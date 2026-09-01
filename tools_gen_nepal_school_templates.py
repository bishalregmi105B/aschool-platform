#!/usr/bin/env python3
"""Generate the Nepali school template library (writer + designer templates).

Adds these template folders under backend/app/templates/designer/:

  Writer (editor_type: writer — editable Word-like docs):
    lesson_plan_cdc            Daily lesson plan (CDC Nepal format, EN)
    lesson_plan_cdc_nepali     Daily lesson plan (Nepali/Devanagari)
    meeting_minutes            PTA / staff meeting minutes
    leave_application          Student leave application (bilingual)
    teacher_leave_letter       Teacher leave request (bilingual)
    admission_form_writer      Admission application form (EN + NE labels)
   notice_exam_ne              Exam notice (Nepali)
    parent_meeting_invitation  Parents' Day invitation (bilingual)
    recommendation_letter      Student recommendation letter
    homework_assignment        Weekly homework assignment sheet

  Designer (editor_type: designer — canvas JSON):
    event_banner               Event / annual-day banner (A2 landscape-ish)
    sports_day_poster          Sports Day poster (A4 portrait)
    science_exhibition_flyer   Science exhibition flyer (A4)
    result_sheet_notice        SEE-style result sheet with grading legend

Each writer template mirrors the block schema of report_card_writer
(header_band / columns / table / paragraph / signature / spacer / footer_band).
Designer templates emit a plain {version, background, objects} canvas.json at
96dpi px (matching hiring_poster).

Run from repo root:  python3 tools_gen_nepal_school_templates.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "app", "templates", "designer")

AUTO_YAML = """
autofill:
  sources: [school]
  notes: >
    School fields ({school_name}, {school_address}, {school_phone}, {school_website},
    {school_logo}) merge into every render automatically. Record data (students,
    exams) is provided by bulk generation or the data-fill panel.
"""


def write_writer_template(key: str, name: str, name_ne: str, category: str,
                          description: str, emoji: str, config: dict, blocks: list) -> None:
    out = os.path.join(ROOT, key)
    os.makedirs(out, exist_ok=True)
    yaml = (
        f"template_key: {key}\n"
        f"name: {name}\n"
        f"name_nepali: {name_ne}\n"
        f"category: {category}\n"
        "editor_type: writer\n"
        f"description: \"{description}\"\n"
        f"page_size: {config.get('size', 'A4')}\n"
        f"thumbnail_emoji: \"{emoji}\"\n"
        "is_default: true\n"
        "size: {width: 794, height: 1123}\n"
        "fields:\n"
        "  - school_name\n"
        "  - school_address\n"
        "  - school_phone\n"
        + AUTO_YAML
    )
    open(os.path.join(out, "template.yaml"), "w", encoding="utf-8").write(yaml)
    json.dump({"type": "writer", "config": config, "blocks": blocks},
              open(os.path.join(out, "writer.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)


def write_designer_template(key: str, name: str, name_ne: str, category: str,
                            description: str, emoji: str, page_w: int, page_h: int,
                            page_label: str, fields: list, objects: list,
                            background: str = "#ffffff") -> None:
    out = os.path.join(ROOT, key)
    os.makedirs(out, exist_ok=True)
    yaml_fields = "".join(f"  - {f}\n" for f in fields)
    yaml = (
        f"template_key: {key}\n"
        f"name: {name}\n"
        f"name_nepali: {name_ne}\n"
        f"category: {category}\n"
        "editor_type: designer\n"
        f"description: \"{description}\"\n"
        f"page_size: {page_label}\n"
        f"thumbnail_emoji: \"{emoji}\"\n"
        "is_default: true\n"
        f"size: {{width: {page_w}, height: {page_h}}}\n"
        "fields:\n"
        f"{yaml_fields}"
        + AUTO_YAML
    )
    open(os.path.join(out, "template.yaml"), "w", encoding="utf-8").write(yaml)
    json.dump({"version": "5.3.0", "background": background, "objects": objects},
              open(os.path.join(out, "canvas.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)


# ── fabric object helpers (96dpi px, matching tool_gen templates) ────────────
def textbox(text, x, y, w, h, size=16, color="#0f172a", bold=False, align="left",
            family="Poppins", opacity=1.0, angle=0.0):
    return {
        "type": "textbox", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": x, "top": y, "width": w, "height": h, "text": text,
        "fontSize": size, "fill": color, "fontFamily": family,
        "fontWeight": "bold" if bold else "normal", "textAlign": align,
        "scaleX": 1, "scaleY": 1, "angle": angle, "opacity": opacity,
        "selectable": True, "evented": True,
    }


def rect(x, y, w, h, fill, rx=0, opacity=1.0, stroke=None, stroke_w=1):
    o = {
        "type": "rect", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": x, "top": y, "width": w, "height": h, "fill": fill,
        "rx": rx, "ry": rx, "scaleX": 1, "scaleY": 1, "angle": 0,
        "opacity": opacity, "selectable": True, "evented": True,
    }
    if stroke:
        o["stroke"] = stroke
        o["strokeWidth"] = stroke_w
    return o


def circle(cx, cy, r, fill, opacity=1.0):
    return {
        "type": "circle", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": cx - r, "top": cy - r, "width": r * 2, "height": r * 2,
        "radius": r, "fill": fill, "scaleX": 1, "scaleY": 1, "angle": 0,
        "opacity": opacity, "selectable": True, "evented": True,
    }


def image_slot(x, y, w, h, token, label):
    return {
        "type": "rect", "version": "6.0.0", "originX": "left", "originY": "top",
        "left": x, "top": y, "width": w, "height": h, "fill": "#e2e8f0",
        "rx": 8, "ry": 8, "stroke": "#94a3b8", "strokeWidth": 1.5,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
        "data": {"type": "image_slot", "token": token, "label": label},
    }


# ═══════════════════════════════ WRITER ═══════════════════════════════

def lesson_plan_blocks(lang: str = "en") -> list:
    if lang == "ne":
        return [
            {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | फोन: {school_phone}",
             "tagline": "दैनिक पाठ योजना (CDC ढाँचा)", "bg": "#0e7490", "color": "#ffffff"},
            {"type": "columns", "columns": [
                {"text": "विषय: ___________________", "align": "left"},
                {"text": "कक्षा: _____   मिति (BS): __________", "align": "right"}]},
            {"type": "columns", "columns": [
                {"text": "एकाइ/पाठ: ___________________", "align": "left"},
                {"text": "अवधि: _____ मिनेट", "align": "right"}]},
            {"type": "table", "headers": ["चरण", "समय", "शिक्षकको क्रियाकलाप", "विद्यार्थीको क्रियाकलाप"],
             "rows": [
                 ["पूर्व तयारी / पुनरावृत्ति", "५ मि.", "", ""],
                 ["प्रस्तुतीकरण (नयाँ सामग्री)", "१० मि.", "", ""],
                 ["अभ्यास (निर्देशित)", "१० मि.", "", ""],
                 ["स्वतन्त्र अभ्यास", "१० मि.", "", ""],
                 ["मूल्यांकन / समापन", "५ मि.", "", ""],
                 ["**जम्मा**", "**४५ मि.**", "", ""]]},
            {"type": "paragraph", "text": "सिकाइ उपलब्धि: (पाठ सकिएपछि विद्यार्थीले के गर्न सक्नेछन्?) _______________________________________________", "align": "left", "fontSize": 11},
            {"type": "paragraph", "text": "गृहकार्य: ______________________________   आवश्यक सामग्री: ____________________________", "align": "left", "fontSize": 11},
            {"type": "signature", "labels": ["विषय शिक्षक", "विभाग प्रमुख", "प्रधानाध्यापक"]},
        ]
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | Phone: {school_phone}",
         "tagline": "DAILY LESSON PLAN — CDC NEPAL FORMAT", "bg": "#0e7490", "color": "#ffffff"},
        {"type": "columns", "columns": [
            {"text": "Subject: ___________________", "align": "left"},
            {"text": "Grade: _____   Date (AD/BS): __________", "align": "right"}]},
        {"type": "columns", "columns": [
            {"text": "Unit / Lesson: ___________________", "align": "left"},
            {"text": "Duration: _____ minutes", "align": "right"}]},
        {"type": "paragraph", "text": "Learning Objectives (measurable — students will be able to…):", "align": "left", "bold": True, "fontSize": 11},
        {"type": "paragraph", "text": "1. ____________________________________   2. ____________________________________", "align": "left", "fontSize": 11},
        {"type": "table", "headers": ["Phase", "Time", "Teacher Activities", "Student Activities"],
         "rows": [
             ["Preparation / Review", "5 min", "", ""],
             ["Presentation (new content)", "10 min", "", ""],
             ["Guided Practice", "10 min", "", ""],
             ["Independent Practice", "10 min", "", ""],
             ["Assessment / Closure", "5 min", "", ""],
             ["**Total**", "**45 min**", "", ""]]},
        {"type": "paragraph", "text": "Materials: ____________________________   Differentiation (struggling / advanced): ____________________", "align": "left", "fontSize": 11},
        {"type": "paragraph", "text": "Homework: _________________________________________________________________", "align": "left", "fontSize": 11},
        {"type": "paragraph", "text": "Teacher Reflection (after the lesson): ______________________________________", "align": "left", "fontSize": 11},
        {"type": "signature", "labels": ["Subject Teacher", "Department Head", "Principal"]},
    ]


def meeting_minutes_blocks() -> list:
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | Phone: {school_phone}",
         "tagline": "MINUTES OF THE MEETING", "bg": "#334155", "color": "#ffffff"},
        {"type": "columns", "columns": [
            {"text": "Meeting: ☐ PTA   ☐ Staff   ☐ SMC   ☐ Other: ____________", "align": "left"},
            {"text": "Date (BS): __________", "align": "right"}]},
        {"type": "columns", "columns": [
            {"text": "Venue: ___________________", "align": "left"},
            {"text": "Start Time: __________", "align": "right"}]},
        {"type": "paragraph", "text": "Attendees (name / role): ____________________________________________________________________", "align": "left", "fontSize": 11},
        {"type": "paragraph", "text": "Chairperson: ______________________   Minutes recorded by: ______________________", "align": "left", "fontSize": 11},
        {"type": "heading", "level": 3, "text": "Agenda", "align": "left"},
        {"type": "paragraph", "text": "1. ______________________________   2. ______________________________   3. ______________________________", "align": "left", "fontSize": 11},
        {"type": "heading", "level": 3, "text": "Discussion & Decisions", "align": "left"},
        {"type": "table", "headers": ["#", "Agenda Item", "Discussion Summary", "Decision / Action (who, when)"],
         "rows": [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""], ["4", "", "", ""]]},
        {"type": "paragraph", "text": "Next meeting date: ____________________________", "align": "left", "fontSize": 11},
        {"type": "signature", "labels": ["Minutes Prepared By", "Verified By", "Chairperson"]},
    ]


def leave_application_blocks(student: bool) -> list:
    who = ("Student's Leave Application" if student else "Leave Request — Teaching / Non-teaching Staff")
    if student:
        body = (
            "Respected Sir/Madam,\n\n"
            "I respectfully wish to inform you that my son/daughter ____________________, studying in "
            "Class ______, Section ______, Roll No. ______, could not attend school from ______ to ______ "
            "(____ days) due to ____________________________________. Kindly grant leave for the mentioned period. "
            "The missed lessons and homework will be completed as directed by the class teacher.\n\n"
            "Thank you."
        )
        labels = ["Guardian's Signature", "Class Teacher", "Principal"]
    else:
        body = (
            "The Principal,\n{school_name}\n{school_address}\n\n"
            "Subject: Application for leave\n\n"
            "Respected Sir/Madam,\n\n"
            "I would like to request leave for ______ day(s) from ______ to ______ due to "
            "____________________________________. Arrangements for my classes during this period have been "
            "discussed with the concerned department. Kindly grant me leave for the mentioned dates.\n\n"
            "Thank you."
        )
        labels = ["Applicant", "Department Head", "Principal"]
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | फोन: {school_phone}",
         "tagline": who, "bg": "#7c3aed", "color": "#ffffff"},
        {"type": "columns", "columns": [
            {"text": "Date (BS): __________", "align": "left"},
            {"text": "Date (AD): __________", "align": "right"}]},
        {"type": "paragraph", "text": body, "align": "left", "fontSize": 12},
        {"type": "signature", "labels": labels},
        {"type": "footer_band", "text": "Approved  ☐  Not approved  ☐     Remarks: ______________________________", "bg": "#f1f5f9", "color": "#334155"},
    ]


def admission_form_writer_blocks() -> list:
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | Phone: {school_phone} | {school_website}",
         "tagline": "STUDENT ADMISSION APPLICATION FORM — भर्ना आवेदन फारम", "bg": "#1d4ed8", "color": "#ffffff"},
        {"type": "columns", "columns": [
            {"text": "Photo", "align": "center"},
            {"text": "Application No: ____________\nDate (BS): ____________", "align": "left"}]},
        {"type": "paragraph", "text": "1. Student's Name (in block letters): ______________________________________________________", "align": "left", "fontSize": 11.5},
        {"type": "paragraph", "text": "   विद्यार्थीको नाम: ______________________________________________________", "align": "left", "fontSize": 11.5},
        {"type": "columns", "columns": [
            {"text": "2. Date of Birth (BS): __________", "align": "left"},
            {"text": "(AD): __________", "align": "left"},
            {"text": "3. Gender: ☐ M  ☐ F  ☐ Other", "align": "right"}]},
        {"type": "paragraph", "text": "4. Birth Certificate No.: ______________   5. Citizenship No. (if any): ______________", "align": "left", "fontSize": 11.5},
        {"type": "paragraph", "text": "6. Permanent Address (Province / District / Municipality / Ward): _________________________________", "align": "left", "fontSize": 11.5},
        {"type": "paragraph", "text": "7. Class Applying For: __________   8. Previous School: ____________________   SEE/SLC Regd. No.: __________", "align": "left", "fontSize": 11.5},
        {"type": "heading", "level": 3, "text": "Guardian / Parent Details — अभिभावकको विवरण", "align": "left"},
        {"type": "table", "headers": ["Relation", "Name", "Occupation", "Phone (Mobile)", "Email"],
         "rows": [["Father", "", "", "", ""], ["Mother", "", "", "", ""], ["Local Guardian", "", "", "", ""]]},
        {"type": "heading", "level": 3, "text": "Documents Enclosed — संलग्न कागजात", "align": "left"},
        {"type": "paragraph", "text": "☐ Birth certificate   ☐ Transfer Certificate   ☐ Previous mark-sheet   ☐ Passport photos (4)   ☐ Migration (if any)", "align": "left", "fontSize": 11},
        {"type": "paragraph", "text": "Declaration: I hereby declare that the information provided above is true to the best of my knowledge. / माथि दिइएको विवरण सत्य भएकोले प्रमाणित गर्दछु।", "align": "left", "fontSize": 10.5, "italic": True},
        {"type": "signature", "labels": ["Applicant / Guardian", "Verified By (Admission)", "Principal"]},
        {"type": "footer_band", "text": "For office use: Interview date __________   Result __________   Class section __________", "bg": "#f1f5f9", "color": "#334155"},
    ]


def exam_notice_ne_blocks() -> list:
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | फोन: {school_phone}",
         "tagline": "सूचना — परीक्षा सम्बन्धी", "bg": "#b91c1c", "color": "#ffffff"},
        {"type": "paragraph", "text": "मिति: _____________  (वि.सं.)", "align": "right", "fontSize": 11},
        {"type": "paragraph",
         "text": ("यस विद्यालयको तपसिलका कक्षाहरूको दोस्रो त्रैमासिक परीक्षा नेपाली मिति ______________ गतेदेखि "
                  "तालिकामा उल्लिखित समय अनुसार सञ्चालन हुने भएकोले सम्पूर्ण विद्यार्थीहरू तोकिएको समयमा "
                  "परीक्षा सभाकोठामा उपस्थित हुन अनुरोध गरिन्छ। अन्तिम पाँच मिनेट परीक्षार्थीहरूको हाजिरी "
                  "जाँचिनेछ। केन्द्र भित्र बेकामको सामग्री राख्न पाइने छैन।"),
         "align": "left", "fontSize": 12},
        {"type": "table", "headers": ["दिन / मिति", "पहिलो सिफ्ट (१०:००–१:००)", "दोस्रो सिफ्ट (२:००–५:००)"],
         "rows": [["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""]]},
        {"type": "paragraph", "text": "नोट: परीक्षा शुल्क तोकिएको मितिभित्र बुझाउनुहुन अनुरोध छ। कक्षा १० (SEE) का विद्यार्थीको लागि छुट्टै सूचना जारी गरिनेछ।", "align": "left", "fontSize": 11, "italic": True},
        {"type": "signature", "labels": ["परीक्षा नियन्त्रक", "उपप्रधानाध्यापक", "प्रधानाध्यापक"]},
    ]


def parent_meeting_invitation_blocks() -> list:
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | Phone: {school_phone}",
         "tagline": "PARENTS' DAY & RESULT DISCUSSION — अभिभावक भेटघाट", "bg": "#047857", "color": "#ffffff"},
        {"type": "paragraph", "text": "Dear Parents / Guardians, प्यारा अभिभावकवर्ग,", "align": "left", "bold": True, "fontSize": 12},
        {"type": "paragraph",
         "text": ("We are pleased to invite you to the Parents' Day and one-to-one result discussion session. "
                  "आगामी ______________ (मिति) गते __________ बजे हुने अभिभावक भेटघाट कार्यक्रममा उपस्थित हुन "
                  "हार्दिक अनुरोध गर्दछौँ। कार्यक्रममा विद्यार्थीको शैक्षिक प्रगति, उपस्थिति र सुधारका उपायहरूबारे "
                  "कक्षा अध्यापकसँग प्रत्यक्ष छलफल हुनेछ।"),
         "align": "left", "fontSize": 12},
        {"type": "table", "headers": ["Item / विवरण", "Details / विवरण"],
         "rows": [
             ["Date / मिति (BS)", ""],
             ["Time / समय", ""],
             ["Venue / स्थान", ""],
             ["Class Teacher", ""]]},
        {"type": "paragraph", "text": "Session slots (15 minutes each) — please arrive 10 minutes before your slot: ☐ 10:00  ☐ 11:00  ☐ 12:00  ☐ 13:00", "align": "left", "fontSize": 11},
        {"type": "signature", "labels": ["Class Teacher", "Co-ordinator", "Principal"]},
        {"type": "footer_band", "text": "{school_phone}  |  {school_website}", "bg": "#047857", "color": "#ffffff"},
    ]


def recommendation_letter_blocks() -> list:
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | Phone: {school_phone} | {school_website}",
         "tagline": "TO WHOM IT MAY CONCERN", "bg": "#0f172a", "color": "#ffffff"},
        {"type": "paragraph", "text": "Date: ____________ (BS)   Ref. No.: ____________", "align": "left", "fontSize": 11},
        {"type": "paragraph",
         "text": ("This is to certify that Mr./Ms. ________________________________________ was a bonafide student "
                  "of this school from ______ to ______ in Class __________ (Roll No. ______). During his/her "
                  "stay, his/her academic performance, conduct and character were found to be very good / excellent. "
                  "He/She is hardworking, disciplined and co-operative. We wish him/her every success in future "
                  "endeavours. This certificate is issued upon his/her request for ____________________ purpose."),
         "align": "left", "fontSize": 12},
        {"type": "columns", "columns": [
            {"text": "Attendance: ______ %", "align": "left"},
            {"text": "GPA (last exam): ______", "align": "center"},
            {"text": "Conduct: ____________", "align": "right"}]},
        {"type": "signature", "labels": ["Class Teacher", "Vice-Principal", "Principal"]},
        {"type": "footer_band", "text": "This letter is valid with the school seal only. / छाप बिना यो प्रमाणपत्र मान्य हुने छैन।", "bg": "#f1f5f9", "color": "#475569"},
    ]


def homework_assignment_blocks() -> list:
    return [
        {"type": "header_band", "school": "{school_name}", "subtitle": "{school_address} | Phone: {school_phone}",
         "tagline": "WEEKLY HOMEWORK ASSIGNMENT — साप्ताहिक गृहकार्य", "bg": "#ea580c", "color": "#ffffff"},
        {"type": "columns", "columns": [
            {"text": "Class: ______  Section: ______", "align": "left"},
            {"text": "Week: ____________  Submitted by: ____________", "align": "right"}]},
        {"type": "table", "headers": ["Day", "Subject", "Homework", "Parent's Sign"],
         "rows": [
             ["Sunday", "", "", ""],
             ["Monday", "", "", ""],
             ["Tuesday", "", "", ""],
             ["Wednesday", "", "", ""],
             ["Thursday", "", "", ""],
             ["Friday", "", "", ""]]},
        {"type": "paragraph", "text": "Notes for parents: Please sign daily after checking that the homework is completed. / गृहकार्य पूरा भएको जाँच गरी दैनिक हस्ताक्षर गर्नुहुन अनुरोध छ।", "align": "left", "fontSize": 10.5, "italic": True},
        {"type": "signature", "labels": ["Student", "Parent / Guardian", "Class Teacher"]},
    ]


# ═══════════════════════════════ DESIGNER ═══════════════════════════════

def event_banner_objects() -> list:
    W = 1191
    objs = [
        rect(0, 0, W, 240, "#0f172a"),
        rect(0, 240, W, 8, "#f59e0b"),
        textbox("{school_name}", 60, 60, 800, 70, size=44, color="#ffffff", bold=True),
        textbox("{school_address}  •  Phone: {school_phone}", 62, 140, 700, 30, size=16, color="#cbd5e1"),
        textbox("ANNOUNCING", 60, 300, 400, 36, size=22, color="#b45309", bold=True),
        textbox("ANNUAL DAY & CULTURAL PROGRAM २०८३", 60, 344, 1000, 90, size=52, color="#0f172a", bold=True),
        textbox("Date / मिति: ____________ (BS)      Time: ____________      Venue: School Main Hall", 60, 470, 1000, 40, size=20, color="#334155"),
        rect(60, 560, 1071, 420, "#eef2f7", rx=14),
        textbox("PROGRAMME / कार्यक्रम", 90, 590, 500, 40, size=24, color="#0f172a", bold=True),
        textbox("10:00  Arrival of Chief Guest & Flag Ceremony\n10:20  Welcome Speech & Annual Report\n"
                "11:00  Cultural Performances (Dance • Music • Drama)\n12:30  Prize Distribution & Report Card Handover\n"
                "13:15  Closing & National Anthem", 90, 645, 640, 300, size=17, color="#1e293b"),
        image_slot(790, 590, 300, 360, "chief_guest_photo", "Chief Guest / Event photo (replace)"),
        textbox("Chief Guest: ______________________", 90, 950, 600, 30, size=16, color="#334155"),
    ]
    for cx, cy, r, c in [(1100, 90, 34, "#f59e0b"), (1140, 180, 20, "#38bdf8"), (1060, 40, 12, "#fbbf24")]:
        objs.append(circle(cx, cy, r, c, opacity=0.9))
    return objs


def sports_day_poster_objects() -> list:
    objs = [
        rect(0, 0, 794, 1123, "#0b3f8f"),
        rect(0, 0, 794, 320, "#08306e"),
        circle(660, 160, 90, "#f59e0b", opacity=0.95),
        textbox("{school_name}", 50, 60, 560, 66, size=38, color="#ffffff", bold=True),
        textbox("{school_address}", 52, 132, 500, 30, size=16, color="#cbd5e1"),
        textbox("ANNUAL SPORTS DAY  २०८३", 50, 360, 694, 80, size=52, color="#ffffff", bold=True, align="center"),
        textbox("Sat __ / __ (BS)  •  9 AM – 4 PM  •  School Ground", 50, 452, 694, 40, size=22, color="#fde68a", align="center"),
        rect(50, 540, 694, 340, "#ffffff", rx=16),
        textbox("EVENTS / प्रतियोगिता", 80, 565, 400, 36, size=24, color="#08306e", bold=True),
        textbox("• 100m / 200m Sprint        • High Jump & Long Jump\n"
                "• Relay Race (4×100m)        • Tug of War\n"
                "• Sack Race (Primary)        • Chess & Carrom\n"
                "• Cheering Competition       • Teachers' Relay", 80, 610, 640, 230, size=18, color="#1e293b"),
        textbox("Registration: Class Teachers by ____________  |  Prizes for winners & runners-up", 50, 910, 694, 36, size=17, color="#e2e8f0", align="center"),
        textbox("Everyone is welcome! सबैलाई स्वागत छ", 50, 970, 694, 42, size=26, color="#f59e0b", bold=True, align="center"),
        textbox("Phone: {school_phone}  •  {school_website}", 50, 1040, 694, 28, size=14, color="#cbd5e1", align="center"),
    ]
    return objs


def science_exhibition_flyer_objects() -> list:
    objs = [
        rect(0, 0, 794, 1123, "#ffffff"),
        rect(0, 0, 794, 12, "#0d9488"),
        rect(0, 1111, 794, 12, "#0d9488"),
        circle(90, 110, 46, "#ccfbf1"),
        circle(700, 150, 28, "#99f6e4"),
        textbox("SCIENCE EXHIBITION २०८३", 40, 70, 714, 70, size=40, color="#0f766e", bold=True, align="center"),
        textbox("{school_name}  •  {school_address}", 40, 150, 714, 34, size=18, color="#334155", align="center"),
        textbox("\"Innovations for a Better Tomorrow\" — models, working demos & projects by students of Grades 4–10.",
                60, 220, 674, 60, size=17, color="#475569", align="center"),
        rect(60, 320, 320, 300, "#f0fdfa", rx=12, stroke="#0d9488", stroke_w=1.5),
        textbox("FOR STUDENTS", 84, 344, 260, 32, size=18, color="#0f766e", bold=True),
        textbox("• Team of max 3 students\n• Model + 3-min demo\n• Register by ____________\n• Setup: hall A, 8 AM", 84, 388, 280, 180, size=15, color="#134e4a"),
        rect(414, 320, 320, 300, "#eff6ff", rx=12, stroke="#1d4ed8", stroke_w=1.5),
        textbox("FOR VISITORS", 438, 344, 260, 32, size=18, color="#1e40af", bold=True),
        textbox("• Entry: free / free\n• Open: 10 AM – 3 PM\n• Science quiz at 1 PM\n• Stalls & food corner", 438, 388, 280, 180, size=15, color="#1e3a8a"),
        image_slot(60, 660, 320, 220, "event_photo", "Science fair photo (replace)"),
        image_slot(414, 660, 320, 220, "event_photo", "Last year's exhibit (replace)"),
        textbox("Date / मिति: ____________ (BS)      Venue: School Hall", 60, 920, 674, 34, size=19, color="#0f172a", bold=True, align="center"),
        textbox("Contact: {school_phone}  •  {school_website}", 60, 968, 674, 30, size=15, color="#475569", align="center"),
    ]
    return objs


def result_sheet_notice_objects() -> list:
    objs = [
        rect(0, 0, 794, 1123, "#ffffff"),
        rect(0, 0, 794, 170, "#1e3a8a"),
        textbox("{school_name}", 40, 34, 560, 60, size=36, color="#ffffff", bold=True),
        textbox("{school_address}  •  {school_phone}", 42, 100, 560, 26, size=15, color="#dbeafe"),
        textbox("RESULT SHEET — SEE MOCK (PRE-BOARD)", 40, 200, 714, 44, size=26, color="#1e3a8a", bold=True),
        textbox("परीक्षाफल प्रकाशन — Class 10", 40, 248, 714, 30, size=18, color="#475569"),
        {"type": "rect", "version": "6.0.0", "originX": "left", "originY": "top", "left": 40, "top": 300,
         "width": 714, "height": 470, "fill": "#f8fafc", "rx": 10, "ry": 10, "stroke": "#cbd5e1",
         "strokeWidth": 1.5, "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
         "selectable": True, "evented": True, "data": {"type": "table_placeholder", "label": "Result table — use Data Fill"}},
        textbox("Grading legend (NEB): A+ 90–100 (4.0) • A 80–89 (3.6) • B+ 70–79 (3.2) • B 60–69 (2.8) • C+ 50–59 (2.4) • C 40–49 (2.0) • D 35–39 (1.6)",
                40, 800, 714, 54, size=14, color="#334155"),
        textbox("Result publication date / मिति: ____________   Time: ______   Place: School Hall", 40, 880, 714, 34, size=17, color="#0f172a", bold=True),
        textbox("Students must collect the mark-sheet in person; parents are requested to accompany them.", 40, 926, 714, 30, size=14, color="#475569"),
        textbox("Principal: ______________________", 40, 1000, 400, 30, size=15, color="#334155"),
    ]
    return objs


# ═══════════════════════════════ MAIN ═══════════════════════════════

def main() -> None:
    cfg = {"size": "A4", "orientation": "portrait", "font": "Times New Roman", "fontSize": 12}

    write_writer_template(
        "lesson_plan_cdc", "Lesson Plan (CDC Format)", "दैनिक पाठ योजना",
        "lesson_plans", "Daily lesson plan following Nepal CDC structure — 45-min phases, objectives, reflection.",
        "📋", cfg, lesson_plan_blocks("en"))
    write_writer_template(
        "lesson_plan_cdc_nepali", "Lesson Plan (Nepali)", "दैनिक पाठ योजना (नेपाली)",
        "lesson_plans", "Nepali-language daily lesson plan following the CDC Nepal 45-minute phase structure.",
        "📋", cfg, lesson_plan_blocks("ne"))
    write_writer_template(
        "meeting_minutes", "Meeting Minutes", "बैठक निर्णय",
        "notices", "PTA / staff / SMC meeting minutes with agenda, decisions and action table.",
        "🗓", cfg, meeting_minutes_blocks())
    write_writer_template(
        "leave_application", "Student Leave Application", "बिदा आवेदन (विद्यार्थी)",
        "letters", "Student leave application — guardian request with approval footer.",
        "✉", cfg, leave_application_blocks(student=True))
    write_writer_template(
        "teacher_leave_letter", "Teacher Leave Request", "बिदा आवेदन (शिक्षक)",
        "letters", "Teacher / staff leave request letter with approval footer.",
        "✉", cfg, leave_application_blocks(student=False))
    write_writer_template(
        "admission_form_writer", "Admission Form (Bilingual)", "भर्ना आवेदन फारम",
        "forms", "Bilingual admission application — student info, guardian table, document checklist, office footer.",
        "📝", cfg, admission_form_writer_blocks())
    write_writer_template(
        "notice_exam_ne", "Exam Notice (Nepali)", "परीक्षा सूचना",
        "notices", "Nepali-language exam notice — routine table, rules and controller/principal signatures.",
        "📢", cfg, exam_notice_ne_blocks())
    write_writer_template(
        "parent_meeting_invitation", "Parents' Day Invitation", "अभिभावक भेटघाट सूचना",
        "notices", "Bilingual Parents' Day invitation with slot booking and session details table.",
        "🤝", cfg, parent_meeting_invitation_blocks())
    write_writer_template(
        "recommendation_letter", "Recommendation Letter", "सिफारिस पत्र",
        "letters", "To-whom-it-may-concern student recommendation with GPA/conduct strip and validity footer.",
        "🎓", cfg, recommendation_letter_blocks())
    write_writer_template(
        "homework_assignment", "Homework Assignment Sheet", "साप्ताहिक गृहकार्य",
        "lesson_plans", "Weekly homework grid with daily parent-signature column and Nepali note.",
        "📚", cfg, homework_assignment_blocks())

    write_designer_template(
        "event_banner", "Event / Annual Day Banner", "वार्षिकोत्सव ब्यानर",
        "banners", "A3-landscape annual-day banner — dark header band, programme column, chief-guest photo slot.",
        "🎉", 1191, 1000, "A3 Landscape (wide)", 
        ["school_name", "school_address", "school_phone", "chief_guest_photo"],
        event_banner_objects(), background="#0f172a")
    write_designer_template(
        "sports_day_poster", "Sports Day Poster", "खेलकुद दिवस पोस्टर",
        "posters", "A4 sports-day poster — events list, date/venue strip, welcome banner.",
        "🏅", 794, 1123, "A4",
        ["school_name", "school_address", "school_phone", "school_website"],
        sports_day_poster_objects(), background="#0b3f8f")
    write_designer_template(
        "science_exhibition_flyer", "Science Exhibition Flyer", "विज्ञान प्रदर्शनी",
        "posters", "A4 bilingual science-exhibition flyer — student/visitor info cards and two photo slots.",
        "🔬", 794, 1123, "A4",
        ["school_name", "school_address", "school_phone", "school_website", "event_photo"],
        science_exhibition_flyer_objects())
    write_designer_template(
        "result_sheet_notice", "Result Publication Notice", "परीक्षाफल सूचना",
        "notices", "A4 SEE-mock result publication notice with NEB grading legend and table placeholder.",
        "🧾", 794, 1123, "A4",
        ["school_name", "school_address", "school_phone"],
        result_sheet_notice_objects())

    print("Wrote 14 Nepali school templates under", ROOT)


if __name__ == "__main__":
    main()
