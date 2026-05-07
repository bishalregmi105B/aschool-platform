"""Conference models: PTConference, TimeSlot."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SAEnum

from app.models.base import SchoolModel


class PTConference(SchoolModel):
    __tablename__ = "pt_conferences"

    title = Column(String(300), nullable=False)
    description = Column(Text)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    is_virtual = Column(Boolean, default=False)
    meeting_link = Column(Text)
    is_active = Column(Boolean, default=True)


class ConferenceSlot(SchoolModel):
    __tablename__ = "conference_slots"

    conference_id = Column(
        UUID(as_uuid=True), ForeignKey("pt_conferences.id"), nullable=False
    )
    teacher_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_mins = Column(Integer, default=15)
    is_booked = Column(Boolean, default=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))

    conference = relationship("PTConference", backref="slots")
    teacher = relationship("User", foreign_keys=[teacher_id])
    parent = relationship("User", foreign_keys=[parent_id])
    student = relationship("Student")


class ConferenceNotes(SchoolModel):
    __tablename__ = "conference_notes"

    slot_id = Column(
        UUID(as_uuid=True), ForeignKey("conference_slots.id"), nullable=False
    )
    notes = Column(Text)
    action_items = Column(Text)
    follow_up_needed = Column(Boolean, default=False)
    follow_up_date = Column(DateTime)

    slot = relationship("ConferenceSlot", backref="notes_record")
