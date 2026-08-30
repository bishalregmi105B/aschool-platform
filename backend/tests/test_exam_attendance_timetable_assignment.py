"""Regression tests for the academics batch (E24 + timetable/assignments/attendance).

Pins the runtime-verified fixes (audits/FIX_STATUS_2026-08-28.md):
- E24-exams-class-id: marks entry without class_id persists the class resolved
  from the request default or the student's own class, so /results and
  /grade-sheet (which filter by class_id) can see the rows;
- timetable create_slot conflict detection: two sections with the same teacher
  at the same day+period (or overlapping time window) are rejected 409; a free
  slot is accepted; garbage body ids are 400, not DataError 500;
- assignments: class_id/subject_id NOT NULL guards (400 instead of
  IntegrityError 500), the model's is_late column is now computed on submit,
  bogus/garbage student_id is 400 with zero rows, and a forced mid-write
  commit failure leaves ZERO partial rows (rollback);
- exams marks: per-record validation fails the whole batch with 400 BEFORE any
  write; a mid-batch DB failure (numeric overflow) 500s with zero partial rows;
- attendance late rule: a late student DID attend — every rate endpoint counts
  present + late (student summary, class summary, reports); half_day never
  counts toward the rate.
"""
import uuid as _uuid
from datetime import date, timedelta

import pytest

from app.models.academic import Class, Section, Subject
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.attendance import Attendance
from app.models.exam import Exam, Marks
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from app.models.timetable import TimetableSlot
from extensions import db as _db
from tests.conftest import get_auth_headers

BOGUS = str(_uuid.uuid4())

PLUGIN_SLUGS = ("timetable", "assignments", "attendance", "exams", "basic_reports")


def _seed_plugin(db, slug):
    exists = Plugin.query.filter_by(slug=slug).first()
    if exists:
        return exists
    plugin = Plugin(
        slug=slug,
        name=slug.replace("_", " ").title(),
        category="starter",
        price_monthly=0,
        price_yearly=0,
        is_free=True,
        is_published=True,
    )
    db.session.add(plugin)
    db.session.commit()
    return plugin


@pytest.fixture
def acad_setup(client, db, school, admin_user):
    """Plugins installed + admin user + class/sections/subject/students."""
    admin = admin_user
    for slug in PLUGIN_SLUGS:
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False)
        )
    db.session.commit()

    klass = Class(school_id=school.id, name="Five")
    db.session.add(klass)
    db.session.flush()
    sec_a = Section(school_id=school.id, class_id=klass.id, name="A")
    sec_b = Section(school_id=school.id, class_id=klass.id, name="B")
    db.session.add_all([sec_a, sec_b])
    db.session.flush()

    teacher1 = User(
        school_id=school.id, role="teacher", full_name="Teacher One",
        phone="+9779841000031", email="teacher1@test.edu.np", is_active=True,
    )
    teacher2 = User(
        school_id=school.id, role="teacher", full_name="Teacher Two",
        phone="+9779841000032", email="teacher2@test.edu.np", is_active=True,
    )
    db.session.add_all([teacher1, teacher2])
    db.session.flush()
    subject = Subject(
        school_id=school.id, name="Mathematics", code="MTH5",
        full_marks=100, pass_marks=32,
    )
    db.session.add(subject)
    db.session.flush()

    students = []
    for i, (first, last) in enumerate([("Anish", "Karki"), ("Bina", "Rai"), ("Chandra", "Tamang")]):
        st = Student(
            school_id=school.id,
            first_name=first,
            last_name=last,
            roll_number=i + 1,
            class_id=klass.id,
            section_id=sec_a.id if i < 2 else sec_b.id,
            status="active",
        )
        db.session.add(st)
        students.append(st)
    db.session.commit()

    return {
        "admin": admin,
        "teacher1": teacher1,
        "teacher2": teacher2,
        "klass": klass,
        "sec_a": sec_a,
        "sec_b": sec_b,
        "subject": subject,
        "s1": students[0],
        "s2": students[1],
        "s3": students[2],
        "headers": get_auth_headers(client, "admin@test.edu.np", "Test@1234"),
    }


# ── Timetable ────────────────────────────────────────────────────────────────

def test_timetable_slot_conflict_detection(client, db, school, acad_setup):
    s = acad_setup
    payload = {
        "class_id": str(s["klass"].id),
        "section_id": str(s["sec_a"].id),
        "subject_id": str(s["subject"].id),
        "teacher_id": str(s["teacher1"].id),
        "day_of_week": "Monday",
        "period_number": 1,
        "start_time": "10:00",
        "end_time": "10:45",
    }

    # free slot -> accepted
    r = client.post("/api/v1/timetable/slots", json=payload, headers=s["headers"])
    assert r.status_code == 201, r.get_json()
    slot_id = r.get_json()["data"]["id"]

    # two sections, same teacher, same day+time -> 409 (hand-built conflict example)
    clash = dict(payload, section_id=str(s["sec_b"].id))
    r = client.post("/api/v1/timetable/slots", json=clash, headers=s["headers"])
    assert r.status_code == 409, r.get_json()
    assert "teacher" in r.get_json()["error"].lower()

    # same class/section, different teacher -> 409
    r = client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, teacher_id=str(s["teacher2"].id)),
        headers=s["headers"],
    )
    assert r.status_code == 409, r.get_json()
    assert "class/section" in r.get_json()["error"].lower()

    # bogus teacher/subject (valid UUID, no row) -> 400, not FK 500
    r = client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, teacher_id=BOGUS, day_of_week="Saturday"),
        headers=s["headers"],
    )
    assert r.status_code == 400
    r = client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, subject_id=BOGUS, day_of_week="Saturday"),
        headers=s["headers"],
    )
    assert r.status_code == 400

    # same teacher, other day -> free -> 201
    r = client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, day_of_week="Tuesday", section_id=str(s["sec_b"].id)),
        headers=s["headers"],
    )
    assert r.status_code == 201, r.get_json()
    other_day_id = r.get_json()["data"]["id"]

    # same teacher, overlapping time window on the booked day but a different
    # period number -> still 409 (the teacher is double-booked)
    r = client.post(
        "/api/v1/timetable/slots",
        json=dict(clash, period_number=99, start_time="10:30", end_time="11:15"),
        headers=s["headers"],
    )
    assert r.status_code == 409, r.get_json()

    # different teacher AND different section, overlapping window -> legit -> 201
    r = client.post(
        "/api/v1/timetable/slots",
        json=dict(
            clash,
            teacher_id=str(s["teacher2"].id),
            period_number=99,
            start_time="10:30",
            end_time="11:15",
        ),
        headers=s["headers"],
    )
    assert r.status_code == 201, r.get_json()
    legit_id = r.get_json()["data"]["id"]

    # bad inputs -> 400 (used to be silently accepted or a DataError 500)
    assert client.post(
        "/api/v1/timetable/slots", json={"day_of_week": "Monday", "period_number": 3},
        headers=s["headers"],
    ).status_code == 400
    assert client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, day_of_week="Monday", period_number=5, class_id="garbage"),
        headers=s["headers"],
    ).status_code == 400
    assert client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, day_of_week="Monday", period_number="five"),
        headers=s["headers"],
    ).status_code == 400
    assert client.post(
        "/api/v1/timetable/slots",
        json=dict(payload, day_of_week="Monday", period_number=6, start_time="nope"),
        headers=s["headers"],
    ).status_code == 400

    # garbage slot id on DELETE -> 404, not 500
    assert client.delete("/api/v1/timetable/slots/garbage", headers=s["headers"]).status_code == 404

    # cleanup of the extra slots
    client.delete(f"/api/v1/timetable/slots/{other_day_id}", headers=s["headers"])
    client.delete(f"/api/v1/timetable/slots/{legit_id}", headers=s["headers"])
    assert TimetableSlot.query.filter_by(school_id=school.id).count() == 1

    # GET filter returns serialized names
    r = client.get(
        f"/api/v1/timetable?class_id={s['klass'].id}", headers=s["headers"]
    )
    assert r.status_code == 200
    rows = r.get_json()["data"]
    assert len(rows) == 1
    assert rows[0]["class_name"] == "Five"
    assert rows[0]["subject_name"] == "Mathematics"


# ── Assignments ──────────────────────────────────────────────────────────────

def _assignment_payload(s, due_offset_days):
    from datetime import datetime, timedelta, timezone
    return {
        "title": "Algebra worksheet",
        "class_id": str(s["klass"].id),
        "section_id": str(s["sec_a"].id),
        "subject_id": str(s["subject"].id),
        "due_date": (datetime.now(timezone.utc) + timedelta(days=due_offset_days)).isoformat(),
        "total_marks": 10,
    }


def test_assignment_create_guards_and_submit_is_late(client, db, school, acad_setup):
    s = acad_setup
    h = s["headers"]

    # class_id/subject_id are NOT NULL on the model — 400, not IntegrityError 500
    assert client.post("/api/v1/assignments", json={"title": "No class"}, headers=h).status_code == 400
    # valid UUID but wrong table / other school -> 400
    r = client.post(
        "/api/v1/assignments",
        json={"title": "Bogus", "class_id": str(s["subject"].id), "subject_id": str(s["subject"].id)},
        headers=h,
    )
    assert r.status_code == 400
    # garbage ids -> 400, not DataError 500
    r = client.post(
        "/api/v1/assignments",
        json={"title": "Garbage", "class_id": "garbage", "subject_id": str(s["subject"].id)},
        headers=h,
    )
    assert r.status_code == 400

    # on-time assignment (due in 2 days)
    r = client.post("/api/v1/assignments", json=_assignment_payload(s, 2), headers=h)
    assert r.status_code == 201, r.get_json()
    active = r.get_json()["data"]
    assert active["status"] == "active"

    # past-due assignment
    r = client.post("/api/v1/assignments", json=_assignment_payload(s, -2), headers=h)
    assert r.status_code == 201
    assert r.get_json()["data"]["status"] == "past"
    past_due = r.get_json()["data"]

    # on-time submission -> is_late False (the model column was never set before)
    r = client.post(
        f"/api/v1/assignments/{active['id']}/submit",
        json={"student_id": str(s["s1"].id), "content": "my answers"},
        headers=h,
    )
    assert r.status_code == 201, r.get_json()
    assert r.get_json()["data"]["is_late"] is False

    # late submission (due date in the past) -> is_late True
    r = client.post(
        f"/api/v1/assignments/{past_due['id']}/submit",
        json={"student_id": str(s["s1"].id), "content": "sorry, late"},
        headers=h,
    )
    assert r.status_code == 201
    assert r.get_json()["data"]["is_late"] is True

    # teacher grading flow
    r = client.get(f"/api/v1/assignments/{active['id']}/submissions", headers=h)
    sub = r.get_json()["data"][0]
    r = client.post(
        f"/api/v1/assignments/{active['id']}/submissions/{sub['id']}/grade",
        json={"marks": 8.5, "feedback": "Good"},
        headers=h,
    )
    assert r.status_code == 200
    graded = r.get_json()["data"]
    assert graded["marks"] == 8.5 and graded["status"] == "graded"

    # submission count reflects the 1 graded submission
    r = client.get(f"/api/v1/assignments/{active['id']}", headers=h)
    assert r.get_json()["data"]["submitted_count"] == 1


def test_assignment_submit_rejects_bad_student_without_rows(client, db, school, acad_setup):
    s = acad_setup
    h = s["headers"]
    r = client.post("/api/v1/assignments", json=_assignment_payload(s, 2), headers=h)
    assignment_id = r.get_json()["data"]["id"]

    # bogus (valid-UUID foreign) student -> 400, zero rows (rollback)
    r = client.post(
        f"/api/v1/assignments/{assignment_id}/submit",
        json={"student_id": BOGUS, "content": "x"},
        headers=h,
    )
    assert r.status_code == 400, r.get_json()
    # garbage student_id -> 400 (was DataError 500)
    r = client.post(
        f"/api/v1/assignments/{assignment_id}/submit",
        json={"student_id": "not-a-uuid", "content": "x"},
        headers=h,
    )
    assert r.status_code == 400
    # unknown assignment -> 404
    r = client.post(
        f"/api/v1/assignments/{BOGUS}/submit",
        json={"student_id": str(s["s1"].id), "content": "x"},
        headers=h,
    )
    assert r.status_code == 404

    assert AssignmentSubmission.query.filter_by(school_id=school.id).count() == 0


def test_assignment_submit_rollback_on_commit_failure(
    client, db, school, app, acad_setup, monkeypatch
):
    s = acad_setup
    h = s["headers"]
    r = client.post("/api/v1/assignments", json=_assignment_payload(s, 2), headers=h)
    assignment_id = r.get_json()["data"]["id"]

    from extensions import db as ext_db
    old_propagate = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False

    def boom():
        raise RuntimeError("forced commit failure")

    monkeypatch.setattr(ext_db.session, "commit", boom)
    try:
        resp = client.post(
            f"/api/v1/assignments/{assignment_id}/submit",
            json={"student_id": str(s["s2"].id), "content": "should never persist"},
            headers=h,
        )
        assert resp.status_code == 500
    finally:
        monkeypatch.undo()
        app.config["PROPAGATE_EXCEPTIONS"] = old_propagate

    # The request ran inside the db fixture's app context, so teardown has not
    # removed the scoped session yet — drop it (close → rollback) exactly like
    # the real request teardown would, then verify ZERO partial rows persisted.
    ext_db.session.remove()
    assert (
        AssignmentSubmission.query.filter_by(school_id=school.id, student_id=s["s2"].id).count()
        == 0
    )
    # the earlier successful fixture rows are untouched (assignment intact)
    assert Assignment.query.filter_by(school_id=school.id).count() == 1


# ── Exams marks entry (E24-exams-class-id + rollback) ────────────────────────

def _create_exam(client, headers, s):
    r = client.post(
        "/api/v1/exams",
        json={
            "name": "Unit Test 1",
            "exam_type": "unit_test",
            "subject_ids": [str(s["subject"].id)],
            "total_marks": 100,
            "pass_marks": 32,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["id"]


def test_exam_marks_entry_resolves_class_from_student(client, db, school, acad_setup):
    """E24-exams-class-id: marks submitted without class_id persist the class
    resolved from the student, so /results (filtered by class_id) sees them."""
    s = acad_setup
    h = s["headers"]
    exam_id = _create_exam(client, h, s)

    r = client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={
            "marks": [
                {"student_id": str(s["s1"].id), "subject_id": str(s["subject"].id), "theory_marks": 78},
                {"student_id": str(s["s2"].id), "subject_id": str(s["subject"].id), "theory_marks": 45},
            ],
        },
        headers=h,
    )
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["data"]["new"] == 2

    rows = Marks.query.filter_by(school_id=school.id, exam_id=exam_id).all()
    assert len(rows) == 2
    assert all(str(m.class_id) == str(s["klass"].id) for m in rows), "class_id must be persisted"

    # results filtered by class now find the marks (this was the E24 bug)
    r = client.get(
        f"/api/v1/exams/{exam_id}/results?class_id={s['klass'].id}", headers=h
    )
    assert r.status_code == 200
    assert len(r.get_json()["data"]) == 2

    # resubmission upserts instead of duplicating
    r = client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={"marks": [{"student_id": str(s["s1"].id), "subject_id": str(s["subject"].id), "theory_marks": 88}]},
        headers=h,
    )
    assert r.status_code == 200
    assert r.get_json()["data"]["new"] == 0 and r.get_json()["data"]["updated"] == 1
    assert Marks.query.filter_by(school_id=school.id, exam_id=exam_id).count() == 2


def test_exam_marks_entry_guards_fail_batch_before_write(client, db, school, acad_setup):
    """A bad record fails the WHOLE batch with 400 before anything is written."""
    s = acad_setup
    h = s["headers"]
    exam_id = _create_exam(client, h, s)

    r = client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={
            "marks": [
                {"student_id": str(s["s3"].id), "subject_id": str(s["subject"].id), "theory_marks": 66},
                {"student_id": BOGUS, "subject_id": str(s["subject"].id), "theory_marks": 50},
            ],
        },
        headers=h,
    )
    assert r.status_code == 400, r.get_json()
    assert "student" in r.get_json()["error"]

    # garbage student id (was DataError 500)
    r = client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={"marks": [{"student_id": "garbage", "subject_id": str(s["subject"].id), "theory_marks": 50}]},
        headers=h,
    )
    assert r.status_code == 400

    # unknown subject / class (valid UUID, no row) -> 400
    r = client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={"marks": [{"student_id": str(s["s3"].id), "subject_id": BOGUS, "theory_marks": 50}]},
        headers=h,
    )
    assert r.status_code == 400
    r = client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={"marks": [{"student_id": str(s["s3"].id), "subject_id": str(s["subject"].id), "class_id": BOGUS, "theory_marks": 50}]},
        headers=h,
    )
    assert r.status_code == 400

    # ZERO rows persisted by any of the failed batches (rollback proven)
    assert Marks.query.filter_by(school_id=school.id, exam_id=exam_id).count() == 0


def test_exam_marks_entry_mid_batch_failure_leaves_no_partial_rows(
    client, db, school, app, acad_setup
):
    """Numeric(6,2) overflow on record 2 raises during the batch — the single
    commit means the whole batch rolls back: zero partial marks rows."""
    s = acad_setup
    h = s["headers"]
    exam_id = _create_exam(client, h, s)

    old_propagate = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False
    try:
        resp = client.post(
            f"/api/v1/exams/{exam_id}/marks",
            json={
                "marks": [
                    {"student_id": str(s["s3"].id), "subject_id": str(s["subject"].id), "theory_marks": 55},
                    {"student_id": str(s["s1"].id), "subject_id": str(s["subject"].id), "theory_marks": 100000},
                ],
            },
            headers=h,
        )
        assert resp.status_code == 500
    finally:
        app.config["PROPAGATE_EXCEPTIONS"] = old_propagate

    _db.session.rollback()
    assert Marks.query.filter_by(school_id=school.id, exam_id=exam_id).count() == 0


# ── Attendance late rule ─────────────────────────────────────────────────────

def test_attendance_late_counts_in_rates(client, db, school, acad_setup):
    """Uniform late rule: rates count present + late (late student attended);
    half_day never counts toward the rate."""
    s = acad_setup
    h = s["headers"]
    today = date.today()

    # s1: 3 present + 2 late + 1 absent + 1 half_day over the last 7 days
    plan = [
        ("present", today - timedelta(days=1)),
        ("late", today - timedelta(days=2)),
        ("present", today - timedelta(days=3)),
        ("late", today - timedelta(days=4)),
        ("present", today - timedelta(days=5)),
        ("absent", today - timedelta(days=6)),
        ("half_day", today - timedelta(days=7)),
    ]
    for status, d in plan:
        r = client.post(
            "/api/v1/attendance/mark",
            json={
                "records": [{"student_id": str(s["s1"].id), "status": status, "class_id": str(s["klass"].id)}],
                "date": d.isoformat(),
            },
            headers=h,
        )
        assert r.status_code == 200, r.get_json()

    # per-student summary: (3 + 2) / 7 = 71.4
    r = client.get(f"/api/v1/attendance/student/{s['s1'].id}/summary", headers=h)
    d = r.get_json()["data"]
    assert d["present_days"] == 3 and d["late_days"] == 2 and d["absent_days"] == 1
    assert d["half_day_days"] == 1
    assert d["percentage"] == 71.4

    # today: s2 late + s3 present -> class rate counts late: 2/3 = 66.7
    # (the old present-only rule reported 33.3)
    r = client.post(
        "/api/v1/attendance/mark",
        json={
            "records": [
                {"student_id": str(s["s2"].id), "status": "late", "class_id": str(s["klass"].id)},
                {"student_id": str(s["s3"].id), "status": "present", "class_id": str(s["klass"].id)},
            ],
            "date": today.isoformat(),
        },
        headers=h,
    )
    assert r.status_code == 200

    r = client.get(
        f"/api/v1/attendance/summary?class_id={s['klass'].id}&date={today.isoformat()}",
        headers=h,
    )
    d = r.get_json()["data"]
    assert d["present"] == 1 and d["late"] == 1
    assert d["attendance_rate"] == 66.7

    # reports attendance summary: school-wide rate counts late
    r = client.get(
        f"/api/v1/reports/attendance/summary?start_date={(today - timedelta(days=7)).isoformat()}&end_date={today.isoformat()}",
        headers=h,
    )
    assert r.status_code == 200
    d = r.get_json()["data"]
    # 9 rows total; present-or-late = 3 + 2 + 1 + 1 = 7 -> 77.8 (old: 4/9 = 44.4)
    assert d["attendance_rate"] == 77.8
    s1_row = next(x for x in d["students"] if str(x["student_id"]) == str(s["s1"].id))
    assert s1_row["percentage"] == 71.4

    # upsert semantics intact: re-marking the same date updates the row
    r = client.post(
        "/api/v1/attendance/mark",
        json={
            "records": [{"student_id": str(s["s1"].id), "status": "present", "class_id": str(s["klass"].id)}],
            "date": (today - timedelta(days=2)).isoformat(),
        },
        headers=h,
    )
    assert r.status_code == 200
    rows = Attendance.query.filter_by(school_id=school.id, student_id=s["s1"].id).all()
    assert len(rows) == 7
    assert all(not r.is_deleted for r in rows)
