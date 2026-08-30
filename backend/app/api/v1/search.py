"""Unified search API — queries students, users, notices in one call."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_, func

from app.utils.decorators import school_required
from app.utils.response import success_response
from app.utils.teacher_scope import teacher_allowed_class_ids
from extensions import db

search_bp = Blueprint("search", __name__, url_prefix="/search")


@search_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def unified_search():
    """Search students, users, and notices by query string."""
    q = (request.args.get("q") or "").strip()
    # E168: int(request.args["limit"]) 500ed on non-numeric values and the
    # negative value slipped through to SQL LIMIT. Clamp to [1, 25].
    try:
        limit = min(max(int(request.args.get("limit", 8)), 1), 25)
    except (TypeError, ValueError):
        limit = 8

    if len(q) < 2:
        return success_response([])

    results = []
    pattern = f"%{q}%"

    # Search students
    from app.models.student import Student

    student_query = Student.query.filter(
        Student.school_id == g.school_id,
        Student.is_deleted == False,
        or_(
            Student.first_name.ilike(pattern),
            Student.last_name.ilike(pattern),
            Student.student_id.ilike(pattern),
        ),
    )

    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        if not allowed_class_ids:
            students = []
        else:
            students = student_query.filter(Student.class_id.in_(allowed_class_ids)).limit(limit).all()
    else:
        students = student_query.limit(limit).all()

    for s in students:
        results.append(
            {
                "type": "student",
                "id": str(s.id),
                "title": f"{s.first_name} {s.last_name}",
                "subtitle": f"ID: {s.student_id}" if s.student_id else None,
                "url": f"/dashboard/students?highlight={s.id}",
            }
        )

    # Search users/staff
    from app.models.user import User

    users = (
        User.query.filter(
            User.school_id == g.school_id,
            User.is_deleted == False,
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.phone.ilike(pattern),
            ),
        )
        .limit(limit)
        .all()
    )
    for u in users:
        results.append(
            {
                "type": "user",
                "id": str(u.id),
                "title": u.full_name,
                "subtitle": u.role,
                "url": f"/dashboard/users?highlight={u.id}",
            }
        )

    # Search notices
    from app.models.notice import Notice

    notices = (
        Notice.query.filter(
            Notice.school_id == g.school_id,
            Notice.is_deleted == False,
            Notice.title.ilike(pattern),
        )
        .limit(limit)
        .all()
    )
    for n in notices:
        results.append(
            {
                "type": "notice",
                "id": str(n.id),
                "title": n.title,
                "subtitle": "Notice",
                "url": "/dashboard/notices",
            }
        )

    # Trim to overall limit
    return success_response(results[:limit])
