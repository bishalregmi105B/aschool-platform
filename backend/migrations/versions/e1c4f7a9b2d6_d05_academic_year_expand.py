"""D-05 (expand phase): academic_year_id on year-critical tables

Adds a nullable academic_year_id FK to marks, report_cards, attendance and
fee_receipts + backfills from students/exams. The NOT NULL contract and the
free-text academic_year column drops are the LATER contract migration — a
school's second academic year must not exist before the backfill ran
(04_DATAMODEL §P1-19).

Revision ID: e1c4f7a9b2d6
Revises: d7f2c8b3e9a4
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e1c4f7a9b2d6"
down_revision = "d7f2c8b3e9a4"
branch_labels = None
depends_on = None

_TABLES = ["marks", "report_cards", "attendance", "fee_receipts"]


def upgrade():
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            f"fk_{table}_academic_year_id_academic_years",
            table, "academic_years", ["academic_year_id"], ["id"],
        )
        op.create_index(f"ix_{table}_academic_year_id", table, ["academic_year_id"])

    # Backfill: marks/report_cards via the exam's year, attendance/fee via
    # the student's year. NULL-safe: rows with no anchor stay NULL and are
    # resolved by the contract migration.
    op.execute("""
        UPDATE marks m SET academic_year_id = e.academic_year_id
        FROM exams e WHERE e.id = m.exam_id AND e.academic_year_id IS NOT NULL
    """)
    op.execute("""
        UPDATE report_cards rc SET academic_year_id = e.academic_year_id
        FROM exams e WHERE e.id = rc.exam_id AND e.academic_year_id IS NOT NULL
    """)
    op.execute("""
        UPDATE attendance a SET academic_year_id = s.academic_year_id
        FROM students s WHERE s.id = a.student_id AND s.academic_year_id IS NOT NULL
    """)
    op.execute("""
        UPDATE fee_receipts fr SET academic_year_id = s.academic_year_id
        FROM students s WHERE s.id = fr.student_id AND s.academic_year_id IS NOT NULL
    """)


def downgrade():
    for table in _TABLES:
        op.drop_index(f"ix_{table}_academic_year_id", table_name=table)
        op.drop_constraint(
            f"fk_{table}_academic_year_id_academic_years", table, type_="foreignkey"
        )
        op.drop_column(table, "academic_year_id")
