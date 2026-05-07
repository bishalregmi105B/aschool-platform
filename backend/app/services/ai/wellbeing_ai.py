"""AI Wellbeing Analytics — student mental health pattern detection."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class WellbeingAI:
    """AI-powered student wellbeing analytics."""

    @staticmethod
    def analyze_mood_trends(mood_data: list, school_id: str = None) -> dict:
        """Analyze student mood check-in trends."""
        if not mood_data:
            return {"trend": "insufficient_data", "alerts": []}

        moods = [d.get("mood", "neutral") for d in mood_data]
        negative_count = sum(1 for m in moods if m in ["sad", "anxious", "angry", "stressed"])
        total = len(moods)
        negative_pct = (negative_count / total * 100) if total > 0 else 0

        alerts = []
        if negative_pct > 50:
            alerts.append({"level": "high", "message": "Student showing persistent negative mood patterns"})
        elif negative_pct > 30:
            alerts.append({"level": "medium", "message": "Student showing elevated negative moods"})

        # Consecutive negative days
        consecutive = 0
        max_consecutive = 0
        for m in moods:
            if m in ["sad", "anxious", "angry", "stressed"]:
                consecutive += 1
                max_consecutive = max(max_consecutive, consecutive)
            else:
                consecutive = 0

        if max_consecutive >= 5:
            alerts.append({"level": "critical", "message": f"{max_consecutive} consecutive days of negative mood — counselor referral recommended"})

        return {
            "trend": "concerning" if negative_pct > 40 else "stable" if negative_pct < 20 else "moderate",
            "negative_percentage": round(negative_pct, 1),
            "consecutive_negative_days": max_consecutive,
            "alerts": alerts,
            "total_checkins": total,
        }

    @staticmethod
    def generate_counselor_brief(student_data: dict, school_id: str = None) -> str:
        prompt = f"""Generate a brief counselor summary for a student:
Name: {student_data.get('name', 'Student')}
Mood Trend: {student_data.get('mood_trend', 'unknown')}
Attendance Rate: {student_data.get('attendance', 'N/A')}%
Academic Performance: {student_data.get('academic', 'N/A')}
Recent Incidents: {student_data.get('incidents', 'None')}
Parent Notes: {student_data.get('parent_notes', 'None')}

Write a 3-4 sentence professional counselor brief with recommendations."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="wellbeing_brief", max_tokens=250)

    @staticmethod
    def suggest_interventions(risk_level: str, factors: list) -> list:
        """Suggest interventions based on risk level."""
        interventions = {
            "low": ["Continue regular check-ins", "Encourage peer activities"],
            "medium": [
                "Schedule counselor meeting",
                "Increase check-in frequency",
                "Notify class teacher",
                "Consider peer mentoring",
            ],
            "high": [
                "Immediate counselor referral",
                "Contact parents/guardians",
                "Daily mood monitoring",
                "Create support plan",
                "Consider external referral",
            ],
            "critical": [
                "URGENT: Contact parents immediately",
                "Schedule crisis counselor session",
                "Inform school administration",
                "Implement safety plan",
                "Coordinate with external mental health services",
            ],
        }
        return interventions.get(risk_level, interventions["low"])
