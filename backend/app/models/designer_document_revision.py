"""DesignerDocumentRevision — version history rows for designer documents.

Created automatically by DocumentStoreService.save_document on every update
(previous state snapshot); capped at 10 per document (FIFO).
"""
import uuid

from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import SchoolModel


class DesignerDocumentRevision(SchoolModel):
    __tablename__ = "designer_document_revisions"

    document_id   = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_by_id = Column(UUID(as_uuid=True), nullable=True)
    name          = Column(String(300), nullable=True)
    canvas_state  = Column(JSONB, default=dict)
    thumbnail_url = Column(Text, default="")

    def to_dict(self):
        return {
            "id":            str(self.id),
            "document_id":   str(self.document_id),
            "name":          self.name,
            "thumbnail_url": self.thumbnail_url,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }
