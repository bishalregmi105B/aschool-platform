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
import threading
import time
from typing import Any

import yaml

TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "designer",
)

REGISTRY_PATH = os.path.join(TEMPLATES_DIR, "templates.json")

_CACHE: dict[str, dict[str, Any]] | None = None

# ── Registry auto-sync ───────────────────────────────────────────────────────
# templates.json is the listing source of truth; the FOLDERS remain the
# authoring source. The registry rebuilds itself automatically at startup
# and on a background interval whenever folder content changes — no manual
# script run needed (scripts/build_template_registry.py stays as a fallback).

REGISTRY_SYNC_INTERVAL_SECONDS = 300
_last_sync_check = 0.0
_sync_lock = threading.Lock()
_registry_watchdog_started = threading.Event()


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


REGISTRY_PATH = os.path.join(TEMPLATES_DIR, "templates.json")


def _load_registry() -> list[dict]:
    """Read the master template registry (templates.json)."""
    with open(REGISTRY_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("templates", [])


def scan_template_folders(force: bool = False) -> dict[str, dict[str, Any]]:
    """Templates from the REGISTRY (templates.json) — the single source of
    truth for the template list and all metadata. Each entry's folder still
    supplies its canvas.json / writer.json / assets, loaded here.

    Folders without a registry entry are NOT listed (add them to
    templates.json — or run scripts/build_template_registry.py to
    regenerate the registry from folder template.yaml files)."""
    global _CACHE
    if _CACHE is not None and not force:
        return _CACHE

    import logging

    logger = logging.getLogger(__name__)
    found: dict[str, dict[str, Any]] = {}
    try:
        entries = _load_registry()
    except Exception as exc:
        logger.warning("templates.json unreadable (%s); no file templates", exc)
        _CACHE = found
        return found

    for entry in entries:
        key = entry.get("template_key") or entry.get("id")
        if not key:
            continue
        folder = os.path.join(TEMPLATES_DIR, key)
        if not os.path.isdir(folder):
            logger.warning("registry entry %s has no folder; skipped", key)
            continue
        meta = dict(entry)
        meta["_folder"] = folder
        canvas_path = os.path.join(folder, "canvas.json")
        writer_path = os.path.join(folder, "writer.json")
        try:
            if os.path.isfile(canvas_path):
                meta.setdefault("canvas_json", _read_json(canvas_path))
            if os.path.isfile(writer_path):
                meta.setdefault("writer_json", _read_json(writer_path))
        except Exception as exc:
            logger.warning("template %s content failed to load: %s", key, exc)
        found[key] = meta
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


# ── Registry auto-sync implementation ───────────────────────────────────────

def _folder_latest_mtime() -> float:
    """Newest mtime across template folders' metadata/content files."""
    latest = 0.0
    if not os.path.isdir(TEMPLATES_DIR):
        return latest
    for entry in os.listdir(TEMPLATES_DIR):
        folder = os.path.join(TEMPLATES_DIR, entry)
        if not os.path.isdir(folder):
            continue
        for name in ("template.yaml", "canvas.json", "writer.json"):
            path = os.path.join(folder, name)
            if os.path.isfile(path):
                try:
                    latest = max(latest, os.path.getmtime(path))
                except OSError:
                    continue
    return latest


def build_registry_from_folders() -> list[dict]:
    """Rebuild registry entries from folder template.yaml metadata."""
    entries: list[dict] = []
    for entry in sorted(os.listdir(TEMPLATES_DIR)):
        folder = os.path.join(TEMPLATES_DIR, entry)
        if not os.path.isdir(folder):
            continue
        meta_path = os.path.join(folder, "template.yaml")
        if not os.path.isfile(meta_path):
            continue
        try:
            meta = _read_yaml(meta_path)
            key = meta.get("template_key") or entry
            normalized = _normalize(meta, folder, key)
            normalized.pop("_folder", None)
            normalized.pop("canvas_json", None)
            normalized.pop("writer_json", None)
            entries.append({"template_key": key, **normalized})
        except Exception as exc:
            import logging

            logging.getLogger(__name__).warning(
                "registry sync: template folder %s failed: %s", entry, exc
            )
    return entries


def sync_registry(force: bool = False) -> bool:
    """Rebuild templates.json from folder metadata when folders changed.

    Runs at most once per REGISTRY_SYNC_INTERVAL_SECONDS unless forced.
    Returns True when the registry file was rewritten (cache reset)."""
    global _last_sync_check

    with _sync_lock:
        now = time.monotonic()
        if not force and (now - _last_sync_check) < REGISTRY_SYNC_INTERVAL_SECONDS:
            return False
        _last_sync_check = now

    try:
        # Cheap change detection: registry older than any folder file.
        if not force and os.path.isfile(REGISTRY_PATH):
            if os.path.getmtime(REGISTRY_PATH) >= _folder_latest_mtime():
                return False

        entries = build_registry_from_folders()
        payload = {"schema_version": 1, "templates": entries}
        existing = None
        if os.path.isfile(REGISTRY_PATH):
            try:
                with open(REGISTRY_PATH, "r", encoding="utf-8") as fh:
                    existing = json.load(fh)
            except Exception:
                existing = None

        if existing == payload:
            # Content unchanged — touch nothing, just refresh the stamp so
            # the mtime check stays cheap.
            os.utime(REGISTRY_PATH)
            return False

        with open(REGISTRY_PATH, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        reset_cache()
        import logging

        logging.getLogger(__name__).info(
            "template registry auto-synced: %d templates", len(entries)
        )
        return True
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning("registry sync failed: %s", exc)
        return False


def _registry_watchdog() -> None:
    while True:
        time.sleep(REGISTRY_SYNC_INTERVAL_SECONDS)
        sync_registry()


def start_registry_watchdog() -> None:
    """Start the background auto-sync thread (idempotent, daemon)."""
    if not _registry_watchdog_started.is_set():
        _registry_watchdog_started.set()
        threading.Thread(
            target=_registry_watchdog, name="template-registry-watchdog", daemon=True
        ).start()
