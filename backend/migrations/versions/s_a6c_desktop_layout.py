"""AOS desktop: free-form icon/folder positions + widget layout.

Revision ID: s_a6c_desktop_layout
Revises: s_a6b_topbar_items
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "s_a6c_desktop_layout"
down_revision = "s_a6b_topbar_items"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_aos_settings",
        sa.Column("desktop_layout", JSONB, nullable=False, server_default="{}"),
    )


def downgrade():
    op.drop_column("user_aos_settings", "desktop_layout")
