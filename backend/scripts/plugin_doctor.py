#!/usr/bin/env python3
"""plugin_doctor — validate every plugin manifest and optionally migrate it.

    python -m scripts.plugin_doctor              # print the findings table
    python -m scripts.plugin_doctor --errors     # errors only (CI-style)
    python -m scripts.plugin_doctor --json       # machine-readable
    python -m scripts.plugin_doctor --fix-safe   # promote clean manifests to v2

`--fix-safe` only touches manifests with zero findings, and only performs the
mechanical v1→v2 renames the compat adapter already applies in memory:

    frontend:            → ui.nav
    flutter:             → mobile
    api_blueprint etc.   → capabilities.*
    (+ schema_version: 2)

It refuses to rewrite a manifest that has any finding, so a broken pointer can
never be frozen into a v2 manifest where it becomes a hard CI failure.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.plugins.validator import (  # noqa: E402
    PluginValidator,
    format_table,
)

POINTER_FIELDS = ("api_blueprint", "models_module", "services", "tasks")


def _to_v2(manifest: dict) -> dict:
    """Mechanical v1 → v2 shape. Pure; the caller decides whether to write."""
    out = dict(manifest)
    if int(out.get("schema_version") or 1) >= 2:
        return out

    caps = dict(out.get("capabilities") or {})
    for field in POINTER_FIELDS:
        if out.get(field) is not None:
            caps.setdefault(field, out.pop(field))
    for legacy in ("blueprint_var", "url_prefix"):
        if out.get(legacy) is not None:
            caps.setdefault(legacy, out.pop(legacy))
    if caps:
        out["capabilities"] = caps

    frontend = out.pop("frontend", None) or {}
    sidebar = frontend.get("sidebar") or {}
    if frontend or sidebar:
        nav = {
            "route": frontend.get("route"),
            "section": sidebar.get("section"),
            "label": sidebar.get("label") or out.get("name"),
            "label_nepali": sidebar.get("label_nepali") or out.get("name_nepali"),
            "icon": sidebar.get("icon") or out.get("icon"),
            "visible_to": sidebar.get("visible_to") or [],
            "subitems": sidebar.get("subitems") or [],
        }
        ui = dict(out.get("ui") or {})
        ui.setdefault("nav", {k: v for k, v in nav.items() if v not in (None, [], {})})
        out["ui"] = ui

    flutter = out.pop("flutter", None) or {}
    if flutter:
        out["mobile"] = {
            role.replace("_app", ""): cfg for role, cfg in flutter.items() if cfg
        }

    out["schema_version"] = 2
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--errors", action="store_true", help="print errors only")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument(
        "--fix-safe",
        action="store_true",
        help="rewrite clean manifests into the v2 shape (skips any with findings)",
    )
    ap.add_argument("--slug", help="restrict --fix-safe to one slug")
    args = ap.parse_args()

    validator = PluginValidator()
    findings = validator.run()
    if args.errors:
        findings = [f for f in findings if f.severity == "error"]

    if args.json:
        print(
            json.dumps(
                [
                    {
                        "severity": f.severity,
                        "slug": f.slug,
                        "file": f.file,
                        "message": f.message,
                    }
                    for f in findings
                ],
                indent=2,
            )
        )
    else:
        print(format_table(findings))
        counts = {
            sev: sum(1 for f in findings if f.severity == sev)
            for sev in ("error", "warning")
        }
        print(
            f"\n{len(validator.manifests)} manifests · "
            f"{counts['error']} errors · {counts['warning']} warnings"
        )

    if args.fix_safe:
        import yaml

        dirty = {f.slug for f in validator.run()}
        written = 0
        for slug, manifest in sorted(validator.manifests.items()):
            if args.slug and slug != args.slug:
                continue
            if slug in dirty:
                print(f"skip {slug}: has findings — fix them first")
                continue
            if int(manifest.get("schema_version") or 1) >= 2:
                continue
            path = validator.paths[slug]
            path.write_text(
                yaml.safe_dump(
                    _to_v2(manifest),
                    sort_keys=False,
                    allow_unicode=True,
                    default_flow_style=False,
                )
            )
            written += 1
            print(f"promoted {slug} → schema_version 2")
        print(f"\n{written} manifest(s) rewritten")

    return 1 if any(f.severity == "error" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
