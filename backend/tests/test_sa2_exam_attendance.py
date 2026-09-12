"""S-A2 exam & attendance depth regression tests (A-05, A-32, A-33).

Covers: online-exam attempt lifecycle (start/take/autosave/submit-409/
resume), mark components (definition validation + component-scored marks),
grade scales (default override), tabulation + merit (NG rule + ranks),
subject attendance (mark/list/report), holiday register, 3-step import.
"""
from datetime import date

import pytest

from app.models.academic import Class, Section, Subject
from app.models.attendance import Attendance, SubjectAttendance
from app.models.exam import Exam, GradeScale, MarkComponent, Marks, OnlineExam, OnlineExamAttempt
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from tests.conftest import get_auth_headers


@pytest.fixture
def exam_env(client, db, school, admin_user, teacher_user):
    """exams + attendance plugins, one class/section/subject, one student."""
    for slug in ("exams", "attendance"):
        db.session.add(Plugin(slug=slug, name=slug.title(), category="core",
                              is_free=True, is_published=True))
        db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True))
    klass = Class(school_id=school.id, name="Class 10")
    db.session.add(klass)
    db.session.flush()
    section = Section(school_id=school.id, name="A", class_id=klass.id)
    subject = Subject(school_id=school.id, name="Science", code="SCI",
                      class_ids=[klass.id], full_marks=100)
    db.session.add_all([section, subject])
    db.session.flush()
    student = Student(school_id=school.id, first_name="Sita", last_name="Karki",
                      class_id=klass.id, section_id=section.id, status="active",
                      roll_number=1)
    db.session.add(student)
    exam = Exam(school_id=school.id, name="Terminal 2083", exam_type="terminal",
                class_id=klass.id, total_marks=100)
    db.session.add(exam)
    db.session.commit()
    return {
        "headers": get_auth_headers(client, "admin@test.edu.np", "Test@1234"),
        "school": school, "klass": klass, "section": section,
        "subject": subject, "student": student, "exam": exam,
    }


def _make_online_exam(db, env, questions=None):
    exam = OnlineExam(
        school_id=env["school"].id,
        title="Science Quiz",
        class_id=env["klass"].id,
        subject_id=env["subject"].id,
        duration_minutes=30,
        total_marks=2,
        total_questions=1,
        questions=questions or [
            {"id": "q1", "type": "mcq", "question": "2+2?",
             "options": [{"id": "a", "text": "3"}, {"id": "b", "text": "4"}],
             "correct_answer": "b", "marks": 2},
        ],
        status="published",
    )
    db.session.add(exam)
    db.session.commit()
    return exam


# ── A-05: online-exam attempt integrity ──────────────────────────────────

def _student_headers(client, db, school, student):
    from app.models.user import User

    user = User(school_id=school.id, role="student", full_name="Sita K",
                phone="+9779841000099", is_active=True)
    user.set_password("Test@1234")
    db.session.add(user)
    db.session.flush()
    student.user_id = user.id
    db.session.commit()
    return get_auth_headers(client, None, None, user) if False else None


def test_online_attempt_lifecycle_and_duplicate_submit(client, db, school, admin_user, exam_env):
    from app.models.user import User

    student = exam_env["student"]
    user = User(school_id=school.id, role="student", full_name="Sita K",
                phone="+9779841000099", email="sita@test.edu.np", is_active=True)
    user.set_password("Test@1234")
    db.session.add(user)
    db.session.flush()
    student.user_id = user.id
    db.session.commit()
    student_headers = get_auth_headers(client, "sita@test.edu.np", "Test@1234")
    student_headers = get_auth_headers(client, "sita@test.edu.np", "Test@1234")
    exam = _make_online_exam(db, exam_env)
    exam = _make_online_exam(db, exam_env)

    # take → auto-starts attempt, strips the answer key
    take = client.get(f"/api/v1/exams/online/{exam.id}/take", headers=student_headers)
    assert take.status_code == 200, take.get_json()
    body = take.get_json()["data"]
    assert body["attempt"]["status"] == "in_progress"
    assert body["attempt"]["remaining_seconds"] <= 30 * 60
    for q in body["questions"]:
        assert "correct_answer" not in q and "answer_key" not in q

    # autosave merges deltas
    autosave = client.patch(
        f"/api/v1/exams/online/{exam.id}/attempt",
        json={"answers": {"q1": "b"}},
        headers=student_headers,
    )
    assert autosave.status_code == 200, autosave.get_json()
    assert autosave.get_json()["data"]["saved_question_count"] == 1

    # submit scores and closes
    submit = client.post(
        f"/api/v1/exams/online/{exam.id}/submit",
        json={"answers": {"q1": "b"}},
        headers=student_headers,
    )
    assert submit.status_code == 201, submit.get_json()
    assert submit.get_json()["data"]["score"] == 2

    # duplicate submit → 409 with the existing attempt id
    dup = client.post(
        f"/api/v1/exams/online/{exam.id}/submit",
        json={"answers": {"q1": "a"}},
        headers=student_headers,
    )
    assert dup.status_code == 409, dup.get_json()
    assert dup.get_json()["error"]["attempt_id"] or dup.get_json()["data"]

    # exactly one attempt row (the unique index holds)
    rows = OnlineExamAttempt.query.filter_by(school_id=school.id).all()
    assert len(rows) == 1
    assert rows[0].status == "submitted"

    # take after submit → 409
    again = client.get(f"/api/v1/exams/online/{exam.id}/take", headers=student_headers)
    assert again.status_code == 409

    # autosave after submit → 409
    late = client.patch(
        f"/api/v1/exams/online/{exam.id}/attempt",
        json={"answers": {"q1": "a"}},
        headers=student_headers,
    )
    assert late.status_code == 409


def test_online_submit_without_start_creates_single_attempt(client, db, school, exam_env):
    """Legacy clients that never call /start still get single-attempt
    semantics: two consecutive submits → 201 then 409."""
    from app.models.user import User

    student = exam_env["student"]
    user = User(school_id=school.id, role="student", full_name="Sita K2",
                phone="+9779841000098", email="sita2@test.edu.np", is_active=True)
    user.set_password("Test@1234")
    db.session.add(user)
    db.session.flush()
    student.user_id = user.id
    db.session.commit()
    student_headers = get_auth_headers(client, "sita2@test.edu.np", "Test@1234")
    exam = _make_online_exam(db, exam_env)

    first = client.post(
        f"/api/v1/exams/online/{exam.id}/submit",
        json={"answers": {"q1": "b"}},
        headers=student_headers,
    )
    assert first.status_code == 201
    second = client.post(
        f"/api/v1/exams/online/{exam.id}/submit",
        json={"answers": {"q1": "b"}},
        headers=student_headers,
    )
    assert second.status_code == 409
    assert len(OnlineExamAttempt.query.filter_by(school_id=school.id).all()) == 1


# ── A-32: mark components ────────────────────────────────────────────────

def test_mark_components_validation_and_component_scored_marks(client, db, exam_env):
    headers = exam_env["headers"]
    exam, subject, student = exam_env["exam"], exam_env["subject"], exam_env["student"]

    # Σ max (150) exceeding subject/exam full marks (100) is rejected
    bad = client.put(
        f"/api/v1/exams/{exam.id}/components",
        json={"subject_id": str(subject.id), "components": [
            {"name": "CQ", "max_mark": 75},
            {"name": "MCQ", "max_mark": 75},
        ]},
        headers=headers,
    )
    assert bad.status_code == 400

    ok = client.put(
        f"/api/v1/exams/{exam.id}/components",
        json={"subject_id": str(subject.id), "components": [
            {"name": "CQ", "max_mark": 50, "pass_mark": 17.5, "seq": 1},
            {"name": "MCQ", "max_mark": 30, "seq": 2},
            {"name": "Practical", "max_mark": 20, "seq": 3},
        ]},
        headers=headers,
    )
    assert ok.status_code == 200, ok.get_json()
    comps = ok.get_json()["data"]  # saved count? uses success payload
    listing = client.get(f"/api/v1/exams/{exam.id}/components", headers=headers)
    defs = listing.get_json()["data"]["components"]
    assert len(defs) == 3
    comp_ids = {c["name"]: c["id"] for c in defs}

    marks_in = client.post(
        f"/api/v1/exams/{exam.id}/marks",
        json={"subject_id": str(subject.id), "marks": [
            {"student_id": str(student.id),
             "components": {comp_ids["CQ"]: 40, comp_ids["MCQ"]: 25,
                            comp_ids["Practical"]: 18}},
        ]},
        headers=headers,
    )
    assert marks_in.status_code == 200, marks_in.get_json()
    row = Marks.query.filter_by(school_id=exam_env["school"].id).first()
    assert float(row.total_marks) == 83
    assert row.components and len(row.components) == 3

    # per-component overscore rejected
    overscore = client.post(
        f"/api/v1/exams/{exam.id}/marks",
        json={"subject_id": str(subject.id), "marks": [
            {"student_id": str(student.id),
             "components": {comp_ids["CQ"]: 60}},
        ]},
        headers=headers,
    )
    assert overscore.status_code == 400


# ── A-32: grade scales ───────────────────────────────────────────────────

def test_grade_scale_default_overrides_neb(client, db, exam_env):
    headers = exam_env["headers"]
    school = exam_env["school"]
    created = client.post(
        "/api/v1/exams/grade-scales",
        json={"name": "SEE 2080", "board": "see", "is_default": True,
              "rows": [
                  {"grade_name": "A", "gpa": 4.0, "percent_from": 80},
                  {"grade_name": "B", "gpa": 3.0, "percent_from": 60},
                  {"grade_name": "C", "gpa": 2.0, "percent_from": 40},
                  {"grade_name": "NG", "gpa": 0.0, "percent_from": 0},
              ]},
        headers=headers,
    )
    assert created.status_code == 201, created.get_json()

    # 65% would be B+ under NEB (3.2); under this school's scale it's B (3.0).
    exam, subject, student = exam_env["exam"], exam_env["subject"], exam_env["student"]
    marks_in = client.post(
        f"/api/v1/exams/{exam.id}/marks",
        json={"subject_id": str(subject.id), "marks": [
            {"student_id": str(student.id), "theory_marks": 65, "full_marks": 100},
        ]},
        headers=headers,
    )
    assert marks_in.status_code == 200, marks_in.get_json()
    row = Marks.query.filter_by(school_id=school.id).first()
    assert row.grade == "B"
    assert float(row.gpa) == 3.0

    listing = client.get("/api/v1/exams/grade-scales", headers=headers)
    scales = listing.get_json()["data"]["scales"]
    assert any(s["is_default"] and s["name"] == "SEE 2080" for s in scales)


# ── A-32: tabulation + merit ─────────────────────────────────────────────

def test_tabulation_and_merit_with_ng_rule(client, db, exam_env):
    headers = exam_env["headers"]
    exam, subject = exam_env["exam"], exam_env["subject"]
    student = exam_env["student"]
    student2 = Student(school_id=exam_env["school"].id, first_name="Hari",
                       last_name="Thapa", class_id=exam_env["klass"].id,
                       section_id=exam_env["section"].id, status="active",
                       roll_number=2)
    db.session.add(student2)
    db.session.commit()

    db.session.add_all([
        Marks(school_id=exam_env["school"].id, exam_id=exam.id, student_id=student.id,
              subject_id=subject.id, class_id=exam_env["klass"].id,
              theory_marks=80, total_marks=80, full_marks=100, grade="A", gpa=3.6),
        # student2 absent → NG result in tabulation/merit (InfixEdu rule)
        Marks(school_id=exam_env["school"].id, exam_id=exam.id, student_id=student2.id,
              subject_id=subject.id, class_id=exam_env["klass"].id,
              theory_marks=90, total_marks=90, full_marks=100, grade="A+", gpa=4.0,
              is_absent=True),
    ])
    db.session.commit()

    tab = client.get(
        f"/api/v1/exams/{exam.id}/tabulation?class_id={exam_env['klass'].id}",
        headers=headers,
    ).get_json()["data"]
    assert len(tab["rows"]) == 2
    assert len(tab["grade_chart"]) >= 8
    by_name = {r["student_name"]: r for r in tab["rows"]}
    assert by_name["Hari Thapa"]["result"] == "NG"

    merit = client.get(
        f"/api/v1/exams/{exam.id}/merit-list?class_id={exam_env['klass'].id}",
        headers=headers,
    ).get_json()["data"]["rows"]
    assert merit[0]["student_name"] == "Sita Karki"  # NG pushed to the bottom
    assert merit[0]["merit_order"] == 1

    # print twins render HTML
    html = client.get(
        f"/api/v1/exams/{exam.id}/tabulation?class_id={exam_env['klass'].id}&format=print",
        headers=headers,
    )
    assert html.status_code == 200 and b"Tabulation" in html.data
    merit_html = client.get(
        f"/api/v1/exams/{exam.id}/merit-list?class_id={exam_env['klass'].id}&format=print",
        headers=headers,
    )
    assert merit_html.status_code == 200 and b"Merit List" in merit_html.data


# ── A-33: subject attendance + holiday ───────────────────────────────────

def test_subject_attendance_mark_list_report(client, db, exam_env):
    headers = exam_env["headers"]
    student = exam_env["student"]

    marked = client.post(
        "/api/v1/attendance/subject/mark",
        json={"class_id": str(exam_env["klass"].id),
              "subject_id": str(exam_env["subject"].id),
              "date_bs": "2083-04-15",
              "entries": [{"student_id": str(student.id), "status": "absent"}]},
        headers=headers,
    )
    assert marked.status_code == 200, marked.get_json()
    assert marked.get_json()["data"]["marked"] == 1

    # upsert: same student+subject+date flips the row
    flipped = client.post(
        "/api/v1/attendance/subject/mark",
        json={"class_id": str(exam_env["klass"].id),
              "subject_id": str(exam_env["subject"].id),
              "date_bs": "2083-04-15",
              "entries": [{"student_id": str(student.id), "status": "present"}]},
        headers=headers,
    )
    assert flipped.status_code == 200
    assert SubjectAttendance.query.filter_by(school_id=exam_env["school"].id).count() == 1
    assert SubjectAttendance.query.first().status == "present"

    listing = client.get(
        f"/api/v1/attendance/subject/list?class_id={exam_env['klass'].id}"
        f"&subject_id={exam_env['subject'].id}&date_bs=2083-04-15",
        headers=headers,
    ).get_json()["data"]
    assert len(listing["records"]) == 1

    # an absent day for the report math
    row = SubjectAttendance.query.first()
    row.status = "absent"
    db.session.commit()
    report = client.get(
        f"/api/v1/attendance/subject/report?class_id={exam_env['klass'].id}",
        headers=headers,
    ).get_json()["data"]["report"]
    assert report[0]["percentage"] == 0.0
    assert report[0]["total"] == 1

    # invalid status rejected
    bad = client.post(
        "/api/v1/attendance/subject/mark",
        json={"class_id": str(exam_env["klass"].id),
              "subject_id": str(exam_env["subject"].id),
              "date_bs": "2083-04-16",
              "entries": [{"student_id": str(student.id), "status": "nope"}]},
        headers=headers,
    )
    assert bad.status_code == 400


def test_holiday_marking_idempotent(client, db, exam_env):
    headers = exam_env["headers"]
    first = client.post(
        "/api/v1/attendance/holiday",
        json={"date_bs": "2083-04-16", "note": "Dashain"},
        headers=headers,
    )
    assert first.status_code == 200, first.get_json()
    marked = first.get_json()["data"]["marked"]
    assert marked >= 1
    again = client.post(
        "/api/v1/attendance/holiday",
        json={"date_bs": "2083-04-16", "note": "Dashain"},
        headers=headers,
    )
    assert again.get_json()["data"]["marked"] == marked  # upserted, not duplicated
    rows = Attendance.query.filter_by(school_id=exam_env["school"].id).all()
    assert all(r.status == "holiday" for r in rows)
    assert len(rows) == marked


# ── A-28: 3-step import ──────────────────────────────────────────────────

def test_attendance_import_preview_then_commit(client, db, exam_env):
    headers = exam_env["headers"]
    student = exam_env["student"]
    payload = {"entries": [
        {"student_id": str(student.id), "date_bs": "2083-04-17", "status": "late"},
        {"student_id": str(student.id), "date_bs": "2083-04-18", "status": "present"},
        {"student_id": str(student.id), "date_bs": "2083-04-19", "status": "bogus"},
    ]}

    preview = client.post("/api/v1/attendance/import/preview", json=payload, headers=headers)
    assert preview.status_code == 200, preview.get_json()
    data = preview.get_json()["data"]
    assert data["valid_count"] == 2
    assert data["error_count"] == 1
    assert Attendance.query.filter_by(school_id=exam_env["school"].id).count() == 0

    commit = client.post("/api/v1/attendance/import/commit", json=payload, headers=headers)
    assert commit.status_code == 200
    assert commit.get_json()["data"]["applied"] == 2
    rows = Attendance.query.filter_by(school_id=exam_env["school"].id).all()
    assert {r.status for r in rows} == {"late", "present"}
    assert all(r.date_bs == "2083-04-17" or r.date_bs == "2083-04-18" for r in rows)
