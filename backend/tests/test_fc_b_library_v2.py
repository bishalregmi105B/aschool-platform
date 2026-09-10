"""FC-B: library v2 regression tests — copy-level circulation, holds queue,
fines ledger, stock-take, acquisition, reports, OPAC.

Mirrors the golden flows from the master plan:
  issue → renew → return → fine → pay/waive
  student hold request → ready → collect
  stock-take scan → close → missing report
"""
import uuid as _uuid
from datetime import date, datetime, timedelta

import pytest

from app.models.library import (
    Book,
    BookCopy,
    BookFine,
    BookFinePayment,
    BookIssue,
    BookPurchaseOrder,
    BookReservation,
    StocktakeItem,
    StocktakeSession,
)
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _install(db, school):
    if not Plugin.query.filter_by(slug="library_management").first():
        db.session.add(Plugin(
            slug="library_management", name="Library Management",
            category="starter", is_free=True, is_published=True,
        ))
    if not SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug="library_management").first():
        db.session.add(SchoolPlugin(school_id=school.id, plugin_slug="library_management", active=True))
    db.session.commit()


def _student(db, school, first="Hold", last="Tester", phone="+97798412000"):
    u = User(
        school_id=school.id, role="student", full_name=f"{first} {last}",
        email=f"{first.lower()}.{last.lower()}.{_uuid.uuid4().hex[:6]}@test.edu.np",
        phone=phone, is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    s = Student(school_id=school.id, user_id=u.id, first_name=first, last_name=last, status="active")
    db.session.add(s)
    db.session.commit()
    return s


@pytest.fixture
def headers(client, db, school, admin_user):
    _install(db, school)
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


@pytest.fixture
def book(db, school):
    b = Book(
        school_id=school.id, title="Copy Test Book", author="A. Author",
        total_copies=2, available_copies=2, price=250,
    )
    db.session.add(b)
    db.session.flush()
    for i in (1, 2):
        db.session.add(BookCopy(
            school_id=school.id, book_id=b.id,
            accession_no=f"ACC-T{i:04d}", barcode=f"SCAN{i:04d}", status="available",
        ))
    db.session.commit()
    return b


def test_issue_targets_copy(client, db, school, headers, book):
    s1 = _student(db, school)
    r = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id),
    }, headers=headers)
    assert r.status_code == 201
    assert r.get_json()["data"]["copy_id"], "issue must carry a physical copy_id"
    copy = BookCopy.query.filter_by(id=r.get_json()["data"]["copy_id"]).first()
    assert copy.status == "issued"
    assert book.available_copies == 1


def test_renew_flow(client, db, school, headers, book):
    s1 = _student(db, school)
    r = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id),
    }, headers=headers)
    issue_id = r.get_json()["data"]["id"]

    r = client.post(f"/api/v1/library/issues/{issue_id}/renew", json={}, headers=headers)
    assert r.status_code == 200
    d = r.get_json()["data"]
    assert d["renewal_count"] == 1
    assert d["due_date"] > date.today().isoformat()


def test_return_creates_ledger_fine_and_pays(client, db, school, headers, book):
    s1 = _student(db, school)
    r = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id),
        "due_date": (date.today() - timedelta(days=3)).isoformat(),
    }, headers=headers)
    issue_id = r.get_json()["data"]["id"]

    r = client.post(f"/api/v1/library/issues/{issue_id}/return", json={}, headers=headers)
    assert r.status_code == 200
    d = r.get_json()["data"]
    assert d["overdue_days"] == 3
    assert d["fine"] > 0 and d.get("fine_id"), "overdue return must create a ledger fine"

    fine = BookFine.query.get(d["fine_id"])
    assert fine.status == "unpaid"
    assert float(fine.amount) == d["fine"]

    # pay it off
    r = client.post(f"/api/v1/library/fines/{fine.id}/pay", json={
        "amount": float(fine.amount), "method": "cash",
    }, headers=headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["status"] == "paid"
    assert BookIssue.query.get(issue_id).fine_paid is True

    payment = BookFinePayment.query.filter_by(fine_id=fine.id).first()
    assert payment is not None


def test_waive_requires_reason(client, db, school, headers, book):
    s1 = _student(db, school)
    r = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id),
        "due_date": (date.today() - timedelta(days=2)).isoformat(),
    }, headers=headers)
    issue_id = r.get_json()["data"]["id"]
    client.post(f"/api/v1/library/issues/{issue_id}/return", json={}, headers=headers)
    fine = BookFine.query.filter_by(issue_id=issue_id).first()

    r = client.post(f"/api/v1/library/fines/{fine.id}/waive", json={}, headers=headers)
    assert r.status_code == 400  # no reason → rejected
    r = client.post(f"/api/v1/library/fines/{fine.id}/waive", json={"reason": "book fair week"}, headers=headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["status"] == "waived"


def test_hold_queue_lifecycle(client, db, school, headers, book):
    s1 = _student(db, school, "First", "Holder")
    s2 = _student(db, school, "Second", "Holder")

    # issue both copies
    i1 = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id)}, headers=headers).get_json()["data"]
    i2 = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s2.id)}, headers=headers).get_json()["data"]

    s3 = _student(db, school, "Third", "Holder")
    s4 = _student(db, school, "Fourth", "Holder")

    # hold while unavailable
    r = client.post(f"/api/v1/library/books/{book.id}/reservations", json={
        "student_id": str(s3.id)}, headers=headers)
    assert r.status_code == 201
    hold3 = r.get_json()["data"]
    r = client.post(f"/api/v1/library/books/{book.id}/reservations", json={
        "student_id": str(s4.id)}, headers=headers)
    hold4 = r.get_json()["data"]
    assert hold3["queue_pos"] == 1 and hold4["queue_pos"] == 2

    # student app's own request path (the old fake-success endpoint)
    s5 = _student(db, school, "Fifth", "Holder")
    r = client.post("/api/v1/student/library/request", json={
        "book_id": str(book.id)}, headers=headers)
    assert r.status_code in (400, 403, 404)  # admin token has no student profile — fine
    # (the real student-token flow is covered by queue math here)

    # return i1 → copy auto-reserved for hold3
    r = client.post(f"/api/v1/library/issues/{i1['id']}/return", json={}, headers=headers)
    assert r.status_code == 200
    assert hold3["status"] == "requested"  # serialized earlier; re-fetch:
    res3 = BookReservation.query.get(hold3["id"])
    assert res3.status == "ready" and res3.ready_copy_id is not None

    # collect → becomes an issue on the reserved copy
    r = client.post(f"/api/v1/library/reservations/{res3.id}/collect", json={}, headers=headers)
    assert r.status_code == 201
    assert r.get_json()["data"]["copy_id"] == str(res3.ready_copy_id)
    assert BookReservation.query.get(res3.id).status == "collected"

    # return i2 → hold4 becomes ready
    client.post(f"/api/v1/library/issues/{i2['id']}/return", json={}, headers=headers)
    res4 = BookReservation.query.get(hold4["id"])
    assert res4.status == "ready"

    # cancel → copy back to available
    r = client.post(f"/api/v1/library/reservations/{res4.id}/cancel", json={}, headers=headers)
    assert r.status_code == 200
    copy = BookCopy.query.get(res4.ready_copy_id)
    assert copy.status == "available"
    # copy1 is still issued to the hold3 collector; copy2 just returned to the shelf
    assert book.available_copies == 1
    assert BookIssue.query.filter_by(
        school_id=school.id, status="issued", book_id=book.id,
    ).count() == 1


def test_renew_blocked_when_holds_queued(client, db, school, headers, book):
    s1 = _student(db, school)
    s2 = _student(db, school, "Also", "Out")
    s3 = _student(db, school, "Queued", "Holder")
    # fully issue the book so the hold request is accepted
    i1 = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id)}, headers=headers).get_json()["data"]
    client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s2.id)}, headers=headers)
    r = client.post(f"/api/v1/library/books/{book.id}/reservations", json={
        "student_id": str(s3.id)}, headers=headers)
    assert r.status_code == 201, "hold should queue while all copies are out"
    r = client.post(f"/api/v1/library/issues/{i1['id']}/renew", json={}, headers=headers)
    assert r.status_code == 400
    assert "hold" in r.get_json()["error"].lower()


def test_scan_endpoint(client, db, school, headers, book):
    s1 = _student(db, school)
    client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id)}, headers=headers)
    r = client.get("/api/v1/library/copies/scan/SCAN0001", headers=headers)
    assert r.status_code == 200
    d = r.get_json()["data"]
    assert d["copy"]["accession_no"] == "ACC-T0001"
    assert d["issue"] is not None and d["student"]["name"] == "Hold Tester"

    r = client.get("/api/v1/library/copies/scan/SCAN0002", headers=headers)
    assert r.get_json()["data"]["issue"] is None
    r = client.get("/api/v1/library/copies/scan/NOPE", headers=headers)
    assert r.status_code == 404


def test_mark_lost_creates_replacement_fine(client, db, school, headers, book):
    s1 = _student(db, school)
    i1 = client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id)}, headers=headers).get_json()["data"]
    r = client.post(f"/api/v1/library/issues/{i1['id']}/mark-lost", json={}, headers=headers)
    assert r.status_code == 200
    fine = BookFine.query.filter_by(issue_id=i1["id"], reason="lost").first()
    assert fine is not None and float(fine.amount) == 250  # book.price
    copy = BookCopy.query.get(i1["copy_id"])
    assert copy.status == "lost"
    assert book.total_copies == 1


def test_stocktake_flow(client, db, school, headers, book):
    r = client.post("/api/v1/library/stocktakes", json={"name": "Term stocktake"}, headers=headers)
    assert r.status_code == 201
    session_id = r.get_json()["data"]["id"]
    assert r.get_json()["data"]["expected_count"] == 2

    r = client.post(f"/api/v1/library/stocktakes/{session_id}/scan", json={
        "barcode": "SCAN0001"}, headers=headers)
    assert r.status_code == 201 and r.get_json()["data"]["outcome"] == "found"

    r = client.post(f"/api/v1/library/stocktakes/{session_id}/scan", json={
        "barcode": "SCAN0001"}, headers=headers)
    assert r.status_code == 409  # duplicate scan

    r = client.post(f"/api/v1/library/stocktakes/{session_id}/scan", json={
        "barcode": "MYSTERY-99"}, headers=headers)
    assert r.status_code == 201 and r.get_json()["data"]["outcome"] == "unexpected"

    r = client.post(f"/api/v1/library/stocktakes/{session_id}/close", json={}, headers=headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["missing"] == 1
    items = client.get(
        f"/api/v1/library/stocktakes/{session_id}/items?outcome=missing", headers=headers
    ).get_json()["data"]
    assert len(items) == 1 and items[0]["copy"]["barcode"] == "SCAN0002"


def test_acquisition_flow(client, db, school, headers):
    r = client.post("/api/v1/library/vendors", json={"name": "Bhotahity Books"}, headers=headers)
    assert r.status_code == 201
    vendor_id = r.get_json()["data"]["id"]

    r = client.post("/api/v1/library/purchase-orders", json={
        "vendor_id": vendor_id,
        "items": [
            {"title": "New SEE Science", "author": "CDC", "quantity": 3, "unit_price": 300},
        ],
    }, headers=headers)
    assert r.status_code == 201
    po_id = r.get_json()["data"]["id"]

    r = client.get("/api/v1/library/purchase-orders", headers=headers)
    po = next(p for p in r.get_json()["data"] if p["id"] == po_id)
    assert po["total"] == 900 and po["status"] == "draft"

    r = client.post(f"/api/v1/library/purchase-orders/{po_id}/receive", json={
        "items": [{"item_id": po["items"][0]["id"], "quantity": 3}],
    }, headers=headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["status"] == "received"

    # received copies materialized as a new catalog book
    b = Book.query.filter_by(school_id=school.id, title="New SEE Science").first()
    assert b is not None and b.total_copies == 3 and b.available_copies == 3
    assert BookCopy.query.filter_by(book_id=b.id).count() == 3


def test_reports_and_stats(client, db, school, headers, book):
    s1 = _student(db, school)
    client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s1.id),
        "due_date": (date.today() - timedelta(days=1)).isoformat(),
    }, headers=headers)

    r = client.get("/api/v1/library/reports/popular", headers=headers)
    assert r.status_code == 200
    assert any(x["book_id"] == str(book.id) and x["times_issued"] == 1 for x in r.get_json()["data"])

    r = client.get("/api/v1/library/reports/overdue_by_class", headers=headers)
    assert r.status_code == 200

    r = client.get("/api/v1/library/reports/collection_stats", headers=headers)
    d = r.get_json()["data"]
    assert d["titles"] >= 1 and d["available_copies"] == book.available_copies


def test_opac_public_search(client, db, school, book):
    # no auth header — OPAC is public read-only
    r = client.get(f"/api/v1/library/public/search?q=Copy+Test&school_slug={school.slug}")
    assert r.status_code == 200
    rows = r.get_json()["data"]
    assert any(x["id"] == str(book.id) for x in rows)

    r = client.get(f"/api/v1/library/public/books/{book.id}?school_slug={school.slug}")
    d = r.get_json()["data"]
    assert d["available_now"] == 2 and len(d["copies"]) == 2


def test_student_library_request_persists(client, db, school, headers, book):
    """The old /student/library/request returned {"requested": true} without
    persisting anything — the fix must create a real BookReservation."""
    from app.models.library import BookReservation

    s = _student(db, school)
    s_user = s.user
    s_user.set_password("Test@1234")
    db.session.commit()
    login = client.post("/api/v1/auth/login", json={"email": s_user.email, "password": "Test@1234"})
    if login.status_code != 200:
        login = client.post("/api/v1/auth/login", json={"phone": s_user.phone, "password": "Test@1234"})
    token = login.get_json()["data"]["access_token"]
    sh = {"Authorization": f"Bearer {token}", "X-School-Slug": school.slug}

    # book fully issued → request should queue
    client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(s.id)}, headers=headers)
    other = _student(db, school, "Other", "Taker")
    client.post("/api/v1/library/issues", json={
        "book_id": str(book.id), "student_id": str(other.id)}, headers=headers)

    r = client.post("/api/v1/student/library/request", json={"book_id": str(book.id)}, headers=sh)
    assert r.status_code == 201, r.get_json()
    d = r.get_json()["data"]
    assert d["requested"] is True and d["queue_pos"] == 1
    assert BookReservation.query.filter_by(
        school_id=school.id, book_id=book.id, student_id=s.id, status="requested",
    ).count() == 1

    # duplicate rejected
    r = client.post("/api/v1/student/library/request", json={"book_id": str(book.id)}, headers=sh)
    assert r.status_code == 409
