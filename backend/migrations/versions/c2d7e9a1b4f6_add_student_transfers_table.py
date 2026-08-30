"""add student_transfers table (audit slice-2: transfers page had no backend)

The /dashboard/students/transfers page called GET/POST /students/transfers,
neither of which existed in the url_map. This migration adds the backing
table: one row per transfer certificate / withdrawal / migration issued for
a student.

Revision ID: c2d7e9a1b4f6
Revises: b7e2c9d4a5f3
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c2d7e9a1b4f6"
down_revision = "b7e2c9d4a5f3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "student_transfers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transfer_type", sa.String(length=20), nullable=False,
                  server_default="tc"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("destination_school", sa.String(length=300), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False,
                  server_default="completed"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_student_transfers_school_id", "student_transfers", ["school_id"]
    )
    op.create_index(
        "ix_student_transfers_student_id", "student_transfers", ["student_id"]
    )


def downgrade():
    op.drop_index("ix_student_transfers_student_id", table_name="student_transfers")
    op.drop_index("ix_student_transfers_school_id", table_name="student_transfers")
    op.drop_table("student_transfers")
