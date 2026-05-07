"""Exam, Marks, and ReportCard models."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Exam(SchoolModel):
    __tablename__ = "exams"

    name = Column(String(200), nullable=False)
    name_nepali = Column(String(200))
    description = Column(Text)
    instructions = Column(Text)
    exam_type = Column(
        Enum(
            "unit_test",
            "terminal",
            "annual",
            "pre_board",
            "board_trial",
            "see_mock",
            "class_test",
            name="exam_type",
        ),
        nullable=False,
    )
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    class_ids = Column(ARRAY(UUID(as_uuid=True)))  # For multi-class exams
    subject_ids = Column(ARRAY(UUID(as_uuid=True)))

    # Dates — support both BS and AD
    start_date_bs = Column(String(10))
    end_date_bs = Column(String(10))
    start_date_ad = Column(Date)
    end_date_ad = Column(Date)
    # Legacy aliases
    start_date = Column(Date)
    end_date = Column(Date)

    # Marks config
    total_marks = Column(Integer)
    pass_marks = Column(Integer)
    full_marks = Column(Integer)  # alias for total_marks
    is_practical = Column(Boolean, default=False)
    practical_marks = Column(Integer)

    status = Column(
        Enum(
            "draft",
            "scheduled",
            "ongoing",
            "completed",
            "result_published",
            name="exam_status",
        ),
        default="scheduled",
    )

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    klass = relationship("Class", backref="exams", foreign_keys=[class_id])
    academic_year = relationship("AcademicYear", backref="exams")


class Marks(SchoolModel):
    __tablename__ = "marks"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Marks split
    theory_marks = Column(Numeric(6, 2))
    practical_marks = Column(Numeric(6, 2))
    total_marks = Column(Numeric(6, 2))
    obtained_marks = Column(Numeric(6, 2))  # Legacy — use theory_marks + practical_marks

    # Full/pass marks (per-subject override)
    full_marks = Column(Numeric(6, 2))
    pass_marks = Column(Numeric(6, 2))

    # NEB grading (auto-calculated)
    grade = Column(String(5))
    gpa = Column(Numeric(3, 2))

    # Rankings
    rank_in_class = Column(Integer)
    rank_in_section = Column(Integer)

    # Status
    remarks = Column(Text)
    is_absent = Column(Boolean, default=False)
    is_withheld = Column(Boolean, default=False)

    exam = relationship("Exam", backref="marks")
    student = relationship("Student", backref="marks")
    subject = relationship("Subject", backref="marks")
    teacher = relationship("User", foreign_keys=[teacher_id])


class ReportCard(SchoolModel):
    __tablename__ = "report_cards"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False)
    generated_at = Column(DateTime)
    pdf_url = Column(Text)

    # AI-generated remarks
    ai_remarks = Column(Text)
    ai_remarks_nepali = Column(Text)

    # Overall results
    total_marks = Column(Numeric(8, 2))
    total_percentage = Column(Numeric(5, 2))
    percentage = Column(Numeric(5, 2))  # alias
    overall_grade = Column(String(5))
    overall_gpa = Column(Numeric(3, 2))
    rank_in_class = Column(Integer)
    rank = Column(Integer)  # alias

    # Extra
    attendance_percentage = Column(Numeric(5, 2))
    teacher_remarks = Column(Text)
    principal_remarks = Column(Text)
    parent_signature_required = Column(Boolean, default=False)
    signed_at = Column(DateTime)

    student = relationship("Student", backref="report_cards")
    exam = relationship("Exam", backref="report_cards")


class OnlineExam(SchoolModel):
    __tablename__ = "online_exams"

    title = Column(String(300), nullable=False)
    description = Column(Text)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    duration_minutes = Column(Integer, default=30)
    total_marks = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    questions = Column(JSONB, default=list)
    start_at = Column(DateTime)
    end_at = Column(DateTime)
    status = Column(String(20), default="upcoming")
    instructions = Column(Text)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    klass = relationship("Class")
    section = relationship("Section")
    subject = relationship("Subject")
    created_by = relationship("User")
    attempts = relationship("OnlineExamAttempt", back_populates="online_exam")


class OnlineExamAttempt(SchoolModel):
    __tablename__ = "online_exam_attempts"

    online_exam_id = Column(UUID(as_uuid=True), ForeignKey("online_exams.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    answers = Column(JSONB, default=dict)
    score = Column(Numeric(8, 2))
    status = Column(String(20), default="submitted")
    started_at = Column(DateTime)
    submitted_at = Column(DateTime)

    online_exam = relationship("OnlineExam", back_populates="attempts")
    student = relationship("Student")
