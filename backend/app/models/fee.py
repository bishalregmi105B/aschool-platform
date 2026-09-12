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
    # ── S-A1 (A-01): explicit BS due date + grouping ──────────────────
    # due_date_bs replaces parsing "[due_day:N]" out of notes for aging and
    # fine accrual; the notes marker stays for dedupe and legacy rows.
    due_date_bs = Column(String(20))
    # The parent bill document this line belongs to (NULL for legacy rows —
    # they keep working; _group_collections_into_invoices backfills lazily).
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("fee_invoices.id"), index=True)
    # Set when the bill was generated from a structure's installment schedule.
    installment_id = Column(UUID(as_uuid=True), ForeignKey("fee_installments.id"))
    # Last BS date a late fine was accrued on (fine-accrual idempotency stamp).
    fine_accrued_on_bs = Column(String(20))

    student = relationship("Student", backref="fee_collections")
    collected_by = relationship("User")
    invoice = relationship("FeeInvoice", backref="collections", foreign_keys=[invoice_id])
    installment = relationship("FeeInstallment")


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


# ── S-A1 (A-01/A-24): invoices, installments, carry-forward, offline
#    slips, day closure. Money stays on FeeCollection/FeeReceipt — every
#    model below is either a grouping document (invoice), a schedule
#    (installment), a workflow row (carry-forward, offline submission) or a
#    control row (day closure). Totals are always computed from the lines;
#    no stored balances (the MSP divergence lesson).
class FeeInvoice(SchoolModel):
    """One bill document per student per billing period.

    Lines are FeeCollection rows (invoice_id). status is maintained by
    _recompute_invoice_status() on every line mutation — it is a cache of
    the line sums, never an independent source of truth.
    """

    __tablename__ = "fee_invoices"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    academic_year = Column(String(10))
    title = Column(String(200), nullable=False)
    # BS period key of the bill group ("2083-01" month, "2083-Q1", or the
    # annual year) — mirrors the cycle keys the generators already use.
    period_key = Column(String(20), index=True)
    due_date_bs = Column(String(20))
    status = Column(
        Enum("pending", "partial", "paid", "waived", name="fee_invoice_status"),
        default="pending",
        index=True,
    )
    notes = Column(Text)

    student = relationship("Student", backref="fee_invoices")


class FeeInstallment(SchoolModel):
    """One row of a structure's installment schedule (e.g. 3 terms).

    Validated so the schedule's amounts sum to the structure total before it
    can be applied; applying generates one FeeCollection per installment with
    the explicit BS due date.
    """

    __tablename__ = "fee_installments"
    __table_args__ = (
        Index("uq_fee_installments_structure_seq", "structure_id", "seq",
              unique=True, postgresql_where=text("is_deleted = false")),
    )

    structure_id = Column(
        UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False, index=True
    )
    seq = Column(Integer, nullable=False)
    label = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    due_date_bs = Column(String(20))
    is_generated = Column(Boolean, default=False)


class FeeCarryForward(SchoolModel):
    """A student's signed balance rolled from one academic year into the next.

    balance > 0 with balance_type='due'      → the student owes (a bill is
                                                 created in the new year on
                                                 apply).
    balance < 0 with balance_type='credit'   → the student overpaid/has
                                                 advance; on apply this is
                                                 stored as a self-settled
                                                 (waived) bill line so reports
                                                 show the credit.
    """

    __tablename__ = "fee_carry_forwards"
    __table_args__ = (
        Index("uq_fee_carry_forward_student_year", "student_id", "from_year_bs", "to_year_bs",
              unique=True, postgresql_where=text("is_deleted = false")),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    from_year_bs = Column(String(10), nullable=False)
    to_year_bs = Column(String(10), nullable=False)
    balance = Column(Numeric(12, 2), nullable=False)  # always stored positive
    balance_type = Column(Enum("due", "credit", name="carry_forward_type"), nullable=False)
    due_date_bs = Column(String(20))
    status = Column(
        Enum("pending", "applied", "reversed", name="carry_forward_status"),
        default="pending",
    )
    applied_collection_id = Column(UUID(as_uuid=True), ForeignKey("fee_collections.id"))
    notes = Column(Text)


class FeeCarryForwardLog(SchoolModel):
    """Immutable audit trail of every carry-forward action (InfixEdu's log
    viewer is the one part of their carry-forward worth copying verbatim)."""

    __tablename__ = "fee_carry_forward_logs"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    action = Column(String(20), nullable=False)  # preview|apply|reverse
    balance = Column(Numeric(12, 2))
    balance_type = Column(String(10))
    from_year_bs = Column(String(10))
    to_year_bs = Column(String(10))
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    detail = Column(JSONB, default=dict)


class FeeOfflineSubmission(SchoolModel):
    """Bank-transfer / cheque slip awaiting admin approval (InfixEdu's
    bank-payment-slip queue — how most Nepali schools actually collect).

    The parent/student uploads evidence + the bills it settles; approval
    records the payments through the SAME record-payment core (receipts,
    invoice status, events) as a desk collection. Money moves only on
    approval, and only once (status transition guards)."""

    __tablename__ = "fee_offline_submissions"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(
        Enum("bank", "cheque", name="offline_method"), nullable=False
    )
    bank_name = Column(String(200))
    reference_no = Column(String(200))
    paid_on_bs = Column(String(20))
    slip_file_id = Column(UUID(as_uuid=True), ForeignKey("managed_files.id"))
    collection_ids = Column(JSONB, default=list)  # bills this submission settles
    status = Column(
        Enum("pending", "approved", "rejected", name="offline_submission_status"),
        default="pending",
        index=True,
    )
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    review_notes = Column(Text)
    receipt_ids = Column(JSONB, default=list)  # receipts written on approval

    student = relationship("Student")
    slip_file = relationship("ManagedFile")
    created_by = relationship("User", foreign_keys=[created_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])


class FeeDayClosure(SchoolModel):
    """Counter accountability (InstiKit day-closure, BS-first).

    When a collector closes their day, record_payment refuses further cash/
    cheque entries for that collector+date until an admin reopens — the till
    lock. expected_total is computed from the day book at close time;
    counted_total is what the counter physically counted (denominations)."""

    __tablename__ = "fee_day_closures"
    __table_args__ = (
        Index("uq_fee_day_closures_date_user", "closure_date_bs", "collected_by_id",
              unique=True, postgresql_where=text("is_deleted = false")),
    )

    closure_date_bs = Column(String(20), nullable=False, index=True)
    closure_date_ad = Column(DateTime)
    collected_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum("closed", "open", name="day_closure_status"), default="closed")
    denominations = Column(JSONB, default=dict)  # {"1000": 3, "500": 2, ...}
    expected_total = Column(Numeric(12, 2), default=0)
    counted_total = Column(Numeric(12, 2), default=0)
    difference = Column(Numeric(12, 2), default=0)
    closed_at = Column(DateTime)
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reopened_at = Column(DateTime)
    reopened_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    collected_by = relationship("User", foreign_keys=[collected_by_id])
