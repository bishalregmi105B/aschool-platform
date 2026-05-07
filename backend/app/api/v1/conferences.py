"""Parent-Teacher Conference API — conferences, slots, booking, notes."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.conference import PTConference, ConferenceSlot, ConferenceNotes
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

conferences_bp = Blueprint("conferences", __name__, url_prefix="/conferences")


@conferences_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("conferences")
def list_conferences():
    query = PTConference.query.filter_by(school_id=g.school_id, is_deleted=False)
    if request.args.get("active"):
        query = query.filter_by(is_active=True)
    items, meta = paginate(query.order_by(PTConference.start_date.desc()))
    return success_response([_conf_dict(c) for c in items], meta={"pagination": meta})


@conferences_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("conferences")
@role_required("superadmin", "school_admin")
def create_conference():
    data = request.get_json(silent=True) or {}
    conf = PTConference(school_id=g.school_id)
    for key in ("title", "description", "start_date", "end_date",
                "is_virtual", "meeting_link", "is_active"):
        if key in data:
            setattr(conf, key, data[key])
    db.session.add(conf)
    db.session.commit()
    return created_response(_conf_dict(conf))


@conferences_bp.route("/<uuid:conf_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("conferences")
@role_required("superadmin", "school_admin")
def update_conference(conf_id):
    conf = PTConference.query.filter_by(
        id=conf_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not conf:
        return error_response("Conference not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("title", "description", "start_date", "end_date",
                "is_virtual", "meeting_link", "is_active"):
        if key in data:
            setattr(conf, key, data[key])
    db.session.commit()
    return success_response(_conf_dict(conf))


# ── Slots ──────────────────────────────────────────────────


@conferences_bp.route("/<uuid:conf_id>/slots", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("conferences")
def list_slots(conf_id):
    query = ConferenceSlot.query.filter_by(
        conference_id=conf_id, school_id=g.school_id, is_deleted=False
    )
    teacher_id = request.args.get("teacher_id")
    if teacher_id:
        query = query.filter_by(teacher_id=teacher_id)
    available_only = request.args.get("available")
    if available_only:
        query = query.filter_by(is_booked=False)
    items, meta = paginate(query.order_by(ConferenceSlot.start_time))
    return success_response([_slot_dict(s) for s in items], meta={"pagination": meta})


@conferences_bp.route("/<uuid:conf_id>/slots", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("conferences")
@role_required("superadmin", "school_admin", "teacher")
def create_slots(conf_id):
    """Teacher creates available time slots."""
    data = request.get_json(silent=True) or {}
    slots = data.get("slots", [data])  # accept array or single
    created = []
    for s in slots:
        slot = ConferenceSlot(
            conference_id=conf_id,
            school_id=g.school_id,
            teacher_id=s.get("teacher_id", g.current_user.id),
            start_time=s["start_time"],
            end_time=s["end_time"],
            duration_mins=s.get("duration_mins", 15),
        )
        db.session.add(slot)
        created.append(slot)
    db.session.commit()
    return created_response([_slot_dict(s) for s in created])


@conferences_bp.route("/slots/<uuid:slot_id>/book", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("conferences")
def book_slot(slot_id):
    """Parent books an available slot."""
    slot = ConferenceSlot.query.filter_by(
        id=slot_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not slot:
        return error_response("Slot not found", 404)
    if slot.is_booked:
        return error_response("Slot already booked", 409)

    data = request.get_json(silent=True) or {}
    slot.is_booked = True
    slot.parent_id = data.get("parent_id", g.current_user.id)
    slot.student_id = data.get("student_id")
    db.session.commit()
    return success_response(_slot_dict(slot))


@conferences_bp.route("/slots/<uuid:slot_id>/cancel", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("conferences")
def cancel_booking(slot_id):
    slot = ConferenceSlot.query.filter_by(
        id=slot_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not slot:
        return error_response("Slot not found", 404)
    slot.is_booked = False
    slot.parent_id = None
    slot.student_id = None
    db.session.commit()
    return success_response(_slot_dict(slot))


# ── Conference Notes ───────────────────────────────────────


@conferences_bp.route("/slots/<uuid:slot_id>/notes", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("conferences")
def get_notes(slot_id):
    notes = ConferenceNotes.query.filter_by(
        slot_id=slot_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not notes:
        return success_response({"slot_id": str(slot_id), "exists": False})
    return success_response(_notes_dict(notes))


@conferences_bp.route("/slots/<uuid:slot_id>/notes", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("conferences")
@role_required("superadmin", "school_admin", "teacher")
def save_notes(slot_id):
    data = request.get_json(silent=True) or {}
    notes = ConferenceNotes.query.filter_by(
        slot_id=slot_id, school_id=g.school_id
    ).first()
    if not notes:
        notes = ConferenceNotes(slot_id=slot_id, school_id=g.school_id)
        db.session.add(notes)
    for key in ("notes", "action_items", "follow_up_needed", "follow_up_date"):
        if key in data:
            setattr(notes, key, data[key])
    db.session.commit()
    return success_response(_notes_dict(notes))


# ── Serializers ────────────────────────────────────────────


def _conf_dict(c):
    return {
        "id": str(c.id), "title": c.title, "description": c.description,
        "start_date": str(c.start_date) if c.start_date else None,
        "end_date": str(c.end_date) if c.end_date else None,
        "start_date_bs": ad_to_bs(c.start_date) if c.start_date else None,
        "end_date_bs": ad_to_bs(c.end_date) if c.end_date else None,
        "is_virtual": c.is_virtual, "meeting_link": c.meeting_link,
        "is_active": c.is_active,
    }


def _slot_dict(s):
    return {
        "id": str(s.id), "conference_id": str(s.conference_id),
        "teacher_id": str(s.teacher_id),
        "start_time": str(s.start_time) if s.start_time else None,
        "end_time": str(s.end_time) if s.end_time else None,
        "duration_mins": s.duration_mins, "is_booked": s.is_booked,
        "parent_id": str(s.parent_id) if s.parent_id else None,
        "student_id": str(s.student_id) if s.student_id else None,
    }


def _notes_dict(n):
    return {
        "id": str(n.id), "slot_id": str(n.slot_id),
        "notes": n.notes, "action_items": n.action_items,
        "follow_up_needed": n.follow_up_needed,
        "follow_up_date": str(n.follow_up_date) if n.follow_up_date else None,
    }
