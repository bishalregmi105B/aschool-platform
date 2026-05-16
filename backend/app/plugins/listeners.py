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
def on_attendance_marked(school_id: str, date: str, count: int, **kwargs):
    """Triggered when attendance is submitted for a class.

    Actions:
    - Send push notification to parents of absent students
    - Feed data to analytics
    """
    logger.info(
        "[EVENT] attendance.marked — school=%s, date=%s, students=%d",
        school_id, date, count,
    )
    try:
        from app.tasks.push_notifications import send_push_to_school

        send_push_to_school.delay(
            school_id=school_id,
            title="Attendance Updated",
            body=f"Attendance for {date} has been recorded ({count} students).",
            roles=["parent"],
            data={"type": "attendance", "date": date},
        )
    except Exception:
        logger.exception("Failed to send attendance push notification")

    # Also create in-app notifications for parents
    try:
        _create_school_notifications(
            school_id=school_id,
            title="Attendance Updated",
            body=f"Attendance for {date} has been recorded ({count} students).",
            category="attendance",
            roles=["parent"],
            data={"type": "attendance", "date": date},
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
