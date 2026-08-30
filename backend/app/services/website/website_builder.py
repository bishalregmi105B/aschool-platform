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
            base.update(cls._white_label_overrides(school_id))
            return base

        customizations = config.customizations or {}

        default_theme = cls._default_theme_slug()
        config_dict = {
            "school_id": school_id,
            "school_name": school.name if school else "",
            "theme": config.theme_slug or default_theme,
            "theme_slug": config.theme_slug or default_theme,
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

        # White-label overrides (premium): display name / footer / branding-removal
        # flag apply only while the white_label plugin is active.
        config_dict.update(cls._white_label_overrides(school_id))
        return config_dict

    @staticmethod
    def _white_label_overrides(school_id: str) -> dict:
        try:
            from app.services.website.white_label import WhiteLabelService

            return WhiteLabelService.website_config_overrides(school_id)
        except Exception:  # pragma: no cover — branding must never break config read
            return {}

    @classmethod
    def update_config(cls, school_id: str, data: dict) -> dict:
        """Update website configuration."""
        from app.models.school import SchoolWebsite

        config = SchoolWebsite.query.filter_by(school_id=school_id, is_deleted=False).first()
        if not config:
            config = SchoolWebsite(school_id=school_id)
            db.session.add(config)

        theme_change = "theme" in data or "theme_slug" in data
        if theme_change:
            config.theme_slug = data.get("theme_slug") or data.get("theme")

        customizations = dict(config.customizations or {})
        # Keep the palette in sync when only the theme id changes (a stale
        # template palette would otherwise keep overriding the new theme on
        # the public site). Explicit "colors" payloads still win.
        if theme_change and "colors" not in data and config.theme_slug:
            from app.services.website.theme_engine import ThemeEngineService

            synced = ThemeEngineService.synced_colors(
                customizations.get("colors"), config.theme_slug, school_id=school_id
            )
            if synced:
                customizations["colors"] = synced
        for field in [
            "primary_color", "secondary_color", "logo_url", "banner_url",
            "tagline", "contact_email", "contact_phone", "address", "social_links",
        ]:
            if field in data:
                customizations[field] = data[field]
        if "colors" in data:
            # Theme applications send the full core palette. Replace the five
            # core tokens but keep auxiliary keys (e.g. "surface") that other
            # flows (templates, white-label) may have stored.
            existing_colors = dict(customizations.get("colors") or {})
            colors = {
                k: v for k, v in existing_colors.items()
                if k not in ("primary", "secondary", "accent", "bg", "text")
            }
            colors.update(data["colors"] or {})
            customizations["colors"] = colors
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

    @staticmethod
    def _default_theme_slug() -> str:
        """Default theme id shared with the frontend registry (no old ids left)."""
        try:
            from app.services.website.theme_engine import ThemeEngineService

            return ThemeEngineService.DEFAULT_THEME_ID
        except Exception:  # pragma: no cover — never block config reads
            return "global-elearning"

    @classmethod
    def _default_config(cls, school_id: str) -> dict:
        return {
            "school_id": school_id,
            "theme": cls._default_theme_slug(),
            "primary_color": "#1a365d",
            "secondary_color": "#2563eb",
            "pages": [
                {"title": "Home", "slug": "home", "page_type": "home"},
                {"title": "About", "slug": "about", "page_type": "about"},
                {"title": "Contact", "slug": "contact", "page_type": "contact"},
            ],
        }
