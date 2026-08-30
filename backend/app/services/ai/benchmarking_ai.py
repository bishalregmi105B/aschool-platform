"""AI Benchmarking — compare school performance against district/national averages."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class BenchmarkingAI:
    """School performance benchmarking and comparative analytics."""

    @staticmethod
    def compare_with_averages(school_data: dict, district_avg: dict = None,
                               national_avg: dict = None) -> dict:
        """Compare school metrics against district and national averages."""
        metrics = {}
        for key in ["pass_rate", "avg_score", "attendance_rate", "student_teacher_ratio"]:
            school_val = school_data.get(key, 0)
            district_val = district_avg.get(key, 0) if district_avg else 0
            national_val = national_avg.get(key, 0) if national_avg else 0

            metrics[key] = {
                "school": school_val,
                "district_avg": district_val,
                "national_avg": national_val,
                "vs_district": round(school_val - district_val, 1) if district_val else None,
                "vs_national": round(school_val - national_val, 1) if national_val else None,
                "rank": "above" if school_val > district_val else "below" if school_val < district_val else "average",
            }

        return {"metrics": metrics, "overall_rank": "above_average"}

    @staticmethod
    def generate_insights(school_data: dict, school_id: str = None) -> str:
        prompt = f"""Analyze this school's performance data and provide benchmarking insights:
Pass Rate: {school_data.get('pass_rate', 'N/A')}%
Average Score: {school_data.get('avg_score', 'N/A')}
Attendance Rate: {school_data.get('attendance_rate', 'N/A')}%
Student-Teacher Ratio: {school_data.get('student_teacher_ratio', 'N/A')}
Total Students: {school_data.get('total_students', 'N/A')}

Provide 3-4 bullet point insights with specific recommendations for improvement.
Compare against typical Nepal school benchmarks."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="benchmarking", max_tokens=400)

    @staticmethod
    def rank_departments(school_id: str) -> list:
        """Rank academic departments by performance."""
        from app.models.exam import Marks
        from sqlalchemy import func
        from extensions import db

        dept_stats = (
            db.session.query(
                Marks.subject_id,
                func.avg(Marks.obtained_marks).label("avg_marks"),
                func.count(Marks.id).label("total"),
            )
            .filter_by(school_id=school_id)
            .group_by(Marks.subject_id)
            .order_by(func.avg(Marks.obtained_marks).desc())
            .all()
        )

        return [
            {"subject": s, "avg_marks": round(float(avg), 1), "total_students": t, "rank": i + 1}
            for i, (s, avg, t) in enumerate(dept_stats)
        ]
