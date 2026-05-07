"""Push notification tasks via Firebase Cloud Messaging."""
from extensions import celery


@celery.task(name="send_push_notification", queue="notifications")
def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """Send FCM push notification to a single device."""
    import requests
    from flask import current_app

    server_key = current_app.config["FIREBASE_SERVER_KEY"]

    payload = {
        "to": token,
        "notification": {"title": title, "body": body},
    }
    if data:
        payload["data"] = data

    resp = requests.post(
        "https://fcm.googleapis.com/fcm/send",
        headers={
            "Authorization": f"key={server_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


@celery.task(name="send_push_to_school", queue="notifications")
def send_push_to_school(school_id: str, title: str, body: str, roles: list = None):
    """Send push notification to all users of a school (optionally filtered by role)."""
    from app.models.user import User

    query = User.query.filter(
        User.school_id == school_id,
        User.is_deleted.is_(False),
        User.fcm_token.isnot(None),
    )
    if roles:
        query = query.filter(User.role.in_(roles))

    for user in query.all():
        send_push_notification.delay(user.fcm_token, title, body)
