"""Plan-compatible super admin API."""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from app.utils.decorators import superadmin_required
from app.utils.response import success_response

super_admin_bp = Blueprint("super_admin", __name__, url_prefix="/super-admin")


@super_admin_bp.route("/overview", methods=["GET"])
@jwt_required()
@superadmin_required
def overview():
    total_schools = School.query.filter_by(is_deleted=False).count()
    active_schools = School.query.filter_by(is_deleted=False, is_active=True).count()
    total_users = User.query.filter_by(is_deleted=False).count()
    total_students = Student.query.filter_by(is_deleted=False).count()
    total_plugins = Plugin.query.filter_by(is_deleted=False).count()
    total_installs = SchoolPlugin.query.filter_by(is_deleted=False).count()

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
    return success_response([school.to_dict() for school in schools])


@super_admin_bp.route("/plugins", methods=["GET"])
@jwt_required()
@superadmin_required
def plugins():
    plugins = Plugin.query.filter_by(is_deleted=False).order_by(Plugin.sort_order.asc(), Plugin.name.asc()).all()
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
