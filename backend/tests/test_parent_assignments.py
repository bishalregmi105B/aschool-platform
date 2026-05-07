from datetime import datetime, timedelta, timezone

from app.models.academic import Class, Subject
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.student import Guardian, Student
from app.models.user import User
from tests.conftest import get_auth_headers


def test_parent_assignments_returns_child_scoped_pending_and_submitted(
    client,
    db,
    school,
    teacher_user,
):
    parent_user = User(
        school_id=school.id,
        role="parent",
        full_name="Parent Sharma",
        email="parent.assignments@test.edu.np",
        phone="+9779841000009",
        is_active=True,
        phone_verified=True,
    )
    parent_user.set_password("Test@1234")
    db.session.add(parent_user)

    klass = Class(school_id=school.id, name="Grade 7", sort_order=7)
    db.session.add(klass)
    db.session.flush()

    subject = Subject(
        school_id=school.id,
        name="Science",
        class_ids=[klass.id],
        teacher_ids=[teacher_user.id],
    )
    db.session.add(subject)
    db.session.flush()

    student = Student(
        school_id=school.id,
        first_name="Child",
        last_name="One",
        class_id=klass.id,
        status="active",
    )
    db.session.add(student)
    db.session.flush()

    db.session.add(
        Guardian(
            school_id=school.id,
            student_id=student.id,
            user_id=parent_user.id,
            full_name="Parent Sharma",
            relation="father",
            is_primary=True,
            phone=parent_user.phone,
            email=parent_user.email,
        )
    )

    pending_assignment = Assignment(
        school_id=school.id,
        title="Chapter 1 Homework",
        description="Complete the chapter review.",
        class_id=klass.id,
        subject_id=subject.id,
        teacher_id=teacher_user.id,
        due_date=datetime.now(timezone.utc) + timedelta(days=2),
        total_marks=20,
    )
    submitted_assignment = Assignment(
        school_id=school.id,
        title="Lab Report",
        description="Write the lab report.",
        class_id=klass.id,
        subject_id=subject.id,
        teacher_id=teacher_user.id,
        due_date=datetime.now(timezone.utc) + timedelta(days=4),
        total_marks=25,
    )
    db.session.add_all([pending_assignment, submitted_assignment])
    db.session.flush()

    db.session.add(
        AssignmentSubmission(
            school_id=school.id,
            assignment_id=submitted_assignment.id,
            student_id=student.id,
            content="Submitted from home",
            status="submitted",
            marks=18,
            feedback="Good work",
        )
    )
    db.session.commit()

    headers = get_auth_headers(client, parent_user.email, "Test@1234")
    response = client.get("/api/v1/parent/assignments", headers=headers)

    assert response.status_code == 200
    payload = response.get_json()["data"]

    assert {row["title"] for row in payload["pending"]} == {"Chapter 1 Homework"}
    assert {row["title"] for row in payload["submitted"]} == {"Lab Report"}
    assert payload["pending"][0]["student_name"] == "Child One"
    assert payload["pending"][0]["due_date_bs"]
    assert payload["submitted"][0]["marks"] == 18.0
    assert payload["submitted"][0]["feedback"] == "Good work"
    assert payload["submitted"][0]["due_date_bs"]