"""Library Management API — books, issues, returns, reservations."""
from datetime import date, datetime, timedelta

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

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
_LEGACY_PLUGIN_SLUG = "library"  # legacy installs keep their config visible


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
@plugin_required("library_management")
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
@plugin_required("library_management")
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
@plugin_required("library_management")
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
@plugin_required("library_management")
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
@plugin_required("library_management")
def list_issues():
    query = BookIssue.query.filter_by(school_id=g.school_id)
    # FC-A05: _issue_dict touches book.title and student.first/last_name per
    # row — without eager loading that was 2 extra queries per issue.
    query = query.options(joinedload(BookIssue.book), joinedload(BookIssue.student))
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
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def issue_book():
    data = request.get_json(silent=True) or {}
    # B-04: take the Book row with SELECT … FOR UPDATE — two concurrent
    # issues of the last copy previously both passed the check-then-act and
    # drove available_copies negative.
    book = (
        Book.query.filter_by(id=data.get("book_id"), school_id=g.school_id)
        .with_for_update()
        .first()
    )
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
    # FC-B: draw from a physical copy when the catalog has them — the copy
    # row is what stock-take and the OPAC availability view track. Copy_id
    # may stay NULL for the requested copy (legacy header-level issue).
    copy = (
        BookCopy.query.filter_by(
            school_id=g.school_id, book_id=book.id, status="available", is_deleted=False,
        )
        .with_for_update()
        .first()
    )
    if data.get("copy_id"):
        copy = BookCopy.query.filter_by(
            id=data["copy_id"], school_id=g.school_id, status="available",
        ).with_for_update().first()
        if not copy:
            return error_response("Requested copy is not available", 400)
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
        copy_id=copy.id if copy else None,
        renewal_count=0,
    )
    if copy:
        copy.status = "issued"
    book.available_copies = (book.available_copies or 0) - 1
    db.session.add(issue)
    db.session.commit()
    _events.emit_for_school("library.issued", str(g.school_id), issue_id=str(issue.id))
    d = _issue_dict(issue)
    d["copy_id"] = str(issue.copy_id) if issue.copy_id else None
    return created_response(d)


@library_bp.route("/issues/<issue_id>/return", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def return_book(issue_id):
    issue = (
        BookIssue.query.options(joinedload(BookIssue.book))
        .filter_by(id=issue_id, school_id=g.school_id)
        .first_or_404()
    )
    if issue.status == "returned":
        return error_response("Book already returned", 400)

    issue.status = "returned"
    issue.returned_date = date.today()
    # per-school fine policy: fines.per_day per overdue day, capped at
    # fines.max — configured in the plugin settings, defaults preserved
    per_day, max_fine = _fine_settings(g.school_id)
    overdue_days = _overdue_days(issue)
    issue.fine_amount = min(max_fine, overdue_days * per_day)

    fine = None
    if (issue.fine_amount or 0) > 0:
        # FC-B: overdue fines now land in the fines ledger so they can be
        # paid/waived — previously fine_amount was written on the issue and
        # fine_paid could never become true.
        fine = BookFine(
            school_id=g.school_id, issue_id=issue.id, student_id=issue.student_id,
            reason="overdue", amount=issue.fine_amount,
        )
        db.session.add(fine)

    book = (
        Book.query.filter_by(id=issue.book_id, school_id=g.school_id)
        .with_for_update()
        .first()
    )
    copy = issue.copy if getattr(issue, "copy", None) else None
    if copy:
        # FC-B: copy-level return — if a hold is queued for this title, the
        # copy goes straight to reserved for the first requester.
        first_hold = (
            BookReservation.query.filter_by(
                school_id=g.school_id, book_id=issue.book_id, status="requested",
            )
            .order_by(BookReservation.queue_pos)
            .first()
        )
        if first_hold:
            copy.status = "reserved"
            first_hold.status = "ready"
            first_hold.ready_copy_id = copy.id
            first_hold.ready_at = _now()
            pickup_days = int(_as_number(
                _config_value(g.school_id, "circulation.reservation_pickup_days", 3), 3,
            ))
            first_hold.pickup_deadline = date.today() + timedelta(days=pickup_days)
            hold = first_hold
        else:
            copy.status = "available"
            hold = None
    else:
        # legacy header-level return
        first_hold = (
            BookReservation.query.filter_by(
                school_id=g.school_id, book_id=issue.book_id, status="requested",
            )
            .order_by(BookReservation.queue_pos)
            .first()
        )
        hold = None
        if first_hold and book and (book.available_copies or 0) + 1 > 0:
            pass  # no copy row to reserve — desk marks the hold ready manually

    # FC-B: availability accounting — a copy handed to a waiting hold is
    # "reserved", not shelved, so it must not count as available. Legacy
    # header-level returns (no copy row) always increment.
    if book and (copy is None or copy.status == "available"):
        book.available_copies = (book.available_copies or 0) + 1

    db.session.commit()
    if hold:
        _events.emit_for_school("library.hold_ready", str(g.school_id), reservation_id=str(hold.id))
    if fine:
        _events.emit_for_school("library.fine_created", str(g.school_id), fine_id=str(fine.id), reason="overdue")
    d = _issue_dict(issue)
    d["overdue_days"] = overdue_days
    d["fine"] = float(issue.fine_amount or 0)
    if fine:
        d["fine_id"] = str(fine.id)
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
        "fine_paid": bool(i.fine_paid),
        # FC-B: copy-level circulation + renewals
        "copy_id": str(i.copy_id) if i.copy_id else None,
        "renewal_count": i.renewal_count or 0,
        "book_title": i.book.title if getattr(i, "book", None) else None,
        "student_name": student_name,
    }


# ── Settings surface (drives UI hints; values live in plugin settings) ────

@library_bp.route("/settings", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
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
        "circulation": {
            "loan_days": loan_days,
            "max_books": max_books,
            "renewal_limit": int(_as_number(_config_value(g.school_id, "circulation.renewal_limit", 2), 2)),
            "reservation_pickup_days": int(_as_number(
                _config_value(g.school_id, "circulation.reservation_pickup_days", 3), 3,
            )),
        },
    })


# ── Teacher app surface (flutter_admin / flutter_teacher) ─────────────────

@library_bp.route("/teacher/library", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
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
        .options(joinedload(BookIssue.book), joinedload(BookIssue.student))
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


# ═══════════════════════════════════════════════════════════
# ── Library v2 (FC-B): copies, holds, fines ledger, stocktake,
#    acquisition, reports, OPAC ─────────────────────────────
# ═══════════════════════════════════════════════════════════

from datetime import datetime, timezone as _tz  # noqa: E402

from flask import jsonify  # noqa: E402
from sqlalchemy import func as _func  # noqa: E402

from app.models.library import (  # noqa: E402
    BookCopy,
    BookFine,
    BookFinePayment,
    BookPurchaseOrder,
    BookPurchaseOrderItem,
    BookRack,
    BookReservation,
    BookVendor,
    StocktakeItem,
    StocktakeSession,
)
from app.plugins import events as _events  # noqa: E402


def _now():
    return datetime.now(_tz.utc)


def _serialize_copy(c):
    book = c.book if hasattr(c, "book") else None
    return {
        "id": str(c.id),
        "book_id": str(c.book_id),
        "book_title": book.title if book else None,
        "accession_no": c.accession_no,
        "barcode": c.barcode,
        "status": c.status,
        "condition": c.condition,
        "rack_id": str(c.rack_id) if c.rack_id else None,
        "notes": c.notes,
    }


def _ensure_copies_for_book(book):
    """Materialize copy rows for a legacy book created before copy-level
    circulation (idempotent)."""
    existing = BookCopy.query.filter_by(
        school_id=book.school_id, book_id=book.id, is_deleted=False
    ).count()
    total = book.total_copies or 0
    if existing >= total:
        return
    base = BookCopy.query.filter_by(school_id=book.school_id, book_id=book.id, is_deleted=False)\
        .order_by(BookCopy.accession_no.desc()).first()
    next_no = 0
    if base and base.accession_no and base.accession_no[-4:].isdigit():
        next_no = int(base.accession_no[-4:])
    for i in range(existing, total):
        next_no += 1
        db.session.add(BookCopy(
            school_id=book.school_id,
            book_id=book.id,
            accession_no=f"ACC-{str(book.id)[:4].upper()}-{next_no:04d}",
            barcode=f"B{str(book.id)[:8]}{next_no:04d}",
            status="available",
        ))


def _serialize_reservation(r):
    book = r.book if hasattr(r, "book") else None
    student = r.student if hasattr(r, "student") else None
    return {
        "id": str(r.id),
        "book_id": str(r.book_id),
        "book_title": book.title if book else None,
        "student_id": str(r.student_id),
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "status": r.status,
        "queue_pos": r.queue_pos,
        "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        "ready_at": r.ready_at.isoformat() if r.ready_at else None,
        "pickup_deadline": str(r.pickup_deadline) if r.pickup_deadline else None,
    }


def _serialize_fine(f):
    student = f.student if hasattr(f, "student") else None
    issue = f.issue if hasattr(f, "issue") else None
    return {
        "id": str(f.id),
        "issue_id": str(f.issue_id) if f.issue_id else None,
        "book_title": (
            issue.book.title if issue and getattr(issue, "book", None) else None
        ),
        "student_id": str(f.student_id),
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "reason": f.reason,
        "amount": float(f.amount or 0),
        "status": f.status,
        "paid_amount": float(f.paid_amount or 0),
        "paid_via": f.paid_via,
        "paid_at": f.paid_at.isoformat() if f.paid_at else None,
        "waived_by": str(f.waived_by) if f.waived_by else None,
        "waived_reason": f.waived_reason,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


# ── Copies & racks ────────────────────────────────────────

@library_bp.route("/books/<book_id>/copies", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
def list_copies(book_id):
    copies = (
        BookCopy.query.filter_by(school_id=g.school_id, book_id=book_id, is_deleted=False)
        .order_by(BookCopy.accession_no)
        .all()
    )
    return success_response([_serialize_copy(c) for c in copies])


@library_bp.route("/books/<book_id>/copies", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def add_copies(book_id):
    """Add N copies to a book; updates the header aggregates."""
    book = Book.query.filter_by(id=book_id, school_id=g.school_id, is_deleted=False).first_or_404()
    data = request.get_json(silent=True) or {}
    count = int(_as_number(data.get("count"), 1, 1))
    _ensure_copies_for_book(book)
    existing = BookCopy.query.filter_by(school_id=g.school_id, book_id=book.id, is_deleted=False).count()
    created = []
    for i in range(existing, existing + count):
        copy = BookCopy(
            school_id=g.school_id,
            book_id=book.id,
            accession_no=f"ACC-{str(book.id)[:4].upper()}-{i + 1:04d}",
            barcode=data.get("barcode_prefix") and f"{data['barcode_prefix']}{i + 1:04d}"
            or f"B{str(book.id)[:8]}{i + 1:04d}",
            status="available",
            condition=data.get("condition"),
        )
        db.session.add(copy)
        created.append(copy)
    book.total_copies = (book.total_copies or 0) + count
    book.available_copies = (book.available_copies or 0) + count
    db.session.commit()
    return created_response([_serialize_copy(c) for c in created])


@library_bp.route("/copies/<copy_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def update_copy(copy_id):
    copy = BookCopy.query.filter_by(id=copy_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    for key in ("condition", "notes", "accession_no", "barcode"):
        if key in data:
            setattr(copy, key, data[key])
    if data.get("rack_id"):
        copy.rack_id = data["rack_id"]
    db.session.commit()
    return success_response(_serialize_copy(copy))


@library_bp.route("/copies/scan/<barcode>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
def scan_copy(barcode):
    """Resolve a barcode/accession number to copy + book + active issue —
    the single endpoint behind every scanner (web desk + mobile)."""
    like = barcode.strip()
    copy = (
        BookCopy.query.filter_by(school_id=g.school_id, is_deleted=False)
        .filter((BookCopy.barcode == like) | (BookCopy.accession_no == like))
        .first()
    )
    if not copy:
        # fallback: legacy header barcode
        book = Book.query.filter_by(school_id=g.school_id, is_deleted=False, barcode=like).first()
        if not book:
            return error_response("No copy matches this barcode", 404)
        return success_response({"book": _book_dict(book), "copy": None, "issue": None})
    issue = BookIssue.query.filter_by(copy_id=copy.id, status="issued", school_id=g.school_id).first()
    d = {
        "book": _book_dict(copy.book) if copy.book else None,
        "copy": _serialize_copy(copy),
        "issue": _issue_dict(issue) if issue else None,
    }
    if issue and issue.student:
        d["student"] = {
            "id": str(issue.student.id),
            "name": f"{issue.student.first_name} {issue.student.last_name}".strip(),
        }
    return success_response(d)


@library_bp.route("/racks", methods=["GET", "POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
def racks():
    if request.method == "GET":
        rows = BookRack.query.filter_by(school_id=g.school_id, is_deleted=False).all()
        return success_response([
            {"id": str(r.id), "name": r.name, "location_code": r.location_code, "capacity": r.capacity}
            for r in rows
        ])
    data = request.get_json(silent=True) or {}
    if not (data.get("name") or "").strip():
        return error_response("name is required", 400)
    rack = BookRack(
        school_id=g.school_id, name=data["name"],
        location_code=data.get("location_code"), capacity=data.get("capacity"),
    )
    db.session.add(rack)
    db.session.commit()
    return created_response({"id": str(rack.id), "name": rack.name})


# ── Circulation v2: issue/return target copies, add renew ──

@library_bp.route("/issues/<issue_id>/renew", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def renew_issue(issue_id):
    """Renew an issued book: push the due date by loan_days, up to
    circulation.renewal_limit (default 2). Blocked when a hold is queued."""
    issue = BookIssue.query.filter_by(id=issue_id, school_id=g.school_id).first_or_404()
    if issue.status != "issued":
        return error_response("Only issued books can be renewed", 400)
    loan_days, _ = _circulation_settings(g.school_id)
    renewal_limit = int(_as_number(_config_value(g.school_id, "circulation.renewal_limit", 2), 2))
    if (issue.renewal_count or 0) >= renewal_limit:
        return error_response(f"Renewal limit of {renewal_limit} reached", 400)
    has_holds = BookReservation.query.filter_by(
        school_id=g.school_id, book_id=issue.book_id, status="ready",
    ).first() or BookReservation.query.filter_by(
        school_id=g.school_id, book_id=issue.book_id, status="requested",
    ).first()
    if has_holds:
        return error_response("This book is on hold for another member — renew not allowed", 400)
    issue.due_date = (issue.due_date or date.today()) + timedelta(days=loan_days)
    issue.renewal_count = (issue.renewal_count or 0) + 1
    db.session.commit()
    d = _issue_dict(issue)
    d["renewal_count"] = issue.renewal_count
    return success_response(d)


@library_bp.route("/issues/<issue_id>/mark-lost", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def mark_issue_lost(issue_id):
    """Mark a book lost: closes the issue, flags the copy, creates a
    replacement fine (lost price = book price if tracked, else fines.max)."""
    issue = BookIssue.query.filter_by(id=issue_id, school_id=g.school_id).first_or_404()
    if issue.status == "returned":
        return error_response("Book already returned", 400)
    issue.status = "lost"
    issue.returned_date = date.today()

    book = Book.query.filter_by(id=issue.book_id, school_id=g.school_id).with_for_update().first()
    _, max_fine = _fine_settings(g.school_id)
    replacement = float(getattr(book, "price", 0) or 0) or max_fine
    fine = BookFine(
        school_id=g.school_id, issue_id=issue.id, student_id=issue.student_id,
        reason="lost", amount=replacement,
    )
    db.session.add(fine)

    copy = issue.copy if getattr(issue, "copy", None) else None
    if copy:
        copy.status = "lost"
    if book:
        book.available_copies = max(0, (book.available_copies or 0) - 1)
        book.total_copies = max(0, (book.total_copies or 0) - 1)

    db.session.commit()
    _events.emit_for_school("library.fine_created", str(g.school_id), fine_id=str(fine.id), reason="lost")
    d = _issue_dict(issue)
    d["fine"] = _serialize_fine(fine)
    return success_response(d)


# ── Holds / reservations ──────────────────────────────────

@library_bp.route("/books/<book_id>/reservations", methods=["GET", "POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
def reservations(book_id):
    if request.method == "GET":
        rows = (
            BookReservation.query.filter_by(school_id=g.school_id, book_id=book_id, is_deleted=False)
            .filter(BookReservation.status.in_(("requested", "ready")))
            .order_by(BookReservation.queue_pos)
            .all()
        )
        return success_response([_serialize_reservation(r) for r in rows])

    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    if not student_id:
        return error_response("student_id is required", 400)
    if not Student.query.filter_by(id=student_id, school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)
    book = Book.query.filter_by(id=book_id, school_id=g.school_id, is_deleted=False).first()
    if not book:
        return error_response("Book not found", 404)
    if (book.available_copies or 0) > 0:
        return error_response("Book is available — issue it directly instead of reserving", 400)
    dup = BookReservation.query.filter_by(
        school_id=g.school_id, book_id=book_id, student_id=student_id, status="requested",
    ).first()
    if dup:
        return error_response("This student already has a pending reservation for this book", 409)
    queue_pos = (
        db.session.query(_func.coalesce(_func.max(BookReservation.queue_pos), 0) + 1)
        .filter_by(school_id=g.school_id, book_id=book_id, status="requested")
        .scalar()
    )
    res = BookReservation(
        school_id=g.school_id, book_id=book_id, student_id=student_id,
        queue_pos=queue_pos, status="requested",
    )
    db.session.add(res)
    db.session.commit()
    _events.emit_for_school("library.hold_requested", str(g.school_id), reservation_id=str(res.id))
    return created_response(_serialize_reservation(res))


@library_bp.route("/reservations", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
def list_reservations():
    """All reservations for the school (holds management page)."""
    query = BookReservation.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    else:
        query = query.filter(BookReservation.status.in_(("requested", "ready")))
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    rows = query.options(joinedload(BookReservation.book), joinedload(BookReservation.student))\
        .order_by(BookReservation.created_at.desc()).limit(200).all()
    return success_response([_serialize_reservation(r) for r in rows])


@library_bp.route("/reservations/<res_id>/ready", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def reservation_ready(res_id):
    """Mark a hold ready for pickup: reserve an available copy and notify."""
    res = BookReservation.query.filter_by(id=res_id, school_id=g.school_id).first_or_404()
    if res.status != "requested":
        return error_response(f"Reservation is {res.status}, not requested", 400)
    copy = BookCopy.query.filter_by(
        school_id=g.school_id, book_id=res.book_id, status="available", is_deleted=False,
    ).with_for_update().first()
    if not copy:
        return error_response("No available copy to reserve yet", 400)
    copy.status = "reserved"
    res.status = "ready"
    res.ready_copy_id = copy.id
    res.ready_at = _now()
    _, _mb = _circulation_settings(g.school_id)
    pickup_days = int(_as_number(_config_value(g.school_id, "circulation.reservation_pickup_days", 3), 3))
    res.pickup_deadline = date.today() + timedelta(days=pickup_days)
    book = Book.query.filter_by(id=res.book_id, school_id=g.school_id).with_for_update().first()
    if book:
        book.available_copies = max(0, (book.available_copies or 0) - 1)
    db.session.commit()
    _events.emit_for_school("library.hold_ready", str(g.school_id), reservation_id=str(res.id))
    return success_response(_serialize_reservation(res))


@library_bp.route("/reservations/<res_id>/collect", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def reservation_collect(res_id):
    """Convert a ready hold into an actual issue at the desk."""
    res = BookReservation.query.filter_by(id=res_id, school_id=g.school_id).first_or_404()
    if res.status != "ready":
        return error_response(f"Reservation is {res.status}, not ready", 400)
    copy = BookCopy.query.filter_by(id=res.ready_copy_id, school_id=g.school_id).with_for_update().first()
    if not copy:
        return error_response("Reserved copy not found", 404)
    loan_days, _ = _circulation_settings(g.school_id)
    copy.status = "issued"
    issue = BookIssue(
        school_id=g.school_id, book_id=res.book_id, student_id=res.student_id,
        copy_id=copy.id, issued_by=g.current_user.id, issued_date=date.today(),
        due_date=date.today() + timedelta(days=loan_days),
    )
    db.session.add(issue)
    res.status = "collected"
    # promote remaining requested holds one step up
    next_res = (
        BookReservation.query.filter_by(school_id=g.school_id, book_id=res.book_id, status="requested")
        .order_by(BookReservation.queue_pos)
        .all()
    )
    for i, r in enumerate(next_res, start=1):
        r.queue_pos = i
    db.session.commit()
    d = _issue_dict(issue)
    d["reservation_id"] = str(res.id)
    return created_response(d)


@library_bp.route("/reservations/<res_id>/cancel", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
def reservation_cancel(res_id):
    res = BookReservation.query.filter_by(id=res_id, school_id=g.school_id).first_or_404()
    if res.status in ("collected", "cancelled"):
        return error_response(f"Reservation already {res.status}", 400)
    if res.status == "ready" and res.ready_copy_id:
        copy = BookCopy.query.filter_by(id=res.ready_copy_id, school_id=g.school_id).with_for_update().first()
        if copy:
            copy.status = "available"
        book = Book.query.filter_by(id=res.book_id, school_id=g.school_id).with_for_update().first()
        if book:
            book.available_copies = (book.available_copies or 0) + 1
    res.status = "cancelled"
    db.session.commit()
    return success_response(_serialize_reservation(res))


# ── Fines ledger ──────────────────────────────────────────

@library_bp.route("/fines", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
def list_fines():
    query = BookFine.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    rows = (
        query.options(joinedload(BookFine.student), joinedload(BookFine.issue).joinedload(BookIssue.book))
        .order_by(BookFine.created_at.desc())
        .limit(300)
        .all()
    )
    totals = dict(
        db.session.query(BookFine.status, _func.coalesce(_func.sum(BookFine.amount), 0))
        .filter_by(school_id=g.school_id, is_deleted=False)
        .group_by(BookFine.status)
        .all()
    )
    return success_response({
        "fines": [_serialize_fine(f) for f in rows],
        "totals": {k: float(v) for k, v in totals.items()},
    })


@library_bp.route("/fines/<fine_id>/pay", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def pay_fine(fine_id):
    """Collect a fine payment (cash at the desk; gateway refs recorded)."""
    fine = BookFine.query.filter_by(id=fine_id, school_id=g.school_id).first_or_404()
    if fine.status in ("paid", "waived"):
        return error_response(f"Fine already {fine.status}", 400)
    data = request.get_json(silent=True) or {}
    amount = _as_number(data.get("amount"), float(fine.amount or 0))
    amount = min(amount, float(fine.amount or 0) - float(fine.paid_amount or 0))
    if amount <= 0:
        return error_response("Nothing left to pay on this fine", 400)
    payment = BookFinePayment(
        school_id=g.school_id, fine_id=fine.id, amount=amount,
        method=data.get("method", "cash"), reference=data.get("reference"),
        collected_by=g.current_user.id,
    )
    db.session.add(payment)
    fine.paid_amount = (fine.paid_amount or 0) + amount
    if fine.paid_amount >= (fine.amount or 0):
        fine.status = "paid"
        fine.paid_at = _now()
        fine.paid_via = data.get("method", "cash")
        # close the loop on the originating issue
        if fine.issue_id:
            issue = BookIssue.query.filter_by(id=fine.issue_id, school_id=g.school_id).first()
            if issue:
                issue.fine_paid = True
    else:
        fine.status = "partial"
    db.session.commit()
    _events.emit_for_school("library.fine_paid", str(g.school_id), fine_id=str(fine.id), amount=amount)
    return success_response(_serialize_fine(fine))


@library_bp.route("/fines/<fine_id>/waive", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin")
def waive_fine(fine_id):
    """Principal/admin waiver — requires a reason (audit trail)."""
    fine = BookFine.query.filter_by(id=fine_id, school_id=g.school_id).first_or_404()
    if fine.status == "paid":
        return error_response("Fine already paid — cannot waive", 400)
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return error_response("A waiver reason is required", 400)
    fine.status = "waived"
    fine.waived_by = g.current_user.id
    fine.waived_reason = reason
    if fine.issue_id:
        issue = BookIssue.query.filter_by(id=fine.issue_id, school_id=g.school_id).first()
        if issue:
            issue.fine_paid = True
    db.session.commit()
    return success_response(_serialize_fine(fine))


# ── Stock-take ────────────────────────────────────────────

@library_bp.route("/stocktakes", methods=["GET", "POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
def stocktakes():
    if request.method == "GET":
        rows = (
            StocktakeSession.query.filter_by(school_id=g.school_id, is_deleted=False)
            .order_by(StocktakeSession.created_at.desc())
            .limit(50)
            .all()
        )
        return success_response([
            {
                "id": str(s.id), "name": s.name, "status": s.status,
                "scan_count": s.scan_count, "expected_count": s.expected_count,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "closed_at": s.closed_at.isoformat() if s.closed_at else None,
            }
            for s in rows
        ])
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip() or f"Stock-take {date.today().isoformat()}"
    expected = BookCopy.query.filter_by(school_id=g.school_id, is_deleted=False).filter(
        BookCopy.status.notin_(("weeded", "lost"))
    ).count()
    session = StocktakeSession(
        school_id=g.school_id, name=name, started_by=g.current_user.id,
        expected_count=expected, scan_count=0,
    )
    db.session.add(session)
    db.session.commit()
    return created_response({"id": str(session.id), "name": session.name, "expected_count": expected})


@library_bp.route("/stocktakes/<session_id>/scan", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def stocktake_scan(session_id):
    """Record one scanned barcode. First scan of a copy = found; a barcode
    not belonging to the library = unexpected."""
    session = StocktakeSession.query.filter_by(id=session_id, school_id=g.school_id).first_or_404()
    if session.status != "open":
        return error_response("Stock-take session is closed", 400)
    data = request.get_json(silent=True) or {}
    scan_value = (data.get("barcode") or "").strip()
    if not scan_value:
        return error_response("barcode is required", 400)
    already = StocktakeItem.query.filter_by(
        session_id=session.id, scan_value=scan_value, is_deleted=False,
    ).first()
    if already:
        return error_response("Already scanned in this session", 409)
    copy = (
        BookCopy.query.filter_by(school_id=g.school_id, is_deleted=False)
        .filter((BookCopy.barcode == scan_value) | (BookCopy.accession_no == scan_value))
        .first()
    )
    if not copy:
        item = StocktakeItem(
            school_id=g.school_id, session_id=session.id, copy_id=None,
            scan_value=scan_value, outcome="unexpected",
        )
        db.session.add(item)
        session.scan_count = (session.scan_count or 0) + 1
        db.session.commit()
        return created_response({"outcome": "unexpected", "copy": None})
    item = StocktakeItem(
        school_id=g.school_id, session_id=session.id, copy_id=copy.id,
        scan_value=scan_value, outcome="found", rack_id=copy.rack_id,
    )
    db.session.add(item)
    session.scan_count = (session.scan_count or 0) + 1
    db.session.commit()
    return created_response({
        "outcome": "found",
        "copy": _serialize_copy(copy),
        "book_title": copy.book.title if copy.book else None,
    })


@library_bp.route("/stocktakes/<session_id>/close", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def stocktake_close(session_id):
    """Close a session: every non-weeded/non-lost copy not scanned comes back
    as missing. Optionally auto-create lost fines for missing copies."""
    session = StocktakeSession.query.filter_by(id=session_id, school_id=g.school_id).first_or_404()
    if session.status != "open":
        return error_response("Session already closed", 400)
    data = request.get_json(silent=True) or {}
    auto_fine = bool(data.get("auto_fine"))

    scanned_copy_ids = {
        str(c) for (c,) in db.session.query(StocktakeItem.copy_id).filter_by(
            session_id=session.id, is_deleted=False,
        ).all() if c
    }
    all_copies = BookCopy.query.filter_by(school_id=g.school_id, is_deleted=False).filter(
        BookCopy.status.notin_(("weeded", "lost"))
    ).all()
    missing = [c for c in all_copies if str(c.id) not in scanned_copy_ids]
    for c in missing:
        db.session.add(StocktakeItem(
            school_id=g.school_id, session_id=session.id, copy_id=c.id,
            scan_value=c.barcode or c.accession_no, outcome="missing", rack_id=c.rack_id,
        ))
    if auto_fine:
        for c in missing:
            if c.status == "issued":
                continue  # an issued copy out with a student is not "lost"
            active_issue = BookIssue.query.filter_by(copy_id=c.id, status="issued").first()
            if active_issue:
                continue
            _, max_fine = _fine_settings(g.school_id)
            replacement = float(getattr(c.book, "price", 0) or 0) or max_fine
            db.session.add(BookFine(
                school_id=g.school_id, student_id=None, reason="lost",
                amount=replacement, notes=f"Stock-take {session.name}: {c.barcode or c.accession_no}",
            ))
        db.session.flush()
    session.status = "closed"
    session.closed_at = _now()
    db.session.commit()
    return success_response({
        "expected": session.expected_count,
        "scanned": session.scan_count,
        "missing": len(missing),
        "fines_created": bool(auto_fine),
    })


@library_bp.route("/stocktakes/<session_id>/items", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
def stocktake_items(session_id):
    outcome = request.args.get("outcome")
    query = StocktakeItem.query.filter_by(session_id=session_id, is_deleted=False)
    if outcome:
        query = query.filter_by(outcome=outcome)
    items = (
        query.options(joinedload(StocktakeItem.copy))
        .order_by(StocktakeItem.scanned_at.desc())
        .limit(500)
        .all()
    )
    return success_response([
        {
            "id": str(i.id),
            "outcome": i.outcome,
            "scan_value": i.scan_value,
            "copy": _serialize_copy(i.copy) if i.copy else None,
            "scanned_at": i.scanned_at.isoformat() if i.scanned_at else None,
        }
        for i in items
    ])


# ── Acquisition: vendors & purchase orders ────────────────

@library_bp.route("/vendors", methods=["GET", "POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
def vendors():
    if request.method == "GET":
        rows = BookVendor.query.filter_by(school_id=g.school_id, is_deleted=False).all()
        return success_response([
            {
                "id": str(v.id), "name": v.name, "contact_name": v.contact_name,
                "phone": v.phone, "email": v.email, "address": v.address,
            }
            for v in rows
        ])
    data = request.get_json(silent=True) or {}
    if not (data.get("name") or "").strip():
        return error_response("name is required", 400)
    vendor = BookVendor(
        school_id=g.school_id, name=data["name"], contact_name=data.get("contact_name"),
        phone=data.get("phone"), email=data.get("email"), address=data.get("address"),
    )
    db.session.add(vendor)
    db.session.commit()
    return created_response({"id": str(vendor.id), "name": vendor.name})


@library_bp.route("/purchase-orders", methods=["GET", "POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
def purchase_orders():
    if request.method == "GET":
        rows = (
            BookPurchaseOrder.query.filter_by(school_id=g.school_id, is_deleted=False)
            .order_by(BookPurchaseOrder.created_at.desc())
            .limit(100)
            .all()
        )
        out = []
        for po in rows:
            items = BookPurchaseOrderItem.query.filter_by(po_id=po.id, is_deleted=False).all()
            out.append({
                "id": str(po.id), "po_number": po.po_number,
                "vendor": po.vendor.name if po.vendor else None,
                "status": po.status,
                "expected_date": str(po.expected_date) if po.expected_date else None,
                "total": float(sum((i.unit_price or 0) * (i.quantity or 0) for i in items)),
                "items": [
                    {
                        "id": str(i.id), "title": i.title, "author": i.author, "isbn": i.isbn,
                        "quantity": i.quantity, "quantity_received": i.quantity_received,
                        "unit_price": float(i.unit_price or 0),
                    }
                    for i in items
                ],
            })
        return success_response(out)

    data = request.get_json(silent=True) or {}
    items_in = data.get("items") or []
    if not items_in:
        return error_response("At least one order item is required", 400)
    po_count = BookPurchaseOrder.query.filter_by(school_id=g.school_id).count()
    po = BookPurchaseOrder(
        school_id=g.school_id,
        po_number=data.get("po_number") or f"PO-{date.today().year}-{po_count + 1:04d}",
        vendor_id=data.get("vendor_id"),
        expected_date=_parse_date(data.get("expected_date")),
        notes=data.get("notes"),
    )
    db.session.add(po)
    db.session.flush()
    for it in items_in:
        db.session.add(BookPurchaseOrderItem(
            school_id=g.school_id, po_id=po.id, book_id=it.get("book_id"),
            title=it.get("title"), author=it.get("author"), isbn=it.get("isbn"),
            quantity=int(_as_number(it.get("quantity"), 1, 1)),
            unit_price=_as_number(it.get("unit_price"), 0),
        ))
    db.session.commit()
    return created_response({"id": str(po.id), "po_number": po.po_number})


@library_bp.route("/purchase-orders/<po_id>/receive", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def receive_po(po_id):
    """Receive a PO: creates catalog copies for received quantities and
    advances the PO status (partially_received → received)."""
    po = BookPurchaseOrder.query.filter_by(id=po_id, school_id=g.school_id).first_or_404()
    if po.status in ("received", "paid", "cancelled"):
        return error_response(f"PO already {po.status}", 400)
    data = request.get_json(silent=True) or {}
    item_receipts = data.get("items") or []  # [{item_id, quantity}]
    by_id = {str(i.id): i for i in BookPurchaseOrderItem.query.filter_by(po_id=po.id, is_deleted=False).all()}
    received_something = False
    for r in item_receipts:
        item = by_id.get(str(r.get("item_id")))
        if not item:
            continue
        qty = int(_as_number(r.get("quantity"), 0, 0))
        if qty <= 0:
            continue
        received_something = True
        item.quantity_received = (item.quantity_received or 0) + qty
        if item.book_id:
            book = Book.query.filter_by(id=item.book_id, school_id=g.school_id).with_for_update().first()
        else:
            # auto-catalogue a new book from the PO line
            book = Book(
                school_id=g.school_id,
                title=item.title or "Untitled",
                author=item.author, isbn=item.isbn,
                category="New acquisition",
                # copies are counted from the BookCopy rows we create below —
                # the header defaults (1/1) would double-count
                total_copies=0,
                available_copies=0,
            )
            db.session.add(book)
            db.session.flush()
            item.book_id = book.id
        before = BookCopy.query.filter_by(school_id=g.school_id, book_id=book.id, is_deleted=False).count()
        for k in range(qty):
            n = before + k + 1
            db.session.add(BookCopy(
                school_id=g.school_id, book_id=book.id,
                accession_no=f"ACC-{str(book.id)[:4].upper()}-{n:04d}",
                barcode=f"B{str(book.id)[:8]}{n:04d}",
                status="available",
            ))
        book.total_copies = (book.total_copies or 0) + qty
        book.available_copies = (book.available_copies or 0) + qty
    if not received_something:
        return error_response("No item quantities to receive", 400)
    db.session.flush()
    all_items = BookPurchaseOrderItem.query.filter_by(po_id=po.id, is_deleted=False).all()
    if all(i.quantity_received >= i.quantity for i in all_items):
        po.status = "received"
    else:
        po.status = "partially_received"
    po.received_date = date.today()
    db.session.commit()
    return success_response({"id": str(po.id), "status": po.status})


# ── Reports ───────────────────────────────────────────────

@library_bp.route("/reports/<report_name>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("library_management")
@role_required("superadmin", "school_admin", "teacher")
def library_reports(report_name):
    """Circulation/popularity/overdue/fines/dead-stock reports."""
    if report_name == "popular":
        rows = (
            db.session.query(BookIssue.book_id, _func.count(BookIssue.id).label("times"))
            .filter_by(school_id=g.school_id, is_deleted=False)
            .group_by(BookIssue.book_id)
            .order_by(_func.count(BookIssue.id).desc())
            .limit(25)
            .all()
        )
        books = {
            str(b.id): b.title
            for b in Book.query.filter(
                Book.id.in_([r for r, _ in rows]),
                Book.school_id == g.school_id,
            ).all()
        }
        return success_response([
            {"book_id": str(bid), "title": books.get(str(bid), "?"), "times_issued": n}
            for bid, n in rows
        ])

    if report_name == "overdue_by_class":
        rows = (
            db.session.query(Student.class_id, _func.count(BookIssue.id))
            .join(Student, Student.id == BookIssue.student_id)
            .filter(
                BookIssue.school_id == g.school_id,
                BookIssue.status == "issued",
                BookIssue.due_date < date.today(),
            )
            .group_by(Student.class_id)
            .all()
        )
        from app.models.academic import Class

        names = {str(c.id): c.name for c in Class.query.filter(
            Class.id.in_([cid for cid, _ in rows if cid]), Class.school_id == g.school_id,
        ).all()}
        return success_response([
            {"class_id": str(cid) if cid else None, "class_name": names.get(str(cid), "Unassigned"), "overdue": n}
            for cid, n in rows
        ])

    if report_name == "circulation_daily":
        days = int(_as_number(request.args.get("days"), 30))
        since = _now() - timedelta(days=days)
        issued = dict(
            db.session.query(BookIssue.issued_date, _func.count(BookIssue.id))
            .filter(BookIssue.school_id == g.school_id, BookIssue.issued_date >= since.date())
            .group_by(BookIssue.issued_date)
            .all()
        )
        returned = dict(
            db.session.query(BookIssue.returned_date, _func.count(BookIssue.id))
            .filter(BookIssue.school_id == g.school_id, BookIssue.returned_date.isnot(None))
            .filter(BookIssue.returned_date >= since.date())
            .group_by(BookIssue.returned_date)
            .all()
        )
        out = []
        d0 = date.today() - timedelta(days=days - 1)
        for i in range(days):
            d = d0 + timedelta(days=i)
            out.append({"date": d.isoformat(), "issued": issued.get(d, 0), "returned": returned.get(d, 0)})
        return success_response(out)

    if report_name == "fines_collected":
        rows = (
            db.session.query(BookFine.status, _func.count(BookFine.id), _func.coalesce(_func.sum(BookFine.amount), 0))
            .filter_by(school_id=g.school_id, is_deleted=False)
            .group_by(BookFine.status)
            .all()
        )
        return success_response([
            {"status": s, "count": n, "total": float(t)} for s, n, t in rows
        ])

    if report_name == "dead_stock":
        never = (
            Book.query.filter_by(school_id=g.school_id, is_deleted=False)
            .filter(
                ~Book.id.in_(
                    db.session.query(BookIssue.book_id).filter_by(school_id=g.school_id, is_deleted=False)
                )
            )
            .limit(200)
            .all()
        )
        return success_response([
            {"id": str(b.id), "title": b.title, "author": b.author,
             "copies": b.total_copies, "available": b.available_copies}
            for b in never
        ])

    if report_name == "collection_stats":
        total_copies = db.session.query(_func.coalesce(_func.sum(Book.total_copies), 0)).filter_by(
            school_id=g.school_id, is_deleted=False).scalar()
        available = db.session.query(_func.coalesce(_func.sum(Book.available_copies), 0)).filter_by(
            school_id=g.school_id, is_deleted=False).scalar()
        titles = Book.query.filter_by(school_id=g.school_id, is_deleted=False).count()
        by_category = dict(
            db.session.query(Book.category, _func.count(Book.id))
            .filter_by(school_id=g.school_id, is_deleted=False)
            .group_by(Book.category)
            .all()
        )
        return success_response({
            "titles": titles,
            "total_copies": int(total_copies or 0),
            "available_copies": int(available or 0),
            "by_category": {k or "Uncategorised": v for k, v in by_category.items()},
        })

    return error_response(f"Unknown report '{report_name}'", 404)


# ── OPAC (public search) ──────────────────────────────────

def _opac_school():
    """Resolve the school for OPAC routes: X-School-Slug header (web+mobile
    pattern) or ?school_slug= (public website embeds)."""
    from app.models.school import School

    slug = (
        request.headers.get("X-School-Slug")
        or request.args.get("school_slug")
        or ""
    ).strip()
    if not slug:
        return None
    return School.query.filter_by(slug=slug, is_active=True).first()


@library_bp.route("/public/search", methods=["GET"])
def opac_search():
    """Public catalog search (OPAC). No auth — read-only availability view.
    Schools can expose this on their website via the LibrarySearch section."""
    school = _opac_school()
    if not school:
        return error_response("Unknown school — pass school_slug or X-School-Slug", 400)
    q = (request.args.get("q") or "").strip()
    query = Book.query.filter_by(school_id=school.id, is_deleted=False)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Book.title.ilike(like), Book.author.ilike(like), Book.isbn.ilike(like)))
    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)
    language = request.args.get("language")
    if language and hasattr(Book, "language"):
        query = query.filter_by(language=language)
    availability = request.args.get("availability")
    if availability == "available":
        query = query.filter(Book.available_copies > 0)
    items, meta = paginate(query.order_by(Book.title))
    return success_response([
        {
            "id": str(b.id), "title": b.title, "author": b.author, "isbn": b.isbn,
            "category": b.category, "cover_url": b.cover_url,
            "available_copies": b.available_copies, "total_copies": b.total_copies,
            "shelf_location": b.shelf_location,
        }
        for b in items
    ], meta={"pagination": meta})


@library_bp.route("/public/books/<book_id>", methods=["GET"])
def opac_book(book_id):
    """Public book detail: per-copy availability (no member data)."""
    school = _opac_school()
    if not school:
        return error_response("Unknown school — pass school_slug or X-School-Slug", 400)
    book = Book.query.filter_by(id=book_id, school_id=school.id, is_deleted=False).first_or_404()
    copies = BookCopy.query.filter_by(school_id=school.id, book_id=book.id, is_deleted=False).all()
    d = _book_dict(book)
    d["copies"] = [
        {"accession_no": c.accession_no, "status": c.status, "rack_id": str(c.rack_id) if c.rack_id else None}
        for c in copies
    ]
    d["available_now"] = sum(1 for c in copies if c.status == "available")
    return success_response(d)
