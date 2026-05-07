"""Alumni network models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Alumni(SchoolModel):
    __tablename__ = "alumni"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    first_name = Column(String(200), nullable=False)
    last_name = Column(String(200), nullable=False)
    email = Column(String(200))
    phone = Column(String(20))
    graduation_year = Column(String(10))
    batch = Column(String(50))
    current_organization = Column(String(300))
    designation = Column(String(200))
    location = Column(String(200))
    bio = Column(Text)
    photo_url = Column(Text)
    linkedin_url = Column(Text)
    is_mentor = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)

    student = relationship("Student")


class AlumniEvent(SchoolModel):
    __tablename__ = "alumni_events"

    title = Column(String(500), nullable=False)
    description = Column(Text)
    event_date = Column(DateTime, nullable=False)
    location = Column(String(300))
    event_type = Column(String(50))  # reunion, meetup, webinar, fundraiser
    max_attendees = Column(Integer)
    registration_open = Column(Boolean, default=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_by = relationship("User")


class AlumniDonation(SchoolModel):
    __tablename__ = "alumni_donations"

    alumni_id = Column(UUID(as_uuid=True), ForeignKey("alumni.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="NPR")
    purpose = Column(String(200))
    payment_method = Column(String(50))
    transaction_ref = Column(String(200))
    donated_at = Column(DateTime)
    receipt_url = Column(Text)
    status = Column(String(20), default="completed")  # pending, completed, refunded

    alumni = relationship("Alumni", backref="donations")
