"""B′ correctness-fix regression tests (2026-09-05, Roadmap v4 §2.5).

Pins the four fixes from R2/R3 verification:
- correct_answer leak: GET /exams/online/<id> no longer ships the answer key
  to student tokens (staff still get it);
- marks lock: POST /exams/<id>/marks returns 409 once the exam is
  result_published; POST /exams/<id>/marks/unlock (admin) re-opens entry;
- /attendance/me: the flutter_teacher route exists and returns only the
  caller's own TeacherAttendance rows;
- per-(class,subject) teachers: PUT/GET /academics/classes/<id>/subject-teachers
  write/read the D-06 ClassSubject + SectionSubjectTeacher junctions, first
  teacher = primary, replacing the school-global teacher_ids[0] guess.
"""
import uuid as _uuid
from datetime import date

import pytest

from app.models.academic import AcademicYear, Class, Section, Subject
from app.models.attendance import TeacherAttendance
from app.models.exam import Exam, Marks, OnlineExam
from app.models.money import ClassSubject, SectionSubjectTeacher
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
def fixes_setup(client, db, school, admin_user):
    for slug in ("attendance", "exams", "academics"):
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False)
        )
    db.session.commit()

    klass = Class(school_id=school.id, name="Six")
    db.session.add(klass)
    db.session.flush()
    sec_a = Section(school_id=school.id, class_id=klass.id, name="A")
    sec_b = Section(school_id=school.id, class_id=klass.id, name="B")
    db.session.add_all([sec_a, sec_b])
    db.session.flush()

    teacher1 = User(
        school_id=school.id, role="teacher", full_name="Rita Sharma",
        phone="+9779841000041", email="rita@test.edu.np", is_active=True,
    )
    teacher1.set_password("Test@1234")
    teacher2 = User(
        school_id=school.id, role="teacher", full_name="Hari Gurung",
        phone="+9779841000042", email="hari@test.edu.np", is_active=True,
    )
    teacher2.set_password("Test@1234")
    db.session.add_all([teacher1, teacher2])
    db.session.flush()

    subject = Subject(
        school_id=school.id, name="Science", code="SCI6",
        full_marks=100, pass_marks=32,
    )
    db.session.add(subject)
    db.session.flush()

    # A student with a login, wired to a Student row (portal-token pattern).
    student_user = User(
        school_id=school.id, role="student", full_name="Deepa Shrestha",
        phone="+9779841000043", email="deepa@test.edu.np", is_active=True,
    )
    student_user.set_password("Test@1234")
    db.session.add(student_user)
    db.session.flush()
    student = Student(
        school_id=school.id,
        user_id=student_user.id,
        first_name="Deepa",
        last_name="Shrestha",
        roll_number=1,
        class_id=klass.id,
        section_id=sec_a.id,
        status="active",
    )
    db.session.add(student)

    exam = Exam(
        school_id=school.id,
        name="Terminal One",
        exam_type="terminal",
        class_id=klass.id,
        status="scheduled",
    )
    db.session.add(exam)
    db.session.commit()

    return {
        "school": school,
        "admin": admin_user,
        "teacher1": teacher1,
        "teacher2": teacher2,
        "student_user": student_user,
        "klass": klass,
        "sec_a": sec_a,
        "sec_b": sec_b,
        "subject": subject,
        "student": student,
        "exam": exam,
        "admin_headers": get_auth_headers(client, "admin@test.edu.np", "Test@1234"),
        "teacher1_headers": get_auth_headers(client, "rita@test.edu.np", "Test@1234"),
        "student_headers": get_auth_headers(client, "deepa@test.edu.np", "Test@1234"),
    }


# ── 1. correct_answer leak ──────────────────────────────────────────────────

def test_online_exam_hides_correct_answer_from_students(client, db, fixes_setup):
    s = fixes_setup
    exam = OnlineExam(
        school_id=s["school"].id,
        title="Chapter quiz",
        class_id=s["klass"].id,
        status="upcoming",
        total_marks=2,
        total_questions=1,
        questions=[
            {
                "id": "q1",
                "text": "What is H2O?",
                "options": ["Water", "Salt"],
                "correct_answer": "Water",
                "marks": 2,
            }
        ],
    )
    db.session.add(exam)
    db.session.commit()

    # Staff keep the answer key (authoring/review).
    r = client.get(f"/api/v1/exams/online/{exam.id}", headers=s["admin_headers"])
    assert r.status_code == 200, r.get_json()
    questions = r.get_json()["data"]["questions"]
    assert questions[0]["correct_answer"] == "Water"

    # Student token must not see the key, but the question itself must render.
    r = client.get(f"/api/v1/exams/online/{exam.id}", headers=s["student_headers"])
    assert r.status_code == 200, r.get_json()
    student_questions = r.get_json()["data"]["questions"]
    assert len(student_questions) == 1
    assert student_questions[0]["text"] == "What is H2O?"
    assert "correct_answer" not in student_questions[0]


# ── 2. marks lock after publish ─────────────────────────────────────────────

def test_marks_locked_after_publish_and_admin_unlock(client, db, fixes_setup):
    s = fixes_setup
    exam = s["exam"]
    headers = s["admin_headers"]

    def _payload(marks):
        return {
            "marks": [
                {
                    "student_id": str(s["student"].id),
                    "subject_id": str(s["subject"].id),
                    "theory_marks": marks,
                }
            ]
        }

    # While unpublished, entry works.
    r = client.post(
        f"/api/v1/exams/{exam.id}/marks", json=_payload(55), headers=headers
    )
    assert r.status_code in (200, 201), r.get_json()

    exam.status = "result_published"
    db.session.commit()

    # Locked: 409, the row is NOT overwritten.
    r = client.post(
        f"/api/v1/exams/{exam.id}/marks", json=_payload(99), headers=headers
    )
    assert r.status_code == 409, r.get_json()
    row = Marks.query.filter_by(
        school_id=s["school"].id,
        exam_id=exam.id,
        student_id=s["student"].id,
        is_deleted=False,
    ).first()
    assert float(row.total_marks) == 55.0

    # Teachers can't unlock.
    r = client.post(
        f"/api/v1/exams/{exam.id}/marks/unlock", headers=s["teacher1_headers"]
    )
    assert r.status_code == 403, r.get_json()

    # Admin unlock returns the exam to `completed`; entry re-opens.
    r = client.post(f"/api/v1/exams/{exam.id}/marks/unlock", headers=headers)
    assert r.status_code == 200, r.get_json()
    assert exam.status == "completed"
    r = client.post(
        f"/api/v1/exams/{exam.id}/marks", json=_payload(60), headers=headers
    )
    assert r.status_code in (200, 201), r.get_json()


# ── 3. GET /attendance/me ───────────────────────────────────────────────────

def test_attendance_me_returns_caller_rows_only(client, db, fixes_setup):
    s = fixes_setup
    today = date.today()
    db.session.add_all(
        [
            TeacherAttendance(
                school_id=s["school"].id,
                user_id=s["teacher1"].id,
                date=today,
                status="present",
            ),
            TeacherAttendance(
                school_id=s["school"].id,
                user_id=s["teacher2"].id,
                date=today,
                status="absent",
            ),
        ]
    )
    db.session.commit()

    r = client.get("/api/v1/attendance/me", headers=s["teacher1_headers"])
    assert r.status_code == 200, r.get_json()
    rows = r.get_json()["data"]
    assert len(rows) == 1
    assert rows[0]["user_id"] == str(s["teacher1"].id)
    assert rows[0]["status"] == "present"


# ── 4. per-(class, subject) teachers ────────────────────────────────────────

def test_class_subject_teachers_roundtrip(client, db, fixes_setup):
    s = fixes_setup
    year = AcademicYear.query.filter_by(
        school_id=s["school"].id, is_current=True
    ).first()
    if year is None:
        year = AcademicYear(
            school_id=s["school"].id,
            name="2082",
            start_date_bs="2082-01-01",
            end_date_bs="2082-12-30",
            is_current=True,
        )
        db.session.add(year)
        db.session.commit()

    headers = s["admin_headers"]
    url = f"/api/v1/academics/classes/{s['klass'].id}/subject-teachers"

    # Assign two teachers; the first is primary.
    r = client.put(
        url,
        json={
            "subject_id": str(s["subject"].id),
            "teacher_ids": [str(s["teacher1"].id), str(s["teacher2"].id)],
            "academic_year_id": str(year.id),
        },
        headers=headers,
    )
    assert r.status_code == 200, r.get_json()
    body = r.get_json()["data"]
    assert body["primary_teacher_id"] == str(s["teacher1"].id)
    assert [t["teacher_id"] for t in body["teachers"]] == [
        str(s["teacher1"].id),
        str(s["teacher2"].id),
    ]

    # One row per section per teacher (the model's grain).
    assert (
        SectionSubjectTeacher.query.filter_by(
            school_id=s["school"].id, is_deleted=False
        ).count()
        == 4  # 2 sections × 2 teachers
    )

    # Re-assign to teacher2 only: teacher1's rows are tombstoned.
    r = client.put(
        url,
        json={
            "subject_id": str(s["subject"].id),
            "teacher_ids": [str(s["teacher2"].id)],
            "academic_year_id": str(year.id),
        },
        headers=headers,
    )
    assert r.status_code == 200, r.get_json()
    body = r.get_json()["data"]
    assert body["primary_teacher_id"] == str(s["teacher2"].id)
    active = SectionSubjectTeacher.query.filter_by(
        school_id=s["school"].id, is_deleted=False
    ).all()
    assert {str(row.teacher_id) for row in active} == {str(s["teacher2"].id)}

    # GET reflects the assignment.
    r = client.get(url, headers=headers)
    assert r.status_code == 200, r.get_json()
    match = [
        cs
        for cs in r.get_json()["data"]
        if cs["subject_id"] == str(s["subject"].id)
    ]
    assert match and match[0]["primary_teacher_id"] == str(s["teacher2"].id)

    # A teacher outside this school is rejected before any write.
    r = client.put(
        url,
        json={
            "subject_id": str(s["subject"].id),
            "teacher_ids": [str(_uuid.uuid4())],
        },
        headers=headers,
    )
    assert r.status_code == 400, r.get_json()
