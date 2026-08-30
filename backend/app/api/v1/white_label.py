"""White-Label Branding API — custom domain with real DNS verification, branding
overrides, and admin-app theme (premium plugin, NPR 2999)."""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.services.website import white_label as wl
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response

white_label_bp = Blueprint("white_label", __name__, url_prefix="/schools/white-label")


def _school_or_error():
    """Return (school, None) or (None, error_response)."""
    from app.models.school import School

    school = School.query.get(g.school_id)
    if not school:
        return None, error_response("School not found", 404)
    return school, None


# ── Overview (setup checklist) ────────────────────────────────────────────

@white_label_bp.route("/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("white_label")
def overview():
    """Checklist data for the white-label overview page."""
    school, err = _school_or_error()
    if err:
        return err

    branding = wl.WhiteLabelService.get_branding(g.school_id)
    flags = wl.WhiteLabelService.get_effective_flags(g.school_id)
    domain = wl.WhiteLabelService.get_domain_status(school)

    # Honest derivation: a custom EMAIL domain is only "done" when the school's
    # own contact email lives on the verified custom domain. No external
    # email-hosting infra is provisioned by this plugin.
    custom_email_domain = bool(
        school.email
        and school.custom_domain
        and school.domain_verified
        and school.email.lower().strip().endswith(f"@{school.custom_domain.lower()}")
    )

    return success_response({
        "has_logo": bool(branding.get("logo_url")),
        "custom_domain_active": domain["status"] == "active",
        "brand_colors_set": bool(branding.get("primary_color") and branding.get("secondary_color")),
        "branding_hidden": bool(flags.get("hide_aschool_branding")),
        "custom_email_domain": custom_email_domain,
        "custom_domain": domain["custom_domain"],
        "domain_verified": domain["domain_verified"],
        "branding": branding,
        "theme": wl.WhiteLabelService.get_theme(g.school_id),
    })


# ── Custom domain ─────────────────────────────────────────────────────────

@white_label_bp.route("/domain", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("white_label")
def get_domain():
    """Custom-domain configuration + the DNS records the school must create."""
    school, err = _school_or_error()
    if err:
        return err
    return success_response(wl.WhiteLabelService.get_domain_status(school))


@white_label_bp.route("/domain", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("white_label")
@role_required("superadmin", "school_admin")
def request_domain():
    """Save/replace the custom-domain request; verification resets to pending."""
    school, err = _school_or_error()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    raw = data.get("domain") or data.get("custom_domain")
    if not raw:
        return error_response("domain is required", 400)

    try:
        status = wl.WhiteLabelService.set_domain(school, str(raw))
    except ValueError as e:
        return error_response(str(e), 400)
    return success_response(status)


@white_label_bp.route("/domain/verify", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("white_label")
@role_required("superadmin", "school_admin")
def verify_domain():
    """Run a REAL DNS lookup (CNAME/A) of the saved domain — never a stub success."""
    school, err = _school_or_error()
    if err:
        return err

    try:
        result = wl.WhiteLabelService.verify_domain_dns(school)
    except ValueError as e:
        return error_response(str(e), 400)
    return success_response(result)


# ── Branding ──────────────────────────────────────────────────────────────

@white_label_bp.route("/branding", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("white_label")
def get_branding():
    """Effective branding overrides (school identity, colors, logo, flags)."""
    return success_response(wl.WhiteLabelService.get_branding(g.school_id))


@white_label_bp.route("/branding", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("white_label")
@role_required("superadmin", "school_admin")
def update_branding():
    """Update branding; writes through to SchoolWebsite.customizations and
    School.logo_url so the website/branding layer picks it up immediately."""
    data = request.get_json(silent=True) or {}
    if not data:
        return error_response("No branding fields provided", 400)

    try:
        branding = wl.WhiteLabelService.save_branding(g.school_id, data)
    except ValueError as e:
        return error_response(str(e), 400)
    return success_response(branding)


# ── Admin-app theme ───────────────────────────────────────────────────────

@white_label_bp.route("/theme", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("white_label")
def get_theme():
    """Admin-app appearance overrides for this school."""
    return success_response(wl.WhiteLabelService.get_theme(g.school_id))


@white_label_bp.route("/theme", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("white_label")
@role_required("superadmin", "school_admin")
def update_theme():
    """Persist admin-app theme overrides (mode, sidebar, colors, density)."""
    data = request.get_json(silent=True) or {}
    if not data:
        return error_response("No theme fields provided", 400)

    try:
        theme = wl.WhiteLabelService.save_theme(g.school_id, data)
    except ValueError as e:
        return error_response(str(e), 400)
    return success_response(theme)
