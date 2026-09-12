"""Attendance models."""
from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Attendance(SchoolModel):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint(
            "school_id", "student_id", "date",
            name="uq_attendance_student_date",
        ),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    # D-05 expand: year-anchored attendance (contract phase makes it NOT NULL)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    date = Column(Date, nullable=False)
    date_bs = Column(String(10))
    status = Column(
        # 'holiday' added by s_a2_exam_attendance (A-33): holiday days are
        # recorded as register rows so monthly registers and absent-SMS
        # digests never treat a holiday as an unexplained absence.
        Enum(
            "present", "absent", "late", "half_day", "leave", "holiday",
            name="attendance_status",
        ),
        nullable=False,
    )
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    marked_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    remarks = Column(Text)
    # A-31: yearly-ledger anchor (nullable; backfilled opportunistically)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"))

    student = relationship("Student", backref="attendance_records")
    marked_by = relationship("User")


class TeacherAttendance(SchoolModel):
    __tablename__ = "teacher_attendance"
    __table_args__ = (
        UniqueConstraint(
            "school_id", "user_id", "date",
            name="uq_teacher_attendance_user_date",
        ),
    )

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
    rejection_reason = Column(Text)

    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class SubjectAttendance(SchoolModel):
    """Subject/period-wise attendance register (S-A2, A-33) — InfixEdu's
    sm_subject_attendances idea: one row per student × subject × date,
    fed from the timetable; the absent-SMS digest reads THIS register (a
    student absent only for the morning subjects is a different signal than
    a full-day absence). Daily register stays in `Attendance`."""

    __tablename__ = "subject_attendance"
    __table_args__ = (
        UniqueConstraint(
            "school_id", "student_id", "subject_id", "date",
            name="uq_subject_attendance_student_subject_date",
        ),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    date = Column(Date, nullable=False)
    date_bs = Column(String(10))
    status = Column(
        Enum("present", "absent", "late", "half_day", "leave", name="attendance_status"),
        nullable=False,
    )
    marked_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    remarks = Column(Text)

    student = relationship("Student", backref="subject_attendance_records")
    subject = relationship("Subject")
    marked_by = relationship("User")
