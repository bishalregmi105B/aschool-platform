"""S-A4 transport trip lifecycle: definitions, daily instances, per-stop
planned/actual, ride reservations, per-student notification prefs, alert
dedupe ledger (A-10/A-11).

Revision ID: s_a4_transport_trips
Revises: s_a3_platform_services
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s_a4_transport_trips"
down_revision = "s_a3_platform_services"
branch_labels = None
depends_on = None

_BASE = [
    sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False,
              server_default=sa.text("gen_random_uuid()")),
    sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
]


def _enum(name: str, *values: str) -> None:
    op.execute(
        f"DO $$ BEGIN CREATE TYPE {name} AS ENUM ({', '.join(repr(v) for v in values)}); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )


def upgrade():
    _enum("trip_direction", "morning", "afternoon")
    _enum("trip_status", "active", "retired")
    _enum("trip_instance_status", "scheduled", "running", "completed", "cancelled")

    op.create_table(
        "transport_trips",
        *_BASE,
        sa.Column("route_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bus_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("direction", postgresql.ENUM("morning", "afternoon",
                    name="trip_direction", create_type=False), nullable=False),
        sa.Column("effective_date_bs", sa.String(length=10), nullable=True),
        sa.Column("weekdays", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("first_stop_time", sa.Time(), nullable=True),
        sa.Column("stop_to_stop_avg_mins", sa.Integer(), nullable=True),
        sa.Column("status", postgresql.ENUM("active", "retired",
                    name="trip_status", create_type=False), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"]),
        sa.ForeignKeyConstraint(["bus_id"], ["buses.id"]),
        sa.ForeignKeyConstraint(["driver_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transport_trips_route_id", "transport_trips", ["route_id"])
    op.create_index("ix_transport_trips_status", "transport_trips", ["status"])

    op.create_table(
        "transport_trip_instances",
        *_BASE,
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("date_bs", sa.String(length=10), nullable=True),
        sa.Column("direction", postgresql.ENUM("morning", "afternoon",
                    name="trip_direction", create_type=False), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("bus_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", postgresql.ENUM("scheduled", "running", "completed",
                    "cancelled", name="trip_instance_status", create_type=False),
                    nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_lat", sa.Numeric(10, 7), nullable=True),
        sa.Column("last_lng", sa.Numeric(10, 7), nullable=True),
        sa.Column("last_speed_kmh", sa.Float(), nullable=True),
        sa.Column("last_fix_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["trip_id"], ["transport_trips.id"]),
        sa.ForeignKeyConstraint(["driver_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["bus_id"], ["buses.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transport_trip_instances_trip_id", "transport_trip_instances",
                    ["trip_id"])
    op.create_index("ix_transport_trip_instances_date", "transport_trip_instances", ["date"])
    op.create_index(
        "uq_transport_trip_instances_trip_date", "transport_trip_instances",
        ["trip_id", "date"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "transport_trip_instance_stops",
        *_BASE,
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stop_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("planned_ts", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_ts", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["instance_id"], ["transport_trip_instances.id"]),
        sa.ForeignKeyConstraint(["stop_id"], ["bus_stops.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transport_trip_instance_stops_instance_id",
                    "transport_trip_instance_stops", ["instance_id"])

    op.create_table(
        "transport_trip_reservations",
        *_BASE,
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_stop_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("end_stop_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ride_status", sa.Integer(), nullable=False),
        sa.Column("boarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dropped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fee_status", sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(["instance_id"], ["transport_trip_instances.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["start_stop_id"], ["bus_stops.id"]),
        sa.ForeignKeyConstraint(["end_stop_id"], ["bus_stops.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transport_trip_reservations_instance_id",
                    "transport_trip_reservations", ["instance_id"])
    op.create_index("ix_transport_trip_reservations_student_id",
                    "transport_trip_reservations", ["student_id"])
    op.create_index("ix_transport_trip_reservations_ride_status",
                    "transport_trip_reservations", ["ride_status"])
    op.create_index(
        "uq_transport_reservations_instance_student", "transport_trip_reservations",
        ["instance_id", "student_id"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "transport_notification_prefs",
        *_BASE,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("near_pickup_radius_m", sa.Integer(), nullable=True),
        sa.Column("near_dropoff_radius_m", sa.Integer(), nullable=True),
        sa.Column("notify_next_stop_pickup", sa.Boolean(), nullable=True),
        sa.Column("notify_near_pickup", sa.Boolean(), nullable=True),
        sa.Column("notify_arrived_pickup", sa.Boolean(), nullable=True),
        sa.Column("notify_picked_up", sa.Boolean(), nullable=True),
        sa.Column("notify_missed_pickup", sa.Boolean(), nullable=True),
        sa.Column("notify_near_dropoff", sa.Boolean(), nullable=True),
        sa.Column("notify_arrived_dropoff", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transport_notification_prefs_student_id",
                    "transport_notification_prefs", ["student_id"])

    op.create_table(
        "transport_alert_log",
        *_BASE,
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event", sa.String(length=40), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["instance_id"], ["transport_trip_instances.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transport_alert_log_instance_id", "transport_alert_log",
                    ["instance_id"])
    op.create_index("ix_transport_alert_log_student_id", "transport_alert_log",
                    ["student_id"])
    op.create_index(
        "ix_transport_alerts_lookup", "transport_alert_log",
        ["instance_id", "student_id", "event"],
    )


def downgrade():
    op.drop_index("ix_transport_alerts_lookup", table_name="transport_alert_log")
    op.drop_index("ix_transport_alert_log_student_id", table_name="transport_alert_log")
    op.drop_index("ix_transport_alert_log_instance_id", table_name="transport_alert_log")
    op.drop_table("transport_alert_log")
    op.drop_index("ix_transport_notification_prefs_student_id",
                  table_name="transport_notification_prefs")
    op.drop_table("transport_notification_prefs")
    op.drop_index("uq_transport_reservations_instance_student",
                  table_name="transport_trip_reservations")
    op.drop_index("ix_transport_trip_reservations_ride_status",
                  table_name="transport_trip_reservations")
    op.drop_index("ix_transport_trip_reservations_student_id",
                  table_name="transport_trip_reservations")
    op.drop_index("ix_transport_trip_reservations_instance_id",
                  table_name="transport_trip_reservations")
    op.drop_table("transport_trip_reservations")
    op.drop_index("ix_transport_trip_instance_stops_instance_id",
                  table_name="transport_trip_instance_stops")
    op.drop_table("transport_trip_instance_stops")
    op.drop_index("uq_transport_trip_instances_trip_date",
                  table_name="transport_trip_instances")
    op.drop_index("ix_transport_trip_instances_date", table_name="transport_trip_instances")
    op.drop_index("ix_transport_trip_instances_trip_id", table_name="transport_trip_instances")
    op.drop_table("transport_trip_instances")
    op.drop_index("ix_transport_trips_status", table_name="transport_trips")
    op.drop_index("ix_transport_trips_route_id", table_name="transport_trips")
    op.drop_table("transport_trips")
    for t in ("trip_instance_status", "trip_status", "trip_direction"):
        op.execute(f"DROP TYPE IF EXISTS {t}")
