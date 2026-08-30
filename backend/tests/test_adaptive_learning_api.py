"""E23 regression tests — ai_adaptive_learning plugin API surface.

Pins the new blueprint app/api/v1/adaptive_learning.py (previously the
premium plugin had ZERO routes; the web pages 404'd):
1. All /lms/learning-paths*, /lms/mastery*, /lms/adaptive-progress routes are
   plugin-gated (403 without ai_adaptive_learning installed).
2. POST /learning-paths/generate-ai stores an LLM path (source="ai") and
   falls back to a LABELED deterministic path (source="rule_based_fallback")
   when the provider is unavailable — never fake LLM output.
3. Quota exhaustion bubbles to the global 429 handler.
4. Mastery assess/GET/PUT use real Marks via AdaptiveLearningAI.assess_mastery
   (per-subject, JSON-safe floats).
5. GET /adaptive-progress returns real per-student rows (avg score, level,
   path counts) and tenant-scopes everything.
"""
import json
from unittest.mock import patch

from flask_jwt_extended import create_access_token

from app.models.academic import Class, Subject
from app.models.adaptive_learning import LearningPath, MasteryRecord
from app.models.ai_token import AISchoolQuota
from app.models.exam import Exam, Marks
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student


def _ensure_plugin_rows(db, slugs):
    existing = {p.slug for p in Plugin.query.filter(Plugin.slug.in_(slugs)).all()}
    for slug in slugs:
        if slug not in existing:
            db.session.add(
                Plugin(
                    slug=slug, name=slug.replace("_", " ").title(),
                    category="premium", price_monthly=1499, price_yearly=14990,
                    is_free=False, emoji="🧠", icon="Brain", description="test",
                    is_published=True, version="1.0.0",
                )
            )
    db.session.commit()


def _install_plugin(db, school, slug="ai_adaptive_learning"):
    _ensure_plugin_rows(db, [slug])
    db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False))
    db.session.commit()


def _headers(user, school):
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "school_id": str(school.id)},
    )
    return {"Authorization": f"Bearer {token}", "X-School-Slug": school.slug}


def _setup_student(db, school, with_marks=True):
    """One class, two subjects, one student; optional real Marks rows."""
    klass = Class(name="Class 9", school_id=school.id)
    math = Subject(name="Mathematics", code="MTH", school_id=school.id)
    eng = Subject(name="English", code="ENG", school_id=school.id)
    exam = Exam(school_id=school.id, name="Unit", exam_type="class_test")
    db.session.add_all([klass, math, eng, exam])
    db.session.flush()
    student = Student(
        school_id=school.id, first_name="Ramesh", last_name="Karki",
        class_id=klass.id, status="active", admission_number="E23-T1",
    )
    db.session.add(student)
    db.session.flush()
    if with_marks:
        db.session.add(Marks(school_id=school.id, exam_id=exam.id,
                             student_id=student.id, subject_id=math.id,
                             class_id=klass.id, total_marks=100, obtained_marks=40))
        db.session.add(Marks(school_id=school.id, exam_id=exam.id,
                             student_id=student.id, subject_id=eng.id,
                             class_id=klass.id, total_marks=100, obtained_marks=85))
    db.session.commit()
    return student, klass


# ── Plugin gate ───────────────────────────────────────────────────────────

def test_adaptive_routes_403_without_plugin(client, db, school, admin_user):
    """Every adaptive-learning route is gated (plugin sold-but-empty was E21)."""
    student, _ = _setup_student(db, school)
    headers = _headers(admin_user, school)
    r = client.get("/api/v1/lms/learning-paths", headers=headers)
    assert r.status_code == 403, r.get_json()
    r = client.post("/api/v1/lms/learning-paths", headers=headers, json={"title": "X"})
    assert r.status_code == 403
    r = client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                    json={"student_id": str(student.id)})
    assert r.status_code == 403
    r = client.get("/api/v1/lms/mastery", headers=headers)
    assert r.status_code == 403
    r = client.get("/api/v1/lms/adaptive-progress", headers=headers)
    assert r.status_code == 403


# ── Generate: LLM path + honest fallback ──────────────────────────────────

def test_generate_ai_stores_llm_path(client, db, school, admin_user):
    _install_plugin(db, school)
    student, _ = _setup_student(db, school)
    headers = _headers(admin_user, school)

    llm = {
        "recommended_topics": ["Fractions", "Decimals"],
        "difficulty_level": "beginner",
        "focus_areas": ["Fractions"],
        "resources": ["Workbook"],
        "estimated_hours": 10,
    }
    with patch(
        "app.api.v1.adaptive_learning.AdaptiveLearningAI.recommend_path",
        return_value=llm,
    ):
        r = client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                        json={"student_id": str(student.id)})
    assert r.status_code == 201, r.get_json()
    data = r.get_json()["data"]
    assert data["source"] == "ai"
    assert data["source_note"] is None
    assert [s["title"] for s in data["steps"]] == ["Fractions", "Decimals"]
    assert data["difficulty"] == "easy"  # LLM "beginner" mapped to path enum
    assert data["student_name"] == "Ramesh Karki"
    # Mastery upserted from the real service: Mathematics 40 → beginner
    rec = MasteryRecord.query.filter_by(
        school_id=school.id, student_id=student.id, subject="Mathematics"
    ).first()
    assert rec is not None and rec.mastery_level == "beginner"
    assert rec.source == "computed"


def test_generate_ai_falls_back_labeled_without_provider(client, db, school, admin_user):
    _install_plugin(db, school)
    student, _ = _setup_student(db, school)
    headers = _headers(admin_user, school)

    with patch(
        "app.api.v1.adaptive_learning.AdaptiveLearningAI.recommend_path",
        side_effect=RuntimeError("No AI provider configured. Set GROQ_API_KEY"),
    ):
        r = client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                        json={"student_id": str(student.id)})
    assert r.status_code == 201, r.get_json()
    data = r.get_json()["data"]
    assert data["source"] == "rule_based_fallback"
    assert "LLM unavailable" in data["source_note"]
    # Deterministic path built from the student's REAL marks (weakest first)
    assert data["recommended_topics"] == ["Mathematics", "English"]
    assert any("40%" in f for f in data["focus_areas"])
    assert all(s["subject"] in ("Mathematics", "English") for s in data["steps"])


def test_generate_ai_quota_exhausted_returns_429(client, db, school, admin_user):
    _install_plugin(db, school)
    student, _ = _setup_student(db, school)
    db.session.add(AISchoolQuota(school_id=school.id, daily_limit=0,
                                 monthly_limit=100000, is_active=True))
    db.session.commit()
    headers = _headers(admin_user, school)

    r = client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                    json={"student_id": str(student.id)})
    assert r.status_code == 429, r.get_json()
    body = r.get_json()
    assert "quota exceeded" in body["error"]
    assert body["quota"]["reason"] == "daily_limit"
    assert LearningPath.query.filter_by(school_id=school.id).count() == 0


def test_generate_ai_regenerates_and_deactivates_previous(client, db, school, admin_user):
    """Regenerate semantics: a whole-student plan supersedes ALL of the
    student's active paths; a subject-scoped plan only replaces the same
    subject's plan (history is kept, deactivated)."""
    _install_plugin(db, school)
    student, _ = _setup_student(db, school)
    headers = _headers(admin_user, school)
    with patch(
        "app.api.v1.adaptive_learning.AdaptiveLearningAI.recommend_path",
        return_value={"recommended_topics": ["T1"]},
    ):
        client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                    json={"student_id": str(student.id)})
        client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                    json={"student_id": str(student.id)})
    active = LearningPath.query.filter_by(school_id=school.id, is_active=True).all()
    assert len(active) == 1
    total = LearningPath.query.filter_by(school_id=school.id).count()
    assert total == 2  # history kept, old path deactivated

    # A subject-scoped plan coexists with the whole-student plan…
    with patch(
        "app.api.v1.adaptive_learning.AdaptiveLearningAI.recommend_path",
        return_value={"recommended_topics": ["T1"]},
    ):
        client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                    json={"student_id": str(student.id), "subject": "Mathematics"})
    active = LearningPath.query.filter_by(school_id=school.id, is_active=True).all()
    assert len(active) == 2
    # …but regenerating the same subject replaces only that subject's plan.
    with patch(
        "app.api.v1.adaptive_learning.AdaptiveLearningAI.recommend_path",
        return_value={"recommended_topics": ["T2"]},
    ):
        client.post("/api/v1/lms/learning-paths/generate-ai", headers=headers,
                    json={"student_id": str(student.id), "subject": "Mathematics"})
    math_active = [
        p for p in LearningPath.query.filter_by(
            school_id=school.id, is_active=True, subject="Mathematics"
        ).all()
    ]
    assert len(math_active) == 1 and math_active[0].recommended_topics == ["T2"]


# ── List / manual create ──────────────────────────────────────────────────

def test_list_and_manual_create_learning_paths(client, db, school, admin_user):
    _install_plugin(db, school)
    student, _ = _setup_student(db, school, with_marks=False)
    headers = _headers(admin_user, school)

    r = client.post("/api/v1/lms/learning-paths", headers=headers,
                    json={"title": "Fractions Mastery Path", "subject": "Mathematics",
                          "class_name": "Class 5", "difficulty": "easy"})
    assert r.status_code == 201, r.get_json()
    assert r.get_json()["data"]["source"] == "manual"

    r = client.post("/api/v1/lms/learning-paths", headers=headers, json={"difficulty": "easy"})
    assert r.status_code == 400  # title required
    r = client.post("/api/v1/lms/learning-paths", headers=headers,
                    json={"title": "X", "difficulty": "impossible"})
    assert r.status_code == 400  # difficulty enum

    r = client.get("/api/v1/lms/learning-paths?search=fractions", headers=headers)
    assert r.status_code == 200
    items = r.get_json()["data"]["items"]
    assert len(items) == 1 and items[0]["title"] == "Fractions Mastery Path"
    assert items[0]["completion_rate"] == 0  # no steps, honestly zero


# ── Mastery ───────────────────────────────────────────────────────────────

def test_mastery_assess_list_put(client, db, school, admin_user):
    _install_plugin(db, school)
    student, _ = _setup_student(db, school)
    headers = _headers(admin_user, school)

    r = client.post("/api/v1/lms/mastery/assess", headers=headers,
                    json={"student_id": str(student.id)})
    assert r.status_code == 200, r.get_json()
    items = {i["subject"]: i for i in r.get_json()["data"]["items"]}
    assert items["Mathematics"]["mastery_level"] == "beginner"
    assert items["Mathematics"]["avg_score"] == 40.0  # JSON-safe float
    assert items["English"]["mastery_level"] == "advanced"
    json.dumps(items)  # fully serializable

    r = client.get("/api/v1/lms/mastery?subject=math", headers=headers)
    assert r.status_code == 200
    items = r.get_json()["data"]["items"]
    assert len(items) == 1 and items[0]["source"] == "computed"

    r = client.put(f"/api/v1/lms/mastery/{items[0]['id']}", headers=headers,
                   json={"mastery_level": "intermediate", "notes": "oral test"})
    assert r.status_code == 200
    assert r.get_json()["data"]["source"] == "manual"

    r = client.put(f"/api/v1/lms/mastery/{items[0]['id']}", headers=headers,
                   json={"mastery_level": "genius"})
    assert r.status_code == 400


# ── Adaptive progress ─────────────────────────────────────────────────────

def test_adaptive_progress_real_rows(client, db, school, admin_user):
    _install_plugin(db, school)
    student, klass = _setup_student(db, school)
    db.session.add(LearningPath(
        school_id=school.id, student_id=student.id, class_name="Class 9",
        title="P1", steps=[{"title": "a", "status": "completed"}],
        recommended_topics=["Mathematics"], source="ai",
    ))
    db.session.add(LearningPath(
        school_id=school.id, class_name="Class 9",  # class-wide → counts for all
        title="P2", source="manual",
    ))
    db.session.commit()
    headers = _headers(admin_user, school)

    r = client.get("/api/v1/lms/adaptive-progress", headers=headers)
    assert r.status_code == 200, r.get_json()
    rows = {s["student_name"]: s for s in r.get_json()["data"]["students"]}
    ramesh = rows["Ramesh Karki"]
    assert ramesh["avg_score"] == 62.5  # (40 + 85) / 2 from real Marks
    assert ramesh["level"] == "intermediate"
    assert ramesh["paths_assigned"] == 2  # own path + class-wide path
    assert ramesh["paths_completed"] == 1  # P1's single step is completed
    assert ramesh["ai_recommendation"] == "Mathematics"

    r = client.get("/api/v1/lms/adaptive-progress?class_name=Class%209", headers=headers)
    assert len(r.get_json()["data"]["students"]) == 1
    r = client.get("/api/v1/lms/adaptive-progress?search=karki", headers=headers)
    assert len(r.get_json()["data"]["students"]) == 1


# ── Tenant isolation ──────────────────────────────────────────────────────

def test_generate_ai_rejects_foreign_student(client, db, school, admin_user):
    from app.models.school import School
    from app.models.user import User

    _install_plugin(db, school)
    student, _ = _setup_student(db, school)
    other = School(name="Other", slug="other-e23", plan="free", status="active",
                   is_active=True, phone="+977980009999")
    db.session.add(other)
    db.session.flush()
    admin2 = User(school_id=other.id, role="school_admin", full_name="Other Admin",
                  phone="+977980009998", email="o@o.test", is_active=True,
                  phone_verified=True)
    admin2.set_password("Other@1234")
    _ensure_plugin_rows(db, ["ai_adaptive_learning"])
    db.session.add(SchoolPlugin(school_id=other.id, plugin_slug="ai_adaptive_learning",
                                active=True, is_trial=False))
    db.session.commit()

    r = client.post("/api/v1/lms/learning-paths/generate-ai",
                    headers=_headers(admin2, other),
                    json={"student_id": str(student.id)})
    assert r.status_code == 404  # other school's student is invisible
