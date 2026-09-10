"""FC-MOB regression tests — backend endpoints added to un-break the Flutter
apps (A-03). Each test mirrors the exact call a mobile screen makes.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models.health_records import HealthProfile
from app.models.library import Book
from app.models.lms import Course, LiveClass
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from app.models.wellbeing import MoodEntry
from tests.conftest import get_auth_headers


def _install(db, school, *slugs):
    for slug in slugs:
        if not Plugin.query.filter_by(slug=slug).first():
            db.session.add(Plugin(
                slug=slug, name=slug.replace("_", " ").title(),
                category="growth", is_free=True, is_published=True,
            ))
        if not SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug=slug).first():
            db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True))
    db.session.commit()


def _student(db, school, first="Mood", last="Tester", phone="+97798411000"):
    u = User(
        school_id=school.id, role="student", full_name=f"{first} {last}",
        email=f"{first.lower()}.{last.lower()}.{datetime.utcnow().timestamp()}@test.edu.np",
        phone=phone, is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    s = Student(school_id=school.id, user_id=u.id, first_name=first, last_name=last, status="active")
    db.session.add(s)
    db.session.commit()
    return s


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


# ── visitors badge lookup ─────────────────────────────────────────────────────

def test_visitor_badge_lookup(client, db, school, admin_headers):
    from app.models.visitor import Visitor

    _install(db, school, "visitor_management")
    v = Visitor(
        school_id=school.id, name="Ram Bahadur", phone="+9779801111111",
        purpose="Parent meeting", badge_number="BADGE-42",
        checked_in_at=datetime.utcnow(), status="checked_in",
    )
    db.session.add(v)
    db.session.commit()

    resp = client.get("/api/v1/visitors/badge/BADGE-42", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["visitor_name"] == "Ram Bahadur"
    assert body["checked_out_at"] is None

    resp = client.get("/api/v1/visitors/badge/NOPE", headers=admin_headers)
    assert resp.status_code == 404


# ── wellbeing admin dashboard + alerts + teacher wellbeing ────────────────────

def test_wellbeing_dashboard_and_alerts(client, db, school, admin_headers):
    _install(db, school, "wellbeing")
    s = _student(db, school)

    db.session.add(MoodEntry(school_id=school.id, student_id=s.id, mood="happy", energy_level=4))
    db.session.add(MoodEntry(
        school_id=school.id, student_id=s.id, mood="anxious", energy_level=2, notes="exam stress",
    ))
    db.session.commit()

    resp = client.get("/api/v1/wellbeing/dashboard", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["class_summaries"] and data["at_risk_total"] >= 1

    resp = client.get("/api/v1/wellbeing/alerts", headers=admin_headers)
    assert resp.status_code == 200
    alerts = resp.get_json()["data"]
    assert len(alerts) == 1  # only the LATEST mood per student flags
    assert alerts[0]["student_name"] == "Mood Tester"
    assert alerts[0]["severity"] == "medium"


def test_teacher_wellbeing_aggregate(client, db, school, teacher_user):
    _install(db, school, "wellbeing")
    s = _student(db, school)
    db.session.add(MoodEntry(
        school_id=school.id, student_id=s.id, mood="sad", energy_level=1, notes="feeling low",
    ))
    db.session.commit()

    token = _login_any(client, teacher_user)
    resp = client.get("/api/v1/teacher/wellbeing", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["summary"]["at_risk"] >= 1
    assert data["alerts"] and data["alerts"][0]["alert_type"] == "sad"


def _login_any(client, user):
    """Password login for fixtures. The shared teacher_user fixture has no
    password set, so give it the standard test password first."""
    from extensions import db

    if not user.password_hash:
        user.set_password("Test@1234")
        db.session.commit()
    resp = client.post("/api/v1/auth/login", json={"email": user.email, "password": "Test@1234"})
    if resp.status_code == 200:
        return resp.get_json()["data"]["access_token"]
    resp = client.post("/api/v1/auth/login", json={"phone": user.phone, "password": "Test@1234"})
    if resp.status_code == 200:
        return resp.get_json()["data"]["access_token"]
    raise AssertionError(f"could not login fixture user: {resp.get_json()}")


# ── LMS live classes ─────────────────────────────────────────────────────────

def test_lms_live_classes(client, db, school, admin_headers, admin_user):
    _install(db, school, "lms")
    course = Course(school_id=school.id, title="Math 10", teacher_id=admin_user.id)
    db.session.add(course)
    db.session.flush()
    lc = LiveClass(
        school_id=school.id, title="Algebra live", course_id=course.id,
        teacher_id=admin_user.id, scheduled_at=datetime.utcnow() + timedelta(days=1),
        status="scheduled",
    )
    db.session.add(lc)
    db.session.commit()

    resp = client.get("/api/v1/lms/live-classes?status=upcoming", headers=admin_headers)
    assert resp.status_code == 200
    rows = resp.get_json()["data"]
    assert any(r["title"] == "Algebra live" for r in rows)

    resp = client.get("/api/v1/lms/live-classes?mine=1", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.get_json()["data"]) == 1
