"""AI Auto-Grading Service — Grade assignments with step-by-step feedback."""

import json
from flask import current_app


class AutoGraderService:
    """AI-powered homework/assignment grading with detailed feedback."""

    MODEL = "claude-sonnet-4-20250514"

    @staticmethod
    def _get_client():
        import anthropic
        return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])

    @classmethod
    def grade_submission(
        cls,
        question: str,
        answer: str,
        max_marks: int,
        rubric: str | None = None,
        subject: str = "",
        grade_level: int = 10,
    ) -> dict:
        """Grade a student's answer with detailed feedback."""

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

        client = cls._get_client()
        response = client.messages.create(
            model=cls.MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            text = response.content[0].text
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
