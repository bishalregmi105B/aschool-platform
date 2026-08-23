"""Tests for the ESP32 -> Firebase -> Postgres GPS pipeline."""
from datetime import datetime, timezone
from unittest.mock import patch

from app.models.transport import Bus, GPSLog


def _make_bus(db, school):
    bus = Bus(
        school_id=school.id,
        vehicle_number="BA-2-CHA-1234",
        gps_device_id="esp32-001",
        capacity=40,
        is_active=True,
    )
    db.session.add(bus)
    db.session.commit()
    return bus


def test_process_gps_data_persists_fix(app, db, school, _make_bus_factory=None):
    from app.tasks.gps_processing import process_gps_data

    with app.app_context():
        bus = Bus(
            school_id=school.id,
            vehicle_number="GA-1-PA-9999",
            gps_device_id="esp32-test",
            is_active=True,
        )
        db.session.add(bus)
        db.session.commit()
        bus_id = str(bus.id)

        ts = datetime.now(timezone.utc).isoformat()

        with patch("app.tasks.gps_processing._emit_gps_update") as emit:
            result = process_gps_data.run(
                bus_id=bus_id,
                lat=27.7172,
                lng=85.3240,
                speed=32.5,
                timestamp=ts,
            )

        assert result["status"] == "ok"
        log = GPSLog.query.filter_by(bus_id=bus.id).one()
        assert float(log.latitude) == 27.7172
        assert float(log.speed_kmh) == 32.5
        assert log.firebase_synced is True

        payload = emit.call_args.args[0]
        assert payload["bus_id"] == bus_id
        assert payload["latitude"] == 27.7172


def test_process_gps_data_accepts_device_id_and_unknown_bus(app, db, school):
    from app.tasks.gps_processing import process_gps_data

    with app.app_context():
        bus = Bus(
            school_id=school.id,
            vehicle_number="LU-2-KHA-0001",
            gps_device_id="dev-xyz",
            is_active=True,
        )
        db.session.add(bus)
        db.session.commit()

        # Device-id addressing (as the firmware sends) resolves to the bus row.
        result = process_gps_data.run(
            bus_id="dev-xyz",
            lat=27.7,
            lng=85.3,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        assert result["status"] == "ok"

        unknown = process_gps_data.run(
            bus_id="does-not-exist",
            lat=27.7,
            lng=85.3,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        assert unknown["status"] == "unknown_bus"


def test_poller_skips_when_unconfigured():
    import os

    with patch.dict(os.environ, {"FIREBASE_DATABASE_URL": ""}, clear=False):
        from app.tasks.gps_firebase_poller import poll_firebase_gps

        result = poll_firebase_gps.run()
        assert result["status"] == "unconfigured"
