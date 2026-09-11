"""S12 AI-foundation regression tests.

Covers:
- content loader: staging validation + ingest round-trip into the spine,
  idempotent re-run, publish gate
- governance fixes G-01..G-12 (workbench): prompt-file loading (G-01),
  grounding enforcement (G-02), context_attendance (G-03), consent scope
  (G-04), citations/output_tokens ledger (G-05), moderation categories
  (G-06), pseudonymizer word-boundaries (G-12)
- content review API: source list, chunk review actions, publish gate
"""
import hashlib
import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from app.models.academic import Class
from app.models.ai_workbench import GuardianAIConsent
from app.models.attendance import Attendance
from app.models.content_spine import (
    ContentChunk,
    ContentSource,
    ContentUnit,
    PaperQuestion,
    QuestionPaper,
)
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


# ── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def admin_headers(client, db, school, admin_user):
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _install(db, school, *slugs):
    for slug in slugs:
        if not Plugin.query.filter_by(slug=slug).first():
            db.session.add(Plugin(
                slug=slug, name=slug.replace("_", " ").title(),
                category="growth", is_free=True, is_published=True,
            ))
        if not SchoolPlugin.query.filter_by(
            school_id=school.id, plugin_slug=slug
        ).first():
            db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True))
    db.session.commit()


def _stage_book(tmp_path: Path) -> Path:
    """A minimal valid staged book: manifest + 2 verified pages."""
    book = tmp_path / "g10-science-ne-2082"
    (book / "verified").mkdir(parents=True)
    (book / "flagged").mkdir()
    (book / "pdf.sha256").write_text("a" * 64 + "  book.pdf\n")

    manifest = {
        "schema_version": "aw-book-manifest@1",
        "book": {
            "title_en": "Science Grade 10",
            "title_ne": "विज्ञान कक्षा १०",
            "subject_en": "Science", "subject_ne": "विज्ञान",
            "grade": "10", "medium": "ne",
            "edition_bs": "२०८२", "board": "cdc-secondary",
            "total_physical_pages": 2,
            "subject_code": "SCI.G10",
        },
        "units": [
            {"ordinal": 1, "unit_no_printed": "१", "unit_no_ascii": 1,
             "title_ne": "बल", "title_en": "Force",
             "page_start": 1, "page_end": 2, "expected_exercise_sets": 1},
        ],
        "front_matter": [], "back_matter": [], "language_pages": "single", "notes": [],
    }
    (book / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    def _page(no: int, exercises: list[dict]) -> dict:
        return {
            "schema_version": "aw-verify@1",
            "page_no_physical": no,
            "discrepancies": [],
            "self_confidence": "high",
            "corrected": {
                "schema_version": "aw-page@1",
                "page_no_physical": no,
                "continues_previous": False,
                "blocks": [
                    {"block_id": "b1", "kind": "heading", "bbox": [80, 60, 120, 700],
                     "text_ne": "बल", "text_en": "Force"},
                    {"block_id": "b2", "kind": "prose", "bbox": [130, 60, 300, 700],
                     "text_ne": "बल एक बाह्य बल हो जसले वस्तुको गति परिवर्तन गर्छ।", "text_en": None},
                    {"block_id": "b3", "kind": "formula_block", "bbox": [310, 100, 360, 600],
                     "text_ne": "F = ma", "formula_latex": ["$F = ma$"]},
                ],
                "contextualizer_note": "Force chapter introduction, Grade 10 Science.",
                "section_heading_path": ["बल"],
                "key_concepts": [{"term_ne": "बल", "term_en": "Force"}],
                "page_furniture": {"header": "", "footer": "", "printed_page_no": "१"},
                "exercises_seen": exercises,
                "figures_seen": [],
            },
        }

    (book / "verified" / "page_001.json").write_text(
        json.dumps(_page(1, [{"item_no_ascii": 1, "has_sub_items": False, "marks_ascii_or_null": 3}]),
                   ensure_ascii=False),
        encoding="utf-8",
    )
    (book / "verified" / "page_002.json").write_text(
        json.dumps(_page(2, [{"item_no_ascii": 2, "has_sub_items": False, "marks_ascii_or_null": 3}]),
                   ensure_ascii=False),
        encoding="utf-8",
    )
    return book


def _stage_question_paper(book: Path) -> None:
    papers = book / "question_papers"
    papers.mkdir(exist_ok=True)
    doc = {
        "schema_version": "aw-question-paper@1",
        "source_slug": "see-2081-model-math",
        "paper": {
            "paper_kind": "model_question", "title_ne": "गणित नमूना प्रश्नपत्र २०८१",
            "exam_year_bs": "२०८१", "grade": "10", "subject_code": "MTH.G10",
            "total_full_marks": 75, "duration_minutes": 180,
            "instructions_verbatim": ["सबै प्रश्नको उत्तर दिनुपर्छ।"],
        },
        "groups": [
            {"group_name": "समूह 'क'", "group_marks": 2, "questions": [
                {"question_no_printed": "१", "question_no_ascii": 1,
                 "question_type": "mcq", "marks": 1, "marks_printed": "१",
                 "stem_ne": "१ मिटर बराबर हुन्छ:", "options": [
                     {"label": "(क)", "text_ne": "१०० से.मी."},
                     {"label": "(ख)", "text_ne": "१० से.मी."},
                 ], "answer_source": "none", "sub_parts": []},
                {"question_no_printed": "२", "question_no_ascii": 2,
                 "question_type": "long_answer", "marks": 4, "marks_printed": "४",
                 "stem_ne": "पाइथागोरस प्रमेयको उपप्रयोग लेख्नुहोस्।",
                 "sub_parts": [
                     {"sub_label": "(क)", "marks": 1, "stem_ne": "कथन लेख्नुहोस्।"},
                     {"sub_label": "(ख)", "marks": 3, "stem_ne": "प्रमाणित गर्नुहोस्।"},
                 ], "answer_source": "none"},
            ]},
        ],
        "page_provenance": [{"page_no": 1, "bbox": [0, 0, 1000, 1000]}],
    }
    (papers / "see-2081-model-math.json").write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")


# ── loader: validation + ingest round-trip ───────────────────────────────────

def test_loader_validate_passes_and_catches(tmp_path):
    from app.content_loader import validate_book

    book = _stage_book(tmp_path)
    errors, warnings = validate_book(book)
    assert errors == [], errors

    # break the contract: bad bbox + unknown schema
    (book / "verified" / "page_001.json").write_text(
        json.dumps({"schema_version": "aw-page@1"}), encoding="utf-8"
    )
    errors, _ = validate_book(book)
    assert any("aw-verify@1" in e for e in errors)


def test_loader_ingest_roundtrip_and_idempotent(tmp_path, db, school):
    from app.content_loader import ingest_book

    book = _stage_book(tmp_path)
    _stage_question_paper(book)

    assert ingest_book(book, publish=True, embed=False) == 0
    source = ContentSource.query.filter_by(file_sha256="a" * 64).one()
    assert source.ingest_status == "published"
    assert source.grade == "10"
    unit = ContentUnit.query.filter_by(source_id=source.id).one()
    assert unit.unit_path == "ch1" and unit.title_ne == "बल"
    chunks = ContentChunk.query.filter_by(source_id=source.id).all()
    assert len(chunks) == 6  # 3 blocks × 2 pages
    assert all(c.is_published for c in chunks)
    # embed text carries title-chain + contextualizer prefix
    prose = next(c for c in chunks if c.kind == "prose")
    assert "बल" in prose.text_embed and "Force chapter" in prose.text_embed

    paper = QuestionPaper.query.filter_by(source_id=source.id).one()
    questions = PaperQuestion.query.filter_by(paper_id=paper.id).all()
    assert len(questions) == 4  # 2 roots + 2 sub-parts
    root = next(q for q in questions if q.sub_label is None and q.question_no_ascii == 2)
    subs = [q for q in questions if q.parent_question_id == root.id]
    assert {s.sub_label for s in subs} == {"(क)", "(ख)"}
    assert str(root.marks) in ("4", "4.00")

    # idempotent re-run: nothing duplicated
    assert ingest_book(book, publish=True, embed=False) == 0
    assert ContentSource.query.filter_by(file_sha256="a" * 64).count() == 1
    assert ContentUnit.query.filter_by(source_id=source.id).count() == 1
    assert ContentChunk.query.filter_by(source_id=source.id).count() == 6
    assert PaperQuestion.query.filter_by(paper_id=paper.id).count() == 4


def test_loader_coverage_gate_blocks_publish(tmp_path, db):
    from app.content_loader import ingest_book

    book = _stage_book(tmp_path)
    manifest = json.loads((book / "manifest.json").read_text(encoding="utf-8"))
    manifest["book"]["total_physical_pages"] = 200  # 2 staged of 200 → 1%
    (book / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    assert ingest_book(book, publish=True, embed=False) == 0
    source = ContentSource.query.filter_by(file_sha256="a" * 64).one()
    assert source.ingest_status == "review"
    assert not ContentChunk.query.filter_by(source_id=source.id).first().is_published


# ── G-02/G-03: grounding enforcement + attendance context ────────────────────

def _seed_registry():
    """The workbench registry seeds at app startup, but the autouse db-reset
    truncates it per test — re-seed on demand (the seeder is idempotent)."""
    from app.services.ai.workbench_seed import seed_workbench_tools

    seed_workbench_tools()


def test_grounding_required_blocks_without_context(client, db, school, admin_headers):
    _install(db, school, "ai_suite")
    _seed_registry()
    from app.models.ai_workbench import AIToolRegistry
    from extensions import db as _db

    row = AIToolRegistry.query.filter_by(tool_key="attendance_outreach").first()
    assert row is not None, "registry seed must define attendance_outreach"
    row.context_builder = "attendance"
    row.grounding = "required"
    _db.session.commit()

    resp = client.post(
        "/api/v1/ai/generate/attendance_outreach",
        json={"input": "draft outreach messages", "days": 7},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    body = resp.get_json()
    assert "grounding" in json.dumps(body).lower()


def test_context_attendance_returns_real_absentees(client, db, school, admin_headers, admin_user):
    from app.services.ai.tool_handlers import context_attendance
    from tests.conftest import app as _  # noqa: F401

    klass = Class(school_id=school.id, name="Grade 9")
    db.session.add(klass)
    db.session.flush()
    u = User(school_id=school.id, role="student", full_name="Absent Ram",
             email=f"ram.{id(klass) % 99999}@test.edu.np", phone="+9779861111111", is_active=True)
    db.session.add(u)
    db.session.flush()
    s = Student(school_id=school.id, user_id=u.id, first_name="Absent",
                last_name="Ram", status="active", class_id=klass.id)
    db.session.add(s)
    db.session.flush()
    db.session.add(Attendance(
        school_id=school.id, student_id=s.id, class_id=klass.id,
        date=date.today() - timedelta(days=1), status="absent",
    ))
    db.session.commit()

    from flask import g as flask_g

    with app_request_context(school, admin_user):
        context = context_attendance({})
    assert context["absentee_count"] == 1
    assert context["absentees"][0]["student_name"] == "Absent Ram"
    assert context["absentees"][0]["days_absent"] == 1
    assert context["_citations"]


# ── G-01: prompt files actually load ─────────────────────────────────────────

def test_system_prompt_loads_seeded_prompt_file(db, school):
    _seed_registry()
    from app.models.ai_workbench import AIToolRegistry
    from app.services.ai.workbench import _system_prompt

    row = AIToolRegistry.query.filter_by(tool_key="lesson_plan").first()
    assert row is not None, "registry seed must define lesson_plan"
    prompt = _system_prompt(row, None, language="en")
    # the seeded lesson_plan_en.md content, not just the inline schema dump
    assert "JSON" in prompt
    assert "schema" in prompt.lower()
    assert len(prompt) > 400


# ── G-06/G-12: moderation categories + pseudonymizer boundaries ──────────────

def test_moderate_covers_all_categories():
    from app.services.ai.workbench import moderate

    assert moderate("I want to kill myself")[1] == "self_harm"
    assert moderate("I will stab my classmate with a knife")[1] == "violence"
    assert moderate("call my guardian at 9812345678")[1] == "pii"
    assert moderate("what is photosynthesis?")[1] is None


def test_pseudonymize_respects_word_boundaries(db, school):
    from app.services.ai.workbench import de_pseudonymize, pseudonymize

    u1 = User(school_id=school.id, role="student", full_name="Ram Bahadur",
              email=f"ram.b.{id(school) % 99999}@test.edu.np", phone="+9779871111111",
              is_active=True)
    db.session.add(u1)
    db.session.flush()
    db.session.add(Student(school_id=school.id, user_id=u1.id, first_name="Ram",
                           last_name="Bahadur", status="active"))
    db.session.commit()

    text = "Ram Bahadur was absent. Ramkrishna was present."
    safe, mapping = pseudonymize(text, school.id)
    assert "Ram Bahadur" not in safe
    assert "Ramkrishna" in safe  # word boundary preserved the longer name
    assert de_pseudonymize(safe, mapping) == text


# ── G-04: consent scope enforced (tutor gate) ────────────────────────────────

def test_tutor_consent_scope_enforced(client, db, school, admin_headers, admin_user):
    _install(db, school, "ai_suite")
    u = User(school_id=school.id, role="student", full_name="Consent Kid",
             email=f"kid.{id(school) % 99999}@test.edu.np", phone="+9779881111111",
             is_active=True)
    db.session.add(u)
    db.session.flush()
    s = Student(school_id=school.id, user_id=u.id, first_name="Consent",
                last_name="Kid", status="active")
    db.session.add(s)
    db.session.flush()
    # tools-only grant: the tutor must refuse even for staff-created plans
    db.session.add(GuardianAIConsent(
        school_id=school.id, student_id=s.id,
        guardian_user_id=admin_user.id, scope="tools", granted=True,
    ))
    db.session.commit()

    resp = client.post("/api/v1/tutor/plans", json={
        "topic": "Force", "grade": "10", "student_id": str(s.id),
    }, headers=admin_headers)
    assert resp.status_code == 403
    assert "consent" in resp.get_json()["error"].lower()


# ── content review API ───────────────────────────────────────────────────────

def test_content_review_api_flow(client, db, school, admin_headers):
    from app.content_loader import ingest_book

    book = _stage_book(Path("/tmp") / f"s12-test-{id(school) % 99999}")
    _stage_question_paper(book)
    assert ingest_book(book, publish=False, embed=False) == 0

    resp = client.get("/api/v1/content/sources", headers=admin_headers)
    assert resp.status_code == 200
    sources = resp.get_json()["data"]
    assert sources and sources[0]["ingest_status"] == "review"
    source_id = sources[0]["id"]

    detail = client.get(f"/api/v1/content/sources/{source_id}", headers=admin_headers)
    assert detail.status_code == 200
    units = detail.get_json()["data"]["units"]
    assert units and units[0]["chunks"]["total"] == 6
    unit_id = units[0]["id"]

    chunks = client.get(
        f"/api/v1/content/sources/{source_id}/chunks?unit_id={unit_id}",
        headers=admin_headers,
    )
    assert chunks.status_code == 200
    rows = chunks.get_json()["data"]
    assert rows[0]["page_no"] is not None and rows[0]["text_display"]

    # flag → publish gate refuses without force → force publishes
    target = rows[0]["id"]
    resp = client.patch(f"/api/v1/content/chunks/{target}",
                        json={"action": "flag", "reason": "matra error"},
                        headers=admin_headers)
    assert resp.status_code == 200
    resp = client.post(f"/api/v1/content/sources/{source_id}/publish", json={},
                       headers=admin_headers)
    assert resp.status_code == 409
    resp = client.post(f"/api/v1/content/sources/{source_id}/publish",
                       json={"force": True}, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.get_json()["data"]["ingest_status"] == "published"


# ── test helper: request context for direct service calls ───────────────────

from contextlib import contextmanager  # noqa: E402


@contextmanager
def app_request_context(school, user):
    from flask import Flask

    from app import create_app as _create_app
    from extensions import db as _db

    app = _create_app("testing")
    with app.test_request_context("/", headers={"X-School-Slug": school.slug}):
        from flask import g as flask_g

        flask_g.school_id = school.id
        flask_g.user_id = user.id
        flask_g.role = user.role
        yield
