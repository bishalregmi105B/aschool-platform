"""S-A3 platform services: user access logs (A-37), notification matrix
rules (A-02), mobile crash reports (A-30).

Revision ID: s_a3_platform_services
Revises: s_a2_exam_attendance
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s_a3_platform_services"
down_revision = "s_a2_exam_attendance"
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

# mobile_crash_reports is tenant-optional (a crash during school lookup has
# no tenant) — BaseModel pattern with a NULLABLE school_id column instead.
_CRASH_COLUMNS = [
    _BASE_COLUMNS[0],
    sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True),
    _BASE_COLUMNS[2],
    _BASE_COLUMNS[3],
    _BASE_COLUMNS[4],
]


def upgrade():
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), server_default=sa.text("false"),
                  nullable=False),
    )

    op.create_table(
        "user_access_logs",
        *_BASE_COLUMNS,
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event", sa.String(length=30), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("platform", sa.String(length=20), nullable=True),
        sa.Column("login_id", sa.String(length=200), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_access_logs_user_id", "user_access_logs", ["user_id"])
    op.create_index(
        "ix_user_access_logs_school_created", "user_access_logs",
        ["school_id", "created_at"],
    )

    op.create_table(
        "notification_rules",
        *_BASE_COLUMNS,
        sa.Column("event_key", sa.String(length=100), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("audience_role", sa.String(length=30), server_default="",
                  nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("template_key", sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notification_rules_event_key", "notification_rules", ["event_key"])
    op.create_index(
        "uq_notification_rules_event_channel_role", "notification_rules",
        ["school_id", "event_key", "channel", "audience_role"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "mobile_crash_reports",
        *_CRASH_COLUMNS,
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("app", sa.String(length=20), nullable=True),
        sa.Column("app_version", sa.String(length=30), nullable=True),
        sa.Column("platform", sa.String(length=20), nullable=True),
        sa.Column("os_version", sa.String(length=60), nullable=True),
        sa.Column("error", sa.String(length=500), nullable=False),
        sa.Column("stack", sa.Text(), nullable=True),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("handled", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mobile_crash_reports_school_id", "mobile_crash_reports", ["school_id"])
    op.create_index("ix_mobile_crash_reports_user_id", "mobile_crash_reports", ["user_id"])


def downgrade():
    op.drop_index("ix_mobile_crash_reports_user_id", table_name="mobile_crash_reports")
    op.drop_index("ix_mobile_crash_reports_school_id", table_name="mobile_crash_reports")
    op.drop_table("mobile_crash_reports")
    op.drop_index("uq_notification_rules_event_channel_role", table_name="notification_rules")
    op.drop_index("ix_notification_rules_event_key", table_name="notification_rules")
    op.drop_table("notification_rules")
    op.drop_index("ix_user_access_logs_school_created", table_name="user_access_logs")
    op.drop_index("ix_user_access_logs_user_id", table_name="user_access_logs")
    op.drop_table("user_access_logs")
    op.drop_column("users", "must_change_password")
