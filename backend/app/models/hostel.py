"""Hostel management models — rooms, allocations, hostel fees."""
import uuid
from datetime import datetime, timezone

from app.extensions import db


class Hostel(db.Model):
    """A hostel building/block."""
    __tablename__ = "hostels"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), nullable=False, default="boys")  # boys | girls | mixed
    warden_name = db.Column(db.String(200))
    warden_phone = db.Column(db.String(20))
    total_capacity = db.Column(db.Integer, default=0)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    rooms = db.relationship("HostelRoom", backref="hostel", lazy="dynamic", cascade="all, delete-orphan")


class HostelRoom(db.Model):
    """A room inside a hostel."""
    __tablename__ = "hostel_rooms"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    hostel_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("hostels.id", ondelete="CASCADE"), nullable=False, index=True)
    room_number = db.Column(db.String(50), nullable=False)
    floor = db.Column(db.String(20))
    capacity = db.Column(db.Integer, nullable=False, default=1)
    room_type = db.Column(db.String(50), default="standard")  # standard | deluxe | dormitory
    monthly_fee = db.Column(db.Numeric(10, 2), default=0)
    is_active = db.Column(db.Boolean, default=True)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    allocations = db.relationship("HostelAllocation", backref="room", lazy="dynamic")

    @property
    def occupied_count(self):
        return self.allocations.filter_by(status="active", is_deleted=False).count()

    @property
    def is_full(self):
        return self.occupied_count >= self.capacity


class HostelAllocation(db.Model):
    """A student's allocation to a hostel room."""
    __tablename__ = "hostel_allocations"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("hostel_rooms.id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    check_in_date = db.Column(db.Date, nullable=False)
    check_out_date = db.Column(db.Date)
    status = db.Column(db.String(20), default="active")  # active | checked_out | cancelled
    notes = db.Column(db.Text)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = db.relationship("Student", backref="hostel_allocations", lazy="joined")
