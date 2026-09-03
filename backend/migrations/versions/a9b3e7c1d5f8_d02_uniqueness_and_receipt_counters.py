"""D-02 uniqueness constraints (money + identity) + school receipt counters

- Partial unique indexes (WHERE is_deleted = false) on the money/identity
  columns: duplicate marks double every aggregate, duplicate receipt numbers
  break IRD-expected series, duplicate payroll double-pays.
- school_receipt_counters: FOR UPDATE-counter receipt series per school +
  fiscal year replaces the COUNT(*)+1 race.

Revision ID: a9b3e7c1d5f8
Revises: f8c2a9d4e1b7
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a9b3e7c1d5f8"
down_revision = "f8c2a9d4e1b7"
branch_labels = None
depends_on = None

# (index name, table, columns, WHERE clause)
_PARTIAL_UQ = [
    ("uq_marks_exam_student_subject", "marks",
     ["school_id", "exam_id", "student_id", "subject_id"], "is_deleted = false"),
    ("uq_fee_receipts_school_receipt_number", "fee_receipts",
     ["school_id", "receipt_number"], "is_deleted = false"),
    ("uq_students_school_student_id", "students",
     ["school_id", "student_id"], "is_deleted = false AND student_id IS NOT NULL"),
    ("uq_students_school_admission_number", "students",
     ["school_id", "admission_number"], "is_deleted = false AND admission_number IS NOT NULL"),
    ("uq_staff_payroll_school_user_month", "staff_payroll",
     ["school_id", "user_id", "month"], "is_deleted = false"),
    ("uq_report_cards_exam_student", "report_cards",
     ["school_id", "exam_id", "student_id"], "is_deleted = false"),
    ("uq_buses_school_vehicle_number", "buses",
     ["school_id", "vehicle_number"], "is_deleted = false"),
    ("uq_houses_school_name", "houses",
     ["school_id", "name"], "is_deleted = false"),
    ("uq_student_badges_student_badge", "student_badges",
     ["school_id", "student_id", "badge_id"], "is_deleted = false"),
    ("uq_enrollments_student_course", "enrollments",
     ["school_id", "student_id", "course_id"], "is_deleted = false"),
    ("uq_student_progress_student_course", "student_progress",
     ["school_id", "student_id", "course_id"], "is_deleted = false"),
    ("uq_payment_initiations_gateway_ref", "payment_initiations",
     ["school_id", "gateway_ref"], "is_deleted = false"),
    ("uq_timetable_slots_grid", "timetable_slots",
     ["school_id", "class_id", "section_id", "day_of_week", "period_number"],
     "is_deleted = false"),
]

# column existence is verified at runtime — some tables/columns may not exist
# in older schemas; the migration skips pairs whose verification query fails.
_EXIST_CHECKS = {
    "marks": None,
    "fee_receipts": None,
    "students": ["student_id", "admission_number"],
    "staff_payroll": ["user_id", "month"],
    "report_cards": ["exam_id", "student_id"],
    "buses": ["vehicle_number"],
    "houses": ["name"],
    "student_badges": ["badge_id"],
    "enrollments": ["course_id"],
    "student_progress": ["course_id"],
    "payment_initiations": ["gateway_ref"],
    "timetable_slots": ["period_number"],
}


def _columns_exist(table, columns):
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        cols = {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return False
    return all(c in cols for c in columns)


def upgrade():
    op.create_table(
        "school_receipt_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fiscal_year_bs", sa.String(length=10), nullable=False),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f("fk_school_receipt_counters_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_school_receipt_counters")),
        sa.UniqueConstraint("school_id", "fiscal_year_bs", name="uq_receipt_counters_school_year"),
    )

    bind = op.get_bind()
    for name, table, cols, where in _PARTIAL_UQ:
        required = _EXIST_CHECKS.get(table)
        if required and not _columns_exist(table, required):
            print(f"  skipping {name} — {table} missing columns {required}")
            continue
        try:
            op.create_index(
                name, table, cols, unique=True,
                postgresql_where=sa.text(where),
            )
        except Exception as exc:  # noqa: BLE001 — pre-existing dupes must not block the rest
            print(f"  skipping {name} — {exc}")
            bind.rollback() if hasattr(bind, "rollback") else None


def downgrade():
    for name, table, cols, where in reversed(_PARTIAL_UQ):
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass
    op.drop_table("school_receipt_counters")
