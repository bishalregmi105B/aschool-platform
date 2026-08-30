"""Regression tests for the incident_management plugin API (E41).

The growth plugin (NPR 399) is the management tier of the base `incidents`
plugin: its whole web UI called /incidents/management/* which did not exist.
These pin the new extension surface (base /incidents routes are NOT
duplicated anywhere here):
- management case creation with type mapping + student FK guard;
- assignment + forward-only status workflow (reported→investigating→resolved
  →closed) with an append-only audit trail;
- escalation: severity bump, auto-investigating, in-app notification via the
  existing notification service, re-escalation cap, escalations listing;
- parent conference scheduling (escalated cases only);
- reports analytics computed from real rows;
- cross-tenant student rejection, plugin gating, rollback on commit failure.
"""
from uuid import uuid4

import pytest

from app.models.incident import Incident
from app.models.incident_management import IncidentWorkflowEvent
from app.models.notification import InAppNotification
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _seed_plugin(db, slug):
    exists = Plugin.query.filter_by(slug=slug).first()
    if exists:
        return exists
    plugin = Plugin(
        slug=slug, name=slug.replace("_", " ").title(), category="growth",
        price_monthly=399, price_yearly=3990, is_free=False, is_published=True,
    )
    db.session.add(plugin)
    db.session.commit()
    return plugin


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    _seed_plugin(db, "incident_management")
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="incident_management",
                     active=True, is_trial=False)
    )
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


@pytest.fixture
def student(db, school):
    u = User(school_id=school.id, role="student", full_name="Asha Test",
             phone="+9779841000061", is_active=True)
    db.session.add(u)
    db.session.flush()
    s = Student(school_id=school.id, user_id=u.id, first_name="Asha",
                last_name="Test", status="active")
    db.session.add(s)
    db.session.commit()
    return s


def _case(client, admin_headers, **overrides):
    payload = {"title": "Playground fight", "type": "violence", "severity": "medium",
               "description": "Pushing during break"}
    payload.update(overrides)
    return client.post("/api/v1/incidents/management", json=payload, headers=admin_headers)


# ── creation ────────────────────────────────────────────────────────────────

def test_case_creation_type_mapping_and_guards(client, db, admin_headers, student):
    r = _case(client, admin_headers, title="")
    assert r.status_code == 400
    r = _case(client, admin_headers, type="alien")
    assert r.status_code == 400
    r = _case(client, admin_headers, student_id=str(uuid4()))
    assert r.status_code == 400  # student not at this school

    r = _case(client, admin_headers, student_id=str(student.id),
              witnesses="Ram Bahadur, Sita Karki", parent_notified=True)
    assert r.status_code == 201, r.get_json()
    case = r.get_json()["data"]
    assert case["incident_type"] == "fighting"  # violence → fighting
    assert case["type"] == "fighting"
    assert case["student_name"] == "Asha Test"
    assert case["parent_notified"] is True
    assert case["status"] == "reported"

    r = client.get("/api/v1/incidents/management/active?search=Playground", headers=admin_headers)
    assert any(c["id"] == case["id"] for c in r.get_json()["data"])

    overview = client.get("/api/v1/incidents/management/overview", headers=admin_headers).get_json()["data"]
    assert overview["stats"]["active"] == 1
    # not escalated yet → pending escalation
    assert overview["stats"]["pending_escalation"] == 1
    assert any(c["id"] == case["id"] for c in overview["recent_cases"])


# ── assign + status workflow ────────────────────────────────────────────────

def test_assign_and_forward_only_status_workflow(client, db, school, admin_headers, student):
    teacher = User(school_id=school.id, role="teacher", full_name="Teacher Gurung",
                   phone="+9779841000062", is_active=True)
    db.session.add(teacher)
    db.session.commit()

    case = _case(client, admin_headers, student_id=str(student.id)).get_json()["data"]

    r = client.post(f"/api/v1/incidents/management/{case['id']}/assign",
                    json={"assignee_id": str(uuid4())}, headers=admin_headers)
    assert r.status_code == 400  # user not at this school
    r = client.post(f"/incidents/management/{case['id']}/assign", headers=admin_headers)
    assert r.status_code in (400, 404, 405)  # malformed path variant, never 500

    r = client.post(f"/api/v1/incidents/management/{case['id']}/assign",
                    json={"assignee_id": str(teacher.id)}, headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["assigned_to_name"] == "Teacher Gurung"

    r = client.post(f"/api/v1/incidents/management/{case['id']}/status",
                    json={"status": "resolved"}, headers=admin_headers)
    assert r.status_code == 400  # reported → resolved skips investigating

    r = client.post(f"/api/v1/incidents/management/{case['id']}/status",
                    json={"status": "investigating"}, headers=admin_headers)
    assert r.status_code == 200
    r = client.post(f"/api/v1/incidents/management/{case['id']}/status",
                    json={"status": "investigating"}, headers=admin_headers)
    assert r.status_code == 400  # no-op transition rejected

    r = client.post(f"/api/v1/incidents/management/{case['id']}/status",
                    json={"status": "resolved", "resolution": "Counselled"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["resolved_at"] is not None
    r = client.post(f"/api/v1/incidents/management/{case['id']}/status",
                    json={"status": "closed"}, headers=admin_headers)
    assert r.status_code == 200
    r = client.post(f"/api/v1/incidents/management/{case['id']}/assign",
                    json={"assignee_id": str(teacher.id)}, headers=admin_headers)
    assert r.status_code == 400  # closed cases are immutable

    audit = client.get(f"/api/v1/incidents/management/{case['id']}/audit", headers=admin_headers).get_json()["data"]
    assert [e["event_type"] for e in audit][0] == "created"
    assert [e["event_type"] for e in audit][-1] == "status_change"
    assert any(e["event_type"] == "assign" and e["to_value"] == str(teacher.id) for e in audit)


# ── escalation ──────────────────────────────────────────────────────────────

def test_escalation_notification_audit_and_cap(client, db, school, admin_headers, admin_user, student):
    case = _case(client, admin_headers, type="bullying", severity="medium",
                 student_id=str(student.id)).get_json()["data"]

    r = client.post(f"/api/v1/incidents/management/{case['id']}/escalate",
                    json={"reason": "Repeat offense"}, headers=admin_headers)
    assert r.status_code == 200, r.get_json()
    body = r.get_json()["data"]
    assert body["severity"] == "high"
    assert body["escalation"]["severity_before"] == "medium"
    assert body["escalated_at"] is not None
    assert body["status"] == "investigating"  # auto-flip on escalation
    assert body["notified"] is True  # school admin (default target) notified

    # notification written through the existing in-app notification service
    notif = InAppNotification.query.filter_by(
        school_id=school.id, category="incident").order_by(
        InAppNotification.created_at.desc()).first()
    assert notif is not None and "escalat" in notif.title.lower()
    assert notif.data["incident_id"] == case["id"]

    r = client.post(f"/api/v1/incidents/management/{case['id']}/escalate",
                    json={"severity": "low"}, headers=admin_headers)
    assert r.status_code == 400  # escalation must raise severity
    r = client.post(f"/api/v1/incidents/management/{case['id']}/escalate",
                    json={"severity": "critical"}, headers=admin_headers)
    assert r.status_code == 200  # re-escalation allowed while not at max
    r = client.post(f"/api/v1/incidents/management/{case['id']}/escalate",
                    json={}, headers=admin_headers)
    assert r.status_code == 400  # already critical

    r = client.get("/api/v1/incidents/management/escalations", headers=admin_headers)
    rows = r.get_json()["data"]
    assert any(e["id"] == case["id"] and e["conference_scheduled"] is False for e in rows)

    # resolve drops it off the escalations worklist
    r = client.patch(f"/api/v1/incidents/management/{case['id']}/resolve",
                     json={"resolution": "Suspended 2 days"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["resolution"] == "Suspended 2 days"
    r = client.post(f"/api/v1/incidents/management/{case['id']}/escalate", json={}, headers=admin_headers)
    assert r.status_code == 400
    r = client.get("/api/v1/incidents/management/escalations", headers=admin_headers)
    assert all(e["id"] != case["id"] for e in r.get_json()["data"])

    audit = client.get(f"/api/v1/incidents/management/{case['id']}/audit", headers=admin_headers).get_json()["data"]
    types = sorted(e["event_type"] for e in audit)
    assert types == ["created", "escalate", "escalate", "resolve", "status_change"]
    assert any(e["event_type"] == "escalate" and e["from_value"] == "medium" and e["to_value"] == "high"
               for e in audit)


def test_conference_requires_escalation(client, admin_headers, student):
    case = _case(client, admin_headers, student_id=str(student.id)).get_json()["data"]
    r = client.post(f"/api/v1/incidents/management/{case['id']}/conference", json={}, headers=admin_headers)
    assert r.status_code == 400

    client.post(f"/api/v1/incidents/management/{case['id']}/escalate", json={}, headers=admin_headers)
    r = client.post(f"/api/v1/incidents/management/{case['id']}/conference",
                    json={"notes": "Friday with guardians"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["conference_scheduled"] is True
    r = client.get("/api/v1/incidents/management/escalations", headers=admin_headers)
    row = next(e for e in r.get_json()["data"] if e["id"] == case["id"])
    assert row["conference_scheduled"] is True


# ── reports ─────────────────────────────────────────────────────────────────

def test_reports_analytics_math(client, admin_headers, student):
    c1 = _case(client, admin_headers, student_id=str(student.id)).get_json()["data"]
    c2 = _case(client, admin_headers, title="Theft in library", type="theft",
               student_id=str(student.id)).get_json()["data"]
    client.post(f"/api/v1/incidents/management/{c1['id']}/status", json={"status": "investigating"}, headers=admin_headers)
    client.post(f"/api/v1/incidents/management/{c1['id']}/status",
                json={"status": "resolved", "resolution": "Handled"}, headers=admin_headers)
    client.post(f"/api/v1/incidents/management/{c2['id']}/escalate", json={}, headers=admin_headers)
    client.patch(f"/api/v1/incidents/management/{c2['id']}/resolve",
                 json={"resolution": "Returned; warned"}, headers=admin_headers)

    r = client.get("/api/v1/incidents/management/reports?period=this_month", headers=admin_headers)
    assert r.status_code == 200
    body = r.get_json()["data"]
    assert body["summary"]["total"] == 2
    assert body["summary"]["resolved"] == 2
    assert body["summary"]["escalated"] == 1
    assert body["summary"]["avg_resolution_days"] is not None
    assert {t["type"] for t in body["by_type"]} == {"fighting", "theft"}
    assert len(body["resolved_cases"]) == 2
    assert all(c["resolution"] for c in body["resolved_cases"])

    r = client.get("/api/v1/incidents/management/reports?period=fortnight", headers=admin_headers)
    assert r.status_code == 400


# ── tenancy, gating, rollback ───────────────────────────────────────────────

def test_cross_tenant_student_and_case_isolated(client, db, admin_headers, student):
    from app.models.school import School
    from app.models.user import User

    other = School(name="Foreign IM Academy", slug=f"foreign-im-{uuid4().hex[:8]}",
                   plan="free", status="active", is_active=True,
                   phone="+9779800000061", email="im-admin@foreign.edu.np",
                   province="Bagmati", district="Kathmandu",
                   municipality="Kathmandu", default_language="ne")
    db.session.add(other)
    db.session.flush()
    other_admin = User(school_id=other.id, role="school_admin", full_name="Foreign Admin",
                       phone="+9779841000063", is_active=True)
    db.session.add(other_admin)
    db.session.commit()

    # an id that is not a student at THIS school must be rejected (a foreign
    # tenant's ids included — no cross-tenant reference may be stored)
    r = _case(client, admin_headers, student_id=str(other.id))
    assert r.status_code == 400

    # another school's INCIDENT must be invisible through management routes
    foreign_incident = Incident(
        school_id=other.id, title="Foreign case", incident_type="bullying",
        severity="low", reported_by_id=other_admin.id,
    )
    db.session.add(foreign_incident)
    db.session.commit()

    r = client.get(f"/api/v1/incidents/management/{foreign_incident.id}/audit", headers=admin_headers)
    assert r.status_code == 404  # another school's incident is invisible
    listing = client.get("/api/v1/incidents/management/active", headers=admin_headers).get_json()["data"]
    assert all(c["id"] != str(foreign_incident.id) for c in listing)


def test_gate_flip_blocks_management_routes(client, db, admin_headers):
    from extensions import cache

    r = client.get("/api/v1/incidents/management/overview", headers=admin_headers)
    assert r.status_code == 200
    sp = SchoolPlugin.query.filter_by(plugin_slug="incident_management").first()
    sp.active = False
    db.session.commit()
    cache.delete(f"school:{sp.school_id}:plugins")
    for path in ("/api/v1/incidents/management/overview",
                 "/api/v1/incidents/management/active",
                 "/api/v1/incidents/management/escalations",
                 "/api/v1/incidents/management/reports"):
        assert client.get(path, headers=admin_headers).status_code == 403, path
    sp.active = True
    db.session.commit()
    cache.delete(f"school:{sp.school_id}:plugins")
    assert client.get("/api/v1/incidents/management/overview", headers=admin_headers).status_code == 200


def test_case_rollback_on_commit_failure(client, db, app, monkeypatch, admin_headers):
    from extensions import db as _db

    before = Incident.query.count()
    real_commit = _db.session.commit
    old_propagate = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False

    def failing_commit(*a, **kw):
        raise RuntimeError("simulated commit failure")

    try:
        monkeypatch.setattr(_db.session, "commit", failing_commit)
        resp = _case(client, admin_headers)
        assert resp.status_code == 500
    finally:
        monkeypatch.setattr(_db.session, "commit", real_commit)
        app.config["PROPAGATE_EXCEPTIONS"] = old_propagate
        _db.session.rollback()

    assert Incident.query.count() == before
    assert IncidentWorkflowEvent.query.count() == 0  # audit event rolled back too
