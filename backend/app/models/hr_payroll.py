"""HR & Payroll models."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class StaffPayroll(SchoolModel):
    __tablename__ = "staff_payroll"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    month = Column(String(7), nullable=False)  # YYYY-MM
    basic_salary = Column(Numeric(12, 2), nullable=False)
    allowances = Column(JSONB, default=dict)  # {transport: 2000, dearness: 1000}
    deductions = Column(JSONB, default=dict)  # {pf: 1500, tax: 500, ssf: 1000}
    gross_salary = Column(Numeric(12, 2))
    net_salary = Column(Numeric(12, 2))
    status = Column(String(20), default="draft")  # draft, approved, paid
    paid_at = Column(DateTime)
    payment_method = Column(String(50))  # bank_transfer, cheque, cash
    bank_ref = Column(String(200))
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class StaffLeave(SchoolModel):
    __tablename__ = "staff_leaves"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    leave_type = Column(String(50), nullable=False)  # casual, sick, maternity, unpaid
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Integer)
    reason = Column(Text)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime)
    notes = Column(Text)

    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class StaffAppraisal(SchoolModel):
    __tablename__ = "staff_appraisals"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    period = Column(String(50))  # e.g., "2081-82 Q1"
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    scores = Column(JSONB, default=dict)  # {teaching: 4, punctuality: 5, ...}
    overall_score = Column(Numeric(3, 1))
    strengths = Column(Text)
    areas_for_improvement = Column(Text)
    goals = Column(JSONB, default=list)
    status = Column(String(20), default="draft")  # draft, submitted, reviewed
    reviewed_at = Column(DateTime)

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])


class ExpenseCategory(SchoolModel):
    __tablename__ = "expense_categories"

    name = Column(String(100), nullable=False)
    description = Column(Text)


class Expense(SchoolModel):
    __tablename__ = "expenses"

    category_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id"), nullable=False)
    title = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, nullable=False)
    recorded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    receipt_url = Column(Text)
    notes = Column(Text)

    category = relationship("ExpenseCategory")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])

