"""Admin-entered teaching content (no OCR): sections → versions → blocks.

Extends the EXISTING curriculum chain (`app/models/curriculum.py`:
frameworks → units → outcomes) with the layer that was missing: what to
actually teach — versioned, bilingual, publishable, and overridable per
school. Nothing here duplicates curriculum.py or lms.py.

Structural invariants (see audits/research/_digest/D1 §B):
- The VERSION, not the section, owns the content. Blocks FK the version, so
  editing a draft can never mutate what is live, and a lesson can cite an
  immutable version id forever. Published versions are append-only;
  "editing" clones to version_no + 1 as a draft.
- Exactly ONE published version per section (partial unique index
  `uq_tsv_one_published`) — the read API's COALESCE depends on it.
- Overrides are ROWS, not JSON patches: a school section carries
  `overrides_section_id` pointing at the platform section it replaces.
- Media is a REFERENCE only (managed_files / external URL / inline SVG).
  It is never parsed for meaning — there is no OCR path by design; all
  class/subject content is typed in by platform/school admins.
"""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class TeachingSection(BaseModel):
    """Stable identity of a teachable slice of a curriculum unit (a chapter)."""

    __tablename__ = "teaching_sections"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )  # NULL = platform-seeded
    unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("curriculum_units.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    overrides_section_id = Column(
        UUID(as_uuid=True), ForeignKey("teaching_sections.id"), nullable=True
    )
    lms_topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=True)
    section_no = Column(Integer, nullable=False)
    code = Column(String(60), nullable=False)  # "SCI.G10.U2.S3" — stable, quotable
    kind = Column(String(24), nullable=False, default="concept")
    title_en = Column(String(300), nullable=False)
    title_ne = Column(String(300))
    summary_en = Column(Text)
    summary_ne = Column(Text)
    estimated_minutes = Column(Integer, nullable=False, default=12)
    difficulty = Column(String(16), nullable=False, default="core")
    prerequisite_section_ids = Column(JSONB, nullable=False, default=list)
    tags = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    unit = relationship("CurriculumUnit", backref="teaching_sections")
    versions = relationship(
        "TeachingSectionVersion",
        backref="section",
        cascade="all, delete-orphan",
        order_by="TeachingSectionVersion.version_no",
    )

    __table_args__ = (
        CheckConstraint(
            "kind IN ('concept','derivation','procedure','experiment','reading','revision')",
            name="ck_teaching_sections_kind",
        ),
        CheckConstraint(
            "difficulty IN ('foundation','core','stretch')",
            name="ck_teaching_sections_difficulty",
        ),
        CheckConstraint(
            "overrides_section_id IS NULL OR school_id IS NOT NULL",
            name="ck_teaching_sections_override_scope",
        ),
        UniqueConstraint("unit_id", "code", name="uq_teaching_sections_platform_code"),
        UniqueConstraint(
            "school_id", "unit_id", "code", name="uq_teaching_sections_school_code"
        ),
        UniqueConstraint(
            "school_id", "overrides_section_id", name="uq_teaching_sections_override"
        ),
    )

    @property
    def published_version(self):
        return next(
            (v for v in self.versions if v.status == "published" and not v.is_deleted),
            None,
        )

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id) if self.school_id else None,
            "unit_id": str(self.unit_id),
            "overrides_section_id": (
                str(self.overrides_section_id) if self.overrides_section_id else None
            ),
            "section_no": self.section_no,
            "code": self.code,
            "kind": self.kind,
            "title_en": self.title_en,
            "title_ne": self.title_ne,
            "summary_en": self.summary_en,
            "summary_ne": self.summary_ne,
            "estimated_minutes": self.estimated_minutes,
            "difficulty": self.difficulty,
            "prerequisite_section_ids": self.prerequisite_section_ids or [],
            "tags": self.tags or [],
            "is_active": bool(self.is_active),
            "published_version_no": (
                self.published_version.version_no if self.published_version else None
            ),
        }


class TeachingSectionVersion(BaseModel):
    """The publish unit AND the citation unit.

    Published rows are immutable; editing clones to version_no + 1 as a draft.
    Exactly one published version per section is enforced by the partial
    unique index below.
    """

    __tablename__ = "teaching_section_versions"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )
    section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_no = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False, default="draft", index=True)
    supersedes_id = Column(
        UUID(as_uuid=True), ForeignKey("teaching_section_versions.id"), nullable=True
    )
    language_coverage = Column(
        JSONB, nullable=False, default=lambda: {"en": False, "ne": False}
    )
    content_sha256 = Column(String(64))
    change_note = Column(Text)
    ai_generation_id = Column(
        UUID(as_uuid=True), ForeignKey("ai_generations.id"), nullable=True
    )
    authored_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at = Column(Date)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(Date)
    published_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    published_at = Column(Date)
    archived_at = Column(Date)

    notes = relationship(
        "TeachingNote",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingNote.block_no",
    )
    examples = relationship(
        "TeachingExample",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingExample.example_no",
    )
    misconceptions = relationship(
        "TeachingMisconception",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingMisconception.sort_order",
    )
    formulas = relationship(
        "TeachingFormula",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingFormula.sort_order",
    )
    exam_tips = relationship(
        "TeachingExamTip",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingExamTip.sort_order",
    )
    key_terms = relationship(
        "TeachingKeyTerm",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingKeyTerm.sort_order",
    )
    media = relationship(
        "TeachingMedia",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingMedia.sort_order",
    )
    outcome_links = relationship(
        "TeachingSectionOutcome",
        backref="version",
        cascade="all, delete-orphan",
        order_by="TeachingSectionOutcome.sort_order",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','in_review','published','archived','rejected')",
            name="ck_tsv_status",
        ),
        UniqueConstraint("section_id", "version_no", name="uq_tsv_section_version"),
    )

    def to_dict(self, include_blocks: bool = False):
        data = {
            "id": str(self.id),
            "section_id": str(self.section_id),
            "version_no": self.version_no,
            "status": self.status,
            "language_coverage": self.language_coverage
            or {"en": False, "ne": False},
            "content_sha256": self.content_sha256,
            "change_note": self.change_note,
            "counts": {
                "notes": len(self.notes or []),
                "examples": len(self.examples or []),
                "misconceptions": len(self.misconceptions or []),
                "formulas": len(self.formulas or []),
                "exam_tips": len(self.exam_tips or []),
                "key_terms": len(self.key_terms or []),
                "media": len(self.media or []),
                "outcome_links": len(self.outcome_links or []),
            },
        }
        if include_blocks:
            data["notes"] = [n.to_dict() for n in (self.notes or [])]
            data["examples"] = [e.to_dict() for e in (self.examples or [])]
            data["misconceptions"] = [m.to_dict() for m in (self.misconceptions or [])]
            data["formulas"] = [f.to_dict() for f in (self.formulas or [])]
            data["exam_tips"] = [t.to_dict() for t in (self.exam_tips or [])]
            data["key_terms"] = [k.to_dict() for k in (self.key_terms or [])]
            data["media"] = [m.to_dict() for m in (self.media or [])]
            data["outcome_links"] = [
                {
                    "outcome_id": str(o.outcome_id),
                    "emphasis": o.emphasis,
                    "mastery_key": o.mastery_key,
                }
                for o in (self.outcome_links or [])
            ]
        return data


class TeachingSectionOutcome(BaseModel):
    """Link a version to curriculum learning_outcomes — text is never copied.

    `mastery_key` is the join the AI Teacher's mastery records use
    (student_id + concept_key): mastery is recorded against curriculum
    outcomes, not ad-hoc chapter labels.
    """

    __tablename__ = "teaching_section_outcomes"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    outcome_id = Column(
        UUID(as_uuid=True),
        ForeignKey("learning_outcomes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    emphasis = Column(String(12), nullable=False, default="primary")
    mastery_key = Column(String(80), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint("emphasis IN ('primary','supporting')", name="ck_tso_emphasis"),
        UniqueConstraint("version_id", "outcome_id", name="uq_tso"),
    )

    def to_dict(self):
        return {
            "outcome_id": str(self.outcome_id),
            "emphasis": self.emphasis,
            "mastery_key": self.mastery_key,
        }


class TeachingNote(BaseModel):
    """Ordered bilingual narrative blocks the AI teaches from."""

    __tablename__ = "teaching_notes"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    block_no = Column(Integer, nullable=False)
    block_type = Column(String(24), nullable=False, default="explanation")
    heading_en = Column(String(300))
    heading_ne = Column(String(300))
    body_en = Column(Text, nullable=False)
    body_ne = Column(Text)
    speaker_note_en = Column(Text)
    speaker_note_ne = Column(Text)
    board_hint = Column(String(200))
    media_id = Column(UUID(as_uuid=True), ForeignKey("teaching_media.id"), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "block_type IN ('hook','explanation','definition','analogy','step',"
            "'caution','recap','activity')",
            name="ck_tn_block_type",
        ),
        UniqueConstraint("version_id", "block_no", name="uq_tn_version_block"),
    )

    def to_dict(self):
        return {
            "block_no": self.block_no,
            "block_type": self.block_type,
            "heading_en": self.heading_en,
            "heading_ne": self.heading_ne,
            "body_en": self.body_en,
            "body_ne": self.body_ne,
            "speaker_note_en": self.speaker_note_en,
            "speaker_note_ne": self.speaker_note_ne,
            "board_hint": self.board_hint,
            "media_id": str(self.media_id) if self.media_id else None,
        }


class TeachingExample(BaseModel):
    """Worked examples with steps, so the teacher can scaffold or hide steps."""

    __tablename__ = "teaching_examples"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    example_no = Column(Integer, nullable=False)
    kind = Column(String(20), nullable=False, default="worked")
    difficulty = Column(String(16), nullable=False, default="core")
    prompt_en = Column(Text, nullable=False)
    prompt_ne = Column(Text)
    given_en = Column(Text)
    given_ne = Column(Text)
    steps = Column(JSONB, nullable=False, default=list)
    answer_en = Column(Text)
    answer_ne = Column(Text)
    answer_latex = Column(Text)
    unit_label = Column(String(40))
    marks = Column(Integer)
    source_ref = Column(String(200))

    __table_args__ = (
        CheckConstraint(
            "kind IN ('worked','guided','practice','exam')", name="ck_te_kind"
        ),
        CheckConstraint(
            "difficulty IN ('foundation','core','stretch')", name="ck_te_difficulty"
        ),
        UniqueConstraint("version_id", "example_no", name="uq_te_version_no"),
    )

    def to_dict(self):
        return {
            "example_no": self.example_no,
            "kind": self.kind,
            "difficulty": self.difficulty,
            "prompt_en": self.prompt_en,
            "prompt_ne": self.prompt_ne,
            "given_en": self.given_en,
            "given_ne": self.given_ne,
            "steps": self.steps or [],
            "answer_en": self.answer_en,
            "answer_ne": self.answer_ne,
            "answer_latex": self.answer_latex,
            "unit_label": self.unit_label,
            "marks": self.marks,
            "source_ref": self.source_ref,
        }


class TeachingMisconception(BaseModel):
    """Wrong belief → correction: the highest-value teaching asset."""

    __tablename__ = "teaching_misconceptions"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order = Column(Integer, nullable=False, default=0)
    wrong_belief_en = Column(Text, nullable=False)
    wrong_belief_ne = Column(Text)
    why_students_think_en = Column(Text)
    why_students_think_ne = Column(Text)
    correction_en = Column(Text, nullable=False)
    correction_ne = Column(Text)
    diagnostic_question_en = Column(Text)
    diagnostic_question_ne = Column(Text)
    severity = Column(String(12), nullable=False, default="common")
    linked_outcome_id = Column(
        UUID(as_uuid=True), ForeignKey("learning_outcomes.id"), nullable=True
    )

    __table_args__ = (
        CheckConstraint("severity IN ('rare','common','pervasive')", name="ck_tm_severity"),
    )

    def to_dict(self):
        return {
            "sort_order": self.sort_order,
            "wrong_belief_en": self.wrong_belief_en,
            "wrong_belief_ne": self.wrong_belief_ne,
            "why_students_think_en": self.why_students_think_en,
            "why_students_think_ne": self.why_students_think_ne,
            "correction_en": self.correction_en,
            "correction_ne": self.correction_ne,
            "diagnostic_question_en": self.diagnostic_question_en,
            "diagnostic_question_ne": self.diagnostic_question_ne,
            "severity": self.severity,
            "linked_outcome_id": (
                str(self.linked_outcome_id) if self.linked_outcome_id else None
            ),
        }


class TeachingFormula(BaseModel):
    """LaTeX for the board, spoken text for the voice (TTS never reads LaTeX)."""

    __tablename__ = "teaching_formulas"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order = Column(Integer, nullable=False, default=0)
    name_en = Column(String(200), nullable=False)
    name_ne = Column(String(200))
    latex = Column(Text, nullable=False)
    spoken_en = Column(Text, nullable=False)
    spoken_ne = Column(Text)
    symbols = Column(JSONB, nullable=False, default=list)
    conditions_en = Column(Text)
    conditions_ne = Column(Text)
    derivable = Column(Boolean, nullable=False, default=False)
    must_memorize = Column(Boolean, nullable=False, default=False)

    def to_dict(self):
        return {
            "sort_order": self.sort_order,
            "name_en": self.name_en,
            "name_ne": self.name_ne,
            "latex": self.latex,
            "spoken_en": self.spoken_en,
            "spoken_ne": self.spoken_ne,
            "symbols": self.symbols or [],
            "conditions_en": self.conditions_en,
            "conditions_ne": self.conditions_ne,
            "derivable": bool(self.derivable),
            "must_memorize": bool(self.must_memorize),
        }


class TeachingExamTip(BaseModel):
    """NEB/SEE exam reality, anchored to the subject_offerings marks grid."""

    __tablename__ = "teaching_exam_tips"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order = Column(Integer, nullable=False, default=0)
    tip_type = Column(String(24), nullable=False, default="frequent")
    body_en = Column(Text, nullable=False)
    body_ne = Column(Text)
    exam_board = Column(String(16))
    question_pattern = Column(String(120))
    typical_marks = Column(Integer)
    appeared_years = Column(JSONB, nullable=False, default=list)
    subject_offering_id = Column(
        UUID(as_uuid=True), ForeignKey("subject_offerings.id"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "tip_type IN ('frequent','trap','marking_scheme','time_management',"
            "'presentation')",
            name="ck_tet_type",
        ),
    )

    def to_dict(self):
        return {
            "sort_order": self.sort_order,
            "tip_type": self.tip_type,
            "body_en": self.body_en,
            "body_ne": self.body_ne,
            "exam_board": self.exam_board,
            "question_pattern": self.question_pattern,
            "typical_marks": self.typical_marks,
            "appeared_years": self.appeared_years or [],
            "subject_offering_id": (
                str(self.subject_offering_id) if self.subject_offering_id else None
            ),
        }


class TeachingKeyTerm(BaseModel):
    """EN/NE glossary — the mixed-language teaching mode needs term parity."""

    __tablename__ = "teaching_key_terms"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    term_en = Column(String(200), nullable=False)
    term_ne = Column(String(200))
    keep_in_english = Column(Boolean, nullable=False, default=True)
    definition_en = Column(Text)
    definition_ne = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("version_id", "term_en", name="uq_tkt_version_term"),
    )

    def to_dict(self):
        return {
            "term_en": self.term_en,
            "term_ne": self.term_ne,
            "keep_in_english": bool(self.keep_in_english),
            "definition_en": self.definition_en,
            "definition_ne": self.definition_ne,
            "sort_order": self.sort_order,
        }


class TeachingMedia(BaseModel):
    """Media REFERENCES ONLY — never parsed, never OCR'd.

    `file_id` → managed_files (ASchool file storage); admins may also paste an
    external URL or inline SVG. `alt_text_en` is what the AI is ALLOWED to say
    about the image — the model never sees the pixels.
    """

    __tablename__ = "teaching_media"

    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_type = Column(String(16), nullable=False)
    file_id = Column(UUID(as_uuid=True), ForeignKey("managed_files.id"), nullable=True)
    external_url = Column(Text)
    svg_inline = Column(Text)
    alt_text_en = Column(String(400), nullable=False)
    alt_text_ne = Column(String(400))
    caption_en = Column(String(400))
    caption_ne = Column(String(400))
    licence = Column(String(120))
    attribution = Column(String(200))
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint(
            "media_type IN ('image','svg','audio','video','link')",
            name="ck_tmedia_type",
        ),
        CheckConstraint(
            "file_id IS NOT NULL OR external_url IS NOT NULL OR svg_inline IS NOT NULL",
            name="ck_tmedia_target",
        ),
    )

    def to_dict(self):
        return {
            "media_type": self.media_type,
            "file_id": str(self.file_id) if self.file_id else None,
            "external_url": self.external_url,
            "svg_inline": self.svg_inline,
            "alt_text_en": self.alt_text_en,
            "alt_text_ne": self.alt_text_ne,
            "caption_en": self.caption_en,
            "caption_ne": self.caption_ne,
            "licence": self.licence,
            "attribution": self.attribution,
            "sort_order": self.sort_order,
        }


class TeachingContentSnapshot(BaseModel):
    """The immutable document handed to the AI service (hash-addressed)."""

    __tablename__ = "teaching_content_snapshots"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )
    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id"),
        nullable=False,
        index=True,
    )
    language = Column(String(8), nullable=False)  # en | ne | mixed
    document = Column(JSONB, nullable=False)
    document_sha256 = Column(String(64), nullable=False)
    token_estimate = Column(Integer, nullable=False, default=0)
    built_at = Column(Date)

    __table_args__ = (
        UniqueConstraint(
            "version_id", "language", "document_sha256", name="uq_tcs"
        ),
    )


class TeachingContentReview(BaseModel):
    """Workflow audit trail: who moved a version through which transition."""

    __tablename__ = "teaching_content_reviews"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )
    version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(16), nullable=False)
    from_status = Column(String(16))
    to_status = Column(String(16))
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    comment = Column(Text)

    __table_args__ = (
        CheckConstraint(
            "action IN ('submit','approve','reject','publish','archive','revert')",
            name="ck_tcr_action",
        ),
    )

    def to_dict(self):
        return {
            "action": self.action,
            "from_status": self.from_status,
            "to_status": self.to_status,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
