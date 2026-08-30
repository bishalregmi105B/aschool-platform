"""Alumni Network API — directory, events, donations."""
from datetime import datetime

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required
from sqlalchemy import distinct, func, or_

from app.models.alumni import Alumni, AlumniDonation, AlumniEvent
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

alumni_bp = Blueprint("alumni", __name__, url_prefix="/alumni")


# ── Directory ──────────────────────────────────────────────


@alumni_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("alumni")
def list_alumni():
    query = Alumni.query.filter_by(school_id=g.school_id, is_deleted=False)
    batch = request.args.get("batch")
    if batch:
        query = query.filter_by(batch=batch)
    if request.args.get("mentors_only"):
        query = query.filter_by(is_mentor=True)
    # The web directory's search box sends ?search= — filter name/email/org.
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Alumni.first_name.ilike(like),
                Alumni.last_name.ilike(like),
                Alumni.email.ilike(like),
                Alumni.current_organization.ilike(like),
            )
        )
    items, meta = paginate(query.order_by(Alumni.graduation_year.desc(), Alumni.first_name))
    # Directory stat cards (web reads data.meta.stats; falls back to list length).
    base = Alumni.query.filter_by(school_id=g.school_id, is_deleted=False)
    current_year = datetime.now().year
    stats = {
        "total": base.count(),
        "this_year": base.filter(
            Alumni.graduation_year.in_([str(current_year), str(current_year - 1)])
        ).count(),
        # "Active Network" card: mentors are the engaged/active members.
        "active": base.filter_by(is_mentor=True).count(),
        "organizations": base.filter(Alumni.current_organization.isnot(None)).with_entities(
            func.count(distinct(Alumni.current_organization))
        ).scalar(),
    }
    return success_response(
        [_alumni_dict(a) for a in items], meta={"pagination": meta, "stats": stats}
    )


@alumni_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin")
def create_alumni():
    data = request.get_json(silent=True) or {}
    if not (data.get("first_name") or "").strip() or not (data.get("last_name") or "").strip():
        return error_response("first_name and last_name are required", 400)
    if data.get("student_id") and not Student.query.filter_by(
        id=data["student_id"], school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("student_id does not match a student at this school", 400)
    alum = Alumni(school_id=g.school_id)
    for key in ("student_id", "first_name", "last_name", "email", "phone",
                "graduation_year", "batch", "current_organization", "designation",
                "location", "bio", "photo_url", "linkedin_url", "is_mentor"):
        if key in data:
            setattr(alum, key, data[key])
    db.session.add(alum)
    db.session.commit()
    return created_response(_alumni_dict(alum))


@alumni_bp.route("/<uuid:alumni_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("alumni")
def get_alumni(alumni_id):
    alum = Alumni.query.filter_by(id=alumni_id, school_id=g.school_id, is_deleted=False).first()
    if not alum:
        return error_response("Alumni not found", 404)
    return success_response(_alumni_dict(alum))


@alumni_bp.route("/<uuid:alumni_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin")
def update_alumni(alumni_id):
    alum = Alumni.query.filter_by(id=alumni_id, school_id=g.school_id, is_deleted=False).first()
    if not alum:
        return error_response("Alumni not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("first_name", "last_name", "email", "phone", "graduation_year",
                "batch", "current_organization", "designation", "location",
                "bio", "photo_url", "linkedin_url", "is_mentor", "is_verified"):
        if key in data:
            setattr(alum, key, data[key])
    db.session.commit()
    return success_response(_alumni_dict(alum))


@alumni_bp.route("/<uuid:alumni_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin")
def delete_alumni(alumni_id):
    alum = Alumni.query.filter_by(id=alumni_id, school_id=g.school_id, is_deleted=False).first()
    if not alum:
        return error_response("Alumni not found", 404)
    alum.soft_delete()
    return success_response({"deleted": True})


# ── Events ─────────────────────────────────────────────────


@alumni_bp.route("/events", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("alumni")
def list_events():
    query = AlumniEvent.query.filter_by(school_id=g.school_id, is_deleted=False)
    items, meta = paginate(query.order_by(AlumniEvent.event_date.desc()))
    return success_response([_event_dict(e) for e in items], meta={"pagination": meta})


@alumni_bp.route("/events", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin")
def create_event():
    data = request.get_json(silent=True) or {}
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    event_date = _parse_datetime(data.get("event_date"))
    if not event_date:
        return error_response("event_date is required (ISO format)", 400)
    claims = get_jwt()
    event = AlumniEvent(school_id=g.school_id, created_by_id=claims.get("sub"))
    for key in ("title", "description", "location", "event_type",
                "max_attendees", "registration_open"):
        if key in data:
            setattr(event, key, data[key])
    event.event_date = event_date
    db.session.add(event)
    db.session.commit()
    return created_response(_event_dict(event))


@alumni_bp.route("/events/<uuid:event_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin")
def update_event(event_id):
    event = AlumniEvent.query.filter_by(
        id=event_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not event:
        return error_response("Event not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("title", "description", "location", "event_type",
                "max_attendees", "registration_open"):
        if key in data:
            setattr(event, key, data[key])
    if "event_date" in data:
        parsed = _parse_datetime(data.get("event_date"))
        if not parsed:
            return error_response("event_date must use ISO format", 400)
        event.event_date = parsed
    db.session.commit()
    return success_response(_event_dict(event))


# ── Donations ──────────────────────────────────────────────


@alumni_bp.route("/donations", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin", "accountant")
def list_donations():
    query = AlumniDonation.query.filter_by(school_id=g.school_id, is_deleted=False)
    alumni_id = request.args.get("alumni_id")
    if alumni_id:
        query = query.filter_by(alumni_id=alumni_id)
    items, meta = paginate(query.order_by(AlumniDonation.donated_at.desc()))
    return success_response([_donation_dict(d) for d in items], meta={"pagination": meta})


@alumni_bp.route("/donations", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("alumni")
@role_required("superadmin", "school_admin", "accountant")
def create_donation():
    data = request.get_json(silent=True) or {}
    if not data.get("alumni_id") or not Alumni.query.filter_by(
        id=data["alumni_id"], school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("alumni_id does not match an alumni record at this school", 400)
    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        amount = 0
    if amount <= 0:
        return error_response("amount must be a positive number", 400)
    donation = AlumniDonation(school_id=g.school_id)
    for key in ("alumni_id", "amount", "currency", "purpose", "payment_method",
                "transaction_ref", "receipt_url", "status"):
        if key in data:
            setattr(donation, key, data[key])
    donation.donated_at = _parse_datetime(data.get("donated_at")) or datetime.utcnow()
    db.session.add(donation)
    db.session.commit()
    return created_response(_donation_dict(donation))


# ── Serializers ────────────────────────────────────────────


def _alumni_dict(a):
    return {
        "id": str(a.id),
        "first_name": a.first_name,
        "last_name": a.last_name,
        "email": a.email,
        "phone": a.phone,
        "graduation_year": a.graduation_year,
        "batch": a.batch,
        "current_organization": a.current_organization,
        "designation": a.designation,
        "location": a.location,
        "bio": a.bio,
        "photo_url": a.photo_url,
        "linkedin_url": a.linkedin_url,
        "is_mentor": a.is_mentor,
        "is_verified": a.is_verified,
    }


def _event_dict(e):
    return {
        "id": str(e.id),
        "title": e.title,
        "description": e.description,
        "event_date": str(e.event_date) if e.event_date else None,
        "location": e.location,
        "event_type": e.event_type,
        "max_attendees": e.max_attendees,
        "registration_open": e.registration_open,
    }


def _donation_dict(d):
    return {
        "id": str(d.id),
        "alumni_id": str(d.alumni_id),
        "amount": float(d.amount) if d.amount else None,
        "currency": d.currency,
        "purpose": d.purpose,
        "payment_method": d.payment_method,
        "transaction_ref": d.transaction_ref,
        "donated_at": str(d.donated_at) if d.donated_at else None,
        "status": d.status,
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
