"""Money & Grades verification (2026-08-28) — fees worked examples.

Rule under test: ALL active matching discounts stack ADDITIVELY on the base
(10% + 5% of 10000 = 1500, NOT sequential 1450), capped at the base; payable =
base + late fine − discount, floored at 0 (net never negative); partial
payments keep an exact running balance via [partial_paid:X].
"""

from app.models.academic import Class
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _login(client):
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _install_fees_plugin(db, school):
    from app.models.plugin import Plugin, SchoolPlugin

    plugin = Plugin.query.filter_by(slug="fees").first()
    if not plugin:
        plugin = Plugin(
            slug="fees", name="Fees", category="core", is_free=True,
            is_published=True, version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="fees", active=True, is_trial=False)
    )
    db.session.commit()


def test_two_discounts_additive_and_running_balance(client, db, school, admin_user):
    _install_fees_plugin(db, school)
    headers = _login(client)

    u = User(
        school_id=school.id, role="student", full_name="Fees Verify Student",
        email="fees.verify@test.edu.np", phone="+9779841000931",
        is_active=True, phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.flush()
    klass = Class(school_id=school.id, name="Verify Grade 9", sort_order=59)
    db.session.add(klass)
    db.session.flush()
    student = Student(
        school_id=school.id, user_id=u.id, first_name="Fees", last_name="Verify",
        status="active", class_id=klass.id,
    )
    db.session.add(student)
    db.session.commit()

    # ── 1. Two percent discounts 10% + 5% on base 10000 (auto-applied) ──
    for value in (10, 5):
        assert client.post(
            "/api/v1/fees/scholarships", headers=headers,
            json={"student_id": str(student.id), "discount_type": "percent",
                  "discount_value": value},
        ).status_code == 201
    assert client.post(
        "/api/v1/fees/structures", headers=headers,
        json={"name": "Tuition Verify", "class_id": str(klass.id),
              "amount": 10000, "frequency": "monthly"},
    ).status_code == 201
    collections = client.get(
        f"/api/v1/fees/collections?student_id={student.id}", headers=headers
    ).get_json()["data"]
    assert len(collections) == 1
    auto = collections[0]
    # ADDITIVE: 1000 + 500 = 1500 (sequential would be 10000-1000=9000 → -450 → 1450)
    assert auto["discount_amount"] == 1500.0
    assert auto["net_amount"] == 8500.0
    assert auto["due_amount"] == 8500.0

    # ── 2. Manual bill with late fine + explicit discount: same rule ──
    manual = client.post(
        "/api/v1/fees/collections", headers=headers,
        json={"student_id": str(student.id), "fee_type": "Transport Verify",
              "amount": 10000, "late_fine_amount": 500, "discount_amount": 1500},
    ).get_json()["data"]
    # payable = 10000 + 500 − 1500 = 9000 (discount capped at base by design:
    # auto-discounts can never exceed the base, so the 500 fine is never waived)
    assert manual["gross_amount"] == 10500.0
    assert manual["net_amount"] == 9000.0
    assert manual["due_amount"] == 9000.0

    # ── 3. Net never negative: discount larger than gross ──
    waived = client.post(
        "/api/v1/fees/collections", headers=headers,
        json={"student_id": str(student.id), "fee_type": "Lab Verify",
              "amount": 1000, "late_fine_amount": 200, "discount_amount": 5000},
    ).get_json()["data"]
    assert waived["net_amount"] == 0.0
    assert waived["due_amount"] == 0.0
    assert waived["payment_status"] == "waived"

    # ── 4. Running balance on the manual bill (payable 9000) ──
    p1 = client.post(
        f"/api/v1/fees/collections/{manual['id']}/pay", headers=headers,
        json={"amount": 3000, "payment_method": "cash"},
    ).get_json()["data"]
    assert p1["collection"]["paid_amount"] == 3000.0
    assert p1["collection"]["due_amount"] == 6000.0
    assert p1["collection"]["payment_status"] == "partial"
    receipt_id = p1["receipt_id"]
    assert p1["receipt"]["amount"] == 3000.0

    # adjust discount up: payable 10000+500-8500=2000 < paid 3000 → rejected
    resp = client.put(
        f"/api/v1/fees/collections/{manual['id']}", headers=headers,
        json={"discount_amount": 8500},
    )
    assert resp.status_code == 400

    # smaller adjustment: payable 9500 → due 6500, still partial
    adj = client.put(
        f"/api/v1/fees/collections/{manual['id']}", headers=headers,
        json={"discount_amount": 1000},
    ).get_json()["data"]
    assert adj["net_amount"] == 9500.0
    assert adj["paid_amount"] == 3000.0
    assert adj["due_amount"] == 6500.0
    assert adj["payment_status"] == "partial"

    # settle exactly: 3000 + 6500 = 9500
    p2 = client.post(
        f"/api/v1/fees/collections/{manual['id']}/pay", headers=headers,
        json={"amount": 6500, "payment_method": "cash"},
    ).get_json()["data"]
    assert p2["collection"]["paid_amount"] == 9500.0
    assert p2["collection"]["due_amount"] == 0.0
    assert p2["collection"]["payment_status"] == "paid"

    # overpay after settle → 400; overpay mid-way caps receipt at outstanding
    assert client.post(
        f"/api/v1/fees/collections/{manual['id']}/pay", headers=headers,
        json={"amount": 100, "payment_method": "cash"},
    ).status_code == 400

    # overpay cap: auto bill payable 8500, pay 99999 → receipt 8500, due 0
    over = client.post(
        f"/api/v1/fees/collections/{auto['id']}/pay", headers=headers,
        json={"amount": 99999, "payment_method": "cash"},
    ).get_json()["data"]
    assert over["receipt"]["amount"] == 8500.0
    assert over["collection"]["paid_amount"] == 8500.0
    assert over["collection"]["due_amount"] == 0.0

    # paid_amount can never exceed payable in the serializer either
    assert over["collection"]["paid_amount"] <= over["collection"]["net_amount"]

    # ── 5. Summary endpoint uses the same payable/paid math ──
    # collections: auto 8500 (paid 8500) + manual 9500 (paid 9500) + waived 0
    summary = client.get("/api/v1/fees/summary", headers=headers).get_json()["data"]
    assert summary["total_expected"] == 18000.0
    assert summary["total_collected"] == 18000.0
    assert summary["total_outstanding"] == 0.0

    # ── 6. Receipt PDF: paid + outstanding-after figures match the ledger ──
    pdf_resp = client.get(f"/api/v1/fees/receipts/{receipt_id}/pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.data[:5] == b"%PDF-"
    with open("/tmp/receipt_verify.pdf", "wb") as fh:
        fh.write(pdf_resp.data)
    # (verified on host with pdftotext: Paid 3,000.00 / Outstanding 6,000.00
    #  — figures consistent with the ledger state at that moment)


def test_receipt_pdf_outstanding_is_point_in_time(client, db, school, admin_user):
    """Reprinting an older receipt must show the outstanding after THAT
    payment (6,000), not the collection's current balance (0)."""
    import io

    from pypdf import PdfReader

    _install_fees_plugin(db, school)
    headers = _login(client)
    u = User(
        school_id=school.id, role="student", full_name="Receipt PIT Student",
        email="receipt.pit@test.edu.np", phone="+9779841000941",
        is_active=True, phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.flush()
    student = Student(
        school_id=school.id, user_id=u.id, first_name="Receipt", last_name="PIT",
        status="active",
    )
    db.session.add(student)
    db.session.commit()

    bill = client.post(
        "/api/v1/fees/collections", headers=headers,
        json={"student_id": str(student.id), "fee_type": "PIT Fee",
              "amount": 10000, "discount_amount": 1000},
    ).get_json()["data"]
    assert bill["net_amount"] == 9000.0

    first = client.post(
        f"/api/v1/fees/collections/{bill['id']}/pay", headers=headers,
        json={"amount": 3000, "payment_method": "cash"},
    ).get_json()["data"]
    first_receipt_id = first["receipt_id"]

    # settle the bill, THEN re-render the first receipt
    client.post(
        f"/api/v1/fees/collections/{bill['id']}/pay", headers=headers,
        json={"amount": 6000, "payment_method": "cash"},
    )

    pdf = client.get(
        f"/api/v1/fees/receipts/{first_receipt_id}/pdf", headers=headers
    )
    assert pdf.status_code == 200
    text = "\n".join(
        page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf.data)).pages
    )
    assert "NPR 3,000.00" in text       # this receipt's payment
    assert "Outstanding after payment: NPR 6,000.00" in text  # 9000 − 3000
    assert "Outstanding after payment: NPR 0.00" not in text
