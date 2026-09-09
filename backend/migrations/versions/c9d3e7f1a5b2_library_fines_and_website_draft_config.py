"""L-01 fix: library fines + website draft/live columns.

Two production 500s traced to model/schema drift:

1. book_issues.fine_amount / fine_paid — `_issue_dict` serializes
   `i.fine_amount` on every /library/issues GET, and return_book writes it,
   but the columns only ever existed on the legacy BookTransaction table.
   Any issues list with >=1 row 500ed, and returned fines were silently
   discarded.

2. website_pages.draft_config — the W-02 draft/live autosave feature reads
   and writes page.draft_config (also publish-draft / revert-draft /
   history), but the column only exists on school_websites. Every editor
   autosave 500ed.

Revision ID: c9d3e7f1a5b2
Revises: b8f2c7d1e6a3
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c9d3e7f1a5b2"
down_revision = "b8f2c7d1e6a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "book_issues",
        sa.Column("fine_amount", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "book_issues",
        sa.Column("fine_paid", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "website_pages",
        sa.Column("draft_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("website_pages", "draft_config")
    op.drop_column("book_issues", "fine_paid")
    op.drop_column("book_issues", "fine_amount")
