"""Social Hub sync tasks — content moderation, activity digests."""

from extensions import celery


@celery.task(name="social_activity_digest")
def send_activity_digest(school_id: str):
    """Send daily activity digest for Social Hub."""
    from flask import current_app
    from app.models.social import Post
    from extensions import db
    from datetime import datetime, timedelta

    yesterday = datetime.utcnow() - timedelta(days=1)

    post_count = Post.query.filter(
        Post.school_id == school_id,
        Post.created_at >= yesterday,
        Post.is_deleted == False,
    ).count()

    current_app.logger.info(f"Social digest for {school_id}: {post_count} posts in last 24h")
    return {"school_id": school_id, "posts_24h": post_count}


@celery.task(name="moderate_social_content")
def moderate_social_content(post_id: str):
    """Basic content moderation for social posts."""
    from flask import current_app
    from app.models.social import Post
    from extensions import db

    post = Post.query.get(post_id)
    if not post:
        return {"moderated": False, "reason": "Post not found"}

    # Basic keyword filter (expandable)
    flagged_words = ["spam", "scam", "abuse"]
    content_lower = (post.content or "").lower()

    is_flagged = any(word in content_lower for word in flagged_words)
    if is_flagged:
        post.is_flagged = True
        db.session.commit()
        current_app.logger.warning(f"Post {post_id} flagged for moderation")

    return {"moderated": True, "flagged": is_flagged}
