"""Assignment models."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Assignment(SchoolModel):
    __tablename__ = "assignments"

    title = Column(String(500), nullable=False)
    description = Column(Text)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    due_date = Column(DateTime, nullable=False)
    total_marks = Column(Integer)
    attachment_urls = Column(ARRAY(Text))
    is_published = Column(Boolean, default=True)

    klass = relationship("Class")
    section = relationship("Section")
    subject = relationship("Subject")
    teacher = relationship("User")
    submissions = relationship("AssignmentSubmission", back_populates="assignment")


class AssignmentSubmission(SchoolModel):
    __tablename__ = "assignment_submissions"

    assignment_id = Column(
        UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False
    )
    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    content = Column(Text)
    attachment_urls = Column(ARRAY(Text))
    submitted_at = Column(DateTime)
    is_late = Column(Boolean, default=False)
    marks = Column(Numeric(6, 2))
    feedback = Column(Text)
    ai_feedback = Column(Text)
    graded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    graded_at = Column(DateTime)
    status = Column(
        Enum("submitted", "graded", "returned", name="submission_status"),
        default="submitted",
    )

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("Student", backref="assignment_submissions")
    graded_by = relationship("User")
