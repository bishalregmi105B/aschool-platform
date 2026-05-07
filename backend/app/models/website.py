"""Website builder models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class WebsitePage(SchoolModel):
    __tablename__ = "website_pages"

    school_id_override = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), index=True
    )
    title = Column(String(300), nullable=False)
    slug = Column(String(100), nullable=False)
    content = Column(JSONB, default=dict)  # Craft.js serialized
    sections = Column(JSONB, default=list)  # [{slug, category, settings, data}]
    is_published = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    page_type = Column(String(50))  # home, about, contact, gallery, custom
    meta_title = Column(String(200))
    meta_description = Column(Text)
    seo_title = Column(String(200))
    seo_description = Column(Text)
    og_image_url = Column(Text)
    custom_css = Column(Text)


class WebsiteTheme(SchoolModel):
    __tablename__ = "website_themes"

    slug = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    thumbnail_url = Column(Text)
    preview_url = Column(Text)
    category = Column(String(50))  # modern, traditional, minimal, colorful
    is_premium = Column(Boolean, default=False)
    config_schema = Column(JSONB, default=dict)
    default_config = Column(JSONB, default=dict)
    version = Column(String(10), default="1.0.0")


class WebsiteForm(SchoolModel):
    __tablename__ = "website_forms"

    title = Column(String(200), nullable=False)
    form_type = Column(String(50))  # contact, admission_inquiry, feedback
    fields = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)
    submissions_count = Column(Integer, default=0)


class WebsiteFormSubmission(SchoolModel):
    __tablename__ = "website_form_submissions"

    form_id = Column(
        UUID(as_uuid=True), ForeignKey("website_forms.id"), nullable=False
    )
    data = Column(JSONB, default=dict)
    ip_address = Column(String(45))
    submitted_at = Column(DateTime)
    is_read = Column(Boolean, default=False)

    form = relationship("WebsiteForm", backref="submissions")
