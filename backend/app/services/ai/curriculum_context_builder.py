"""Curriculum Multimodal Context Builder Service.

Constructs high-fidelity, multimodal context payloads for:
1. Socratic AI Tutor: Scaffolded hint ladders, misconception interceptors, textbook page grounding.
2. ARIA Live Teacher: Whiteboard SVG paths, spoken math pronunciations for TTS, blackboard cues.
3. Exam Question Paper Generator: CDC/NEB Specification Grid compliance, cognitive balance matrix.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from app.models.curriculum import CurriculumUnit, LearningOutcome
from app.models.curriculum_graph import ConceptMisconception, CurriculumConcept
from app.models.question_bank import PaperBlueprint, QuestionBankItem
from app.models.teaching_content import (
    TeachingExamTip,
    TeachingFormula,
    TeachingKeyTerm,
    TeachingMisconception,
    TeachingNote,
    TeachingSection,
    TeachingSectionVersion,
)
from app.models.textbook import (
    TextbookAsset,
    TextbookChapter,
    TextbookCorpus,
    TextbookPage,
    TextbookSection,
)


def _school_scoped(query, school_id: Optional[UUID]):
    """A19 tenancy guard: this builder is dormant (no route wiring yet), but
    every query takes a school filter so it can never become a cross-tenant
    read primitive when wired. Platform rows (school_id NULL) stay visible."""
    if school_id is None:
        return query
    return query.filter(
        query.column_descriptions[0]["entity"].school_id.in_([school_id, None])
    )


class CurriculumContextBuilder:
    """Service to compile and serialize pedagogical contexts for AI engines."""

    @staticmethod
    def build_socratic_tutor_context(
        section_version_id: UUID,
        language: str = "ne",
        question_id: Optional[UUID] = None,
        school_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Build grounded Socratic tutoring context with hint ladders and misconceptions."""
        version = _school_scoped(
            TeachingSectionVersion.query.filter_by(id=section_version_id), school_id
        ).first()
        if not version:
            return {"error": "Section version not found"}

        section = version.section
        unit = section.unit if section else None

        # 1. Grounding in physical textbook
        tb_section = (
            TextbookSection.query.filter_by(teaching_section_id=section.id).first()
            if section
            else None
        )
        tb_chapter = tb_section.chapter if tb_section else None
        textbook = tb_chapter.textbook if tb_chapter else None

        grounding = {
            "book_title": (
                textbook.title_ne if language == "ne" else textbook.title_en
            )
            if textbook
            else (section.title_ne if section else "Curriculum Section"),
            "grade": textbook.grade if textbook else (unit.framework.grade if unit and unit.framework else "10"),
            "chapter": tb_chapter.title_ne if tb_chapter else (unit.title_ne if unit else ""),
            "section": tb_section.title_ne if tb_section else (section.title_ne if section else ""),
            "pages": list(range(tb_section.page_start, tb_section.page_end + 1))
            if tb_section
            else [],
            "source_pdf": textbook.source_pdf_path if textbook else None,
        }

        # 2. Key Formulas & Pronunciation
        formulas = [
            {
                "name": f.name_en or f.latex,
                "latex": f.latex,
                "spoken": f.spoken_ne if language == "ne" else f.spoken_en,
            }
            for f in version.formulas
        ]

        # 3. Misconceptions to intercept
        misconceptions = [
            {
                "wrong_belief": m.wrong_belief_ne if language == "ne" else m.wrong_belief_en,
                "why_students_think": m.why_students_think_ne
                if language == "ne"
                else m.why_students_think_en,
                "diagnostic_question": m.diagnostic_question_ne
                if language == "ne"
                else m.diagnostic_question_en,
                "correction": m.correction_ne if language == "ne" else m.correction_en,
            }
            for m in version.misconceptions
        ]

        # 4. Multimodal figures / assets
        assets = []
        if tb_section:
            page_assets = (
                TextbookAsset.query.join(TextbookPage)
                .filter(
                    TextbookAsset.textbook_id == textbook.id,
                    TextbookPage.page_number >= tb_section.page_start,
                    TextbookPage.page_number <= tb_section.page_end,
                )
                .all()
            )
            for a in page_assets:
                assets.append({
                    "asset_id": str(a.id),
                    "caption": a.caption_ne if language == "ne" else a.caption_en,
                    "image_url": a.image_storage_path,
                    "svg_inline": a.svg_vector_path,
                    "vision_description": a.vision_description,
                })

        # 5. Question & scaffolded hint ladders if a question is active
        question_data = None
        if question_id:
            qb = _school_scoped(
                QuestionBankItem.query.filter_by(id=question_id), school_id
            ).first()
            if qb:
                question_data = {
                    "id": str(qb.id),
                    "question_text": qb.question_text_nepali
                    if language == "ne"
                    else qb.question_text,
                    "marks": float(qb.marks or 1),
                    "bloom_level": qb.bloom_level,
                    "solution_latex": qb.solution_latex,
                    "subparts": [
                        {
                            "part_label": sp.part_label,
                            "prompt": sp.prompt_ne if language == "ne" else sp.prompt_en,
                            "marks": float(sp.marks),
                            "solution_steps": sp.solution_steps,
                        }
                        for sp in qb.subparts
                    ],
                }

        return {
            "$schema": "https://aschool.edu.np/schemas/context/socratic_tutor_v2.json",
            "language": language,
            "textbook_grounding": grounding,
            "formulas": formulas,
            "misconceptions": misconceptions,
            "figures": assets,
            "active_question": question_data,
        }

    @staticmethod
    def build_aria_live_context(
        section_version_id: UUID,
        language_mode: str = "mixed",
        school_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Build real-time ARIA live whiteboard presentation context with SVG and spoken math."""
        version = _school_scoped(
            TeachingSectionVersion.query.filter_by(id=section_version_id), school_id
        ).first()
        if not version:
            return {"error": "Section version not found"}

        section = version.section
        unit = section.unit if section else None

        # Whiteboard visual actions from notes and assets
        whiteboard_actions = []
        for n in version.notes:
            if n.board_hint or n.block_type in ("diagram", "derivation", "worked_example"):
                whiteboard_actions.append({
                    "block_no": n.block_no,
                    "heading": n.heading_ne if language_mode == "ne" else n.heading_en,
                    "board_hint": n.board_hint,
                    "spoken_narration": n.speaker_note_ne
                    if language_mode == "ne"
                    else n.speaker_note_en,
                })

        # Spoken math dictionary
        spoken_math = {}
        for f in version.formulas:
            spoken_math[f.latex] = (
                f.spoken_ne if language_mode == "ne" else f.spoken_en or f.latex
            )

        # Blackboard bullet summary
        bullet_points = [
            n.heading_ne if language_mode == "ne" else n.heading_en
            for n in version.notes
            if n.heading_en or n.heading_ne
        ]

        return {
            "$schema": "https://aschool.edu.np/schemas/context/aria_live_v2.json",
            "session": {
                "topic": section.title_ne if language_mode == "ne" else section.title_en,
                "grade": unit.framework.grade if unit and unit.framework else "10",
                "language_mode": language_mode,
            },
            "whiteboard_actions": whiteboard_actions,
            "spoken_math_dictionary": spoken_math,
            "blackboard_bullet_points": bullet_points,
        }

    @staticmethod
    def build_exam_paper_context(
        blueprint_id: UUID, school_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Build exam generation context grounded in official CDC Specification Grids."""
        bp = _school_scoped(
            PaperBlueprint.query.filter_by(id=blueprint_id), school_id
        ).first()
        if not bp:
            return {"error": "Blueprint not found"}

        return {
            "$schema": "https://aschool.edu.np/schemas/context/exam_generator_v2.json",
            "exam_metadata": {
                "title": bp.name,
                "full_marks": float(bp.total_marks),
                "duration_minutes": bp.duration_minutes,
                "language": bp.language,
            },
            "grid_constraints": bp.sections,
        }
