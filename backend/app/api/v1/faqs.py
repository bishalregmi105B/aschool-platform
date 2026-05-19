"""FAQ management API — manage frequently asked questions for the school website."""
from flask import g, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.faq import FAQ
from app.utils.response import success_response, created_response, no_content_response, error_response
from . import api_v1_bp

faqs_bp = __import__("flask", fromlist=["Blueprint"]).Blueprint("faqs", __name__, url_prefix="/faqs")


def _faq_dict(faq: "FAQ") -> dict:
    return {
        "id": str(faq.id),
        "question": faq.question,
        "answer": faq.answer,
        "category": faq.category,
        "is_active": faq.is_active,
        "sort_order": faq.sort_order,
        "created_at": faq.created_at.isoformat() if faq.created_at else None,
    }


@faqs_bp.route("", methods=["GET"])
@jwt_required()
def list_faqs():
    """List all FAQs for the school (admin view)."""
    category = request.args.get("category")
    query = FAQ.query.filter_by(school_id=g.school_id, is_deleted=False)
    if category:
        query = query.filter_by(category=category)
    faqs = query.order_by(FAQ.sort_order.asc(), FAQ.created_at.desc()).all()
    return success_response([_faq_dict(f) for f in faqs])


@faqs_bp.route("/public", methods=["GET"])
def list_public_faqs():
    """Public FAQ listing (no auth required) — for school website."""
    school_slug = request.args.get("school_slug")
    from app.models.school import School
    school = School.query.filter_by(slug=school_slug, is_active=True).first() if school_slug else None
    school_id = school.id if school else None
    if not school_id:
        return success_response([])
    faqs = FAQ.query.filter_by(school_id=school_id, is_active=True, is_deleted=False).order_by(FAQ.sort_order.asc()).all()
    return success_response([_faq_dict(f) for f in faqs])


@faqs_bp.route("", methods=["POST"])
@jwt_required()
def create_faq():
    """Create a new FAQ entry."""
    data = request.get_json() or {}
    question = data.get("question", "").strip()
    answer = data.get("answer", "").strip()
    if not question or not answer:
        return error_response("question and answer are required", 422)
    faq = FAQ(
        school_id=g.school_id,
        question=question,
        answer=answer,
        category=data.get("category", "General"),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", 0),
    )
    db.session.add(faq)
    db.session.commit()
    return created_response(_faq_dict(faq))


@faqs_bp.route("/<uuid:faq_id>", methods=["PUT"])
@jwt_required()
def update_faq(faq_id):
    """Update an existing FAQ."""
    faq = FAQ.query.filter_by(id=faq_id, school_id=g.school_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}
    for key in ("question", "answer", "category", "is_active", "sort_order"):
        if key in data:
            setattr(faq, key, data[key])
    db.session.commit()
    return success_response(_faq_dict(faq))


@faqs_bp.route("/<uuid:faq_id>", methods=["DELETE"])
@jwt_required()
def delete_faq(faq_id):
    """Soft-delete an FAQ."""
    faq = FAQ.query.filter_by(id=faq_id, school_id=g.school_id, is_deleted=False).first_or_404()
    faq.is_deleted = True
    db.session.commit()
    return no_content_response()
