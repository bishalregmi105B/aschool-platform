"""add student diary tables

Revision ID: b9d2e7f4c120
Revises: a8c3d2e1f045
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b9d2e7f4c120"
down_revision: Union[str, None] = "a8c3d2e1f045"
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
    op.create_table(
        "diary_categories",
        *_school_columns(),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=20), server_default="blue", nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
    )
    op.create_index(op.f("ix_diary_categories_school_id"), "diary_categories", ["school_id"], unique=False)

    op.create_table(
        "diary_entries",
        *_school_columns(),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=True),
        sa.Column("attachment_urls", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["diary_categories.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )
    op.create_index(op.f("ix_diary_entries_school_id"), "diary_entries", ["school_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_diary_entries_school_id"), table_name="diary_entries")
    op.drop_table("diary_entries")
    op.drop_index(op.f("ix_diary_categories_school_id"), table_name="diary_categories")
    op.drop_table("diary_categories")
