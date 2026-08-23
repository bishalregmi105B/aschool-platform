"""AI Homework Helper — Socratic tutoring chatbot for students."""

import json
from flask import current_app


class HomeworkHelperService:
    """Student-facing AI tutor that uses Socratic method (guides, doesn't give answers)."""

    MODEL = "claude-haiku-4-5-20241022"

    @staticmethod
    def _get_client():
        import anthropic
        return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])

    @classmethod
    def get_help(
        cls,
        question: str,
        subject: str | None = None,
        grade_level: int | None = None,
        conversation_history: list[dict] | None = None,
        student_attempt: str | None = None,
    ) -> dict:
        """Provide Socratic tutoring help — guide without giving direct answers."""
        subject_label = subject or "their subject"
        grade_label = f"Grade {grade_level}" if grade_level else "school"
        system_prompt = f"""You are a friendly, patient tutor helping a {grade_label} student in Nepal with {subject_label}.

RULES:
1. NEVER give the direct answer. Instead, guide the student step by step.
2. Ask leading questions to help them discover the answer themselves.
3. If they show their work, point out where they went right/wrong.
4. Use simple language appropriate for their grade level.
5. Give hints, not solutions.
6. Use examples relevant to Nepal (local context, currency in NPR, etc.).
7. Be encouraging and positive.
8. If the student is stuck after 3 hints, give a more direct hint but still not the answer.

Respond in JSON:
{{
  "response": "your tutoring response",
  "hint_level": 1-3 (how direct is the hint),
  "concept_involved": "the concept being tested",
  "next_step_suggestion": "what the student should try next"
}}"""

        messages = []
        if conversation_history:
            messages.extend(conversation_history[-10:])  # Keep last 10 messages

        user_msg = question
        if student_attempt:
            user_msg += f"\n\nMy attempt: {student_attempt}"

        messages.append({"role": "user", "content": user_msg})

        client = cls._get_client()
        response = client.messages.create(
            model=cls.MODEL,
            max_tokens=800,
            system=system_prompt,
            messages=messages,
        )

        try:
            text = response.content[0].text
            start = text.index("{")
            end = text.rindex("}") + 1
            result = json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            result = {
                "response": response.content[0].text,
                "hint_level": 1,
                "concept_involved": subject,
                "next_step_suggestion": "Try breaking the problem into smaller parts.",
            }

        return result
