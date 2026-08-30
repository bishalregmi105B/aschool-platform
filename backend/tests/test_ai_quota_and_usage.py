"""Phase-2 AI batch regression tests (E18 fixes).

Pins:
1. Quota exhaustion → clear 429 (global QuotaExceededError handler), not 500.
2. /ai-usage/stats daily_chart covers the LAST 7 days (not the oldest 7).
3. SchoolInsightsService.calculate_student_risk_scores no longer crashes on
   Incident.involved_student_ids (was the nonexistent `students_involved`).
4. AdaptiveLearningAI.assess_mastery returns JSON-safe floats (Numeric→Decimal).
"""
import json
from datetime import date, datetime, timedelta
from unittest.mock import patch

from flask_jwt_extended import create_access_token
from sqlalchemy import text

from app.models.academic import Class, Subject
from app.models.ai_token import AIUsageLog, AISchoolQuota
from app.models.attendance import Attendance
from app.models.exam import Exam, Marks
from app.models.fee import FeeCollection
from app.models.incident import Incident
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student


def _ensure_plugin_rows(db, slugs):
    """The truncated test DB has no plugin catalog — create minimal rows first."""
    existing = {p.slug for p in Plugin.query.filter(Plugin.slug.in_(slugs)).all()}
    for slug in slugs:
        if slug not in existing:
            db.session.add(
                Plugin(
                    slug=slug, name=slug.replace("_", " ").title(), category="premium",
                    price_monthly=999, price_yearly=9999, is_free=False,
                    emoji="🤖", icon="Sparkles", description="test", is_published=True,
                    version="1.0.0",
                )
            )
    db.session.commit()


def _fake_provider(calls, text_payload="{}"):
    def _provider(messages, model_key, max_tokens, temperature):
        calls.append(messages)
        return {
            "text": text_payload,
            "model": "fake-smart",
            "provider": "fake",
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "latency_ms": 1,
        }

    return _provider


def _setup_ai_school(db, school, admin_user, plugins=("ai_tools",)):
    _ensure_plugin_rows(db, plugins)
    for slug in plugins:
        db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False))
    db.session.commit()
    token = create_access_token(
        identity=str(admin_user.id),
        additional_claims={"role": "school_admin", "school_id": str(school.id)},
    )
    headers = {"Authorization": f"Bearer {token}", "X-School-Slug": school.slug}
    return headers


def test_quota_exhausted_returns_429_with_clear_error(client, db, school, admin_user):
    headers = _setup_ai_school(db, school, admin_user)
    db.session.add(
        AISchoolQuota(school_id=school.id, daily_limit=1, monthly_limit=100000, is_active=True)
    )
    db.session.commit()

    calls = []
    from app.services.ai import token_hub

    with patch.object(token_hub, "_call_groq", _fake_provider(calls)), patch.object(
        token_hub, "_call_anthropic", _fake_provider(calls)
    ):
        # First call fits (check happens BEFORE the call): 0 used < 1 limit
        r1 = client.post(
            "/api/v1/ai-tools/remarks",
            headers=headers,
            json={"student_name": "S", "marks": 5, "total": 10, "percentage": 50},
        )
        assert r1.status_code == 200

        # Quota now exhausted (150 tokens used >= 1) → 429, never 500
        r2 = client.post(
            "/api/v1/ai-tools/remarks",
            headers=headers,
            json={"student_name": "S", "marks": 5, "total": 10, "percentage": 50},
        )
    body = r2.get_json()
    assert r2.status_code == 429, body
    assert "quota" in (body.get("error") or "").lower()
    assert body["quota"]["reason"] == "daily_limit"

    # The blocked attempt is itself quota-logged
    row = AIUsageLog.query.filter_by(
        school_id=school.id, status="quota_exceeded"
    ).first()
    assert row is not None
    assert row.total_tokens == 0


def test_missing_quota_row_blocks_with_inactive_reason(client, db, school, admin_user):
    headers = _setup_ai_school(db, school, admin_user)
    # No AISchoolQuota row created → blocked by design ("inactive"), not 500
    calls = []
    from app.services.ai import token_hub

    with patch.object(token_hub, "_call_groq", _fake_provider(calls)), patch.object(
        token_hub, "_call_anthropic", _fake_provider(calls)
    ):
        r = client.post(
            "/api/v1/ai-tools/remarks",
            headers=headers,
            json={"student_name": "S", "marks": 5, "total": 10, "percentage": 50},
        )
    body = r.get_json()
    assert r.status_code == 429, body
    assert body["quota"]["reason"] == "inactive"


def test_daily_chart_covers_last_seven_days_only(client, db, school, admin_user):
    headers = _setup_ai_school(db, school, admin_user)
    db.session.add(
        AISchoolQuota(school_id=school.id, daily_limit=100000, monthly_limit=1000000, is_active=True)
    )
    old_row = AIUsageLog(
        school_id=school.id, user_id=admin_user.id, feature="old:feature", model="m",
        provider="p", prompt_tokens=1, completion_tokens=1, total_tokens=999,
        latency_ms=1, status="success",
    )
    today_row = AIUsageLog(
        school_id=school.id, user_id=admin_user.id, feature="new:feature", model="m",
        provider="p", prompt_tokens=1, completion_tokens=1, total_tokens=111,
        latency_ms=1, status="success",
    )
    db.session.add_all([old_row, today_row])
    db.session.commit()
    db.session.execute(
        text("UPDATE ai_usage_logs SET created_at = :c WHERE id = :i"),
        {"c": datetime.utcnow() - timedelta(days=20), "i": old_row.id},
    )
    db.session.commit()

    r = client.get("/api/v1/ai-usage/stats", headers=headers)
    assert r.status_code == 200
    data = r.get_json()["data"]
    days = [x["day"] for x in data["daily_chart"]]
    assert str(date.today()) in days
    assert all(x["tokens"] != 999 for x in data["daily_chart"])
    chart_total = sum(x["tokens"] for x in data["daily_chart"])
    assert chart_total == 111  # old row excluded by the 7-day window


def test_risk_alerts_counts_incidents_via_involved_student_ids(client, db, school, admin_user):
    headers = _setup_ai_school(
        db, school, admin_user, plugins=("ai_tools", "ai_insights", "attendance")
    )
    klass = Class(name="Class 5", school_id=school.id)
    db.session.add(klass)
    db.session.flush()
    student = Student(
        school_id=school.id, first_name="Risk", last_name="Case",
        class_id=klass.id, status="active", admission_number="R1",
    )
    db.session.add(student)
    db.session.flush()
    # 4 absences in the last 30 days → +40 risk
    for i in range(4):
        db.session.add(
            Attendance(
                school_id=school.id, student_id=student.id, class_id=klass.id,
                date=date.today() - timedelta(days=i + 1), status="absent",
            )
        )
    db.session.add(
        FeeCollection(school_id=school.id, student_id=student.id, amount=1000,
                      payment_status="pending")
    )
    db.session.add(
        Incident(
            school_id=school.id, title="Fight", incident_type="behavioral",
            reported_by_id=admin_user.id, involved_student_ids=[student.id],
            occurred_at=datetime.utcnow(),
        )
    )
    db.session.commit()

    r = client.get("/api/v1/ai-tools/insights/risk-alerts", headers=headers)
    assert r.status_code == 200, r.get_json()  # must not 500 (was AttributeError)
    alerts = r.get_json()["data"]
    match = [a for a in alerts if a["student_name"] == "Risk Case"]
    assert len(match) == 1
    reasons = " ".join(match[0]["reasons"])
    assert "1 recent incident(s)" in reasons
    assert match[0]["risk_score"] == 75  # 40 absence + 20 fee + 15 incident


def test_assess_mastery_returns_json_safe_floats(app, db, school):
    from app.services.ai.adaptive_learning import AdaptiveLearningAI

    klass = Class(name="Class 9", school_id=school.id)
    db.session.add(klass)
    db.session.flush()
    student = Student(
        school_id=school.id, first_name="Dec", last_name="Imal",
        class_id=klass.id, status="active", admission_number="D1",
    )
    exam = Exam(school_id=school.id, name="Unit", exam_type="class_test")
    subject = Subject(school_id=school.id, name="Math", code="M")
    db.session.add_all([student, exam, subject])
    db.session.flush()
    db.session.add(
        Marks(school_id=school.id, exam_id=exam.id, student_id=student.id,
              subject_id=subject.id, class_id=klass.id, total_marks=77, obtained_marks=77)
    )
    # NULL obtained_marks must not crash (counted as 0)
    db.session.add(
        Marks(school_id=school.id, exam_id=exam.id, student_id=student.id,
              subject_id=subject.id, class_id=klass.id, total_marks=None, obtained_marks=None)
    )
    db.session.commit()

    with app.app_context():
        out = AdaptiveLearningAI.assess_mastery(str(student.id), "Math", school_id=str(school.id))
    assert isinstance(out["avg_score"], float)  # Numeric would yield Decimal → jsonify 500
    assert out["avg_score"] == 38.5
    assert out["mastery_level"] == "beginner"
    assert out["total_assessments"] == 2
    json.dumps(out)  # must be JSON-serializable
