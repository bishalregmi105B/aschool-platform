"""AI Report Card Remarks Generator — auto-generates personalized teacher remarks."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class ReportRemarksAI:
    """Generate personalized report card remarks using AI."""

    @staticmethod
    def generate_remark(student_name: str, marks: dict, attendance_pct: float,
                        behavior: str = "good", language: str = "en",
                        school_id: str = None) -> str:
        prompt = f"""Generate a personalized report card remark for:
Student: {student_name}
Marks: {marks}
Attendance: {attendance_pct}%
Behavior: {behavior}

Write a 2-3 sentence constructive, encouraging remark.
{"Write in Nepali (Devanagari script)." if language == "ne" else "Write in English."}
Do NOT use generic phrases. Be specific about strengths and areas for improvement."""

        return AITokenHub.generate(
            school_id=school_id,
            prompt=prompt,
            action="report_remarks",
            max_tokens=200,
        )

    @staticmethod
    def bulk_generate(students_data: list, school_id: str = None, language: str = "en") -> list:
        """Generate remarks for multiple students."""
        results = []
        for student in students_data:
            remark = ReportRemarksAI.generate_remark(
                student_name=student["name"],
                marks=student.get("marks", {}),
                attendance_pct=student.get("attendance", 0),
                behavior=student.get("behavior", "good"),
                language=language,
                school_id=school_id,
            )
            results.append({"student_id": student.get("id"), "remark": remark})
        return results
