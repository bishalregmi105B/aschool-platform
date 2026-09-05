"""Plugin widget contract — load, validate, filter and serve `widgets.yaml`.

A plugin contributes UI by declaring data, not by shipping executable frontend
code the host evaluates. Each widget is a record naming:

  * a `type` the host has a generic renderer for (`stat-group`, `table-panel`,
    `chart`, …) plus a `spec:` body, **or** `renderer: component` naming a token
    in a compile-time frontend registry (the escape hatch for canvas/map/editor
    UI that no declarative dialect should try to express);
  * one or more host-owned `slots` it asks to appear in;
  * a `data:` source, which for `source: api` must be a GET route belonging to
    the declaring plugin.

Gating is server-side and absolute: `GET /plugins/widgets` omits widgets whose
plugin is not installed+active for the school, whose role does not match, or
whose surface was not requested. A hidden widget is ABSENT from the payload, not
CSS-hidden in the client.

Binding tokens (`$today`, `$context.student_id`, `$.data.present`) are resolved
by the client at render time; this module only checks that a widget is
structurally legal and allowed.
"""

from __future__ import annotations

import logging
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

# Cache: slug -> parsed widget list. The filesystem is the source of truth and
# manifests are scanned at boot, so an in-process dict is the right lifetime;
# `reset_cache()` exists for refresh-registry and tests.
_WIDGET_CACHE: dict[str, list[dict]] = {}


def reset_cache() -> None:
    _WIDGET_CACHE.clear()


def _widget_file(slug: str) -> Path | None:
    """Path to a plugin's widgets.yaml, honouring `ui.widgets_ref`."""
    from app.plugins.loader import PluginLoader

    folder = PluginLoader.get_module_dir(slug)
    if folder is None:
        return None
    manifest = PluginLoader.get_manifest(slug) or {}
    ref = (manifest.get("ui") or {}).get("widgets_ref") or manifest.get("widgets_ref")
    candidate = folder / str(ref) if ref else folder / "widgets.yaml"
    return candidate if candidate.exists() else None


def load_plugin_widgets(slug: str) -> list[dict]:
    """Parsed widget records for one plugin ([] when it declares none).

    Parse failures are logged and yield [] — a malformed widgets.yaml must
    never take the dashboard down. The contract test (`test_plugin_contract`)
    is what turns a malformed file into a build failure.
    """
    if slug in _WIDGET_CACHE:
        return _WIDGET_CACHE[slug]

    path = _widget_file(slug)
    if path is None:
        _WIDGET_CACHE[slug] = []
        return []

    try:
        doc = yaml.safe_load(path.read_text()) or {}
    except (OSError, yaml.YAMLError) as e:
        logger.error("Plugin %s: widgets.yaml failed to load: %s", slug, e)
        _WIDGET_CACHE[slug] = []
        return []

    raw = doc.get("widgets") if isinstance(doc, dict) else None
    if not isinstance(raw, list):
        logger.error("Plugin %s: widgets.yaml has no `widgets:` list", slug)
        _WIDGET_CACHE[slug] = []
        return []

    widgets: list[dict] = []
    for entry in raw:
        if not isinstance(entry, dict) or not entry.get("key"):
            continue
        widgets.append(_normalize_widget(slug, entry))
    _WIDGET_CACHE[slug] = widgets
    return widgets


def _normalize_widget(slug: str, entry: dict) -> dict:
    """Fill defaults and canonicalize the shorthand forms authors use."""
    slots = entry.get("slots") or []
    if isinstance(slots, dict):
        slots = [slots]
    normalized_slots = []
    for slot in slots:
        if isinstance(slot, str):
            normalized_slots.append({"id": slot, "default": False, "order": 100})
        elif isinstance(slot, dict) and slot.get("id"):
            normalized_slots.append(
                {
                    "id": slot["id"],
                    "default": bool(slot.get("default")),
                    "order": int(slot.get("order") or 100),
                    "params_from": slot.get("params_from") or {},
                }
            )

    size = entry.get("size") or {}
    default_size = size.get("default") or {"w": 6, "h": 2}

    return {
        "id": f"{slug}.{entry['key']}",
        "plugin_slug": slug,
        "key": entry["key"],
        "title": entry.get("title") or entry["key"].replace("_", " ").title(),
        "title_i18n": entry.get("title_i18n"),
        "description": entry.get("description") or "",
        "type": entry.get("type"),
        "renderer": entry.get("renderer") or "spec",
        "component": entry.get("component"),
        "surfaces": entry.get("surfaces") or ["web"],
        "slots": normalized_slots,
        "roles": entry.get("roles") or [],
        "requires_permissions": entry.get("requires_permissions") or [],
        "requires_plugins": entry.get("requires_plugins") or [],
        "size": {
            "default": default_size,
            "min": size.get("min") or default_size,
            "breakpoints": size.get("breakpoints") or {},
        },
        "data": entry.get("data") or {},
        "spec": entry.get("spec") or {},
        "config_schema": entry.get("config_schema") or {},
        "states": entry.get("states") or {},
        "telemetry": entry.get("telemetry") or {},
        "section_type": entry.get("section_type"),
    }


def all_widgets() -> list[dict]:
    """Every widget declared by every scanned plugin (ungated)."""
    from app.plugins.loader import PluginLoader

    out: list[dict] = []
    for slug in PluginLoader.get_all_manifests():
        out.extend(load_plugin_widgets(slug))
    return out


def widgets_for(
    installed_slugs: list[str],
    role: str,
    surface: str = "web",
    slot: str | None = None,
    permissions: set[str] | None = None,
) -> list[dict]:
    """The widgets a specific caller is allowed to render, slot-ordered.

    Filters, in order: plugin installed+active (alias-aware, matching
    `@plugin_required`), soft `requires_plugins`, surface, slot, role, and
    permissions when the caller supplies a permission set.
    """
    from app.plugins.decorators import _acceptable_plugin_slugs
    from app.plugins.loader import PluginLoader

    installed = {str(s) for s in installed_slugs}
    allowed: list[dict] = []

    for slug in PluginLoader.get_all_manifests():
        if not (_acceptable_plugin_slugs(slug) & installed):
            continue
        manifest = PluginLoader.get_manifest(slug) or {}
        if manifest.get("deprecated") or manifest.get("coming_soon"):
            continue
        for widget in load_plugin_widgets(slug):
            if surface not in widget["surfaces"]:
                continue
            if widget["roles"] and role not in widget["roles"]:
                continue
            missing_dep = [
                dep
                for dep in widget["requires_plugins"]
                if not (_acceptable_plugin_slugs(dep) & installed)
            ]
            if missing_dep:
                continue
            if permissions is not None and widget["requires_permissions"]:
                if not set(widget["requires_permissions"]).issubset(permissions):
                    continue
            slot_ids = [s["id"] for s in widget["slots"]]
            if slot and slot not in slot_ids:
                continue
            allowed.append(widget)

    def _order(w: dict) -> tuple[int, str]:
        if slot:
            for s in w["slots"]:
                if s["id"] == slot:
                    return (s["order"], w["id"])
        return (min((s["order"] for s in w["slots"]), default=100), w["id"])

    allowed.sort(key=_order)
    return allowed


def default_layout(widgets: list[dict], slot: str) -> list[str]:
    """Widget ids a fresh dashboard shows for a slot (`default: true`)."""
    ids = []
    for w in widgets:
        for s in w["slots"]:
            if s["id"] == slot and s["default"]:
                ids.append(w["id"])
    return ids
