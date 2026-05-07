"""Plan-compatible theme API for school website themes."""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response

themes_bp = Blueprint("themes", __name__, url_prefix="/themes")


@themes_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def list_themes():
    from app.services.website.theme_engine import ThemeEngineService

    return success_response(ThemeEngineService.list_themes())


@themes_bp.route("/<theme_id>", methods=["GET"])
@jwt_required()
@school_required
def get_theme(theme_id):
    from app.services.website.theme_engine import ThemeEngineService

    theme = ThemeEngineService.get_theme(theme_id)
    if not theme:
        return error_response("Theme not found", 404)
    return success_response(theme)


@themes_bp.route("/<theme_id>/preview-css", methods=["GET"])
@jwt_required()
@school_required
def preview_css(theme_id):
    from app.services.website.theme_engine import ThemeEngineService

    return success_response({"theme_id": theme_id, "css": ThemeEngineService.generate_css(theme_id)})


@themes_bp.route("/apply", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("website_builder")
@role_required("superadmin", "school_admin")
def apply_theme():
    from app.services.website.theme_engine import ThemeEngineService

    data = request.get_json(silent=True) or {}
    theme_id = data.get("theme_id") or data.get("theme_slug")
    if not theme_id:
        return error_response("theme_id is required")

    result = ThemeEngineService.apply_theme(g.school_id, theme_id, data.get("color_overrides"))
    if "error" in result:
        return error_response(result["error"], 400)
    return success_response(result)
