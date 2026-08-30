"""add learning_paths + mastery_records tables (ai_adaptive_learning E21)

The ai_adaptive_learning plugin (premium, NPR 1499) had a working service
layer (app/services.ai.adaptive_learning) but no storage: no LearningPath or
mastery model/table existed anywhere, so its API (added in
app/api/v1/adaptive_learning.py) had nothing to persist. This migration adds
the two SchoolModel tables the blueprint reads/writes.

Revision ID: e8a3d5f7c2b4
Revises: d5a9e7c1b3f2
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e8a3d5f7c2b4"
down_revision = "d5a9e7c1b3f2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "learning_paths",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("class_name", sa.String(length=120), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("subject", sa.String(length=120), nullable=True),
        sa.Column(
            "difficulty", sa.Enum(
                "easy", "medium", "hard", "adaptive",
                name="learning_path_difficulty",
            ),
            server_default="adaptive",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "steps", postgresql.JSONB(astext_type=sa.Text()),
            nullable=False, server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "recommended_topics", postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "focus_areas", postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "resources", postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("estimated_hours", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False,
                  server_default="manual"),
        sa.Column("source_note", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  server_default=sa.true()),
        # BaseModel columns
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_learning_paths_school_id"
        ),
        sa.ForeignKeyConstraint(
            ["student_id"], ["students.id"], name="fk_learning_paths_student_id"
        ),
    )
    op.create_index(
        "ix_learning_paths_school_id", "learning_paths", ["school_id"]
    )
    op.create_index(
        "ix_learning_paths_student_id", "learning_paths", ["student_id"]
    )

    op.create_table(
        "mastery_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(length=120), nullable=False),
        sa.Column(
            "mastery_level", sa.Enum(
                "beginner", "intermediate", "advanced", name="mastery_level",
            ),
            server_default="beginner", nullable=False,
        ),
        sa.Column("avg_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_assessments", sa.Integer(), nullable=False,
                  server_default="0"),
        sa.Column("source", sa.String(length=40), nullable=False,
                  server_default="computed"),
        sa.Column("notes", sa.Text(), nullable=True),
        # BaseModel columns
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_mastery_records_school_id"
        ),
        sa.ForeignKeyConstraint(
            ["student_id"], ["students.id"], name="fk_mastery_records_student_id"
        ),
        sa.UniqueConstraint(
            "school_id", "student_id", "subject",
            name="uq_mastery_school_student_subject",
        ),
    )
    op.create_index(
        "ix_mastery_records_school_id", "mastery_records", ["school_id"]
    )
    op.create_index(
        "ix_mastery_records_student_id", "mastery_records", ["student_id"]
    )


def downgrade():
    op.drop_index("ix_mastery_records_student_id", table_name="mastery_records")
    op.drop_index("ix_mastery_records_school_id", table_name="mastery_records")
    op.drop_table("mastery_records")
    op.execute("DROP TYPE IF EXISTS mastery_level")
    op.drop_index("ix_learning_paths_student_id", table_name="learning_paths")
    op.drop_index("ix_learning_paths_school_id", table_name="learning_paths")
    op.drop_table("learning_paths")
    op.execute("DROP TYPE IF EXISTS learning_path_difficulty")
