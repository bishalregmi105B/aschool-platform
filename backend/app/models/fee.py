"""Fee models: FeeStructure, FeeCollection, FeeReceipt, FeeType, StudentScholarship."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class FeeType(SchoolModel):
    """Custom fee type / category defined per school."""
    __tablename__ = "fee_types"

    name = Column(String(120), nullable=False)
    description = Column(String(255))
    is_system = Column(Boolean, default=False)


class FeeStructure(SchoolModel):
    __tablename__ = "fee_structures"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    academic_year = Column(String(10))
    fee_items = Column(JSONB, default=list)
    total_annual = Column(Numeric(12, 2))
    total_monthly = Column(Numeric(10, 2))

    klass = relationship("Class", backref="fee_structures")


class FeeCollection(SchoolModel):
    __tablename__ = "fee_collections"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    academic_year = Column(String(10))
    fee_item_name = Column(String(200))
    amount = Column(Numeric(10, 2), nullable=False)
    month_bs = Column(String(20))
    year_bs = Column(String(10))
    payment_method = Column(
        Enum(
            "cash",
            "esewa",
            "khalti",
            "fonepay",
            "bank",
            "cheque",
            # DB enum gained qr_pay in e4f5a6b7c8d9 — the model must match or
            # reading a qr_pay row raises LookupError (D-01).
            "qr_pay",
            name="payment_method",
        )
    )
    transaction_id = Column(String(200))
    receipt_number = Column(String(50))
    collected_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    collected_at = Column(DateTime)
    late_fine_amount = Column(Numeric(10, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    is_scholarship = Column(Boolean, default=False)
    payment_status = Column(
        # 'refunded' added by migration f8c2a9d4e1b7 (S-13): the refund path
        # sets this status; without the enum value the commit raised DataError
        # AFTER the gateway had already moved the money.
        Enum(
            "paid", "pending", "partial", "waived", "refunded",
            name="payment_status",
        ),
        default="pending",
    )
    notes = Column(Text)
    receipt_url = Column(Text)
    # P-01(c): reminder dedupe — beat restarts/retries must not spam
    # guardians; send_fee_reminders skips fees reminded within 72h.
    last_reminder_sent_at = Column(DateTime)

    student = relationship("Student", backref="fee_collections")
    collected_by = relationship("User")


class FeeReceipt(SchoolModel):
    __tablename__ = "fee_receipts"

    collection_id = Column(
        UUID(as_uuid=True), ForeignKey("fee_collections.id"), nullable=False
    )
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    # D-05 expand: year anchor from the student (contract phase NOT NULL)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    receipt_number = Column(String(50), nullable=False)
    amount = Column(Numeric(10, 2), default=0)
    payment_method = Column(String(50))
    transaction_id = Column(String(200))
    pdf_url = Column(Text)
    qr_code_url = Column(Text)
    idempotency_key = Column(String(100), unique=True, index=True)
    sent_via_whatsapp = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    verified_hash = Column(String(255))

    collection = relationship("FeeCollection", backref="receipt")
    student = relationship("Student", backref="fee_receipts")

    __table_args__ = (
        # D-02: receipt numbers are a per-school series — a duplicate breaks
        # the IRD-expected ordering and the books. Mirrors migration a9b3e7c1d5f8.
        Index(
            "uq_fee_receipts_school_receipt_number",
            "school_id", "receipt_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


class FeeRefund(SchoolModel):
    """A refunded fee payment (S-13) — written in the SAME transaction as the
    collection status change, before the gateway call's money movement is
    acknowledged. The refund story lives in the ledger, not in a parseable
    substring of FeeCollection.notes."""

    __tablename__ = "fee_refunds"

    collection_id = Column(
        UUID(as_uuid=True), ForeignKey("fee_collections.id"), nullable=False, index=True
    )
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(String(255), nullable=False)
    gateway = Column(String(50))            # khalti / esewa / ...
    gateway_ref = Column(String(200))       # gateway refund transaction id
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(
        Enum("initiated", "completed", "failed", name="refund_status"),
        default="initiated",
    )

    collection = relationship("FeeCollection", backref="refunds")
    approved_by = relationship("User")


class PaymentInitiation(SchoolModel):
    """One hosted-checkout attempt per gateway redirect (audit E60).

    Persisted BEFORE the user is redirected to the gateway so every
    callback can be matched to a server-side record of what was
    initiated (amount + gateway reference). Callbacks are anchored to
    this row for amount cross-checking and idempotency — money is never
    applied without a server-side record of the initiated charge.

    gateway_ref holds the gateway's transaction reference:
      esewa  -> transaction_uuid (the fee collection id)
      khalti -> pidx returned by the initiate API
      fonepay-> PRN generated at initiation

    status: initiated -> completed | failed
    """

    __tablename__ = "payment_initiations"

    collection_id = Column(
        UUID(as_uuid=True), ForeignKey("fee_collections.id"), nullable=False, index=True
    )
    gateway = Column(String(20), nullable=False)  # esewa | khalti | fonepay
    gateway_ref = Column(String(200), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="initiated")  # initiated|completed|failed
    initiated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    completed_at = Column(DateTime)

    collection = relationship("FeeCollection", backref="payment_initiations")
    initiated_by = relationship("User")


class StudentScholarship(SchoolModel):
    """Per-student fee discount/scholarship — auto-applied during fee generation.

    discount_type: "percent" (0-100) or "fixed" (flat NPR amount)
    fee_type: if null, applies to ALL fee types for this student
    valid_until_bs: if null, scholarship is open-ended
    """
    __tablename__ = "student_scholarships"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    fee_type = Column(String(100))          # null = all types
    discount_type = Column(String(10), default="percent")   # "percent" | "fixed"
    discount_value = Column(Numeric(10, 2), default=0)
    reason = Column(String(255))
    valid_from_bs = Column(String(20))
    valid_until_bs = Column(String(20))
    is_active = Column(Boolean, default=True)

    student = relationship("Student", backref="scholarships")
