"""Plugin per-school config access — dot-path reads over SchoolPlugin.config.

The settings screen (config_schema.yaml + /dashboard/plugins/[slug]/settings)
writes SchoolPlugin.config; these helpers are how real consumers (celery
tasks, AI routes, the website builder) read those values. Always returns the
caller's default when the plugin is not installed or the key is missing —
a config read must never raise into business logic.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_dotted(config: dict | None, dotted_key: str, default=None):
    """Read a (possibly nested) value from a flat-or-nested dict by dot path.

    Supports the nested form the whatsapp_bot ai_settings editor writes
    ({"ai_settings": {"auto_reply_enabled": True}}) as well as flat keys.
    """
    if not isinstance(config, dict) or not dotted_key:
        return default
    node = config
    for part in dotted_key.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node


def get_plugin_config(school_id: str, plugin_slug: str) -> dict:
    """SchoolPlugin.config for (school, slug); {} when absent."""
    try:
        from app.models.plugin import SchoolPlugin

        sp = SchoolPlugin.query.filter_by(
            school_id=str(school_id), plugin_slug=plugin_slug
        ).first()
        return dict(sp.config or {}) if sp and sp.config else {}
    except Exception as e:  # noqa: BLE001 — config reads are best-effort
        logger.warning(
            "plugin_config(%s, %s) read failed: %s", school_id, plugin_slug, e
        )
        return {}


def plugin_config_value(
    school_id: str, plugin_slug: str, dotted_key: str, default=None
):
    """Value of one (possibly nested) plugin-config key, or the default."""
    return get_dotted(
        get_plugin_config(school_id, plugin_slug), dotted_key, default
    )
