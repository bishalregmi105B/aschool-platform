"""Emergency models."""
from sqlalchemy import (
    ARRAY,
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


class EmergencyAlert(SchoolModel):
    __tablename__ = "emergency_alerts"

    alert_type = Column(
        Enum(
            "earthquake",
            "fire",
            "flood",
            "lockdown",
            "medical",
            "drill",
            "other",
            name="emergency_type",
        ),
        nullable=False,
    )
    title = Column(String(300), nullable=False)
    description = Column(Text)
    triggered_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    triggered_at = Column(DateTime)
    resolved_at = Column(DateTime)
    status = Column(
        Enum("active", "resolved", "false_alarm", name="alert_status"),
        default="active",
    )
    sms_sent = Column(Boolean, default=False)
    push_sent = Column(Boolean, default=False)

    triggered_by = relationship("User")


class EvacuationPlan(SchoolModel):
    __tablename__ = "evacuation_plans"

    name = Column(String(200), nullable=False)
    emergency_type = Column(String(50))
    instructions = Column(Text)
    assembly_points = Column(JSONB, default=list)
    floor_plan_url = Column(Text)
    last_drilled_at = Column(DateTime)
    is_active = Column(Boolean, default=True)


class EmergencyHeadcount(SchoolModel):
    __tablename__ = "emergency_headcounts"

    alert_id = Column(
        UUID(as_uuid=True), ForeignKey("emergency_alerts.id"), nullable=False
    )
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    total_expected = Column(Integer)
    total_present = Column(Integer)
    missing_student_ids = Column(ARRAY(UUID(as_uuid=True)))
    submitted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    submitted_at = Column(DateTime)

    alert = relationship("EmergencyAlert", backref="headcounts")
    submitted_by = relationship("User")
