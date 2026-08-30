"""Timetable API — view and generate timetables."""
import uuid as uuid_mod
from datetime import time

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.academic import Class, Section, Subject
from app.models.timetable import TimetableSlot
from app.models.user import User
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

timetable_bp = Blueprint("timetable", __name__, url_prefix="/timetable")


@timetable_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("timetable")
def get_timetable():
    """Get timetable, optionally filtered by class/section/teacher/day."""
    query = TimetableSlot.query.filter_by(school_id=g.school_id, is_deleted=False)
    class_id = request.args.get("class_id")
    section_id = request.args.get("section_id")
    teacher_id = request.args.get("teacher_id")
    day = request.args.get("day")

    if class_id:
        query = query.filter_by(class_id=class_id)
    if section_id:
        query = query.filter_by(section_id=section_id)
    if teacher_id:
        query = query.filter_by(teacher_id=teacher_id)
    if day:
        query = query.filter_by(day_of_week=day)

    query = query.order_by(TimetableSlot.day_of_week, TimetableSlot.period_number)
    slots = query.all()
    return success_response([_slot_dict(s) for s in slots])


@timetable_bp.route("/teacher/<teacher_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("timetable")
def get_teacher_timetable_compat(teacher_id):
    query = TimetableSlot.query.filter_by(
        school_id=g.school_id,
        teacher_id=teacher_id,
        is_deleted=False,
    ).order_by(TimetableSlot.day_of_week, TimetableSlot.period_number)
    return success_response([_slot_dict(slot) for slot in query.all()])


@timetable_bp.route("/generate", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("timetable")
@role_required("superadmin", "school_admin")
def generate_timetable():
    """Auto-generate a clash-free timetable using AI solver."""
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    result = TimetableSolverService.generate_timetable(
        school_id=g.school_id,
        academic_year_id=data.get("academic_year_id", ""),
        days=data.get("days"),
        periods_per_day=data.get("periods_per_day", 8),
        period_duration=data.get("period_duration", 45),
        start_time=data.get("start_time", "10:00"),
    )
    return success_response(result)


@timetable_bp.route("/save", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("timetable")
@role_required("superadmin", "school_admin")
def save_timetable():
    """Save a generated timetable to the database.

    Scoped replace: only the (class_id, section_id) pairs present in the
    payload are cleared and re-saved. Manually created slots for classes NOT
    in the payload survive — matching the frontend's documented promise that
    manual slots are not affected by generation.
    """
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    pairs = [
        (cls_data.get("class_id"), cls_data.get("section_id"))
        for cls_data in data.get("classes", [])
        if cls_data.get("class_id")
    ]
    for class_id, section_id in pairs:
        query = TimetableSlot.query.filter_by(
            school_id=g.school_id, class_id=class_id, is_deleted=False
        )
        if section_id:
            query = query.filter_by(section_id=section_id)
        query.delete(synchronize_session=False)
    saved = TimetableSolverService.save_timetable(g.school_id, data)
    db.session.commit()
    return success_response({"saved_slots": saved})


@timetable_bp.route("/slots", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("timetable")
@role_required("superadmin", "school_admin")
def create_slot():
    """Manually create a single timetable slot.

    Conflict detection: a slot occupies (day_of_week, period_number) — and, when
    times are given, its time window. The slot is rejected with 409 when the
    same day+period (or an overlapping time window) is already occupied by:
    - the same class/section (double-booked classroom), or
    - the same teacher (teacher double-booked, e.g. two sections at once).
    A free slot is accepted.
    """
    data = request.get_json(silent=True) or {}
    day = data.get("day_of_week")
    period = data.get("period_number")
    class_id = _coerce_uuid(data.get("class_id"))
    section_id = _coerce_uuid(data.get("section_id"))
    subject_id = _coerce_uuid(data.get("subject_id"))
    teacher_id = _coerce_uuid(data.get("teacher_id"))
    start_time = _parse_time(data.get("start_time"))
    end_time = _parse_time(data.get("end_time"))

    if not day or period is None or not class_id:
        return error_response(
            "class_id, day_of_week and period_number are required", 400
        )
    try:
        period = int(period)
    except (TypeError, ValueError):
        return error_response("period_number must be an integer", 400)
    if "section_id" in data and data["section_id"] and not section_id:
        return error_response("section_id is not a valid id", 400)
    if "subject_id" in data and data["subject_id"] and not subject_id:
        return error_response("subject_id is not a valid id", 400)
    if "teacher_id" in data and data["teacher_id"] and not teacher_id:
        return error_response("teacher_id is not a valid id", 400)
    if "start_time" in data and data["start_time"] and not start_time:
        return error_response("start_time is not a valid time (HH:MM)", 400)
    if "end_time" in data and data["end_time"] and not end_time:
        return error_response("end_time is not a valid time (HH:MM)", 400)
    if start_time and end_time and end_time <= start_time:
        return error_response("end_time must be after start_time", 400)

    # FK scope checks: a valid-UUID but unknown class/subject/teacher would
    # otherwise pass validation and die at commit with an FK IntegrityError 500.
    if not Class.query.filter_by(id=class_id, school_id=g.school_id, is_deleted=False).first():
        return error_response("class_id does not match a class at this school", 400)
    if section_id and not Section.query.filter_by(
        id=section_id, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("section_id does not match a section at this school", 400)
    if subject_id and not Subject.query.filter_by(
        id=subject_id, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("subject_id does not match a subject at this school", 400)
    if teacher_id and not User.query.filter_by(
        id=teacher_id, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("teacher_id does not match a user at this school", 400)

    clash_filters = [
        TimetableSlot.school_id == g.school_id,
        TimetableSlot.is_deleted.is_(False),
        TimetableSlot.day_of_week == day,
    ]
    if start_time and end_time:
        # Same period number, or any slot whose time window overlaps the new one.
        clash_filters.append(
            db.or_(
                TimetableSlot.period_number == period,
                db.and_(
                    TimetableSlot.start_time.isnot(None),
                    TimetableSlot.end_time.isnot(None),
                    TimetableSlot.start_time < end_time,
                    TimetableSlot.end_time > start_time,
                ),
            )
        )
    else:
        clash_filters.append(TimetableSlot.period_number == period)

    class_clash = None
    teacher_clash = None
    for existing in TimetableSlot.query.filter(*clash_filters).all():
        # Two slots overlap for the class when they target the same section,
        # or when either side is class-wide (section NULL = every section of
        # the class). Without the class-wide rule a manual "All sections" slot
        # and a generated section slot could silently double-book the same
        # period (E102).
        same_class_section = str(existing.class_id) == str(class_id) and (
            str(existing.section_id or "") == str(section_id or "")
            or existing.section_id is None
            or section_id is None
        )
        if same_class_section:
            class_clash = existing
            break
        if (
            teacher_id
            and existing.teacher_id
            and str(existing.teacher_id) == str(teacher_id)
        ):
            teacher_clash = existing
            break

    if class_clash:
        return error_response(
            f"Slot conflict: this class/section already has a lesson on {day} "
            f"(period {class_clash.period_number})", 409
        )
    if teacher_clash:
        return error_response(
            f"Slot conflict: the teacher is already booked on {day} "
            f"(period {teacher_clash.period_number})", 409
        )

    slot = TimetableSlot(
        school_id=g.school_id,
        class_id=class_id,
        section_id=section_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        day_of_week=day,
        period_number=period,
        start_time=start_time,
        end_time=end_time,
        room=data.get("room"),
    )
    db.session.add(slot)
    db.session.commit()
    return created_response(_slot_dict(slot))


@timetable_bp.route("/slots/<slot_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("timetable")
@role_required("superadmin", "school_admin")
def delete_slot(slot_id):
    slot_uuid = _coerce_uuid(slot_id)
    slot = (
        TimetableSlot.query.filter_by(id=slot_uuid, school_id=g.school_id).first()
        if slot_uuid
        else None
    )
    if not slot:
        return error_response("Slot not found", 404)
    db.session.delete(slot)
    db.session.commit()
    return success_response({"deleted": True})


def _coerce_uuid(value):
    """Coerce to UUID; None when absent/not a valid UUID (garbage ids would
    otherwise reach the ORM and die with a DataError 500)."""
    if isinstance(value, uuid_mod.UUID):
        return value
    if not value:
        return None
    try:
        return uuid_mod.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _parse_time(value):
    """Parse 'HH:MM' / 'HH:MM:SS' into a time; None when absent/invalid."""
    if not value:
        return None
    if isinstance(value, time):
        return value
    try:
        parts = str(value).split(":")
        return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    except (TypeError, ValueError, IndexError):
        return None


def _slot_dict(s):
    time_label = ""
    if s.start_time and s.end_time:
        time_label = f"{s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')}"
    return {
        "id": str(s.id),
        "class_id": str(s.class_id) if s.class_id else None,
        "class_name": s.klass.name if s.klass else None,
        "section_id": str(s.section_id) if s.section_id else None,
        "section_name": s.section.name if s.section else None,
        "subject_id": str(s.subject_id) if s.subject_id else None,
        "subject_name": s.subject.name if s.subject else None,
        "subject": s.subject.name if s.subject else ("Break" if s.is_break else None),
        "teacher_id": str(s.teacher_id) if s.teacher_id else None,
        "teacher_name": s.teacher.full_name if s.teacher else None,
        "teacher": s.teacher.full_name if s.teacher else None,
        "day_of_week": s.day_of_week,
        "day": s.day_of_week,
        "period_number": s.period_number,
        "start_time": str(s.start_time) if s.start_time else None,
        "end_time": str(s.end_time) if s.end_time else None,
        "time": time_label,
        "room": s.room if hasattr(s, "room") else None,
        "is_break": s.is_break,
    }
