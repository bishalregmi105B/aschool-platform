"""Schools CRUD API."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.school import School
from app.utils.decorators import role_required, school_required, superadmin_required
from app.utils.pagination import paginate
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from extensions import db

schools_bp = Blueprint("schools", __name__, url_prefix="/schools")


@schools_bp.route("", methods=["GET"])
@superadmin_required
def list_schools():
    """List all schools (superadmin only)."""
    query = School.active()
    search = request.args.get("search")
    if search:
        query = query.filter(
            School.name.ilike(f"%{search}%") | School.slug.ilike(f"%{search}%")
        )
    plan = request.args.get("plan")
    if plan:
        query = query.filter_by(plan=plan)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    query = query.order_by(School.created_at.desc())
    items, meta = paginate(query)
    return success_response([s.to_dict() for s in items], meta={"pagination": meta})


@schools_bp.route("/<uuid:school_id>", methods=["GET"])
@jwt_required()
def get_school(school_id):
    """Get school profile by ID."""
    school = School.query.get(school_id)
    if not school or school.is_deleted:
        return error_response("School not found", 404)
    return success_response(school.to_dict())


@schools_bp.route("/current", methods=["GET"])
@jwt_required()
def get_current_school():
    """Get current school from subdomain context."""
    if not g.get("school"):
        return error_response("No school context", 400)
    return success_response(g.school.to_dict())


@schools_bp.route("/current", methods=["PATCH", "PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_current_school():
    """Update the current school from the resolved school context."""
    school = School.query.filter_by(id=g.school_id, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    data = request.get_json(silent=True) or {}
    _populate_school(school, data)
    db.session.commit()
    return success_response(school.to_dict())


@schools_bp.route("", methods=["POST"])
@superadmin_required
def create_school():
    """Create a new school (superadmin only)."""
    data = request.get_json(silent=True) or {}
    required = ["name", "slug", "phone", "email"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", 400)

    if School.query.filter_by(slug=data["slug"]).first():
        return error_response("School slug already exists", 409)

    school = School()
    _populate_school(school, data)
    db.session.add(school)
    db.session.commit()

    # Auto-install core plugins
    from app.plugins.billing import install_plugin

    for slug in ["attendance", "notices", "academics", "basic_reports", "basic_website"]:
        install_plugin(str(school.id), slug)

    return created_response(school.to_dict())


@schools_bp.route("/<uuid:school_id>", methods=["PUT"])
@jwt_required()
@role_required("superadmin", "school_admin")
def update_school(school_id):
    """Update school settings."""
    school = School.query.get(school_id)
    if not school or school.is_deleted:
        return error_response("School not found", 404)

    data = request.get_json(silent=True) or {}
    _populate_school(school, data)
    db.session.commit()
    return success_response(school.to_dict())


@schools_bp.route("/<uuid:school_id>", methods=["DELETE"])
@superadmin_required
def delete_school(school_id):
    """Soft-delete a school (superadmin only)."""
    school = School.query.get(school_id)
    if not school or school.is_deleted:
        return error_response("School not found", 404)
    school.soft_delete()
    return no_content_response()


def _populate_school(school: School, data: dict):
    """Set allowed fields on school from request data."""
    allowed = {
        "name", "name_nepali", "slug", "custom_domain", "logo_url", "favicon_url",
        "banner_url", "plan", "type", "level", "established_year_bs",
        "established_year_ad", "affiliated_to", "regd_number", "pan_number",
        "province", "district", "municipality", "ward", "address", "latitude",
        "longitude", "google_maps_url", "phone", "phone_2", "email",
        "website_external", "settings", "website_config", "ai_config",
        "fee_config", "exam_config", "notification_config", "social_ai_config",
        "gamification_config", "admission_config", "academic_year_start_bs",
        "academic_year_end_bs", "working_days", "school_start_time",
        "school_end_time", "default_language", "max_students",
    }
    for key in allowed:
        if key in data:
            setattr(school, key, data[key])
