"""Regression tests for fees summary aggregation."""

from app.models.academic import Class
from app.models.fee import FeeCollection
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from tests.conftest import get_auth_headers


def test_fees_summary_uses_partial_notes_and_active_student_count(
    client,
    db,
    school,
    admin_user,
):
    db.session.add(
        Plugin(
            slug="fees",
            name="Fees",
            category="core",
            is_free=True,
            is_published=True,
        )
    )
    db.session.add(
        SchoolPlugin(
            school_id=school.id,
            plugin_slug="fees",
            active=True,
        )
    )

    klass = Class(school_id=school.id, name="Class 10")
    db.session.add(klass)
    db.session.flush()

    student_paid = Student(
        school_id=school.id,
        first_name="Paid",
        last_name="Student",
        class_id=klass.id,
        status="active",
    )
    student_partial = Student(
        school_id=school.id,
        first_name="Partial",
        last_name="Student",
        class_id=klass.id,
        status="active",
    )
    db.session.add_all([student_paid, student_partial])
    db.session.flush()

    db.session.add_all(
        [
            FeeCollection(
                school_id=school.id,
                student_id=student_paid.id,
                amount=100,
                payment_status="paid",
            ),
            FeeCollection(
                school_id=school.id,
                student_id=student_partial.id,
                amount=200,
                payment_status="partial",
                notes="[partial_paid:80]",
            ),
            FeeCollection(
                school_id=school.id,
                student_id=student_partial.id,
                amount=50,
                payment_status="pending",
            ),
        ]
    )
    db.session.commit()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.get("/api/v1/fees/summary", headers=headers)

    assert resp.status_code == 200
    payload = resp.get_json()["data"]

    assert payload["total_expected"] == 350.0
    assert payload["total_collected"] == 180.0
    assert payload["total_outstanding"] == 170.0
    assert payload["student_count"] == 2
    assert payload["paid_count"] == 1
    assert payload["pending_count"] == 1
    assert payload["overdue_count"] == 1
