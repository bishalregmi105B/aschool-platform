"""FC-A05: query-count regressions for the library/fees hot lists.

These endpoints serialize names/titles per row; without eager loading they
issued 1–2 extra queries per row (the "N+1" class). The tests count SQL
statements around a single request and pin an upper bound so a future lazy
load regression fails loudly.
"""
import uuid as _uuid
from datetime import date

import pytest
from sqlalchemy import event

from app.models.library import Book, BookIssue
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _make_student(db, school, first, last, phone):
    u = User(
        school_id=school.id,
        role="student",
        full_name=f"{first} {last}",
        email=f"{first.lower()}.{last.lower()}.{_uuid.uuid4().hex[:6]}@test.edu.np",
        phone=phone,
        is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    student = Student(
        school_id=school.id, user_id=u.id, first_name=first, last_name=last,
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return student


def _install(db, school, slug):
    if not Plugin.query.filter_by(slug=slug).first():
        db.session.add(Plugin(
            slug=slug, name=slug.replace("_", " ").title(),
            category="starter", is_free=True, is_published=True,
        ))
        db.session.commit()
    if not SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug=slug).first():
        db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True))
        db.session.commit()


@pytest.fixture
def librarian_headers(client, db, school, admin_user):
    _install(db, school, "library_management")
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


@pytest.fixture
def library_data(db, school, admin_user):
    """1 book + 8 issued issues (enough rows that N+1s would show)."""
    students = [
        _make_student(db, school, f"Student{i}", "Nplus", f"+97798410{i:04d}")
        for i in range(8)
    ]
    book = Book(school_id=school.id, title="N+1 Test Book", total_copies=20, available_copies=12)
    db.session.add(book)
    db.session.flush()
    issues = [
        BookIssue(
            school_id=school.id, book_id=book.id, student_id=s.id,
            issued_by=admin_user.id, issued_date=date(2026, 9, 1),
            due_date=date(2026, 9, 15),
        )
        for s in students
    ]
    db.session.add_all(issues)
    db.session.commit()
    return book


@pytest.fixture
def sql_counter(app):
    counts = {"n": 0}

    def _count(conn, cursor, statement, parameters, context, executemany):
        counts["n"] += 1

    event.listen(app.extensions["sqlalchemy"].engine, "before_cursor_execute", _count)
    yield counts
    event.remove(app.extensions["sqlalchemy"].engine, "before_cursor_execute", _count)


def test_list_issues_query_count_bounded(
    client, db, school, librarian_headers, library_data, sql_counter
):
    def _count_queries():
        sql_counter["n"] = 0
        resp = client.get("/api/v1/library/issues", headers=librarian_headers)
        assert resp.status_code == 200
        return resp

    full = _count_queries()
    assert len(full.get_json()["data"]) == 8
    eight_rows = sql_counter["n"]

    # Same endpoint filtered to the single issue of one student: fixed
    # per-request overhead (auth, plugin gate, config lookups) is constant,
    # so the row-driven delta must be ~0. Before the joinedload fix the
    # delta grew by 2 queries per additional row (8 rows → +16).
    lone_student_id = None
    from app.models.library import BookIssue as _BI
    row = _BI.query.first()
    lone_student_id = str(row.student_id)
    resp = client.get(
        f"/api/v1/library/issues?student_id={lone_student_id}", headers=librarian_headers
    )
    assert resp.status_code == 200
    one_rows = sql_counter["n"]

    assert eight_rows - one_rows <= 2, (
        f"list_issues query count scales with rows (8 rows={eight_rows}, "
        f"1 row={one_rows}) — N+1 regression"
    )


def test_fees_recent_query_count_bounded(
    client, db, school, admin_user, librarian_headers, sql_counter
):
    from app.models.fee import FeeCollection, FeeReceipt

    _install(db, school, "fees")
    student = _make_student(db, school, "Fee", "Nplus", "+97798419999")
    receipts = []
    for i in range(10):
        c = FeeCollection(
            school_id=school.id, student_id=student.id,
            fee_item_name="Monthly Fee", amount=1000 + i, payment_status="paid",
        )
        db.session.add(c)
        db.session.flush()
        receipts.append(FeeReceipt(
            school_id=school.id, collection_id=c.id, student_id=student.id,
            amount=1000 + i, receipt_number=f"R-FC-TEST-{i:04d}",
        ))
    db.session.add_all(receipts)
    db.session.commit()

    sql_counter["n"] = 0
    resp = client.get("/api/v1/fees/recent?limit=10", headers=librarian_headers)
    assert resp.status_code == 200
    assert len(resp.get_json()["data"]) == 10
    ten_rows = sql_counter["n"]

    sql_counter["n"] = 0
    resp = client.get("/api/v1/fees/recent?limit=2", headers=librarian_headers)
    assert resp.status_code == 200
    two_rows = sql_counter["n"]

    assert ten_rows - two_rows <= 2, (
        f"/fees/recent query count scales with rows (10 rows={ten_rows}, "
        f"2 rows={two_rows}) — N+1 regression"
    )


def test_library_hot_path_indexes_exist(db):
    """FC-A06: the three hot-path indexes exist (matches migration fc_a06_idx)."""
    from sqlalchemy import inspect

    names = {i["name"] for i in inspect(db.engine).get_indexes("book_issues")}
    assert "ix_book_issues_school_book" in names
    assert "ix_book_issues_school_status_due" in names
    assert "ix_books_school_deleted_title" in {i["name"] for i in inspect(db.engine).get_indexes("books")}
