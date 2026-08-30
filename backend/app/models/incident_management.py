"""Incident Management extension models — escalation + workflow audit (E41).

`incidents` (starter) is the base reporting tier: Incident, WitnessStatement
and IncidentAction already live in `app.models.incident` and are reused — the
management tier ADDS workflow (assignment, status transitions with an audit
trail), escalation metadata and parent-conference tracking on top. Base
routes are not duplicated anywhere in the management blueprint.
"""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class IncidentEscalation(SchoolModel):
    """One escalation event on an incident (severity bump + who it went to).

    An incident can be escalated multiple times (e.g. high → critical);
    the latest row is the live escalation state surfaced on the escalations
    page. `conference_scheduled` lives here because the parent conference is
    booked *for* an escalation.
    """
    __tablename__ = "incident_escalations"

    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False, index=True
    )
    escalated_by_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # principal / management / specific staff member (nullable → school admins)
    escalated_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    escalated_to_role = Column(String(50))
    severity_before = Column(String(20))
    severity_after = Column(String(20))
    reason = Column(Text)
    conference_scheduled = Column(Boolean, default=False, nullable=False)
    conference_scheduled_at = Column(DateTime)
    conference_notes = Column(Text)

    escalated_by = relationship("User", foreign_keys=[escalated_by_id])
    escalated_to = relationship("User", foreign_keys=[escalated_to_id])
    incident = relationship("Incident", backref="escalations")


class IncidentWorkflowEvent(SchoolModel):
    """Append-only audit trail for management actions on an incident:
    assignment, status transitions, escalations, resolutions, conferences."""
    __tablename__ = "incident_workflow_events"

    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False, index=True
    )
    # created | assign | status_change | escalate | resolve | conference
    event_type = Column(String(50), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    from_value = Column(String(100))
    to_value = Column(String(100))
    # free-form context: witness names reported with the case, escalation
    # reasons, resolution notes pointers, etc.
    notes = Column(Text)

    actor = relationship("User")
