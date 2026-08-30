"""Parent-Teacher Conference API — conferences, slots, booking, notes."""
from datetime import date, datetime

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.conference import PTConference, ConferenceSlot, ConferenceNotes
from app.models.student import Student
from app.models.user import User
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

conferences_bp = Blueprint("conferences", __name__, url_prefix="/conferences")

# E192: nepali_datetime only covers BS 1975-2100 (AD ~1918-2044). A
# conference scheduled outside that range must be rejected with a 400 on
# write and must never 500 the list serializer (same contract as notices).
_BS_MIN_AD = (1918, 1, 1)
_BS_MAX_AD = (2044, 12, 31)


def _bs_in_range(value) -> bool:
    if not value:
        return True
    d = value.date() if isinstance(value, datetime) else value
    if not isinstance(d, date):
        return True
    return _BS_MIN_AD <= (d.year, d.month, d.day) <= _BS_MAX_AD


def _bs_or_none(value):
    """ad_to_bs that degrades to None instead of OverflowError on legacy rows."""
    if not value:
        return None
    try:
        return ad_to_bs(value)
    except (OverflowError, ValueError):
        return None


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


def _parse_dt(value):
    """Parse a client datetime string; None when absent/unparseable."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _valid_uuid(value) -> bool:
    """True when value is a well-formed UUID string (avoids PG DataError)."""
    import uuid as _uuid

    try:
        _uuid.UUID(str(value))
        return True
    except (TypeError, ValueError, AttributeError):
        return False


@conferences_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("conferences")
@role_required("superadmin", "school_admin")
def create_conference():
    data = request.get_json(silent=True) or {}
    # title/start_date/end_date are NOT NULL columns — validate up front so a
    # bad body returns 400 instead of an unhandled IntegrityError 500.
    missing = [f for f in ("title", "start_date", "end_date") if not data.get(f)]
    if missing:
        return error_response(
            f"Missing required fields: {', '.join(missing)}", 400
        )
    start = _parse_dt(data.get("start_date"))
    end = _parse_dt(data.get("end_date"))
    if not start or not end:
        return error_response("start_date and end_date must be valid datetimes", 400)
    if end < start:
        return error_response("end_date must be on or after start_date", 400)
    # E192: out-of-BS-range dates would 500 every later list call via
    # ad_to_bs — reject them up front.
    bad = [f for f, d in (("start_date", start), ("end_date", end)) if not _bs_in_range(d)]
    if bad:
        return error_response(
            f"{', '.join(bad)} is outside the supported BS calendar range "
            f"(AD 1918-2044)", 400,
        )
    conf = PTConference(school_id=g.school_id)
    conf.title = data["title"]
    conf.start_date = start
    conf.end_date = end
    for key in ("description", "is_virtual", "meeting_link", "is_active"):
        if key in data:
            setattr(conf, key, data[key])
    # Meeting-link honesty (E192 note): links such as public Jitsi rooms
    # (https://meet.jit.si/<room>) are NOT access-controlled — anyone who
    # obtains the URL can join. The API only validates the URL's shape;
    # restricting rooms (lobby/passcode) is the school's responsibility in
    # the provider. Flagged as a product limitation, not silently hidden.
    link = (data.get("meeting_link") or "").strip() if "meeting_link" in data else None
    if link:
        if not (link.startswith("http://") or link.startswith("https://")):
            return error_response("meeting_link must be an http(s) URL", 400)
        conf.meeting_link = link
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
    if "start_date" in data:
        parsed = _parse_dt(data.get("start_date"))
        if not parsed:
            return error_response("start_date must be a valid datetime", 400)
        conf.start_date = parsed
    if "end_date" in data:
        parsed = _parse_dt(data.get("end_date"))
        if not parsed:
            return error_response("end_date must be a valid datetime", 400)
        conf.end_date = parsed
    if conf.start_date and conf.end_date and conf.end_date < conf.start_date:
        return error_response("end_date must be on or after start_date", 400)
    bad = [f for f, d in (("start_date", conf.start_date), ("end_date", conf.end_date))
           if not _bs_in_range(d)]
    if bad:
        db.session.rollback()
        return error_response(
            f"{', '.join(bad)} is outside the supported BS calendar range "
            f"(AD 1918-2044)", 400,
        )
    if "meeting_link" in data:
        link = (data.get("meeting_link") or "").strip()
        if link and not (link.startswith("http://") or link.startswith("https://")):
            return error_response("meeting_link must be an http(s) URL", 400)
        conf.meeting_link = link or None
    for key in ("title", "description", "is_virtual", "is_active"):
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
    conf = PTConference.query.filter_by(
        id=conf_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not conf:
        return error_response("Conference not found", 404)

    data = request.get_json(silent=True) or {}
    # Accept {"slots": [...]} / a single {...} object / a bare top-level array.
    if isinstance(data, list):
        slots = data
    else:
        slots = data.get("slots", [data])
    if not isinstance(slots, list) or not slots:
        return error_response("slots must be a non-empty array", 400)
    created = []
    for s in slots:
        start = _parse_dt(s.get("start_time"))
        end = _parse_dt(s.get("end_time"))
        if not start or not end:
            return error_response(
                "Each slot needs valid start_time and end_time datetimes", 400
            )
        if end <= start:
            return error_response("Slot end_time must be after start_time", 400)
        # teacher_id is an FK to users — validate it belongs to this school
        # so a bogus id returns 400 instead of an IntegrityError 500.
        teacher_id = s.get("teacher_id", g.current_user.id)
        teacher = None
        if _valid_uuid(teacher_id):
            teacher = User.query.filter_by(
                id=teacher_id, school_id=g.school_id
            ).first()
        if not teacher:
            return error_response(
                "teacher_id does not match a user at this school", 400
            )
        slot = ConferenceSlot(
            conference_id=conf_id,
            school_id=g.school_id,
            teacher_id=teacher.id,
            start_time=start,
            end_time=end,
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
    # student_id is an FK to students — a bogus id must 400, not 500.
    student_id = data.get("student_id")
    if student_id:
        student = None
        if _valid_uuid(student_id):
            student = Student.query.filter_by(
                id=student_id, school_id=g.school_id, is_deleted=False
            ).first()
        if not student:
            return error_response(
                "student_id does not match a student at this school", 400
            )
    # E193: the booking is attributed to the CALLER. Only school admins may
    # book on behalf of another parent (validated to exist in this school) —
    # a parent passing someone else's parent_id must not be able to frame
    # the booking record.
    role = getattr(g.current_user, "role", None)
    parent_id = g.current_user.id
    if data.get("parent_id") and role in ("superadmin", "school_admin"):
        delegate = User.query.filter_by(
            id=data["parent_id"], school_id=g.school_id, is_deleted=False
        ).first() if _valid_uuid(data["parent_id"]) else None
        if not delegate:
            return error_response(
                "parent_id does not match a user at this school", 400
            )
        parent_id = delegate.id
    slot.is_booked = True
    slot.parent_id = parent_id
    slot.student_id = student_id
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
    # E193: only the booking parent, the slot's teacher, or a school admin
    # may cancel — an unrelated user must not free someone else's slot.
    role = getattr(g.current_user, "role", None)
    is_admin = role in ("superadmin", "school_admin")
    is_booking_parent = slot.parent_id is not None and str(slot.parent_id) == str(g.current_user.id)
    is_slot_teacher = slot.teacher_id is not None and str(slot.teacher_id) == str(g.current_user.id)
    if not (is_admin or is_booking_parent or is_slot_teacher):
        return error_response("Not authorized to cancel this booking", 403)
    slot.is_booked = False
    slot.parent_id = None
    slot.student_id = None
    db.session.commit()
    return success_response(_slot_dict(slot))


# ── Conference Notes ───────────────────────────────────────


def _notes_participant(slot) -> bool:
    """E193: notes are private to the slot's participants — the booked
    parent, the slot's teacher, and school admins. Everyone else (other
    parents, other teachers) is excluded from both reads and writes."""
    if getattr(g.current_user, "role", None) in ("superadmin", "school_admin"):
        return True
    user_id = str(g.current_user.id)
    return (
        slot.parent_id is not None and str(slot.parent_id) == user_id
    ) or (
        slot.teacher_id is not None and str(slot.teacher_id) == user_id
    )


@conferences_bp.route("/slots/<uuid:slot_id>/notes", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("conferences")
def get_notes(slot_id):
    slot = ConferenceSlot.query.filter_by(
        id=slot_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not slot:
        return error_response("Slot not found", 404)
    if not _notes_participant(slot):
        return error_response("Not authorized to view these notes", 403)
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
    slot = ConferenceSlot.query.filter_by(
        id=slot_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not slot:
        return error_response("Slot not found", 404)
    # E193: a teacher who does not own the slot must not write (or read by
    # blind write) another teacher's conference notes.
    role = getattr(g.current_user, "role", None)
    if role == "teacher" and str(slot.teacher_id) != str(g.current_user.id):
        return error_response("Not authorized to write these notes", 403)
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
        # E192: degrade to None instead of OverflowError-500 on legacy
        # out-of-range dates.
        "start_date_bs": _bs_or_none(c.start_date),
        "end_date_bs": _bs_or_none(c.end_date),
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
