/**
 * Theme parity lock — frontend half (roadmap v5 Phase P).
 *
 * The public site's rendered design is FIXED. These tests pin the frontend
 * side of the contract:
 *  1. The registry supplies all 10 licensed themes with safe hex colors;
 *  2. The CSS the site injects only uses variables derived from the registry
 *     (no hardcoded palette drift in the layout).
 *
 * The byte-level CSS snapshot half lives backend-side
 * (backend/tests/test_theme_parity.py); the Playwright visual-diff capture
 * lives in scripts/capture_theme_baseline.py.
 */
import { readFileSync } from "fs";
import { join } from "path";

const THEMES_DIR = join(__dirname, "..", "themes");
const LAYOUT = join(__dirname, "..", "app", "school", "[slug]", "layout.tsx");

const SAFE_HEX = /^#[0-9a-fA-F]{3,8}$/;

function loadRegistry(): Array<{ id: string; entry: string }> {
  const src = readFileSync(join(THEMES_DIR, "registry.ts"), "utf-8");
  const ids = [...src.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  return ids.map((id) => {
    const entryStart = src.indexOf(`id: "${id}"`);
    const entryEnd = src.indexOf('id: "', entryStart + 10);
    return {
      id,
      entry: src.slice(entryStart, entryEnd === -1 ? src.length : entryEnd),
    };
  });
}

describe("theme registry (public site contract)", () => {
  const themes = loadRegistry();

  it("ships at least the 10 licensed designs", () => {
    expect(themes.length >= 10).toBe(true);
  });

  it("every theme has the 5 core colors, all safe hex", () => {
    const problems: string[] = [];
    for (const theme of themes) {
      for (const key of ["primary", "secondary", "accent", "bg", "text"]) {
        const match = theme.entry.match(
          new RegExp(`${key}:\\s*"(#[0-9a-fA-F]{3,8})"`)
        );
        if (!match) problems.push(`${theme.id}: ${key} missing or not hex`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("every theme has heading + body fonts", () => {
    const problems: string[] = [];
    for (const theme of themes) {
      if (!/heading:\s*"[^"]+"/.test(theme.entry))
        problems.push(`${theme.id}: heading font missing`);
      if (!/body:\s*"[^"]+"/.test(theme.entry))
        problems.push(`${theme.id}: body font missing`);
    }
    expect(problems).toEqual([]);
  });

  it("theme ids are stable slugs (they are FKs in school records)", () => {
    const expected = [
      "collegiate-heritage",
      "university-azure",
      "educenter-bright",
      "kids-campus-playful",
    ];
    const missing = expected.filter(
      (id) => !themes.some((t) => t.id === id)
    );
    expect(missing).toEqual([]);
  });
});

describe("public site layout consumes the registry, not hardcoded palettes", () => {
  const layout = readFileSync(LAYOUT, "utf-8");

  it("imports from themes/registry", () => {
    expect(layout.includes("themes/registry")).toBe(true);
  });

  it("injects colors via CSS variables, not literal hex values", () => {
    // Any literal 6-digit hex in the school layout is palette drift —
    // colors must come from the registry/theme record.
    const hexLiterals = layout.match(/#[0-9a-fA-F]{6}\b/g) || [];
    expect(hexLiterals).toEqual([]);
  });
});
