"""Users CRUD API."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.academic import Section, Subject
from app.models.student import Guardian, Student
from app.models.user import User
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from app.utils.password import generate_default_password
from extensions import db

users_bp = Blueprint("users", __name__, url_prefix="/users")


@users_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "accountant", "teacher", "staff")
def list_users():
    """List users for the current school."""
    query = User.query.filter_by(school_id=g.school_id, is_deleted=False)

    role = request.args.get("role")
    if role:
        query = query.filter_by(role=role)

    search = request.args.get("search")
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%")
            | User.phone.ilike(f"%{search}%")
            | User.email.ilike(f"%{search}%")
        )

    is_active = request.args.get("is_active")
    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == "true")

    query = query.order_by(User.full_name)
    items, meta = paginate(query)
    return success_response([_user_dict(u) for u in items], meta={"pagination": meta})


@users_bp.route("/<uuid:user_id>", methods=["GET"])
@jwt_required()
@school_required
def get_user(user_id):
    """Get a single user."""
    user = User.query.get(user_id)
    if not user or user.is_deleted or str(user.school_id) != str(g.school_id):
        return error_response("User not found", 404)
    return success_response(_user_dict(user))


@users_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_user():
    """Create a new user for the current school."""
    data = request.get_json(silent=True) or {}
    required = ["full_name", "phone", "role"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", 400)

    valid_roles = {"school_admin", "accountant", "teacher", "staff", "parent", "student"}
    if data["role"] not in valid_roles:
        return error_response(f"Invalid role. Must be one of: {', '.join(sorted(valid_roles))}", 400)

    # Check duplicate phone within school
    existing = User.query.filter_by(
        phone=data["phone"], school_id=g.school_id, is_deleted=False
    ).first()
    if existing:
        return error_response("User with this phone already exists in this school", 409)

    user = User(school_id=g.school_id)
    _populate_user(user, data)

    if data.get("password"):
        user.set_password(data["password"])
    else:
        user.set_password(generate_default_password(user))

    db.session.add(user)
    db.session.commit()
    return created_response(_user_dict(user))


@users_bp.route("/<uuid:user_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_user(user_id):
    """Update a user."""
    user = User.query.get(user_id)
    if not user or user.is_deleted or str(user.school_id) != str(g.school_id):
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    _populate_user(user, data)

    if data.get("password"):
        user.set_password(data["password"])

    db.session.commit()
    return success_response(_user_dict(user))


@users_bp.route("/<uuid:user_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_user(user_id):
    """Soft-delete a user."""
    user = User.query.get(user_id)
    if not user or user.is_deleted or str(user.school_id) != str(g.school_id):
        return error_response("User not found", 404)
    user.soft_delete()
    return no_content_response()


@users_bp.route("/<uuid:user_id>/toggle-active", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def toggle_user_active(user_id):
    """Activate/deactivate a user."""
    user = User.query.get(user_id)
    if not user or user.is_deleted or str(user.school_id) != str(g.school_id):
        return error_response("User not found", 404)
    user.is_active = not user.is_active
    db.session.commit()
    return success_response(_user_dict(user))


@users_bp.route("/<uuid:user_id>/children/<uuid:student_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def unlink_parent_child(user_id, student_id):
    """Unlink a child from a parent user by soft-deleting guardian links."""
    user = User.query.get(user_id)
    if not user or user.is_deleted or str(user.school_id) != str(g.school_id):
        return error_response("User not found", 404)

    if user.role != "parent":
        return error_response("User is not a parent", 400)

    links = Guardian.query.filter_by(
        school_id=g.school_id,
        user_id=user.id,
        student_id=student_id,
        is_deleted=False,
    ).all()
    if not links:
        return error_response("Parent-child link not found", 404)

    for link in links:
        link.soft_delete()

    db.session.commit()
    return success_response({"removed": len(links)})


def _populate_user(user: User, data: dict):
    """Set allowed fields on user from request data."""
    allowed = {
        "full_name", "full_name_nepali", "email", "phone", "role",
        "avatar_url", "gender", "dob_bs", "dob_ad", "address",
        "preferred_language", "permissions", "is_active",
    }
    for key in allowed:
        if key in data:
            setattr(user, key, data[key])


def _user_dict(user: User):
    data = user.to_dict()

    if user.role == "parent":
        guardian_rows = Guardian.query.filter_by(
            school_id=user.school_id,
            user_id=user.id,
            is_deleted=False,
        ).all()
        student_ids = {row.student_id for row in guardian_rows if row.student_id}
        data["children_count"] = len(student_ids)

        if student_ids:
            students = Student.query.filter(
                Student.school_id == user.school_id,
                Student.id.in_(list(student_ids)),
                Student.is_deleted.is_(False),
            ).order_by(Student.first_name, Student.last_name).all()
            data["children"] = [
                {
                    "id": str(student.id),
                    "name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                    "class_name": student.klass.name if student.klass else None,
                    "section_name": student.section.name if student.section else None,
                    "student_id": student.student_id,
                }
                for student in students
            ]
        else:
            data["children"] = []

    if user.role != "teacher":
        return data

    subjects = (
        Subject.query.filter_by(school_id=user.school_id, is_deleted=False)
        .filter(Subject.teacher_ids.any(user.id))
        .order_by(Subject.name)
        .all()
    )
    sections = (
        Section.query.filter_by(school_id=user.school_id, is_deleted=False, class_teacher_id=user.id)
        .order_by(Section.name)
        .all()
    )

    data["subjects"] = [subject.name for subject in subjects]
    data["subject_ids"] = [str(subject.id) for subject in subjects]
    data["class_sections"] = [
        f"{section.klass.name} - {section.name}" if getattr(section, "klass", None) else section.name
        for section in sections
    ]
    data["class_section_ids"] = [str(section.id) for section in sections]
    return data
