"""Gamification streak updater — updates daily streaks and awards badges."""
from extensions import celery
from app.plugins.events import emit_for_school
import logging

logger = logging.getLogger(__name__)


@celery.task(name="gamification_streak_update")
def update_student_streaks():
    """Run nightly: update attendance/homework streaks and award badges.

    Only processes schools with the 'gamification' plugin active.
    """
    from extensions import db
    from app.models.plugin import SchoolPlugin
    from app.models.gamification import StudentBadge, Badge
    from app.models.attendance import Attendance
    from datetime import date, timedelta

    today = date.today()
    yesterday = today - timedelta(days=1)

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="gamification", active=True)
        .all()
    )

    for (school_id,) in active_schools:
        try:
            # Derive attendance streaks from attendance records; award milestone badges.
            # There is no StudentStreak table — streak state is computed per student
            # by counting consecutive present days ending yesterday.
            students = (
                Attendance.query.with_entities(Attendance.student_id)
                .filter_by(school_id=school_id)
                .distinct()
                .all()
            )
            streaks = [
                type("StreakView", (), {"student_id": sid})()
                for (sid,) in students
            ]

            for streak in streaks:
                # Count consecutive present days ending yesterday.
                current_count = 0
                check_date = yesterday
                while True:
                    present = (
                        Attendance.query.filter_by(
                            school_id=school_id,
                            student_id=streak.student_id,
                            date=check_date,
                            status="present",
                        ).first()
                        is not None
                    )
                    if not present:
                        break
                    current_count += 1
                    check_date -= timedelta(days=1)

                if current_count > 0:
                    # Check milestone badges (7, 30, 100 days)
                    for milestone in [7, 30, 100]:
                        if current_count == milestone:
                            emit_for_school(
                                "gamification.streak_milestone",
                                school_id=str(school_id),
                                student_id=str(streak.student_id),
                                streak_type="attendance",
                                days=milestone,
                            )

            db.session.commit()
            logger.info("Updated streaks for school %s", school_id)
        except Exception:
            db.session.rollback()
            logger.exception("Streak update failed for school %s", school_id)
