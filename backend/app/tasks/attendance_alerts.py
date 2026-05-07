"""Daily absent student notification — alerts parents via WhatsApp/SMS/push."""
from extensions import celery
from app.plugins.events import emit_for_school
import logging

logger = logging.getLogger(__name__)


@celery.task(name="attendance_alerts_daily")
def send_daily_absent_alerts():
    """Run daily at end of school hours: notify parents of absent students.

    Only fires for schools with the 'attendance' plugin active.
    Uses WhatsApp/SMS/Push based on school notification preferences.
    """
    from extensions import db
    from app.models.school import School
    from app.models.attendance import AttendanceRecord
    from app.models.plugin import SchoolPlugin
    from datetime import date

    today = date.today()

    # Get schools with attendance plugin active
    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="attendance", active=True)
        .all()
    )

    for (school_id,) in active_schools:
        try:
            absent_records = AttendanceRecord.query.filter_by(
                school_id=school_id,
                date=today,
                status="absent",
            ).all()

            for record in absent_records:
                emit_for_school(
                    "attendance.student_absent",
                    school_id=str(school_id),
                    student_id=str(record.student_id),
                    date=str(today),
                )

            logger.info(
                "Sent %d absence alerts for school %s",
                len(absent_records),
                school_id,
            )
        except Exception:
            logger.exception("Failed to send alerts for school %s", school_id)
