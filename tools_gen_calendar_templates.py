#!/usr/bin/env python3
"""Hand-designed Nepali calendar + hiring templates for the designer.

Every decorative element (frames, scallops, halftone dots, waves, pills,
color system) is authored to match the client's reference PDFs; the only
computed part is placing the 365 real BS-2083 dates onto those designed
grids — each date is its own editable textbox so schools can restyle any
day cell directly (the point of pre-filling instead of {day} autofill).

Templates produced under backend/app/templates/designer/:
  calendar_monthly_2083   — Pathshala style, 12 pages (A4 portrait)
  calendar_wall_2083      — SM-Nepal style wall sheet (A2) with photo strip
  calendar_two_month_2083 — Rising-Star style, 6 pages (A4 landscape),
                            gold dashed frame + scalloped header
  hiring_poster           — WE'RE HIRING square social post (1080)

    backend/.venv/bin/python tools_gen_calendar_templates.py [bs_year]
"""
import json
import math
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "app", "templates", "designer")

DEV = str.maketrans("0123456789", "०१२३४५६७८९")
BS_MONTHS_NE = ["वैशाख", "ज्येष्ठ", "असार", "श्रावण", "भाद्र", "आश्विन",
                "कार्तिक", "मार्ग", "पौष", "माघ", "फाल्गुन", "चैत"]
WEEKDAYS_EN = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"]
WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

# one accent per month — the palette walks the year from spring green to Chait gold
MONTH_ACCENT = ["#0f766e", "#15803d", "#0369a1", "#1d4ed8", "#7c3aed", "#be185d",
                "#b91c1c", "#c2410c", "#ea580c", "#b45309", "#4d7c0f", "#0e7490"]
MONTH_SOFT = ["#ccfbf1", "#dcfce7", "#e0f2fe", "#dbeafe", "#ede9fe", "#fce7f3",
              "#fee2e2", "#ffedd5", "#ffedd5", "#fef3c7", "#ecfccb", "#cffafe"]

SUN_RED, SAT_RED, INK, AD_GRAY = "#dc2626", "#e11d48", "#1f2937", "#9ca3af"
FONT = "Noto Sans Devanagari"


def tb(left, top, width, text, size=12, weight="normal", fill=INK, align="left",
       line_h=1.25, angle=0, italic=False, name=None):
    return {
        "type": "textbox", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "text": text,
        "fontSize": size, "fontWeight": weight, "fontStyle": "italic" if italic else "normal",
        "fill": fill, "textAlign": align, "fontFamily": FONT,
        "lineHeight": line_h, "editable": True, "splitByGrapheme": False,
        "scaleX": 1, "scaleY": 1, "angle": angle, "opacity": 1,
        "selectable": True, "evented": True, **({"name": name} if name else {}),
    }


def rect(left, top, width, height, fill, rx=0, stroke=None, stroke_w=1, opacity=1,
         angle=0, dash=None, name=None):
    o = {
        "type": "rect", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "fill": fill, "stroke": stroke, "strokeWidth": stroke_w,
        "scaleX": 1, "scaleY": 1, "angle": angle, "opacity": opacity,
        "selectable": True, "evented": True, "rx": rx, "ry": rx,
    }
    if dash:
        o["strokeDashArray"] = dash
    if name:
        o["name"] = name
    return o


def circle(left, top, d, fill, stroke=None, stroke_w=1, opacity=1, dash=None, name=None):
    o = {
        "type": "circle", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": d, "height": d, "radius": d / 2,
        "fill": fill, "stroke": stroke, "strokeWidth": stroke_w,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": opacity,
        "selectable": True, "evented": True,
    }
    if dash:
        o["strokeDashArray"] = dash
    if name:
        o["name"] = name
    return o


def image(left, top, width, height, src, name, token=None):
    return {
        "type": "image", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "src": src, "srcOrigin": None, "crossOrigin": None,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
        "data": {"token": token} if token else {},
        "name": name,
    }


def dots_arc(cx, cy, r0, r1, arcs, count, color, d=5, a0=180, a1=270):
    """Halftone dot arc fan (the reference posters' dotted halo)."""
    out = []
    for ring in range(arcs):
        r = r0 + ring * ((r1 - r0) / max(1, arcs - 1))
        n = max(3, int(count * (ring + 1) / arcs))
        for i in range(n):
            a = math.radians(a0 + (a1 - a0) * i / (n - 1))
            out.append(circle(cx + r * math.cos(a) - d / 2, cy + r * math.sin(a) - d / 2,
                              d, color, opacity=0.75))
    return out


def scallop(x0, x1, y, d, color, step=None):
    """Row of half-visible circles — the scalloped ribbon edge."""
    step = step or d * 0.9
    n = int((x1 - x0) / step)
    return [circle(x0 + i * step, y - d / 2, d, color) for i in range(n + 1)]


def month_rows(bs_days):
    """Sunday-first rows of (bs|None); each bs keeps .day/.weekday()."""
    rows, row = [], [None] * 7
    for bs in bs_days:
        col = (bs.weekday() + 1) % 7
        if col == 0 and any(c is not None for c in row):
            rows.append(row)
            row = [None] * 7
        row[col] = bs
        if col == 6:
            rows.append(row)
            row = [None] * 7
    if any(c is not None for c in row):
        rows.append(row)
    return rows


def year_months(year):
    import nepali_datetime
    months = []
    for m in range(1, 13):
        first = nepali_datetime.date(year, m, 1)
        nxt = (nepali_datetime.date(year + 1, 1, 1) if m == 12
               else nepali_datetime.date(year, m + 1, 1))
        months.append([nepali_datetime.date(year, m, d + 1)
                       for d in range(nxt.toordinal() - first.toordinal())])
    return months


def ad_label(days):
    a, b = days[0].to_datetime_date(), days[-1].to_datetime_date()
    return f"{a.strftime('%b')}/{b.strftime('%b')} {b.year}"


def write_single(key, meta, objects, background="#ffffff"):
    folder = os.path.join(OUT, key)
    os.makedirs(folder, exist_ok=True)
    json.dump({"version": "6.0.0", "background": background, "objects": objects},
              open(os.path.join(folder, "canvas.json"), "w", encoding="utf-8"),
              ensure_ascii=False)
    open(os.path.join(folder, "template.yaml"), "w", encoding="utf-8").write(meta)
    print("wrote", folder, f"({len(objects)} objects)")


def write_multi(key, meta, pages):
    folder = os.path.join(OUT, key)
    os.makedirs(folder, exist_ok=True)
    json.dump({"version": "multi-page", "pages": pages},
              open(os.path.join(folder, "canvas.json"), "w", encoding="utf-8"),
              ensure_ascii=False)
    open(os.path.join(folder, "template.yaml"), "w", encoding="utf-8").write(meta)
    print("wrote", folder, f"({sum(len(p['json']['objects']) for p in pages)} objects)")


# ═══════════════════════ 1. MONTHLY — Pathshala style ═══════════════════════════

def monthly_page(idx, days, year):
    W, H = 794, 1123
    accent, soft = MONTH_ACCENT[idx], MONTH_SOFT[idx]
    o = []

    # ── header: white band, logo ring, school identity, year tag ──
    o += [rect(0, 0, W, 96, "#ffffff")]
    o += [circle(26, 16, 64, "#ffffff", stroke=accent, stroke_w=3)]
    o += [image(34, 24, 48, 48, "{school_logo}", "school_logo", token="school_logo")]
    o += [tb(104, 14, 430, "{school_name}", 22, "bold", "#0f172a", line_h=1.1)]
    o += [tb(104, 44, 430, "{school_address}", 10.5, "normal", "#64748b")]
    o += [tb(104, 62, 640, "फोन: {school_phone}   •   {school_website}   •   {school_email}",
             10, "normal", "#94a3b8")]
    o += [rect(600, 30, 170, 36, soft, rx=18)]
    o += [tb(600, 38, 170, f"सन् {str(year).translate(DEV)}", 14, "bold", accent, "center")]

    # accent band with month + AD + legend
    o += [rect(0, 96, W, 54, accent)]
    o += [rect(0, 150, W, 5, "#fbbf24")]
    o += [tb(28, 104, 400, f"{BS_MONTHS_NE[idx]} {str(year).translate(DEV)}", 24, "bold", "#ffffff")]
    o += [tb(W - 274, 112, 246, ad_label(days), 15, "bold", "#fef3c7", "right")]

    # legend
    leg = [("#dc2626", "Public / School Holiday"), ("#16a34a", "Events"), ("#2563eb", "Exams")]
    lx = 28
    for c, label in leg:
        o += [circle(lx, 170, 9, c), tb(lx + 14, 166, 190, label, 10, "normal", "#475569")]
        lx += 214

    # ── weekday pills ──
    x0, gw = 24, 746
    cw = gw / 7
    wy = 194
    for i, wd in enumerate(WEEKDAYS_EN):
        cx = x0 + i * cw
        pill = "#fee2e2" if i in (0, 6) else "#f1f5f9"
        ink = SUN_RED if i in (0, 6) else "#475569"
        o += [rect(cx + 3, wy, cw - 6, 26, pill, rx=13)]
        o += [tb(cx, wy + 5, cw, wd, 9.5, "bold", ink, "center")]

    # ── day grid — every BS date pre-filled, editable ──
    gy, rh = wy + 34, 90
    for r, row in enumerate(month_rows(days)):
        for c, bs in enumerate(row):
            cx, cy = x0 + c * cw, gy + r * rh
            weekend = c in (0, 6)
            o += [rect(cx + 2, cy, cw - 4, rh - 3,
                       "#fff1f2" if weekend else "#ffffff",
                       rx=8, stroke="#e2e8f0", stroke_w=1)]
            if bs is None:
                continue
            o += [tb(cx + 10, cy + 8, cw - 20, str(bs.day).translate(DEV), 27, "bold",
                     SUN_RED if weekend else INK)]
            o += [tb(cx + cw - 34, cy + 10, 24, str(bs.to_datetime_date().day), 9,
                     "normal", AD_GRAY, "right")]
            o += [rect(cx + 12, cy + rh - 26, cw - 24, 1.2, "#e2e8f0")]  # tithi/event slot
            o += [tb(cx + 10, cy + rh - 24, cw - 20, "", 8)]

    # ── holidays / activities panels ──
    y_act = gy + 6 * rh + 16
    half = (gw - 18) / 2
    for i, (title, tint) in enumerate((("Holidays:", "#fff1f2"), ("Activities:", "#f0fdf4"))):
        bx = x0 + i * (half + 18)
        o += [rect(bx, y_act, half, 236, tint, rx=10, stroke=accent, stroke_w=1.2, dash=[5, 4])]
        o += [tb(bx + 14, y_act + 10, half - 28, title, 15, "bold", accent)]
        o += [tb(bx + 14, y_act + 38, half - 28, "•\n•\n•\n•\n•\n•\n•\n•", 12, "normal",
                 "#334155", line_h=2.0)]

    # ── footer ribbon ──
    o += [rect(0, H - 42, W, 42, accent)]
    o += [tb(20, H - 34, W - 40,
             "{school_name}  •  {school_address}  •  फोन: {school_phone}", 11,
             "bold", "#ffffff", "center")]
    return {"id": f"m{idx + 1}", "width": W, "height": H, "orientation": "portrait",
            "margins": {"top": 0, "right": 0, "bottom": 0, "left": 0},
            "background": "#ffffff",
            "json": {"version": "6.0.0", "background": "#ffffff", "objects": o}}


def gen_monthly(year, months):
    pages = [monthly_page(i, days, year) for i, days in enumerate(months)]
    meta = f"""template_key: calendar_monthly_{year}
name: Monthly Calendar {year} (Pre-filled)
name_nepali: महिना क्यालेन्डर {year} — मिति भरिएको
category: calendars
editor_type: designer
description: "Pathshala-style monthly calendar — 12 pages, every BS date of {year} pre-filled as its own editable text (Devanagari numeral + tiny AD date + event slot). Twelve accent colours, holiday legend, dashed Holidays/Activities panels."
page_size: A4
thumbnail_emoji: "🗓️"
is_default: true
size: {{width: 794, height: 1123}}
pages:
""" + "".join(f"  - {{size: {{width: 794, height: 1123}}, name: \"{BS_MONTHS_NE[i]}\"}}\n"
              for i in range(12)) + """fields:
  - school_name
  - school_address
  - school_phone
  - school_website
  - school_email
  - school_logo
autofill:
  sources: [school]
  notes: >
    Dates are baked in — restyle or annotate any day cell directly.
    Holidays/Activities are plain editable bullet text; header autofills.
"""
    write_multi(f"calendar_monthly_{year}", meta, pages)


# ═══════════════════════ 2. WALL — SM-Nepal style ════════════════════════════════

def gen_wall(year, months):
    W, H = 1191, 1684
    orange, deep, blue = "#f97316", "#9a3412", "#1e40af"
    o = []

    # header: white crest band + badge
    o += [rect(0, 0, W, 128, "#fff7ed")]
    o += [circle(24, 16, 96, "#ffffff", stroke=orange, stroke_w=4)]
    o += [image(40, 32, 64, 64, "{school_logo}", "school_logo", token="school_logo")]
    o += [tb(140, 14, 700, "{school_name}", 34, "bold", deep, line_h=1.05)]
    o += [tb(140, 56, 700, "{school_address}", 15, "normal", "#7c2d12")]
    o += [tb(140, 82, 700, "फोन: {school_phone}   •   {school_website}", 13, "normal", "#9a3412")]
    # year badge top-right
    o += [circle(1042, 12, 104, "#fbbf24", stroke=deep, stroke_w=3)]
    o += [tb(1042, 40, 104, str(year).translate(DEV), 30, "bold", "#7c2d12", "center")]
    o += [tb(1042, 78, 104, "सन्", 13, "bold", "#7c2d12", "center")]

    # orange ribbon with scalloped underside
    o += [rect(0, 128, W, 46, orange)]
    o += scallop(10, W - 10, 174, 18, orange, step=17)
    o += [tb(0, 136, W, f"ACADEMIC CALENDAR  {str(year).translate(DEV)}", 24, "bold",
             "#ffffff", "center")]

    # months: 2 columns + central photo strip (SM look)
    col_w, lx = 470, [16, 705]
    strip_x, strip_w = 496, 194
    y0, row_h = 208, 232
    for m_idx, days in enumerate(months):
        col, row = m_idx % 2, m_idx // 2
        mx, my = lx[col], y0 + row * row_h
        cwid = col_w / 7
        accent = MONTH_ACCENT[m_idx]

        o += [rect(mx, my, col_w, 24, accent, rx=5)]
        o += [tb(mx + 8, my + 3, col_w / 2, f"{BS_MONTHS_NE[m_idx]} {str(year).translate(DEV)}",
                 13, "bold", "#ffffff")]
        o += [tb(mx + col_w / 2, my + 4, col_w / 2 - 8, ad_label(days), 10, "normal",
                 "#f1f5f9", "right")]
        wy = my + 27
        for i, wd in enumerate(WEEKDAYS_NE):
            o += [tb(mx + i * cwid, wy, cwid, wd, 9.5, "bold",
                     SUN_RED if i == 0 else (SAT_RED if i == 6 else "#64748b"), "center")]
        o += [rect(mx, wy + 15, col_w, 1.4, "#e2e8f0")]
        gy = wy + 19
        for r, rrow in enumerate(month_rows(days)):
            for c, bs in enumerate(rrow):
                if bs is None:
                    continue
                cx, cy = mx + c * cwid, gy + r * 29
                weekend = c in (0, 6)
                o += [tb(cx, cy, cwid, str(bs.day).translate(DEV), 15, "bold",
                         SUN_RED if weekend else INK, "center")]
                o += [tb(cx + cwid - 22, cy + 1, 19, str(bs.to_datetime_date().day), 7,
                         "normal", AD_GRAY, "right")]
        for i in range(8):
            o += [rect(mx + i * cwid, gy - 1, 1, 6 * 29 + 3, "#f1f5f9")]
        for r in range(7):
            o += [rect(mx, gy + r * 29 - 1, col_w, 1, "#f1f5f9")]

    # central photo strip
    o += [rect(strip_x - 8, y0 - 8, strip_w + 16, 6 * row_h + 8, "#ffedd5", rx=14)]
    strip_slots = [(y0 + 6, 300, "SCHOOL PHOTO 1"), (y0 + 320, 300, "SCHOOL PHOTO 2"),
                   (y0 + 634, 300, "SCHOOL PHOTO 3")]
    for sy, sh, label in strip_slots:
        o += [rect(strip_x, sy, strip_w, sh, "#ffffff", rx=10, stroke=orange, stroke_w=2)]
        o += [image(strip_x + 4, sy + 4, strip_w - 8, sh - 8, label, "school_photo_strip")]
    o += [rect(strip_x, y0 + 952, strip_w, 152, deep, rx=10)]
    o += [tb(strip_x + 10, y0 + 968, strip_w - 20, "आशिर्वाद", 18, "bold", "#fbbf24", "center")]
    o += [tb(strip_x + 10, y0 + 996, strip_w - 20,
             "यस क्यालेन्डरमा\nसम्पूर्ण मितिहरू\nपरिवर्तन गर्न\nसकिन्छ —\nप्रत्येक मिति\nसम्पादनयोग्य छ।",
             10, "normal", "#ffedd5", "center", line_h=1.45)]

    # footer ribbon
    o += [rect(0, H - 52, W, 52, orange)]
    o += [rect(0, H - 52, W, 5, "#fbbf24")]
    o += [tb(0, H - 42, W, "{school_name} — {school_address} — फोन: {school_phone}",
             14, "bold", "#ffffff", "center")]

    meta = f"""template_key: calendar_wall_{year}
name: Wall Calendar {year} (Single Sheet)
name_nepali: भित्ते क्यालेन्डर {year}
category: calendars
editor_type: designer
description: "SM-style A2 wall calendar — all 12 months of BS {year} pre-filled in Devanagari numerals around a central photo strip, scalloped orange ribbon header, year badge, red Saturdays."
page_size: A2
thumbnail_emoji: "🧾"
is_default: true
size: {{width: {W}, height: {H}}}
fields:
  - school_name
  - school_address
  - school_phone
  - school_website
  - school_logo
autofill:
  sources: [school]
  notes: >
    Every date of BS {year} is a real editable textbox. Replace the three
    SCHOOL PHOTO slots with school event photos; header/footer autofill.
"""
    write_single(f"calendar_wall_{year}", meta, o)


# ═══════════════════════ 3. TWO-MONTH — Rising-Star style ═══════════════════════

def two_month_page(idx, months, year):
    W, H = 1123, 794
    blue, gold, navy = "#1d4ed8", "#b45309", "#1e3a5f"
    o = []

    # gold dashed frame + scalloped navy header
    o += [rect(10, 10, W - 20, H - 20, "#ffffff", rx=14, stroke=gold, stroke_w=2, dash=[7, 5])]
    o += [rect(10, 10, W - 20, 118, navy, rx=14)]
    o += [rect(10, 100, W - 20, 28, navy)]
    o += scallop(60, W - 60, 138, 16, navy, step=15)

    o += [circle(34, 26, 84, "#ffffff", stroke="#fbbf24", stroke_w=3)]
    o += [image(44, 36, 64, 64, "{school_logo}", "school_logo", token="school_logo")]
    o += [tb(140, 24, 560, "{school_name}", 26, "bold", "#ffffff", line_h=1.05)]
    o += [tb(140, 56, 560, "{school_address}", 12, "normal", "#dbeafe")]
    o += [tb(140, 76, 560, "फोन: {school_phone}   •   {school_website}", 11, "normal",
             "#bfdbfe")]
    o += [tb(W - 330, 30, 300, f"सन् {str(year).translate(DEV)}", 20, "bold", "#fbbf24", "right")]
    o += [tb(W - 330, 60, 300, "हार्दिक शुभकामना", 13, "normal", "#dbeafe", "right")]

    # two month blocks
    x0s, colw = [40, 580], 503
    for k in range(2):
        m_idx = idx * 2 + k
        days = months[m_idx]
        mx = x0s[k]
        cw = colw / 7
        accent, soft = MONTH_ACCENT[m_idx], MONTH_SOFT[m_idx]

        o += [rect(mx, 156, colw * 0.60, 32, accent, rx=16)]
        o += [tb(mx + 12, 162, colw * 0.60 - 24,
                 f"{BS_MONTHS_NE[m_idx]} {str(year).translate(DEV)}", 16, "bold", "#ffffff")]
        o += [rect(mx + colw * 0.60 + 8, 156, colw * 0.40 - 8, 32, gold, rx=16)]
        o += [tb(mx + colw * 0.60 + 8, 162, colw * 0.40 - 20, ad_label(days).upper(), 12,
                 "bold", "#ffffff", "center")]

        wy = 196
        for i, wd in enumerate(WEEKDAYS_SHORT):
            o += [tb(mx + i * cw, wy, cw, wd, 11, "bold",
                     SUN_RED if i in (0, 6) else "#475569", "center")]
        o += [rect(mx, wy + 17, colw, 2, "#e2e8f0")]

        gy = wy + 22
        for r, rrow in enumerate(month_rows(days)):
            for c, bs in enumerate(rrow):
                cx, cy = mx + c * cw, gy + r * 42
                weekend = c in (0, 6)
                if bs is None:
                    continue
                o += [tb(cx + 4, cy, cw - 12, str(bs.day).translate(DEV), 19, "bold",
                         SUN_RED if weekend else INK)]
                o += [tb(cx + cw - 26, cy + 2, 22, str(bs.to_datetime_date().day), 8,
                         "normal", AD_GRAY, "right")]
        for r in range(7):
            o += [rect(mx, gy + r * 42 - 1, colw, 1, "#f1f5f9")]

    # activities panels
    y_act = 540
    half = (W - 80 - 27) / 2
    for i in range(2):
        m_idx = idx * 2 + i
        bx = 40 + i * (half + 27)
        o += [rect(bx, y_act, half, 196, MONTH_SOFT[m_idx], rx=10,
                   stroke=MONTH_ACCENT[m_idx], stroke_w=1.2, dash=[5, 4])]
        o += [tb(bx + 14, y_act + 10, half - 28,
                 f"School Activities — {BS_MONTHS_NE[m_idx]}", 14, "bold",
                 MONTH_ACCENT[m_idx])]
        o += [tb(bx + 14, y_act + 36, half - 28, "•\n•\n•\n•\n•\n•\n•", 11.5, "normal",
                 "#334155", line_h=1.9)]

    o += [rect(40, H - 52, W - 80, 30, "#fef3c7", rx=8)]
    o += [tb(40, H - 47, W - 80,
             "Above mentioned programs are subjected to change in unavoidable circumstances.",
             10.5, "italic", "#92400e", "center")]
    return {"id": f"p{idx + 1}", "width": W, "height": H, "orientation": "landscape",
            "margins": {"top": 0, "right": 0, "bottom": 0, "left": 0},
            "background": "#ffffff",
            "json": {"version": "6.0.0", "background": "#ffffff", "objects": o}}


def gen_two_month(year, months):
    pages = [two_month_page(i, months, year) for i in range(6)]
    meta = f"""template_key: calendar_two_month_{year}
name: Dual-Month Calendar {year} (Pre-filled)
name_nepali: जोडी क्यालेन्डर {year}
category: calendars
editor_type: designer
description: "Rising-Star style — 6 A4-landscape pages, two months side by side, gold dashed frame, scalloped header, every BS date of {year} pre-filled (Devanagari + AD corner) with per-month Activities panels."
page_size: A4
thumbnail_emoji: "📅"
is_default: true
size: {{width: 1123, height: 794}}
pages:
""" + "".join(f"  - {{size: {{width: 1123, height: 794}}, name: \"{BS_MONTHS_NE[p * 2]} + {BS_MONTHS_NE[p * 2 + 1]}\"}}\n"
              for p in range(6)) + """fields:
  - school_name
  - school_address
  - school_phone
  - school_website
  - school_logo
autofill:
  sources: [school]
  notes: >
    All {year} dates baked in as editable text; school header autofills;
    Activities panels are plain editable bullet text.
"""
    write_multi(f"calendar_two_month_{year}", meta, pages)


# ═══════════════════════ 4. HIRING POSTER — WE'RE HIRING ════════════════════════

def gen_hiring():
    W = H = 1080
    navy, blue, teal = "#1e3a8a", "#3b82f6", "#0d9488"
    o = []

    # halftone dot halos (top-right + mid-left), like the reference
    o += dots_arc(1060, 40, 60, 200, 4, 10, "#93c5fd", d=6, a0=90, a1=200)
    o += dots_arc(60, 470, 50, 150, 3, 8, "#bfdbfe", d=5, a0=90, a1=250)

    # logo ring + identity
    o += [circle(48, 44, 158, "#ffffff", stroke="#cbd5e1", stroke_w=2, dash=[4, 4])]
    o += [image(66, 62, 122, 122, "{school_logo}", "school_logo", token="school_logo")]
    o += [tb(238, 56, 780, "{school_name}", 54, "bold", navy, line_h=1.08)]
    o += [tb(238, 150, 780, "{school_address}", 30, "bold", teal)]

    # headline
    o += [tb(0, 246, W, "WE'RE", 82, "bold", blue, "center", line_h=1.02)]
    o += [tb(0, 336, W, "HIRING", 152, "bold", navy, "center", line_h=1.0)]
    o += [tb(140, 512, 470, "{position_title}", 46, "bold", "#2563eb")]
    o += [tb(620, 524, 330, "{position_level}", 30, "bold", "#0f172a", italic=True)]

    o += [rect(120, 592, 840, 3, "#e2e8f0")]

    # two columns
    col_w, lx, rx_ = 420, 120, 600
    o += [tb(lx, 616, col_w, "Qualifications:", 28, "bold", navy)]
    o += [tb(lx, 660, col_w, "{qualifications}", 22, "normal", "#334155", line_h=1.55)]
    o += [tb(rx_, 616, col_w, "How To Apply ?", 28, "bold", navy)]
    o += [tb(rx_, 660, col_w, "{how_to_apply}", 22, "normal", "#334155", line_h=1.55)]

    # contact block
    o += [tb(lx, 886, 500, "Contact Us", 32, "bold", "#1d4ed8")]
    o += [tb(lx, 928, 500, "📞 {contact_phone_1}", 26, "bold", navy)]
    o += [tb(lx, 966, 500, "📞 {contact_phone_2}", 26, "bold", navy)]

    # illustration slot + waves
    o += [rect(596, 846, 440, 210, "#eff6ff", rx=18, stroke="#bfdbfe", stroke_w=2)]
    o += [image(612, 858, 408, 186, "SCHOOL PHOTO", "school_photo")]
    o += [rect(-80, 1042, 700, 140, "#1d4ed8", angle=-7, name="wave_deep")]
    o += [rect(420, 1062, 760, 140, "#93c5fd", angle=-7, name="wave_light")]

    meta = """template_key: hiring_poster
name: Hiring Announcement Poster
name_nepali: सूचना — शिक्षक/कर्मचारी आवश्यकता
category: notices
editor_type: designer
description: "Square social-media hiring post — logo ring with dashed halo, WE'RE HIRING headline, Qualifications / How To Apply columns, contact block, illustration slot on blue waves."
page_size: Square 1080
thumbnail_emoji: "📢"
is_default: true
size: {width: 1080, height: 1080}
fields:
  - school_name
  - school_address
  - school_logo
  - position_title
  - position_level
  - qualifications
  - how_to_apply
  - contact_phone_1
  - contact_phone_2
autofill:
  sources: [school]
  notes: >
    {school_name}/{school_address}/{school_logo} autofill from school info.
    {position_title} e.g. "English Teacher"; {position_level} e.g. "Primary Level";
    {qualifications} and {how_to_apply} are bullet text — one point per line.
    Replace SCHOOL PHOTO with a teacher/classroom illustration.
"""
    write_single("hiring_poster", meta, o)


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2083
    months = year_months(year)
    gen_monthly(year, months)
    gen_wall(year, months)
    gen_two_month(year, months)
    gen_hiring()
