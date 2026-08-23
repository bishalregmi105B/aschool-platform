"""Plugin Marketplace API — browse, install, uninstall, config."""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.plugin import Plugin, SchoolPlugin
from app.plugins.billing import install_plugin, uninstall_plugin

from datetime import datetime, timedelta, timezone
from app.plugins.loader import PluginLoader
from app.utils.decorators import role_required, school_required
from app.utils.response import (
    created_response,
    error_response,
    success_response,
)
from extensions import db

plugins_bp = Blueprint("plugins", __name__, url_prefix="/plugins")


@plugins_bp.route("/marketplace", methods=["GET"])
@jwt_required()
def marketplace():
    """Browse available plugins as a flat list."""
    category = request.args.get("category")
    search = request.args.get("search")

    query = Plugin.query.filter_by(is_published=True, is_deleted=False)
    if category:
        query = query.filter_by(category=category)
    if search:
        query = query.filter(Plugin.name.ilike(f"%{search}%") | Plugin.tags.any(search))
    query = query.order_by(Plugin.sort_order, Plugin.name)
    plugins = query.all()

    # Check which are installed for the current school
    installed_slugs = set()
    if g.get("school_id"):
        installed = SchoolPlugin.query.filter_by(
            school_id=g.school_id, active=True
        ).all()
        installed_slugs = {sp.plugin_slug for sp in installed}

    result = []
    for p in plugins:
        tier = "free" if p.is_free else (p.category or "starter")
        result.append(
            {
                "slug": p.slug,
                "name": p.name,
                "name_nepali": p.name_nepali,
                "description": p.description,
                "emoji": p.emoji,
                "icon": p.icon,
                "category": p.category,
                "price_monthly": float(p.price_monthly or 0),
                "price_yearly": float(p.price_yearly or 0),
                "is_free": p.is_free,
                "tier": tier,
                "trial_days": p.trial_days,
                "screenshots": p.screenshots or [],
                "tags": p.tags or [],
                "installed": p.slug in installed_slugs,
                "is_installed": p.slug in installed_slugs,
                "is_featured": p.is_featured,
                "avg_rating": float(p.avg_rating or 0),
                "install_count": p.install_count or 0,
                "depends_on": p.depends_on or [],
                "conflicts_with": p.conflicts_with or [],
                "version": p.version,
            }
        )

    return success_response(result)


@plugins_bp.route("/sidebar", methods=["GET"])
@jwt_required()
@school_required
def get_sidebar_config():
    """Return plugin-driven sidebar navigation items for the current school and user role.

    The frontend sidebar is built from these items combined with its hardcoded
    core items (Dashboard, Academics, Students, etc.).
    """
    role = g.role or "school_admin"
    installed_slugs = g.installed_plugins or []
    items = PluginLoader.get_frontend_sidebar(installed_slugs, role)
    # Also include any bottom-nav plugin items so the client can handle them
    bottom_items = PluginLoader.get_bottom_nav_items(installed_slugs, role)
    return success_response(
        {
            "items": items,
            "bottom_nav": bottom_items,
        }
    )


@plugins_bp.route("/installed", methods=["GET"])
@jwt_required()
@school_required
def installed_plugins():
    """Get all installed plugins for the current school."""
    installed = SchoolPlugin.query.filter_by(
        school_id=g.school_id, active=True, is_deleted=False
    ).all()

    result = []
    for sp in installed:
        result.append(
            {
                "plugin_slug": sp.plugin_slug,
                "active": sp.active,
                "installed_at": sp.installed_at.isoformat()
                if sp.installed_at
                else None,
                "is_trial": sp.is_trial,
                "trial_ends_at": sp.trial_ends_at.isoformat()
                if sp.trial_ends_at
                else None,
                "billing_cycle": sp.billing_cycle,
                "next_billing_date": sp.next_billing_date.isoformat()
                if sp.next_billing_date
                else None,
                "config": sp.config or {},
            }
        )

    return success_response(result)


@plugins_bp.route("/install", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def install():
    """Install a plugin for the current school."""
    data = request.get_json(silent=True) or {}
    plugin_slug = data.get("plugin_slug")
    billing_cycle = data.get("billing_cycle", "monthly")

    if not plugin_slug:
        return error_response("plugin_slug is required", 400)

    result = install_plugin(str(g.school_id), plugin_slug, billing_cycle)
    if "error" in result:
        status = (
            409
            if "conflict" in result["error"].lower()
            or "dependency" in result["error"].lower()
            else 400
        )
        return error_response(result["error"], status)

    return created_response(result)


@plugins_bp.route("/<slug>/trial", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def start_trial(slug):
    """Start (or resume) a free trial for a plugin — no billing obligation.

    409 if the plugin is already installed or its trial was already used.
    """
    plugin = Plugin.query.filter_by(
        slug=slug, is_published=True, is_deleted=False
    ).first()
    if not plugin:
        return error_response(f"Plugin '{slug}' not found or not available", 404)

    existing = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug
    ).first()
    if existing and existing.active:
        return error_response(f"Plugin '{slug}' is already installed", 409)
    if existing and existing.trial_started_at:
        return error_response(
            f"Trial for '{slug}' was already used by this school", 409
        )

    trial_days = plugin.trial_days or 14
    now = datetime.now(timezone.utc)

    if existing:
        existing.active = True
        existing.uninstalled_at = None
        existing.is_trial = True
        existing.trial_started_at = now
        existing.trial_ends_at = now + timedelta(days=trial_days)
        existing.billing_cycle = "monthly"
        sp = existing
    else:
        # Dependency check still applies for trials.
        for dep_slug in (plugin.depends_on or []):
            dep = SchoolPlugin.query.filter_by(
                school_id=g.school_id, plugin_slug=dep_slug, active=True
            ).first()
            if not dep:
                return error_response(
                    f"Dependency not met: '{dep_slug}' must be installed first",
                    409,
                )
        sp = SchoolPlugin(
            school_id=g.school_id,
            plugin_slug=slug,
            active=True,
            billing_cycle="monthly",
            is_trial=True,
            trial_started_at=now,
            trial_ends_at=now + timedelta(days=trial_days),
            next_billing_date=(now + timedelta(days=trial_days)).date(),
        )
        db.session.add(sp)
        plugin.install_count = (plugin.install_count or 0) + 1

    db.session.commit()

    from app.plugins.billing import _invalidate_plugin_cache

    _invalidate_plugin_cache(str(g.school_id))

    return created_response(
        {
            "plugin_slug": slug,
            "is_trial": True,
            "trial_days": trial_days,
            "trial_ends_at": sp.trial_ends_at.isoformat() if sp.trial_ends_at else None,
        }
    )


@plugins_bp.route("/<slug>/subscribe", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def subscribe(slug):
    """Convert an active trial to a paid subscription (or subscribe directly).

    Body: {"billing_cycle": "monthly" | "yearly"}
    """
    data = request.get_json(silent=True) or {}
    billing_cycle = data.get("billing_cycle", "monthly")
    if billing_cycle not in ("monthly", "yearly"):
        return error_response("billing_cycle must be 'monthly' or 'yearly'", 400)

    plugin = Plugin.query.filter_by(
        slug=slug, is_published=True, is_deleted=False
    ).first()
    if not plugin:
        return error_response(f"Plugin '{slug}' not found or not available", 404)
    if plugin.is_free:
        return error_response(f"Plugin '{slug}' is free and needs no subscription", 400)

    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug, active=True
    ).first()

    now = datetime.now(timezone.utc)
    if not sp:
        result = install_plugin(str(g.school_id), slug, billing_cycle)
        if "error" in result:
            return error_response(result["error"], 409)
        sp = SchoolPlugin.query.filter_by(
            school_id=g.school_id, plugin_slug=slug
        ).first()
    else:
        period = timedelta(days=365) if billing_cycle == "yearly" else timedelta(days=30)
        sp.is_trial = False
        sp.billing_cycle = billing_cycle
        sp.next_billing_date = (now + period).date()

    db.session.commit()

    from app.plugins.billing import _invalidate_plugin_cache

    _invalidate_plugin_cache(str(g.school_id))

    return success_response(
        {
            "plugin_slug": slug,
            "billing_cycle": billing_cycle,
            "price_monthly": float(plugin.price_monthly or 0),
            "price_yearly": float(plugin.price_yearly or 0),
            "is_trial": False,
            "next_billing_date": sp.next_billing_date.isoformat()
            if getattr(sp, "next_billing_date", None)
            else None,
        }
    )


@plugins_bp.route("/uninstall", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def uninstall():
    """Uninstall (soft) a plugin from the current school."""
    data = request.get_json(silent=True) or {}
    plugin_slug = data.get("plugin_slug")

    if not plugin_slug:
        return error_response("plugin_slug is required", 400)

    result = uninstall_plugin(str(g.school_id), plugin_slug)
    if "error" in result:
        return error_response(result["error"], 400)

    return success_response(result)


@plugins_bp.route("/<slug>/config", methods=["GET"])
@jwt_required()
@school_required
def get_plugin_config(slug):
    """Get plugin configuration for the current school."""
    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug, active=True
    ).first()
    if not sp:
        return error_response(f"Plugin '{slug}' is not installed", 404)
    return success_response(sp.config or {})


@plugins_bp.route("/<slug>/config", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_plugin_config(slug):
    """Update plugin configuration for the current school."""
    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug, active=True
    ).first()
    if not sp:
        return error_response(f"Plugin '{slug}' is not installed", 404)

    data = request.get_json(silent=True) or {}
    current_config = sp.config or {}
    current_config.update(data)
    sp.config = current_config
    db.session.commit()
    return success_response(sp.config)
