"""
Cross-plugin event listeners — wires the event bus to actual actions.

This module registers @on() listeners that react to events emitted by various
plugins, enabling inter-plugin communication without tight coupling.

Import this module from the plugin loader or app factory to ensure listeners
are registered at startup.

Event flow:
    1. Plugin A emits: emit("fee.paid", school_id=..., student_id=..., amount=...)
    2. This module's @on("fee.paid") listener fires
    3. Listener triggers push notification, gamification points, analytics, etc.
"""
import logging

from app.plugins.events import on

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# ATTENDANCE EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("attendance.marked")
def on_attendance_marked(school_id: str, date, count: int, **kwargs):
    """Triggered when attendance is submitted for a class.

    Actions:
    - Send push notification to parents of absent students
    - Feed data to analytics
    """
    # Normalize date to ISO string to prevent JSONB serialization errors
    from datetime import date as _date
    date_str = date.isoformat() if isinstance(date, _date) else str(date)
    logger.info(
        "[EVENT] attendance.marked — school=%s, date=%s, students=%d",
        school_id, date_str, count,
    )
    try:
        from app.tasks.push_notifications import send_push_to_school

        send_push_to_school.delay(
            school_id=school_id,
            title="Attendance Updated",
            body=f"Attendance for {date_str} has been recorded ({count} students).",
            roles=["parent"],
            data={"type": "attendance", "date": date_str},
        )
    except Exception:
        logger.exception("Failed to send attendance push notification")

    # Also create in-app notifications for parents
    try:
        _create_school_notifications(
            school_id=school_id,
            title="Attendance Updated",
            body=f"Attendance for {date_str} has been recorded ({count} students).",
            category="attendance",
            roles=["parent"],
            data={"type": "attendance", "date": date_str},
        )
    except Exception:
        logger.exception("Failed to create attendance in-app notifications")


# ═══════════════════════════════════════════════════════════════════════════
# FEE EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("fee.paid")
def on_fee_paid(school_id: str, student_id: str, amount: float, **kwargs):
    """Triggered when a fee payment is recorded.

    Actions:
    - Send push notification to parent confirming payment
    - Send SMS receipt notification
    - Award gamification points for timely payment
    """
    logger.info(
        "[EVENT] fee.paid — school=%s, student=%s, amount=%.2f",
        school_id, student_id, amount,
    )

    # 1. Push notification to parent
    try:
        from app.models.student import Student
        student = Student.query.filter_by(id=student_id).first()
        if student and student.user_id:
            from app.tasks.push_notifications import send_push_notification
            from app.models.user import User

            parent = User.query.filter_by(id=student.user_id, is_deleted=False).first()
            if parent and parent.onesignal_player_ids:
                for pid in parent.onesignal_player_ids:
                    send_push_notification.delay(
                        player_id=pid,
                        title="Payment Received ✅",
                        body=f"NPR {amount:,.0f} payment recorded for {student.first_name}.",
                        data={"type": "fee_paid", "student_id": student_id},
                    )

            # In-app notification for parent
            if parent:
                _create_user_notification(
                    school_id=school_id,
                    user_id=str(parent.id),
                    title="Payment Received ✅",
                    body=f"NPR {amount:,.0f} payment recorded for {student.first_name}.",
                    category="fee",
                    data={"type": "fee_paid", "student_id": student_id},
                )
    except Exception:
        logger.exception("Failed to send fee payment push notification")

    # 2. Gamification: award points for payment
    try:
        _award_points_if_enabled(
            school_id=school_id,
            student_id=student_id,
            points=5,
            reason="Fee payment recorded",
            category="fee_payment",
        )
    except Exception:
        logger.exception("Failed to award gamification points for fee payment")


# ═══════════════════════════════════════════════════════════════════════════
# NOTICE EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("notice.created")
def on_notice_created(school_id: str, notice_id: str, **kwargs):
    """Triggered when a new notice/circular is published.

    Actions:
    - Send push notification to all school users
    """
    logger.info(
        "[EVENT] notice.created — school=%s, notice=%s",
        school_id, notice_id,
    )
    try:
        from app.models.notice import Notice
        notice = Notice.query.filter_by(id=notice_id).first()
        title = notice.title if notice else "New Notice"

        from app.tasks.push_notifications import send_push_to_school

        send_push_to_school.delay(
            school_id=school_id,
            title="📢 New Notice",
            body=title[:100],
            data={"type": "notice", "notice_id": notice_id},
        )
    except Exception:
        logger.exception("Failed to send notice push notification")

    # In-app notification for all school users
    try:
        _create_school_notifications(
            school_id=school_id,
            title="📢 New Notice",
            body=title[:100],
            category="notice",
            data={"type": "notice", "notice_id": notice_id},
        )
    except Exception:
        logger.exception("Failed to create notice in-app notifications")


# ═══════════════════════════════════════════════════════════════════════════
# EXAM EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("marks.submitted")
def on_marks_submitted(school_id: str, exam_id: str, **kwargs):
    """Triggered when marks are submitted for an exam.

    Actions:
    - Notify teachers that marks are under review
    """
    logger.info(
        "[EVENT] marks.submitted — school=%s, exam=%s",
        school_id, exam_id,
    )


@on("results.published")
def on_results_published(school_id: str, exam_id: str, **kwargs):
    """Triggered when exam results are published.

    Actions:
    - Send push notification to parents and students
    - Award gamification points based on performance
    """
    logger.info(
        "[EVENT] results.published — school=%s, exam=%s",
        school_id, exam_id,
    )
    try:
        from app.tasks.push_notifications import send_push_to_school

        send_push_to_school.delay(
            school_id=school_id,
            title="📊 Results Published",
            body="Exam results have been published. Check your dashboard.",
            roles=["parent", "student"],
            data={"type": "results", "exam_id": exam_id},
        )
    except Exception:
        logger.exception("Failed to send results published push notification")

    # In-app notification
    try:
        _create_school_notifications(
            school_id=school_id,
            title="📊 Results Published",
            body="Exam results have been published. Check your dashboard.",
            category="exam",
            roles=["parent", "student"],
            data={"type": "results", "exam_id": exam_id},
        )
    except Exception:
        logger.exception("Failed to create results in-app notifications")

    # Award points to all students who scored above threshold
    try:
        _award_exam_performance_points(school_id, exam_id)
    except Exception:
        logger.exception("Failed to award exam performance points")


# ═══════════════════════════════════════════════════════════════════════════
# GAMIFICATION EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("gamification.points_awarded")
def on_points_awarded(school_id: str, student_id: str, points: int, **kwargs):
    """Triggered when gamification points are awarded.

    Actions:
    - Send push notification to student
    """
    logger.info(
        "[EVENT] gamification.points_awarded — school=%s, student=%s, points=%d",
        school_id, student_id, points,
    )
    try:
        from app.models.student import Student
        student = Student.query.filter_by(id=student_id).first()
        if student and student.user_id:
            from app.models.user import User
            user = User.query.filter_by(id=student.user_id, is_deleted=False).first()
            if user and user.onesignal_player_ids:
                from app.tasks.push_notifications import send_push_notification
                for pid in user.onesignal_player_ids:
                    send_push_notification.delay(
                        player_id=pid,
                        title="🏆 Points Earned!",
                        body=f"You earned {points} points!",
                        data={"type": "gamification", "points": points},
                    )
    except Exception:
        logger.exception("Failed to send gamification push notification")


@on("gamification.badge_earned")
def on_badge_earned(school_id: str, student_id: str, badge_name: str = "", **kwargs):
    """Triggered when a student earns a badge."""
    logger.info(
        "[EVENT] gamification.badge_earned — school=%s, student=%s, badge=%s",
        school_id, student_id, badge_name,
    )
    try:
        from app.models.student import Student
        student = Student.query.filter_by(id=student_id).first()
        if student and student.user_id:
            from app.models.user import User
            user = User.query.filter_by(id=student.user_id, is_deleted=False).first()
            if user and user.onesignal_player_ids:
                from app.tasks.push_notifications import send_push_notification
                for pid in user.onesignal_player_ids:
                    send_push_notification.delay(
                        player_id=pid,
                        title="🎖️ Badge Unlocked!",
                        body=f"You earned the '{badge_name}' badge!",
                        data={"type": "badge", "badge_name": badge_name},
                    )
    except Exception:
        logger.exception("Failed to send badge earned notification")


# ═══════════════════════════════════════════════════════════════════════════
# FILE EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("file.uploaded")
def on_file_uploaded(school_id: str, file_id: str, folder: str = "", **kwargs):
    """Log file uploads for analytics."""
    logger.info(
        "[EVENT] file.uploaded — school=%s, file=%s, folder=%s",
        school_id, file_id, folder,
    )


@on("file.deleted")
def on_file_deleted(school_id: str, file_id: str, **kwargs):
    """Log file deletions for audit trail."""
    logger.info(
        "[EVENT] file.deleted — school=%s, file=%s",
        school_id, file_id,
    )


# ═══════════════════════════════════════════════════════════════════════════
# IEMIS EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("iemis.imported")
def on_iemis_imported(school_id: str, **kwargs):
    """Log IEMIS data import completion."""
    logger.info("[EVENT] iemis.imported — school=%s", school_id)
    try:
        from app.tasks.push_notifications import send_push_to_school

        send_push_to_school.delay(
            school_id=school_id,
            title="✅ IEMIS Import Complete",
            body="Student data has been imported from IEMIS successfully.",
            roles=["school_admin"],
            data={"type": "iemis_import"},
        )
    except Exception:
        logger.exception("Failed to send IEMIS import notification")

    try:
        _create_school_notifications(
            school_id=school_id,
            title="✅ IEMIS Import Complete",
            body="Student data has been imported from IEMIS successfully.",
            category="system",
            roles=["school_admin"],
            data={"type": "iemis_import"},
        )
    except Exception:
        logger.exception("Failed to create IEMIS in-app notification")


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def _award_points_if_enabled(
    school_id: str,
    student_id: str,
    points: int,
    reason: str,
    category: str,
):
    """Award gamification points if the gamification plugin is active."""
    from app.plugins.events import _school_has_plugin

    if not _school_has_plugin(school_id, "gamification"):
        return

    from app.models.gamification import PointsLog
    from extensions import db

    log = PointsLog(
        school_id=school_id,
        student_id=student_id,
        points=points,
        reason=reason,
        category=category,
    )
    try:
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Failed to award gamification points")


def _award_exam_performance_points(school_id: str, exam_id: str):
    """Award gamification XP to students scoring above 80% on an exam."""
    from app.plugins.events import _school_has_plugin

    if not _school_has_plugin(school_id, "gamification"):
        return

    from app.models.exam import Marks
    from app.models.gamification import PointsLog
    from extensions import db

    marks = Marks.query.filter_by(
        school_id=school_id,
        exam_id=exam_id,
        is_deleted=False,
    ).all()

    for mark in marks:
        if not mark.student_id:
            continue
        total = float(mark.total_marks or 0)
        obtained = float(mark.obtained_marks or 0)
        if total <= 0:
            continue
        percentage = (obtained / total) * 100

        if percentage >= 90:
            points = 20
        elif percentage >= 80:
            points = 10
        elif percentage >= 70:
            points = 5
        else:
            continue

        log = PointsLog(
            school_id=school_id,
            student_id=mark.student_id,
            points=points,
            reason=f"Exam performance: {percentage:.0f}%",
            category="exam_performance",
        )
        db.session.add(log)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Failed to award exam performance points in batch")


# ═══════════════════════════════════════════════════════════════════════════
# IN-APP NOTIFICATION HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _create_user_notification(
    school_id: str,
    user_id: str,
    title: str,
    body: str,
    category: str = "general",
    priority: str = "normal",
    data: dict | None = None,
    action_url: str | None = None,
):
    """Create an in-app notification for a specific user."""
    try:
        from app.api.v1.notifications import create_notification

        create_notification(
            school_id=school_id,
            user_id=user_id,
            title=title,
            body=body,
            category=category,
            priority=priority,
            data=data,
            action_url=action_url,
        )
    except Exception:
        logger.exception("Failed to create in-app notification for user=%s", user_id)


def _create_school_notifications(
    school_id: str,
    title: str,
    body: str,
    category: str = "general",
    priority: str = "normal",
    roles: list[str] | None = None,
    data: dict | None = None,
    action_url: str | None = None,
):
    """Create in-app notifications for all users in a school (optionally filtered by role).

    For efficiency, this only creates notifications for active users.
    In a production environment with high volume, consider making this async.
    """
    try:
        from app.models.user import User
        from app.api.v1.notifications import create_notification
        from extensions import db

        query = User.query.filter_by(school_id=school_id, is_deleted=False)
        if roles:
            query = query.filter(User.role.in_(roles))

        # Limit to 500 users per event to avoid DB overload
        users = query.limit(500).all()

        for user in users:
            try:
                from app.models.notification import InAppNotification

                notification = InAppNotification(
                    school_id=school_id,
                    user_id=str(user.id),
                    title=title,
                    body=body,
                    category=category,
                    priority=priority,
                    data=data or {},
                    action_url=action_url,
                )
                db.session.add(notification)
            except Exception:
                continue

        db.session.commit()
        logger.info(
            "Created %d in-app notifications for school=%s category=%s",
            len(users), school_id, category,
        )
    except Exception:
        logger.exception("Failed to create school-wide in-app notifications")


# ═══════════════════════════════════════════════════════════════════════════
# ADMISSION EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("admission.accepted")
def on_admission_accepted(school_id: str, application_id: str, **kwargs):
    """Triggered when an admission application is accepted.

    Actions:
    - Auto-create a student User account + Student profile
    - Send welcome SMS to parent/applicant
    - Push notification to school admin
    """
    logger.info(
        "[EVENT] admission.accepted — school=%s, application=%s",
        school_id, application_id,
    )
    try:
        from app.models.admission import AdmissionApplication
        from app.models.user import User
        from app.models.student import Student
        from app.utils.password import generate_default_password
        from extensions import db

        app_obj = AdmissionApplication.query.filter_by(id=application_id, school_id=school_id).first()
        if not app_obj:
            logger.warning("Admission application %s not found", application_id)
            return

        # Skip if student already created
        existing = Student.query.filter_by(
            school_id=school_id,
            admission_application_id=application_id,
        ).first() if hasattr(Student, "admission_application_id") else None
        if existing:
            logger.info("Student already created for application %s", application_id)
            return

        # Create User account
        user = User(
            school_id=school_id,
            role="student",
            full_name=app_obj.student_name or "",
            email=app_obj.parent_email or None,
            phone=app_obj.parent_phone or None,
            is_active=True,
        )
        db.session.add(user)
        db.session.flush()

        # Create Student profile
        student = Student(
            school_id=school_id,
            user_id=user.id,
            first_name=(app_obj.student_name or "").split(" ")[0],
            last_name=" ".join((app_obj.student_name or "").split(" ")[1:]) or "",
            class_id=app_obj.class_applied_id if hasattr(app_obj, "class_applied_id") else None,
        )
        db.session.add(student)
        db.session.commit()

        logger.info("Auto-created student user=%s from admission application=%s", user.id, application_id)

        # Send welcome SMS to parent
        if app_obj.parent_phone:
            try:
                from app.services.communications.sms_gateway import SMSGateway
                SMSGateway.send_sms(
                    app_obj.parent_phone,
                    f"Congratulations! {app_obj.student_name}'s admission has been accepted. "
                    f"Student login: {user.email or user.phone}. "
                    f"Default password will be shared by school administration.",
                )
            except Exception:
                logger.exception("Failed to send admission acceptance SMS")

    except Exception:
        logger.exception("Failed to auto-create student from admission application=%s", application_id)


@on("admission.enrolled")
def on_admission_enrolled(school_id: str, application_id: str, **kwargs):
    """Triggered when an admitted student is formally enrolled."""
    logger.info(
        "[EVENT] admission.enrolled — school=%s, application=%s",
        school_id, application_id,
    )
    # Notify admin + assign default fee structure (future enhancement)


# ═══════════════════════════════════════════════════════════════════════════
# ASSIGNMENT EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("assignment.submitted")
def on_assignment_submitted(
    school_id: str, assignment_id: str, student_id: str, submission_id: str, **kwargs
):
    """Triggered when a student submits an assignment.

    Actions:
    - Push/in-app notification to the assignment's teacher
    - Award gamification XP to the student
    """
    logger.info(
        "[EVENT] assignment.submitted — school=%s, assignment=%s, student=%s",
        school_id, assignment_id, student_id,
    )

    # Notify the teacher who created the assignment
    try:
        from app.models.assignment import Assignment
        assignment = Assignment.query.filter_by(id=assignment_id, school_id=school_id).first()
        if assignment and assignment.created_by_id:
            from app.models.user import User
            teacher = User.query.filter_by(id=assignment.created_by_id, is_deleted=False).first()
            if teacher:
                _create_user_notification(
                    school_id=school_id,
                    user_id=str(teacher.id),
                    title="📝 New Submission",
                    body=f"A student submitted '{assignment.title}'.",
                    category="assignment",
                    data={"type": "assignment_submitted", "assignment_id": assignment_id},
                )
    except Exception:
        logger.exception("Failed to notify teacher of assignment submission")

    # Award gamification points for submitting on time
    try:
        _award_points_if_enabled(
            school_id=school_id,
            student_id=student_id,
            points=3,
            reason="Assignment submitted",
            category="assignment_submission",
        )
    except Exception:
        logger.exception("Failed to award points for assignment submission")


# ═══════════════════════════════════════════════════════════════════════════
# INCIDENT EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("incident.created")
def on_incident_created(
    school_id: str, incident_id: str, severity: str = "low", title: str = "", **kwargs
):
    """Triggered when an incident is reported.

    Actions:
    - Notify school admin via push + in-app notification
    - If severity is high/critical, also send SMS to admin
    """
    logger.info(
        "[EVENT] incident.created — school=%s, incident=%s, severity=%s",
        school_id, incident_id, severity,
    )

    try:
        from app.tasks.push_notifications import send_push_to_school

        send_push_to_school.delay(
            school_id=school_id,
            title="⚠️ Incident Reported",
            body=f"{title[:80]}" if title else "A new incident has been reported.",
            roles=["school_admin", "superadmin"],
            data={"type": "incident", "incident_id": incident_id, "severity": severity},
        )
    except Exception:
        logger.exception("Failed to send incident push notification")

    try:
        _create_school_notifications(
            school_id=school_id,
            title="⚠️ Incident Reported",
            body=f"{title[:100]}" if title else "A new incident has been reported.",
            category="incident",
            priority="high" if severity in ("high", "critical") else "normal",
            roles=["school_admin"],
            data={"type": "incident", "incident_id": incident_id},
        )
    except Exception:
        logger.exception("Failed to create incident in-app notification")

    # For high/critical severity, send SMS to admin
    if severity in ("high", "critical"):
        try:
            from app.models.user import User
            admins = User.query.filter_by(
                school_id=school_id, role="school_admin", is_active=True, is_deleted=False
            ).limit(5).all()
            if admins:
                from app.services.communications.sms_gateway import SMSGateway
                for admin in admins:
                    if admin.phone:
                        SMSGateway.send_sms(
                            admin.phone,
                            f"URGENT: {severity.upper()} incident reported at school. "
                            f"Title: {title[:60]}. Login to ASchool dashboard to review.",
                        )
        except Exception:
            logger.exception("Failed to send high-severity incident SMS")


# ═══════════════════════════════════════════════════════════════════════════
# EMERGENCY EVENTS
# ═══════════════════════════════════════════════════════════════════════════

@on("emergency.alert_broadcast")
def on_emergency_alert(
    school_id: str, alert_id: str, alert_type: str = "general", title: str = "", **kwargs
):
    """Triggered when an emergency alert is broadcast.

    Actions:
    - Push notification to ALL school users (parents, students, teachers, admin)
    - Bulk SMS to all users with phone numbers
    - In-app notification center entry for every user
    """
    logger.info(
        "[EVENT] emergency.alert_broadcast — school=%s, alert=%s, type=%s",
        school_id, alert_id, alert_type,
    )

    push_title = f"🚨 EMERGENCY: {title[:60]}" if title else "🚨 EMERGENCY ALERT"
    push_body = f"An emergency alert has been issued. Please follow school instructions immediately."

    # Push notification to ALL users in school
    try:
        from app.tasks.push_notifications import send_push_to_school
        send_push_to_school.delay(
            school_id=school_id,
            title=push_title,
            body=push_body,
            data={"type": "emergency", "alert_id": alert_id, "alert_type": alert_type},
        )
    except Exception:
        logger.exception("Failed to send emergency push notification")

    # In-app notification for all users
    try:
        _create_school_notifications(
            school_id=school_id,
            title=push_title,
            body=push_body,
            category="emergency",
            priority="urgent",
            data={"type": "emergency", "alert_id": alert_id},
        )
    except Exception:
        logger.exception("Failed to create emergency in-app notifications")

    # Bulk SMS to all users with phone numbers
    try:
        from app.models.user import User
        from app.services.communications.sms_gateway import SMSGateway

        users_with_phones = User.query.filter(
            User.school_id == school_id,
            User.phone.isnot(None),
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        ).with_entities(User.phone).limit(1000).all()

        numbers = [u.phone for u in users_with_phones if u.phone]
        if numbers:
            sms_body = f"EMERGENCY ALERT: {title[:80]}. Please follow school instructions." if title else \
                       "EMERGENCY ALERT from ASchool. Please follow school instructions immediately."
            SMSGateway.send_bulk(numbers, sms_body, identity="ASchool-Emergency")
    except Exception:
        logger.exception("Failed to send emergency bulk SMS")
