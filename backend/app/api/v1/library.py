"""Library Management API — books, issues, returns, reservations."""
from datetime import date, datetime, timedelta

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.library import Book, BookIssue
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

library_bp = Blueprint("library", __name__, url_prefix="/library")


# ── Books ─────────────────────────────────────────────────

@library_bp.route("/books", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library")
def list_books():
    query = Book.query.filter_by(school_id=g.school_id, is_deleted=False)
    category = request.args.get("category")
    search = request.args.get("search")
    if category:
        query = query.filter_by(category=category)
    if search:
        query = query.filter(Book.title.ilike(f"%{search}%"))
    query = query.order_by(Book.title)
    items, meta = paginate(query)
    return success_response([_book_dict(b) for b in items], meta={"pagination": meta})


@library_bp.route("/books", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library")
@role_required("superadmin", "school_admin", "teacher")
def create_book():
    data = request.get_json(silent=True) or {}
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    book = Book(school_id=g.school_id)
    for key in ("title", "author", "isbn", "category", "publisher", "total_copies", "available_copies", "shelf_location"):
        if key in data:
            setattr(book, key, data[key])
    db.session.add(book)
    db.session.commit()
    return created_response(_book_dict(book))


@library_bp.route("/books/<book_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("library")
@role_required("superadmin", "school_admin", "teacher")
def update_book(book_id):
    book = Book.query.filter_by(id=book_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    for key in ("title", "author", "isbn", "category", "publisher", "total_copies", "available_copies", "shelf_location"):
        if key in data:
            setattr(book, key, data[key])
    db.session.commit()
    return success_response(_book_dict(book))


@library_bp.route("/books/<book_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("library")
@role_required("superadmin", "school_admin")
def delete_book(book_id):
    book = Book.query.filter_by(id=book_id, school_id=g.school_id).first_or_404()
    book.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Issues & Returns ──────────────────────────────────────

@library_bp.route("/issues", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library")
def list_issues():
    query = BookIssue.query.filter_by(school_id=g.school_id)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    # the web checkout page looks up the active issue for a book+student pair
    # to drive POST /library/issues/<id>/return
    book_id = request.args.get("book_id")
    if book_id:
        query = query.filter_by(book_id=book_id)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    query = query.order_by(BookIssue.issued_date.desc())
    items, meta = paginate(query)
    return success_response([_issue_dict(i) for i in items], meta={"pagination": meta})


@library_bp.route("/issues", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library")
@role_required("superadmin", "school_admin", "teacher")
def issue_book():
    data = request.get_json(silent=True) or {}
    book = Book.query.filter_by(id=data.get("book_id"), school_id=g.school_id).first()
    if not book or (book.available_copies or 0) <= 0:
        return error_response("Book not available for issue", 400)

    student_id = data.get("student_id")
    if student_id:
        student = Student.query.filter_by(id=student_id, school_id=g.school_id).first()
        if not student:
            return error_response("student_id does not match a student at this school", 400)

    issued_date = _parse_date(data.get("issued_date")) or date.today()
    issue = BookIssue(
        school_id=g.school_id,
        book_id=data["book_id"],
        student_id=student_id,
        user_id=data.get("user_id"),
        issued_by=g.current_user.id,
        issued_date=issued_date,
        # book_issues.due_date is NOT NULL — default to a 14-day loan when the
        # client omits it (previously a raw 500 on the not-null violation).
        due_date=_parse_date(data.get("due_date")) or issued_date + timedelta(days=14),
    )
    book.available_copies = (book.available_copies or 0) - 1
    db.session.add(issue)
    db.session.commit()
    return created_response(_issue_dict(issue))


@library_bp.route("/issues/<issue_id>/return", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library")
@role_required("superadmin", "school_admin", "teacher")
def return_book(issue_id):
    issue = BookIssue.query.filter_by(id=issue_id, school_id=g.school_id).first_or_404()
    if issue.status == "returned":
        return error_response("Book already returned", 400)

    issue.status = "returned"
    issue.returned_date = date.today()

    book = Book.query.get(issue.book_id)
    if book:
        book.available_copies = (book.available_copies or 0) + 1

    db.session.commit()
    return success_response(_issue_dict(issue))


def _book_dict(b):
    return {
        "id": str(b.id), "title": b.title, "author": b.author, "isbn": b.isbn,
        "category": b.category, "publisher": b.publisher,
        "total_copies": b.total_copies, "available_copies": b.available_copies,
        "shelf_location": b.shelf_location, "cover_url": b.cover_url,
    }


def _issue_dict(i):
    student_name = None
    if getattr(i, "student", None):
        student_name = f"{i.student.first_name} {i.student.last_name}"
    return {
        "id": str(i.id), "book_id": str(i.book_id), "student_id": str(i.student_id) if i.student_id else None,
        "user_id": str(i.user_id) if i.user_id else None, "issued_by": str(i.issued_by) if i.issued_by else None,
        "issued_date": str(i.issued_date) if i.issued_date else None,
        "due_date": str(i.due_date) if i.due_date else None,
        "returned_date": str(i.returned_date) if i.returned_date else None,
        "status": i.status,
        "book_title": i.book.title if getattr(i, "book", None) else None,
        "student_name": student_name,
    }


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None
