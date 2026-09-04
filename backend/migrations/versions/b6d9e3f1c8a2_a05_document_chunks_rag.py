"""A-05: document_chunks — pgvector RAG store (the 100%-unused vector
extension finally ships).

Hybrid retrieval store: HNSW cosine on embeddings + GIN tsvector for BM25.
Multi-tenant filter `school_id =` is MANDATORY in the retrieval service.

Revision ID: b6d9e3f1c8a2
Revises: a3c8e2f5b7d9
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b6d9e3f1c8a2"
down_revision = "a3c8e2f5b7d9"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.Enum("curriculum", "textbook", "notice", "policy", "past_paper", "lesson", name="chunk_source_type"), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("text_ne", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f("fk_document_chunks_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_document_chunks")),
    )
    op.create_index("ix_document_chunks_school_source", "document_chunks", ["school_id", "source_type"])
    op.create_index("ix_document_chunks_source_id", "document_chunks", ["source_id"])

    # vector column + indexes via raw SQL (alembic has no pgvector type)
    # bge-m3 / multilingual-e5 class: 1024 dims, cosine (HNSW)
    op.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(1024)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw "
        "ON document_chunks USING hnsw (embedding_vec vector_cosine_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_tsv "
        "ON document_chunks USING gin (to_tsvector('simple', text))"
    )


def downgrade():
    op.drop_table("document_chunks")
    op.execute("DROP TYPE IF EXISTS chunk_source_type")
