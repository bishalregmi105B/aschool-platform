"""Phase-3 production-readiness: Design Studio bulk generation at scale.

Seeds 50 → 200 → 500 students and runs TemplateEngineService /
BulkGeneratorService directly against PostgreSQL (bypassing HTTP so timings
measure the render pipeline itself). Asserts every generated document binds
the student's identity fields and records wall time + SQL query counts so
N+1 regressions are caught.
"""
import time

import pytest
from sqlalchemy import event

from app.models.academic import Class, Section, Subject
from app.models.exam import Exam, Marks
from app.models.student import Student
from app.services.designer.bulk_generator import BulkGeneratorService

BATCH_SIZES = [50, 200, 500]

# ~60-char mixed Devanagari + Latin name (edge case b)
LONG_MIXED_NAME = (
    "सिता प्रिया राजेश्वरी देवी शर्मा अधिकारी Sita Priya Rajeshwari Devi Sharma"
)
DEVANAGARI_FIRST = "सिता"
DEVANAGARI_LAST = "शर्मा"


def _seed_class(db, school):
    klass = Class(school_id=school.id, name="Grade 10", numeric_grade=10, sort_order=10)
    db.session.add(klass)
    db.session.flush()
    section = Section(school_id=school.id, class_id=klass.id, name="A", capacity=60)
    db.session.add(section)
    db.session.flush()
    return klass, section


def _seed_students(db, school, klass, section, n):
    """Seed n students; every 10th gets a long Devanagari+Latin name,
    every 5th a pure-Devanagari name; roll numbers repeat every 25."""
    students = []
    for i in range(n):
        if i % 10 == 0:
            parts = LONG_MIXED_NAME.split(" ")
            first, last = parts[0], " ".join(parts[1:])
        elif i % 10 == 5:
            first, last = DEVANAGARI_FIRST, DEVANAGARI_LAST
        else:
            first, last = f"Student{i}", f"Test{i}"
        students.append(
            Student(
                school_id=school.id,
                class_id=klass.id,
                section_id=section.id,
                first_name=first,
                last_name=last,
                roll_number=(i % 25) + 1,  # duplicates on purpose (edge case d)
                dob_bs="2067-02-10",
                status="active",
            )
        )
    db.session.add_all(students)
    db.session.commit()


def _canvas_texts(value):
    """Collect every text string inside a rendered canvas_json structure."""
    found = []
    if isinstance(value, dict):
        if value.get("type") in ("textbox", "text", "i-text") and isinstance(
            value.get("text"), str
        ):
            found.append(value["text"])
        for v in value.values():
            found.extend(_canvas_texts(v))
    elif isinstance(value, list):
        for item in value:
            found.extend(_canvas_texts(item))
    return found


class _QueryCounter:
    """Count SQL statements executed by an engine during a block."""

    def __init__(self, engine):
        self.engine = engine
        self.statements = []

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._before)
        return self

    def _before(self, conn, cursor, statement, params, context, executemany):
        self.statements.append(statement)

    def __exit__(self, *exc):
        event.remove(self.engine, "before_cursor_execute", self._before)
        return False


@pytest.mark.parametrize("n", BATCH_SIZES)
def test_bulk_id_cards_scale_identity_and_queries(db, school, n):
    """50/200/500 ID cards: identity binding + no N+1 explosion + timing."""
    klass, section = _seed_class(db, school)
    _seed_students(db, school, klass, section, n)

    with _QueryCounter(db.engine) as counter:
        t0 = time.perf_counter()
        cards = BulkGeneratorService.generate_bulk_id_cards(
            str(school.id), class_id=str(klass.id)
        )
        elapsed = time.perf_counter() - t0

    assert len(cards) == n
    print(
        f"\n[BULK id-cards n={n}] wall={elapsed:.2f}s "
        f"queries={len(counter.statements)} "
        f"({len(counter.statements) / n:.1f}/student)"
    )

    # Identity binding — every card must carry its own student's fields.
    for card in cards:
        full_name = card["student_name"]
        assert full_name and full_name.strip(), "empty student name in card"
        assert full_name in card["html"], (
            f"student '{full_name}' missing from rendered HTML"
        )
        texts = " | ".join(_canvas_texts(card["canvas_json"]))
        assert full_name in texts, (
            f"student '{full_name}' missing from canvas_json binding"
        )
        # No unresolved tokens may remain anywhere.
        for t in _canvas_texts(card["canvas_json"]):
            assert "{photo_url}" not in t and "{name}" not in t

    # N+1 guard: query count must stay near-constant, not grow per-student
    # per-relation. Generous ceiling keeps this a regression alarm, not a perf bench.
    assert len(counter.statements) < max(60, n), (
        f"possible N+1: {len(counter.statements)} queries for {n} students "
        f"({len(counter.statements) / n:.1f} per student)"
    )
    # Wall-clock sanity (CI-friendly): must finish well under a minute.
    assert elapsed < 60, f"generation took {elapsed:.2f}s for {n} students"


@pytest.mark.parametrize("n", [50, 200])
def test_bulk_marksheets_neb_fields_and_queries(db, school, n):
    """Bulk marksheets with NEB theory/practical split + GPA + BS dates."""
    from datetime import date

    klass, section = _seed_class(db, school)
    _seed_students(db, school, klass, section, n)

    subjects = [
        Subject(
            school_id=school.id,
            name="Compulsory Nepali",
            class_ids=[klass.id],
            credit_hours=4,
            has_practical=True,
            full_marks=100,
            pass_marks=32,
            practical_full_marks=25,
            practical_pass_marks=8,
        ),
        Subject(
            school_id=school.id,
            name="Mathematics",
            class_ids=[klass.id],
            credit_hours=5,
            has_practical=False,
            full_marks=100,
            pass_marks=32,
        ),
    ]
    db.session.add_all(subjects)
    db.session.flush()

    exam = Exam(
        school_id=school.id,
        name="Terminal Exam 2082",
        exam_type="terminal",
        start_date_bs="2082-03-01",
        start_date=date(2026, 6, 15),
        subject_ids=[s.id for s in subjects],
    )
    db.session.add(exam)
    db.session.flush()

    students = Student.query.filter_by(
        school_id=school.id, class_id=klass.id, is_deleted=False
    ).all()

    marks_rows = []
    for s in students:
        # Nepali: theory 55/75 + practical 20/25 → total 75/100 → C+ / 2.4 GPA
        marks_rows.append(
            Marks(
                school_id=school.id,
                exam_id=exam.id,
                student_id=s.id,
                subject_id=subjects[0].id,
                class_id=klass.id,
                theory_marks=55,
                practical_marks=20,
                total_marks=75,
                full_marks=100,
                pass_marks=32,
            )
        )
        # Maths: 80/100 → A / 3.6 GPA
        marks_rows.append(
            Marks(
                school_id=school.id,
                exam_id=exam.id,
                student_id=s.id,
                subject_id=subjects[1].id,
                class_id=klass.id,
                theory_marks=80,
                total_marks=80,
                full_marks=100,
                pass_marks=32,
            )
        )
    db.session.add_all(marks_rows)
    db.session.commit()

    with _QueryCounter(db.engine) as counter:
        t0 = time.perf_counter()
        sheets = BulkGeneratorService.generate_bulk_marksheets(
            str(school.id),
            exam_id=str(exam.id),
            class_id=str(klass.id),
        )
        elapsed = time.perf_counter() - t0

    assert len(sheets) == n
    print(
        f"\n[BULK marksheets n={n}] wall={elapsed:.2f}s "
        f"queries={len(counter.statements)} "
        f"({len(counter.statements) / n:.1f}/student)"
    )

    for ms in sheets:
        assert ms["student_name"], "empty student name"
        html = ms["html"]
        assert ms["student_name"] in html or ms["student_name"].split()[0] in html
        # NEB theory/practical columns render
        assert "Th." in html and "Pr." in html
        # Subject names bound into every sheet
        assert "Compulsory Nepali" in html and "Mathematics" in html
        # GPA + grade present
        assert "GPA" in html.upper() or "GRADE POINT AVERAGE" in html.upper()
        # Ranks assigned 1..N without duplicates
        assert isinstance(ms.get("rank"), int)

    ranks = sorted(ms["rank"] for ms in sheets)
    assert ranks == list(range(1, n + 1)), "ranks not contiguous"

    # NOTE (honest finding): the default 'marksheet' writer template does not
    # include a {dob} block — BS dates only surface on the 'grade_sheet'
    # template ("{dob} (B.S.) {dob_ad} (A.D)"). Verify the BS date binding
    # through the data payload + grade_sheet rendering below.
    from app.services.designer.template_engine import TemplateEngineService

    probe = sheets[0]
    payload_sheet = TemplateEngineService.render_html(
        "grade_sheet",
        {
            "name": probe["student_name"],
            "dob": "2067-02-10",
            "dob_ad": "2010-05-24",
            "symbol_no": "12345A",
            "exam_year": "2082",
            "gpa": 3.2,
            "school_name": "Test Academy",
            "subjects_marks": [
                {
                    "subject": "Compulsory Nepali",
                    "credit_hours": 4,
                    "grade": "C+",
                    "gpa": 2.4,
                }
            ],
        },
        {},
        school_id=None,
    )
    assert "2067-02-10" in payload_sheet, "BS (Bikram Sambat) DOB missing"
    assert "2010-05-24" in payload_sheet, "AD DOB missing"
    assert "GRADE POINT AVERAGE = 3.2" in payload_sheet

    assert len(counter.statements) < max(60, n * 2), (
        f"possible N+1: {len(counter.statements)} queries for {n} students"
    )
    assert elapsed < 120, f"marksheet generation took {elapsed:.2f}s for {n}"


# ── Edge cases ────────────────────────────────────────────────────────────────


def test_edge_student_without_photo_renders_cleanly(app, db, school):
    """(a) No photo: image object degrades to empty, no crash, no token left."""
    klass, section = _seed_class(db, school)
    s = Student(
        school_id=school.id,
        class_id=klass.id,
        section_id=section.id,
        first_name="NoPhoto",
        last_name="Student",
        roll_number=1,
        status="active",
    )
    db.session.add(s)
    db.session.commit()

    cards = BulkGeneratorService.generate_bulk_id_cards(
        str(school.id), class_id=str(klass.id)
    )
    assert len(cards) == 1
    card = cards[0]
    assert "NoPhoto Student" in card["html"]
    texts = _canvas_texts(card["canvas_json"])
    assert all("{photo_url}" not in t for t in texts)
    # The photo image object degrades to src="" in canvas_json and the HTML
    # renderer drops empty-src images entirely — no broken <img> tags.
    imgs = _collect_images(card["canvas_json"])
    assert any(str(img.get("src", "")).startswith("data:image/png") for img in imgs), (
        "QR image missing"
    )
    assert '<img src=""' not in card["html"]
    assert 'src="https' not in card["html"] or "photo" not in card["html"]


def test_edge_long_devanagari_latin_name(app, db, school):
    """(b) ~60-char mixed-script name renders fully, no truncation/crash."""
    from app.services.designer.template_engine import TemplateEngineService

    html = TemplateEngineService.render_html(
        "id_card_standard",
        {"name": LONG_MIXED_NAME, "roll_no": "42"},
        {},
        school_id=None,
    )
    assert LONG_MIXED_NAME in html
    canvas_doc = TemplateEngineService.render_document(
        "id_card_standard", {"name": LONG_MIXED_NAME}, {}, school_id=None
    )
    assert LONG_MIXED_NAME in " | ".join(_canvas_texts(canvas_doc))


def test_edge_missing_required_fields_no_tokens_leak(app, db, school):
    """(c) Missing fields degrade to empty strings — no raw {tokens} leak."""
    from app.services.designer.template_engine import TemplateEngineService

    for template_id in ("id_card_standard", "marksheet", "grade_sheet"):
        html = TemplateEngineService.render_html(template_id, {}, {}, school_id=None)
        assert "{" + "name" + "}" not in html
        assert "{" + "school_name" + "}" not in html
        assert html.strip(), f"{template_id} rendered empty HTML"


def test_edge_duplicate_roll_numbers_one_card_per_student(app, db, school):
    """(d) Duplicate roll numbers never collapse or crash bulk generation."""
    klass, section = _seed_class(db, school)
    for i in range(6):
        db.session.add(
            Student(
                school_id=school.id,
                class_id=klass.id,
                section_id=section.id,
                first_name=f"Dup{i}",
                last_name="Roll",
                roll_number=7,  # identical for all six
                status="active",
            )
        )
    db.session.commit()

    cards = BulkGeneratorService.generate_bulk_id_cards(
        str(school.id), class_id=str(klass.id)
    )
    assert len(cards) == 6
    ids = {card["student_id"] for card in cards}
    assert len(ids) == 6


# ── Nepal rendering / PDF font embedding ─────────────────────────────────────


def test_devanagari_pdf_font_embedding(app, db):
    """WeasyPrint PDF path embeds a Devanagari-capable font when one exists.

    Skips (with documentation) on hosts lacking a Devanagari system font —
    there the PDF will show tofu boxes because templates do not @font-face
    embed a font themselves; they rely on OS fonts via fontconfig.
    """
    import shutil
    import subprocess

    from weasyprint import HTML

    from app.services.designer.template_engine import TemplateEngineService

    try:
        fc_output = subprocess.run(
            ["fc-list", ":family=Noto Sans Devanagari"],
            capture_output=True,
            text=True,
            timeout=10,
        ).stdout
    except Exception:
        fc_output = ""
    has_font = bool(fc_output.strip()) or shutil.which("fc-list") is None

    if not has_font:
        pytest.skip(
            "No 'Noto Sans Devanagari' system font installed — WeasyPrint would "
            "render tofu boxes. Templates rely on OS fonts (no @font-face); "
            "install fonts-noto-core on the deployment host."
        )

    html = TemplateEngineService.render_html(
        "grade_sheet",
        {
            "name": f"{DEVANAGARI_FIRST} {DEVANAGARI_LAST}",
            "dob": "2067-02-10",
            "dob_ad": "2010-05-24",
            "symbol_no": "12345A",
            "exam_year": "2082",
            "gpa": 3.2,
            "subjects_marks": [
                {
                    "subject": "नेपाली",
                    "credit_hours": 4,
                    "grade": "B+",
                    "gpa": 3.2,
                    "th_grade": "B+",
                    "th_gpa": 3.2,
                    "in_grade": "A",
                    "in_gpa": 3.6,
                }
            ],
        },
        {},
        school_id=None,
    )
    pdf_bytes = HTML(string=html).write_pdf()
    assert pdf_bytes.startswith(b"%PDF")

    # Font names live inside compressed object streams → decompress first.
    import re
    import zlib

    embedded = set()
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", pdf_bytes, re.DOTALL):
        data = m.group(1)
        try:
            data = zlib.decompress(data)
        except Exception:
            pass
        embedded.update(
            f.decode("latin-1")
            for f in re.findall(rb"/BaseFont\s*/([^\s/>\]]+)", data)
        )

    # Templates hardcode font-family:'Arial'; WeasyPrint (via Pango/fontconfig)
    # falls back per-glyph to an installed Devanagari font and embeds it.
    assert any("Devanagari" in name for name in embedded), (
        f"PDF produced but no Devanagari-capable font was embedded "
        f"(embedded: {sorted(embedded)}) — Devanagari glyphs will show as "
        f"tofu boxes. Install fonts-noto-core on the deployment host."
    )


def test_qr_code_on_id_cards(app, db, school):
    """QR verification payload is injected into ID-card renders."""
    try:
        import qrcode  # noqa: F401
    except ImportError:
        pytest.skip("qrcode lib not installed")

    klass, section = _seed_class(db, school)
    db.session.add(
        Student(
            school_id=school.id,
            class_id=klass.id,
            section_id=section.id,
            first_name="Qr",
            last_name="Test",
            admission_number="ADM-QR-1",
            roll_number=1,
            status="active",
        )
    )
    db.session.commit()

    cards = BulkGeneratorService.generate_bulk_id_cards(
        str(school.id), class_id=str(klass.id)
    )
    assert len(cards) == 1
    card = cards[0]
    qr_images = [
        img
        for img in _collect_images(card["canvas_json"])
        if str(img.get("src", "")).startswith("data:image/png;base64,")
    ]
    assert qr_images, "no QR data-URI image found on generated ID card"


def _collect_images(value):
    found = []
    if isinstance(value, dict):
        if value.get("type") == "Image":
            found.append(value)
        for v in value.values():
            found.extend(_collect_images(v))
    elif isinstance(value, list):
        for item in value:
            found.extend(_collect_images(item))
    return found
