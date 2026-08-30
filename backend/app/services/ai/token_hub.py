"""
Centralized AI Token Hub — the ONLY entry-point for all AI calls in ASchool.

Every AI request must go through AITokenHub.request(). This service:
  1. Checks per-school quota (daily + monthly)
  2. Routes to the configured provider (Groq PRIMARY, Anthropic FALLBACK)
  3. Logs every call to ai_usage_logs
  4. Returns a provider-agnostic AIHubResponse

Provider priority:
  1. Groq (fast, cost-effective) — always tried first when GROQ_API_KEY is set
  2. Anthropic Claude (quality fallback) — used when Groq unavailable or fails

Usage:
    result = AITokenHub.request(
        school_id=g.school_id,
        user_id=g.current_user_id,
        feature="design-studio:ai-suggest",
        messages=[{"role": "user", "content": "..."}],
        max_tokens=500,
    )
    text = result["text"]
"""
import logging
import time
from datetime import datetime, timezone
from typing import Any

from flask import current_app

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider constants
# ---------------------------------------------------------------------------
GROQ_MODELS = {
    "fast":    "llama-3.1-8b-instant",
    "smart":   "llama-3.3-70b-versatile",
    "preview": "llama-3.3-70b-specdec",
}


class QuotaExceededError(Exception):
    """Raised when a school's daily or monthly AI token limit is exhausted."""

    def __init__(self, reason: str, used: int, limit: int):
        self.reason = reason   # "daily_limit" | "monthly_limit" | "inactive"
        self.used = used
        self.limit = limit
        super().__init__(
            f"AI quota exceeded ({reason}): {used}/{limit} tokens used."
        )


class AIProviderError(Exception):
    """Raised when no AI provider is configured or every configured provider
    fails (bad key, network outage, provider 5xx). The API layer converts this
    to an honest 502 — never a fake result, never an opaque 500."""
    pass


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_user_id(school_id):
    """Best-effort user attribution when the caller has no user context
    (e.g. Celery tasks). AIUsageLog.user_id is NOT NULL — without this the
    usage row would silently fail to persist and quota usage would never
    accumulate for system-triggered calls."""
    if school_id is None:
        return None
    try:
        from extensions import db
        from app.models.school import School
        from app.models.user import User

        school = db.session.get(School, school_id)
        if school is not None and school.owner_id:
            return school.owner_id
        admin = (
            User.query.filter_by(
                school_id=school_id,
                role="school_admin",
                is_active=True,
                is_deleted=False,
            )
            .first()
        )
        return admin.id if admin else None
    except Exception as exc:
        logger.warning("Could not resolve fallback user for AI usage log: %s", exc)
        return None


def _get_groq_client():
    """Return a Groq client; raise ImportError if groq is not installed."""
    import groq  # noqa: F401  (optional dependency)
    api_key = current_app.config.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")
    return groq.Groq(api_key=api_key)


def _get_anthropic_client():
    import anthropic
    return anthropic.Anthropic(
        api_key=current_app.config["ANTHROPIC_API_KEY"]
    )


def _call_groq(messages: list, model_key: str, max_tokens: int, temperature: float) -> dict:
    """Call Groq and return a normalised response dict."""
    client = _get_groq_client()
    model_id = GROQ_MODELS.get(model_key, GROQ_MODELS["smart"])
    t0 = time.time()
    completion = client.chat.completions.create(
        model=model_id,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    latency_ms = int((time.time() - t0) * 1000)
    usage = completion.usage
    return {
        "text":               completion.choices[0].message.content or "",
        "model":              model_id,
        "provider":           "groq",
        "prompt_tokens":      usage.prompt_tokens,
        "completion_tokens":  usage.completion_tokens,
        "total_tokens":       usage.total_tokens,
        "latency_ms":         latency_ms,
    }


def _call_anthropic(messages: list, model_key: str, max_tokens: int, temperature: float) -> dict:
    """Call Anthropic Claude and return a normalised response dict."""
    client = _get_anthropic_client()
    config = current_app.config
    model_map = {
        "fast":  config.get("AI_MODEL_FAST",    "claude-haiku-4-5-20250514"),
        "smart": config.get("AI_MODEL_QUALITY", "claude-sonnet-4-20250514"),
    }
    model_id = model_map.get(model_key, model_map["smart"])

    # Split off system message if present
    system_msg = None
    api_messages = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            api_messages.append(m)

    kwargs: dict[str, Any] = {
        "model":      model_id,
        "max_tokens": max_tokens,
        "messages":   api_messages,
    }
    if system_msg:
        kwargs["system"] = system_msg

    t0 = time.time()
    response = client.messages.create(**kwargs)
    latency_ms = int((time.time() - t0) * 1000)
    text = response.content[0].text if response.content else ""
    usage = response.usage
    return {
        "text":               text,
        "model":              model_id,
        "provider":           "anthropic",
        "prompt_tokens":      usage.input_tokens,
        "completion_tokens":  usage.output_tokens,
        "total_tokens":       usage.input_tokens + usage.output_tokens,
        "latency_ms":         latency_ms,
    }


# ---------------------------------------------------------------------------
# Quota helpers
# ---------------------------------------------------------------------------

def _get_usage_today(school_id) -> int:
    from extensions import db
    from app.models.ai_token import AIUsageLog
    from sqlalchemy import func

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    result = (
        db.session.query(func.coalesce(func.sum(AIUsageLog.total_tokens), 0))
        .filter(
            AIUsageLog.school_id == school_id,
            AIUsageLog.status == "success",
            AIUsageLog.created_at >= today_start,
        )
        .scalar()
    )
    return int(result or 0)


def _get_usage_month(school_id) -> int:
    from extensions import db
    from app.models.ai_token import AIUsageLog
    from sqlalchemy import func

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = (
        db.session.query(func.coalesce(func.sum(AIUsageLog.total_tokens), 0))
        .filter(
            AIUsageLog.school_id == school_id,
            AIUsageLog.status == "success",
            AIUsageLog.created_at >= month_start,
        )
        .scalar()
    )
    return int(result or 0)


def _check_quota(school_id) -> None:
    """Raise QuotaExceededError if the school is over limit.

    NOTE on the default path: a MISSING AISchoolQuota row (or an inactive one)
    is treated as BLOCKED ("inactive"), not unlimited — there is no
    None=unlimited fallback. Schools therefore must have a quota row before
    their first AI call; registration provisions one eagerly via
    AITokenHub.ensure_quota_exists() (app/api/v1/auth.py register_school),
    with POST /api/v1/ai-usage/quota/init as the manual fallback.
    """
    # If enforcement is disabled (dev mode), skip
    if not current_app.config.get("AI_QUOTA_ENFORCEMENT", True):
        return

    from app.models.ai_token import AISchoolQuota

    quota = AISchoolQuota.query.filter_by(school_id=school_id).first()
    if quota is None or not quota.is_active:
        raise QuotaExceededError("inactive", 0, 0)

    today   = _get_usage_today(school_id)
    monthly = _get_usage_month(school_id)

    if today >= quota.daily_limit:
        raise QuotaExceededError("daily_limit", today, quota.daily_limit)
    if monthly >= quota.monthly_limit:
        raise QuotaExceededError("monthly_limit", monthly, quota.monthly_limit)


def _log_call(
    school_id,
    user_id,
    feature: str,
    model: str,
    provider: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    latency_ms: int,
    status: str,
    error_message: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Persist a single AI call record."""
    from extensions import db
    from app.models.ai_token import AIUsageLog

    entry = AIUsageLog(
        school_id=school_id,
        user_id=user_id,
        feature=feature,
        model=model,
        provider=provider,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
        metadata_=metadata,
    )
    try:
        db.session.add(entry)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.warning("Failed to persist AI usage log: %s", exc)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

class AITokenHub:
    """
    Centralized gateway for all AI calls. Never call Groq/Anthropic directly.

    Parameters
    ----------
    school_id : UUID  – current school
    user_id   : UUID  – requesting user
    feature   : str   – namespaced action, e.g. "design-studio:ai-suggest"
    messages  : list  – [{"role": "system"|"user"|"assistant", "content": "…"}]
    model     : str   – "fast" | "smart" (default "smart")
    max_tokens: int   – default 1000
    temperature: float – default 0.7
    metadata  : dict  – extra context stored in the log
    """

    @staticmethod
    def request(
        school_id,
        user_id,
        feature: str,
        messages: list[dict],
        model: str = "smart",
        max_tokens: int = 1000,
        temperature: float = 0.7,
        metadata: dict | None = None,
    ) -> dict:
        """
        Execute one AI call, enforce quota, log result. Returns dict:
          { text, tokens_used, model, provider, latency_ms }
        """
        # 0. Attribution fallback so every usage row has a user (NOT NULL col)
        if user_id is None:
            user_id = _resolve_user_id(school_id)

        # 1. Quota check
        try:
            _check_quota(school_id)
        except QuotaExceededError as exc:
            _log_call(
                school_id=school_id,
                user_id=user_id,
                feature=feature,
                model="none",
                provider="none",
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                latency_ms=0,
                status="quota_exceeded",
                error_message=str(exc),
                metadata=metadata,
            )
            raise  # bubble up → API layer returns 429

        # 2. Choose provider: Groq is PRIMARY, Anthropic is FALLBACK
        provider_fn = None
        fallback_fn = None
        groq_key = current_app.config.get("GROQ_API_KEY", "")
        anthropic_key = current_app.config.get("ANTHROPIC_API_KEY", "")

        if groq_key:
            try:
                import groq as _  # noqa: F401
                provider_fn = _call_groq
            except ImportError:
                logger.debug("groq package not installed, trying Anthropic")

        if anthropic_key:
            if provider_fn is None:
                provider_fn = _call_anthropic
            else:
                fallback_fn = _call_anthropic  # Anthropic available as fallback

        if provider_fn is None:
            raise AIProviderError(
                "No AI provider configured. Set GROQ_API_KEY (primary) "
                "or ANTHROPIC_API_KEY (fallback)."
            )

        # 3. Call provider (with fallback on failure)
        try:
            result = provider_fn(
                messages=messages,
                model_key=model,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        except Exception as primary_exc:
            # Try fallback provider if available
            if fallback_fn:
                logger.warning(
                    "Primary AI provider failed (%s), trying fallback: %s",
                    primary_exc,
                    fallback_fn.__name__,
                )
                try:
                    result = fallback_fn(
                        messages=messages,
                        model_key=model,
                        max_tokens=max_tokens,
                        temperature=temperature,
                    )
                except Exception as fallback_exc:
                    _log_call(
                        school_id=school_id,
                        user_id=user_id,
                        feature=feature,
                        model="unknown",
                        provider="unknown",
                        prompt_tokens=0,
                        completion_tokens=0,
                        total_tokens=0,
                        latency_ms=0,
                        status="error",
                        error_message=f"Primary: {primary_exc}; Fallback: {fallback_exc}",
                        metadata=metadata,
                    )
                    raise AIProviderError(f"AI providers failed: {fallback_exc}") from fallback_exc
            else:
                _log_call(
                    school_id=school_id,
                    user_id=user_id,
                    feature=feature,
                    model="unknown",
                    provider="unknown",
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                    latency_ms=0,
                    status="error",
                    error_message=str(primary_exc),
                    metadata=metadata,
                )
                raise AIProviderError(f"AI provider call failed: {primary_exc}") from primary_exc

        # 4. Log success
        _log_call(
            school_id=school_id,
            user_id=user_id,
            feature=feature,
            model=result["model"],
            provider=result["provider"],
            prompt_tokens=result["prompt_tokens"],
            completion_tokens=result["completion_tokens"],
            total_tokens=result["total_tokens"],
            latency_ms=result["latency_ms"],
            status="success",
            metadata=metadata,
        )

        return {
            "text":        result["text"],
            "tokens_used": result["total_tokens"],
            "model":       result["model"],
            "provider":    result["provider"],
            "latency_ms":  result["latency_ms"],
        }

    # ------------------------------------------------------------------
    # Context resolution for services whose callers don't pass school/user
    # ------------------------------------------------------------------

    @staticmethod
    def resolve_context(school_id=None, user_id=None) -> tuple:
        """Fill in missing school/user ids from the active request context.

        Service functions keep their original signatures (callers unchanged);
        when the optional school_id/user_id kwargs are omitted the values from
        Flask's request-scoped ``g`` are used. Safe outside a request context
        (e.g. Celery) — returns whatever was passed in.
        """
        if school_id is not None and user_id is not None:
            return school_id, user_id
        try:
            from flask import g
            if school_id is None:
                school_id = getattr(g, "school_id", None)
            if user_id is None:
                user_id = getattr(g, "current_user_id", None)
        except Exception:
            pass
        return school_id, user_id

    # ------------------------------------------------------------------
    # Simple prompt -> text helper used by the service modules
    # ------------------------------------------------------------------

    @staticmethod
    def generate(
        school_id,
        prompt: str,
        action: str = "service",
        max_tokens: int = 500,
        model: str = "smart",
        temperature: float = 0.7,
        system_prompt: str | None = None,
        user_id=None,
        metadata: dict | None = None,
    ) -> str:
        """
        One-shot convenience wrapper around :meth:`request`.

        Takes a single prompt (plus optional system prompt) and returns the
        completion text. Quota enforcement, provider failover and usage
        logging all behave exactly as in ``request()``, with the feature
        namespaced as ``"service:<action>"``.
        """
        messages: list[dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        result = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature=f"service:{action}",
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            metadata=metadata,
        )
        return result.get("text", "")

    # ------------------------------------------------------------------
    # Convenience helpers for admin stats
    # ------------------------------------------------------------------

    @staticmethod
    def get_usage_today(school_id) -> int:
        return _get_usage_today(school_id)

    @staticmethod
    def get_usage_month(school_id) -> int:
        return _get_usage_month(school_id)

    @staticmethod
    def ensure_quota_exists(school_id, daily: int = None, monthly: int = None) -> None:
        """Upsert a quota record for the school using env-level defaults if omitted.

        This is the provisioning entry-point for the product mandate "AI quota
        exists from account creation": because _check_quota() BLOCKS schools
        without a quota row (no unlimited-by-default), register_school()
        (app/api/v1/auth.py) calls this eagerly with the env defaults
        AI_DEFAULT_DAILY_LIMIT (10,000/day) and AI_DEFAULT_MONTHLY_LIMIT
        (100,000/month). Idempotent — an existing row is left untouched.
        """
        from extensions import db
        from app.models.ai_token import AISchoolQuota

        daily   = daily   or int(current_app.config.get("AI_DEFAULT_DAILY_LIMIT",   10_000))
        monthly = monthly or int(current_app.config.get("AI_DEFAULT_MONTHLY_LIMIT", 100_000))

        existing = AISchoolQuota.query.filter_by(school_id=school_id).first()
        if existing is None:
            quota = AISchoolQuota(
                school_id=school_id,
                daily_limit=daily,
                monthly_limit=monthly,
                alert_at=80,
                is_active=True,
            )
            db.session.add(quota)
            db.session.commit()
