"""Attendance models."""
from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Attendance(SchoolModel):
    __tablename__ = "attendance"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    date = Column(Date, nullable=False)
    date_bs = Column(String(10))
    status = Column(
        Enum("present", "absent", "late", "half_day", "leave", name="attendance_status"),
        nullable=False,
    )
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    marked_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    remarks = Column(Text)

    student = relationship("Student", backref="attendance_records")
    marked_by = relationship("User")


class TeacherAttendance(SchoolModel):
    __tablename__ = "teacher_attendance"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    date_bs = Column(String(10))
    status = Column(
        Enum("present", "absent", "late", "leave", "half_day", name="teacher_att_status"),
        nullable=False,
    )
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    remarks = Column(Text)

    user = relationship("User", backref="teacher_attendance_records")


class LeaveRequest(SchoolModel):
    __tablename__ = "leave_requests"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    leave_type = Column(String(50))  # sick, casual, earned, maternity
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text)
    status = Column(
        Enum("pending", "approved", "rejected", name="leave_status"), default="pending"
    )
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime)

    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
