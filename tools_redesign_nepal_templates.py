#!/usr/bin/env python3
"""Redesign the Nepali school designer templates (v2 design system).

Rebuilds canvas.json for the core designer templates with polished,
authentic school styling based on real Nepali school documents:
  - bilingual (EN + नेपाली) headers with logo ring and accent bands
  - layered color blocks and thin rules (no gradients — they survive the
    server PDF renderer and fabric JSON round-trips)
  - photo / QR / logo token slots that keep bulk fill working
    ({photo_url}, {qr_code}, {school_logo}, {name}, ...)

Templates rebuilt here:
  id_card_standard, id_card_nepali, id_card_staff,
  character_certificate, character_certificate_nepali, transfer_certificate,
  merit_certificate, participation_certificate,
  admit_card_standard, admit_card_hall_ticket,
  report_card, admission_form, letterhead_official, letterhead_informal

Run from repo root:  python3 tools_redesign_nepal_templates.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "app", "templates", "designer")

FONT = "Poppins"

# ── palette ──────────────────────────────────────────────────────────────────
NAVY, NAVY_D = "#1e3a8a", "#172554"
GOLD, GOLD_D = "#f59e0b", "#b45309"
MAROON, MAROON_D = "#9f1239", "#701a34"
TEAL, TEAL_D = "#0f766e", "#115e59"
GREEN, GREEN_D = "#166534", "#14532d"
ORANGE = "#ea580c"
SLATE, INK = "#475569", "#0f172a"
PAPER, MIST, LINE = "#ffffff", "#f1f5f9", "#cbd5e1"


def _base(o):
    o.update({
        "version": "6.0.0", "originX": "left", "originY": "top",
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    })
    return o


def txt(text, x, y, w, h, size=14, color=INK, bold=False, align="left",
        family=FONT, opacity=1.0, angle=0.0):
    return _base({
        "type": "textbox", "left": x, "top": y, "width": w, "height": h,
        "text": text, "fontSize": size, "fill": color, "fontFamily": family,
        "fontWeight": "bold" if bold else "normal", "textAlign": align,
        "opacity": opacity, "angle": angle,
    })


def rect(x, y, w, h, fill, rx=0, opacity=1.0, stroke=None, stroke_w=1, angle=0.0):
    o = _base({
        "type": "rect", "left": x, "top": y, "width": w, "height": h,
        "fill": fill, "rx": rx, "ry": rx, "opacity": opacity, "angle": angle,
    })
    if stroke:
        o["stroke"] = stroke
        o["strokeWidth"] = stroke_w
    return o


def circle(cx, cy, r, fill, opacity=1.0, stroke=None, stroke_w=1):
    o = _base({
        "type": "circle", "left": cx - r, "top": cy - r,
        "width": r * 2, "height": r * 2, "radius": r, "fill": fill,
        "opacity": opacity,
    })
    if stroke:
        o["stroke"] = stroke
        o["strokeWidth"] = stroke_w
    return o


def rule(x, y, w, color=LINE, h=1.5):
    return rect(x, y, w, h, color)


def img_slot(x, y, w, h, token):
    """Photo / QR / logo token slot — bulk fill + server render compatible."""
    return _base({
        "type": "Image", "left": x, "top": y, "width": w, "height": h,
        "src": token, "data": None,
    })


def logo_ring(cx, cy, r, band_color):
    """White logo medallion that sits on a colored band."""
    return [
        circle(cx, cy, r, "#ffffff"),
        circle(cx, cy, r - 3, "#f8fafc", stroke=band_color, stroke_w=1.2),
        txt("LOGO", cx - 14, cy - 6, 28, 12, size=8, color="#94a3b8", align="center"),
    ]


def photo_box(x, y, w, h, label="PHOTO"):
    """White-matted photo slot with dashed hint frame (server draws the image)."""
    return [
        rect(x - 3, y - 3, w + 6, h + 6, "#ffffff", rx=3, stroke="#cbd5e1", stroke_w=1),
        img_slot(x, y, w, h, "{photo_url}"),
    ]


def corner_ornaments(x, y, w, h, color, size=26, thickness=3):
    """Certificate corner brackets."""
    out = []
    for (cx, cy, dx, dy) in ((x, y, 1, 1), (x + w, y, -1, 1), (x, y + h, 1, -1), (x + w, y + h, -1, -1)):
        out.append(rect(cx - (0 if dx > 0 else size), cy - (0 if dy > 0 else thickness),
                        size, thickness, color))
        out.append(rect(cx - (0 if dx > 0 else thickness), cy - (0 if dy > 0 else size),
                        thickness, size, color))
    return out


def save(key, objects, background="#ffffff"):
    out = os.path.join(ROOT, key)
    os.makedirs(out, exist_ok=True)
    json.dump({"version": "5.3.0", "background": background, "objects": objects},
              open(os.path.join(out, "canvas.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print("redesigned", key, f"({len(objects)} objects)")


# ═══════════════════════ ID CARDS (300×189) ═══════════════════════

def id_card(theme, theme_d, accent, labels, title_chip="STUDENT"):
    """Modern student/staff ID: color header with logo ring + school name,
    photo right, details left, QR chip, bottom ID strip."""
    W, H = 300, 189
    o = []
    # card base + colored header
    o.append(rect(0, 0, W, H, "#ffffff", rx=10, stroke="#e2e8f0", stroke_w=1))
    o.append(rect(0, 0, W, 52, theme, rx=10))
    o.append(rect(0, 30, W, 22, theme))            # square off header bottom
    o.append(rect(0, 52, W, 4, accent))            # accent strip
    o += logo_ring(30, 26, 17, "#ffffff")
    o.append(txt("{school_name}", 54, 8, 200, 20, size=12.5, color="#ffffff", bold=True))
    o.append(txt("{school_address}", 54, 28, 210, 14, size=8, color="#e0e7ff"))
    # title chip on header right
    o.append(rect(W - 58, 10, 48, 15, "#ffffff", rx=7.5))
    o.append(txt(title_chip, W - 58, 12.5, 48, 12, size=8, color=theme_d, bold=True, align="center"))
    # photo right
    o += photo_box(226, 62, 58, 70)
    # details left
    lx, lw = 14, 205
    o.append(txt("{name}", lx, 64, lw, 18, size=11.5, color=INK, bold=True))
    o.append(rule(lx, 84, lw, accent, 2))
    rows = [
        (labels["class"], "{class}   {section}   {roll_no}"),
        (labels["dob"], "{dob}     {blood_group}"),
        (labels["address"], "{address}"),
        (labels["phone"], "{phone}"),
    ]
    yy = 92
    for label, value in rows:
        o.append(txt(label, lx, yy, 62, 12, size=7.5, color="#64748b", bold=True))
        o.append(txt(value, lx + 62, yy, lw - 62, 12, size=8, color=INK))
        yy += 19
    # QR chip bottom-right
    o.append(rect(230, 140, 50, 40, "#f8fafc", rx=4, stroke="#e2e8f0", stroke_w=1))
    o.append(img_slot(236, 143, 26, 26, "{qr_code}"))
    o.append(txt("SCAN", 236, 169, 38, 9, size=6.5, color="#94a3b8", bold=True))
    # bottom strip
    o.append(rect(0, H - 18, W, 18, theme_d, rx=10))
    o.append(rect(0, H - 26, W, 10, theme_d))
    o.append(txt("{school_website}   •   {school_phone}", 10, H - 15.5, 280, 12,
                 size=7.5, color="#ffffff", align="center"))
    # signature hint
    o.append(rule(14, H - 34, 80, "#94a3b8", 1))
    o.append(txt(labels["sign"], 14, H - 33, 80, 10, size=6.5, color="#64748b", align="center"))
    return o


def redesign_id_cards():
    save("id_card_standard", id_card(
        NAVY, NAVY_D, GOLD,
        {"class": "Class / Sec / Roll", "dob": "DOB / Blood", "address": "Address",
         "phone": "Phone", "sign": "Principal"}))
    save("id_card_nepali", id_card(
        MAROON, MAROON_D, GOLD,
        {"class": "कक्षा / सेक्सन / रोल", "dob": "जन्ममिति / रक्त", "address": "ठेगाना",
         "phone": "सम्पर्क", "sign": "प्रधानाध्यापक"}))
    # staff card: teal theme, different fields
    o = id_card(TEAL, TEAL_D, GOLD,
                {"class": "Designation", "dob": "Department", "address": "Email",
                 "phone": "Phone", "sign": "Principal"}, title_chip="STAFF")
    save("id_card_staff", o)


# ═══════════════════════ CERTIFICATES (794×1123) ═══════════════════════

def certificate(title_en, title_ne, theme, accent, body_lines, foot_left,
                foot_mid, foot_right, extra_center=None):
    """Formal certificate: double border, corner brackets, logo medallion,
    letter-spaced title, body, seal ring, three signature blocks."""
    W, H = 794, 1123
    o = [rect(0, 0, W, H, "#fffdf8")]                      # warm paper
    # double border + corner brackets
    o.append(rect(24, 24, W - 48, H - 48, "#00000000", stroke=theme, stroke_w=3))
    o.append(rect(34, 34, W - 68, H - 68, "#00000000", stroke=accent, stroke_w=1.2))
    o += corner_ornaments(24, 24, W - 48, H - 48, theme, 34, 4)
    # header medallion
    o += logo_ring(W / 2, 130, 44, theme)
    o.append(txt("{school_name}", 80, 186, W - 160, 40, size=30, color=theme, bold=True, align="center"))
    o.append(txt("{school_address}  •  Estd. {school_estd}", 80, 230, W - 160, 22,
                 size=13, color="#64748b", align="center"))
    o.append(txt("{school_phone}   |   {school_website}", 80, 254, W - 160, 20,
                 size=11, color="#94a3b8", align="center"))
    # title with side rules
    o.append(rule(120, 322, 200, accent, 2))
    o.append(rule(W - 320, 322, 200, accent, 2))
    o.append(circle(W / 2, 323, 5, accent))
    o.append(txt(title_en, 80, 340, W - 160, 46, size=34, color=INK, bold=True, align="center"))
    o.append(txt(title_ne, 80, 392, W - 160, 26, size=15, color="#64748b", align="center"))
    # body
    yy = 470
    for line in body_lines:
        o.append(txt(line, 110, yy, W - 220, 34, size=15.5, color=INK, align="center"))
        yy += 46
    if extra_center:
        yy += 6
        o.append(rect(W / 2 - 170, yy, 340, 40, MIST, rx=6))
        o.append(txt(extra_center, W / 2 - 160, yy + 10, 320, 22, size=14, color=theme,
                     bold=True, align="center"))
        yy += 40
    # dotted fill lines under body
    yy += 30
    for _ in range(2):
        o.append(rule(140, yy, W - 280, LINE, 1))
        yy += 44
    # seal ring
    o.append(circle(W - 170, 810, 58, "#ffffff", stroke=accent, stroke_w=2))
    o.append(circle(W - 170, 810, 46, "#fefce8", stroke=accent, stroke_w=1))
    o.append(txt("SEAL", W - 200, 800, 60, 20, size=13, color=accent, bold=True, align="center"))
    # date
    o.append(txt("Date: {date}", 110, 806, 220, 22, size=13, color=INK, bold=True))
    o.append(txt("मिति: {date_bs}", 110, 832, 220, 20, size=12, color="#64748b"))
    # signature row
    sig_y = 950
    for cx, label in ((170, foot_left), (W / 2, foot_mid), (W - 170, foot_right)):
        o.append(rule(cx - 80, sig_y, 160, INK, 1.4))
        o.append(txt(label, cx - 80, sig_y + 8, 160, 20, size=12, color=SLATE, align="center"))
    # bottom motto
    o.append(txt("•  {school_website}  •", 80, H - 74, W - 160, 18, size=10.5,
                 color="#94a3b8", align="center"))
    return o


def redesign_certificates():
    body_common = [
        "This is to certify that Mr./Ms. {name}",
        "Class: {class}   Section: {section}   Roll No: {roll_no}",
        "was a bona fide student of this school. During the period of study,",
        "his/her conduct and character were found to be excellent.",
    ]
    save("character_certificate", certificate(
        "CHARACTER  CERTIFICATE", "चरित्र प्रमाणपत्र", NAVY, GOLD, body_common,
        "Class Teacher", "Vice Principal", "Principal",
        extra_center="Conduct:  Excellent  ☐  Very Good  ☐  Good  ☐"))

    save("character_certificate_nepali", certificate(
        "चरित्र प्रमाणपत्र", "CHARACTER CERTIFICATE", MAROON, GOLD, [
            "यसले प्रमाणित गर्दछ कि {name}",
            "कक्षा: {class}   सेक्सन: {section}   रोल नं: {roll_no}",
            "यस विद्यालयको विद्यार्थी रहँदा उनको/उनकीको चरित्र र शैक्षिक",
            "अवस्था सन्तोषजनक राम्रो रहेको पाइयो।",
        ],
        "कक्षा शिक्षक", "उपप्रधानाध्यापक", "प्रधानाध्यापक",
        extra_center="चरित्र:  उत्कृष्ट  ☐  राम्रो  ☐  सन्तोषजनक  ☐"))

    save("transfer_certificate", certificate(
        "TRANSFER  CERTIFICATE", "सराई प्रमाणपत्र", GREEN, GOLD, [
            "This is to certify that Mr./Ms. {name}",
            "Class: {class}   Roll No: {roll_no}   Adm. No: {enrollment_number}",
            "was a student of this school from {admission_date} to {leaving_date}.",
            "All school dues have been cleared and the student may be admitted",
            "to any other institution of their choice.",
        ],
        "Class Teacher", "Account Section", "Principal"))

    save("merit_certificate", certificate(
        "CERTIFICATE  OF  MERIT", "प्रमाणपत्र — विशेष योग्यता", "#1d4ed8", GOLD, [
            "This certificate is proudly awarded to",
            "{name}",
            "of Class {class}, for outstanding academic performance",
            "with GPA {gpa} in {exam_name}.",
        ],
        "Class Teacher", "Exam Coordinator", "Principal",
        extra_center="Rank: {rank}      Percentage: {percentage}%"))

    save("participation_certificate", certificate(
        "CERTIFICATE  OF  PARTICIPATION", "सहभागिता प्रमाणपत्र", TEAL, ORANGE, [
            "This certificate is proudly presented to",
            "{name}",
            "of Class {class}, for active and enthusiastic participation in",
            "{event_name} held on {event_date}.",
        ],
        "Mentor", "Event Coordinator", "Principal"))


# ═══════════════════════ ADMIT CARDS (794×1123) ═══════════════════════

def admit_card(title_en, title_ne, theme, accent, chip="ADMIT CARD"):
    W, H = 794, 1123
    o = [rect(0, 0, W, H, "#ffffff")]
    o.append(rect(0, 0, W, 110, theme))
    o.append(rect(0, 110, W, 6, accent))
    o += logo_ring(58, 55, 34, "#ffffff")
    o.append(txt("{school_name}", 110, 22, 480, 34, size=25, color="#ffffff", bold=True))
    o.append(txt("{school_address}  •  {school_phone}", 110, 60, 480, 22, size=12.5,
                 color="#e0e7ff"))
    o.append(rect(W - 130, 24, 106, 30, "#ffffff", rx=15))
    o.append(txt(chip, W - 130, 30, 106, 20, size=11.5, color=theme, bold=True, align="center"))
    # title strip
    o.append(rect(40, 138, W - 80, 44, MIST, rx=8))
    o.append(txt(title_en, 40, 147, W - 80, 26, size=17, color=theme, bold=True, align="center"))
    # student info grid
    o.append(txt("STUDENT  DETAILS  /  विद्यार्थी विवरण", 40, 204, 400, 20, size=12.5,
                 color=INK, bold=True))
    o += photo_box(620, 200, 110, 130)
    info = [
        ("Name  /  नाम", "{name}"),
        ("Class  /  कक्षा", "{class}        Section: {section}"),
        ("Roll No  /  रोल नं", "{roll_no}"),
        ("Date of Birth", "{dob}"),
        ("Symbol No", "{symbol_no}"),
    ]
    yy = 240
    for label, value in info:
        o.append(txt(label, 40, yy, 180, 18, size=11.5, color="#64748b", bold=True))
        o.append(txt(value, 226, yy, 370, 18, size=12.5, color=INK, bold=True))
        o.append(rule(40, yy + 22, W - 240, LINE, 1))
        yy += 34
    # exam schedule block
    o.append(rect(40, yy + 10, W - 80, 300, "#f8fafc", rx=10, stroke="#cbd5e1", stroke_w=1.2))
    o.append(txt("EXAMINATION  SCHEDULE  /  परीक्षा तालिका", 60, yy + 26, 400, 20,
                 size=12.5, color=theme, bold=True))
    row_y = yy + 58
    o.append(rect(60, row_y, W - 120, 30, theme))
    for cx, cw, head in ((60, 90, "Date"), (150, 130, "Day"), (280, 260, "Subject"),
                         (540, 174, "Time")):
        o.append(txt(head, cx + 10, row_y + 7, cw - 20, 18, size=11, color="#ffffff", bold=True))
    for i in range(6):
        ry = row_y + 30 + i * 34
        if i % 2 == 1:
            o.append(rect(60, ry, W - 120, 34, "#eef2f7"))
        o.append(txt("{date}", 70, ry + 8, 80, 16, size=10.5, color="#94a3b8"))
        o.append(txt("{subject}", 290, ry + 8, 240, 16, size=10.5, color="#94a3b8"))
    # instructions
    iy = yy + 330
    o.append(txt("Instructions:  •  Bring this card to every exam   •  Mobile phones are prohibited",
                 40, iy, W - 80, 20, size=11, color="#64748b"))
    o.append(txt("•  Report 30 minutes before start   •  Keep the card visible on the desk",
                 40, iy + 24, W - 80, 20, size=11, color="#64748b"))
    # QR + signature
    o.append(rect(40, H - 130, 90, 90, "#f8fafc", rx=6, stroke="#e2e8f0", stroke_w=1))
    o.append(img_slot(48, H - 122, 60, 60, "{qr_code}"))
    for cx, label in ((W / 2 - 60, "Exam Controller"), (W - 200, "Principal")):
        o.append(rule(cx - 80, H - 88, 160, INK, 1.4))
        o.append(txt(label, cx - 80, H - 82, 160, 20, size=12, color=SLATE, align="center"))
    return o


def redesign_admit_cards():
    save("admit_card_standard", admit_card(
        "ADMIT  CARD  —  {exam_name}", "प्रवेश पत्र", NAVY, GOLD))
    save("admit_card_hall_ticket", admit_card(
        "HALL  TICKET  —  {exam_name}", "हल टिकट", MAROON, GOLD, chip="HALL TICKET"))


# ═══════════════════════ REPORT CARD (794×1123) ═══════════════════════

def redesign_report_card():
    W, H = 794, 1123
    theme, accent = NAVY, GOLD
    o = [rect(0, 0, W, H, "#ffffff")]
    o.append(rect(0, 0, W, 108, theme))
    o.append(rect(0, 108, W, 5, accent))
    o += logo_ring(56, 54, 32, "#ffffff")
    o.append(txt("{school_name}", 106, 18, 470, 32, size=23, color="#ffffff", bold=True))
    o.append(txt("{school_address}  •  {school_phone}  •  {school_website}", 106, 54, 500, 20,
                 size=11, color="#e0e7ff"))
    o.append(rect(W - 170, 30, 146, 44, "#ffffff", rx=8))
    o.append(txt("PROGRESS", W - 170, 34, 146, 20, size=12, color=theme, bold=True, align="center"))
    o.append(txt("REPORT  CARD", W - 170, 54, 146, 18, size=11, color=NAVY_D, align="center"))
    # student meta band
    o.append(rect(40, 134, W - 80, 78, MIST, rx=8))
    meta = [
        ("Student", "{name}", 20), ("Class", "{class}", 244), ("Section", "{section}", 420),
        ("Roll No", "{roll_no}", 560),
        ("Exam", "{exam_name}", 20), ("Academic Year", "{academic_year}", 244),
        ("Date of Birth", "{dob}", 420), ("Adm. No", "{enrollment_number}", 560),
    ]
    yy = 146
    for i, (label, value, x) in enumerate(meta):
        if i == 4:
            yy = 182
        o.append(txt(label, x, yy, 92, 15, size=10, color="#64748b", bold=True))
        o.append(txt(value, x + 92, yy, 118, 15, size=11, color=INK, bold=True))
    # marks table placeholder
    o.append(rect(40, 232, W - 80, 380, "#ffffff", stroke="#cbd5e1", stroke_w=1.4, rx=6))
    o.append(rect(40, 232, W - 80, 34, theme, rx=6))
    o.append(txt("MARK  SHEET  —  MARKS  &  GRADES", 56, 240, 400, 20, size=12.5,
                 color="#ffffff", bold=True))
    for cx, cw, head in ((56, 60, "S.No"), (116, 170, "Subject"), (286, 70, "FM"),
                         (356, 70, "PM"), (426, 84, "Obt."), (510, 70, "Grade"),
                         (580, 78, "GP"), (658, 62, "Rank")):
        o.append(txt(head, cx, 240, cw, 18, size=10, color="#ffffff", bold=True))
    for i in range(9):
        ry = 266 + i * 36
        if i % 2 == 1:
            o.append(rect(41, ry, W - 82, 36, "#f8fafc"))
        o.append(txt(str(i + 1), 56, ry + 9, 50, 16, size=10.5, color="#94a3b8"))
    o.append(rect(41, 266 + 9 * 36, W - 82, 38, theme))
    o.append(txt("TOTAL", 56, 266 + 9 * 36 + 9, 150, 18, size=11.5, color="#ffffff", bold=True))
    # result + attendance side by side
    o.append(rect(40, 636, 350, 120, "#f0fdf4", rx=8, stroke="#bbf7d0", stroke_w=1.2))
    o.append(txt("RESULT", 60, 648, 200, 18, size=12, color=GREEN, bold=True))
    o.append(txt("Percentage:  {percentage}%", 60, 676, 310, 18, size=12, color=INK))
    o.append(txt("GPA:  {gpa}      Grade:  {grade}", 60, 700, 310, 18, size=12, color=INK))
    o.append(txt("Rank:  {rank}      Result:  {result}", 60, 724, 310, 18, size=12, color=INK))
    o.append(rect(410, 636, 344, 120, "#eff6ff", rx=8, stroke="#bfdbfe", stroke_w=1.2))
    o.append(txt("ATTENDANCE", 430, 648, 200, 18, size=12, color="#1d4ed8", bold=True))
    o.append(txt("Working Days:  {working_days}", 430, 676, 300, 18, size=12, color=INK))
    o.append(txt("Present:  {present_days}      Absent:  {absent_days}", 430, 700, 310, 18, size=12, color=INK))
    o.append(rule(430, 738, 200, "#94a3b8", 1))
    # grading legend
    o.append(rect(40, 776, W - 80, 96, MIST, rx=8))
    o.append(txt("GRADING  LEGEND  (NEB)", 56, 786, 300, 18, size=11.5, color=INK, bold=True))
    legend = [("A+", "90–100", "4.0"), ("A", "80–89", "3.6"), ("B+", "70–79", "3.2"),
              ("B", "60–69", "2.8"), ("C+", "50–59", "2.4"), ("C", "40–49", "2.0"),
              ("D", "35–39", "1.6"), ("E", "<35", "0.8")]
    for i, (g, rng, gp) in enumerate(legend):
        x = 56 + (i % 4) * 186
        y2 = 810 + (i // 4) * 28
        o.append(circle(x + 8, y2 + 8, 10, theme))
        o.append(txt(g, x + 1, y2 + 1, 15, 14, size=9, color="#ffffff", bold=True, align="center"))
        o.append(txt(f"{rng}  —  GP {gp}", x + 26, y2 + 1, 150, 15, size=10.5, color=SLATE))
    # remarks + signature
    o.append(txt("Class Teacher's Remark:  {remark}", 40, 892, W - 80, 20, size=12, color=INK, bold=True))
    o.append(rule(40, 922, W - 80, LINE, 1))
    for cx, label in ((170, "Class Teacher"), (W / 2, "Checked By"), (W - 170, "Principal")):
        o.append(rule(cx - 85, 990, 170, INK, 1.4))
        o.append(txt(label, cx - 85, 997, 170, 20, size=12, color=SLATE, align="center"))
    save("report_card", o)


# ═══════════════════════ ADMISSION FORM (794×1123) ═══════════════════════

def redesign_admission_form():
    W, H = 794, 1123
    theme, accent = "#1d4ed8", GOLD
    o = [rect(0, 0, W, H, "#ffffff")]
    o.append(rect(0, 0, W, 6, theme))
    o.append(rect(0, H - 6, W, 6, theme))
    o += logo_ring(72, 62, 34, theme)
    o.append(txt("{school_name}", 120, 26, 480, 32, size=24, color=theme, bold=True))
    o.append(txt("{school_address}  •  {school_phone}  •  {school_website}", 120, 62, 480, 20,
                 size=11, color="#64748b"))
    o.append(rect(W - 156, 34, 132, 34, theme, rx=6))
    o.append(txt("ADMISSION  FORM", W - 156, 42, 132, 20, size=11.5, color="#ffffff",
                 bold=True, align="center"))
    o.append(txt("भर्ना आवेदन फारम", 120, 86, 300, 18, size=11, color="#94a3b8"))
    o.append(rule(40, 116, W - 80, accent, 2))
    # form rows
    def row(y, label, width_frac=1.0, label2=None, value2=None):
        o.append(txt(label, 40, y, 240, 18, size=11.5, color=INK, bold=True))
        o.append(rule(40, y + 24, (W - 140) * width_frac - 10, "#94a3b8", 1))
        if label2:
            x2 = 40 + (W - 120) * width_frac + 20
            o.append(txt(label2, x2, y, 150, 18, size=11.5, color=INK, bold=True))
            o.append(rule(x2, y + 24, W - x2 - 60, "#94a3b8", 1))
    yy = 140
    row(yy, "1.  Student's Name  /  विद्यार्थीको नाम"); yy += 52
    row(yy, "2.  Date of Birth (BS / AD)", 0.48, "3.  Gender  /  लिङ्ग", None); yy += 52
    row(yy, "4.  Birth Certificate No.", 0.48, "5.  Citizenship No. (if any)", None); yy += 52
    row(yy, "6.  Permanent Address  /  स्थायी ठेगाना"); yy += 52
    row(yy, "7.  Class Applying For", 0.48, "8.  Previous School", None); yy += 52
    row(yy, "9.  SEE / SLC Regd. No.", 0.48, "10.  GPA in Previous Exam", None); yy += 56
    # guardian table
    o.append(txt("GUARDIAN  DETAILS  /  अभिभावकको विवरण", 40, yy, 400, 18, size=12.5,
                 color=theme, bold=True))
    yy += 26
    gy = yy
    o.append(rect(40, gy, W - 80, 118, "#f8fafc", rx=6, stroke="#cbd5e1", stroke_w=1))
    headers = [("Relation", 40, 110), ("Name", 150, 220), ("Occupation", 370, 150),
               ("Mobile", 520, 120), ("Email", 640, 154)]
    o.append(rect(40, gy, W - 80, 28, theme, rx=6))
    for head, x, cw in headers:
        o.append(txt(head, x + 8, gy + 6, cw - 12, 17, size=10.5, color="#ffffff", bold=True))
    for label, x, cw in [("Father", 40, 110), ("Mother", 40, 110), ("Guardian", 40, 110)]:
        ry = gy + 28 + ["Father", "Mother", "Guardian"].index(label) * 30
        o.append(txt(label, x + 8, ry + 7, cw - 12, 16, size=10.5, color=SLATE))
    yy = gy + 118 + 18
    # photo + documents
    o += photo_box(W - 150, 140, 100, 120, "PHOTO")
    o.append(txt("DOCUMENTS  ENCLOSED  /  संलग्न कागजात", 40, yy, 400, 18, size=12.5,
                 color=theme, bold=True))
    yy += 26
    docs = "☐ Birth Certificate     ☐ Transfer Certificate     ☐ Mark-sheet\n☐ Passport Photos (4)     ☐ Migration (if any)     ☐ Others: ________"
    o.append(txt(docs, 40, yy, W - 100, 52, size=11.5, color=INK))
    yy += 66
    # declaration
    o.append(rect(40, yy, W - 80, 64, MIST, rx=6))
    o.append(txt("Declaration: I hereby declare that the information provided above is true to the best",
                 56, yy + 10, W - 110, 18, size=11, color=SLATE))
    o.append(txt("of my knowledge.  /  माथि दिइएका विवरणहरू सत्य भएकोले प्रमाणित गर्दछु।",
                 56, yy + 34, W - 110, 18, size=11, color=SLATE))
    # office use + signature
    for cx, label in ((150, "Applicant / Guardian"), (W / 2, "Verified By"), (W - 150, "Principal")):
        o.append(rule(cx - 85, H - 96, 170, INK, 1.4))
        o.append(txt(label, cx - 85, H - 89, 170, 20, size=12, color=SLATE, align="center"))
    save("admission_form", o)


# ═══════════════════════ LETTERHEADS (794×1123) ═══════════════════════

def redesign_letterheads():
    W, H = 794, 1123
    # official: navy band header, gold rule, footer strip
    o = [rect(0, 0, W, H, "#ffffff")]
    o.append(rect(0, 0, W, 118, NAVY))
    o.append(rect(0, 118, W, 4, GOLD))
    o += logo_ring(64, 59, 36, "#ffffff")
    o.append(txt("{school_name}", 118, 22, 420, 34, size=25, color="#ffffff", bold=True))
    o.append(txt("{school_motto}", 118, 58, 420, 20, size=11.5, color="#c7d2fe"))
    o.append(rect(W - 148, 32, 118, 52, "#ffffff", rx=8))
    o.append(txt("OFFICIAL", W - 148, 42, 118, 18, size=11, color=NAVY, bold=True, align="center"))
    o.append(txt("{school_estd}", W - 148, 62, 118, 16, size=10, color=SLATE, align="center"))
    o.append(txt("Ref. No.: ____________        Date: {date}", 40, 150, 400, 18, size=11.5, color="#64748b"))
    o.append(rule(40, 178, W - 80, LINE, 1))
    # body space
    o.append(txt("(Body of the letter — start typing or use the Writer to fill this letterhead)",
                 40, H / 2 - 60, W - 80, 24, size=12, color="#cbd5e1", align="center"))
    # footer strip
    o.append(rect(0, H - 64, W, 4, GOLD))
    o.append(rect(0, H - 60, W, 60, NAVY))
    o.append(txt("{school_address}", 40, H - 50, 460, 18, size=11, color="#e0e7ff"))
    o.append(txt("Phone: {school_phone}   •   {school_website}   •   {school_email}",
                 40, H - 28, 560, 18, size=11, color="#c7d2fe"))
    save("letterhead_official", o)

    # informal: light, left accent, airy
    o = [rect(0, 0, W, H, "#ffffff")]
    o.append(rect(0, 0, 10, H, GOLD))
    o += logo_ring(76, 74, 38, NAVY)
    o.append(txt("{school_name}", 130, 34, 500, 34, size=26, color=NAVY, bold=True))
    o.append(txt("{school_address}  •  {school_phone}  •  {school_website}", 130, 72, 520, 20,
                 size=11.5, color="#64748b"))
    o.append(rule(40, 128, W - 80, GOLD, 2))
    o.append(txt("Date: {date}", 40, 150, 300, 18, size=11.5, color="#94a3b8"))
    o.append(txt("(Start writing — informal letterhead)", 40, H / 2 - 40, W - 80, 24,
                 size=12, color="#cbd5e1", align="center"))
    for cx, label in ((170, "Prepared By"), (W - 170, "Approved By")):
        o.append(rule(cx - 80, H - 110, 160, "#94a3b8", 1))
        o.append(txt(label, cx - 80, H - 103, 160, 18, size=11, color="#94a3b8", align="center"))
    save("letterhead_informal", o)


if __name__ == "__main__":
    redesign_id_cards()
    redesign_certificates()
    redesign_admit_cards()
    redesign_report_card()
    redesign_admission_form()
    redesign_letterheads()
    print("done — redesigned 14 templates")
