"""Plugin Marketplace API — browse, install, uninstall, activate/deactivate, config."""

import json
import math

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm.attributes import flag_modified

from app.models.plugin import Plugin, SchoolPlugin
from app.plugins.billing import (
    activate_plugin,
    deactivate_plugin,
    effective_trial_days,
    install_plugin,
    plugin_is_free,
    uninstall_plugin,
)

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

# Schema-lite config validation (E163, plugin-architecture batch — FIX_STATUS
# §14): JSON object only, capped size,
# reserved keys that the platform writes are not client-writable.
PLUGIN_CONFIG_MAX_BYTES = 16 * 1024
PLUGIN_CONFIG_RESERVED_KEYS = {"last_payment"}


def _install_state(sp: SchoolPlugin | None) -> str:
    """WP-style lifecycle state derived from the SchoolPlugin row.

    active → "active"; deactivated (active=False, never uninstalled) →
    "inactive"; uninstalled (or no row) → "not_installed".
    """
    if sp is None or sp.uninstalled_at is not None:
        return "not_installed"
    return "active" if sp.active else "inactive"


def _trial_days_left(sp: SchoolPlugin | None) -> int | None:
    """Whole days left on the row's trial (0 once ended); None when not a trial."""
    if sp is None or not sp.is_trial or sp.trial_ends_at is None:
        return None
    ends = sp.trial_ends_at
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)
    delta = ends - datetime.now(timezone.utc)
    return max(0, math.ceil(delta.total_seconds() / 86400))


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

    # Check which are installed for the current school. All rows (active AND
    # deactivated) are loaded so the WP-style lifecycle state can be reported;
    # uninstalled rows (uninstalled_at set) count as not installed.
    installs_by_slug: dict[str, SchoolPlugin] = {}
    if g.get("school_id"):
        rows = SchoolPlugin.query.filter_by(school_id=g.school_id).all()
        installs_by_slug = {
            sp.plugin_slug: sp
            for sp in rows
            if sp.uninstalled_at is None
        }

    result = []
    for p in plugins:
        tier = "free" if p.is_free else (p.category or "starter")
        sp = installs_by_slug.get(p.slug)
        is_free = plugin_is_free(p)
        state = _install_state(sp)
        description = p.description
        if p.slug == "website_builder":
            # E207: the theme count in the copy went stale (said "20 themes"
            # after the registry was reduced to 10) — derive it live from the
            # theme registry so the card can never drift again.
            from app.services.website.theme_engine import ThemeEngineService

            theme_count = len(ThemeEngineService.list_themes())
            description = (
                f"{theme_count} open-source school themes + custom domain "
                "+ AI builder + Craft.js editor"
            )
        result.append(
            {
                "slug": p.slug,
                "name": p.name,
                "name_nepali": p.name_nepali,
                "description": description,
                "emoji": p.emoji,
                "icon": p.icon,
                "category": p.category,
                "price_monthly": float(p.price_monthly or 0),
                "price_yearly": float(p.price_yearly or 0),
                "is_free": is_free,
                "tier": tier,
                "trial_days": 0 if is_free else effective_trial_days(p),
                "screenshots": p.screenshots or [],
                "tags": p.tags or [],
                "installed": state == "active",
                "is_installed": state == "active",
                # WP-style lifecycle: not_installed | active | inactive
                "install_state": state,
                "is_deactivated": state == "inactive",
                "is_trial": bool(sp and sp.is_trial and state == "active"),
                "trial_days_left": _trial_days_left(sp) if state == "active" else None,
                "can_subscribe": not is_free,
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

    trial_days = effective_trial_days(plugin)
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
    """Activate a PAID subscription — requires proof of payment (audit E5).

    Caller survey (2026-08-28) across backend, frontend/lib, aschool_shared
    and the flutter apps found exactly ONE caller of /subscribe: the backend
    test suite (tests/test_marketplace_billing.py). No production client and
    no checkout flow that could actually collect plugin money exists. The
    previous behaviour silently flipped is_trial=False and set
    next_billing_date (which nothing checks) — a fake "paid" state.

    Chosen fix (documented per audit instruction): REQUIRE a payment
    reference and return 402 Payment Required without one — never silently
    mark paid. Body must carry:
        {"billing_cycle": "monthly"|"yearly",
         "payment": {"provider": "stripe|esewa|khalti|fonepay",
                     "transaction_id": "<provider ref>"}}
    (flat payment_provider / payment_transaction_id keys also accepted).
    The reference is stored on SchoolPlugin.config["last_payment"] for
    auditing; provider-side verification is NOT attempted (no billing
    integration — out of scope). Signature-verified Stripe webhooks
    (app/api/webhooks/__init__.py) remain the other paid-activation path.
    Trial install/uninstall flows (is_trial=True) are untouched.
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

    # E5: never mark paid without payment proof.
    payment = data.get("payment") or {}
    provider = str(
        payment.get("provider") or data.get("payment_provider") or ""
    ).strip()
    transaction_id = str(
        payment.get("transaction_id")
        or payment.get("payment_reference")
        or data.get("payment_transaction_id")
        or data.get("transaction_id")
        or ""
    ).strip()
    if not provider or not transaction_id:
        return error_response(
            "Payment required: subscriptions cannot be activated without proof "
            "of payment — pass {'payment': {'provider': 'stripe|esewa|khalti|"
            "fonepay', 'transaction_id': '...'}}",
            402,
        )

    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug
    ).first()

    now = datetime.now(timezone.utc)
    period = timedelta(days=365) if billing_cycle == "yearly" else timedelta(days=30)

    if not sp:
        # Dependency/conflict checks mirror install_plugin for parity.
        for dep_slug in (plugin.depends_on or []):
            dep = SchoolPlugin.query.filter_by(
                school_id=g.school_id, plugin_slug=dep_slug, active=True
            ).first()
            if not dep:
                return error_response(
                    f"Dependency not met: '{dep_slug}' must be installed first",
                    409,
                )
        for conflict_slug in (plugin.conflicts_with or []):
            conflict = SchoolPlugin.query.filter_by(
                school_id=g.school_id, plugin_slug=conflict_slug, active=True
            ).first()
            if conflict:
                return error_response(
                    f"Conflict: '{slug}' conflicts with installed plugin "
                    f"'{conflict_slug}'",
                    409,
                )
        # First-ever install via subscribe: create the row directly as PAID —
        # never through install_plugin, which would mint a trial first.
        sp = SchoolPlugin(
            school_id=g.school_id,
            plugin_slug=slug,
            active=True,
            billing_cycle=billing_cycle,
            is_trial=False,
        )
        plugin.install_count = (plugin.install_count or 0) + 1
        db.session.add(sp)
    elif sp.uninstalled_at is not None or not sp.active:
        # Reactivate an uninstalled/deactivated row as PAID — including rows
        # whose trial EXPIRED (install_plugin refuses those, which would
        # deadlock subscribe: its refusal message says "subscribe to install
        # it again").
        for dep_slug in (plugin.depends_on or []):
            dep = SchoolPlugin.query.filter_by(
                school_id=g.school_id, plugin_slug=dep_slug, active=True
            ).first()
            if not dep:
                return error_response(
                    f"Dependency not met: '{dep_slug}' must be installed first",
                    409,
                )
        sp.active = True
        sp.uninstalled_at = None

    sp.is_trial = False
    # Clear the trial window when converting to paid — a subscribed row must
    # not carry a stale trial_ends_at (the trial-expiry job keys on is_trial,
    # but honest state means exactly zero trial residue after payment).
    sp.trial_started_at = None
    sp.trial_ends_at = None
    sp.billing_cycle = billing_cycle
    sp.next_billing_date = (now + period).date()
    # Store the payment reference on the install record (audit trail). This is
    # a payment *reference*, not a verified receipt — see docstring.
    amount = (
        plugin.price_yearly if billing_cycle == "yearly" else plugin.price_monthly
    )
    sp.config = {
        **(sp.config or {}),
        "last_payment": {
            "provider": provider,
            "transaction_id": transaction_id,
            "billing_cycle": billing_cycle,
            "amount": float(amount or 0),
            "recorded_at": now.isoformat(),
        },
    }

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
            "payment_provider": provider,
            "transaction_id": transaction_id,
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


@plugins_bp.route("/<slug>/activate", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def activate(slug):
    """WP-style activate: re-enable a DEACTIVATED plugin (distinct from install).

    Idempotent on already-active installs (200 with already_active=True);
    404 when no install row exists or the plugin was uninstalled.
    """
    result = activate_plugin(str(g.school_id), slug)
    if "error" in result:
        message = result["error"]
        sp = SchoolPlugin.query.filter_by(
            school_id=g.school_id, plugin_slug=slug
        ).first()
        if sp is None or sp.uninstalled_at is not None:
            return error_response(message, 404)
        return error_response(message, 409)

    return success_response({**result, "active": True, "already_active": False})


@plugins_bp.route("/<slug>/deactivate", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def deactivate(slug):
    """WP-style deactivate: disable a plugin WITHOUT uninstalling it.

    The install row (config, trial state, billing) is preserved; the plugin
    disappears from g.installed_plugins so its gated routes 403 immediately.
    Idempotent on already-deactivated installs; 404 when never installed.
    """
    result = deactivate_plugin(str(g.school_id), slug)
    if "error" in result:
        sp = SchoolPlugin.query.filter_by(
            school_id=g.school_id, plugin_slug=slug
        ).first()
        if sp is None or sp.uninstalled_at is not None:
            return error_response(result["error"], 404)
        return error_response(result["error"], 409)

    return success_response({**result, "active": False, "already_inactive": False})


@plugins_bp.route("/<slug>/config", methods=["GET"])
@jwt_required()
@school_required
def get_plugin_config(slug):
    """Get plugin configuration for the current school.

    Readable while the plugin is installed (active OR deactivated) — WP-style
    settings stay inspectable for a disabled plugin; 404 once uninstalled.
    """
    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug
    ).first()
    if not sp or sp.uninstalled_at is not None:
        return error_response(f"Plugin '{slug}' is not installed", 404)
    return success_response(sp.config or {})


@plugins_bp.route("/<slug>/config", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_plugin_config(slug):
    """Update plugin configuration for the current school (schema-lite, E163).

    Body must be a flat JSON object (JSON-dict validated); non-dict payloads
    are rejected, the payload is capped at PLUGIN_CONFIG_MAX_BYTES, and
    platform-reserved keys (config["last_payment"] — the subscribe audit
    trail) are not client-writable. Works while the plugin is active or
    merely deactivated; 404 once uninstalled.

    Default semantics MERGE the payload over the stored config. Pass
    ?replace=1 to REPLACE the whole config with the payload (needed to drop
    deleted keys — the settings page sends the full dict with this flag).
    """
    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug=slug
    ).first()
    if not sp or sp.uninstalled_at is not None:
        return error_response(f"Plugin '{slug}' is not installed", 404)

    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        return error_response(
            "Plugin config must be a JSON object (e.g. {\"key\": \"value\"})", 400
        )

    reserved = PLUGIN_CONFIG_RESERVED_KEYS & data.keys()
    if reserved:
        return error_response(
            f"Config key(s) {sorted(reserved)} are reserved by the platform", 400
        )

    try:
        payload_bytes = len(json.dumps(data).encode("utf-8"))
    except (TypeError, ValueError):
        return error_response("Plugin config is not JSON-serializable", 400)
    if payload_bytes > PLUGIN_CONFIG_MAX_BYTES:
        return error_response(
            f"Plugin config too large ({payload_bytes} bytes; "
            f"limit {PLUGIN_CONFIG_MAX_BYTES})",
            400,
        )

    # Merge into a FRESH dict and reassign — never mutate sp.config in place.
    # Assigning the same (mutated) dict object back is a no-op for the unit of
    # work (the attribute history compares equal), so an in-place edit on a
    # JSONB column would be silently dropped; flag_modified is applied as
    # defense-in-depth for the same bug class.
    replace = request.args.get("replace", "").lower() in ("1", "true", "yes")
    merged_config = dict(data) if replace else {**(sp.config or {}), **data}
    sp.config = merged_config
    flag_modified(sp, "config")
    db.session.commit()
    return success_response(sp.config)
