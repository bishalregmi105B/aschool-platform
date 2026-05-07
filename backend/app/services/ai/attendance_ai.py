"""AI Attendance Analytics — pattern detection and prediction."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class AttendanceAI:
    """AI-powered attendance analytics and pattern detection."""

    @staticmethod
    def detect_patterns(school_id: str, class_id: str = None) -> dict:
        """Detect attendance patterns: day-of-week trends, seasonal drops, etc."""
        from app.models.attendance import AttendanceRecord
        from sqlalchemy import func
        from extensions import db

        query = AttendanceRecord.query.filter_by(school_id=school_id)
        if class_id:
            query = query.filter_by(class_id=class_id)

        # Day-of-week analysis
        dow_stats = (
            db.session.query(
                func.extract("dow", AttendanceRecord.date).label("dow"),
                func.count(AttendanceRecord.id).label("total"),
                func.sum(func.cast(AttendanceRecord.status == "present", db.Integer)).label("present"),
            )
            .filter_by(school_id=school_id)
            .group_by("dow")
            .all()
        )

        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        patterns = []
        for dow, total, present in dow_stats:
            rate = (present / total * 100) if total > 0 else 0
            patterns.append({"day": day_names[int(dow)], "rate": round(rate, 1), "total": total})

        # Find lowest attendance day
        worst_day = min(patterns, key=lambda x: x["rate"]) if patterns else None

        return {
            "day_of_week": patterns,
            "worst_day": worst_day,
            "recommendation": f"Consider scheduling important activities away from {worst_day['day']}s" if worst_day else None,
        }

    @staticmethod
    def predict_absence(student_id: str, school_id: str = None) -> dict:
        """Predict likelihood of absence for a student."""
        from app.models.attendance import AttendanceRecord
        from datetime import date, timedelta

        last_30 = date.today() - timedelta(days=30)
        records = AttendanceRecord.query.filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= last_30,
        ).all()

        total = len(records)
        absent = sum(1 for r in records if r.status == "absent")
        rate = (absent / total * 100) if total > 0 else 0

        return {
            "absence_rate_30d": round(rate, 1),
            "risk": "high" if rate > 25 else "medium" if rate > 15 else "low",
            "total_days": total,
            "absent_days": absent,
        }
