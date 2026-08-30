"""Student transfer (TC / withdrawal / migration) model."""
from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class StudentTransfer(SchoolModel):
    """A transfer certificate / withdrawal / migration record for one student.

    Tenant-scoped (school_id) and soft-deletable via SchoolModel.
    """
    __tablename__ = "student_transfers"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    transfer_type = Column(
        String(20), nullable=False, default="tc"
    )  # tc | withdrawal | migration
    reason = Column(Text)
    destination_school = Column(String(300))
    status = Column(String(20), nullable=False, default="completed")
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    student = relationship("Student")
