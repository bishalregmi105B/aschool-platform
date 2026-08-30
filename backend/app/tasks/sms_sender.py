"""SMS notification tasks via Sparrow SMS."""
import logging

from extensions import celery, db

logger = logging.getLogger(__name__)


def _update_sms_log(app, log_id, status, provider="sparrow",
                    provider_message_id=None, cost=0):
    """Flip an SMSLog row to its real per-message outcome.

    The /sms/send API commits rows as `queued` and dispatches this task with
    the row id — the queue position is only honest if the task records what
    actually happened (sent/failed), including the no-credentials path.
    """
    if not log_id:
        return
    from datetime import datetime, timezone

    from app.models.notification import SMSLog

    with app.app_context():
        try:
            log = SMSLog.query.filter_by(id=log_id).first()
            if not log:
                logger.error("SMS task: SMSLog %s not found — outcome lost", log_id)
                return
            log.status = status
            log.provider = provider
            log.provider_message_id = provider_message_id
            log.cost = cost
            if status == "sent":
                log.sent_at = datetime.now(timezone.utc)
            db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception("SMS task: failed to update SMSLog %s", log_id)


@celery.task(name="send_sms", queue="notifications")
def send_sms(phone: str, message: str, school_id: str = None, log_id: str = None):
    """Send SMS via Sparrow SMS. Falls back to console logging in dev.

    When a ``log_id`` is supplied (the /sms/send queue path), the SMSLog row
    is updated with the real outcome — console-mode and provider errors are
    recorded as ``failed`` (cost 0), never left as a fake ``sent``.
    """
    import requests
    from flask import current_app

    token = current_app.config.get("SPARROW_SMS_TOKEN", "")
    sender = current_app.config.get("SPARROW_SMS_FROM", "ASchool")

    _PLACEHOLDER = {"your-sparrow-token", ""}
    if not token or token in _PLACEHOLDER or current_app.config.get("SMS_CONSOLE_MODE"):
        # No valid SMS token — log to console so devs can read the OTP,
        # and record the row as NOT sent (honest no-credential behavior).
        logger.warning(
            "[DEV SMS] To: %s | %s | SMSLog %s marked failed "
            "(SMS provider not configured — message NOT delivered)",
            phone, message, log_id,
        )
        _update_sms_log(current_app._get_current_object(), log_id, "failed",
                        provider="console")
        return {"status": "console", "phone": phone}

    try:
        resp = requests.post(
            "http://api.sparrowsms.com/v2/sms/",
            data={"token": token, "from": sender, "to": phone, "text": message},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.error("SMS send to %s failed: %s", phone, exc)
        _update_sms_log(current_app._get_current_object(), log_id, "failed")
        raise

    _update_sms_log(
        current_app._get_current_object(), log_id, "sent",
        provider_message_id=str(data.get("messgae_id") or "") or None,
        cost=data.get("count", 1) if isinstance(data.get("count"), int) else 1,
    )
    return data


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
    """Send multiple SMS messages. Each dict: {phone, message[, log_id]}.

    ``log_id`` (present on the /sms/send queue path) is forwarded so the
    per-recipient task flips that SMSLog row to its real outcome.
    """
    results = []
    for msg in messages:
        result = send_sms.delay(
            msg["phone"], msg["message"], log_id=msg.get("log_id")
        )
        results.append(result.id)
    return results
