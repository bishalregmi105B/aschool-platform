"""A-02 notification matrix resolver — the single enforcement point every
sender consults before delivering on a channel.

Semantics (the empty-table-is-today's-behavior rule):
  - no rule rows for (school, event, channel) → channel ENABLED;
  - an explicit row with enabled=False → channel DISABLED for that event
    (for the rule's audience, or globally when audience_role='');
  - an explicit enabled=True row is a no-op (documented preference).
"""
import logging

logger = logging.getLogger(__name__)

CHANNELS = ("push", "sms", "email", "whatsapp")

# The canonical plugin-event vocabulary (E-01). Senders use event keys from
# this list; the matrix UI offers exactly these.
KNOWN_EVENTS = [
    "attendance.marked",
    "attendance.absent_alert",
    "fees.collected",
    "fees.overdue",
    "fees.reminder_sent",
    "exams.scheduled",
    "exams.marks_entered",
    "exams.result_published",
    "online_exam.submitted",
    "notice.published",
    "admission.accepted",
    "admission.enrolled",
    "assignment.created",
    "assignment.submitted",
    "timetable.generated",
    "library.issued",
    "library.returned",
    "library.overdue",
    "library.fine_created",
    "library.hold_ready",
    "incident.reported",
    "emergency.alert_triggered",
    "wellbeing.alert_triggered",
    "wellbeing.mood_logged",
    "conference.booked",
    "sms.sent",
    "website.published",
    "gamification.badge_earned",
    "gamification.points_awarded",
    "gamification.streak_milestone",
    "file.uploaded",
    "file.deleted",
    "iemis.import_completed",
    "whatsapp.message_received",
    "academics.class_created",
]


def channels_for(school_id, event_key: str) -> dict[str, bool]:
    """Channel enablement for one event at one school — defaults on."""
    result = {channel: True for channel in CHANNELS}
    if not school_id or not event_key:
        return result
    try:
        from app.models.notification import NotificationRule

        rows = NotificationRule.query.filter(
            NotificationRule.school_id == school_id,
            NotificationRule.event_key == event_key,
            NotificationRule.enabled.is_(False),
            NotificationRule.is_deleted.is_(False),
        ).all()
        for row in rows:
            if row.channel in result:
                result[row.channel] = False
    except Exception:  # noqa: BLE001 — matrix failure must not block sending
        logger.warning("notification matrix lookup failed for %s", event_key, exc_info=True)
    return result


def channel_enabled(school_id, event_key: str, channel: str) -> bool:
    return channels_for(school_id, event_key).get(channel, True)
