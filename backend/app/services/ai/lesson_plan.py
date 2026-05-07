"""AI Lesson Plan Generator."""

import json
from flask import current_app


class LessonPlanService:
    """Generate lesson plans aligned with Nepal's CDC curriculum."""

    MODEL = "claude-sonnet-4-20250514"

    @staticmethod
    def _get_client():
        import anthropic
        return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])

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
    ) -> dict:
        """Generate a structured lesson plan."""

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

        client = cls._get_client()
        response = client.messages.create(
            model=cls.MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            text = response.content[0].text
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"error": "Failed to generate lesson plan. Please try again."}
