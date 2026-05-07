"""Transport models: Bus, Route, BusStop, GPSLog."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import UUID
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
