"""Wellbeing models: MoodCheckin, WellbeingSurvey, CounselorSession."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class MoodCheckin(SchoolModel):
    __tablename__ = "mood_checkins"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    mood = Column(
        Enum("happy", "okay", "sad", "anxious", "angry", name="mood_type"),
        nullable=False,
    )
    note = Column(Text)
    checked_in_at = Column(DateTime)

    student = relationship("Student", backref="mood_checkins")


class WellbeingSurvey(SchoolModel):
    __tablename__ = "wellbeing_surveys"

    title = Column(String(300), nullable=False)
    questions = Column(JSONB, default=list)
    target_class_ids = Column(JSONB, default=list)
    is_anonymous = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    starts_at = Column(DateTime)
    ends_at = Column(DateTime)
    response_count = Column(Integer, default=0)


class WellbeingSurveyResponse(SchoolModel):
    __tablename__ = "wellbeing_survey_responses"

    survey_id = Column(
        UUID(as_uuid=True), ForeignKey("wellbeing_surveys.id"), nullable=False
    )
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    answers = Column(JSONB, default=dict)
    submitted_at = Column(DateTime)

    survey = relationship("WellbeingSurvey", backref="responses")
    student = relationship("Student")


class CounselorSession(SchoolModel):
    __tablename__ = "counselor_sessions"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    counselor_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    scheduled_at = Column(DateTime)
    duration_mins = Column(Integer)
    notes = Column(Text)
    follow_up_needed = Column(Boolean, default=False)
    follow_up_date = Column(DateTime)
    status = Column(
        Enum("scheduled", "completed", "cancelled", "no_show", name="session_status"),
        default="scheduled",
    )

    student = relationship("Student", backref="counselor_sessions")


class MoodEntry(SchoolModel):
    __tablename__ = "mood_entries"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    mood = Column(String(20), nullable=False)  # happy, neutral, sad, anxious, angry
    energy_level = Column(Integer)  # 1-5
    notes = Column(Text)

    student = relationship("Student", backref="mood_entries")


class CounselorNote(SchoolModel):
    __tablename__ = "counselor_notes"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    counselor_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    note_type = Column(String(50), default="general")
    content = Column(Text, nullable=False)
    is_confidential = Column(Boolean, default=True)

    student = relationship("Student", backref="counselor_notes")
    counselor = relationship("User")
    counselor = relationship("User")
