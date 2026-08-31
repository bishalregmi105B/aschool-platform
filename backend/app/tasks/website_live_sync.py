"""
Celery task: Website Live Data Sync
Triggered when notices, events, results, staff, or admission data changes.
Rebuilds static JSON cache, triggers ISR revalidation, and updates sitemap.
"""
import json
import logging
from datetime import datetime, timezone

import requests
from celery import shared_task

from app.extensions import db, redis_client
from app.models import Notice, School, SchoolWebsite, WebsitePage
from app.utils.tenant_url import school_site_url

logger = logging.getLogger(__name__)

FRONTEND_URL = "http://frontend:3000"  # internal docker network
REVALIDATE_SECRET = None  # set from config at runtime


def _get_revalidate_secret():
    from flask import current_app
    return current_app.config.get("ISR_REVALIDATE_SECRET", "")


@shared_task(name="website.sync_school_data", bind=True, max_retries=3)
def sync_school_data(self, school_id: int, trigger: str = "manual"):
    """
    Rebuild cached public data for a school website.
    Called after notice/event/staff/result/admission changes.
    
    Args:
        school_id: The school to sync
        trigger: What caused the sync (notice_created, staff_updated, etc.)
    """
    from app import create_app
    app = create_app()

    with app.app_context():
        try:
            school = db.session.get(School, school_id)
            if not school:
                logger.warning(f"School {school_id} not found for website sync")
                return

            slug = school.slug
            logger.info(f"Website sync started for {slug} (trigger: {trigger})")

            # 1. Rebuild public data cache in Redis
            _rebuild_public_cache(school)

            # 2. Trigger ISR revalidation for affected pages
            _trigger_revalidation(slug, trigger)

            # 3. Rebuild sitemap data
            _rebuild_sitemap(school)

            # 4. Update last_synced timestamp
            redis_client.set(f"website:last_sync:{school_id}", datetime.now(timezone.utc).isoformat())

            logger.info(f"Website sync completed for {slug}")

        except Exception as exc:
            logger.error(f"Website sync failed for school {school_id}: {exc}")
            raise self.retry(exc=exc, countdown=30)


def _rebuild_public_cache(school):
    """Rebuild Redis cache with latest public data."""
    school_id = school.id
    slug = school.slug

    # Cache school info
    school_data = {
        "id": school.id,
        "name": school.name,
        "name_nepali": school.name_nepali,
        "slug": slug,
        "type": school.type,
        "level": school.level,
        "logo_url": school.logo_url,
        "banner_url": school.banner_url,
        "phone": school.phone,
        "email": school.email,
        "district": school.district,
        "municipality": school.municipality,
        "established_year_bs": school.established_year_bs,
    }
    redis_client.setex(
        f"website:public:{slug}:school",
        600,  # 10 min cache
        json.dumps(school_data),
    )

    # Cache latest notices (published, last 20)
    notices = (
        db.session.query(Notice)
        .filter_by(school_id=school_id)
        .filter(Notice.is_published == True)
        .order_by(Notice.created_at.desc())
        .limit(20)
        .all()
    )
    notices_data = [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "category": n.category,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notices
    ]
    redis_client.setex(
        f"website:public:{slug}:notices",
        600,
        json.dumps(notices_data),
    )

    # Cache website settings/theme
    settings = (
        db.session.query(SchoolWebsite)
        .filter_by(school_id=school_id)
        .first()
    )
    if settings:
        settings_data = {
            "theme_slug": settings.theme_slug,
            "is_published": settings.is_published,
            "meta_title": settings.meta_title,
            "meta_description": settings.meta_description,
            "customizations": settings.customizations,
        }
        redis_client.setex(
            f"website:public:{slug}:settings",
            600,
            json.dumps(settings_data),
        )

    # Cache pages list
    pages = (
        db.session.query(WebsitePage)
        .filter_by(school_id=school_id, is_published=True)
        .filter(WebsitePage.is_deleted == False)
        .order_by(WebsitePage.sort_order)
        .all()
    )
    pages_data = [
        {
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "sections": p.sections,
        }
        for p in pages
    ]
    redis_client.setex(
        f"website:public:{slug}:pages",
        600,
        json.dumps(pages_data),
    )

    logger.info(f"Rebuilt public cache for {slug}: {len(notices_data)} notices, {len(pages_data)} pages")


# Map triggers to the pages that need revalidation
TRIGGER_PAGE_MAP = {
    "notice_created": ["/", "/notices"],
    "notice_updated": ["/", "/notices"],
    "notice_deleted": ["/notices"],
    "staff_updated": ["/teachers"],
    "staff_created": ["/teachers"],
    "result_published": ["/results"],
    "admission_updated": ["/admission"],
    "page_updated": None,  # revalidate all
    "theme_changed": None,  # revalidate all
    "settings_updated": None,
    "manual": None,
}

ALL_PUBLIC_PAGES = ["/", "/about", "/academics", "/teachers", "/notices", "/gallery", "/contact", "/admission", "/results"]


def _trigger_revalidation(slug: str, trigger: str):
    """Call Next.js ISR revalidation API for affected pages."""
    pages_to_revalidate = TRIGGER_PAGE_MAP.get(trigger, None)
    if pages_to_revalidate is None:
        pages_to_revalidate = ALL_PUBLIC_PAGES

    for page_path in pages_to_revalidate:
        full_path = f"/school/{slug}{page_path}"
        try:
            resp = requests.post(
                f"{FRONTEND_URL}/api/revalidate",
                json={"path": full_path, "secret": _get_revalidate_secret()},
                timeout=5,
            )
            if resp.status_code == 200:
                logger.debug(f"Revalidated {full_path}")
            else:
                logger.warning(f"Revalidation failed for {full_path}: {resp.status_code}")
        except requests.RequestException as e:
            logger.warning(f"Revalidation request failed for {full_path}: {e}")


def _rebuild_sitemap(school):
    """Rebuild sitemap data in Redis for the school."""
    slug = school.slug
    base_url = school_site_url(slug)

    urls = []
    for page_path in ALL_PUBLIC_PAGES:
        priority = "1.0" if page_path == "/" else "0.8"
        urls.append({
            "loc": f"{base_url}{page_path}",
            "lastmod": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "changefreq": "daily" if page_path in ["/", "/notices"] else "weekly",
            "priority": priority,
        })

    # Add custom pages
    pages = (
        db.session.query(WebsitePage)
        .filter_by(school_id=school.id, is_published=True)
        .filter(WebsitePage.is_deleted == False)
        .all()
    )
    for page in pages:
        if page.slug not in [p.lstrip("/") for p in ALL_PUBLIC_PAGES]:
            urls.append({
                "loc": f"{base_url}/{page.slug}",
                "lastmod": page.updated_at.strftime("%Y-%m-%d") if page.updated_at else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "changefreq": "weekly",
                "priority": "0.6",
            })

    redis_client.setex(
        f"website:sitemap:{slug}",
        3600,  # 1 hour
        json.dumps(urls),
    )

    logger.info(f"Rebuilt sitemap for {slug}: {len(urls)} URLs")


@shared_task(name="website.bulk_sync_all")
def bulk_sync_all():
    """Periodic task — sync all published school websites. Run every 30 min."""
    from app import create_app
    app = create_app()

    with app.app_context():
        published_schools = (
            db.session.query(School.id)
            .join(SchoolWebsite, SchoolWebsite.school_id == School.id)
            .filter(SchoolWebsite.is_published == True)
            .all()
        )

        for (school_id,) in published_schools:
            sync_school_data.delay(school_id, trigger="periodic")

        logger.info(f"Queued website sync for {len(published_schools)} schools")
