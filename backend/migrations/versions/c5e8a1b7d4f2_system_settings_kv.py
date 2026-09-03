"""P-02/P-04: system_settings KV table (last_db_backup_at etc.)

Revision ID: c5e8a1b7d4f2
Revises: b4d7e2f9a6c1
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c5e8a1b7d4f2"
down_revision = "b4d7e2f9a6c1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "system_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_system_settings")),
    )
    op.create_index("ix_system_settings_key", "system_settings", ["key"], unique=True)


def downgrade():
    op.drop_index("ix_system_settings_key", table_name="system_settings")
    op.drop_table("system_settings")
