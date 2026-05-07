"""Plan-compatible communication model aliases."""

from app.models.notification import (
    NotificationTemplate,
    PushNotification,
    SMSLog,
    WhatsAppBotConfig,
    WhatsAppMessage,
)
from app.models.notice import Notice

__all__ = [
    "SMSLog",
    "WhatsAppMessage",
    "PushNotification",
    "NotificationTemplate",
    "WhatsAppBotConfig",
    "Notice",
]
