"""Notification models: SMS, WhatsApp, Push."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class SMSLog(SchoolModel):
    __tablename__ = "sms_logs"

    to_phone = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    template_name = Column(String(100))
    status = Column(
        Enum("queued", "sent", "delivered", "failed", name="sms_status"),
        default="queued",
    )
    provider = Column(String(20), default="sparrow")
    provider_message_id = Column(String(200))
    cost = Column(Integer, default=1)  # credits
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    sent_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    sent_by = relationship("User")


class WhatsAppMessage(SchoolModel):
    __tablename__ = "whatsapp_messages"

    phone_number_id = Column(String(100))
    to_phone = Column(String(20), nullable=False)
    from_phone = Column(String(20))
    direction = Column(
        Enum("inbound", "outbound", name="wa_direction"), nullable=False
    )
    message_type = Column(String(20))  # text, image, audio, document, template
    content = Column(Text)
    media_url = Column(Text)
    template_name = Column(String(100))
    template_params = Column(JSONB, default=list)
    wa_message_id = Column(String(200))
    status = Column(
        Enum("queued", "sent", "delivered", "read", "failed", name="wa_status"),
        default="queued",
    )
    is_bot_reply = Column(Boolean, default=False)
    bot_command = Column(String(50))

    sent_at = Column(DateTime)


class PushNotification(SchoolModel):
    __tablename__ = "push_notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSONB, default=dict)
    fcm_token = Column(Text)
    status = Column(
        Enum("queued", "sent", "failed", name="push_status"), default="queued"
    )
    sent_at = Column(DateTime)

    user = relationship("User")


class NotificationTemplate(SchoolModel):
    __tablename__ = "notification_templates"

    name = Column(String(100), nullable=False)
    channel = Column(String(20))  # sms, whatsapp, push, email
    template_en = Column(Text, nullable=False)
    template_ne = Column(Text)
    variables = Column(JSONB, default=list)  # [{name, description}]
    is_active = Column(Boolean, default=True)


class WhatsAppBotConfig(SchoolModel):
    __tablename__ = "whatsapp_bot_configs"

    is_enabled = Column(Boolean, default=False)
    welcome_message = Column(Text, default="")
    auto_replies = Column(JSONB, default=list)  # [{keyword, response, match_type}]
    notification_types = Column(JSONB, default=list)  # ["attendance", "fee_reminder", ...]
    language = Column(String(5), default="en")


class InAppNotification(SchoolModel):
    """In-app notification center entries — supports read/unread + badge count.

    Every push notification, event, or system alert creates an in-app entry
    so users can review notifications in the dashboard even if they dismissed
    the push.
    """
    __tablename__ = "in_app_notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(300), nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # attendance, fee, notice, exam, system
    priority = Column(
        Enum("low", "normal", "high", "urgent", name="notification_priority"),
        default="normal",
    )
    data = Column(JSONB, default=dict)  # deep-link payload
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime)
    action_url = Column(String(500))  # deep-link URL

    user = relationship("User", backref="in_app_notifications")



class NotificationRule(SchoolModel):
    """A-02 per-event notification matrix — one row per (event × channel ×
    audience role) the school has an OPINION about. Absence of a row means
    "default on" for that channel: the matrix only records overrides, so a
    fresh tenant behaves exactly like today until an admin disables
    something (empty-table semantics = no behavior change).

    event_key uses the canonical plugin-event vocabulary (see
    services/notification_rules.KNOWN_EVENTS); audience_role '' = all
    recipients of the event."""

    __tablename__ = "notification_rules"

    event_key = Column(String(100), nullable=False, index=True)
    channel = Column(String(20), nullable=False)  # push|sms|email|whatsapp
    audience_role = Column(String(30), nullable=False, server_default="")
    enabled = Column(Boolean, nullable=False, default=True)
    template_key = Column(String(100))

    __table_args__ = (
        Index(
            "uq_notification_rules_event_channel_role",
            "school_id", "event_key", "channel", "audience_role",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )
