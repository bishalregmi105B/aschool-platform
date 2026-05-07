"""WhatsApp messaging tasks via WhatsApp Business API."""
from extensions import celery


@celery.task(name="send_whatsapp", queue="notifications")
def send_whatsapp(phone: str, template: str, params: dict = None):
    """Send WhatsApp template message."""
    import requests
    from flask import current_app

    token = current_app.config["WHATSAPP_TOKEN"]
    phone_id = current_app.config["WHATSAPP_PHONE_ID"]

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {"name": template, "language": {"code": "en"}},
    }
    if params:
        payload["template"]["components"] = [
            {"type": "body", "parameters": [{"type": "text", "text": v} for v in params.values()]}
        ]

    resp = requests.post(
        f"https://graph.facebook.com/v18.0/{phone_id}/messages",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


@celery.task(name="send_whatsapp_text", queue="notifications")
def send_whatsapp_text(phone: str, text: str):
    """Send a freeform WhatsApp text message."""
    import requests
    from flask import current_app

    token = current_app.config["WHATSAPP_TOKEN"]
    phone_id = current_app.config["WHATSAPP_PHONE_ID"]

    resp = requests.post(
        f"https://graph.facebook.com/v18.0/{phone_id}/messages",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": text},
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()
