"""Question Bank + Paper models (A-03).

QuestionBankItem  — the school's curated+AI-grown question pool
PaperBlueprint    — reusable exam recipe (sections, type distribution, marks)
GeneratedPaper    — one assembled paper instance (questions + answer key)
"""
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class QuestionBankItem(SchoolModel):
    __tablename__ = "question_bank_items"

    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), index=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    question_text = Column(Text, nullable=False)
    question_text_nepali = Column(Text)
    question_type = Column(
        Enum(
            "mcq", "short_answer", "long_answer", "true_false",
            "fill_blank", "match", "numerical",
            name="question_bank_type",
        ),
        nullable=False,
    )
    difficulty = Column(Enum("easy", "medium", "hard", name="question_difficulty"), default="medium")
    marks = Column(Numeric(5, 2), default=1)
    topic = Column(String(200))
    bloom_level = Column(String(50))  # knowledge/understanding/application/...

    # Multimodal and composite question extensions
    is_composite = Column(Boolean, default=False, nullable=False)
    stimulus_en = Column(Text, nullable=True)
    stimulus_ne = Column(Text, nullable=True)
    solution_latex = Column(Text, nullable=True)
    estimated_minutes = Column(Integer, default=5, nullable=True)
    common_misconceptions = Column(JSONB, default=list, nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("textbook_assets.id"), nullable=True)
    textbook_section_id = Column(UUID(as_uuid=True), ForeignKey("textbook_sections.id"), nullable=True)
    source_page_no = Column(Integer, nullable=True)
    jaccard_content_hash = Column(String(64), nullable=True, index=True)

    options = Column(JSONB, default=list)      # mcq: [{key:"a", text:"..."}]
    correct_answer = Column(Text)
    explanation = Column(Text)

    source = Column(Enum("manual", "ai", name="question_source"), default="manual")
    ai_metadata = Column(JSONB)                # model, prompt_sha, generated_at

    times_used = Column(Integer, default=0)
    is_approved = Column(Boolean, default=False)  # teacher approval for AI items

    subject = relationship("Subject")
    subparts = relationship(
        "QuestionSubpart",
        backref="parent_question",
        cascade="all, delete-orphan",
        order_by="QuestionSubpart.part_order",
    )
    rubric_steps = relationship(
        "QuestionRubricStep",
        backref="question",
        cascade="all, delete-orphan",
        order_by="QuestionRubricStep.step_no",
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "subject_id": str(self.subject_id),
            "class_id": str(self.class_id) if self.class_id else None,
            "question_text": self.question_text,
            "question_text_nepali": self.question_text_nepali,
            "question_type": self.question_type,
            "is_composite": bool(self.is_composite),
            "stimulus_en": self.stimulus_en,
            "stimulus_ne": self.stimulus_ne,
            "difficulty": self.difficulty,
            "marks": float(self.marks or 0),
            "topic": self.topic,
            "bloom_level": self.bloom_level,
            "estimated_minutes": self.estimated_minutes,
            "solution_latex": self.solution_latex,
            "options": self.options or [],
            "correct_answer": self.correct_answer,
            "explanation": self.explanation,
            "asset_id": str(self.asset_id) if self.asset_id else None,
            "source_page_no": self.source_page_no,
            "source": self.source,
            "times_used": self.times_used or 0,
            "is_approved": bool(self.is_approved),
            "subparts": [sp.to_dict() for sp in (self.subparts or [])],
            "rubric_steps": [rs.to_dict() for rs in (self.rubric_steps or [])],
        }


class PaperBlueprint(SchoolModel):
    """Reusable exam recipe: sections × (question_type, count, marks_each)."""

    __tablename__ = "paper_blueprints"

    name = Column(String(200), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    total_marks = Column(Numeric(6, 2), nullable=False)
    duration_minutes = Column(Integer, default=180)
    # [{name:"Section A", question_type:"mcq", count:10, marks_each:1,
    #   difficulty:"easy"}, ...]
    sections = Column(JSONB, nullable=False, default=list)
    language = Column(String(10), default="en")

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "subject_id": str(self.subject_id),
            "class_id": str(self.class_id) if self.class_id else None,
            "total_marks": float(self.total_marks or 0),
            "duration_minutes": self.duration_minutes,
            "sections": self.sections or [],
            "language": self.language,
        }


class GeneratedPaper(SchoolModel):
    """One assembled paper — questions carry bank-item refs so usage
    analytics work; answer_key is rendered separately for teachers."""

    __tablename__ = "generated_papers"

    blueprint_id = Column(UUID(as_uuid=True), ForeignKey("paper_blueprints.id"), index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    title = Column(String(300), nullable=False)
    grade = Column(String(100))
    duration_minutes = Column(Integer, default=180)
    total_marks = Column(Numeric(6, 2), default=0)
    instructions = Column(Text)

    # [{section, question_type, question_text, marks, options, bank_item_id,
    #   source, correct_answer, explanation}]
    questions = Column(JSONB, nullable=False, default=list)

    language = Column(String(10), default="en")

    def to_dict(self, include_answers: bool = False):
        questions = []
        for q in self.questions or []:
            entry = {k: v for k, v in q.items() if k != "correct_answer"}
            if include_answers:
                entry["correct_answer"] = q.get("correct_answer")
                entry["explanation"] = q.get("explanation")
            questions.append(entry)
        return {
            "id": str(self.id),
            "title": self.title,
            "grade": self.grade,
            "duration_minutes": self.duration_minutes,
            "total_marks": float(self.total_marks or 0),
            "instructions": self.instructions,
            "language": self.language,
            "questions": questions,
        }


class QuestionSubpart(SchoolModel):
    """Sub-questions inside a composite root question (e.g., Q1. a, b, c)."""

    __tablename__ = "question_subparts"

    parent_question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("question_bank_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    part_order = Column(Integer, nullable=False)  # 1, 2, 3...
    part_label = Column(String(10), nullable=False)  # "(क)", "(ख)" or "(a)", "(b)"

    prompt_en = Column(Text, nullable=False)
    prompt_ne = Column(Text, nullable=True)
    marks = Column(Numeric(4, 2), nullable=False, default=1.0)
    bloom_level = Column(String(30), default="understanding", nullable=False)
    correct_answer_en = Column(Text, nullable=True)
    correct_answer_ne = Column(Text, nullable=True)
    solution_steps = Column(JSONB, default=list, nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("textbook_assets.id"), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "parent_question_id": str(self.parent_question_id),
            "part_order": self.part_order,
            "part_label": self.part_label,
            "prompt_en": self.prompt_en,
            "prompt_ne": self.prompt_ne,
            "marks": float(self.marks or 0),
            "bloom_level": self.bloom_level,
            "correct_answer_en": self.correct_answer_en,
            "correct_answer_ne": self.correct_answer_ne,
            "solution_steps": self.solution_steps or [],
            "asset_id": str(self.asset_id) if self.asset_id else None,
        }


class QuestionRubricStep(SchoolModel):
    """Step-by-step grading criteria for automated and teacher marking."""

    __tablename__ = "question_rubric_steps"

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("question_bank_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subpart_id = Column(
        UUID(as_uuid=True),
        ForeignKey("question_subparts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    step_no = Column(Integer, nullable=False)
    criterion_en = Column(String(300), nullable=False)  # e.g., "Correct formula stated"
    criterion_ne = Column(String(300), nullable=True)
    allocated_marks = Column(Numeric(4, 2), nullable=False)  # e.g., 0.5 or 1.0

    def to_dict(self):
        return {
            "id": str(self.id),
            "question_id": str(self.question_id),
            "subpart_id": str(self.subpart_id) if self.subpart_id else None,
            "step_no": self.step_no,
            "criterion_en": self.criterion_en,
            "criterion_ne": self.criterion_ne,
            "allocated_marks": float(self.allocated_marks or 0),
        }

