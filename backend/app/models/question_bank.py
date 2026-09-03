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

    options = Column(JSONB, default=list)      # mcq: [{key:"a", text:"..."}]
    correct_answer = Column(Text)
    explanation = Column(Text)

    source = Column(Enum("manual", "ai", name="question_source"), default="manual")
    ai_metadata = Column(JSONB)                # model, prompt_sha, generated_at

    times_used = Column(Integer, default=0)
    is_approved = Column(Boolean, default=False)  # teacher approval for AI items

    subject = relationship("Subject")

    def to_dict(self):
        return {
            "id": str(self.id),
            "subject_id": str(self.subject_id),
            "class_id": str(self.class_id) if self.class_id else None,
            "question_text": self.question_text,
            "question_text_nepali": self.question_text_nepali,
            "question_type": self.question_type,
            "difficulty": self.difficulty,
            "marks": float(self.marks or 0),
            "topic": self.topic,
            "bloom_level": self.bloom_level,
            "options": self.options or [],
            "correct_answer": self.correct_answer,
            "explanation": self.explanation,
            "source": self.source,
            "times_used": self.times_used or 0,
            "is_approved": bool(self.is_approved),
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
