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


# ── Prebuilt theme pages ─────────────────────────────────────────────────
# Every theme assumes these pages exist. They are created idempotently at
# theme-apply time and backfilled on the pages list fetch so existing
# schools get them too. Section types/keys mirror the public renderer
# (frontend/components/website/SectionRenderer.tsx) so each section renders
# on the public site and is editable in the builder editor.

DEFAULT_PAGE_SLUGS = (
    "home", "about", "academics", "admission", "teachers",
    "notices", "gallery", "contact", "results",
)

DEFAULT_PAGES = [
    {"slug": "home", "title": "Home", "page_type": "home"},
    {"slug": "about", "title": "About Us", "page_type": "about"},
    {"slug": "academics", "title": "Academics", "page_type": "custom"},
    {"slug": "admission", "title": "Admission", "page_type": "custom"},
    {"slug": "teachers", "title": "Teachers", "page_type": "custom"},
    {"slug": "notices", "title": "Notices", "page_type": "custom"},
    {"slug": "gallery", "title": "Gallery", "page_type": "gallery"},
    {"slug": "contact", "title": "Contact Us", "page_type": "contact"},
    {"slug": "results", "title": "Results", "page_type": "custom"},
]


def _default_section(s_type, title, content, sort_order):
    return {
        "id": str(uuid.uuid4()),
        "type": s_type,
        "title": title,
        "content": content,
        "sort_order": sort_order,
    }


def _default_sections_for_page(slug: str, school_name: str) -> list[dict]:
    """Starter sections for a prebuilt page (public-renderer compatible)."""
    label = school_name or "Our School"

    if slug == "home":
        return [
            _default_section("slideshow", "Hero Slideshow", {
                "slides": [
                    {"title": f"Welcome to {label}", "subtitle": "Excellence in Education", "cta_text": "Apply Now"},
                    {"title": "Building Tomorrow's Leaders", "subtitle": "Academics · Sports · Arts · Technology", "cta_text": "Learn More"},
                    {"title": "Join Our Community", "subtitle": "Admissions Open", "cta_text": "Contact Us"},
                ],
            }, 0),
            _default_section("stats", "Statistics", {
                "items": [
                    {"value": "1000+", "label": "Students"},
                    {"value": "60+", "label": "Teachers"},
                    {"value": "A+", "label": "Grade Ranking"},
                    {"value": "2050", "label": "Established (BS)"},
                ],
            }, 1),
            _default_section("about", "About Section", {
                "tag": "Who We Are",
                "heading": "About Our School",
                "body": f"{label} is dedicated to academic excellence and the holistic development of every student.",
                "vision": "To inspire lifelong learning and leadership in every child.",
            }, 2),
            _default_section("notices", "Latest Notices", {
                "tag": "Updates", "heading": "Events & Notices",
                "max_items": 6, "use_api": True, "show_view_all": True,
            }, 3),
            _default_section("programs", "Academic Programs", {
                "tag": "What We Offer", "heading": "Academic Programs",
                "items": [
                    {"icon": "📚", "name": "Primary Level", "desc": "Grades 1–5: strong foundations", "grade": "1–5"},
                    {"icon": "🔬", "name": "Secondary Level", "desc": "Grades 9–10: SEE preparation", "grade": "9–10"},
                    {"icon": "🎓", "name": "Higher Secondary", "desc": "Grades 11–12: Science, Management & Humanities", "grade": "11–12"},
                ],
            }, 4),
            _default_section("cta", "Call to Action", {
                "heading": "Join Our School Community",
                "subheading": "Admission is open for the upcoming academic year.",
                "cta_primary": "Start Application", "cta_secondary": "Contact Us",
            }, 5),
        ]
    if slug == "about":
        return [
            _default_section("hero", "Hero Banner", {
                "heading": f"About {label}", "subheading": "Our story, vision and mission",
                "cta_primary": "Contact Us", "show_logo": False, "show_location": True,
            }, 0),
            _default_section("about", "About Section", {
                "tag": "Our Story", "heading": "About Our School", "body": "", "vision": "",
            }, 1),
            _default_section("principal", "Principal's Message", {
                "heading": "Message from Principal", "message": "", "name": "", "designation": "Principal",
            }, 2),
        ]
    if slug == "academics":
        return [
            _default_section("hero", "Hero Banner", {
                "heading": "Academics", "subheading": "Programs from primary to higher secondary",
                "show_logo": False, "show_location": True,
            }, 0),
            _default_section("programs", "Academic Programs", {
                "tag": "Curriculum", "heading": "Programs We Offer",
                "items": [
                    {"icon": "📚", "name": "Primary Level", "desc": "Grades 1–5: strong foundations", "grade": "1–5"},
                    {"icon": "🔬", "name": "Secondary Level", "desc": "Grades 9–10: SEE preparation", "grade": "9–10"},
                    {"icon": "🎓", "name": "Higher Secondary", "desc": "Grades 11–12: Science, Management & Humanities", "grade": "11–12"},
                ],
            }, 1),
            _default_section("stats", "Statistics", {
                "items": [
                    {"value": "1000+", "label": "Students"},
                    {"value": "98%", "label": "SEE Pass Rate"},
                ],
            }, 2),
        ]
    if slug == "admission":
        return [
            _default_section("hero", "Hero Banner", {
                "heading": "Admissions Open", "subheading": "Apply to join our school community",
                "cta_primary": "Apply Now", "show_logo": False, "show_location": True,
            }, 0),
            _default_section("cta", "Admission CTA", {
                "heading": "Ready to Join Our School?",
                "subheading": "Admissions are open. Limited seats available. Apply today.",
                "cta_primary": "Start Application", "cta_secondary": "Book a Visit",
            }, 1),
            _default_section("contact", "Admission Enquiry", {
                "heading": "Contact the Admissions Office",
                "subheading": "Send us a message and we will get back to you.",
            }, 2),
        ]
    if slug == "teachers":
        return [
            _default_section("hero", "Hero Banner", {
                "heading": "Our Teachers", "subheading": "Meet the educators behind our students' success",
                "show_logo": False, "show_location": True,
            }, 0),
            _default_section("teachers", "Our Teachers", {
                "tag": "Our Team", "heading": "Meet Our Teachers",
                "use_api": True, "show_view_all": True,
            }, 1),
        ]
    if slug == "notices":
        return [
            _default_section("notices", "Latest Notices", {
                "tag": "Updates", "heading": "Events & Notices",
                "max_items": 8, "use_api": True, "show_view_all": True,
            }, 0),
        ]
    if slug == "gallery":
        return [
            _default_section("gallery", "Photo Gallery", {
                "tag": "Memories", "heading": "Photo Gallery",
                "use_api": True, "columns": 3, "max_items": 6, "show_view_all": True,
            }, 0),
        ]
    if slug == "contact":
        return [
            _default_section("contact", "Contact Us", {
                "heading": "Contact Us", "subheading": "We would love to hear from you.",
            }, 0),
            _default_section("map", "Find Us", {"heading": "Our Location", "embed_url": ""}, 1),
        ]
    if slug == "results":
        return [
            _default_section("cta", "Check Your Results", {
                "heading": "Check Your Exam Results",
                "subheading": "Enter your symbol number and date of birth to view your published results.",
                "cta_primary": "Open Result Checker", "cta_secondary": "Contact Us",
            }, 0),
        ]
    return []


def ensure_default_pages(school_id) -> list[str]:
    """Idempotently create the prebuilt pages every theme needs.

    - Called from GET /website-builder/pages (backfill so existing schools
      get the prebuilt pages on their next pages fetch) and from POST
      /website-builder/themes/apply.
    - Existing pages are NEVER overwritten: only missing slugs are created,
      and soft-deleted rows are revived so one live page per slug is kept.
    """
    from app.models.school import School
    from app.models.website import WebsitePage

    existing = WebsitePage.query.filter(
        WebsitePage.school_id == school_id,
        WebsitePage.slug.in_(DEFAULT_PAGE_SLUGS),
    ).all()
    by_slug = {p.slug: p for p in existing}

    school = School.query.get(school_id)
    school_name = school.name if school else ""

    created = []
    changed = False
    for sort_order, spec in enumerate(DEFAULT_PAGES):
        page = by_slug.get(spec["slug"])
        if page is None:
            db.session.add(WebsitePage(
                school_id=school_id,
                title=spec["title"],
                slug=spec["slug"],
                page_type=spec["page_type"],
                sections=_default_sections_for_page(spec["slug"], school_name),
                sort_order=sort_order,
                is_published=True,
                is_deleted=False,
            ))
            created.append(spec["slug"])
            changed = True
        elif page.is_deleted:
            page.is_deleted = False
            page.is_published = True
            changed = True

    if changed:
        db.session.commit()
    return created


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

    # A theme application must leave the school with ALL its prebuilt pages
    # (home, about, academics, …) so they show up — and are editable — in
    # the builder's Pages screen. Idempotent; never overwrites existing pages.
    ensure_default_pages(g.school_id)

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
    # Backfill: schools that never applied a theme (or predate prebuilt
    # pages) get the default pages created here — idempotent, so existing
    # school-authored pages are never touched.
    ensure_default_pages(g.school_id)

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

DEFAULT_ROBOTS_TXT = "User-agent: *\nAllow: /"


@website_builder_bp.route("/seo", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("website_builder")
def get_seo_settings():
    """Get SEO settings for the school website.

    ALWAYS returns the full key set the dashboard SEO page renders
    (meta_title, meta_description, og_image, google_analytics_id,
    google_site_verification, sitemap_enabled, robots_txt) with safe
    defaults — the frontend does `form.meta_title.length`, so no key may
    ever be missing or None. `og_image_url` is kept as a legacy alias.
    """
    from app.models.school import SchoolWebsite

    website = SchoolWebsite.query.filter_by(school_id=g.school_id, is_deleted=False).first()
    customizations = (
        dict(website.customizations)
        if website and isinstance(website.customizations, dict) else {}
    )
    og_image = (website.og_image_url if website else None) or ""

    return success_response({
        "meta_title": (website.meta_title if website else None) or "",
        "meta_description": (website.meta_description if website else None) or "",
        "og_image": og_image,
        "og_image_url": og_image,
        "google_analytics_id": (website.google_analytics_id if website else None) or "",
        "google_site_verification": customizations.get("google_site_verification") or "",
        "sitemap_enabled": bool(customizations.get("sitemap_enabled", True)),
        "robots_txt": customizations.get("robots_txt") or DEFAULT_ROBOTS_TXT,
    })


@website_builder_bp.route("/seo", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def update_seo_settings():
    """Update SEO settings.

    Accepts the dashboard's full key set. Column-backed fields are stored on
    SchoolWebsite; the keys without dedicated columns
    (google_site_verification, sitemap_enabled, robots_txt) live in the
    `customizations` JSONB. `og_image` maps to the `og_image_url` column
    (the legacy key is still accepted).
    """
    from app.models.school import SchoolWebsite

    data = request.get_json(silent=True) or {}
    website = _get_school_website()

    if "meta_title" in data:
        website.meta_title = str(data.get("meta_title") or "")[:200]
    if "meta_description" in data:
        website.meta_description = str(data.get("meta_description") or "")
    if "og_image" in data or "og_image_url" in data:
        website.og_image_url = str(data.get("og_image") or data.get("og_image_url") or "")
    if "google_analytics_id" in data:
        website.google_analytics_id = str(data.get("google_analytics_id") or "")[:50]

    customizations = dict(website.customizations or {})
    if "google_site_verification" in data:
        customizations["google_site_verification"] = str(data.get("google_site_verification") or "")[:255]
    if "sitemap_enabled" in data:
        customizations["sitemap_enabled"] = bool(data.get("sitemap_enabled"))
    if "robots_txt" in data:
        customizations["robots_txt"] = str(data.get("robots_txt") or "")
    website.customizations = customizations

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
        "page_type": p.page_type,
        # The pages manager badges/hides delete for prebuilt pages.
        "is_default": p.slug in DEFAULT_PAGE_SLUGS,
        "created_at": str(p.created_at) if p.created_at else None,
        "updated_at": str(p.updated_at) if hasattr(p, "updated_at") and p.updated_at else None,
    }
