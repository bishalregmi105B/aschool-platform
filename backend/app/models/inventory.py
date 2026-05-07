"""Inventory & Asset management models."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Asset(SchoolModel):
    __tablename__ = "assets"

    name = Column(String(300), nullable=False)
    asset_code = Column(String(100), unique=True)
    qr_code = Column(Text)
    category = Column(String(100))  # furniture, electronics, sports, lab
    location = Column(String(200))
    purchase_date = Column(Date)
    purchase_price = Column(Numeric(12, 2))
    current_value = Column(Numeric(12, 2))
    depreciation_rate = Column(Numeric(5, 2))
    condition = Column(String(20), default="good")  # new, good, fair, poor, disposed
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    warranty_expiry = Column(Date)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)

    assigned_to = relationship("User")


class ProcurementRequest(SchoolModel):
    __tablename__ = "procurement_requests"

    title = Column(String(300), nullable=False)
    items = Column(JSONB, default=list)  # [{name, quantity, estimated_cost}]
    total_estimated_cost = Column(Numeric(12, 2))
    justification = Column(Text)
    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String(20), default="pending")  # pending, approved, rejected, ordered, received
    vendor = Column(String(300))
    purchase_order_ref = Column(String(200))
    received_at = Column(DateTime)
    notes = Column(Text)

    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class AssetAuditLog(SchoolModel):
    __tablename__ = "asset_audit_logs"

    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    action = Column(String(50), nullable=False)  # assigned, returned, maintenance, disposed
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    old_value = Column(JSONB)
    new_value = Column(JSONB)
    notes = Column(Text)

    asset = relationship("Asset", backref="audit_logs")
    performed_by = relationship("User")
