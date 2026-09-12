"""AOS experience: per-user desktop state (theme, dock, widgets, folders).

Revision ID: s_a6_user_aos_settings
Revises: s_a5b_payment_context
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "s_a6_user_aos_settings"
down_revision = "s_a5b_payment_context"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_aos_settings",
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("theme_mode", sa.String(length=10), nullable=False, server_default="dark"),
        sa.Column("accent_color", sa.String(length=20), nullable=False, server_default="#0078d4"),
        sa.Column("wallpaper", sa.String(length=200), nullable=False, server_default="bloom-dark"),
        sa.Column("brightness", sa.String(length=10), nullable=False, server_default="100"),
        sa.Column("dock_style", sa.String(length=10), nullable=False, server_default="mac"),
        sa.Column("dock_size", sa.String(length=10), nullable=False, server_default="medium"),
        sa.Column("show_top_bar", sa.String(length=10), nullable=False, server_default="true"),
        sa.Column("top_bar_height", sa.String(length=10), nullable=False, server_default="standard"),
        sa.Column("blur_intensity", sa.String(length=10), nullable=False, server_default="30"),
        sa.Column("taskbar_align", sa.String(length=10), nullable=False, server_default="center"),
        sa.Column("system_mode", sa.String(length=10), nullable=False, server_default=""),
        sa.Column("pinned_apps", JSONB, nullable=False, server_default="[]"),
        sa.Column("desktop_folders", JSONB, nullable=False, server_default="[]"),
        sa.Column("home_widgets", JSONB, nullable=False, server_default="[]"),
        # BaseModel columns
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("user_id", name="uq_user_aos_settings_user"),
    )
    op.create_index("ix_user_aos_settings_user_id", "user_aos_settings", ["user_id"])
    op.create_foreign_key(
        "fk_user_aos_settings_user",
        "user_aos_settings",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint("fk_user_aos_settings_user", "user_aos_settings", type_="foreignkey")
    op.drop_index("ix_user_aos_settings_user_id", table_name="user_aos_settings")
    op.drop_table("user_aos_settings")
