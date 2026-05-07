"""add lms topics/materials and online exams

Revision ID: f2d4c7a9b001
Revises: 28636966600d, 9d4d0b8f3c21
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2d4c7a9b001"
down_revision: Union[str, Sequence[str], None] = ("28636966600d", "9d4d0b8f3c21")
branch_labels = None
depends_on = None


def _base_columns():
    return [
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "school_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("schools.id"),
            nullable=False,
        ),
    ]


def upgrade():
    op.create_table(
        "topics",
        *_base_columns(),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("is_published", sa.Boolean(), server_default="true"),
    )
    op.create_index("idx_topics_school_lesson", "topics", ["school_id", "lesson_id"])

    op.create_table(
        "study_materials",
        *_base_columns(),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id")),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("topics.id")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("material_type", sa.String(30), server_default="file"),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("thumbnail_url", sa.Text()),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("is_published", sa.Boolean(), server_default="true"),
    )
    op.create_index("idx_study_materials_school_topic", "study_materials", ["school_id", "topic_id"])
    op.create_index("idx_study_materials_school_lesson", "study_materials", ["school_id", "lesson_id"])

    op.create_table(
        "online_exams",
        *_base_columns(),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id")),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sections.id")),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subjects.id")),
        sa.Column("duration_minutes", sa.Integer(), server_default="30"),
        sa.Column("total_marks", sa.Integer(), server_default="0"),
        sa.Column("total_questions", sa.Integer(), server_default="0"),
        sa.Column("questions", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb")),
        sa.Column("start_at", sa.DateTime()),
        sa.Column("end_at", sa.DateTime()),
        sa.Column("status", sa.String(20), server_default="upcoming"),
        sa.Column("instructions", sa.Text()),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
    )
    op.create_index("idx_online_exams_school_class", "online_exams", ["school_id", "class_id"])
    op.create_index("idx_online_exams_school_subject", "online_exams", ["school_id", "subject_id"])

    op.create_table(
        "online_exam_attempts",
        *_base_columns(),
        sa.Column("online_exam_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("online_exams.id"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("answers", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("score", sa.Numeric(8, 2)),
        sa.Column("status", sa.String(20), server_default="submitted"),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("submitted_at", sa.DateTime()),
    )
    op.create_index("idx_online_attempts_exam_student", "online_exam_attempts", ["online_exam_id", "student_id"])


def downgrade():
    op.drop_table("online_exam_attempts")
    op.drop_table("online_exams")
    op.drop_table("study_materials")
    op.drop_table("topics")
