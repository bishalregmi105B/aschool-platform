"""Student diary models."""
from sqlalchemy import ARRAY, Boolean, Column, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class DiaryCategory(SchoolModel):
    __tablename__ = "diary_categories"

    name = Column(String(100), nullable=False)
    color = Column(String(20), default="blue")
    active = Column(Boolean, default=True)


class DiaryEntry(SchoolModel):
    __tablename__ = "diary_entries"

    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("diary_categories.id"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    entry_date = Column(Date)
    attachment_urls = Column(ARRAY(Text))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_published = Column(Boolean, default=True)

    category = relationship("DiaryCategory")
    student = relationship("Student")
    klass = relationship("Class")
    section = relationship("Section")
    created_by = relationship("User")
