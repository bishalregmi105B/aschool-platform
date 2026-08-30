"""Admission CRM API — inquiries, applications, enrollment pipeline."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

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


@admission_bp.route("/applications/<app_id>/status", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("admission")
@role_required("superadmin", "school_admin")
def update_application_status(app_id):
    """Move application through pipeline: submitted → under_review → interview → accepted → enrolled / rejected."""
    application = AdmissionApplication.query.filter_by(id=app_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    # E186: "shortlisted" is part of the DB enum (admission_status) but was
    # missing here, so a legitimate pipeline stage was rejected with 400.
    valid = ["submitted", "under_review", "shortlisted", "interview", "accepted", "enrolled", "rejected", "waitlisted"]
    if new_status not in valid:
        return error_response(f"Invalid status. Must be one of: {', '.join(valid)}", 400)
    application.status = new_status
    application.remarks = data.get("remarks", application.remarks)
    db.session.commit()

    # Fire integration events based on status transitions
    if new_status == "accepted":
        from app.plugins.events import emit
        emit("admission.accepted", school_id=str(g.school_id), application_id=str(application.id))
    elif new_status == "enrolled":
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
        "parent_name": a.parent_name, "parent_phone": a.parent_phone,
        "inquiry_id": str(a.inquiry_id) if a.inquiry_id else None,
        "class_applied": a.class_applied, "status": a.status, "remarks": a.remarks,
        "created_at": str(a.created_at) if a.created_at else None,
    }
