"""Website Builder Pro API — themes, page builder, AI designer, domain management."""
import uuid

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.website import WebsitePage, WebsiteTheme
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from app.utils.tenant_url import school_site_host, school_site_url
from extensions import db

website_builder_bp = Blueprint("website_builder", __name__, url_prefix="/website-builder")


def _get_school_website():
    from app.models.school import SchoolWebsite

    website = SchoolWebsite.query.filter_by(school_id=g.school_id, is_deleted=False).first()
    if not website:
        website = SchoolWebsite(school_id=g.school_id)
        db.session.add(website)
        db.session.flush()
    return website


def _normalize_sections(raw_sections):
    normalized = []
    for idx, section in enumerate(raw_sections or []):
        if not isinstance(section, dict):
            continue
        normalized.append({
            "id": str(section.get("id") or uuid.uuid4()),
            "type": section.get("type") or section.get("slug") or "custom",
            "title": section.get("title") or section.get("label") or "Untitled Section",
            "content": section.get("content") or section.get("data") or {},
            "sort_order": int(section.get("sort_order", idx)),
        })
    return normalized


# ── Themes ────────────────────────────────────────────────

@website_builder_bp.route("/themes", methods=["GET"])
@jwt_required()
@school_required
def list_themes():
    """List all available website themes (real open-source school designs)."""
    from app.services.website.theme_engine import ThemeEngineService

    themes = ThemeEngineService.list_themes()
    return success_response({"themes": themes, "total": len(themes)})


@website_builder_bp.route("/themes/<theme_id>/preview-css", methods=["GET"])
@jwt_required()
@school_required
def get_theme_css(theme_id):
    """Get generated CSS variables for a theme."""
    from app.services.website.theme_engine import ThemeEngineService

    css = ThemeEngineService.generate_css(theme_id)
    return success_response({"theme_id": theme_id, "css": css})


@website_builder_bp.route("/themes/apply", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def apply_theme():
    """Apply a theme to the school website."""
    from app.services.website.theme_engine import ThemeEngineService

    data = request.get_json(silent=True) or {}
    theme_id = data.get("theme_id") or data.get("theme_slug")
    color_overrides = data.get("color_overrides")

    if not theme_id:
        return error_response("theme_id is required", 400)

    result = ThemeEngineService.apply_theme(g.school_id, theme_id, color_overrides)
    if "error" in result:
        return error_response(result["error"], 400)
    return success_response(result)


@website_builder_bp.route("/status", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("website_builder")
def get_website_status():
    """Return a dashboard-friendly status overview for the website builder."""
    from app.models.school import School
    from app.services.website.theme_engine import ThemeEngineService

    school = School.query.get(g.school_id)
    website = _get_school_website()
    pages_count = WebsitePage.query.filter_by(school_id=g.school_id, is_deleted=False).count()
    subdomain = school.slug if school else None

    return success_response({
        "is_published": website.is_published,
        "theme_slug": website.theme_slug or ThemeEngineService.DEFAULT_THEME_ID,
        "subdomain": subdomain,
        "default_domain": school_site_host(subdomain),
        "custom_domain": school.custom_domain if school else None,
        "domain_verified": bool(school.domain_verified) if school else False,
        "pages_count": pages_count,
        "last_updated": website.updated_at.isoformat() if website.updated_at else None,
        "public_url": (
            f"https://{school.custom_domain}"
            if school and school.custom_domain and school.domain_verified
            else school_site_url(subdomain)
        ),
    })


# ── Pages ─────────────────────────────────────────────────

@website_builder_bp.route("/pages", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("website_builder")
def list_pages():
    """List all website pages for the school."""
    query = WebsitePage.query.filter_by(school_id=g.school_id, is_deleted=False)
    query = query.order_by(WebsitePage.sort_order)
    items, meta = paginate(query)
    return success_response([_page_dict(p) for p in items], meta={"pagination": meta})


@website_builder_bp.route("/pages", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def create_page():
    """Create a new website page."""
    data = request.get_json(silent=True) or {}
    page = WebsitePage(school_id=g.school_id)
    for key in ("title", "slug", "sections", "meta_title", "meta_description", "sort_order", "is_published"):
        if key in data:
            setattr(page, key, data[key])
    db.session.add(page)
    db.session.commit()
    return created_response(_page_dict(page))


@website_builder_bp.route("/pages/<page_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("website_builder")
def get_page(page_id):
    """Get a specific page with full section data."""
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    return success_response(_page_dict(page))


@website_builder_bp.route("/pages/<page_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def update_page(page_id):
    """Update page content and sections."""
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}

    for key in ("title", "slug", "sections", "meta_title", "meta_description",
                "sort_order", "is_published", "custom_css"):
        if key in data:
            setattr(page, key, data[key])

    db.session.commit()
    return success_response(_page_dict(page))


@website_builder_bp.route("/pages/<page_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def delete_page(page_id):
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    page.is_deleted = True
    db.session.commit()
    return success_response({"deleted": True})


@website_builder_bp.route("/pages/<page_id>/sections", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def add_page_section(page_id):
    """Add a section to a page backed by the page's JSON section list."""
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    sections = _normalize_sections(page.sections)
    section = {
        "id": str(uuid.uuid4()),
        "type": data.get("type", "custom"),
        "title": data.get("title") or data.get("type", "Untitled Section").replace("-", " ").title(),
        "content": data.get("content") or {},
        "sort_order": len(sections),
    }
    sections.append(section)
    page.sections = sections
    db.session.commit()
    return created_response(section)


@website_builder_bp.route("/pages/<page_id>/sections/<section_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def update_page_section(page_id, section_id):
    """Update a single page section."""
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    sections = _normalize_sections(page.sections)

    for section in sections:
        if section["id"] != section_id:
            continue
        if "title" in data:
            section["title"] = data["title"]
        if "content" in data:
            section["content"] = data["content"]
        else:
            content = {k: v for k, v in data.items() if k != "title"}
            if content:
                section["content"] = content
        page.sections = sections
        db.session.commit()
        return success_response(section)

    return error_response("Section not found", 404)


@website_builder_bp.route("/pages/<page_id>/sections/<section_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def delete_page_section(page_id, section_id):
    """Delete a single section from a page."""
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    sections = [s for s in _normalize_sections(page.sections) if s["id"] != section_id]
    for idx, section in enumerate(sections):
        section["sort_order"] = idx
    page.sections = sections
    db.session.commit()
    return success_response({"deleted": True})


@website_builder_bp.route("/pages/<page_id>/sections/<section_id>/reorder", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def reorder_page_section(page_id, section_id):
    """Move a section up or down in the page order."""
    page = WebsitePage.query.filter_by(id=page_id, school_id=g.school_id).first_or_404()
    direction = (request.get_json(silent=True) or {}).get("direction")
    sections = _normalize_sections(page.sections)
    index = next((idx for idx, section in enumerate(sections) if section["id"] == section_id), -1)

    if index == -1:
        return error_response("Section not found", 404)
    if direction not in {"up", "down"}:
        return error_response("direction must be 'up' or 'down'", 400)

    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(sections):
        return success_response({"sections": sections})

    sections[index], sections[target] = sections[target], sections[index]
    for idx, section in enumerate(sections):
        section["sort_order"] = idx
    page.sections = sections
    db.session.commit()
    return success_response({"sections": sections})


# ── Section Blocks ────────────────────────────────────────

@website_builder_bp.route("/sections/available", methods=["GET"])
@jwt_required()
@school_required
def list_available_sections():
    """List all available section types that can be added to pages."""
    from app.services.ai.website_designer import SchoolWebsiteDesigner
    from app.models.school import School

    school = School.query.get(g.school_id)
    school_type = school.type if school else "private"
    level = school.level if school else "secondary"

    sections = SchoolWebsiteDesigner.suggest_sections(school_type, level)
    return success_response(sections)


# ── AI Website Builder ────────────────────────────────────

@website_builder_bp.route("/ai/generate-design", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def ai_generate_design():
    """Generate 3 design variations using AI."""
    from app.services.ai.website_designer import SchoolWebsiteDesigner
    from app.models.school import School

    data = request.get_json(silent=True) or {}
    school = School.query.get(g.school_id)

    result = SchoolWebsiteDesigner.generate_from_prompt(
        school_name=school.name if school else data.get("school_name", "School"),
        school_type=data.get("school_type", school.type if school else "private"),
        level=data.get("level", school.level if school else "secondary"),
        style_preference=data.get("style_preference", "modern"),
        language=data.get("language", "en"),
        key_strengths=data.get("key_strengths"),
        logo_description=data.get("logo_description"),
    )
    return success_response(result)


@website_builder_bp.route("/ai/generate-copy", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def ai_generate_copy():
    """Generate bilingual website copy for all pages."""
    from app.services.ai.website_designer import SchoolWebsiteDesigner
    from app.models.school import School

    data = request.get_json(silent=True) or {}
    school = School.query.get(g.school_id)

    result = SchoolWebsiteDesigner.generate_school_copy(
        school_name=school.name if school else data.get("school_name", "School"),
        school_type=data.get("school_type", school.type if school else "private"),
        level=data.get("level", school.level if school else "secondary"),
        existing_data=data.get("existing_data"),
    )
    return success_response(result)


# ── Domain Management ─────────────────────────────────────

@website_builder_bp.route("/domain", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("website_builder")
def get_domain_config():
    """Get custom domain configuration."""
    from app.models.school import School

    school = School.query.get(g.school_id)
    return success_response({
        "subdomain": school.slug if school else None,
        "default_domain": school_site_host(school.slug) if school else None,
        "custom_domain": school.custom_domain if hasattr(school, "custom_domain") and school.custom_domain else None,
        "domain_verified": school.domain_verified if hasattr(school, "domain_verified") else False,
        "ssl_active": True,
        "cname_target": school_site_host(school.slug) if school else None,
        "dns_records": [
            {
                "type": "CNAME",
                "name": "www",
                "value": school_site_host(school.slug),
            }
        ] if school else [],
    })


@website_builder_bp.route("/domain", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def update_domain():
    """Update custom domain settings."""
    from app.models.school import School

    data = request.get_json(silent=True) or {}
    school = School.query.get(g.school_id)
    if not school:
        return error_response("School not found", 404)

    if "custom_domain" in data:
        school.custom_domain = data["custom_domain"]
    if "domain_verified" in data:
        school.domain_verified = data["domain_verified"]

    db.session.commit()
    return success_response({"custom_domain": school.custom_domain, "updated": True})


@website_builder_bp.route("/domain/verify", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def verify_domain():
    """Compatibility endpoint for dashboard verification flow."""
    from app.models.school import School

    school = School.query.get(g.school_id)
    if not school:
        return error_response("School not found", 404)
    if not school.custom_domain:
        return error_response("No custom domain configured", 400)

    school.domain_verified = True
    db.session.commit()
    return success_response({
        "custom_domain": school.custom_domain,
        "domain_verified": True,
        "verified": True,
    })


# ── SEO ───────────────────────────────────────────────────

@website_builder_bp.route("/seo", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("website_builder")
def get_seo_settings():
    """Get SEO settings for the school website."""
    from app.models.school import SchoolWebsite

    website = SchoolWebsite.query.filter_by(school_id=g.school_id, is_deleted=False).first()
    if not website:
        return success_response({"meta_title": "", "meta_description": "", "og_image_url": ""})

    return success_response({
        "meta_title": website.meta_title,
        "meta_description": website.meta_description,
        "og_image_url": website.og_image_url if hasattr(website, "og_image_url") else None,
        "google_analytics_id": website.google_analytics_id,
        "robots_txt": website.robots_txt if hasattr(website, "robots_txt") else "User-agent: *\nAllow: /",
    })


@website_builder_bp.route("/seo", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def update_seo_settings():
    """Update SEO settings."""
    from app.models.school import SchoolWebsite

    data = request.get_json(silent=True) or {}
    website = _get_school_website()

    for key in ("meta_title", "meta_description", "og_image_url", "google_analytics_id"):
        if key in data:
            setattr(website, key, data[key])

    db.session.commit()
    return success_response({"updated": True})


# ── Publish / Unpublish ───────────────────────────────────

def _resolve_target_school(data):
    """Resolve the school a publish/unpublish targets (E202).

    Empty/absent ``school_slug`` → the caller's own school (unchanged
    behavior). A provided slug that is NOT the caller's school is rejected
    upstream with 403 instead of being silently ignored — previously the
    body param was accepted and discarded, so a caller could believe they
    published/unpublished a different school.
    """
    from app.models.school import School

    slug = str(data.get("school_slug") or "").strip().lower()
    caller = School.query.get(g.school_id)
    if not slug:
        return caller
    if caller is None or (caller.slug or "").lower() != slug:
        return None
    return caller


def _revalidate_public_site(slug: str) -> None:
    """Fire-and-forget on-demand ISR revalidation of /school/<slug>/* (E201).

    Correctness of the unpublish GUARD no longer depends on this (the Next.js
    public layout checks publish status with a no-store fetch at request
    time), but pinging /api/revalidate purges the ISR route + data caches so
    a (re)published site's heavy content is fresh within seconds instead of
    the 5-minute window. Best-effort: failures fall back to the ISR window.
    """
    import requests as _requests
    from flask import current_app

    sub_pages = (
        "", "/about", "/academics", "/teachers", "/notices", "/gallery",
        "/contact", "/admission", "/results", "/events", "/facilities",
        "/alumni", "/news",
    )
    base_url = (current_app.config.get("NEXTJS_INTERNAL_URL") or "http://nextjs:3000").rstrip("/")
    secret = current_app.config.get("ISR_REVALIDATE_SECRET") or ""
    for sub in sub_pages:
        try:
            _requests.post(
                f"{base_url}/api/revalidate",
                json={"path": f"/school/{slug}{sub}", "secret": secret},
                timeout=2,
            )
        except Exception:  # noqa: BLE001 — never fail the mutation on revalidate
            current_app.logger.warning("ISR revalidation failed for /school/%s%s", slug, sub)


@website_builder_bp.route("/publish", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def publish_website():
    """Publish the school website."""
    from app.models.school import SchoolWebsite
    from datetime import datetime, timezone

    data = request.get_json(silent=True) or {}
    school = _resolve_target_school(data)
    if school is None:
        return error_response("school_slug does not match your school", 403)

    website = _get_school_website()

    website.is_published = True
    website.published_at = datetime.now(timezone.utc)
    db.session.commit()

    _revalidate_public_site(school.slug)

    return success_response({"published": True, "published_at": str(website.published_at)})


@website_builder_bp.route("/unpublish", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def unpublish_website():
    """Unpublish the school website."""
    from app.models.school import SchoolWebsite

    data = request.get_json(silent=True) or {}
    school = _resolve_target_school(data)
    if school is None:
        return error_response("school_slug does not match your school", 403)

    website = _get_school_website()

    website.is_published = False
    db.session.commit()

    _revalidate_public_site(school.slug)

    return success_response({"published": False})


def _page_dict(p):
    return {
        "id": p.id,
        "title": p.title,
        "slug": p.slug,
        "sections": p.sections or [],
        "meta_title": p.meta_title if hasattr(p, "meta_title") else None,
        "meta_description": p.meta_description if hasattr(p, "meta_description") else None,
        "sort_order": p.sort_order,
        "is_published": p.is_published,
        "created_at": str(p.created_at) if p.created_at else None,
        "updated_at": str(p.updated_at) if hasattr(p, "updated_at") and p.updated_at else None,
    }
