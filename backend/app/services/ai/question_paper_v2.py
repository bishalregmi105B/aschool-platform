"""Question Paper Generator v2 (A-03) — bank-first, then generate.

Pipeline per blueprint section:
  1. Try the school's own QuestionBankItem pool (approved, matching
     subject/type/difficulty/topic) — deterministic, free, curriculum-true.
  2. Fill any shortfall with ONE AITokenHub call per section (structured
     output via parse_and_validate), temperature 0.2, Nepali-aware, and
     seed the bank with the generated items (source="ai", unapproved).
Output is PERSISTED as GeneratedPaper; the answer key is rendered
separately (include_answers=False by default everywhere client-facing).
"""
import logging

from flask import current_app

from app.models.question_bank import GeneratedPaper, PaperBlueprint, QuestionBankItem
from app.utils.llm_output import parse_and_validate

logger = logging.getLogger(__name__)

_BANK_PER_TYPE_ORDER = {
    "mcq": ["mcq"],
    "short_answer": ["short_answer", "fill_blank"],
    "long_answer": ["long_answer"],
    "true_false": ["true_false"],
    "fill_blank": ["fill_blank"],
    "match": ["match"],
    "numerical": ["numerical"],
}

_TYPE_LABELS = {
    "mcq": "multiple-choice (exactly 4 options keyed a-d, one correct)",
    "short_answer": "short answer (2-3 sentences expected)",
    "long_answer": "long/essay answer (structured, with key points in the answer key)",
    "true_false": "true/false",
    "fill_blank": "fill in the blank using ______ for the blank",
    "match": "match the following (provide two columns A and B)",
    "numerical": "numerical problem with worked solution",
}


class QuestionPaperServiceV2:
    """Bank-first paper assembly. The v1 single-shot path is kept for
    ad-hoc (no-blueprint) generation only."""

    @staticmethod
    def generate_from_blueprint(
        blueprint: PaperBlueprint,
        school_id,
        user_id=None,
        title: str | None = None,
    ) -> GeneratedPaper:
        db = _session()
        questions: list[dict] = []
        used_bank_ids: list = []

        for section in blueprint.sections or []:
            qtype = section.get("question_type", "short_answer")
            count = int(section.get("count", 0))
            marks_each = float(section.get("marks_each", 1))
            difficulty = section.get("difficulty")
            topic = section.get("topic")

            bank_items = QuestionBankService.sample_for_section(
                school_id=school_id,
                subject_id=blueprint.subject_id,
                question_type=qtype,
                count=count,
                difficulty=difficulty,
                topic=topic,
                exclude_ids=used_bank_ids,
            )
            taken = list(bank_items)
            used_bank_ids.extend(str(item.id) for item in taken)

            for item in taken:
                questions.append(
                    _bank_item_to_question(item, section.get("name", "Section"), marks_each)
                )

            shortfall = count - len(taken)
            if shortfall > 0:
                generated = QuestionPaperServiceV2._generate_section(
                    school_id=school_id,
                    user_id=user_id,
                    subject_name=_subject_name(blueprint.subject_id),
                    grade=_class_name(blueprint.class_id),
                    qtype=qtype,
                    count=shortfall,
                    marks_each=marks_each,
                    difficulty=difficulty or "medium",
                    topic=topic,
                    language=blueprint.language or "en",
                    section_name=section.get("name", "Section"),
                )
                questions.extend(generated)

        total_marks = round(sum(float(q["marks"]) for q in questions), 2)

        paper = GeneratedPaper(
            school_id=school_id,
            blueprint_id=blueprint.id,
            subject_id=blueprint.subject_id,
            class_id=blueprint.class_id,
            created_by_id=user_id,
            title=title or f"{blueprint.name} — generated",
            duration_minutes=blueprint.duration_minutes or 180,
            total_marks=total_marks,
            language=blueprint.language or "en",
            questions=questions,
        )
        db.add(paper)

        # usage analytics: every drawn bank item counts
        if used_bank_ids:
            db.query(QuestionBankItem).filter(
                QuestionBankItem.id.in_(used_bank_ids)
            ).update(
                {QuestionBankItem.times_used: QuestionBankItem.times_used + 1},
                synchronize_session=False,
            )
        db.commit()
        db.refresh(paper)
        return paper

    @staticmethod
    def _generate_section(
        school_id,
        user_id,
        subject_name: str,
        grade: str,
        qtype: str,
        count: int,
        marks_each: float,
        difficulty: str,
        topic: str | None,
        language: str,
        section_name: str,
    ) -> list[dict]:
        """One AITokenHub call for the section's shortfall; seeds the bank."""
        from app.services.ai.token_hub import AITokenHub

        nepali_note = (
            "Write question_text_nepali as a faithful Nepali translation of question_text."
            if language == "ne"
            else "question_text_nepali may be null."
        )
        prompt = (
            f"You are an experienced NEB (Nepal) school exam setter for {subject_name}.\n"
            f"Write exactly {count} {difficulty} {_TYPE_LABELS.get(qtype, qtype)} questions"
            + (f" on the topic '{topic}'" if topic else "")
            + f". Each carries {marks_each:g} marks.\n"
            "Return ONLY a JSON object: {\"questions\": [{\"question_text\": str, "
            "\"question_text_nepali\": str|null, \"correct_answer\": str, \"options\": "
            "[{\"key\": \"a\", \"text\": str}] | [], \"topic\": str}]}\n"
            f"{nepali_note}"
        )

        result = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="question-paper:v2-section",
            messages=[
                {"role": "system", "content": "You output valid JSON only. No prose."},
                {"role": "user", "content": prompt},
            ],
            model="smart",
            max_tokens=250 * max(count, 1) + 400,
            temperature=0.2,  # A-02: grading/structured content must be stable
        )
        parsed = parse_and_validate(
            result["text"], required=["questions"]
        )
        items = parsed.get("questions", [])[:count]

        db = _session()
        out: list[dict] = []
        for item in items:
            bank_item = QuestionBankItem(
                school_id=school_id,
                subject_id=_subject_id_or_none(school_id, subject_name),
                created_by_id=user_id,
                question_text=item.get("question_text", "").strip(),
                question_text_nepali=item.get("question_text_nepali"),
                question_type=qtype,
                difficulty=difficulty,
                marks=marks_each,
                topic=item.get("topic") or topic,
                options=item.get("options") or [],
                correct_answer=str(item.get("correct_answer") or ""),
                source="ai",
                ai_metadata={
                    "model": result.get("model"),
                    "provider": result.get("provider"),
                    "prompt_sha256": (result.get("metadata") or {}).get("prompt_sha256"),
                    "cost_usd": result.get("cost_usd"),
                },
                is_approved=False,
            )
            db.add(bank_item)
            db.flush()
            out.append(
                {
                    "section": section_name,
                    "question_type": qtype,
                    "question_text": bank_item.question_text,
                    "question_text_nepali": bank_item.question_text_nepali,
                    "marks": marks_each,
                    "options": bank_item.options or [],
                    "bank_item_id": str(bank_item.id),
                    "source": "ai",
                    "correct_answer": bank_item.correct_answer,
                    "explanation": None,
                }
            )
        db.commit()
        return out


class QuestionBankService:
    """CRUD + sampling over the school's question pool."""

    @staticmethod
    def sample_for_section(
        school_id,
        subject_id,
        question_type: str,
        count: int,
        difficulty: str | None = None,
        topic: str | None = None,
        exclude_ids: list[str] | None = None,
    ) -> list[QuestionBankItem]:
        import random

        query = QuestionBankItem.query.filter(
            QuestionBankItem.school_id == school_id,
            QuestionBankItem.subject_id == subject_id,
            QuestionBankItem.is_deleted.is_(False),
            QuestionBankItem.question_type == question_type,
            QuestionBankItem.is_approved.is_(True),
        )
        if difficulty:
            query = query.filter(QuestionBankItem.difficulty == difficulty)
        if topic:
            query = query.filter(QuestionBankItem.topic.ilike(f"%{topic}%"))
        if exclude_ids:
            query = query.filter(~QuestionBankItem.id.in_(exclude_ids))
        items = query.all()
        random.shuffle(items)
        return items[:count]


# ── helpers ──────────────────────────────────────────────────────────────

def _session():
    from extensions import db

    return db.session


def _subject_name(subject_id) -> str:
    from app.models.academic import Subject

    subject = Subject.query.get(subject_id)
    return subject.name if subject else "the subject"


def _class_name(class_id) -> str:
    from app.models.academic import Class

    klass = Class.query.get(class_id) if class_id else None
    return klass.name if klass else "the class"


def _subject_id_or_none(school_id, subject_name: str):
    from app.models.academic import Subject

    subject = (
        Subject.query.filter_by(school_id=school_id, name=subject_name, is_deleted=False)
        .first()
    )
    return subject.id if subject else None


def _bank_item_to_question(item: QuestionBankItem, section_name: str, marks_each: float) -> dict:
    # The section's marks_each is the exam contract; the item's stored marks
    # are advisory (the bank may pool items across blueprints).
    return {
        "section": section_name,
        "question_type": item.question_type,
        "question_text": item.question_text,
        "question_text_nepali": item.question_text_nepali,
        "marks": float(marks_each),
        "options": item.options or [],
        "bank_item_id": str(item.id),
        "source": "bank",
        "correct_answer": item.correct_answer,
        "explanation": item.explanation,
    }
