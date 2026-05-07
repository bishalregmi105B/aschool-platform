"""add designer templates table

Revision ID: 9d4d0b8f3c21
Revises: b7e2a1f3c849
Create Date: 2026-04-28 08:15:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "9d4d0b8f3c21"
down_revision = "b7e2a1f3c849"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "designer_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=True),
        sa.Column("template_key", sa.String(150), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("editor_type", sa.String(50), nullable=False, server_default="designer"),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("page_size", sa.String(50), server_default="A4"),
        sa.Column("thumbnail_emoji", sa.String(20), server_default="📄"),
        sa.Column("thumbnail_url", sa.Text, server_default=""),
        sa.Column("width", sa.Integer, server_default="794"),
        sa.Column("height", sa.Integer, server_default="1123"),
        sa.Column("page_count", sa.Integer, server_default="1"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("fields", postgresql.JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("canvas_json", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("writer_json", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("extra_config", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.UniqueConstraint("school_id", "template_key", name="uq_designer_templates_school_key"),
    )
    op.create_index("idx_designer_templates_school", "designer_templates", ["school_id"])
    op.create_index("idx_designer_templates_category", "designer_templates", ["category"])


def downgrade():
    op.drop_index("idx_designer_templates_category", table_name="designer_templates")
    op.drop_index("idx_designer_templates_school", table_name="designer_templates")
    op.drop_table("designer_templates")