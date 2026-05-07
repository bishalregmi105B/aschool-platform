"""AI Sentiment Analysis — analyze feedback and social comments."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class SentimentAI:
    """Sentiment analysis for parent feedback, social comments, etc."""

    @staticmethod
    def analyze(text: str, school_id: str = None) -> dict:
        prompt = f"""Analyze the sentiment of this text and respond in JSON:
"{text}"
Format: {{"sentiment": "positive|negative|neutral|mixed", "confidence": 0.0-1.0, "emotion": "happy|angry|sad|worried|neutral", "topics": ["topic1"], "summary": "one line summary"}}"""

        response = AITokenHub.generate(school_id=school_id, prompt=prompt,
                                       action="sentiment", max_tokens=200)
        try:
            import json
            return json.loads(response)
        except Exception:
            return {"sentiment": "neutral", "confidence": 0.5, "raw": response}

    @staticmethod
    def bulk_analyze(texts: list, school_id: str = None) -> list:
        """Analyze sentiment for multiple texts."""
        return [SentimentAI.analyze(t, school_id) for t in texts]

    @staticmethod
    def aggregate_sentiment(results: list) -> dict:
        """Aggregate multiple sentiment results into a summary."""
        if not results:
            return {"overall": "neutral", "distribution": {}}
        sentiments = [r.get("sentiment", "neutral") for r in results]
        dist = {}
        for s in sentiments:
            dist[s] = dist.get(s, 0) + 1
        overall = max(dist, key=dist.get) if dist else "neutral"
        return {"overall": overall, "distribution": dist, "total": len(results)}
