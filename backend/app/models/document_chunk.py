"""A-05: document chunk for hybrid RAG retrieval (pgvector + BM25).

The embedding lives in `embedding_vec` (vector(1024), HNSW cosine) created
by raw SQL in the migration — alembic has no pgvector type. All reads MUST
filter school_id (tenant isolation, CI gate d).
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import BaseModel, SchoolModel


class DocumentChunk(BaseModel):
    """RAG chunk. school_id NULL = platform content (PD framework, CDC
    policy) — retrievable by every school alongside its own rows."""

    __tablename__ = "document_chunks"

    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    source_type = Column(
        String(30), nullable=False
    )  # curriculum|textbook|notice|policy|past_paper|lesson
    source_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    text_ne = Column(Text)
    # embedding_vec column exists in the DB but is intentionally not mapped —
    # vector math goes through raw SQL in services/ai/rag.py
    metadata_json = Column(JSONB, default=dict)
