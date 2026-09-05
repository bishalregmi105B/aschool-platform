#!/usr/bin/env python3
"""Theme parity lock — Playwright baseline capture + visual diff (v5 Phase P).

The public site's rendered design is FIXED. This script:

  capture   — screenshots the rendered school sites (3 schools × 3 viewports)
              into backend/tests/theme_baselines/ and writes a manifest with
              content hashes. Run it ONCE to pin today's approved design;
              re-run only after a deliberately reviewed design change.

  compare   — re-screenshots and byte-compares against the baseline. Any
              difference fails with a diff path. Threshold 0: not "close
              enough" — the rendered design must not change.

Usage:
  python scripts/capture_theme_baseline.py capture --base-url https://app.example.com \
      --schools school-a,school-b,school-c
  python scripts/capture_theme_baseline.py compare --base-url https://app.example.com \
      --schools school-a,school-b,school-c

In CI, `compare` runs after deploy previews; locally it needs a running
stack. The pytest + jest halves of the lock (CSS snapshots + registry sync)
run everywhere without a browser.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

BASELINES = Path(__file__).resolve().parent.parent / "tests" / "theme_baselines"
VIEWPORTS = [(375, 812, "mobile"), (768, 1024, "tablet"), (1440, 900, "desktop")]


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _shoot(base_url: str, slug: str, out_dir: Path) -> dict:
    """Screenshot one school's live site at all viewports via Playwright."""
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict] = {}
    script = f"""
const playwright = require('playwright');
(async () => {{
  const browser = await playwright.chromium.launch();
  for (const [w, h, name] of {json.dumps([v[:2] for v in VIEWPORTS])}) {{
    const page = await browser.newPage({{ viewport: {{ width: w, height: h }} }});
    await page.goto('{base_url}/school/{slug}', {{ waitUntil: 'networkidle', timeout: 60000 }});
    await page.waitForTimeout(800);  // web fonts settle
    await page.screenshot({{ path: '{out_dir}/{slug}-' + name + '.png', fullPage: true }});
    await page.close();
  }}
  await browser.close();
}})();
"""
    result = subprocess.run(
        [sys.executable, "-m", "node", "-e", script]
        if False
        else ["node", "-e", script],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).resolve().parent.parent.parent / "frontend"),
        timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(f"playwright capture failed: {result.stderr[-400:]}")
    for _, _, name in VIEWPORTS:
        png = out_dir / f"{slug}-{name}.png"
        manifest[f"{slug}/{name}"] = {
            "sha256": _hash(png),
            "bytes": png.stat().st_size,
        }
    return manifest


def cmd_capture(args) -> int:
    schools = [s.strip() for s in args.schools.split(",") if s.strip()]
    all_manifest: dict = {"captured": str(date.today()), "shots": {}}
    for slug in schools:
        print(f"capturing {slug} …")
        all_manifest["shots"].update(
            _shoot(args.base_url, slug, BASELINES)
        )
    BASELINES.mkdir(parents=True, exist_ok=True)
    (BASELINES / "manifest.json").write_text(
        json.dumps(all_manifest, indent=2, sort_keys=True)
    )
    print(f"baseline pinned: {len(all_manifest['shots'])} shots in {BASELINES}")
    return 0


def cmd_compare(args) -> int:
    manifest_path = BASELINES / "manifest.json"
    if not manifest_path.exists():
        print("no baseline captured yet — run `capture` first", file=sys.stderr)
        return 2
    expected = json.loads(manifest_path.read_text())["shots"]
    tmp = BASELINES / "_candidate"
    failures = []
    for slug in [s.strip() for s in args.schools.split(",") if s.strip()]:
        actual = _shoot(args.base_url, slug, tmp)
        for key, meta in actual.items():
            if key not in expected:
                failures.append(f"{key}: no baseline shot")
            elif meta["sha256"] != expected[key]["sha256"]:
                failures.append(
                    f"{key}: RENDERED DESIGN CHANGED "
                    f"(baseline {expected[key]['sha256'][:12]} vs now "
                    f"{meta['sha256'][:12]}; diff shots in {tmp})"
                )
    if failures:
        print("PARITY LOCK VIOLATED — the public site's design is fixed:")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print(f"parity lock holds: {len(expected)} shots identical")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in ("capture", "compare"):
        p = sub.add_parser(name)
        p.add_argument("--base-url", required=True)
        p.add_argument(
            "--schools",
            default="school-a,school-b,school-c",
            help="comma-separated school slugs (3 minimum per the lock)",
        )
    args = parser.parse_args()
    if args.cmd == "capture":
        return cmd_capture(args)
    return cmd_compare(args)


if __name__ == "__main__":
    sys.exit(main())
