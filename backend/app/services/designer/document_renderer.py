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
        # unresolvable placeholder → visible empty slot with light border
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


def _render_page(page: dict, width: int, height: int, values: dict) -> str:
    bg = page.get("background") or "#ffffff"
    objects_html = "".join(
        _render_object(o, values) for o in (page.get("objects") or [])
    )
    return (
        f"<div style='width:{width}px;height:{height}px;position:relative;"
        f"background:{bg};overflow:hidden;page-break-after:always;"
        f"font-family:'Poppins','Noto Sans Devanagari',Arial,sans-serif;'>"
        f"{objects_html}</div>"
    )


def document_to_html(
    canvas_state: dict,
    fields: dict | None = None,
    school_config: dict | None = None,
) -> str:
    """Saved designer document → standalone HTML for WeasyPrint."""
    values = _merge_fields(fields, school_config)
    state = _replace_tokens(copy.deepcopy(canvas_state or {}), values)

    pages = []
    if state.get("version") == "multi-page" and isinstance(state.get("pages"), list):
        for p in state["pages"]:
            pages.append((
                int(p.get("width", 794)),
                int(p.get("height", 1123)),
                p.get("json") or p,
            ))
    else:
        pages.append((int(state.get("width", 794)), int(state.get("height", 1123)), state))

    body = "".join(_render_page(page, w, h, values) for w, h, page in pages)
    return f"<!DOCTYPE html><html><head><meta charset='utf-8'></head><body style='margin:0;'>{body}</body></html>"


def document_pdf(canvas_state: dict, fields: dict | None = None, school_config: dict | None = None) -> bytes:
    """Saved designer document → PDF bytes via WeasyPrint."""
    from weasyprint import HTML

    from app.services.designer.pdf_css import wrap_pdf_html

    html_str = document_to_html(canvas_state, fields, school_config)
    return HTML(string=wrap_pdf_html(html_str)).write_pdf()
