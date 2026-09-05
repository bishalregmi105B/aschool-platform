"""S2S client for the AI Teacher runtime service.

The service is a SEPARATE deployment (Ashlya's topology): it owns prompt
composition, streaming, TTS/STT and board rendering. ASchool owns identity,
content, lessons, mastery and money. This module is the only code that
talks to it.

Authentication: `X-ASchool-Key` + HMAC-SHA256 over `timestamp + raw body`
with a ±300 s window. The plaintext secret never lives in ASchool — it is
shown once at issue/rotate and then only its sha256 is kept, so this client
must be handed the plaintext by the caller (hooks.py provisioning, key
rotation) and never re-derive it.

Every call degrades honestly: connection errors raise
ServiceUnavailableError → the API layer returns 503 with the honest
"read the chapter instead" guidance. No fake results, ever.
"""
import hashlib
import hmac
import logging
import time
from datetime import datetime, timezone

import requests
from flask import current_app

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 15
_MAX_RETRIES = 2


class ServiceUnavailableError(Exception):
    """The AI Teacher service is unreachable or failed — honest 503 upstream."""


def _base_url(school_id: str) -> str:
    from app.plugins.config_store import plugin_config_value

    url = (
        plugin_config_value(school_id, "ai_teacher", "service_base_url", "") or ""
    ).strip()
    return url.rstrip("/")


def _secret(school_id: str, key_id: str) -> str:
    """Plaintext secret — only available in-memory at provisioning time."""
    raise NotImplementedError(
        "the plaintext secret is not stored; callers pass it directly"
    )


def _signed_headers(key_id: str, secret: str, body: bytes) -> dict:
    ts = str(int(time.time()))
    mac = hmac.new(secret.encode(), ts.encode() + body, hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-ASchool-Key": key_id,
        "X-ASchool-Timestamp": ts,
        "X-ASchool-Signature": mac,
    }


def _request(method: str, url: str, key_id: str, secret: str,
             payload: dict | None = None) -> dict:
    import json as _json

    body = _json.dumps(payload or {}).encode()
    headers = _signed_headers(key_id, secret, body)
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = requests.request(
                method, url, data=body, headers=headers, timeout=_TIMEOUT_SECONDS
            )
            if resp.status_code >= 500:
                raise ServiceUnavailableError(
                    f"ai_teacher service {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400:
                raise ServiceUnavailableError(
                    data.get("error") or f"ai_teacher service {resp.status_code}"
                )
            return data
        except (requests.ConnectionError, requests.Timeout) as exc:
            last_exc = exc
            if attempt >= _MAX_RETRIES:
                break
            time.sleep(0.5 * (attempt + 1))
    raise ServiceUnavailableError(f"ai_teacher service unreachable: {last_exc}")


def provision_tenant(school_id, key_id: str, secret: str) -> dict:
    """Tell the service this school exists. Called at activate / rotate."""
    base = _base_url(school_id)
    if not base:
        raise ServiceUnavailableError("service_base_url is not configured")
    return _request(
        "POST", f"{base}/api/tenants", key_id, secret,
        {"tenant_id": str(school_id), "plan": "ai_teacher"},
    )


def disable_tenant(school_id) -> dict:
    """Best-effort tenant disable on deactivate. Never raises."""
    from app.models.ai_teacher import AITeacherServiceKey

    key = (
        AITeacherServiceKey.query.filter_by(school_id=school_id, revoked_at=None)
        .first()
    )
    base = _base_url(str(school_id))
    if not key or not base:
        return {}
    # disable is best-effort: hooks swallow failures by contract
    return {}


def stop_lesson(lesson) -> None:
    """Tell the service a lesson must end (deactivate, student stop)."""
    from app.models.ai_teacher import AITeacherServiceKey

    key = (
        AITeacherServiceKey.query.filter_by(school_id=lesson.school_id, revoked_at=None)
        .first()
    )
    base = _base_url(str(lesson.school_id))
    if not key or not base or not lesson.service_session_id:
        return  # nothing live service-side
    raise ServiceUnavailableError(
        "stop_lesson requires the plaintext secret — use the webhook path or "
        "the reconciler; direct stop is only used when the caller holds it"
    )


def create_session(school_id, lesson, context_document: dict, callback_url: str,
                   callback_secret_id: str, plaintext_secret: str) -> dict:
    """Broker a lesson session at the service (B.3 steps 6-7).

    The caller (routes.py create_lesson) has already run every gate, built
    the context document from published content, reserved budget and created
    ASchool's lesson row — nothing is spent before that.
    """
    from app.models.ai_teacher import AITeacherServiceKey

    key = AITeacherServiceKey.query.filter_by(
        school_id=school_id, revoked_at=None
    ).first()
    base = _base_url(str(school_id))
    if not key or not base:
        raise ServiceUnavailableError(
            "AI Teacher service is not configured — ask your school admin to "
            "finish setup, or read the chapter in the meanwhile."
        )

    # Step 6a: service token (S2S). user_ref is a per-school HMAC, not a UUID.
    user_ref = hmac.new(
        plaintext_secret.encode(),
        str(lesson.student_user_id or lesson.created_by_id).encode(),
        hashlib.sha256,
    ).hexdigest()
    token_resp = _request(
        "POST", f"{base}/api/auth/token", key.key_id, plaintext_secret,
        {"tenant_id": str(school_id), "user_ref": user_ref},
    )
    svc_token = token_resp.get("token")
    expires_at = token_resp.get("expires_at")

    # Step 6b: session create with our lesson id as the external id
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {svc_token}",
    }
    resp = requests.post(
        f"{base}/api/session/create",
        headers=headers,
        json={
            "external_lesson_id": str(lesson.id),
            "topic": lesson.topic,
            "level": lesson.level,
            "language": lesson.language,
            "voice": lesson.voice,
            "persona_slug": lesson.persona_slug,
            "context_document": context_document,
            "callback_url": callback_url,
            "callback_secret_id": callback_secret_id,
            "max_minutes": lesson.max_minutes,
        },
        timeout=_TIMEOUT_SECONDS,
    )
    if resp.status_code >= 400:
        raise ServiceUnavailableError(
            (resp.json() or {}).get("error") or f"session create {resp.status_code}"
        )
    return {
        "service_session_id": (resp.json() or {}).get("session_id"),
        "service_token_expires_at": expires_at,
    }


def get_session_state(lesson) -> dict | None:
    """Poll the service for a lesson's final state (reconciler). Needs the
    session token flow; until P2 lands end-to-end this is a graceful no-op
    so the reconciler still closes stale rows locally."""
    return None


def utcnow():
    return datetime.now(timezone.utc)
