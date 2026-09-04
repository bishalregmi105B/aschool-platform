"""W-04: ContactMessage — public website form submissions persisted and
inbox-readable. Before this, contact posts went ONLY to audit_logs where
no human could ever read them.
"""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import SchoolModel


class ContactMessage(SchoolModel):
    __tablename__ = "contact_messages"

    name = Column(String(300), nullable=False)
    phone = Column(String(20))
    email = Column(String(200))
    subject = Column(String(300))
    message = Column(Text, nullable=False)
    source_page = Column(String(300))            # where on the public site
    ip_address = Column(String(45))
    is_read = Column(Boolean, default=False, index=True)
    read_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    read_at = Column(DateTime(timezone=True))
    replied_at = Column(DateTime(timezone=True))
