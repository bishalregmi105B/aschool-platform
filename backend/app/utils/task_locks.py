"""Distributed task locks — P-01(b).

Celery beat fires on schedule regardless of the previous run's completion;
after a worker restart or a long previous window, two instances of the same
beat task run concurrently (duplicate SMS, double payroll, double fee
generation). This decorator serializes them on Redis with SET NX EX.
"""
import logging
from functools import wraps

logger = logging.getLogger(__name__)


def task_lock(key: str, ttl: int = 3600):
    """Serialize a Celery task: only one instance per `key` at a time.

    `key` may contain `{...}` format slots resolved from task kwargs.
    A second instance while the lock is held logs and skips (returns a
    marker dict); a crashed worker releases the lock when the TTL lapses.
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            from extensions import redis_client

            if redis_client is None:
                return fn(*args, **kwargs)
            try:
                lock_key = f"tasklock:{key.format(**kwargs)}" if kwargs else f"tasklock:{key}"
            except (KeyError, IndexError):
                lock_key = f"tasklock:{key}"
            try:
                acquired = redis_client.set(lock_key, "1", nx=True, ex=ttl)
            except Exception:  # noqa: BLE001 — redis down must not block tasks
                logger.warning("task lock redis unavailable for %s — running unlocked", key)
                return fn(*args, **kwargs)
            if not acquired:
                logger.info("task %s skipped — lock %s held (previous run still active?)", fn.__name__, lock_key)
                return {"skipped": "lock_held", "lock": lock_key}
            try:
                return fn(*args, **kwargs)
            finally:
                try:
                    redis_client.delete(lock_key)
                except Exception:  # noqa: BLE001
                    pass

        return wrapper

    return decorator
