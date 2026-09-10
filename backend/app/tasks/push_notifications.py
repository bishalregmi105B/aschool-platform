"""Push notification tasks via OneSignal.

OneSignal handles both Android (FCM) and iOS (APNs) delivery automatically.
Legacy FCM direct sending is preserved as a fallback if OneSignal is not configured.
"""
import logging
from datetime import datetime

from extensions import celery

logger = logging.getLogger(__name__)


def _log_push(school_id, title, body, data=None, fcm_token=None, status="sent"):
    """Best-effort PushNotification row (B-27).

    The OneSignal path used to deliver pushes without ever writing the
    push_notifications table, so push history was invisible. Delivery must
    never depend on logging — every failure here is swallowed.
    """
    if not school_id:
        return
    try:
        from flask import has_app_context

        if not has_app_context():
            return
        from app.models.notification import PushNotification
        from extensions import db

        db.session.add(
            PushNotification(
                school_id=school_id,
                user_id=None,
                title=(title or "")[:200],
                body=body or "",
                data=data or {},
                fcm_token=fcm_token,
                status=status,
                sent_at=datetime.utcnow(),
            )
        )
        db.session.commit()
    except Exception:  # noqa: BLE001 — logging must not break delivery
        logger.info("PushNotification log skipped", exc_info=True)
        try:
            from extensions import db

            db.session.rollback()
        except Exception:  # noqa: BLE001
            pass


@celery.task(name="send_push_notification", queue="notifications")
def send_push_notification(
    player_id: str,
    title: str,
    body: str,
    data: dict = None,
):
    """Send push notification to a single device via OneSignal.

    Falls back to legacy FCM if OneSignal is not configured.
    """
    from flask import current_app

    # Try OneSignal first (preferred)
    onesignal_app_id = current_app.config.get("ONESIGNAL_APP_ID", "")
    if onesignal_app_id:
        from app.services.communications.onesignal_service import OneSignalService

        result = OneSignalService.send_to_player(
            player_id=player_id,
            title=title,
            body=body,
            data=data,
        )
        _log_push(
            (data or {}).get("school_id"), title, body,
            data=data, fcm_token=player_id,
            status="sent" if result.get("success") else "failed",
        )
        return result

    # Legacy FCM fallback (for backward compatibility during migration)
    return _send_fcm_legacy(player_id, title, body, data)


@celery.task(name="send_push_to_school", queue="notifications")
def send_push_to_school(
    school_id: str,
    title: str,
    body: str,
    roles: list = None,
    data: dict = None,
):
    """Send push notification to all users of a school (optionally filtered by role).

    Uses OneSignal tag-based filtering for efficient server-side delivery
    without needing to query all user tokens.
    """
    from flask import current_app

    onesignal_app_id = current_app.config.get("ONESIGNAL_APP_ID", "")
    if onesignal_app_id:
        from app.services.communications.onesignal_service import OneSignalService

        result = OneSignalService.send_to_school(
            school_id=school_id,
            title=title,
            body=body,
            roles=roles,
            data=data,
        )
        _log_push(
            school_id, title, body,
            data={"roles": roles, **(data or {})},
            status="sent" if result.get("success") else "failed",
        )
        return result

    # Legacy FCM fallback
    return _send_fcm_to_school_legacy(school_id, title, body, roles)


@celery.task(name="send_push_bulk", queue="notifications")
def send_push_bulk(
    player_ids: list[str],
    title: str,
    body: str,
    data: dict = None,
):
    """Send push notification to multiple specific devices.

    OneSignal handles batching internally — no need for per-device looping.
    """
    from flask import current_app

    onesignal_app_id = current_app.config.get("ONESIGNAL_APP_ID", "")
    if onesignal_app_id:
        from app.services.communications.onesignal_service import OneSignalService

        return OneSignalService.send_to_players(
            player_ids=player_ids,
            title=title,
            body=body,
            data=data,
        )

    # Legacy: loop through FCM tokens
    results = []
    for token in player_ids:
        results.append(_send_fcm_legacy(token, title, body, data))
    return results


# ── Legacy FCM helpers (to be removed once OneSignal migration is complete) ──

def _send_fcm_legacy(token: str, title: str, body: str, data: dict = None) -> dict:
    """Direct FCM push — legacy fallback."""
    import requests
    from flask import current_app

    server_key = current_app.config.get("FIREBASE_SERVER_KEY", "")
    if not server_key:
        logger.warning("FIREBASE_SERVER_KEY not set — push notification skipped")
        return {"success": False, "error": "FCM not configured"}

    payload = {
        "to": token,
        "notification": {"title": title, "body": body},
    }
    if data:
        payload["data"] = data

    try:
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
        return {"success": True, **resp.json()}
    except Exception as exc:
        logger.exception("FCM push failed: %s", exc)
        return {"success": False, "error": str(exc)}


def _send_fcm_to_school_legacy(
    school_id: str, title: str, body: str, roles: list = None,
) -> dict:
    """Send FCM push to all users of a school — legacy fallback."""
    from app.models.user import User

    query = User.query.filter(
        User.school_id == school_id,
        User.is_deleted.is_(False),
        User.fcm_tokens.isnot(None),
    )
    if roles:
        query = query.filter(User.role.in_(roles))

    sent = 0
    for user in query.all():
        tokens = user.fcm_tokens or []
        for token in tokens:
            send_push_notification.delay(token, title, body)
            sent += 1

    return {"success": True, "queued": sent}
