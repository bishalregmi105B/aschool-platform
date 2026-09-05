"""Platform RAG chunks: allow school_id NULL for platform-seeded content

The PD-framework seed (services/ai/extensions.seed_pd_framework) inserts
UNESCO ICT-CFT chunks as PLATFORM content — every school should retrieve
them — but document_chunks.school_id was NOT NULL, so the seed failed on
every boot (logged + swallowed) and the content never loaded. Model now
extends BaseModel with a nullable school_id; retrieval includes platform
rows (school_id IS NULL OR = :school_id) with tenant isolation preserved
for school-owned rows.

Revision ID: a7c3e9f1d4b8
Revises: f6b2d8e4c1a9
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c3e9f1d4b8"
down_revision = "f6b2d8e4c1a9"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "document_chunks", "school_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade():
    op.execute("DELETE FROM document_chunks WHERE school_id IS NULL")
    op.alter_column(
        "document_chunks", "school_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
