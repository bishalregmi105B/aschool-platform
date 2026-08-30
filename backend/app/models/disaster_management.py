"""Disaster Management models — drills + drill participation (E40).

The disaster_management plugin (premium, NPR 999) is the premium tier of the
`emergency` plugin: alerts, evacuation plans and headcounts already live in
`app.models.emergency` and are REUSED here (the overview endpoint aggregates
them). What the emergency tier has no storage for is drill scheduling and
per-class drill participation, so those get their own tables here.
"""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class DisasterDrill(SchoolModel):
    """A scheduled/conducted emergency drill (earthquake, fire, flood, ...).

    Distinct from EmergencyAlert(alert_type="drill"): an alert is something
    that happened and needs response; a drill is planned, has a scheduled
    time + duration, and its own lifecycle (scheduled → completed/missed/
    cancelled). Mixing them would pollute the live alert feed and abuse the
    alert status enum (active/resolved/false_alarm).
    """
    __tablename__ = "disaster_drills"

    title = Column(String(300), nullable=False)
    # Free-ish vocabulary validated at the API edge (frontend offers
    # earthquake/fire/flood/general) — String keeps "lockdown" etc. possible
    # without a PG enum migration for every new drill kind.
    drill_type = Column(String(50), default="general")
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer)
    notes = Column(Text)
    # scheduled | completed | missed | cancelled (validated in the blueprint)
    status = Column(String(20), default="scheduled", nullable=False)
    completed_at = Column(DateTime)
    conducted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    # e.g. external evaluator / certifying body the drill was conducted with
    conducted_by_name = Column(String(200))

    participations = relationship(
        "DrillParticipation", backref="drill", lazy="dynamic"
    )


class DrillParticipation(SchoolModel):
    """Per-class participation record for one drill — who was expected,
    who took part, who was counted missing (for readiness analytics)."""
    __tablename__ = "drill_participations"

    drill_id = Column(
        UUID(as_uuid=True), ForeignKey("disaster_drills.id"), nullable=False
    )
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    total_expected = Column(Integer)
    total_present = Column(Integer)
    missing_student_ids = Column(ARRAY(UUID(as_uuid=True)))
    notes = Column(Text)
    recorded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    recorded_at = Column(DateTime)

    recorded_by = relationship("User")
