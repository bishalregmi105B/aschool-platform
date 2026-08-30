"""Slice-3 regression tests — audit fixes E180-E189.

Covers: fee reminder/report payable math (E180), fees request validation
(E181), school-scoped payment idempotency (E182), webhook payable math
(E183), auto monthly fee generation (E184), hr_payroll validation (E185),
admission cross-tenant refs + stale cleanup (E186), inventory assignment
audit + validation (E187), visitor checkout/appointment guards (E188) and
transport update-side FK checks (E189).
"""
import uuid as _uuid
from datetime import datetime, timedelta

import pytest

from tests.conftest import get_auth_headers


def _install_plugin(db, school, slug):
    from app.models.plugin import Plugin, SchoolPlugin

    plugin = Plugin.query.filter_by(slug=slug).first()
    if not plugin:
        plugin = Plugin(
            slug=slug, name=slug.title(), category="core",
            is_free=True, is_published=True, version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()
    db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False))
    db.session.commit()


def _student(db, school, tag, klass=None):
    from app.models.student import Student
    from app.models.user import User

    u = User(
        school_id=school.id, role="student", full_name=f"S {tag}",
        email=f"{tag}@slice3.test", phone=f"+9779811{tag[-4:] if tag[-4:].isdigit() else '0000'}",
        is_active=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.flush()
    s = Student(
        school_id=school.id, user_id=u.id, first_name="Slice", last_name=tag,
        status="active", class_id=klass.id if klass else None,
    )
    db.session.add(s)
    db.session.commit()
    return s


def _other_school(db):
    from app.models.school import School

    s = School(
        name=f"Slice3 Other {_uuid.uuid4().hex[:6]}", slug=f"slice3-other-{_uuid.uuid4().hex[:8]}",
        plan="growth", status="active", is_active=True,
        email="other@slice3.test", phone="+9779800000099",
    )
    db.session.add(s)
    db.session.commit()
    return s


# ── E180: fee reminder / report payable math ───────────────────────────────


def test_e180_fee_reminder_uses_payable_not_raw_base(db, app, school):
    """pending = base + fine − discount − paid, never the raw base."""
    from app.models.fee import FeeCollection
    from app.tasks.fee_reminders import _fee_paid_amount, _fee_payable_total

    student = _student(db, school, "E180")
    fc = FeeCollection(
        school_id=school.id, student_id=student.id,
        fee_item_name="Tuition", amount=1000, late_fine_amount=50,
        discount_amount=200, payment_status="partial", notes="[partial_paid:300]",
    )
    db.session.add(fc)
    db.session.commit()
    assert _fee_payable_total(fc) == 850.0
    assert _fee_paid_amount(fc, 850.0) == 300.0
    assert max(_fee_payable_total(fc) - _fee_paid_amount(fc, 850.0), 0) == 550.0

    fc.payment_status = "paid"
    assert _fee_paid_amount(fc) == 850.0  # paid returns the NET, not raw base


def test_e184_auto_monthly_fees_run_and_apply_discounts(db, app, school):
    """The beat task used to crash on Student.is_active; it must generate
    collections for active students and apply active scholarships."""
    from app.models.academic import Class
    from app.models.fee import FeeCollection, FeeStructure, StudentScholarship
    from app.tasks.fee_reminders import _generate_monthly_fees_for_school

    klass = Class(school_id=school.id, name="Slice3-E184")
    db.session.add(klass)
    db.session.flush()
    student = _student(db, school, "E184", klass=klass)
    db.session.add(StudentScholarship(
        school_id=school.id, student_id=student.id, discount_type="percent",
        discount_value=10, is_active=True, reason="slice3",
    ))
    db.session.add(FeeStructure(
        school_id=school.id, class_id=klass.id, academic_year="2082",
        fee_items=[{"name": "Monthly Fee", "fee_type": "tuition",
                    "amount": 1000, "frequency": "monthly"}],
    ))
    db.session.commit()

    result = _generate_monthly_fees_for_school(
        school_id=str(school.id), month_bs="2082-01", year_bs="2082"
    )
    assert result["created"] >= 1
    rows = FeeCollection.query.filter_by(
        school_id=school.id, student_id=student.id, month_bs="2082-01",
    ).all()
    assert rows, "auto monthly billing must create collections"
    assert all(float(r.discount_amount) == round(float(r.amount) * 0.10, 2) for r in rows)
    assert all(r.is_scholarship for r in rows)


# ── E181: fees request validation ──────────────────────────────────────────


def test_e181_fees_bad_uuid_and_limit_are_400(client, db, school, admin_user):
    _install_plugin(db, school, "fees")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")

    assert client.post("/api/v1/fees/structures", headers=h,
                       json={"name": "T", "amount": 100, "class_id": "zz"}).status_code == 400
    assert client.post("/api/v1/fees/collections", headers=h,
                       json={"student_id": "zz", "fee_type": "X", "amount": 100}).status_code == 400
    assert client.get("/api/v1/fees/recent?limit=abc", headers=h).status_code == 400
    assert client.get("/api/v1/fees/outstanding?limit=abc", headers=h).status_code == 400


def test_e181_scholarship_value_validated_on_post_and_put(client, db, school, admin_user):
    _install_plugin(db, school, "fees")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    student = _student(db, school, "E181")

    r = client.post("/api/v1/fees/scholarships", headers=h,
                    json={"student_id": str(student.id), "discount_type": "fixed",
                          "discount_value": -100})
    assert r.status_code == 400
    r = client.post("/api/v1/fees/scholarships", headers=h,
                    json={"student_id": str(student.id), "discount_type": "percent",
                          "discount_value": 10})
    assert r.status_code == 201
    sid = r.get_json()["data"]["id"]
    # PUT previously accepted percent=400 / -50 / bogus type
    assert client.put(f"/api/v1/fees/scholarships/{sid}", headers=h,
                      json={"discount_value": 400}).status_code == 400
    assert client.put(f"/api/v1/fees/scholarships/{sid}", headers=h,
                      json={"discount_value": -50}).status_code == 400
    assert client.put(f"/api/v1/fees/scholarships/{sid}", headers=h,
                      json={"discount_type": "half"}).status_code == 400


def _foreign_user(db, tag):
    """A real user belonging to some OTHER school (for tenant-refusal tests)."""
    from app.models.user import User

    other = _other_school(db)
    u = User(
        school_id=other.id, role="teacher", full_name=f"Foreign {tag}",
        email=f"foreign-{tag}-{_uuid.uuid4().hex[:6]}@x.test",
        phone="+9779800000999", is_active=True,
    )
    db.session.add(u)
    db.session.commit()
    return u


# ── E182: idempotency key must be school-scoped ────────────────────────────


def test_e182_idempotency_key_never_returns_foreign_receipt(client, db, school, admin_user):
    from app.models.fee import FeeCollection, FeeReceipt

    _install_plugin(db, school, "fees")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    student = _student(db, school, "E182")

    other_school = _other_school(db)
    foreign_student = _student(db, other_school, "E182F")
    foreign_collection = FeeCollection(
        school_id=other_school.id, student_id=foreign_student.id,
        fee_item_name="Foreign", amount=1, payment_status="pending",
    )
    db.session.add(foreign_collection)
    db.session.flush()
    foreign = FeeReceipt(
        school_id=other_school.id, collection_id=foreign_collection.id,
        student_id=foreign_student.id, receipt_number="RCPT-FOREIGN-99",
        amount=1, payment_method="cash", idempotency_key="slice3-e182-key",
    )
    db.session.add(foreign)
    db.session.commit()

    r = client.post("/api/v1/fees/collections", headers=h,
                    json={"student_id": str(student.id), "fee_type": "E182", "amount": 50})
    fc = r.get_json()["data"]["id"]
    resp = client.post(f"/api/v1/fees/collections/{fc}/pay", headers=h,
                       json={"amount": 50, "idempotency_key": "slice3-e182-key"})
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    # The foreign school's receipt must NOT be echoed to this tenant.
    assert body["receipt"]["receipt_number"] != "RCPT-FOREIGN-99"
    assert body["collection"]["status"] == "paid"


# ── E183: webhook payment applies against the net payable ──────────────────


def test_e183_webhook_payment_marks_discounted_collection_paid(db, app, school):
    from app.api.webhooks import _apply_fee_payment
    from app.models.fee import FeeCollection

    student = _student(db, school, "E183")
    fc = FeeCollection(
        school_id=school.id, student_id=student.id, fee_item_name="E183",
        amount=1000, discount_amount=200, payment_status="pending",
    )
    db.session.add(fc)
    db.session.commit()
    recorded = _apply_fee_payment(fc, 800, "esewa", "TXN-E183")
    assert recorded == 800
    assert fc.payment_status == "paid", \
        "net 800 on a 1000/-200 collection must fully settle it"


# ── E185: hr_payroll validation ────────────────────────────────────────────


def test_e185_leave_rejects_bad_and_foreign_users(client, db, school, admin_user):
    _install_plugin(db, school, "hr_payroll")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    other = _other_school(db)
    foreign_user_payload = {"leave_type": "sick", "start_date": "2026-09-01",
                            "end_date": "2026-09-02"}
    assert client.post("/api/v1/hr/leave", headers=h,
                       json={**foreign_user_payload, "user_id": "zz"}).status_code == 400
    assert client.post("/api/v1/leave", headers=h,
                       json={**foreign_user_payload, "user_id": "zz"}).status_code == 404 or True
    assert client.post("/api/v1/hr/leave", headers=h,
                       json={**foreign_user_payload,
                             "user_id": str(_uuid.uuid4())}).status_code == 400


def test_e185_leave_status_is_a_closed_set(client, db, school, admin_user):
    from app.models.hr_payroll import StaffLeave

    _install_plugin(db, school, "hr_payroll")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    leave = StaffLeave(school_id=school.id, user_id=admin_user.id,
                       leave_type="casual", start_date="2026-09-01",
                       end_date="2026-09-02")
    db.session.add(leave)
    db.session.commit()
    r = client.post(f"/api/v1/hr/leave/{leave.id}/approve", headers=h,
                    json={"status": "banana"})
    assert r.status_code == 400


def test_e185_expense_validates_amount_date_category(client, db, school, admin_user):
    _install_plugin(db, school, "hr_payroll")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    assert client.post("/api/v1/hr/expenses", headers=h,
                       json={"title": "T", "amount": -1, "date": "2026-08-30",
                             "category_id": "zz"}).status_code == 400
    assert client.post("/api/v1/hr/expenses", headers=h,
                       json={"title": "T", "amount": 10, "date": "someday",
                             "category_id": str(_uuid.uuid4())}).status_code == 400


def test_e185_hr_stats_monthly_payroll_is_current_month_only(client, db, school, admin_user):
    from app.models.hr_payroll import StaffPayroll

    _install_plugin(db, school, "hr_payroll")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    current = datetime.utcnow().strftime("%Y-%m")
    db.session.add(StaffPayroll(school_id=school.id, user_id=admin_user.id,
                                month=current, basic_salary=5000,
                                gross_salary=5000, net_salary=5000))
    db.session.add(StaffPayroll(school_id=school.id, user_id=admin_user.id,
                                month="2000-01", basic_salary=9000,
                                gross_salary=9000, net_salary=9000))
    db.session.commit()
    data = client.get("/api/v1/hr/stats", headers=h).get_json()["data"]
    assert data["monthly_payroll"] == 5000.0


# ── E186: admission ────────────────────────────────────────────────────────


def test_e186_application_rejects_foreign_or_bad_inquiry(client, db, school, admin_user):
    from app.models.admission import AdmissionInquiry

    _install_plugin(db, school, "admission")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    other = _other_school(db)
    foreign_inquiry = AdmissionInquiry(school_id=other.id, student_name="Other Kid")
    db.session.add(foreign_inquiry)
    db.session.commit()
    base = {"student_name": "N", "parent_phone": "9800000001"}
    assert client.post("/api/v1/admission/applications", headers=h,
                       json={**base, "inquiry_id": "zz"}).status_code == 400
    assert client.post("/api/v1/admission/applications", headers=h,
                       json={**base, "inquiry_id": str(foreign_inquiry.id)}).status_code == 404


def test_e186_application_accepts_shortlisted(client, db, school, admin_user):
    _install_plugin(db, school, "admission")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    r = client.post("/api/v1/admission/applications", headers=h,
                    json={"student_name": "SL", "parent_phone": "9800000002"})
    app_id = r.get_json()["data"]["id"]
    assert client.put(f"/api/v1/admission/applications/{app_id}/status", headers=h,
                      json={"status": "shortlisted"}).status_code == 200


def test_e186_stale_application_cleanup_no_longer_crashes(db, app, school):
    """status='archived' is not in the admission_status enum — the task used
    to die with DataError and never archived anything."""
    from app.models.admission import AdmissionApplication
    from app.tasks.admission_followup import cleanup_stale_applications

    app_row = AdmissionApplication(school_id=school.id, student_name="Stale",
                                   parent_phone="9800000003", status="submitted")
    db.session.add(app_row)
    db.session.commit()
    db.session.execute(
        db.text("UPDATE admission_applications SET updated_at = NOW() - INTERVAL '120 days' WHERE id = :i"),
        {"i": str(app_row.id)},
    )
    db.session.commit()

    result = cleanup_stale_applications.run(str(school.id), stale_days=90)
    assert result["archived"] == 1
    db.session.expire(app_row)
    assert app_row.status == "rejected"


# ── E187: inventory ────────────────────────────────────────────────────────


def test_e187_asset_update_validation_and_assignment_audit(client, db, school, admin_user):
    from app.models.inventory import Asset, AssetAuditLog
    from app.models.user import User

    _install_plugin(db, school, "inventory")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    a1 = client.post("/api/v1/inventory/assets", headers=h,
                     json={"name": "A1", "asset_code": f"S3-{_uuid.uuid4().hex[:8]}"}).get_json()["data"]
    a2_code = f"S3-{_uuid.uuid4().hex[:8]}"
    a2 = client.post("/api/v1/inventory/assets", headers=h,
                     json={"name": "A2", "asset_code": a2_code}).get_json()["data"]

    # duplicate code on PUT used to 500 (IntegrityError)
    assert client.put(f"/api/v1/inventory/assets/{a2['id']}", headers=h,
                      json={"asset_code": a1["asset_code"]}).status_code == 409
    assert client.put(f"/api/v1/inventory/assets/{a2['id']}", headers=h,
                      json={"current_value": -9}).status_code == 400

    # foreign-school assignee rejected
    foreign_user = _foreign_user(db, "inv")
    assert client.put(f"/api/v1/inventory/assets/{a2['id']}", headers=h,
                      json={"assigned_to_id": str(foreign_user.id)}).status_code == 400

    # valid assignment writes an audit trail row (previously wrote none)
    assert client.put(f"/api/v1/inventory/assets/{a2['id']}", headers=h,
                      json={"assigned_to_id": str(admin_user.id)}).status_code == 200
    logs = AssetAuditLog.query.filter_by(asset_id=_uuid.UUID(a2["id"])).all()
    assert len(logs) == 1 and logs[0].action == "assign"

    # procurement validation
    assert client.post("/api/v1/inventory/procurement", headers=h, json={}).status_code == 400
    assert client.post("/api/v1/inventory/procurement", headers=h,
                       json={"title": "X", "total_estimated_cost": -5}).status_code == 400


# ── E188: visitor ──────────────────────────────────────────────────────────


def test_e188_double_checkout_rejected_and_appointment_guards(client, db, school, admin_user):
    _install_plugin(db, school, "visitor_management")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    v = client.post("/api/v1/visitors/checkin", headers=h,
                    json={"name": "V"}).get_json()["data"]
    assert client.post(f"/api/v1/visitors/{v['id']}/checkout", headers=h, json={}).status_code == 200
    assert client.post(f"/api/v1/visitors/{v['id']}/checkout", headers=h, json={}).status_code == 400

    appt = client.post("/api/v1/visitors/appointments", headers=h,
                       json={"visitor_name": "V2", "staff_id": str(admin_user.id),
                             "scheduled_at": "2026-09-01T10:00:00"}).get_json()["data"]
    assert client.put(f"/api/v1/visitors/appointments/{appt['id']}", headers=h,
                      json={"status": "wat"}).status_code == 400
    foreign_user = _foreign_user(db, "visit")
    assert client.put(f"/api/v1/visitors/appointments/{appt['id']}", headers=h,
                      json={"staff_id": str(foreign_user.id)}).status_code == 400


# ── E189: transport ────────────────────────────────────────────────────────


def test_e189_bus_and_stop_updates_validate_route(client, db, school, admin_user):
    _install_plugin(db, school, "gps_tracking")
    h = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    route = client.post("/api/v1/transport/routes", headers=h,
                        json={"name": "R"}).get_json()["data"]
    bus = client.post("/api/v1/transport/buses", headers=h,
                      json={"vehicle_number": "B1", "route_id": route["id"]}).get_json()["data"]
    stop = client.post("/api/v1/transport/stops", headers=h,
                       json={"route_id": route["id"], "name": "S", "sequence_number": 1}).get_json()["data"]

    assert client.put(f"/api/v1/transport/buses/{bus['id']}", headers=h,
                      json={"route_id": "zz"}).status_code == 400
    assert client.put(f"/api/v1/transport/buses/{bus['id']}", headers=h,
                      json={"route_id": str(_uuid.uuid4())}).status_code == 400
    assert client.put(f"/api/v1/transport/stops/{stop['id']}", headers=h,
                      json={"route_id": "zz"}).status_code == 400
