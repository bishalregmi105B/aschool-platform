"""DesignerTemplate model — school-scoped reusable document templates."""

from sqlalchemy import Boolean, Column, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import BaseModel


class DesignerTemplate(BaseModel):
    """Persisted template definition for canvas and writer documents."""

    __tablename__ = "designer_templates"
    __table_args__ = (
        UniqueConstraint("school_id", "template_key", name="uq_designer_templates_school_key"),
    )

    school_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    template_key = Column(String(150), nullable=False, index=True)
    name = Column(String(300), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    editor_type = Column(String(50), default="designer", nullable=False)
    description = Column(Text, default="")
    page_size = Column(String(50), default="A4")
    thumbnail_emoji = Column(String(20), default="📄")
    thumbnail_url = Column(Text, default="")
    width = Column(Integer, default=794)
    height = Column(Integer, default=1123)
    page_count = Column(Integer, default=1)
    is_default = Column(Boolean, default=False)
    fields = Column(JSONB, default=list)
    canvas_json = Column(JSONB, default=dict)
    writer_json = Column(JSONB, default=dict)
    extra_config = Column(JSONB, default=dict)

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id) if self.school_id else None,
            "template_key": self.template_key,
            "name": self.name,
            "category": self.category,
            "editor_type": self.editor_type,
            "description": self.description or "",
            "page_size": self.page_size or "A4",
            "thumbnail_emoji": self.thumbnail_emoji or "📄",
            "thumbnail_url": self.thumbnail_url or "",
            "width": self.width or 794,
            "height": self.height or 1123,
            "page_count": self.page_count or 1,
            "is_default": bool(self.is_default),
            "fields": self.fields or [],
            "canvas_json": self.canvas_json or {},
            "writer_json": self.writer_json or {},
            "extra_config": self.extra_config or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }