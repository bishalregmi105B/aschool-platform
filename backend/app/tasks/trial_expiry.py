"""Plugin trial expiry — deactivates SchoolPlugin installs whose trial ended."""
import logging
from datetime import datetime, timezone

from extensions import celery

logger = logging.getLogger(__name__)


@celery.task(name="expire_trials")
def expire_trials():
    """Run hourly: deactivate plugin installs whose trial period has ended.

    A SchoolPlugin row is trial-expired when is_trial is True and
    trial_ends_at is in the past. Deactivation (active=False) removes the
    plugin from the request-scoped installed-plugins list, ending unpaid
    trial access. The per-school plugin cache is invalidated for every
    affected school so the change takes effect immediately.
    """
    from extensions import cache, db
    from app.models.plugin import SchoolPlugin

    now = datetime.now(timezone.utc)

    rows = (
        SchoolPlugin.query.filter(
            SchoolPlugin.active.is_(True),
            SchoolPlugin.is_trial.is_(True),
            SchoolPlugin.trial_ends_at.isnot(None),
            SchoolPlugin.trial_ends_at < now,
        )
        .all()
    )

    expired_school_ids: set[str] = set()
    for sp in rows:
        try:
            sp.active = False
            sp.uninstalled_at = now
            expired_school_ids.add(str(sp.school_id))
            logger.info(
                "Expired trial: school=%s plugin=%s trial_ended_at=%s",
                sp.school_id,
                sp.plugin_slug,
                sp.trial_ends_at,
            )
        except Exception:
            logger.exception(
                "Failed to expire trial for school=%s plugin=%s",
                sp.school_id,
                sp.plugin_slug,
            )

    if expired_school_ids:
        db.session.commit()
        for school_id in expired_school_ids:
            cache.delete(f"school:{school_id}:plugins")

    logger.info("expire_trials: deactivated %d expired trial installs", len(rows))
    return {"expired": len(rows), "schools": sorted(expired_school_ids)}
