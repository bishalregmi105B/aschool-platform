"""FC-B: library v2 — copy-level catalog, holds, fines ledger, stocktake,
acquisition.

Gives the library module the missing LMS surfaces (Librarika/Koha parity):
per-copy circulation with barcodes, reservation queue, a fines ledger that
can actually be paid/waived (fine_paid on book_issues was never settable),
stock-take sessions, and a vendor/PO acquisition chain.

Header-level Book aggregates (total_copies/available_copies) stay; book_copies
is the per-copy source of truth. book_issues gains an optional copy_id so the
existing issue flow can keep working while copies are adopted.

Revision ID: fc_b_lib
Revises: fc_a06_idx
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "fc_b_lib"
down_revision = "fc_a06_idx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "book_racks",
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("location_code", sa.String(50)),
        sa.Column("capacity", sa.Integer()),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "book_copies",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("books.id"), nullable=False),
        sa.Column("accession_no", sa.String(50)),
        sa.Column("barcode", sa.String(50)),
        sa.Column(
            "status",
            sa.Enum("available", "issued", "reserved", "lost", "damaged", "weeded", "repair", name="book_copy_status"),
            nullable=False,
            server_default="available",
        ),
        sa.Column("condition", sa.String(200)),
        sa.Column("rack_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_racks.id")),
        sa.Column("notes", sa.Text()),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_book_copies_school_book_status", "book_copies", ["school_id", "book_id", "status"])
    op.create_index("ix_book_copies_school_barcode", "book_copies", ["school_id", "barcode"])
    # accession numbers are the librarian's physical label — unique per school
    op.create_unique_constraint(
        "uq_book_copies_school_accession", "book_copies", ["school_id", "accession_no"],
    )

    op.create_table(
        "book_reservations",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("books.id"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("students.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("requested", "ready", "collected", "expired", "cancelled", name="book_reservation_status"),
            nullable=False,
            server_default="requested",
        ),
        sa.Column("queue_pos", sa.Integer(), server_default="1"),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ready_at", sa.DateTime(timezone=True)),
        sa.Column("pickup_deadline", sa.Date()),
        sa.Column("ready_copy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_copies.id")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_book_res_school_book_status", "book_reservations", ["school_id", "book_id", "status"])

    op.create_table(
        "book_fines",
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_issues.id")),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("students.id"), nullable=True),
        sa.Column("reason", sa.Enum("overdue", "damage", "lost", "card", name="book_fine_reason"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("unpaid", "partial", "paid", "waived", name="book_fine_status"),
            nullable=False,
            server_default="unpaid",
        ),
        sa.Column("paid_amount", sa.Numeric(10, 2), server_default="0"),
        sa.Column("paid_via", sa.String(50)),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("waived_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("waived_reason", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_book_fines_school_student_status", "book_fines", ["school_id", "student_id", "status"])

    op.create_table(
        "book_fine_payments",
        sa.Column("fine_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_fines.id"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("method", sa.String(50), server_default="cash"),
        sa.Column("reference", sa.String(200)),
        sa.Column("collected_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "stocktake_sessions",
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.Enum("open", "closed", name="stocktake_status"), nullable=False, server_default="open"),
        sa.Column("started_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("scan_count", sa.Integer(), server_default="0"),
        sa.Column("expected_count", sa.Integer(), server_default="0"),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "stocktake_items",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stocktake_sessions.id"), nullable=False),
        sa.Column("copy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_copies.id"), nullable=True),
        sa.Column("scan_value", sa.String(200)),
        sa.Column(
            "outcome",
            sa.Enum("found", "missing", "unexpected", "damaged", name="stocktake_outcome"),
            nullable=False,
        ),
        sa.Column("rack_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_racks.id")),
        sa.Column("scanned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_stocktake_items_session", "stocktake_items", ["session_id"])

    op.create_table(
        "book_vendors",
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("contact_name", sa.String(200)),
        sa.Column("phone", sa.String(50)),
        sa.Column("email", sa.String(200)),
        sa.Column("address", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "book_purchase_orders",
        sa.Column("po_number", sa.String(50)),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_vendors.id")),
        sa.Column(
            "status",
            sa.Enum("draft", "sent", "partially_received", "received", "paid", "cancelled", name="book_po_status"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("expected_date", sa.Date()),
        sa.Column("received_date", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "book_po_items",
        sa.Column("po_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_purchase_orders.id"), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("books.id")),
        sa.Column("title", sa.String(500)),
        sa.Column("author", sa.String(300)),
        sa.Column("isbn", sa.String(20)),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("quantity_received", sa.Integer(), server_default="0"),
        sa.Column("unit_price", sa.Numeric(10, 2), server_default="0"),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # book_issues.copy_id — links an issue to the physical copy (nullable so
    # legacy header-only issues keep working)
    op.add_column(
        "book_issues",
        sa.Column("copy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("book_copies.id"), nullable=True),
    )
    op.create_index("ix_book_issues_copy", "book_issues", ["copy_id"])
    op.add_column("book_issues", sa.Column("renewal_count", sa.Integer(), nullable=False, server_default="0"))

    # books: replacement price / OPAC language / low-stock threshold
    op.add_column("books", sa.Column("price", sa.Numeric(10, 2), nullable=True))
    op.add_column("books", sa.Column("language", sa.String(50), nullable=True))
    op.add_column("books", sa.Column("min_stock_alert", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_index("ix_book_issues_copy", table_name="book_issues")
    op.drop_column("book_issues", "copy_id")
    op.drop_column("book_issues", "renewal_count")
    op.drop_column("books", "price")
    op.drop_column("books", "language")
    op.drop_column("books", "min_stock_alert")
    op.drop_table("book_po_items")
    op.drop_table("book_purchase_orders")
    op.drop_table("book_vendors")
    op.drop_index("ix_stocktake_items_session", table_name="stocktake_items")
    op.drop_table("stocktake_items")
    op.drop_table("stocktake_sessions")
    op.drop_table("book_fine_payments")
    op.drop_index("ix_book_fines_school_student_status", table_name="book_fines")
    op.drop_table("book_fines")
    op.drop_index("ix_book_res_school_book_status", table_name="book_reservations")
    op.drop_table("book_reservations")
    op.drop_constraint("uq_book_copies_school_accession", "book_copies", type_="unique")
    op.drop_index("ix_book_copies_school_barcode", table_name="book_copies")
    op.drop_index("ix_book_copies_school_book_status", table_name="book_copies")
    op.drop_table("book_copies")
    op.drop_table("book_racks")
    for enum_name in (
        "book_copy_status", "book_reservation_status", "book_fine_reason",
        "book_fine_status", "stocktake_status", "stocktake_outcome", "book_po_status",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
