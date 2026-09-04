"""A-04: Curriculum grounding models.

CurriculumFramework → CurriculumUnit → LearningOutcome, plus
SubjectOffering (the NEB/SEE subject grid with THFM/THPM/PRFM/PRPM).
Framework rows with school_id NULL are platform-level (seeded CDC/NEB);
schools may add their own. AI prompts inject the relevant unit/outcome
subset; question papers become truly syllabus-aligned.
"""
from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, SchoolModel


class CurriculumFramework(BaseModel):
    """A board curriculum: platform-seeded (school_id NULL) or school-made."""

    __tablename__ = "curriculum_frameworks"

    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)
    board = Column(Enum("neb", "cdc", "cbse", "ib", "custom", name="curriculum_board"), nullable=False)
    grade = Column(String(20), nullable=False)          # "1".."12", "11-12", ...
    subject_code = Column(String(50), nullable=False)   # NEB subject code, e.g. "SCI.101"
    subject_name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)

    units = relationship("CurriculumUnit", backref="framework", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("board", "grade", "subject_code", "school_id",
                         name="uq_curriculum_framework_board_grade_subject"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id) if self.school_id else None,
            "board": self.board,
            "grade": self.grade,
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "is_active": bool(self.is_active),
        }


class CurriculumUnit(BaseModel):
    __tablename__ = "curriculum_units"

    framework_id = Column(UUID(as_uuid=True), ForeignKey("curriculum_frameworks.id"), nullable=False, index=True)
    unit_no = Column(Integer, nullable=False)
    title_en = Column(String(300), nullable=False)
    title_ne = Column(String(300))
    periods = Column(Integer, default=0)
    weight_pct = Column(Numeric(5, 2), default=0)   # exam weight for this unit

    outcomes = relationship("LearningOutcome", backref="unit", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("framework_id", "unit_no", name="uq_curriculum_unit_framework_no"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "unit_no": self.unit_no,
            "title_en": self.title_en,
            "title_ne": self.title_ne,
            "periods": self.periods or 0,
            "weight_pct": float(self.weight_pct or 0),
        }


class LearningOutcome(BaseModel):
    __tablename__ = "learning_outcomes"

    unit_id = Column(UUID(as_uuid=True), ForeignKey("curriculum_units.id"), nullable=False, index=True)
    code = Column(String(30), nullable=False)            # e.g. "SCI.101.U1.LO2"
    statement_en = Column(Text, nullable=False)
    statement_ne = Column(Text)
    bloom = Column(String(30))                           # remember/understand/apply/...

    __table_args__ = (
        UniqueConstraint("unit_id", "code", name="uq_learning_outcome_unit_code"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "code": self.code,
            "statement_en": self.statement_en,
            "statement_ne": self.statement_ne,
            "bloom": self.bloom,
        }


class SubjectOffering(BaseModel):
    """NEB/SEE subject grid per grade: theory/practical full & pass marks."""

    __tablename__ = "subject_offerings"

    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)
    subject_code = Column(String(50), nullable=False, index=True)
    subject_name = Column(String(200), nullable=False)
    grade = Column(String(20), nullable=False)
    theory_full = Column(Integer, default=75)
    theory_pass = Column(Integer, default=24)
    practical_full = Column(Integer, default=25)
    practical_pass = Column(Integer, default=10)
    has_practical = Column(Boolean, default=False)
    credit_hours = Column(Numeric(4, 1))

    __table_args__ = (
        UniqueConstraint("subject_code", "grade", "school_id",
                         name="uq_subject_offering_code_grade"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "grade": self.grade,
            "theory_full": self.theory_full,
            "theory_pass": self.theory_pass,
            "practical_full": self.practical_full,
            "practical_pass": self.practical_pass,
            "has_practical": bool(self.has_practical),
            "credit_hours": float(self.credit_hours) if self.credit_hours is not None else None,
        }
