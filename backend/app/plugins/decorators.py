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
    # ── AI Suite bundle (E230 catalog consolidation, 2026-08-31) ─────────
    # The seven AI/analytics plugins were merged into ONE licensing bundle
    # (`ai_suite`, premium, NPR 399/mo — backend/app/plugins/modules/
    # ai_suite/manifest.yaml). Their blueprints stay mounted exactly as
    # today; the aliases below make an ai_suite install satisfy every
    # ai_* / benchmarking / advanced_analytics gated route. The aliases are
    # KEPT pointing at ai_suite (not removed) so legacy installs of the
    # individual plugins keep passing their own gates — same mechanism as
    # the digital_content→elibrary and portfolio→student_portfolio merges.
    "ai_grading": "ai_suite",
    "ai_tutor": "ai_suite",
    "ai_tools": "ai_suite",
    "ai_adaptive_learning": "ai_suite",
    "ai_insights": "ai_suite",
    "benchmarking": "ai_suite",
    "advanced_analytics": "ai_suite",
    # NOTE: no "social_hub" entry — the plugin was WITHDRAWN from the catalog
    # (E230: unpublished + deprecated, unused, moderation liability). Its
    # routes stay mounted and gated @plugin_required("social_hub") so the
    # schools that already installed it keep working off their own
    # SchoolPlugin row; the feature is not replaced by any other plugin, so
    # aliasing it would silently hand its routes to another product.
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

    The map consulted is the EFFECTIVE one — the table above merged with
    every manifest's `aliases:` declaration (`PluginLoader.alias_map`), so a
    plugin can ship its own legacy slugs without editing this file. The merge
    only ever adds `legacy → canonical` pairs, so the single-hop property is
    preserved by construction. Falls back to the table alone if the loader is
    unavailable (import cycles during early boot, bare unit tests).
    """
    requested = str(plugin_slug or "").strip()
    if not requested:
        return set()

    try:
        from app.plugins.loader import PluginLoader

        alias_map = PluginLoader.alias_map()
    except Exception:  # noqa: BLE001 — gating must never depend on the loader
        alias_map = PLUGIN_SLUG_ALIASES

    accepted = {requested}

    mapped = alias_map.get(requested)
    if mapped:
        accepted.add(mapped)

    for old_slug, current_slug in alias_map.items():
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
