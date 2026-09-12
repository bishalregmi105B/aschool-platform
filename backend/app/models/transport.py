"""Transport models: Bus, Route, BusStop, GPSLog."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Index,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Route(SchoolModel):
    __tablename__ = "routes"

    name = Column(String(200), nullable=False)
    description = Column(Text)
    distance_km = Column(Numeric(6, 2))
    estimated_time_mins = Column(Integer)
    is_active = Column(Boolean, default=True)


class Bus(SchoolModel):
    __tablename__ = "buses"

    vehicle_number = Column(String(20), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    conductor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    capacity = Column(Integer)
    current_students_count = Column(Integer, default=0)
    gps_device_id = Column(String(100))
    make = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    insurance_expiry = Column(DateTime)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"))
    is_active = Column(Boolean, default=True)

    driver = relationship("User", foreign_keys=[driver_id])
    conductor = relationship("User", foreign_keys=[conductor_id])
    route = relationship("Route", backref="buses")


class BusStop(SchoolModel):
    __tablename__ = "bus_stops"

    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    name = Column(String(200), nullable=False)
    name_nepali = Column(String(200))
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    sequence_number = Column(Integer)
    arrival_time_am = Column(Time)
    arrival_time_pm = Column(Time)
    student_ids = Column(ARRAY(UUID(as_uuid=True)))

    route = relationship("Route", backref="stops")


class GPSLog(SchoolModel):
    __tablename__ = "gps_logs"

    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    speed_kmh = Column(Float)
    heading = Column(Float)
    accuracy_m = Column(Float)
    timestamp = Column(DateTime, nullable=False)
    firebase_synced = Column(Boolean, default=False)

    bus = relationship("Bus", backref="gps_logs")


# ══════════════════════════════════════════════════════════════════════════
# S-A4 (A-10/A-11) — the 4-layer trip lifecycle (the SchoolBusTrack model,
# rebuilt for multi-tenant Postgres):
#   definition (TransportTrip) → daily instance (TransportTripInstance)
#   → per-stop planned/actual (TransportTripInstanceStop)
#   → per-student ride (TransportTripReservation, ride_status 0/1/2/3/4)
# plus per-student notification prefs (A-11) and the alert dedupe ledger.
# Timestamps are TIMESTAMPTZ (their TIME-only columns lose the date).
# ══════════════════════════════════════════════════════════════════════════

class TransportTrip(SchoolModel):
    """A recurring trip definition: one route run morning or afternoon on
    the selected weekdays, starting on effective_date_bs. Suspend = cancel
    instances for specific dates (holidays) via instances' status."""

    __tablename__ = "transport_trips"

    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False, index=True)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"))
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    direction = Column(
        Enum("morning", "afternoon", name="trip_direction"), nullable=False
    )
    effective_date_bs = Column(String(10))
    # ISO weekday ints present in the schedule, e.g. [0..6] (Mon=0) — []
    # = every day.
    weekdays = Column(JSONB, default=list)
    first_stop_time = Column(Time)          # local planned start
    stop_to_stop_avg_mins = Column(Integer, default=5)
    status = Column(
        Enum("active", "retired", name="trip_status"), default="active", index=True
    )
    name = Column(String(200))

    route = relationship("Route")
    bus = relationship("Bus")
    driver = relationship("User")


class TransportTripInstance(SchoolModel):
    """One concrete run on one date (materialized by the publish beat).
    Carries driver/bus snapshots so history survives reassignment, the
    last GPS fix (what parents render instantly), and a per-instance socket
    room name (private, JWT-scoped — never the public channels SBT used)."""

    __tablename__ = "transport_trip_instances"
    __table_args__ = (
        Index(
            "uq_transport_trip_instances_trip_date",
            "trip_id", "date",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    trip_id = Column(UUID(as_uuid=True), ForeignKey("transport_trips.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    date_bs = Column(String(10))
    direction = Column(Enum("morning", "afternoon", name="trip_direction"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"))
    status = Column(
        Enum("scheduled", "running", "completed", "cancelled", name="trip_instance_status"),
        default="scheduled", index=True,
    )
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    last_lat = Column(Numeric(10, 7))
    last_lng = Column(Numeric(10, 7))
    last_speed_kmh = Column(Float)
    last_fix_at = Column(DateTime(timezone=True))

    trip = relationship("TransportTrip", backref="instances")
    bus = relationship("Bus")
    driver = relationship("User")
    stops = relationship(
        "TransportTripInstanceStop", back_populates="instance",
        cascade="all, delete-orphan", order_by="TransportTripInstanceStop.seq",
    )


class TransportTripInstanceStop(SchoolModel):
    """Per-stop planned/actual pair. planned_ts derives from the trip's
    first_stop_time + per-stop offsets; actual_ts is stamped by the geofence
    engine (arrival) — TIMESTAMPTZ, never TIME-only."""

    __tablename__ = "transport_trip_instance_stops"

    instance_id = Column(
        UUID(as_uuid=True), ForeignKey("transport_trip_instances.id"),
        nullable=False, index=True,
    )
    stop_id = Column(UUID(as_uuid=True), ForeignKey("bus_stops.id"), nullable=False)
    seq = Column(Integer, nullable=False)
    planned_ts = Column(DateTime(timezone=True))
    actual_ts = Column(DateTime(timezone=True))

    instance = relationship("TransportTripInstance", back_populates="stops")
    stop = relationship("BusStop")


class TransportTripReservation(SchoolModel):
    """The board/alight register — ride_status IS the transport attendance:
    0 waiting, 1 onboard, 2 missed, 3 dropped, 4 absent (pre-marked)."""

    __tablename__ = "transport_trip_reservations"
    __table_args__ = (
        Index(
            "uq_transport_reservations_instance_student",
            "instance_id", "student_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    instance_id = Column(
        UUID(as_uuid=True), ForeignKey("transport_trip_instances.id"),
        nullable=False, index=True,
    )
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    start_stop_id = Column(UUID(as_uuid=True), ForeignKey("bus_stops.id"))
    end_stop_id = Column(UUID(as_uuid=True), ForeignKey("bus_stops.id"))
    ride_status = Column(Integer, nullable=False, default=0, index=True)
    boarded_at = Column(DateTime(timezone=True))
    dropped_at = Column(DateTime(timezone=True))
    fee_status = Column(String(20))     # ok|overdue|none — gate on the fees plugin

    instance = relationship("TransportTripInstance", backref="reservations")
    student = relationship("Student")


class TransportNotificationPref(SchoolModel):
    """Per-student notification toggles + approach radius (A-11). One row
    per student; missing row = sensible defaults (everything on, 150 m)."""

    __tablename__ = "transport_notification_prefs"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    near_pickup_radius_m = Column(Integer, default=150)
    near_dropoff_radius_m = Column(Integer, default=150)
    # 7 event toggles (bus_arrived_at_school is a dead switch in SBT — we
    # model only events the engine actually fires):
    notify_next_stop_pickup = Column(Boolean, default=True)
    notify_near_pickup = Column(Boolean, default=True)
    notify_arrived_pickup = Column(Boolean, default=True)
    notify_picked_up = Column(Boolean, default=True)
    notify_missed_pickup = Column(Boolean, default=True)
    notify_near_dropoff = Column(Boolean, default=True)
    notify_arrived_dropoff = Column(Boolean, default=True)

    student = relationship("Student")


class TransportAlertLog(SchoolModel):
    """Dedupe ledger: one alert per (instance, student, event) inside the
    dedupe window — a driver circling a stop must not spam guardians."""

    __tablename__ = "transport_alert_log"

    instance_id = Column(UUID(as_uuid=True), ForeignKey("transport_trip_instances.id"), index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    event = Column(String(40), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=False, default=func.now())



