"""Biometric plugin tests — device CRUD with per-device API keys, keyed punch
ingestion with idempotent replay, malformed-payload rollback, heartbeat
last-seen health, and punch→attendance mapping."""
import uuid
from datetime import date

import pytest

from app.models.attendance import Attendance
from app.models.biometric import BiometricDevice, BiometricPunch, BiometricSyncLog
from app.models.plugin import SchoolPlugin
from app.models.student import Student
from extensions import db
from tests.conftest import get_auth_headers


def _install_biometric(db, school):
    """Create the published catalog plugin (FK target) + install it for school."""
    from app.models.plugin import Plugin

    if not Plugin.query.filter_by(slug="biometric").first():
        db.session.add(Plugin(
            slug="biometric", name="Biometric Integration", category="premium",
            price_monthly=1999, price_yearly=19999, is_free=False, trial_days=7,
            emoji="✋", icon="Fingerprint", description="ZKTeco fingerprint attendance",
            is_published=True, version="1.0.0",
        ))
        db.session.flush()
    db.session.add(SchoolPlugin(
        school_id=school.id, plugin_slug="biometric", active=True, is_trial=False,
    ))
    db.session.commit()


def _make_student(db, school, klass, code="S001"):
    s = Student(
        school_id=school.id, first_name="Ram", last_name="Bahadur",
        student_id=code, admission_number=code, class_id=klass.id if klass else None,
    )
    db.session.add(s)
    db.session.commit()
    return s


def _make_class(db, school):
    from app.models.academic import Class

    c = Class(school_id=school.id, name="Grade 5")
    db.session.add(c)
    db.session.commit()
    return c


def _register_device(client, headers, name="Main Gate ZKTeco", serial=None, **extra):
    payload = {"name": name, "ip_address": "192.168.1.100", "port": 4370}
    if serial:
        payload["serial_number"] = serial
    payload.update(extra)
    resp = client.post("/api/v1/attendance/biometric/devices", json=payload, headers=headers)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["data"]


@pytest.fixture
def device_setup(client, db, school, admin_user):
    """School with the biometric plugin installed + one registered device.
    `dc` is a cookie-free client — devices authenticate with the API key and
    carry no session cookies (cookie-auth POSTs would trip the CSRF guard)."""
    _install_biometric(db, school)
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    data = _register_device(client, headers)
    return {
        "headers": headers,
        "dc": client.application.test_client(),
        "device": data,
        "api_key": data["api_key"],
        "device_key_headers": {"X-Device-Key": data["api_key"]},
    }


def test_plugin_gated_for_admin_without_install(client, db, school, admin_user):
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.get("/api/v1/attendance/biometric/devices", headers=headers)
    # Blocked by the plugin gate. (With zero installs the gate reports the
    # generic "School context not found"; with any other install present it
    # reports "Plugin 'biometric' is not installed" — either way: 403.)
    assert resp.status_code == 403


def test_create_device_returns_key_once_and_list_hides_it(client, db, school, admin_user):
    _install_biometric(db, school)
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    data = _register_device(client, headers, serial="ZK-123")
    assert data["api_key"]
    assert data["port"] == 4370

    listed = client.get("/api/v1/attendance/biometric/devices", headers=headers).get_json()["data"]["items"]
    assert len(listed) == 1
    assert "api_key" not in listed[0]
    assert listed[0]["status"] == "offline"

    # Stored hash, never plaintext
    row = db.session.get(BiometricDevice, uuid.UUID(data["id"]))
    assert row.api_key_hash != data["api_key"]
    assert len(row.api_key_hash) == 64


def test_create_device_requires_name(client, db, school, admin_user):
    _install_biometric(db, school)
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    resp = client.post("/api/v1/attendance/biometric/devices", json={"ip_address": "1.2.3.4"}, headers=headers)
    assert resp.status_code == 400


def test_ingest_requires_device_key(client, db, school, admin_user, device_setup):
    dc = device_setup["dc"]
    resp = dc.post("/api/v1/attendance/biometric/ingest", json={"punches": []})
    assert resp.status_code == 401
    resp = dc.post(
        "/api/v1/attendance/biometric/ingest",
        json={"punches": []},
        headers={"X-Device-Key": "wrong-key"},
    )
    assert resp.status_code == 401


def test_ingest_maps_punches_to_attendance(client, db, school, admin_user, device_setup):
    klass = _make_class(db, school)
    student = _make_student(db, school, klass, "S001")
    _make_student(db, school, klass, "S002")
    dc = device_setup["dc"]

    ts = "2026-08-28T09:05:00+05:45"
    resp = dc.post(
        "/api/v1/attendance/biometric/ingest",
        json={"punches": [
            {"punch_id": "1", "user_id": "S001", "timestamp": ts, "direction": "in"},
            {"punch_id": "2", "user_id": "S002", "timestamp": "2026-08-28T09:06:30+05:45"},
        ]},
        headers=device_setup["device_key_headers"],
    )
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()["data"]
    assert body["received"] == 2 and body["new"] == 2 and body["duplicates"] == 0

    atts = Attendance.query.filter_by(school_id=school.id, date=date(2026, 8, 28)).all()
    assert len(atts) == 2
    s1_att = next(a for a in atts if str(a.student_id) == str(student.id))
    assert s1_att.status == "present"
    assert s1_att.check_in_time is not None
    assert str(s1_att.class_id) == str(klass.id)

    punches = BiometricPunch.query.filter_by(school_id=school.id).all()
    assert len(punches) == 2 and all(p.status == "mapped" for p in punches)


def test_ingest_replay_is_idempotent(client, db, school, admin_user, device_setup):
    klass = _make_class(db, school)
    _make_student(db, school, klass, "S001")
    batch = {"punches": [{"punch_id": "1", "user_id": "S001", "timestamp": "2026-08-28T09:05:00+05:45"}]}
    headers = device_setup["device_key_headers"]
    dc = device_setup["dc"]

    first = dc.post("/api/v1/attendance/biometric/ingest", json=batch, headers=headers)
    assert first.status_code == 200 and first.get_json()["data"]["new"] == 1
    replay = dc.post("/api/v1/attendance/biometric/ingest", json=batch, headers=headers)
    assert replay.status_code == 200
    assert replay.get_json()["data"]["duplicates"] == 1
    assert replay.get_json()["data"]["new"] == 0

    # No double attendance row, no double punch row
    assert Attendance.query.filter_by(school_id=school.id).count() == 1
    assert BiometricPunch.query.filter_by(school_id=school.id).count() == 1

    # Replay without punch_id dedupes on the natural key too
    replay2 = dc.post(
        "/api/v1/attendance/biometric/ingest",
        json={"punches": [{"user_id": "S001", "timestamp": "2026-08-28T09:05:00+05:45"}]},
        headers=headers,
    )
    assert replay2.get_json()["data"]["duplicates"] == 1
    assert BiometricPunch.query.filter_by(school_id=school.id).count() == 1


def test_ingest_malformed_payload_writes_nothing(client, db, school, admin_user, device_setup):
    klass = _make_class(db, school)
    _make_student(db, school, klass, "S001")
    headers = device_setup["device_key_headers"]
    dc = device_setup["dc"]

    # One good record + one with an invalid timestamp → whole batch rejected
    resp = dc.post(
        "/api/v1/attendance/biometric/ingest",
        json={"punches": [
            {"punch_id": "1", "user_id": "S001", "timestamp": "2026-08-28T09:05:00+05:45"},
            {"punch_id": "2", "user_id": "S002", "timestamp": "not-a-date"},
        ]},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.get_json()["data"]["invalid_records"][0]["index"] == 1

    assert BiometricPunch.query.filter_by(school_id=school.id).count() == 0
    assert Attendance.query.filter_by(school_id=school.id).count() == 0
    assert BiometricSyncLog.query.filter_by(school_id=school.id).count() == 0

    # Non-list and empty payloads → 400 as well
    for bad in ({"punches": "nope"}, {}, {"punches": []}):
        assert dc.post("/api/v1/attendance/biometric/ingest", json=bad, headers=headers).status_code == 400


def test_unmapped_punches_stored_and_manual_sync_remaps(client, db, school, admin_user, device_setup):
    headers = device_setup["device_key_headers"]
    dc = device_setup["dc"]
    device_id = device_setup["device"]["id"]

    # Punch arrives before the student exists → stored, unmapped
    resp = dc.post(
        "/api/v1/attendance/biometric/ingest",
        json={"punches": [{"punch_id": "9", "user_id": "S042", "timestamp": "2026-08-28T10:00:00+05:45"}]},
        headers=headers,
    )
    assert resp.get_json()["data"]["failed"] == 1
    punch = BiometricPunch.query.filter_by(school_id=school.id).one()
    assert punch.status == "unmapped" and punch.attendance_id is None

    # Student imported later, then admin hits Sync
    klass = _make_class(db, school)
    _make_student(db, school, klass, "S042")
    sync = client.post(f"/api/v1/attendance/biometric/devices/{device_id}/sync", headers=device_setup["headers"])
    assert sync.status_code == 200
    assert sync.get_json()["data"]["records_synced"] == 1

    db.session.expire_all()
    punch = db.session.get(BiometricPunch, punch.id)
    assert punch.status == "mapped" and punch.attendance_id is not None
    assert Attendance.query.filter_by(school_id=school.id).count() == 1

    logs = client.get("/api/v1/attendance/biometric/logs", headers=device_setup["headers"]).get_json()["data"]["items"]
    assert len(logs) >= 1 and logs[0]["device_name"] == "Main Gate ZKTeco"
    assert logs[0]["records_synced"] == 1


def test_heartbeat_updates_last_seen_and_online_status(client, db, school, admin_user, device_setup):
    headers = device_setup["device_key_headers"]
    dc = device_setup["dc"]
    resp = dc.post("/api/v1/attendance/biometric/heartbeat", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "ok"

    admin_headers = device_setup["headers"]
    listed = client.get("/api/v1/attendance/biometric/devices", headers=admin_headers).get_json()["data"]["items"]
    assert listed[0]["status"] == "online"
    assert listed[0]["last_seen_at"] is not None

    overview = client.get("/api/v1/attendance/biometric/overview", headers=admin_headers).get_json()["data"]
    assert overview["stats"]["online"] == 1
    assert overview["stats"]["total_devices"] == 1

    # Disabled device is rejected at the gate
    device = db.session.get(BiometricDevice, uuid.UUID(device_setup["device"]["id"]))
    device.is_active = False
    db.session.commit()
    assert dc.post("/api/v1/attendance/biometric/heartbeat", headers=headers).status_code == 403


def test_device_key_regenerate_invalidates_old_key(client, db, school, admin_user, device_setup):
    admin_headers = device_setup["headers"]
    device_id = device_setup["device"]["id"]
    dc = device_setup["dc"]
    resp = client.post(f"/api/v1/attendance/biometric/devices/{device_id}/regenerate-key", headers=admin_headers)
    assert resp.status_code == 200
    new_key = resp.get_json()["data"]["api_key"]

    old = dc.post("/api/v1/attendance/biometric/heartbeat", headers={"X-Device-Key": device_setup["api_key"]})
    assert old.status_code == 401
    new = dc.post("/api/v1/attendance/biometric/heartbeat", headers={"X-Device-Key": new_key})
    assert new.status_code == 200


def test_tenant_isolation_second_school_cannot_touch_device(client, db, school, admin_user, device_setup):
    from app.models.school import School
    from app.models.user import User

    other = School(name="Other Academy", slug="other-academy", plan="growth", status="active",
                   is_active=True, phone="+9779800000099", email="admin@other.edu.np")
    db.session.add(other)
    db.session.flush()  # assign other.id before referencing it below
    other_admin = User(school_id=other.id, role="school_admin", full_name="Other Admin",
                       phone="+9779841000099", email="admin@other.edu.np", is_active=True, phone_verified=True)
    other_admin.set_password("Test@1234")
    db.session.add(other_admin)
    # Plugin catalog row already exists from device_setup's install.
    db.session.add(SchoolPlugin(school_id=other.id, plugin_slug="biometric", active=True, is_trial=False))
    db.session.commit()

    # Fresh client: the primary client now carries the first admin's auth
    # cookies, which would trip the CSRF guard on this second login POST.
    other_client = client.application.test_client()
    other_headers = get_auth_headers(other_client, "admin@other.edu.np", "Test@1234")
    device_id = device_setup["device"]["id"]
    dc = device_setup["dc"]

    # Other school's device list is empty; cross-school access → 404
    items = other_client.get("/api/v1/attendance/biometric/devices", headers=other_headers).get_json()["data"]["items"]
    assert items == []
    assert other_client.patch(f"/api/v1/attendance/biometric/devices/{device_id}", json={"name": "hacked"},
                              headers=other_headers).status_code == 404
    assert other_client.post(f"/api/v1/attendance/biometric/devices/{device_id}/sync",
                             headers=other_headers).status_code == 404

    # Other school's device key cannot punch into the first school either
    other_device = _register_device(other_client, other_headers, name="Other Gate")
    resp = dc.post(
        "/api/v1/attendance/biometric/ingest",
        json={"punches": [{"punch_id": "1", "user_id": "S001", "timestamp": "2026-08-28T09:05:00+05:45"}]},
        headers={"X-Device-Key": other_device["api_key"]},
    )
    assert resp.status_code == 200
    school_ids = {str(p.school_id) for p in BiometricPunch.query.all()}
    assert school_ids == {str(other.id)}
