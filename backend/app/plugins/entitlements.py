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

from datetime import datetime, timezone

from extensions import db
from app.models.plugin import Plugin, SchoolPlugin

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
