"""AI Content Generator — school notices, letters, social posts."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class ContentGeneratorAI:
    """AI-powered content generation for school communications."""

    @staticmethod
    def generate_notice(school_name: str, subject: str, details: str,
                        language: str = "en", school_id: str = None) -> str:
        prompt = f"""Write a formal school notice for {school_name}:
Subject: {subject}
Details: {details}
{"Write in Nepali (Devanagari script)." if language == "ne" else "Write in English."}
Format: Include reference number placeholder, date, subject line, body, and principal signature line."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="content_gen", max_tokens=500)

    @staticmethod
    def generate_social_post(school_name: str, event: str, tone: str = "professional",
                             platform: str = "facebook", school_id: str = None) -> str:
        prompt = f"""Write a {platform} post for {school_name} about: {event}
Tone: {tone}
Include relevant hashtags. Keep it engaging and shareable.
Max 280 characters for Twitter, otherwise 2-3 paragraphs."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="content_gen", max_tokens=300)

    @staticmethod
    def generate_letter(school_name: str, recipient: str, subject: str,
                        body_context: str, language: str = "en",
                        school_id: str = None) -> str:
        prompt = f"""Write a formal school letter:
From: {school_name}
To: {recipient}
Subject: {subject}
Context: {body_context}
{"Write in Nepali." if language == "ne" else "Write in English."}
Include proper salutation, body, and closing."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="content_gen", max_tokens=600)

    @staticmethod
    def translate(text: str, from_lang: str = "en", to_lang: str = "ne",
                  school_id: str = None) -> str:
        """Translate text between English and Nepali."""
        lang_names = {"en": "English", "ne": "Nepali"}
        prompt = f"Translate the following from {lang_names.get(from_lang, from_lang)} to {lang_names.get(to_lang, to_lang)}. Return only the translation:\n\n{text}"

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="translation", max_tokens=len(text) * 2)

    @staticmethod
    def analyze_sentiment(text: str, school_id: str = None) -> dict:
        """Analyze sentiment of social media comments."""
        prompt = f"""Analyze the sentiment of this comment and respond in JSON:
"{text}"
Format: {{"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0, "topics": ["topic1"]}}"""

        response = AITokenHub.generate(school_id=school_id, prompt=prompt,
                                       action="sentiment", max_tokens=150)
        try:
            import json
            return json.loads(response)
        except Exception:
            return {"sentiment": "neutral", "confidence": 0.5, "raw": response}
