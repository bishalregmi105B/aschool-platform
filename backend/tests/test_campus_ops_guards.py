"""Regression tests for the Phase-2 campus-ops plugin batch (2026-08-29).

Covers the fixes applied while runtime-verifying library_management, elibrary,
hostel, health_records, emergency, incidents, gamification and wellbeing:
- hostel: plugin_required gates (previously entirely ungated) + allocation guards
- library: due_date NOT NULL default + student_id guard
- health_records / emergency / incidents / gamification / wellbeing:
  unvalidated-FK 500 guards (E17 pattern), enum guards, mood student resolution
- gamification leaderboard: student_name + rank for the web page
- student_app: /student/library|elibrary|wellbeing now plugin-gated
- rollback: failed multi-write paths leave no partial rows
"""
import uuid
from datetime import date, timedelta

import pytest

from app.extensions import db as _db
from app.models.academic import Class
from app.models.plugin import SchoolPlugin
from app.models.student import Student
from tests.conftest import get_auth_headers

CAMPUS_OPS = ["library_management", "elibrary", "hostel", "health_records",
              "emergency", "incidents", "gamification", "wellbeing"]

BOGUS = str(uuid.uuid4())


@pytest.fixture
def ops_school(db):
    """School with all campus-ops plugins installed."""
    from app.models.plugin import Plugin
    from app.models.school import School

    # the testing DB truncates `plugins` — seed the catalog rows first
    # (SchoolPlugin.plugin_slug has a FK to plugins.slug)
    names = {
        "library_management": "Library Management",
        "elibrary": "E-Library & Digital Content",
        "hostel": "Hostel Management",
        "health_records": "Student Health Records",
        "emergency": "Emergency Management",
        "incidents": "Incident Management",
        "gamification": "Student Gamification",
        "wellbeing": "Student Wellbeing",
    }
    for slug, name in names.items():
        if not Plugin.query.filter_by(slug=slug).first():
            db.session.add(Plugin(slug=slug, name=name, category="growth",
                                  price_monthly=199, price_yearly=1999,
                                  is_free=False, is_published=True, version="1.0.0"))
    db.session.commit()

    s = School(
        name=f"CampusOps Academy {uuid.uuid4().hex[:8]}",
        slug=f"campusops-{uuid.uuid4().hex[:8]}",
        plan="growth",
        status="active",
        is_active=True,
        phone="+9779800000042",
        province="Bagmati",
        district="Kathmandu",
    )
    db.session.add(s)
    db.session.flush()
    for slug in CAMPUS_OPS:
        db.session.add(SchoolPlugin(school_id=s.id, plugin_slug=slug, active=True, is_trial=False))
    db.session.commit()
    return s


@pytest.fixture
def ops_setup(db, ops_school):
    """Admin + class + two students for the ops school."""
    from app.models.user import User

    admin = User(
        school_id=ops_school.id, role="school_admin", full_name="Ops Admin",
        phone="+9779841000042", email=f"ops-{uuid.uuid4().hex[:6]}@test.edu.np",
        is_active=True,
    )
    admin.set_password("Test@1234")
    cls = Class(school_id=ops_school.id, name="Grade 10")
    db.session.add_all([admin, cls])
    db.session.flush()
    s1 = Student(school_id=ops_school.id, first_name="One", last_name="Student",
                 class_id=cls.id, admission_number="OPS-001", status="active")
    s2 = Student(school_id=ops_school.id, first_name="Two", last_name="Student",
                 class_id=cls.id, admission_number="OPS-002", status="active")
    db.session.add_all([s1, s2])
    db.session.commit()
    return {"school": ops_school, "admin": admin, "cls": cls, "s1": s1, "s2": s2}


@pytest.fixture
def ops_headers(client, ops_setup):
    return get_auth_headers(client, ops_setup["admin"].email, "Test@1234")


def test_library_issue_defaults_due_date_and_guards_bogus_student(client, ops_headers, ops_setup):
    r = client.post("/api/v1/library/books", headers=ops_headers,
                    json={"title": "Test Book", "total_copies": 1, "available_copies": 1})
    assert r.status_code == 201
    book_id = r.get_json()["data"]["id"]

    # due_date was NOT NULL — a missing due_date used to 500
    r = client.post("/api/v1/library/issues", headers=ops_headers,
                    json={"book_id": book_id, "student_id": str(ops_setup["s1"].id)})
    assert r.status_code == 201
    data = r.get_json()["data"]
    assert data["due_date"] == str(date.today() + timedelta(days=14))
    issue_id = data["id"]

    # bogus student id -> 400 (used to be FK IntegrityError -> 500)
    r = client.post("/api/v1/library/issues", headers=ops_headers,
                    json={"book_id": book_id, "student_id": BOGUS})
    assert r.status_code == 400

    # rollback: the failed issue left no partial rows and no phantom copy loss
    from app.models.library import Book, BookIssue
    book = _db.session.get(Book, book_id)
    assert book.available_copies == 0  # only the successful issue consumed a copy
    assert BookIssue.query.filter_by(school_id=ops_setup["school"].id).count() == 1

    # list_issues supports the book/student filters the web return flow uses
    r = client.get(f"/api/v1/library/issues?status=issued&book_id={book_id}",
                   headers=ops_headers)
    items = r.get_json()["data"]
    assert len(items) == 1 and items[0]["id"] == issue_id


def test_hostel_plugin_gate_and_allocation_guards(client, app, db, ops_setup):
    from app.models.hostel import HostelAllocation, HostelRoom
    from app.models.user import User

    # gate: another school WITHOUT the hostel plugin gets 403 (routes used to
    # be entirely ungated)
    from app.models.school import School
    other = School(name=f"NoHostel {uuid.uuid4().hex[:6]}", slug=f"nohostel-{uuid.uuid4().hex[:6]}",
                   plan="free", status="active", is_active=True)
    db.session.add(other)
    db.session.flush()
    outsider = User(school_id=other.id, role="school_admin", full_name="Out Sider",
                    email=f"out-{uuid.uuid4().hex[:6]}@test.edu.np",
                    phone=f"+977981{uuid.uuid4().int % 10**8:08d}", is_active=True)
    outsider.set_password("Test@1234")
    db.session.add(outsider)
    db.session.commit()
    out_headers = get_auth_headers(client, outsider.email, "Test@1234")
    assert client.get("/api/v1/hostel", headers=out_headers).status_code == 403
    assert client.post("/api/v1/hostel", headers=out_headers, json={"name": "X"}).status_code == 403

    headers = get_auth_headers(client, ops_setup["admin"].email, "Test@1234")
    r = client.post("/api/v1/hostel", headers=headers,
                    json={"name": "Boys Block", "type": "boys", "total_capacity": 5})
    assert r.status_code == 201
    hostel_id = r.get_json()["data"]["id"]
    r = client.post("/api/v1/hostel/rooms", headers=headers,
                    json={"hostel_id": hostel_id, "room_number": "101", "capacity": 1})
    room_id = r.get_json()["data"]["id"]

    s1, s2 = str(ops_setup["s1"].id), str(ops_setup["s2"].id)
    assert client.post("/api/v1/hostel/allocations", headers=headers,
                       json={"room_id": room_id, "student_id": s1,
                             "check_in_date": str(date.today())}).status_code == 201
    # room is full -> 422
    assert client.post("/api/v1/hostel/allocations", headers=headers,
                       json={"room_id": room_id, "student_id": s2,
                             "check_in_date": str(date.today())}).status_code == 422
    # bogus student -> 400, and no allocation row persisted (rollback)
    assert client.post("/api/v1/hostel/allocations", headers=headers,
                       json={"room_id": room_id, "student_id": BOGUS,
                             "check_in_date": str(date.today())}).status_code == 400
    assert HostelAllocation.query.filter_by(school_id=ops_setup["school"].id).count() == 1
    # malformed date -> 400 (a second room with a free bed so the room-full
    # 422 does not preempt the date validation)
    r = client.post("/api/v1/hostel/rooms", headers=headers,
                    json={"hostel_id": hostel_id, "room_number": "102", "capacity": 2})
    assert r.status_code == 201
    room2_id = r.get_json()["data"]["id"]
    assert client.post("/api/v1/hostel/allocations", headers=headers,
                       json={"room_id": room2_id, "student_id": s2,
                             "check_in_date": "not-a-date"}).status_code == 400
    # room occupancy derives from active allocations
    assert _db.session.get(HostelRoom, room_id).occupied_count == 1


def test_health_records_rejects_foreign_students(client, ops_headers):
    assert client.put(f"/api/v1/health-records/students/{BOGUS}", headers=ops_headers,
                      json={"blood_group": "O-"}).status_code == 404
    assert client.post("/api/v1/health-records/visits", headers=ops_headers,
                       json={"student_id": BOGUS, "reason": "x"}).status_code == 400
    assert client.post("/api/v1/health-records/immunizations", headers=ops_headers,
                       json={"student_id": BOGUS, "vaccine_name": "MMR"}).status_code == 400


def test_emergency_alert_validation_and_headcount_guard(client, ops_headers, ops_setup):
    from app.models.emergency import EmergencyAlert

    # alert_type/title required (nullable=False — used to 500 on missing keys)
    assert client.post("/api/v1/emergency/alerts", headers=ops_headers,
                       json={"title": "x"}).status_code == 400
    assert client.post("/api/v1/emergency/alerts", headers=ops_headers,
                       json={"alert_type": "alien_invasion", "title": "x"}).status_code == 400
    # valid alert
    r = client.post("/api/v1/emergency/alerts", headers=ops_headers,
                    json={"alert_type": "fire", "title": "Fire in lab"})
    assert r.status_code == 201
    alert_id = r.get_json()["data"]["id"]

    # headcount on a bogus alert id -> 404 (used to be FK IntegrityError 500)
    assert client.post(f"/api/v1/emergency/alerts/{BOGUS}/headcount", headers=ops_headers,
                       json={"total_expected": 1, "total_present": 1}).status_code == 404
    assert EmergencyAlert.query.filter_by(school_id=ops_setup["school"].id).count() == 1

    # resolve with an invalid status -> 400 (enum)
    assert client.post(f"/api/v1/emergency/alerts/{alert_id}/resolve", headers=ops_headers,
                       json={"status": "whenever"}).status_code == 400
    r = client.post(f"/api/v1/emergency/alerts/{alert_id}/resolve", headers=ops_headers, json={})
    assert r.status_code == 200 and r.get_json()["data"]["status"] == "resolved"


def test_incidents_validation_and_statement_guards(client, ops_headers, ops_setup):
    from app.models.incident import Incident, WitnessStatement

    assert client.post("/api/v1/incidents", headers=ops_headers,
                       json={"incident_type": "bullying"}).status_code == 400
    assert client.post("/api/v1/incidents", headers=ops_headers,
                       json={"title": "x", "incident_type": "alien"}).status_code == 400
    r = client.post("/api/v1/incidents", headers=ops_headers,
                    json={"title": "Fight", "incident_type": "fighting",
                          "involved_student_ids": [str(ops_setup["s1"].id)]})
    assert r.status_code == 201
    inc_id = r.get_json()["data"]["id"]

    # statements/actions on a bogus incident -> 404 (used to be FK 500)
    assert client.post(f"/api/v1/incidents/{BOGUS}/statements", headers=ops_headers,
                       json={"statement": "saw it"}).status_code == 404
    assert client.post(f"/api/v1/incidents/{BOGUS}/actions", headers=ops_headers,
                       json={"action_type": "counseling"}).status_code == 404
    # empty statement -> 400 (statement NOT NULL)
    assert client.post(f"/api/v1/incidents/{inc_id}/statements", headers=ops_headers,
                       json={"statement": "  "}).status_code == 400
    # action with bogus student -> 400
    assert client.post(f"/api/v1/incidents/{inc_id}/actions", headers=ops_headers,
                       json={"action_type": "counseling", "student_id": BOGUS}).status_code == 400
    assert WitnessStatement.query.filter_by(school_id=ops_setup["school"].id).count() == 0
    assert Incident.query.filter_by(school_id=ops_setup["school"].id).count() == 1

    # invalid status on PUT -> 400 (enum)
    assert client.put(f"/api/v1/incidents/{inc_id}", headers=ops_headers,
                      json={"status": "vibes"}).status_code == 400


def test_gamification_points_guards_and_leaderboard_math(client, ops_headers, ops_setup):
    from app.models.gamification import PointsLog, StudentBadge

    s1, s2 = str(ops_setup["s1"].id), str(ops_setup["s2"].id)
    # guards (all were 500s pre-fix)
    assert client.post("/api/v1/gamification/points", headers=ops_headers,
                       json={"student_id": BOGUS, "points": 5}).status_code == 400
    assert client.post("/api/v1/gamification/points", headers=ops_headers,
                       json={"student_id": s1, "points": "abc"}).status_code == 400
    assert client.post("/api/v1/gamification/points", headers=ops_headers,
                       json={"student_id": s1, "points": True}).status_code == 400
    assert client.post("/api/v1/gamification/award-badge", headers=ops_headers,
                       json={"student_id": s1, "badge_id": BOGUS}).status_code == 400
    # nothing persisted by the failed writes (rollback)
    assert PointsLog.query.filter_by(school_id=ops_setup["school"].id).count() == 0
    assert StudentBadge.query.filter_by(school_id=ops_setup["school"].id).count() == 0

    # hand-checked leaderboard math: S1=50+30=80, S2=100, S3 n/a
    for sid, pts in [(s1, 50), (s1, 30), (s2, 100)]:
        assert client.post("/api/v1/gamification/points", headers=ops_headers,
                           json={"student_id": sid, "points": pts, "reason": "test"}).status_code == 201

    r = client.get("/api/v1/gamification/leaderboard", headers=ops_headers)
    lb = r.get_json()["data"]
    assert [(e["student_id"], e["total_points"]) for e in lb] == [(s2, 100), (s1, 80)]
    assert lb[0]["rank"] == 1
    assert lb[0]["student_name"] == "Two Student" and lb[1]["student_name"] == "One Student"

    r = client.get(f"/api/v1/gamification/points/{s1}", headers=ops_headers)
    assert r.get_json()["data"]["total_points"] == 80

    # badge award works for a real badge
    r = client.post("/api/v1/gamification/badges", headers=ops_headers,
                    json={"name": "Perfect Week", "points_value": 50})
    assert r.status_code == 201
    badge_id = r.get_json()["data"]["id"]
    assert client.post("/api/v1/gamification/award-badge", headers=ops_headers,
                       json={"student_id": s1, "badge_id": badge_id}).status_code == 201


def test_wellbeing_mood_resolution_and_note_guards(client, app, db, ops_setup, client_headers=None):
    from app.models.user import User
    from app.models.wellbeing import CounselorNote, MoodEntry

    headers = get_auth_headers(client, ops_setup["admin"].email, "Test@1234")
    s1 = str(ops_setup["s1"].id)

    # mood without student_id: admin has no student profile -> 400 (was FK 500)
    assert client.post("/api/v1/wellbeing/mood", headers=headers,
                       json={"mood": "happy"}).status_code == 400
    # missing mood -> 400 (NOT NULL)
    assert client.post("/api/v1/wellbeing/mood", headers=headers,
                       json={"student_id": s1}).status_code == 400
    # explicit student log works; bogus student -> 400
    assert client.post("/api/v1/wellbeing/mood", headers=headers,
                       json={"student_id": s1, "mood": "happy", "energy_level": 4}).status_code == 201
    assert client.post("/api/v1/wellbeing/mood", headers=headers,
                       json={"student_id": BOGUS, "mood": "happy"}).status_code == 400

    # the student's OWN mood check-in resolves their student profile
    student_user = User(school_id=ops_setup["school"].id, role="student",
                        full_name="One Student", email=f"stu-{uuid.uuid4().hex[:6]}@test.edu.np",
                        phone=f"+977982{uuid.uuid4().int % 10**8:08d}", is_active=True)
    student_user.set_password("Test@1234")
    db.session.add(student_user)
    db.session.flush()  # id is a python-side default — only materialized on flush
    ops_setup["s1"].user_id = student_user.id
    db.session.commit()
    stu_headers = get_auth_headers(client, student_user.email, "Test@1234")
    r = client.post("/api/v1/wellbeing/mood", headers=stu_headers, json={"mood": "okay"})
    assert r.status_code == 201, r.get_json()
    entry = MoodEntry.query.order_by(MoodEntry.created_at.desc()).first()
    assert str(entry.student_id) == s1

    # counselor notes: missing student_id -> 400 (was KeyError 500); bogus -> 400
    assert client.post("/api/v1/wellbeing/counselor-notes", headers=headers,
                       json={"content": "x"}).status_code == 400
    assert client.post("/api/v1/wellbeing/counselor-notes", headers=headers,
                       json={"student_id": BOGUS, "content": "x"}).status_code == 400
    assert client.post("/api/v1/wellbeing/counselor-notes", headers=headers,
                       json={"student_id": s1, "content": "follow-up"}).status_code == 201
    assert CounselorNote.query.filter_by(school_id=ops_setup["school"].id).count() == 1

    # mood summary math: 2 entries -> {happy:1, okay:1}
    r = client.get("/api/v1/wellbeing/mood/summary?days=7", headers=headers)
    dist = r.get_json()["data"]["mood_distribution"]
    assert dist.get("happy") == 1 and dist.get("okay") == 1


def test_student_app_campus_ops_routes_are_plugin_gated(client, app, db, ops_setup):
    """/student/library|elibrary|wellbeing used to be fully ungated."""
    from app.models.user import User

    from extensions import cache

    student_user = User(school_id=ops_setup["school"].id, role="student",
                        full_name="Gated Student", email=f"gate-{uuid.uuid4().hex[:6]}@test.edu.np",
                        phone=f"+977983{uuid.uuid4().int % 10**8:08d}", is_active=True)
    student_user.set_password("Test@1234")
    db.session.add(student_user)
    db.session.flush()
    ops_setup["s1"].user_id = student_user.id
    db.session.commit()
    stu_headers = get_auth_headers(client, student_user.email, "Test@1234")

    # strip every campus-ops plugin -> all three feature areas must 403
    SchoolPlugin.query.filter(
        SchoolPlugin.school_id == ops_setup["school"].id,
        SchoolPlugin.plugin_slug.in_(CAMPUS_OPS),
    ).delete(synchronize_session=False)
    db.session.commit()
    # g.installed_plugins is cached under school:{id}:plugins (300 s) — a
    # direct DB flip must delete the same key the billing paths delete.
    cache.delete(f"school:{ops_setup['school'].id}:plugins")

    assert client.get("/api/v1/student/library", headers=stu_headers).status_code == 403
    assert client.get("/api/v1/student/elibrary", headers=stu_headers).status_code == 403
    assert client.get("/api/v1/student/wellbeing", headers=stu_headers).status_code == 403

    # restore wellbeing only -> wellbeing opens, library stays gated
    db.session.add(SchoolPlugin(school_id=ops_setup["school"].id, plugin_slug="wellbeing",
                                active=True, is_trial=False))
    db.session.commit()
    cache.delete(f"school:{ops_setup['school'].id}:plugins")
    assert client.get("/api/v1/student/wellbeing", headers=stu_headers).status_code == 200
    assert client.get("/api/v1/student/library", headers=stu_headers).status_code == 403
