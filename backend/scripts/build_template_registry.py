#!/usr/bin/env python3
"""Regenerate the template registry (templates.json) from folder metadata.

The registry at app/templates/designer/templates.json is the single source
of truth for the template list and all details. When you add, remove, or
edit template folders (template.yaml), run this script to refresh it:

    cd backend && python scripts/build_template_registry.py
"""
import importlib.util
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

spec = importlib.util.spec_from_file_location(
    "tf",
    os.path.join(BACKEND_DIR, "app", "services", "designer", "template_folders.py"),
)
tf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tf)

import yaml  # noqa: E402  (module has it; keep local import for clarity)

TEMPLATES_DIR = tf.TEMPLATES_DIR


def _folder_meta(folder: str, entry_name: str) -> dict | None:
    meta_path = os.path.join(folder, "template.yaml")
    if not os.path.isfile(meta_path):
        return None
    with open(meta_path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def main() -> None:
    registry = []
    for entry in sorted(os.listdir(TEMPLATES_DIR)):
        folder = os.path.join(TEMPLATES_DIR, entry)
        if not os.path.isdir(folder):
            continue
        meta = _folder_meta(folder, entry)
        if meta is None:
            continue
        key = meta.get("template_key") or entry
        # Reuse the module's normalizer for the canonical shape, then strip
        # runtime-only fields (canvas/writer JSON loads lazily from folders).
        normalized = tf._normalize(meta, folder, key)
        normalized.pop("_folder", None)
        normalized.pop("canvas_json", None)
        normalized.pop("writer_json", None)
        registry.append({"template_key": key, **normalized})

    out_path = os.path.join(TEMPLATES_DIR, "templates.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(
            {"schema_version": 1, "templates": registry},
            fh,
            ensure_ascii=False,
            indent=2,
        )
    print(f"wrote {out_path} with {len(registry)} templates")


if __name__ == "__main__":
    main()
