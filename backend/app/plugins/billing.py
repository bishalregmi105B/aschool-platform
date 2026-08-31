"""
Plugin billing utilities — trial management, usage tracking, pro-rated billing.

Install policy (plugin-architecture batch audits E160-E161, config-controlled
in config.py — note the E160-E169 band was double-allocated; see FIX_STATUS
§14 for the authoritative plugin-batch rows):
- FREE plugin (price_monthly == 0 OR tier in PLUGIN_FREE_TIERS) installs
  instantly with is_trial=False, trial_ends_at=None — "Install" semantics,
  never a trial.
- PAID plugin installs with a PLUGIN_TRIAL_DAYS-day trial (platform config
  supersedes the per-plugin catalog trial_days so policy stays env-controlled).
"""
from datetime import date, datetime, timedelta, timezone

from flask import current_app

from extensions import cache, db
from app.models.plugin import Plugin, PluginUsageLog, SchoolPlugin


def plugin_is_free(plugin: Plugin) -> bool:
    """True when the plugin installs with NO trial and NO payment (E160).

    A plugin is free when its monthly price is zero, it is flagged is_free,
    or its tier category is listed in PLUGIN_FREE_TIERS (default core,add_on).
    """
    cfg = current_app.config
    free_tiers = set(cfg.get("PLUGIN_FREE_TIERS") or ["core", "add_on"])
    if (plugin.category or "").lower() in free_tiers:
        return True
    if plugin.is_free:
        return True
    return float(plugin.price_monthly or 0) == 0


def effective_trial_days(plugin: Plugin) -> int:
    """Trial length for a PAID install (E160) — config PLUGIN_TRIAL_DAYS wins."""
    try:
        configured = int(current_app.config.get("PLUGIN_TRIAL_DAYS", 14))
    except (TypeError, ValueError):
        configured = 14
    if configured <= 0:
        # 0 / negative disables trials entirely: paid installs are not trials
        # and not paid either — treat as immediate unpaid activation.
        return 0
    return configured


def _apply_install_policy(sp: SchoolPlugin, plugin: Plugin) -> None:
    """Stamp a SchoolPlugin row per the config-driven install policy."""
    now = datetime.now(timezone.utc)
    if plugin_is_free(plugin):
        sp.active = True
        sp.is_trial = False
        sp.trial_started_at = None
        sp.trial_ends_at = None
        sp.next_billing_date = None
    else:
        days = effective_trial_days(plugin)
        sp.active = True
        if days <= 0:
            # Trials disabled by config — activate without trial state.
            sp.is_trial = False
            sp.trial_started_at = None
            sp.trial_ends_at = None
            sp.next_billing_date = None
        else:
            sp.is_trial = True
            sp.trial_started_at = now
            sp.trial_ends_at = now + timedelta(days=days)
            sp.next_billing_date = (now + timedelta(days=days)).date()


def install_plugin(school_id: str, plugin_slug: str, billing_cycle: str = "monthly") -> dict:
    """Install a plugin for the current school under the config-driven policy.

    Free plugins (price_monthly == 0 OR tier in PLUGIN_FREE_TIERS) activate
    immediately with no trial; paid plugins start a PLUGIN_TRIAL_DAYS trial.
    Returns dict or {"error": ...}.
    """
    plugin = Plugin.query.filter_by(slug=plugin_slug, is_published=True).first()
    if not plugin:
        return {"error": f"Plugin '{plugin_slug}' not found or not available"}

    # E230: coming-soon plugins are not installable yet (final testing).
    # Checked at the deepest shared entry-point so API installs, seeds and
    # plan grants all refuse consistently; existing install rows are
    # untouched and the plugin's routes remain gated+mounted.
    from app.plugins.loader import PluginLoader

    if (PluginLoader.get_manifest(plugin_slug) or {}).get("coming_soon"):
        return {"error": f"Plugin '{plugin_slug}' is in final testing — releasing soon"}

    existing = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=plugin_slug
    ).first()

    if existing and existing.active:
        return {"error": f"Plugin '{plugin_slug}' is already installed"}

    if existing and not existing.active:
        # Reinstall of a previously uninstalled/deactivated plugin.
        now = datetime.now(timezone.utc)
        if existing.is_trial and existing.trial_ends_at is not None:
            # A trial window already exists on this row — it is NEVER reset by
            # a deactivate/uninstall cycle (restarting the clock on every
            # reinstall would make the trial infinite). Expired trials are
            # refused outright; running trials resume with their remaining
            # days.
            ends = existing.trial_ends_at.replace(tzinfo=timezone.utc)
            if ends < now:
                return {
                    "error": (
                        f"The free trial for '{plugin_slug}' has already been used "
                        "by this school — subscribe to install it again"
                    )
                }
            existing.active = True
            existing.uninstalled_at = None
            existing.billing_cycle = billing_cycle
            db.session.commit()
            _invalidate_plugin_cache(school_id)
            return _sp_dict(existing)
        if not plugin_is_free(plugin) and not existing.is_trial:
            # Previously-paid row (plan-tier grant or a recorded subscription —
            # the payment reference stays in config["last_payment"]). Reinstall
            # restores that row as-is; it must never be silently converted into
            # a fresh trial the school may have already consumed.
            existing.active = True
            existing.uninstalled_at = None
            existing.billing_cycle = billing_cycle
            db.session.commit()
            _invalidate_plugin_cache(school_id)
            return _sp_dict(existing)
        _apply_install_policy(existing, plugin)
        existing.uninstalled_at = None
        existing.billing_cycle = billing_cycle
        db.session.commit()
        _invalidate_plugin_cache(school_id)
        return _sp_dict(existing)

    # Check dependencies
    for dep_slug in (plugin.depends_on or []):
        dep = SchoolPlugin.query.filter_by(
            school_id=school_id, plugin_slug=dep_slug, active=True
        ).first()
        if not dep:
            return {"error": f"Dependency not met: '{dep_slug}' must be installed first"}

    # Check conflicts
    for conflict_slug in (plugin.conflicts_with or []):
        conflict = SchoolPlugin.query.filter_by(
            school_id=school_id, plugin_slug=conflict_slug, active=True
        ).first()
        if conflict:
            return {"error": f"Conflict: '{plugin_slug}' conflicts with installed plugin '{conflict_slug}'"}

    school_plugin = SchoolPlugin(
        school_id=school_id,
        plugin_slug=plugin_slug,
        active=True,
        billing_cycle=billing_cycle,
    )
    _apply_install_policy(school_plugin, plugin)
    db.session.add(school_plugin)

    plugin.install_count = (plugin.install_count or 0) + 1
    db.session.commit()
    _invalidate_plugin_cache(school_id)

    return _sp_dict(school_plugin)


def uninstall_plugin(school_id: str, plugin_slug: str) -> dict:
    """Soft-uninstall a plugin — data is preserved. Returns dict.

    Works on ACTIVE and DEACTIVATED (WP-style disabled) installs alike —
    WordPress allows deleting a deactivated plugin; only a row that was
    already uninstalled (or never installed) is refused.
    """
    sp = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=plugin_slug
    ).first()
    if not sp or sp.uninstalled_at is not None:
        return {"error": f"Plugin '{plugin_slug}' is not installed"}

    sp.active = False
    sp.uninstalled_at = datetime.now(timezone.utc)
    db.session.commit()
    _invalidate_plugin_cache(school_id)

    return {"uninstalled_at": sp.uninstalled_at.isoformat(), "data_preserved": True}


def deactivate_plugin(school_id: str, plugin_slug: str) -> dict:
    """WP-style deactivate — disable the plugin WITHOUT marking it uninstalled.

    Unlike uninstall_plugin this never stamps uninstalled_at, so the install
    row keeps its state (config, trial, billing) and can be re-enabled with
    activate_plugin. Deactivated plugins are excluded from g.installed_plugins
    (active=True filter) so their gated routes immediately 403.
    """
    sp = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=plugin_slug
    ).first()
    if not sp or sp.uninstalled_at is not None:
        return {"error": f"Plugin '{plugin_slug}' is not installed"}
    if not sp.active:
        return {"error": f"Plugin '{plugin_slug}' is already deactivated"}

    sp.active = False
    db.session.commit()
    _invalidate_plugin_cache(school_id)
    return _sp_dict(sp)


def activate_plugin(school_id: str, plugin_slug: str) -> dict:
    """WP-style activate — re-enable a deactivated (NOT uninstalled) plugin."""
    sp = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=plugin_slug
    ).first()
    if not sp or sp.uninstalled_at is not None:
        return {
            "error": f"Plugin '{plugin_slug}' is not installed — install it from the marketplace first"
        }
    if sp.active:
        return {"error": f"Plugin '{plugin_slug}' is already active"}

    sp.active = True
    db.session.commit()
    _invalidate_plugin_cache(school_id)
    return _sp_dict(sp)


def log_usage(school_id: str, plugin_slug: str, action: str, cost: float = 0):
    """Record a usage event for billing."""
    today = date.today()
    log = PluginUsageLog.query.filter_by(
        school_id=school_id,
        plugin_slug=plugin_slug,
        action=action,
        usage_date=today,
    ).first()

    if log:
        log.usage_count += 1
        log.cost += cost
    else:
        log = PluginUsageLog(
            school_id=school_id,
            plugin_slug=plugin_slug,
            action=action,
            usage_count=1,
            usage_date=today,
            cost=cost,
        )
        db.session.add(log)

    db.session.commit()


def _sp_dict(sp: SchoolPlugin) -> dict:
    return {
        "plugin_slug": sp.plugin_slug,
        "active": sp.active,
        "installed_at": sp.installed_at.isoformat() if sp.installed_at else None,
        "is_trial": sp.is_trial,
        "trial_started_at": sp.trial_started_at.isoformat() if sp.trial_started_at else None,
        "trial_ends_at": sp.trial_ends_at.isoformat() if sp.trial_ends_at else None,
        "billing_cycle": sp.billing_cycle,
    }


def _invalidate_plugin_cache(school_id: str):
    cache.delete(f"school:{school_id}:plugins")
