"""Textbook and grounding schema: preserves physical textbook provenance,
page numbers, bounding boxes, and multimodal assets for CDC publications.
"""

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class TextbookCorpus(BaseModel):
    """Represents an official physical textbook published by CDC/Sanothimi."""

    __tablename__ = "textbook_corpora"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )
    framework_id = Column(
        UUID(as_uuid=True),
        ForeignKey("curriculum_frameworks.id"),
        nullable=True,
        index=True,
    )

    title_en = Column(String(300), nullable=False)
    title_ne = Column(String(300), nullable=False)
    grade = Column(String(20), nullable=False, index=True)  # "1".."12"
    subject_code = Column(String(50), nullable=False, index=True)
    edition_bs = Column(String(20), nullable=True)  # e.g., "2081", "2082"
    edition_ad = Column(Integer, nullable=True)  # e.g., 2024
    language = Column(String(20), nullable=False, default="ne")  # "ne", "en", "bilingual"
    source_pdf_path = Column(Text, nullable=False)
    total_pages = Column(Integer, nullable=False, default=0)
    file_size_bytes = Column(Integer, nullable=True)
    is_translation = Column(Boolean, default=False, nullable=False)  # Translated edition
    font_encoding = Column(
        String(30), default="unicode", nullable=False
    )  # "unicode", "preeti", "scanned"
    is_teacher_guide = Column(Boolean, default=False, nullable=False)
    is_spec_grid = Column(Boolean, default=False, nullable=False)

    chapters = relationship(
        "TextbookChapter", backref="textbook", cascade="all, delete-orphan"
    )
    pages = relationship(
        "TextbookPage", backref="textbook", cascade="all, delete-orphan"
    )


class TextbookPage(BaseModel):
    """Physical page indexing for bounding-box grounding and high-res rendering."""

    __tablename__ = "textbook_pages"

    textbook_id = Column(
        UUID(as_uuid=True),
        ForeignKey("textbook_corpora.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_number = Column(Integer, nullable=False)  # 1-indexed physical PDF page
    printed_page_number = Column(String(20), nullable=True)  # Page printed in header/footer
    width_pts = Column(Numeric(7, 2), nullable=False, default=595.0)
    height_pts = Column(Numeric(7, 2), nullable=False, default=842.0)
    raw_text_extracted = Column(Text, nullable=True)
    unicode_clean_text = Column(Text, nullable=True)  # Normalized Unicode UTF-8
    has_equations = Column(Boolean, default=False, nullable=False)
    has_diagrams = Column(Boolean, default=False, nullable=False)
    image_storage_path = Column(Text, nullable=True)  # 300 DPI WebP path

    assets = relationship(
        "TextbookAsset", backref="page", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("textbook_id", "page_number", name="uq_textbook_page_no"),
    )


class TextbookChapter(BaseModel):
    """Hierarchical chapter/unit structure reflecting the physical textbook."""

    __tablename__ = "textbook_chapters"

    textbook_id = Column(
        UUID(as_uuid=True),
        ForeignKey("textbook_corpora.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    curriculum_unit_id = Column(
        UUID(as_uuid=True), ForeignKey("curriculum_units.id"), nullable=True, index=True
    )

    chapter_no = Column(Integer, nullable=False)
    title_en = Column(String(300), nullable=False)
    title_ne = Column(String(300), nullable=False)
    page_start = Column(Integer, nullable=False)
    page_end = Column(Integer, nullable=False)

    sections = relationship(
        "TextbookSection", backref="chapter", cascade="all, delete-orphan"
    )


class TextbookSection(BaseModel):
    """Sub-chapter sections containing prose, definitions, theorems, and exercises."""

    __tablename__ = "textbook_sections"

    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("textbook_chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teaching_section_id = Column(
        UUID(as_uuid=True), ForeignKey("teaching_sections.id"), nullable=True, index=True
    )

    section_no = Column(String(30), nullable=False)  # e.g., "1.2", "4.3.1"
    title_en = Column(String(300), nullable=False)
    title_ne = Column(String(300), nullable=False)
    page_start = Column(Integer, nullable=False)
    page_end = Column(Integer, nullable=False)


class TextbookAsset(BaseModel):
    """Extracted visual diagrams, geometry proofs, circuits, and map clippings."""

    __tablename__ = "textbook_assets"

    textbook_id = Column(
        UUID(as_uuid=True),
        ForeignKey("textbook_corpora.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_id = Column(
        UUID(as_uuid=True),
        ForeignKey("textbook_pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    asset_type = Column(
        String(30), nullable=False
    )  # "geometry", "circuit", "anatomy", "chart", "map", "formula_block"
    bbox_json = Column(JSONB, nullable=False)  # [ymin, xmin, ymax, xmax] normalized 0..1000
    caption_en = Column(Text, nullable=True)
    caption_ne = Column(Text, nullable=True)
    image_storage_path = Column(Text, nullable=False)
    svg_vector_path = Column(Text, nullable=True)  # Inline SVG for geometry/circuits
    vision_description = Column(Text, nullable=True)  # AI-generated visual description
