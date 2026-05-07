"""Dismissal models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class AuthorizedPickup(SchoolModel):
    __tablename__ = "authorized_pickups"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    name = Column(String(300), nullable=False)
    relation = Column(String(100))
    phone = Column(String(20), nullable=False)
    photo_url = Column(Text)
    id_document_url = Column(Text)
    is_active = Column(Boolean, default=True)
    authorized_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    student = relationship("Student", backref="authorized_pickups")
    authorized_by = relationship("User")


class DismissalRecord(SchoolModel):
    __tablename__ = "dismissal_records"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    picked_up_by = Column(String(300))
    pickup_id = Column(UUID(as_uuid=True), ForeignKey("authorized_pickups.id"))
    qr_verified = Column(Boolean, default=False)
    dismissed_at = Column(DateTime)
    dismissed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    student = relationship("Student", backref="dismissal_records")
    pickup_person = relationship("AuthorizedPickup")
    dismissed_by = relationship("User")
