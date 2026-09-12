"""S-A5: student_enrollments + promotion_records (A-31) with a backfill of
one default enrollment per active student, plus the admission-funnel and
exit-document tables (A-09/A-22/A-35/A-36) are added by their own code in
this same wave — this migration carries ALL S-A5 schema.

Revision ID: s_a5_admission_funnel
Revises: s_a4_transport_trips
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s_a5_admission_funnel"
down_revision = "s_a4_transport_trips"
branch_labels = None
depends_on = None

_BASE = [
    sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False,
              server_default=sa.text("gen_random_uuid()")),
    sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
]

_OPT_SCHOOL = [
    sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False,
              server_default=sa.text("gen_random_uuid()")),
    sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
]


def upgrade():
    # ── A-31: enrollments + promotion snapshots ─────────────────────────
    op.create_table(
        "student_enrollments",
        *_BASE,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("academic_year_label", sa.String(length=10), nullable=True),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("roll_number", sa.Integer(), nullable=True),
        sa.Column("is_promoted", sa.Boolean(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=True),
        sa.Column("is_graduated", sa.Boolean(), nullable=True),
        sa.Column("promoted_from_enrollment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.ForeignKeyConstraint(["promoted_from_enrollment_id"], ["student_enrollments.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "student_id", "academic_year_id",
                            name="uq_student_enrollments_student_year"),
    )
    op.create_index("ix_student_enrollments_student_id", "student_enrollments", ["student_id"])
    op.create_index("ix_student_enrollments_academic_year_id", "student_enrollments",
                    ["academic_year_id"])

    op.create_table(
        "promotion_records",
        *_BASE,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_enrollment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("to_enrollment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("to_class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_roll_number", sa.Integer(), nullable=True),
        sa.Column("to_roll_number", sa.Integer(), nullable=True),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("performed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["from_enrollment_id"], ["student_enrollments.id"]),
        sa.ForeignKeyConstraint(["to_enrollment_id"], ["student_enrollments.id"]),
        sa.ForeignKeyConstraint(["from_class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["to_class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
        sa.ForeignKeyConstraint(["performed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_promotion_records_student_id", "promotion_records", ["student_id"])

    # Backfill: one default enrollment per non-deleted student from the
    # student's own current fields (additive — nothing is re-pointed yet).
    op.execute("""
        INSERT INTO student_enrollments
            (id, school_id, student_id, academic_year_id, academic_year_label,
             class_id, section_id, roll_number, is_promoted, is_default,
             is_graduated, created_at, updated_at, is_deleted)
        SELECT gen_random_uuid(), s.school_id, s.id, s.academic_year_id,
               s.academic_year, s.class_id, s.section_id, s.roll_number,
               false, true, false, now(), now(), false
        FROM students s
        WHERE s.is_deleted = false
        ON CONFLICT DO NOTHING
    """)

    # ── A-31: nullable enrollment anchors on the yearly ledgers ────────
    op.add_column("marks", sa.Column("enrollment_id", postgresql.UUID(as_uuid=True),
                                     nullable=True))
    op.add_column("attendance", sa.Column("enrollment_id", postgresql.UUID(as_uuid=True),
                                          nullable=True))
    op.add_column("fee_collections", sa.Column("enrollment_id", postgresql.UUID(as_uuid=True),
                                               nullable=True))
    op.create_foreign_key("fk_marks_enrollment", "marks", "student_enrollments",
                          ["enrollment_id"], ["id"])
    op.create_foreign_key("fk_attendance_enrollment", "attendance", "student_enrollments",
                          ["enrollment_id"], ["id"])
    op.create_foreign_key("fk_fee_collections_enrollment", "fee_collections",
                          "student_enrollments", ["enrollment_id"], ["id"])

    # ── A-35: dynamic registration/custom fields ────────────────────────
    op.create_table(
        "custom_field_defs",
        *_BASE,
        sa.Column("form_name", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("label_nepali", sa.String(length=200), nullable=True),
        sa.Column("field_type", sa.String(length=30), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=True),
        sa.Column("choices", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_custom_field_defs_form_name", "custom_field_defs", ["form_name"])
    op.add_column("students", sa.Column("dynamic_fields",
                                        postgresql.JSONB(astext_type=sa.Text()),
                                        nullable=True))
    op.add_column("staff", sa.Column("dynamic_fields",
                                     postgresql.JSONB(astext_type=sa.Text()),
                                     nullable=True))

    # ── A-09: admission funnel staging + seat caps ──────────────────────
    op.create_table(
        "admission_registrations",
        *_BASE,
        sa.Column("student_first_name", sa.String(length=120), nullable=False),
        sa.Column("student_last_name", sa.String(length=120), nullable=True),
        sa.Column("student_dob_bs", sa.String(length=10), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("guardian_name", sa.String(length=200), nullable=False),
        sa.Column("guardian_relation", sa.String(length=30), nullable=True),
        sa.Column("guardian_phone", sa.String(length=20), nullable=False),
        sa.Column("guardian_email", sa.String(length=200), nullable=True),
        sa.Column("previous_school", sa.String(length=200), nullable=True),
        sa.Column("applied_class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("documents", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("dynamic_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="submitted"),
        sa.Column("registration_number", sa.String(length=50), nullable=True),
        sa.Column("verification_token", sa.String(length=100), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=True),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["applied_class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["application_id"], ["admission_applications.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admission_registrations_status", "admission_registrations",
                    ["status"])
    op.create_index("ix_admission_registrations_token", "admission_registrations",
                    ["verification_token"])
    op.create_index("ix_admission_registrations_guardian_phone",
                    "admission_registrations", ["guardian_phone"])

    op.create_table(
        "enrollment_seats",
        *_BASE,
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("max_seat", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_enrollment_seats_class_year", "enrollment_seats",
        ["school_id", "class_id", "academic_year_id"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    # ── A-36: student exit documents ────────────────────────────────────
    op.create_table(
        "student_exit_documents",
        *_BASE,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("doc_type", sa.String(length=30), nullable=False),
        sa.Column("document_number", sa.String(length=50), nullable=False),
        sa.Column("issued_on_bs", sa.String(length=10), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("dues_cleared", sa.Boolean(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_student_exit_documents_number", "student_exit_documents",
        ["school_id", "document_number"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade():
    op.drop_index("uq_student_exit_documents_number", table_name="student_exit_documents")
    op.drop_table("student_exit_documents")
    op.drop_index("uq_enrollment_seats_class_year", table_name="enrollment_seats")
    op.drop_table("enrollment_seats")
    op.drop_index("ix_admission_registrations_guardian_phone",
                  table_name="admission_registrations")
    op.drop_index("ix_admission_registrations_token", table_name="admission_registrations")
    op.drop_index("ix_admission_registrations_status", table_name="admission_registrations")
    op.drop_table("admission_registrations")
    op.drop_column("staff", "dynamic_fields")
    op.drop_column("students", "dynamic_fields")
    op.drop_index("ix_custom_field_defs_form_name", table_name="custom_field_defs")
    op.drop_table("custom_field_defs")
    op.drop_constraint("fk_fee_collections_enrollment", "fee_collections", type_="foreignkey")
    op.drop_constraint("fk_attendance_enrollment", "attendance", type_="foreignkey")
    op.drop_constraint("fk_marks_enrollment", "marks", type_="foreignkey")
    op.drop_column("fee_collections", "enrollment_id")
    op.drop_column("attendance", "enrollment_id")
    op.drop_column("marks", "enrollment_id")
    op.drop_index("ix_promotion_records_student_id", table_name="promotion_records")
    op.drop_table("promotion_records")
    op.drop_index("ix_student_enrollments_academic_year_id", table_name="student_enrollments")
    op.drop_index("ix_student_enrollments_student_id", table_name="student_enrollments")
    op.drop_table("student_enrollments")
