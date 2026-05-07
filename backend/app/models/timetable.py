"""Timetable models."""
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Timetable(SchoolModel):
    __tablename__ = "timetables"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    academic_year = Column(String(10))
    is_active = Column(Boolean, default=True)

    klass = relationship("Class", backref="timetables")
    section = relationship("Section", backref="timetables")
    periods = relationship("TimetablePeriod", back_populates="timetable")


class TimetablePeriod(SchoolModel):
    __tablename__ = "timetable_periods"

    timetable_id = Column(
        UUID(as_uuid=True), ForeignKey("timetables.id"), nullable=False
    )
    day = Column(String(10), nullable=False)  # Sunday, Monday, etc.
    period_number = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    room = Column(String(50))
    is_break = Column(Boolean, default=False)

    timetable = relationship("Timetable", back_populates="periods")
    subject = relationship("Subject")
    teacher = relationship("User")


class Substitution(SchoolModel):
    __tablename__ = "substitutions"

    period_id = Column(
        UUID(as_uuid=True), ForeignKey("timetable_periods.id"), nullable=False
    )
    original_teacher_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    substitute_teacher_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    date = Column(String(10), nullable=False)
    reason = Column(String(200))
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    period = relationship("TimetablePeriod", backref="substitutions")
    original_teacher = relationship("User", foreign_keys=[original_teacher_id])
    substitute_teacher = relationship("User", foreign_keys=[substitute_teacher_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class TimetableSlot(SchoolModel):
    """Flat timetable slot for plugin API — one row per class/section/day/period."""
    __tablename__ = "timetable_slots"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    day_of_week = Column(String(10), nullable=False)  # Sunday, Monday, etc.
    period_number = Column(Integer, nullable=False)
    start_time = Column(Time)
    end_time = Column(Time)
    room = Column(String(50))
    is_break = Column(Boolean, default=False)

    klass = relationship("Class")
    section = relationship("Section")
    subject = relationship("Subject")
    teacher = relationship("User")
