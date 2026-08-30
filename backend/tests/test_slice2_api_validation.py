"""Slice-2 deep-dive regression tests (E170-E179).

Pins the fixes verified against the live aschool-flask-1 container
(audits/FIX_STATUS_2026-08-28.md slice-2 backend rows E170-E179):
- E170 analytics fee aggregates count the PAYABLE amount (base + fine −
  discount), not the raw `amount` column;
- E171 /reports/dashboard monthly fee total is discount-aware;
- E172 /student/fees paid/due math is discount-aware;
- E173 /attendance/mark rejects unknown/foreign students, bogus classes and
  garbage dates with 400 (previously a cross-tenant write or a 500);
- E174 /attendance/leave-requests rejects foreign user_ids with 400;
- E175 POST /teacher/assignments validates class/subject/due_date (400, not
  FK-500) and requires the NOT NULL subject_id;
- E176 /student/assignments survives far-future due dates (ad_to_bs overflow)
  and /student/achievements returns real PointsLog/Badge data;
- E177 exams class_id params and online-exam student_id are validated (400);
- E178 assignment grading endpoints return 404 for garbage submission ids;
- E179 academics numeric_grade / initial_section_capacity must be integers.
"""
import uuid
from datetime import date, datetime, timedelta

import pytest

from app.api.v1.analytics import _overview_payload
from app.models.academic import Class, Section, Subject
from app.models.fee import FeeCollection
from app.models.gamification import PointsLog
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


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


def _install_plugin(db, school_id, slug):
    _seed_plugin(db, slug)
    row = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=slug
    ).first()
    if not row:
        row = SchoolPlugin(school_id=school_id, plugin_slug=slug, active=True)
        db.session.add(row)
        db.session.commit()
    return row


@pytest.fixture
def academy(db, school):
    """Class + section + subject + student for the main test school."""
    klass = Class(school_id=school.id, name="Class 10", numeric_grade=10)
    db.session.add(klass)
    db.session.flush()
    section = Section(school_id=school.id, class_id=klass.id, name="A")
    subject = Subject(school_id=school.id, name="Mathematics", class_ids=[klass.id])
    db.session.add_all([section, subject])
    db.session.flush()

    student_user = User(
        school_id=school.id,
        role="student",
        full_name="Fee Probe Kid",
        email="fee.kid@academy.test",
        phone="+9779841000099",
        is_active=True,
    )
    db.session.add(student_user)
    db.session.flush()
    student = Student(
        school_id=school.id,
        user_id=student_user.id,
        first_name="Fee",
        last_name="Kid",
        class_id=klass.id,
        section_id=section.id,
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return {"class": klass, "section": section, "subject": subject, "student": student}


def _foreign_student(db, school):
    """A student belonging to a DIFFERENT school (cross-tenant probe target)."""
    from app.models.school import School as SchoolModel

    other = SchoolModel(
        name="Other Academy",
        slug=f"other-academy-{uuid.uuid4().hex[:6]}",
        plan="growth",
        status="active",
        is_active=True,
    )
    db.session.add(other)
    db.session.flush()
    user = User(
        school_id=other.id,
        role="student",
        full_name="Foreign Kid",
        email=f"foreign.{uuid.uuid4().hex[:6]}@other.test",
        phone=f"+9779841{uuid.uuid4().int % 100000:05d}",
        is_active=True,
    )
    db.session.add(user)
    db.session.flush()
    student = Student(
        school_id=other.id,
        user_id=user.id,
        first_name="Foreign",
        last_name="Kid",
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return student


def _admin_headers(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.edu.np", "password": "Test@1234"},
    )
    assert resp.status_code == 200, f"admin login failed: {resp.status_code} {resp.get_json()}"
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _teacher_headers(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "teacher@academy.test", "password": "Teacher@123"},
    )
    assert resp.status_code == 200, f"teacher login failed: {resp.status_code} {resp.get_json()}"
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _student_headers(client, email="fee.kid@academy.test", password="Kid@1234"):
    resp = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200, f"student login failed: {resp.status_code} {resp.get_json()}"
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _teacher_with_email(db, school):
    if not teacher_user_exists(school.id):
        u = User(
            school_id=school.id,
            role="teacher",
            full_name="Test Teacher",
            email="teacher@academy.test",
            phone="+9779841000077",
            is_active=True,
        )
        u.set_password("Teacher@123")
        db.session.add(u)
        db.session.commit()
        return u
    return User.query.filter_by(email="teacher@academy.test").first()


def teacher_user_exists(school_id):
    return User.query.filter_by(email="teacher@academy.test", school_id=school_id).first() is not None


# ── E170: analytics payable-based fee math ──────────────────────────────────

def test_overview_fee_math_is_payable_based(db, school, academy):
    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=academy["student"].id,
            fee_item_name="Tuition",
            amount=1000,
            discount_amount=250,
            late_fine_amount=50,
            payment_status="paid",
        )
    )
    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=academy["student"].id,
            fee_item_name="Transport",
            amount=600,
            payment_status="pending",
        )
    )
    db.session.commit()

    payload = _overview_payload(school.id)
    # paid: payable = 1000 + 50 fine − 250 discount = 800 (raw amount said 1000)
    assert payload["fee_summary"]["total_collected"] == 800.0
    # pending: payable 600 (raw said 600 too, but with a fine/discount it must move)
    assert payload["fee_summary"]["total_pending"] == 600.0
    assert payload["collection_rate"] == round(800 / 1400 * 100, 1)


def test_overview_excludes_waived_and_counts_partial(db, school, academy):
    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=academy["student"].id,
            fee_item_name="Exam",
            amount=500,
            payment_status="waived",
        )
    )
    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=academy["student"].id,
            fee_item_name="Tuition",
            amount=400,
            payment_status="partial",
            notes="[partial_paid:150] monthly plan",
        )
    )
    db.session.commit()

    payload = _overview_payload(school.id)
    # waived excluded entirely; partial counts only the recorded 150 as paid
    assert payload["fee_summary"]["total_collected"] == 150.0
    assert payload["fee_summary"]["total_pending"] == 250.0


# ── E171: reports dashboard monthly fee ─────────────────────────────────────

def test_reports_dashboard_monthly_fee_is_payable(client, db, school, admin_user, academy):
    _install_plugin(db, school.id, "basic_reports")
    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=academy["student"].id,
            fee_item_name="Tuition",
            amount=1000,
            discount_amount=400,
            payment_status="paid",
            collected_at=datetime.utcnow(),
        )
    )
    db.session.commit()

    resp = client.get("/api/v1/reports/dashboard", headers=_admin_headers(client))
    assert resp.status_code == 200, resp.get_json()
    # 1000 − 400 discount = 600 actually collected, not the raw 1000
    assert resp.get_json()["data"]["monthly_fee_collected"] == 600.0


# ── E172: student fees math ────────────────────────────────────────────────

def test_student_fees_discount_aware(client, db, school, academy):
    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=academy["student"].id,
            fee_item_name="Tuition",
            amount=1000,
            discount_amount=250,
            payment_status="paid",
        )
    )
    db.session.commit()

    user = User.query.get(academy["student"].user_id)
    user.set_password("Kid@1234")
    db.session.commit()
    headers = get_auth_headers(client, "fee.kid@academy.test", "Kid@1234")

    resp = client.get("/api/v1/student/fees", headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    assert data["overview"]["paid"] == 750.0  # not the raw 1000
    assert data["overview"]["due"] == 0.0
    assert data["invoices"][0]["amount"] == 750.0


# ── E173: attendance mark validation ───────────────────────────────────────

def test_mark_attendance_rejects_foreign_and_bogus_students(client, db, school, admin_user, academy):
    _install_plugin(db, school.id, "attendance")
    foreign = _foreign_student(db, school)
    headers = _admin_headers(client)

    # foreign student (valid uuid, other school) — was a cross-tenant write
    resp = client.post(
        "/api/v1/attendance/mark",
        json={
            "class_id": str(academy["class"].id),
            "records": [{"student_id": str(foreign.id), "status": "present"}],
        },
        headers=headers,
    )
    assert resp.status_code == 400, resp.get_json()
    assert "does not match a student at this school" in resp.get_json()["error"]

    # bogus uuid — was an FK IntegrityError 500
    resp = client.post(
        "/api/v1/attendance/mark",
        json={
            "class_id": str(academy["class"].id),
            "records": [{"student_id": str(uuid.uuid4()), "status": "present"}],
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # garbage class_id — was a DataError 500
    resp = client.post(
        "/api/v1/attendance/mark",
        json={
            "records": [
                {"student_id": str(academy["student"].id), "status": "present", "class_id": "not-a-uuid"}
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # garbage date — silently became "today" before
    resp = client.post(
        "/api/v1/attendance/mark",
        json={
            "records": [{"student_id": str(academy["student"].id), "status": "present"}],
            "date": "someday",
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # zero partial writes across all the failures
    from app.models.attendance import Attendance

    assert (
        Attendance.query.filter_by(school_id=school.id).count() == 0
    )


def test_mark_attendance_positive_upsert(client, db, school, admin_user, academy):
    _install_plugin(db, school.id, "attendance")
    headers = _admin_headers(client)
    payload = {
        "class_id": str(academy["class"].id),
        "records": [{"student_id": str(academy["student"].id), "status": "late"}],
        "date": date.today().isoformat(),
    }
    resp = client.post("/api/v1/attendance/mark", json=payload, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    assert data["new_records"] == 1
    assert data["total_marked"] == 1

    # re-mark updates instead of duplicating
    resp = client.post("/api/v1/attendance/mark", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["data"]["updated_records"] == 1


# ── E174: leave requests ───────────────────────────────────────────────────

def test_leave_request_rejects_foreign_user(client, db, school, admin_user, academy):
    _install_plugin(db, school.id, "attendance")
    foreign_teacher = User(
        school_id=_foreign_student(db, school).school_id,
        role="teacher",
        full_name="Foreign Teacher",
        email=f"ft.{uuid.uuid4().hex[:6]}@other.test",
        phone=f"+9779842{uuid.uuid4().int % 100000:05d}",
        is_active=True,
    )
    db.session.add(foreign_teacher)
    db.session.commit()
    headers = _admin_headers(client)

    resp = client.post(
        "/api/v1/attendance/leave-requests",
        json={
            "start_date": "2026-09-01",
            "end_date": "2026-09-02",
            "user_id": str(foreign_teacher.id),
        },
        headers=headers,
    )
    assert resp.status_code == 400, resp.get_json()

    # self-serve default still works
    resp = client.post(
        "/api/v1/attendance/leave-requests",
        json={"start_date": "2026-09-01", "end_date": "2026-09-02", "reason": "family"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["data"]["status"] == "pending"


# ── E175: teacher assignment creation ──────────────────────────────────────

def test_teacher_assignment_validates_inputs(client, db, school, admin_user, academy):
    _install_plugin(db, school.id, "assignments")
    _teacher_with_email(db, school)
    headers = _teacher_headers(client)

    # bogus class → 400 (was FK IntegrityError 500)
    resp = client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "probe",
            "class_id": str(uuid.uuid4()),
            "subject_id": str(academy["subject"].id),
        },
        headers=headers,
    )
    assert resp.status_code == 400, resp.get_json()

    # foreign class → 400
    foreign_class = Class(
        school_id=_foreign_student(db, school).school_id, name="Other 5"
    )
    db.session.add(foreign_class)
    db.session.commit()
    resp = client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "probe",
            "class_id": str(foreign_class.id),
            "subject_id": str(academy["subject"].id),
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # missing subject_id (NOT NULL column) → 400, not IntegrityError 500
    resp = client.post(
        "/api/v1/teacher/assignments",
        json={"title": "probe", "class_id": str(academy["class"].id)},
        headers=headers,
    )
    assert resp.status_code == 400

    # garbage due_date → 400 (silently became "now" before)
    resp = client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "probe",
            "class_id": str(academy["class"].id),
            "subject_id": str(academy["subject"].id),
            "due_date": "tuesday",
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # valid creation works
    resp = client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "Homework 1",
            "class_id": str(academy["class"].id),
            "subject_id": str(academy["subject"].id),
            "due_date": (datetime.utcnow() + timedelta(days=2)).isoformat(),
            "total_marks": 10,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["data"]["title"] == "Homework 1"


# ── E176: student app data honesty ─────────────────────────────────────────

def test_student_assignments_survives_far_future_due_date(client, db, school, academy):
    from app.models.assignment import Assignment

    db.session.add(
        Assignment(
            school_id=school.id,
            title="Far future homework",
            class_id=academy["class"].id,
            subject_id=academy["subject"].id,
            teacher_id=academy["student"].user_id,
            due_date=datetime(2099, 12, 31),  # ad_to_bs overflows here
        )
    )
    db.session.commit()

    user = User.query.get(academy["student"].user_id)
    user.set_password("Kid@1234")
    db.session.commit()
    headers = get_auth_headers(client, "fee.kid@academy.test", "Kid@1234")

    resp = client.get("/api/v1/student/assignments", headers=headers)
    assert resp.status_code == 200, resp.get_json()  # was a 500 (OverflowError)
    pending = resp.get_json()["data"]["pending"]
    assert any(row["title"] == "Far future homework" for row in pending)
    # BS date degrades to None instead of crashing the response
    row = next(r for r in pending if r["title"] == "Far future homework")
    assert row["due_date_bs"] is None


def test_student_achievements_returns_real_points(client, db, school, academy):
    db.session.add(
        PointsLog(
            school_id=school.id,
            student_id=academy["student"].id,
            points=30,
            reason="math olympiad",
            category="academic",
            awarded_at=datetime(2026, 8, 29, 10, 0, 0),
        )
    )
    db.session.commit()

    user = User.query.get(academy["student"].user_id)
    user.set_password("Kid@1234")
    db.session.commit()
    headers = get_auth_headers(client, "fee.kid@academy.test", "Kid@1234")

    resp = client.get("/api/v1/student/achievements", headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    assert data["total_points"] == 30  # hardcoded zeros before E176
    assert data["history"][0]["reason"] == "math olympiad"
    assert any(entry["is_me"] for entry in data["leaderboard"])


# ── E177: exams param validation ───────────────────────────────────────────

def test_exam_grade_sheet_rejects_garbage_class(client, db, school, admin_user, academy):
    from app.models.exam import Exam

    _install_plugin(db, school.id, "exams")
    exam = Exam(school_id=school.id, name="Unit Test", exam_type="unit_test")
    db.session.add(exam)
    db.session.commit()
    headers = _admin_headers(client)

    resp = client.get(
        f"/api/v1/exams/{exam.id}/grade-sheet?class_id=garbage", headers=headers
    )
    assert resp.status_code == 400, resp.get_json()  # was ValueError → 500


def test_exam_subjects_rejects_garbage_class_when_no_subject_ids(client, db, school, admin_user, academy):
    from app.models.exam import Exam

    _install_plugin(db, school.id, "exams")
    exam = Exam(school_id=school.id, name="Unit Test 2", exam_type="unit_test")
    db.session.add(exam)
    db.session.commit()
    headers = _admin_headers(client)

    resp = client.get(
        f"/api/v1/exams/{exam.id}/subjects?class_id=garbage", headers=headers
    )
    assert resp.status_code == 400, resp.get_json()


def test_online_exam_submit_validates_student(client, db, school, admin_user, academy):
    from app.models.exam import OnlineExam

    _install_plugin(db, school.id, "exams")
    exam = OnlineExam(
        school_id=school.id,
        title="Open quiz",
        duration_minutes=30,
        questions=[],
        start_at=datetime.utcnow() - timedelta(hours=1),
        end_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.session.add(exam)
    db.session.commit()
    headers = _admin_headers(client)

    resp = client.post(
        f"/api/v1/exams/online/{exam.id}/submit",
        json={"student_id": str(uuid.uuid4()), "answers": {}},
        headers=headers,
    )
    assert resp.status_code == 400, resp.get_json()  # was FK IntegrityError 500

    foreign = _foreign_student(db, school)
    resp = client.post(
        f"/api/v1/exams/online/{exam.id}/submit",
        json={"student_id": str(foreign.id), "answers": {}},
        headers=headers,
    )
    assert resp.status_code == 400  # cross-tenant attempt blocked


# ── E178: assignment grading endpoints ─────────────────────────────────────

def test_grade_endpoints_return_404_for_garbage_ids(client, db, school, admin_user, academy):
    _install_plugin(db, school.id, "assignments")
    headers = _admin_headers(client)

    resp = client.post(
        "/api/v1/assignments/submissions/garbage/grade",
        json={"marks": 5},
        headers=headers,
    )
    assert resp.status_code == 404, resp.get_json()  # was DataError 500

    resp = client.post(
        f"/api/v1/assignments/{uuid.uuid4()}/ai-grade",
        json={"submission_id": "garbage"},
        headers=headers,
    )
    assert resp.status_code == 404, resp.get_json()


# ── E179: academics integer validation ─────────────────────────────────────

def test_class_integer_fields_reject_garbage(client, db, school, admin_user):
    headers = _admin_headers(client)

    resp = client.post(
        "/api/v1/academics/classes",
        json={"name": "Garbage Grade", "numeric_grade": "eight"},
        headers=headers,
    )
    assert resp.status_code == 400, resp.get_json()  # was DataError 500

    resp = client.post(
        "/api/v1/academics/classes",
        json={
            "name": "Bad Capacity",
            "numeric_grade": 11,
            "initial_section_name": "A",
            "initial_section_capacity": "garbage",
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # valid class still creates with an integer grade + initial section
    resp = client.post(
        "/api/v1/academics/classes",
        json={
            "name": "Good Class",
            "numeric_grade": "11",
            "initial_section_name": "A",
            "initial_section_capacity": "25",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()["data"]
    assert data["numeric_grade"] == 11
    assert data["sections"][0]["name"] == "A"
