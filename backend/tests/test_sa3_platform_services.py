"""S-A3 platform services regression tests (A-02, A-07, A-30, A-37, E-04).

Covers: notification matrix semantics + API + gated senders, access logs on
auth events, forced password rotation, /mobile/version maintenance flags,
crash reporting endpoint.
"""
import pytest

from app.models.monitoring import MobileCrashReport
from app.models.notification import NotificationRule
from app.models.user import User
from app.models.user_access_log import UserAccessLog
from tests.conftest import get_auth_headers


@pytest.fixture
def env(client, db, school, admin_user):
    return {
        "headers": get_auth_headers(client, "admin@test.edu.np", "Test@1234"),
        "client": client, "db": db, "school": school, "admin": admin_user,
    }


# ── A-02: notification matrix ────────────────────────────────────────────

def test_matrix_defaults_on_and_disable_roundtrip(env):
    client, headers = env["client"], env["headers"]
    listing = client.get("/api/v1/notifications/rules", headers=headers)
    assert listing.status_code == 200, listing.get_json()
    data = listing.get_json()["data"]
    events = {e["event_key"]: e for e in data["events"]}
    assert "attendance.absent_alert" in events
    assert events["attendance.absent_alert"]["channels"]["sms"] is True  # default on

    # disable the SMS leg of fees.overdue
    put = client.put(
        "/api/v1/notifications/rules",
        json={"event_key": "fees.overdue", "channel": "sms", "enabled": False},
        headers=headers,
    )
    assert put.status_code == 200, put.get_json()
    rule = NotificationRule.query.filter_by(school_id=env["school"].id).first()
    assert rule is not None and rule.enabled is False

    listing2 = client.get("/api/v1/notifications/rules", headers=headers)
    cell = next(
        e for e in listing2.get_json()["data"]["events"] if e["event_key"] == "fees.overdue"
    )
    assert cell["channels"]["sms"] is False
    assert cell["overrides"], "override row should be listed"

    # unknown event rejected
    bad = client.put(
        "/api/v1/notifications/rules",
        json={"event_key": "not.an.event", "channel": "sms", "enabled": False},
        headers=headers,
    )
    assert bad.status_code == 400

    # delete reverts to default-on
    rule_id = cell["overrides"][0]["id"]
    deleted = client.delete(f"/api/v1/notifications/rules/{rule_id}", headers=headers)
    assert deleted.status_code == 200
    cell2 = next(
        e for e in client.get("/api/v1/notifications/rules", headers=headers)
        .get_json()["data"]["events"]
        if e["event_key"] == "fees.overdue"
    )
    assert cell2["channels"]["sms"] is True
    assert not cell2["overrides"]


def test_matrix_gates_absent_alert_sms(env, monkeypatch):
    """A disabled sms rule for attendance.absent_alert stops the SMS send
    while push/in-app legs are untouched (the listener's real path)."""
    from app.models.student import Guardian, Student
    from app.plugins.events import emit_for_school

    db, school = env["db"], env["school"]
    klass_obj = _quick_class(db, school)
    student = Student(school_id=school.id, first_name="Gita", last_name="Rai",
                      class_id=klass_obj.id, status="active")
    db.session.add(student)
    db.session.flush()
    db.session.add(Guardian(school_id=school.id, student_id=student.id,
                            full_name="Gita's father", phone="+9779811111111",
                            relation="father", is_primary=True))
    db.session.add(NotificationRule(
        school_id=school.id, event_key="attendance.absent_alert", channel="sms",
        audience_role="", enabled=False,
    ))
    db.session.commit()

    sent = {}
    monkeypatch.setattr(
        "app.tasks.sms_sender.send_sms",
        type("P", (), {"delay": staticmethod(lambda *a, **k: sent.setdefault("args", a))})(),
    )

    emit_for_school("attendance.absent_alert", school_id=str(school.id),
                    student_id=str(student.id), date="2026-09-12")
    assert "args" not in sent, "matrix-disabled SMS must not be sent"

    # remove the override → default-on → the SMS goes out
    for rule in NotificationRule.query.filter_by(school_id=school.id).all():
        rule.soft_delete()
    db.session.commit()
    emit_for_school("attendance.absent_alert", school_id=str(school.id),
                    student_id=str(student.id), date="2026-09-13")
    assert "args" in sent, "default-on SMS must be sent once the override is gone"


def _quick_class(db, school):
    from app.models.academic import Class

    klass = Class(school_id=school.id, name=f"C-{school.slug[:6]}")
    db.session.add(klass)
    db.session.flush()
    return klass


# ── A-37: access logs + forced rotation ──────────────────────────────────

def test_login_writes_access_logs(env):
    client = env["client"]
    # success (admin already logged in via fixture, so just log in again)
    client.post("/api/v1/auth/login", json={"email": "admin@test.edu.np",
                                            "password": "Test@1234"})
    # failure
    client.post("/api/v1/auth/login", json={"email": "admin@test.edu.np",
                                            "password": "wrong-pass"})
    rows = UserAccessLog.query.filter_by(school_id=env["school"].id).all()
    events = {r.event for r in rows}
    assert "login" in events and "login_failed" in events
    failed = next(r for r in rows if r.event == "login_failed")
    assert failed.login_id == "admin@test.edu.np"
    assert failed.user_id is None

    listing = client.get("/api/v1/users/access-logs", headers=env["headers"])
    assert listing.status_code == 200
    logs = listing.get_json()["data"]["logs"]
    assert {l["event"] for l in logs} >= {"login", "login_failed"}


def test_force_password_change_and_reset_sets_flag(env):
    client, db, headers = env["client"], env["db"], env["headers"]
    user = User(school_id=env["school"].id, role="parent", full_name="Parent Rai",
                phone="+9779841000077", email="parent@test.edu.np", is_active=True)
    user.set_password("OldPass@1")
    db.session.add(user)
    db.session.commit()

    resp = client.post(
        f"/api/v1/users/{user.id}/force-password-change",
        json={"enabled": True}, headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["must_change_password"] is True
    db.session.expire_all()
    assert user.must_change_password is True

    # the change-password endpoint clears the flag
    login = client.post("/api/v1/auth/login", json={
        "email": "parent@test.edu.np", "password": "OldPass@1"})
    assert login.status_code == 200
    assert login.get_json()["data"]["user"]["must_change_password"] is True
    change = client.post("/api/v1/auth/change-password", json={
        "current_password": "OldPass@1", "new_password": "NewPass@123"},
        headers=get_auth_headers(client, "parent@test.edu.np", "OldPass@1"))
    assert change.status_code == 200
    db.session.expire_all()
    assert user.must_change_password is False
    assert UserAccessLog.query.filter_by(event="password_changed").count() == 1


# ── A-07 / A-30: mobile ops ──────────────────────────────────────────────

def test_mobile_version_maintenance_flags(env):
    client, headers, school = env["client"], env["headers"], env["school"]
    put = client.put(
        "/api/v1/mobile/version",
        json={"maintenance": {"all": False, "student": True},
              "maintenance_message": "Exam day maintenance"},
        headers=headers,
    )
    assert put.status_code == 200, put.get_json()
    got = client.get("/api/v1/mobile/version?app=student&version=1.0.0", headers=headers)
    data = got.get_json()["data"]
    assert data["maintenance"] is True
    assert data["maintenance_message"] == "Exam day maintenance"
    got_admin = client.get("/api/v1/mobile/version?app=admin&version=1.0.0", headers=headers)
    assert got_admin.get_json()["data"]["maintenance"] is False


def test_crash_report_endpoint(env, app):
    # cookie-free client: the shared `client` fixture carries login cookies,
    # which would trip the cookie-auth CSRF guard on this unauthenticated POST
    client = app.test_client()
    resp = client.post(
        "/api/v1/mobile/crash",
        json={"app": "student", "app_version": "1.2.3", "platform": "android",
              "os_version": "Android 14", "error": "Boom" * 300,
              "stack": "at main()...", "context": {"screen": "exams",
                                                    "auth_token": "secret"},
              "school_slug": env["school"].slug},
    )
    assert resp.status_code == 200, resp.get_json()
    row = MobileCrashReport.query.first()
    assert row is not None
    assert len(row.error) <= 500
    assert row.context.get("auth_token") == "[redacted]"
    assert str(row.school_id) == str(env["school"].id)


# ── E-04: vocabulary (source-scan tests live in test_event_vocabulary.py;
# here we pin the canonical renames so a revert fails loudly) ─────────────

def test_canonical_event_names_in_use():
    import re

    fees_src = open("app/api/v1/fees.py", encoding="utf-8").read()
    assert '"fees.collected"' in fees_src and '"fee.paid"' not in fees_src
    exams_src = open("app/api/v1/exams.py", encoding="utf-8").read()
    assert '"exams.result_published"' in exams_src
    assert '"exams.marks_entered"' in exams_src
    assert '"notice.published"' in open("app/api/v1/notices.py", encoding="utf-8").read()
