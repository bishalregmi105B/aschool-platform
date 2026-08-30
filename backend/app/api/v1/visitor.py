"""Visitor Management API — check-in, check-out, appointments."""
import uuid
from datetime import datetime

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.user import User
from app.models.visitor import Visitor, VisitorAppointment
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

visitor_bp = Blueprint("visitor", __name__, url_prefix="/visitors")


# ── Visitors / Check-in ───────────────────────────────────


@visitor_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
def list_visitors():
    query = Visitor.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    # The web dashboard's search box sends ?search= — match it against the
    # name/phone/ID/badge fields (client previously filtered server-side-less).
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                Visitor.name.ilike(like),
                Visitor.phone.ilike(like),
                Visitor.id_number.ilike(like),
                Visitor.badge_number.ilike(like),
            )
        )
    items, meta = paginate(query.order_by(Visitor.checked_in_at.desc()))
    return success_response([_visitor_dict(v) for v in items], meta={"pagination": meta})


@visitor_bp.route("/checkin", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
@role_required("superadmin", "school_admin", "staff")
def checkin_visitor():
    data = request.get_json(silent=True) or {}
    # visitors.name is NOT NULL — validate up front so an empty payload gets a
    # 400 instead of an unhandled IntegrityError (500).
    if not str(data.get("name") or "").strip():
        return error_response("name is required", 400)
    # visiting_staff_id is an FK to users.id — reject unknown ids with a 400
    # instead of an IntegrityError (500).
    visiting_staff_id = data.get("visiting_staff_id")
    if visiting_staff_id:
        try:
            staff_uuid = uuid.UUID(str(visiting_staff_id))
        except (ValueError, AttributeError, TypeError):
            return error_response("visiting_staff_id must be a valid UUID", 400)
        if not User.query.filter_by(
            id=staff_uuid, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response(
                "visiting_staff_id does not match a user at this school", 400
            )
    visitor = Visitor(
        school_id=g.school_id,
        checked_in_at=datetime.utcnow(),
        status="checked_in",
    )
    for key in ("name", "phone", "email", "id_type", "id_number", "photo_url",
                "purpose", "visiting_staff_id", "badge_number", "notes"):
        if key in data:
            setattr(visitor, key, data[key])
    db.session.add(visitor)
    db.session.commit()
    return created_response(_visitor_dict(visitor))


@visitor_bp.route("/<uuid:visitor_id>/checkout", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
@role_required("superadmin", "school_admin", "staff")
def checkout_visitor(visitor_id):
    visitor = Visitor.query.filter_by(
        id=visitor_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not visitor:
        return error_response("Visitor not found", 404)
    # E188: an already checked-out visitor must not be re-checked-out (the
    # original checkout timestamp used to be silently overwritten).
    if visitor.status == "checked_out":
        return error_response("Visitor is already checked out", 400)
    visitor.checked_out_at = datetime.utcnow()
    visitor.status = "checked_out"
    db.session.commit()
    return success_response(_visitor_dict(visitor))


# ── Appointments ───────────────────────────────────────────


@visitor_bp.route("/appointments", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
def list_appointments():
    query = VisitorAppointment.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    items, meta = paginate(query.order_by(VisitorAppointment.scheduled_at.desc()))
    return success_response([_appt_dict(a) for a in items], meta={"pagination": meta})


@visitor_bp.route("/appointments", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
@role_required("superadmin", "school_admin", "staff")
def create_appointment():
    data = request.get_json(silent=True) or {}
    # Model requires these NOT NULL (visitor_appointments.staff_id/scheduled_at);
    # validate up front so callers get 400 instead of an unhandled IntegrityError.
    missing = [
        field
        for field in ("visitor_name", "staff_id", "scheduled_at")
        if not data.get(field)
    ]
    if missing:
        return error_response(
            f"Missing required field(s): {', '.join(missing)}", 400
        )
    # staff_id is a NOT NULL FK to users.id — reject unknown ids with a 400
    # instead of an unhandled IntegrityError (500).
    try:
        staff_uuid = uuid.UUID(str(data["staff_id"]))
    except (ValueError, AttributeError, TypeError):
        return error_response("staff_id must be a valid UUID", 400)
    if not User.query.filter_by(
        id=staff_uuid, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("staff_id does not match a user at this school", 400)
    appt = VisitorAppointment(school_id=g.school_id)
    for key in ("visitor_name", "visitor_phone", "visitor_email", "purpose",
                "staff_id", "notes"):
        if key in data:
            setattr(appt, key, data[key])
    appt.scheduled_at = _parse_datetime(data.get("scheduled_at"))
    if appt.scheduled_at is None:
        return error_response("scheduled_at must be a valid ISO datetime", 400)
    db.session.add(appt)
    db.session.commit()
    return created_response(_appt_dict(appt))


@visitor_bp.route("/appointments/<uuid:appt_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
@role_required("superadmin", "school_admin", "staff")
def update_appointment(appt_id):
    appt = VisitorAppointment.query.filter_by(
        id=appt_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not appt:
        return error_response("Appointment not found", 404)
    data = request.get_json(silent=True) or {}
    # E188: staff_id on update must satisfy the same tenant/FK check as POST
    # (a foreign-school staff id used to be linked silently).
    if data.get("staff_id"):
        try:
            staff_uuid = uuid.UUID(str(data["staff_id"]))
        except (ValueError, AttributeError, TypeError):
            return error_response("staff_id must be a valid UUID", 400)
        if not User.query.filter_by(
            id=staff_uuid, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response("staff_id does not match a user at this school", 400)
    # E188: status is a workflow field — reject free-form values.
    if "status" in data and data["status"] not in (
        "pending", "approved", "rejected", "cancelled", "completed"
    ):
        return error_response(
            "Invalid status. Must be one of: pending, approved, rejected, cancelled, completed",
            400,
        )
    for key in ("visitor_name", "visitor_phone", "visitor_email", "purpose",
                "staff_id", "status", "notes"):
        if key in data:
            setattr(appt, key, data[key])
    if "scheduled_at" in data:
        appt.scheduled_at = _parse_datetime(data.get("scheduled_at"))
    db.session.commit()
    return success_response(_appt_dict(appt))


@visitor_bp.route("/appointments/<uuid:appt_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("visitor_management")
@role_required("superadmin", "school_admin")
def approve_appointment(appt_id):
    from flask_jwt_extended import get_jwt
    appt = VisitorAppointment.query.filter_by(
        id=appt_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not appt:
        return error_response("Appointment not found", 404)
    claims = get_jwt()
    appt.status = "approved"
    appt.approved_by_id = claims.get("sub")
    db.session.commit()
    return success_response(_appt_dict(appt))


# ── Serializers ────────────────────────────────────────────


def _visitor_dict(v):
    return {
        "id": str(v.id),
        "name": v.name,
        "phone": v.phone,
        "email": v.email,
        "id_type": v.id_type,
        "id_number": v.id_number,
        "purpose": v.purpose,
        "visiting_staff_id": str(v.visiting_staff_id) if v.visiting_staff_id else None,
        "checked_in_at": str(v.checked_in_at) if v.checked_in_at else None,
        "checked_out_at": str(v.checked_out_at) if v.checked_out_at else None,
        "badge_number": v.badge_number,
        "status": v.status,
    }


def _appt_dict(a):
    return {
        "id": str(a.id),
        "visitor_name": a.visitor_name,
        "visitor_phone": a.visitor_phone,
        "visitor_email": a.visitor_email,
        "purpose": a.purpose,
        "staff_id": str(a.staff_id) if a.staff_id else None,
        "scheduled_at": str(a.scheduled_at) if a.scheduled_at else None,
        "status": a.status,
        "approved_by_id": str(a.approved_by_id) if a.approved_by_id else None,
    }


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
