"""Generate canvas.json for the Attendance Ledger designer template.

Run once from this folder (or anywhere):

    ../../../../.venv/bin/python _generate.py
    # or simply: python3 _generate.py

Layout (A4 portrait 794x1123):

    ┌ header: {school_name} / {school_address} ────────────────┐
    │ Attendance Ledger — {class_name} {section_name} | {month_name} {year_bs}
    ├──────┬──────────────┬ 1 .. 31 (day columns) ┬────┬────┤
    │ Roll │  Student Name│ 20px day cells        │ P  │ A  │   ← header band
    │ {roll_1} │ {name_1}  │ {m_1_1} .. {m_1_31}   │ {total_p_1} │ {total_a_1} │
    │  ... 20 roster rows ...                                    │
    └────────────────────────────────────────────────────────────┘
    Class Teacher __________________ Principal __________________

Object-count note: the 20×31 = 620 per-day mark textboxes required by the
token spec ({m_1_1}..{m_20_31}) dominate the count (~797 total); everything
else (grid lines, header) is kept minimal. The canvas is emitted once and
served statically, so the count only affects designer load time.
"""

import json
import os

W, H = 794, 1123  # A4 portrait

# Table geometry
TABLE_LEFT = 10
TABLE_RIGHT = 784
TABLE_TOP = 88
HEADER_H = 20
ROW_H = 28
ROWS = 20
DAYS = 31
DAY_W = 20
TABLE_BOTTOM = TABLE_TOP + HEADER_H + ROWS * ROW_H  # 668

ROLL_W = 22
NAME_W = 90
P_W = 21
A_W = 21
ROLL_X = TABLE_LEFT                       # 10
NAME_X = ROLL_X + ROLL_W                  # 32
DAY_X0 = NAME_X + NAME_W                  # 122
P_X = DAY_X0 + DAYS * DAY_W               # 742
A_X = P_X + P_W                           # 763

INK = "#0f172a"
GRID = "#cbd5e1"
BORDER = "#475569"
GREEN = "#0e3b2e"
HEADER_BG = "#e2f2ea"


def _rect(left, top, width, height, fill="transparent", stroke=None, stroke_width=1):
    return {
        "type": "rect", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "fill": fill, "stroke": stroke, "strokeWidth": stroke_width,
        "rx": 0, "ry": 0,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    }


def _text(left, top, width, text, size=8, bold=False, color=INK,
          align="center", family="Arial", height=None):
    return {
        "type": "textbox", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width,
        "height": height if height is not None else max(14, size + 6),
        "text": text,
        "fontSize": size, "fontWeight": "bold" if bold else "normal",
        "fontStyle": "normal",
        "fill": color, "textAlign": align, "fontFamily": family,
        "editable": True, "splitByGrapheme": False,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    }


def _hline(top, color=GRID, stroke_w=1):
    return {
        "type": "line", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": TABLE_LEFT, "top": top,
        "x1": 0, "y1": 0, "x2": TABLE_RIGHT - TABLE_LEFT, "y2": 0,
        "stroke": color, "strokeWidth": stroke_w,
        "width": TABLE_RIGHT - TABLE_LEFT, "height": 0,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    }


def _vline(x, color=GRID, stroke_w=1):
    return {
        "type": "line", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": x, "top": TABLE_TOP,
        "x1": 0, "y1": 0, "x2": 0, "y2": TABLE_BOTTOM - TABLE_TOP,
        "stroke": color, "strokeWidth": stroke_w,
        "width": 0, "height": TABLE_BOTTOM - TABLE_TOP,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    }


def build_objects():
    objs = []

    # ── Page header ────────────────────────────────────────────────
    objs.append(_text(10, 14, W - 20, "{school_name}", 15, bold=True, color=GREEN))
    objs.append(_text(10, 34, W - 20, "{school_address}", 8, color="#475569"))
    objs.append(_hline(50, "#0e3b2e", 2))
    objs.append(_text(
        10, 58, 500, "Attendance Ledger — {class_name} {section_name}",
        11, bold=True, color=GREEN, align="left",
    ))
    objs.append(_text(
        444, 58, 340, "{month_name} {year_bs}", 11, bold=True, color=GREEN, align="right",
    ))
    objs.append(_text(
        244, 74, 540,
        "P Present · A Absent · L Late · H Half-day · Lv Leave",
        6.5, color="#64748b", align="right",
    ))

    # ── Grid ───────────────────────────────────────────────────────
    objs.append(_rect(
        TABLE_LEFT, TABLE_TOP, TABLE_RIGHT - TABLE_LEFT,
        TABLE_BOTTOM - TABLE_TOP, "transparent", BORDER, 1.5,
    ))
    objs.append(_rect(
        TABLE_LEFT, TABLE_TOP, TABLE_RIGHT - TABLE_LEFT, HEADER_H,
        HEADER_BG, BORDER, 1,
    ))
    # header bottom + row separators
    objs.append(_hline(TABLE_TOP + HEADER_H))
    for r in range(1, ROWS):
        objs.append(_hline(TABLE_TOP + HEADER_H + r * ROW_H))
    # column boundaries: roll|name, name|day, day boundaries, day|P, P|A
    objs.append(_vline(ROLL_X + ROLL_W))
    objs.append(_vline(DAY_X0))
    for d in range(1, DAYS):
        objs.append(_vline(DAY_X0 + d * DAY_W))
    objs.append(_vline(P_X))
    objs.append(_vline(A_X))

    # ── Header labels ──────────────────────────────────────────────
    hdr_y = TABLE_TOP + 5
    objs.append(_text(ROLL_X, hdr_y, ROLL_W, "Roll", 8, bold=True, color=GREEN))
    objs.append(_text(NAME_X, hdr_y, NAME_W, "Student Name", 8, bold=True, color=GREEN, align="left"))
    for d in range(1, DAYS + 1):
        objs.append(_text(
            DAY_X0 + (d - 1) * DAY_W, hdr_y + 1, DAY_W, str(d), 7, bold=True, color=GREEN,
        ))
    objs.append(_text(P_X, hdr_y, P_W, "P", 8, bold=True, color=GREEN))
    objs.append(_text(A_X, hdr_y, A_W, "A", 8, bold=True, color=GREEN))

    # ── Roster rows ────────────────────────────────────────────────
    for r in range(1, ROWS + 1):
        y = TABLE_TOP + HEADER_H + (r - 1) * ROW_H
        objs.append(_text(ROLL_X, y + 8, ROLL_W, f"{{roll_{r}}}", 8))
        objs.append(_text(NAME_X + 2, y + 8, NAME_W - 4, f"{{name_{r}}}", 8, align="left"))
        for d in range(1, DAYS + 1):
            objs.append(_text(
                DAY_X0 + (d - 1) * DAY_W, y + 9, DAY_W, f"{{m_{r}_{d}}}", 7,
            ))
        objs.append(_text(P_X, y + 8, P_W, f"{{total_p_{r}}}", 8))
        objs.append(_text(A_X, y + 8, A_W, f"{{total_a_{r}}}", 8))

    # ── Signature block ────────────────────────────────────────────
    sig_y = TABLE_BOTTOM + 40
    objs.append({
        "type": "line", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": 60, "top": sig_y, "x1": 0, "y1": 0, "x2": 200, "y2": 0,
        "stroke": "#334155", "strokeWidth": 1,
        "width": 200, "height": 0,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    })
    objs.append(_text(60, sig_y + 4, 200, "Class Teacher", 9, color="#334155"))
    objs.append({
        "type": "line", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": 534, "top": sig_y, "x1": 0, "y1": 0, "x2": 200, "y2": 0,
        "stroke": "#334155", "strokeWidth": 1,
        "width": 200, "height": 0,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    })
    objs.append(_text(534, sig_y + 4, 200, "Principal", 9, color="#334155"))

    # ── Footer ─────────────────────────────────────────────────────
    objs.append(_text(10, H - 30, W - 20, "Printed on {today_bs} · ASchool", 7, color="#94a3b8"))

    return objs


def main():
    canvas = {"version": "6.0.0", "background": "#ffffff", "objects": build_objects()}
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "canvas.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, ensure_ascii=False, indent=2)
    print(f"wrote {out_path} — {len(canvas['objects'])} objects")


if __name__ == "__main__":
    main()
