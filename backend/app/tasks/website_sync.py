"""Website sync tasks — cache invalidation, sitemap generation."""

from extensions import celery


@celery.task(name="sync_website_cache")
def sync_website_cache(school_id: str):
    """Invalidate and rebuild website cache after content updates."""
    from flask import current_app
    from extensions import cache
    from app.services.website.website_builder import WebsiteBuilderService

    cache.delete(f"website_config:{school_id}")
    config = WebsiteBuilderService.get_website_config(school_id)
    cache.set(f"website_config:{school_id}", config, timeout=3600)

    current_app.logger.info(f"Website cache synced for school {school_id}")
    return {"success": True, "pages": len(config.get("pages", []))}


@celery.task(name="generate_sitemap")
def generate_sitemap(school_id: str, school_slug: str):
    """Generate sitemap.xml for a school's website."""
    from flask import current_app
    from app.services.website.website_builder import WebsiteBuilderService
    from app.utils.tenant_url import school_site_url

    config = WebsiteBuilderService.get_website_config(school_id)
    pages = config.get("pages", [])

    base = school_site_url(school_slug)
    urls = [f"{base}/"]
    for page in pages:
        urls.append(f"{base}/{page['slug']}")

    current_app.logger.info(f"Sitemap generated for {school_slug}: {len(urls)} URLs")
    return {"school_id": school_id, "urls": urls}
