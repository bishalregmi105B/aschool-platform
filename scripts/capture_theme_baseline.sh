#!/usr/bin/env bash
# Theme parity baseline capture (roadmap v5 Phase P, D2 §D.4).
#
# Captures the PUBLIC SITE rendered output for 3 schools × 3 viewports into
# frontend/parity-baseline/ and regenerates the backend CSS snapshots.
# Run BEFORE any theme/website change and re-run after: pixel diffs at
# threshold 0 mean the public site did not move.
#
# Prereqs:
#   - backend running (FLASK app on :5000) with 3 seeded demo schools
#   - frontend dev server on :3000 (or set FRONTEND_URL)
#   - npx playwright installed (npx playwright install chromium)
#   - backend venv for the CSS snapshot refresh
#
# Usage:  bash scripts/capture_theme_baseline.sh [--refresh-snapshots]
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
SCHOOLS=("${SCHOOLS:@}" )
if [ ${#SCHOOLS[@]} -eq 0 ]; then
  SCHOOLS=(demo-school sunshine-academy evergreen-vidyalaya)
fi
VIEWPORTS=("375,812" "768,1024" "1440,900")
OUT_DIR="$(dirname "$0")/../frontend/parity-baseline"
mkdir -p "$OUT_DIR"

echo "▶ Capturing ${#SCHOOLS[@]} schools × ${#VIEWPORTS[@]} viewports → $OUT_DIR"

for school in "${SCHOOLS[@]}"; do
  for vp in "${VIEWPORTS[@]}"; do
    w="${vp%,*}"; h="${vp#*,}"
    name="${school}_${w}x${h}"
    node - "$FRONTEND_URL/school/$school" "$w" "$h" "$OUT_DIR/$name.png" <<'NODE'
const { chromium } = require("playwright");
(async () => {
  const [url, w, h, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: parseInt(w, 10), height: parseInt(h, 10) },
  });
  await page.goto(url, { waitUntil: "networkidle" });
  // Fonts settle: force one extra paint after webfonts load.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`  ✓ ${out}`);
})();
NODE
  done
done

if [ "${1:-}" = "--refresh-snapshots" ]; then
  echo "▶ Refreshing backend CSS snapshots"
  (cd ../backend && .venv/bin/python - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0, ".")
from app.services.website.theme_engine import ThemeEngineService as ThemeEngine

snapshot_dir = Path("tests/theme_snapshots")
snapshot_dir.mkdir(exist_ok=True)
for theme in ThemeEngine.list_themes():
    (snapshot_dir / f"{theme['id']}.snap.css").write_text(
        ThemeEngine.generate_css(theme["id"])
    )
    print(f"  ✓ {theme['id']}.snap.css")
PY
  )
fi

echo "▶ Done. Compare after changes with:"
echo "    npx playwright screenshot --full-page <url> new.png"
echo "    compare baseline.png new.png  (threshold 0 — any pixel diff fails)"
