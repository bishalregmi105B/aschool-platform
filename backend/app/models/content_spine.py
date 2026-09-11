"""S12 content spine — the AI workspace's grounding substrate.

Layer model (docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md):
  content_sources (ingested books/guides/grids/papers, sha256-deduped)
    → content_units (chapters/sections aligned to curriculum_units, honest NULLs)
      → content_chunks (page-anchored, kind-tagged, verbatim text; embedding_vec
        lives in the DB only — raw SQL, HNSW + GIN, same pattern as document_chunks)

Plus the printed question-paper archive (question_papers/paper_questions —
verbatim, must be able to reprint the paper 1:1), extraction run manifests,
and the golden-set/eval harness tables.

Ingestion operator: Claude Code / Gemini Code per
docs/ai_workspace_prompts/AGENT_INGESTION_BRIEF.md; the ONLY DB writer is
app/content_loader.py (thin, deterministic).
"""
import uuid

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import BaseModel


class ContentSource(BaseModel):
    """One ingested document. school_id NULL = platform corpus shared by all
    tenants (CDC books). ingest_status walks the registered→…→published
    ladder; publishing is gated by the loader's coverage manifest."""

    __tablename__ = "content_sources"
    __table_args__ = (
        UniqueConstraint("kind", "file_sha256", name="uq_content_sources_kind_sha"),
    )
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    kind = Column(
        String(30), nullable=False, default="textbook"
    )  # textbook|teacher_guide|spec_grid|model_question|past_paper|syllabus|curriculum_doc|oer|school_upload
    board = Column(String(20))  # cdc|neb|cbse|custom
    grade = Column(String(10))
    subject_code = Column(String(50))
    title_en = Column(String(300))
    title_ne = Column(String(300))
    medium = Column(String(20), default="ne")  # ne|en|bilingual
    edition_bs = Column(String(20))
    edition_ad = Column(Integer)
    source_url = Column(Text)
    storage_path = Column(Text)
    file_sha256 = Column(String(64), nullable=False, index=True)
    page_count = Column(Integer)
    font_encoding = Column(String(20))  # unicode|preeti|scanned|english|mixed
    replaces_source_id = Column(UUID(as_uuid=True), ForeignKey("content_sources.id"))
    ingest_status = Column(
        String(20), nullable=False, default="registered", index=True
    )  # registered|parsing|structuring|chunking|embedding|qa|review|published|failed
    ingest_error = Column(Text)
    manifest = Column(JSONB, default=dict)  # coverage manifest (pages, exercises, flags)
    meta = Column(JSONB, default=dict)

    units = None  # relationship defined lazily via backrefs not needed for v1


class ContentUnit(BaseModel):
    """Chapter/section tree extracted from a source. curriculum_unit_id is
    NULLABLE BY DESIGN — unaligned units are honest NULLs with an
    align_method/confidence, never fake matches."""

    __tablename__ = "content_units"
    __table_args__ = (
        UniqueConstraint("source_id", "unit_path", name="uq_content_units_source_path"),
    )
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    source_id = Column(
        UUID(as_uuid=True), ForeignKey("content_sources.id"), nullable=False, index=True
    )
    parent_unit_id = Column(UUID(as_uuid=True), ForeignKey("content_units.id"))
    unit_path = Column(String(200), nullable=False)  # "ch3" | "ch3/3.2"
    unit_no_printed = Column(String(20))
    unit_no_ascii = Column(Integer)
    unit_kind = Column(String(20), default="chapter")  # part|chapter|section
    title_en = Column(String(300))
    title_ne = Column(String(300))
    title_chain = Column(Text)  # "Book › च.३ बल › ३.२ न्युटनको दोस्रो नियम"
    page_start = Column(Integer)
    page_end = Column(Integer)
    curriculum_unit_id = Column(
        UUID(as_uuid=True), ForeignKey("curriculum_units.id"), nullable=True, index=True
    )
    align_method = Column(String(20))  # manual|toc|heuristic|llm|none
    align_confidence = Column(Numeric(3, 2))
    section_summary_en = Column(Text)
    section_summary_ne = Column(Text)
    key_concepts = Column(JSONB, default=list)
    has_exercises = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)
    meta = Column(JSONB, default=dict)


class ContentChunk(BaseModel):
    """The retrieval-ready leaf. text_display is the verbatim print; the
    EMBED text (title-chain prefix + contextualizer + text) is assembled by
    the loader into text_embed. embedding_vec exists in the DB only (raw
    SQL) — all vector math is raw SQL, never through this model."""

    __tablename__ = "content_chunks"
    __table_args__ = (
        UniqueConstraint("source_id", "unit_id", "ordinal", name="uq_content_chunks_natural"),
    )
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    source_id = Column(
        UUID(as_uuid=True), ForeignKey("content_sources.id"), nullable=False, index=True
    )
    unit_id = Column(
        UUID(as_uuid=True), ForeignKey("content_units.id"), nullable=False, index=True
    )
    ordinal = Column(Integer, nullable=False)
    kind = Column(String(30), nullable=False, default="prose")
    # prose|definition|worked_example|exercise_item|exercise_set|formula_block|
    # figure|table|activity|note|answer|teacher_note|heading
    audience = Column(String(20), default="student")  # student|teacher
    language = Column(String(10), default="ne")  # ne|en|bilingual
    text_display = Column(Text, nullable=False)
    text_embed = Column(Text, nullable=False)
    contextualizer_note = Column(Text)
    page_no = Column(Integer)
    page_image_path = Column(Text)
    bbox = Column(JSONB)  # [ymin, xmin, ymax, xmax] 0-1000
    extraction_run_id = Column(UUID(as_uuid=True), ForeignKey("extraction_runs.id"))
    prompt_version = Column(String(20))
    model_id = Column(String(100))
    content_sha256 = Column(String(64), nullable=False, index=True)
    text_ne = Column(Text)
    text_en = Column(Text)
    embedding_model = Column(String(100))
    is_published = Column(Boolean, default=False, index=True)
    qa_status = Column(String(20), default="pending")  # pending|passed|flagged|rejected
    qa_flags = Column(JSONB, default=list)
    meta = Column(JSONB, default=dict)


class ExtractionRun(BaseModel):
    """One agent ingestion pass over one source — carries the coverage
    manifest that gates publishing ('the book is fully in' is a query)."""

    __tablename__ = "extraction_runs"
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    source_id = Column(
        UUID(as_uuid=True), ForeignKey("content_sources.id"), nullable=False, index=True
    )
    operator = Column(String(50))  # claude-code|gemini-code|manual
    model_id = Column(String(100))
    prompt_version = Column(String(20))
    status = Column(String(20), default="running")  # running|completed|failed
    pages_total = Column(Integer)
    pages_extracted = Column(Integer)
    exercises_detected = Column(Integer)
    exercises_expected = Column(Integer)
    figures_detected = Column(Integer)
    illegible_count = Column(Integer)
    flagged_pages = Column(JSONB, default=list)
    manifest = Column(JSONB, default=dict)
    error = Column(Text)


class QuestionPaper(BaseModel):
    """A printed question paper (model set, SEE/NEB board paper, school exam,
    or the spec-grid source). The archive must reprint the paper 1:1."""

    __tablename__ = "question_papers"
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    source_id = Column(
        UUID(as_uuid=True), ForeignKey("content_sources.id"), index=True
    )
    paper_kind = Column(
        String(30), nullable=False, default="model_question"
    )  # model_question|see|neb|board|school_exam|spec_grid
    title_en = Column(String(300))
    title_ne = Column(String(300))
    exam_year_bs = Column(String(20))
    exam_year_ad = Column(Integer)
    grade = Column(String(10))
    subject_code = Column(String(50))
    total_full_marks = Column(Integer)
    duration_minutes = Column(Integer)
    instructions = Column(JSONB, default=list)  # verbatim instruction lines
    page_start = Column(Integer)
    page_end = Column(Integer)
    extraction_run_id = Column(UUID(as_uuid=True), ForeignKey("extraction_runs.id"))
    is_published = Column(Boolean, default=False, index=True)
    meta = Column(JSONB, default=dict)


class PaperQuestion(BaseModel):
    """One printed question (or sub-part) of a question paper — everything
    verbatim, marks exactly as printed, never computed."""

    __tablename__ = "paper_questions"
    __table_args__ = (
        UniqueConstraint(
            "paper_id", "question_no_ascii", "sub_label",
            name="uq_paper_questions_paper_no_label",
        ),
    )
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    paper_id = Column(
        UUID(as_uuid=True), ForeignKey("question_papers.id"), nullable=False, index=True
    )
    parent_question_id = Column(UUID(as_uuid=True), ForeignKey("paper_questions.id"))
    group_name = Column(String(100))  # "समूह 'क'" / "Group A"
    group_order = Column(Integer, default=0)
    question_no_printed = Column(String(20))
    question_no_ascii = Column(Integer, index=True)
    sub_label = Column(String(10))  # "(क)" — NULL for root questions
    question_type = Column(String(30), default="short_answer")
    marks = Column(Numeric(6, 2))
    marks_printed = Column(String(20))
    stem_ne = Column(Text)
    stem_en = Column(Text)
    options = Column(JSONB, default=list)  # [{label, text_ne/text_en}]
    answer_ne = Column(Text)
    answer_en = Column(Text)
    answer_source = Column(String(20), default="none")  # printed|answer_key|none
    unit_hint = Column(String(300))
    blueprint_cell_id = Column(UUID(as_uuid=True), ForeignKey("paper_blueprints.id"))
    has_figure = Column(Boolean, default=False)
    figure_bbox = Column(JSONB)
    page_no = Column(Integer)
    bbox = Column(JSONB)
    extraction_run_id = Column(UUID(as_uuid=True), ForeignKey("extraction_runs.id"))
    prompt_version = Column(String(20))
    content_sha256 = Column(String(64), index=True)
    is_published = Column(Boolean, default=False, index=True)
    meta = Column(JSONB, default=dict)


class GoldenSetItem(BaseModel):
    """Golden question for the per-grade×subject eval harness — a query, the
    chunks/units that MUST be retrieved, and the language/kind tags."""

    __tablename__ = "golden_set_items"
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    grade = Column(String(10), nullable=False)
    subject_code = Column(String(50), nullable=False)
    query = Column(Text, nullable=False)
    language = Column(String(10), default="ne")  # ne|en|mixed
    kind = Column(String(30), default="prose")  # prose|worked_example|exercise|formula|figure
    expected_unit_paths = Column(JSONB, default=list)
    expected_chunk_ids = Column(JSONB, default=list)
    notes = Column(Text)


class EvalRun(BaseModel):
    """One evaluation pass over a golden set — recall/MRR/groundedness scores
    stored so any embedding/chunker/prompt change is gated on regression."""

    __tablename__ = "eval_runs"
    # school_id NULL = platform corpus (shared by every school),
    # mirroring document_chunks; vector/RAG reads filter tenant explicitly.
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    name = Column(String(200))
    grade = Column(String(10))
    subject_code = Column(String(50))
    eval_type = Column(String(30), default="retrieval")  # retrieval|generation|paper
    config = Column(JSONB, default=dict)  # model versions, k, thresholds
    items_total = Column(Integer, default=0)
    items_passed = Column(Integer, default=0)
    recall_at_k = Column(Numeric(5, 4))
    mrr_at_k = Column(Numeric(5, 4))
    groundedness = Column(Numeric(5, 4))
    nepali_gap = Column(Numeric(5, 4))
    results = Column(JSONB, default=list)  # per-item detail
    passed = Column(Boolean, default=False, index=True)
