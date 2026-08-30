"""Payroll money-math regression tests.

gross = basic_salary + Σallowances ; net = gross − Σdeductions.
Covers the audit findings: server-side totals, robust component sums and
serializer/payslip fallbacks (see audits/VERIFICATION_MONEY_GRADES_2026-08-28.md).
"""
from app.api.v1.hr_payroll import _payroll_dict, _sum_money
from app.models.hr_payroll import StaffPayroll
from app.models.user import User
from tests.conftest import get_auth_headers


def _login(client):
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _staff(db, school):
    u = User(
        school_id=school.id,
        role="staff",
        full_name="Payroll Math Staff",
        email="payroll.math@test.edu.np",
        phone="+9779841000910",
        is_active=True,
        phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()
    return u


def _install_hr_plugin(db, school):
    from app.models.plugin import Plugin, SchoolPlugin

    plugin = Plugin.query.filter_by(slug="hr_payroll").first()
    if not plugin:
        plugin = Plugin(
            slug="hr_payroll",
            name="HR & Payroll",
            category="core",
            is_free=True,
            is_published=True,
            version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="hr_payroll", active=True,
                     is_trial=False)
    )
    db.session.commit()


def test_sum_money_skips_non_numeric_component_values():
    """Component sums count numbers and numeric strings only — never crash."""
    assert _sum_money({"pf": 1500, "insurance": 500}) == 2000.0
    assert _sum_money({"pf": "1500"}) == 1500.0          # numeric strings count
    assert _sum_money({"tax": "10%"}) == 0.0             # unsupported format skipped
    assert _sum_money({"flag": True}) == 0.0             # booleans are not NPR
    assert _sum_money({}) == 0.0
    assert _sum_money(None) == 0.0
    assert _sum_money(2500) == 2500.0                    # scalar JSONB payload


def test_create_payroll_computes_gross_and_net_from_components(
    client, db, school, admin_user
):
    _install_hr_plugin(db, school)
    staff = _staff(db, school)
    headers = _login(client)

    resp = client.post(
        "/api/v1/hr/payroll",
        headers=headers,
        json={
            "user_id": str(staff.id),
            "month": "2082-05",
            "basic_salary": 40000,
            "allowances": {"transport": 3000, "dearness": 2000},
            "deductions": {"pf": 1500, "insurance": 500},
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()["data"]
    # 40000 + (3000 + 2000) = 45000 ; 45000 - (1500 + 500) = 43000
    assert data["gross_salary"] == 45000.0
    assert data["net_salary"] == 43000.0
    assert data["allowances_total"] == 5000.0
    assert data["deductions_total"] == 2000.0


def test_explicit_gross_net_are_not_overwritten(client, db, school, admin_user):
    """Client-supplied totals are respected — fallbacks never ignore real data."""
    _install_hr_plugin(db, school)
    staff = _staff(db, school)
    headers = _login(client)

    resp = client.post(
        "/api/v1/hr/payroll",
        headers=headers,
        json={
            "user_id": str(staff.id),
            "month": "2082-06",
            "basic_salary": 40000,
            "deductions": {"pf": 1500},
            "gross_salary": 45000,
            "net_salary": 43500,
        },
    )
    data = resp.get_json()["data"]
    assert data["gross_salary"] == 45000.0
    assert data["net_salary"] == 43500.0


def test_update_recomputes_totals_when_components_change(
    client, db, school, admin_user
):
    _install_hr_plugin(db, school)
    staff = _staff(db, school)
    headers = _login(client)

    created = client.post(
        "/api/v1/hr/payroll",
        headers=headers,
        json={
            "user_id": str(staff.id),
            "month": "2082-07",
            "basic_salary": 40000,
            "allowances": {"transport": 3000, "dearness": 2000},
            "deductions": {"pf": 1500, "insurance": 500},
        },
    ).get_json()["data"]
    # create derives totals server-side: gross = 40000 + 5000 = 45000,
    # net = 45000 − 2000 = 43000
    assert created["gross_salary"] == 45000.0
    assert created["net_salary"] == 43000.0

    updated = client.put(
        f"/api/v1/hr/payroll/{created['id']}",
        headers=headers,
        json={"deductions": {"pf": 1500, "insurance": 500, "advance": 1000}},
    ).get_json()["data"]
    # net follows the new deductions: 45000 - 3000 = 42000
    assert updated["net_salary"] == 42000.0
    assert updated["gross_salary"] == 45000.0

    # Unrelated updates never touch stored money.
    untouched = client.put(
        f"/api/v1/hr/payroll/{created['id']}",
        headers=headers,
        json={"notes": "no money change"},
    ).get_json()["data"]
    assert untouched["net_salary"] == 42000.0
    assert untouched["gross_salary"] == 45000.0


def test_serializer_falls_back_to_computed_totals(db, school, admin_user):
    """Records with components but no stored totals report computed values."""
    staff = _staff(db, school)
    record = StaffPayroll(
        school_id=school.id,
        user_id=staff.id,
        month="2082-08",
        basic_salary=40000,
        allowances={"transport": 3000, "dearness": 2000},
        deductions={"pf": 1500, "insurance": 500},
        status="draft",
    )
    db.session.add(record)
    db.session.commit()

    data = _payroll_dict(record)
    assert data["gross_salary"] == 45000.0
    assert data["net_salary"] == 43000.0


def test_payslip_pdf_generates_for_record_without_stored_totals(
    client, db, school, admin_user
):
    _install_hr_plugin(db, school)
    staff = _staff(db, school)
    headers = _login(client)

    created = client.post(
        "/api/v1/hr/payroll",
        headers=headers,
        json={
            "user_id": str(staff.id),
            "month": "2082-09",
            "basic_salary": 40000,
            "allowances": {"transport": 3000},
            "deductions": {"pf": 1500},
        },
    ).get_json()["data"]

    resp = client.get(f"/api/v1/hr/payroll/{created['id']}/payslip", headers=headers)
    assert resp.status_code == 200
    assert resp.mimetype == "application/pdf"
    assert resp.data[:5] == b"%PDF-"


def test_explicit_gross_with_derived_net_stays_consistent(client, db, school, admin_user):
    """When a client supplies gross but not net, the stored net must equal
    the stored gross − Σdeductions (net = gross − Σdeductions invariant)."""
    _install_hr_plugin(db, school)
    staff = _staff(db, school)
    headers = _login(client)

    created = client.post(
        "/api/v1/hr/payroll",
        headers=headers,
        json={
            "user_id": str(staff.id),
            "month": "2082-10",
            "basic_salary": 40000,
            "allowances": {"transport": 3000, "dearness": 2000},
            "deductions": {"pf": 1500, "insurance": 500},
            "gross_salary": 46000,  # client's own view; components sum to 45000
        },
    ).get_json()["data"]
    assert created["gross_salary"] == 46000.0
    assert created["net_salary"] == 44000.0  # 46000 − 2000, NOT 45000 − 2000

    fetched = client.get(
        "/api/v1/hr/payroll", headers=headers, query_string={"month": "2082-10"}
    ).get_json()["data"][0]
    assert fetched["gross_salary"] == 46000.0
    assert fetched["net_salary"] == 44000.0


def test_serializer_net_fallback_uses_stored_gross(db, school, admin_user):
    """Legacy row (gross stored, net NULL): reported net = stored gross −
    Σdeductions, matching the payslip fallback — not the component gross."""
    staff = _staff(db, school)
    record = StaffPayroll(
        school_id=school.id,
        user_id=staff.id,
        month="2082-11",
        basic_salary=40000,
        allowances={"transport": 3000, "dearness": 2000},
        deductions={"pf": 1500, "insurance": 500},
        gross_salary=46000,
        net_salary=None,
        status="draft",
    )
    db.session.add(record)
    db.session.commit()

    data = _payroll_dict(record)
    assert data["gross_salary"] == 46000.0
    assert data["net_salary"] == 44000.0  # 46000 − 2000; component math would say 43000


def test_payslip_pdf_numbers_dump_for_pdftotext(client, db, school, admin_user):
    """Mandate fixture: base + 2 allowances + 2 deductions (+ a percent-style
    value that must be skipped). Dumps the payslip PDF to /tmp/payslip_verify.pdf
    so the host can pdftotext-verify: gross 45,000.00 / net 43,000.00."""
    _install_hr_plugin(db, school)
    staff = _staff(db, school)
    headers = _login(client)

    created = client.post(
        "/api/v1/hr/payroll",
        headers=headers,
        json={
            "user_id": str(staff.id),
            "month": "2082-12",
            "basic_salary": 40000,
            "allowances": {"transport": 3000, "dearness": 2000},
            "deductions": {"pf": 1500, "insurance": 500, "tax_percent": "10%"},
        },
    ).get_json()["data"]
    # "10%" is not a numeric component: totals ignore it.
    assert created["allowances_total"] == 5000.0
    assert created["deductions_total"] == 2000.0
    assert created["gross_salary"] == 45000.0
    assert created["net_salary"] == 43000.0

    resp = client.get(f"/api/v1/hr/payroll/{created['id']}/payslip", headers=headers)
    assert resp.status_code == 200
    assert resp.data[:5] == b"%PDF-"
    with open("/tmp/payslip_verify.pdf", "wb") as fh:
        fh.write(resp.data)
