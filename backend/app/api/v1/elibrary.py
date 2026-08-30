"""Plan-compatible E-Library API."""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.digital_content import DigitalBook, OERResource, PastPaper
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

elibrary_bp = Blueprint("elibrary", __name__, url_prefix="/elibrary")


@elibrary_bp.route("/books", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("elibrary")
def list_books():
    query = DigitalBook.query.filter_by(school_id=g.school_id, is_deleted=False)
    search = request.args.get("search")
    if search:
        query = query.filter(DigitalBook.title.ilike(f"%{search}%"))

    books = query.order_by(DigitalBook.created_at.desc()).all()
    data = [_book_dict(book) for book in books]
    stats = {
        "total": len(data),
        "textbooks": sum(1 for item in data if item["category"] == "textbook"),
        "ebooks": sum(1 for item in data if item["category"] == "ebook"),
        "journals": sum(1 for item in data if item["category"] == "journal"),
    }
    return success_response(data, meta={"stats": stats})


@elibrary_bp.route("/books", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("elibrary")
@role_required("superadmin", "school_admin", "teacher")
def create_book():
    data = request.get_json(silent=True) or {}
    book = DigitalBook(
        school_id=g.school_id,
        title=data.get("title", ""),
        author=data.get("author"),
        file_url=data.get("file_url", ""),
        file_type=data.get("file_type", "pdf"),
        is_approved=True,
        uploaded_by_id=getattr(getattr(g, "current_user", None), "id", None),
    )
    db.session.add(book)
    db.session.commit()
    return created_response(_book_dict(book))


@elibrary_bp.route("/papers", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("elibrary")
def list_papers():
    papers = (
        PastPaper.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(PastPaper.created_at.desc())
        .all()
    )
    return success_response([_paper_dict(paper) for paper in papers])


@elibrary_bp.route("/papers", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("elibrary")
@role_required("superadmin", "school_admin", "teacher")
def create_paper():
    """Register a past paper — file bytes go through POST /files/upload first,
    then the returned URL is stored here (the web upload page does both steps)."""
    data = request.get_json(silent=True) or {}
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    if not (data.get("file_url") or "").strip():
        return error_response("file_url is required (upload the file via POST /files/upload first)", 400)
    paper = PastPaper(
        school_id=g.school_id,
        title=data["title"],
        file_url=data["file_url"],
        exam_type=data.get("exam_type"),
        year=data.get("year"),
        answer_key_url=data.get("answer_key_url"),
        uploaded_by_id=getattr(getattr(g, "current_user", None), "id", None),
    )
    db.session.add(paper)
    db.session.commit()
    return created_response(_paper_dict(paper))


@elibrary_bp.route("/resources", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("elibrary")
def list_resources():
    resources = (
        OERResource.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(OERResource.created_at.desc())
        .all()
    )
    return success_response([_resource_dict(resource) for resource in resources])


@elibrary_bp.route("/resources", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("elibrary")
@role_required("superadmin", "school_admin", "teacher")
def create_resource():
    """Register an OER resource — file bytes go through POST /files/upload first,
    then the returned URL is stored here (the web upload page does both steps)."""
    data = request.get_json(silent=True) or {}
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    if not (data.get("url") or "").strip():
        return error_response("url is required (upload the file via POST /files/upload first)", 400)
    tags = data.get("tags")
    if tags is not None and not isinstance(tags, list):
        return error_response("tags must be a list of strings", 400)
    resource = OERResource(
        school_id=g.school_id,
        title=data["title"],
        description=data.get("description"),
        resource_type=data.get("resource_type"),
        url=data["url"],
        tags=tags,
        is_approved=True,
    )
    db.session.add(resource)
    db.session.commit()
    return created_response(_resource_dict(resource))


def _book_dict(book: DigitalBook) -> dict:
    category = "ebook"
    if getattr(book, "title", "").lower().endswith("journal"):
        category = "journal"
    elif getattr(book, "subject_id", None) or getattr(book, "class_id", None):
        category = "textbook"
    return {
        "id": str(book.id),
        "title": book.title,
        "author": book.author,
        "category": category,
        "subject": book.subject.name if getattr(book, "subject", None) else None,
        "class_name": None,
        "isbn": None,
        "description": None,
        "file_url": book.file_url,
        "cover_url": book.cover_url,
        "file_type": book.file_type,
        "pages": book.pages,
    }


def _paper_dict(paper: PastPaper) -> dict:
    return {
        "id": str(paper.id),
        "title": paper.title,
        "subject": paper.subject.name if getattr(paper, "subject", None) else None,
        "exam_type": paper.exam_type,
        "year": paper.year,
        "file_url": paper.file_url,
        "answer_key_url": paper.answer_key_url,
    }


def _resource_dict(resource: OERResource) -> dict:
    return {
        "id": str(resource.id),
        "title": resource.title,
        "description": resource.description,
        "resource_type": resource.resource_type,
        "url": resource.url,
        "subject": resource.subject.name if getattr(resource, "subject", None) else None,
        "tags": resource.tags or [],
    }
