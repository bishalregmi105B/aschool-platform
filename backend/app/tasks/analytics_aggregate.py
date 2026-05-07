"""Daily analytics aggregation — rolls up metrics for school dashboards."""
from extensions import celery
import logging

logger = logging.getLogger(__name__)


@celery.task(name="analytics_aggregate_daily")
def aggregate_daily_metrics():
    """Run nightly: aggregate daily attendance, fee, enrollment metrics per school."""
    from extensions import db
    from app.models.school import School
    from app.models.student import Student
    from app.models.attendance import AttendanceRecord
    from app.models.fee import FeeCollection
    from app.models.ai_insight import DailyMetric
    from datetime import date
    from sqlalchemy import func

    today = date.today()

    schools = School.query.filter_by(is_deleted=False).all()

    for school in schools:
        try:
            # Student count
            student_count = Student.query.filter_by(
                school_id=school.id, is_deleted=False
            ).count()

            # Today's attendance
            present = AttendanceRecord.query.filter_by(
                school_id=school.id, date=today, status="present"
            ).count()
            absent = AttendanceRecord.query.filter_by(
                school_id=school.id, date=today, status="absent"
            ).count()
            total_marked = present + absent
            attendance_rate = (present / total_marked * 100) if total_marked > 0 else 0

            # Today's fee collection
            fees_collected = (
                db.session.query(func.coalesce(func.sum(FeeCollection.amount), 0))
                .filter_by(school_id=school.id)
                .filter(func.date(FeeCollection.created_at) == today)
                .scalar()
            )

            # Upsert daily metric
            metric = DailyMetric.query.filter_by(
                school_id=school.id, date=today
            ).first()

            if not metric:
                metric = DailyMetric(school_id=school.id, date=today)
                db.session.add(metric)

            metric.total_students = student_count
            metric.attendance_rate = round(attendance_rate, 2)
            metric.fees_collected = fees_collected
            metric.present_count = present
            metric.absent_count = absent

            # Update denormalized school totals
            school.total_students = student_count

            db.session.commit()
            logger.info(
                "Aggregated metrics for %s: %d students, %.1f%% attendance, Rs.%s fees",
                school.slug,
                student_count,
                attendance_rate,
                fees_collected,
            )
        except Exception:
            db.session.rollback()
            logger.exception("Analytics aggregation failed for school %s", school.id)
