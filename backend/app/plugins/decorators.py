"""
Plugin access control decorators.

@plugin_required('lms') — use on ALL plugin route handlers.
Checks if the requesting school has the plugin installed + active.
"""

from functools import wraps

from flask import g, jsonify


PLUGIN_SLUG_ALIASES = {
    # Legacy slug -> current installed slug
    "communications": "sms_notifications",
    "hr": "hr_payroll",
    "transport": "gps_tracking",
    "visitors": "visitor_management",
    "library": "library_management",
    "digital_content": "elibrary",
    "design_studio": "digital_content",
}


def _acceptable_plugin_slugs(plugin_slug: str) -> set[str]:
    """Return all equivalent slugs accepted for a requested plugin slug."""
    requested = str(plugin_slug or "").strip()
    accepted = {requested} if requested else set()

    # Resolve aliases transitively so groups like
    # design_studio <-> digital_content <-> elibrary are all accepted.
    frontier = list(accepted)
    while frontier:
        current = frontier.pop()

        mapped = PLUGIN_SLUG_ALIASES.get(current)
        if mapped and mapped not in accepted:
            accepted.add(mapped)
            frontier.append(mapped)

        for old_slug, current_slug in PLUGIN_SLUG_ALIASES.items():
            if current_slug == current and old_slug not in accepted:
                accepted.add(old_slug)
                frontier.append(old_slug)

    return {slug for slug in accepted if slug}


def plugin_required(plugin_slug: str):
    """Decorator: ensures the current school has the plugin installed and active."""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            installed = getattr(g, "installed_plugins", None)
            if not installed:
                return (
                    jsonify(
                        success=False,
                        error="School context not found",
                        data=None,
                    ),
                    403,
                )

            acceptable = _acceptable_plugin_slugs(plugin_slug)
            if not any(slug in installed for slug in acceptable):
                return (
                    jsonify(
                        success=False,
                        error=f"Plugin '{plugin_slug}' is not installed",
                        data={
                            "plugin_slug": plugin_slug,
                            "install_url": f"/marketplace/{plugin_slug}",
                            "message": "Install this plugin from the marketplace.",
                        },
                    ),
                    403,
                )

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def _school_has_plugin(school_id: str, plugin_slug: str) -> bool:
    """Helper: check if a school has a specific plugin installed.

    Safe to call from within request context (uses g.installed_plugins) or
    out-of-band (falls back to DB query if g is not available).
    """
    from flask import g as _g

    # Fast path: already in request context
    installed = getattr(_g, "installed_plugins", None)
    if installed is not None:
        return plugin_slug in installed

    # Fallback: direct DB query (e.g. called from Celery task context)
    try:
        from app.models.plugin import SchoolPlugin

        return (
            SchoolPlugin.query.filter_by(
                school_id=school_id,
                plugin_slug=plugin_slug,
                active=True,
            ).first()
            is not None
        )
    except Exception:
        return False
