"""Theme parity lock — backend tests (roadmap v5 Phase P).

The public site's rendered design is FIXED (owner decision, v3 §3.5/D2 §D.4).
Before any theme engine change lands, these tests pin the contract:

1. CSS snapshot: generate_css() output is byte-stable per theme — any change
   to the letterhead/site CSS ships only with an explicit snapshot update
   (delete the .snap file, review the diff, re-commit).
2. Registry sync: backend THEMES and frontend themes/registry.ts must agree
   on ids + colors + fonts — the frontend applies variables the backend
   generates; a silent divergence means a school's live site stops matching
   its dashboard preview.

The Playwright visual-diff half of the lock lives in
frontend/__tests__/theme-parity.test.ts + scripts/capture_theme_baseline.py.
"""
import json
from pathlib import Path

import pytest

from app.services.website.theme_engine import ThemeEngineService as ThemeEngine

SNAPSHOT_DIR = Path(__file__).parent / "theme_snapshots"
FRONTEND_REGISTRY = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "themes"
    / "registry.ts"
)


def test_every_theme_generates_stable_css():
    themes = ThemeEngine.list_themes()
    assert len(themes) >= 10  # 10 licensed designs shipped
    for theme in themes:
        css = ThemeEngine.generate_css(theme["id"])
        assert css and ":root" in css
        snapshot = SNAPSHOT_DIR / f"{theme['id']}.snap.css"
        if snapshot.exists():
            assert css == snapshot.read_text(), (
                f"Theme CSS for {theme['id']} changed. The public site's "
                "rendered design is parity-locked: review the diff, then "
                f"regenerate the snapshot ONLY deliberately "
                f"(backend/tests/theme_snapshots/{theme['id']}.snap.css)."
            )
        else:
            snapshot.write_text(css)


def test_css_variables_cover_core_color_keys():
    css = ThemeEngine.generate_css("collegiate-heritage")
    for key in ("--color-primary", "--color-secondary", "--color-accent",
                "--color-bg", "--color-text", "--font-heading", "--font-body"):
        assert key in css, f"{key} missing from generated CSS"


def test_color_overrides_are_sanitized():
    css = ThemeEngine.generate_css(
        "collegiate-heritage",
        {"primary": "#123abc", "evil": "</style><script>alert(1)</script>"},
    )
    assert "#123abc" in css
    assert "script" not in css


def test_backend_and_frontend_registries_agree():
    """Parse the TS registry (no node needed — the literals are plain) and
    compare id/color/font tuples with the backend THEMES table."""
    src = FRONTEND_REGISTRY.read_text()

    def _extract(entry_src: str, field: str):
        import re

        match = re.search(rf"{field}:\s*(\{{[^}}]*\}})", entry_src, re.DOTALL)
        return match.group(1) if match else None

    # Split the array on top-level `{ id:` entries.
    entries = src.split("{\n    //")[1:]
    frontend = {}
    for entry in entries:
        import re

        id_match = re.search(r'id:\s*"([a-z0-9-]+)"', entry)
        if not id_match:
            continue
        tid = id_match.group(1)
        colors_src = _extract(entry, "colors")
        fonts_src = _extract(entry, "fonts")
        frontend[tid] = {
            "colors": dict(re.findall(r'(\w+):\s*"(#[0-9a-fA-F]{3,8})"', colors_src or "")),
            "fonts": dict(re.findall(r'(\w+):\s*"([^"]+)"', fonts_src or "")),
        }

    backend = {
        theme["id"]: {
            "colors": theme["colors"],
            "fonts": theme["fonts"],
        }
        for theme in ThemeEngine.list_themes()
    }

    missing = set(backend) - set(frontend)
    extra = set(frontend) - set(backend)
    assert not missing, f"themes missing from frontend registry: {sorted(missing)}"
    assert not extra, f"themes in frontend registry but not backend: {sorted(extra)}"

    for tid, backend_theme in backend.items():
        assert frontend[tid]["colors"] == backend_theme["colors"], (
            f"{tid}: color mismatch between backend theme_engine and "
            f"frontend/themes/registry.ts — the live site would render "
            f"different colors than the dashboard preview"
        )
        assert frontend[tid]["fonts"] == backend_theme["fonts"], (
            f"{tid}: font mismatch between registries"
        )
