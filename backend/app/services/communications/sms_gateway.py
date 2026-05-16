"""SMS Gateway Service — Sparrow SMS integration for Nepal."""

import requests
from flask import current_app


class SmsGatewayService:
    """Sparrow SMS API integration for OTP and bulk notifications."""

    BASE_URL = "http://api.sparrowsms.com/v2"

    @classmethod
    def _token(cls) -> str:
        return current_app.config["SPARROW_SMS_TOKEN"]

    @classmethod
    def send_sms(cls, to_number: str, message: str, identity: str = "ASchool") -> dict:
        """Send a single SMS via Sparrow SMS."""
        url = f"{cls.BASE_URL}/sms/"
        payload = {
            "token": cls._token(),
            "from": identity,
            "to": cls._format_phone(to_number),
            "text": message[:480],  # SMS limit
        }

        resp = requests.post(url, json=payload, timeout=30)
        data = resp.json()

        return {
            "success": data.get("response_code") == 200,
            "message_id": data.get("messgae_id"),  # Sparrow API typo is intentional
            "credits_used": data.get("count", 1),
            "response": data,
        }

    @classmethod
    def send_otp(cls, to_number: str, otp_code: str) -> dict:
        """Send OTP verification SMS."""
        message = f"Your ASchool verification code is {otp_code}. Valid for 10 minutes. Do not share."
        return cls.send_sms(to_number, message)

    @classmethod
    def send_attendance_sms(cls, to_number: str, student_name: str, status: str, date: str) -> dict:
        """Send attendance notification SMS."""
        message = f"ASchool: {student_name} was marked {status} on {date}."
        return cls.send_sms(to_number, message)

    @classmethod
    def send_fee_reminder_sms(cls, to_number: str, student_name: str, amount: str, due_date: str) -> dict:
        """Send fee reminder SMS."""
        message = f"ASchool: Fee reminder for {student_name}. Amount: NPR {amount}. Due: {due_date}."
        return cls.send_sms(to_number, message)

    @classmethod
    def send_bulk(cls, numbers: list[str], message: str, identity: str = "ASchool") -> dict:
        """Send bulk SMS — dispatches each message via Celery for async delivery.

        This prevents HTTP request timeouts when sending to hundreds of numbers.
        Each SMS is sent as an individual Celery task with retry logic.
        """
        from app.tasks.sms_sender import send_single_sms

        queued = 0
        for number in numbers:
            send_single_sms.delay(number, message, identity)
            queued += 1

        return {
            "total": len(numbers),
            "queued": queued,
            "note": "SMS messages are being delivered asynchronously via background queue.",
        }

    @classmethod
    def check_credits(cls) -> dict:
        """Check remaining SMS credits."""
        url = f"{cls.BASE_URL}/credit/"
        resp = requests.get(url, params={"token": cls._token()}, timeout=15)
        data = resp.json()
        return {
            "credits_available": data.get("credits_available", 0),
            "credits_used": data.get("credits_used", 0),
        }

    @staticmethod
    def _format_phone(number: str) -> str:
        """Format to local Nepal number (977XXXXXXXXXX)."""
        number = number.strip().replace(" ", "").replace("-", "").replace("+", "")
        if number.startswith("0"):
            number = "977" + number[1:]
        elif not number.startswith("977"):
            number = "977" + number
        return number
