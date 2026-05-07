"""Notification orchestration service expected by the implementation plan."""

from __future__ import annotations

from app.services.communications.email_service import EmailService
from app.services.communications.sms_gateway import SmsGatewayService
from app.services.communications.whatsapp_cloud import WhatsAppCloudService


class NotificationEngine:
    """Unified channel dispatcher for school notifications."""

    @classmethod
    def send_sms(cls, phone: str, message: str) -> dict:
        return SmsGatewayService.send_sms(phone, message)

    @classmethod
    def send_email(cls, to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
        return EmailService.send_email(to, subject, html_body, text_body)

    @classmethod
    def send_whatsapp(cls, phone: str, message: str) -> dict:
        return WhatsAppCloudService.send_text(phone, message)

    @classmethod
    def broadcast(
        cls,
        *,
        sms_numbers: list[str] | None = None,
        email_recipients: list[dict] | None = None,
        whatsapp_numbers: list[str] | None = None,
        subject: str | None = None,
        message: str,
        html_body: str | None = None,
    ) -> dict:
        result = {"sms": None, "email": None, "whatsapp": None}

        if sms_numbers:
            result["sms"] = SmsGatewayService.send_bulk(sms_numbers, message)

        if email_recipients and subject and html_body:
            result["email"] = EmailService.send_bulk_email(email_recipients, subject, html_body)

        if whatsapp_numbers:
            result["whatsapp"] = {
                "total": len(whatsapp_numbers),
                "results": [
                    WhatsAppCloudService.send_text(number, message)
                    for number in whatsapp_numbers
                ],
            }

        return result
