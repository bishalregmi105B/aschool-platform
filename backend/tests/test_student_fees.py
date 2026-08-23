"""Tests for the student-facing fees endpoint (GET /api/v1/student/fees)."""
from app.models.fee import FeeCollection
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _make_student_user(db, school):
    u = User(
        school_id=school.id,
        role="student",
        full_name="Fees Test Student",
        email="fees.student@test.edu.np",
        phone="+9779841000031",
        is_active=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.flush()

    student = Student(
        school_id=school.id,
        user_id=u.id,
        first_name="Fees",
        last_name="Test",
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return u


def test_student_fees_overview_and_invoices(client, db, school):
    user = _make_student_user(db, school)
    headers = get_auth_headers(client, "fees.student@test.edu.np", "Test@1234")

    db.session.add_all(
        [
            FeeCollection(
                school_id=school.id,
                student_id=user_id_student(db, user),
                fee_item_name="Tuition",
                amount=5000,
                payment_status="paid",
            ),
            FeeCollection(
                school_id=school.id,
                student_id=user_id_student(db, user),
                fee_item_name="Transport",
                amount=2000,
                payment_status="partial",
                notes="[partial_paid:800]",
            ),
            FeeCollection(
                school_id=school.id,
                student_id=user_id_student(db, user),
                fee_item_name="Exam",
                amount=1000,
                payment_status="pending",
            ),
        ]
    )
    db.session.commit()

    resp = client.get("/api/v1/student/fees", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]

    overview = data["overview"]
    assert overview["total_fees"] == 8000.0
    assert overview["paid"] == 5800.0
    assert overview["due"] == 2200.0

    by_title = {i["title"]: i for i in data["invoices"]}
    assert by_title["Tuition"]["status"] == "paid"
    assert by_title["Transport"]["status"] == "partial"
    assert by_title["Transport"]["amount"] == 1200.0
    assert by_title["Exam"]["status"] == "pending"


def test_student_fees_requires_auth(client, db):
    resp = client.get("/api/v1/student/fees")
    assert resp.status_code == 401


def user_id_student(db, user):
    """Fetch the linked Student row id for a student-role user."""
    return (
        Student.query.filter_by(user_id=user.id, is_deleted=False).first().id
    )
