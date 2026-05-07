"""Notice and Event models."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Notice(SchoolModel):
    __tablename__ = "notices"

    title = Column(String(500), nullable=False)
    title_nepali = Column(String(500))
    content = Column(Text, nullable=False)
    content_nepali = Column(Text)
    notice_type = Column(
        Enum("general", "academic", "event", "holiday", "urgent", name="notice_type"),
        default="general",
    )
    target_audience = Column(ARRAY(String))  # ["teacher","parent","student"]
    target_class_ids = Column(ARRAY(UUID(as_uuid=True)))
    attachment_urls = Column(ARRAY(Text))
    is_pinned = Column(Boolean, default=False)
    published_at = Column(DateTime)
    expires_at = Column(DateTime)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_sms_sent = Column(Boolean, default=False)
    is_push_sent = Column(Boolean, default=False)

    created_by = relationship("User")


class Event(SchoolModel):
    __tablename__ = "events"

    title = Column(String(300), nullable=False)
    title_nepali = Column(String(300))
    description = Column(Text)
    event_type = Column(String(50))  # holiday, exam, sports, cultural
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    start_time = Column(Time)
    end_time = Column(Time)
    location = Column(String(200))
    is_all_day = Column(Boolean, default=True)
    color = Column(String(7))  # hex color for calendar
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_by = relationship("User")
