"""Timetable API — view and generate timetables."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.timetable import TimetableSlot
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
    query = TimetableSlot.query.filter_by(school_id=g.school_id)
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
    """Save a generated timetable to the database."""
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    # Clear existing slots
    TimetableSlot.query.filter_by(school_id=g.school_id).delete()
    saved = TimetableSolverService.save_timetable(g.school_id, data)
    db.session.commit()
    return success_response({"saved_slots": saved})


@timetable_bp.route("/slots", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("timetable")
@role_required("superadmin", "school_admin")
def create_slot():
    """Manually create a single timetable slot."""
    data = request.get_json(silent=True) or {}
    slot = TimetableSlot(school_id=g.school_id)
    for key in ("class_id", "section_id", "subject_id", "teacher_id", "day_of_week", "period_number", "start_time", "end_time", "room"):
        if key in data:
            setattr(slot, key, data[key])
    db.session.add(slot)
    db.session.commit()
    return created_response(_slot_dict(slot))


@timetable_bp.route("/slots/<slot_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("timetable")
@role_required("superadmin", "school_admin")
def delete_slot(slot_id):
    slot = TimetableSlot.query.filter_by(id=slot_id, school_id=g.school_id).first_or_404()
    db.session.delete(slot)
    db.session.commit()
    return success_response({"deleted": True})


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
