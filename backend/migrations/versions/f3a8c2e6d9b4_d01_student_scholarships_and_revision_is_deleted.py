"""D-01 live data-integrity fixes

1. student_scholarships — model shipped (app/models/fee.py) but no migration
   ever created the table: scholarship CRUD 500s in production and the
   auto-apply-at-generation discount lookup failed into a silent except-pass,
   billing students in full.
2. designer_document_revisions.is_deleted — table created by c7d9e1f3a5b2
   without the BaseModel soft-delete column, so every ORM save raised
   UndefinedColumn.

Revision ID: f3a8c2e6d9b4
Revises: c7d9e1f3a5b2
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f3a8c2e6d9b4"
down_revision = "c7d9e1f3a5b2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "student_scholarships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fee_type", sa.String(length=100), nullable=True),
        sa.Column("discount_type", sa.String(length=10), nullable=True),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("valid_from_bs", sa.String(length=20), nullable=True),
        sa.Column("valid_until_bs", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f("fk_student_scholarships_school_id_schools")),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_student_scholarships_student_id_students")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_student_scholarships")),
    )
    op.create_index(
        op.f("ix_student_scholarships_school_id"),
        "student_scholarships",
        ["school_id"],
    )
    op.create_index(
        op.f("ix_student_scholarships_student_id"),
        "student_scholarships",
        ["student_id"],
    )

    op.add_column(
        "designer_document_revisions",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade():
    op.drop_column("designer_document_revisions", "is_deleted")
    op.drop_index(op.f("ix_student_scholarships_student_id"), table_name="student_scholarships")
    op.drop_index(op.f("ix_student_scholarships_school_id"), table_name="student_scholarships")
    op.drop_table("student_scholarships")
