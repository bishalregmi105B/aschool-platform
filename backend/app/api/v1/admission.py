"""Admission CRM API — inquiries, applications, enrollment pipeline."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.models.admission import AdmissionInquiry, AdmissionApplication
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

admission_bp = Blueprint("admission", __name__, url_prefix="/admission")

# E186: statuses accepted by update_inquiry — the column is documented as
# new/contacted/converted/lost and the follow-up task moves inquiries to
# "followed_up"; reject free-form garbage.
VALID_INQUIRY_STATUSES = ("new", "contacted", "followed_up", "converted", "lost")


def _parse_uuid(value):
    """Return a UUID or None — bad uuids in bodies used to surface as
    unhandled 500s (psycopg2 DataError) instead of 400s."""
    import uuid as _uuid

    try:
        return _uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _parse_date_value(value):
    """Parse a client-supplied date/datetime; None when unparseable."""
    from datetime import date as _date, datetime as _dt

    if value is None or value == "":
        return None
    if isinstance(value, _dt):
        return value
    if isinstance(value, _date):
        return value
    try:
        return _date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


# ── Inquiries ─────────────────────────────────────────────

@admission_bp.route("/inquiries", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("admission")
def list_inquiries():
    query = AdmissionInquiry.query.filter_by(school_id=g.school_id)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(AdmissionInquiry.created_at.desc())
    items, meta = paginate(query)
    return success_response([_inquiry_dict(i) for i in items], meta={"pagination": meta})


@admission_bp.route("/inquiries", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("admission")
def create_inquiry():
    data = request.get_json(silent=True) or {}
    inquiry = AdmissionInquiry(school_id=g.school_id)
    for key in ("student_name", "guardian_name", "phone", "email", "class_applied", "source", "notes"):
        if key in data:
            setattr(inquiry, key, data[key])
    db.session.add(inquiry)
    db.session.commit()
    return created_response(_inquiry_dict(inquiry))


@admission_bp.route("/inquiries/<inquiry_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def update_inquiry(inquiry_id):
    inquiry = AdmissionInquiry.query.filter_by(id=inquiry_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    if "status" in data and data["status"] not in VALID_INQUIRY_STATUSES:
        return error_response(
            "Invalid status. Must be one of: " + ", ".join(VALID_INQUIRY_STATUSES),
            400,
        )
    if data.get("assigned_to"):
        # E186: assigned_to must be a user of this school (FK + tenant check).
        from app.models.user import User

        assigned_uuid = _parse_uuid(data["assigned_to"])
        if assigned_uuid is None:
            return error_response("assigned_to must be a valid UUID", 400)
        if not User.query.filter_by(
            id=assigned_uuid, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response("assigned_to does not match a user at this school", 400)
    for key in ("status", "notes", "follow_up_date", "assigned_to"):
        if key in data:
            setattr(inquiry, key, data[key])
    db.session.commit()
    return success_response(_inquiry_dict(inquiry))


# ── Applications ──────────────────────────────────────────

@admission_bp.route("/applications", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("admission")
def list_applications():
    query = AdmissionApplication.query.filter_by(school_id=g.school_id)
    status = request.args.get("status")
    class_applied = request.args.get("class")
    if status:
        query = query.filter_by(status=status)
    if class_applied:
        query = query.filter_by(class_applied=class_applied)
    query = query.order_by(AdmissionApplication.created_at.desc())
    items, meta = paginate(query)
    return success_response([_app_dict(a) for a in items], meta={"pagination": meta})


@admission_bp.route("/applications", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("admission")
def create_application():
    data = request.get_json(silent=True) or {}
    # admission_applications.student_name is NOT NULL — validate up front so a
    # missing name gets a 400 instead of an unhandled IntegrityError (500).
    if not str(data.get("student_name") or "").strip():
        return error_response("student_name is required", 400)
    app = AdmissionApplication(school_id=g.school_id)
    for key in ("student_name", "dob", "gender", "guardian_name", "guardian_phone",
                 "guardian_email", "class_applied", "previous_school", "address", "documents"):
        if key in data:
            setattr(app, key, data[key])
    app.parent_name = data.get("parent_name") or data.get("guardian_name") or app.parent_name
    app.parent_phone = data.get("parent_phone") or data.get("guardian_phone") or app.parent_phone
    app.parent_email = data.get("parent_email") or data.get("guardian_email") or app.parent_email
    if not app.parent_phone:
        return error_response("parent_phone or guardian_phone is required", 400)
    if data.get("inquiry_id"):
        # E186: the inquiry link must be (a) a valid uuid and (b) an inquiry
        # of THIS school — a foreign-school inquiry used to be linked
        # silently, leaking another tenant's CRM row into this application.
        inquiry_uuid = _parse_uuid(data["inquiry_id"])
        if inquiry_uuid is None:
            return error_response("inquiry_id must be a valid UUID", 400)
        inquiry = AdmissionInquiry.query.filter_by(
            id=inquiry_uuid, school_id=g.school_id
        ).first()
        if not inquiry:
            return error_response("inquiry_id does not match an inquiry at this school", 404)
        app.inquiry_id = inquiry.id
    db.session.add(app)
    db.session.commit()
    return created_response(_app_dict(app))


# Stages at which application details may still be edited — once "accepted"
# the admission.accepted listener has already auto-created the Student+User
# from these fields, so edits would silently desync the two records.
EDITABLE_APPLICATION_STATUSES = ("submitted", "under_review", "shortlisted", "interview")

EDITABLE_APPLICATION_FIELDS = (
    "student_name",
    "dob",
    "gender",
    "address",
    "previous_school",
    "class_applied",
    "parent_name",
    "parent_phone",
    "parent_email",
    "guardian_name",
    "guardian_phone",
    "guardian_email",
)


@admission_bp.route("/applications/<app_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def update_application(app_id):
    """Edit application details (only before the accepted stage)."""
    app_uuid = _parse_uuid(app_id)
    if app_uuid is None:
        return error_response("Application not found", 404)
    application = AdmissionApplication.query.filter_by(
        id=app_uuid, school_id=g.school_id
    ).first()
    if not application:
        return error_response("Application not found", 404)
    if application.status not in EDITABLE_APPLICATION_STATUSES:
        return error_response(
            "Application details can only be edited before the application "
            "is accepted (a student record is auto-created at acceptance)",
            400,
        )
    data = request.get_json(silent=True) or {}
    if "student_name" in data and not str(data.get("student_name") or "").strip():
        return error_response("student_name cannot be empty", 400)
    # admission_applications.parent_phone is NOT NULL — an empty value here
    # would surface as an IntegrityError (500) instead of a 400.
    if "parent_phone" in data and not str(data.get("parent_phone") or "").strip():
        return error_response("parent_phone is required", 400)
    if "dob" in data:
        parsed_dob = _parse_date_value(data.get("dob"))
        if parsed_dob is None and data.get("dob") not in (None, ""):
            return error_response("dob must be a valid ISO date", 400)
        data["dob"] = parsed_dob
    if "gender" in data and data.get("gender") not in (None, "", "male", "female", "other"):
        return error_response("gender must be one of: male, female, other", 400)
    updated = [key for key in EDITABLE_APPLICATION_FIELDS if key in data]
    if not updated:
        return error_response("No editable fields supplied", 400)
    for key in updated:
        setattr(application, key, data[key])
    db.session.commit()
    return success_response(_app_dict(application))


@admission_bp.route("/applications/<app_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("admission")
def get_application(app_id):
    """Application detail — everything the detail dialog / edit form shows."""
    app_uuid = _parse_uuid(app_id)
    if app_uuid is None:
        return error_response("Application not found", 404)
    application = AdmissionApplication.query.filter_by(
        id=app_uuid, school_id=g.school_id
    ).first()
    if not application:
        return error_response("Application not found", 404)
    return success_response(_app_detail_dict(application))


# Legal pipeline transitions for PUT /applications/<id>/status. The stages in
# PIPELINE_ORDER must move forward (a backwards jump is a 400); "rejected" and
# "waitlisted" are side-states reachable from any live stage, "enrolled" is
# terminal and may ONLY be entered from "accepted" (the admission.accepted
# listener auto-creates the Student + login at acceptance — enrolling from an
# earlier stage would leave an application with no student record).
PIPELINE_ORDER = {
    "submitted": 0,
    "under_review": 1,
    "shortlisted": 2,
    "interview": 3,
    "accepted": 4,
    "enrolled": 5,
}
SIDE_STATUSES = ("rejected", "waitlisted")
VALID_APPLICATION_STATUSES = (*PIPELINE_ORDER, *SIDE_STATUSES)


@admission_bp.route("/applications/<app_id>/status", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def update_application_status(app_id):
    """Move application through pipeline: submitted → under_review → shortlisted → interview → accepted → enrolled (rejected/waitlisted are side-states)."""
    application = AdmissionApplication.query.filter_by(id=app_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in VALID_APPLICATION_STATUSES:
        return error_response(
            "Invalid status. Must be one of: " + ", ".join(VALID_APPLICATION_STATUSES),
            400,
        )
    current = application.status
    if current == "enrolled" and new_status != "enrolled":
        return error_response(
            "Enrolled applications are final — the status cannot change", 400
        )
    if new_status == "enrolled" and current != "accepted":
        return error_response(
            "Application must be accepted before it can be enrolled "
            "(a student record is auto-created at the accepted stage)",
            400,
        )
    current_rank = PIPELINE_ORDER.get(current)
    new_rank = PIPELINE_ORDER.get(new_status)
    if (
        current_rank is not None
        and new_rank is not None
        and new_rank < current_rank
    ):
        allowed_back = current in ("accepted", "enrolled") and new_status == "rejected"
        if not allowed_back:
            return error_response(
                f"Cannot move an application backwards from "
                f"'{current}' to '{new_status}'",
                400,
            )
    application.status = new_status
    application.remarks = data.get("remarks", application.remarks)
    db.session.commit()

    # Fire integration events based on status transitions
    if new_status == "accepted" and current != "accepted":
        from app.plugins.events import emit
        emit("admission.accepted", school_id=str(g.school_id), application_id=str(application.id))
    elif new_status == "enrolled" and current != "enrolled":
        from app.plugins.events import emit
        emit("admission.enrolled", school_id=str(g.school_id), application_id=str(application.id))

    return success_response(_app_dict(application))


@admission_bp.route("/dashboard", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("admission")
def admission_dashboard():
    """Admission funnel summary."""
    from sqlalchemy import func
    pipeline = db.session.query(
        AdmissionApplication.status, func.count(AdmissionApplication.id)
    ).filter_by(school_id=g.school_id).group_by(AdmissionApplication.status).all()

    inquiry_count = AdmissionInquiry.query.filter_by(school_id=g.school_id).count()

    return success_response({
        "total_inquiries": inquiry_count,
        "pipeline": {status: count for status, count in pipeline},
    })


def _inquiry_dict(i):
    return {
        "id": str(i.id), "student_name": i.student_name, "guardian_name": i.guardian_name,
        "phone": i.phone, "email": i.email, "class_applied": i.class_applied,
        "source": i.source, "status": i.status, "notes": i.notes,
        "created_at": str(i.created_at) if i.created_at else None,
    }


def _app_dict(a):
    return {
        "id": str(a.id), "student_name": a.student_name, "guardian_name": a.guardian_name,
        "guardian_phone": a.guardian_phone, "guardian_email": a.guardian_email,
        "parent_name": a.parent_name, "parent_phone": a.parent_phone,
        "parent_email": a.parent_email,
        # Full applicant fields so the frontend detail dialog / edit flows can
        # show everything captured on the application.
        "dob": a.dob.date().isoformat() if a.dob else None,
        "gender": a.gender, "address": a.address, "previous_school": a.previous_school,
        "inquiry_id": str(a.inquiry_id) if a.inquiry_id else None,
        "class_applied": a.class_applied, "status": a.status, "remarks": a.remarks,
        "created_at": str(a.created_at) if a.created_at else None,
    }


def _app_detail_dict(a):
    """Serializer for GET /applications/<id> — everything _app_dict has plus
    the review/merit fields the detail dialog and status timeline render."""
    data = _app_dict(a)
    data.update(
        {
            "test_score": float(a.test_score) if a.test_score is not None else None,
            "interview_score": float(a.interview_score)
            if a.interview_score is not None
            else None,
            "merit_rank": a.merit_rank,
            "notes": a.notes,
            "documents": a.documents if isinstance(a.documents, list) else [],
            "form_data": a.form_data if isinstance(a.form_data, dict) else {},
            "reviewed_by_id": str(a.reviewed_by_id) if a.reviewed_by_id else None,
            "updated_at": str(a.updated_at) if getattr(a, "updated_at", None) else None,
        }
    )
    return data


# ══════════════════════════════════════════════════════════════════════════
# S-A5 — A-09 admission funnel: staging queue → review → convert w/
# FOR-UPDATE seat caps; A-22 admission-fee linkage.
# ══════════════════════════════════════════════════════════════════════════

def _registration_dict(r):
    student = r.student
    return {
        "id": str(r.id),
        "registration_number": r.registration_number,
        "status": r.status,
        "student_name": f"{r.student_first_name} {r.student_last_name or ''}".strip(),
        "student_first_name": r.student_first_name,
        "student_dob_bs": r.student_dob_bs,
        "gender": r.gender,
        "guardian_name": r.guardian_name,
        "guardian_relation": r.guardian_relation,
        "guardian_phone": r.guardian_phone,
        "guardian_email": r.guardian_email,
        "previous_school": r.previous_school,
        "applied_class_id": str(r.applied_class_id) if r.applied_class_id else None,
        "class_name": r.applied_class.name if r.applied_class else None,
        "documents": r.documents or [],
        "dynamic_fields": r.dynamic_fields or {},
        "source": r.source,
        "review_notes": r.review_notes,
        "student_id": str(r.student_id) if r.student_id else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@admission_bp.route("/registrations", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin", "teacher")
def list_registrations():
    from app.models.admission import AdmissionRegistration

    query = AdmissionRegistration.query.filter(
        AdmissionRegistration.school_id == g.school_id,
        AdmissionRegistration.is_deleted.is_(False),
    ).options(joinedload(AdmissionRegistration.applied_class))
    status = (request.args.get("status") or "").strip().lower()
    if status in ("submitted", "under_review", "approved", "rejected", "converted"):
        query = query.filter(AdmissionRegistration.status == status)
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                AdmissionRegistration.student_first_name.ilike(like),
                AdmissionRegistration.student_last_name.ilike(like),
                AdmissionRegistration.guardian_name.ilike(like),
                AdmissionRegistration.guardian_phone.ilike(like),
                AdmissionRegistration.registration_number.ilike(like),
            )
        )
    items, meta = paginate(query.order_by(AdmissionRegistration.created_at.desc()))
    return success_response({
        "registrations": [_registration_dict(r) for r in items], "meta": meta
    })


@admission_bp.route("/registrations/<uuid:registration_id>/review", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def review_registration(registration_id):
    from app.models.admission import AdmissionRegistration

    reg = AdmissionRegistration.query.filter_by(
        id=registration_id, school_id=g.school_id, is_deleted=False
    ).first()
    if reg is None:
        return error_response("Registration not found", 404)
    data = request.get_json(silent=True) or {}
    decision = str(data.get("decision") or "").strip().lower()
    if decision not in ("under_review", "approved", "rejected"):
        return error_response("decision must be under_review|approved|rejected", 400)
    reg.status = decision
    reg.review_notes = str(data.get("review_notes") or "")[:1000] or None
    reg.reviewed_by_id = g.user_id
    db.session.commit()
    return success_response(_registration_dict(reg))


@admission_bp.route("/registrations/<uuid:registration_id>/convert", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def convert_registration_route(registration_id):
    """Approve → provision in ONE transaction, gated by the class's
    FOR-UPDATE seat cap. Over-cap → 409 with the counts."""
    from app.models.admission import AdmissionRegistration
    from app.services import admission_funnel
    from app.services.admission_funnel import SeatCapExceededError

    reg = AdmissionRegistration.query.filter_by(
        id=registration_id, school_id=g.school_id, is_deleted=False
    ).first()
    if reg is None:
        return error_response("Registration not found", 404)
    if reg.status == "converted":
        return error_response("Registration already converted", 409)
    data = request.get_json(silent=True) or {}

    from app.models.school import School

    school = School.query.get(g.school_id)
    try:
        result = admission_funnel.convert_registration(
            school, reg, g.user_id, section_id=data.get("section_id")
        )
        db.session.commit()
    except SeatCapExceededError as exc:
        db.session.rollback()
        return error_response(
            {
                "message": f"Seat cap reached for the applied class "
                           f"({exc.booked}/{exc.max_seat})",
                "booked": exc.booked,
                "max_seat": exc.max_seat,
            },
            409,
        )
    except ValueError as exc:
        db.session.rollback()
        return error_response(str(exc), 400)

    # Admission-fee linkage (A-22 bridge): when the fees plugin is active,
    # raise the admission-fee bill so the office can collect or the family
    # can pay from the public flow.
    fee_collection_id = None
    try:
        from app.models.fee import FeeCollection

        installed = set(getattr(g, "installed_plugins", None) or [])
        if "fees" in installed and reg.applied_class_id:
            amount = data.get("admission_fee_amount")
            if amount:
                bill = FeeCollection(
                    school_id=g.school_id,
                    student_id=reg.student_id,
                    fee_item_name="Admission Fee",
                    amount=_admission_fee_amount(amount),
                    academic_year=reg.applied_class.academic_year_id
                    and str(reg.applied_class.academic_year_id)[:4]
                    or None,
                    payment_status="pending",
                    notes=f"[admission_fee:{reg.registration_number}]",
                )
                db.session.add(bill)
                db.session.commit()
                fee_collection_id = str(bill.id)
    except Exception:  # noqa: BLE001 — fee linkage must not break provisioning
        db.session.rollback()

    return success_response({**result, "fee_collection_id": fee_collection_id})


def _admission_fee_amount(value):
    try:
        return round(max(float(value), 0.0), 2)
    except (TypeError, ValueError):
        return 0.0


@admission_bp.route("/seats", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin", "teacher")
def list_seats():
    from app.models.academic import Class
    from app.models.student import Student
    from app.models.admission import EnrollmentSeatCap

    caps = EnrollmentSeatCap.query.filter(
        EnrollmentSeatCap.school_id == g.school_id,
        EnrollmentSeatCap.is_deleted.is_(False),
    ).all()
    out = []
    for cap in caps:
        booked = Student.query.filter(
            Student.school_id == g.school_id,
            Student.class_id == cap.class_id,
            Student.is_deleted.is_(False),
            Student.status == "active",
        ).count()
        out.append({
            "id": str(cap.id),
            "class_id": str(cap.class_id),
            "class_name": cap.klass.name if cap.klass else None,
            "academic_year_id": str(cap.academic_year_id) if cap.academic_year_id else None,
            "max_seat": cap.max_seat,
            "booked": booked,
            "remaining": max(cap.max_seat - booked, 0),
        })
    return success_response({"seats": out})


@admission_bp.route("/seats", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def upsert_seat():
    from app.models.academic import Class
    from app.models.admission import EnrollmentSeatCap

    data = request.get_json(silent=True) or {}
    class_id = _parse_uuid(data.get("class_id"))
    if not class_id:
        return error_response("class_id is required", 400)
    if Class.query.filter_by(id=class_id, school_id=g.school_id, is_deleted=False).first() is None:
        return error_response("class_id does not match this school", 404)
    try:
        max_seat = int(data.get("max_seat"))
    except (TypeError, ValueError):
        return error_response("max_seat must be an integer", 400)
    if max_seat < 1 or max_seat > 500:
        return error_response("max_seat must be 1–500", 400)
    year_id = _parse_uuid(data.get("academic_year_id"))
    cap = EnrollmentSeatCap.query.filter(
        EnrollmentSeatCap.school_id == g.school_id,
        EnrollmentSeatCap.class_id == class_id,
        EnrollmentSeatCap.academic_year_id == year_id,
        EnrollmentSeatCap.is_deleted.is_(False),
    ).first()
    if cap is None:
        cap = EnrollmentSeatCap(school_id=g.school_id, class_id=class_id,
                                academic_year_id=year_id)
        db.session.add(cap)
    cap.max_seat = max_seat
    db.session.commit()
    return success_response({"id": str(cap.id), "max_seat": cap.max_seat})
