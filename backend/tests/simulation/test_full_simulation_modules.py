"""ASchool end-to-end simulation suite mapped to Modules 1-15.

These tests intentionally assert the security and tenant-isolation expectations from
simulate.md. Failing tests are treated as actionable findings.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from app.models.academic import Class, Subject
from app.models.fee import FeeCollection
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from app.services.auth_service import AuthService
from extensions import cache
from extensions import db as _db


REQUIRED_PLUGIN_SLUGS = [
    "attendance",
    "notices",
    "fees",
    "basic_website",
    "gps_tracking",
    "library_management",
    "exams",
    "iemis_importer",
]


def _seed_plugin_rows(db, slugs: list[str]) -> None:
    for slug in slugs:
        if Plugin.query.filter_by(slug=slug).first():
            continue
        db.session.add(
            Plugin(
                slug=slug,
                name=slug.replace("_", " ").title(),
                category="core",
                price_monthly=0,
                price_yearly=0,
                is_free=True,
                is_published=True,
                version="1.0.0",
            )
        )


def _install_plugins_for_school(db, school: School, slugs: list[str]) -> None:
    for slug in slugs:
        existing = SchoolPlugin.query.filter_by(
            school_id=school.id,
            plugin_slug=slug,
        ).first()
        if existing:
            continue
        db.session.add(
            SchoolPlugin(
                school_id=school.id,
                plugin_slug=slug,
                active=True,
                is_trial=False,
            )
        )


def _make_user(
    db,
    *,
    school: School,
    role: str,
    full_name: str,
    phone: str,
    email: str | None = None,
    password: str = "Test@1234",
) -> User:
    user = User(
        school_id=school.id,
        role=role,
        full_name=full_name,
        phone=phone,
        email=email,
        is_active=True,
        phone_verified=True,
    )
    user.set_password(password)
    db.session.add(user)
    return user


def _auth_headers(user: User) -> dict[str, str]:
    token = AuthService.create_tokens(user)["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sim_env(db):
    # Schools
    alpha = School(
        name="Shree Janajyoti Secondary School",
        slug="school-alpha",
        plan="growth",
        status="active",
        is_active=True,
        phone="+9779800001001",
        email="alpha-admin@example.com",
        district="Kathmandu",
    )
    beta = School(
        name="Everest Model Academy",
        slug="school-beta",
        plan="growth",
        status="active",
        is_active=True,
        phone="+9779800001002",
        email="beta-admin@example.com",
        district="Lalitpur",
    )
    gamma = School(
        name="Gandaki Scholars School",
        slug="school-gamma",
        plan="starter",
        status="active",
        is_active=True,
        phone="+9779800001003",
        email="gamma-admin@example.com",
        district="Pokhara",
    )
    db.session.add_all([alpha, beta, gamma])
    db.session.flush()

    # Plugin registry + install
    _seed_plugin_rows(db, REQUIRED_PLUGIN_SLUGS)
    db.session.flush()
    for school in (alpha, beta, gamma):
        _install_plugins_for_school(db, school, REQUIRED_PLUGIN_SLUGS)

    # Users across role matrix
    alpha_admin = _make_user(
        db,
        school=alpha,
        role="school_admin",
        full_name="Alpha Admin",
        phone="+9779841001001",
        email="alpha-admin@example.com",
    )
    beta_admin = _make_user(
        db,
        school=beta,
        role="school_admin",
        full_name="Beta Admin",
        phone="+9779841001002",
        email="beta-admin@example.com",
    )
    alpha_teacher = _make_user(
        db,
        school=alpha,
        role="teacher",
        full_name="Alpha Teacher",
        phone="+9779841001003",
    )
    alpha_student_user = _make_user(
        db,
        school=alpha,
        role="student",
        full_name="Sita Student",
        phone="+9779841001004",
    )
    alpha_parent = _make_user(
        db,
        school=alpha,
        role="parent",
        full_name="Maya Guardian",
        phone="+9779841001005",
    )

    # Academic baseline
    class_alpha = Class(school_id=alpha.id, name="Class 10", numeric_grade=10, sort_order=10)
    class_beta = Class(school_id=beta.id, name="Class 10", numeric_grade=10, sort_order=10)
    db.session.add_all([class_alpha, class_beta])
    db.session.flush()

    # Subjects for cross-tenant assignment checks
    beta_subject = Subject(
        school_id=beta.id,
        name="Science",
        code="SCI-10",
        class_ids=[class_beta.id],
    )
    db.session.add(beta_subject)

    # Students for attendance/hostel/fees flows
    student_alpha = Student(
        school_id=alpha.id,
        first_name="Sita",
        last_name="Thapa",
        class_id=class_alpha.id,
        roll_number=1,
    )
    student_alpha_2 = Student(
        school_id=alpha.id,
        first_name="Ram",
        last_name="Shrestha",
        class_id=class_alpha.id,
        roll_number=2,
    )
    db.session.add_all([student_alpha, student_alpha_2])
    db.session.flush()

    fee_collection_alpha = FeeCollection(
        school_id=alpha.id,
        student_id=student_alpha.id,
        fee_item_name="Tuition Fee",
        amount=2500,
        payment_status="pending",
    )
    db.session.add(fee_collection_alpha)
    db.session.commit()

    # Clear plugin caches for this request lifecycle.
    for school in (alpha, beta, gamma):
        cache.delete(f"school:{school.id}:plugins")

    return {
        "alpha": alpha,
        "beta": beta,
        "gamma": gamma,
        "alpha_admin": alpha_admin,
        "beta_admin": beta_admin,
        "alpha_teacher": alpha_teacher,
        "alpha_student_user": alpha_student_user,
        "alpha_parent": alpha_parent,
        "class_alpha": class_alpha,
        "class_beta": class_beta,
        "beta_subject": beta_subject,
        "student_alpha": student_alpha,
        "student_alpha_2": student_alpha_2,
        "fee_collection_alpha": fee_collection_alpha,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Module 1 — Tenant & School Setup
# ──────────────────────────────────────────────────────────────────────────────

def test_module_01_register_three_schools_with_realistic_data(client, monkeypatch):
    monkeypatch.setattr("app.services.auth_service.send_sms.delay", lambda *args, **kwargs: None)

    payloads = [
        {
            "school_name": "Shree Balmiki Secondary School",
            "full_name": "Rita Adhikari",
            "phone": "+9779842001001",
            "password": "StrongPass@123",
            "district": "Kathmandu",
            "municipality": "Tokha",
            "plan": "pro",
        },
        {
            "school_name": "Prabhat Kiran Academy",
            "full_name": "Suman Bista",
            "phone": "+9779842001002",
            "password": "StrongPass@123",
            "district": "Bhaktapur",
            "municipality": "Madhyapur Thimi",
            "plan": "starter",
        },
        {
            "school_name": "Himalayan Future School",
            "full_name": "Nabin Karki",
            "phone": "+9779842001003",
            "password": "StrongPass@123",
            "district": "Pokhara",
            "municipality": "Pokhara",
            "plan": "free",
        },
    ]

    seen_school_ids = set()
    for payload in payloads:
        resp = client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 201
        data = resp.get_json()["data"]
        school = data["school"]
        assert school["id"] not in seen_school_ids
        seen_school_ids.add(school["id"])
        assert school["slug"]


def test_sec_01_cross_tenant_put_school_must_be_403(client, sim_env):
    # Clear any prior failed transaction state before asserting auth behavior.
    _db.session.rollback()
    headers = _auth_headers(sim_env["alpha_admin"])
    resp = client.put(
        f"/api/v1/schools/{sim_env['beta'].id}",
        json={"name": "Compromised Beta"},
        headers=headers,
    )
    assert resp.status_code == 403


def test_sec_02_cross_tenant_get_school_must_be_403(client, sim_env):
    headers = _auth_headers(sim_env["alpha_admin"])
    resp = client.get(f"/api/v1/schools/{sim_env['beta'].id}", headers=headers)
    assert resp.status_code == 403


def test_sec_04_custom_css_script_injection_rejected_or_sanitized(client, sim_env):
    headers = _auth_headers(sim_env["alpha_admin"])
    payload = {"custom_css": "</style><script>alert('xss')</script>"}

    update = client.put("/api/v1/website/config", json=payload, headers=headers)
    assert update.status_code in (400, 422, 200)

    if update.status_code == 200:
        cfg = client.get("/api/v1/website/config", headers=headers)
        assert cfg.status_code == 200
        custom_css = (cfg.get_json()["data"].get("custom_css") or "").lower()
        assert "<script" not in custom_css
        assert "</style>" not in custom_css


# ──────────────────────────────────────────────────────────────────────────────
# Module 2 — User Management
# ──────────────────────────────────────────────────────────────────────────────

def test_module_02_role_matrix_teacher_student_parent_cannot_create_class(client, sim_env):
    restricted_users = [
        sim_env["alpha_teacher"],
        sim_env["alpha_student_user"],
        sim_env["alpha_parent"],
    ]
    for user in restricted_users:
        resp = client.post(
            "/api/v1/academics/classes",
            json={"name": "Class 9"},
            headers=_auth_headers(user),
        )
        assert resp.status_code == 403


def test_sec_05_register_response_hides_dev_otp_in_testing(client, monkeypatch):
    monkeypatch.setattr("app.services.auth_service.send_sms.delay", lambda *args, **kwargs: None)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "school_name": "OTP Privacy School",
            "full_name": "Hari Rana",
            "phone": "+9779842111101",
            "password": "StrongPass@123",
        },
    )
    assert resp.status_code == 201
    payload = resp.get_json()["data"]
    assert "dev_otp" not in payload


def test_module_02_otp_repeat_request_rate_limited(client, monkeypatch):
    monkeypatch.setattr("app.services.auth_service.send_sms.delay", lambda *args, **kwargs: None)
    phone = "+9779842111102"

    first = client.post("/api/v1/auth/send-otp", json={"phone": phone})
    second = client.post("/api/v1/auth/send-otp", json={"phone": phone})

    assert first.status_code == 200
    assert second.status_code in (400, 429)


def test_module_02_duplicate_roll_number_within_class_rejected(client, sim_env):
    headers = _auth_headers(sim_env["alpha_admin"])
    class_id = str(sim_env["class_alpha"].id)

    first = client.post(
        "/api/v1/students",
        headers=headers,
        json={
            "first_name": "Anish",
            "last_name": "KC",
            "class_id": class_id,
            "roll_number": 15,
            "phone": "+9779842333301",
        },
    )
    second = client.post(
        "/api/v1/students",
        headers=headers,
        json={
            "first_name": "Bipana",
            "last_name": "Lama",
            "class_id": class_id,
            "roll_number": 15,
            "phone": "+9779842333302",
        },
    )

    assert first.status_code in (200, 201)
    assert second.status_code in (400, 409)


# ──────────────────────────────────────────────────────────────────────────────
# Module 3 — Academic Structure
# ──────────────────────────────────────────────────────────────────────────────

def test_module_03_create_class_and_section_and_teacher_forbidden_delete(client, sim_env):
    admin_headers = _auth_headers(sim_env["alpha_admin"])

    created_class = client.post(
        "/api/v1/academics/classes",
        headers=admin_headers,
        json={"name": "Class 5", "numeric_grade": 5, "sort_order": 5},
    )
    assert created_class.status_code == 201
    class_id = created_class.get_json()["data"]["id"]

    created_section = client.post(
        f"/api/v1/academics/classes/{class_id}/sections",
        headers=admin_headers,
        json={"name": "A", "capacity": 40},
    )
    assert created_section.status_code == 201

    teacher_headers = _auth_headers(sim_env["alpha_teacher"])
    delete_attempt = client.delete(
        f"/api/v1/academics/classes/{class_id}",
        headers=teacher_headers,
    )
    assert delete_attempt.status_code == 403


def test_module_03_cross_tenant_subject_assignment_must_be_403(client, sim_env):
    alpha_headers = _auth_headers(sim_env["alpha_admin"])
    resp = client.post(
        f"/api/v1/academics/classes/{sim_env['class_alpha'].id}/subjects",
        headers=alpha_headers,
        json={"subject_id": str(sim_env["beta_subject"].id)},
    )
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Module 4 — Attendance
# ──────────────────────────────────────────────────────────────────────────────

def test_module_04_attendance_submit_and_teacher_scope_enforced(client, sim_env):
    admin_headers = _auth_headers(sim_env["alpha_admin"])
    student_id = str(sim_env["student_alpha"].id)
    class_id = str(sim_env["class_alpha"].id)

    first = client.post(
        "/api/v1/attendance/mark",
        headers=admin_headers,
        json={
            "class_id": class_id,
            "records": [{"student_id": student_id, "status": "present"}],
        },
    )
    second = client.post(
        "/api/v1/attendance/mark",
        headers=admin_headers,
        json={
            "class_id": class_id,
            "records": [{"student_id": student_id, "status": "late"}],
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200

    records = client.get(
        f"/api/v1/attendance/student/{student_id}",
        headers=admin_headers,
    )
    assert records.status_code == 200
    data = records.get_json()["data"]
    assert len(data) == 1

    teacher_headers = _auth_headers(sim_env["alpha_teacher"])
    blocked = client.post(
        "/api/v1/attendance/mark",
        headers=teacher_headers,
        json={
            "class_id": class_id,
            "records": [{"student_id": student_id, "status": "present"}],
        },
    )
    assert blocked.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Module 5 — Examinations & Results
# ──────────────────────────────────────────────────────────────────────────────

def test_sec_03_notice_xss_payload_rejected_or_sanitized(client, sim_env):
    headers = _auth_headers(sim_env["alpha_teacher"])
    payload = {
        "title": "Exam Notice",
        "content": "<img src=x onerror=alert(1)>",
        "target_roles": ["student"],
    }
    created = client.post("/api/v1/notices", headers=headers, json=payload)
    assert created.status_code in (400, 422, 201)

    if created.status_code == 201:
        notice_id = created.get_json()["data"]["id"]
        read_back = client.get(f"/api/v1/notices/{notice_id}", headers=headers)
        assert read_back.status_code == 200
        content = (read_back.get_json()["data"].get("content") or "").lower()
        assert "onerror" not in content
        assert "<script" not in content


# ──────────────────────────────────────────────────────────────────────────────
# Module 6 — Fees & Billing
# ──────────────────────────────────────────────────────────────────────────────

def test_module_06_cross_tenant_billing_probe_must_be_403(client, sim_env):
    beta_headers = _auth_headers(sim_env["beta_admin"])
    collection_id = sim_env["fee_collection_alpha"].id
    resp = client.post(
        f"/api/v1/fees/collections/{collection_id}/pay",
        headers=beta_headers,
        json={"amount": 100, "payment_method": "cash"},
    )
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Module 7 — Communication
# ──────────────────────────────────────────────────────────────────────────────

def test_module_07_student_cannot_create_notice(client, sim_env):
    student_headers = _auth_headers(sim_env["alpha_student_user"])
    resp = client.post(
        "/api/v1/notices",
        headers=student_headers,
        json={"title": "Hello", "content": "World"},
    )
    assert resp.status_code == 403


def test_sec_08_whatsapp_verify_uses_constant_time_compare():
    source = Path(__file__).resolve().parents[2] / "app" / "api" / "webhooks" / "__init__.py"
    code = source.read_text(encoding="utf-8")
    assert "hmac.compare_digest(" in code
    assert "token == verify_token" not in code


# ──────────────────────────────────────────────────────────────────────────────
# Module 8 — Library
# ──────────────────────────────────────────────────────────────────────────────

def test_module_08_issue_rejected_when_no_available_copies(client, sim_env):
    admin_headers = _auth_headers(sim_env["alpha_admin"])
    teacher_headers = _auth_headers(sim_env["alpha_teacher"])

    created_book = client.post(
        "/api/v1/library/books",
        headers=admin_headers,
        json={
            "title": "Nepal Social Studies",
            "author": "CDC",
            "isbn": "9789999999990",
            "total_copies": 1,
            "available_copies": 0,
            "category": "Textbook",
        },
    )
    assert created_book.status_code == 201
    book_id = created_book.get_json()["data"]["id"]

    issue = client.post(
        "/api/v1/library/issues",
        headers=teacher_headers,
        json={
            "book_id": book_id,
            "student_id": str(sim_env["student_alpha"].id),
        },
    )
    assert issue.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# Module 9 — Transport
# ──────────────────────────────────────────────────────────────────────────────

def test_module_09_transport_route_creation_role_enforced(client, sim_env):
    admin_headers = _auth_headers(sim_env["alpha_admin"])
    student_headers = _auth_headers(sim_env["alpha_student_user"])

    ok = client.post(
        "/api/v1/transport/routes",
        headers=admin_headers,
        json={"name": "Route A", "distance_km": 12.5},
    )
    assert ok.status_code == 201

    denied = client.post(
        "/api/v1/transport/routes",
        headers=student_headers,
        json={"name": "Route B"},
    )
    assert denied.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Module 10 — Hostel
# ──────────────────────────────────────────────────────────────────────────────

def test_module_10_hostel_over_allocation_rejected(client, sim_env):
    headers = _auth_headers(sim_env["alpha_admin"])

    hostel = client.post(
        "/api/v1/hostel",
        headers=headers,
        json={"name": "Boys Hostel", "type": "boys", "total_capacity": 1},
    )
    assert hostel.status_code == 201
    hostel_id = hostel.get_json()["data"]["id"]

    room = client.post(
        "/api/v1/hostel/rooms",
        headers=headers,
        json={"hostel_id": hostel_id, "room_number": "101", "capacity": 1},
    )
    assert room.status_code == 201
    room_id = room.get_json()["data"]["id"]

    first = client.post(
        "/api/v1/hostel/allocations",
        headers=headers,
        json={
            "room_id": room_id,
            "student_id": str(sim_env["student_alpha"].id),
            "check_in_date": "2026-05-19",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/hostel/allocations",
        headers=headers,
        json={
            "room_id": room_id,
            "student_id": str(sim_env["student_alpha_2"].id),
            "check_in_date": "2026-05-19",
        },
    )
    assert second.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# Module 11 — Online Examination
# ──────────────────────────────────────────────────────────────────────────────

def test_module_11_online_exam_xss_and_schedule_enforced(client, sim_env):
    headers = _auth_headers(sim_env["alpha_admin"])
    payload = {
        "title": "Unit Test",
        "class_id": str(sim_env["class_alpha"].id),
        "duration_minutes": 60,
        "questions": [
            {
                "id": "q1",
                "type": "mcq",
                "question": "<script>alert(1)</script>",
                "options": ["A", "B", "C", "D"],
                "answer": "A",
                "marks": 1,
            }
        ],
        "start_at": "2099-01-01T10:00:00Z",
        "end_at": "2099-01-01T11:00:00Z",
    }
    created = client.post("/api/v1/exams/online", headers=headers, json=payload)
    assert created.status_code in (400, 422, 201)

    if created.status_code == 201:
        exam_data = created.get_json()["data"]
        questions = exam_data.get("questions") or []
        joined = str(questions).lower()
        assert "<script" not in joined

        submit = client.post(
            f"/api/v1/exams/online/{exam_data['id']}/submit",
            headers=_auth_headers(sim_env["alpha_student_user"]),
            json={
                "student_id": str(sim_env["student_alpha"].id),
                "answers": {"q1": "A"},
            },
        )
        assert submit.status_code in (400, 403)


# ──────────────────────────────────────────────────────────────────────────────
# Module 12 — Data Import / Export
# ──────────────────────────────────────────────────────────────────────────────

def test_module_12_import_export_endpoints_fail_safely(client, sim_env):
    headers = _auth_headers(sim_env["alpha_admin"])

    import_without_file = client.post("/api/v1/iemis/import", headers=headers)
    assert import_without_file.status_code == 400

    random_receipt = uuid.uuid4()
    export_probe = client.get(f"/api/v1/fees/receipts/{random_receipt}/pdf", headers=headers)
    assert export_probe.status_code in (404, 501)


# ──────────────────────────────────────────────────────────────────────────────
# Module 13 — Public School Website
# ──────────────────────────────────────────────────────────────────────────────

def test_module_13_public_school_page_loads(client, sim_env):
    resp = client.get(f"/api/v1/website/public/{sim_env['alpha'].slug}")
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data.get("school", {}).get("slug") == sim_env["alpha"].slug
