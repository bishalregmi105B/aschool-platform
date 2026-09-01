"""Document PDF export — render saved designer documents to HTML for WeasyPrint.

Bridges the gap between saved canvas_state (fabric JSON, arbitrary objects)
and TemplateEngineService.render_html (which works on registered templates).

The canvas→HTML renderer here covers the full object set the editor can
produce (textbox/rect/circle/triangle/polygon/star/line/path/image/group),
resolving data.token image placeholders and re-encoding data.type=qr codes —
so a saved ID-card design prints with real QRs and photos.
"""

import copy
import html
import io
import re
from typing import Any

_TOKEN_RE = re.compile(r"\{\{?(\w+)\}?\}")


def _esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


def _merge_fields(fields: dict | None, school_config: dict | None) -> dict:
    merged = dict(school_config or {})
    merged.update(fields or {})
    return merged


def _replace_tokens(value: Any, values: dict) -> Any:
    if isinstance(value, str):
        def repl(match):
            return str(values.get(match.group(1), match.group(0)))
        return _TOKEN_RE.sub(repl, value)
    if isinstance(value, dict):
        return {k: _replace_tokens(v, values) for k, v in value.items()}
    if isinstance(value, list):
        return [_replace_tokens(v, values) for v in value]
    return value


def _absolute(url: str) -> str:
    """WeasyPrint needs absolute URLs to fetch images; the backend serves
    uploads itself, so the request's origin is resolved by the caller passing
    absolute URLs in fields (bulk generator already does). Relative paths that
    point at our own /uploads are resolved against APP_URL."""
    if not url or url.startswith(("data:", "http://", "https://")):
        return url
    if url.startswith("/uploads"):
        import os

        base = os.getenv("APP_URL", "http://localhost:5000")
        return f"{base}{url}"
    return url


def _qr_data_url(value: str) -> str | None:
    try:
        import base64

        import qrcode

        buf = io.BytesIO()
        qr = qrcode.QRCode(box_size=6, border=1)
        qr.add_data(value)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def _render_object(obj: dict, values: dict) -> str:
    """One fabric object → absolutely-positioned HTML/CSS."""
    obj_type = str(obj.get("type", "")).lower()
    left = float(obj.get("left", 0) or 0)
    top = float(obj.get("top", 0) or 0)
    scale_x = float(obj.get("scaleX", 1) or 1)
    scale_y = float(obj.get("scaleY", 1) or 1)
    width = float(obj.get("width", 0) or 0) * scale_x
    height = float(obj.get("height", 0) or 0) * scale_y
    angle = float(obj.get("angle", 0) or 0)
    opacity = float(obj.get("opacity", 1) or 1)

    if not obj.get("visible", True):
        return ""

    base_style = (
        f"position:absolute;left:{left:.1f}px;top:{top:.1f}px;"
        f"width:{width:.1f}px;height:{height:.1f}px;"
        f"opacity:{opacity};"
    )
    if angle:
        base_style += f"transform:rotate({angle:.1f}deg);transform-origin:top left;"

    if obj_type in ("textbox", "text", "i-text"):
        text = str(obj.get("text", ""))
        font_size = float(obj.get("fontSize", 16) or 16) * scale_y
        style = base_style + (
            f"font-size:{font_size:.1f}px;"
            f"font-family:'{obj.get('fontFamily', 'Arial')}';"
            f"font-weight:{'bold' if obj.get('fontWeight') == 'bold' else 'normal'};"
            f"font-style:{obj.get('fontStyle', 'normal')};"
            f"text-align:{obj.get('textAlign', 'left')};"
            f"line-height:{obj.get('lineHeight', 1.16)};"
            f"color:{obj.get('fill', '#000') if isinstance(obj.get('fill'), str) else '#000'};"
            "overflow:hidden;white-space:pre-wrap;word-break:break-word;"
        )
        decoration = []
        if obj.get("underline"):
            decoration.append("underline")
        if obj.get("linethrough"):
            decoration.append("line-through")
        if decoration:
            style += f"text-decoration:{' '.join(decoration)};"
        return f"<div style='{style}'>{_esc(text)}</div>"

    if obj_type == "rect":
        fill = obj.get("fill") if isinstance(obj.get("fill"), str) else "transparent"
        rx = float(obj.get("rx", 0) or 0) * scale_x
        stroke = obj.get("stroke")
        style = base_style + f"background:{fill or 'transparent'};border-radius:{rx:.1f}px;"
        if stroke:
            style += (
                f"border:{float(obj.get('strokeWidth', 1) or 1)}px solid {stroke};"
                f"box-sizing:border-box;"
            )
        return f"<div style='{style}'></div>"

    if obj_type == "circle":
        fill = obj.get("fill") if isinstance(obj.get("fill"), str) else "transparent"
        stroke = obj.get("stroke")
        style = base_style + f"background:{fill or 'transparent'};border-radius:50%;"
        if stroke:
            style += f"border:{float(obj.get('strokeWidth', 1) or 1)}px solid {stroke};box-sizing:border-box;"
        return f"<div style='{style}'></div>"

    if obj_type == "image":
        src = obj.get("src") or ""
        data = obj.get("data") or {}
        token = data.get("token") or (src if "{" in src else "")
        match = _TOKEN_RE.search(token or src)

        # 1) client-side QR objects carry their value directly
        if data.get("type") == "qr" and data.get("value") and not match:
            resolved = _qr_data_url(str(data["value"]))
        elif match:
            key = match.group(1)
            if key == "qr_code" and data.get("qr_value"):
                resolved = _qr_data_url(str(values.get(data["qr_value"], data["qr_value"])))
            elif key == "qr_code" and data.get("type") == "qr" and data.get("value"):
                resolved = _qr_data_url(str(data["value"]))
            else:
                val = values.get(key, "")
                resolved = _absolute(str(val)) if val else None
        elif src and "{" not in src:
            resolved = _absolute(src)
        else:
            resolved = None

        if resolved and not resolved.startswith("data:"):
            style = base_style + f"background:url('{resolved}') no-repeat center/cover;"
            return f"<div style='{style}'></div>"
        if resolved:  # data URI
            style = base_style + f"background:url('{resolved}') no-repeat center/contain;"
            return f"<div style='{style}'></div>"
        # no image → initials avatar fallback when we know the subject name,
        # else a visible empty slot with a light border
        name = str(values.get("name") or values.get("student_name") or "").strip()
        if name:
            initial = name[0].upper()
            bg = "#dbeafe"
            fg = "#1e40af"
            style = base_style + (
                f"background:{bg};display:flex;align-items:center;justify-content:center;"
                f"font-size:{min(width, height) * 0.42:.0f}px;font-weight:700;color:{fg};"
                f"font-family:Arial,sans-serif;"
            )
            return f"<div style='{style}'>{_esc(initial)}</div>"
        style = base_style + "background:#f1f5f9;border:1px dashed #cbd5e1;box-sizing:border-box;"
        return f"<div style='{style}'></div>"

    if obj_type == "line":
        stroke = obj.get("stroke", "#334155")
        x2 = float(obj.get("x2", 0) or 0) * scale_x
        style = (
            f"position:absolute;left:{left:.1f}px;top:{top:.1f}px;width:{abs(x2):.1f}px;height:0;"
            f"border-top:{float(obj.get('strokeWidth', 1) or 1)}px solid {stroke};opacity:{opacity};"
        )
        if angle:
            style += f"transform:rotate({angle:.1f}deg);transform-origin:left center;"
        return f"<div style='{style}'></div>"

    if obj_type in ("polygon", "path", "triangle", "group"):
        # Rendered as SVG — polygon points/paths carry their geometry.
        points = obj.get("points")
        path = obj.get("path")
        fill = obj.get("fill") if isinstance(obj.get("fill"), str) else "#94a3b8"
        stroke = obj.get("stroke", "none")
        stroke_w = float(obj.get("strokeWidth", 0) or 0)
        svg_inner = ""
        if points:
            # fabric polygon points are relative to a bounded box; normalize by pathOffset
            ox = float(obj.get("pathOffset", {}).get("x", 0) or 0)
            oy = float(obj.get("pathOffset", {}).get("y", 0) or 0)
            pts = " ".join(
                f"{(p.get('x', 0) - ox) * scale_x:.1f},{(p.get('y', 0) - oy) * scale_y:.1f}"
                for p in points
            )
            svg_inner = f"<polygon points='{pts}' fill='{fill}' stroke='{stroke}' stroke-width='{stroke_w}' />"
        elif path:
            d = " ".join(
                " ".join(str(seg) for seg in seg_cmd) if isinstance(seg_cmd, list) else str(seg_cmd)
                for seg_cmd in (
                    [seg[0]] + [str(n) for n in seg[1:]] for seg in path
                )
            )
            svg_inner = f"<path d='{d}' fill='{fill}' stroke='{stroke}' stroke-width='{stroke_w}' />"
        else:
            return ""
        style = base_style + "overflow:visible;"
        return (
            f"<svg style='{style}' viewBox='0 0 {width:.1f} {height:.1f}' "
            f"preserveAspectRatio='none'>{svg_inner}</svg>"
        )

    # unknown type → dashed placeholder box (matches server renderer behavior)
    style = base_style + "border:1px dashed #cbd5e1;box-sizing:border-box;"
    return f"<div style='{style}'></div>"


def _render_page(page: dict, width: int, height: int, values: dict, page_name: str | None = None) -> str:
    bg = page.get("background") or "#ffffff"
    objects_html = "".join(
        _render_object(o, values) for o in (page.get("objects") or [])
    )
    # page_name maps the div to a matching `@page pgN` rule so WeasyPrint emits
    # one PDF page per design page at the design's own px size (A2 wall
    # calendars, A5 admit cards, 1080px posters — never clipped to A4).
    page_rule = f"page:{page_name};" if page_name else ""
    return (
        f"<div style='width:{width}px;height:{height}px;position:relative;"
        f"background:{bg};overflow:hidden;{page_rule}"
        f"font-family:'Poppins','Noto Sans Devanagari',Arial,sans-serif;'>"
        f"{objects_html}</div>"
    )


def _document_pages(canvas_state: dict) -> list[tuple[int, int, dict]]:
    """Normalized [(width_px, height_px, page_json), …] for a saved document."""
    state = canvas_state or {}
    if state.get("version") == "multi-page" and isinstance(state.get("pages"), list):
        return [
            (int(p.get("width", 794)), int(p.get("height", 1123)), p.get("json") or p)
            for p in state["pages"]
        ]
    return [(int(state.get("width", 794)), int(state.get("height", 1123)), state)]


def document_to_html(
    canvas_state: dict,
    fields: dict | None = None,
    school_config: dict | None = None,
) -> str:
    """Saved designer document → HTML body fragment for WeasyPrint.

    Returns a body fragment (callers wrap it via ``pdf_css.wrap_pdf_html``).
    Each page div carries `page:pgN` so the wrapper can emit per-page
    `@page pgN { size: Wpx Hpx }` rules matching the design's real size.
    """
    values = _merge_fields(fields, school_config)
    state = _replace_tokens(copy.deepcopy(canvas_state or {}), values)

    parts = []
    for index, (w, h, page) in enumerate(_document_pages(state)):
        parts.append(_render_page(page, w, h, values, page_name=f"pg{index}"))
    return "".join(parts)


def document_page_size_rule(canvas_state: dict) -> str:
    """`@page` size string matching the document's own page dimensions (px).

    Single-size documents → one `@page { size: Wpx Hpx }`. Mixed-size
    documents additionally name every page (pgN) so each sheet keeps its own
    dimensions. Falls back to A4 portrait for degenerate input.
    """
    pages = _document_pages(canvas_state or {})
    if not pages:
        return "A4 portrait"
    sizes: list[tuple[int, int]] = []
    rules: list[str] = []
    for index, (w, h, _page) in enumerate(pages):
        size = (max(1, w), max(1, h))
        rules.append(f"@page pg{index} {{ size: {size[0]}px {size[1]}px; margin: 0; }}")
        if size not in sizes:
            sizes.append(size)
    if len(sizes) == 1:
        return f"{sizes[0][0]}px {sizes[0][1]}px"
    # mixed sizes: default page = first size, plus a named rule per page
    return "custom::" + " ".join([f"@page {{ size: {sizes[0][0]}px {sizes[0][1]}px; margin: 0; }}"] + rules)


def document_pdf(canvas_state: dict, fields: dict | None = None, school_config: dict | None = None) -> bytes:
    """Saved designer document → PDF bytes via WeasyPrint.

    The PDF page size always follows the document's own design dimensions
    (px @ 96dpi), so e.g. the A2 wall calendar exports as one full-size A2
    sheet instead of being clipped onto A4.
    """
    from weasyprint import HTML

    from app.services.designer.pdf_css import PDF_BASE_CSS, wrap_pdf_html

    html_str = document_to_html(canvas_state, fields, school_config)
    size_rule = document_page_size_rule(canvas_state)
    if size_rule.startswith("custom::"):
        extra_css = size_rule[len("custom::"):]
        doc = (
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<style>{PDF_BASE_CSS} {extra_css}</style>"
            f"</head><body>{html_str}</body></html>"
        )
        return HTML(string=doc).write_pdf()
    return HTML(string=wrap_pdf_html(html_str, page_size=size_rule)).write_pdf()
