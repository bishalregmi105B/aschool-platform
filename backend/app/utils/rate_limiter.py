"""Rate limiter — per-school API rate limiting using Redis."""
import logging
import time
from functools import wraps

from flask import g, jsonify, request

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token-bucket rate limiter backed by Redis."""

    def __init__(self, redis_client=None):
        self._redis = redis_client

    @property
    def redis(self):
        if not self._redis:
            from extensions import redis_client
            self._redis = redis_client
        return self._redis

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, dict]:
        """Check if a request is allowed under the rate limit.

        Returns (allowed, info_dict).
        """
        if not self.redis:
            return True, {"remaining": max_requests, "reset": 0}

        now = time.time()
        window_key = f"rl:{key}:{int(now // window_seconds)}"

        try:
            pipe = self.redis.pipeline()
            pipe.incr(window_key)
            pipe.expire(window_key, window_seconds + 1)
            results = pipe.execute()
            current = results[0]

            remaining = max(0, max_requests - current)
            reset = int((int(now // window_seconds) + 1) * window_seconds - now)

            return current <= max_requests, {
                "remaining": remaining,
                "limit": max_requests,
                "reset": reset,
            }
        except Exception:
            logger.exception("Rate limiter error")
            return True, {"remaining": max_requests, "reset": 0}


# Global instance
_limiter = RateLimiter()


def rate_limit(max_requests: int = 60, window: int = 60, key_func=None):
    """Decorator: rate limit a Flask route.

    Args:
        max_requests: Maximum requests per window
        window: Window size in seconds
        key_func: Function to generate the rate limit key (default: school_id + endpoint)
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if key_func:
                key = key_func()
            else:
                school_id = getattr(g, "school_id", "global")
                key = f"{school_id}:{request.endpoint}"

            allowed, info = _limiter.is_allowed(key, max_requests, window)

            if not allowed:
                response = jsonify(
                    success=False,
                    error="Rate limit exceeded",
                    data={
                        "retry_after": info["reset"],
                        "limit": info["limit"],
                    },
                )
                response.status_code = 429
                response.headers["X-RateLimit-Limit"] = str(info["limit"])
                response.headers["X-RateLimit-Remaining"] = "0"
                response.headers["X-RateLimit-Reset"] = str(info["reset"])
                response.headers["Retry-After"] = str(info["reset"])
                return response

            response = f(*args, **kwargs)
            return response

        return decorated
    return decorator


def ai_rate_limit(max_requests: int = 20, window: int = 3600):
    """Rate limit specifically for AI endpoints (stricter)."""
    return rate_limit(max_requests=max_requests, window=window)
