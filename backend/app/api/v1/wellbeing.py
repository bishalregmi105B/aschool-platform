"""Wellbeing API — mood tracking, counselor notes, wellbeing surveys."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.wellbeing import MoodEntry, CounselorNote, WellbeingSurvey
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

wellbeing_bp = Blueprint("wellbeing", __name__, url_prefix="/wellbeing")


# ── Mood Tracking ─────────────────────────────────────────

@wellbeing_bp.route("/mood", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
def list_mood_entries():
    query = MoodEntry.query.filter_by(school_id=g.school_id)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    query = query.order_by(MoodEntry.created_at.desc())
    items, meta = paginate(query)
    return success_response([_mood_dict(m) for m in items], meta={"pagination": meta})


@wellbeing_bp.route("/mood", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
def submit_mood():
    """Students submit daily mood check-in."""
    data = request.get_json(silent=True) or {}
    if not data.get("mood"):
        return error_response("mood is required", 400)
    energy_level = data.get("energy_level")
    if energy_level is not None:
        try:
            energy_level = int(energy_level)
        except (TypeError, ValueError):
            return error_response("energy_level must be an integer (1-5)", 400)
    student_id = data.get("student_id")
    if student_id:
        # admins/teachers may log on behalf of a student — must belong to school
        if not Student.query.filter_by(id=student_id, school_id=g.school_id).first():
            return error_response("student_id does not match a student at this school", 400)
    else:
        # default: the logged-in user's own student profile (a User id is NOT a
        # student_id — inserting it used to violate the FK and 500)
        student = Student.query.filter_by(user_id=g.current_user.id, school_id=g.school_id).first()
        if not student:
            return error_response("student_id is required (current user has no student profile)", 400)
        student_id = str(student.id)
    entry = MoodEntry(
        school_id=g.school_id,
        student_id=student_id,
        mood=data.get("mood"),  # happy, okay, neutral, sad, anxious, angry
        energy_level=energy_level,  # 1-5
        notes=data.get("notes", ""),
    )
    db.session.add(entry)
    db.session.commit()
    return created_response(_mood_dict(entry))


@wellbeing_bp.route("/mood/summary", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
def mood_summary():
    """Aggregate mood summary for a class or school."""
    from sqlalchemy import func, cast
    from datetime import datetime, timedelta

    days = int(request.args.get("days", 7))
    since = datetime.utcnow() - timedelta(days=days)

    results = db.session.query(
        MoodEntry.mood, func.count(MoodEntry.id)
    ).filter(
        MoodEntry.school_id == g.school_id,
        MoodEntry.created_at >= since,
    ).group_by(MoodEntry.mood).all()

    return success_response({
        "period_days": days,
        "mood_distribution": {mood: count for mood, count in results},
        "total_entries": sum(c for _, c in results),
    })


# ── Counselor Notes ───────────────────────────────────────

@wellbeing_bp.route("/counselor-notes", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
@role_required("superadmin", "school_admin", "teacher")
def list_counselor_notes():
    query = CounselorNote.query.filter_by(school_id=g.school_id)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    query = query.order_by(CounselorNote.created_at.desc())
    items, meta = paginate(query)
    return success_response([_note_dict(n) for n in items], meta={"pagination": meta})


@wellbeing_bp.route("/counselor-notes", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
@role_required("superadmin", "school_admin", "teacher")
def create_counselor_note():
    data = request.get_json(silent=True) or {}
    if not data.get("student_id"):
        return error_response("student_id is required", 400)
    if not Student.query.filter_by(id=data["student_id"], school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)
    note = CounselorNote(
        school_id=g.school_id,
        student_id=data["student_id"],
        counselor_id=g.current_user.id,
        note_type=data.get("type", "general"),
        content=data.get("content", ""),
        is_confidential=data.get("is_confidential", True),
    )
    db.session.add(note)
    db.session.commit()
    return created_response(_note_dict(note))


# ── Surveys ───────────────────────────────────────────────

@wellbeing_bp.route("/surveys", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
def list_surveys():
    query = WellbeingSurvey.query.filter_by(school_id=g.school_id)
    items, meta = paginate(query)
    return success_response([_survey_dict(s) for s in items], meta={"pagination": meta})


@wellbeing_bp.route("/surveys", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("wellbeing")
@role_required("superadmin", "school_admin")
def create_survey():
    data = request.get_json(silent=True) or {}
    survey = WellbeingSurvey(
        school_id=g.school_id,
        title=data.get("title", ""),
        questions=data.get("questions", []),
        target_class_ids=data.get("target_class_ids") or [],
        is_anonymous=data.get("is_anonymous", True),
        is_active=data.get("is_active", True),
    )
    db.session.add(survey)
    db.session.commit()
    return created_response(_survey_dict(survey))


def _mood_dict(m):
    student = m.student if hasattr(m, "student") else None
    return {
        "id": str(m.id), "student_id": str(m.student_id) if m.student_id else None, "mood": m.mood,
        # web mood tracker renders the student's name, not the raw uuid
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "energy_level": m.energy_level, "notes": m.notes,
        "created_at": str(m.created_at) if m.created_at else None,
    }


def _note_dict(n):
    student = n.student if hasattr(n, "student") else None
    return {
        "id": str(n.id),
        "student_id": str(n.student_id) if n.student_id else None,
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "counselor_id": str(n.counselor_id) if n.counselor_id else None,
        "note_type": n.note_type, "content": n.content, "is_confidential": n.is_confidential,
        "created_at": str(n.created_at) if n.created_at else None,
    }


def _survey_dict(s):
    return {
        "id": str(s.id),
        "title": s.title,
        "questions": s.questions or [],
        "target_class_ids": s.target_class_ids or [],
        "target_audience": "all" if not s.target_class_ids else "classes",
        "is_anonymous": s.is_anonymous,
        "is_active": s.is_active,
    }
