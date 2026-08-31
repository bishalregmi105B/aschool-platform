"""Tenant URL helpers — single source of truth for the school-site base domain.

The platform is deployed at brighternepal.com (BASE_DOMAIN in prod .env).
Nothing outside this module may hardcode a domain; school-site URLs are
always built from the runtime BASE_DOMAIN config.
"""
from typing import Optional

# Fallback only — production .env sets BASE_DOMAIN=brighternepal.com.
DEFAULT_BASE_DOMAIN = "brighternepal.com"


def school_site_domain() -> str:
    """Return the current platform base domain (e.g. "brighternepal.com").

    Reads BASE_DOMAIN from the Flask config (which itself comes from the
    BASE_DOMAIN env var), falling back to the production default.
    Safe to call outside an app context (returns the default).
    """
    try:
        from flask import current_app

        return (current_app.config.get("BASE_DOMAIN") or DEFAULT_BASE_DOMAIN).strip().lstrip(".")
    except RuntimeError:
        # No app context (e.g. bare Celery worker import) — use the default.
        return DEFAULT_BASE_DOMAIN


def school_site_url(slug: Optional[str], path: str = "", scheme: str = "https") -> Optional[str]:
    """Return the public URL for a school site: https://{slug}.{base}/[path]."""
    domain = school_site_domain()
    base = f"{scheme}://{slug}.{domain}"
    if path:
        base += path if path.startswith("/") else f"/{path}"
    return base


def school_site_host(slug: Optional[str]) -> Optional[str]:
    """Return the hostname for a school site: {slug}.{base}."""
    if not slug:
        return None
    return f"{slug}.{school_site_domain()}"
