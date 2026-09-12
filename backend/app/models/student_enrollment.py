"""A-31: multi-year student enrollment records (the InfixEdu student_records
idea, rebuilt for ASchool).

One row per (student, academic year): the immutable yearly history — class,
section, roll number, promote state. `students` keeps being the live profile;
`student_enrollments` is the year-axis ledger marks/attendance/fees will
re-point to incrementally (enrollment_id columns land nullable first).
"""
import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class StudentEnrollment(SchoolModel):
    __tablename__ = "student_enrollments"
    __table_args__ = (
        UniqueConstraint(
            "school_id", "student_id", "academic_year_id",
            name="uq_student_enrollments_student_year",
        ),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), index=True)
    academic_year_label = Column(String(10))   # "2083" BS label for display
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    roll_number = Column(Integer)
    is_promoted = Column(Boolean, default=False)   # superseded by a later year
    is_default = Column(Boolean, default=False)    # the current record
    is_graduated = Column(Boolean, default=False)
    # InfixEdu's promotion snapshot (previous/current rolls, result status)
    promoted_from_enrollment_id = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"))
    meta = Column(JSONB, default=dict)

    student = relationship("Student", backref="enrollments")
    klass = relationship("Class")
    section = relationship("Section")
    academic_year = relationship("AcademicYear")


class PromotionRecord(SchoolModel):
    """Immutable snapshot of one promotion action (who, from→to, rolls,
    operator) — the audit artifact InfixEdu kept and we lacked."""

    __tablename__ = "promotion_records"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    from_enrollment_id = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"))
    to_enrollment_id = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"))
    from_class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    to_class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    from_roll_number = Column(Integer)
    to_roll_number = Column(Integer)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    meta = Column(JSONB, default=dict)
