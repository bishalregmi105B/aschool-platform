"""Regression tests for the disaster_management plugin API (E40).

The premium plugin (NPR 999) sold drills/seismic/overview pages whose only
backend was the emergency tier. These pin the new surface:
- drills CRUD with validation guards (bad type/date/duration → 400);
- per-class participation with int/UUID[]/FK guards;
- overview aggregating REAL emergency-tier rows with a hand-computed
  readiness score (formula documented in app/api/v1/disaster_management.py);
- seismic endpoint honest shape (USGS-sourced; empty list + unavailable flag
  when the external feed is unreachable — never fabricated events);
- plugin gating (no disaster_management → 403) and rollback on commit failure.
"""
from datetime import datetime, timedelta

import pytest

from app.models.disaster_management import DisasterDrill
from app.models.plugin import Plugin, SchoolPlugin
from app.models.emergency import EmergencyAlert, EvacuationPlan
from tests.conftest import get_auth_headers


def _seed_plugin(db, slug):
    exists = Plugin.query.filter_by(slug=slug).first()
    if exists:
        return exists
    plugin = Plugin(
        slug=slug, name=slug.replace("_", " ").title(), category="premium",
        price_monthly=999, price_yearly=9990, is_free=False, is_published=True,
    )
    db.session.add(plugin)
    db.session.commit()
    return plugin


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    for slug in ("emergency", "disaster_management"):
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True,
                         is_trial=False)
        )
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _drill_payload(**overrides):
    payload = {
        "title": "Term Earthquake Drill",
        "drill_type": "earthquake",
        "scheduled_date": (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "duration_minutes": "45",
        "notes": "Assembly point B",
    }
    payload.update(overrides)
    return payload


# ── drills CRUD ──────────────────────────────────────────────────────────────

def test_drill_crud_and_validation(client, db, admin_headers):
    r = client.post("/api/v1/emergency/drills", json={}, headers=admin_headers)
    assert r.status_code == 400
    r = client.post("/api/v1/emergency/drills", json=_drill_payload(drill_type="tsunami"), headers=admin_headers)
    assert r.status_code == 400
    r = client.post("/api/v1/emergency/drills", json=_drill_payload(scheduled_date="not-a-date"), headers=admin_headers)
    assert r.status_code == 400
    r = client.post("/api/v1/emergency/drills", json=_drill_payload(duration_minutes="abc"), headers=admin_headers)
    assert r.status_code == 400

    r = client.post("/api/v1/emergency/drills", json=_drill_payload(), headers=admin_headers)
    assert r.status_code == 201, r.get_json()
    drill = r.get_json()["data"]
    assert drill["drill_type"] == "earthquake"
    assert drill["duration_minutes"] == 45
    assert drill["status"] == "scheduled"
    assert drill["scheduled_date"] is not None

    r = client.get("/api/v1/emergency/drills", headers=admin_headers)
    assert any(d["id"] == drill["id"] for d in r.get_json()["data"])

    # upcoming filter excludes future-completed/past drills
    past = client.post(
        "/api/v1/emergency/drills",
        json=_drill_payload(title="Past", scheduled_date=(datetime.utcnow() - timedelta(days=10)).strftime("%Y-%m-%d")),
        headers=admin_headers,
    ).get_json()["data"]
    r = client.get("/api/v1/emergency/drills?upcoming=true", headers=admin_headers)
    ids = [d["id"] for d in r.get_json()["data"]]
    assert drill["id"] in ids and past["id"] not in ids

    r = client.patch(f"/api/v1/emergency/drills/{past['id']}", json={"status": "completed"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["data"]["completed_at"] is not None
    r = client.patch(f"/api/v1/emergency/drills/{past['id']}", json={"status": "bogus"}, headers=admin_headers)
    assert r.status_code == 400

    r = client.delete(f"/api/v1/emergency/drills/{past['id']}", headers=admin_headers)
    assert r.status_code == 200
    r = client.get(f"/api/v1/emergency/drills/{past['id']}", headers=admin_headers)
    assert r.status_code == 404


def test_participation_guards(client, db, admin_headers):
    drill = client.post("/api/v1/emergency/drills", json=_drill_payload(), headers=admin_headers).get_json()["data"]

    r = client.post(f"/api/v1/emergency/drills/{drill['id']}/participations",
                    json={"total_expected": 10, "total_present": 12}, headers=admin_headers)
    assert r.status_code == 400  # present > expected

    r = client.post(f"/api/v1/emergency/drills/{drill['id']}/participations",
                    json={"total_expected": "ten", "total_present": 5}, headers=admin_headers)
    assert r.status_code == 400  # non-integer

    r = client.post(f"/api/v1/emergency/drills/{drill['id']}/participations",
                    json={"total_expected": 5, "total_present": 5, "missing_student_ids": ["garbage"]},
                    headers=admin_headers)
    assert r.status_code == 400  # bad UUID[]

    r = client.post(f"/api/v1/emergency/drills/{drill['id']}/participations",
                    json={"class_id": "00000000-0000-0000-0000-000000000001",
                          "total_expected": 5, "total_present": 5}, headers=admin_headers)
    assert r.status_code == 400  # class not at this school

    r = client.post(f"/api/v1/emergency/drills/{drill['id']}/participations",
                    json={"total_expected": "30", "total_present": "28", "notes": "ok"},
                    headers=admin_headers)
    assert r.status_code == 201
    assert r.get_json()["data"]["total_expected"] == 30  # coerced to int

    detail = client.get(f"/api/v1/emergency/drills/{drill['id']}", headers=admin_headers).get_json()["data"]
    assert len(detail["participations"]) == 1


# ── overview / readiness math ───────────────────────────────────────────────

def test_overview_readiness_hand_computed(client, db, school, admin_headers):
    """Fixtures: 1 active plan, 1 active alert, 1 drill completed 30 days ago.

    Formula (documented in disaster_management.py): recency 30d → 40;
    completed-in-365d = 1 → 8; active plans = 1 → 12; stale unresolved
    alerts = 0 → 10. Expected readiness = 70.
    """
    from app.models.user import User
    db.session.add(EvacuationPlan(school_id=school.id, name="Main Block", is_active=True))
    db.session.add(EmergencyAlert(
        school_id=school.id, alert_type="drill", title="Announcement",
        triggered_by_id=User.query.filter_by(school_id=school.id).first().id,
        triggered_at=datetime.utcnow(),
    ))
    db.session.commit()

    r = client.post("/api/v1/emergency/drills", json=_drill_payload(
        title="Past drill", scheduled_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")),
        headers=admin_headers)
    drill_id = r.get_json()["data"]["id"]
    client.patch(f"/api/v1/emergency/drills/{drill_id}", json={"status": "completed"}, headers=admin_headers)

    r = client.get("/api/v1/emergency/disaster/overview", headers=admin_headers)
    assert r.status_code == 200
    stats = r.get_json()["data"]["stats"]
    assert stats["total_plans"] == 1
    assert stats["active_alerts"] == 1
    assert stats["drills_this_year"] == 1
    assert stats["completed_this_year"] == 1
    assert stats["last_drill_at"] is not None
    assert stats["readiness_score"] == 70, stats
    assert isinstance(r.get_json()["data"]["recent_alerts"], list)


# ── seismic (honest external-feed contract) ─────────────────────────────────

def test_seismic_endpoint_honest_shape(client, admin_headers):
    r = client.get("/api/v1/emergency/seismic-alerts", headers=admin_headers)
    assert r.status_code == 200
    body = r.get_json()["data"]
    # Either live USGS events or an honest empty list with the unavailable flag.
    assert isinstance(body["alerts"], list)
    assert body.get("source") == "usgs"
    assert "unavailable" in body
    for event in body["alerts"]:
        assert {"magnitude", "location", "time", "depth_km", "distance_km", "event_id"} <= set(event)


# ── gating + rollback ────────────────────────────────────────────────────────

def test_gate_flip_blocks_disaster_routes(client, db, admin_headers):
    from extensions import cache

    r = client.get("/api/v1/emergency/drills", headers=admin_headers)
    assert r.status_code == 200
    sp = SchoolPlugin.query.filter_by(plugin_slug="disaster_management").first()
    sp.active = False
    db.session.commit()
    cache.delete(f"school:{sp.school_id}:plugins")
    r = client.get("/api/v1/emergency/drills", headers=admin_headers)
    assert r.status_code == 403
    sp.active = True
    db.session.commit()
    cache.delete(f"school:{sp.school_id}:plugins")
    assert client.get("/api/v1/emergency/drills", headers=admin_headers).status_code == 200


def test_drill_rollback_on_commit_failure(client, db, app, monkeypatch, admin_headers):
    from extensions import db as _db

    before = DisasterDrill.query.count()
    real_commit = _db.session.commit
    old_propagate = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False

    def failing_commit(*a, **kw):
        raise RuntimeError("simulated commit failure")

    try:
        monkeypatch.setattr(_db.session, "commit", failing_commit)
        resp = client.post("/api/v1/emergency/drills", json=_drill_payload(), headers=admin_headers)
        assert resp.status_code == 500
    finally:
        monkeypatch.setattr(_db.session, "commit", real_commit)
        app.config["PROPAGATE_EXCEPTIONS"] = old_propagate
        _db.session.rollback()

    assert DisasterDrill.query.count() == before
