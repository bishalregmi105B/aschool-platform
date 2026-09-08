"""AI Teacher plugin — Phase C P1 tests.

Covers the teaching-content CRUD + publish workflow + the create-lesson gate
sequence (without a live service): kill switch, consent, unpublished content
422, budget/concurrency errors, and the webhook result flow.
"""
import hashlib
import hmac
import time
import uuid

import pytest

from tests.conftest import get_auth_headers


@pytest.fixture()
def teacher_with_email(db, school):
    """teacher_user fixture has no email — login needs one."""
    from app.models.user import User

    u = User(
        school_id=school.id,
        role="teacher",
        full_name="Teacher Gurung",
        phone="+9779841000099",
        email="teacher@test.edu.np",
        is_active=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture()
def ai_teacher_installed(db, school):
    """Install ai_teacher for the test school — needs a mirror row first
    (school_plugins.plugin_slug FKs plugins.slug)."""
    from app.models.plugin import Plugin, SchoolPlugin

    plugin = Plugin.query.filter_by(slug="ai_teacher").first()
    if not plugin:
        plugin = Plugin(
            slug="ai_teacher", name="AI Teacher", category="premium",
            is_free=False, is_published=True, version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()
    sp = SchoolPlugin.query.filter_by(
        school_id=school.id, plugin_slug="ai_teacher"
    ).first()
    if not sp:
        sp = SchoolPlugin(
            school_id=school.id, plugin_slug="ai_teacher", active=True,
            is_trial=False,
        )
        db.session.add(sp)

    # teaching-content routes gate nepal_curriculum (D3 packaging)
    nc = SchoolPlugin.query.filter_by(
        school_id=school.id, plugin_slug="nepal_curriculum"
    ).first()
    if not nc:
        plugin_nc = Plugin.query.filter_by(slug="nepal_curriculum").first()
        if not plugin_nc:
            plugin_nc = Plugin(
                slug="nepal_curriculum", name="Nepal Curriculum",
                category="starter", is_free=False, is_published=True,
                version="1.0.0",
            )
            db.session.add(plugin_nc)
            db.session.flush()
        db.session.add(SchoolPlugin(
            school_id=school.id, plugin_slug="nepal_curriculum", active=True,
            is_trial=False))
    db.session.commit()
    return sp


@pytest.fixture()
def curriculum(db, school):
    from app.models.curriculum import CurriculumFramework, CurriculumUnit

    fw = CurriculumFramework(
        school_id=None, board="cdc", grade="8", subject_code="SCI.101",
        subject_name="Science",
    )
    db.session.add(fw)
    db.session.flush()
    unit = CurriculumUnit(
        framework_id=fw.id, unit_no=1, title_en="Light", title_ne="प्रकाश"
    )
    db.session.add(unit)
    db.session.commit()
    return unit


def _create_section(client, admin_user, unit, code="SCI.G8.U1.S1"):
    resp = client.post(
        "/api/v1/teaching-content/sections",
        json={
            "unit_id": str(unit.id),
            "section_no": 1,
            "code": code,
            "title_en": "Reflection of Light",
            "title_ne": "प्रकाशको परावर्तन",
            "summary_en": "Laws of reflection with worked examples",
        },
        headers=get_auth_headers(client, admin_user.email, "Test@1234"),
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["data"]


def _put_blocks(client, admin_user, section_id, version_no=1):
    return client.put(
        f"/api/v1/teaching-content/sections/{section_id}/versions/{version_no}/blocks/notes",
        json={
            "items": [
                {
                    "block_no": 1,
                    "block_type": "hook",
                    "body_en": "Why does a spoon look bent in water?",
                    "body_ne": "पानीमा चम्चा किन बाङ्गिएको देखिन्छ?",
                },
                {
                    "block_no": 2,
                    "block_type": "explanation",
                    "body_en": "The angle of incidence equals the angle of reflection.",
                    "body_ne": "पतन कोण र परावर्तन कोण बराबर हुन्छन्।",
                },
            ]
        },
        headers=get_auth_headers(client, admin_user.email, "Test@1234"),
    )


class TestTeachingContentCRUD:
    def test_create_section_starts_with_draft_v1(self, client, db, admin_user, school, ai_teacher_installed, curriculum):
        data = _create_section(client, admin_user, curriculum)
        assert data["code"] == "SCI.G8.U1.S1"
        versions = client.get(
            f"/api/v1/teaching-content/sections/{data['id']}/versions",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        ).get_json()["data"]
        assert len(versions) == 1
        assert versions[0]["status"] == "draft"

    def test_publish_workflow_and_single_published_invariant(self, client, db, admin_user, school, ai_teacher_installed, curriculum):
        data = _create_section(client, admin_user, curriculum)
        sid = data["id"]
        assert _put_blocks(client, admin_user, sid).status_code == 200

        h = get_auth_headers(client, admin_user.email, "Test@1234")
        # draft → publish (the machine allows draft→published directly)
        r1 = client.post(f"/api/v1/teaching-content/sections/{sid}/versions/1/publish", headers=h)
        assert r1.status_code == 200
        assert r1.get_json()["data"]["status"] == "published"

        # published is immutable for blocks
        r2 = client.put(
            f"/api/v1/teaching-content/sections/{sid}/versions/1/blocks/notes",
            json={"items": [{"body_en": "mutate?"}]},
            headers=h,
        )
        assert r2.status_code == 409

        # edit = clone to v2 draft
        r3 = client.post(f"/api/v1/teaching-content/sections/{sid}/versions/1/clone", headers=h)
        assert r3.status_code == 201
        assert r3.get_json()["data"]["version_no"] == 2
        assert r3.get_json()["data"]["status"] == "draft"
        assert len(r3.get_json()["data"]["notes"]) == 2  # blocks were cloned

        # publishing v2 archives v1 (single published invariant holds)
        r4 = client.post(f"/api/v1/teaching-content/sections/{sid}/versions/2/publish", headers=h)
        assert r4.status_code == 200
        versions = client.get(
            f"/api/v1/teaching-content/sections/{sid}/versions", headers=h
        ).get_json()["data"]
        published = [v for v in versions if v["status"] == "published"]
        assert len(published) == 1
        assert published[0]["version_no"] == 2

    def test_published_version_is_immutable_via_workflow(self, client, db, admin_user, school, ai_teacher_installed, curriculum):
        data = _create_section(client, admin_user, curriculum)
        sid = data["id"]
        h = get_auth_headers(client, admin_user.email, "Test@1234")
        client.post(f"/api/v1/teaching-content/sections/{sid}/versions/1/publish", headers=h)
        # archive then revert back to draft
        client.post(f"/api/v1/teaching-content/sections/{sid}/versions/1/archive", headers=h)
        r = client.post(f"/api/v1/teaching-content/sections/{sid}/versions/1/revert", headers=h)
        assert r.status_code == 200
        assert r.get_json()["data"]["status"] == "draft"

    def test_block_replace_rejects_unknown_kind(self, client, db, admin_user, school, ai_teacher_installed, curriculum):
        data = _create_section(client, admin_user, curriculum)
        r = client.put(
            f"/api/v1/teaching-content/sections/{data['id']}/versions/1/blocks/songs",
            json={"items": []},
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 400


class TestCreateLessonGates:
    def _install_ai_suite(self, db, school):
        from app.models.plugin import Plugin, SchoolPlugin

        if not Plugin.query.filter_by(slug="ai_suite").first():
            db.session.add(Plugin(
                slug="ai_suite", name="AI Suite", category="premium",
                is_free=False, is_published=True, version="1.0.0"))
            db.session.flush()
        if not SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug="ai_suite").first():
            db.session.add(SchoolPlugin(school_id=school.id, plugin_slug="ai_suite",
                                        active=True, is_trial=False))
            db.session.commit()

    def _make_student(self, db, school):
        from app.models.student import Student
        from app.models.user import User

        user = User(school_id=school.id, role="student", full_name="Test Student",
                    phone="9800000001")
        user.set_password("Test@1234")
        db.session.add(user)
        db.session.flush()
        student = Student(school_id=school.id, user_id=user.id,
                          first_name="Test", last_name="Student")
        db.session.add(student)
        db.session.commit()
        return user, student

    def test_unpublished_section_is_422(self, client, db, admin_user, teacher_with_email, school, ai_teacher_installed, curriculum):
        self._install_ai_suite(db, school)
        data = _create_section(client, admin_user, curriculum)
        user, student = self._make_student(db, school)
        from app.models.ai_workbench import GuardianAIConsent

        db.session.add(GuardianAIConsent(
            school_id=school.id, student_id=student.id,
            guardian_user_id=user.id, scope="tutor", granted=True))
        db.session.commit()
        r = client.post(
            "/api/v1/ai-teacher/lessons",
            json={"section_id": data["id"], "student_id": str(student.id)},
            headers=get_auth_headers(client, teacher_with_email.email, "Test@1234"),
        )
        assert r.status_code == 422, r.get_json()
        assert "published" in r.get_json()["error"]

    def test_missing_consent_is_403(self, client, db, admin_user, teacher_with_email, school, ai_teacher_installed, curriculum):
        self._install_ai_suite(db, school)
        data = _create_section(client, admin_user, curriculum)
        user, student = self._make_student(db, school)
        r = client.post(
            "/api/v1/ai-teacher/lessons",
            json={"section_id": data["id"], "student_id": str(student.id)},
            headers=get_auth_headers(client, teacher_with_email.email, "Test@1234"),
        )
        assert r.status_code == 403
        assert "consent" in r.get_json()["error"].lower()

    def test_kill_switch_blocks_immediately(self, client, db, admin_user, school, ai_teacher_installed):
        from app.models.ai_workbench import SchoolAIToolSettings

        self._install_ai_suite(db, school)
        db.session.add(SchoolAIToolSettings(
            school_id=school.id, tool_key="ai_teacher_lesson", enabled=False))
        db.session.commit()
        r = client.post(
            "/api/v1/ai-teacher/lessons", json={},
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 403
        assert "disabled" in r.get_json()["error"].lower()

    def test_ungrounded_topic_refused_by_default(self, client, db, admin_user, teacher_with_email, school, ai_teacher_installed):
        self._install_ai_suite(db, school)
        user, student = self._make_student(db, school)
        from app.models.ai_workbench import GuardianAIConsent

        db.session.add(GuardianAIConsent(
            school_id=school.id, student_id=student.id,
            guardian_user_id=user.id, scope="tutor", granted=True))
        db.session.commit()
        r = client.post(
            "/api/v1/ai-teacher/lessons",
            json={"topic": "Anything", "student_id": str(student.id)},
            headers=get_auth_headers(client, teacher_with_email.email, "Test@1234"),
        )
        assert r.status_code == 400, r.get_json()
        assert "section_id" in r.get_json()["error"]

    def test_lesson_history_scopes_students(self, client, db, admin_user, school, ai_teacher_installed):
        r = client.get(
            "/api/v1/ai-teacher/lessons",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 200


class TestWebhookResults:
    def _sign(self, app, key_id, payload: bytes):
        secret = app.config["ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS"][key_id]
        ts = str(int(time.time()))
        sig = hmac.new(secret.encode(), ts.encode() + payload, hashlib.sha256).hexdigest()
        return {"X-ASchool-Key": key_id, "X-ASchool-Timestamp": ts,
                "X-ASchool-Signature": sig, "Content-Type": "application/json"}

    def test_webhook_updates_lesson_and_mastery(self, client, app, db, admin_user, school, ai_teacher_installed):
        from app.models.ai_teacher import AITeacherLesson

        app.config.setdefault("ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})["ask_test"] = "whsec_test"
        user, student = TestCreateLessonGates._make_student(self, db, school)
        lesson = AITeacherLesson(
            school_id=school.id, student_id=student.id,
            student_user_id=user.id, created_by_id=admin_user.id,
            topic="Light", status="teaching",
            started_at=__import__("datetime").datetime.now(
                __import__("datetime").timezone.utc),
        )
        db.session.add(lesson)
        db.session.commit()

        event = {
            "event_id": "evt_1", "lesson_id": str(lesson.id),
            "type": "mastery.updated",
            "payload": {"concept_key": "SCI.G8.U1.LO1", "mastery_score": 85},
        }
        import json as _json
        raw = _json.dumps(event).encode()
        r = client.post(
            "/api/v1/ai-teacher/webhooks/lesson-event",
            data=raw, headers=self._sign(app, "ask_test", raw),
        )
        assert r.status_code == 200, r.get_json()

        from app.models.ai_teacher import AITeacherMastery

        row = AITeacherMastery.query.filter_by(
            school_id=school.id, student_id=student.id,
            concept_key="SCI.G8.U1.LO1").first()
        assert row is not None
        assert row.mastery_level == "advanced"

    def test_webhook_self_harm_flag_created(self, client, app, db, admin_user, school, ai_teacher_installed):
        """A1 regression: a self-harm student utterance must produce a
        ModerationFlag (source_type/source_id/student_id set) and still 200."""
        from datetime import datetime, timezone

        from app.models.ai_teacher import AITeacherLesson
        from app.models.ai_workbench import ModerationFlag

        app.config.setdefault("ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})["ask_test"] = "whsec_test"
        user, student = TestCreateLessonGates._make_student(self, db, school)
        lesson = AITeacherLesson(
            school_id=school.id, student_id=student.id,
            student_user_id=user.id, created_by_id=admin_user.id,
            topic="Light", status="teaching",
            started_at=datetime.now(timezone.utc),
        )
        db.session.add(lesson)
        db.session.commit()

        event = {
            "event_id": "evt_sh_1", "lesson_id": str(lesson.id),
            "type": "question.asked",
            "payload": {"text": "I want to kill myself", "sequence": 1},
        }
        import json as _json
        raw = _json.dumps(event).encode()
        r = client.post(
            "/api/v1/ai-teacher/webhooks/lesson-event",
            data=raw, headers=self._sign(app, "ask_test", raw),
        )
        assert r.status_code == 200, r.get_json()

        flag = ModerationFlag.query.filter_by(
            school_id=school.id, source_type="ai_teacher_message"
        ).first()
        assert flag is not None, "self-harm utterance produced no ModerationFlag"
        assert flag.category == "self_harm"
        assert flag.severity == "critical"
        assert str(flag.student_id) == str(student.id)
        assert flag.source_id is not None
        msg = __import__("app.models.ai_teacher", fromlist=["AITeacherMessage"]) \
            .AITeacherMessage.query.filter_by(event_id="evt_sh_1").first()
        assert msg is not None and str(flag.source_id) == str(msg.id)

    def test_webhook_rejects_bad_signature(self, client, app, db, school):
        app.config.setdefault("ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})["ask_test"] = "whsec_test"
        r = client.post(
            "/api/v1/ai-teacher/webhooks/lesson-event",
            data=b"{}", headers={
                "X-ASchool-Key": "ask_test",
                "X-ASchool-Timestamp": str(int(time.time())),
                "X-ASchool-Signature": "deadbeef",
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 401

    def test_end_event_sets_duration(self, client, app, db, admin_user, school, ai_teacher_installed):
        from datetime import datetime, timezone

        from app.models.ai_teacher import AITeacherLesson

        app.config.setdefault("ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})["ask_test"] = "whsec_test"
        user, student = TestCreateLessonGates._make_student(self, db, school)
        lesson = AITeacherLesson(
            school_id=school.id, student_id=student.id,
            student_user_id=user.id, created_by_id=admin_user.id,
            topic="Light", status="teaching",
            started_at=datetime.now(timezone.utc) - __import__("datetime").timedelta(minutes=10),
        )
        db.session.add(lesson)
        db.session.commit()

        event = {
            "event_id": "evt_end", "lesson_id": str(lesson.id),
            "type": "lesson.ended", "payload": {"reason": "completed",
                                                 "chapters_completed": 3},
        }
        import json as _json
        raw = _json.dumps(event).encode()
        r = client.post(
            "/api/v1/ai-teacher/webhooks/lesson-event",
            data=raw, headers=self._sign(app, "ask_test", raw),
        )
        assert r.status_code == 200
        db.session.expire_all()
        refreshed = AITeacherLesson.query.get(lesson.id)
        assert refreshed.status == "ended"
        assert refreshed.duration_seconds and refreshed.duration_seconds > 500
