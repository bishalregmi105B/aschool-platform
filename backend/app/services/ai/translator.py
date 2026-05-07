"""AI Translator — English ↔ Nepali translation service."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class TranslatorAI:
    """English ↔ Nepali translation powered by AI."""

    @staticmethod
    def translate(text: str, from_lang: str = "en", to_lang: str = "ne",
                  school_id: str = None) -> str:
        lang_map = {"en": "English", "ne": "Nepali (Devanagari script)"}
        prompt = f"""Translate from {lang_map.get(from_lang, from_lang)} to {lang_map.get(to_lang, to_lang)}.
Return ONLY the translation, nothing else.

Text: {text}"""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="translation", max_tokens=len(text) * 3)

    @staticmethod
    def translate_document(fields: dict, from_lang: str = "en", to_lang: str = "ne",
                           school_id: str = None) -> dict:
        """Translate multiple fields at once."""
        results = {}
        for key, value in fields.items():
            if isinstance(value, str) and value.strip():
                results[key] = TranslatorAI.translate(value, from_lang, to_lang, school_id)
            else:
                results[key] = value
        return results

    @staticmethod
    def detect_language(text: str) -> str:
        """Simple language detection for Nepali vs English."""
        nepali_chars = sum(1 for c in text if '\u0900' <= c <= '\u097F')
        return "ne" if nepali_chars > len(text) * 0.3 else "en"
