"""Plan entitlements — single source of truth for plan tier → plugin access.

School.plan (free/starter/growth/enterprise) maps to cumulative plugin tier
categories (Plugin.category enum: core, starter, growth, premium, add_on):

    free        → core, add_on
    starter     → core, add_on, starter
    growth      → core, add_on, starter, growth
    enterprise  → core, add_on, starter, growth, premium

Plugins granted through a plan are real entitlements (is_trial=False,
trial_ends_at=None) — the school pays for the plan, not per-plugin trials.
No trial rows are ever created at signup, and a free-plan school never
receives a paid plugin from this module.

Also hosts the server-side School.max_students enforcement helpers
(NULL/0 cap = unlimited) used by the student create/bulk-import paths.
"""

import logging
import uuid
from datetime import datetime, timezone

from extensions import db
from app.models.plugin import Plugin, SchoolPlugin

logger = logging.getLogger(__name__)

# ── Plan → plugin tier categories (cumulative) ────────────────────────────────

PLAN_PLUGIN_TIERS: dict[str, list[str]] = {
    "free": ["core", "add_on"],
    "starter": ["core", "add_on", "starter"],
    "growth": ["core", "add_on", "starter", "growth"],
    "enterprise": ["core", "add_on", "starter", "growth", "premium"],
}

# "premium" is accepted as an alias of the top tier (enterprise).
PLAN_ALIASES: dict[str, str] = {
    "premium": "enterprise",
}

DEFAULT_PLAN = "free"


def normalize_plan(plan: str | None) -> str:
    """Map arbitrary plan input to a valid School.plan value."""
    key = (plan or "").strip().lower()
    key = PLAN_ALIASES.get(key, key)
    return key if key in PLAN_PLUGIN_TIERS else DEFAULT_PLAN


def plan_tiers(plan: str | None) -> list[str]:
    """Return the plugin tier categories included in the plan."""
    return PLAN_PLUGIN_TIERS[normalize_plan(plan)]


def plan_plugin_slugs(plan: str | None) -> list[str]:
    """Slugs of published catalog plugins the plan is entitled to, tier-ordered."""
    tiers = plan_tiers(plan)
    plugins = (
        Plugin.query.filter(Plugin.category.in_(tiers), Plugin.is_published.is_(True))
        .order_by(
            db.case(
                {tier: idx for idx, tier in enumerate(tiers)},
                value=Plugin.category,
                else_=len(tiers),
            ),
            Plugin.slug,
        )
        .all()
    )
    return [p.slug for p in plugins]


def grant_plan_plugins(school_id: str, plan: str | None) -> list[dict]:
    """Install every catalog plugin the plan entitles, as paid (non-trial) grants.

    Idempotent: active installs are left untouched; inactive rows are
    reactivated as paid grants. No trial rows are created — schools on paid
    plans hold plan-level entitlements, and free schools only ever receive
    free-tier (core/add_on) plugins. Returns the list of grant dicts.
    """
    granted: list[dict] = []
    for slug in plan_plugin_slugs(plan):
        sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=slug).first()
        if sp and sp.active:
            continue  # already installed (possibly a real purchase) — do not clobber
        if sp:
            sp.active = True
            sp.uninstalled_at = None
            sp.is_trial = False
            sp.trial_started_at = None
            sp.trial_ends_at = None
            sp.next_billing_date = None
        else:
            sp = SchoolPlugin(
                school_id=school_id,
                plugin_slug=slug,
                active=True,
                billing_cycle="monthly",
                is_trial=False,
                trial_started_at=None,
                trial_ends_at=None,
                next_billing_date=None,
            )
            db.session.add(sp)
        granted.append(
            {
                "plugin_slug": slug,
                "is_trial": sp.is_trial,
                "trial_ends_at": None,
            }
        )

    if granted:
        db.session.commit()
        _invalidate_plugin_cache(school_id)
    return granted


def ensure_free_plugins(school, plan: str | None = None) -> list[dict]:
    """Idempotently install every plan-tier plugin for a school (auto-provisioning).

    For every catalog plugin whose tier category falls inside the school's
    plan tier set (free → core+add_on; starter/growth/enterprise are the
    cumulative sets — see PLAN_PLUGIN_TIERS) that has NO SchoolPlugin row
    yet, create one ACTIVE row as a plan entitlement: is_trial=False,
    trial_ends_at=None, next_billing_date=None — never a trial row (the
    school pays for the plan, not per-plugin trials).

    Existing rows are NEVER touched: an admin's deactivated/uninstalled
    choice and any stored config are preserved. Soft-deleted rows are
    resurrected instead of re-inserted (the (school_id, plugin_slug) unique
    constraint would reject a duplicate).

    Catalog visibility matches the marketplace exactly: the REGISTRY
    (PluginLoader manifests) is the source of truth, merged with the
    `plugins` mirror rows under the same delisting rule as
    api/v1/plugins._catalog_entries(); coming-soon and deprecated slugs are
    never auto-granted (install_plugin refuses coming-soon installs too).

    Cheap + idempotent: at most 2-3 queries (mirror rows, existing install
    rows, School.plan when the caller did not supply it) and a bulk insert
    of ONLY the missing rows; a fast no-op once the school is fully
    provisioned. Intended call sites: school creation (auth register,
    superadmin school create) and lazily from the marketplace / installed
    plugins list endpoints so pre-existing schools self-heal on first load.

    Returns the list of grant dicts ({plugin_slug, is_trial, trial_ends_at})
    for rows created (or resurrected) by this call.
    """
    from app.plugins.loader import PluginLoader

    # Accept a School instance OR a bare school_id (str/UUID).
    if hasattr(school, "id"):
        raw_id = school.id
        if plan is None and hasattr(school, "plan"):
            plan = getattr(school, "plan", None)
    else:
        raw_id = school
    try:
        school_uuid = raw_id if isinstance(raw_id, uuid.UUID) else uuid.UUID(str(raw_id))
    except (TypeError, ValueError, AttributeError):
        logger.warning("ensure_free_plugins: invalid school identifier %r", school)
        return []
    if plan is None:
        plan = school_plan(school_uuid)  # 1 extra query only when plan unsupplied
    tiers = plan_tiers(plan)

    # 1. Entitled slugs — same visibility rule as the marketplace catalog:
    #    a manifest entry is offered unless BOTH the manifest and the mirror
    #    row agree it is delisted; published mirror rows without a manifest
    #    are offered as fallbacks. One query for all mirror rows.
    manifests = PluginLoader.get_all_manifests()
    mirror_by_slug: dict[str, Plugin] = {
        p.slug: p for p in Plugin.query.filter(Plugin.is_deleted.is_(False)).all()
    }

    entitled: set[str] = set()
    for slug, m in manifests.items():
        category = str(m.get("category") or "core")
        if category not in tiers:
            continue
        # E230: coming-soon (final testing) and deprecated (legacy alias of a
        # canonical successor) plugins are never auto-granted — installing a
        # deprecated alias would double up sidebar entries beside the canon.
        if m.get("coming_soon") or m.get("deprecated"):
            continue
        if m.get("published") is False:
            row = mirror_by_slug.get(slug)
            if not (row and row.is_published):
                continue  # delisted by manifest and the mirror agrees
        entitled.add(slug)
    for slug, row in mirror_by_slug.items():
        if (
            slug not in manifests
            and row.is_published
            and (row.category or "") in tiers
        ):
            entitled.add(slug)  # mirror-only fallback the catalog still shows

    if not entitled:
        return []

    # 2. Existing install rows for this school (ANY state) — one query.
    existing = SchoolPlugin.query.filter(
        SchoolPlugin.school_id == school_uuid,
        SchoolPlugin.plugin_slug.in_(entitled),
    ).all()
    by_slug = {sp.plugin_slug: sp for sp in existing}

    granted: list[dict] = []
    for slug in sorted(entitled):
        sp = by_slug.get(slug)
        if sp is None:
            db.session.add(
                SchoolPlugin(
                    school_id=school_uuid,
                    plugin_slug=slug,
                    active=True,
                    billing_cycle="monthly",
                    is_trial=False,
                    trial_started_at=None,
                    trial_ends_at=None,
                    next_billing_date=None,
                )
            )
        elif sp.is_deleted:
            # Resurrect rather than re-insert (unique constraint); config kept.
            sp.is_deleted = False
            sp.active = True
            sp.uninstalled_at = None
            sp.is_trial = False
            sp.trial_started_at = None
            sp.trial_ends_at = None
            sp.next_billing_date = None
        else:
            # Already installed (active, deactivated, or uninstalled) —
            # leave the row exactly as the school's admins left it.
            continue
        granted.append(
            {"plugin_slug": slug, "is_trial": False, "trial_ends_at": None}
        )

    if not granted:
        return []

    try:
        db.session.commit()
    except Exception as e:  # noqa: BLE001 — a concurrent install racing the
        # unique constraint must never 500 the page that triggered backfill;
        # the school ends up fully provisioned either way.
        db.session.rollback()
        logger.warning(
            "ensure_free_plugins: commit failed for school=%s (concurrent "
            "install?): %s", school_uuid, e,
        )
        return []
    _invalidate_plugin_cache(str(school_uuid))
    return granted


def is_plan_core_plugin(plugin_or_category: "Plugin | str") -> bool:
    """True when the plugin's tier is 'core' — the school's base toolset.

    Deactivating/uninstalling a core plugin would break the school's
    dashboard, sidebar and base flows, so the plugins API refuses it (see
    plugins.py deactivate/uninstall guards). 'add_on' and the paid tiers
    stay freely manageable by the school's admins.
    """
    if isinstance(plugin_or_category, str):
        return (plugin_or_category or "").lower() == "core"
    return ((getattr(plugin_or_category, "category", None) or "") == "core")


def school_plan(school_id) -> str:
    """Effective plan of a school (normalized)."""
    from app.models.school import School

    school = School.query.get(school_id)
    return normalize_plan(getattr(school, "plan", None))


# ── School.max_students enforcement (E2) ─────────────────────────────────────


class StudentCapExceededError(Exception):
    """Raised when an enrollment would exceed the school's max_students cap."""


def count_active_students(school_id) -> int:
    """Count non-deleted (active) student records for a school."""
    from app.models.student import Student

    return Student.query.filter(
        Student.school_id == school_id, Student.is_deleted.is_(False)
    ).count()


def get_max_students(school_id) -> int | None:
    """Effective max_students cap for a school; None means unlimited."""
    from app.models.school import School

    school = School.query.get(school_id)
    if not school:
        return None
    cap = getattr(school, "max_students", None)
    if cap is None or cap <= 0:
        return None  # NULL / 0 = unlimited
    return int(cap)


def student_cap_error(school_id, incoming_count: int = 1, active_count: int | None = None) -> str | None:
    """Return a human-readable violation message, or None if within the cap.

    `active_count` can be precomputed by bulk callers to avoid repeated COUNTs.
    """
    cap = get_max_students(school_id)
    if cap is None:
        return None
    current = count_active_students(school_id) if active_count is None else active_count
    if current + max(0, incoming_count) > cap:
        return (
            f"Student limit reached: this school's plan allows {cap} students "
            f"and {current} are already enrolled "
            f"({incoming_count} more requested). Upgrade the plan or raise "
            f"max_students to add more."
        )
    return None


def assert_student_cap(school_id, incoming_count: int = 1, active_count: int | None = None) -> None:
    """Raise StudentCapExceededError if the enrollment would exceed the cap."""
    message = student_cap_error(school_id, incoming_count, active_count)
    if message:
        raise StudentCapExceededError(message)


def _invalidate_plugin_cache(school_id: str):
    """Keep in sync with billing.py — request gate reads a 300s cached list."""
    from extensions import cache

    cache.delete(f"school:{school_id}:plugins")
