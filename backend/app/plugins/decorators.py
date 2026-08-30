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
    # portfolio was a duplicate publication of student_portfolio (same name,
    # same api_blueprint app.api.v1.portfolio, same models; all consumer
    # surfaces — web PluginGate, mobile visibility, flutter apps — gate
    # student_portfolio). Renamed to the canonical slug; alias KEPT so
    # legacy portfolio installs still pass student_portfolio-gated routes.
    "portfolio": "student_portfolio",
    # NOTE: no "design_studio" entry — it is its own published plugin
    # (growth, NPR 499), a different feature from the e-library pair.
    # Aliasing it to digital_content let an elibrary (starter, NPR 299)
    # install unlock design_studio routes via a transitive chain.
}


def _acceptable_plugin_slugs(plugin_slug: str) -> set[str]:
    """Return all equivalent slugs accepted for a requested plugin slug.

    Expansion is single-hop only: the requested slug, its direct alias
    target, and any legacy slug aliasing directly to it. Chaining is
    deliberately NOT followed (non-transitive) so an alias can never
    unlock a third plugin's routes.
    """
    requested = str(plugin_slug or "").strip()
    if not requested:
        return set()

    accepted = {requested}

    mapped = PLUGIN_SLUG_ALIASES.get(requested)
    if mapped:
        accepted.add(mapped)

    for old_slug, current_slug in PLUGIN_SLUG_ALIASES.items():
        if current_slug == requested and old_slug not in accepted:
            accepted.add(old_slug)

    return accepted


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
