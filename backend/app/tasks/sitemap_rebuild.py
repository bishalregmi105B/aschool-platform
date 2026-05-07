"""Sitemap rebuilder — regenerates school website sitemaps nightly."""
from extensions import celery
import logging

logger = logging.getLogger(__name__)


@celery.task(name="sitemap_rebuild")
def rebuild_all_sitemaps():
    """Run nightly: regenerate sitemap.xml for all published school websites.

    Only processes schools with 'basic_website' or 'website_builder' plugin.
    """
    from extensions import db
    from app.models.plugin import SchoolPlugin
    from app.models.school import School
    from app.models.website import SchoolWebsite

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter(
            SchoolPlugin.plugin_slug.in_(["basic_website", "website_builder"]),
            SchoolPlugin.active.is_(True),
        )
        .distinct()
        .all()
    )

    for (school_id,) in active_schools:
        try:
            school = School.query.get(school_id)
            if not school or not school.slug:
                continue

            website = SchoolWebsite.query.filter_by(
                school_id=school_id,
                is_published=True,
            ).first()

            if not website:
                continue

            # Build sitemap entries
            base_url = f"https://{school.slug}.aschool.com.np"
            pages = [
                {"url": base_url, "priority": "1.0"},
                {"url": f"{base_url}/about", "priority": "0.8"},
                {"url": f"{base_url}/academics", "priority": "0.7"},
                {"url": f"{base_url}/teachers", "priority": "0.7"},
                {"url": f"{base_url}/events", "priority": "0.6"},
                {"url": f"{base_url}/gallery", "priority": "0.6"},
                {"url": f"{base_url}/results", "priority": "0.7"},
                {"url": f"{base_url}/admission", "priority": "0.8"},
                {"url": f"{base_url}/contact", "priority": "0.5"},
                {"url": f"{base_url}/notices", "priority": "0.6"},
                {"url": f"{base_url}/news", "priority": "0.6"},
                {"url": f"{base_url}/alumni", "priority": "0.4"},
            ]

            # Store as JSONB on website record for SSR serving
            website.sitemap_data = pages
            db.session.commit()

            logger.info("Rebuilt sitemap for %s (%d pages)", school.slug, len(pages))
        except Exception:
            db.session.rollback()
            logger.exception("Sitemap rebuild failed for school %s", school_id)
