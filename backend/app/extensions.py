"""Compatibility alias for plan-named backend/app/extensions.py."""

from extensions import cache, celery, cors, db, init_redis, jwt, limiter, migrate, redis_client, socketio

__all__ = [
    "db",
    "migrate",
    "jwt",
    "cors",
    "limiter",
    "cache",
    "socketio",
    "celery",
    "redis_client",
    "init_redis",
]
