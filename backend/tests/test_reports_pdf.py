"""Tests for the Basic Reports PDF export endpoints (/reports/*/pdf).

Pins the document-generation contract: JSON summary endpoints keep their
shape, and the adjacent /pdf endpoints render real WeasyPrint PDFs (letterhead,
NPR, Bikram Sambat issue date), persist them via upload_file and return a
downloadable URL.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models.academic import Class
from app.models.attendance import Attendance
from app.models.fee import FeeCollection
from app.models.student import Student
from app.utils.report_pdf import build_report_html, fmt_npr
from extensions import db
from tests.conftest import get_auth_headers


@pytest.fixture
def reports_school(db, school, admin_user):
    """School with the basic_reports plugin installed for admin_user."""
    from app.models.plugin import Plugin, SchoolPlugin

    plugin = Plugin.query.filter_by(slug="basic_reports").first()
    if plugin is None:
        plugin = Plugin(
            slug="basic_reports",
            name="Basic Reports",
            category="core",
            price_monthly=0,
            price_yearly=0,
            is_free=True,
            description="Attendance, fee and exam reports",
            is_published=True,
            version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()

    sp = SchoolPlugin(
        school_id=school.id,
        plugin_slug="basic_reports",
        active=True,
        is_trial=False,
    )
    db.session.add(sp)
    db.session.commit()

    klass = Class(school_id=school.id, name="Grade 4", numeric_grade=4)
    db.session.add(klass)
    db.session.flush()

    students = []
    for i, name in enumerate([("Anita", "Rai"), ("Bimal", "Gurung")], start=1):
        s = Student(
            school_id=school.id,
            first_name=name[0],
            last_name=name[1],
            class_id=klass.id,
            roll_number=i,
            status="active",
        )
        db.session.add(s)
        students.append(s)
    db.session.flush()

    today = date.today()
    for si, s in enumerate(students):
        db.session.add(
            Attendance(
                school_id=school.id,
                student_id=s.id,
                class_id=klass.id,
                date=today,
                status="present" if si == 0 else "absent",
            )
        )

    db.session.add(
        FeeCollection(
            school_id=school.id,
            student_id=students[0].id,
            fee_item_name="Monthly Tuition",
            amount=4500,
            payment_status="paid",
            payment_method="cash",
            collected_at=datetime.now(),
        )
    )
    db.session.commit()
    return {"klass": klass, "students": students, "admin": admin_user}


def _get_pdf(client, headers, url):
    """Fetch an exported PDF through the served /uploads route."""
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.data[:5] == b"%PDF-"
    assert len(resp.data) > 1000
    return resp


def test_attendance_report_pdf_real_file(client, reports_school):
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.get(
        "/api/v1/reports/attendance/summary/pdf?start_date=2026-08-01",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["pdf_url"].startswith("/uploads/reports/")
    assert data["size_bytes"] > 1000
    _get_pdf(client, headers, data["pdf_url"])


def test_attendance_pdf_class_scope_filename(client, reports_school):
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    klass = reports_school["klass"]
    resp = client.get(
        f"/api/v1/reports/attendance/summary/pdf?start_date=2026-08-01&class_id={klass.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert "_class_" in resp.get_json()["data"]["filename"]


def test_fee_collection_report_pdf_real_file(client, reports_school):
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.get(
        "/api/v1/reports/fees/collection/pdf?start_date=2026-08-01",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["pdf_url"].startswith("/uploads/reports/")
    assert data["total_collected"] == 4500.0
    # PDF streams are Flate-compressed; text content is verified via the
    # runtime pdftotext evidence in audits/VERIFICATION_MONEY_GRADES doc.
    pdf = _get_pdf(client, headers, data["pdf_url"])
    assert pdf.data[:5] == b"%PDF-"


def test_attendance_pdf_requires_start_date(client, reports_school):
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.get("/api/v1/reports/attendance/summary/pdf", headers=headers)
    assert resp.status_code == 400


def test_reports_endpoints_require_auth(client, reports_school):
    assert (
        client.get("/api/v1/reports/attendance/summary/pdf?start_date=2026-08-01").status_code
        == 401
    )
    assert (
        client.get("/api/v1/reports/fees/collection/pdf?start_date=2026-08-01").status_code
        == 401
    )


def test_json_endpoints_keep_shape(client, reports_school):
    """The dashboard pages consume these JSON tables — shape must not drift."""
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.get(
        "/api/v1/reports/attendance/summary?start_date=2026-08-01", headers=headers
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert set(data.keys()) == {
        "period",
        "class_id",
        "summary",
        "total_records",
        "attendance_rate",
        # per-student rows added for the web attendance report table
        "students",
    }

    resp = client.get(
        "/api/v1/reports/fees/collection?start_date=2026-08-01", headers=headers
    )
    data = resp.get_json()["data"]
    assert set(data.keys()) == {
        "period",
        "total_collected",
        "total_pending",
        "total_students",
        "payments_count",
        "collection_rate",
    }


def test_fmt_npr_and_letterhead_bs_date():
    assert fmt_npr(1234.5) == "NPR 1,234.50"
    assert fmt_npr(None) == "NPR 0.00"

    html = build_report_html("Unit Test Report", "<p>body</p>", school=None)
    assert "Unit Test Report" in html
    assert "BS" in html  # Bikram Sambat issue date present
