"""Scheduled social post publishing engine."""
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PostSchedulerService:
    """Manages scheduling and publishing of social media posts."""

    @staticmethod
    def schedule_post(school_id: str, content: str, platforms: list,
                      scheduled_at: datetime, image_url: str = None) -> dict:
        """Create a scheduled post record."""
        from extensions import db
        from app.models.social import SocialPost

        post = SocialPost(
            school_id=school_id,
            content=content,
            platforms=platforms,
            image_url=image_url,
            scheduled_at=scheduled_at,
            status="scheduled",
        )
        db.session.add(post)
        db.session.commit()

        return {"id": str(post.id), "scheduled_at": str(scheduled_at), "status": "scheduled"}

    @staticmethod
    def cancel_scheduled(post_id: str) -> bool:
        """Cancel a scheduled post."""
        from extensions import db
        from app.models.social import SocialPost

        post = SocialPost.query.get(post_id)
        if post and post.status == "scheduled":
            post.status = "cancelled"
            db.session.commit()
            return True
        return False

    @staticmethod
    def get_scheduled(school_id: str) -> list:
        """Get all pending scheduled posts for a school."""
        from app.models.social import SocialPost

        return SocialPost.query.filter_by(
            school_id=school_id,
            status="scheduled",
        ).order_by(SocialPost.scheduled_at).all()
