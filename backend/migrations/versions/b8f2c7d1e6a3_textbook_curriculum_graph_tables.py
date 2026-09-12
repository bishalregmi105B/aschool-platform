"""Textbook/curriculum-graph tables + composite question bank extensions

W5-B #7/#8 / W5-C A3+A6: the textbook_* and curriculum_graph models were only
created by the ai_teacher plugin's create_all hook — `flask db upgrade` produced
a schema missing them while question_bank_items declared FKs into them
(NoReferencedTableError on autogenerate, incomplete fresh deploys). This
migration makes the whole chain reproducible from migrations alone.

Tables: textbook_corpora/pages/chapters/sections/assets,
curriculum_concepts, concept_prerequisites, concept_misconceptions,
question_subparts, question_rubric_steps.
Columns: question_bank_items composite-question extensions.

Revision ID: b8f2c7d1e6a3
Revises: a7c3e9f1d4b8
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b8f2c7d1e6a3"
down_revision = "a7c3e9f1d4b8"
branch_labels = None
depends_on = None


def _base_cols(name):
    """BaseModel mirror: UUID PK + tz-aware timestamps + soft delete."""
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{name}")),
    ]


def _school_fk(name):
    return sa.ForeignKeyConstraint(
        ["school_id"], ["schools.id"], name=op.f(f"fk_{name}_school_id_schools")
    )


def upgrade():
    # --- textbook spine -----------------------------------------------------
    op.create_table(
        "textbook_corpora",
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("framework_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title_en", sa.String(length=300), nullable=False),
        sa.Column("title_ne", sa.String(length=300), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=False),
        sa.Column("subject_code", sa.String(length=50), nullable=False),
        sa.Column("edition_bs", sa.String(length=20), nullable=True),
        sa.Column("edition_ad", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(length=20), server_default=sa.text("'ne'"), nullable=False),
        sa.Column("source_pdf_path", sa.Text(), nullable=False),
        sa.Column("total_pages", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("is_translation", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("font_encoding", sa.String(length=30), server_default=sa.text("'unicode'"), nullable=False),
        sa.Column("is_teacher_guide", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_spec_grid", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        *_base_cols("textbook_corpora"),
        _school_fk("textbook_corpora"),
        sa.ForeignKeyConstraint(
            ["framework_id"], ["curriculum_frameworks.id"],
            name=op.f("fk_textbook_corpora_framework_id_curriculum_frameworks"),
        ),
    )
    for col in ("school_id", "framework_id", "grade", "subject_code"):
        op.create_index(op.f(f"ix_textbook_corpora_{col}"), "textbook_corpora", [col])

    op.create_table(
        "textbook_pages",
        sa.Column("textbook_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("printed_page_number", sa.String(length=20), nullable=True),
        sa.Column("width_pts", sa.Numeric(7, 2), server_default=sa.text("595.0"), nullable=False),
        sa.Column("height_pts", sa.Numeric(7, 2), server_default=sa.text("842.0"), nullable=False),
        sa.Column("raw_text_extracted", sa.Text(), nullable=True),
        sa.Column("unicode_clean_text", sa.Text(), nullable=True),
        sa.Column("has_equations", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("has_diagrams", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("image_storage_path", sa.Text(), nullable=True),
        *_base_cols("textbook_pages"),
        sa.ForeignKeyConstraint(
            ["textbook_id"], ["textbook_corpora.id"],
            name=op.f("fk_textbook_pages_textbook_id_textbook_corpora"), ondelete="CASCADE",
        ),
        sa.UniqueConstraint("textbook_id", "page_number", name="uq_textbook_page_no"),
    )
    op.create_index(op.f("ix_textbook_pages_textbook_id"), "textbook_pages", ["textbook_id"])

    op.create_table(
        "textbook_chapters",
        sa.Column("textbook_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("curriculum_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("chapter_no", sa.Integer(), nullable=False),
        sa.Column("title_en", sa.String(length=300), nullable=False),
        sa.Column("title_ne", sa.String(length=300), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=False),
        sa.Column("page_end", sa.Integer(), nullable=False),
        *_base_cols("textbook_chapters"),
        sa.ForeignKeyConstraint(
            ["textbook_id"], ["textbook_corpora.id"],
            name=op.f("fk_textbook_chapters_textbook_id_textbook_corpora"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["curriculum_unit_id"], ["curriculum_units.id"],
            name=op.f("fk_textbook_chapters_curriculum_unit_id_curriculum_units"),
        ),
    )
    op.create_index(op.f("ix_textbook_chapters_textbook_id"), "textbook_chapters", ["textbook_id"])
    op.create_index(
        op.f("ix_textbook_chapters_curriculum_unit_id"), "textbook_chapters", ["curriculum_unit_id"]
    )

    op.create_table(
        "textbook_sections",
        sa.Column("chapter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teaching_section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("section_no", sa.String(length=30), nullable=False),
        sa.Column("title_en", sa.String(length=300), nullable=False),
        sa.Column("title_ne", sa.String(length=300), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=False),
        sa.Column("page_end", sa.Integer(), nullable=False),
        *_base_cols("textbook_sections"),
        sa.ForeignKeyConstraint(
            ["chapter_id"], ["textbook_chapters.id"],
            name=op.f("fk_textbook_sections_chapter_id_textbook_chapters"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["teaching_section_id"], ["teaching_sections.id"],
            name=op.f("fk_textbook_sections_teaching_section_id_teaching_sections"),
        ),
    )
    op.create_index(op.f("ix_textbook_sections_chapter_id"), "textbook_sections", ["chapter_id"])
    op.create_index(
        op.f("ix_textbook_sections_teaching_section_id"), "textbook_sections", ["teaching_section_id"]
    )

    op.create_table(
        "textbook_assets",
        sa.Column("textbook_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_type", sa.String(length=30), nullable=False),
        sa.Column("bbox_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("caption_en", sa.Text(), nullable=True),
        sa.Column("caption_ne", sa.Text(), nullable=True),
        sa.Column("image_storage_path", sa.Text(), nullable=False),
        sa.Column("svg_vector_path", sa.Text(), nullable=True),
        sa.Column("vision_description", sa.Text(), nullable=True),
        *_base_cols("textbook_assets"),
        sa.ForeignKeyConstraint(
            ["textbook_id"], ["textbook_corpora.id"],
            name=op.f("fk_textbook_assets_textbook_id_textbook_corpora"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["page_id"], ["textbook_pages.id"],
            name=op.f("fk_textbook_assets_page_id_textbook_pages"), ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_textbook_assets_textbook_id"), "textbook_assets", ["textbook_id"])
    op.create_index(op.f("ix_textbook_assets_page_id"), "textbook_assets", ["page_id"])

    # --- pedagogical knowledge graph ---------------------------------------
    op.create_table(
        "curriculum_concepts",
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=False),
        sa.Column("subject_code", sa.String(length=32), nullable=False),
        sa.Column("name_np", sa.String(length=255), nullable=False),
        sa.Column("name_en", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "bloom_level", sa.String(length=32), server_default=sa.text("'understanding'"), nullable=False
        ),
        *_base_cols("curriculum_concepts"),
        _school_fk("curriculum_concepts"),
    )
    for col in ("school_id", "grade", "subject_code"):
        op.create_index(op.f(f"ix_curriculum_concepts_{col}"), "curriculum_concepts", [col])
    # code is unique+indexed in the model — SQLAlchemy emits a UNIQUE index.
    op.create_index(
        op.f("ix_curriculum_concepts_code"), "curriculum_concepts", ["code"], unique=True
    )

    op.create_table(
        "concept_prerequisites",
        sa.Column("concept_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prerequisite_concept_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dependency_weight", sa.Numeric(3, 2), server_default=sa.text("1.00"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        *_base_cols("concept_prerequisites"),
        sa.ForeignKeyConstraint(
            ["concept_id"], ["curriculum_concepts.id"],
            name=op.f("fk_concept_prerequisites_concept_id_curriculum_concepts"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["prerequisite_concept_id"], ["curriculum_concepts.id"],
            name=op.f("fk_concept_prerequisites_prerequisite_concept_id_curriculum_concepts"),
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "concept_id", "prerequisite_concept_id", name="uq_concept_dependency"
        ),
        sa.CheckConstraint(
            "concept_id != prerequisite_concept_id", name="chk_prevent_self_dependency"
        ),
    )
    op.create_index(
        op.f("ix_concept_prerequisites_concept_id"), "concept_prerequisites", ["concept_id"]
    )
    op.create_index(
        op.f("ix_concept_prerequisites_prerequisite_concept_id"),
        "concept_prerequisites",
        ["prerequisite_concept_id"],
    )

    op.create_table(
        "concept_misconceptions",
        sa.Column("concept_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("misconception_label_np", sa.String(length=255), nullable=False),
        sa.Column("misconception_label_en", sa.String(length=255), nullable=False),
        sa.Column("remedial_strategy", sa.Text(), nullable=False),
        sa.Column("distractor_patterns", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_base_cols("concept_misconceptions"),
        sa.ForeignKeyConstraint(
            ["concept_id"], ["curriculum_concepts.id"],
            name=op.f("fk_concept_misconceptions_concept_id_curriculum_concepts"), ondelete="CASCADE",
        ),
    )
    op.create_index(
        op.f("ix_concept_misconceptions_concept_id"), "concept_misconceptions", ["concept_id"]
    )

    # --- composite question bank --------------------------------------------
    op.create_table(
        "question_subparts",
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("part_order", sa.Integer(), nullable=False),
        sa.Column("part_label", sa.String(length=10), nullable=False),
        sa.Column("prompt_en", sa.Text(), nullable=False),
        sa.Column("prompt_ne", sa.Text(), nullable=True),
        sa.Column("marks", sa.Numeric(4, 2), server_default=sa.text("1.0"), nullable=False),
        sa.Column("bloom_level", sa.String(length=30), server_default=sa.text("'understanding'"), nullable=False),
        sa.Column("correct_answer_en", sa.Text(), nullable=True),
        sa.Column("correct_answer_ne", sa.Text(), nullable=True),
        sa.Column("solution_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        *_base_cols("question_subparts"),
        _school_fk("question_subparts"),
        sa.ForeignKeyConstraint(
            ["parent_question_id"], ["question_bank_items.id"],
            name=op.f("fk_question_subparts_parent_question_id_question_bank_items"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["textbook_assets.id"],
            name=op.f("fk_question_subparts_asset_id_textbook_assets"),
        ),
    )
    op.create_index(op.f("ix_question_subparts_school_id"), "question_subparts", ["school_id"])
    op.create_index(
        op.f("ix_question_subparts_parent_question_id"), "question_subparts", ["parent_question_id"]
    )

    op.create_table(
        "question_rubric_steps",
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subpart_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("step_no", sa.Integer(), nullable=False),
        sa.Column("criterion_en", sa.String(length=300), nullable=False),
        sa.Column("criterion_ne", sa.String(length=300), nullable=True),
        sa.Column("allocated_marks", sa.Numeric(4, 2), nullable=False),
        *_base_cols("question_rubric_steps"),
        _school_fk("question_rubric_steps"),
        sa.ForeignKeyConstraint(
            ["question_id"], ["question_bank_items.id"],
            name=op.f("fk_question_rubric_steps_question_id_question_bank_items"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subpart_id"], ["question_subparts.id"],
            name=op.f("fk_question_rubric_steps_subpart_id_question_subparts"), ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_question_rubric_steps_school_id"), "question_rubric_steps", ["school_id"])
    op.create_index(
        op.f("ix_question_rubric_steps_question_id"), "question_rubric_steps", ["question_id"]
    )
    op.create_index(
        op.f("ix_question_rubric_steps_subpart_id"), "question_rubric_steps", ["subpart_id"]
    )

    # question_bank_items composite extensions (server defaults required —
    # the table holds live rows on existing deployments).
    op.add_column(
        "question_bank_items",
        sa.Column("is_composite", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("question_bank_items", sa.Column("stimulus_en", sa.Text(), nullable=True))
    op.add_column("question_bank_items", sa.Column("stimulus_ne", sa.Text(), nullable=True))
    op.add_column("question_bank_items", sa.Column("solution_latex", sa.Text(), nullable=True))
    op.add_column("question_bank_items", sa.Column("estimated_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "question_bank_items",
        sa.Column(
            "common_misconceptions",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "question_bank_items",
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "question_bank_items",
        sa.Column("textbook_section_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("question_bank_items", sa.Column("source_page_no", sa.Integer(), nullable=True))
    op.add_column(
        "question_bank_items",
        sa.Column("jaccard_content_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_question_bank_items_jaccard_content_hash"),
        "question_bank_items",
        ["jaccard_content_hash"],
    )
    op.create_foreign_key(
        op.f("fk_question_bank_items_asset_id_textbook_assets"),
        "question_bank_items",
        "textbook_assets",
        ["asset_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_question_bank_items_textbook_section_id_textbook_sections"),
        "question_bank_items",
        "textbook_sections",
        ["textbook_section_id"],
        ["id"],
    )

    # --- pre-existing model/migration drift, closed here (W5-B #7 follow-up) --
    # a03 created these columns without FK constraints; the model declares
    # them. Constraints are VALIDATEd — the test chain created them empty, but
    # validation still runs in this transaction so a fresh deploy is consistent.
    # subject_id/class_id indexes already exist from a03 — FKs only here.
    for fk_name, ref_col, ref_table in (
        ("fk_question_bank_items_subject_id_subjects", "subject_id", "subjects"),
        ("fk_question_bank_items_class_id_classes", "class_id", "classes"),
        ("fk_question_bank_items_created_by_id_users", "created_by_id", "users"),
    ):
        op.create_foreign_key(
            op.f(fk_name), "question_bank_items", ref_table, [ref_col], ["id"],
            ondelete=None,
        )
        op.execute(
            f"ALTER TABLE question_bank_items VALIDATE CONSTRAINT {op.f(fk_name)}"
        )

    # document_chunks.source_type: RAG migration shipped an ENUM, the model is
    # String(30) — align to the model.
    op.alter_column(
        "document_chunks",
        "source_type",
        existing_type=sa.Enum(
            "curriculum", "textbook", "notice", "policy", "past_paper", "lesson",
            name="chunk_source_type",
        ),
        type_=sa.String(length=30),
        existing_nullable=False,
    )

    # teaching_misconceptions.version_id index: migration named it
    # ix_tm_version, the model emits ix_teaching_misconceptions_version_id.
    # Guarded: some databases already have one or both index names.
    op.execute("DROP INDEX IF EXISTS ix_tm_version")
    op.execute("DROP INDEX IF EXISTS ix_teaching_misconceptions_version_id")
    op.create_index(
        op.f("ix_teaching_misconceptions_version_id"),
        "teaching_misconceptions",
        ["version_id"],
    )


def downgrade():
    op.create_index(
        "ix_tm_version", "teaching_misconceptions", ["version_id"]
    )
    op.drop_index(
        op.f("ix_teaching_misconceptions_version_id"), table_name="teaching_misconceptions"
    )
    op.alter_column(
        "document_chunks",
        "source_type",
        existing_type=sa.String(length=30),
        type_=sa.Enum(
            "curriculum", "textbook", "notice", "policy", "past_paper", "lesson",
            name="chunk_source_type",
        ),
        existing_nullable=False,
        postgresql_using="source_type::chunk_source_type",
    )
    for fk_name in (
        "fk_question_bank_items_created_by_id_users",
        "fk_question_bank_items_class_id_classes",
        "fk_question_bank_items_subject_id_subjects",
    ):
        op.drop_constraint(op.f(fk_name), "question_bank_items", type_="foreignkey")
    op.drop_constraint(
        op.f("fk_question_bank_items_textbook_section_id_textbook_sections"), "question_bank_items",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_question_bank_items_asset_id_textbook_assets"), "question_bank_items",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_question_bank_items_jaccard_content_hash"), table_name="question_bank_items"
    )
    for col in (
        "jaccard_content_hash",
        "source_page_no",
        "textbook_section_id",
        "asset_id",
        "common_misconceptions",
        "estimated_minutes",
        "solution_latex",
        "stimulus_ne",
        "stimulus_en",
        "is_composite",
    ):
        op.drop_column("question_bank_items", col)

    for table in (
        "question_rubric_steps",
        "question_subparts",
        "concept_misconceptions",
        "concept_prerequisites",
        "curriculum_concepts",
        "textbook_assets",
        "textbook_sections",
        "textbook_chapters",
        "textbook_pages",
        "textbook_corpora",
    ):
        op.drop_table(table)
