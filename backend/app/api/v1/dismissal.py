"""Student Dismissal & Pickup API — authorized pickups, QR verification, records."""
from datetime import datetime

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required

from app.models.dismissal import AuthorizedPickup, DismissalRecord
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

dismissal_bp = Blueprint("dismissal", __name__, url_prefix="/dismissal")


# ── Authorized Pickups ─────────────────────────────────────


@dismissal_bp.route("/authorized", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("dismissal")
def list_authorized():
    query = AuthorizedPickup.query.filter_by(school_id=g.school_id, is_deleted=False)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    items, meta = paginate(query.order_by(AuthorizedPickup.name))
    return success_response([_pickup_dict(p) for p in items], meta={"pagination": meta})


@dismissal_bp.route("/authorized", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("dismissal")
@role_required("superadmin", "school_admin", "parent")
def create_authorized():
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    pickup = AuthorizedPickup(
        school_id=g.school_id,
        authorized_by_id=claims.get("sub"),
    )
    for key in ("student_id", "name", "relation", "phone", "photo_url", "id_document_url", "is_active"):
        if key in data:
            setattr(pickup, key, data[key])
    db.session.add(pickup)
    db.session.commit()
    return created_response(_pickup_dict(pickup))


@dismissal_bp.route("/authorized/<uuid:pickup_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("dismissal")
@role_required("superadmin", "school_admin", "parent")
def update_authorized(pickup_id):
    pickup = AuthorizedPickup.query.filter_by(
        id=pickup_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not pickup:
        return error_response("Authorized pickup not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("name", "relation", "phone", "photo_url", "id_document_url", "is_active"):
        if key in data:
            setattr(pickup, key, data[key])
    db.session.commit()
    return success_response(_pickup_dict(pickup))


@dismissal_bp.route("/authorized/<uuid:pickup_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("dismissal")
@role_required("superadmin", "school_admin", "parent")
def delete_authorized(pickup_id):
    pickup = AuthorizedPickup.query.filter_by(
        id=pickup_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not pickup:
        return error_response("Authorized pickup not found", 404)
    pickup.soft_delete()
    return success_response({"deleted": True})


# ── Dismissal Records ─────────────────────────────────────


@dismissal_bp.route("/records", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("dismissal")
def list_records():
    query = DismissalRecord.query.filter_by(school_id=g.school_id, is_deleted=False)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    date = request.args.get("date")
    if date:
        query = query.filter(db.func.date(DismissalRecord.dismissed_at) == date)
    items, meta = paginate(query.order_by(DismissalRecord.dismissed_at.desc()))
    return success_response([_record_dict(r) for r in items], meta={"pagination": meta})


@dismissal_bp.route("/records", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("dismissal")
@role_required("superadmin", "school_admin", "teacher")
def create_record():
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    record = DismissalRecord(
        school_id=g.school_id,
        dismissed_by_id=claims.get("sub"),
        dismissed_at=datetime.utcnow(),
    )
    for key in ("student_id", "picked_up_by", "pickup_id", "qr_verified", "notes"):
        if key in data:
            setattr(record, key, data[key])
    db.session.add(record)
    db.session.commit()
    return created_response(_record_dict(record))


@dismissal_bp.route("/verify-qr", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("dismissal")
def verify_qr():
    """Verify a QR code for pickup and auto-create dismissal record."""
    data = request.get_json(silent=True) or {}
    pickup_id = data.get("pickup_id")
    student_id = data.get("student_id")
    if not pickup_id or not student_id:
        return error_response("pickup_id and student_id are required")
    pickup = AuthorizedPickup.query.filter_by(
        id=pickup_id, student_id=student_id, school_id=g.school_id, is_active=True, is_deleted=False
    ).first()
    if not pickup:
        return error_response("Invalid or inactive pickup authorization", 403)
    claims = get_jwt()
    record = DismissalRecord(
        school_id=g.school_id,
        student_id=student_id,
        picked_up_by=pickup.name,
        pickup_id=pickup_id,
        qr_verified=True,
        dismissed_by_id=claims.get("sub"),
        dismissed_at=datetime.utcnow(),
    )
    db.session.add(record)
    db.session.commit()
    return created_response(_record_dict(record))


# ── Serializers ────────────────────────────────────────────


def _pickup_dict(p):
    return {
        "id": str(p.id),
        "student_id": str(p.student_id),
        "name": p.name,
        "relation": p.relation,
        "phone": p.phone,
        "photo_url": p.photo_url,
        "id_document_url": p.id_document_url,
        "is_active": p.is_active,
    }


def _record_dict(r):
    return {
        "id": str(r.id),
        "student_id": str(r.student_id),
        "picked_up_by": r.picked_up_by,
        "pickup_id": str(r.pickup_id) if r.pickup_id else None,
        "qr_verified": r.qr_verified,
        "dismissed_at": str(r.dismissed_at) if r.dismissed_at else None,
        "dismissed_by_id": str(r.dismissed_by_id) if r.dismissed_by_id else None,
        "notes": r.notes,
    }
