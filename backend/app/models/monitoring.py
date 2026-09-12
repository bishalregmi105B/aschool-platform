"""Mobile ops monitoring (S-A3) — crash reports from the five Flutter apps.

A-30: the apps report unhandled exceptions to /mobile/crash; rows give the
admin a support surface without an external Sentry account. Payload caps
are enforced at write time.
"""
from sqlalchemy import Boolean, Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import BaseModel


class MobileCrashReport(BaseModel):
    __tablename__ = "mobile_crash_reports"

    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    app = Column(String(20))            # admin|teacher|student|parent|user
    app_version = Column(String(30))
    platform = Column(String(20))       # android|ios|web|macos|windows|linux
    os_version = Column(String(60))
    error = Column(String(500), nullable=False)
    stack = Column(Text)
    context = Column(JSONB, default=dict)
    handled = Column(Boolean, default=False)  # caught-but-reported vs fatal

