"""Fee discount stacking + payment math regression tests.

Auto-applied scholarships stack ADDITIVELY (percentages computed on the base
amount, not sequentially on the remainder), are capped at the base, and net
payable never goes negative (see audits/VERIFICATION_MONEY_GRADES_2026-08-28.md).
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
            slug="fees",
            name="Fees",
            category="core",
            is_free=True,
            is_published=True,
            version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="fees", active=True,
                     is_trial=False)
    )
    db.session.commit()


def _student_with_class(db, school, email, klass):
    u = User(
        school_id=school.id,
        role="student",
        full_name="Discount Test Student",
        email=email,
        phone="+9779841000921",
        is_active=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.flush()
    student = Student(
        school_id=school.id,
        user_id=u.id,
        first_name="Discount",
        last_name="Test",
        status="active",
        class_id=klass.id,
    )
    db.session.add(student)
    db.session.commit()
    return student


def _apply_structure(client, headers, klass, amount):
    """Create a structure for the class — create_fee_structure auto-applies it."""
    return client.post(
        "/api/v1/fees/structures",
        headers=headers,
        json={
            "name": "Tuition Stacking",
            "class_id": str(klass.id),
            "amount": amount,
            "frequency": "monthly",
        },
    )


def _first_collection(client, headers, student_id):
    resp = client.get(
        f"/api/v1/fees/collections?student_id={student_id}", headers=headers
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert len(data) == 1
    return data[0]


def test_two_percent_discounts_stack_additively(client, db, school, admin_user):
    """sibling 10% + merit 5% on 10000 = 1500 (15% of base), not 14.5%/one-only."""
    _install_fees_plugin(db, school)
    headers = _login(client)
    klass = Class(school_id=school.id, name="Stack Grade 5", sort_order=51)
    db.session.add(klass)
    db.session.commit()
    student = _student_with_class(db, school, "stack.percent@test.edu.np", klass)

    for value, reason in ((10, "sibling"), (5, "merit")):
        resp = client.post(
            "/api/v1/fees/scholarships",
            headers=headers,
            json={
                "student_id": str(student.id),
                "discount_type": "percent",
                "discount_value": value,
                "reason": reason,
            },
        )
        assert resp.status_code == 201

    assert _apply_structure(client, headers, klass, 10000).status_code == 201
    collection = _first_collection(client, headers, student.id)
    assert collection["discount_amount"] == 1500.0   # 1000 + 500, additive
    assert collection["net_amount"] == 8500.0        # 10000 - 1500
    assert collection["due_amount"] == 8500.0


def test_fixed_and_percent_discounts_combine_and_cap_at_base(
    client, db, school, admin_user
):
    _install_fees_plugin(db, school)
    headers = _login(client)
    klass = Class(school_id=school.id, name="Stack Grade 6", sort_order=52)
    db.session.add(klass)
    db.session.commit()
    student = _student_with_class(db, school, "stack.mixed@test.edu.np", klass)

    client.post("/api/v1/fees/scholarships", headers=headers, json={
        "student_id": str(student.id),
        "discount_type": "fixed",
        "discount_value": 500,
        "reason": "sibling",
    })
    client.post("/api/v1/fees/scholarships", headers=headers, json={
        "student_id": str(student.id),
        "discount_type": "percent",
        "discount_value": 10,
        "reason": "merit",
    })
    assert _apply_structure(client, headers, klass, 10000).status_code == 201
    collection = _first_collection(client, headers, student.id)
    assert collection["discount_amount"] == 1500.0   # 500 + 1000
    assert collection["net_amount"] == 8500.0

    # 100% + fixed > base: capped at the base, net never negative.
    client.post("/api/v1/fees/scholarships", headers=headers, json={
        "student_id": str(student.id),
        "discount_type": "percent",
        "discount_value": 100,
        "reason": "full-waiver",
    })
    assert _apply_structure(client, headers, klass, 4000).status_code == 201
    resp = client.get(
        f"/api/v1/fees/collections?student_id={student.id}", headers=headers
    )
    amounts = [c["net_amount"] for c in resp.get_json()["data"]]
    assert all(a >= 0 for a in amounts)


def test_partial_payments_keep_running_balance_exact(
    client, db, school, admin_user
):
    """Base 10000, discount 1000 -> payable 9000; 4000 then 5000 closes it out."""
    _install_fees_plugin(db, school)
    headers = _login(client)
    klass = Class(school_id=school.id, name="Stack Grade 7", sort_order=53)
    db.session.add(klass)
    db.session.commit()
    student = _student_with_class(db, school, "stack.partial@test.edu.np", klass)

    created = client.post(
        "/api/v1/fees/collections",
        headers=headers,
        json={
            "student_id": str(student.id),
            "fee_type": "Transport",
            "amount": 10000,
            "discount_amount": 1000,
        },
    ).get_json()["data"]
    assert created["net_amount"] == 9000.0

    first = client.post(
        f"/api/v1/fees/collections/{created['id']}/pay",
        headers=headers,
        json={"amount": 4000, "payment_method": "cash"},
    ).get_json()["data"]
    assert first["collection"]["paid_amount"] == 4000.0
    assert first["collection"]["due_amount"] == 5000.0
    assert first["collection"]["payment_status"] == "partial"
    assert first["receipt"]["amount"] == 4000.0

    second = client.post(
        f"/api/v1/fees/collections/{created['id']}/pay",
        headers=headers,
        json={"amount": 5000, "payment_method": "cash"},
    ).get_json()["data"]
    assert second["collection"]["paid_amount"] == 9000.0
    assert second["collection"]["due_amount"] == 0.0
    assert second["collection"]["payment_status"] == "paid"

    # Settled bill rejects further payments; overpay caps at outstanding.
    assert client.post(
        f"/api/v1/fees/collections/{created['id']}/pay",
        headers=headers,
        json={"amount": 100, "payment_method": "cash"},
    ).status_code == 400


def test_discount_exceeding_total_clamps_to_zero_and_waives(
    client, db, school, admin_user
):
    _install_fees_plugin(db, school)
    headers = _login(client)
    klass = Class(school_id=school.id, name="Stack Grade 8", sort_order=54)
    db.session.add(klass)
    db.session.commit()
    student = _student_with_class(db, school, "stack.waive@test.edu.np", klass)

    resp = client.post(
        "/api/v1/fees/collections",
        headers=headers,
        json={
            "student_id": str(student.id),
            "fee_type": "Lab",
            "amount": 1000,
            "late_fine_amount": 200,
            "discount_amount": 5000,
        },
    ).get_json()["data"]
    assert resp["net_amount"] == 0.0
    assert resp["due_amount"] == 0.0
    assert resp["payment_status"] == "waived"
