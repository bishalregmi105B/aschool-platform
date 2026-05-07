"""AI Token models — per-school quota and per-call usage log."""
from sqlalchemy import Boolean, Column, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import SchoolModel


class AISchoolQuota(SchoolModel):
    """Per-school AI token budget configuration."""

    __tablename__ = "ai_school_quotas"

    monthly_limit = Column(Integer, nullable=False, default=100_000)
    daily_limit = Column(Integer, nullable=False, default=10_000)
    alert_at = Column(Integer, nullable=False, default=80)  # % threshold
    is_active = Column(Boolean, nullable=False, default=True)
    plan_type = Column(String(50), default="standard")  # standard | premium | custom

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id),
            "monthly_limit": self.monthly_limit,
            "daily_limit": self.daily_limit,
            "alert_at": self.alert_at,
            "is_active": self.is_active,
            "plan_type": self.plan_type,
        }


class AIUsageLog(SchoolModel):
    """Individual AI call audit log — every request logged here."""

    __tablename__ = "ai_usage_logs"

    user_id = Column(UUID(as_uuid=True), nullable=False)
    feature = Column(String(100), nullable=False, index=True)   # e.g. "docs-designer:ai-suggest"
    model = Column(String(100), nullable=False, default="unknown")
    provider = Column(String(50), nullable=False, default="anthropic")  # anthropic | groq
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, default=0)
    status = Column(String(20), nullable=False, default="success")  # success | error | quota_exceeded
    error_message = Column(Text)
    metadata_ = Column("metadata", JSONB)          # prompt hash, doc type, etc.

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id),
            "user_id": str(self.user_id),
            "feature": self.feature,
            "model": self.model,
            "provider": self.provider,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "latency_ms": self.latency_ms,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
