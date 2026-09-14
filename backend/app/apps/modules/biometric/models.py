"""Biometric (ZKTeco fingerprint attendance) plugin models.

Three tables:
- biometric_devices: registered fingerprint devices per school. Each device
  authenticates to the ingest API with a per-device API key (only the SHA-256
  hash is stored; the plaintext key is shown once at creation).
- biometric_punches: raw punches reported by devices, kept as the source of
  truth (including punches that could not be mapped to a student), with
  DB-level idempotency so device retries/replays never create duplicates.
- biometric_sync_logs: one row per ingest batch or manual sync, powering the
  "Sync Logs" screen (records synced/failed, duration, status).
"""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel
from extensions import db


class BiometricDevice(SchoolModel):
    """A biometric attendance device (e.g. ZKTeco fingerprint terminal)."""

    __tablename__ = "biometric_devices"
    __table_args__ = (
        UniqueConstraint("school_id", "serial_number", name="uq_biometric_device_serial"),
    )

    name = Column(String(120), nullable=False)
    serial_number = Column(String(100))
    ip_address = Column(String(45))
    port = Column(Integer, nullable=False, server_default="4370")
    location = Column(String(200))
    model = Column(String(100))

    # Per-device API key. Only the SHA-256 hex digest is persisted; the
    # plaintext is returned exactly once (device create / key regenerate).
    api_key_hash = Column(String(64), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, server_default="true", default=True)

    # Health / last-seen, updated by device heartbeat and ingest calls.
    last_seen_at = Column(DateTime)
    last_ip = Column(String(45))
    last_sync_at = Column(DateTime)

    punches = relationship(
        "BiometricPunch", backref="device", passive_deletes=True
    )

    def to_dict(self, include_key=False):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id),
            "name": self.name,
            "serial_number": self.serial_number,
            "ip_address": self.ip_address,
            "port": self.port,
            "location": self.location,
            "model": self.model,
            "is_active": self.is_active,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "last_sync": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "last_ip": self.last_ip,
        }


class BiometricPunch(SchoolModel):
    """A single fingerprint punch reported by a device.

    Idempotency: a device replaying a batch must not create duplicate rows.
    Two DB guards:
    - uq_biometric_punch_device_punch on (device_id, device_punch_id) when a
      device-local punch id is supplied;
    - uq_biometric_punch_natural on (device_id, device_user_id, punched_at)
      for devices that never send punch ids.
    """

    __tablename__ = "biometric_punches"
    __table_args__ = (
        Index(
            "uq_biometric_punch_device_punch",
            "device_id", "device_punch_id",
            unique=True,
            postgresql_where=text("device_punch_id IS NOT NULL"),
        ),
        Index("uq_biometric_punch_natural", "device_id", "device_user_id", "punched_at", unique=True),
        Index("ix_biometric_punch_school_status", "school_id", "status"),
    )

    device_id = Column(
        UUID(as_uuid=True), ForeignKey("biometric_devices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    device_punch_id = Column(String(100))
    device_user_id = Column(String(100), nullable=False)
    punched_at = Column(DateTime, nullable=False, index=True)
    direction = Column(String(10), server_default="unknown")  # in / out / unknown

    # Mapping result: pending → mapped | unmapped
    status = Column(String(20), nullable=False, server_default="pending")
    mapped_student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    attendance_id = Column(UUID(as_uuid=True), ForeignKey("attendance.id"))
    failure_reason = Column(String(255))
    raw = Column(JSONB)

    student = relationship("Student")
    attendance = relationship("Attendance")

    def to_dict(self):
        return {
            "id": str(self.id),
            "device_id": str(self.device_id),
            "device_punch_id": self.device_punch_id,
            "device_user_id": self.device_user_id,
            "punched_at": self.punched_at.isoformat() if self.punched_at else None,
            "direction": self.direction,
            "status": self.status,
            "mapped_student_id": str(self.mapped_student_id) if self.mapped_student_id else None,
            "attendance_id": str(self.attendance_id) if self.attendance_id else None,
            "failure_reason": self.failure_reason,
        }


class BiometricSyncLog(SchoolModel):
    """One ingest batch or manual sync, for the Sync Logs screen."""

    __tablename__ = "biometric_sync_logs"

    device_id = Column(
        UUID(as_uuid=True), ForeignKey("biometric_devices.id", ondelete="SET NULL"),
        index=True,
    )
    # Denormalised so logs survive device deletion and are searchable.
    device_name = Column(String(120))
    trigger = Column(String(20), nullable=False, server_default="device")  # device | manual
    status = Column(String(20), nullable=False, server_default="success")  # success | partial | failed
    records_synced = Column(Integer, nullable=False, server_default="0")
    records_failed = Column(Integer, nullable=False, server_default="0")
    duplicates = Column(Integer, nullable=False, server_default="0")
    duration_seconds = Column(Float)
    detail = Column(JSONB)

    def to_dict(self):
        return {
            "id": str(self.id),
            "device_id": str(self.device_id) if self.device_id else None,
            "device_name": self.device_name,
            "trigger": self.trigger,
            "status": self.status,
            "records_synced": self.records_synced,
            "records_failed": self.records_failed,
            "duplicates": self.duplicates,
            "duration_seconds": self.duration_seconds,
            "detail": self.detail,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
