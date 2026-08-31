"""Template Engine — all templates stored as fabric.js canvas JSON (data-driven)."""

import copy
import html
import json
import math
import re


# ── helpers ────────────────────────────────────────────────────────────────────

def _rect(left, top, width, height, fill="#3b82f6", **kw):
    base = {
        "type": "rect", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "fill": fill, "stroke": None, "strokeWidth": 1,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True, "rx": 0, "ry": 0,
    }
    base.update(kw)
    return base


def _text(left, top, width, text, size=12, bold=False, italic=False,
          color="#1e293b", align="center", family="Arial", editable=True, **kw):
    base = {
        "type": "textbox", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "text": text,
        "fontSize": size, "fontWeight": "bold" if bold else "normal",
        "fontStyle": "italic" if italic else "normal",
        "fill": color, "textAlign": align, "fontFamily": family,
        "editable": editable, "splitByGrapheme": False,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    }
    base.update(kw)
    return base


def _line(left, top, x2, color="#334155", stroke_w=1):
    return {
        "type": "line", "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": left, "top": top,
        "x1": 0, "y1": 0, "x2": x2, "y2": 0,
        "stroke": color, "strokeWidth": stroke_w,
        "width": abs(x2), "height": 0,
        "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
        "selectable": True, "evented": True,
    }


def _canvas(objects, bg="#ffffff"):
    return {"version": "6.0.0", "background": bg, "objects": objects}


def _image(left, top, width, height, src="", **kw):
    """Fabric v6 Image object for canvas JSON. src accepts a URL or {token}."""
    base = {
        "type": "Image",
        "version": "6.0.0",
        "originX": "left", "originY": "top",
        "left": left, "top": top,
        "width": width, "height": height,
        "scaleX": 1, "scaleY": 1,
        "angle": 0, "opacity": 1,
        "src": src,
        "crossOrigin": "anonymous",
        "selectable": True, "evented": True,
    }
    base.update(kw)
    return base


# ── Template functions ─────────────────────────────────────────────────────────

def _id_card_standard():
    W = 300
    return _canvas([
        _rect(0, 0, W, 42, "#1e40af", rx=0, ry=0, selectable=False),
        _text(6, 7, W - 12, "{school_name}", 13, bold=True, color="#ffffff"),
        _text(6, 23, W - 12, "Est. 2001  •  Affiliated to CBSE | BSE", 7, color="#93c5fd"),
        _rect(10, 52, 68, 90, "#e2e8f0", stroke="#94a3b8", strokeWidth=1, rx=4, ry=4),
        _image(10, 52, 68, 90, "{photo_url}"),
        _text(86, 52, W - 96, "{name}", 13, bold=True, color="#1e293b", align="left"),
        _text(86, 72, W - 96, "Class: {class}  Sec: {section}  Roll: {roll_no}", 9, color="#334155", align="left"),
        _text(86, 88, W - 96, "DOB: {dob}  Blood: {blood_group}", 9, color="#334155", align="left"),
        _text(86, 104, 160, "Phone: {phone}", 9, color="#334155", align="left"),
        _text(86, 118, 164, "Address: {address}", 8, color="#64748b", align="left"),
        # QR verification box — empty {qr_code} degrades to blank space
        _image(258, 112, 32, 32, "{qr_code}"),
        _line(0, 152, W, "#cbd5e1"),
        _text(6, 157, W - 12, "{school_address}  •  {school_phone}  •  {school_website}", 7, color="#64748b"),
    ])


def _id_card_staff():
    W = 300
    return _canvas([
        _rect(0, 0, W, 60, "#059669", selectable=False),
        _text(6, 6, W - 12, "{school_name}", 13, bold=True, color="#ffffff"),
        _text(6, 24, W - 12, "STAFF IDENTIFICATION CARD", 8, color="#6ee7b7"),
        _rect(W - 78, 68, 68, 90, "#e2e8f0", stroke="#94a3b8", strokeWidth=1, rx=4, ry=4),
        _image(W - 78, 68, 68, 90, "{photo_url}"),
        _text(10, 68, W - 90, "{name}", 13, bold=True, color="#1e293b", align="left"),
        _text(10, 88, W - 90, "Designation: {designation}", 9, color="#334155", align="left"),
        _text(10, 104, W - 90, "Department: {department}", 9, color="#334155", align="left"),
        _text(10, 120, W - 90, "Emp ID: {employee_id}", 9, color="#334155", align="left"),
        _text(10, 136, W - 90, "Phone: {phone}", 9, color="#64748b", align="left"),
        _line(0, 162, W, "#d1fae5"),
        _text(6, 167, W - 12, "{school_address}  •  {school_phone}  •  {school_website}", 7, color="#64748b"),
    ])


def _character_certificate():
    W = 794
    return _canvas([
        _rect(20, 20, W - 40, 1083, "transparent", stroke="#1e40af", strokeWidth=3, rx=8, ry=8),
        _rect(32, 32, W - 64, 1059, "transparent", stroke="#93c5fd", strokeWidth=1, rx=6, ry=6),
        _text(50, 80, W - 100, "YOUR SCHOOL NAME", 30, bold=True, color="#1e40af"),
        _text(50, 120, W - 100, "School Address, City | Phone | www.school.edu", 12, color="#64748b"),
        _line(80, 158, W - 160, "#1e40af", 2),
        _text(50, 172, W - 100, "CHARACTER CERTIFICATE", 24, bold=True, color="#0f172a"),
        _text(50, 240, W - 100, "This is to certify that", 14, color="#334155"),
        _text(50, 270, W - 100, "{name}", 18, bold=True, color="#1e293b"),
        _text(50, 310, W - 100, "S/D/O: {father_name}    Class: {class} {section}", 13, color="#334155"),
        _text(50, 345, W - 100, "Enrollment No.: {enrollment_number}", 13, color="#334155"),
        _text(50, 380, W - 100, "has been a student of this institution and bears", 13, color="#334155"),
        _text(50, 410, W - 100, "a good moral character and conduct.", 13, color="#334155"),
        _text(50, 450, W - 100, "We wish him/her all the best for future endeavours.", 13, color="#334155"),
        _text(65, 620, 200, "Date: {date}", 12, color="#334155", align="left"),
        _text(W - 280, 620, 210, "Principal / Headmaster", 12, color="#334155", align="right"),
        _line(W - 280, 660, 200, "#334155"),
        _text(W - 280, 666, 200, "Signature with School Seal", 10, color="#64748b", align="center"),
    ])


def _transfer_certificate():
    W = 794
    return _canvas([
        _rect(20, 20, W - 40, 1083, "transparent", stroke="#dc2626", strokeWidth=3, rx=8, ry=8),
        _rect(32, 32, W - 64, 1059, "transparent", stroke="#fca5a5", strokeWidth=1, rx=6, ry=6),
        _text(50, 70, W - 100, "YOUR SCHOOL NAME", 28, bold=True, color="#dc2626"),
        _text(50, 108, W - 100, "School Address | Phone | www.school.edu", 12, color="#64748b"),
        _line(80, 146, W - 160, "#dc2626", 2),
        _text(50, 162, W - 100, "TRANSFER CERTIFICATE", 24, bold=True, color="#1e293b"),
        _text(50, 220, W - 100, "Certificate No.: {enrollment_number}", 11, color="#64748b"),
        _text(50, 255, W - 100, "1.  Name of Student     :  {name}", 12, color="#334155", align="left"),
        _text(50, 285, W - 100, "2.  Father's Name       :  {father_name}", 12, color="#334155", align="left"),
        _text(50, 315, W - 100, "3.  Mother's Name       :  {mother_name}", 12, color="#334155", align="left"),
        _text(50, 345, W - 100, "4.  Date of Admission  :  {admission_date}", 12, color="#334155", align="left"),
        _text(50, 375, W - 100, "5.  Date of Birth        :  {dob}", 12, color="#334155", align="left"),
        _text(50, 405, W - 100, "6.  Class last studied   :  {class}  Section: {section}", 12, color="#334155", align="left"),
        _text(50, 435, W - 100, "7.  Reason for leaving  :  {leaving_reason}", 12, color="#334155", align="left"),
        _text(50, 465, W - 100, "8.  Date of leaving      :  {leaving_date}", 12, color="#334155", align="left"),
        _text(50, 495, W - 100, "9.  Conduct & Character  :  {conduct}", 12, color="#334155", align="left"),
        _text(50, 600, W - 100, "Certified that the above entries are taken from school records.", 12, italic=True, color="#475569"),
        _text(65, 700, 200, "Date: {date}", 12, color="#334155", align="left"),
        _text(W - 280, 700, 200, "Headmaster / Principal", 12, color="#334155", align="right"),
        _line(W - 280, 740, 200, "#334155"),
        _text(W - 280, 746, 200, "Signature with Seal", 10, color="#64748b", align="center"),
    ])


def _merit_certificate():
    W, H = 1123, 794
    return _canvas([
        _rect(0, 0, W, H, "#fef3c7"),
        _rect(24, 24, W - 48, H - 48, "transparent", stroke="#d97706", strokeWidth=4, rx=12, ry=12),
        _rect(36, 36, W - 72, H - 72, "transparent", stroke="#fbbf24", strokeWidth=1, rx=10, ry=10),
        _text(60, 70, W - 120, "CERTIFICATE OF MERIT", 32, bold=True, color="#92400e"),
        _text(60, 118, W - 120, "YOUR SCHOOL NAME", 16, bold=True, color="#d97706"),
        _line(120, 152, W - 240, "#d97706", 2),
        _text(60, 178, W - 120, "This certificate is proudly presented to", 16, color="#78350f"),
        _text(60, 220, W - 120, "{name}", 26, bold=True, color="#1e293b"),
        _text(60, 268, W - 120, "of Class: {class}  Section: {section}  Roll No: {roll_no}", 14, color="#44403c"),
        _text(60, 320, W - 120, "In recognition of outstanding achievement in", 14, color="#78350f"),
        _text(60, 356, W - 120, "{achievement}", 18, bold=True, color="#92400e"),
        _text(60, 400, W - 120, "Ranked  {rank}  in  {event_name}", 14, color="#44403c"),
        _text(60, 434, W - 120, "We congratulate and wish continued success in all future endeavours.", 13, italic=True, color="#57534e"),
        _text(160, 640, 200, "Date: {date}", 12, color="#334155", align="left"),
        _text(W // 2 - 100, 640, 200, "Class Teacher", 12, color="#334155", align="center"),
        _text(W - 360, 640, 200, "Principal", 12, color="#334155", align="right"),
        _line(160, 680, 200, "#334155"),
        _line(W // 2 - 100, 680, 200, "#334155"),
        _line(W - 360, 680, 200, "#334155"),
    ])


def _participation_certificate():
    W, H = 1123, 794
    return _canvas([
        _rect(0, 0, W, H, "#f0fdf4"),
        _rect(24, 24, W - 48, H - 48, "transparent", stroke="#16a34a", strokeWidth=4, rx=12, ry=12),
        _rect(36, 36, W - 72, H - 72, "transparent", stroke="#86efac", strokeWidth=1, rx=10, ry=10),
        _text(60, 72, W - 120, "CERTIFICATE OF PARTICIPATION", 30, bold=True, color="#14532d"),
        _text(60, 118, W - 120, "YOUR SCHOOL NAME", 16, bold=True, color="#16a34a"),
        _line(120, 152, W - 240, "#16a34a", 2),
        _text(60, 178, W - 120, "This is to certify that", 16, color="#166534"),
        _text(60, 218, W - 120, "{name}", 26, bold=True, color="#1e293b"),
        _text(60, 265, W - 120, "Class: {class}  Section: {section}  Roll No: {roll_no}", 14, color="#15803d"),
        _text(60, 310, W - 120, "has participated in the", 14, color="#166534"),
        _text(60, 344, W - 120, "{event_name}", 18, bold=True, color="#14532d"),
        _text(60, 390, W - 120, "held on  {event_date}  at  {event_venue}", 14, color="#166534"),
        _text(60, 430, W - 120, "We appreciate the participation and encourage continued growth.", 13, italic=True, color="#166534"),
        _text(160, 640, 200, "Date: {date}", 12, color="#334155", align="left"),
        _text(W - 360, 640, 200, "Principal", 12, color="#334155", align="right"),
        _line(160, 680, 200, "#334155"),
        _line(W - 360, 680, 200, "#334155"),
    ])


def _admit_card_standard():
    W, H = 559, 794
    rows = []
    for i in range(4):
        y = 288 + i * 24
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        rows += [
            _rect(30, y, W - 60, 24, bg, stroke="#e2e8f0", strokeWidth=1),
            _text(30, y + 4, 100, "___________", 9, color="#334155", align="center"),
            _text(130, y + 4, 120, "___________", 9, color="#334155", align="center"),
            _text(250, y + 4, 100, "___________", 9, color="#334155", align="center"),
            _text(350, y + 4, 100, "___________", 9, color="#334155", align="center"),
        ]
    return _canvas([
        _rect(10, 10, W - 20, H - 20, "transparent", stroke="#0f172a", strokeWidth=2),
        _rect(10, 10, W - 20, 58, "#1e40af", selectable=False),
        _text(14, 15, W - 28, "YOUR SCHOOL NAME", 15, bold=True, color="#ffffff"),
        _text(14, 36, W - 28, "Affiliated to Board | www.school.edu", 9, color="#bfdbfe"),
        _rect(30, 82, W - 60, 28, "#dbeafe", stroke="#93c5fd", strokeWidth=1),
        _text(30, 87, W - 60, "ADMIT CARD — {exam_name}", 13, bold=True, color="#1e40af"),
        _rect(W - 110, 124, 84, 100, "#f1f5f9", stroke="#cbd5e1", strokeWidth=1),
        _text(W - 104, 160, 72, "PHOTO", 9, color="#94a3b8", editable=True),
        _text(30, 124, 100, "Student Name:", 10, bold=True, color="#0f172a", align="left"),
        _text(142, 124, W - 272, "{name}", 10, color="#334155", align="left"),
        _text(30, 148, 50, "Class:", 10, bold=True, color="#0f172a", align="left"),
        _text(84, 148, 120, "{class}", 10, color="#334155", align="left"),
        _text(220, 148, 62, "Roll No.:", 10, bold=True, color="#0f172a", align="left"),
        _text(286, 148, 80, "{roll_no}", 10, color="#334155", align="left"),
        _text(30, 172, 50, "DOB:", 10, bold=True, color="#0f172a", align="left"),
        _text(68, 172, 160, "{dob}", 10, color="#334155", align="left"),
        _text(30, 196, 110, "Father's Name:", 10, bold=True, color="#0f172a", align="left"),
        _text(144, 196, W - 174, "______________________", 10, color="#334155", align="left"),
        _line(30, 236, W - 60, "#94a3b8"),
        _text(30, 244, W - 60, "EXAMINATION SCHEDULE", 12, bold=True, color="#1e40af"),
        _rect(30, 264, W - 60, 24, "#1e40af"),
        _text(30, 268, 100, "Subject", 9, bold=True, color="#ffffff", align="center"),
        _text(130, 268, 120, "Date", 9, bold=True, color="#ffffff", align="center"),
        _text(250, 268, 100, "Time", 9, bold=True, color="#ffffff", align="center"),
        _text(350, 268, 100, "Venue", 9, bold=True, color="#ffffff", align="center"),
        *rows,
        _line(30, 385, W - 60, "#cbd5e1"),
        _text(30, 395, W - 60, "Instructions: Bring this card to exam. Not transferable. Mobile phones not allowed.", 8, italic=True, color="#64748b"),
        _text(30, 720, 140, "Date: __________", 10, color="#334155", align="left"),
        _text(W - 200, 720, 160, "Principal Signature", 10, color="#334155", align="right"),
        _line(W - 200, 748, 160, "#334155"),
    ])


def _admit_card_hall_ticket():
    W, H = 559, 794
    rows = []
    for i in range(5):
        y = 262 + i * 22
        bg = "#f5f3ff" if i % 2 == 0 else "#ffffff"
        rows += [
            _rect(18, y, W - 36, 22, bg, stroke="#ede9fe", strokeWidth=1),
            _text(18, y + 4, 160, "_____________", 9, color="#334155", align="center"),
            _text(178, y + 4, 120, "_____________", 9, color="#334155", align="center"),
            _text(298, y + 4, 100, "_____________", 9, color="#334155", align="center"),
        ]
    return _canvas([
        _rect(10, 10, W - 20, H - 20, "transparent", stroke="#7c3aed", strokeWidth=2),
        _rect(10, 10, W - 20, 72, "#7c3aed", selectable=False),
        _text(14, 14, W - 28, "YOUR SCHOOL NAME", 15, bold=True, color="#ffffff"),
        _text(14, 34, W - 28, "HALL TICKET — ANNUAL EXAMINATION", 12, bold=True, color="#ede9fe"),
        _text(14, 52, W - 28, "Year: ________", 10, color="#c4b5fd"),
        _rect(W - 112, 86, 88, 108, "#f5f3ff", stroke="#c4b5fd", strokeWidth=1),
        _text(W - 108, 130, 80, "PHOTO", 9, color="#8b5cf6", editable=True),
        _text(18, 90, 120, "Candidate Name:", 10, bold=True, color="#1e293b", align="left"),
        _text(146, 90, W - 282, "______________________________", 10, color="#334155", align="left"),
        _text(18, 114, 60, "Roll No.:", 10, bold=True, color="#1e293b", align="left"),
        _text(82, 114, 120, "__________", 10, color="#7c3aed", bold=True, align="left"),
        _text(18, 138, 50, "Class:", 10, bold=True, color="#1e293b", align="left"),
        _text(72, 138, 120, "__________", 10, color="#334155", align="left"),
        _text(18, 162, 60, "Centre:", 10, bold=True, color="#1e293b", align="left"),
        _text(82, 162, W - 120, "______________________", 10, color="#334155", align="left"),
        _line(18, 208, W - 36, "#7c3aed", 2),
        _text(18, 218, W - 36, "SUBJECT WISE SCHEDULE", 12, bold=True, color="#7c3aed"),
        _rect(18, 238, W - 36, 22, "#7c3aed"),
        _text(18, 242, 160, "Subject", 9, bold=True, color="#ffffff", align="center"),
        _text(178, 242, 120, "Date", 9, bold=True, color="#ffffff", align="center"),
        _text(298, 242, 100, "Shift / Time", 9, bold=True, color="#ffffff", align="center"),
        *rows,
        _line(18, 375, W - 36, "#cbd5e1"),
        _text(18, 383, W - 36, "Report 30 min before exam. Carry throughout. Mobile phones not allowed.", 8, italic=True, color="#64748b"),
        _text(18, 720, 140, "Issue Date: ______", 10, color="#334155", align="left"),
        _text(W - 220, 720, 190, "Controller of Examinations", 10, color="#334155", align="right"),
        _line(W - 220, 748, 190, "#334155"),
    ])


def _report_card():
    W = 794
    subject_rows = []
    for i in range(8):
        y = 201 + i * 26
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        subject_rows += [
            _rect(20, y, W - 40, 26, bg, stroke="#e2e8f0", strokeWidth=1),
            _text(20, y + 5, 200, f"Subject {i + 1}", 10, color="#334155", align="center"),
            _text(220, y + 5, 90, "100", 10, color="#334155", align="center"),
            _text(310, y + 5, 90, "___", 10, color="#334155", align="center"),
            _text(400, y + 5, 60, "___", 10, color="#334155", align="center"),
            _text(460, y + 5, 60, "Good", 10, color="#334155", align="center"),
        ]
    return _canvas([
        _rect(0, 0, W, 88, "#1e40af", selectable=False),
        _text(20, 10, W - 40, "YOUR SCHOOL NAME", 22, bold=True, color="#ffffff"),
        _text(20, 40, W - 40, "School Address | Phone | www.school.edu", 11, color="#bfdbfe"),
        _text(20, 60, W - 40, "ACADEMIC PROGRESS REPORT", 13, bold=True, color="#eff6ff"),
        _rect(20, 100, W - 40, 32, "#eff6ff", stroke="#dbeafe", strokeWidth=1),
        _text(24, 107, 240, "Student: {name}", 10, color="#1e293b", align="left"),
        _text(280, 107, 120, "Class: {class}  Sec: {section}", 10, color="#1e293b", align="left"),
        _text(420, 107, 120, "Roll No: {roll_no}", 10, color="#1e293b", align="left"),
        _text(560, 107, 200, "Year: {exam_year}", 10, color="#1e293b", align="left"),
        _text(20, 148, W - 40, "TERM  ☐ First   ☐ Second   ☐ Third   ☐ Annual", 11, color="#334155"),
        _rect(20, 175, W - 40, 26, "#1e40af"),
        _text(20, 181, 200, "Subject", 10, bold=True, color="#ffffff", align="center"),
        _text(220, 181, 90, "Max Marks", 9, bold=True, color="#ffffff", align="center"),
        _text(310, 181, 90, "Obtained", 9, bold=True, color="#ffffff", align="center"),
        _text(400, 181, 60, "Grade", 9, bold=True, color="#ffffff", align="center"),
        _text(460, 181, 60, "Remarks", 9, bold=True, color="#ffffff", align="center"),
        *subject_rows,
        _rect(20, 409, W - 40, 28, "#1e40af"),
        _text(20, 415, 200, "TOTAL", 10, bold=True, color="#ffffff", align="center"),
        _text(220, 415, 90, "800", 10, bold=True, color="#ffffff", align="center"),
        _text(310, 415, 90, "___", 10, bold=True, color="#ffffff", align="center"),
        _text(400, 415, 60, "___", 10, bold=True, color="#ffffff", align="center"),
        _text(460, 415, 60, "___", 10, bold=True, color="#ffffff", align="center"),
        _text(20, 450, W - 40, "Attendance:  Present: ___  Absent: ___  Total: ___  Percentage: ____%", 11, color="#334155"),
        _text(20, 478, W - 40, "Class Teacher Remark: _________________________________________________________", 11, color="#334155"),
        _line(50, 680, 200, "#334155"),
        _text(50, 686, 200, "Class Teacher", 10, color="#64748b", align="center"),
        _line(W // 2 - 100, 680, 200, "#334155"),
        _text(W // 2 - 100, 686, 200, "Parent Signature", 10, color="#64748b", align="center"),
        _line(W - 280, 680, 200, "#334155"),
        _text(W - 280, 686, 200, "Principal", 10, color="#64748b", align="center"),
    ])


def _marksheet():
    W = 794
    subject_rows = []
    for i in range(10):
        y = 212 + i * 24
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        subject_rows += [
            _rect(20, y, W - 40, 24, bg, stroke="#e2e8f0", strokeWidth=1),
            _text(20, y + 4, 180, f"Subject {i + 1}", 9, color="#334155", align="center"),
            _text(200, y + 4, 70, "___", 9, color="#334155", align="center"),
            _text(270, y + 4, 70, "___", 9, color="#334155", align="center"),
            _text(340, y + 4, 70, "___", 9, color="#334155", align="center"),
            _text(410, y + 4, 70, "___", 9, color="#334155", align="center"),
            _text(480, y + 4, 70, "___", 9, color="#334155", align="center"),
            _text(550, y + 4, 60, "___", 9, color="#334155", align="center"),
            _text(610, y + 4, 80, "Pass", 9, color="#334155", align="center"),
        ]
    return _canvas([
        _rect(0, 0, W, 100, "#0f172a", selectable=False),
        _rect(0, 0, 8, 100, "#f59e0b", selectable=False),
        _text(20, 8, W - 30, "YOUR SCHOOL NAME", 22, bold=True, color="#ffffff"),
        _text(20, 38, W - 30, "Affiliated to Board of Secondary Education", 12, color="#94a3b8"),
        _text(20, 78, W - 30, "MARK SHEET", 13, bold=True, color="#f59e0b"),
        _rect(20, 114, W - 40, 58, "#f8fafc", stroke="#e2e8f0", strokeWidth=1),
        _text(24, 118, 220, "Student Name: {name}", 10, color="#1e293b", align="left"),
        _text(24, 136, 220, "Father's Name: {father_name}", 10, color="#1e293b", align="left"),
        _text(24, 154, 220, "Mother's Name: {mother_name}", 10, color="#1e293b", align="left"),
        _text(260, 118, 220, "Enrollment No.: {enrollment_number}", 10, color="#1e293b", align="left"),
        _text(260, 136, 220, "Date of Birth: {dob}", 10, color="#1e293b", align="left"),
        _text(260, 154, 220, "Class: {class}  Section: {section}", 10, color="#1e293b", align="left"),
        _text(500, 118, 270, "Exam: {exam_name}", 10, color="#1e293b", align="left"),
        _text(500, 136, 270, "Year: {exam_year}", 10, color="#1e293b", align="left"),
        _rect(20, 184, W - 40, 28, "#0f172a"),
        _text(20, 190, 180, "Subject", 10, bold=True, color="#ffffff", align="center"),
        _text(200, 190, 70, "Th.Max", 9, bold=True, color="#ffffff", align="center"),
        _text(270, 190, 70, "Th.Obt.", 9, bold=True, color="#ffffff", align="center"),
        _text(340, 190, 70, "Pr.Max", 9, bold=True, color="#ffffff", align="center"),
        _text(410, 190, 70, "Pr.Obt.", 9, bold=True, color="#ffffff", align="center"),
        _text(480, 190, 70, "Total", 9, bold=True, color="#ffffff", align="center"),
        _text(550, 190, 60, "Grade", 9, bold=True, color="#ffffff", align="center"),
        _text(610, 190, 80, "Result", 9, bold=True, color="#ffffff", align="center"),
        *subject_rows,
        _rect(20, 452, W - 40, 26, "#0f172a"),
        _text(20, 456, 180, "GRAND TOTAL", 9, bold=True, color="#ffffff", align="center"),
        _text(480, 456, 70, "___", 9, bold=True, color="#f59e0b", align="center"),
        _text(550, 456, 60, "___", 9, bold=True, color="#f59e0b", align="center"),
        _text(20, 494, W - 40, "Result:  ☐ PASS    ☐ FAIL       Percentage: _______%    Division: _____________", 11, color="#0f172a"),
        _line(50, 660, 200, "#334155"),
        _text(50, 666, 200, "Examiner", 10, color="#64748b", align="center"),
        _line(W // 2 - 100, 660, 200, "#334155"),
        _text(W // 2 - 100, 666, 200, "Head of Dept.", 10, color="#64748b", align="center"),
        _line(W - 280, 660, 200, "#334155"),
        _text(W - 280, 666, 200, "Principal", 10, color="#64748b", align="center"),
    ])


def _notice():
    W = 794
    return _canvas([
        _rect(0, 0, W, 70, "#dc2626", selectable=False),
        _text(20, 8, W - 40, "YOUR SCHOOL NAME", 20, bold=True, color="#ffffff"),
        _text(20, 34, W - 40, "School Address | Phone | www.school.edu", 10, color="#fecaca"),
        _text(20, 52, W - 40, "OFFICIAL NOTICE", 12, bold=True, color="#fee2e2"),
        _line(20, 84, W - 40, "#dc2626", 2),
        _text(20, 100, 300, "Ref. No: _______________", 11, color="#334155", align="left"),
        _text(W - 220, 100, 190, "Date: ______________", 11, color="#334155", align="right"),
        _text(20, 130, W - 40, "SUBJECT: ________________________________________________________________", 13, bold=True, color="#1e293b"),
        _text(20, 165, W - 40, "This is to inform all concerned that ______________________________________________", 12, color="#334155"),
        _text(20, 193, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 221, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 249, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 290, W - 40, "All students/staff/parents are requested to note and comply accordingly.", 12, italic=True, color="#475569"),
        _text(W - 260, 640, 220, "Principal / Vice Principal", 12, color="#334155", align="right"),
        _line(W - 260, 676, 220, "#334155"),
        _text(W - 260, 682, 220, "Signature with School Seal", 10, color="#64748b", align="center"),
    ])


def _circular():
    W = 794
    return _canvas([
        _rect(0, 0, W, 80, "#0369a1", selectable=False),
        _text(20, 9, W - 40, "YOUR SCHOOL NAME", 22, bold=True, color="#ffffff"),
        _text(20, 40, W - 40, "CIRCULAR", 16, bold=True, color="#bae6fd"),
        _text(20, 60, W - 40, "School Address | Phone | www.school.edu", 10, color="#7dd3fc"),
        _line(20, 94, W - 40, "#0369a1", 2),
        _text(20, 109, 260, "Circular No.: ___________", 11, color="#334155", align="left"),
        _text(W - 230, 109, 200, "Date: _______________", 11, color="#334155", align="right"),
        _text(20, 138, W - 40, "To: All Students / Parents / Staff  (Class: _____ to _____)", 12, bold=True, color="#1e293b"),
        _text(20, 168, W - 40, "Subject: _______________________________________________", 13, bold=True, color="#0369a1"),
        _line(20, 195, W - 40, "#bae6fd"),
        _text(20, 212, W - 40, "This is to inform you that _______________________________________", 12, color="#334155"),
        _text(20, 240, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 268, W - 40, "The event/activity will be held on  __________  from  __________  to  __________", 12, color="#334155"),
        _text(20, 296, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 338, W - 40, "Additional Guidelines:", 12, bold=True, color="#0369a1"),
        _text(20, 362, W - 40, "•  ______________________________________________________________________", 11, color="#334155"),
        _text(20, 386, W - 40, "•  ______________________________________________________________________", 11, color="#334155"),
        _text(20, 410, W - 40, "•  ______________________________________________________________________", 11, color="#334155"),
        _text(20, 448, W - 40, "Please sign and return the slip below by ________________.", 11, italic=True, color="#64748b"),
        _line(20, 480, W - 40, "#cbd5e1"),
        _text(20, 495, W - 40, "PARENT / GUARDIAN ACKNOWLEDGEMENT SLIP", 11, bold=True, color="#334155"),
        _text(20, 518, W - 40, "I have received and understood the above circular.", 10, color="#475569"),
        _text(20, 540, 260, "Student Name: _______________", 10, color="#334155", align="left"),
        _text(20, 562, 260, "Class: _____  Section: _____", 10, color="#334155", align="left"),
        _text(W - 240, 562, 200, "Parent Signature: ___________", 10, color="#334155", align="right"),
        _text(W - 260, 700, 220, "Principal", 12, color="#334155", align="right"),
        _line(W - 260, 735, 220, "#334155"),
    ])


def _letterhead_official():
    W = 794
    return _canvas([
        _rect(0, 0, W, 2, "#fbbf24", selectable=False),
        _rect(0, 118, W, 4, "#1e40af", selectable=False),
        _rect(0, 0, 6, 122, "#1e40af", selectable=False),
        _rect(W - 6, 0, 6, 122, "#1e40af", selectable=False),
        _rect(20, 14, 80, 80, "#eff6ff", stroke="#bfdbfe", strokeWidth=1, rx=4, ry=4),
        _text(22, 46, 76, "LOGO", 11, bold=True, color="#93c5fd", editable=True),
        _text(115, 16, W - 200, "YOUR SCHOOL NAME", 22, bold=True, color="#1e40af"),
        _text(115, 47, W - 200, "Affiliated to Board of Secondary Education", 11, color="#334155"),
        _text(115, 64, W - 200, "Street Address, City, State — Pincode", 10, color="#475569"),
        _text(115, 80, W - 200, "Phone: +000-000-0000  |  Email: info@school.edu", 10, color="#475569"),
        _text(115, 96, W - 200, "www.school.edu  |  Estd. 2001", 10, color="#64748b"),
        _text(20, 138, 280, "Ref No.: _______________", 10, color="#334155", align="left"),
        _text(W - 230, 138, 200, "Date: _______________", 10, color="#334155", align="right"),
        _text(20, 168, 300, "To,", 12, bold=True, color="#1e293b", align="left"),
        _text(20, 190, 350, "_____________________", 12, color="#334155", align="left"),
        _text(20, 212, 350, "_____________________", 12, color="#334155", align="left"),
        _text(20, 234, 350, "_____________________", 12, color="#334155", align="left"),
        _text(20, 270, W - 40, "Subject: _________________________________________________________", 12, bold=True, color="#1e293b"),
        _line(20, 296, W - 40, "#1e40af"),
        _text(20, 316, W - 40, "Dear Sir / Madam,", 12, color="#334155", align="left"),
        _text(20, 344, W - 40, "With reference to the above subject, I state that ___________________________", 12, color="#334155"),
        _text(20, 372, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 400, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 428, W - 40, "___________________________________________________________________________", 12, color="#334155"),
        _text(20, 468, W - 40, "Thanking you,", 12, color="#334155", align="left"),
        _text(20, 496, W - 40, "Yours faithfully,", 12, color="#334155", align="left"),
        _text(20, 660, 200, "_______________________", 12, color="#334155", align="left"),
        _text(20, 680, 200, "Principal", 12, bold=True, color="#1e293b", align="left"),
        _text(20, 700, 280, "YOUR SCHOOL NAME", 10, color="#475569", align="left"),
        _rect(0, 1095, W, 3, "#1e40af", selectable=False),
        _rect(0, 1098, W, 3, "#fbbf24", selectable=False),
        _text(20, 1103, W - 40, "Phone: +000-000-0000  |  Email: info@school.edu  |  www.school.edu", 8, color="#94a3b8"),
    ])


def _letterhead_informal():
    W = 794
    return _canvas([
        _rect(0, 0, W, 90, "#f8fafc", selectable=False),
        _rect(0, 90, W, 3, "#3b82f6", selectable=False),
        _text(20, 12, W - 40, "YOUR SCHOOL NAME", 24, bold=True, color="#1e293b"),
        _text(20, 44, W - 40, "School Address  |  Phone  |  Email  |  Website", 10, color="#64748b"),
        _text(W - 160, 138, 140, "Date: __________", 10, color="#64748b", align="right"),
        _text(20, 164, W - 40, "To,", 13, color="#334155", align="left"),
        _text(20, 188, 300, "________________________", 13, color="#334155", align="left"),
        _text(20, 214, 300, "________________________", 13, color="#334155", align="left"),
        _text(20, 254, W - 40, "Subject: _________________________________________________", 13, bold=True, color="#1e293b"),
        _line(20, 280, W - 40, "#3b82f6"),
        _text(20, 298, W - 40, "Dear Sir/Madam,", 13, color="#334155", align="left"),
        _text(20, 326, W - 40, "_________________________________________________________________________", 12, color="#334155"),
        _text(20, 354, W - 40, "_________________________________________________________________________", 12, color="#334155"),
        _text(20, 382, W - 40, "_________________________________________________________________________", 12, color="#334155"),
        _text(20, 410, W - 40, "_________________________________________________________________________", 12, color="#334155"),
        _text(20, 450, W - 40, "Yours faithfully,", 12, color="#334155", align="left"),
        _text(20, 590, 200, "__________________", 12, color="#334155", align="left"),
        _text(20, 614, 200, "Principal", 12, bold=True, color="#1e293b", align="left"),
        _rect(0, 1103, W, 20, "#1e293b", selectable=False),
        _text(20, 1106, W - 40, "School Address  •  Phone  •  Email  •  Website", 8, color="#94a3b8"),
    ])

# ══════════════════════════════════════════════════════════════════════════════
# Writer JSON — native block-based format for rich-text writer templates
# ══════════════════════════════════════════════════════════════════════════════

def _w_heading(text, level=1, align="center", color="#1e293b", bold=True):
    return {"type": "heading", "level": level, "text": text, "align": align, "color": color, "bold": bold}

def _w_para(text, align="left", color="#334155", bold=False, italic=False, size=12):
    return {"type": "paragraph", "text": text, "align": align, "color": color, "bold": bold, "italic": italic, "fontSize": size}

def _w_divider(color="#334155", width=1):
    return {"type": "divider", "color": color, "width": width}

def _w_spacer(height=20):
    return {"type": "spacer", "height": height}

def _w_table(headers, rows):
    return {"type": "table", "headers": headers, "rows": rows}

def _w_columns(cols):
    """cols: list of dicts like [{"text": "...", "align": "left"}, {"text": "...", "align": "right"}]"""
    return {"type": "columns", "columns": cols}

def _w_signature(labels):
    """labels: list of strings, e.g. ["Class Teacher", "Principal"]"""
    return {"type": "signature", "labels": labels}

def _w_header_band(school="YOUR SCHOOL NAME", subtitle="", tagline="", bg="#1e40af", color="#ffffff"):
    return {"type": "header_band", "school": school, "subtitle": subtitle, "tagline": tagline, "bg": bg, "color": color}

def _w_footer_band(text="", bg="#1e293b", color="#94a3b8"):
    return {"type": "footer_band", "text": text, "bg": bg, "color": color}

def _writer(config, blocks):
    return {"type": "writer", "config": config, "blocks": blocks}


# ── Writer template builders ────────────────────────────────────────────────

def _writer_report_card():
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Arial", "fontSize": 11},
        blocks=[
            _w_header_band("YOUR SCHOOL NAME", "School Address | Phone | www.school.edu", "ACADEMIC PROGRESS REPORT"),
            _w_spacer(8),
            _w_columns([
                {"text": "Student: ___________________", "align": "left"},
                {"text": "Class: _____  Section: _____", "align": "center"},
                {"text": "Roll No: ______", "align": "right"},
            ]),
            _w_columns([
                {"text": "Year: __________", "align": "left"},
                {"text": "TERM:  ☐ First   ☐ Second   ☐ Third   ☐ Annual", "align": "right"},
            ]),
            _w_spacer(8),
            _w_table(
                headers=["Subject", "Max Marks", "Obtained", "Grade", "Remarks"],
                rows=[
                    ["Subject 1", "100", "___", "___", "Good"],
                    ["Subject 2", "100", "___", "___", ""],
                    ["Subject 3", "100", "___", "___", ""],
                    ["Subject 4", "100", "___", "___", ""],
                    ["Subject 5", "100", "___", "___", ""],
                    ["Subject 6", "100", "___", "___", ""],
                    ["Subject 7", "100", "___", "___", ""],
                    ["Subject 8", "100", "___", "___", ""],
                    ["**TOTAL**", "**800**", "**___**", "**___**", "**___**"],
                ],
            ),
            _w_spacer(8),
            _w_para("Attendance:  Present: ___  Absent: ___  Total: ___  Percentage: ____%"),
            _w_para("Class Teacher Remark: _________________________________________________________"),
            _w_spacer(40),
            _w_signature(["Class Teacher", "Parent Signature", "Principal"]),
        ],
    )


def _writer_marksheet():
    """School progress report / marksheet showing raw marks per subject."""
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Arial", "fontSize": 10},
        blocks=[
            _w_header_band("{school_name}", "{school_address}", "MARKSHEET / PROGRESS REPORT", bg="#065f46"),
            _w_spacer(6),
            _w_divider("#065f46"),
            _w_spacer(4),
            _w_columns([
                {"text": "Student:  **{name}**", "align": "left"},
                {"text": "Roll No:  **{roll_no}**", "align": "center"},
                {"text": "Class:  **{class_name}**", "align": "right"},
            ]),
            _w_columns([
                {"text": "Exam:  {exam_name}", "align": "left"},
                {"text": "Section:  {section_name}", "align": "center"},
                {"text": "Year:  {exam_year}", "align": "right"},
            ]),
            _w_divider("#065f46"),
            _w_spacer(6),
            {"type": "subject_rows"},
            _w_spacer(8),
            _w_columns([
                {"text": "Percentage: **{percentage}%**", "align": "left"},
                {"text": "Overall Grade: **{grade}**", "align": "center"},
                {"text": "GPA: **{gpa}**", "align": "right"},
            ]),
            _w_spacer(4),
            _w_para("Result: {grade}  |  This is to certify that the above student has {status} the examination.", color="#0f172a"),
            _w_spacer(40),
            _w_signature(["Class Teacher", "Parent / Guardian", "Principal"]),
        ],
    )


def _writer_grade_sheet():
    """IEMIS-style NEB Grade Sheet with credit hours, grade points and GPA."""
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Arial", "fontSize": 10},
        blocks=[
            _w_header_band("{school_name}", "{school_address}", "GRADE SHEET", bg="#1e3a8a"),
            _w_spacer(6),
            _w_para("THE GRADE(S) SECURED BY  {name}  ({symbol_no})", bold=True, color="#0f172a"),
            _w_columns([
                {"text": "DATE OF BIRTH: {dob} (B.S.) {dob_ad}(A.D)", "align": "left"},
                {"text": "SYMBOL NO: {symbol_no}", "align": "right"},
            ]),
            _w_para("OF {school_name}, {school_address}   IEMIS CODE {iemis_code}", color="#334155"),
            _w_para("IN THE EDUCATION EXAMINATION OF YEAR {exam_year} B.S. ARE GIVEN BELOW.", color="#334155"),
            _w_spacer(6),
            {"type": "subject_rows_neb"},
            _w_spacer(8),
            _w_para("GRADE POINT AVERAGE = {gpa}", bold=True, color="#0f172a"),
            _w_para("1. ONE CREDIT HOUR EQUALS 28 HOURS", italic=True, color="#64748b", size=9),
            _w_para("2. TH: THEORY(FINAL/EXTERNAL)   IN: INTERNAL", italic=True, color="#64748b", size=9),
            _w_spacer(8),
            {
                "type": "table",
                "caption": "DETAILS OF GRADE SHEET",
                "headers": ["S.N.", "Achievement In Percent", "Grade", "Description", "Grade Point"],
                "rows": [
                    ["1", "90 to 100", "A+", "Outstanding", "4.0"],
                    ["2", "80 to below 90", "A", "Excellent", "3.6"],
                    ["3", "70 to below 80", "B+", "Very Good", "3.2"],
                    ["4", "60 to below 70", "B", "Good", "2.8"],
                    ["5", "50 to below 60", "C+", "Satisfactory", "2.4"],
                    ["6", "40 to below 50", "C", "Acceptable", "2.0"],
                    ["7", "35 to below 40", "D", "Basic", "1.6"],
                    ["8", "0 to below 35", "NG", "Not Graded", "—"],
                ],
            },
            _w_spacer(40),
            _w_signature(["Class Teacher", "Head Teacher"]),
        ],
    )


def _writer_notice():
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Times New Roman", "fontSize": 12},
        blocks=[
            _w_header_band("YOUR SCHOOL NAME", "School Address | Phone | www.school.edu", "OFFICIAL NOTICE", bg="#dc2626"),
            _w_divider("#dc2626", 2),
            _w_spacer(4),
            _w_columns([
                {"text": "Ref. No: _______________", "align": "left"},
                {"text": "Date: ______________", "align": "right"},
            ]),
            _w_spacer(8),
            _w_para("SUBJECT: ________________________________________________________________", bold=True, color="#1e293b", size=13),
            _w_spacer(8),
            _w_para("This is to inform all concerned that ______________________________________________"),
            _w_para("___________________________________________________________________________"),
            _w_para("___________________________________________________________________________"),
            _w_para("___________________________________________________________________________"),
            _w_spacer(8),
            _w_para("All students/staff/parents are requested to note and comply accordingly.", italic=True, color="#475569"),
            _w_spacer(80),
            _w_signature(["Principal / Vice Principal"]),
        ],
    )


def _writer_circular():
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Times New Roman", "fontSize": 12},
        blocks=[
            _w_header_band("YOUR SCHOOL NAME", "School Address | Phone | www.school.edu", "CIRCULAR", bg="#0369a1"),
            _w_divider("#0369a1", 2),
            _w_spacer(4),
            _w_columns([
                {"text": "Circular No.: ___________", "align": "left"},
                {"text": "Date: _______________", "align": "right"},
            ]),
            _w_spacer(4),
            _w_para("To: All Students / Parents / Staff  (Class: _____ to _____)", bold=True),
            _w_para("Subject: _______________________________________________", bold=True, color="#0369a1", size=13),
            _w_divider("#bae6fd"),
            _w_spacer(4),
            _w_para("This is to inform you that _______________________________________"),
            _w_para("___________________________________________________________________________"),
            _w_para("The event/activity will be held on  __________  from  __________  to  __________"),
            _w_para("___________________________________________________________________________"),
            _w_spacer(8),
            _w_para("Additional Guidelines:", bold=True, color="#0369a1"),
            _w_para("•  ______________________________________________________________________"),
            _w_para("•  ______________________________________________________________________"),
            _w_para("•  ______________________________________________________________________"),
            _w_spacer(4),
            _w_para("Please sign and return the slip below by ________________.", italic=True, color="#64748b"),
            _w_divider("#cbd5e1"),
            _w_para("PARENT / GUARDIAN ACKNOWLEDGEMENT SLIP", bold=True),
            _w_para("I have received and understood the above circular.", size=10, color="#475569"),
            _w_columns([
                {"text": "Student Name: _______________", "align": "left"},
                {"text": "Class: _____  Section: _____", "align": "left"},
                {"text": "Parent Signature: ___________", "align": "right"},
            ]),
            _w_spacer(40),
            _w_signature(["Principal"]),
        ],
    )


def _writer_letterhead_official():
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Times New Roman", "fontSize": 12,
                "showHeader": True, "headerText": "YOUR SCHOOL NAME — Affiliated to Board of Secondary Education",
                "showFooter": True, "footerText": "Phone: +000-000-0000  |  Email: info@school.edu  |  www.school.edu"},
        blocks=[
            _w_heading("YOUR SCHOOL NAME", level=2, color="#1e40af"),
            _w_para("Affiliated to Board of Secondary Education", align="center", color="#334155", size=11),
            _w_para("Street Address, City, State — Pincode", align="center", color="#475569", size=10),
            _w_para("Phone: +000-000-0000  |  Email: info@school.edu", align="center", color="#475569", size=10),
            _w_para("www.school.edu  |  Estd. 2001", align="center", color="#64748b", size=10),
            _w_divider("#1e40af", 2),
            _w_spacer(4),
            _w_columns([
                {"text": "Ref No.: _______________", "align": "left"},
                {"text": "Date: _______________", "align": "right"},
            ]),
            _w_spacer(8),
            _w_para("To,", bold=True),
            _w_para("_____________________"),
            _w_para("_____________________"),
            _w_para("_____________________"),
            _w_spacer(4),
            _w_para("Subject: _________________________________________________________", bold=True, color="#1e293b"),
            _w_divider("#1e40af"),
            _w_spacer(4),
            _w_para("Dear Sir / Madam,"),
            _w_spacer(4),
            _w_para("With reference to the above subject, I state that ___________________________"),
            _w_para("___________________________________________________________________________"),
            _w_para("___________________________________________________________________________"),
            _w_para("___________________________________________________________________________"),
            _w_spacer(8),
            _w_para("Thanking you,"),
            _w_para("Yours faithfully,"),
            _w_spacer(40),
            _w_para("_______________________"),
            _w_para("Principal", bold=True),
            _w_para("YOUR SCHOOL NAME", size=10, color="#475569"),
        ],
    )


def _writer_letterhead_informal():
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Times New Roman", "fontSize": 13,
                "showFooter": True, "footerText": "School Address  •  Phone  •  Email  •  Website"},
        blocks=[
            _w_heading("YOUR SCHOOL NAME", level=2, color="#1e293b"),
            _w_para("School Address  |  Phone  |  Email  |  Website", align="center", color="#64748b", size=10),
            _w_divider("#3b82f6", 2),
            _w_spacer(8),
            _w_columns([
                {"text": "", "align": "left"},
                {"text": "Date: __________", "align": "right"},
            ]),
            _w_spacer(4),
            _w_para("To,"),
            _w_para("________________________"),
            _w_para("________________________"),
            _w_spacer(4),
            _w_para("Subject: _________________________________________________", bold=True, color="#1e293b"),
            _w_divider("#3b82f6"),
            _w_spacer(4),
            _w_para("Dear Sir/Madam,"),
            _w_spacer(4),
            _w_para("_________________________________________________________________________"),
            _w_para("_________________________________________________________________________"),
            _w_para("_________________________________________________________________________"),
            _w_para("_________________________________________________________________________"),
            _w_spacer(8),
            _w_para("Yours faithfully,"),
            _w_spacer(40),
            _w_para("__________________"),
            _w_para("Principal", bold=True),
        ],
    )


def _writer_fee_bill():
    """Student fee bill / payment receipt template."""
    return _writer(
        config={"size": "A4", "orientation": "portrait", "font": "Arial", "fontSize": 11},
        blocks=[
            _w_header_band("{school_name}", "{school_address}", "FEE BILL / RECEIPT", bg="#065f46"),
            _w_spacer(6),
            _w_columns([
                {"text": "Bill No: {bill_no}", "align": "left"},
                {"text": "Date: {bill_date}", "align": "right"},
            ]),
            _w_divider("#065f46"),
            _w_spacer(4),
            _w_columns([
                {"text": "Student: **{student_name}**", "align": "left"},
                {"text": "Class: {class_name}  Section: {section_name}", "align": "right"},
            ]),
            _w_columns([
                {"text": "Roll No: {roll_no}", "align": "left"},
                {"text": "Due Date: {due_date}", "align": "right"},
            ]),
            _w_spacer(8),
            {"type": "fee_rows"},
            _w_spacer(8),
            _w_para("Remarks: {remarks}", color="#64748b"),
            _w_spacer(32),
            _w_signature(["Accountant", "Principal"]),
        ],
    )


# ── Template registry ──────────────────────────────────────────────────────────


def _nepali_calendar_page(month_name: str, width=794, height=1123):
    # Simple page: header banner, school name, large image placeholder, calendar grid placeholder
    objs = []
    # Header banner
    objs.append(_rect(0, 0, width, 110, "#b91c1c", selectable=False))
    objs.append(_text(16, 20, width - 32, "{school_name}", 24, bold=True, color="#ffffff", align="left"))
    objs.append(_text(16, 52, width - 32, "{school_address}", 10, color="#fde68a", align="left"))
    # Large image area
    objs.append(_rect(24, 128, width - 48, 220, "#f3f4f6", stroke="#cbd5e1", strokeWidth=1, rx=6, ry=6))
    objs.append(_text(28, 320, 120, "SCHOOL IMAGE", 10, color="#94a3b8", editable=True, align="left"))
    # Month title
    objs.append(_text(32, 360, width - 64, month_name, 28, bold=True, color="#0f172a", align="center"))
    # Calendar grid placeholder (6 rows x 7 cols)
    grid_x = 32
    grid_y = 420
    cell_w = (width - 64) / 7
    cell_h = 56
    # Day headings
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for i, d in enumerate(days):
        objs.append(_text(grid_x + i * cell_w + 8, grid_y - 28, cell_w - 16, d, 10, bold=True, color="#dc2626", align="center"))
    # cells as light rectangles
    for r in range(6):
        for c in range(7):
            left = grid_x + c * cell_w
            top = grid_y + r * cell_h
            objs.append(_rect(left, top, cell_w - 6, cell_h - 6, "#ffffff", stroke="#e5e7eb", strokeWidth=1))
            objs.append(_text(left + 6, top + 6, cell_w - 18, "{day}", 14, color="#0f172a", align="left", editable=True))
    # Footer notes
    objs.append(_text(32, height - 120, width - 64, "Notes: \n- Holiday markers can be colored red.\n- Add school contact details above.", 10, color="#374151", align="left"))
    return _canvas(objs, bg="#ffffff")

TEMPLATES: dict = {
    "id_card_standard": {
        "name": "Student ID Card",
        "category": "id_cards",
        "editor_type": "designer",
        "description": "Horizontal student ID card with photo, name, class, roll and contacts",
        "page_size": "ID Card",
        "thumbnail_emoji": "🪪",
        "is_default": True,
        "width": 300, "height": 189,
        "fields": ["photo", "name", "class", "section", "roll_no", "blood_group", "phone"],
        "canvas_json": _id_card_standard(),
    },
    "nepali_calendar_12_months": {
        "name": "Nepali School Calendar",
        "category": "calendars",
        "editor_type": "designer",
        "description": "Multi-page Nepali calendar — one month per page with school header and image placeholder",
        "page_size": "A4",
        "thumbnail_emoji": "🗓️",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["school_name", "school_address", "school_logo"],
        "canvas_json": {
            "version": "multi-page",
            "pages": [
                {"id": "m1",  "json": _nepali_calendar_page("Baishakh"),  "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m2",  "json": _nepali_calendar_page("Jestha"),    "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m3",  "json": _nepali_calendar_page("Ashadh"),    "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m4",  "json": _nepali_calendar_page("Shrawan"),   "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m5",  "json": _nepali_calendar_page("Bhadra"),    "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m6",  "json": _nepali_calendar_page("Ashwin"),    "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m7",  "json": _nepali_calendar_page("Kartik"),    "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m8",  "json": _nepali_calendar_page("Mangsir"),   "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m9",  "json": _nepali_calendar_page("Poush"),     "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m10", "json": _nepali_calendar_page("Magh"),      "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m11", "json": _nepali_calendar_page("Falgun"),    "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
                {"id": "m12", "json": _nepali_calendar_page("Chaitra"),   "width": 794, "height": 1123, "orientation": "portrait", "margins": {"top": 10, "right": 10, "bottom": 10, "left": 10}, "background": "#ffffff"},
            ]
        },
    },
    "marksheet": {
        "name": "NEB Marksheet",
        "category": "reports",
        "editor_type": "writer",
        "description": "IEMIS-style NEB marksheet with theory/practical split, grade points and grading legend",
        "page_size": "A4",
        "thumbnail_emoji": "📝",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["name", "class_name", "roll_no", "exam_name", "subjects_marks", "grade", "gpa", "percentage"],
        "canvas_json": _marksheet(),
        "writer_json": _writer_marksheet(),
    },
    "grade_sheet": {
        "name": "NEB Grade Sheet",
        "category": "reports",
        "editor_type": "writer",
        "description": "Official NEB grade sheet with credit hours, grade points and GPA (IEMIS format)",
        "page_size": "A4",
        "thumbnail_emoji": "🎓",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["name", "dob", "symbol_no", "class_name", "school_name", "exam_year", "subjects_marks", "gpa"],
        "canvas_json": _marksheet(),
        "writer_json": _writer_grade_sheet(),
    },
    "fee_bill": {
        "name": "Student Fee Bill",
        "category": "reports",
        "editor_type": "writer",
        "description": "Student fee bill / payment receipt with itemised fee table",
        "page_size": "A4",
        "thumbnail_emoji": "🧾",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["student_name", "class_name", "roll_no", "bill_no", "bill_date", "due_date", "fee_items", "total_amount"],
        "canvas_json": {},
        "writer_json": _writer_fee_bill(),
    },
    "admit_card_standard": {
        "name": "Exam Admit Card",
        "category": "admit_cards",
        "editor_type": "designer",
        "description": "Exam admit card with student details, photo box and subject schedule rows",
        "page_size": "A4 Half",
        "thumbnail_emoji": "🎫",
        "is_default": True,
        "width": 559, "height": 794,
        "fields": ["school_name", "exam_name", "student_name", "class_name", "roll_no", "dob", "father_name", "photo"],
        "canvas_json": _admit_card_standard(),
    },
    "character_certificate": {
        "name": "Character Certificate",
        "category": "certificates",
        "editor_type": "designer",
        "description": "Formal character certificate with conduct statement and principal seal line",
        "page_size": "A4",
        "thumbnail_emoji": "📜",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["school_name", "student_name", "class_name", "roll_no", "conduct", "issue_date"],
        "canvas_json": _character_certificate(),
    },
    # ── Restored registry entries: these builders existed but were dropped
    # from the registry during a refactor, so /transfer-certificate, staff ID
    # and bulk merit/participation flows resolved to nothing (or 500-ed).
    "id_card_staff": {
        "name": "Staff ID Card",
        "category": "id_cards",
        "editor_type": "designer",
        "description": "Vertical staff ID card with photo, designation and school contacts",
        "page_size": "ID Card",
        "thumbnail_emoji": "🪪",
        "is_default": True,
        "width": 300, "height": 480,
        "fields": ["photo", "name", "designation", "department", "employee_id", "phone"],
        "canvas_json": _id_card_staff(),
    },
    "transfer_certificate": {
        "name": "Transfer Certificate",
        "category": "certificates",
        "editor_type": "designer",
        "description": "School leaving / transfer certificate with numbered leaving-record fields",
        "page_size": "A4",
        "thumbnail_emoji": "📤",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["name", "father_name", "mother_name", "class", "section", "dob", "leaving_reason", "leaving_date"],
        "canvas_json": _transfer_certificate(),
    },
    "merit_certificate": {
        "name": "Merit Certificate",
        "category": "certificates",
        "editor_type": "designer",
        "description": "Landscape merit award certificate with achievement and rank lines",
        "page_size": "A4 Landscape",
        "thumbnail_emoji": "🏅",
        "is_default": True,
        "width": 1123, "height": 794,
        "fields": ["name", "class", "section", "roll_no", "achievement", "rank", "date"],
        "canvas_json": _merit_certificate(),
    },
    "participation_certificate": {
        "name": "Participation Certificate",
        "category": "certificates",
        "editor_type": "designer",
        "description": "Landscape participation certificate for events and programs",
        "page_size": "A4 Landscape",
        "thumbnail_emoji": "🎖️",
        "is_default": True,
        "width": 1123, "height": 794,
        "fields": ["name", "class", "section", "roll_no", "event_name", "event_date", "date"],
        "canvas_json": _participation_certificate(),
    },
    "admit_card_hall_ticket": {
        "name": "Hall Ticket",
        "category": "admit_cards",
        "editor_type": "designer",
        "description": "Exam hall ticket variant with subject schedule rows",
        "page_size": "A5",
        "thumbnail_emoji": "🎫",
        "is_default": True,
        "width": 559, "height": 794,
        "fields": ["name", "class", "roll_no", "dob", "exam_name", "symbol_no"],
        "canvas_json": _admit_card_hall_ticket(),
    },
    # ── Registered 2026-08-31: builders existed but were never in the registry ──
    "report_card": {
        "name": "Report Card",
        "category": "reports",
        "editor_type": "designer",
        "description": "Terminal report card with subject table, attendance and remarks",
        "page_size": "A4",
        "thumbnail_emoji": "📋",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["name", "class", "section", "roll_no", "exam_name"],
        "canvas_json": _report_card(),
    },
    "notice": {
        "name": "Notice",
        "category": "notices",
        "editor_type": "writer",
        "description": "Official school notice with header band and signature block",
        "page_size": "A4",
        "thumbnail_emoji": "📢",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["school_name", "date", "title"],
        "writer_json": _writer_notice(),
    },
    "circular": {
        "name": "Parent Circular",
        "category": "notices",
        "editor_type": "writer",
        "description": "Circular to parents with header, body placeholders and signatures",
        "page_size": "A4",
        "thumbnail_emoji": "📨",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["school_name", "date", "class", "section"],
        "writer_json": _writer_circular(),
    },
    "letterhead_official": {
        "name": "Official Letterhead",
        "category": "letterheads",
        "editor_type": "writer",
        "description": "Formal letterhead — logo band, reference line, signature block",
        "page_size": "A4",
        "thumbnail_emoji": "📜",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["school_name", "school_address", "school_phone", "school_website"],
        "writer_json": _writer_letterhead_official(),
    },
    "letterhead_informal": {
        "name": "Informal Letterhead",
        "category": "letterheads",
        "editor_type": "writer",
        "description": "Lightweight letterhead for internal memos and notes",
        "page_size": "A4",
        "thumbnail_emoji": "🗒️",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["school_name", "date"],
        "writer_json": _writer_letterhead_informal(),
    },
    "report_card_writer": {
        "name": "Report Card (Document)",
        "category": "reports",
        "editor_type": "writer",
        "description": "Editable report card document with subject rows and grading legend",
        "page_size": "A4",
        "thumbnail_emoji": "📝",
        "is_default": True,
        "width": 794, "height": 1123,
        "fields": ["name", "class", "section", "roll_no", "exam_name"],
        "writer_json": _writer_report_card(),
    },
}


class TemplateEngineService:
    """Render document templates from the JSON registry."""

    _TOKEN_PATTERN = re.compile(r"\{\{([^{}]+)\}\}|\{([^{}]+)\}")

    _SEED_CHECK_INTERVAL_SECONDS = 30.0
    _last_seed_at: float | None = None

    _TEMPLATE_ALIASES = {
        "character_certificate_v1": "character_certificate",
        "transfer_certificate_v1": "transfer_certificate",
        "staff_id_card_v1": "id_card_staff",
        "gradesheet": "grade_sheet",
        "grade-sheet": "grade_sheet",
    }

    _CATEGORY_ALIASES = {
        "id_card": "id_cards",
        "id_cards": "id_cards",
        "certificate": "certificates",
        "certificates": "certificates",
        "admit_card": "admit_cards",
        "admit_cards": "admit_cards",
        "report": "reports",
        "reports": "reports",
        "marksheet": "reports",
        "marksheets": "reports",
        "grade_sheet": "reports",
        "grade_sheets": "reports",
        "letter": "letterheads",
        "letters": "letterheads",
        "letterhead": "letterheads",
        "letterheads": "letterheads",
        "notice": "notices",
        "notices": "notices",
    }

    @classmethod
    def normalize_category(cls, category: str | None) -> str | None:
        if not category:
            return None
        key = str(category).strip().lower()
        if key in {"", "all"}:
            return None
        return cls._CATEGORY_ALIASES.get(key, key)

    @classmethod
    def resolve_template_id(cls, template_id: str) -> str:
        return cls._TEMPLATE_ALIASES.get(template_id, template_id)

    @classmethod
    def _ensure_seeded(cls) -> None:
        """Populate / sync the template table from the built-in registry.

        Runs a full upsert so that builtin templates (school_id=None) always
        reflect the latest writer_json / editor_type from the code.
        Soft-deletes builtin templates that are no longer in the registry.

        The sweep is memoized for _SEED_CHECK_INTERVAL_SECONDS per process:
        it hydrates every builtin row's full canvas/writer JSON, which made
        bulk generation pay thousands of JSONB round-trips (one sweep per
        render). Content edits land within that window; freshly wiped
        databases are covered by the registry fallback paths in
        get_template()/list_templates_for_school().
        """
        import time as _time

        now = _time.monotonic()
        if cls._last_seed_at is not None and (
            now - cls._last_seed_at < cls._SEED_CHECK_INTERVAL_SECONDS
        ):
            return

        try:
            from extensions import db
            from app.models.designer_template import DesignerTemplate
        except Exception:
            return

        try:
            existing_rows = {
                r.template_key: r
                for r in DesignerTemplate.query.filter_by(is_deleted=False, school_id=None).all()
            }
        except Exception:
            return

        changed = False
        for template_key, meta in TEMPLATES.items():
            row = existing_rows.get(template_key)

            new_editor_type = meta.get("editor_type", "designer")
            new_writer_json = meta.get("writer_json") or {}
            new_canvas_json = meta.get("canvas_json", {})

            if row is None:
                db.session.add(DesignerTemplate(
                    school_id=None,
                    template_key=template_key,
                    name=meta.get("name", template_key),
                    category=meta.get("category", "documents"),
                    editor_type=new_editor_type,
                    description=meta.get("description", ""),
                    page_size=meta.get("page_size", "A4"),
                    thumbnail_emoji=meta.get("thumbnail_emoji", "📄"),
                    thumbnail_url=meta.get("thumbnail_url", ""),
                    width=int(meta.get("width", 794)),
                    height=int(meta.get("height", 1123)),
                    page_count=max(1, int(meta.get("page_count", 1))),
                    is_default=1 if meta.get("is_default") else 0,
                    fields=meta.get("fields", []),
                    canvas_json=new_canvas_json,
                    writer_json=new_writer_json,
                    extra_config=meta.get("extra_config") or {},
                ))
                changed = True
            else:
                # Sync from code only when content actually drifted. Without
                # this guard every get_template() call rewrites + commits all
                # builtin rows — a hidden per-render write storm that wrecks
                # bulk generation throughput.
                new_name = meta.get("name", template_key)
                new_description = meta.get("description", "")
                new_fields = meta.get("fields", [])
                new_category = meta.get("category", "documents")
                desc_drift = bool(new_description) and row.description != new_description
                if (
                    row.editor_type != new_editor_type
                    or row.writer_json != new_writer_json
                    or row.canvas_json != new_canvas_json
                    or row.name != new_name
                    or desc_drift
                    or row.fields != new_fields
                    or row.category != new_category
                ):
                    row.editor_type = new_editor_type
                    row.writer_json = new_writer_json
                    row.canvas_json = new_canvas_json
                    row.name = new_name
                    row.description = meta.get("description", row.description or "")
                    row.fields = meta.get("fields", row.fields or [])
                    row.category = meta.get("category", row.category or "documents")
                    changed = True

        # Soft-delete builtin templates removed from the registry
        for key, row in existing_rows.items():
            if key not in TEMPLATES:
                row.is_deleted = True
                changed = True

        if changed:
            try:
                db.session.commit()
            except Exception:
                try:
                    db.session.rollback()
                except Exception:
                    pass

        cls._last_seed_at = now

    @staticmethod
    def _template_page_count(meta: dict) -> int:
        canvas = meta.get("canvas_json") or {}
        pages = canvas.get("pages") if isinstance(canvas, dict) else None
        if isinstance(pages, list) and pages:
            return len(pages)
        return max(1, int(meta.get("page_count") or 1))

    @classmethod
    def _template_record_to_meta(cls, record) -> dict:
        meta = record.to_dict()
        meta.setdefault("id", meta.get("template_key"))
        meta.setdefault("canvas_json", {})
        meta.setdefault("writer_json", {})
        meta["page_count"] = cls._template_page_count(meta)
        return meta

    @classmethod
    def _build_fallback_template(cls, template_id: str) -> dict | None:
        meta = TEMPLATES.get(template_id)
        if not meta:
            return None
        return {
            "id": template_id,
            "template_key": template_id,
            "school_id": None,
            **meta,
            "page_count": cls._template_page_count(meta),
        }

    @staticmethod
    def _resolve_nested_value(data: dict, key: str):
        current = data
        for part in key.split("."):
            if isinstance(current, dict):
                if part not in current:
                    return None
                current = current.get(part)
                continue
            if isinstance(current, list):
                try:
                    current = current[int(part)]
                except (TypeError, ValueError, IndexError):
                    return None
                continue
            return None
        return current

    @classmethod
    def _apply_template_payload(cls, template, payload: dict, base_meta: dict | None = None):
        base = base_meta or {}
        template.template_key = payload.get("template_key") or base.get("template_key") or template.template_key
        template.name = payload.get("name") or base.get("name") or template.name
        template.category = payload.get("category") or base.get("category") or template.category
        template.editor_type = payload.get("editor_type") or base.get("editor_type") or template.editor_type
        template.description = payload.get("description") if payload.get("description") is not None else base.get("description", template.description)
        template.page_size = payload.get("page_size") or base.get("page_size") or template.page_size
        template.thumbnail_emoji = payload.get("thumbnail_emoji") or base.get("thumbnail_emoji") or template.thumbnail_emoji
        template.thumbnail_url = payload.get("thumbnail_url") if payload.get("thumbnail_url") is not None else base.get("thumbnail_url", template.thumbnail_url)
        template.width = int(payload.get("width") or base.get("width") or template.width or 794)
        template.height = int(payload.get("height") or base.get("height") or template.height or 1123)
        template.page_count = max(1, int(payload.get("page_count") or base.get("page_count") or template.page_count or 1))
        template.is_default = 1 if payload.get("is_default", base.get("is_default", template.is_default)) else 0
        template.fields = payload.get("fields") if payload.get("fields") is not None else base.get("fields", template.fields)
        template.canvas_json = payload.get("canvas_json") if payload.get("canvas_json") is not None else base.get("canvas_json", template.canvas_json)
        template.writer_json = payload.get("writer_json") if payload.get("writer_json") is not None else base.get("writer_json", template.writer_json)
        template.extra_config = payload.get("extra_config") if payload.get("extra_config") is not None else base.get("extra_config", template.extra_config)
        return template

    @classmethod
    def upsert_template(cls, school_id, payload: dict) -> dict:
        """Create or update a school-scoped template override."""
        from extensions import db
        from app.models.designer_template import DesignerTemplate

        cls._ensure_seeded()

        template_key = payload.get("template_key") or payload.get("template_id") or payload.get("id")
        if not template_key:
            raise ValueError("template_key is required")
        template_key = cls.resolve_template_id(str(template_key))

        base_template = cls.get_template(template_key, school_id=school_id) or cls._build_fallback_template(template_key)
        if not base_template:
            raise ValueError(f"Template '{template_key}' not found")

        record = None
        template_row_id = payload.get("id")
        if template_row_id:
            record = DesignerTemplate.query.filter_by(id=template_row_id, school_id=school_id, is_deleted=False).first()
        if not record:
            record = DesignerTemplate.query.filter_by(
                school_id=school_id,
                template_key=template_key,
                is_deleted=False,
            ).first()
        if not record:
            record = DesignerTemplate(school_id=school_id, template_key=template_key)
            db.session.add(record)

        cls._apply_template_payload(record, payload, base_template)
        db.session.commit()
        return record.to_dict()

    @classmethod
    def list_templates(cls, category: str | None = None) -> list:
        """Return available templates, optionally filtered by category."""
        return cls.list_templates_for_school(category=category, school_id=None)

    @classmethod
    def list_templates_for_school(cls, category: str | None = None, school_id=None) -> list:
        """Return templates with school-specific overrides applied."""
        from app.models.designer_template import DesignerTemplate

        cls._ensure_seeded()
        normalized_category = cls.normalize_category(category)

        try:
            query = DesignerTemplate.query.filter(DesignerTemplate.is_deleted.is_(False))
            if school_id is not None:
                query = query.filter((DesignerTemplate.school_id.is_(None)) | (DesignerTemplate.school_id == school_id))
            else:
                query = query.filter(DesignerTemplate.school_id.is_(None))
            rows = query.all()
        except Exception:
            rows = []

        templates = {}
        for row in sorted(rows, key=lambda item: (item.school_id is not None, item.updated_at or item.created_at)):
            meta = cls._template_record_to_meta(row)
            template_category = cls.normalize_category(meta.get("category")) or meta.get("category")
            if normalized_category and template_category != normalized_category:
                continue
            templates[meta.get("template_key") or meta.get("id")] = meta

        if templates:
            return list(templates.values())

        result = []
        for tid, meta in TEMPLATES.items():
            template_category = cls.normalize_category(meta.get("category")) or meta.get("category")
            if normalized_category and template_category != normalized_category:
                continue
            result.append({"id": tid, "template_key": tid, **meta, "page_count": cls._template_page_count(meta)})
        return result

    @classmethod
    def get_template(cls, template_id: str, school_id=None) -> dict | None:
        from app.models.designer_template import DesignerTemplate

        cls._ensure_seeded()
        resolved_id = cls.resolve_template_id(template_id)

        try:
            if school_id is not None:
                row = DesignerTemplate.query.filter_by(
                    school_id=school_id,
                    template_key=resolved_id,
                    is_deleted=False,
                ).first()
                if row:
                    return cls._template_record_to_meta(row)

            row = DesignerTemplate.query.filter_by(
                school_id=None,
                template_key=resolved_id,
                is_deleted=False,
            ).first()
            if row:
                return cls._template_record_to_meta(row)
        except Exception:
            pass

        return cls._build_fallback_template(resolved_id)

    @staticmethod
    def _num(value, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _looks_like_url(value: str) -> bool:
        v = (value or "").strip().lower()
        return v.startswith("http://") or v.startswith("https://") or v.startswith("data:image/")

    @classmethod
    def _merge_data(cls, data: dict | None, school_config: dict | None) -> dict:
        payload = {}
        for k, v in (data or {}).items():
            payload[str(k)] = "" if v is None else v

        school = school_config or {}
        school_fields = {
            "school_name": school.get("school_name") or school.get("name") or "",
            "school_address": school.get("school_address") or school.get("address") or "",
            "school_phone": school.get("school_phone") or school.get("phone") or "",
            "school_email": school.get("school_email") or school.get("email") or "",
            "school_website": school.get("school_website") or school.get("website") or "",
            "school_logo": school.get("school_logo") or school.get("logo_url") or "",
        }

        merged = {**school_fields, **payload}

        # Useful aliases so templates can use either naming style.
        if merged.get("roll_number") and not merged.get("roll_no"):
            merged["roll_no"] = merged["roll_number"]
        if merged.get("roll_no") and not merged.get("roll_number"):
            merged["roll_number"] = merged["roll_no"]
        if merged.get("class_name") and not merged.get("class"):
            merged["class"] = merged["class_name"]
        if merged.get("class") and not merged.get("class_name"):
            merged["class_name"] = merged["class"]
        if merged.get("section_name") and not merged.get("section"):
            merged["section"] = merged["section_name"]
        if merged.get("section") and not merged.get("section_name"):
            merged["section_name"] = merged["section"]
        if merged.get("photo_url") and not merged.get("photo"):
            merged["photo"] = merged["photo_url"]
        if merged.get("photo") and not merged.get("photo_url"):
            merged["photo_url"] = merged["photo"]
        # Enrollment/symbol aliases: single-render callers pass the student's
        # admission_number, templates print "Enrollment No.: {enrollment_number}".
        if merged.get("admission_number") and not merged.get("enrollment_number"):
            merged["enrollment_number"] = merged["admission_number"]
        if merged.get("symbol_no") and not merged.get("enrollment_number"):
            merged["enrollment_number"] = merged["symbol_no"]
        # Document-date aliases: templates render "Date: {date}" and bulk
        # generation supplies "issue_date"; leaving_date (transfer cert)
        # defaults to the issue date when no explicit leaving date is known.
        if merged.get("issue_date") and not merged.get("date"):
            merged["date"] = merged["issue_date"]
        if not merged.get("leaving_date") and merged.get("issue_date"):
            merged["leaving_date"] = merged["issue_date"]

        return merged

    @classmethod
    def _replace_tokens(cls, text: str, values: dict) -> str:
        if not isinstance(text, str):
            return text

        def repl(match):
            key = (match.group(1) or match.group(2) or "").strip()
            value = cls._resolve_nested_value(values, key)
            if value is None:
                return ""
            if isinstance(value, (dict, list)):
                return json.dumps(value, ensure_ascii=False)
            return str(value)

        out = cls._TOKEN_PATTERN.sub(repl, text)

        # Backward-compatible smart replacements for legacy default text.
        school_name = str(values.get("school_name") or "").strip()
        school_address = str(values.get("school_address") or "").strip()
        school_phone = str(values.get("school_phone") or "").strip()
        school_website = str(values.get("school_website") or "").strip()

        if school_name:
            out = out.replace("YOUR SCHOOL NAME", school_name)

        school_info = " • ".join([x for x in [school_address, school_phone, school_website] if x])
        if school_info:
            out = out.replace("School Address  •  Phone  •  www.school.edu", school_info)
            out = out.replace("School Address | Phone | www.school.edu", school_info)
            out = out.replace("School Address  |  Phone  |  Email  |  Website", school_info)

        return out

    @classmethod
    def _deep_replace(cls, value, values: dict):
        if isinstance(value, str):
            return cls._replace_tokens(value, values)
        if isinstance(value, list):
            return [cls._deep_replace(item, values) for item in value]
        if isinstance(value, dict):
            return {k: cls._deep_replace(v, values) for k, v in value.items()}
        return value

    @classmethod
    def render_document(
        cls,
        template_id: str,
        data: dict,
        school_config: dict | None = None,
        school_id=None,
        template_meta: dict | None = None,
    ) -> dict:
        """Return canvas_json with {field} / {{field}} placeholders substituted.

        Callers that already resolved the template (bulk generation) can pass
        ``template_meta`` to skip the per-document DB lookup.
        """
        template = (
            template_meta
            if template_meta is not None
            else cls.get_template(template_id, school_id=school_id)
        )
        if not template:
            raise ValueError(f"Template '{template_id}' not found")

        canvas = copy.deepcopy(template.get("canvas_json", {}))
        if not canvas:
            return {}

        merged = cls._merge_data(data, school_config)
        return cls._deep_replace(canvas, merged)

    @classmethod
    def _render_canvas_object(cls, obj: dict) -> str:
        obj_type = str(obj.get("type") or "").lower()
        left = cls._num(obj.get("left"))
        top = cls._num(obj.get("top"))
        scale_x = cls._num(obj.get("scaleX"), 1.0) or 1.0
        scale_y = cls._num(obj.get("scaleY"), 1.0) or 1.0
        width = cls._num(obj.get("width")) * scale_x
        height = cls._num(obj.get("height")) * scale_y
        angle = cls._num(obj.get("angle"))
        opacity = cls._num(obj.get("opacity"), 1.0)

        style = [
            "position:absolute",
            f"left:{left}px",
            f"top:{top}px",
            f"opacity:{opacity}",
        ]
        if angle:
            style.append(f"transform:rotate({angle}deg)")
            style.append("transform-origin:top left")

        if obj_type in {"textbox", "text", "i-text"}:
            text_value = str(obj.get("text") or "")
            escaped_text = html.escape(text_value).replace("\n", "<br/>")
            if cls._looks_like_url(text_value):
                img_w = max(width, 32)
                img_h = max(height, 32)
                return (
                    f"<img src=\"{html.escape(text_value, quote=True)}\" alt=\"\" "
                    f"style=\"{';'.join(style)};width:{img_w}px;height:{img_h}px;object-fit:cover;\"/>"
                )

            font_size = cls._num(obj.get("fontSize"), 12)
            text_align = obj.get("textAlign") or "left"
            font_family = obj.get("fontFamily") or "Arial"
            fill = obj.get("fill") or "#1e293b"
            line_height = cls._num(obj.get("lineHeight"), 1.2)
            text_decoration = []
            if obj.get("underline"):
                text_decoration.append("underline")
            if obj.get("linethrough"):
                text_decoration.append("line-through")

            style.extend([
                f"width:{max(width, 20)}px",
                f"font-size:{font_size}px",
                f"font-family:{font_family}",
                f"font-weight:{obj.get('fontWeight') or 'normal'}",
                f"font-style:{obj.get('fontStyle') or 'normal'}",
                f"line-height:{line_height}",
                f"text-align:{text_align}",
                f"color:{fill}",
                "white-space:pre-wrap",
            ])
            if text_decoration:
                style.append(f"text-decoration:{' '.join(text_decoration)}")

            return f"<div style=\"{';'.join(style)}\">{escaped_text}</div>"

        if obj_type == "rect":
            fill = obj.get("fill") or "transparent"
            if str(fill).lower() in {"none", "transparent", "null"}:
                fill = "transparent"
            stroke = obj.get("stroke")
            stroke_width = cls._num(obj.get("strokeWidth"), 0)
            rx = cls._num(obj.get("rx"), 0)
            ry = cls._num(obj.get("ry"), 0)

            style.extend([
                f"width:{max(width, 0)}px",
                f"height:{max(height, 0)}px",
                f"background:{fill}",
            ])
            if stroke and stroke_width > 0:
                style.append(f"border:{stroke_width}px solid {stroke}")
            if rx or ry:
                style.append(f"border-radius:{rx}px/{(ry or rx)}px")
            return f"<div style=\"{';'.join(style)}\"></div>"

        if obj_type == "line":
            x1 = cls._num(obj.get("x1"), 0)
            y1 = cls._num(obj.get("y1"), 0)
            x2 = cls._num(obj.get("x2"), 0)
            y2 = cls._num(obj.get("y2"), 0)
            stroke = obj.get("stroke") or "#334155"
            stroke_width = cls._num(obj.get("strokeWidth"), 1)
            length = max(1.0, math.hypot(x2 - x1, y2 - y1))
            line_angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            line_style = [
                "position:absolute",
                f"left:{left + x1}px",
                f"top:{top + y1}px",
                f"width:{length}px",
                f"border-top:{stroke_width}px solid {stroke}",
                f"transform:rotate({line_angle}deg)",
                "transform-origin:left top",
            ]
            return f"<div style=\"{';'.join(line_style)}\"></div>"

        if obj_type == "circle":
            radius = cls._num(obj.get("radius"), max(width, height) / 2 or 25)
            diameter = max(2, radius * 2)
            fill = obj.get("fill") or "transparent"
            stroke = obj.get("stroke")
            stroke_width = cls._num(obj.get("strokeWidth"), 0)
            style.extend([
                f"width:{diameter}px",
                f"height:{diameter}px",
                "border-radius:50%",
                f"background:{fill}",
            ])
            if stroke and stroke_width > 0:
                style.append(f"border:{stroke_width}px solid {stroke}")
            return f"<div style=\"{';'.join(style)}\"></div>"

        if obj_type == "image":
            src = str(obj.get("src") or "").strip()
            if not src:
                return ""
            img_w = max(width, 32)
            img_h = max(height, 32)
            style.extend([
                f"width:{img_w}px",
                f"height:{img_h}px",
                "object-fit:cover",
            ])
            return f"<img src=\"{html.escape(src, quote=True)}\" alt=\"\" style=\"{';'.join(style)}\"/>"

        # Unsupported object type: keep layout trace so templates still render deterministically.
        if width > 0 and height > 0:
            style.extend([
                f"width:{width}px",
                f"height:{height}px",
                "border:1px dashed #cbd5e1",
                "background:rgba(148,163,184,0.08)",
                "font-size:9px",
                "color:#64748b",
                "display:flex",
                "align-items:center",
                "justify-content:center",
            ])
            return f"<div style=\"{';'.join(style)}\">{html.escape(obj_type)}</div>"

        return ""

    @classmethod
    def _render_canvas_page_html(cls, canvas: dict, width: int, height: int, is_last: bool = False) -> str:
        background = canvas.get("background") or canvas.get("backgroundColor") or "#ffffff"

        rendered = []
        for obj in canvas.get("objects", []):
            html_obj = cls._render_canvas_object(obj)
            if html_obj:
                rendered.append(html_obj)

        page_style = [
            "position:relative",
            f"width:{width}px",
            f"height:{height}px",
            f"background:{background}",
            "overflow:hidden",
            "border:1px solid #e2e8f0",
            "border-radius:4px",
            "page-break-after:auto" if is_last else "page-break-after:always",
        ]
        return f"<div style=\"{';'.join(page_style)}\">{''.join(rendered)}</div>"

    @classmethod
    def _render_canvas_html(cls, meta: dict, merged_data: dict) -> str:
        canvas = cls._deep_replace(copy.deepcopy(meta.get("canvas_json", {})), merged_data)
        width = int(cls._num(meta.get("width"), 794))
        height = int(cls._num(meta.get("height"), 1123))

        pages = canvas.get("pages") if isinstance(canvas, dict) else None
        if isinstance(pages, list) and pages:
            rendered_pages = []
            for index, page in enumerate(pages):
                page_canvas = page if isinstance(page, dict) else {}
                page_width = int(cls._num(page_canvas.get("width"), width))
                page_height = int(cls._num(page_canvas.get("height"), height))
                rendered_pages.append(cls._render_canvas_page_html(page_canvas, page_width, page_height, is_last=index == len(pages) - 1))
            return (
                "<div style='display:flex;flex-direction:column;gap:16px;align-items:flex-start;'>"
                f"{''.join(rendered_pages)}"
                "</div>"
            )

        return cls._render_canvas_page_html(canvas, width, height, is_last=True)

    @classmethod
    def _render_writer_html(cls, meta: dict, merged_data: dict) -> str:
        writer_json = cls._deep_replace(copy.deepcopy(meta.get("writer_json", {})), merged_data)
        config = writer_json.get("config") or {}
        blocks = writer_json.get("blocks") or []

        def esc(value) -> str:
            return html.escape("" if value is None else str(value))

        def md(value: str) -> str:
            text = esc(value)
            return text.replace("**", "<strong>", 1).replace("**", "</strong>", 1) if "**" in text else text

        body_parts = []

        # ── Page dimensions & font from config ──────────────────────────────
        _SIZE = {"A4": ("210mm", "297mm"), "A5": ("148mm", "210mm"), "LETTER": ("216mm", "279mm")}
        _sz  = (config.get("size") or "A4").upper()
        _ori = (config.get("orientation") or "portrait").lower()
        pg_w, pg_h = _SIZE.get(_sz, _SIZE["A4"])
        if _ori == "landscape":
            pg_w, pg_h = pg_h, pg_w
        _pad = "15mm"
        font = esc(config.get("font") or "Times New Roman")
        font_size = cls._num(config.get("fontSize"), 12)

        for block in blocks:
            block_type = block.get("type")

            if block_type == "heading":
                level = min(max(int(block.get("level", 1)), 1), 4)
                text = md(str(block.get("text") or ""))
                align = block.get("align") or "center"
                color = block.get("color") or "#1e293b"
                body_parts.append(
                    f"<h{level} style='margin:0 0 10px 0;text-align:{align};color:{color};'>{text}</h{level}>"
                )
                continue

            if block_type == "paragraph":
                text = md(str(block.get("text") or ""))
                align = block.get("align") or "left"
                color = block.get("color") or "#334155"
                size = block.get("size") or block.get("fontSize") or 12
                style = [f"margin:0 0 8px 0", f"text-align:{align}", f"color:{color}", f"font-size:{size}pt"]
                if block.get("bold"):
                    style.append("font-weight:700")
                if block.get("italic"):
                    style.append("font-style:italic")
                body_parts.append(f"<p style='{";".join(style)}'>{text}</p>")
                continue

            if block_type == "divider":
                color = block.get("color") or "#334155"
                width = cls._num(block.get("width"), 1)
                body_parts.append(f"<hr style='border:none;border-top:{width}px solid {color};margin:8px 0;'/>")
                continue

            if block_type == "spacer":
                h = cls._num(block.get("height"), 20)
                body_parts.append(f"<div style='height:{h}px'></div>")
                continue

            if block_type == "table":
                rows = block.get("rows") or []
                headers = block.get("headers") or []
                parts = ["<table style='border-collapse:collapse;width:100%;margin:8px 0;'>"]
                if headers:
                    parts.append("<thead><tr>")
                    for header in headers:
                        parts.append(
                            "<th style='border:1px solid #cbd5e1;padding:6px 10px;background:#f8fafc;font-weight:600;'>"
                            f"{md(str(header))}</th>"
                        )
                    parts.append("</tr></thead>")
                parts.append("<tbody>")
                for row in rows:
                    parts.append("<tr>")
                    for cell in row:
                        parts.append(
                            "<td style='border:1px solid #cbd5e1;padding:6px 10px;'>"
                            f"{md(str(cell))}</td>"
                        )
                    parts.append("</tr>")
                parts.append("</tbody></table>")
                body_parts.append("".join(parts))
                continue

            if block_type == "columns":
                cols = block.get("columns") or []
                items = []
                for col in cols:
                    align = col.get("align") or "left"
                    items.append(
                        f"<div style='flex:1;text-align:{align};'>{md(str(col.get('text') or ''))}</div>"
                    )
                body_parts.append(f"<div style='display:flex;gap:8px;margin:8px 0;'>{''.join(items)}</div>")
                continue

            if block_type == "signature":
                labels = block.get("labels") or []
                items = []
                for label in labels:
                    items.append(
                        "<div style='text-align:center;'>"
                        "<div style='border-top:1px solid #334155;width:180px;margin:0 auto;'></div>"
                        f"<div style='font-size:10pt;color:#64748b;margin-top:4px;'>{esc(label)}</div>"
                        "</div>"
                    )
                body_parts.append(f"<div style='display:flex;justify-content:space-between;margin-top:16px;'>{''.join(items)}</div>")
                continue

            if block_type == "header_band":
                body_parts.append(
                    f"<div style='padding:14px 24px;margin:-{_pad} -{_pad} 12px -{_pad};text-align:center;"
                    f"background:{block.get('bg') or '#1e40af'};color:{block.get('color') or '#ffffff'};'>"
                    f"<div style='font-size:18pt;font-weight:bold;'>{esc(block.get('school') or '')}</div>"
                    f"<div style='font-size:10pt;opacity:0.85;margin-top:2px;'>{esc(block.get('subtitle') or '')}</div>"
                    f"<div style='font-size:11pt;font-weight:bold;margin-top:4px;opacity:0.9;'>{esc(block.get('tagline') or '')}</div>"
                    "</div>"
                )
                continue

            if block_type == "footer_band":
                body_parts.append(
                    f"<div style='padding:6px 24px;margin:10px -{_pad} -{_pad} -{_pad};text-align:center;font-size:8pt;"
                    f"background:{block.get('bg') or '#1e293b'};color:{block.get('color') or '#94a3b8'};'>"
                    f"{esc(block.get('text') or '')}</div>"
                )
                continue

            if block_type == "subject_rows":
                # Marksheet table: Subject | Th.Full | Th.Obt | Pr.Full | Pr.Obt | Pass | Total | Grade | Result
                subjects = merged_data.get("subjects_marks") or []
                if subjects and isinstance(subjects, list):
                    hdr = "border:1px solid #065f46;padding:5px 8px;background:#065f46;color:#fff;font-weight:600;text-align:center;"
                    bw  = "border:1px solid #e2e8f0;padding:5px 8px;"
                    parts = [
                        "<table style='border-collapse:collapse;width:100%;margin:8px 0;font-size:9pt;'>",
                        "<thead><tr>",
                        f"<th style='{hdr}text-align:left;'>Subject</th>",
                        f"<th style='{hdr}'>Th. Full</th>",
                        f"<th style='{hdr}'>Th. Obt.</th>",
                        f"<th style='{hdr}'>Pr. Full</th>",
                        f"<th style='{hdr}'>Pr. Obt.</th>",
                        f"<th style='{hdr}'>Pass</th>",
                        f"<th style='{hdr}'>Total</th>",
                        f"<th style='{hdr}'>Grade</th>",
                        f"<th style='{hdr}'>Result</th>",
                        "</tr></thead><tbody>",
                    ]
                    total_obt = total_full = 0.0
                    for row in subjects:
                        grade_val = row.get("grade", "")
                        no_marks  = grade_val in ("—", "") and not row.get("obtained")
                        is_pass   = grade_val not in ("NG", "", "—") and not no_marks
                        res_color = "#16a34a" if is_pass else ("#94a3b8" if no_marks else "#dc2626")
                        res_label = "—" if no_marks else ("Pass" if is_pass else "Fail")
                        th_full   = row.get("th_full") or row.get("full_marks") or "—"
                        th_obt    = row.get("th_obtained") if row.get("th_obtained") is not None else (row.get("obtained") or 0)
                        pr_full   = row.get("pr_full") or "—"
                        pr_obt    = row.get("pr_obtained") or "—"
                        pass_m    = row.get("pass_marks") or "—"
                        tot       = row.get("obtained") or 0
                        total_obt  += float(tot)
                        total_full += float(row.get("full_marks") or 0)
                        row_bg = "" if is_pass or no_marks else "background:#fff5f5;"
                        parts.append(f"<tr style='{row_bg}'>")
                        parts.append(f"<td style='{bw}text-align:left;font-weight:500;'>{esc(row.get('subject', ''))}</td>")
                        for val in [th_full, th_obt if not no_marks else "—", pr_full, pr_obt if not no_marks else "—", pass_m]:
                            parts.append(f"<td style='{bw}text-align:center;'>{val}</td>")
                        parts.append(f"<td style='{bw}text-align:center;font-weight:600;'>{tot if not no_marks else '—'}</td>")
                        parts.append(f"<td style='{bw}text-align:center;'>{grade_val or '—'}</td>")
                        parts.append(f"<td style='{bw}text-align:center;font-weight:600;color:{res_color};'>{res_label}</td>")
                        parts.append("</tr>")
                    pct = round(total_obt / total_full * 100, 1) if total_full else 0
                    parts.append(
                        f"<tr style='background:#f0fdf4;font-weight:700;border-top:2px solid #065f46;'>"
                        f"<td style='border:1px solid #cbd5e1;padding:5px 8px;'>GRAND TOTAL</td>"
                        f"<td colspan='5' style='border:1px solid #cbd5e1;padding:5px 8px;'></td>"
                        f"<td style='border:1px solid #cbd5e1;padding:5px 8px;text-align:center;'>{total_obt:.0f} / {total_full:.0f}</td>"
                        f"<td style='border:1px solid #cbd5e1;padding:5px 8px;text-align:center;'></td>"
                        f"<td style='border:1px solid #cbd5e1;padding:5px 8px;text-align:center;color:#065f46;'>{pct}%</td>"
                        f"</tr>"
                    )
                    parts.append("</tbody></table>")
                    body_parts.append("".join(parts))
                else:
                    body_parts.append("<p style='color:#64748b;font-style:italic;'>No subject marks data available.</p>")
                continue

            if block_type == "subject_rows_neb":
                # IEMIS-style NEB grade sheet: always TH/IN rows per subject
                subjects = merged_data.get("subjects_marks") or []
                if subjects and isinstance(subjects, list):
                    bd = "border:1px solid #cbd5e1;"
                    bw = "border:1px solid #e2e8f0;"
                    hdr_style = f"{bd}padding:5px 8px;background:#1e3a8a;color:#fff;font-weight:600;text-align:center;"
                    parts = [
                        "<table style='border-collapse:collapse;width:100%;margin:8px 0;font-size:9.5pt;'>",
                        "<thead><tr>",
                        f"<th style='{hdr_style}'>SUBJECTS</th>",
                        f"<th style='{hdr_style}width:90px;'>CREDIT HOUR (CH)</th>",
                        f"<th style='{hdr_style}width:60px;'>GRADE</th>",
                        f"<th style='{hdr_style}width:90px;'>GRADE POINT (GP)</th>",
                        f"<th style='{hdr_style}width:70px;'>FINAL GRADE</th>",
                        "</tr></thead><tbody>",
                    ]
                    total_ch = 0.0
                    weighted_gp = 0.0
                    gpa_sum = 0.0
                    gpa_count = 0

                    for row in subjects:
                        subj_name  = esc(row.get("subject", ""))
                        ch_total   = float(row.get("credit_hours") or 0)
                        # TH = 75%, IN = 25% of total credit hours (NEB standard)
                        ch_th_val  = round(ch_total * 0.75, 2) if ch_total else None
                        ch_in_val  = round(ch_total * 0.25, 2) if ch_total else None
                        ch_th_disp = ch_th_val if ch_th_val is not None else "—"
                        ch_in_disp = ch_in_val if ch_in_val is not None else "—"

                        th_grade   = esc(str(row.get("th_grade") or row.get("grade") or "—"))
                        th_gp      = row.get("th_gpa") if row.get("th_gpa") is not None else row.get("gpa", "—")
                        in_grade   = esc(str(row.get("in_grade") or row.get("grade") or "—"))
                        in_gp      = row.get("in_gpa") if row.get("in_gpa") is not None else row.get("gpa", "—")
                        final_gr   = esc(str(row.get("grade") or "—"))

                        total_ch += ch_total
                        gpa_v = float(row.get("gpa") or 0)
                        if ch_total:
                            weighted_gp += gpa_v * ch_total
                        if gpa_v:
                            gpa_sum += gpa_v
                            gpa_count += 1

                        # TH row — Final Grade spans 2 rows
                        parts.append(
                            f"<tr>"
                            f"<td style='{bw}padding:4px 8px;'>{subj_name}(TH)</td>"
                            f"<td style='{bw}padding:4px 8px;text-align:center;'>{ch_th_disp}</td>"
                            f"<td style='{bw}padding:4px 8px;text-align:center;'>{th_grade}</td>"
                            f"<td style='{bw}padding:4px 8px;text-align:center;'>{th_gp}</td>"
                            f"<td rowspan='2' style='{bw}padding:4px 8px;text-align:center;font-weight:700;'>{final_gr}</td>"
                            f"</tr>"
                        )
                        # IN row — no Final Grade cell (covered by rowspan)
                        parts.append(
                            f"<tr>"
                            f"<td style='{bw}padding:4px 8px;'>{subj_name}(IN)</td>"
                            f"<td style='{bw}padding:4px 8px;text-align:center;'>{ch_in_disp}</td>"
                            f"<td style='{bw}padding:4px 8px;text-align:center;'>{in_grade}</td>"
                            f"<td style='{bw}padding:4px 8px;text-align:center;'>{in_gp}</td>"
                            f"</tr>"
                        )

                    # Total row
                    if total_ch > 0:
                        gpa_avg  = round(weighted_gp / total_ch, 2)
                        ch_disp  = round(total_ch, 2)
                    else:
                        gpa_avg = round(gpa_sum / gpa_count, 2) if gpa_count else 0.0
                        ch_disp = "—"

                    parts.append(
                        f"<tr style='background:#f1f5f9;font-weight:700;'>"
                        f"<td style='{bd}padding:5px 8px;'>&nbsp;</td>"
                        f"<td style='{bd}padding:5px 8px;text-align:center;'>{ch_disp}</td>"
                        f"<td colspan='2' style='{bd}padding:5px 8px;text-align:center;'>GRADE POINT AVERAGE = {gpa_avg}</td>"
                        f"<td style='{bd}padding:5px 8px;'>&nbsp;</td>"
                        f"</tr>"
                    )
                    parts.append("</tbody></table>")
                    body_parts.append("".join(parts))
                else:
                    body_parts.append("<p style='color:#64748b;font-style:italic;'>No subject marks data available.</p>")
                continue

            if block_type == "fee_rows":
                # Fee bill table: Particulars | Billed | Paid | Due (fee_rows data
                # comes as list of {particular, billed, paid, due} or fee dict rows)
                fee_rows_data = merged_data.get("fee_rows") or merged_data.get("fees") or []
                if fee_rows_data and isinstance(fee_rows_data, list):
                    hdr = "border:1px solid #0e7490;padding:6px 10px;background:#0e7490;color:#fff;font-weight:600;text-align:center;"
                    bw = "border:1px solid #e2e8f0;padding:6px 10px;"
                    parts = [
                        "<table style='border-collapse:collapse;width:100%;margin:8px 0;font-size:9.5pt;'>",
                        "<thead><tr>",
                        f"<th style='{hdr}text-align:left;'>Particulars</th>",
                        f"<th style='{hdr}width:110px;'>Billed (Rs.)</th>",
                        f"<th style='{hdr}width:110px;'>Paid (Rs.)</th>",
                        f"<th style='{hdr}width:110px;'>Due (Rs.)</th>",
                        "</tr></thead><tbody>",
                    ]
                    total_billed = total_paid = total_due = 0.0

                    def _amt(v):
                        try:
                            return float(v or 0)
                        except (TypeError, ValueError):
                            return 0.0

                    for row in fee_rows_data:
                        if isinstance(row, dict):
                            name = esc(row.get("particular") or row.get("name") or row.get("fee_type") or "")
                            billed = _amt(row.get("billed") or row.get("amount") or row.get("total"))
                            paid = _amt(row.get("paid") or row.get("paid_amount"))
                        else:
                            name, billed, paid = esc(str(row)), 0.0, 0.0
                        due = billed - paid
                        total_billed += billed
                        total_paid += paid
                        total_due += due
                        due_style = f"{bw}text-align:right;color:{'#dc2626' if due > 0 else '#16a34a'};font-weight:600;"
                        parts.append(
                            "<tr>"
                            f"<td style='{bw}'>{name}</td>"
                            f"<td style='{bw}text-align:right;'>{billed:,.0f}</td>"
                            f"<td style='{bw}text-align:right;'>{paid:,.0f}</td>"
                            f"<td style='{due_style}'>{due:,.0f}</td>"
                            "</tr>"
                        )
                    parts.append(
                        f"<tr style='background:#ecfeff;font-weight:700;border-top:2px solid #0e7490;'>"
                        f"<td style='{bw}'>TOTAL</td>"
                        f"<td style='{bw}text-align:right;'>{total_billed:,.0f}</td>"
                        f"<td style='{bw}text-align:right;'>{total_paid:,.0f}</td>"
                        f"<td style='{bw}text-align:right;color:{'#dc2626' if total_due > 0 else '#16a34a'};'>{total_due:,.0f}</td>"
                        "</tr>"
                    )
                    parts.append("</tbody></table>")
                    body_parts.append("".join(parts))
                else:
                    body_parts.append("<p style='color:#64748b;font-style:italic;'>No fee data available.</p>")
                continue

        return (
            f"<div style='width:{pg_w};min-height:{pg_h};padding:{_pad};box-sizing:border-box;"
            f"background:#fff;font-family:{font};font-size:{font_size}pt;color:#0f172a;line-height:1.5;'>"
            f"{''.join(body_parts)}"
            "</div>"
        )

    @classmethod
    def _render_key_value_html(cls, meta: dict, merged_data: dict) -> str:
        def esc(value) -> str:
            if value is None:
                return ""
            if isinstance(value, (list, dict)):
                value = json.dumps(value, ensure_ascii=False)
            return html.escape(str(value))

        fields = meta.get("fields") or sorted(merged_data.keys())
        rows = []
        for key in fields:
            label = html.escape(str(key).replace("_", " ").title())
            rows.append(
                "<tr>"
                f"<th style='text-align:left;padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;font-weight:600;color:#334155;'>{label}</th>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0;font-size:12px;color:#0f172a;'>{esc(merged_data.get(key, ''))}</td>"
                "</tr>"
            )

        title = html.escape(meta.get("name") or "Document")
        school_name = esc(merged_data.get("school_name") or "School")
        return (
            "<div style='font-family:Arial,sans-serif;padding:24px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;'>"
            f"<h1 style='margin:0 0 4px 0;font-size:20px;color:#0f172a;'>{title}</h1>"
            f"<p style='margin:0 0 16px 0;font-size:12px;color:#64748b;'>{school_name}</p>"
            "<table style='width:100%;border-collapse:collapse;'>"
            f"{''.join(rows)}"
            "</table>"
            "</div>"
        )

    @classmethod
    def render_html(
        cls,
        template_id: str,
        data: dict | None = None,
        school_config: dict | None = None,
        school_id=None,
        template_meta: dict | None = None,
    ) -> str:
        """Render printable HTML for both designer and writer templates.

        Callers that already resolved the template (bulk generation) can pass
        ``template_meta`` to skip the per-document DB lookup.
        """
        template = (
            template_meta
            if template_meta is not None
            else cls.get_template(template_id, school_id=school_id)
        )
        if not template:
            raise ValueError(f"Template '{template_id}' not found")

        merged_data = cls._merge_data(data, school_config)

        if template.get("editor_type") == "writer" and template.get("writer_json"):
            return cls._render_writer_html(template, merged_data)

        if template.get("canvas_json"):
            return cls._render_canvas_html(template, merged_data)

        if template.get("writer_json"):
            return cls._render_writer_html(template, merged_data)

        return cls._render_key_value_html(template, merged_data)
