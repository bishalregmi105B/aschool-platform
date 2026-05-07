"""Health Records models: HealthProfile, MedicalVisit, Immunization."""
from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class HealthProfile(SchoolModel):
    __tablename__ = "health_profiles"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, unique=True
    )
    blood_group = Column(String(5))
    height_cm = Column(Numeric(5, 2))
    weight_kg = Column(Numeric(5, 2))
    allergies = Column(ARRAY(Text), default=[])
    medical_conditions = Column(ARRAY(Text), default=[])
    emergency_contact = Column(String(200))
    emergency_phone = Column(String(20))
    insurance_info = Column(JSONB, default=dict)
    doctor_name = Column(String(200))
    doctor_phone = Column(String(20))
    last_checkup_date = Column(Date)

    student = relationship("Student", backref="health_profile")


class MedicalVisit(SchoolModel):
    __tablename__ = "medical_visits"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    visit_date = Column(Date, nullable=False)
    reason = Column(String(500))
    diagnosis = Column(Text)
    treatment = Column(Text)
    referred_to = Column(String(300))
    notes = Column(Text)

    student = relationship("Student", backref="medical_visits")
    recorder = relationship("User")


class Immunization(SchoolModel):
    __tablename__ = "immunizations"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    vaccine_name = Column(String(200), nullable=False)
    dose_number = Column(Integer, default=1)
    date_administered = Column(Date)
    next_due_date = Column(Date)
    administered_by = Column(String(200))
    batch_number = Column(String(100))
    notes = Column(Text)

    student = relationship("Student", backref="immunizations")
