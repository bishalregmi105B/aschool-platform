"""Daily absent student notification — alerts parents via WhatsApp/SMS/push.

S-A2 (A-33): the absent-SMS digest now (a) honors a per-school send window
(School.settings['attendance_absent_sms'] = {enabled, send_after, send_before,
template}) so guardians are messaged inside school hours, (b) reads the
SUBJECT register too — a student absent for the day AND a student who
missed only some subjects both surface, with the subject list in the SMS
(the InfixEdu digest placeholders), and (c) sends via Sparrow directly to
the primary guardian's phone when no event listener already handled it.
"""
from extensions import celery
import logging

logger = logging.getLogger(__name__)


def _within_send_window(window_cfg: dict) -> bool:
    after = str(window_cfg.get("send_after") or "16:00")[:5]
    before = str(window_cfg.get("send_before") or "20:00")[:5]
    from datetime import datetime, timezone, timedelta

    nepal_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=45)
    now_hm = nepal_now.strftime("%H:%M")
    return after <= now_hm <= before


@celery.task(name="attendance_alerts_daily")
def send_daily_absent_alerts():
    """Run daily at end of school hours: notify parents of absent students.

    Only fires for schools with the 'attendance' plugin active.
    Uses WhatsApp/SMS/Push based on school notification preferences.
    """
    from extensions import db
    from app.models.school import School
    from app.models.attendance import Attendance, SubjectAttendance
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
            # Plugin config kill-switch (config_schema.yaml →
            # absent_alerts_enabled, default true): a school that turned the
            # daily alert off is skipped entirely.
            from app.plugins.config_store import plugin_config_value

            if not plugin_config_value(
                str(school_id), "attendance", "absent_alerts_enabled", True
            ):
                continue

            absent_records = Attendance.query.filter_by(
                school_id=school_id,
                date=today,
                status="absent",
            ).all()

            for record in absent_records:
                emit_for_school(
                    "attendance.absent_alert",
                    school_id=str(school_id),
                    student_id=str(record.student_id),
                    date=str(today),
                )

            logger.info(
                "Sent %d absence alerts for school %s",
                len(absent_records),
                school_id,
            )

            _send_windowed_absent_sms(str(school_id), today)
        except Exception:
            logger.exception("Failed to send alerts for school %s", school_id)


def _send_windowed_absent_sms(school_id: str, today) -> None:
    """A-33 absent-SMS digest: per-school window + Sparrow direct to the
    primary guardian, with the [student_name] [date] [subject_list]
    placeholders. Subject absences come from SubjectAttendance; students
    already fully absent today are not messaged twice."""
    from datetime import datetime, timezone, timedelta

    from app.models.school import School
    from app.models.attendance import Attendance, SubjectAttendance
    from app.models.student import Guardian
    from app.services.communications.sms_gateway import SmsGatewayService

    school = School.query.get(school_id)
    if school is None:
        return
    cfg = {}
    if isinstance(school.settings, dict):
        cfg = school.settings.get("attendance_absent_sms") or {}
    if not cfg.get("enabled"):
        return
    if not _within_send_window(cfg):
        logger.info("absent-SMS window closed for school %s — skipping", school_id)
        return

    template = str(cfg.get("template") or "Notice: [student_name] was absent on [date].")

    # Fully-absent students today (dedupe set).
    absent_rows = Attendance.query.filter(
        Attendance.school_id == school_id,
        Attendance.date == today,
        Attendance.status == "absent",
        Attendance.is_deleted.is_(False),
    ).all()
    absent_ids = {str(r.student_id) for r in absent_rows}

    # Subject absences today — group by student.
    subject_rows = SubjectAttendance.query.filter(
        SubjectAttendance.school_id == school_id,
        SubjectAttendance.date == today,
        SubjectAttendance.status == "absent",
        SubjectAttendance.is_deleted.is_(False),
    ).all()
    subjects_by_student: dict[str, list[str]] = {}
    for row in subject_rows:
        if str(row.student_id) in absent_ids:
            continue  # full-day absence already messaged
        subjects_by_student.setdefault(str(row.student_id), []).append(
            row.subject.name if row.subject else "a subject"
        )

    targets: dict[str, list[str]] = {sid: [] for sid in absent_ids}
    for sid, names in subjects_by_student.items():
        targets[sid] = names

    sent = 0
    for student_id, subject_names in targets.items():
        from app.models.student import Student

        student = Student.query.filter_by(
            id=student_id, school_id=school_id, is_deleted=False
        ).first()
        if student is None:
            continue
        guardian = (
            Guardian.query.filter_by(student_id=student.id, is_primary=True, is_deleted=False).first()
            or Guardian.query.filter_by(student_id=student.id, is_deleted=False).first()
        )
        if guardian is None or not guardian.phone:
            continue
        message = (
            template.replace("[student_name]", f"{student.first_name or ''} {student.last_name or ''}".strip())
            .replace("[date]", str(today))
            .replace("[class]", getattr(student, "student_class", None) or "")
        )
        if subject_names:
            message += f" Subjects missed: {', '.join(subject_names[:6])}."
        try:
            result = SmsGatewayService.send_sms(guardian.phone, message)
            if result.get("success"):
                sent += 1
        except Exception:  # noqa: BLE001 — one guardian must not block the rest
            logger.exception("absent SMS failed for student %s", student_id)

    if sent:
        logger.info("absent-SMS digest sent %d message(s) for school %s", sent, school_id)
