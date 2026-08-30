"""add biometric plugin tables

Revision ID: b10c5d9e2f3a
Revises: 27312847ace7
Create Date: 2026-08-28 08:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b10c5d9e2f3a"
down_revision: Union[str, None] = "27312847ace7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Biometric devices (per-school, API-key authenticated)
    op.create_table(
        "biometric_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("serial_number", sa.String(100)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("port", sa.Integer, nullable=False, server_default="4370"),
        sa.Column("location", sa.String(200)),
        sa.Column("model", sa.String(100)),
        sa.Column("api_key_hash", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_seen_at", sa.DateTime),
        sa.Column("last_ip", sa.String(45)),
        sa.Column("last_sync_at", sa.DateTime),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("school_id", "serial_number", name="uq_biometric_device_serial"),
    )
    op.create_index("ix_biometric_devices_api_key_hash", "biometric_devices", ["api_key_hash"])
    op.create_index("ix_biometric_devices_school_id", "biometric_devices", ["school_id"])

    # Raw punches (source of truth; idempotent on device replay)
    op.create_table(
        "biometric_punches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biometric_devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_punch_id", sa.String(100)),
        sa.Column("device_user_id", sa.String(100), nullable=False),
        sa.Column("punched_at", sa.DateTime, nullable=False),
        sa.Column("direction", sa.String(10), server_default="unknown"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("mapped_student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("students.id")),
        sa.Column("attendance_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attendance.id")),
        sa.Column("failure_reason", sa.String(255)),
        sa.Column("raw", postgresql.JSONB),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    # Idempotency guards: a replayed punch (same device punch id, or same
    # device+user+timestamp) must never create a second row.
    op.create_index(
        "uq_biometric_punch_device_punch",
        "biometric_punches",
        ["device_id", "device_punch_id"],
        unique=True,
        postgresql_where=sa.text("device_punch_id IS NOT NULL"),
    )
    op.create_index(
        "uq_biometric_punch_natural",
        "biometric_punches",
        ["device_id", "device_user_id", "punched_at"],
        unique=True,
    )
    op.create_index("ix_biometric_punches_device_id", "biometric_punches", ["device_id"])
    op.create_index("ix_biometric_punches_punched_at", "biometric_punches", ["punched_at"])
    op.create_index("ix_biometric_punches_school_id", "biometric_punches", ["school_id"])
    op.create_index("ix_biometric_punch_school_status", "biometric_punches", ["school_id", "status"])

    # Sync logs (one per ingest batch or manual sync)
    op.create_table(
        "biometric_sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biometric_devices.id", ondelete="SET NULL")),
        sa.Column("device_name", sa.String(120)),
        sa.Column("trigger", sa.String(20), nullable=False, server_default="device"),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("records_synced", sa.Integer, nullable=False, server_default="0"),
        sa.Column("records_failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duplicates", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Float),
        sa.Column("detail", postgresql.JSONB),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_biometric_sync_logs_device_id", "biometric_sync_logs", ["device_id"])
    op.create_index("ix_biometric_sync_logs_school_id", "biometric_sync_logs", ["school_id"])


def downgrade() -> None:
    op.drop_table("biometric_sync_logs")
    op.drop_table("biometric_punches")
    op.drop_table("biometric_devices")
