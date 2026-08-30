"""AI Lesson Plan Generator.

All LLM calls route through AITokenHub — per-school quota enforcement and
usage logging happen there (E7: no direct Anthropic calls).
"""

import json

from app.services.ai.token_hub import AITokenHub


class LessonPlanService:
    """Generate lesson plans aligned with Nepal's CDC curriculum."""

    @classmethod
    def generate_lesson_plan(
        cls,
        subject: str,
        grade: int,
        topic: str,
        duration_minutes: int = 45,
        learning_objectives: list[str] | None = None,
        teaching_method: str = "interactive",
        language: str = "english",
        school_id=None,
        user_id=None,
    ) -> dict:
        """Generate a structured lesson plan.

        school_id/user_id are optional — resolved from the request context
        (``g``) when omitted, so existing callers work unchanged.
        """

        prompt = f"""Create a detailed lesson plan for a school in Nepal:

Subject: {subject}
Grade: {grade}
Topic: {topic}
Duration: {duration_minutes} minutes
Teaching Method: {teaching_method}
Language: {language}
Learning Objectives: {json.dumps(learning_objectives) if learning_objectives else "Auto-generate based on topic"}

Return JSON:
{{
  "subject": "{subject}",
  "grade": {grade},
  "topic": "{topic}",
  "duration": "{duration_minutes} minutes",
  "learning_objectives": ["..."],
  "materials_needed": ["..."],
  "lesson_structure": [
    {{
      "phase": "Introduction",
      "duration": "5 minutes",
      "activities": ["..."],
      "teacher_instructions": "...",
      "student_activities": "..."
    }}
  ],
  "assessment": {{
    "formative": ["in-class checks"],
    "summative": "end-of-lesson task"
  }},
  "differentiation": {{
    "advanced": "extension activity",
    "struggling": "support strategy"
  }},
  "homework": "optional homework assignment",
  "reflection_questions": ["teacher self-reflection prompts"]
}}

Align with Nepal's CDC curriculum framework. Include practical, locally relevant examples."""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="lesson-plan:generate",
            messages=[{"role": "user", "content": prompt}],
            model="smart",  # quality tier (sonnet-class model via hub routing)
            max_tokens=2048,
            temperature=1.0,  # matches the previous direct Anthropic default
            metadata={"subject": subject, "grade": grade, "language": language},
        )["text"]

        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"error": "Failed to generate lesson plan. Please try again."}
