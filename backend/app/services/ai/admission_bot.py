"""AI Admission Bot — handles admission inquiries via WhatsApp/chat."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class AdmissionBotAI:
    """AI-powered admission inquiry handler."""

    @staticmethod
    def handle_inquiry(school_id: str, question: str, school_info: dict = None) -> str:
        """Handle an admission inquiry using AI with school context."""
        context = ""
        if school_info:
            context = f"""School: {school_info.get('name', 'Unknown')}
Type: {school_info.get('type', 'private')}
Level: {school_info.get('level', 'secondary')}
Location: {school_info.get('district', '')}, {school_info.get('municipality', '')}
Affiliated to: {school_info.get('affiliated_to', 'NEB')}
"""

        prompt = f"""You are an admission assistant for a school in Nepal.
{context}
Answer the following admission inquiry helpfully and accurately.
If you don't know specific details (fees, dates), say they should contact the school office.
Keep response concise (2-4 sentences).

Inquiry: {question}"""

        return AITokenHub.generate(
            school_id=school_id,
            prompt=prompt,
            action="admission_bot",
            max_tokens=200,
        )

    @staticmethod
    def classify_lead(message: str, school_id: str = None) -> dict:
        """Classify an admission lead's intent and urgency."""
        prompt = f"""Classify this admission inquiry:
"{message}"

Respond in JSON:
{{"intent": "general_info|fee_inquiry|admission_process|visit_request|enrollment",
  "urgency": "low|medium|high",
  "grade_interested": "unknown or specific grade",
  "suggested_action": "brief action"}}"""

        response = AITokenHub.generate(
            school_id=school_id,
            prompt=prompt,
            action="admission_bot",
            max_tokens=150,
        )

        try:
            import json
            return json.loads(response)
        except Exception:
            return {"intent": "general_info", "urgency": "medium", "raw": response}
