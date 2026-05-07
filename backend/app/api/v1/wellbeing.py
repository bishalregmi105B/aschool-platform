"""Wellbeing API — mood tracking, counselor notes, wellbeing surveys."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.wellbeing import MoodEntry, CounselorNote, WellbeingSurvey
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, success_response
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
    entry = MoodEntry(
        school_id=g.school_id,
        student_id=data.get("student_id", g.current_user.id),
        mood=data.get("mood"),  # happy, neutral, sad, anxious, angry
        energy_level=data.get("energy_level"),  # 1-5
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
    return {
        "id": str(m.id), "student_id": str(m.student_id) if m.student_id else None, "mood": m.mood,
        "energy_level": m.energy_level, "notes": m.notes,
        "created_at": str(m.created_at) if m.created_at else None,
    }


def _note_dict(n):
    return {
        "id": str(n.id),
        "student_id": str(n.student_id) if n.student_id else None,
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
