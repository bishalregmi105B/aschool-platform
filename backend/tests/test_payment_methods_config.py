"""Tests for centralized fee payment method configuration."""

from app.models.fee import FeeCollection
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.student import Student
from tests.conftest import get_auth_headers


def _install_fees_plugin(db, school):
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
    db.session.commit()


def test_payment_methods_can_be_configured(client, db, school, admin_user):
    _install_fees_plugin(db, school)
    headers = get_auth_headers(client, admin_user.email, "Test@1234")

    get_resp = client.get("/api/v1/fees/payment-methods", headers=headers)
    assert get_resp.status_code == 200
    current = get_resp.get_json()["data"]["methods"]
    assert any(method["key"] == "cash" for method in current)

    update_resp = client.put(
        "/api/v1/fees/payment-methods",
        headers=headers,
        json={
            "methods": [
                {"key": "cash", "enabled": False},
                {
                    "key": "bank",
                    "enabled": True,
                    "qr_image_url": "https://files.example/bank-qr.png",
                    "instructions": "Scan bank QR and add bank reference",
                },
            ]
        },
    )
    assert update_resp.status_code == 200

    updated = update_resp.get_json()["data"]["methods"]
    cash = next(method for method in updated if method["key"] == "cash")
    bank = next(method for method in updated if method["key"] == "bank")

    assert cash["enabled"] is False
    assert bank["enabled"] is True
    assert bank["qr_image_url"] == "https://files.example/bank-qr.png"

    school_row = School.query.get(school.id)
    assert isinstance(school_row.fee_config.get("payment_methods"), list)


def test_record_payment_rejects_disabled_method(client, db, school, admin_user):
    _install_fees_plugin(db, school)

    student = Student(
        school_id=school.id,
        first_name="Config",
        last_name="Check",
        status="active",
    )
    db.session.add(student)
    db.session.flush()

    collection = FeeCollection(
        school_id=school.id,
        student_id=student.id,
        fee_item_name="Tuition Fee",
        amount=1200,
        payment_status="pending",
    )
    db.session.add(collection)
    db.session.commit()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    client.put(
        "/api/v1/fees/payment-methods",
        headers=headers,
        json={
            "methods": [
                {"key": "cash", "enabled": True},
                {"key": "bank", "enabled": False},
            ]
        },
    )

    pay_resp = client.post(
        f"/api/v1/fees/collections/{collection.id}/pay",
        headers=headers,
        json={"amount": 100, "payment_method": "bank"},
    )

    assert pay_resp.status_code == 400
    assert "disabled" in (pay_resp.get_json().get("error", "").lower())
