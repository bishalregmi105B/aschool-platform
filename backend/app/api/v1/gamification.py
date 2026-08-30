"""Gamification API — badges, points, leaderboard, houses, rewards."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.gamification import Badge, StudentBadge, PointsLog, House, Reward
from app.models.student import Student
from app.models.academic import Class
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

gamification_bp = Blueprint("gamification", __name__, url_prefix="/gamification")


# ── Badges ─────────────────────────────────────────────────


@gamification_bp.route("/badges", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gamification")
def list_badges():
    query = Badge.query.filter_by(school_id=g.school_id, is_deleted=False)
    items, meta = paginate(query.order_by(Badge.name))
    return success_response([_badge_dict(b) for b in items], meta={"pagination": meta})


@gamification_bp.route("/badges", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gamification")
@role_required("superadmin", "school_admin")
def create_badge():
    data = request.get_json(silent=True) or {}
    if not (data.get("name") or "").strip():
        return error_response("name is required", 400)
    badge = Badge(school_id=g.school_id)
    for key in ("name", "name_nepali", "description", "icon_url", "criteria",
                "points_value", "is_active"):
        if key in data:
            setattr(badge, key, data[key])
    db.session.add(badge)
    db.session.commit()
    return created_response(_badge_dict(badge))


@gamification_bp.route("/badges/<uuid:badge_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("gamification")
@role_required("superadmin", "school_admin")
def update_badge(badge_id):
    badge = Badge.query.filter_by(id=badge_id, school_id=g.school_id, is_deleted=False).first()
    if not badge:
        return error_response("Badge not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("name", "name_nepali", "description", "icon_url", "criteria",
                "points_value", "is_active"):
        if key in data:
            setattr(badge, key, data[key])
    db.session.commit()
    return success_response(_badge_dict(badge))


# ── Award Points ───────────────────────────────────────────


@gamification_bp.route("/points", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gamification")
@role_required("superadmin", "school_admin", "teacher")
def award_points():
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    points = data.get("points", 0)
    if not student_id or not points:
        return error_response("student_id and points are required", 400)
    if isinstance(points, bool) or not isinstance(points, int):
        return error_response("points must be an integer", 400)
    if not Student.query.filter_by(id=student_id, school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)

    log = PointsLog(
        school_id=g.school_id,
        student_id=student_id,
        points=points,
        reason=data.get("reason", ""),
        category=data.get("category", "general"),
        awarded_by_id=g.current_user.id,
    )
    db.session.add(log)
    db.session.commit()

    from app.plugins.events import emit
    emit("gamification.points_awarded", school_id=str(g.school_id),
         student_id=student_id, points=points)

    return created_response(_points_dict(log))


@gamification_bp.route("/points/<uuid:student_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gamification")
def student_points(student_id):
    query = PointsLog.query.filter_by(
        school_id=g.school_id, student_id=student_id, is_deleted=False
    )
    items, meta = paginate(query.order_by(PointsLog.created_at.desc()))
    from sqlalchemy import func
    total = db.session.query(func.coalesce(func.sum(PointsLog.points), 0)).filter_by(
        school_id=g.school_id, student_id=student_id, is_deleted=False
    ).scalar()
    return success_response({
        "total_points": int(total),
        "logs": [_points_dict(p) for p in items],
    }, meta={"pagination": meta})


# ── Award Badge ────────────────────────────────────────────


@gamification_bp.route("/award-badge", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gamification")
@role_required("superadmin", "school_admin", "teacher")
def award_badge():
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    badge_id = data.get("badge_id")
    if not student_id or not badge_id:
        return error_response("student_id and badge_id are required", 400)
    if not Student.query.filter_by(id=student_id, school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)
    if not Badge.query.filter_by(id=badge_id, school_id=g.school_id, is_deleted=False).first():
        return error_response("badge_id does not match a badge at this school", 400)
    # dedup guard (E131): the web "Award to student" dialog can be submitted
    # repeatedly for the same student+badge pair, stacking a duplicate
    # StudentBadge row in every badge consumer (student/parent badge lists).
    if StudentBadge.query.filter_by(
        student_id=student_id, badge_id=badge_id, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("This student already has this badge", 409)

    from datetime import datetime, timezone
    sb = StudentBadge(
        school_id=g.school_id,
        student_id=student_id,
        badge_id=badge_id,
        awarded_at=datetime.now(timezone.utc),
        awarded_by_id=g.current_user.id,
    )
    db.session.add(sb)
    db.session.commit()

    from app.plugins.events import emit
    emit("gamification.badge_earned", school_id=str(g.school_id),
         student_id=student_id, badge_id=badge_id)

    return created_response({"student_id": student_id, "badge_id": badge_id})


# ── Leaderboard ────────────────────────────────────────────


@gamification_bp.route("/leaderboard", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gamification")
def leaderboard():
    from sqlalchemy import func
    results = (
        db.session.query(
            PointsLog.student_id,
            func.sum(PointsLog.points).label("total_points"),
            Student.first_name,
            Student.last_name,
            Class.name.label("class_name"),
        )
        .join(Student, Student.id == PointsLog.student_id)
        .outerjoin(Class, Class.id == Student.class_id)
        .filter(PointsLog.school_id == g.school_id, PointsLog.is_deleted.is_(False))
        .group_by(PointsLog.student_id, Student.first_name, Student.last_name, Class.name)
        .order_by(func.sum(PointsLog.points).desc())
        .limit(request.args.get("limit", request.args.get("top", 50), type=int))
        .all()
    )
    return success_response([
        {
            "rank": idx + 1,
            "student_id": str(r.student_id),
            # frontend leaderboard renders entry.student_name
            "student_name": f"{r.first_name} {r.last_name}".strip() if r.first_name else None,
            "total_points": int(r.total_points),
            # frontend leaderboard renders entry.class_name (real class, "—" if none)
            "class_name": r.class_name,
        }
        for idx, r in enumerate(results)
    ])


# ── Houses ─────────────────────────────────────────────────


@gamification_bp.route("/houses", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gamification")
def list_houses():
    items = House.query.filter_by(school_id=g.school_id, is_deleted=False).order_by(
        House.total_points.desc()
    ).all()
    return success_response([_house_dict(h) for h in items])


@gamification_bp.route("/houses", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gamification")
@role_required("superadmin", "school_admin")
def create_house():
    data = request.get_json(silent=True) or {}
    if not (data.get("name") or "").strip():
        return error_response("name is required", 400)
    house = House(school_id=g.school_id)
    for key in ("name", "color", "motto", "logo_url", "captain_id"):
        if key in data:
            setattr(house, key, data[key])
    db.session.add(house)
    db.session.commit()
    return created_response(_house_dict(house))


# ── Rewards ────────────────────────────────────────────────


@gamification_bp.route("/rewards", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gamification")
def list_rewards():
    items = Reward.query.filter_by(school_id=g.school_id, is_deleted=False, is_active=True).all()
    return success_response([_reward_dict(r) for r in items])


@gamification_bp.route("/rewards", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gamification")
@role_required("superadmin", "school_admin")
def create_reward():
    data = request.get_json(silent=True) or {}
    if not (data.get("name") or "").strip():
        return error_response("name is required", 400)
    if not isinstance(data.get("points_required"), int) or isinstance(data.get("points_required"), bool):
        return error_response("points_required must be an integer", 400)
    reward = Reward(school_id=g.school_id)
    for key in ("name", "description", "points_required", "icon_url",
                "quantity_available", "is_active"):
        if key in data:
            setattr(reward, key, data[key])
    db.session.add(reward)
    db.session.commit()
    return created_response(_reward_dict(reward))


# ── Serializers ────────────────────────────────────────────


def _badge_dict(b):
    return {
        "id": str(b.id), "name": b.name, "name_nepali": b.name_nepali,
        "description": b.description, "icon_url": b.icon_url,
        "criteria": b.criteria, "points_value": b.points_value,
        "is_active": b.is_active,
    }


def _points_dict(p):
    return {
        "id": str(p.id), "student_id": str(p.student_id),
        "points": p.points, "reason": p.reason, "category": p.category,
        "awarded_by_id": str(p.awarded_by_id) if p.awarded_by_id else None,
        "created_at": str(p.created_at),
    }


def _house_dict(h):
    return {
        "id": str(h.id), "name": h.name, "color": h.color,
        "motto": h.motto, "logo_url": h.logo_url,
        "total_points": h.total_points,
        "captain_id": str(h.captain_id) if h.captain_id else None,
    }


def _reward_dict(r):
    return {
        "id": str(r.id), "name": r.name, "description": r.description,
        "points_required": r.points_required, "icon_url": r.icon_url,
        "quantity_available": r.quantity_available, "is_active": r.is_active,
    }
