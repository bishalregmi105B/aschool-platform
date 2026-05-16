"""SMS notification tasks via Sparrow SMS."""
import logging

from extensions import celery

logger = logging.getLogger(__name__)


@celery.task(name="send_sms", queue="notifications")
def send_sms(phone: str, message: str, school_id: str = None):
    """Send SMS via Sparrow SMS API. Falls back to console logging in dev."""
    import requests
    from flask import current_app

    token = current_app.config.get("SPARROW_SMS_TOKEN", "")
    sender = current_app.config.get("SPARROW_SMS_FROM", "ASchool")

    _PLACEHOLDER = {"your-sparrow-token", ""}
    if not token or token in _PLACEHOLDER or current_app.config.get("SMS_CONSOLE_MODE"):
        # No valid SMS token — log to console so devs can read the OTP
        logger.warning("[DEV SMS] To: %s | %s", phone, message)
        return {"status": "console", "phone": phone}

    resp = requests.post(
        "http://api.sparrowsms.com/v2/sms/",
        data={"token": token, "from": sender, "to": phone, "text": message},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


@celery.task(
    name="send_single_sms",
    queue="notifications",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def send_single_sms(self, phone: str, message: str, identity: str = "ASchool"):
    """Send a single SMS with automatic retry on failure.

    Called by SmsGatewayService.send_bulk() for each recipient.
    Uses exponential backoff: 10s, 20s, 40s.
    """
    try:
        from app.services.communications.sms_gateway import SmsGatewayService

        result = SmsGatewayService.send_sms(phone, message, identity)
        if not result.get("success"):
            raise Exception(f"SMS delivery failed: {result}")
        return result
    except Exception as exc:
        logger.warning("SMS to %s failed (attempt %d): %s", phone, self.request.retries, exc)
        raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))


@celery.task(name="send_bulk_sms", queue="notifications")
def send_bulk_sms(messages: list[dict]):
    """Send multiple SMS messages. Each dict: {phone, message}."""
    results = []
    for msg in messages:
        result = send_sms.delay(msg["phone"], msg["message"])
        results.append(result.id)
    return results
