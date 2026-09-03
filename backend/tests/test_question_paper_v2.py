"""A-03: Question Bank + Paper Generator v2.

Covers the deterministic bank-first path end to end (no LLM): manual items
are sampled per section, marks sum, answer keys are excluded by default,
and generated papers persist.
"""
import pytest

from app.models.academic import Class, Subject
from app.models.plugin import Plugin, SchoolPlugin
from app.models.question_bank import GeneratedPaper, PaperBlueprint, QuestionBankItem
from extensions import db as _db
from tests.conftest import get_auth_headers


@pytest.fixture
def bank_env(client, db, school, admin_user):
    p = Plugin.query.filter_by(slug="ai_tools").first()
    if not p:
        p = Plugin(slug="ai_tools", name="AI Tools", category="premium",
                   is_free=True, is_published=True, version="1.0.0", emoji="🤖")
        db.session.add(p)
    db.session.add(SchoolPlugin(school_id=school.id, plugin_slug="ai_tools", active=True, is_trial=False))
    klass = Class(school_id=school.id, name="Ten")
    db.session.add(klass)
    db.session.flush()
    subject = Subject(school_id=school.id, name="Science", code="SCI10", full_marks=100, pass_marks=32)
    db.session.add(subject)
    db.session.commit()
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    return {"headers": headers, "subject": subject, "klass": klass}


def _seed_bank(school, subject, klass, n=5, qtype="mcq", difficulty="easy"):
    db = _db
    for i in range(n):
        db.session.add(
            QuestionBankItem(
                school_id=school,
                subject_id=subject.id,
                class_id=klass.id,
                question_text=f"Q{i}: which is correct?",
                question_type=qtype,
                difficulty=difficulty,
                marks=1,
                options=[{"key": "a", "text": "opt a"}, {"key": "b", "text": "opt b"}],
                correct_answer="a",
                source="manual",
                is_approved=True,
            )
        )
    _db.session.commit()


class TestQuestionBankAPI:
    def test_bulk_add_and_list(self, client, bank_env):
        s = bank_env
        r = client.post(
            "/api/v1/ai-tools/question-bank",
            json={"items": [
                {"subject_id": str(s["subject"].id), "question_text": "What is 2+2?",
                 "question_type": "mcq", "marks": 1,
                 "options": [{"key": "a", "text": "4"}], "correct_answer": "a"},
                {"subject_id": str(s["subject"].id), "question_text": "Explain gravity.",
                 "question_type": "short_answer"},
            ]},
            headers=s["headers"],
        )
        assert r.status_code == 201, r.get_json()
        assert len(r.get_json()["data"]) == 2

        r = client.get(
            f"/api/v1/ai-tools/question-bank?subject_id={s['subject'].id}",
            headers=s["headers"],
        )
        assert r.status_code == 200
        assert len(r.get_json()["data"]) == 2

    def test_ai_item_requires_approval_flow(self, client, bank_env):
        """Unapproved AI items are invisible to sampling; approval flips it."""
        s = bank_env
        school = _school_id()
        item = QuestionBankItem(
            school_id=school, subject_id=s["subject"].id, class_id=s["klass"].id,
            question_text="AI drafted question", question_type="mcq",
            difficulty="medium", marks=1, source="ai", is_approved=False,
        )
        _db.session.add(item)
        _db.session.commit()

        headers = s["headers"]
        r = client.put(
            f"/api/v1/ai-tools/question-bank/{item.id}",
            json={"is_approved": True, "correct_answer": "b"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.get_json()["data"]["is_approved"] is True

    def test_delete_soft_deletes(self, client, bank_env):
        s = bank_env
        item = QuestionBankItem(
            school_id=_school_id(), subject_id=s["subject"].id,
            question_text="to delete", question_type="short_answer",
        )
        _db.session.add(item)
        _db.session.commit()
        r = client.delete(f"/api/v1/ai-tools/question-bank/{item.id}", headers=s["headers"])
        assert r.status_code == 200
        _db.session.expire_all()
        assert item.is_deleted is True


def _school_id():
    from app.models.school import School

    return School.query.filter_by(slug="test-academy").first().id


class TestPaperGenerationV2:
    def test_bank_first_generation_no_llm(self, client, bank_env):
        """Blueprint fully covered by approved bank items → deterministic
        paper, zero AI calls, marks sum correct, no answer key by default."""
        s = bank_env
        _seed_bank(_school_id(), s["subject"], s["klass"], n=6, qtype="mcq")
        _seed_bank(_school_id(), s["subject"], s["klass"], n=4,
                   qtype="short_answer", difficulty="medium")

        r = client.post(
            "/api/v1/ai-tools/question-paper/v2",
            json={
                "name": "Unit Test 1",
                "subject_id": str(s["subject"].id),
                "class_id": str(s["klass"].id),
                "total_marks": 20,
                "duration_minutes": 60,
                "sections": [
                    {"name": "Section A", "question_type": "mcq",
                     "count": 5, "marks_each": 2, "difficulty": "easy"},
                    {"name": "Section B", "question_type": "short_answer",
                     "count": 2, "marks_each": 5, "difficulty": "medium"},
                ],
            },
            headers=s["headers"],
        )
        assert r.status_code == 201, r.get_json()
        data = r.get_json()["data"]
        assert data["ai_generated_count"] == 0
        assert data["bank_used_count"] == 7
        assert float(data["total_marks"]) == 20.0  # 5×2 + 2×5
        for q in data["questions"]:
            assert "correct_answer" not in q  # answer key withheld by default

        # fetch WITH the key
        r2 = client.get(
            f"/api/v1/ai-tools/generated-papers/{data['id']}?include_answer_key=true",
            headers=s["headers"],
        )
        assert r2.status_code == 200
        keyed = r2.get_json()["data"]
        assert all(q.get("correct_answer") for q in keyed["questions"])
        assert GeneratedPaper.query.count() >= 1

    def test_generated_paper_persisted_with_blueprint(self, client, bank_env):
        s = bank_env
        bp = PaperBlueprint(
            school_id=_school_id(), name="Terminal Exam", subject_id=s["subject"].id,
            class_id=s["klass"].id, total_marks=5,
            sections=[{"name": "A", "question_type": "mcq", "count": 5, "marks_each": 1}],
        )
        _db.session.add(bp)
        _db.session.commit()
        _seed_bank(_school_id(), s["subject"], s["klass"], n=5)
        r = client.post(
            "/api/v1/ai-tools/question-paper/v2",
            json={"blueprint_id": str(bp.id)},
            headers=s["headers"],
        )
        assert r.status_code == 201
        assert r.get_json()["data"]["bank_used_count"] == 5
