"""Exam, Marks, and ReportCard models."""
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
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
    # D-05 expand: denormalized year anchor from the exam (contract phase NOT NULL)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))

    __table_args__ = (
        # D-02: duplicate marks rows double every aggregate (GPA, rank,
        # ledger). Mirrors the migration index for create_all-built schemas.
        Index(
            "uq_marks_exam_student_subject",
            "school_id", "exam_id", "student_id", "subject_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    # Marks split
    theory_marks = Column(Numeric(6, 2))
    practical_marks = Column(Numeric(6, 2))
    total_marks = Column(Numeric(6, 2))
    obtained_marks = Column(Numeric(6, 2))  # Legacy — use theory_marks + practical_marks
    # A-32: component scores keyed by MarkComponent id
    # ({"<component_uuid>": 12.5, ...}) — the N-component mark distribution
    # (CQ/MCQ/practical/oral) Nepali schools mark against; obtained is the
    # sum when present, else theory+practical.
    components = Column(JSONB, default=dict)

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
    # D-05 expand: year anchor from the exam (contract phase NOT NULL)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
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

    __table_args__ = (
        # A-05: ONE attempt row per (school, exam, student). Duplicate-submit
        # and retake policy are API decisions enforced against this
        # constraint — the old schema let a client create unlimited rows
        # (each resubmit rescored and re-ranked the exam).
        Index(
            "uq_online_exam_attempts_one_per_student",
            "school_id", "online_exam_id", "student_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


# ── S-A2 (A-32): mark components + per-school grade scales ───────────────

class MarkComponent(SchoolModel):
    """One component of a subject's mark distribution for an exam
    (e.g. CQ 50 / MCQ 25 / practical 25) — InfixEdu's sm_exam_setups idea:
    the marks grid renders one column per component and the component totals
    must not exceed the subject's full marks.

    Validation lives in the API: Σ component max_marks ≤ subject full marks,
    names unique per (exam, subject)."""

    __tablename__ = "mark_components"
    __table_args__ = (
        Index(
            "uq_mark_components_exam_subject_name",
            "school_id", "exam_id", "subject_id", "name",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    max_mark = Column(Numeric(6, 2), nullable=False)
    pass_mark = Column(Numeric(6, 2))
    seq = Column(Integer, default=0)

    exam = relationship("Exam")
    subject = relationship("Subject")


class GradeScale(SchoolModel):
    """A per-school grading scale (A-32): rows of (grade_name, gpa,
    percent_from, percent_upto, description). The school's `is_default`
    scale replaces the hard-coded NEB table in grade calculation — SEE and
    NEB presets are seeded, schools can adjust boundaries without code.

    NEB reference (nepal_grading.NEB_GRADES): A+ 90-100 4.0 … NG <35 0.0."""

    __tablename__ = "grade_scales"

    name = Column(String(120), nullable=False)
    board = Column(String(20))  # neb|see|custom
    is_default = Column(Boolean, default=False, index=True)
    rows = Column(JSONB, default=list)  # [{grade_name, gpa, percent_from, percent_upto, description}]

    __table_args__ = (
        Index(
            "uq_grade_scales_school_name",
            "school_id", "name",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )
