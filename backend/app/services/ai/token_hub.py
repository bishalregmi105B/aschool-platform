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


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

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
    """Raise QuotaExceededError if the school is over limit."""
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
            raise RuntimeError(
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
                    raise fallback_exc
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
                raise primary_exc

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
        """Upsert a quota record for the school using env-level defaults if omitted."""
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
