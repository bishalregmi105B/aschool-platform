"""W0-close: migrate legacy plugin rows to canonical slugs

The AI bundle (E230) and the library/portfolio/communications merges left
schools holding SchoolPlugin rows under deprecated slugs. The alias table
kept every gate passing, but the mirror kept offering stale catalog rows and
the DB told a lie about what a school owns. This revision rewrites rows to
their canonical slug (merging duplicates: a school holding both ai_tools and
ai_suite keeps exactly one ai_suite row, active if either was), then the
deprecated ai_adaptive_learning manifest is deleted in the same change.

Downgrade does NOT resurrect legacy rows — the alias table still resolves
canonical slugs for any code path that asks by a legacy name.

Revision ID: b9f3a6c1d7e2
Revises: c7d2e9f4a8b3
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "b9f3a6c1d7e2"
down_revision = "c7d2e9f4a8b3"
branch_labels = None
depends_on = None

# legacy slug → canonical slug (mirrors decorators.PLUGIN_SLUG_ALIASES)
LEGACY_TO_CANONICAL = {
    "ai_grading": "ai_suite",
    "ai_tutor": "ai_suite",
    "ai_tools": "ai_suite",
    "ai_adaptive_learning": "ai_suite",
    "ai_insights": "ai_suite",
    "benchmarking": "ai_suite",
    "advanced_analytics": "ai_suite",
    "library": "library_management",
    "digital_content": "elibrary",
    "portfolio": "student_portfolio",
    "communications": "sms_notifications",
    "hr": "hr_payroll",
    "transport": "gps_tracking",
    "visitors": "visitor_management",
}


def upgrade():
    bind = op.get_bind()
    for legacy, canonical in LEGACY_TO_CANONICAL.items():
        rows = bind.execute(
            sa.text(
                "SELECT id, school_id, active, uninstalled_at FROM school_plugins "
                "WHERE plugin_slug = :legacy"
            ),
            {"legacy": legacy},
        ).fetchall()
        for row in rows:
            existing = bind.execute(
                sa.text(
                    "SELECT id, active, uninstalled_at FROM school_plugins "
                    "WHERE school_id = :school AND plugin_slug = :canonical "
                    "ORDER BY active DESC, id LIMIT 1"
                ),
                {"school": row.school_id, "canonical": canonical},
            ).fetchone()
            if existing is None:
                bind.execute(
                    sa.text(
                        "UPDATE school_plugins SET plugin_slug = :canonical "
                        "WHERE id = :id"
                    ),
                    {"canonical": canonical, "id": row.id},
                )
            else:
                # Merge: keep the canonical row; make it active if either was.
                if row.active and not existing.active:
                    bind.execute(
                        sa.text(
                            "UPDATE school_plugins SET active = true, "
                            "uninstalled_at = NULL WHERE id = :id"
                        ),
                        {"id": existing.id},
                    )
                bind.execute(
                    sa.text("DELETE FROM school_plugins WHERE id = :id"),
                    {"id": row.id},
                )


def downgrade():
    # No-op by design: canonical rows are strictly more truthful than the
    # legacy ones, and the alias table still accepts legacy names.
    pass
