"""Library models."""
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Book(SchoolModel):
    __tablename__ = "books"
    __table_args__ = (
        # FC-A06: every catalog query filters school+is_deleted and sorts by title
        Index("ix_books_school_deleted_title", "school_id", "is_deleted", "title"),
    )

    title = Column(String(500), nullable=False)
    author = Column(String(300))
    isbn = Column(String(20))
    publisher = Column(String(300))
    category = Column(String(100))
    total_copies = Column(Integer, default=1)
    available_copies = Column(Integer, default=1)
    shelf_location = Column(String(50))
    cover_url = Column(Text)
    barcode = Column(String(50))
    is_available = Column(Boolean, default=True)
    # FC-B: replacement price (NPR) for lost-book fines, language for OPAC
    # facets, low-stock alert threshold for reorder prompts
    price = Column(Numeric(10, 2))
    language = Column(String(50))
    min_stock_alert = Column(Integer)


class BookTransaction(SchoolModel):
    __tablename__ = "book_transactions"

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    issued_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    return_date = Column(Date)
    status = Column(
        Enum("issued", "returned", "overdue", "lost", name="book_tx_status"),
        default="issued",
    )
    fine_amount = Column(Numeric(8, 2), default=0)
    fine_paid = Column(Boolean, default=False)

    book = relationship("Book", backref="transactions")
    student = relationship("Student", backref="book_transactions")
    issued_by = relationship("User")


class BookIssue(SchoolModel):
    __tablename__ = "book_issues"
    __table_args__ = (
        # FC-A06: checkout desk looks up the active issue for a book; the
        # overdue page filters school+status+due_date. Previously only a
        # school+student index existed and both scans were sequential.
        Index("ix_book_issues_school_book", "school_id", "book_id"),
        Index("ix_book_issues_school_status_due", "school_id", "status", "due_date"),
    )

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    issued_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    issued_date = Column(Date)
    due_date = Column(Date, nullable=False)
    returned_date = Column(Date)
    status = Column(
        Enum("issued", "returned", "overdue", "lost", name="book_issue_status"),
        default="issued",
    )
    # Fine assessed at return (per-day rate × days overdue, capped by plugin
    # config). Persisted so unpaid fines survive the return and can be tracked
    # and paid later — previously this was set on the instance and never saved
    # (L-01: serialized here on every /library/issues GET → AttributeError 500).
    fine_amount = Column(Numeric(8, 2))
    fine_paid = Column(Boolean, nullable=False, default=False)
    # FC-B: the physical copy this issue drew from (nullable — legacy
    # header-level issues predate copy-level circulation)
    copy_id = Column(UUID(as_uuid=True), ForeignKey("book_copies.id"))
    # FC-B: how many times the due date was pushed (circulation.renewal_limit)
    renewal_count = Column(Integer, nullable=False, default=0)

    book = relationship("Book", backref="issues")
    student = relationship("Student", backref="book_issues")
    copy = relationship("BookCopy", backref="issues")


# ── Library v2 (FC-B): copy-level catalog, holds, fines ledger, stocktake,
#    acquisition. The header-level Book row keeps aggregate counts for cheap
#    list rendering; book_copies is the circulation source of truth. ────────


class BookRack(SchoolModel):
    __tablename__ = "book_racks"

    name = Column(String(100), nullable=False)
    location_code = Column(String(50))
    capacity = Column(Integer)


class BookCopy(SchoolModel):
    __tablename__ = "book_copies"
    __table_args__ = (
        Index("ix_book_copies_school_book_status", "school_id", "book_id", "status"),
        Index("ix_book_copies_school_barcode", "school_id", "barcode"),
        # accession numbers are the librarian's physical label — unique per school
        UniqueConstraint("school_id", "accession_no", name="uq_book_copies_school_accession"),
    )

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    # accession number — unique per school, the librarian's physical label
    accession_no = Column(String(50))
    barcode = Column(String(50))
    # available, issued, reserved, lost, damaged, weeded, repair
    status = Column(
        Enum(
            "available", "issued", "reserved", "lost", "damaged", "weeded", "repair",
            name="book_copy_status",
        ),
        nullable=False,
        default="available",
    )
    condition = Column(String(200))
    rack_id = Column(UUID(as_uuid=True), ForeignKey("book_racks.id"))
    notes = Column(Text)

    book = relationship("Book", backref="copies")
    rack = relationship("BookRack")


class BookReservation(SchoolModel):
    __tablename__ = "book_reservations"
    __table_args__ = (
        Index("ix_book_res_school_book_status", "school_id", "book_id", "status"),
    )

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    # requested → ready → collected / expired / cancelled
    status = Column(
        Enum("requested", "ready", "collected", "expired", "cancelled", name="book_reservation_status"),
        nullable=False,
        default="requested",
    )
    queue_pos = Column(Integer, default=1)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    ready_at = Column(DateTime(timezone=True))
    pickup_deadline = Column(Date)
    ready_copy_id = Column(UUID(as_uuid=True), ForeignKey("book_copies.id"))

    book = relationship("Book", backref="reservations")
    student = relationship("Student", backref="book_reservations")


class BookFine(SchoolModel):
    __tablename__ = "book_fines"
    __table_args__ = (
        Index("ix_book_fines_school_student_status", "school_id", "student_id", "status"),
    )

    issue_id = Column(UUID(as_uuid=True), ForeignKey("book_issues.id"))
    # nullable: stock-take losses have no member to charge (school absorbs)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    # overdue, damage, lost, card
    reason = Column(Enum("overdue", "damage", "lost", "card", name="book_fine_reason"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False, default=0)
    # unpaid → partial → paid / waived
    status = Column(
        Enum("unpaid", "partial", "paid", "waived", name="book_fine_status"),
        nullable=False,
        default="unpaid",
    )
    paid_amount = Column(Numeric(10, 2), default=0)
    paid_via = Column(String(50))
    paid_at = Column(DateTime(timezone=True))
    waived_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    waived_reason = Column(Text)
    notes = Column(Text)

    issue = relationship("BookIssue", backref="fines")
    student = relationship("Student", backref="book_fines")


class BookFinePayment(SchoolModel):
    __tablename__ = "book_fine_payments"

    fine_id = Column(UUID(as_uuid=True), ForeignKey("book_fines.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    # cash, esewa, khalti, fonepay, voucher
    method = Column(String(50), default="cash")
    reference = Column(String(200))
    collected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    fine = relationship("BookFine", backref="payments")


class StocktakeSession(SchoolModel):
    __tablename__ = "stocktake_sessions"

    name = Column(String(200), nullable=False)
    # open → closed
    status = Column(Enum("open", "closed", name="stocktake_status"), nullable=False, default="open")
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    scan_count = Column(Integer, default=0)
    expected_count = Column(Integer, default=0)
    closed_at = Column(DateTime(timezone=True))


class StocktakeItem(SchoolModel):
    __tablename__ = "stocktake_items"
    __table_args__ = (
        Index("ix_stocktake_items_session", "session_id"),
    )

    session_id = Column(UUID(as_uuid=True), ForeignKey("stocktake_sessions.id"), nullable=False)
    # nullable: an "unexpected" scan (barcode not in the catalog) has no copy
    copy_id = Column(UUID(as_uuid=True), ForeignKey("book_copies.id"), nullable=True)
    scan_value = Column(String(200))
    # found, missing, unexpected, damaged
    outcome = Column(Enum("found", "missing", "unexpected", "damaged", name="stocktake_outcome"), nullable=False)
    rack_id = Column(UUID(as_uuid=True), ForeignKey("book_racks.id"))
    scanned_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("StocktakeSession", backref="items")
    copy = relationship("BookCopy")


class BookVendor(SchoolModel):
    __tablename__ = "book_vendors"

    name = Column(String(300), nullable=False)
    contact_name = Column(String(200))
    phone = Column(String(50))
    email = Column(String(200))
    address = Column(Text)
    notes = Column(Text)


class BookPurchaseOrder(SchoolModel):
    __tablename__ = "book_purchase_orders"

    po_number = Column(String(50))
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("book_vendors.id"))
    # draft → sent → partially_received → received → paid / cancelled
    status = Column(
        Enum("draft", "sent", "partially_received", "received", "paid", "cancelled", name="book_po_status"),
        nullable=False,
        default="draft",
    )
    expected_date = Column(Date)
    received_date = Column(Date)
    notes = Column(Text)

    vendor = relationship("BookVendor", backref="purchase_orders")


class BookPurchaseOrderItem(SchoolModel):
    __tablename__ = "book_po_items"

    po_id = Column(UUID(as_uuid=True), ForeignKey("book_purchase_orders.id"), nullable=False)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"))
    # free-text title so a PO can be raised before the book is catalogued
    title = Column(String(500))
    author = Column(String(300))
    isbn = Column(String(20))
    quantity = Column(Integer, nullable=False, default=1)
    quantity_received = Column(Integer, default=0)
    unit_price = Column(Numeric(10, 2), default=0)

    po = relationship("BookPurchaseOrder", backref="items")
    book = relationship("Book", backref="po_items")
