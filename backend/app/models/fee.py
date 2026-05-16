"""Fee models: FeeStructure, FeeCollection, FeeReceipt."""
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
