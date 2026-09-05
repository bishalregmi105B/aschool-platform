"""Phase C P1: teaching-content spine (12 tables, admin-entered, no OCR)

Sections → versions → blocks hanging off the existing curriculum_units chain.
Full DDL rationale in audits/research/_digest/D1_AITEACHER_AND_TOOLS.md §B;
models in app/models/teaching_content.py.

Key invariants enforced here:
- exactly ONE published version per section (uq_tsv_one_published, partial)
- platform code uniqueness (school_id IS NULL) and school code uniqueness
- a school section may override at most one platform section
- media rows reference managed_files / URLs / inline SVG only — never parsed

Revision ID: d4e7f1a9c2b8
Revises: b9f3a6c1d7e2
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "d4e7f1a9c2b8"
down_revision = "b9f3a6c1d7e2"
branch_labels = None
depends_on = None


def _base_columns():
    return [
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"),
                  nullable=False),
    ]


def _col(name, *a, **kw):
    return sa.Column(name, *a, **kw)


def upgrade():
    # ── 1. teaching_sections ──────────────────────────────────────────────
    op.create_table(
        "teaching_sections",
        *_base_columns(),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"),
                  nullable=True),
        sa.Column("unit_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("curriculum_units.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("overrides_section_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_sections.id"), nullable=True),
        sa.Column("lms_topic_id", pg.UUID(as_uuid=True), sa.ForeignKey("topics.id"),
                  nullable=True),
        sa.Column("section_no", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(60), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False, server_default="concept"),
        sa.Column("title_en", sa.String(300), nullable=False),
        sa.Column("title_ne", sa.String(300)),
        sa.Column("summary_en", sa.Text()),
        sa.Column("summary_ne", sa.Text()),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("difficulty", sa.String(16), nullable=False, server_default="core"),
        sa.Column("prerequisite_section_ids", pg.JSONB(), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("tags", pg.JSONB(), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=True),
        sa.CheckConstraint(
            "kind IN ('concept','derivation','procedure','experiment','reading','revision')",
            name="ck_teaching_sections_kind"),
        sa.CheckConstraint(
            "difficulty IN ('foundation','core','stretch')",
            name="ck_teaching_sections_difficulty"),
        sa.CheckConstraint(
            "overrides_section_id IS NULL OR school_id IS NOT NULL",
            name="ck_teaching_sections_override_scope"),
    )
    op.create_index("uq_teaching_sections_platform_code", "teaching_sections",
                    ["unit_id", "code"], unique=True,
                    postgresql_where=sa.text("school_id IS NULL AND is_deleted = false"))
    op.create_index("uq_teaching_sections_school_code", "teaching_sections",
                    ["school_id", "unit_id", "code"], unique=True,
                    postgresql_where=sa.text("school_id IS NOT NULL AND is_deleted = false"))
    op.create_index("uq_teaching_sections_override", "teaching_sections",
                    ["school_id", "overrides_section_id"], unique=True,
                    postgresql_where=sa.text(
                        "overrides_section_id IS NOT NULL AND is_deleted = false"))
    op.create_index("ix_teaching_sections_unit_order", "teaching_sections",
                    ["unit_id", "section_no"])

    # ── 2. teaching_section_versions ─────────────────────────────────────
    op.create_table(
        "teaching_section_versions",
        *_base_columns(),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"),
                  nullable=True),
        sa.Column("section_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_sections.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("supersedes_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id"), nullable=True),
        sa.Column("language_coverage", pg.JSONB(), nullable=False,
                  server_default=sa.text('\'{"en": false, "ne": false}\'::jsonb')),
        sa.Column("content_sha256", sa.String(64)),
        sa.Column("change_note", sa.Text()),
        sa.Column("ai_generation_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("ai_generations.id"), nullable=True),
        sa.Column("authored_by_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("published_by_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('draft','in_review','published','archived','rejected')",
            name="ck_tsv_status"),
        sa.UniqueConstraint("section_id", "version_no", name="uq_tsv_section_version"),
    )
    op.create_index("uq_tsv_one_published", "teaching_section_versions", ["section_id"],
                    unique=True,
                    postgresql_where=sa.text("status = 'published' AND is_deleted = false"))
    op.create_index("ix_tsv_status", "teaching_section_versions", ["status"])

    # ── 3. teaching_section_outcomes ─────────────────────────────────────
    op.create_table(
        "teaching_section_outcomes",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("outcome_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("learning_outcomes.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("emphasis", sa.String(12), nullable=False, server_default="primary"),
        sa.Column("mastery_key", sa.String(80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("emphasis IN ('primary','supporting')", name="ck_tso_emphasis"),
        sa.UniqueConstraint("version_id", "outcome_id", name="uq_tso"),
    )
    op.create_index("ix_tso_outcome", "teaching_section_outcomes", ["outcome_id"])

    # ── 4. teaching_notes (media FK added after teaching_media exists) ───
    op.create_table(
        "teaching_notes",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("block_no", sa.Integer(), nullable=False),
        sa.Column("block_type", sa.String(24), nullable=False,
                  server_default="explanation"),
        sa.Column("heading_en", sa.String(300)),
        sa.Column("heading_ne", sa.String(300)),
        sa.Column("body_en", sa.Text(), nullable=False),
        sa.Column("body_ne", sa.Text()),
        sa.Column("speaker_note_en", sa.Text()),
        sa.Column("speaker_note_ne", sa.Text()),
        sa.Column("board_hint", sa.String(200)),
        sa.Column("media_id", pg.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint(
            "block_type IN ('hook','explanation','definition','analogy','step',"
            "'caution','recap','activity')",
            name="ck_tn_block_type"),
        sa.UniqueConstraint("version_id", "block_no", name="uq_tn_version_block"),
    )
    op.create_index("ix_tn_version", "teaching_notes", ["version_id", "block_no"])

    # ── 5. teaching_examples ─────────────────────────────────────────────
    op.create_table(
        "teaching_examples",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("example_no", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="worked"),
        sa.Column("difficulty", sa.String(16), nullable=False, server_default="core"),
        sa.Column("prompt_en", sa.Text(), nullable=False),
        sa.Column("prompt_ne", sa.Text()),
        sa.Column("given_en", sa.Text()),
        sa.Column("given_ne", sa.Text()),
        sa.Column("steps", pg.JSONB(), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("answer_en", sa.Text()),
        sa.Column("answer_ne", sa.Text()),
        sa.Column("answer_latex", sa.Text()),
        sa.Column("unit_label", sa.String(40)),
        sa.Column("marks", sa.Integer()),
        sa.Column("source_ref", sa.String(200)),
        sa.CheckConstraint("kind IN ('worked','guided','practice','exam')",
                           name="ck_te_kind"),
        sa.CheckConstraint("difficulty IN ('foundation','core','stretch')",
                           name="ck_te_difficulty"),
        sa.UniqueConstraint("version_id", "example_no", name="uq_te_version_no"),
    )
    op.create_index("ix_te_version", "teaching_examples", ["version_id", "example_no"])

    # ── 6. teaching_misconceptions ───────────────────────────────────────
    op.create_table(
        "teaching_misconceptions",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wrong_belief_en", sa.Text(), nullable=False),
        sa.Column("wrong_belief_ne", sa.Text()),
        sa.Column("why_students_think_en", sa.Text()),
        sa.Column("why_students_think_ne", sa.Text()),
        sa.Column("correction_en", sa.Text(), nullable=False),
        sa.Column("correction_ne", sa.Text()),
        sa.Column("diagnostic_question_en", sa.Text()),
        sa.Column("diagnostic_question_ne", sa.Text()),
        sa.Column("severity", sa.String(12), nullable=False, server_default="common"),
        sa.Column("linked_outcome_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("learning_outcomes.id"), nullable=True),
        sa.CheckConstraint("severity IN ('rare','common','pervasive')",
                           name="ck_tm_severity"),
    )
    op.create_index("ix_tm_version", "teaching_misconceptions",
                    ["version_id", "sort_order"])

    # ── 7. teaching_formulas ─────────────────────────────────────────────
    op.create_table(
        "teaching_formulas",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name_en", sa.String(200), nullable=False),
        sa.Column("name_ne", sa.String(200)),
        sa.Column("latex", sa.Text(), nullable=False),
        sa.Column("spoken_en", sa.Text(), nullable=False),
        sa.Column("spoken_ne", sa.Text()),
        sa.Column("symbols", pg.JSONB(), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("conditions_en", sa.Text()),
        sa.Column("conditions_ne", sa.Text()),
        sa.Column("derivable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("must_memorize", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
    )
    op.create_index("ix_tf_version", "teaching_formulas", ["version_id", "sort_order"])

    # ── 8. teaching_exam_tips ────────────────────────────────────────────
    op.create_table(
        "teaching_exam_tips",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tip_type", sa.String(24), nullable=False, server_default="frequent"),
        sa.Column("body_en", sa.Text(), nullable=False),
        sa.Column("body_ne", sa.Text()),
        sa.Column("exam_board", sa.String(16)),
        sa.Column("question_pattern", sa.String(120)),
        sa.Column("typical_marks", sa.Integer()),
        sa.Column("appeared_years", pg.JSONB(), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("subject_offering_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("subject_offerings.id"), nullable=True),
        sa.CheckConstraint(
            "tip_type IN ('frequent','trap','marking_scheme','time_management',"
            "'presentation')",
            name="ck_tet_type"),
    )
    op.create_index("ix_tet_version", "teaching_exam_tips", ["version_id", "sort_order"])

    # ── 9. teaching_key_terms ────────────────────────────────────────────
    op.create_table(
        "teaching_key_terms",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("term_en", sa.String(200), nullable=False),
        sa.Column("term_ne", sa.String(200)),
        sa.Column("keep_in_english", sa.Boolean(), nullable=False,
                  server_default=sa.text("true")),
        sa.Column("definition_en", sa.Text()),
        sa.Column("definition_ne", sa.Text()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("version_id", "term_en", name="uq_tkt_version_term"),
    )

    # ── 10. teaching_media ───────────────────────────────────────────────
    op.create_table(
        "teaching_media",
        *_base_columns(),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("media_type", sa.String(16), nullable=False),
        sa.Column("file_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("managed_files.id"), nullable=True),
        sa.Column("external_url", sa.Text()),
        sa.Column("svg_inline", sa.Text()),
        sa.Column("alt_text_en", sa.String(400), nullable=False),
        sa.Column("alt_text_ne", sa.String(400)),
        sa.Column("caption_en", sa.String(400)),
        sa.Column("caption_ne", sa.String(400)),
        sa.Column("licence", sa.String(120)),
        sa.Column("attribution", sa.String(200)),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "media_type IN ('image','svg','audio','video','link')",
            name="ck_tmedia_type"),
        sa.CheckConstraint(
            "file_id IS NOT NULL OR external_url IS NOT NULL OR svg_inline IS NOT NULL",
            name="ck_tmedia_target"),
    )
    op.create_index("ix_tmedia_version", "teaching_media", ["version_id", "sort_order"])
    # deferred FK from the DDL: teaching_notes.media_id → teaching_media.id
    op.create_foreign_key(
        "fk_tn_media", "teaching_notes", "teaching_media", ["media_id"], ["id"]
    )

    # ── 11. teaching_content_snapshots ───────────────────────────────────
    op.create_table(
        "teaching_content_snapshots",
        *_base_columns(),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"),
                  nullable=True),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id"), nullable=False),
        sa.Column("language", sa.String(8), nullable=False),
        sa.Column("document", pg.JSONB(), nullable=False),
        sa.Column("document_sha256", sa.String(64), nullable=False),
        sa.Column("token_estimate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("built_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("version_id", "language", "document_sha256", name="uq_tcs"),
    )
    op.create_index("ix_tcs_version_lang", "teaching_content_snapshots",
                    ["version_id", "language"])

    # ── 12. teaching_content_reviews ─────────────────────────────────────
    op.create_table(
        "teaching_content_reviews",
        *_base_columns(),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"),
                  nullable=True),
        sa.Column("version_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("from_status", sa.String(16)),
        sa.Column("to_status", sa.String(16)),
        sa.Column("actor_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=True),
        sa.Column("comment", sa.Text()),
        sa.CheckConstraint(
            "action IN ('submit','approve','reject','publish','archive','revert')",
            name="ck_tcr_action"),
    )
    op.create_index("ix_tcr_version", "teaching_content_reviews",
                    ["version_id", "created_at"])


def downgrade():
    # children before parents
    op.drop_table("teaching_content_reviews")
    op.drop_table("teaching_content_snapshots")
    op.drop_table("teaching_media")
    op.drop_table("teaching_key_terms")
    op.drop_table("teaching_exam_tips")
    op.drop_table("teaching_formulas")
    op.drop_table("teaching_misconceptions")
    op.drop_table("teaching_examples")
    op.drop_table("teaching_notes")
    op.drop_table("teaching_section_outcomes")
    op.drop_table("teaching_section_versions")
    op.drop_table("teaching_sections")
