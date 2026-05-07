"""School banner slider API."""
from __future__ import annotations

from datetime import datetime

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required

from app.models.slider import SchoolSlider
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

sliders_bp = Blueprint("sliders", __name__, url_prefix="/sliders")


@sliders_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def list_sliders():
    query = SchoolSlider.query.filter_by(school_id=g.school_id, is_deleted=False)
    include_inactive = request.args.get("include_inactive", "false").lower() == "true"
    role = get_jwt().get("role")
    if not include_inactive or role not in ("superadmin", "school_admin"):
        query = query.filter_by(is_active=True)

    now = datetime.utcnow()
    query = query.filter(
        (SchoolSlider.starts_at.is_(None)) | (SchoolSlider.starts_at <= now),
        (SchoolSlider.ends_at.is_(None)) | (SchoolSlider.ends_at >= now),
    )
    sliders = query.order_by(SchoolSlider.sort_order.asc(), SchoolSlider.created_at.desc()).all()
    return success_response([_slider_dict(slider) for slider in sliders])


@sliders_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_slider():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    image_url = (data.get("image_url") or data.get("image") or "").strip()
    if not title or not image_url:
        return error_response("title and image_url are required", 400)

    slider = SchoolSlider(
        school_id=g.school_id,
        title=title,
        subtitle=(data.get("subtitle") or "").strip() or None,
        image_url=image_url,
        link_url=(data.get("link_url") or "").strip() or None,
        sort_order=int(data.get("sort_order") or 0),
        is_active=data.get("is_active", True),
        starts_at=_parse_datetime(data.get("starts_at")),
        ends_at=_parse_datetime(data.get("ends_at")),
    )
    db.session.add(slider)
    db.session.commit()
    return created_response(_slider_dict(slider))


@sliders_bp.route("/<uuid:slider_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_slider(slider_id):
    slider = SchoolSlider.query.filter_by(
        id=slider_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not slider:
        return error_response("Slider not found", 404)

    data = request.get_json(silent=True) or {}
    if "title" in data:
        slider.title = (data.get("title") or "").strip() or slider.title
    if "subtitle" in data:
        slider.subtitle = (data.get("subtitle") or "").strip() or None
    if "image_url" in data or "image" in data:
        image_url = (data.get("image_url") or data.get("image") or "").strip()
        if image_url:
            slider.image_url = image_url
    if "link_url" in data:
        slider.link_url = (data.get("link_url") or "").strip() or None
    if "sort_order" in data:
        slider.sort_order = int(data.get("sort_order") or 0)
    if "is_active" in data:
        slider.is_active = bool(data.get("is_active"))
    if "starts_at" in data:
        slider.starts_at = _parse_datetime(data.get("starts_at"))
    if "ends_at" in data:
        slider.ends_at = _parse_datetime(data.get("ends_at"))

    db.session.commit()
    return success_response(_slider_dict(slider))


@sliders_bp.route("/<uuid:slider_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_slider(slider_id):
    slider = SchoolSlider.query.filter_by(
        id=slider_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not slider:
        return error_response("Slider not found", 404)

    slider.is_deleted = True
    db.session.commit()
    return success_response({"deleted": True})


def _slider_dict(slider: SchoolSlider) -> dict:
    return {
        "id": str(slider.id),
        "title": slider.title,
        "subtitle": slider.subtitle,
        "image_url": slider.image_url,
        "image": slider.image_url,
        "link_url": slider.link_url,
        "sort_order": slider.sort_order or 0,
        "is_active": bool(slider.is_active),
        "starts_at": slider.starts_at.isoformat() if slider.starts_at else None,
        "ends_at": slider.ends_at.isoformat() if slider.ends_at else None,
        "created_at": slider.created_at.isoformat() if slider.created_at else None,
    }


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except (TypeError, ValueError):
        return None
