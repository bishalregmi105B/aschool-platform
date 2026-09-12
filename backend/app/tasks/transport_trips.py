"""S-A4 transport beat tasks (A-10): instance publication + stale-run
safety net.

Both are idempotent: publish skips dates already materialized; force-end
only closes genuinely stale running instances (last fix older than the
window).
"""
import logging

from extensions import celery

logger = logging.getLogger(__name__)


@celery.task(name="publish_transport_instances", queue="default")
def publish_transport_instances():
    """Materialize today's trip instances for every school with the
    gps_tracking plugin active. Runs every 5 minutes (cheap: one indexed
    existence check per trip) so a trip created mid-morning still runs
    today."""
    from datetime import date

    from app.models.plugin import SchoolPlugin
    from extensions import db

    school_ids = [
        str(row[0])
        for row in db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="gps_tracking", active=True)
        .all()
    ]
    total = 0
    for school_id in school_ids:
        try:
            from app.services.transport_service import publish_instances_for_date

            result = publish_instances_for_date(school_id, date.today())
            total += result.get("created", 0)
        except Exception:  # noqa: BLE001 — one school must not block the rest
            logger.exception("instance publish failed for school %s", school_id)
    if total:
        logger.info("published %s transport instance(s)", total)
    return {"created": total}


@celery.task(name="force_end_stale_transport", queue="default")
def force_end_stale_transport():
    """Close running instances whose last GPS fix is older than 4 hours —
    the driver app died mid-trip (SBT's silent failure mode; ours self-
    heals and marks the tail missed)."""
    from app.models.plugin import SchoolPlugin
    from extensions import db

    school_ids = [
        str(row[0])
        for row in db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="gps_tracking", active=True)
        .all()
    ]
    closed = 0
    for school_id in school_ids:
        try:
            from app.services.transport_service import force_end_stale

            closed += force_end_stale(school_id)
        except Exception:  # noqa: BLE001
            logger.exception("stale-end failed for school %s", school_id)
    if closed:
        logger.info("force-ended %s stale transport run(s)", closed)
    return {"closed": closed}
