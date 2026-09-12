"""S-A5 admission funnel service (A-09) — staging → review → convert.

The InfixEdu ParentRegistration pipeline and InstiKit's seat model, rebuilt:
  - public submission lands in `admission_registrations` (staging, no
    accounts created);
  - admin review approves/rejects with notes;
  - conversion provisions guardian account + student + application inside
    ONE transaction, gated by a FOR-UPDATE seat cap (`enrollment_seats`) —
    the cap InstiKit displayed but never enforced.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


def registration_number_for(school) -> str:
    """REG-<slug4>-<seq> — per-school sequence via count (documented race
    tolerance: the number is informational, the row id is the key)."""
    from app.models.admission import AdmissionRegistration

    slug4 = (school.slug or "sch").replace("-", "")[:4].upper()
    count = AdmissionRegistration.query.filter(
        AdmissionRegistration.school_id == school.id,
        AdmissionRegistration.is_deleted.is_(False),
    ).count()
    return f"REG-{slug4}-{count + 1:05d}"


def submit_public_registration(school, data: dict) -> dict:
    """Public, unauthenticated entry point. Duplicate guard: same guardian
    phone + student first name at the same school inside 24 h → ValueError."""
    from app.models.admission import AdmissionRegistration

    phone = str(data.get("guardian_phone") or "").strip()
    first = str(data.get("student_first_name") or "").strip()
    if not phone or not first:
        raise ValueError("guardian_phone and student_first_name are required")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    duplicate = AdmissionRegistration.query.filter(
        AdmissionRegistration.school_id == school.id,
        AdmissionRegistration.guardian_phone == phone,
        AdmissionRegistration.student_first_name == first,
        AdmissionRegistration.created_at > cutoff,
        AdmissionRegistration.is_deleted.is_(False),
    ).first()
    if duplicate is not None:
        raise DuplicateRegistrationError()

    from app.models.academic import Class

    applied_class_id = data.get("applied_class_id")
    if applied_class_id:
        klass = Class.query.filter_by(
            id=applied_class_id, school_id=school.id, is_deleted=False
        ).first()
        if klass is None:
            raise ValueError("applied_class_id does not match this school")
        applied_class_id = klass.id

    reg = AdmissionRegistration(
        school_id=school.id,
        student_first_name=first[:120],
        student_last_name=str(data.get("student_last_name") or "").strip()[:120] or None,
        student_dob_bs=str(data.get("student_dob_bs") or "").strip()[:10] or None,
        gender=str(data.get("gender") or "").strip()[:20] or None,
        guardian_name=str(data.get("guardian_name") or "").strip()[:200],
        guardian_relation=str(data.get("guardian_relation") or "").strip()[:30] or None,
        guardian_phone=phone[:20],
        guardian_email=str(data.get("guardian_email") or "").strip()[:200] or None,
        previous_school=str(data.get("previous_school") or "").strip()[:200] or None,
        applied_class_id=applied_class_id,
        documents=data.get("documents") if isinstance(data.get("documents"), list) else [],
        dynamic_fields=data.get("dynamic_fields") if isinstance(data.get("dynamic_fields"), dict) else {},
        status="submitted",
        registration_number=registration_number_for(school),
        verification_token=secrets.token_urlsafe(24),
        source=str(data.get("source") or "public")[:30],
    )
    return reg


def seat_state(school_id, class_id, academic_year_id=None) -> dict:
    """(max_seat, booked, remaining) for one class+year — booked counts the
    ACTIVE students already in the class (the live truth, not a counter)."""
    from app.models.academic import Class
    from app.models.student import Student
    from app.models.admission import EnrollmentSeatCap

    cap_row = None
    if EnrollmentSeatCap is not None:
        cap_row = EnrollmentSeatCap.query.filter(
            EnrollmentSeatCap.school_id == school_id,
            EnrollmentSeatCap.class_id == class_id,
            EnrollmentSeatCap.academic_year_id == academic_year_id,
            EnrollmentSeatCap.is_deleted.is_(False),
        ).with_for_update().first()
    booked = Student.query.filter(
        Student.school_id == school_id,
        Student.class_id == class_id,
        Student.is_deleted.is_(False),
        Student.status == "active",
    ).count()
    max_seat = int(cap_row.max_seat) if cap_row is not None else None
    remaining = (max_seat - booked) if max_seat is not None else None
    return {"max_seat": max_seat, "booked": booked, "remaining": remaining}


class DuplicateRegistrationError(Exception):
    pass


class SeatCapExceededError(Exception):
    def __init__(self, max_seat, booked):
        self.max_seat = max_seat
        self.booked = booked
        super().__init__(f"Seat cap reached ({booked}/{max_seat})")


def convert_registration(school, registration, actor_id, section_id=None) -> dict:
    """Approve → provision. ONE transaction:
    1. seat cap (FOR UPDATE) — over-cap raises SeatCapExceededError;
    2. guardian User (parent role, unusable password + forced rotation —
       the family sets a real one on first login; InfixEdu's `123456` is the
       anti-pattern here);
    3. Student row (dynamic_fields carried);
    4. AdmissionApplication row linked for the pipeline history;
    5. registration → converted (student_id set).
    Caller commits.
    """
    import uuid as _uuid

    from app.models.academic import Class
    from app.models.admission import (
        AdmissionApplication,
        AdmissionRegistration,
    )
    from app.models.student import Guardian, Student
    from app.models.user import User
    from extensions import db

    if registration.status not in ("approved", "under_review", "submitted"):
        raise ValueError(f"cannot convert a {registration.status} registration")
    target_class = None
    if registration.applied_class_id:
        target_class = Class.query.get(registration.applied_class_id)
    class_id = target_class.id if target_class else None

    if class_id is not None:
        state = seat_state(str(school.id), str(class_id), target_class.academic_year_id)
        if state["max_seat"] is not None and state["remaining"] <= 0:
            raise SeatCapExceededError(state["max_seat"], state["booked"])

    now = datetime.now(timezone.utc)
    guardian_user = User.query.filter(
        User.school_id == school.id,
        User.phone == registration.guardian_phone,
        User.is_deleted.is_(False),
    ).first()
    if guardian_user is None:
        guardian_user = User(
            school_id=school.id,
            role="parent",
            full_name=registration.guardian_name[:300],
            phone=registration.guardian_phone,
            email=registration.guardian_email,
            is_active=True,
        )
        # No known password: the family sets one via the set-password flow
        # (must_change_password forces the screen on first login).
        guardian_user.set_password(secrets.token_urlsafe(24))
        guardian_user.must_change_password = True
        db.session.add(guardian_user)
        db.session.flush()

    student = Student(
        school_id=school.id,
        first_name=registration.student_first_name,
        last_name=registration.student_last_name,
        class_id=class_id,
        section_id=_uuid.UUID(str(section_id)) if section_id else None,
        academic_year_id=target_class.academic_year_id if target_class else None,
        academic_year=str(target_class.academic_year_id or "")[:10] if target_class else None,
        status="active",
        dynamic_fields=registration.dynamic_fields or {},
    )
    db.session.add(student)
    db.session.flush()

    if not Guardian.query.filter_by(
        student_id=student.id, phone=registration.guardian_phone, is_deleted=False
    ).first():
        db.session.add(Guardian(
            school_id=school.id,
            student_id=student.id,
            user_id=guardian_user.id,
            full_name=registration.guardian_name[:300],
            phone=registration.guardian_phone,
            email=registration.guardian_email,
            relation=registration.guardian_relation or "guardian",
            is_primary=True,
        ))

    application = AdmissionApplication(
        school_id=school.id,
        student_name=f"{registration.student_first_name} "
                     f"{registration.student_last_name or ''}".strip(),
        parent_name=registration.guardian_name[:300],
        parent_phone=registration.guardian_phone,
        parent_email=registration.guardian_email,
        guardian_name=registration.guardian_name[:300],
        guardian_phone=registration.guardian_phone,
        applied_class_id=registration.applied_class_id,
        class_applied=target_class.name if target_class else None,
        previous_school=registration.previous_school,
        form_data=registration.dynamic_fields or {},
        documents=registration.documents or [],
        status="accepted",
        remarks=f"Converted from registration {registration.registration_number}",
        reviewed_by_id=actor_id,
    )
    db.session.add(application)
    db.session.flush()

    registration.status = "converted"
    registration.student_id = student.id
    registration.application_id = application.id
    registration.reviewed_by_id = actor_id

    return {
        "student_id": str(student.id),
        "guardian_user_id": str(guardian_user.id),
        "application_id": str(application.id),
    }
