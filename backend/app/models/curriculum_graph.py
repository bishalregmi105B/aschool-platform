"""Pedagogical Knowledge Graph (PKG) models for CDC and international curricula.

Models concepts as directed acyclic graphs (DAG) with prerequisite edges,
Bloom's taxonomy levels, and diagnostic misconception interceptors.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class CurriculumConcept(BaseModel):
    """Core pedagogical concept node in the curriculum knowledge graph."""

    __tablename__ = "curriculum_concepts"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )
    code = Column(
        String(64), unique=True, nullable=False, index=True
    )  # e.g. "CDC-G10-MATH-ALG-04"
    grade = Column(Integer, nullable=False, index=True)
    subject_code = Column(String(32), nullable=False, index=True)
    name_np = Column(String(255), nullable=False)
    name_en = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    bloom_level = Column(
        String(32), nullable=False, default="understanding"
    )  # remembering, understanding, applying, analyzing, evaluating, creating

    # Relationships
    prerequisites = relationship(
        "ConceptPrerequisite",
        foreign_keys="ConceptPrerequisite.concept_id",
        backref="concept",
        cascade="all, delete-orphan",
    )
    dependents = relationship(
        "ConceptPrerequisite",
        foreign_keys="ConceptPrerequisite.prerequisite_concept_id",
        backref="prerequisite",
        cascade="all, delete-orphan",
    )
    misconceptions = relationship(
        "ConceptMisconception", backref="concept", cascade="all, delete-orphan"
    )


class ConceptPrerequisite(BaseModel):
    """Directed pedagogical dependency edge between two concepts."""

    __tablename__ = "concept_prerequisites"

    concept_id = Column(
        UUID(as_uuid=True),
        ForeignKey("curriculum_concepts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prerequisite_concept_id = Column(
        UUID(as_uuid=True),
        ForeignKey("curriculum_concepts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dependency_weight = Column(
        Numeric(3, 2), default=1.00, nullable=False
    )  # 1.0 = strict blocker, 0.5 = recommended prior knowledge
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "concept_id", "prerequisite_concept_id", name="uq_concept_dependency"
        ),
        CheckConstraint(
            "concept_id != prerequisite_concept_id", name="chk_prevent_self_dependency"
        ),
    )


class ConceptMisconception(BaseModel):
    """Common student cognitive traps, erroneous mental models, and diagnostic distractors."""

    __tablename__ = "concept_misconceptions"

    concept_id = Column(
        UUID(as_uuid=True),
        ForeignKey("curriculum_concepts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    misconception_label_np = Column(String(255), nullable=False)
    misconception_label_en = Column(String(255), nullable=False)
    remedial_strategy = Column(Text, nullable=False)
    distractor_patterns = Column(
        JSONB, default=dict, nullable=False
    )  # e.g. {"error_type": "sign_error", "trigger_rule": "-b +/- sqrt..."}
