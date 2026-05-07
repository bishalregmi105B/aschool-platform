"""Regression tests for teacher-scoped list and search APIs."""

from app.models.academic import Class, Subject
from app.models.exam import Exam
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _create_teacher(db, school, phone, email, full_name):
    teacher = User(
        school_id=school.id,
        role="teacher",
        full_name=full_name,
        phone=phone,
        email=email,
        is_active=True,
        phone_verified=True,
    )
    teacher.set_password("Teach@1234")
    db.session.add(teacher)
    db.session.commit()
    return teacher


def _install_plugin_for_school(db, school, slug, name):
    plugin = Plugin.query.filter_by(slug=slug).first()
    if not plugin:
        plugin = Plugin(
            slug=slug,
            name=name,
            category="core",
            is_free=True,
            is_published=True,
            version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()

    school_plugin = SchoolPlugin.query.filter_by(
        school_id=school.id,
        plugin_slug=slug,
    ).first()
    if not school_plugin:
        school_plugin = SchoolPlugin(
            school_id=school.id,
            plugin_slug=slug,
            active=True,
            is_trial=False,
        )
        db.session.add(school_plugin)
    else:
        school_plugin.active = True

    db.session.commit()


def test_teacher_lists_are_scoped_to_assigned_classes_subjects_and_students(client, db, school):
    teacher = _create_teacher(
        db,
        school,
        phone="+9779841000101",
        email="teacher.scope@test.edu.np",
        full_name="Teacher Scope",
    )
    other_teacher = _create_teacher(
        db,
        school,
        phone="+9779841000102",
        email="teacher.other@test.edu.np",
        full_name="Teacher Other",
    )

    class_allowed = Class(school_id=school.id, name="Grade 8", sort_order=8)
    class_blocked = Class(school_id=school.id, name="Grade 9", sort_order=9)
    db.session.add_all([class_allowed, class_blocked])
    db.session.flush()

    subject_allowed = Subject(
        school_id=school.id,
        name="Mathematics",
        class_ids=[class_allowed.id],
        teacher_ids=[teacher.id],
    )
    subject_same_class_other_teacher = Subject(
        school_id=school.id,
        name="Science",
        class_ids=[class_allowed.id],
        teacher_ids=[other_teacher.id],
    )
    subject_blocked = Subject(
        school_id=school.id,
        name="History",
        class_ids=[class_blocked.id],
        teacher_ids=[other_teacher.id],
    )
    db.session.add_all(
        [subject_allowed, subject_same_class_other_teacher, subject_blocked]
    )

    student_allowed = Student(
        school_id=school.id,
        first_name="Allowed",
        last_name="Student",
        class_id=class_allowed.id,
        student_id="ALLOWED-1",
        status="active",
    )
    student_blocked = Student(
        school_id=school.id,
        first_name="Blocked",
        last_name="Student",
        class_id=class_blocked.id,
        student_id="BLOCKED-1",
        status="active",
    )
    db.session.add_all([student_allowed, student_blocked])
    db.session.commit()

    headers = get_auth_headers(client, teacher.email, "Teach@1234")

    classes_resp = client.get("/api/v1/academics/classes?per_page=200", headers=headers)
    assert classes_resp.status_code == 200
    classes_data = classes_resp.get_json()["data"]
    assert {row["id"] for row in classes_data} == {str(class_allowed.id)}

    subjects_resp = client.get("/api/v1/academics/subjects?per_page=200", headers=headers)
    assert subjects_resp.status_code == 200
    subjects_data = subjects_resp.get_json()["data"]
    assert {row["id"] for row in subjects_data} == {str(subject_allowed.id)}

    class_subjects_resp = client.get(
        f"/api/v1/academics/classes/{class_allowed.id}/subjects",
        headers=headers,
    )
    assert class_subjects_resp.status_code == 200
    class_subjects_data = class_subjects_resp.get_json()["data"]
    assert {row["id"] for row in class_subjects_data} == {str(subject_allowed.id)}

    blocked_class_subjects_resp = client.get(
        f"/api/v1/academics/classes/{class_blocked.id}/subjects",
        headers=headers,
    )
    assert blocked_class_subjects_resp.status_code == 200
    assert blocked_class_subjects_resp.get_json()["data"] == []

    students_resp = client.get("/api/v1/students?per_page=200", headers=headers)
    assert students_resp.status_code == 200
    students_data = students_resp.get_json()["data"]
    assert {row["id"] for row in students_data} == {str(student_allowed.id)}

    search_resp = client.get("/api/v1/search?q=Student&limit=25", headers=headers)
    assert search_resp.status_code == 200
    search_data = search_resp.get_json()["data"]
    student_hits = [row for row in search_data if row.get("type") == "student"]
    assert {row["id"] for row in student_hits} == {str(student_allowed.id)}


def test_teacher_exam_subjects_only_include_assigned_subjects(client, db, school):
    _install_plugin_for_school(db, school, slug="exams", name="Exams")

    teacher = _create_teacher(
        db,
        school,
        phone="+9779841000201",
        email="teacher.exams.scope@test.edu.np",
        full_name="Teacher Exams Scope",
    )
    other_teacher = _create_teacher(
        db,
        school,
        phone="+9779841000202",
        email="teacher.exams.other@test.edu.np",
        full_name="Teacher Exams Other",
    )

    class_allowed = Class(school_id=school.id, name="Grade 10", sort_order=10)
    class_blocked = Class(school_id=school.id, name="Grade 11", sort_order=11)
    db.session.add_all([class_allowed, class_blocked])
    db.session.flush()

    subject_allowed = Subject(
        school_id=school.id,
        name="Physics",
        class_ids=[class_allowed.id],
        teacher_ids=[teacher.id],
    )
    subject_other = Subject(
        school_id=school.id,
        name="Chemistry",
        class_ids=[class_allowed.id],
        teacher_ids=[other_teacher.id],
    )
    db.session.add_all([subject_allowed, subject_other])
    db.session.flush()

    exam = Exam(
        school_id=school.id,
        name="Terminal Exam",
        exam_type="terminal",
        class_id=class_allowed.id,
        subject_ids=[subject_allowed.id, subject_other.id],
        status="ongoing",
    )
    db.session.add(exam)
    db.session.commit()

    headers = get_auth_headers(client, teacher.email, "Teach@1234")

    subjects_resp = client.get(
        f"/api/v1/exams/{exam.id}/subjects?class_id={class_allowed.id}",
        headers=headers,
    )
    assert subjects_resp.status_code == 200
    subjects_data = subjects_resp.get_json()["data"]
    assert {row["id"] for row in subjects_data} == {str(subject_allowed.id)}

    blocked_resp = client.get(
        f"/api/v1/exams/{exam.id}/subjects?class_id={class_blocked.id}",
        headers=headers,
    )
    assert blocked_resp.status_code == 403
