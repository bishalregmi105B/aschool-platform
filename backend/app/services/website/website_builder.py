"""School Website Builder Service — Dynamic page and content management."""

from flask import current_app
from extensions import db


class WebsiteBuilderService:
    """Manage school website pages, menus, and content."""

    @classmethod
    def get_website_config(cls, school_id: str) -> dict:
        """Get the full website configuration for a school."""
        from app.models.school import School, SchoolWebsite
        from app.models.website import WebsitePage

        school = School.query.get(school_id)
        config = SchoolWebsite.query.filter_by(school_id=school_id, is_deleted=False).first()
        pages = WebsitePage.query.filter_by(school_id=school_id, is_published=True).order_by(
            WebsitePage.sort_order
        ).all()

        if not config:
            base = cls._default_config(school_id)
            base["school_name"] = school.name if school else ""
            return base

        customizations = config.customizations or {}

        return {
            "school_id": school_id,
            "school_name": school.name if school else "",
            "theme": config.theme_slug or "modern-minimal",
            "theme_slug": config.theme_slug or "modern-minimal",
            "primary_color": customizations.get("primary_color", "#1a365d"),
            "secondary_color": customizations.get("secondary_color", "#2563eb"),
            "logo_url": customizations.get("logo_url", ""),
            "banner_url": customizations.get("banner_url", ""),
            "tagline": customizations.get("tagline", ""),
            "contact_email": customizations.get("contact_email", school.email if school else ""),
            "contact_phone": customizations.get("contact_phone", school.phone if school else ""),
            "address": customizations.get("address", school.address if school else ""),
            "social_links": customizations.get("social_links", {}),
            "is_published": bool(config.is_published),
            "pages": [
                {
                    "id": str(p.id),
                    "title": p.title,
                    "slug": p.slug,
                    "content": p.content,
                    "page_type": p.page_type,
                    "sort_order": p.sort_order,
                    "is_published": p.is_published,
                }
                for p in pages
            ],
        }

    @classmethod
    def update_config(cls, school_id: str, data: dict) -> dict:
        """Update website configuration."""
        from app.models.school import SchoolWebsite

        config = SchoolWebsite.query.filter_by(school_id=school_id, is_deleted=False).first()
        if not config:
            config = SchoolWebsite(school_id=school_id)
            db.session.add(config)

        if "theme" in data or "theme_slug" in data:
            config.theme_slug = data.get("theme_slug") or data.get("theme")

        customizations = dict(config.customizations or {})
        for field in [
            "primary_color", "secondary_color", "logo_url", "banner_url",
            "tagline", "contact_email", "contact_phone", "address", "social_links",
        ]:
            if field in data:
                customizations[field] = data[field]
        config.customizations = customizations

        db.session.commit()
        return cls.get_website_config(school_id)

    @classmethod
    def create_page(cls, school_id: str, data: dict) -> dict:
        """Create a new website page."""
        from app.models.website import WebsitePage

        page = WebsitePage(
            school_id=school_id,
            title=data["title"],
            slug=data.get("slug", data["title"].lower().replace(" ", "-")),
            content=data.get("content", ""),
            page_type=data.get("page_type", "custom"),
            sort_order=data.get("sort_order", 0),
            is_published=data.get("is_published", True),
        )
        db.session.add(page)
        db.session.commit()

        return {
            "id": str(page.id),
            "title": page.title,
            "slug": page.slug,
            "page_type": page.page_type,
        }

    @classmethod
    def update_page(cls, page_id: str, data: dict) -> dict:
        """Update an existing page."""
        from app.models.website import WebsitePage

        page = WebsitePage.query.get_or_404(page_id)
        for field in ["title", "slug", "content", "page_type", "sort_order", "is_published"]:
            if field in data:
                setattr(page, field, data[field])

        db.session.commit()
        return {"id": str(page.id), "title": page.title, "slug": page.slug}

    @classmethod
    def delete_page(cls, page_id: str) -> bool:
        """Delete a website page."""
        from app.models.website import WebsitePage

        page = WebsitePage.query.get_or_404(page_id)
        db.session.delete(page)
        db.session.commit()
        return True

    @classmethod
    def _default_config(cls, school_id: str) -> dict:
        return {
            "school_id": school_id,
            "theme": "default",
            "primary_color": "#1a365d",
            "secondary_color": "#2563eb",
            "pages": [
                {"title": "Home", "slug": "home", "page_type": "home"},
                {"title": "About", "slug": "about", "page_type": "about"},
                {"title": "Contact", "slug": "contact", "page_type": "contact"},
            ],
        }
