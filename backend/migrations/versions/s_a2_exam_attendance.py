"""S-A2 exam & attendance depth: online-exam attempt uniqueness, mark
components, per-school grade scales, subject-wise attendance, holiday
attendance status (A-05, A-32, A-33).

Revision ID: s_a2_exam_attendance
Revises: s_a1_fees_depth
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s_a2_exam_attendance"
down_revision = "s_a1_fees_depth"
branch_labels = None
depends_on = None

_BASE_COLUMNS = [
    sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False,
              server_default=sa.text("gen_random_uuid()")),
    sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
]


def upgrade():
    # attendance_status enum gains 'holiday' (shared by Attendance and
    # SubjectAttendance — ADD VALUE cannot run inside a transaction block
    # with other DDL on older PG; commit first).
    op.execute("COMMIT")
    op.execute("ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'holiday'")
    op.execute("BEGIN")

    # A-05: one attempt row per (school, exam, student) — the duplicate-
    # submit loophole and the retake question are decided by the API, not
    # by how many rows the client can create.
    op.create_index(
        "uq_online_exam_attempts_one_per_student",
        "online_exam_attempts",
        ["school_id", "online_exam_id", "student_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    # A-32: component scores on marks + component definitions
    op.add_column("marks", sa.Column("components", postgresql.JSONB(astext_type=sa.Text()),
                                     nullable=True))
    op.create_table(
        "mark_components",
        *_BASE_COLUMNS,
        sa.Column("exam_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("max_mark", sa.Numeric(6, 2), nullable=False),
        sa.Column("pass_mark", sa.Numeric(6, 2), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mark_components_exam_id", "mark_components", ["exam_id"])
    op.create_index("ix_mark_components_subject_id", "mark_components", ["subject_id"])
    op.create_index(
        "uq_mark_components_exam_subject_name", "mark_components",
        ["school_id", "exam_id", "subject_id", "name"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "grade_scales",
        *_BASE_COLUMNS,
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("board", sa.String(length=20), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=True),
        sa.Column("rows", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_grade_scales_is_default", "grade_scales", ["is_default"])
    op.create_index(
        "uq_grade_scales_school_name", "grade_scales", ["school_id", "name"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    # A-33: subject/period-wise attendance register
    op.create_table(
        "subject_attendance",
        *_BASE_COLUMNS,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("date_bs", sa.String(length=10), nullable=True),
        sa.Column(
            "status", postgresql.ENUM(
                "present", "absent", "late", "half_day", "leave",
                name="attendance_status", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("marked_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["marked_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_subject_attendance_student_subject_date", "subject_attendance",
        ["school_id", "student_id", "subject_id", "date"], unique=True,
    )
    op.create_index("ix_subject_attendance_date", "subject_attendance", ["date"])


def downgrade():
    op.drop_index("ix_subject_attendance_date", table_name="subject_attendance")
    op.drop_index("uq_subject_attendance_student_subject_date", table_name="subject_attendance")
    op.drop_table("subject_attendance")
    op.drop_index("uq_grade_scales_school_name", table_name="grade_scales")
    op.drop_index("ix_grade_scales_is_default", table_name="grade_scales")
    op.drop_table("grade_scales")
    op.drop_index("uq_mark_components_exam_subject_name", table_name="mark_components")
    op.drop_index("ix_mark_components_subject_id", table_name="mark_components")
    op.drop_index("ix_mark_components_exam_id", table_name="mark_components")
    op.drop_table("mark_components")
    op.drop_column("marks", "components")
    op.drop_index("uq_online_exam_attempts_one_per_student", table_name="online_exam_attempts")
    # 'holiday' cannot be removed from the enum type safely (PG limitation);
    # it is inert once no column uses it — documented, not dropped.
