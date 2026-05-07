"""WhatsApp Cloud API integration for school notifications."""

import hashlib
import hmac
import json

import requests
from flask import current_app


class WhatsAppCloudService:
    """Meta WhatsApp Cloud API v17+ integration."""

    API_VERSION = "v17.0"
    BASE_URL = "https://graph.facebook.com"

    @classmethod
    def _headers(cls) -> dict:
        return {
            "Authorization": f"Bearer {current_app.config['WHATSAPP_ACCESS_TOKEN']}",
            "Content-Type": "application/json",
        }

    @classmethod
    def _phone_number_id(cls) -> str:
        return current_app.config["WHATSAPP_PHONE_NUMBER_ID"]

    @classmethod
    def send_template(
        cls,
        to_number: str,
        template_name: str,
        language_code: str = "en",
        components: list[dict] | None = None,
    ) -> dict:
        """Send a pre-approved WhatsApp template message."""
        url = f"{cls.BASE_URL}/{cls.API_VERSION}/{cls._phone_number_id()}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "to": cls._format_phone(to_number),
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            },
        }

        if components:
            payload["template"]["components"] = components

        resp = requests.post(url, headers=cls._headers(), json=payload, timeout=30)
        return resp.json()

    @classmethod
    def send_text(cls, to_number: str, message: str) -> dict:
        """Send a free-form text message (within 24h window)."""
        url = f"{cls.BASE_URL}/{cls.API_VERSION}/{cls._phone_number_id()}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "to": cls._format_phone(to_number),
            "type": "text",
            "text": {"body": message[:4096]},  # WhatsApp text limit
        }

        resp = requests.post(url, headers=cls._headers(), json=payload, timeout=30)
        return resp.json()

    @classmethod
    def send_attendance_notification(cls, parent_phone: str, student_name: str, status: str, date: str) -> dict:
        """Send attendance notification via template."""
        return cls.send_template(
            to_number=parent_phone,
            template_name="attendance_notification",
            components=[{
                "type": "body",
                "parameters": [
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": status},
                    {"type": "text", "text": date},
                ],
            }],
        )

    @classmethod
    def send_fee_reminder(cls, parent_phone: str, student_name: str, amount: str, due_date: str) -> dict:
        """Send fee reminder via template."""
        return cls.send_template(
            to_number=parent_phone,
            template_name="fee_reminder",
            components=[{
                "type": "body",
                "parameters": [
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": amount},
                    {"type": "text", "text": due_date},
                ],
            }],
        )

    @classmethod
    def verify_webhook(cls, token: str) -> bool:
        """Verify webhook subscription token."""
        return token == current_app.config.get("WHATSAPP_VERIFY_TOKEN")

    @classmethod
    def verify_signature(cls, payload: bytes, signature: str) -> bool:
        """Verify incoming webhook payload signature."""
        secret = current_app.config.get("WHATSAPP_APP_SECRET", "")
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)

    @classmethod
    def parse_incoming(cls, data: dict) -> list[dict]:
        """Parse incoming webhook messages."""
        messages = []
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    messages.append({
                        "from": msg.get("from"),
                        "type": msg.get("type"),
                        "text": msg.get("text", {}).get("body", ""),
                        "timestamp": msg.get("timestamp"),
                        "message_id": msg.get("id"),
                    })
        return messages

    @staticmethod
    def _format_phone(number: str) -> str:
        """Ensure Nepal phone format (977XXXXXXXXXX)."""
        number = number.strip().replace(" ", "").replace("-", "").replace("+", "")
        if number.startswith("0"):
            number = "977" + number[1:]
        elif not number.startswith("977"):
            number = "977" + number
        return number
