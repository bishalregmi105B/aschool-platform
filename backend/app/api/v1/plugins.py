"""Plugin Marketplace API — browse, install, uninstall, activate/deactivate, config."""

import json
import logging
import math
from types import SimpleNamespace

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
from app.plugins.entitlements import ensure_free_plugins

from datetime import datetime, timedelta, timezone
from app.plugins.loader import PluginLoader
from app.utils.decorators import role_required, school_required
from app.utils.response import (
    created_response,
    error_response,
    success_response,
)
from extensions import db

logger = logging.getLogger(__name__)

plugins_bp = Blueprint("plugins", __name__, url_prefix="/plugins")

# Schema-lite config validation (E163, plugin-architecture batch — FIX_STATUS
# §14): JSON object only, capped size,
# reserved keys that the platform writes are not client-writable.
PLUGIN_CONFIG_MAX_BYTES = 16 * 1024
PLUGIN_CONFIG_RESERVED_KEYS = {"last_payment"}


def _coming_soon_guard(slug: str) -> str | None:
    """E230: refuse install/trial/subscribe for coming-soon plugins.

    The routes stay gated+mounted and existing install rows keep working —
    only NEW activations are blocked while the plugin is in final testing.
    Returns the user-facing message, or None when the plugin is installable.
    """
    manifest = PluginLoader.get_manifest(slug) or {}
    if manifest.get("coming_soon"):
        return (
            f"'{manifest.get('name', slug)}' is in final testing — releasing "
            "soon. It cannot be installed yet."
        )
    return None


def _core_plugin_guard(slug: str) -> str | None:
    """Refuse deactivate/uninstall of CORE plugins (base toolset).

    Core-category plugins (dashboard, marketplace nav, students, teachers…)
    ship with every plan and the school's dashboard/sidebar depends on them —
    an admin deactivating one bricks the school shell. Returns the 400
    message when `slug` is core (manifest category first, mirror row
    fallback), or None when the plugin is freely manageable.
    """
    manifest = PluginLoader.get_manifest(slug) or {}
    category = manifest.get("category")
    if not category:
        row = Plugin.query.filter_by(slug=slug, is_deleted=False).first()
        category = row.category if row else None
    if (category or "").lower() == "core":
        name = manifest.get("name") or slug
        return (
            f"'{name}' is a core plugin included with every plan — it cannot "
            "be deactivated or uninstalled"
        )
    return None


def _run_plugin_hook(plugin_slug: str, hook_name: str) -> None:
    """Run a plugin's lifecycle hook (activate/deactivate/uninstall) if present.

    WP-style: hooks are the module's own code — table creation on activate,
    config-row cleanup on uninstall. Failures (import or runtime) are LOGGED
    and never fatal: the install state must not depend on plugin hooks, and a
    broken plugin cannot take the marketplace down.
    """
    try:
        module = PluginLoader.get_hooks(plugin_slug)
        fn = getattr(module, hook_name, None) if module else None
        if fn is None:
            return
        fn(db)
        logger.info("Plugin '%s': %s hook ran", plugin_slug, hook_name)
    except Exception as e:  # noqa: BLE001 — hooks are never fatal
        logger.warning(
            "Plugin '%s': %s hook failed (ignored): %s", plugin_slug, hook_name, e
        )


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


def _catalog_entries() -> list[dict]:
    """WP-style catalog view: the REGISTRY (loader) is the source of truth.

    Every manifest slug is an entry; the DB `plugins` mirror row only supplies
    the extra marketplace fields manifests don't carry (screenshots, tags,
    ratings, stats, sort order). Mirror rows for slugs no longer in the
    registry act as a fallback until the next refresh unpublishes them.
    """
    manifests = PluginLoader.get_all_manifests()
    rows_by_slug: dict[str, Plugin] = {
        p.slug: p for p in Plugin.query.filter_by(is_deleted=False).all()
    }

    entries: list[dict] = []
    seen: set[str] = set()
    for slug, m in manifests.items():
        seen.add(slug)
        row = rows_by_slug.get(slug)
        is_published = bool(m.get("published", True))
        if not is_published and not (row and row.is_published):
            # Delisted by its manifest and the mirror agrees — not offered.
            continue

        def _val(field, default):
            """Manifest value wins; mirror row is the fallback."""
            if m.get(field) is not None:
                return m.get(field)
            if row is not None:
                v = getattr(row, field, None)
                if v is not None:
                    return v
            return default

        entries.append(
            {
                "slug": slug,
                "name": _val("name", slug),
                "name_nepali": _val("name_nepali", ""),
                "description": _val("description", ""),
                "emoji": _val("emoji", None),
                "icon": _val("icon", None),
                "category": _val("category", "core"),
                "price_monthly": float(_val("price_monthly", 0) or 0),
                "price_yearly": float(_val("price_yearly", 0) or 0),
                "is_free": _val("is_free", float(_val("price_monthly", 0) or 0) == 0),
                "version": _val("version", "1.0.0"),
                "depends_on": _val("depends_on", []) or [],
                "conflicts_with": _val("conflicts_with", []) or [],
                "screenshots": (row.screenshots if row else None) or [],
                "tags": (row.tags if row else None) or [],
                "sort_order": (row.sort_order if row else None) or 0,
                "is_featured": (row.is_featured if row else None) or False,
                "avg_rating": float(
                    ((row.avg_rating if row else None) or 0)
                ),
                "install_count": (row.install_count if row else None) or 0,
                # E230: manifest-only catalog flags (no mirror columns needed)
                "coming_soon": bool(m.get("coming_soon")),
                "deprecated": bool(m.get("deprecated")),
            }
        )

    # Fallback: published mirror rows whose folder/manifest vanished (a
    # refresh-registry hasn't unpublished them yet — e.g. mirror-only rows).
    for slug, row in rows_by_slug.items():
        if slug in seen or not row.is_published:
            continue
        entries.append(
            {
                "slug": slug,
                "name": row.name,
                "name_nepali": row.name_nepali or "",
                "description": row.description or "",
                "emoji": row.emoji,
                "icon": row.icon,
                "category": row.category,
                "price_monthly": float(row.price_monthly or 0),
                "price_yearly": float(row.price_yearly or 0),
                "is_free": bool(row.is_free),
                "version": row.version or "1.0.0",
                "depends_on": row.depends_on or [],
                "conflicts_with": row.conflicts_with or [],
                "screenshots": row.screenshots or [],
                "tags": row.tags or [],
                "sort_order": row.sort_order or 0,
                "is_featured": bool(row.is_featured),
                "avg_rating": float(row.avg_rating or 0),
                "install_count": row.install_count or 0,
                "coming_soon": False,
                "deprecated": False,
            }
        )

    entries.sort(key=lambda e: (e["sort_order"], (e["name"] or "").lower()))
    return entries


def _ensure_provisioned() -> None:
    """Lazy backfill of plan-tier plugins for EXISTING schools.

    Runs the idempotent entitlements.ensure_free_plugins pass before the
    marketplace / installed-plugins listing is built, so schools created
    before auto-provisioning (or whose grants failed at signup) get every
    free-tier plugin ACTIVE on first load — nobody hand-installs the core
    plugins. Cheap when already provisioned: 1-2 SELECTs, zero writes, no
    commit. Never runs without a school context, and failures are logged,
    not raised — the listing must keep working.
    """
    if not g.get("school_id"):
        return
    try:
        ensure_free_plugins(g.school_id)
    except Exception as e:  # noqa: BLE001 — backfill is best-effort
        logger.warning("Plugin lazy-provisioning failed: %s", e)


@plugins_bp.route("/marketplace", methods=["GET"])
@jwt_required()
def marketplace():
    """Browse available plugins as a flat list.

    Reads the plugin REGISTRY (directory scan) merged with per-school
    SchoolPlugin state; the DB `plugins` table is only a mirror/fallback.
    Lazily backfills missing plan-tier plugins first so pre-existing
    schools see their free plugins as ACTIVE without hand-installing.
    """
    category = request.args.get("category")
    search = request.args.get("search")

    _ensure_provisioned()
    entries = _catalog_entries()
    if category:
        entries = [e for e in entries if e["category"] == category]
    if search:
        needle = search.lower()
        entries = [
            e
            for e in entries
            if needle in (e["name"] or "").lower()
            or needle in (e["name_nepali"] or "").lower()
            or needle in (e["description"] or "").lower()
            or any(needle in (t or "").lower() for t in e["tags"])
        ]

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
    for e in entries:
        sp = installs_by_slug.get(e["slug"])
        # plugin_is_free/effective_trial_days only read category/is_free/
        # price_monthly — a lightweight view over the merged entry suffices.
        probe = SimpleNamespace(
            category=e["category"], is_free=e["is_free"], price_monthly=e["price_monthly"]
        )
        is_free = plugin_is_free(probe)
        tier = "free" if is_free else (e["category"] or "starter")
        state = _install_state(sp)
        description = e["description"]
        if e["slug"] == "website_builder":
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
                "slug": e["slug"],
                "name": e["name"],
                "name_nepali": e["name_nepali"],
                "description": description,
                "emoji": e["emoji"],
                "icon": e["icon"],
                "category": e["category"],
                "price_monthly": e["price_monthly"],
                "price_yearly": e["price_yearly"],
                "is_free": is_free,
                "tier": tier,
                "trial_days": 0 if is_free else effective_trial_days(probe),
                "screenshots": e["screenshots"],
                "tags": e["tags"],
                "installed": state == "active",
                "is_installed": state == "active",
                # WP-style lifecycle: not_installed | active | inactive
                "install_state": state,
                "is_deactivated": state == "inactive",
                "is_trial": bool(sp and sp.is_trial and state == "active"),
                "trial_days_left": _trial_days_left(sp) if state == "active" else None,
                "can_subscribe": not is_free,
                "is_featured": e["is_featured"],
                "avg_rating": e["avg_rating"],
                "install_count": e["install_count"],
                "depends_on": e["depends_on"],
                "conflicts_with": e["conflicts_with"],
                "version": e["version"],
                # E230: coming-soon plugins show a "Coming Soon" card with a
                # disabled install button; deprecated ones are legacy slugs
                # kept for alias compatibility (canonical successor exists).
                "coming_soon": e["coming_soon"],
                "deprecated": e["deprecated"],
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
    # Lazy backfill first (idempotent, no-op when fully provisioned) so
    # pre-existing schools get their plan-tier plugins ACTIVE on first load.
    _ensure_provisioned()
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

    # E230: coming-soon plugins cannot be activated yet (409 — the plugin
    # exists in the catalog, the request is understood, but is not allowed).
    coming_soon = _coming_soon_guard(str(plugin_slug))
    if coming_soon:
        return error_response(coming_soon, 409)

    result = install_plugin(str(g.school_id), plugin_slug, billing_cycle)
    if "error" in result:
        status = (
            409
            if "conflict" in result["error"].lower()
            or "dependency" in result["error"].lower()
            else 400
        )
        return error_response(result["error"], status)

    # WP-style activation hook: the module creates its tables/defaults after
    # the SchoolPlugin row exists. Logged-not-fatal on failure.
    _run_plugin_hook(plugin_slug, "activate")

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

    coming_soon = _coming_soon_guard(slug)
    if coming_soon:
        return error_response(coming_soon, 409)

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

    # Trial installs mint a SchoolPlugin row too — run the activation hook.
    _run_plugin_hook(slug, "activate")

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

    coming_soon = _coming_soon_guard(slug)
    if coming_soon:
        return error_response(coming_soon, 409)

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

    # First-ever paid install mints the SchoolPlugin row — run the activation
    # hook (idempotent: table creation is checkfirst).
    _run_plugin_hook(slug, "activate")

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

    # Core plugins ship with every plan and the dashboard/sidebar depends on
    # them — uninstalling one would break the school shell.
    core_guard = _core_plugin_guard(str(plugin_slug))
    if core_guard:
        return error_response(core_guard, 400)

    result = uninstall_plugin(str(g.school_id), plugin_slug)
    if "error" in result:
        return error_response(result["error"], 400)

    # WP-style uninstall hook: modules remove only their own config rows —
    # data tables are kept (WordPress keeps data on uninstall too). Logged-
    # not-fatal on failure.
    _run_plugin_hook(plugin_slug, "uninstall")

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
    CORE-category plugins cannot be deactivated (400) — they are the base
    toolset every school's dashboard and sidebar depends on.
    """
    # Core guard before the existence checks: a core plugin is provisioned
    # for every school, so refusing by category (not by install row) keeps
    # the message stable even if the row was somehow never created.
    core_guard = _core_plugin_guard(slug)
    if core_guard:
        return error_response(core_guard, 400)

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


@plugins_bp.route("/refresh-registry", methods=["POST"])
@jwt_required()
@role_required("superadmin")
def refresh_registry():
    """Rescan the plugin directory and re-sync the `plugins` catalog mirror.

    WP model: the plugins DIRECTORY is the catalog source of truth — this
    endpoint re-scans it without a restart, upserting mirror rows (missing
    folders created published, vanished folders unpublished). Superadmin-only.
    """
    try:
        result = PluginLoader.refresh_registry()
    except Exception as e:  # noqa: BLE001 — reported, never crashes the API
        logger.error("refresh-registry failed: %s", e)
        return error_response(f"Registry refresh failed: {e}", 500)
    return success_response(result)


@plugins_bp.route("/<slug>/config-schema", methods=["GET"])
@jwt_required()
def get_plugin_config_schema(slug):
    """Settings-screen definition for a plugin (from its config_schema.yaml).

    `fields` is empty when the plugin carries no schema — the settings UI
    then falls back to the generic key/value editor.
    """
    manifest = PluginLoader.get_manifest(slug)
    if not manifest:
        return error_response(f"Plugin '{slug}' not found", 404)
    fields = PluginLoader.get_config_schema(slug)
    return success_response(
        {
            "slug": slug,
            "has_schema": bool(fields),
            "fields": fields,
        }
    )

