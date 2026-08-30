"""AI Homework Helper — Socratic tutoring chatbot for students.

All LLM calls route through AITokenHub — per-school quota enforcement and
usage logging happen there (E7: no direct Anthropic calls).
"""

import json

from app.services.ai.token_hub import AITokenHub


class HomeworkHelperService:
    """Student-facing AI tutor that uses Socratic method (guides, doesn't give answers)."""

    @classmethod
    def get_help(
        cls,
        question: str,
        subject: str | None = None,
        grade_level: int | None = None,
        conversation_history: list[dict] | None = None,
        student_attempt: str | None = None,
        school_id=None,
        user_id=None,
    ) -> dict:
        """Provide Socratic tutoring help — guide without giving direct answers.

        school_id/user_id are optional — resolved from the request context
        (``g``) when omitted, so existing callers work unchanged.
        """
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

        messages = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            messages.extend(conversation_history[-10:])  # Keep last 10 messages

        user_msg = question
        if student_attempt:
            user_msg += f"\n\nMy attempt: {student_attempt}"

        messages.append({"role": "user", "content": user_msg})

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="homework-helper:tutor",
            messages=messages,
            model="fast",  # haiku-class model via hub routing
            max_tokens=800,
            temperature=1.0,  # matches the previous direct Anthropic default
            metadata={"subject": subject, "grade_level": grade_level},
        )["text"]

        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            result = json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            result = {
                "response": text,
                "hint_level": 1,
                "concept_involved": subject,
                "next_step_suggestion": "Try breaking the problem into smaller parts.",
            }

        return result
