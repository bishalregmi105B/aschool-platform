"""Schools CRUD API."""
from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required, get_jwt

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
    claims = get_jwt()
    # E161: this used to check claims.get("is_superadmin") — a claim
    # AuthService.create_tokens never sets, so even the platform superadmin
    # got 403 on their own school detail/update. Check the role instead.
    if claims.get("role") != "superadmin" and str(school.id) != str(g.get("school_id")):
        return error_response("Forbidden", 403)
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
    # E161b: tenant admins may not change routing/plan fields (see update_school).
    data = {k: v for k, v in data.items() if k not in ("slug", "custom_domain", "plan", "max_students", "is_active")}
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

    # Auto-provision every plugin the school's plan entitles (free plan → all
    # core/add_on plugins active out of the box; higher plans cumulative).
    # Idempotent and non-fatal: a provisioning failure is logged and healed
    # lazily by the marketplace's ensure_free_plugins backfill.
    try:
        from app.plugins.entitlements import ensure_free_plugins

        ensure_free_plugins(school)
    except Exception:  # noqa: BLE001 — never block school creation on plugins
        current_app.logger.exception(
            "Plan plugin provisioning failed for school %s — plugins will be "
            "backfilled lazily by the marketplace endpoints",
            school.id,
        )

    return created_response(school.to_dict())


@schools_bp.route("/<uuid:school_id>", methods=["PUT"])
@jwt_required()
@role_required("superadmin", "school_admin")
def update_school(school_id):
    """Update school settings."""
    school = School.query.get(school_id)
    if not school or school.is_deleted:
        return error_response("School not found", 404)
    claims = get_jwt()
    # E161: same dead-claim bug as get_school (see above).
    if claims.get("role") != "superadmin" and str(school.id) != str(g.get("school_id")):
        return error_response("Forbidden", 403)
    data = request.get_json(silent=True) or {}
    # Tenant admins may not touch routing/plan fields — slug + custom_domain
    # drive subdomain resolution and plan drives entitlements.
    if claims.get("role") != "superadmin":
        data = {k: v for k, v in data.items() if k not in ("slug", "custom_domain", "plan", "max_students", "is_active")}
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


@schools_bp.route("/lookup", methods=["GET"])
def lookup_schools():
    """Public school search — used by mobile app login picker. No auth required."""
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return success_response([])
    results = School.query.filter(
        School.is_active.is_(True),
        School.is_deleted.is_(False),
        db.or_(
            School.name.ilike(f"%{q}%"),
            School.slug.ilike(f"%{q}%"),
        ),
    ).limit(12).all()
    return success_response([
        {
            "name": s.name,
            "slug": s.slug,
            "logo_url": s.logo_url,
            "address": s.address,
        }
        for s in results
    ])


_DEFAULT_NOTIFICATION_CONFIG = {
    "push_enabled": True,
    "sms_enabled": True,
    "whatsapp_enabled": True,
    "types": {
        "attendance": True,
        "fee_reminder": True,
        "fee_payment": True,
        "notice": True,
        "homework": True,
        "exam_result": True,
        "gamification": True,
    },
}


@schools_bp.route("/current/notification-settings", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def get_notification_settings():
    """Get per-school notification settings."""
    school = School.query.filter_by(id=g.school_id, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)
    config = school.notification_config or {}
    # Merge with defaults so all keys are present
    merged = {**_DEFAULT_NOTIFICATION_CONFIG, **config}
    merged["types"] = {**_DEFAULT_NOTIFICATION_CONFIG["types"], **config.get("types", {})}
    return success_response(merged)


@schools_bp.route("/current/notification-settings", methods=["PUT", "PATCH"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_notification_settings():
    """Update per-school notification settings."""
    school = School.query.filter_by(id=g.school_id, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)
    data = request.get_json(silent=True) or {}
    current = school.notification_config or {}
    # Merge top-level keys
    for key in ("push_enabled", "sms_enabled", "whatsapp_enabled"):
        if key in data:
            current[key] = bool(data[key])
    # Merge nested types
    if "types" in data and isinstance(data["types"], dict):
        current.setdefault("types", {})
        for t, v in data["types"].items():
            current["types"][t] = bool(v)
    school.notification_config = current
    db.session.commit()
    merged = {**_DEFAULT_NOTIFICATION_CONFIG, **current}
    merged["types"] = {**_DEFAULT_NOTIFICATION_CONFIG["types"], **current.get("types", {})}
    return success_response(merged)


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
