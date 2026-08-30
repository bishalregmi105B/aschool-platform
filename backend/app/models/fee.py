"""Fee models: FeeStructure, FeeCollection, FeeReceipt, FeeType, StudentScholarship."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
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
        Enum("paid", "pending", "partial", "waived", name="payment_status"),
        default="pending",
    )
    notes = Column(Text)
    receipt_url = Column(Text)

    student = relationship("Student", backref="fee_collections")
    collected_by = relationship("User")


class FeeReceipt(SchoolModel):
    __tablename__ = "fee_receipts"

    collection_id = Column(
        UUID(as_uuid=True), ForeignKey("fee_collections.id"), nullable=False
    )
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
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

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    fee_type = Column(String(100))          # null = all types
    discount_type = Column(String(10), default="percent")   # "percent" | "fixed"
    discount_value = Column(Numeric(10, 2), default=0)
    reason = Column(String(255))
    valid_from_bs = Column(String(20))
    valid_until_bs = Column(String(20))
    is_active = Column(Boolean, default=True)

    student = relationship("Student", backref="scholarships")
