"""S-A1 fees-depth regression tests (A-01 + A-08 + A-24).

Covers: installment schedule + apply, invoice grouping + status recompute,
carry-forward preview/apply (due + credit), AR aging buckets, fine accrual
idempotency, offline slip approve/reject, day closure till lock + day book,
receipt numbering config, pending-payment sweeper, parent nudge.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.fee import (
    FeeCollection,
    FeeDayClosure,
    FeeInvoice,
    FeeInstallment,
    FeeOfflineSubmission,
    PaymentInitiation,
)
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from tests.conftest import get_auth_headers


@pytest.fixture
def fees_env(client, db, school, admin_user):
    """fees plugin installed + auth headers + one class with one student."""
    db.session.add(Plugin(slug="fees", name="Fees", category="core", is_free=True,
                          is_published=True))
    db.session.add(SchoolPlugin(school_id=school.id, plugin_slug="fees", active=True))
    from app.models.academic import Class

    klass = Class(school_id=school.id, name="Class 10")
    db.session.add(klass)
    db.session.flush()
    student = Student(
        school_id=school.id, first_name="Ram", last_name="Bahadur",
        class_id=klass.id, status="active",
    )
    db.session.add(student)
    db.session.commit()
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    return {"headers": headers, "student": student, "klass": klass}


def _create_structure(client, headers, school, klass, total=3000):
    resp = client.post(
        "/api/v1/fees/structures",
        json={
            "name": "Annual Fee 2083",
            "class_id": str(klass.id),
            "academic_year": "2083",
            "total_annual": total,
            "fee_items": [
                {"name": "Tuition Fee", "fee_type": "tuition", "amount": total,
                 "frequency": "annual"},
            ],
        },
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.get_json()
    return resp.get_json()["data"]


# ── Installments + invoices ──────────────────────────────────────────────

def test_installments_apply_creates_bills_with_due_dates_and_invoice(
    client, db, school, fees_env
):
    headers = fees_env["headers"]
    structure = _create_structure(client, headers, school, fees_env["klass"])

    # Mismatched schedule is rejected (2500 ≠ 3000).
    bad = client.put(
        f"/api/v1/fees/structures/{structure['id']}/installments",
        json={"installments": [
            {"seq": 1, "label": "Term 1", "amount": 1000, "due_date_bs": "2083-04-10"},
            {"seq": 2, "label": "Term 2", "amount": 1000, "due_date_bs": "2083-08-10"},
            {"seq": 3, "label": "Term 3", "amount": 500, "due_date_bs": "2083-12-10"},
        ]},
        headers=headers,
    )
    assert bad.status_code == 400

    ok = client.put(
        f"/api/v1/fees/structures/{structure['id']}/installments",
        json={"installments": [
            {"seq": 1, "label": "Term 1", "amount": 1000, "due_date_bs": "2083-04-10"},
            {"seq": 2, "label": "Term 2", "amount": 1000, "due_date_bs": "2083-08-10"},
            {"seq": 3, "label": "Term 3", "amount": 1000, "due_date_bs": "2083-12-10"},
        ]},
        headers=headers,
    )
    assert ok.status_code == 200, ok.get_json()
    assert ok.get_json()["data"]["scheduled_total"] == 3000

    listing = client.get(
        f"/api/v1/fees/structures/{structure['id']}/installments", headers=headers
    )
    data = listing.get_json()["data"]
    assert data["balanced"] is True
    assert len(data["installments"]) == 3

    applied = client.post(
        f"/api/v1/fees/structures/{structure['id']}/installments/apply",
        headers=headers,
    )
    assert applied.status_code == 200, applied.get_json()
    assert applied.get_json()["data"]["created_collections"] == 3

    # Idempotent re-apply.
    reapplied = client.post(
        f"/api/v1/fees/structures/{structure['id']}/installments/apply",
        headers=headers,
    )
    assert reapplied.get_json()["data"]["created_collections"] == 0
    assert reapplied.get_json()["data"]["skipped_existing"] == 3

    # create_fee_structure auto-applies the full amount; applying the
    # installment schedule must RETIRE those unpaid full bills (conversion,
    # not double-billing) and create one bill per installment.
    live_bills = FeeCollection.query.filter_by(school_id=school.id, is_deleted=False).all()
    assert len(live_bills) == 3
    assert all(b.installment_id is not None for b in live_bills)
    assert {b.due_date_bs for b in live_bills} == {"2083-04-10", "2083-08-10", "2083-12-10"}

    invoices = FeeInvoice.query.filter_by(school_id=school.id).all()
    assert len(invoices) == 1  # all three lines land on one invoice
    assert invoices[0].status == "pending"
    assert invoices[0].period_key == "2083"
    invoice_detail = client.get(
        f"/api/v1/fees/invoices/{invoices[0].id}", headers=headers
    ).get_json()["data"]["invoice"]
    assert invoice_detail["total_amount"] == 3000
    assert len(invoice_detail["lines"]) == 3


def test_invoice_status_recomputes_on_payment(client, db, school, fees_env):
    headers = fees_env["headers"]
    structure = _create_structure(client, headers, school, fees_env["klass"], total=2000)
    client.put(
        f"/api/v1/fees/structures/{structure['id']}/installments",
        json={"installments": [
            {"seq": 1, "label": "Term 1", "amount": 1000, "due_date_bs": "2083-04-10"},
            {"seq": 2, "label": "Term 2", "amount": 1000, "due_date_bs": "2083-08-10"},
        ]},
        headers=headers,
    )
    client.post(
        f"/api/v1/fees/structures/{structure['id']}/installments/apply",
        headers=headers,
    )
    invoice = FeeInvoice.query.filter_by(school_id=school.id).first()
    bills = sorted(
        FeeCollection.query.filter_by(school_id=school.id, is_deleted=False).all(),
        key=lambda b: b.due_date_bs or "",
    )

    pay1 = client.post(
        f"/api/v1/fees/collections/{bills[0].id}/pay",
        json={"amount": 400, "payment_method": "cash"},
        headers=headers,
    )
    assert pay1.status_code == 200, pay1.get_json()
    assert invoice.status == "partial"

    pay2 = client.post(
        f"/api/v1/fees/collections/{bills[0].id}/pay",
        json={"amount": 600, "payment_method": "cash"},
        headers=headers,
    )
    assert pay2.status_code == 200
    assert invoice.status == "partial"  # first bill settled, second pending

    pay3 = client.post(
        f"/api/v1/fees/collections/{bills[1].id}/pay",
        json={"amount": 1000, "payment_method": "cash"},
        headers=headers,
    )
    assert pay3.status_code == 200
    assert invoice.status == "paid"

    listing = client.get(
        "/api/v1/fees/invoices", headers=headers
    ).get_json()["data"]["invoices"]
    assert listing[0]["status"] == "paid"
    assert listing[0]["paid_amount"] == 2000


# ── Carry-forward ────────────────────────────────────────────────────────

def test_carry_forward_preview_and_apply_due_and_credit(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]

    # 2082: one unpaid bill of 500 (due) + one bill where 1500 was paid
    # against a payable of 800 (amount lowered after payment). Signed
    # balance = (500 + 800) payable − 1500 paid = −200 (credit).
    db.session.add_all([
        FeeCollection(school_id=school.id, student_id=student.id, amount=500,
                      academic_year="2082", year_bs="2082", payment_status="pending",
                      fee_item_name="Old due"),
        FeeCollection(school_id=school.id, student_id=student.id, amount=800,
                      academic_year="2082", year_bs="2082", payment_status="partial",
                      notes="[partial_paid:1500]", fee_item_name="Old paid"),
    ])
    db.session.commit()

    preview = client.get(
        "/api/v1/fees/carry-forward/preview?from_year_bs=2082", headers=headers
    ).get_json()["data"]
    entry = next(e for e in preview["students"] if e["student_id"] == str(student.id))
    assert entry["signed_balance"] == -200.0  # overpaid → credit
    assert entry["balance_type"] == "credit"

    applied = client.post(
        "/api/v1/fees/carry-forward/apply",
        json={"from_year_bs": "2082", "to_year_bs": "2083",
              "student_ids": [str(student.id)], "due_date_bs": "2083-04-10"},
        headers=headers,
    )
    assert applied.status_code == 200, applied.get_json()
    assert applied.get_json()["data"]["applied"] == 1
    assert applied.get_json()["data"]["bills_created"] == 1

    # Credit lands as a self-settled (waived) line in the new year.
    credit_bill = FeeCollection.query.filter(
        FeeCollection.fee_item_name.like("Carry-forward credit%")
    ).first()
    assert credit_bill is not None
    assert credit_bill.payment_status == "waived"
    assert float(credit_bill.discount_amount) == 200.0

    # Idempotent: a second apply skips the student.
    again = client.post(
        "/api/v1/fees/carry-forward/apply",
        json={"from_year_bs": "2082", "to_year_bs": "2083",
              "student_ids": [str(student.id)]},
        headers=headers,
    ).get_json()["data"]
    assert again["applied"] == 0 and again["skipped"] == 1


# ── AR aging ─────────────────────────────────────────────────────────────

def test_aging_buckets_group_by_class(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]
    # as_of 2083-06-01: due 2083-05-01 (31 days → b31_60), 2083-06-01 (current),
    # no due date (unscheduled).
    db.session.add_all([
        FeeCollection(school_id=school.id, student_id=student.id, amount=100,
                      due_date_bs="2083-05-01", payment_status="pending"),
        FeeCollection(school_id=school.id, student_id=student.id, amount=200,
                      due_date_bs="2083-06-01", payment_status="pending"),
        FeeCollection(school_id=school.id, student_id=student.id, amount=400,
                      payment_status="pending"),
    ])
    db.session.commit()

    resp = client.get(
        "/api/v1/fees/receivables/aging?as_of_bs=2083-06-01", headers=headers
    )
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    by_class = {row["class_name"]: row for row in data["by_class"]}
    row = by_class["Class 10"]
    assert row["b31_60"] == 100
    assert row["current_or_30"] == 200
    assert row["unscheduled"] == 400
    assert row["total"] == 700
    assert data["grand_total"] == 700


# ── Fines ────────────────────────────────────────────────────────────────

def test_fine_accrual_fixed_once_idempotent(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]
    db.session.add(
        FeeCollection(school_id=school.id, student_id=student.id, amount=1000,
                      due_date_bs="2083-04-01", payment_status="pending")
    )
    db.session.commit()

    settings = client.put(
        "/api/v1/fees/fines/settings",
        json={"mode": "fixed_once", "value": 50, "grace_days": 0},
        headers=headers,
    )
    assert settings.status_code == 200, settings.get_json()

    first = client.post("/api/v1/fees/fines/accrue",
                        json={"as_of_bs": "2083-04-15"}, headers=headers)
    assert first.status_code == 200, first.get_json()
    assert first.get_json()["data"]["bills_fined"] == 1
    assert first.get_json()["data"]["fine_total"] == 50

    bill = FeeCollection.query.filter_by(school_id=school.id).first()
    assert float(bill.late_fine_amount) == 50
    assert bill.fine_accrued_on_bs == "2083-04-15"

    # Same BS day → no-op; later day → fixed_once adds nothing more? InfixEdu
    # semantics: fixed_once accrues once (idempotency stamp blocks re-accrual).
    second = client.post("/api/v1/fees/fines/accrue",
                         json={"as_of_bs": "2083-04-16"}, headers=headers)
    assert second.get_json()["data"]["bills_fined"] == 0
    assert float(FeeCollection.query.first().late_fine_amount) == 50


def test_fine_accrual_daily_percent_grows(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]
    db.session.add(
        FeeCollection(school_id=school.id, student_id=student.id, amount=1000,
                      due_date_bs="2083-04-01", payment_status="pending")
    )
    db.session.commit()
    client.put("/api/v1/fees/fines/settings",
               json={"mode": "daily_percent", "value": 1, "grace_days": 0},
               headers=headers)

    day10 = client.post("/api/v1/fees/fines/accrue",
                        json={"as_of_bs": "2083-04-11"}, headers=headers)
    assert day10.get_json()["data"]["fine_total"] == 100.0  # 1% × 10 days
    day12 = client.post("/api/v1/fees/fines/accrue",
                        json={"as_of_bs": "2083-04-13"}, headers=headers)
    # Grows by 2 more days (1% × 12 − already accrued 10% of base)
    assert day12.get_json()["data"]["fine_total"] == 20.0
    bill = FeeCollection.query.filter_by(school_id=school.id).first()
    assert float(bill.late_fine_amount) == 120.0


def test_fines_and_waivers_reports(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]
    db.session.add_all([
        FeeCollection(school_id=school.id, student_id=student.id, amount=1000,
                      late_fine_amount=75, discount_amount=100,
                      fee_item_name="Tuition Fee", payment_status="pending"),
    ])
    db.session.commit()
    fines = client.get("/api/v1/fees/reports/fines", headers=headers).get_json()["data"]
    assert fines["grand_total"] == 75
    waivers = client.get("/api/v1/fees/reports/waivers", headers=headers).get_json()["data"]
    assert waivers["grand_total"] == 100


# ── Offline submissions ──────────────────────────────────────────────────

def test_offline_submission_approve_flow(client, db, school, fees_env, student_user):
    headers = fees_env["headers"]
    student = fees_env["student"]
    bill = FeeCollection(school_id=school.id, student_id=student.id, amount=500,
                         payment_status="pending")
    db.session.add(bill)
    db.session.flush()
    sub = FeeOfflineSubmission(
        school_id=school.id, student_id=student.id, amount=500, method="bank",
        bank_name="Nabil", reference_no="TX-123", paid_on_bs="2083-04-12",
        collection_ids=[str(bill.id)], status="pending", created_by_id=None,
    )
    db.session.add(sub)
    db.session.commit()

    approve = client.post(
        f"/api/v1/fees/offline-submissions/{sub.id}/approve",
        json={"review_notes": "verified in bank statement"},
        headers=headers,
    )
    assert approve.status_code == 200, approve.get_json()
    data = approve.get_json()["data"]
    assert data["allocated_amount"] == 500
    assert len(data["receipt_ids"]) == 1
    db.session.expire_all()
    assert bill.payment_status == "paid"
    assert bill.receipt_number  # receipt drawn from the school series

    # Double-approve is refused.
    again = client.post(
        f"/api/v1/fees/offline-submissions/{sub.id}/approve", headers=headers
    )
    assert again.status_code == 409

    # Reject flow on a fresh submission.
    sub2 = FeeOfflineSubmission(
        school_id=school.id, student_id=student.id, amount=100, method="cheque",
        collection_ids=[], status="pending",
    )
    db.session.add(sub2)
    db.session.commit()
    reject = client.post(
        f"/api/v1/fees/offline-submissions/{sub2.id}/reject",
        json={"review_notes": "unclear slip"},
        headers=headers,
    )
    assert reject.status_code == 200
    assert reject.get_json()["data"]["submission"]["status"] == "rejected"


# ── Day book + day closure till lock ─────────────────────────────────────

def test_day_closure_till_lock_and_day_book(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]
    bill = FeeCollection(school_id=school.id, student_id=student.id, amount=300,
                         payment_status="pending")
    db.session.add(bill)
    db.session.commit()

    # Record a cash payment "today" (the payment lands at now → BS today).
    pay = client.post(
        f"/api/v1/fees/collections/{bill.id}/pay",
        json={"amount": 300, "payment_method": "cash"},
        headers=headers,
    )
    assert pay.status_code == 200, pay.get_json()

    # Close the day for this collector.
    close = client.post(
        "/api/v1/fees/day-closures",
        json={"denominations": {"100": 3}, "notes": "end of day"},
        headers=headers,
    )
    assert close.status_code == 201, close.get_json()
    closure = close.get_json()["data"]
    assert closure["expected_total"] == 300
    assert closure["counted_total"] == 300
    assert closure["difference"] == 0

    day_book = client.get("/api/v1/fees/day-book", headers=headers).get_json()["data"]
    assert day_book["grand_total"] == 300
    assert day_book["by_method"][0]["method"] == "cash"

    # A second cash bill + payment is refused while the counter is closed.
    bill2 = FeeCollection(school_id=school.id, student_id=student.id, amount=50,
                          payment_status="pending")
    db.session.add(bill2)
    db.session.commit()
    blocked = client.post(
        f"/api/v1/fees/collections/{bill2.id}/pay",
        json={"amount": 50, "payment_method": "cash"},
        headers=headers,
    )
    assert blocked.status_code == 423, blocked.get_json()

    listing = client.get("/api/v1/fees/day-closures", headers=headers)
    assert listing.status_code == 200
    closure_id = listing.get_json()["data"]["closures"][0]["id"]
    reopened = client.post(
        f"/api/v1/fees/day-closures/{closure_id}/reopen", headers=headers
    )
    assert reopened.status_code == 200
    allowed = client.post(
        f"/api/v1/fees/collections/{bill2.id}/pay",
        json={"amount": 50, "payment_method": "cash"},
        headers=headers,
    )
    assert allowed.status_code == 200


def test_day_closure_double_close_conflict(client, db, school, fees_env):
    headers = fees_env["headers"]
    first = client.post("/api/v1/fees/day-closures", json={}, headers=headers)
    assert first.status_code == 201
    second = client.post("/api/v1/fees/day-closures", json={}, headers=headers)
    assert second.status_code == 409


# ── Receipt numbering config ─────────────────────────────────────────────

def test_receipt_numbering_config(client, db, school, fees_env):
    headers = fees_env["headers"]
    got = client.put(
        "/api/v1/fees/receipt-numbering",
        json={"prefix": "sha", "pad": 6},
        headers=headers,
    )
    assert got.status_code == 200
    assert got.get_json()["data"]["prefix"] == "SHA"
    assert got.get_json()["data"]["sample"].startswith("SHA/")

    student = fees_env["student"]
    bill = FeeCollection(school_id=school.id, student_id=student.id, amount=100,
                         payment_status="pending")
    db.session.add(bill)
    db.session.commit()
    pay = client.post(
        f"/api/v1/fees/collections/{bill.id}/pay",
        json={"amount": 100, "payment_method": "cash"},
        headers=headers,
    )
    assert pay.status_code == 200
    assert pay.get_json()["data"]["receipt"]["receipt_number"].startswith("SHA/")


# ── Pending-payment sweeper ──────────────────────────────────────────────

def test_sweep_pending_initiations(client, db, school, fees_env):
    headers = fees_env["headers"]
    student = fees_env["student"]
    bill = FeeCollection(school_id=school.id, student_id=student.id, amount=100,
                         payment_status="pending")
    db.session.add(bill)
    db.session.flush()
    stale = PaymentInitiation(
        school_id=school.id, collection_id=bill.id, gateway="esewa",
        gateway_ref="ref-1", amount=100, status="initiated",
        created_at=datetime.now(timezone.utc) - timedelta(hours=3),
    )
    fresh = PaymentInitiation(
        school_id=school.id, collection_id=bill.id, gateway="khalti",
        gateway_ref="ref-2", amount=100, status="initiated",
        created_at=datetime.now(timezone.utc),
    )
    db.session.add_all([stale, fresh])
    db.session.commit()

    swept = client.post(
        "/api/v1/fees/payments/sweep-pending", json={"stale_hours": 1},
        headers=headers,
    )
    assert swept.status_code == 200
    assert swept.get_json()["data"]["swept"] == 1
    db.session.expire_all()
    assert stale.status == "failed"
    assert fresh.status == "initiated"


# ── Nudge ────────────────────────────────────────────────────────────────

def test_nudge_parent_notifies_guardian_user(client, db, school, fees_env, admin_user):
    headers = fees_env["headers"]
    student = fees_env["student"]
    from app.models.student import Guardian

    guardian = Guardian(
        school_id=school.id, student_id=student.id, relation="father",
        full_name="Father Bahadur", user_id=admin_user.id,
    )
    db.session.add(guardian)
    db.session.add(
        FeeCollection(school_id=school.id, student_id=student.id, amount=250,
                      payment_status="pending")
    )
    db.session.commit()

    resp = client.post(
        f"/api/v1/fees/students/{student.id}/nudge-parent", headers=headers
    )
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["data"]["notified"] == 1

    from app.models.notification import InAppNotification

    note = InAppNotification.query.filter_by(school_id=school.id).first()
    assert note is not None
    assert "250" in note.body
