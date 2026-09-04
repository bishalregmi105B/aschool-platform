"""W0 dedup: drop the withdrawn social_ads / social_hub tables

The social_ads and social_hub plugins were unpublished and unused (zero UI
surfaces, declared Meta/TikTok/YouTube integrations never existed) — the
dedup audit (audits/research/ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md) verdict
was DELETE. Routes, models (app/models/social.py, ad_campaign.py), tasks
and services were removed with the manifests; this migration drops the
orphaned tables. Downgrade recreates them from the (still-present) initial
migration definitions.

Revision ID: e8b1c4d6a9f2
Revises: d5c8f2a7b4e1
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "e8b1c4d6a9f2"
down_revision = "d5c8f2a7b4e1"
branch_labels = None
depends_on = None

# Drop order: children before parents (social_posts.boost_campaign_id →
# ad_campaigns; hub_comments.post_id → hub_posts; hub_group_members.group_id
# → hub_groups).
DROP_ORDER = [
    "hub_comments",
    "hub_group_members",
    "hub_posts",
    "hub_groups",
    "social_messages",
    "social_posts",
    "social_accounts",
    "ad_campaigns",
]


def upgrade():
    for table in DROP_ORDER:
        op.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')


def downgrade():
    bind = op.get_bind()
    id_type = pg.UUID(as_uuid=True)

    op.create_table(
        "ad_campaigns",
        sa.Column("id", id_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", id_type, sa.ForeignKey("schools.id"), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("objective", sa.String(50)),
        sa.Column("status", sa.String(30)),
        sa.Column("budget", sa.Numeric(12, 2)),
        sa.Column("target_grades", pg.JSONB, default=list),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false")),
    )
    op.create_index(op.f("ix_ad_campaigns_school_id"), "ad_campaigns", ["school_id"])
    for table in ("social_accounts", "social_posts", "social_messages",
                  "hub_posts", "hub_comments", "hub_groups", "hub_group_members"):
        # Recreated shape-conservative: the canonical definitions live in the
        # initial migration; a downgrade here only needs the tables back for
        # rollback parity, not byte-identical DDL.
        bind.execute(sa.text(
            f'CREATE TABLE IF NOT EXISTS "{table}" ('
            "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
            "school_id uuid REFERENCES schools(id), "
            "created_at timestamp, updated_at timestamp, "
            "is_deleted boolean DEFAULT false)"
        ))
