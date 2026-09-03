"""A-03: question bank + paper blueprint + generated papers tables

Revision ID: a3c8e2f5b7d9
Revises: f2a6b9c3d7e1
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a3c8e2f5b7d9"
down_revision = "f2a6b9c3d7e1"
branch_labels = None
depends_on = None


def _school_table(name, cols):
    args = [
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        *cols,
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f(f"fk_{name}_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{name}")),
    ]
    return args


def upgrade():
    op.create_table(
        "question_bank_items",
        *_school_table("question_bank_items", [
            sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("question_text", sa.Text(), nullable=False),
            sa.Column("question_text_nepali", sa.Text(), nullable=True),
            sa.Column("question_type", sa.Enum("mcq", "short_answer", "long_answer", "true_false", "fill_blank", "match", "numerical", name="question_bank_type"), nullable=False),
            sa.Column("difficulty", sa.Enum("easy", "medium", "hard", name="question_difficulty"), nullable=True),
            sa.Column("marks", sa.Numeric(5, 2), nullable=True),
            sa.Column("topic", sa.String(length=200), nullable=True),
            sa.Column("bloom_level", sa.String(length=50), nullable=True),
            sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("correct_answer", sa.Text(), nullable=True),
            sa.Column("explanation", sa.Text(), nullable=True),
            sa.Column("source", sa.Enum("manual", "ai", name="question_source"), nullable=True),
            sa.Column("ai_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("times_used", sa.Integer(), nullable=True),
            sa.Column("is_approved", sa.Boolean(), nullable=True),
        ]),
    )
    op.create_index(op.f("ix_question_bank_items_school_id"), "question_bank_items", ["school_id"])
    op.create_index(op.f("ix_question_bank_items_subject_id"), "question_bank_items", ["subject_id"])
    op.create_index(op.f("ix_question_bank_items_class_id"), "question_bank_items", ["class_id"])

    op.create_table(
        "paper_blueprints",
        *_school_table("paper_blueprints", [
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("total_marks", sa.Numeric(6, 2), nullable=False),
            sa.Column("duration_minutes", sa.Integer(), nullable=True),
            sa.Column("sections", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("language", sa.String(length=10), nullable=True),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        ]),
    )
    op.create_index(op.f("ix_paper_blueprints_school_id"), "paper_blueprints", ["school_id"])
    op.create_index(op.f("ix_paper_blueprints_subject_id"), "paper_blueprints", ["subject_id"])

    op.create_table(
        "generated_papers",
        *_school_table("generated_papers", [
            sa.Column("blueprint_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("title", sa.String(length=300), nullable=False),
            sa.Column("grade", sa.String(length=100), nullable=True),
            sa.Column("duration_minutes", sa.Integer(), nullable=True),
            sa.Column("total_marks", sa.Numeric(6, 2), nullable=True),
            sa.Column("instructions", sa.Text(), nullable=True),
            sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("language", sa.String(length=10), nullable=True),
        ]),
    )
    op.create_index(op.f("ix_generated_papers_school_id"), "generated_papers", ["school_id"])
    op.create_index(op.f("ix_generated_papers_subject_id"), "generated_papers", ["subject_id"])
    op.create_index(op.f("ix_generated_papers_blueprint_id"), "generated_papers", ["blueprint_id"])


def downgrade():
    op.drop_table("generated_papers")
    op.drop_table("paper_blueprints")
    op.drop_table("question_bank_items")
    op.execute("DROP TYPE IF EXISTS question_bank_type")
    op.execute("DROP TYPE IF EXISTS question_difficulty")
    op.execute("DROP TYPE IF EXISTS question_source")
