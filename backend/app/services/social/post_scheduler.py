"""Scheduled social post publishing engine."""
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PostSchedulerService:
    """Manages scheduling and publishing of social media posts.

    E199: this service referenced columns that do not exist on SocialPost
    (`content`, `image_url`) — any call raised TypeError — and wrote a
    `cancelled` status that is not in the post_status enum (DataError). It
    now uses the real columns (content_en, media_urls) and cancels by
    returning a scheduled post to `draft`.
    """

    @staticmethod
    def schedule_post(school_id: str, content: str, platforms: list,
                      scheduled_at: datetime, image_url: str = None) -> dict:
        """Create a scheduled post record."""
        from extensions import db
        from app.models.social import SocialPost

        media_urls = [image_url] if image_url else []
        post = SocialPost(
            school_id=school_id,
            content_en=content,
            platforms=platforms,
            media_urls=media_urls,
            scheduled_at=scheduled_at,
            status="scheduled",
        )
        db.session.add(post)
        db.session.commit()

        return {"id": str(post.id), "scheduled_at": str(scheduled_at), "status": "scheduled"}

    @staticmethod
    def cancel_scheduled(post_id: str) -> bool:
        """Cancel a scheduled post (back to draft — the only reversible
        state in the post_status enum)."""
        from extensions import db
        from app.models.social import SocialPost

        post = SocialPost.query.filter_by(id=post_id, is_deleted=False).first()
        if post and post.status == "scheduled":
            post.status = "draft"
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
