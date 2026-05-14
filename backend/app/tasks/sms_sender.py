"""SMS notification tasks via Sparrow SMS."""
from extensions import celery


@celery.task(name="send_sms", queue="notifications")
def send_sms(phone: str, message: str, school_id: str = None):
    """Send SMS via Sparrow SMS API. Falls back to console logging in dev."""
    import logging
    import requests
    from flask import current_app

    token = current_app.config.get("SPARROW_SMS_TOKEN", "")
    sender = current_app.config.get("SPARROW_SMS_FROM", "ASchool")

    _PLACEHOLDER = {"your-sparrow-token", ""}
    if not token or token in _PLACEHOLDER or current_app.config.get("SMS_CONSOLE_MODE"):
        # No valid SMS token — log to console so devs can read the OTP
        logging.getLogger("sms").warning(
            "[DEV SMS] To: %s | %s", phone, message
        )
        return {"status": "console", "phone": phone}

    resp = requests.post(
        "http://api.sparrowsms.com/v2/sms/",
        data={"token": token, "from": sender, "to": phone, "text": message},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


@celery.task(name="send_bulk_sms", queue="notifications")
def send_bulk_sms(messages: list[dict]):
    """Send multiple SMS messages. Each dict: {phone, message}."""
    results = []
    for msg in messages:
        result = send_sms.delay(msg["phone"], msg["message"])
        results.append(result.id)
    return results
