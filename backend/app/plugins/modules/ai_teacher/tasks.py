"""AI Teacher Celery tasks — the belt-and-braces reconciler + retention.

Webhooks are best-effort; the poller is the source of eventual truth
(AT §B.6). Both tasks are registered on the default queue via the manifest
tasks[] header.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


def reconcile_lessons() -> dict:
    """Every 10 min: poll the service for lessons stuck in ready/teaching
    past max_minutes + 5, and close them as abandoned with whatever the
    service reports. Runs inside the Flask app context (Celery task)."""
    from flask import current_app

    from app.models.ai_teacher import AITeacherLesson
    from extensions import db

    closed = 0
    cutoff_buffer = 5
    stuck = AITeacherLesson.query.filter(
        AITeacherLesson.status.in_(["ready", "teaching", "paused"]),
        AITeacherLesson.is_deleted.is_(False),
    ).all()
    now = datetime.now(timezone.utc)
    for lesson in stuck:
        started = lesson.started_at or lesson.created_at
        if started is None:
            continue
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        deadline = started + timedelta(minutes=(lesson.max_minutes or 25) + cutoff_buffer)
        if now < deadline:
            continue
        # Best-effort poll of the service for final state; if unreachable,
        # close as abandoned with the estimate (we never fake a measured one).
        final = None
        try:
            from app.plugins.modules.ai_teacher.service_client import (
                ServiceUnavailableError,
                get_session_state,
            )

            final = get_session_state(lesson)
        except ServiceUnavailableError:
            final = None
        if final:
            # Poll-derived events go through the SAME applier as webhooks
            # (routes.apply_event) so lessons converge either way.
            from app.plugins.modules.ai_teacher.routes import apply_event

            for event in final.get("events") or []:
                try:
                    apply_event(
                        lesson,
                        event.get("type", ""),
                        event.get("payload") or {},
                        event.get("event_id"),
                    )
                except Exception:  # noqa: BLE001 — one bad event ≠ a stuck lesson
                    logger.warning(
                        "ai_teacher.reconcile: bad event for %s",
                        lesson.id,
                        exc_info=True,
                    )
            db.session.expire(lesson)
            db.session.refresh(lesson)
            usage = final.get("usage")
            if usage and lesson.cost_source != "measured":
                from app.plugins.modules.ai_teacher.routes import _usage_log
                from app.services.ai.token_hub import (
                    estimate_cost_usd,
                    reconcile_quota_reservation,
                )

                cost_usd = estimate_cost_usd(
                    usage.get("provider", "groq"),
                    usage.get("model", "unknown"),
                    int(usage.get("prompt_tokens", 0)),
                    int(usage.get("completion_tokens", 0)),
                )
                lesson.cost_npr = round(cost_usd * 135, 2)
                lesson.cost_source = "measured"
                db.session.add(_usage_log(lesson, usage, cost_usd))
                reconcile_quota_reservation(
                    lesson.school_id,
                    float(lesson.estimated_cost_npr or 0) / 135,
                    cost_usd,
                )
            if final.get("status") == "ended":
                continue  # apply_event already closed it honestly
        lesson.status = "abandoned"
        lesson.end_reason = "reconciler_timeout"
        lesson.ended_at = now
        if lesson.started_at:
            lesson.duration_seconds = int((now - lesson.started_at).total_seconds())
        closed += 1
    db.session.commit()
    if closed:
        logger.info("ai_teacher.reconcile_lessons closed %d stale lesson(s)", closed)
    return {"closed": closed}


def purge_transcripts() -> dict:
    """Nightly: delete mirrored messages older than each school's configured
    transcript_retention_days (plugin config, default 180)."""
    from app.models.ai_teacher import AITeacherMessage, AITeacherLesson
    from app.plugins.config_store import plugin_config_value
    from extensions import db
    from sqlalchemy import func

    purged = 0
    school_ids = [
        row[0]
        for row in db.session.query(AITeacherLesson.school_id).distinct().all()
    ]
    for school_id in school_ids:
        days = int(
            plugin_config_value(str(school_id), "ai_teacher",
                                "transcript_retention_days", 180) or 180
        )
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        deleted = (
            AITeacherMessage.query.filter(
                AITeacherMessage.school_id == school_id,
                AITeacherMessage.created_at < cutoff,
            )
            .delete(synchronize_session=False)
        )
        purged += deleted
    db.session.commit()
    if purged:
        logger.info("ai_teacher.purge_transcripts removed %d message(s)", purged)
    return {"purged": purged}
