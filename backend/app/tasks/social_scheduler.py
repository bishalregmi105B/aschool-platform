"""Social media post scheduler — publishes scheduled posts at their scheduled time."""
from extensions import celery
import logging

logger = logging.getLogger(__name__)


@celery.task(name="social_publish_scheduled")
def publish_scheduled_posts():
    """Run every 5 minutes: publish social media posts scheduled for now.

    Only processes schools with the 'social_hub' plugin active.
    """
    from extensions import db
    from app.models.plugin import SchoolPlugin
    from app.models.school import School
    from app.models.social import SocialPost
    from app.services.social.social_hub import SocialHubService
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="social_hub", active=True)
        .all()
    )

    for (school_id,) in active_schools:
        try:
            scheduled_posts = SocialPost.query.filter(
                SocialPost.school_id == school_id,
                SocialPost.status == "scheduled",
                SocialPost.scheduled_at <= now,
            ).all()

            for post in scheduled_posts:
                try:
                    school = School.query.get(school_id)
                    if not school:
                        post.status = "failed"
                        post.platform_post_ids = {"error": "School not found"}
                        continue

                    message = post.content_en or post.content_ne or ""
                    image_url = (post.media_urls or [None])[0]
                    results = SocialHubService(school).publish_to_all(
                        message=message,
                        image_url=image_url,
                        platforms=post.platforms or None,
                    )
                    if not results or all(result.get("error") for result in results.values()):
                        post.status = "failed"
                        post.platform_post_ids = results or {
                            "error": "No connected social publishing account"
                        }
                        logger.warning("Scheduled post %s was not published", post.id)
                    else:
                        post.status = "published"
                        post.published_at = now
                        post.platform_post_ids = results
                        logger.info("Published scheduled post %s for school %s", post.id, school_id)
                except Exception:
                    post.status = "failed"
                    logger.exception("Failed to publish post %s", post.id)

            db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception("Social scheduler failed for school %s", school_id)
