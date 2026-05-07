"""AI Risk Detector — identifies at-risk students using behavioral patterns."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class RiskDetectorAI:
    """Detect at-risk students based on attendance, grades, and behavior patterns."""

    @staticmethod
    def analyze_student(student_data: dict, school_id: str = None) -> dict:
        prompt = f"""Analyze this student's data and determine risk level:
Name: {student_data.get('name', 'Unknown')}
Attendance Rate: {student_data.get('attendance_pct', 0)}%
Recent Grade Trend: {student_data.get('grade_trend', 'stable')}
Assignment Completion: {student_data.get('assignment_completion', 0)}%
Behavior Notes: {student_data.get('behavior_notes', 'None')}
Late Arrivals (this month): {student_data.get('late_count', 0)}

Respond in JSON format:
{{"risk_level": "low|medium|high|critical", "factors": ["factor1", "factor2"], "recommendations": ["rec1", "rec2"], "summary": "brief summary"}}"""

        response = AITokenHub.generate(
            school_id=school_id,
            prompt=prompt,
            action="risk_detection",
            max_tokens=300,
        )

        try:
            import json
            return json.loads(response)
        except Exception:
            return {"risk_level": "unknown", "summary": response, "factors": [], "recommendations": []}

    @staticmethod
    def bulk_scan(school_id: str) -> list:
        """Scan all students in a school for risk indicators."""
        from app.models.student import Student
        from app.models.attendance import AttendanceRecord
        from sqlalchemy import func

        students = Student.query.filter_by(school_id=school_id, is_deleted=False).all()
        at_risk = []

        for student in students:
            total = AttendanceRecord.query.filter_by(
                school_id=school_id, student_id=student.id
            ).count()
            present = AttendanceRecord.query.filter_by(
                school_id=school_id, student_id=student.id, status="present"
            ).count()

            attendance_pct = (present / total * 100) if total > 0 else 100

            if attendance_pct < 75:
                at_risk.append({
                    "student_id": str(student.id),
                    "name": f"{student.first_name} {student.last_name}",
                    "attendance_pct": round(attendance_pct, 1),
                    "risk_level": "high" if attendance_pct < 60 else "medium",
                })

        return at_risk
