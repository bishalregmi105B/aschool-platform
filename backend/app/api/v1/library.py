"""Library Management API — books, issues, returns, reservations."""
from datetime import date, datetime, timedelta

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from app.models.library import Book, BookIssue
from app.models.student import Student
from app.plugins.config_store import plugin_config_value
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

library_bp = Blueprint("library", __name__, url_prefix="/library")

# School-level policy is NOT hardcoded — it lives in SchoolPlugin.config,
# edited at Settings → Installed Plugins → Library Management → Settings
# (schema: app/plugins/modules/library_management/config_schema.yaml). The
# values below are only the *fallback defaults* (mirroring the schema) used
# when a school has not configured the key.
PLUGIN_SLUG = "library_management"
# Legacy slug kept for pre-rename SchoolPlugin rows (see PLUGIN_SLUG_ALIASES
# in app/plugins/decorators.py) — read as a fallback so old installs still
# pick up their configured values without a migration.
_LEGACY_PLUGIN_SLUG = "library"


def _config_value(school_id, key, default):
    """First configured value for `key` across current/legacy plugin slugs."""
    for slug in (PLUGIN_SLUG, _LEGACY_PLUGIN_SLUG):
        value = plugin_config_value(school_id, slug, key, None)
        if value is not None:
            return value
    return default


def _as_number(value, default, minimum=0):
    """Best-effort numeric coercion for a settings value (never raises)."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, number)


def _fine_settings(school_id) -> tuple[float, float]:
    """(fine_per_day, max_fine) for a school — fines.per_day / fines.max."""
    per_day = _as_number(_config_value(school_id, "fines.per_day", 2), 2.0)
    max_fine = _as_number(_config_value(school_id, "fines.max", 500), 500.0)
    return per_day, max_fine


def _circulation_settings(school_id) -> tuple[int, int]:
    """(loan_days, max_books) for a school — max_books 0 means no limit."""
    loan_days = int(_as_number(_config_value(school_id, "circulation.loan_days", 14), 14))
    max_books = int(_as_number(_config_value(school_id, "circulation.max_books", 0), 0))
    return loan_days, max_books


def _overdue_days(issue) -> int:
    ref = issue.returned_date or date.today()
    if issue.due_date and ref > issue.due_date:
        return (ref - issue.due_date).days
    return 0


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
        # UI copy promises title, author AND ISBN — deliver all three
        like = f"%{search}%"
        query = query.filter(or_(Book.title.ilike(like), Book.author.ilike(like), Book.isbn.ilike(like)))
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
    if status == "overdue":
        # overdue = issued and past due (status column is a snapshot; compute
        # live so the overdue page is always accurate)
        query = query.filter(
            BookIssue.status == "issued",
            BookIssue.due_date < date.today(),
        )
    elif status:
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
        # per-school borrow limit (circulation.max_books; 0 = no limit)
        loan_days, max_books = _circulation_settings(g.school_id)
        if max_books > 0:
            active_count = BookIssue.query.filter_by(
                school_id=g.school_id, student_id=student_id, status="issued",
            ).count()
            if active_count >= max_books:
                return error_response(
                    f"Student has reached the library limit of {max_books} book(s) — "
                    "a book must be returned first",
                    400,
                )
    else:
        loan_days, _ = _circulation_settings(g.school_id)

    issued_date = _parse_date(data.get("issued_date")) or date.today()
    issue = BookIssue(
        school_id=g.school_id,
        book_id=data["book_id"],
        student_id=student_id,
        user_id=data.get("user_id"),
        issued_by=g.current_user.id,
        issued_date=issued_date,
        # book_issues.due_date is NOT NULL — default to the school's configured
        # loan period (circulation.loan_days) when the client omits it
        # (previously a hardcoded 14-day loan / a raw 500 on the not-null violation).
        due_date=_parse_date(data.get("due_date")) or issued_date + timedelta(days=loan_days),
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
    # per-school fine policy: fines.per_day per overdue day, capped at
    # fines.max — configured in the plugin settings, defaults preserved
    per_day, max_fine = _fine_settings(g.school_id)
    overdue_days = _overdue_days(issue)
    issue.fine_amount = min(max_fine, overdue_days * per_day)

    book = Book.query.get(issue.book_id)
    if book:
        book.available_copies = (book.available_copies or 0) + 1

    db.session.commit()
    d = _issue_dict(issue)
    d["overdue_days"] = overdue_days
    d["fine"] = float(issue.fine_amount or 0)
    return success_response(d)


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
    days_over = _overdue_days(i)
    return {
        "id": str(i.id), "book_id": str(i.book_id), "student_id": str(i.student_id) if i.student_id else None,
        "user_id": str(i.user_id) if i.user_id else None, "issued_by": str(i.issued_by) if i.issued_by else None,
        "issued_date": str(i.issued_date) if i.issued_date else None,
        "due_date": str(i.due_date) if i.due_date else None,
        "returned_date": str(i.returned_date) if i.returned_date else None,
        "status": "overdue" if (i.status == "issued" and days_over > 0) else i.status,
        "overdue_days": days_over if i.status == "issued" else 0,
        "fine_amount": float(i.fine_amount or 0),
        "book_title": i.book.title if getattr(i, "book", None) else None,
        "student_name": student_name,
    }


# ── Settings surface (drives UI hints; values live in plugin settings) ────

@library_bp.route("/settings", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library")
def library_settings():
    """Fine + circulation policy for this school.

    Lightweight read for UI hints (e.g. the web checkout page's fine notice);
    the school admin edits the same values at
    /dashboard/plugins/library_management/settings.
    """
    per_day, max_fine = _fine_settings(g.school_id)
    loan_days, max_books = _circulation_settings(g.school_id)
    return success_response({
        "fines": {"per_day": per_day, "max": max_fine},
        "circulation": {"loan_days": loan_days, "max_books": max_books},
    })


# ── Teacher app surface (flutter_admin / flutter_teacher) ─────────────────

@library_bp.route("/teacher/library", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library")
@role_required("teacher", "school_admin", "superadmin")
def teacher_library():
    """Single call for the teacher app: catalog summary + active issues + overdue.

    flutter_teacher/lib/features/library/teacher_library_screen.dart reads
    books/issues/overdue from this one endpoint.
    """
    books = (
        Book.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(Book.title)
        .limit(200)
        .all()
    )
    issues = (
        BookIssue.query.filter_by(school_id=g.school_id, status="issued")
        .order_by(BookIssue.due_date.asc())
        .limit(200)
        .all()
    )
    per_day, max_fine = _fine_settings(g.school_id)
    loan_days, max_books = _circulation_settings(g.school_id)
    return success_response({
        "books": [_book_dict(b) for b in books],
        "issues": [_issue_dict(i) for i in issues],
        "overdue": [_issue_dict(i) for i in issues if i.due_date and i.due_date < date.today()],
        "summary": {
            "total_books": len(books),
            "total_copies": sum(b.total_copies or 0 for b in books),
            "available_copies": sum(b.available_copies or 0 for b in books),
            "active_issues": len(issues),
            # per-school policy, so clients can render accurate hints without
            # hardcoding rates
            "fines": {"per_day": per_day, "max": max_fine},
            "circulation": {"loan_days": loan_days, "max_books": max_books},
        },
    })


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
