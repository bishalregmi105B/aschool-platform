"""Regression tests for the Phase-2 Money & Operations validation fixes.

Pins the runtime-verified guards (audits/FIX_STATUS_2026-08-28.md E15-E17):
- dismissal verify-qr accepts the parent app's `aschool:pickup:<uid>:<sid>` QR
  string and records carry a student_name;
- visitor check-in requires a name and rejects unknown staff ids with 400;
- inventory asset audit rejects unknown assets with 404 and negative money
  values with 400;
- hr payroll create rejects user_ids outside the school with 400.
"""
import uuid as _uuid

import pytest

from app.models.dismissal import AuthorizedPickup
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _seed_plugin(db, slug):
    """Insert a minimal published Plugin row so SchoolPlugin's slug FK passes."""
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


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    for slug in (
        "dismissal",
        "visitor_management",
        "inventory",
        "hr_payroll",
    ):
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(
                school_id=school.id,
                plugin_slug=slug,
                active=True,
                is_trial=False,
            )
        )
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _make_student(db, school) -> Student:
    u = User(
        school_id=school.id,
        role="student",
        full_name="Pickup Test Kid",
        email="pickup.kid@test.edu.np",
        phone="+9779841000041",
        is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    student = Student(
        school_id=school.id,
        user_id=u.id,
        first_name="Pickup",
        last_name="Kid",
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return student


# ── Dismissal ────────────────────────────────────────────────────────────────

def test_verify_qr_accepts_parent_app_qr_string(client, db, school, admin_headers):
    student = _make_student(db, school)
    pickup = AuthorizedPickup(
        school_id=school.id,
        student_id=student.id,
        name="Mother of Kid",
        relation="mother",
        phone="+9779841000042",
        authorized_by_id=admin_user_id(db, school),
    )
    db.session.add(pickup)
    db.session.commit()

    qr = f"aschool:pickup:{admin_user_id(db, school)}:{student.id}"
    resp = client.post(
        "/api/v1/dismissal/verify-qr", json={"qr_code": qr}, headers=admin_headers
    )
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()["data"]
    assert data["qr_verified"] is True
    assert data["picked_up_by"] == "Mother of Kid"
    assert data["student_name"] == "Pickup Kid"


def test_verify_qr_rejects_malformed_and_unknown(client, db, school, admin_headers):
    student = _make_student(db, school)
    pickup = AuthorizedPickup(
        school_id=school.id,
        student_id=student.id,
        name="Mother of Kid",
        relation="mother",
        phone="+9779841000042",
    )
    db.session.add(pickup)
    db.session.commit()

    resp = client.post(
        "/api/v1/dismissal/verify-qr", json={"qr_code": "garbage"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/v1/dismissal/verify-qr",
        json={"qr_code": f"aschool:pickup:{_uuid.uuid4()}:{_uuid.uuid4()}"},
        headers=admin_headers,
    )
    assert resp.status_code == 403


# ── Visitor management ───────────────────────────────────────────────────────

def test_visitor_checkin_requires_name_and_known_staff(
    client, db, school, admin_user, admin_headers
):
    resp = client.post(
        "/api/v1/visitors/checkin", json={"purpose": "no name"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/v1/visitors/checkin",
        json={"name": "X", "visiting_staff_id": str(_uuid.uuid4())},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "visiting_staff_id" in resp.get_json()["error"]


def test_visitor_appointment_unknown_staff_400(
    client, db, school, admin_headers
):
    resp = client.post(
        "/api/v1/visitors/appointments",
        json={
            "visitor_name": "Sita",
            "staff_id": str(_uuid.uuid4()),
            "scheduled_at": "2082-04-12T10:00:00",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "staff_id" in resp.get_json()["error"]


# ── Inventory ────────────────────────────────────────────────────────────────

def test_inventory_audit_unknown_asset_404_and_negative_price_400(
    client, db, school, admin_headers
):
    resp = client.post(
        f"/api/v1/inventory/assets/{_uuid.uuid4()}/audit",
        json={"action": "assigned"},
        headers=admin_headers,
    )
    assert resp.status_code == 404

    resp = client.post(
        "/api/v1/inventory/assets",
        json={"name": "Neg", "purchase_price": -500},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "purchase_price" in resp.get_json()["error"]


# ── HR payroll ───────────────────────────────────────────────────────────────

def test_payroll_create_unknown_user_400(client, db, school, admin_headers):
    resp = client.post(
        "/api/v1/hr/payroll",
        json={
            "user_id": str(_uuid.uuid4()),
            "month": "2082-04",
            "basic_salary": 10000,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "user_id" in resp.get_json()["error"]


def admin_user_id(db, school):
    from app.models.user import User as _U

    u = _U.query.filter_by(school_id=school.id, role="school_admin").first()
    return str(u.id)
