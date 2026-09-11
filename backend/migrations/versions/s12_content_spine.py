"""S12: AI content spine — sources/units/chunks + printed question-paper
archive + extraction manifests + golden-set/eval harness.

Storage design: docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md + docs/FINAL_AI_PLATFORM_PLAN_2026-09-11.md.
content_chunks.embedding_vec is created via raw SQL (pgvector, alembic has no
type) with HNSW cosine + GIN tsvector — the document_chunks pattern.

Revision ID: s12_spine_01
Revises: fc_b_lib
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s12_spine_01"
down_revision = "fc_b_lib"
branch_labels = None
depends_on = None


def _base_columns(table: str, school_nullable: bool = True):
    """id/timestamps/soft-delete + tenant column with an explicitly named FK
    (no autogenerate-style name templates at runtime)."""
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("schools.id", name=f"fk_{table}_school_id_schools"),
                  nullable=school_nullable, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    ]


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── content_sources ──────────────────────────────────────────────────
    op.create_table(
        "content_sources",
        *_base_columns("content_sources"),
        sa.Column("kind", sa.String(30), nullable=False, server_default="textbook"),
        sa.Column("board", sa.String(20)),
        sa.Column("grade", sa.String(10)),
        sa.Column("subject_code", sa.String(50)),
        sa.Column("title_en", sa.String(300)),
        sa.Column("title_ne", sa.String(300)),
        sa.Column("medium", sa.String(20), server_default="ne"),
        sa.Column("edition_bs", sa.String(20)),
        sa.Column("edition_ad", sa.Integer()),
        sa.Column("source_url", sa.Text()),
        sa.Column("storage_path", sa.Text()),
        sa.Column("file_sha256", sa.String(64), nullable=False),
        sa.Column("page_count", sa.Integer()),
        sa.Column("font_encoding", sa.String(20)),
        sa.Column("replaces_source_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_sources.id", name="fk_content_sources_replaces_source_id_content_sources")),
        sa.Column("ingest_status", sa.String(20), nullable=False, server_default="registered"),
        sa.Column("ingest_error", sa.Text()),
        sa.Column("manifest", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text())),
        sa.UniqueConstraint("kind", "file_sha256", name="uq_content_sources_kind_sha"),
    )
    op.create_index("ix_content_sources_ingest_status", "content_sources", ["ingest_status"])

    # ── extraction_runs (before its FK consumers) ────────────────────────
    op.create_table(
        "extraction_runs",
        *_base_columns("extraction_runs"),
        sa.Column("source_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_sources.id", name="fk_extraction_runs_source_id_content_sources"),
                  nullable=False),
        sa.Column("operator", sa.String(50)),
        sa.Column("model_id", sa.String(100)),
        sa.Column("prompt_version", sa.String(20)),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("pages_total", sa.Integer()),
        sa.Column("pages_extracted", sa.Integer()),
        sa.Column("exercises_detected", sa.Integer()),
        sa.Column("exercises_expected", sa.Integer()),
        sa.Column("figures_detected", sa.Integer()),
        sa.Column("illegible_count", sa.Integer()),
        sa.Column("flagged_pages", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("manifest", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("error", sa.Text()),
    )
    op.create_index("ix_extraction_runs_source_id", "extraction_runs", ["source_id"])

    # ── content_units ────────────────────────────────────────────────────
    op.create_table(
        "content_units",
        *_base_columns("content_units"),
        sa.Column("source_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_sources.id", name="fk_content_units_source_id_content_sources"),
                  nullable=False),
        sa.Column("parent_unit_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_units.id", name="fk_content_units_parent_unit_id_content_units")),
        sa.Column("unit_path", sa.String(200), nullable=False),
        sa.Column("unit_no_printed", sa.String(20)),
        sa.Column("unit_no_ascii", sa.Integer()),
        sa.Column("unit_kind", sa.String(20), server_default="chapter"),
        sa.Column("title_en", sa.String(300)),
        sa.Column("title_ne", sa.String(300)),
        sa.Column("title_chain", sa.Text()),
        sa.Column("page_start", sa.Integer()),
        sa.Column("page_end", sa.Integer()),
        sa.Column("curriculum_unit_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("curriculum_units.id", name="fk_content_units_curriculum_unit_id_curriculum_units")),
        sa.Column("align_method", sa.String(20)),
        sa.Column("align_confidence", sa.Numeric(3, 2)),
        sa.Column("section_summary_en", sa.Text()),
        sa.Column("section_summary_ne", sa.Text()),
        sa.Column("key_concepts", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("has_exercises", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text())),
        sa.UniqueConstraint("source_id", "unit_path", name="uq_content_units_source_path"),
    )
    op.create_index("ix_content_units_source_id", "content_units", ["source_id"])
    op.create_index("ix_content_units_curriculum_unit_id", "content_units", ["curriculum_unit_id"])

    # ── content_chunks ───────────────────────────────────────────────────
    op.create_table(
        "content_chunks",
        *_base_columns("content_chunks"),
        sa.Column("source_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_sources.id", name="fk_content_chunks_source_id_content_sources"),
                  nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_units.id", name="fk_content_chunks_unit_id_content_units"),
                  nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False, server_default="prose"),
        sa.Column("audience", sa.String(20), server_default="student"),
        sa.Column("language", sa.String(10), server_default="ne"),
        sa.Column("text_display", sa.Text(), nullable=False),
        sa.Column("text_embed", sa.Text(), nullable=False),
        sa.Column("contextualizer_note", sa.Text()),
        sa.Column("page_no", sa.Integer()),
        sa.Column("page_image_path", sa.Text()),
        sa.Column("bbox", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("extraction_run_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("extraction_runs.id", name="fk_content_chunks_extraction_run_id_extraction_runs")),
        sa.Column("prompt_version", sa.String(20)),
        sa.Column("model_id", sa.String(100)),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("text_ne", sa.Text()),
        sa.Column("text_en", sa.Text()),
        sa.Column("embedding_model", sa.String(100)),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("qa_status", sa.String(20), server_default="pending"),
        sa.Column("qa_flags", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text())),
        sa.UniqueConstraint("source_id", "unit_id", "ordinal", name="uq_content_chunks_natural"),
    )
    op.create_index("ix_content_chunks_source_id", "content_chunks", ["source_id"])
    op.create_index("ix_content_chunks_unit_id", "content_chunks", ["unit_id"])
    op.create_index("ix_content_chunks_published", "content_chunks", ["is_published"])
    op.create_index("ix_content_chunks_sha", "content_chunks", ["content_sha256"])
    # vector + lexical indexes via raw SQL (pgvector; bge-m3 class 1024 dims)
    op.execute("ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(1024)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_content_chunks_embedding_hnsw "
        "ON content_chunks USING hnsw (embedding_vec vector_cosine_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_content_chunks_tsv "
        "ON content_chunks USING gin (to_tsvector('simple', text_embed))"
    )

    # ── question_papers + paper_questions (printed-paper archive) ────────
    op.create_table(
        "question_papers",
        *_base_columns("question_papers"),
        sa.Column("source_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("content_sources.id", name="fk_question_papers_source_id_content_sources")),
        sa.Column("paper_kind", sa.String(30), nullable=False, server_default="model_question"),
        sa.Column("title_en", sa.String(300)),
        sa.Column("title_ne", sa.String(300)),
        sa.Column("exam_year_bs", sa.String(20)),
        sa.Column("exam_year_ad", sa.Integer()),
        sa.Column("grade", sa.String(10)),
        sa.Column("subject_code", sa.String(50)),
        sa.Column("total_full_marks", sa.Integer()),
        sa.Column("duration_minutes", sa.Integer()),
        sa.Column("instructions", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("page_start", sa.Integer()),
        sa.Column("page_end", sa.Integer()),
        sa.Column("extraction_run_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("extraction_runs.id", name="fk_question_papers_extraction_run_id_extraction_runs")),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text())),
    )

    op.create_table(
        "paper_questions",
        *_base_columns("paper_questions"),
        sa.Column("paper_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("question_papers.id", name="fk_paper_questions_paper_id_question_papers"),
                  nullable=False),
        sa.Column("parent_question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("paper_questions.id", name="fk_paper_questions_parent_question_id_paper_questions")),
        sa.Column("group_name", sa.String(100)),
        sa.Column("group_order", sa.Integer(), server_default=sa.text("0")),
        sa.Column("question_no_printed", sa.String(20)),
        sa.Column("question_no_ascii", sa.Integer()),
        sa.Column("sub_label", sa.String(10)),
        sa.Column("question_type", sa.String(30), server_default="short_answer"),
        sa.Column("marks", sa.Numeric(6, 2)),
        sa.Column("marks_printed", sa.String(20)),
        sa.Column("stem_ne", sa.Text()),
        sa.Column("stem_en", sa.Text()),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("answer_ne", sa.Text()),
        sa.Column("answer_en", sa.Text()),
        sa.Column("answer_source", sa.String(20), server_default="none"),
        sa.Column("unit_hint", sa.String(300)),
        sa.Column("blueprint_cell_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("paper_blueprints.id", name="fk_paper_questions_blueprint_cell_id_paper_blueprints")),
        sa.Column("has_figure", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("figure_bbox", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("page_no", sa.Integer()),
        sa.Column("bbox", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("extraction_run_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("extraction_runs.id", name="fk_paper_questions_extraction_run_id_extraction_runs")),
        sa.Column("prompt_version", sa.String(20)),
        sa.Column("content_sha256", sa.String(64)),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text())),
        sa.UniqueConstraint("paper_id", "question_no_ascii", "sub_label",
                            name="uq_paper_questions_paper_no_label"),
    )
    op.create_index("ix_paper_questions_paper_id", "paper_questions", ["paper_id"])
    op.create_index("ix_paper_questions_question_no_ascii", "paper_questions", ["question_no_ascii"])
    op.create_index("ix_paper_questions_published", "paper_questions", ["is_published"])

    # ── golden sets + eval runs ──────────────────────────────────────────
    op.create_table(
        "golden_set_items",
        *_base_columns("golden_set_items"),
        sa.Column("grade", sa.String(10), nullable=False),
        sa.Column("subject_code", sa.String(50), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("language", sa.String(10), server_default="ne"),
        sa.Column("kind", sa.String(30), server_default="prose"),
        sa.Column("expected_unit_paths", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("expected_chunk_ids", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("notes", sa.Text()),
    )
    op.create_table(
        "eval_runs",
        *_base_columns("eval_runs"),
        sa.Column("name", sa.String(200)),
        sa.Column("grade", sa.String(10)),
        sa.Column("subject_code", sa.String(50)),
        sa.Column("eval_type", sa.String(30), server_default="retrieval"),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("items_total", sa.Integer(), server_default=sa.text("0")),
        sa.Column("items_passed", sa.Integer(), server_default=sa.text("0")),
        sa.Column("recall_at_k", sa.Numeric(5, 4)),
        sa.Column("mrr_at_k", sa.Numeric(5, 4)),
        sa.Column("groundedness", sa.Numeric(5, 4)),
        sa.Column("nepali_gap", sa.Numeric(5, 4)),
        sa.Column("results", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("passed", sa.Boolean(), server_default=sa.text("false")),
    )


def downgrade():
    op.drop_table("eval_runs")
    op.drop_table("golden_set_items")
    op.drop_table("paper_questions")
    op.drop_table("question_papers")
    op.execute("DROP INDEX IF EXISTS ix_content_chunks_tsv")
    op.execute("DROP INDEX IF EXISTS ix_content_chunks_embedding_hnsw")
    op.drop_table("content_chunks")
    op.drop_table("content_units")
    op.drop_table("extraction_runs")
    op.drop_table("content_sources")
