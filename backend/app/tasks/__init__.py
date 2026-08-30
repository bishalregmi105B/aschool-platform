"""Celery tasks — plugin event processing + autodiscovery."""
from extensions import celery


@celery.task(name="process_plugin_event")
def process_plugin_event(event_name: str, kwargs: dict):
    """Process a plugin event asynchronously."""
    from app.plugins.events import emit

    emit(event_name, **kwargs)


@celery.task(name="process_plugin_event_for_school")
def process_plugin_event_for_school(event_name: str, school_id: str, kwargs: dict):
    """Process a plugin event for a specific school — checks plugin activation."""
    from app.plugins.events import emit_for_school

    emit_for_school(event_name, school_id, **kwargs)


# ── Import all task modules for Celery autodiscovery ──────────────────────
# Each module registers its @celery.task decorated functions.
from app.tasks import (  # noqa: E402, F401
    fee_reminders,
    report_generation,
    ai_insights_weekly,
    gps_processing,
    admission_followup,
    social_sync,
    sms_sender,
    whatsapp_sender,
    push_notifications,
    website_sync,
    website_live_sync,
    attendance_alerts,
    library_overdue,
    payroll_monthly,
    sitemap_rebuild,
    analytics_aggregate,
    academic_rollover,
    streak_updater,
    social_scheduler,
    db_backup,
    gps_firebase_poller,
    trial_expiry,
)

