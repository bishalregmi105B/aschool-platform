"""Regression tests for the Phase-2 CAMPUS OPS batch (audits/FIX_STATUS E40-E42).

Pins the runtime-verified behavior of the campus-ops plugins:
- library_management: issue/return with availability math;
- hostel: allocate/checkout with occupancy summary and full-room guard,
  plus rollback-on-commit-failure for the allocation write path;
- incidents: involved_student_ids must belong to the school (cross-tenant
  rejection + school-scoped name serialization) and rollback-on-commit-failure;
- gamification: points award + hand-checked leaderboard math;
- emergency: alert + headcount with UUID[]/int guards;
- wellbeing: mood log + summary math;
- E40/E41: the disaster_management and incident_management extension frontend
  surfaces now have real endpoints (E40 drills/seismic/overview; E41
  /incidents/management/*) — pinned as 200 for an installed school; the
  incident_management-only base-gate coupling pin stays.
"""
import uuid as _uuid

import pytest

from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers

CAMPUS_PLUGINS = (
    "library_management",
    "elibrary",
    "hostel",
    "health_records",
    "emergency",
    "disaster_management",
    "incidents",
    "incident_management",
    "gamification",
    "wellbeing",
)


def _seed_plugin(db, slug):
    exists = Plugin.query.filter_by(slug=slug).first()
    if exists:
        return exists
    plugin = Plugin(
        slug=slug,
        name=slug.replace("_", " ").title(),
        category="growth",
        price_monthly=0,
        price_yearly=0,
        is_free=True,
        is_published=True,
    )
    db.session.add(plugin)
    db.session.commit()
    return plugin


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    for slug in CAMPUS_PLUGINS:
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(
                school_id=school.id,
                plugin_slug=slug,
                active=True,
                is_trial=False,
            )
        )
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _make_student(db, school, first, last, phone, email=None):
    u = User(
        school_id=school.id,
        role="student",
        full_name=f"{first} {last}",
        email=email or f"{first.lower()}.{last.lower()}.{_uuid.uuid4().hex[:6]}@test.edu.np",
        phone=phone,
        is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    student = Student(
        school_id=school.id,
        user_id=u.id,
        first_name=first,
        last_name=last,
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return student


@pytest.fixture
def students(db, school):
    return [
        _make_student(db, school, "Asha", "Test", "+9779841000051"),
        _make_student(db, school, "Bibha", "Test", "+9779841000052"),
        _make_student(db, school, "Chandra", "Test", "+9779841000053"),
    ]


# ── library_management ────────────────────────────────────────────────────────

def test_library_issue_return_availability_math(client, db, school, admin_headers, students):
    s1, s2, _ = students
    resp = client.post(
        "/api/v1/library/books",
        json={"title": "Nepali Vyakaran", "author": "R. Sharma",
              "total_copies": 2, "available_copies": 2, "category": "textbook"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    book = resp.get_json()["data"]

    resp = client.post(
        "/api/v1/library/issues",
        json={"book_id": book["id"], "student_id": s1.id},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    issue = resp.get_json()["data"]
    assert issue["student_name"] == "Asha Test"
    assert issue["book_title"] == "Nepali Vyakaran"

    resp = client.get("/api/v1/library/books", headers=admin_headers)
    assert resp.get_json()["data"][0]["available_copies"] == 1

    # bogus student → 400, no copy consumed
    resp = client.post(
        "/api/v1/library/issues",
        json={"book_id": book["id"], "student_id": str(_uuid.uuid4())},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    # failed issue consumed no copy
    resp = client.get("/api/v1/library/books", headers=admin_headers)
    assert resp.get_json()["data"][0]["available_copies"] == 1

    resp = client.post(
        f"/api/v1/library/issues/{issue['id']}/return", json={}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "returned"
    assert resp.get_json()["data"]["returned_date"] is not None

    resp = client.get("/api/v1/library/books", headers=admin_headers)
    assert resp.get_json()["data"][0]["available_copies"] == 2

    # double return → 400
    resp = client.post(
        f"/api/v1/library/issues/{issue['id']}/return", json={}, headers=admin_headers
    )
    assert resp.status_code == 400


# ── hostel ────────────────────────────────────────────────────────────────────

def _hostel_with_room(client, admin_headers, capacity=1):
    resp = client.post(
        "/api/v1/hostel",
        json={"name": "Test Bhawan", "type": "girls", "total_capacity": capacity},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    hostel = resp.get_json()["data"]
    resp = client.post(
        "/api/v1/hostel/rooms",
        json={"hostel_id": hostel["id"], "room_number": "101", "capacity": capacity,
              "monthly_fee": 3000},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    return hostel, resp.get_json()["data"]


def test_hostel_allocate_checkout_occupancy(client, db, admin_headers, students):
    s1, s2, _ = students
    hostel, room = _hostel_with_room(client, admin_headers, capacity=1)
    today = __import__("datetime").date.today().isoformat()

    resp = client.post(
        "/api/v1/hostel/allocations",
        json={"room_id": room["id"], "student_id": s1.id, "check_in_date": today},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    alloc = resp.get_json()["data"]
    assert alloc["hostel_name"] == "Test Bhawan"
    assert alloc["room_number"] == "101"
    assert alloc["monthly_fee"] == 3000

    # room now full → 422; duplicate active allocation → 422
    resp = client.post(
        "/api/v1/hostel/allocations",
        json={"room_id": room["id"], "student_id": s2.id, "check_in_date": today},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    resp = client.post(
        "/api/v1/hostel/allocations",
        json={"room_id": room["id"], "student_id": s1.id, "check_in_date": today},
        headers=admin_headers,
    )
    assert resp.status_code == 422

    resp = client.get("/api/v1/hostel/summary", headers=admin_headers)
    summary = resp.get_json()["data"][0]
    assert summary["occupied"] == 1 and summary["occupancy_pct"] == 100

    resp = client.post(
        f"/api/v1/hostel/allocations/{alloc['id']}/checkout",
        json={"check_out_date": today},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "checked_out"

    resp = client.get("/api/v1/hostel/summary", headers=admin_headers)
    assert resp.get_json()["data"][0]["occupied"] == 0


def test_hostel_allocation_rollback_on_commit_failure(
    client, db, app, monkeypatch, admin_headers, students
):
    """E28-style rollback proof: a mid-write commit failure must leave ZERO
    HostelAllocation rows while the fixture room/student survive."""
    from extensions import db as _db

    s1, _, _ = students
    _, room = _hostel_with_room(client, admin_headers, capacity=1)
    today = __import__("datetime").date.today().isoformat()

    from app.models.hostel import HostelAllocation
    before = HostelAllocation.query.count()

    real_commit = _db.session.commit
    calls = {"n": 0}
    old_propagate = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False

    def failing_commit(*a, **kw):
        calls["n"] += 1
        raise RuntimeError("simulated commit failure")

    try:
        monkeypatch.setattr(_db.session, "commit", failing_commit)
        resp = client.post(
            "/api/v1/hostel/allocations",
            json={"room_id": room["id"], "student_id": s1.id, "check_in_date": today},
            headers=admin_headers,
        )
        assert resp.status_code == 500
        assert calls["n"] >= 1
    finally:
        monkeypatch.setattr(_db.session, "commit", real_commit)
        app.config["PROPAGATE_EXCEPTIONS"] = old_propagate
        _db.session.rollback()

    assert HostelAllocation.query.count() == before
    # fixture rows survive
    assert Student.query.get(s1.id) is not None


# ── incidents (+ E42 cross-tenant guard) ─────────────────────────────────────

def _foreign_student(db):
    other = School(
        name="Foreign Academy",
        slug=f"foreign-{_uuid.uuid4().hex[:8]}",
        plan="free",
        status="active",
        is_active=True,
        phone="+9779800000099",
        email="admin@foreign.edu.np",
        province="Bagmati",
        district="Kathmandu",
        municipality="Kathmandu",
        default_language="ne",
    )
    db.session.add(other)
    db.session.flush()
    return _make_student(db, other, "Foreign", "Kid", "+9779841000099")


def test_incident_rejects_foreign_school_students(client, db, admin_headers, students):
    foreign = _foreign_student(db)
    resp = client.post(
        "/api/v1/incidents",
        json={"title": "Cross tenant", "incident_type": "behavioral",
              "involved_student_ids": [str(foreign.id)]},
        headers=admin_headers,
    )
    assert resp.status_code == 400, resp.get_json()
    assert "not at this school" in resp.get_json()["error"]

    from app.models.incident import Incident
    assert Incident.query.filter_by(title="Cross tenant").count() == 0


def test_incident_serializer_names_school_scoped(client, db, admin_headers, students):
    """Legacy-row safety: even if involved_student_ids somehow holds a foreign
    id, the serializer must never resolve/leak a foreign student's name."""
    s1, _, _ = students
    foreign = _foreign_student(db)
    resp = client.post(
        "/api/v1/incidents",
        json={"title": "Legacy leak", "incident_type": "behavioral",
              "involved_student_ids": [str(s1.id)]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    inc = resp.get_json()["data"]

    from app.models.incident import Incident
    row = Incident.query.get(_uuid.UUID(inc["id"]))
    row.involved_student_ids = [s1.id, foreign.id]  # simulate pre-guard row
    db.session.commit()

    resp = client.get(f"/api/v1/incidents/{inc['id']}", headers=admin_headers)
    data = resp.get_json()["data"]
    assert "Asha Test" in data["student_names"]
    assert "Foreign Kid" not in data["student_names"]
    assert str(foreign.id) in data["student_names"]  # id fallback, no name leak


def test_incident_rollback_on_commit_failure(client, db, app, monkeypatch, admin_headers, students):
    from extensions import db as _db

    s1, _, _ = students
    from app.models.incident import Incident
    before = Incident.query.count()

    real_commit = _db.session.commit
    old_propagate = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False

    def failing_commit(*a, **kw):
        raise RuntimeError("simulated commit failure")

    try:
        monkeypatch.setattr(_db.session, "commit", failing_commit)
        resp = client.post(
            "/api/v1/incidents",
            json={"title": "Rollback probe", "incident_type": "behavioral",
                  "involved_student_ids": [str(s1.id)]},
            headers=admin_headers,
        )
        assert resp.status_code == 500
    finally:
        monkeypatch.setattr(_db.session, "commit", real_commit)
        app.config["PROPAGATE_EXCEPTIONS"] = old_propagate
        _db.session.rollback()
    assert Incident.query.count() == before


# ── gamification ──────────────────────────────────────────────────────────────

def test_gamification_points_leaderboard_math(client, admin_headers, students):
    s1, s2, s3 = students
    # S2 +20, S1 +5 then +7, S3 -3 → expected board: S2=20, S1=12, S3=-3
    awards = [(s2, 20), (s1, 5), (s1, 7), (s3, -3)]
    for student, pts in awards:
        resp = client.post(
            "/api/v1/gamification/points",
            json={"student_id": str(student.id), "points": pts, "reason": "test",
                  "category": "academic"},
            headers=admin_headers,
        )
        assert resp.status_code == 201, resp.get_json()

    resp = client.get("/api/v1/gamification/leaderboard", headers=admin_headers)
    board = resp.get_json()["data"]
    actual = [(e["rank"], e["student_name"], e["total_points"]) for e in board]
    assert actual == [
        (1, "Bibha Test", 20), (2, "Asha Test", 12), (3, "Chandra Test", -3)
    ]

    resp = client.get(f"/api/v1/gamification/points/{s1.id}", headers=admin_headers)
    assert resp.get_json()["data"]["total_points"] == 12

    # non-integer points → 400
    resp = client.post(
        "/api/v1/gamification/points",
        json={"student_id": str(s1.id), "points": 2.5},
        headers=admin_headers,
    )
    assert resp.status_code == 400


# ── emergency ────────────────────────────────────────────────────────────────

def test_emergency_alert_headcount_guards(client, admin_headers, students):
    _, s2, _ = students
    resp = client.post(
        "/api/v1/emergency/alerts",
        json={"alert_type": "earthquake", "title": "Drill", "description": "Drop cover"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    alert = resp.get_json()["data"]
    assert alert["status"] == "active"

    resp = client.post(
        "/api/v1/emergency/alerts",
        json={"alert_type": "volcano", "title": "x"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    resp = client.post(
        f"/api/v1/emergency/alerts/{alert['id']}/headcount",
        json={"total_expected": 3, "total_present": 2, "missing_student_ids": [str(s2.id)]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["data"]["missing_student_ids"] == [str(s2.id)]

    resp = client.post(
        f"/api/v1/emergency/alerts/{alert['id']}/headcount",
        json={"total_expected": 3, "total_present": 2, "missing_student_ids": ["garbage"]},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    resp = client.post(
        f"/api/v1/emergency/alerts/{alert['id']}/headcount",
        json={"total_expected": "many"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    resp = client.get(f"/api/v1/emergency/alerts/{alert['id']}/headcount", headers=admin_headers)
    assert len(resp.get_json()["data"]) == 1


# ── wellbeing ────────────────────────────────────────────────────────────────

def test_wellbeing_mood_summary_math(client, db, admin_headers, students, admin_user):
    s1, s2, _ = students
    resp = client.post(
        "/api/v1/wellbeing/mood",
        json={"student_id": str(s1.id), "mood": "happy", "energy_level": 4},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    resp = client.post(
        "/api/v1/wellbeing/mood",
        json={"student_id": str(s1.id), "mood": "happy"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    resp = client.post(
        "/api/v1/wellbeing/mood",
        json={"student_id": str(s2.id), "mood": "sad", "energy_level": "low"},
        headers=admin_headers,
    )
    assert resp.status_code == 400  # non-int energy_level
    resp = client.post(
        "/api/v1/wellbeing/mood",
        json={"student_id": str(s2.id), "mood": "sad", "energy_level": 2},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    # admin has no student profile → 400 with explicit message
    resp = client.post(
        "/api/v1/wellbeing/mood", json={"mood": "happy"}, headers=admin_headers
    )
    assert resp.status_code == 400

    resp = client.get("/api/v1/wellbeing/mood/summary?days=7", headers=admin_headers)
    summary = resp.get_json()["data"]
    assert summary["mood_distribution"]["happy"] == 2
    assert summary["mood_distribution"]["sad"] == 1
    assert summary["total_entries"] == 3


# ── counselor-note contract (E43) ─────────────────────────────────────────────

def test_counselor_note_persists_content_and_returns_student_name(
    client, db, admin_headers, students
):
    """The web counselor page previously sent {note, session_type} which the
    backend ignored (reads `content`/`type`) → notes saved with empty content.
    Also pins the serializer's student_name used by the web table."""
    s1, _, _ = students
    resp = client.post(
        "/api/v1/wellbeing/counselor-notes",
        json={"student_id": str(s1.id), "type": "counseling",
              "content": "Follow up next week"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    note = resp.get_json()["data"]
    assert note["content"] == "Follow up next week"
    assert note["note_type"] == "counseling"
    assert note["student_name"] == "Asha Test"

    resp = client.get("/api/v1/wellbeing/counselor-notes", headers=admin_headers)
    rows = resp.get_json()["data"]
    assert any(n["id"] == note["id"] and n["student_name"] == "Asha Test" for n in rows)


# ── slug gating + extension-surface pins (E40/E41) ───────────────────────────

def test_plugin_gate_toggles_incidents_and_wellbeing(client, db, admin_headers):
    from extensions import cache

    resp = client.get("/api/v1/incidents", headers=admin_headers)
    assert resp.status_code == 200

    sp = SchoolPlugin.query.filter_by(plugin_slug="incidents").first()
    sp.active = False
    db.session.commit()
    # g.installed_plugins is cached for 300 s (school:{id}:plugins) — a direct
    # DB flip must invalidate the same cache key the billing paths delete.
    cache.delete(f"school:{sp.school_id}:plugins")
    resp = client.get("/api/v1/incidents", headers=admin_headers)
    assert resp.status_code == 403
    assert "install" in resp.get_json()["error"].lower()

    sp.active = True
    db.session.commit()
    cache.delete(f"school:{sp.school_id}:plugins")
    resp = client.get("/api/v1/incidents", headers=admin_headers)
    assert resp.status_code == 200


def test_incident_management_only_install_fails_base_gate(client, db, admin_user):
    """E41 coupling pin: the management tier's own web pages call /incidents/*
    routes, but those gate only the `incidents` slug, and the manifest's
    depends_on: [incidents] is NOT enforced at install time — so a school that
    buys only incident_management (growth 399) gets 403 on its own pages'
    API calls. Flips if depends_on enforcement or gate reconciliation lands."""
    for slug in ("incident_management",):
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(school_id=admin_user.school_id, plugin_slug=slug,
                         active=True, is_trial=False)
        )
    db.session.commit()
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.get("/api/v1/incidents", headers=headers)
    assert resp.status_code == 403
    assert resp.get_json()["data"]["plugin_slug"] == "incidents"


def test_extension_endpoints_are_wired(client, admin_headers):
    """E40 (disaster_management) + E41 (incident_management) — was pinned as
    404 ("flip when wired"); the surfaces are wired now (app/api/v1/
    disaster_management.py + app/api/v1/incident_management.py), so the
    extension frontends' read endpoints must answer 200 for a school with
    both plugins installed."""
    for path in (
        "/api/v1/emergency/drills",                # E40 disaster drills page
        "/api/v1/emergency/seismic-alerts",        # E40 disaster alerts page
        "/api/v1/emergency/disaster/overview",     # E40 disaster overview page
        "/api/v1/incidents/management/overview",   # E41 incident-mgmt overview
        "/api/v1/incidents/management/active",     # E41 incident-mgmt active
        "/api/v1/incidents/management/escalations",  # E41 incident-mgmt escalations
        "/api/v1/incidents/management/reports",    # E41 incident-mgmt reports
    ):
        resp = client.get(path, headers=admin_headers)
        assert resp.status_code == 200, f"{path} -> {resp.status_code}: {resp.get_json()}"
