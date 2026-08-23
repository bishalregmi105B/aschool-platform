"""
Plugin billing utilities — trial management, usage tracking, pro-rated billing.
"""
from datetime import date, datetime, timedelta, timezone

from extensions import cache, db
from app.models.plugin import Plugin, PluginUsageLog, SchoolPlugin


def install_plugin(school_id: str, plugin_slug: str, billing_cycle: str = "monthly") -> dict:
    """Install a plugin for a school with a free trial. Returns dict."""
    plugin = Plugin.query.filter_by(slug=plugin_slug, is_published=True).first()
    if not plugin:
        return {"error": f"Plugin '{plugin_slug}' not found or not available"}

    existing = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=plugin_slug
    ).first()

    if existing and existing.active:
        return {"error": f"Plugin '{plugin_slug}' is already installed"}

    if existing and not existing.active:
        existing.active = True
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

    trial_days = plugin.trial_days or 14
    now = datetime.now(timezone.utc)

    school_plugin = SchoolPlugin(
        school_id=school_id,
        plugin_slug=plugin_slug,
        active=True,
        billing_cycle=billing_cycle,
        is_trial=not plugin.is_free,
        trial_started_at=now if not plugin.is_free else None,
        trial_ends_at=(now + timedelta(days=trial_days)) if not plugin.is_free else None,
        next_billing_date=(now + timedelta(days=trial_days)).date() if not plugin.is_free else None,
    )
    db.session.add(school_plugin)

    plugin.install_count = (plugin.install_count or 0) + 1
    db.session.commit()
    _invalidate_plugin_cache(school_id)

    return _sp_dict(school_plugin)


def uninstall_plugin(school_id: str, plugin_slug: str) -> dict:
    """Soft-uninstall a plugin — data is preserved. Returns dict."""
    sp = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=plugin_slug, active=True
    ).first()
    if not sp:
        return {"error": f"Plugin '{plugin_slug}' is not installed"}

    sp.active = False
    sp.uninstalled_at = datetime.now(timezone.utc)
    db.session.commit()
    _invalidate_plugin_cache(school_id)

    return {"uninstalled_at": sp.uninstalled_at.isoformat(), "data_preserved": True}


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
