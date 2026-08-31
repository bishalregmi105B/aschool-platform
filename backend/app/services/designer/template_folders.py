"""File-based designer template catalog.

Architecture mirrors the plugin system: the FILESYSTEM is the source of truth
for shipping quality templates; the DB only stores per-school user edits.

    backend/app/templates/designer/<template_key>/
        template.yaml   — metadata: name, category, editor_type, page_size,
                          size, fields (autofill keys), autofill (data-source
                          + defaults), description, thumbnail_emoji, tags
        canvas.json     — fabric.js canvas layout (single or multi-page)
        writer.json     — writer block layout (for editor_type: writer)
        assets/         — images referenced by the layout (relative URLs)

User-level edits (per school) live in the designer_templates DB table exactly
as before: a school that customizes "id_card_standard" gets a DB overlay row;
the file provides the pristine default. list/get merge semantics:

    file default  ←  DB overlay (school-scoped)

Migrating a template from the old in-code registry to a folder is additive:
folders win over registry entries with the same template_key.
"""

import copy
import json
import os
from typing import Any

import yaml

TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "designer",
)

_CACHE: dict[str, dict[str, Any]] | None = None


def _read_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _normalize(meta: dict, folder: str, key: str) -> dict:
    """Folder metadata → the exact template dict shape the engine consumes."""
    size = meta.get("size") or {}
    pages = meta.get("pages")  # multi-page: [{size: {...}, count: n, name: str}]
    if not pages:
        width = int(size.get("width", 794))
        height = int(size.get("height", 1123))
    else:
        first = (pages[0].get("size") or {}) if isinstance(pages, list) else {}
        width = int(first.get("width", 794))
        height = int(first.get("height", 1123))

    canvas_path = os.path.join(folder, "canvas.json")
    writer_path = os.path.join(folder, "writer.json")

    out = {
        "name": meta.get("name", key.replace("_", " ").title()),
        "name_nepali": meta.get("name_nepali"),
        "category": meta.get("category", "reports"),
        "editor_type": meta.get("editor_type", "designer"),
        "description": meta.get("description", ""),
        "page_size": meta.get("page_size", "A4"),
        "thumbnail_emoji": meta.get("thumbnail_emoji", "📄"),
        "is_default": bool(meta.get("is_default", True)),
        "width": width,
        "height": height,
        "fields": meta.get("fields", []),
        "tags": meta.get("tags", []),
        "autofill": meta.get("autofill", {}),
        # files that ship with the template (relative paths served at
        # /api/v1/design-studio/templates/<key>/assets/<file>)
        "assets": sorted(
            f for f in os.listdir(os.path.join(folder, "assets"))
            if os.path.isfile(os.path.join(folder, "assets", f))
        ) if os.path.isdir(os.path.join(folder, "assets")) else [],
        "_folder": folder,
    }
    if os.path.isfile(canvas_path):
        out["canvas_json"] = _read_json(canvas_path)
    if os.path.isfile(writer_path):
        out["writer_json"] = _read_json(writer_path)
    if meta.get("published") is False:
        out["published"] = False
    return out


def scan_template_folders(force: bool = False) -> dict[str, dict[str, Any]]:
    """Scan backend/app/templates/designer/*/ and return {key: template_dict}."""
    global _CACHE
    if _CACHE is not None and not force:
        return _CACHE

    found: dict[str, dict[str, Any]] = {}
    if os.path.isdir(TEMPLATES_DIR):
        for entry in sorted(os.listdir(TEMPLATES_DIR)):
            folder = os.path.join(TEMPLATES_DIR, entry)
            meta_path = os.path.join(folder, "template.yaml")
            if not os.path.isfile(meta_path):
                continue
            try:
                meta = _read_yaml(meta_path)
                key = meta.get("template_key") or entry
                found[key] = _normalize(meta, folder, key)
            except Exception as exc:  # malformed folder must not break startup
                import logging

                logging.getLogger(__name__).warning(
                    "template folder %s failed to load: %s", entry, exc
                )
    _CACHE = found
    return found


def get_folder_template(template_key: str) -> dict | None:
    return scan_template_folders().get(template_key)


def deep_merge(base: dict, overlay: dict) -> dict:
    """Recursively merge overlay onto base (overlay wins). Used to apply
    school DB edits over the file default without dropping new file fields."""
    out = copy.deepcopy(base)
    for k, v in (overlay or {}).items():
        if v is None:
            continue
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def reset_cache() -> None:
    global _CACHE
    _CACHE = None
