"""designer_document_revisions — last-10 version history for designer docs

Every save of a DesignerDocument now snapshots the previous canvas_state into
designer_document_revisions (kept at 10 per document, FIFO). The designer hub
exposes restore. Table follows the SchoolModel convention (id/school_id/
created_at/updated_at).

Revision ID: c7d9e1f3a5b2
Revises: e5b7c1d9a3f8
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c7d9e1f3a5b2"
down_revision = "e5b7c1d9a3f8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "designer_document_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=True),
        sa.Column("canvas_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["designer_documents.id"],
            name=op.f("fk_designer_document_revisions_document_id_designer_documents"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_designer_document_revisions")),
    )
    op.create_index(
        op.f("ix_designer_document_revisions_school_id"),
        "designer_document_revisions",
        ["school_id"],
    )
    op.create_index(
        op.f("ix_designer_document_revisions_document_id"),
        "designer_document_revisions",
        ["document_id"],
    )


def downgrade():
    op.drop_index(op.f("ix_designer_document_revisions_document_id"), table_name="designer_document_revisions")
    op.drop_index(op.f("ix_designer_document_revisions_school_id"), table_name="designer_document_revisions")
    op.drop_table("designer_document_revisions")
