"""Digital content models: DigitalBook, OERResource, PastPaper."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class DigitalBook(SchoolModel):
    __tablename__ = "digital_books"

    title = Column(String(500), nullable=False)
    author = Column(String(300))
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    file_url = Column(Text, nullable=False)
    cover_url = Column(Text)
    file_type = Column(String(10))  # pdf, epub
    pages = Column(Integer)
    is_approved = Column(Boolean, default=False)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    subject = relationship("Subject")
    uploaded_by = relationship("User")


class PastPaper(SchoolModel):
    __tablename__ = "past_papers"

    title = Column(String(500), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    exam_type = Column(String(50))  # see, neb, internal
    year = Column(String(10))
    file_url = Column(Text, nullable=False)
    answer_key_url = Column(Text)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    subject = relationship("Subject")
    uploaded_by = relationship("User")


class OERResource(SchoolModel):
    __tablename__ = "oer_resources"

    title = Column(String(500), nullable=False)
    description = Column(Text)
    resource_type = Column(String(50))  # video, article, simulation
    url = Column(Text, nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    tags = Column(ARRAY(String))
    is_approved = Column(Boolean, default=False)

    subject = relationship("Subject")
