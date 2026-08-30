"""Incident models."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Incident(SchoolModel):
    __tablename__ = "incidents"

    title = Column(String(300), nullable=False)
    description = Column(Text)
    incident_type = Column(
        Enum(
            "bullying",
            "fighting",
            "vandalism",
            "theft",
            "medical",
            "behavioral",
            "other",
            name="incident_type",
        ),
        nullable=False,
    )
    severity = Column(
        Enum("low", "medium", "high", "critical", name="incident_severity"),
        default="medium",
    )
    occurred_at = Column(DateTime)
    location = Column(String(200))
    reported_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    involved_student_ids = Column(ARRAY(UUID(as_uuid=True)))
    status = Column(
        Enum("reported", "investigating", "resolved", "closed", name="incident_status"),
        default="reported",
    )
    resolution = Column(Text)
    resolved_at = Column(DateTime)

    # ── incident_management extension (E41): workflow columns ──────────────
    # Staff member the case is assigned to (management-tier assign endpoint).
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    # Latest escalation pointer (full history in IncidentEscalation).
    escalated_at = Column(DateTime)
    escalated_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    parent_notified = Column(Boolean, default=False)
    conference_scheduled = Column(Boolean, default=False)
    conference_scheduled_at = Column(DateTime)

    # Multiple users FKs live on this table (reported_by_id, assigned_to_id,
    # escalated_to_id), so every User relationship must pin its column.
    reported_by = relationship("User", foreign_keys=[reported_by_id])
    assignee = relationship("User", foreign_keys=[assigned_to_id])
    escalation_target = relationship("User", foreign_keys=[escalated_to_id])


class WitnessStatement(SchoolModel):
    __tablename__ = "witness_statements"

    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False
    )
    witness_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    statement = Column(Text, nullable=False)
    recorded_at = Column(DateTime)

    incident = relationship("Incident", backref="witness_statements")
    witness = relationship("User")


class IncidentAction(SchoolModel):
    __tablename__ = "incident_actions"

    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False
    )
    action_type = Column(String(100))  # warning, suspension, counseling, parent_meeting
    description = Column(Text)
    taken_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    taken_at = Column(DateTime)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))

    incident = relationship("Incident", backref="actions")
    taken_by = relationship("User")
    student = relationship("Student")
