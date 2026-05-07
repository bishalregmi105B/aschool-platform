"""AI Social Media — auto-replies, caption generation, hashtag suggestions."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class SocialAI:
    """AI-powered social media content assistance."""

    @staticmethod
    def generate_reply(comment: str, post_context: str = "", tone: str = "professional",
                       school_id: str = None) -> str:
        prompt = f"""Generate a {tone} reply to this social media comment for a school:
Post context: {post_context}
Comment: "{comment}"
Keep it short (1-2 sentences), professional, and helpful."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="social_reply", max_tokens=100)

    @staticmethod
    def suggest_hashtags(content: str, platform: str = "instagram",
                         school_id: str = None) -> list:
        prompt = f"""Suggest 10 relevant hashtags for this school {platform} post:
"{content}"
Return only hashtags, one per line, including # symbol.
Mix popular and niche education-related hashtags."""

        response = AITokenHub.generate(school_id=school_id, prompt=prompt,
                                       action="social_hashtags", max_tokens=200)
        return [tag.strip() for tag in response.split("\n") if tag.strip().startswith("#")]

    @staticmethod
    def generate_caption(event: str, platform: str = "facebook", language: str = "en",
                         school_id: str = None) -> str:
        prompt = f"""Write a {platform} caption for a school post about: {event}
{"Write in Nepali." if language == "ne" else "Write in English."}
Make it engaging, include emojis, and add a call-to-action."""

        return AITokenHub.generate(school_id=school_id, prompt=prompt,
                                   action="social_caption", max_tokens=300)

    @staticmethod
    def analyze_best_posting_time(school_id: str = None) -> dict:
        """Suggest best times to post based on engagement patterns."""
        return {
            "facebook": {"best_days": ["Tuesday", "Thursday"], "best_time": "10:00 AM"},
            "instagram": {"best_days": ["Wednesday", "Friday"], "best_time": "12:00 PM"},
            "tiktok": {"best_days": ["Monday", "Saturday"], "best_time": "6:00 PM"},
        }
