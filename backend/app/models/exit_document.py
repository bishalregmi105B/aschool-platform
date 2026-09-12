"""A-36: student exit documents — TC/character/bonafide/transcript with
public verification (the InstiKit TC-verification steal) and the MSP
behavior of disabling the student on TC issuance."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class StudentExitDocument(SchoolModel):
    __tablename__ = "student_exit_documents"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    doc_type = Column(String(30), nullable=False)  # transfer_certificate|character_certificate|bonafide|transcript
    document_number = Column(String(50), nullable=False)
    issued_on_bs = Column(String(10))
    reason = Column(Text)
    dues_cleared = Column(Boolean, default=False)
    revoked_at = Column(DateTime)
    meta = Column(JSONB, default=dict)

    student = relationship("Student")

    __table_args__ = (
        Index(
            "uq_student_exit_documents_number",
            "school_id", "document_number",
            unique=True,
            postgresql_where=sa_text("is_deleted = false"),
        ),
    )
