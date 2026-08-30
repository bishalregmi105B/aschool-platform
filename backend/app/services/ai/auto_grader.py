"""AI Auto-Grading Service — Grade assignments with step-by-step feedback.

All LLM calls route through AITokenHub — per-school quota enforcement and
usage logging happen there (E7: no direct Anthropic calls).
"""

import json

from app.services.ai.token_hub import AITokenHub


class AutoGraderService:
    """AI-powered homework/assignment grading with detailed feedback."""

    @classmethod
    def grade_submission(
        cls,
        question: str,
        answer: str,
        max_marks: int,
        rubric: str | None = None,
        subject: str = "",
        grade_level: int = 10,
        school_id=None,
        user_id=None,
    ) -> dict:
        """Grade a student's answer with detailed feedback.

        school_id/user_id are optional — resolved from the request context
        (``g``) when omitted, so existing callers work unchanged.
        """

        rubric_text = f"\nGrading Rubric: {rubric}" if rubric else ""

        prompt = f"""You are a teacher at a school in Nepal grading a student's work.

Subject: {subject}
Grade Level: {grade_level}
Maximum Marks: {max_marks}
{rubric_text}

Question: {question}

Student's Answer: {answer}

Grade this answer and return JSON:
{{
  "marks_awarded": <number between 0 and {max_marks}>,
  "percentage": <number>,
  "grade_letter": "A+/A/B+/B/C+/C/D/E",
  "feedback": {{
    "strengths": ["what the student did well"],
    "improvements": ["specific areas to improve"],
    "corrections": ["factual or conceptual errors if any"],
    "step_by_step": "detailed marking breakdown"
  }},
  "model_answer": "the ideal answer for this question",
  "encouragement": "brief motivational note"
}}

Be fair, constructive, and specific. Consider Nepal curriculum standards."""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="auto-grader:grade",
            messages=[{"role": "user", "content": prompt}],
            model="smart",  # quality tier (sonnet-class model via hub routing)
            max_tokens=1500,
            temperature=1.0,  # matches the previous direct Anthropic default
            metadata={"subject": subject, "grade_level": grade_level},
        )["text"]

        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"error": "Grading failed. Please try again."}

    @classmethod
    def batch_grade(cls, submissions: list[dict], question: str, max_marks: int, subject: str = "") -> list[dict]:
        """Grade multiple submissions for the same question."""
        results = []
        for sub in submissions:
            result = cls.grade_submission(
                question=question,
                answer=sub.get("answer", ""),
                max_marks=max_marks,
                subject=subject,
            )
            result["student_id"] = sub.get("student_id")
            results.append(result)
        return results
