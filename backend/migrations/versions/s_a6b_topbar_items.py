"""AOS topbar: per-user visible menu bar items.

Revision ID: s_a6b_topbar_items
Revises: s_a6_user_aos_settings
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "s_a6b_topbar_items"
down_revision = "s_a6_user_aos_settings"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_aos_settings",
        sa.Column("topbar_items", JSONB, nullable=False, server_default="[]"),
    )


def downgrade():
    op.drop_column("user_aos_settings", "topbar_items")
