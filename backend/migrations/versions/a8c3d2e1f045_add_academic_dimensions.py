"""add academic semesters, mediums, streams, and shifts

Revision ID: a8c3d2e1f045
Revises: f2d4c7a9b001
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a8c3d2e1f045"
down_revision: Union[str, None] = "f2d4c7a9b001"
branch_labels = None
depends_on = None


def _school_columns():
    return [
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "school_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("schools.id"),
            nullable=False,
        ),
    ]


def upgrade():
    op.add_column("academic_years", sa.Column("name_nepali", sa.String(length=20), nullable=True))

    op.create_table(
        "mediums",
        *_school_columns(),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_nepali", sa.String(length=100), nullable=True),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.create_index(op.f("ix_mediums_school_id"), "mediums", ["school_id"], unique=False)

    op.create_table(
        "streams",
        *_school_columns(),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_nepali", sa.String(length=100), nullable=True),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("class_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.create_index(op.f("ix_streams_school_id"), "streams", ["school_id"], unique=False)

    op.create_table(
        "shifts",
        *_school_columns(),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_nepali", sa.String(length=100), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.create_index(op.f("ix_shifts_school_id"), "shifts", ["school_id"], unique=False)

    op.create_table(
        "semesters",
        *_school_columns(),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_nepali", sa.String(length=100), nullable=True),
        sa.Column("start_date_bs", sa.String(length=10), nullable=True),
        sa.Column("end_date_bs", sa.String(length=10), nullable=True),
        sa.Column("start_date_ad", sa.Date(), nullable=True),
        sa.Column("end_date_ad", sa.Date(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=True),
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
    )
    op.create_index(op.f("ix_semesters_school_id"), "semesters", ["school_id"], unique=False)
    op.create_index("idx_semesters_school_year", "semesters", ["school_id", "academic_year_id"], unique=False)

    op.add_column("classes", sa.Column("medium_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("classes", sa.Column("stream_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_classes_medium_id_mediums", "classes", "mediums", ["medium_id"], ["id"])
    op.create_foreign_key("fk_classes_stream_id_streams", "classes", "streams", ["stream_id"], ["id"])

    op.add_column("sections", sa.Column("medium_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("sections", sa.Column("shift_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_sections_medium_id_mediums", "sections", "mediums", ["medium_id"], ["id"])
    op.create_foreign_key("fk_sections_shift_id_shifts", "sections", "shifts", ["shift_id"], ["id"])

    op.add_column("subjects", sa.Column("stream_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_subjects_stream_id_streams", "subjects", "streams", ["stream_id"], ["id"])

    op.add_column("students", sa.Column("semester_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("students", sa.Column("stream_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("students", sa.Column("shift_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("students", sa.Column("medium_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_students_semester_id_semesters", "students", "semesters", ["semester_id"], ["id"])
    op.create_foreign_key("fk_students_stream_id_streams", "students", "streams", ["stream_id"], ["id"])
    op.create_foreign_key("fk_students_shift_id_shifts", "students", "shifts", ["shift_id"], ["id"])
    op.create_foreign_key("fk_students_medium_id_mediums", "students", "mediums", ["medium_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_students_medium_id_mediums", "students", type_="foreignkey")
    op.drop_constraint("fk_students_shift_id_shifts", "students", type_="foreignkey")
    op.drop_constraint("fk_students_stream_id_streams", "students", type_="foreignkey")
    op.drop_constraint("fk_students_semester_id_semesters", "students", type_="foreignkey")
    op.drop_column("students", "medium_id")
    op.drop_column("students", "shift_id")
    op.drop_column("students", "stream_id")
    op.drop_column("students", "semester_id")

    op.drop_constraint("fk_subjects_stream_id_streams", "subjects", type_="foreignkey")
    op.drop_column("subjects", "stream_id")

    op.drop_constraint("fk_sections_shift_id_shifts", "sections", type_="foreignkey")
    op.drop_constraint("fk_sections_medium_id_mediums", "sections", type_="foreignkey")
    op.drop_column("sections", "shift_id")
    op.drop_column("sections", "medium_id")

    op.drop_constraint("fk_classes_stream_id_streams", "classes", type_="foreignkey")
    op.drop_constraint("fk_classes_medium_id_mediums", "classes", type_="foreignkey")
    op.drop_column("classes", "stream_id")
    op.drop_column("classes", "medium_id")

    op.drop_index("idx_semesters_school_year", table_name="semesters")
    op.drop_index(op.f("ix_semesters_school_id"), table_name="semesters")
    op.drop_table("semesters")
    op.drop_index(op.f("ix_shifts_school_id"), table_name="shifts")
    op.drop_table("shifts")
    op.drop_index(op.f("ix_streams_school_id"), table_name="streams")
    op.drop_table("streams")
    op.drop_index(op.f("ix_mediums_school_id"), table_name="mediums")
    op.drop_table("mediums")
    op.drop_column("academic_years", "name_nepali")
