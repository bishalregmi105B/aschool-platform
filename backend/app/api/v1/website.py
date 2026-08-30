"""Basic Website plugin API — public pages for school website."""
import re
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.school import School, SchoolWebsite
from app.models.notice import Notice
from app.models.website import WebsitePage
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response
from extensions import db


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

website_bp = Blueprint("basic_website", __name__, url_prefix="/website")


@website_bp.route("/public/<slug>", methods=["GET"])
def get_public_website(slug):
    """Get public website data for a school (no auth required)."""
    school, err = _public_site_guard(slug)
    if err:
        return err

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

    # Merge the legacy top-level custom_css column into the nested
    # customizations dict so CSS written via PUT /website/config {"custom_css"}
    # actually reaches the public renderer (the layout reads
    # customizations.custom_css). Nested value wins when both exist. Both
    # paths are sanitized on write in update_website_config.
    customizations = dict(website.customizations) if website and isinstance(website.customizations, dict) else {}
    if website and website.custom_css and not customizations.get("custom_css"):
        customizations["custom_css"] = website.custom_css

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
            "customizations": customizations,
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

    for key in ("theme_slug", "customizations", "is_published",
                "google_analytics_id", "facebook_pixel_id", "meta_title",
                "meta_description", "og_image_url"):
        if key in data:
            setattr(website, key, data[key])

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

    return success_response({
        "teachers": [
            {
                "id": str(t.id),
                "name": t.full_name,
                "designation": "",
                "department": "",
                "qualification": "",
                "photo_url": t.avatar_url or None,
            }
            for t in teachers
        ]
    })


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

    from app.models.file import ManagedFile

    images = (
        ManagedFile.query.filter(
            ManagedFile.school_id == school.id,
            ManagedFile.file_type == "image",
            ManagedFile.is_deleted.is_(False),
        )
        .order_by(ManagedFile.created_at.desc())
        .limit(60)
        .all()
    )

    return success_response({
        "images": [
            {
                "id": str(img.id),
                "url": img.url,
                "caption": img.original_name or "",
                "uploaded_at": img.created_at.isoformat() if img.created_at else None,
            }
            for img in images
        ]
    })


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
