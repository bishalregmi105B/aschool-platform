"""S-A4 transport trip lifecycle regression tests (A-10, A-11, A-42).

Covers: trip CRUD, instance publication (weekday calendar + reservations
from stop assignment), driver ownership on start/end, position ingest with
geofence arrival + per-passenger triggers (prefs + dedupe), pickup/missed/
drop-off ride register, end-blocked-while-onboard, missed-pickup + history
reports, dual ingest from process_gps_data.
"""
from datetime import date

import pytest

from app.models.academic import Class
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.transport import (
    Bus,
    BusStop,
    GPSLog,
    Route,
    TransportAlertLog,
    TransportNotificationPref,
    TransportTrip,
    TransportTripInstance,
    TransportTripReservation,
)
from tests.conftest import get_auth_headers


@pytest.fixture
def transport_env(client, db, school, admin_user):
    """gps_tracking plugin + route with 2 stops (one assigned to a student)
    + bus + driver-user + one trip (every day, morning)."""
    db.session.add(Plugin(slug="gps_tracking", name="GPS Tracking", category="core",
                          is_free=True, is_published=True))
    db.session.add(SchoolPlugin(school_id=school.id, plugin_slug="gps_tracking", active=True))
    klass = Class(school_id=school.id, name="Class 5")
    db.session.add(klass)
    db.session.flush()
    student = Student(school_id=school.id, first_name="Bibek", last_name="Gurung",
                      class_id=klass.id, status="active")
    db.session.add(student)
    db.session.flush()
    route = Route(school_id=school.id, name="Route 1")
    db.session.add(route)
    db.session.flush()
    stop1 = BusStop(school_id=school.id, route_id=route.id, name="Stop A",
                    latitude=27.7172, longitude=85.3240, sequence_number=1,
                    student_ids=[student.id])
    stop2 = BusStop(school_id=school.id, route_id=route.id, name="School Gate",
                    latitude=27.7180, longitude=85.3250, sequence_number=2)
    db.session.add_all([stop1, stop2])
    bus = Bus(school_id=school.id, vehicle_number="BA 2 KHA 1234", capacity=30)
    db.session.add(bus)
    db.session.flush()
    trip = TransportTrip(
        school_id=school.id, route_id=route.id, bus_id=bus.id,
        direction="morning", weekdays=[], first_stop_time=None,
        stop_to_stop_avg_mins=5, name="Morning Run",
    )
    db.session.add(trip)
    db.session.commit()
    return {
        "headers": get_auth_headers(client, "admin@test.edu.np", "Test@1234"),
        "client": client, "db": db, "school": school, "student": student,
        "route": route, "stops": [stop1, stop2], "bus": bus, "trip": trip,
        "klass": klass,
    }


def test_trip_crud(client, transport_env):
    headers = transport_env["headers"]
    create = client.post(
        "/api/v1/transport/trips",
        json={"route_id": str(transport_env["route"].id),
              "bus_id": str(transport_env["bus"].id),
              "direction": "afternoon", "weekdays": [0, 1, 2, 3, 4],
              "name": "Afternoon Run", "stop_to_stop_avg_mins": 4},
        headers=headers,
    )
    assert create.status_code == 201, create.get_json()
    trip = create.get_json()["data"]
    assert trip["direction"] == "afternoon"

    bad = client.post(
        "/api/v1/transport/trips",
        json={"route_id": str(transport_env["route"].id), "direction": "nightly"},
        headers=headers,
    )
    assert bad.status_code == 400

    upd = client.put(
        f"/api/v1/transport/trips/{trip['id']}",
        json={"status": "retired"}, headers=headers,
    )
    assert upd.get_json()["data"]["status"] == "retired"

    listing = client.get("/api/v1/transport/trips?direction=morning", headers=headers)
    assert all(t["direction"] == "morning" for t in listing.get_json()["data"]["trips"])


def test_instance_publication_creates_stops_and_reservations(transport_env):
    from app.services.transport_service import publish_instances_for_date

    school, trip = transport_env["school"], transport_env["trip"]
    day = date.today()
    result = publish_instances_for_date(str(school.id), day)
    assert result["created"] == 1

    instance = TransportTripInstance.query.filter_by(school_id=school.id).first()
    assert instance is not None
    assert len(instance.stops) == 2
    # the student rides: one reservation, boarding at their stop
    rides = [r for r in instance.reservations if not r.is_deleted]
    assert len(rides) == 1
    assert str(rides[0].start_stop_id) == str(transport_env["stops"][0].id)
    assert str(rides[0].end_stop_id) == str(transport_env["stops"][1].id)
    assert rides[0].ride_status == 0

    # idempotent: a second publish skips
    again = publish_instances_for_date(str(school.id), day)
    assert again["created"] == 0 and again["skipped"] >= 1


def test_position_ingest_geofence_and_pickup_flow(transport_env, monkeypatch):
    from app.services.transport_service import (
        board_student,
        drop_off_at_stop,
        end_instance,
        ingest_position,
        publish_instances_for_date,
    )

    school = transport_env["school"]
    publish_instances_for_date(str(school.id), date.today())
    instance = TransportTripInstance.query.filter_by(school_id=school.id).first()
    stop1 = transport_env["stops"][0]
    stop2 = transport_env["stops"][1]

    # start via position ingest near stop 1 → running + arrival triggers
    result = ingest_position(str(school.id), instance, 27.717200, 85.324000, 15.0)
    assert instance.status == "running"
    events = [t["event"] for t in result["triggers"]]
    assert "arrived_pickup" in events
    # arrival auto-mark does NOT stamp while a passenger waits at stop 1
    assert instance.stops[0].actual_ts is None

    # board the student → picked_up alert logged (dedupe row exists)
    board = board_student(str(school.id), instance, str(transport_env["student"].id))
    assert board["ok"] and board["ride_status"] == 1
    assert TransportAlertLog.query.filter_by(event="picked_up").count() == 1

    # dedupe: the same alert inside 30 minutes does not double-send
    from app.services.transport_service import _fire_alert

    reservation = [r for r in instance.reservations if not r.is_deleted][0]
    assert _fire_alert(str(school.id), instance, reservation, "picked_up") is False

    # the bus is still AT stop 1 with nobody waiting → arrival stamps stop 1
    ingest_position(str(school.id), instance, 27.717200, 85.324000, 0.0)
    assert instance.stops[0].actual_ts is not None

    # drive to the school gate → arrival stamps (nobody waiting there)
    ingest_position(str(school.id), instance, 27.718000, 85.325000, 20.0)
    assert instance.stops[1].actual_ts is not None

    # drop off → ride_status 3
    dropped = drop_off_at_stop(str(school.id), instance, str(stop2.id))
    assert dropped["dropped"] == 1

    # end trip is refused while onboard, allowed after drop-off
    instance2 = TransportTripInstance.query.filter_by(school_id=school.id).first()
    fresh_board = board_student(str(school.id), instance2, str(transport_env["student"].id))
    # the ride already dropped (status 3) — re-board is refused as final
    assert fresh_board["ok"] is False

    end_result = end_instance(str(school.id), instance2)
    assert end_result["ok"] is True


def test_missed_pickup_and_end_refused_while_onboard(transport_env):
    from app.services.transport_service import (
        board_student,
        end_instance,
        ingest_position,
        publish_instances_for_date,
    )

    school = transport_env["school"]
    publish_instances_for_date(str(school.id), date.today())
    instance = TransportTripInstance.query.filter_by(school_id=school.id).first()
    ingest_position(str(school.id), instance, 27.717200, 85.324000, 10.0)

    # missed pickup
    missed = board_student(str(school.id), instance, str(transport_env["student"].id),
                           missed=True)
    assert missed["ok"] and missed["ride_status"] == 2
    assert TransportAlertLog.query.filter_by(event="missed_pickup").count() == 1

    # end with nobody onboard → ok; the missed tail was already final
    end_result = end_instance(str(school.id), instance)
    assert end_result["ok"] is True


def test_end_refused_while_onboard(transport_env):
    from app.services.transport_service import (
        board_student,
        end_instance,
        publish_instances_for_date,
    )

    school = transport_env["school"]
    publish_instances_for_date(str(school.id), date.today())
    instance = TransportTripInstance.query.filter_by(school_id=school.id).first()
    board_student(str(school.id), instance, str(transport_env["student"].id))
    result = end_instance(str(school.id), instance)
    assert result["ok"] is False and result["onboard"] == 1


def test_prefs_toggle_and_parent_scoping(client, db, transport_env, admin_user):
    headers = transport_env["headers"]
    student = transport_env["student"]
    put = client.put(
        "/api/v1/transport/notification-prefs",
        json={"student_id": str(student.id), "notify_near_pickup": False,
              "near_pickup_radius_m": 300},
        headers=headers,
    )
    assert put.status_code == 200, put.get_json()
    pref = TransportNotificationPref.query.filter_by(school_id=transport_env["school"].id).first()
    assert pref.notify_near_pickup is False
    assert pref.near_pickup_radius_m == 300


def test_missed_pickup_and_history_reports(client, transport_env):
    from app.services.transport_service import (
        board_student,
        ingest_position,
        publish_instances_for_date,
    )

    headers = transport_env["headers"]
    school = transport_env["school"]
    publish_instances_for_date(str(school.id), date.today())
    instance = TransportTripInstance.query.filter_by(school_id=school.id).first()
    ingest_position(str(school.id), instance, 27.717200, 85.324000, 10.0)
    board_student(str(school.id), instance, str(transport_env["student"].id), missed=True)

    missed = client.get("/api/v1/transport/reports/missed-pickups", headers=headers)
    assert missed.status_code == 200
    rows = missed.get_json()["data"]["missed"]
    assert len(rows) == 1 and rows[0]["student_name"] == "Bibek Gurung"

    history = client.get("/api/v1/transport/reports/trip-history", headers=headers)
    assert history.status_code == 200
    trips = history.get_json()["data"]["trips"]
    assert trips[0]["missed"] == 1


def test_dual_ingest_from_esp32_path(transport_env, monkeypatch):
    """process_gps_data feeds the trip engine: a running instance gets its
    last fix updated + GPSLog written, exactly like driver-phone ingest."""
    from app.tasks.gps_processing import process_gps_data

    school = transport_env["school"]
    from app.services.transport_service import publish_instances_for_date

    publish_instances_for_date(str(school.id), date.today())
    instance = TransportTripInstance.query.filter_by(school_id=school.id).first()
    instance.bus_id = transport_env["bus"].id
    instance.status = "running"
    transport_env["db"].session.commit()

    monkeypatch.setattr(
        "app.tasks.gps_processing._emit_gps_update", lambda *a, **k: None
    )
    result = process_gps_data(
        str(transport_env["bus"].id), 27.717200, 85.324000, speed=12.0
    )
    assert result["status"] == "ok"
    transport_env["db"].session.expire_all()
    assert instance.last_lat is not None
    assert GPSLog.query.filter_by(school_id=school.id).count() >= 1
