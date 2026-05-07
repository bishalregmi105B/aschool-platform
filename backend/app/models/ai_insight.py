"""AI Insight models."""
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class WeeklyInsightReport(SchoolModel):
    __tablename__ = "weekly_insight_reports"

    week_start = Column(String(10))  # BS date
    week_end = Column(String(10))
    insights = Column(JSONB, default=list)
    generated_at = Column(DateTime)
    summary_en = Column(Text)
    summary_ne = Column(Text)


class DailyBrief(SchoolModel):
    __tablename__ = "daily_briefs"

    date_bs = Column(String(10))
    brief_data = Column(JSONB, default=dict)
    generated_at = Column(DateTime)


class RiskAlert(SchoolModel):
    __tablename__ = "risk_alerts"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    risk_score = Column(String(10))
    risk_level = Column(String(20))
    signals = Column(JSONB, default=list)
    recommended_action = Column(Text)
    status = Column(String(20), default="active")  # active, resolved, dismissed
    resolved_at = Column(DateTime)
    resolved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    student = relationship("Student", backref="risk_alerts")
    resolved_by = relationship("User")
