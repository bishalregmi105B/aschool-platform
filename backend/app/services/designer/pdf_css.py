"""Shared CSS for server-side PDF renders (WeasyPrint).

The Noto Sans Devanagari family is installed system-wide in the Docker image
(see Dockerfile fc-cache step), so `font-family` stacks ending with it render
shaped Nepali text via Pango/HarfBuzz. This module also embeds the fonts as
@font-face for environments where fc-cache hasn't run (local dev).
"""

import os

_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "fonts")

# CSS prepended to every server-rendered PDF document.
PDF_BASE_CSS = """
@font-face {
  font-family: 'Noto Sans Devanagari';
  src: local('Noto Sans Devanagari'),
       url('file://%(font_dir)s/NotoSansDevanagari-Regular.ttf');
  font-weight: normal;
}
@font-face {
  font-family: 'Noto Sans Devanagari';
  src: local('Noto Sans Devanagari Bold'),
       url('file://%(font_dir)s/NotoSansDevanagari-Bold.ttf');
  font-weight: bold;
}
body { margin: 0; }
* { -weasy-hyphens: none; }
""" % {"font_dir": _FONT_DIR}


def wrap_pdf_html(body_html: str, page_size: str = "portrait") -> str:
    """Full HTML document for WeasyPrint with the font stack + @page rule.

    ``page_size`` may be:
      - "portrait" / "landscape"  → A4 (kept for backwards compatibility)
      - "A4 portrait", "A3 landscape", "A2 portrait", …  → named paper size
      - "1191px 1684px" (or any "<w> <h>" pair)   → exact px size, matching
        the canvas renderer's fixed-px page divs so nothing is clipped and
        nothing overflows onto extra sheets.
    """
    size_rule = page_size if page_size else "A4 portrait"
    if size_rule == "portrait":
        size_rule = "A4 portrait"
    elif size_rule == "landscape":
        size_rule = "A4 landscape"
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{PDF_BASE_CSS} @page {{ size: {size_rule}; margin: 0; }}</style>"
        f"</head><body>{body_html}</body></html>"
    )
