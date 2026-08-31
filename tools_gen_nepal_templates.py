#!/usr/bin/env python3
"""Generate Nepal-specific designer template folders.

Creates backend/app/templates/designer/<key>/{template.yaml, canvas.json}
following the exact shape the engine + editors consume (verified against the
existing id_card_standard folder).
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "app", "templates", "designer")


def tb(left, top, width, text, size=12, weight="normal", fill="#1e293b", align="left", family="Noto Sans Devanagari", line_h=1.25, angle=0, opacity=1, editable=True, name=None):
    o = {
        "type": "textbox", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "text": text,
        "fontSize": size, "fontWeight": weight, "fontStyle": "normal",
        "fill": fill, "textAlign": align, "fontFamily": family,
        "lineHeight": line_h, "editable": editable, "splitByGrapheme": False,
        "scaleX": 1, "scaleY": 1, "angle": angle, "opacity": opacity,
        "selectable": True, "evented": True,
    }
    if name:
        o["name"] = name
    return o


def rect(left, top, width, height, fill, rx=0, stroke=None, stroke_w=1, opacity=1, name=None):
    o = {
        "type": "rect", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "fill": fill, "stroke": stroke, "strokeWidth": stroke_w,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": opacity,
        "selectable": True, "evented": True, "rx": rx, "ry": rx,
    }
    if name:
        o["name"] = name
    return o


def image(left, top, width, height, src_token, name, token=None, qr_value=None):
    o = {
        "type": "image", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "src": src_token, "srcOrigin": None, "crossOrigin": None,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
        "data": {"token": token} if token else ({"type": "qr", "value": qr_value} if qr_value else {}),
    }
    o["name"] = name
    return o


def line(x1, y1, x2, y2, stroke="#94a3b8", stroke_w=1, dash=None, opacity=1, name=None):
    o = {
        "type": "line", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": x1, "top": y1, "x2": x2, "y2": y2,
        "stroke": stroke, "strokeWidth": stroke_w,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": opacity,
        "selectable": True, "evented": True,
    }
    if dash:
        o["strokeDashArray"] = dash
    if name:
        o["name"] = name
    return o


def write_template(key, meta, objects, background="#ffffff"):
    folder = os.path.join(OUT, key)
    os.makedirs(folder, exist_ok=True)
    canvas = {"version": "6.0.0", "background": background, "objects": objects}
    with open(os.path.join(folder, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(canvas, f, ensure_ascii=False, indent=2)
    with open(os.path.join(folder, "template.yaml"), "w", encoding="utf-8") as f:
        f.write(meta.rstrip() + "\n")
    print("wrote", folder)


# ── 1. Nepali ID card (Devanagari labels, Nepal-flag crimson) ───────────────
CARD_W, CARD_H = 300, 189
idc = []
idc.append(rect(0, 0, CARD_W, CARD_H, "#ffffff", rx=10, stroke="#dc2626", stroke_w=2, name="card-border"))
idc.append(rect(0, 0, CARD_W, 44, "#b91c1c", rx=0, name="header-band"))
idc.append(rect(0, 38, CARD_W, 6, "#dc2626", name="header-accent"))
idc.append(image(6, 5, 34, 34, "{school_logo}", "logo-slot", token="school_logo"))
idc.append(tb(46, 4, 248, "{school_name}", size=13, weight="bold", fill="#ffffff", align="center", name="school-name"))
idc.append(tb(46, 22, 248, "{school_address}", size=7.5, fill="#fecaca", align="center", name="school-address"))
idc.append(tb(8, 52, 90, "विद्यार्थी पहिचानपत्र", size=9, weight="bold", fill="#b91c1c", align="center", name="card-title-np"))
idc.append(tb(160, 52, 90, "STUDENT IDENTITY CARD", size=6.5, fill="#64748b", align="center", name="card-title-en"))
idc.append(rect(90, 78, 120, 1.2, "#fca5a5", name="title-divider"))
# photo frame
idc.append(rect(10, 70, 74, 92, "#fef2f2", rx=6, stroke="#dc2626", stroke_w=1.2, name="photo-frame"))
idc.append(image(13, 73, 68, 86, "{photo}", "photo-slot", token="photo"))
# details (devanagari labels)
rows = [
    ("नाम", "{name}", 82),
    ("कक्षा", "{class}  '{section}", 100),
    ("रोल नं", "{roll_no}", 118),
    ("जन्म मिति", "{dob}", 136),
    ("रक्त समूह", "{blood_group}", 154),
]
for label, value, y in rows:
    idc.append(tb(92, y, 58, f"{label}:", size=9, weight="bold", fill="#7f1d1d", name=f"lbl-{label}"))
    idc.append(tb(148, y, 118, value, size=9.5, fill="#0f172a", name=f"val-{y}"))
idc.append(tb(92, 170, 200, "सम्पर्क: {phone}", size=8, fill="#475569", name="contact-row"))
idc.append(image(268, 74, 26, 26, "", "qr-slot", token="qr_code"))
idc.append(tb(262, 104, 34, "Scan", size=6, fill="#94a3b8", align="center", name="qr-caption"))
idc.append(rect(0, CARD_H - 12, CARD_W, 12, "#fee2e2", rx=0, name="footer-band"))
idc.append(tb(8, CARD_H - 11, 284, "{school_phone}  •  {school_website}", size=7, fill="#7f1d1d", align="center", name="footer-contact"))

write_template("id_card_nepali", """template_key: id_card_nepali
name: Student ID Card (Nepali)
category: id_cards
editor_type: designer
description: विद्यार्थी पहिचानपत्र — Devanagari-labelled ID card in Nepal-flag crimson with photo and QR
page_size: ID Card
thumbnail_emoji: 🇳🇵
is_default: true
size:
  width: 300
  height: 189
fields:
- photo
- name
- class
- section
- roll_no
- dob
- blood_group
- phone
autofill:
  sources:
  - school
  dates: auto (school footer)
  notes: School fields merge automatically; record data comes from bulk generation or the data-fill panel. Devanagari renders correctly in print PDF (Noto Sans Devanagari).
""", idc)


# ── 2. Nepali character certificate (चरित्र प्रमाणपत्र, A4) ─────────────────
W, H = 794, 1123
cc = []
cc.append(rect(0, 0, W, H, "#ffffff", name="page-bg"))
cc.append(rect(14, 14, W - 28, H - 28, "", rx=0, stroke="#166534", stroke_w=3, name="border-outer"))
cc.append(rect(22, 22, W - 44, H - 44, "", rx=0, stroke="#166534", stroke_w=1, name="border-inner"))
cc.append(image(W / 2 - 32, 48, 64, 64, "{school_logo}", "logo-slot", token="school_logo"))
cc.append(tb(60, 122, W - 120, "{school_name}", size=26, weight="bold", fill="#166534", align="center", name="school-name"))
cc.append(tb(60, 158, W - 120, "{school_address}  •  फोन: {school_phone}", size=12, fill="#4b5563", align="center", name="school-address"))
cc.append(rect(220, 186, W - 440, 1.5, "#166534", name="header-rule"))
cc.append(tb(60, 212, W - 120, "चरित्र प्रमाणपत्र", size=30, weight="bold", fill="#14532d", align="center", name="title-np"))
cc.append(tb(60, 252, W - 120, "( CHARACTER CERTIFICATE )", size=13, fill="#6b7280", align="center", name="title-en"))
cc.append(rect(277, 288, 240, 1, "#a7f3d0", name="title-rule"))
body = ("प्रमाणित गरिन्छ कि {name} (अभिभावक: {father_name}) ले हाम्रो विद्यालय\n"
        "मा कक्षा {class_name} '{section} मा अध्ययन गरेको / गरिरहेको र\n"
        "विद्यालयका नियम-नियमावली प्रति अनुशासित र इमानदार रहेको व्यहोरिन्छ।\n\n"
        "उक्त अवधिमा विद्यार्थीको चरित्र उत्तम (मितव्ययी, मेहनती र\n"
        "शान्तिप्रेमी) रहेको र विद्यालयलाई कुनै प्रकारको अपमान नपुर्\u200dयाएको\n"
        "हुँदा यस विद्यालयका तर्फबाट सुझाव सहित छुट्टी दिइएको छ।\n\n"
        "आगामी दिनमा उहाँको उज्ज्वल भविष्य रहोस् भन्ने शुभकामना व्यक्त गर्दछौं।")
cc.append(tb(84, 330, W - 168, body, size=15, fill="#1f2937", align="center", line_h=1.9, name="body-text"))
# info rows
info_rows = [
    ("नाम", "{name}"),
    ("कक्षा / सेक्सन", "{class_name} '{section}"),
    ("रोल नं", "{roll_no}"),
    ("लगाइएको मिति (दर्ता नं)", "{enrollment_number}"),
]
y = 610
for label, value in info_rows:
    cc.append(tb(120, y, 240, f"{label} : ", size=13, weight="bold", fill="#374151", align="right", name=f"inf-lbl-{y}"))
    cc.append(line(375, y + 18, 660, y + 18, stroke="#9ca3af", stroke_w=1, name=f"inf-line-{y}"))
    cc.append(tb(385, y + 2, 270, value, size=13, fill="#111827", name=f"inf-val-{y}"))
    y += 42
cc.append(tb(120, 795, 300, "मिति (BS): {today_bs}", size=13, fill="#374151", name="date-bs"))
cc.append(tb(120, 820, 300, "मिति (AD): {today_ad}", size=13, fill="#374151", name="date-ad"))
cc.append(tb(470, 900, 210, "..............................", size=14, fill="#374151", align="center", name="sig-dots"))
cc.append(tb(470, 928, 210, "प्रधानाध्यापक", size=14, weight="bold", fill="#166534", align="center", name="sig-label"))
cc.append(tb(470, 950, 210, "{principal_name}", size=11, fill="#6b7280", align="center", name="sig-name"))
cc.append(image(120, 880, 110, 110, "{school_stamp}", "stamp-slot", token="school_stamp"))
cc.append(tb(60, H - 78, W - 120, "यस प्रमाणपत्र विद्यालयको आधिकारिक चाबी बिना रद्द हुनेछ ।", size=9.5, fill="#9ca3af", align="center", name="footer-note"))

write_template("character_certificate_nepali", """template_key: character_certificate_nepali
name: Character Certificate (Nepali)
category: certificates
editor_type: designer
description: चरित्र प्रमाणपत्र — formal Nepali-language character certificate with school seal and principal signature
page_size: A4
thumbnail_emoji: 📜
is_default: true
size:
  width: 794
  height: 1123
fields:
- name
- father_name
- class_name
- section
- roll_no
- enrollment_number
autofill:
  sources:
  - school
  dates:
    today_bs: auto
    today_ad: auto
  notes: "Auto dates: {today_bs} / {today_ad} fill automatically at render time. Bulk-generate for a whole class from the designer hub."
""", cc)


# ── 3. Admission application form (प्रवेश आवेदन फारम, A4) ───────────────────
af = []
af.append(rect(0, 0, W, H, "#ffffff", name="page-bg"))
af.append(rect(0, 0, W, 110, "#1e3a5f", name="header-band"))
af.append(image(28, 22, 66, 66, "{school_logo}", "logo-slot", token="school_logo"))
af.append(tb(110, 26, W - 200, "{school_name}", size=24, weight="bold", fill="#ffffff", name="school-name"))
af.append(tb(110, 62, W - 200, "{school_address}  •  फोन: {school_phone}  •  {school_website}", size=11, fill="#bfdbfe", name="school-address"))
af.append(rect(0, 110, W, 34, "#3b82f6", name="title-band"))
af.append(tb(0, 116, W, "प्रवेश आवेदन फारम  |  ADMISSION APPLICATION FORM", size=16, weight="bold", fill="#ffffff", align="center", name="title"))
af.append(tb(40, 160, 260, "आवेदन मिति: {today_bs}", size=12, fill="#374151", name="form-date"))
af.append(tb(W - 260, 160, 220, "फारम नं: ........................", size=12, fill="#374151", align="right", name="form-no"))
af.append(tb(40, 190, W - 80, "विद्यार्थीको विवरण (Student Details)", size=13, weight="bold", fill="#1e3a5f", name="sec1"))
af.append(rect(40, 210, W - 80, 1.2, "#93c5fd", name="sec1-rule"))

def field_rows(items, y, col_w=(300, 320)):
    """two-column dashed field rows: (label_np, label_en)"""
    for i, (lbl_np, lbl_en) in enumerate(items):
        col = i % 2
        x = 40 + col * 380
        yy = y + (i // 2) * 52
        af.append(tb(x, yy, 360, f"{lbl_np} ({lbl_en})", size=11, weight="bold", fill="#475569", name=f"f{i}-lbl"))
        af.append(line(x + 4, yy + 30, x + 340, yy + 30, stroke="#94a3b8", stroke_w=1, dash=[5, 4], name=f"f{i}-line"))

field_rows([
    ("विद्यार्थीको नाम", "Student's Full Name"),
    ("थर", "Surname"),
    ("जन्म मिति (BS)", "Date of Birth (BS)"),
    ("लिङ्ग", "Gender"),
], 226)
af.append(tb(40, 330, W - 80, "अभिभावकको विवरण (Guardian Details)", size=13, weight="bold", fill="#1e3a5f", name="sec2"))
af.append(rect(40, 350, W - 80, 1.2, "#93c5fd", name="sec2-rule"))
field_rows([
    ("बाबुको नाम", "Father's Name"),
    ("आमाको नाम", "Mother's Name"),
    ("सम्पर्क नं", "Contact No."),
    ("इमेल", "Email"),
    ("स्थायी ठेगाना", "Permanent Address"),
    ("अस्थायी ठेगाना", "Temporary Address"),
], 366)
af.append(tb(40, 524, W - 80, "अघिल्लो विद्यालयको विवरण (Previous School)", size=13, weight="bold", fill="#1e3a5f", name="sec3"))
af.append(rect(40, 544, W - 80, 1.2, "#93c5fd", name="sec3-rule"))
field_rows([
    ("विद्यालयको नाम", "School Name"),
    ("उत्तीर्ण कक्षा", "Class Passed"),
    ("प्राप्ताङ्क / GPA", "Marks / GPA"),
    ("सम्पर्क नं", "Contact No."),
], 560)
af.append(tb(40, 700, W - 80, "यस विद्यालयमा भर्ना गराउन चाहेको कक्षा: {class_name}", size=13, weight="bold", fill="#0f172a", name="applied-class"))
af.append(tb(40, 730, W - 80, "मागिएका कागजाता: जन्मदर्ता प्रतिलिपि, अघिल्लो कक्षाको मार्कसिट, चरित्र प्रमाणपत्र, २ कपड फोटो", size=11, fill="#475569", name="docs-note"))
decl = ("घोषणा: माथि उल्लेख गरिएका सम्पूर्ण विवरणहरू सत्य र सही छन् भन्ने कुरा म प्रमाणित गर्दछु।\n"
        "यदि कुनै विवरण गलत ठहरिएमा विद्यालयले भर्ना रद्द गर्न सक्नेछ भन्ने कुरा मलाई थाहा छ।")
af.append(tb(40, 775, W - 80, decl, size=12, fill="#374151", line_h=1.6, name="declaration"))
af.append(tb(40, 880, 300, "अभिभावकको हस्ताक्षर: ..........................", size=12, fill="#334155", name="sig-guardian"))
af.append(tb(40, 930, 300, "मिति: {today_bs}", size=12, fill="#334155", name="sig-date"))
af.append(tb(W - 340, 880, 300, "..........................", size=12, fill="#334155", align="right", name="sig-officer-dots"))
af.append(tb(W - 340, 930, 300, "भर्ना अधिकृतको हस्ताक्षर", size=12, weight="bold", fill="#1e3a5f", align="right", name="sig-officer"))
af.append(tb(40, H - 70, W - 80, "फारम बुझाउने अन्तिम मिति विद्यालयको कार्यालयमा सम्पर्क गर्नुहोला ।  •  {school_phone}", size=10, fill="#94a3b8", align="center", name="footer"))

write_template("admission_form", """template_key: admission_form
name: Admission Application Form
category: reports
editor_type: designer
description: प्रवेश आवेदन फारम — bilingual (Nepali/English) admission application form with dashed fill-in fields
page_size: A4
thumbnail_emoji: 📝
is_default: true
size:
  width: 794
  height: 1123
fields:
- school_name
- class_name
autofill:
  sources:
  - school
  dates:
    today_bs: auto
  notes: Print blank for walk-in applicants, or open in the designer to customise. {today_bs} fills automatically.
""", af)

print("done")
