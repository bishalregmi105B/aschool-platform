"""Student Portfolio API — portfolios, items, micro-credentials.

Routes are gated on the canonical slug `student_portfolio`; legacy
`portfolio` installs still pass via the alias in app/plugins/decorators.py.
"""
from datetime import datetime

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.portfolio import StudentPortfolio, PortfolioItem, MicroCredential
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

portfolio_bp = Blueprint("portfolio", __name__, url_prefix="/portfolio")


def _student_or_none(student_id):
    """E134: student must exist at THIS school before any portfolio write —
    an unknown/foreign uuid previously died at commit (FK violation → 500)."""
    return Student.query.filter_by(id=student_id, school_id=g.school_id).first()


@portfolio_bp.route("/students/<uuid:student_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("student_portfolio")
def get_portfolio(student_id):
    portfolio = StudentPortfolio.query.filter_by(
        student_id=student_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not portfolio:
        return success_response({"student_id": str(student_id), "exists": False})
    return success_response(_portfolio_dict(portfolio))


@portfolio_bp.route("/students/<uuid:student_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("student_portfolio")
@role_required("superadmin", "school_admin", "teacher")
def update_portfolio(student_id):
    data = request.get_json(silent=True) or {}
    if not _student_or_none(student_id):
        return error_response("Student not found at this school", 404)
    portfolio = StudentPortfolio.query.filter_by(
        student_id=student_id, school_id=g.school_id
    ).first()
    if not portfolio:
        portfolio = StudentPortfolio(student_id=student_id, school_id=g.school_id)
        db.session.add(portfolio)
    for key in ("bio", "interests", "skills", "is_public"):
        if key in data:
            setattr(portfolio, key, data[key])
    db.session.commit()
    return success_response(_portfolio_dict(portfolio))


# ── Portfolio Items ────────────────────────────────────────


@portfolio_bp.route("/students/<uuid:student_id>/items", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("student_portfolio")
def list_items(student_id):
    portfolio = StudentPortfolio.query.filter_by(
        student_id=student_id, school_id=g.school_id
    ).first()
    if not portfolio:
        return success_response([])
    query = PortfolioItem.query.filter_by(
        portfolio_id=portfolio.id, school_id=g.school_id, is_deleted=False
    )
    items, meta = paginate(query.order_by(PortfolioItem.created_at.desc()))
    return success_response([_item_dict(i) for i in items], meta={"pagination": meta})


@portfolio_bp.route("/students/<uuid:student_id>/items", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("student_portfolio")
@role_required("superadmin", "school_admin", "teacher")
def add_item(student_id):
    data = request.get_json(silent=True) or {}
    if not _student_or_none(student_id):
        return error_response("Student not found at this school", 404)
    portfolio = StudentPortfolio.query.filter_by(
        student_id=student_id, school_id=g.school_id
    ).first()
    if not portfolio:
        portfolio = StudentPortfolio(student_id=student_id, school_id=g.school_id)
        db.session.add(portfolio)
        db.session.flush()

    item = PortfolioItem(portfolio_id=portfolio.id, school_id=g.school_id)
    for key in ("title", "description", "item_type", "media_urls", "tags"):
        if key in data:
            setattr(item, key, data[key])
    db.session.add(item)
    db.session.commit()
    return created_response(_item_dict(item))


# ── Micro-Credentials ─────────────────────────────────────


@portfolio_bp.route("/students/<uuid:student_id>/credentials", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("student_portfolio")
def list_credentials(student_id):
    query = MicroCredential.query.filter_by(
        student_id=student_id, school_id=g.school_id, is_deleted=False
    )
    items, meta = paginate(query.order_by(MicroCredential.issued_at.desc()))
    return success_response([_credential_dict(c) for c in items], meta={"pagination": meta})


@portfolio_bp.route("/students/<uuid:student_id>/credentials", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("student_portfolio")
@role_required("superadmin", "school_admin")
def add_credential(student_id):
    data = request.get_json(silent=True) or {}
    if not _student_or_none(student_id):
        return error_response("Student not found at this school", 404)
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    cred = MicroCredential(student_id=student_id, school_id=g.school_id)
    for key in ("title", "description", "issuer",
                "credential_url", "verification_hash", "badge_url"):
        if key in data:
            setattr(cred, key, data[key])
    cred.issued_at = _parse_datetime(data.get("issued_at"))
    db.session.add(cred)
    db.session.commit()
    return created_response(_credential_dict(cred))


# ── Serializers ────────────────────────────────────────────


def _portfolio_dict(p):
    return {
        "id": str(p.id), "student_id": str(p.student_id),
        "bio": p.bio, "interests": p.interests, "skills": p.skills,
        "is_public": p.is_public,
        "items_count": len(p.items) if p.items else 0,
    }


def _item_dict(i):
    return {
        "id": str(i.id), "portfolio_id": str(i.portfolio_id),
        "title": i.title, "description": i.description,
        "item_type": i.item_type, "media_urls": i.media_urls,
        "tags": i.tags, "created_at": str(i.created_at),
    }


def _credential_dict(c):
    return {
        "id": str(c.id), "student_id": str(c.student_id),
        "title": c.title, "description": c.description,
        "issuer": c.issuer,
        "issued_at": str(c.issued_at) if c.issued_at else None,
        "credential_url": c.credential_url, "badge_url": c.badge_url,
    }


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
