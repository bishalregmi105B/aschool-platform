"""Plan-compatible super admin API."""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from extensions import db
from app.models.app import App, SchoolApp
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from app.utils.decorators import superadmin_required
from app.utils.response import error_response, success_response

super_admin_bp = Blueprint("super_admin", __name__, url_prefix="/super-admin")


@super_admin_bp.route("/overview", methods=["GET"])
@jwt_required()
@superadmin_required
def overview():
    total_schools = School.query.filter_by(is_deleted=False).count()
    active_schools = School.query.filter_by(is_deleted=False, is_active=True).count()
    total_users = User.query.filter_by(is_deleted=False).count()
    total_students = Student.query.filter_by(is_deleted=False).count()
    total_plugins = App.query.filter_by(is_deleted=False).count()
    total_installs = SchoolApp.query.filter_by(is_deleted=False).count()

    return success_response(
        {
            "stats": {
                "total_schools": total_schools,
                "active_schools": active_schools,
                "total_users": total_users,
                "total_students": total_students,
                "total_plugins": total_plugins,
                "total_installs": total_installs,
            }
        }
    )


@super_admin_bp.route("/schools", methods=["GET"])
@jwt_required()
@superadmin_required
def schools():
    search = request.args.get("search")
    query = School.query.filter_by(is_deleted=False)
    if search:
        query = query.filter(School.name.ilike(f"%{search}%"))
    schools = query.order_by(School.created_at.desc()).all()

    # Tenant-list counts in three grouped queries — not N+1.
    school_ids = [s.id for s in schools]
    student_counts = dict(
        db.session.query(Student.school_id, func.count(Student.id))
        .filter(
            Student.school_id.in_(school_ids),
            Student.is_deleted.is_(False),
        )
        .group_by(Student.school_id)
        .all()
    ) if school_ids else {}
    user_counts = dict(
        db.session.query(User.school_id, func.count(User.id))
        .filter(
            User.school_id.in_(school_ids),
            User.is_deleted.is_(False),
        )
        .group_by(User.school_id)
        .all()
    ) if school_ids else {}
    plugin_counts = dict(
        db.session.query(SchoolApp.school_id, func.count(SchoolApp.id))
        .filter(
            SchoolApp.school_id.in_(school_ids),
            SchoolApp.is_deleted.is_(False),
        )
        .group_by(SchoolApp.school_id)
        .all()
    ) if school_ids else {}

    payload = []
    for school in schools:
        data = school.to_dict()
        data["student_count"] = student_counts.get(school.id, 0)
        data["user_count"] = user_counts.get(school.id, 0)
        data["plugin_count"] = plugin_counts.get(school.id, 0)
        payload.append(data)
    return success_response(payload)


@super_admin_bp.route("/schools/<school_id>", methods=["GET"])
@jwt_required()
@superadmin_required
def school_detail(school_id):
    school = School.query.filter_by(id=school_id, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    data = school.to_dict()
    data["student_count"] = Student.query.filter_by(
        school_id=school.id, is_deleted=False
    ).count()
    data["user_count"] = User.query.filter_by(
        school_id=school.id, is_deleted=False
    ).count()
    data["users_by_role"] = dict(
        db.session.query(User.role, func.count(User.id))
        .filter(User.school_id == school.id, User.is_deleted.is_(False))
        .group_by(User.role)
        .all()
    )
    installs = SchoolApp.query.filter_by(
        school_id=school.id, is_deleted=False
    ).all()
    plugin_names = {
        p.slug: p.name
        for p in App.query.filter(
            App.slug.in_([i.app_slug for i in installs]),
            App.is_deleted.is_(False),
        ).all()
    } if installs else {}
    data["plugins"] = [
        {
            "slug": install.app_slug,
            "name": plugin_names.get(install.app_slug, install.app_slug),
            "active": install.active,
            "is_trial": install.is_trial,
        }
        for install in installs
    ]
    return success_response(data)


@super_admin_bp.route("/schools/<school_id>/status", methods=["PATCH"])
@jwt_required()
@superadmin_required
def set_school_status(school_id):
    """Activate or suspend a tenant. Suspension is the dunning lever: a
    suspended school's users are blocked at login by the auth layer."""
    data = request.get_json(silent=True) or {}
    is_active = data.get("is_active")
    if not isinstance(is_active, bool):
        return error_response("is_active (boolean) is required", 400)

    school = School.query.filter_by(id=school_id, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    school.is_active = is_active
    school.status = "active" if is_active else "suspended"
    db.session.commit()
    return success_response(
        {"id": str(school.id), "is_active": school.is_active, "status": school.status}
    )


@super_admin_bp.route("/plugins", methods=["GET"])
@jwt_required()
@superadmin_required
def plugins():
    plugins = App.query.filter_by(is_deleted=False).order_by(App.sort_order.asc(), App.name.asc()).all()
    return success_response(
        [
            {
                "slug": plugin.slug,
                "name": plugin.name,
                "category": plugin.category,
                "installs": plugin.install_count or 0,
                "price_monthly": float(plugin.price_monthly or 0),
                "price_yearly": float(plugin.price_yearly or 0),
            }
            for plugin in plugins
        ]
    )
