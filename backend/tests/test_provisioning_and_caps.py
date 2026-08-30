"""Regression tests for three backend correctness fixes (2026-08-28).

1. IEMIS import must NOT create User(phone=None) — users.phone is NOT NULL;
   a deterministic 9800000xxxx placeholder is generated instead and the user
   is marked via permissions["placeholder_phone"].
2. The admission.accepted auto-enrollment listener respects the
   School.max_students plan cap (E2) — no student row is created beyond it.
3. School registration provisions the per-school AI token quota row
   (AITokenHub._check_quota treats a missing row as blocked, not unlimited).
"""
import re

from app.api.v1.iemis_importer import _import_students, _placeholder_phone
from app.models.admission import AdmissionApplication
from app.models.ai_token import AISchoolQuota
from app.models.student import Student
from app.models.user import User
from app.plugins import listeners  # noqa: F401 — registers @on() handlers
from app.plugins.events import emit
from extensions import db


# ── 1. IEMIS import placeholder phone ────────────────────────────────────────


def test_iemis_student_import_without_phone_creates_usable_user(db, school):
    """A row with no contact number must still produce a User row (phone is
    NOT NULL) with a valid 9800000xxxx placeholder."""
    result = _import_students(
        [{"full_name": "Ram Bahadur Thapa", "grade": "5"}], school.id, dry_run=False
    )
    assert result["imported"] == 1, result["error_list"]
    assert result["errors"] == 0

    user = User.query.filter_by(school_id=school.id, role="student").first()
    assert user is not None
    assert user.phone, "users.phone must never be None after import"
    assert re.fullmatch(r"9800000\d{4}", user.phone)
    assert (user.permissions or {}).get("placeholder_phone") is True
    assert user.phone_verified is False
    student = Student.query.filter_by(user_id=user.id, is_deleted=False).first()
    assert student is not None
    assert student.first_name == "Ram Bahadur"
    assert student.last_name == "Thapa"


def test_placeholder_phone_is_deterministic_and_in_reserved_block(db, school):
    first = _placeholder_phone(school.id, "stud:123:Hari Sharma")
    second = _placeholder_phone(school.id, "stud:123:Hari Sharma")
    other = _placeholder_phone(school.id, "stud:456:Sita Sharma")
    assert first == second  # deterministic → re-imports stay idempotent
    assert re.fullmatch(r"9800000\d{4}", first)
    assert first != other  # distinct source rows get distinct numbers


def test_placeholder_phone_avoids_existing_number(db, school):
    from extensions import db as _db

    occupied = _placeholder_phone(school.id, "stud:999:Predetermined Row")
    taken = User(
        school_id=school.id,
        role="parent",
        full_name="Phone Holder",
        phone=occupied,
    )
    _db.session.add(taken)
    _db.session.commit()

    # Same source key now yields a DIFFERENT (bumped) free number
    fresh = _placeholder_phone(school.id, "stud:999:Predetermined Row")
    assert fresh != occupied
    assert re.fullmatch(r"9800000\d{4}", fresh)


# ── 2. Admission auto-enrollment student cap ─────────────────────────────────


def _make_application(school_id, student_name, phone="9807777666"):
    app_obj = AdmissionApplication(
        school_id=school_id,
        student_name=student_name,
        parent_phone=phone,
        status="accepted",
    )
    db.session.add(app_obj)
    db.session.commit()
    return app_obj


def test_admission_auto_enrollment_blocked_at_cap(db, school):
    school.max_students = 1
    db.session.commit()

    # One student already enrolled → cap of 1 is full.
    db.session.add(
        Student(school_id=school.id, first_name="Existing", last_name="Kid")
    )
    db.session.commit()

    app_obj = _make_application(school.id, "Blocked Kid")
    emit("admission.accepted", school_id=school.id, application_id=str(app_obj.id))

    students = Student.query.filter_by(school_id=school.id, is_deleted=False).all()
    assert len(students) == 1  # the pre-existing one only
    assert (
        User.query.filter(User.school_id == school.id, User.full_name == "Blocked Kid").first()
        is None
    )


def test_admission_auto_enrollment_allowed_within_cap(db, school):
    school.max_students = 1  # 0 enrolled so far → exactly one seat left
    db.session.commit()

    app_obj = _make_application(school.id, "Cap Ok Kid")
    emit("admission.accepted", school_id=school.id, application_id=str(app_obj.id))

    student = (
        Student.query.filter_by(school_id=school.id, is_deleted=False)
        .filter(Student.first_name == "Cap")
        .first()
    )
    assert student is not None, "admission listener should auto-create the student"
    user = User.query.get(student.user_id)
    assert user is not None
    assert user.phone, "auto-created user must satisfy the NOT NULL phone column"


# ── 3. Registration provisions the AI token quota ────────────────────────────


def test_registration_provisions_ai_quota(client, db, app):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "school_name": "Quota Provision Academy",
            "full_name": "Quota Admin",
            "phone": "9812345678",
            "password": "Str0ngPass",
            "plan": "free",
        },
    )
    assert resp.status_code == 201, resp.get_json()
    school_id = resp.get_json()["data"]["school"]["id"]

    quota = AISchoolQuota.query.filter_by(school_id=school_id).first()
    assert quota is not None, "registration must provision the AI quota row"
    assert quota.is_active is True
    assert quota.daily_limit == app.config["AI_DEFAULT_DAILY_LIMIT"]
    assert quota.monthly_limit == app.config["AI_DEFAULT_MONTHLY_LIMIT"]
