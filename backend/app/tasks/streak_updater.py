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
    from app.models.gamification import StudentStreak, StudentBadge, Badge
    from app.models.attendance import AttendanceRecord
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
            # Get all student streaks for this school
            streaks = StudentStreak.query.filter_by(
                school_id=school_id,
                streak_type="attendance",
            ).all()

            for streak in streaks:
                # Check if student was present yesterday
                was_present = AttendanceRecord.query.filter_by(
                    school_id=school_id,
                    student_id=streak.student_id,
                    date=yesterday,
                    status="present",
                ).first()

                if was_present:
                    streak.current_count += 1
                    if streak.current_count > streak.best_count:
                        streak.best_count = streak.current_count

                    # Check milestone badges (7, 30, 100 days)
                    for milestone in [7, 30, 100]:
                        if streak.current_count == milestone:
                            emit_for_school(
                                "gamification.streak_milestone",
                                school_id=str(school_id),
                                student_id=str(streak.student_id),
                                streak_type="attendance",
                                days=milestone,
                            )
                else:
                    # Reset streak
                    streak.current_count = 0

            db.session.commit()
            logger.info("Updated streaks for school %s", school_id)
        except Exception:
            db.session.rollback()
            logger.exception("Streak update failed for school %s", school_id)
