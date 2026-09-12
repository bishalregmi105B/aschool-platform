"""Basic Website plugin API — public pages for school website."""
import re
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.school import School, SchoolWebsite
from app.models.notice import Notice
from app.models.website import WebsitePage
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from sqlalchemy import or_

from app.utils.response import created_response, error_response, success_response
from extensions import db, limiter
from flask_limiter.util import get_remote_address


def _public_form_key():
    """Rate-limit key for unauthenticated public form endpoints:
    school slug + client IP (S-08) — one IP cannot spam one school's
    forms, and one IP cannot spray every school either."""
    slug = request.view_args.get("slug", "") if request.view_args else ""
    return f"{slug}:{get_remote_address()}"


# ── custom_css sanitization ─────────────────────────────────────────────
# Allowlist approach: CSS is injected into a <style> block on public pages,
# so anything beyond plain declarations is dropped. Blocks url()/expression()
# exfiltration and script/HTML injection vectors rather than blacklisting them.
_CSS_URL_RE = re.compile(r"url\s*\(", re.IGNORECASE)
_CSS_DANGER_RE = re.compile(
    r"(javascript\s*:|expression\s*\(|@import|behavior\s*:|<|\\)",
    re.IGNORECASE,
)
_CSS_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
_CSS_SAFE_SELECTOR_RE = re.compile(r"^[A-Za-z0-9_\-\s\.\#>,:\*\[\]=\"'\(\)\+%~|^$]*$")
_CSS_SAFE_DECL_RE = re.compile(r"^[-a-zA-Z]+\s*:\s*[^;{}]*$", re.IGNORECASE)


def sanitize_custom_css(css: str) -> str:
    """Return only syntactically-safe selector{declaration} blocks."""
    if not css:
        return ""
    css = _CSS_COMMENT_RE.sub("", css)

    safe_blocks = []
    # Split top-level blocks "selector { declarations }"
    for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        selector, body = match.group(1).strip(), match.group(2)
        if not selector or not _CSS_SAFE_SELECTOR_RE.match(selector):
            continue
        if _CSS_URL_RE.search(body) or _CSS_DANGER_RE.search(body):
            continue
        decls = []
        for decl in body.split(";"):
            decl = decl.strip()
            if decl and _CSS_SAFE_DECL_RE.match(decl):
                decls.append(decl)
        if decls:
            safe_blocks.append(f"{selector} {{ { '; '.join(decls)}; }}")
    return "\n".join(safe_blocks)


# Any customizations.colors value is interpolated into the public site's
# <style> block by the Next.js layout — a "</style><script>" payload there is
# stored XSS with superadmin as the victim (S-11). Colors must be hex or a
# small CSS color-word set; anything else is dropped.
_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_CSS_COLOR_WORD_RE = re.compile(r"^[a-z]+$", re.IGNORECASE)
_CSS_COLOR_WORDS = {
    "transparent", "currentcolor", "white", "black", "red", "green",
    "blue", "yellow", "orange", "purple", "gray", "grey",
}


def _sanitize_color_value(value):
    """Return the color if hex or a known CSS color word, else None."""
    if not isinstance(value, str):
        return None
    v = value.strip()
    if _HEX_COLOR_RE.match(v):
        return v
    if _CSS_COLOR_WORD_RE.match(v) and v.lower() in _CSS_COLOR_WORDS:
        return v.lower()
    return None


_COLOR_KEYS_ALLOWLIST = (
    "primary", "secondary", "accent", "bg", "text",
    "surface", "sidebar_active", "sidebar_text",
)


def sanitize_colors(colors):
    """Allowlist the keys the product reads; each value must be a real color.

    Unknown keys are dropped (the wholesale setattr made this dict a free-form
    injection point); invalid values are dropped rather than stored.
    """
    if not isinstance(colors, dict):
        return {}
    clean = {}
    for key in _COLOR_KEYS_ALLOWLIST:
        if key in colors:
            value = _sanitize_color_value(colors[key])
            if value is not None:
                clean[key] = value
    return clean

website_bp = Blueprint("basic_website", __name__, url_prefix="/website")


# ── shared public live-data helpers ─────────────────────────────────────
# Every public endpoint (home payload, per-page payload, dedicated feeds)
# serves the same shapes so any page can render any section type from
# live school data.

def _public_school_dict(school) -> dict:
    # W-04: real profile fields (getattr fallbacks kept for pre-migration DBs)
    return {
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
    }


def _public_notices_payload(school) -> list:
    """Published notices for public view (feeds the 'notices' section)."""
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
    return [
        {
            "id": str(n.id),
            "title": n.title,
            # W-03 i18n: Nepali variants exist on the model and were never
            # selected — the public site can now offer a language toggle.
            "title_nepali": getattr(n, "title_nepali", None),
            "content": n.content,
            "content_nepali": getattr(n, "content_nepali", None),
            "attachment_urls": getattr(n, "attachment_urls", None) or [],
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notices
    ]


def _public_teachers_payload(school) -> list:
    """Real staff directory for the public site (feeds 'teachers' sections).

    Carries both ``photo`` and ``photo_url`` keys: the public home fallback
    template reads ``teacher.photo`` while the dedicated /teachers feed
    consumers read ``photo_url``.
    """
    from app.models.user import User

    teachers = (
        User.query.filter(
            User.school_id == school.id,
            User.role == "teacher",
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
        .order_by(User.full_name.asc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": str(t.id),
            "name": t.full_name,
            "designation": "",
            "department": "",
            "qualification": "",
            "photo_url": t.avatar_url or None,
            "photo": t.avatar_url or None,
        }
        for t in teachers
    ]


def _public_gallery_payload(school) -> list:
    """School's public gallery images (feeds 'gallery' sections).

    S-12: only files explicitly marked is_public='public' may appear on the
    unauthenticated site — the school's uploads root contains scanned
    documents and fee invoices that must never leak here.
    """
    from app.models.file import ManagedFile

    images = (
        ManagedFile.query.filter(
            ManagedFile.school_id == school.id,
            ManagedFile.file_type == "image",
            ManagedFile.is_public == "public",
            ManagedFile.is_deleted.is_(False),
        )
        .order_by(ManagedFile.created_at.desc())
        .limit(60)
        .all()
    )
    return [
        {
            "id": str(img.id),
            "url": img.url,
            "caption": img.original_name or "",
            "uploaded_at": img.created_at.isoformat() if img.created_at else None,
        }
        for img in images
    ]


def _public_pages_payload(school):
    """Nav-ready list of the school's published builder pages.

    Drives the dynamic navbar/footer and lets renamed slugs propagate
    (links are built from the stored slug, never hardcoded).
    """
    pages = WebsitePage.query.filter(
        WebsitePage.school_id == school.id,
        WebsitePage.is_deleted.is_(False),
        WebsitePage.is_published.is_(True),
    ).order_by(WebsitePage.sort_order.asc()).all()
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "slug": p.slug,
            "page_type": p.page_type or "custom",
            "sort_order": p.sort_order or 0,
        }
        for p in pages
    ]


@website_bp.route("/public/<slug>", methods=["GET"])
def get_public_website(slug):
    """Get public website data for a school (no auth required)."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    website = SchoolWebsite.query.filter_by(
        school_id=school.id, is_published=True, is_deleted=False
    ).first()

    # Live data sources for every public section type (notices, teachers,
    # gallery). The home fallback layout destructures `teachers` and
    # `gallery` from this payload, so they must always be present.
    notices = _public_notices_payload(school)
    teachers = _public_teachers_payload(school)
    gallery = _public_gallery_payload(school)

    # Get home page sections from website builder
    home_page = WebsitePage.query.filter_by(
        school_id=school.id,
        slug="home",
        is_published=True,
        is_deleted=False,
    ).first()
    page_sections = []
    if home_page:
        raw = home_page.sections or []
        page_sections = sorted(raw, key=lambda s: s.get("sort_order", 0))

    # Merge the legacy top-level custom_css column into the nested
    # customizations dict so CSS written via PUT /website/config {"custom_css"}
    # actually reaches the public renderer (the layout reads
    # customizations.custom_css). Nested value wins when both exist. Both
    # paths are sanitized on write in update_website_config.
    customizations = dict(website.customizations) if website and isinstance(website.customizations, dict) else {}
    if website and website.custom_css and not customizations.get("custom_css"):
        customizations["custom_css"] = website.custom_css

    return success_response({
        "school": _public_school_dict(school),
        "website": {
            "theme_slug": website.theme_slug if website else "default",
            "customizations": customizations,
            "meta_title": website.meta_title if website else school.name,
            "meta_description": website.meta_description if website else None,
        } if website else None,
        "sections": page_sections,
        "pages": _public_pages_payload(school),
        "notices": notices,
        "teachers": teachers,
        "gallery": gallery,
    })


@website_bp.route("/public/<slug>/pages/<page_slug>", methods=["GET"])
def get_public_page(slug, page_slug):
    """Public renderer for ANY stored website-builder page (no auth required).

    Generalizes rendering beyond the hardcoded home page: every page created
    in the builder (default theme pages or custom slugs) is resolvable here
    by slug, with its sections plus the live data sources sections need.
    Unknown slugs return 404.
    """
    school, err = _public_site_guard(slug)
    if err:
        return err

    from sqlalchemy import func

    # S-12: drafts must not be publicly renderable.
    page = WebsitePage.query.filter(
        WebsitePage.school_id == school.id,
        func.lower(WebsitePage.slug) == (page_slug or "").strip().lower(),
        WebsitePage.is_published.is_(True),
        WebsitePage.is_deleted.is_(False),
    ).first()
    if not page:
        return error_response("Page not found", 404)

    page_sections = sorted(page.sections or [], key=lambda s: s.get("sort_order", 0))

    return success_response({
        "page": {
            "id": str(page.id),
            "title": page.title,
            "slug": page.slug,
            "meta_title": page.meta_title or page.title,
            "meta_description": page.meta_description or "",
        },
        "school": _public_school_dict(school),
        "sections": page_sections,
        "pages": _public_pages_payload(school),
        "notices": _public_notices_payload(school),
        "teachers": _public_teachers_payload(school),
        "gallery": _public_gallery_payload(school),
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

    from app.utils.tracking_ids import valid_ga_id, valid_pixel_id

    for key in ("theme_slug", "customizations", "is_published",
                "google_analytics_id", "facebook_pixel_id", "meta_title",
                "meta_description", "og_image_url"):
        if key not in data:
            continue
        value = data[key]
        # F4: GA/pixel ids land in inline <script> on the public site —
        # allowlist their exact formats, reject anything else.
        if key == "google_analytics_id" and value:
            if not valid_ga_id(value):
                return error_response(
                    "google_analytics_id must look like G-XXXXXXXXXX", 400
                )
        if key == "facebook_pixel_id" and value:
            if not valid_pixel_id(value):
                return error_response(
                    "facebook_pixel_id must be a numeric Meta pixel id", 400
                )
        setattr(website, key, value)

    # S-11: customizations.colors is interpolated into the public <style>
    # block — allowlist its keys and require real color values.
    if isinstance(website.customizations, dict) and "colors" in website.customizations:
        website.customizations = {
            **website.customizations,
            "colors": sanitize_colors(website.customizations.get("colors")),
        }

    # Theme switch: keep customizations["colors"] core tokens in sync with the
    # chosen theme (a stale template palette would otherwise keep overriding
    # the new theme on the public site). Explicit colors in the same payload win.
    if "theme_slug" in data and "colors" not in (data.get("customizations") or {}):
        from app.services.website.theme_engine import ThemeEngineService

        synced = ThemeEngineService.synced_colors(
            (website.customizations or {}).get("colors"),
            website.theme_slug,
            school_id=str(g.school_id),
        )
        if synced:
            website.customizations = {**(website.customizations or {}), "colors": synced}

    # customizations.custom_css is rendered into the public site's <style>
    # block — sanitize it on every write, same as top-level custom_css.
    if isinstance(website.customizations, dict) and "custom_css" in website.customizations:
        website.customizations = {
            **website.customizations,
            "custom_css": sanitize_custom_css(website.customizations.get("custom_css") or ""),
        }

    if "custom_css" in data:
        css = sanitize_custom_css(data["custom_css"] or "")
        website.custom_css = css

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
@limiter.limit("5/hour;20/day", key_func=_public_form_key)
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

    # W-04: persist to a real inbox (was audit_logs-only — nobody could ever
    # read the message) + keep the audit line for the trail.
    from app.models.contact import ContactMessage
    from app.models.compliance import AuditLog as _AuditLog

    msg = ContactMessage(
        school_id=school.id,
        name=name,
        phone=phone or None,
        email=email or None,
        message=message,
        source_page=request.headers.get("Referer", "")[:300],
        ip_address=request.remote_addr,
    )
    db.session.add(msg)
    log = _AuditLog(
        school_id=school.id,
        action="contact_form",
        resource_type="contact",
        resource_id=msg.id,
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
@limiter.limit("5/hour;20/day", key_func=_public_form_key)
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


def _public_school_or_none(slug):
    return School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()


def _public_site_guard(slug):
    """Shared guard for every public /website/public/<slug> endpoint.

    Returns (school, error_response). When a SchoolWebsite row exists but is
    explicitly unpublished (the website-builder "Unpublish" button), the site
    is intentionally offline → 404. Schools without any website row keep the
    legacy always-on fallback rendering (basic_website-only schools).
    """
    school = School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()
    if not school:
        return None, error_response("School not found", 404)

    website = SchoolWebsite.query.filter_by(
        school_id=school.id, is_deleted=False
    ).first()
    if website and not website.is_published:
        # Still a 404 (site is offline), but surface the school name so the
        # frontend can render an honest "website coming soon" state.
        return None, error_response(
            "Website not published",
            404,
            data={"school_name": school.name, "slug": slug},
        )
    return school, None


@website_bp.route("/public/<slug>/teachers", methods=["GET"])
def get_public_teachers(slug):
    """Public teacher directory — real staff of the school (no auth)."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    return success_response({"teachers": _public_teachers_payload(school)})


def _public_news_article_dict(n) -> dict:
    """News article shape the public news pages consume (B-11).

    News is the published-notice stream: `slug` is the notice id, `excerpt`
    is a tag-stripped preview, `image_url` stays empty until notices grow
    cover images (P-A attachment work).
    """
    excerpt = re.sub(r"<[^>]+>", " ", n.content or "")
    excerpt = re.sub(r"\s+", " ", excerpt).strip()[:200]
    return {
        "id": str(n.id),
        "title": n.title,
        "title_nepali": getattr(n, "title_nepali", None),
        "content": n.content,
        "content_nepali": getattr(n, "content_nepali", None),
        "excerpt": excerpt,
        "slug": str(n.id),
        "image_url": None,
        "author": n.created_by.full_name if n.created_by else None,
        "category": getattr(n, "notice_type", None),
        "created_at": n.published_at.isoformat()
        if getattr(n, "published_at", None)
        else (n.created_at.isoformat() if n.created_at else None),
    }


@website_bp.route("/public/<slug>/news", methods=["GET"])
def get_public_news(slug):
    """Public news feed — published notices as articles (no auth)."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    articles = (
        Notice.query.filter(
            Notice.school_id == school.id,
            Notice.is_deleted.is_(False),
            Notice.published_at.isnot(None),
        )
        .order_by(Notice.published_at.desc(), Notice.created_at.desc())
        .limit(30)
        .all()
    )
    return success_response(
        {"articles": [_public_news_article_dict(n) for n in articles]}
    )


@website_bp.route("/public/<slug>/news/<article_slug>", methods=["GET"])
def get_public_news_article(slug, article_slug):
    """Single public news article — resolved by notice id (no auth)."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    if not re.fullmatch(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        article_slug or "",
    ):
        return error_response("Article not found", 404)

    notice = Notice.query.filter(
        Notice.id == article_slug,
        Notice.school_id == school.id,
        Notice.is_deleted.is_(False),
        Notice.published_at.isnot(None),
    ).first()
    if not notice:
        return error_response("Article not found", 404)
    return success_response(_public_news_article_dict(notice))


@website_bp.route("/public/<slug>/events", methods=["GET"])
def get_public_events(slug):
    """Public events calendar — synced from the school's event records."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    from app.models.notice import Event

    events = (
        Event.query.filter(
            Event.school_id == school.id,
            Event.is_deleted.is_(False),
        )
        .order_by(Event.start_date.desc())
        .limit(100)
        .all()
    )

    return success_response({
        "events": [
            {
                "id": str(e.id),
                "title": e.title,
                "description": e.description or "",
                "date": e.start_date.isoformat() if e.start_date else None,
                "end_date": e.end_date.isoformat() if e.end_date else None,
                "location": e.location or "",
                "type": e.event_type or "",
            }
            for e in events
        ]
    })


@website_bp.route("/public/<slug>/gallery", methods=["GET"])
def get_public_gallery(slug):
    """Public photo gallery — school's uploaded images (file manager)."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    return success_response({"images": _public_gallery_payload(school)})


@website_bp.route("/public/<slug>/alumni", methods=["GET"])
def get_public_alumni(slug):
    """Public alumni directory — verified alumni profiles."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    from app.models.alumni import Alumni

    alumni_rows = (
        Alumni.query.filter(
            Alumni.school_id == school.id,
            Alumni.is_deleted.is_(False),
        )
        .order_by(Alumni.graduation_year.desc())
        .limit(100)
        .all()
    )

    return success_response({
        "alumni": [
            {
                "id": str(a.id),
                "name": f"{a.first_name} {a.last_name or ''}".strip(),
                "batch_year": a.graduation_year or a.batch or "",
                "current_occupation": a.designation or "",
                "organization": a.current_organization or "",
                "photo_url": a.photo_url or None,
                "testimonial": a.bio or "",
            }
            for a in alumni_rows
        ]
    })


@website_bp.route("/public/<slug>/results", methods=["GET"])
@limiter.limit("5/hour;20/day", key_func=_public_form_key)
def get_public_results(slug):
    """Public result checker — symbol number + DOB returns published exam result."""
    school, err = _public_site_guard(slug)
    if err:
        return err

    symbol_no = (request.args.get("symbol_no") or "").strip()
    dob = (request.args.get("dob") or "").strip()
    if not symbol_no or not dob:
        return error_response("symbol_no and dob are required", 400)

    from datetime import date as _date

    from sqlalchemy import or_

    from app.models.exam import Exam, Marks
    from app.models.student import Student

    student = Student.query.filter(
        Student.school_id == school.id,
        Student.is_deleted.is_(False),
        or_(
            Student.admission_number == symbol_no,
            Student.student_id == symbol_no,
        ),
    ).first()
    if not student:
        return error_response("Result not found. Please check your details.", 404)

    # DOB must match either the BS or AD date of birth on record.
    dob_ad = None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            from datetime import datetime as _datetime

            dob_ad = _datetime.strptime(dob, fmt).date()
            break
        except ValueError:
            continue
    dob_matches = (student.dob_bs == dob) or (
        dob_ad is not None and student.dob_ad == dob_ad
    )
    if not dob_matches:
        return error_response("Result not found. Please check your details.", 404)

    # Latest published exam that has marks for this student.
    latest_mark = (
        Marks.query.join(Exam, Marks.exam_id == Exam.id)
        .filter(
            Marks.student_id == student.id,
            Marks.is_deleted.is_(False),
            Exam.status == "result_published",
            Exam.is_deleted.is_(False),
        )
        .order_by(Exam.created_at.desc())
        .first()
    )
    if not latest_mark:
        return error_response(
            "No published results found for this student yet.", 404
        )

    exam = latest_mark.exam
    marks_rows = (
        Marks.query.filter(
            Marks.student_id == student.id,
            Marks.exam_id == exam.id,
            Marks.is_deleted.is_(False),
        )
        .all()
    )

    subject_ids = [m.subject_id for m in marks_rows if m.subject_id]
    subject_map = {}
    if subject_ids:
        from app.models.academic import Subject

        subject_map = {
            s.id: s
            for s in Subject.query.filter(Subject.id.in_(subject_ids)).all()
        }

    results = []
    total_obtained = 0.0
    total_full = 0.0
    gpa_values = []
    for m in marks_rows:
        subj = subject_map.get(m.subject_id)
        full = float(m.full_marks or (subj.full_marks if subj else 0) or 0)
        obtained = float(
            m.total_marks if m.total_marks is not None
            else (m.obtained_marks or (m.theory_marks or 0) + (m.practical_marks or 0))
        )
        total_obtained += obtained
        total_full += full
        if m.gpa is not None:
            gpa_values.append(float(m.gpa))
        results.append({
            "subject": subj.name if subj else "Subject",
            "full_marks": full,
            "pass_marks": float(m.pass_marks or 0),
            "obtained_marks": obtained,
            "grade": m.grade or "",
            "grade_point": float(m.gpa) if m.gpa is not None else 0.0,
        })

    percentage = round(total_obtained / total_full * 100, 2) if total_full else 0.0
    gpa = round(sum(gpa_values) / len(gpa_values), 2) if gpa_values else 0.0

    from app.models.academic import AcademicYear

    academic_year_name = ""
    if exam.academic_year_id:
        year_row = AcademicYear.query.get(exam.academic_year_id)
        academic_year_name = year_row.name if year_row else ""

    return success_response({
        "student_name": f"{student.first_name} {student.last_name or ''}".strip(),
        "class_name": student.klass.name if getattr(student, "klass", None) else "",
        "section": student.section.name if getattr(student, "section", None) else "",
        "roll_number": student.roll_number,
        "exam_name": exam.name,
        "academic_year": academic_year_name,
        "results": results,
        "total_marks": total_obtained,
        "percentage": percentage,
        "gpa": gpa,
        "rank": latest_mark.rank_in_class,
        "remarks": latest_mark.remarks or "",
    })


# ── W-04: contact inbox (admin) ──────────────────────────────────────────


@website_bp.route("/contact-messages", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def list_contact_messages():
    """Unread-first inbox for the school's public contact form."""
    from app.models.contact import ContactMessage
    from sqlalchemy import case

    query = ContactMessage.query.filter(
        ContactMessage.school_id == g.school_id,
        ContactMessage.is_deleted.is_(False),
    )
    if request.args.get("unread") == "true":
        query = query.filter(ContactMessage.is_read.is_(False))
    rows = (
        query.order_by(
            case((ContactMessage.is_read.is_(False), 0), else_=1),
            ContactMessage.created_at.desc(),
        )
        .limit(100)
        .all()
    )
    return success_response(
        {
            "unread_count": ContactMessage.query.filter_by(
                school_id=g.school_id, is_read=False, is_deleted=False
            ).count(),
            "messages": [
                {
                    "id": str(m.id),
                    "name": m.name,
                    "phone": m.phone,
                    "email": m.email,
                    "message": m.message,
                    "source_page": m.source_page,
                    "is_read": bool(m.is_read),
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in rows
            ],
        }
    )


@website_bp.route("/contact-messages/<uuid:message_id>/read", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def mark_contact_read(message_id):
    from datetime import datetime, timezone

    from app.models.contact import ContactMessage
    from extensions import db

    msg = ContactMessage.query.filter_by(
        id=message_id, school_id=g.school_id, is_deleted=False
    ).first()
    if msg is None:
        return error_response("Message not found", 404)
    msg.is_read = True
    msg.read_by_id = g.user_id
    msg.read_at = datetime.now(timezone.utc)
    db.session.commit()
    return success_response({"read": True})


# ══════════════════════════════════════════════════════════════════════════
# S-A5 — A-09 public admission registration + A-22 guest payments
# (unauthenticated, slug-scoped, rate-limited; staging rows only —
# provisioning happens in the office, via /admission/registrations/*)
# ══════════════════════════════════════════════════════════════════════════

@website_bp.route("/public/<slug>/admission/registration", methods=["POST"])
@limiter.limit("5/hour;20/day", key_func=_public_form_key)
def submit_public_admission_registration(slug):
    """Public admission application — lands in the staging queue."""
    from app.services.admission_funnel import DuplicateRegistrationError, submit_public_registration

    school, err = _public_site_guard(slug)
    if err is not None:
        return err
    data = request.get_json(silent=True) or {}
    try:
        reg = submit_public_registration(school, data)
    except DuplicateRegistrationError:
        return error_response(
            "An application with these details was already submitted recently",
            409,
        )
    except ValueError as exc:
        return error_response(str(exc), 400)
    from extensions import db

    db.session.add(reg)
    db.session.commit()
    # verification_token rides ONLY the submission response — it is the
    # applicant's status-tracking receipt (the enumeration guard for the
    # status endpoint).
    return created_response({
        "id": str(reg.id),
        "registration_number": reg.registration_number,
        "verification_token": reg.verification_token,
        "status": reg.status,
        "message": "Application received. The school office will contact you.",
    })


@website_bp.route("/public/<slug>/admission/registration/<uuid:registration_id>", methods=["GET"])
def public_registration_status(slug, registration_id):
    """Applicant status view — requires the verification token from the
    submission response (enumeration guard); minimal PII."""
    from app.models.admission import AdmissionRegistration

    school, err = _public_site_guard(slug)
    if err is not None:
        return err
    token = (request.args.get("token") or "").strip()
    reg = AdmissionRegistration.query.filter_by(
        id=registration_id, school_id=school.id, is_deleted=False
    ).first()
    if reg is None or not token or token != (reg.verification_token or ""):
        return error_response("Registration not found", 404)
    return success_response({
        "registration_number": reg.registration_number,
        "status": reg.status,
        "student_name": f"{reg.student_first_name} {reg.student_last_name or ''}".strip(),
        "review_notes": reg.review_notes if reg.status == "rejected" else None,
        "submitted_at": reg.created_at.isoformat() if reg.created_at else None,
    })


@website_bp.route("/public/<slug>/payments/lookup", methods=["POST"])
@limiter.limit("10/hour;30/day", key_func=_public_form_key)
def guest_fee_lookup(slug):
    """A-22 guest payments, step 1: find a student's dues without an
    account (enrollment number or guardian phone). Minimal PII."""
    from app.models.fee import FeeCollection
    from app.models.student import Guardian, Student

    school, err = _public_site_guard(slug)
    if err is not None:
        return err
    data = request.get_json(silent=True) or {}
    identifier = str(data.get("student_identifier") or "").strip()
    if not identifier:
        return error_response("student_identifier is required", 400)

    student = Student.query.filter(
        Student.school_id == school.id,
        Student.is_deleted.is_(False),
        Student.status == "active",
        or_(Student.enrollment_number == identifier,
            Student.student_id == identifier),
    ).first()
    if student is None:
        guardian = Guardian.query.filter(
            Guardian.student_id == Student.id,
            Guardian.school_id == school.id,
            Guardian.is_deleted.is_(False),
            Guardian.phone == identifier[-10:],
        ).first()
        student = (
            Student.query.filter_by(id=guardian.student_id, is_deleted=False).first()
            if guardian else None
        )
    if student is None:
        return error_response("No student found for that identifier", 404)

    dues = FeeCollection.query.filter(
        FeeCollection.school_id == school.id,
        FeeCollection.student_id == student.id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(("pending", "partial")),
    ).all()
    outstanding = []
    for bill in dues:
        try:
            from app.api.v1.fees import _collection_payable_total, _extract_partial_paid

            payable = float(_collection_payable_total(bill))
            paid = min(float(_extract_partial_paid(bill)), payable)
            due = max(payable - paid, 0.0)
        except Exception:
            payable = float(bill.amount or 0)
            due = payable
        if due > 0.005:
            outstanding.append({
                "collection_id": str(bill.id),
                "fee_type": bill.fee_item_name,
                "due_amount": round(due, 2),
                "month_bs": bill.month_bs,
            })
    return success_response({
        "student_id": str(student.id),
        "student_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
        "class_name": (student.to_dict() or {}).get("class_name"),
        "outstanding": outstanding,
    })


@website_bp.route("/public/<slug>/payments/initiate", methods=["POST"])
@limiter.limit("5/hour;20/day", key_func=_public_form_key)
def guest_fee_initiate(slug):
    """A-22 guest payments, step 2: create guest PaymentInitiation rows and
    return the gateway hosted-checkout payload. Completion rides the
    EXISTING /webhooks/<gateway>/callback + success routes — the initiation
    row (context='guest_fee') is the server-side anchor."""
    from app.models.fee import FeeCollection, PaymentInitiation

    school, err = _public_site_guard(slug)
    if err is not None:
        return err
    data = request.get_json(silent=True) or {}
    collection_ids = data.get("collection_ids") or []
    payer_phone = str(data.get("payer_phone") or "").strip()[:20]
    provider = str(data.get("provider") or "esewa").strip().lower()
    if provider not in ("esewa", "khalti", "fonepay"):
        return error_response("provider must be esewa|khalti|fonepay", 400)
    if not isinstance(collection_ids, list) or not collection_ids:
        return error_response("collection_ids is required", 400)

    bills = []
    total = 0.0
    for cid in collection_ids[:20]:
        parsed = _parse_uuid_safe(cid)
        if not parsed:
            continue
        bill = FeeCollection.query.filter(
            FeeCollection.id == parsed,
            FeeCollection.school_id == school.id,
            FeeCollection.is_deleted.is_(False),
            FeeCollection.payment_status.in_(("pending", "partial")),
        ).first()
        if bill is None:
            continue
        try:
            from app.api.v1.fees import _collection_payable_total, _extract_partial_paid

            payable = float(_collection_payable_total(bill))
            paid = min(float(_extract_partial_paid(bill)), payable)
        except Exception:
            payable = float(bill.amount or 0)
            paid = 0.0
        due = max(payable - paid, 0.0)
        if due > 0.005:
            bills.append((bill, round(due, 2)))
            total += due
    if not bills:
        return error_response("No valid outstanding bills to pay", 400)

    from app.services.payments.esewa_gateway import EsewaGateway
    from app.services.payments.khalti_gateway import KhaltiGateway

    # Per-school credentials — the SAME configured-methods resolver the desk
    # path uses (its method rows carry merchant_code/secret_key).
    from app.api.v1.fees import _get_configured_payment_methods

    with_current_app = None
    from flask import current_app as _app

    with_current_app = _app
    methods = _get_configured_payment_methods.__wrapped__() \
        if hasattr(_get_configured_payment_methods, "__wrapped__") \
        else None
    if methods is None:
        # Not a decorated function: call needs app+g context; the public
        # request has no g.school_id — resolve the school's methods directly
        # from the fees plugin config store instead.
        from app.plugins.config_store import get_plugin_config

        methods = _methods_from_plugin_config(school.id)
    method_index = {m["key"]: m for m in (methods or [])}
    selected = method_index.get(provider)
    if not selected or not selected.get("enabled"):
        return error_response(f"Payment provider '{provider}' is not enabled", 400)

    first_bill, _ = bills[0]
    # The first bill's id doubles as the transaction anchor (same shape as
    # the desk path: esewa transaction_uuid = collection id).
    anchor_id = str(first_bill.id)
    base_url = request.host_url.rstrip("/")
    try:
        if provider == "esewa":
            payload = EsewaGateway.initiate_payment(
                transaction_uuid=anchor_id,
                amount=round(total, 2),
                product_code=(selected.get("merchant_code") or "").strip(),
                secret_key=(selected.get("secret_key") or "").strip(),
                success_url=f"{base_url}/webhooks/esewa/callback",
                failure_url=f"{base_url}/webhooks/esewa/callback",
            )
        else:
            result = KhaltiGateway.initiate_payment(
                purchase_order_id=anchor_id,
                purchase_order_name=f"Guest fee payment ({school.name})",
                amount_paisa=int(round(total, 2) * 100),
                return_url=f"{base_url}/webhooks/khalti/callback",
                secret_key=(selected.get("secret_key") or "").strip(),
                customer_info={"phone": payer_phone} if payer_phone else None,
            )
            payload = result
    except ValueError as exc:
        return error_response(f"Payment gateway not configured: {exc}", 400)
    except Exception as exc:  # noqa: BLE001 — gateway outages are user-facing
        return error_response(f"Payment gateway error: {exc}", 502)

    for bill, due in bills:
        db.session.add(PaymentInitiation(
            school_id=school.id,
            collection_id=bill.id,
            gateway=provider,
            gateway_ref=anchor_id,
            amount=due,
            status="initiated",
            context="guest_fee",
        ))
    db.session.commit()
    return created_response({
        "total_amount": round(total, 2),
        "provider": provider,
        "checkout": payload,
        "message": "Complete the payment, then keep the reference — the school "
                   "is notified automatically when the gateway confirms.",
    })


def _parse_uuid_safe(value):
    import uuid as _uuid

    try:
        return _uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None

def _methods_from_plugin_config(school_id):
    """Per-school payment-method rows from the fees plugin config (the
    guest path has no JWT, so fees.py's g-bound resolver can't run)."""
    try:
        from app.plugins.config_store import get_plugin_config

        cfg = get_plugin_config(str(school_id), "fees", {}) or {}
        methods = cfg.get("payment_methods")
        if isinstance(methods, list):
            return methods
    except Exception:  # noqa: BLE001
        pass
    return []
