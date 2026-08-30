"""Plan-compatible staff API."""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.models.user import User
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from app.utils.password import generate_default_password
from extensions import db

staff_bp = Blueprint("staff", __name__, url_prefix="/staff")


STAFF_ROLES = ("teacher", "staff", "accountant", "school_admin")


@staff_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def list_staff():
    query = User.query.filter(
        User.school_id == g.school_id,
        User.is_deleted.is_(False),
        User.role.in_(STAFF_ROLES),
    )

    role = request.args.get("role")
    if role:
        query = query.filter(User.role == role)

    search = request.args.get("search")
    if search:
        query = query.filter(User.full_name.ilike(f"%{search}%"))

    staff = query.order_by(User.full_name.asc()).all()
    return success_response([member.to_dict() for member in staff])


@staff_bp.route("/stats", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def stats():
    rows = (
        db.session.query(User.role, func.count(User.id))
        .filter(
            User.school_id == g.school_id,
            User.is_deleted.is_(False),
            User.role.in_(STAFF_ROLES),
        )
        .group_by(User.role)
        .all()
    )
    counts = {role: count for role, count in rows}
    return success_response(
        {
            "total_staff": sum(counts.values()),
            "teachers": counts.get("teacher", 0),
            "support_staff": counts.get("staff", 0),
            "accountants": counts.get("accountant", 0),
            "admins": counts.get("school_admin", 0),
        }
    )


@staff_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_staff():
    data = request.get_json(silent=True) or {}
    if data.get("role") not in STAFF_ROLES:
        return error_response("role must be one of teacher, staff, accountant, school_admin")
    # E126: users.phone is NOT NULL — a missing phone used to surface as an
    # unhandled IntegrityError 500 instead of a clear 400.
    if not (data.get("phone") or "").strip():
        return error_response("phone is required")

    # E160 hardening: mirror users.create_user — reject duplicate phones with
    # a 409 (the DB has no unique constraint, so it silently created a second
    # account that login_with_password could not disambiguate) and enforce the
    # password policy for user-chosen passwords.
    existing = User.query.filter_by(
        phone=data["phone"], school_id=g.school_id, is_deleted=False
    ).first()
    if existing:
        return error_response("User with this phone already exists in this school", 409)

    user = User(school_id=g.school_id)
    for key in ("full_name", "full_name_nepali", "email", "phone", "role", "avatar_url", "gender"):
        if key in data:
            setattr(user, key, data[key])
    if data.get("password"):
        from app.utils.validators import validate_password_strength

        ok, pw_error = validate_password_strength(data["password"])
        if not ok:
            return error_response(pw_error, 400)
        user.set_password(data["password"])
    else:
        user.set_password(generate_default_password(user))

    db.session.add(user)
    db.session.commit()
    return created_response(user.to_dict())
