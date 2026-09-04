"""D-06: normalized replacements for the money/relationship JSONBs.

- ClassSubject: the (school, year, class, subject) junction replacing
  Subject.class_ids/teacher_ids ARRAY denormalization — one row per
  subject-per-class with credit hours and NEB marks split.
- SectionSubjectTeacher: which teacher teaches which class-subject in a
  section (replaces ad-hoc teacher arrays).
- FeeStructureItem: structured fee heads replacing
  fee_structures.fee_items JSONB — each head has its own amount, frequency
  and BS due-day, enabling per-head receipts and the fee-cap directive.
"""
from sqlalchemy import (
    Boolean, Column, Enum, ForeignKey, Integer, Numeric, String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class ClassSubject(SchoolModel):
    __tablename__ = "class_subjects"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False, index=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), index=True)
    subject_type = Column(
        Enum("core", "optional", "practical", name="class_subject_type"), default="core"
    )
    credit_hours = Column(Numeric(4, 1))
    theory_full = Column(Integer)
    theory_pass = Column(Integer)
    practical_full = Column(Integer)
    practical_pass = Column(Integer)
    is_active = Column(Boolean, default=True)

    klass = relationship("Class", foreign_keys=[class_id])
    subject = relationship("Subject", foreign_keys=[subject_id])

    __table_args__ = (
        UniqueConstraint(
            "school_id", "class_id", "subject_id", "academic_year_id",
            name="uq_class_subject",
        ),
    )


class SectionSubjectTeacher(SchoolModel):
    __tablename__ = "section_subject_teachers"

    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False, index=True)
    class_subject_id = Column(
        UUID(as_uuid=True), ForeignKey("class_subjects.id"), nullable=False, index=True
    )
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    is_primary = Column(Boolean, default=True)

    section = relationship("Section", foreign_keys=[section_id])
    class_subject = relationship("ClassSubject", foreign_keys=[class_subject_id])
    teacher = relationship("User", foreign_keys=[teacher_id])

    __table_args__ = (
        UniqueConstraint(
            "school_id", "section_id", "class_subject_id", "teacher_id",
            name="uq_section_subject_teacher",
        ),
    )


class FeeStructureItem(SchoolModel):
    """One fee head inside a FeeStructure (replaces fee_items JSONB)."""

    __tablename__ = "fee_structure_items"

    fee_structure_id = Column(
        UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False, index=True
    )
    fee_type_id = Column(UUID(as_uuid=True), ForeignKey("fee_types.id"), index=True)
    name = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(
        Enum("one_time", "monthly", "quarterly", "semi_annual", "annual",
             name="fee_item_frequency"),
        default="monthly",
    )
    due_day_bs = Column(Integer)          # BS day-of-month for monthly heads
    is_mandatory = Column(Boolean, default=True)
    # N-04 fee-cap directive (2072) heading classification for reporting
    cap_heading = Column(String(100))
    sort_order = Column(Integer, default=0)

    fee_structure = relationship("FeeStructure", backref="items_normalized")
    fee_type = relationship("FeeType")

    __table_args__ = (
        UniqueConstraint(
            "school_id", "fee_structure_id", "name",
            name="uq_fee_structure_item_name",
        ),
    )
