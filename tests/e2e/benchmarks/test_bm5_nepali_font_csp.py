"""Benchmark 5 Verifier: Nepali Font & CSP Integrity.

Requirement from ORIGINAL_REQUEST.md:
"Nepali font rendering is crisp, consistent, and free of CSP console errors."

Verification Scope:
1. Verifies next.config.js CSP policy:
   - Ensures `font-src` allows fonts.gstatic.com and does NOT allow corrupt CSS2 fonts.googleapis.com
   - Ensures `style-src` allows fonts.googleapis.com for font stylesheets
2. Verifies globals.css:
   - Ensures zero corrupt CSS2 stylesheet URLs in `@font-face src: url(...)`
3. Verifies layout.tsx:
   - Ensures `Mukta` Devanagari font is configured via `next/font/google`
   - Ensures CSS variable `--font-mukta` is declared and passed to <body>
"""

import os
import re
import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
NEXT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "frontend", "next.config.js")
GLOBALS_CSS_PATH = os.path.join(PROJECT_ROOT, "frontend", "app", "globals.css")
LAYOUT_TSX_PATH = os.path.join(PROJECT_ROOT, "frontend", "app", "layout.tsx")


def test_next_config_csp_font_directives():
    """Verify CSP header configuration in next.config.js for font and style sources."""
    assert os.path.isfile(NEXT_CONFIG_PATH), f"next.config.js not found at {NEXT_CONFIG_PATH}"

    with open(NEXT_CONFIG_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. font-src must permit font binaries from fonts.gstatic.com
    assert "https://fonts.gstatic.com" in content, (
        "CSP font-src must include https://fonts.gstatic.com for Google Font binaries"
    )

    # 2. font-src must NOT contain fonts.googleapis.com (which returns CSS text, not font binaries)
    font_src_matches = re.findall(r"font-src\s+([^;\"]+)", content)
    assert len(font_src_matches) > 0, "No font-src directive found in CSP configuration"
    for directive in font_src_matches:
        assert "fonts.googleapis.com" not in directive, (
            f"CSP font-src contains corrupt stylesheet origin 'fonts.googleapis.com': {directive}. "
            "Google Fonts stylesheets must only be permitted under style-src."
        )

    # 3. style-src must permit Google Fonts stylesheets
    style_src_matches = re.findall(r"style-src\s+([^;\"]+)", content)
    assert len(style_src_matches) > 0, "No style-src directive found in CSP configuration"
    assert any("fonts.googleapis.com" in s for s in style_src_matches), (
        "CSP style-src must include https://fonts.googleapis.com for font stylesheets"
    )

    print("\n[BM5-PASS] next.config.js CSP directives verified:")
    print("  ✓ font-src contains https://fonts.gstatic.com")
    print("  ✓ font-src excludes corrupt stylesheet endpoint fonts.googleapis.com")
    print("  ✓ style-src contains https://fonts.googleapis.com")


def test_globals_css_no_corrupt_font_face():
    """Verify that globals.css contains no corrupt @font-face declarations pointing to CSS2 URLs."""
    assert os.path.isfile(GLOBALS_CSS_PATH), f"globals.css not found at {GLOBALS_CSS_PATH}"

    with open(GLOBALS_CSS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Check for invalid CSS2 stylesheet URL inside @font-face
    corrupt_pattern = re.compile(
        r"@font-face\s*\{[^}]*src:\s*url\([\"']https://fonts\.googleapis\.com/css2[^\)]*[\"']\)[^}]*\}",
        re.DOTALL,
    )
    matches = corrupt_pattern.findall(content)
    assert len(matches) == 0, (
        f"Found {len(matches)} invalid @font-face declarations pointing to CSS2 stylesheet URLs in globals.css. "
        "@font-face src: url() must point to .woff2 font binary files, not CSS stylesheets."
    )

    print("[BM5-PASS] globals.css verified: 0 corrupt CSS2 @font-face declarations.")


def test_mukta_devanagari_loader_in_layout():
    """Verify that layout.tsx configures the Mukta Devanagari font via next/font/google."""
    assert os.path.isfile(LAYOUT_TSX_PATH), f"layout.tsx not found at {LAYOUT_TSX_PATH}"

    with open(LAYOUT_TSX_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify import from next/font/google
    assert "from \"next/font/google\"" in content or "from 'next/font/google'" in content, (
        "next/font/google must be imported in layout.tsx"
    )
    assert "Mukta" in content, "Mukta font loader must be imported from next/font/google"

    # Verify Devanagari subset configuration
    assert "devanagari" in content.lower(), "Mukta font configuration must include 'devanagari' subset"

    # Verify CSS variable configuration
    assert "--font-mukta" in content, "Mukta font loader must assign CSS variable '--font-mukta'"

    # Verify inclusion in <body> class
    assert "mukta.variable" in content or "${mukta.variable}" in content, (
        "<body> must include mukta.variable for root typography cascading"
    )

    print("[BM5-PASS] layout.tsx verified: Mukta Devanagari font loader active with --font-mukta.")
