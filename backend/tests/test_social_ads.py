"""E30 regression tests: social_ads campaign API (blueprint app/api/v1/social_ads.py).

Covers what the runtime probe proved (audits/FIX_STATUS_2026-08-28.md E30):
- plugin gate: every /social/campaigns* route is 403 without the plugin;
- CRUD roundtrip create→list→get→patch→pause→resume→soft-delete;
- targeting validated against REAL classes/sections (unknown/foreign → 400);
- the audience preview/estimate equals direct SQL counts (honest reach —
  matched students + distinct guardians, never fabricated impressions);
- XSS: content is bleach-sanitized like notices, media_url must be http(s);
- tenancy: another school's admin gets 404 on our campaign id;
- a failed commit rolls back — no partial campaign row survives.
"""
import pytest

from app.models.academic import Class, Section
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.social import AdCampaign
from app.models.student import Guardian, Student
from app.models.user import User
from extensions import db
from tests.conftest import get_auth_headers

PASSWORD = "Test@1234"


def _seed_social_ads_plugin(db):
    """The plugins table must hold the slug before SchoolPlugin can FK it."""
    exists = Plugin.query.filter_by(slug="social_ads").first()
    if exists:
        return exists
    plugin = Plugin(
        slug="social_ads",
        name="Social Ad Boosting",
        category="growth",
        price_monthly=499,
        price_yearly=4999,
        is_free=False,
        is_published=True,
    )
    db.session.add(plugin)
    db.session.commit()
    return plugin


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    """Admin headers for a school WITHOUT the social_ads plugin."""
    return get_auth_headers(client, "admin@test.edu.np", PASSWORD)


@pytest.fixture
def social_headers(client, db, school, admin_user):
    """Admin headers for a school WITH the social_ads plugin installed."""
    _seed_social_ads_plugin(db)
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="social_ads",
                     active=True, is_trial=False)
    )
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", PASSWORD)


def _seed_audience(db, school, n_students=3, guardians_per=2, section=None):
    """Seed students (+ guardians) under a section; returns nothing."""
    for i in range(n_students):
        student = Student(
            school_id=school.id,
            first_name=f"Ad{i}",
            last_name="Tester",
            status="active",
            section_id=section.id if section else None,
            class_id=section.class_id if section else None,
        )
        db.session.add(student)
        db.session.flush()
        for j in range(guardians_per):
            db.session.add(Guardian(
                school_id=school.id,
                student_id=student.id,
                full_name=f"Guardian {i}-{j}",
                relation="father" if j == 0 else "mother",
            ))
    db.session.commit()


@pytest.fixture
def class_section(db, school):
    klass = Class(school_id=school.id, name="Grade 10", numeric_grade=10)
    db.session.add(klass)
    db.session.flush()
    sec = Section(school_id=school.id, class_id=klass.id, name="A")
    db.session.add(sec)
    db.session.commit()
    return klass, sec


# ── Plugin gate ──────────────────────────────────────────────────────────────

def test_campaign_routes_403_without_social_ads_plugin(client, db, admin_headers):
    """A school WITHOUT the plugin gets 403 (not 404) — the routes exist and
    self-gate via @plugin_required('social_ads')."""
    assert client.get("/api/v1/social/campaigns",
                      headers=admin_headers).status_code == 403
    assert client.post("/api/v1/social/campaigns", json={"name": "x"},
                       headers=admin_headers).status_code == 403
    assert client.get("/api/v1/social/campaigns/preview",
                      headers=admin_headers).status_code == 403


# ── CRUD roundtrip ───────────────────────────────────────────────────────────

def test_campaign_crud_roundtrip(client, db, social_headers):
    resp = client.post("/api/v1/social/campaigns", json={
        "name": "Grade 1 Admission 2082",
        "content": "<p>Enroll now</p>",
        "media_url": "https://cdn.example.com/ad.jpg",
        "platform": "facebook",
        "objective": "admission",
        "budget": "15000",
        "start_date": "2026-09-01T00:00:00",
        "end_date": "2026-09-30T00:00:00",
    }, headers=social_headers)
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()["data"]
    cid = body["id"]
    assert body["name"] == "Grade 1 Admission 2082"
    assert body["status"] == "draft"
    assert body["budget"] == 15000.0
    assert body["reach"] == 0 and body["impressions"] == 0  # honest zeros

    # List shows it, with stats.
    lst = client.get("/api/v1/social/campaigns", headers=social_headers)
    assert lst.status_code == 200
    items = lst.get_json()["data"]["items"]
    assert [c["id"] for c in items] == [cid]
    assert lst.get_json()["data"]["stats"]["total"] == 1

    # Detail.
    got = client.get(f"/api/v1/social/campaigns/{cid}", headers=social_headers)
    assert got.status_code == 200
    assert got.get_json()["data"]["audience_estimate"]["estimate_basis"]

    # draft → paused is not an allowed transition.
    bad = client.patch(f"/api/v1/social/campaigns/{cid}",
                       json={"status": "paused"}, headers=social_headers)
    assert bad.status_code == 400

    # draft → active → pause endpoint → resume endpoint.
    act = client.patch(f"/api/v1/social/campaigns/{cid}",
                       json={"status": "active"}, headers=social_headers)
    assert act.status_code == 200 and act.get_json()["data"]["status"] == "active"
    paused = client.post(f"/api/v1/social/campaigns/{cid}/pause",
                         headers=social_headers)
    assert paused.status_code == 200 and paused.get_json()["data"]["status"] == "paused"
    resumed = client.post(f"/api/v1/social/campaigns/{cid}/resume",
                          headers=social_headers)
    assert resumed.status_code == 200 and resumed.get_json()["data"]["status"] == "active"

    # Soft delete: list drops it, detail 404s.
    deleted = client.delete(f"/api/v1/social/campaigns/{cid}",
                            headers=social_headers)
    assert deleted.status_code == 200
    assert client.get(f"/api/v1/social/campaigns/{cid}",
                      headers=social_headers).status_code == 404
    lst2 = client.get("/api/v1/social/campaigns", headers=social_headers)
    assert lst2.get_json()["data"]["items"] == []


# ── Honest audience estimate vs SQL ──────────────────────────────────────────

def test_preview_estimate_matches_sql_counts(client, db, social_headers,
                                             school, class_section):
    klass, sec = class_section
    _seed_audience(db, school, n_students=3, guardians_per=2, section=sec)

    resp = client.get(
        f"/api/v1/social/campaigns/preview?class_ids={klass.id}"
        f"&section_ids={sec.id}&audience=students_parents",
        headers=social_headers,
    )
    assert resp.status_code == 200, resp.get_json()
    est = resp.get_json()["data"]

    # Direct SQL: matched students of THIS school under the class/section.
    students = Student.query.filter(
        Student.school_id == school.id,
        Student.is_deleted.is_(False),
        Student.class_id == klass.id,
        Student.section_id == sec.id,
    ).count()
    guardians = (
        db.session.query(Guardian.id)
        .join(Student, Guardian.student_id == Student.id)
        .filter(Student.school_id == school.id,
                Student.section_id == sec.id)
        .distinct().count()
    )
    assert est["students_count"] == students == 3
    assert est["guardians_count"] == guardians == 6
    assert est["estimated_reach"] == students + guardians == 9
    assert "Not a Meta impression forecast" in est["estimate_basis"]

    # Live data, not a constant: another student bumps the estimate.
    db.session.add(Student(school_id=school.id, first_name="Extra",
                           last_name="Kid", status="active",
                           class_id=klass.id, section_id=sec.id))
    db.session.commit()
    est2 = client.get(
        f"/api/v1/social/campaigns/preview?audience=students",
        headers=social_headers,
    ).get_json()["data"]
    assert est2["estimated_reach"] == 4

    # audience=parents counts guardians only.
    est3 = client.get(
        f"/api/v1/social/campaigns/preview?audience=parents",
        headers=social_headers,
    ).get_json()["data"]
    assert est3["estimated_reach"] == 6


# ── Targeting validation ─────────────────────────────────────────────────────

def test_create_rejects_invalid_targeting(client, db, social_headers, school,
                                          class_section):
    klass, sec = class_section

    # Unknown class id.
    r = client.post("/api/v1/social/campaigns", json={
        "name": "x", "class_ids": ["00000000-0000-0000-0000-000000000001"]},
        headers=social_headers)
    assert r.status_code == 400 and "Unknown class" in r.get_json()["error"]

    # Junk (non-UUID) targeting ids must be 400, never a Postgres 500.
    for junk in (["abc"], ["None"], ["; DROP TABLE students; --"]):
        r = client.post("/api/v1/social/campaigns", json={
            "name": "x", "class_ids": junk}, headers=social_headers)
        assert r.status_code == 400, (junk, r.status_code, r.get_json())
        r = client.get(
            "/api/v1/social/campaigns/preview?class_ids=" + junk[0],
            headers=social_headers)
        assert r.status_code == 400, (junk, r.status_code, r.get_json())

    # Section from ANOTHER school is not acceptable.
    other = School(name="Other", slug="other-ad-school", plan="growth",
                   is_active=True)
    db.session.add(other)
    db.session.flush()
    other_class = Class(school_id=other.id, name="Other Grade")
    db.session.add(other_class)
    db.session.flush()
    other_sec = Section(school_id=other.id, class_id=other_class.id, name="Z")
    db.session.add(other_sec)
    db.session.commit()
    r = client.post("/api/v1/social/campaigns", json={
        "name": "x", "section_ids": [str(other_sec.id)]},
        headers=social_headers)
    assert r.status_code == 400 and "Unknown section" in r.get_json()["error"]

    # A section that belongs to a class NOT among the selected classes.
    klass2 = Class(school_id=school.id, name="Grade 11", numeric_grade=11)
    db.session.add(klass2)
    db.session.flush()
    sec2 = Section(school_id=school.id, class_id=klass2.id, name="B")
    db.session.add(sec2)
    db.session.commit()
    r = client.post("/api/v1/social/campaigns", json={
        "name": "x", "class_ids": [str(klass.id)],
        "section_ids": [str(sec2.id)]},
        headers=social_headers)
    assert r.status_code == 400 and "does not belong" in r.get_json()["error"]

    # Bad audience enum.
    r = client.post("/api/v1/social/campaigns", json={
        "name": "x", "audience": "everyone_on_the_internet"},
        headers=social_headers)
    assert r.status_code == 400

    # Non-http media URL (javascript:/data: payloads) — JSON 400, and the
    # same guard on PATCH (a bare-string return used to leak a 200 HTML page).
    r = client.post("/api/v1/social/campaigns", json={
        "name": "x", "media_url": "javascript:alert(1)"},
        headers=social_headers)
    assert r.status_code == 400
    assert r.content_type.startswith("application/json")
    made = client.post("/api/v1/social/campaigns", json={"name": "y"},
                       headers=social_headers)
    yid = made.get_json()["data"]["id"]
    r = client.patch(f"/api/v1/social/campaigns/{yid}",
                     json={"media_url": "javascript:alert(1)"},
                     headers=social_headers)
    assert r.status_code == 400
    assert r.content_type.startswith("application/json")

    # end_date before start_date.
    r = client.post("/api/v1/social/campaigns", json={
        "name": "x", "start_date": "2026-10-01", "end_date": "2026-09-01"},
        headers=social_headers)
    assert r.status_code == 400

    # Only the deliberately-created 'y' exists — every rejected create
    # persisted nothing.
    assert AdCampaign.query.filter_by(school_id=school.id).count() == 1


# ── XSS sanitization ─────────────────────────────────────────────────────────

def test_content_is_sanitized_like_notices(client, db, social_headers):
    r = client.post("/api/v1/social/campaigns", json={
        "name": "Ad <b>Boost</b>",
        "content": "<p>Fine</p><script>alert(1)</script>"
                   "<img src=x onerror=alert(1)>",
    }, headers=social_headers)
    assert r.status_code == 201
    data = r.get_json()["data"]
    assert "<script>" not in (data["content"] or "")
    assert "onerror" not in (data["content"] or "")
    assert "<p>Fine</p>" in data["content"]
    assert data["name"] == "Ad Boost"  # plain-text field: ALL markup stripped


# ── Tenancy ──────────────────────────────────────────────────────────────────

def test_other_school_admin_gets_404_on_foreign_campaign(
        client, db, social_headers, school):
    r = client.post("/api/v1/social/campaigns", json={"name": "mine"},
                    headers=social_headers)
    cid = r.get_json()["data"]["id"]

    other = School(name="Rival", slug="rival-ad-school", plan="growth",
                   is_active=True)
    db.session.add(other)
    db.session.flush()
    rival = User(school_id=other.id, role="school_admin",
                 full_name="Rival Admin", phone="+9779899990001",
                 email="rival@rival.test", is_active=True)
    rival.set_password(PASSWORD)
    db.session.add(rival)
    # The rival school has the plugin too — so its 404 is a real tenancy 404,
    # not the plugin gate's 403.
    db.session.add(SchoolPlugin(school_id=other.id, plugin_slug="social_ads",
                                active=True, is_trial=False))
    db.session.commit()
    rival_headers = get_auth_headers(client, "rival@rival.test", PASSWORD)

    assert client.get(f"/api/v1/social/campaigns/{cid}",
                      headers=rival_headers).status_code == 404
    assert client.delete(f"/api/v1/social/campaigns/{cid}",
                         headers=rival_headers).status_code == 404
    # ...and it still exists for its owner.
    assert client.get(f"/api/v1/social/campaigns/{cid}",
                      headers=social_headers).status_code == 200


# ── Rollback on mid-write failure ────────────────────────────────────────────

def test_create_rolls_back_on_commit_failure(client, db, social_headers,
                                             school, monkeypatch):
    from extensions import db as ext_db

    real_commit = ext_db.session.commit

    def exploding_commit():
        raise RuntimeError("disk on fire mid-write")

    ext_db.session.commit = exploding_commit
    try:
        r = client.post("/api/v1/social/campaigns",
                        json={"name": "doomed"}, headers=social_headers)
    finally:
        ext_db.session.commit = real_commit
    assert r.status_code == 500
    # No partial row survived the failed commit.
    assert AdCampaign.query.filter_by(school_id=school.id).count() == 0
    # The session recovered: a good create right after still works.
    r2 = client.post("/api/v1/social/campaigns",
                     json={"name": "healthy"}, headers=social_headers)
    assert r2.status_code == 201
    assert AdCampaign.query.filter_by(school_id=school.id).count() == 1
