"""Basic Website plugin API — public pages for school website."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.school import School, SchoolWebsite
from app.models.notice import Notice
from app.models.website import WebsitePage
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response
from extensions import db

website_bp = Blueprint("basic_website", __name__, url_prefix="/website")


@website_bp.route("/public/<slug>", methods=["GET"])
def get_public_website(slug):
    """Get public website data for a school (no auth required)."""
    school = School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    website = SchoolWebsite.query.filter_by(
        school_id=school.id, is_published=True, is_deleted=False
    ).first()

    # Get published notices for public view
    notices = (
        Notice.query.filter(
            Notice.school_id == school.id,
            Notice.is_deleted.is_(False),
            Notice.published_at.isnot(None),
        )
        .order_by(Notice.published_at.desc(), Notice.created_at.desc())
        .limit(10)
        .all()
    )

    # Get home page sections from website builder
    home_page = WebsitePage.query.filter_by(
        school_id=school.id, slug="home", is_deleted=False
    ).first()
    page_sections = []
    if home_page:
        raw = home_page.sections or []
        page_sections = sorted(raw, key=lambda s: s.get("sort_order", 0))

    return success_response({
        "school": {
            "name": school.name,
            "name_nepali": school.name_nepali,
            "slug": school.slug,
            "logo_url": school.logo_url,
            "banner_url": school.banner_url,
            "type": school.type,
            "level": school.level,
            "district": school.district,
            "municipality": school.municipality,
            "phone": school.phone,
            "email": school.email,
            "established_year_bs": school.established_year_bs,
            "total_students": school.total_students,
            "total_staff": school.total_staff,
            "about_us": getattr(school, "about_us", None),
            "vision": getattr(school, "vision", None),
        },
        "website": {
            "theme_slug": website.theme_slug if website else "default",
            "customizations": website.customizations if website else {},
            "meta_title": website.meta_title if website else school.name,
            "meta_description": website.meta_description if website else None,
        } if website else None,
        "sections": page_sections,
        "notices": [
            {
                "id": str(n.id),
                "title": n.title,
                "content": n.content,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notices
        ],
    })


@website_bp.route("/public-domain", methods=["GET"])
def get_public_website_by_domain():
    """Resolve custom domain to school slug for public website routing."""
    host = (request.args.get("host") or "").strip().lower()
    if not host:
        return error_response("Domain is required", 400)

    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]

    school = School.query.filter_by(
        custom_domain=host,
        domain_verified=True,
        is_active=True,
        is_deleted=False,
    ).first()
    if not school:
        return error_response("School not found", 404)

    return success_response({"slug": school.slug})


@website_bp.route("/config", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_website")
@role_required("school_admin")
def get_website_config():
    """Get website configuration for admin editing."""
    website = SchoolWebsite.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).first()

    if not website:
        return success_response({"theme_slug": "default", "customizations": {}, "is_published": False})

    return success_response({
        "id": str(website.id),
        "theme_slug": website.theme_slug,
        "customizations": website.customizations or {},
        "is_published": website.is_published,
        "custom_css": website.custom_css,
        "google_analytics_id": website.google_analytics_id,
        "meta_title": website.meta_title,
        "meta_description": website.meta_description,
    })


@website_bp.route("/config", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("basic_website")
@role_required("school_admin")
def update_website_config():
    """Update website configuration."""
    data = request.get_json(silent=True) or {}

    website = SchoolWebsite.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).first()

    if not website:
        website = SchoolWebsite(school_id=g.school_id)
        db.session.add(website)

    for key in ("theme_slug", "customizations", "is_published", "custom_css",
                "google_analytics_id", "facebook_pixel_id", "meta_title",
                "meta_description", "og_image_url"):
        if key in data:
            setattr(website, key, data[key])

    if data.get("is_published") and not website.published_at:
        from datetime import datetime, timezone
        website.published_at = datetime.now(timezone.utc)

    db.session.commit()
    return success_response({
        "id": str(website.id),
        "theme_slug": website.theme_slug,
        "is_published": website.is_published,
    })


@website_bp.route("/public/<slug>/contact", methods=["POST"])
def submit_contact_form(slug):
    """Public contact form submission (no auth required)."""
    school = School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()[:300]
    phone = (data.get("phone") or "").strip()[:20]
    email = (data.get("email") or "").strip()[:200]
    message = (data.get("message") or "").strip()[:2000]

    if not name or not message:
        return error_response("Name and message are required", 400)

    from app.models.compliance import AuditLog as _AuditLog

    log = _AuditLog(
        school_id=school.id,
        action="contact_form",
        resource_type="contact",
        new_values={"name": name, "phone": phone, "email": email, "message": message},
        ip_address=request.remote_addr,
        user_agent=str(request.user_agent)[:500],
    )
    db.session.add(log)
    db.session.commit()

    return success_response(
        {"message": "Your message has been received. We will get back to you soon."},
        201,
    )


@website_bp.route("/public/<slug>/admission-inquiry", methods=["POST"])
def submit_admission_inquiry(slug):
    """Public admission inquiry form (no auth required)."""
    school = School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    data = request.get_json(silent=True) or {}
    student_name = (data.get("student_name") or "").strip()[:300]
    guardian_name = (data.get("guardian_name") or "").strip()[:300]
    phone = (data.get("phone") or "").strip()[:20]
    class_applied = (data.get("class_applied") or "").strip()[:50]

    if not student_name or not guardian_name or not phone or not class_applied:
        return error_response(
            "Student name, guardian name, phone, and class are required", 400
        )

    from app.models.admission import AdmissionInquiry

    inquiry = AdmissionInquiry(
        school_id=school.id,
        student_name=student_name,
        guardian_name=guardian_name,
        phone=phone,
        email=(data.get("email") or "").strip()[:200],
        class_applied=class_applied,
        notes=(data.get("previous_school") or "") + "\n" + (data.get("notes") or ""),
        source="website",
        status="new",
    )
    db.session.add(inquiry)
    db.session.commit()

    return success_response(
        {"message": "Your admission inquiry has been submitted. We will contact you soon."},
        201,
    )


@website_bp.route("/public/<slug>/facilities", methods=["GET"])
def get_public_facilities(slug):
    """Get facilities published in school website configuration."""
    school = School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()
    if not school:
        return error_response("School not found", 404)

    website = SchoolWebsite.query.filter_by(
        school_id=school.id, is_deleted=False
    ).first()

    facilities = []
    if isinstance((school.website_config or {}).get("facilities"), list):
        facilities = (school.website_config or {}).get("facilities") or []
    elif website and isinstance((website.customizations or {}).get("facilities"), list):
        facilities = (website.customizations or {}).get("facilities") or []

    normalized = [
        {
            "id": item.get("id") or index + 1,
            "name": item.get("name") or item.get("name_en") or item.get("title"),
            "description": item.get("description") or item.get("description_en") or "",
            "icon": item.get("icon"),
            "image_url": item.get("image_url"),
        }
        for index, item in enumerate(facilities)
        if isinstance(item, dict) and (item.get("name") or item.get("name_en") or item.get("title"))
    ]

    return success_response({"facilities": normalized})
