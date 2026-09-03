"""Processed webhook events — replay protection for signature-verified
provider webhooks (S-13).

Providers redeliver on timeouts and misbehaving clients replay captured
requests; every effectful webhook handler inserts its provider+event_id
here in the same transaction as its effects, making a second delivery a
no-op.
"""
from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class ProcessedWebhookEvent(BaseModel):
    __tablename__ = "processed_webhook_events"

    provider = Column(String(50), nullable=False)  # 'stripe', 'esewa', ...
    event_id = Column(String(200), nullable=False)
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "provider", "event_id", name="uq_processed_webhook_provider_event"
        ),
    )
