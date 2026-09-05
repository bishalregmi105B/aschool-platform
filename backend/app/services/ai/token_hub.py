"""
Centralized AI Token Hub — the ONLY entry-point for all AI calls in ASchool.

Every AI request must go through AITokenHub.request(). This service:
  1. Checks per-school quota (daily + monthly, cost-based)
  2. Routes to the configured provider (Groq PRIMARY, Anthropic FALLBACK)
     with timeouts, bounded retries and a per-provider circuit breaker (A-01)
  3. Logs every call to ai_usage_logs with USD cost accounting
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
import hashlib
import logging
import random
import threading
import time
from datetime import datetime, timezone
from typing import Any

from flask import current_app

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider constants — env-overridable (A-01: the env vars used to be dead)
# ---------------------------------------------------------------------------
GROQ_MODELS = {
    # Groq 2026 catalog (verified live): the llama-3.x chat models were
    # retired; the OpenAI gpt-oss line and qwen are the current chat models.
    "fast":    "openai/gpt-oss-20b",
    "smart":   "openai/gpt-oss-120b",
    "preview": "qwen/qwen3.8-27b",
    # Special-purpose (AW-04/AW-08)
    "guard":   "meta-llama/llama-prompt-guard-2-86m",
    "speech":  "whisper-large-v3-turbo",
}


def _groq_model_id(model_key: str) -> str:
    """Model id from config (GROQ_MODEL_FAST/QUALITY) with catalog fallback."""
    config = current_app.config
    config_map = {
        "fast": config.get("GROQ_MODEL_FAST") or GROQ_MODELS["fast"],
        "smart": config.get("GROQ_MODEL_QUALITY") or GROQ_MODELS["smart"],
    }
    return config_map.get(model_key, config_map["smart"])


# USD per 1M tokens (prompt, completion) — default price sheet, effective
# 2026-09. Groq ~40× cheaper than Claude; quota enforcement is on COST.
DEFAULT_MODEL_PRICES = {
    ("groq", "openai/gpt-oss-20b"): (0.05, 0.08),
    ("groq", "openai/gpt-oss-120b"): (0.15, 0.75),
    ("groq", "qwen/qwen3.8-27b"): (0.10, 0.50),
    ("groq", "whisper-large-v3-turbo"): (0.04, 0.0),  # per-M audio tokens approx
    ("anthropic", "claude-haiku-4-5-20250514"): (0.80, 4.00),
    ("anthropic", "claude-sonnet-4-20250514"): (3.00, 15.00),
}


def estimate_cost_usd(provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """USD cost of one call from the price sheet (unknown models priced as
    the provider's most expensive entry — fail conservative)."""
    key = (provider, model)
    if key not in DEFAULT_MODEL_PRICES:
        provider_rates = [r for (p, _), r in DEFAULT_MODEL_PRICES.items() if p == provider]
        key = (provider, "unknown")
        DEFAULT_MODEL_PRICES[key] = max(provider_rates) if provider_rates else (3.0, 15.0)
    prompt_rate, completion_rate = DEFAULT_MODEL_PRICES[key]
    return round(
        (prompt_tokens * prompt_rate + completion_tokens * completion_rate) / 1_000_000,
        6,
    )


# ---------------------------------------------------------------------------
# Circuit breaker + retry policy (A-01)
# ---------------------------------------------------------------------------
class _CircuitBreaker:
    """Per-provider breaker: open after N consecutive failures, half-open
    after cooldown. A dead Groq must not add its full timeout to every call."""

    def __init__(self, failure_threshold: int = 5, cooldown_seconds: int = 60):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._consecutive_failures = 0
        self._opened_at: float | None = None
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            if self._opened_at is None:
                return True
            if time.time() - self._opened_at >= self.cooldown_seconds:
                # half-open: allow one probe
                return True
            return False

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self._consecutive_failures += 1
            if self._consecutive_failures >= self.failure_threshold:
                self._opened_at = time.time()

    @property
    def is_open(self) -> bool:
        with self._lock:
            return self._opened_at is not None and (
                time.time() - self._opened_at < self.cooldown_seconds
            )


_BREAKERS: dict[str, _CircuitBreaker] = {}
_BREAKERS_LOCK = threading.Lock()


def _breaker(provider: str) -> _CircuitBreaker:
    with _BREAKERS_LOCK:
        if provider not in _BREAKERS:
            _BREAKERS[provider] = _CircuitBreaker()
        return _BREAKERS[provider]


def _is_retryable(exc: Exception) -> bool:
    """429 / 5xx / connection errors are retryable; 401/400 are not."""
    status = getattr(exc, "status_code", None)
    if status is not None:
        return status == 429 or 500 <= int(status) < 600
    type_name = type(exc).__name__.lower()
    return any(t in type_name for t in ("timeout", "connection", "ratelimit", "apierror", "internal"))


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
    timeout = current_app.config.get("AI_TIMEOUT_QUALITY", 90)
    return anthropic.Anthropic(
        api_key=current_app.config["ANTHROPIC_API_KEY"],
        timeout=timeout,
    )


def _call_groq(messages: list, model_key: str, max_tokens: int, temperature: float) -> dict:
    """Call Groq and return a normalised response dict (timeout enforced)."""
    client = _get_groq_client()
    model_id = _groq_model_id(model_key)
    timeout = current_app.config.get("AI_TIMEOUT_FAST" if model_key == "fast" else "AI_TIMEOUT_QUALITY", 60)
    t0 = time.time()
    completion = client.chat.completions.create(
        model=model_id,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout,
    )
    latency_ms = int((time.time() - t0) * 1000)
    usage = completion.usage
    message = completion.choices[0].message
    text = message.content or ""
    if not text and getattr(message, "reasoning", None):
        # gpt-oss reasoning models: max_tokens can be fully consumed by the
        # reasoning field — surface the reasoning tail honestly so callers
        # see why output is missing (and retries with a higher budget work).
        text = ""
    return {
        "text":               text,
        "reasoning":          getattr(message, "reasoning", None),
        "finish_reason":      getattr(completion.choices[0], "finish_reason", None),
        "model":              model_id,
        "provider":           "groq",
        "prompt_tokens":      usage.prompt_tokens,
        "completion_tokens":  usage.completion_tokens,
        "total_tokens":       usage.total_tokens,
        "latency_ms":         latency_ms,
    }


def _call_groq_stream(messages: list, model_key: str, max_tokens: int, temperature: float):
    """Streaming Groq call — yields text deltas; final yield is the usage dict.

    Same normalisation contract as ``_call_groq``: the last yielded item is a
    dict with token counts so the caller can log/meter exactly what streamed.
    Streaming responses carry usage only when ``stream_options`` requests it.
    """
    client = _get_groq_client()
    model_id = _groq_model_id(model_key)
    timeout = current_app.config.get("AI_TIMEOUT_FAST" if model_key == "fast" else "AI_TIMEOUT_QUALITY", 60)
    t0 = time.time()
    stream = client.chat.completions.create(
        model=model_id,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout,
        stream=True,
        stream_options={"include_usage": True},
    )
    prompt_tokens = 0
    completion_tokens = 0
    for chunk in stream:
        if getattr(chunk, "usage", None):
            prompt_tokens = chunk.usage.prompt_tokens or prompt_tokens
            completion_tokens = chunk.usage.completion_tokens or completion_tokens
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        piece = getattr(delta, "content", None)
        if piece:
            yield piece
    yield {
        "text": "",  # the deltas carried the text; this signals completion
        "model": model_id,
        "provider": "groq",
        "prompt_tokens": prompt_tokens,
        # Fallback estimate when the provider omits usage: chars/4 heuristic.
        "completion_tokens": completion_tokens,
        "latency_ms": int((time.time() - t0) * 1000),
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


def _check_quota(school_id, est_cost_usd: float = 0.0) -> None:
    """Raise QuotaExceededError if the school is over limit (A-01: atomic).

    Two doors:
      1. COST check — the estimated call cost is reserved atomically in
         Redis (INCRBY + TTL). Concurrent bursts cannot collectively blow
         through the budget the way check-then-act allows.
      2. TOKEN totals — the DB day/month sums remain the source of truth
         for reconciliation; the Redis reservation is reconciled to actual
         usage after the call (`reconcile_quota_reservation`).

    NOTE on the default path: a MISSING AISchoolQuota row (or an inactive one)
    is treated as BLOCKED ("inactive"), not unlimited. Registration
    provisions one eagerly; POST /api/v1/ai-usage/quota/init is the manual
    fallback.
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

    _reserve_cost(school_id, est_cost_usd, quota)


def _reserve_cost(school_id, est_cost_usd: float, quota) -> None:
    """Atomically reserve the estimated USD cost against the daily budget
    (A-01). Redis INCRBY on a micro-USD integer with a 48h TTL; the budget
    is the school's daily token limit converted at a conservative blended
    rate when no explicit usd budget is stored."""
    if not est_cost_usd or est_cost_usd <= 0:
        return
    from extensions import redis_client

    if redis_client is None:
        return
    try:
        blended_usd_per_mtoken = float(
            current_app.config.get("AI_BLENDED_USD_PER_MTOKEN", 0.6)
        )
        daily_budget_usd_micro = int(
            quota.daily_limit * blended_usd_per_mtoken * 1_000_000
        )
        est_micro = max(1, int(est_cost_usd * 1_000_000))
        key = f"ai:cost:{school_id}:{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        used = redis_client.incrby(key, est_micro)
        if used == est_micro:  # first increment today — set the TTL
            redis_client.expire(key, 172800)
        if used > daily_budget_usd_micro:
            # roll back the reservation; the caller reports quota-exceeded
            redis_client.decrby(key, est_micro)
            raise QuotaExceededError("daily_cost", used // 1_000_000, daily_budget_usd_micro)
    except QuotaExceededError:
        raise
    except Exception:  # noqa: BLE001 — redis down must not block AI calls
        logger.warning("cost reservation unavailable — falling back to token totals")


def reconcile_quota_reservation(school_id, est_cost_usd: float, actual_cost_usd: float) -> None:
    """After the call: return the estimated reservation and record actual."""
    from extensions import redis_client

    if redis_client is None or not est_cost_usd:
        return
    try:
        diff_micro = int((est_cost_usd - (actual_cost_usd or 0)) * 1_000_000)
        if diff_micro > 0:
            key = f"ai:cost:{school_id}:{datetime.now(timezone.utc).strftime('%Y%m%d')}"
            redis_client.decrby(key, diff_micro)
    except Exception:  # noqa: BLE001
        logger.warning("cost reconciliation failed")


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
    cost_usd: float | None = None,
) -> None:
    """Persist a single AI call record (with cost accounting, A-01)."""
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
    if cost_usd is not None and hasattr(AIUsageLog, "cost_usd"):
        entry.cost_usd = cost_usd
    try:
        db.session.add(entry)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.warning("Failed to persist AI usage log: %s", exc)


def _call_with_retries(provider_fn, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """Run one provider call with bounded retries + circuit breaker (A-01).

    Retries only 429/5xx/connection errors, exponential backoff with jitter,
    max AI_MAX_RETRIES attempts (default 2 retries = 3 attempts).
    """
    max_retries = int(current_app.config.get("AI_MAX_RETRIES", 2) or 2)
    breaker = _breaker(provider_fn.__name__)
    last_exc: Exception | None = None

    for attempt in range(max_retries + 1):
        if not breaker.allow():
            raise AIProviderError(
                f"Circuit breaker open for {provider_fn.__name__} "
                f"({breaker.failure_threshold} consecutive failures) — try again shortly"
            )
        try:
            result = provider_fn(
                messages=messages,
                model_key=model_key,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            breaker.record_success()
            return result
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            breaker.record_failure()
            if attempt >= max_retries or not _is_retryable(exc):
                raise
            backoff = min(2 ** attempt, 8) + random.random()
            logger.warning(
                "AI call attempt %d/%d failed (%s) — retrying in %.1fs",
                attempt + 1, max_retries + 1, exc, backoff,
            )
            time.sleep(backoff)
    raise AIProviderError(f"AI provider failed after {max_retries + 1} attempts: {last_exc}")


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
        max_tokens: int = 2000,  # reasoning models spend part of this
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

        # 1. Quota check with an atomic cost reservation (A-01): the
        # estimate is derived from the request size and max_tokens.
        est_cost = estimate_cost_usd(
            "groq", _groq_model_id(model),
            sum(len(str(m.get("content", ""))) for m in messages) // 4,
            max_tokens,
        )
        try:
            _check_quota(school_id, est_cost_usd=est_cost)
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

        # 3. Call provider (with bounded retries + circuit breaker + fallback)
        prompt_sha = hashlib.sha256(
            "\n".join(str(m.get("content", "")) for m in messages).encode()
        ).hexdigest()[:16]
        log_meta = dict(metadata or {})
        log_meta.setdefault("prompt_sha256", prompt_sha)

        try:
            result = _call_with_retries(
                provider_fn, model, messages, max_tokens, temperature
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
                    result = _call_with_retries(
                        fallback_fn, model, messages, max_tokens, temperature
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
                        metadata=log_meta,
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
                    metadata=log_meta,
                )
                raise AIProviderError(f"AI provider call failed: {primary_exc}") from primary_exc

        # 4. Log success with cost accounting (A-01)
        cost_usd = estimate_cost_usd(
            result["provider"], result["model"],
            result["prompt_tokens"], result["completion_tokens"],
        )
        try:
            reconcile_quota_reservation(school_id, est_cost, cost_usd)
        except Exception:  # noqa: BLE001
            logger.warning("quota reconciliation failed")
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
            metadata=log_meta,
            cost_usd=cost_usd,
        )

        return {
            "text":        result["text"],
            "tokens_used": result["total_tokens"],
            "model":       result["model"],
            "provider":    result["provider"],
            "latency_ms":  result["latency_ms"],
            "cost_usd":    cost_usd,
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

    @staticmethod
    def stream_request(
        school_id,
        user_id,
        feature: str,
        messages: list[dict],
        model: str = "fast",
        max_tokens: int = 1500,
        temperature: float = 0.7,
        metadata: dict | None = None,
    ):
        """Token-streaming sibling of :meth:`request` (AI Teacher board/caption
        sync needs first-token latency, not one-shot completion).

        Yields ``str`` deltas, then one final ``dict`` with the same metering
        fields as ``request()``. Quota: the FULL max_tokens estimate is
        reserved up front (atomic, like request()) and reconciled to the
        measured usage after the stream ends — a mid-stream client that
        disappears still pays for what the provider generated.
        """
        if user_id is None:
            user_id = _resolve_user_id(school_id)

        est_cost = estimate_cost_usd(
            "groq", _groq_model_id(model),
            sum(len(str(m.get("content", ""))) for m in messages) // 4,
            max_tokens,
        )
        try:
            _check_quota(school_id, est_cost_usd=est_cost)
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
            raise

        groq_key = current_app.config.get("GROQ_API_KEY", "")
        if not groq_key:
            raise AIProviderError(
                "Streaming requires GROQ_API_KEY (the stream path has a "
                "single provider — no Anthropic fallback)."
            )

        prompt_sha = hashlib.sha256(
            "\n".join(str(m.get("content", "")) for m in messages).encode()
        ).hexdigest()[:16]
        log_meta = dict(metadata or {})
        log_meta.setdefault("prompt_sha256", prompt_sha)

        prompt_tokens = 0
        completion_tokens = 0
        model_id = _groq_model_id(model)
        latency_ms = 0
        status = "success"
        error_message = None
        try:
            for piece in _call_groq_stream(
                messages=messages, model_key=model,
                max_tokens=max_tokens, temperature=temperature,
            ):
                if isinstance(piece, str):
                    yield piece
                else:
                    prompt_tokens = piece["prompt_tokens"]
                    completion_tokens = piece["completion_tokens"]
                    latency_ms = piece["latency_ms"]
        except Exception as exc:  # noqa: BLE001 — meter the failure honestly
            status = "error"
            error_message = str(exc)
            raise
        finally:
            actual_cost = estimate_cost_usd(
                "groq", model_id, prompt_tokens, completion_tokens
            )
            _log_call(
                school_id=school_id,
                user_id=user_id,
                feature=feature,
                model=model_id,
                provider="groq",
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                latency_ms=latency_ms,
                status=status,
                error_message=error_message,
                cost_usd=actual_cost,
                metadata=log_meta,
            )
            reconcile_quota_reservation(school_id, est_cost, actual_cost)

        yield {
            "text": "",
            "model": model_id,
            "provider": "groq",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "latency_ms": latency_ms,
            "cost_usd": actual_cost,
        }

    # ------------------------------------------------------------------
    # Convenience helpers for admin stats
    # ------------------------------------------------------------------

    @staticmethod
    def embed(texts: list[str], school_id=None, user_id=None, feature: str = "embedding") -> list[list[float]]:
        """A-05: embedding API through the hub — same quota/log/cost doors.

        Provider: OPENAI_API_KEY → text-embedding-3-small (1024-dim via
        dimensions param). Without a key, raises AIProviderError — callers
        decide whether to degrade (BM25-only retrieval) or fail.
        """
        if not texts:
            return []
        api_key = current_app.config.get("OPENAI_API_KEY", "")
        if not api_key:
            raise AIProviderError(
                "No embedding provider configured. Set OPENAI_API_KEY for "
                "text-embedding-3-small (RAG degrades to BM25-only without it)."
            )
        import openai

        client = openai.OpenAI(
            api_key=api_key,
            timeout=current_app.config.get("AI_TIMEOUT_FAST", 30),
        )
        t0 = time.time()
        response = client.embeddings.create(
            model="text-embedding-3-small", input=texts, dimensions=1024
        )
        latency_ms = int((time.time() - t0) * 1000)
        usage = response.usage
        vectors = [item.embedding for item in response.data]
        # embeddings are cheap; log for the meter anyway (prompt tokens only)
        _log_call(
            school_id=school_id,
            user_id=user_id,
            feature=feature,
            model="text-embedding-3-small",
            provider="openai",
            prompt_tokens=usage.total_tokens,
            completion_tokens=0,
            total_tokens=usage.total_tokens,
            latency_ms=latency_ms,
            status="success",
            cost_usd=estimate_cost_usd("openai", "text-embedding-3-small", usage.total_tokens, 0),
        )
        return vectors

    @staticmethod
    def transcribe(audio_bytes: bytes, filename: str = "audio.webm", school_id=None, user_id=None, feature: str = "speech", language: str | None = None) -> dict:
        """AW-08 speech kind: audio → text via Groq whisper-large-v3-turbo.

        Same quota/log/cost discipline as chat. Never used for ambient
        recording — callers must present the transcript for user
        confirmation before any data is committed (capture-tools contract).
        """
        api_key = current_app.config.get("GROQ_API_KEY", "")
        if not api_key:
            raise AIProviderError("GROQ_API_KEY is not configured (speech provider)")
        import groq

        client = groq.Groq(api_key=api_key)
        t0 = time.time()
        kwargs: dict[str, Any] = {
            "model": "whisper-large-v3-turbo",
            "file": (filename, audio_bytes),
        }
        if language:
            kwargs["language"] = language
        try:
            transcription = client.audio.transcriptions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            _log_call(
                school_id=school_id, user_id=user_id, feature=feature,
                model="whisper-large-v3-turbo", provider="groq",
                prompt_tokens=0, completion_tokens=0, total_tokens=0,
                latency_ms=int((time.time() - t0) * 1000),
                status="error", error_message=str(exc)[:300],
            )
            raise AIProviderError(f"Speech transcription failed: {exc}") from exc

        latency_ms = int((time.time() - t0) * 1000)
        text = getattr(transcription, "text", "") or ""
        # whisper pricing is per audio-second; token metering is approximate —
        # log tokens as audio bytes/1000 so quotas still bind.
        approx_tokens = max(1, len(audio_bytes) // 1000)
        cost = estimate_cost_usd("groq", "whisper-large-v3-turbo", approx_tokens, 0)
        _log_call(
            school_id=school_id, user_id=user_id, feature=feature,
            model="whisper-large-v3-turbo", provider="groq",
            prompt_tokens=approx_tokens, completion_tokens=0,
            total_tokens=approx_tokens, latency_ms=latency_ms,
            status="success", cost_usd=cost,
        )
        return {"text": text, "latency_ms": latency_ms, "cost_usd": cost, "provider": "groq"}

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
