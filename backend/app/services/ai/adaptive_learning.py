"""AI Adaptive Learning — personalized learning path recommendations."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


def _match_subject_ids(school_id, subject):
    """Resolve a subject name to Subject ids (school-scoped when possible).

    Returns a set of ids, or None if the lookup fails for any reason — the
    caller then keeps the legacy all-subject behavior. An empty set means the
    subject genuinely has no rows in this school, so mastery is honestly
    assessed as 0.0/beginner rather than faked from other subjects.
    """
    try:
        from app.models.academic import Subject

        query = Subject.query.filter(Subject.name.ilike(str(subject).strip()))
        if school_id:
            query = query.filter(Subject.school_id == school_id)
        return {s.id for s in query.all()}
    except Exception:
        logger.debug("Subject lookup failed for %r; assessing all subjects", subject)
        return None


class AdaptiveLearningAI:
    """AI-powered personalized learning path recommendations."""

    @staticmethod
    def recommend_path(student_data: dict, school_id: str = None) -> dict:
        prompt = f"""Based on this student's performance data, recommend a personalized learning path:
Name: {student_data.get('name', 'Student')}
Strengths: {student_data.get('strengths', 'Not assessed')}
Weaknesses: {student_data.get('weaknesses', 'Not assessed')}
Recent Scores: {student_data.get('scores', {})}
Learning Style: {student_data.get('learning_style', 'visual')}

Respond in JSON:
{{"recommended_topics": ["topic1", "topic2"], "difficulty_level": "beginner|intermediate|advanced", "focus_areas": ["area1"], "resources": ["resource1"], "estimated_hours": 10}}"""

        response = AITokenHub.generate(school_id=school_id, prompt=prompt,
                                       action="adaptive_learning", max_tokens=300)
        try:
            import json
            return json.loads(response)
        except Exception:
            return {"recommended_topics": [], "raw": response}

    @staticmethod
    def assess_mastery(student_id: str, subject: str, school_id: str = None) -> dict:
        """Assess student mastery level in a subject based on performance history."""
        from app.models.exam import Marks
        from app.models.assignment import AssignmentSubmission

        results = Marks.query.filter_by(student_id=student_id).all()
        # The subject parameter used to be ignored (all subjects averaged
        # together). Filter to the requested subject's marks when it resolves;
        # an unknown/failed lookup falls back to the legacy all-subject mode.
        if subject:
            subject_ids = _match_subject_ids(school_id, subject)
            if subject_ids is not None:
                results = [r for r in results if r.subject_id in subject_ids]
        # obtained_marks is Numeric → Decimal arithmetic; cast so callers can
        # jsonify the result (Flask's default JSON provider rejects Decimal).
        avg_score = float(sum((r.obtained_marks or 0) for r in results) / max(len(results), 1))

        mastery = "advanced" if avg_score >= 80 else "intermediate" if avg_score >= 60 else "beginner"

        return {
            "student_id": student_id,
            "subject": subject,
            "mastery_level": mastery,
            "avg_score": round(avg_score, 1),
            "total_assessments": len(results),
        }

    @staticmethod
    def generate_practice_questions(topic: str, difficulty: str = "medium",
                                     count: int = 5, school_id: str = None) -> str:
        prompt = f"""Generate {count} practice questions on "{topic}" at {difficulty} difficulty level.
Include a mix of MCQs, short answer, and one application-based question.
Format each question with its answer."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="practice_questions", max_tokens=600)
