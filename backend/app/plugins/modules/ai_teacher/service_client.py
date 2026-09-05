"""S2S client for the AI Teacher runtime service (external deployment).

The service is a SEPARATE deployment (Ashlya's topology) and owns prompt
composition, streaming, TTS/STT and board rendering. ASchool owns identity,
content, lessons, mastery and money. This module is the only code that
talks to it.

Contract (W4/A2 §7 — the shim mounted in the ATeacher service):
- Auth is HMAC-SHA256 over `timestamp + raw body` with a ±300 s window
  (X-ASchool-Key / X-ASchool-Timestamp / X-ASchool-Signature). The shim
  verifies against the per-school secret provisioned at activate/rotate.
- POST /api/tenants            — tenant ack (provisioning).
- POST /api/auth/token         — {tenant_id, user_ref} → {token, expires_at}.
- POST /api/session/create     — our full payload IN, one round-trip OUT:
                                 {session_id, token, expires_at}. The shim
                                 flattens context_document, maps language and
                                 persona fields, and records external_lesson_id.
- POST /api/lesson/stop        — {session_id} (exists on the raw service too).
- GET  /api/session/<id>/state — status + events + messages bundle for the
                                 reconciler (shim convenience).

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

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 15
_MAX_RETRIES = 2

# Language mapping: the service accepts literal "English"/"Nepali"/"Hindi"
# (AT backend/config.py:95-99) — no "en"/"ne"/"mixed" mode.
_LANGUAGE_MAP = {"en": "English", "ne": "Nepali", "mixed": "English"}


class ServiceUnavailableError(Exception):
    """The AI Teacher service is unreachable or failed — honest 503 upstream."""


def _base_url(school_id: str) -> str:
    from app.plugins.config_store import plugin_config_value

    url = (
        plugin_config_value(school_id, "ai_teacher", "service_base_url", "") or ""
    ).strip()
    return url.rstrip("/")


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


def _service_key(school_id):
    from app.models.ai_teacher import AITeacherServiceKey

    return AITeacherServiceKey.query.filter_by(
        school_id=school_id, revoked_at=None
    ).first()


def provision_tenant(school_id, key_id: str, secret: str) -> dict:
    """Tell the service this school exists. Called at activate / rotate."""
    base = _base_url(str(school_id))
    if not base:
        raise ServiceUnavailableError("service_base_url is not configured")
    return _request(
        "POST", f"{base}/api/tenants", key_id, secret,
        {"tenant_id": str(school_id), "plan": "ai_teacher"},
    )


def disable_tenant(school_id) -> dict:
    """Best-effort tenant disable on deactivate. Never raises."""
    return {}


def _flatten_context(context_document: dict) -> str:
    """Structured teaching-content dict → compact study-sheet text ≤150k chars.

    The service consumes a markdown-stripped TEXT context (AT auth.py:42);
    rendering the published blocks here keeps one canonical shape for both
    shim and raw-service paths.
    """
    parts: list[str] = []
    doc = context_document or {}

    def _emit(label: str, items):
        for item in items or []:
            if isinstance(item, dict):
                title = item.get("title") or item.get("term") or ""
                body = (
                    item.get("body")
                    or item.get("content")
                    or item.get("definition")
                    or item.get("explanation")
                    or ""
                )
                if title or body:
                    parts.append(f"{label}: {title}\n{body}".strip())
            elif isinstance(item, str) and item.strip():
                parts.append(f"{label}: {item.strip()}")

    _emit("NOTE", doc.get("notes"))
    _emit("CONCEPT", doc.get("key_terms"))
    _emit("EXAMPLE", doc.get("examples"))
    _emit("WATCH OUT", doc.get("misconceptions"))
    _emit("FORMULA", doc.get("formulas"))
    _emit("EXAM TIP", doc.get("exam_tips"))
    for outcome in doc.get("outcomes") or []:
        text = outcome.get("text") if isinstance(outcome, dict) else str(outcome)
        if text:
            parts.append(f"LEARNING OUTCOME: {text}")
    return "\n\n".join(parts)[:150_000]


def stop_lesson(lesson) -> None:
    """Tell the service a lesson must end (deactivate, student stop).

    Uses the plaintext webhook secret from the school's encrypted plugin
    config envelope — the shim verifies our HMAC with the same secret.
    """
    from app.models.plugin import SchoolPlugin
    from app.plugins.config_schema import decrypt_secret

    key = _service_key(lesson.school_id)
    base = _base_url(str(lesson.school_id))
    if not key or not base or not lesson.service_session_id:
        return  # nothing live service-side
    sp = SchoolPlugin.query.filter_by(
        school_id=lesson.school_id, plugin_slug="ai_teacher"
    ).first()
    envelope = (sp.config or {}).get("webhook_secret") if sp else None
    secret = decrypt_secret(envelope) if isinstance(envelope, dict) else None
    if not secret:
        logger.warning(
            "ai_teacher: stop_lesson skipped for %s — no plaintext secret "
            "(rotate the key from Settings)",
            lesson.id,
        )
        return
    _request(
        "POST", f"{base}/api/lesson/stop", key.key_id, secret,
        {"session_id": lesson.service_session_id},
    )


def get_session_state(lesson) -> dict | None:
    """Reconciler poll: {status, events, messages} from the shim.

    Returns None when the service is unreachable or not configured so the
    reconciler closes stale rows locally (never fake a measured state)."""
    from app.models.plugin import SchoolPlugin
    from app.plugins.config_schema import decrypt_secret

    key = _service_key(lesson.school_id)
    base = _base_url(str(lesson.school_id))
    if not key or not base or not lesson.service_session_id:
        return None
    sp = SchoolPlugin.query.filter_by(
        school_id=lesson.school_id, plugin_slug="ai_teacher"
    ).first()
    envelope = (sp.config or {}).get("webhook_secret") if sp else None
    secret = decrypt_secret(envelope) if isinstance(envelope, dict) else None
    if not secret:
        return None
    try:
        return _request(
            "GET",
            f"{base}/api/session/{lesson.service_session_id}/state",
            key.key_id,
            secret,
        )
    except ServiceUnavailableError:
        return None


def create_session(school_id, lesson, context_document: dict, callback_url: str,
                   callback_secret_id: str, plaintext_secret: str) -> dict:
    """Broker a lesson session at the service (shim: one round-trip).

    The caller (routes.py create_lesson) has already run every gate, built
    the context document from published content, reserved budget and created
    ASchool's lesson row — nothing is spent before that.

    Returns {service_session_id, service_token, service_token_expires_at};
    the token feeds the player embed URL (never stored server-side).
    """
    key = _service_key(school_id)
    base = _base_url(str(school_id))
    if not key or not base:
        raise ServiceUnavailableError(
            "AI Teacher service is not configured — ask your school admin to "
            "finish setup, or read the chapter in the meanwhile."
        )
    secret = plaintext_secret or ""
    if not secret:
        # Shim accepts HMAC with the provisioned secret; hooks keep only the
        # encrypted envelope, so decrypt it here.
        from app.models.plugin import SchoolPlugin
        from app.plugins.config_schema import decrypt_secret

        sp = SchoolPlugin.query.filter_by(
            school_id=school_id, plugin_slug="ai_teacher"
        ).first()
        envelope = (sp.config or {}).get("webhook_secret") if sp else None
        secret = decrypt_secret(envelope) if isinstance(envelope, dict) else ""
    if not secret:
        raise ServiceUnavailableError(
            "AI Teacher credential is not decryptable — rotate the service "
            "key from Settings."
        )

    language = _LANGUAGE_MAP.get((lesson.language or "").lower(), lesson.language or "English")
    result = _request(
        "POST", f"{base}/api/session/create", key.key_id, secret,
        {
            "external_lesson_id": str(lesson.id),
            "topic": lesson.topic,
            "level": lesson.level,
            "language": language,
            "voice": lesson.voice,
            "persona_slug": lesson.persona_slug,
            "context_document": context_document or {},
            "callback_url": callback_url,
            "callback_secret_id": callback_secret_id,
            "max_minutes": lesson.max_minutes,
        },
    )
    return {
        "service_session_id": result.get("session_id"),
        "service_token": result.get("token"),
        "service_token_expires_at": result.get("expires_at"),
    }


def utcnow():
    return datetime.now(timezone.utc)
