"""DesignerDocument model — persisted canvas states for Docs & Designer plugin."""
import uuid

from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import SchoolModel


class DesignerDocument(SchoolModel):
    """A single saved canvas document (certificate, ID card, notice, etc.)."""

    __tablename__ = "designer_documents"

    created_by_id = Column(UUID(as_uuid=True), nullable=False)
    name          = Column(String(300), nullable=False)
    template_type = Column(String(100), default="custom")   # certificate|id_card|notice|report_card|…
    canvas_state  = Column(JSONB, default=dict)             # full fabric.js / element JSON
    thumbnail_url = Column(Text, default="")

    def to_dict(self):
        return {
            "id":            str(self.id),
            "school_id":     str(self.school_id),
            "created_by_id": str(self.created_by_id),
            "name":          self.name,
            "template_type": self.template_type,
            "canvas_state":  self.canvas_state,
            "thumbnail_url": self.thumbnail_url,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
        }
