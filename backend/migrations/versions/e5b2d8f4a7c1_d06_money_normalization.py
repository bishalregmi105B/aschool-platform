"""D-06: money normalization tables — class_subjects, section_subject_teachers,
fee_structure_items

Revision ID: e5b2d8f4a7c1
Revises: d8a1f4c7b2e9
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e5b2d8f4a7c1"
down_revision = "d8a1f4c7b2e9"
branch_labels = None
depends_on = None


def _school_table(name, cols, uq):
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        *cols,
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f(f"fk_{name}_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{name}")),
        sa.UniqueConstraint(*uq[0], name=uq[1]),
    ]


def upgrade():
    for enum_name, values in (
        ("class_subject_type", "'core', 'optional', 'practical'"),
        ("fee_item_frequency", "'one_time', 'monthly', 'quarterly', 'semi_annual', 'annual'"),
    ):
        op.execute(
            f"DO $$ BEGIN CREATE TYPE {enum_name} AS ENUM ({values}); "
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
        )

    op.create_table("class_subjects",
        *_school_table("class_subjects", [
            sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("subject_type", postgresql.ENUM("core", "optional", "practical", name="class_subject_type", create_type=False), nullable=True),
            sa.Column("credit_hours", sa.Numeric(4, 1), nullable=True),
            sa.Column("theory_full", sa.Integer(), nullable=True),
            sa.Column("theory_pass", sa.Integer(), nullable=True),
            sa.Column("practical_full", sa.Integer(), nullable=True),
            sa.Column("practical_pass", sa.Integer(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(["class_id"], ["classes.id"], name=op.f("fk_class_subjects_class_id_classes")),
            sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], name=op.f("fk_class_subjects_subject_id_subjects")),
            sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"], name=op.f("fk_class_subjects_academic_year_id_academic_years")),
        ], (["school_id", "class_id", "subject_id", "academic_year_id"], "uq_class_subject")),
    )
    op.create_index(op.f("ix_class_subjects_school_id"), "class_subjects", ["school_id"])
    op.create_index(op.f("ix_class_subjects_class_id"), "class_subjects", ["class_id"])
    op.create_index(op.f("ix_class_subjects_subject_id"), "class_subjects", ["subject_id"])
    op.create_index(op.f("ix_class_subjects_academic_year_id"), "class_subjects", ["academic_year_id"])

    op.create_table("section_subject_teachers",
        *_school_table("section_subject_teachers", [
            sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("class_subject_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(["section_id"], ["sections.id"], name=op.f("fk_section_subject_teachers_section_id_sections")),
            sa.ForeignKeyConstraint(["class_subject_id"], ["class_subjects.id"], name=op.f("fk_section_subject_teachers_class_subject_id_class_subjects")),
            sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], name=op.f("fk_section_subject_teachers_teacher_id_users")),
        ], (["school_id", "section_id", "class_subject_id", "teacher_id"], "uq_section_subject_teacher")),
    )
    op.create_index(op.f("ix_section_subject_teachers_school_id"), "section_subject_teachers", ["school_id"])
    op.create_index(op.f("ix_section_subject_teachers_section_id"), "section_subject_teachers", ["section_id"])
    op.create_index(op.f("ix_section_subject_teachers_class_subject_id"), "section_subject_teachers", ["class_subject_id"])
    op.create_index(op.f("ix_section_subject_teachers_teacher_id"), "section_subject_teachers", ["teacher_id"])

    op.create_table("fee_structure_items",
        *_school_table("fee_structure_items", [
            sa.Column("fee_structure_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("fee_type_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("frequency", postgresql.ENUM("one_time", "monthly", "quarterly", "semi_annual", "annual", name="fee_item_frequency", create_type=False), nullable=True),
            sa.Column("due_day_bs", sa.Integer(), nullable=True),
            sa.Column("is_mandatory", sa.Boolean(), nullable=True),
            sa.Column("cap_heading", sa.String(length=100), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["fee_structure_id"], ["fee_structures.id"], name=op.f("fk_fee_structure_items_fee_structure_id_fee_structures")),
            sa.ForeignKeyConstraint(["fee_type_id"], ["fee_types.id"], name=op.f("fk_fee_structure_items_fee_type_id_fee_types")),
        ], (["school_id", "fee_structure_id", "name"], "uq_fee_structure_item_name")),
    )
    op.create_index(op.f("ix_fee_structure_items_school_id"), "fee_structure_items", ["school_id"])
    op.create_index(op.f("ix_fee_structure_items_fee_structure_id"), "fee_structure_items", ["fee_structure_id"])
    op.create_index(op.f("ix_fee_structure_items_fee_type_id"), "fee_structure_items", ["fee_type_id"])


def downgrade():
    op.drop_table("fee_structure_items")
    op.drop_table("section_subject_teachers")
    op.drop_table("class_subjects")
    # enum types left in place (columns may reference them across history)



# W-04 contact_messages table (appended migration — same release)
# Implemented as a separate revision to keep e5b2d8f4a7c1 D-06-pure.
