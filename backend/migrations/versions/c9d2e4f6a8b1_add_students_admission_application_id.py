"""add students.admission_application_id

The admission.accepted auto-enrollment listener needs a durable link between
the auto-created Student and its AdmissionApplication so re-accepting an
application cannot create duplicate User/Student rows (idempotency key).

Revision ID: c9d2e4f6a8b1
Revises: e7a1c4f8b2d6
Create Date: 2026-08-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c9d2e4f6a8b1"
down_revision = "e7a1c4f8b2d6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "students",
        sa.Column("admission_application_id", postgresql.UUID(as_uuid=True),
                  nullable=True),
    )
    op.create_index(
        "ix_students_admission_application_id",
        "students",
        ["admission_application_id"],
    )
    op.create_foreign_key(
        "fk_students_admission_application_id",
        "students",
        "admission_applications",
        ["admission_application_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint("fk_students_admission_application_id", "students",
                       type_="foreignkey")
    op.drop_index("ix_students_admission_application_id", table_name="students")
    op.drop_column("students", "admission_application_id")
