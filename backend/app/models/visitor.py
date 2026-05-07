"""Visitor management models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Visitor(SchoolModel):
    __tablename__ = "visitors"

    name = Column(String(300), nullable=False)
    phone = Column(String(20))
    email = Column(String(200))
    id_type = Column(String(50))  # citizenship, license, passport
    id_number = Column(String(100))
    photo_url = Column(Text)
    purpose = Column(String(200))
    visiting_staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    checked_in_at = Column(DateTime)
    checked_out_at = Column(DateTime)
    badge_number = Column(String(50))
    notes = Column(Text)
    status = Column(String(20), default="checked_in")  # checked_in, checked_out

    visiting_staff = relationship("User")


class VisitorAppointment(SchoolModel):
    __tablename__ = "visitor_appointments"

    visitor_name = Column(String(300), nullable=False)
    visitor_phone = Column(String(20))
    visitor_email = Column(String(200))
    purpose = Column(String(200))
    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")  # pending, approved, rejected, completed
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    staff = relationship("User", foreign_keys=[staff_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
