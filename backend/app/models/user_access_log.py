"""User access log (S-A3, A-37) — who logged in, when, from where.

The InstiKit ops-surface lesson: admins need visibility over authentication
activity without touching server logs. Rows are written best-effort from the
auth endpoints — a logging failure must never break a login.
"""
from sqlalchemy import Column, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class UserAccessLog(SchoolModel):
    __tablename__ = "user_access_logs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    # login | login_failed | logout | password_changed | locked_out
    event = Column(String(30), nullable=False)
    ip = Column(String(45))          # IPv6-max
    user_agent = Column(String(300))
    platform = Column(String(20))    # web|android|ios|macos|windows|linux
    # login identifier as typed (email/phone/student-id) — PII-light: no
    # passwords, no tokens, truncated.
    login_id = Column(String(200))
    meta = Column(JSONB, default=dict)

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_user_access_logs_school_created", "school_id", "created_at"),
    )
