"""Compliance and EMIS models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class ComplianceReport(SchoolModel):
    __tablename__ = "compliance_reports"

    report_type = Column(String(100), nullable=False)  # emis, doe, neb
    academic_year = Column(String(10))
    data = Column(JSONB, default=dict)
    status = Column(String(20), default="draft")  # draft, submitted, accepted
    submitted_at = Column(DateTime)
    submitted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    submitted_by = relationship("User")


class EMISExport(SchoolModel):
    __tablename__ = "emis_exports"

    academic_year = Column(String(10))
    export_data = Column(JSONB, default=dict)
    file_url = Column(Text)
    generated_at = Column(DateTime)
    generated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    generated_by = relationship("User")


class AuditLog(SchoolModel):
    __tablename__ = "audit_logs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(UUID(as_uuid=True))
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(String(45))
    user_agent = Column(Text)

    user = relationship("User")
