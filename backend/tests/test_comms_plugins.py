"""Regression tests for the Phase-2 COMMUNICATIONS verification batch.

Pins the runtime-verified fixes (audits/FIX_STATUS_2026-08-28.md E30-E33):
- E30 social_ads has no backend API (GET/POST /social/campaigns → 404) —
  documented gap, asserted here so wiring the endpoints later flips this;
- E31 SMS queue honesty: the sender task flips SMSLog rows to their real
  per-message outcome (failed on missing credentials / provider errors,
  sent with cost on success) instead of leaving rows queued forever;
- E32 WhatsApp: JSONB auto-replies append persists; inbound webhook
  attribution honesty (no_enabled_bot / ambiguous_bot_owner → unhandled,
  never fake success) and signature verification;
- E33 conferences/notices input guards: bad ids and missing NOT NULL
  fields return 400/404 instead of IntegrityError 500; bare-array slot
  bodies are accepted; booking conflicts 409;
- notifications center: unread-count / read / tenancy / delete;
- g.current_user is resolved for X-School-Slug (mobile) requests too.
"""
import hashlib
import hmac
import json
import uuid as _uuid

import pytest

from app.models.notification import InAppNotification, SMSLog, WhatsAppBotConfig
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


def _seed_plugin(db, slug):
    exists = Plugin.query.filter_by(slug=slug).first()
    if exists:
        return exists
    plugin = Plugin(
        slug=slug,
        name=slug.replace("_", " ").title(),
        category="starter" if slug in ("sms_notifications", "whatsapp_bot") else "growth",
        price_monthly=0,
        price_yearly=0,
        is_free=True,
        is_published=True,
    )
    db.session.add(plugin)
    db.session.commit()
    return plugin


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    for slug in (
        "sms_notifications",
        "whatsapp_bot",
        "notices",
        "social_hub",
        "conferences",
    ):
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(
                school_id=school.id,
                plugin_slug=slug,
                active=True,
                is_trial=False,
            )
        )
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _make_student(db, school) -> Student:
    u = User(
        school_id=school.id,
        role="student",
        full_name="Comms Test Kid",
        email="comms.kid@test.edu.np",
        phone="+9779841000099",
        is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    student = Student(
        school_id=school.id,
        user_id=u.id,
        first_name="Comms",
        last_name="Kid",
        status="active",
    )
    db.session.add(student)
    db.session.commit()
    return student


# ── SMS (E31) ────────────────────────────────────────────────────────────────

def test_sms_send_validates_phones_and_queues(client, db, school, admin_headers):
    resp = client.post(
        "/api/v1/sms/send",
        json={"phones": ["9812345678", "not-a-phone"], "message": "hi"},
        headers=admin_headers,
    )
    assert resp.status_code == 400, resp.get_json()

    resp = client.post(
        "/api/v1/sms/send",
        json={"phones": ["9812345678", "977-9812345679"], "message": "School notice"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["data"]["queued"] == 2
    log_ids = resp.get_json()["data"]["log_ids"]

    rows = [db.session.get(SMSLog, _id) for _id in log_ids]
    assert all(r.status == "queued" and r.cost == 0 for r in rows)


def test_sms_task_marks_log_failed_without_credentials(
    client, db, school, app, admin_headers
):
    resp = client.post(
        "/api/v1/sms/send",
        json={"phones": ["9812345678"], "message": "no creds"},
        headers=admin_headers,
    )
    log_id = resp.get_json()["data"]["log_ids"][0]

    from app.tasks.sms_sender import send_sms as task_send_sms

    token_before = app.config.get("SPARROW_SMS_TOKEN", "")
    console_before = app.config.get("SMS_CONSOLE_MODE", False)
    app.config["SPARROW_SMS_TOKEN"] = ""
    app.config["SMS_CONSOLE_MODE"] = False
    try:
        result = task_send_sms("9812345678", "dev msg", log_id=log_id)
    finally:
        app.config["SPARROW_SMS_TOKEN"] = token_before
        app.config["SMS_CONSOLE_MODE"] = console_before

    assert result.get("status") == "console"
    row = db.session.get(SMSLog, log_id)
    db.session.refresh(row)
    # Honest no-credential outcome: the row must NOT stay queued/sent.
    assert row.status == "failed"
    assert row.cost == 0
    assert row.provider == "console"


def test_sms_task_marks_log_sent_with_provider_success(
    client, db, school, app, admin_headers, monkeypatch
):
    resp = client.post(
        "/api/v1/sms/send",
        json={"phones": ["9812345678"], "message": "real send"},
        headers=admin_headers,
    )
    log_id = resp.get_json()["data"]["log_ids"][0]

    from app.tasks import sms_sender

    def fake_post(url, data=None, **kw):
        class R:
            def raise_for_status(self):
                return None

            def json(self):
                return {"response_code": 200, "messgae_id": "abc123", "count": 1}

        return R()

    # the task imports requests inside the function — patch the module itself
    monkeypatch.setattr("requests.post", fake_post)
    token_before = app.config.get("SPARROW_SMS_TOKEN", "")
    console_before = app.config.get("SMS_CONSOLE_MODE", False)
    app.config["SPARROW_SMS_TOKEN"] = "fake-but-valid-shaped"
    app.config["SMS_CONSOLE_MODE"] = False
    try:
        result = sms_sender.send_sms("9812345678", "real send", log_id=log_id)
    finally:
        app.config["SPARROW_SMS_TOKEN"] = token_before
        app.config["SMS_CONSOLE_MODE"] = console_before

    assert result.get("response_code") == 200
    row = db.session.get(SMSLog, log_id)
    db.session.refresh(row)
    assert row.status == "sent"
    assert row.cost == 1
    assert row.provider_message_id == "abc123"
    assert row.sent_at is not None


def test_sms_task_marks_log_failed_on_provider_error(
    client, db, school, app, admin_headers, monkeypatch
):
    resp = client.post(
        "/api/v1/sms/send",
        json={"phones": ["9812345678"], "message": "boom"},
        headers=admin_headers,
    )
    log_id = resp.get_json()["data"]["log_ids"][0]

    from app.tasks import sms_sender

    def failing_post(url, data=None, **kw):
        raise ConnectionError("provider unreachable")

    monkeypatch.setattr("requests.post", failing_post)
    token_before = app.config.get("SPARROW_SMS_TOKEN", "")
    console_before = app.config.get("SMS_CONSOLE_MODE", False)
    app.config["SPARROW_SMS_TOKEN"] = "fake-token"
    app.config["SMS_CONSOLE_MODE"] = False
    try:
        with pytest.raises(ConnectionError):
            sms_sender.send_sms("9812345678", "boom", log_id=log_id)
    finally:
        app.config["SPARROW_SMS_TOKEN"] = token_before
        app.config["SMS_CONSOLE_MODE"] = console_before

    row = db.session.get(SMSLog, log_id)
    db.session.refresh(row)
    assert row.status == "failed"


def test_sms_stats_counts_only_sent_credits(client, db, school, admin_headers):
    db.session.add(
        SMSLog(school_id=school.id, to_phone="9800000000", message="x",
               status="sent", cost=3)
    )
    db.session.add(
        SMSLog(school_id=school.id, to_phone="9800000001", message="y",
               status="failed", cost=0)
    )
    db.session.commit()
    resp = client.get("/api/v1/sms/stats", headers=admin_headers)
    d = resp.get_json()["data"]
    assert d["sent"] == 1 and d["failed"] == 1 and d["credits_used"] == 3


# ── WhatsApp (E32) ───────────────────────────────────────────────────────────

def test_wa_auto_reply_append_persists(client, db, school, admin_headers):
    """The JSONB in-place append bug: rules must survive the commit."""
    resp = client.put(
        "/api/v1/whatsapp-bot/config",
        json={"is_enabled": True,
              "auto_replies": [{"keyword": "FEES", "response": "R1",
                                "match_type": "contains"}]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_json()

    resp = client.post(
        "/api/v1/whatsapp-bot/auto-replies",
        json={"keyword": "ATTENDANCE", "response": "R2"},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    resp = client.get("/api/v1/whatsapp-bot/auto-replies", headers=admin_headers)
    rules = resp.get_json()["data"]
    assert len(rules) == 2, f"rules lost on commit: {rules}"
    assert {r["keyword"] for r in rules} == {"FEES", "ATTENDANCE"}


def _wa_payload(msgs):
    return {"object": "whatsapp_business_account",
            "entry": [{"id": "WABAID", "changes": [{
                "field": "messages",
                "value": {"messaging_product": "whatsapp",
                          "metadata": {"display_phone_number": "9779800000000",
                                       "phone_number_id": "1234567890"},
                          "contacts": [],
                          "messages": msgs}}]}]}


def test_wa_webhook_unhandled_without_enabled_bot(client, db, school):
    resp = client.post("/webhooks/whatsapp", json=_wa_payload(
        [{"from": "9779812345678", "id": "wamid.1", "type": "text",
          "text": {"body": "hi"}}]))
    assert resp.status_code == 200
    d = resp.get_json()["data"]
    assert d["unhandled"] == 1 and d["processed"] == 0
    assert d["reason"] == "no_enabled_bot"


def test_wa_webhook_unhandled_when_ambiguous(client, db, school, admin_headers, app):
    db.session.add(WhatsAppBotConfig(school_id=school.id, is_enabled=True))
    # a second school with an enabled bot → attribution is ambiguous
    from app.models.school import School
    s2 = School(name="Other", slug="other-wa-school", type="private",
                level="secondary", district="K", plan="growth", is_active=True)
    db.session.add(s2)
    db.session.flush()
    db.session.add(WhatsAppBotConfig(school_id=s2.id, is_enabled=True))
    db.session.commit()

    # cookie-free client: the webhook is public and must not trip the
    # cookie-CSRF guard via cookies left by the admin login above
    bare = app.test_client()
    resp = bare.post("/webhooks/whatsapp", json=_wa_payload(
        [{"from": "9779812345678", "id": "wamid.2", "type": "text",
          "text": {"body": "hi"}}]))
    body = resp.get_json()
    assert body and body.get("success"), f"unexpected webhook response: {resp.status_code} {body}"
    d = body["data"]
    assert d["reason"] == "ambiguous_bot_owner" and d["unhandled"] == 1


def test_wa_webhook_processes_and_stores_inbound(client, db, school):
    db.session.add(WhatsAppBotConfig(school_id=school.id, is_enabled=True))
    db.session.commit()
    resp = client.post("/webhooks/whatsapp", json=_wa_payload(
        [{"from": "9779812345678", "id": "wamid.3", "type": "text",
          "text": {"body": "FEES please"}}]))
    d = resp.get_json()["data"]
    assert d["processed"] == 1 and d["unhandled"] == 0

    from app.models.notification import WhatsAppMessage
    row = WhatsAppMessage.query.filter_by(
        school_id=school.id, wa_message_id="wamid.3").first()
    assert row is not None
    assert row.direction == "inbound"
    assert row.content == "FEES please"


def test_wa_webhook_signature_verification(client, db, school, app):
    app.config["WHATSAPP_APP_SECRET"] = "test-secret"
    try:
        body = json.dumps(_wa_payload(
            [{"from": "9779812345678", "id": "wamid.4", "type": "text",
              "text": {"body": "hi"}}])).encode()
        resp = client.post(
            "/webhooks/whatsapp", data=body,
            headers={"Content-Type": "application/json",
                     "X-Hub-Signature-256": "sha256=deadbeef"})
        assert resp.status_code == 403

        sig = hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
        resp = client.post(
            "/webhooks/whatsapp", data=body,
            headers={"Content-Type": "application/json",
                     "X-Hub-Signature-256": f"sha256={sig}"})
        assert resp.status_code == 200
    finally:
        app.config["WHATSAPP_APP_SECRET"] = ""


# ── social_ads (E30 — now WIRED; pin the gate) ───────────────────────────────

def test_social_ads_campaigns_endpoints_exist_and_are_gated(client, db, admin_headers):
    """E30 flipped (2026-08-29): /social/campaigns* routes now exist and are
    gated `plugin_required("social_ads")` — a school WITHOUT the plugin gets
    403 (not 404) from every campaign route."""
    assert client.get("/api/v1/social/campaigns",
                      headers=admin_headers).status_code == 403
    assert client.post("/api/v1/social/campaigns", json={"name": "x"},
                       headers=admin_headers).status_code == 403


# ── Conferences (E33) ────────────────────────────────────────────────────────

def _make_conference(client, admin_headers):
    resp = client.post(
        "/api/v1/conferences",
        json={"title": "PTM", "start_date": "2026-09-01T09:00:00",
              "end_date": "2026-09-03T17:00:00"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["data"]["id"]


def test_conference_create_validates_required_fields(client, db, admin_headers):
    resp = client.post("/api/v1/conferences", json={"description": "nope"},
                       headers=admin_headers)
    assert resp.status_code == 400
    assert "title" in resp.get_json()["error"]

    resp = client.post(
        "/api/v1/conferences",
        json={"title": "PTM", "start_date": "garbage", "end_date": "2026-09-30"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_conference_create_rejects_end_before_start(client, db, admin_headers):
    resp = client.post(
        "/api/v1/conferences",
        json={"title": "PTM", "start_date": "2026-09-10T09:00:00",
              "end_date": "2026-09-01T09:00:00"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_slots_unknown_conference_404_and_missing_times_400(
    client, db, admin_headers
):
    resp = client.post(
        f"/api/v1/conferences/{_uuid.uuid4()}/slots",
        json={"start_time": "2026-09-01T10:00:00",
              "end_time": "2026-09-01T10:30:00"},
        headers=admin_headers,
    )
    assert resp.status_code == 404

    conf_id = _make_conference(client, admin_headers)
    resp = client.post(f"/api/v1/conferences/{conf_id}/slots",
                       json={"foo": "bar"}, headers=admin_headers)
    assert resp.status_code == 400


def test_slots_accept_bare_array_and_reject_bogus_teacher(
    client, db, school, admin_user, admin_headers
):
    conf_id = _make_conference(client, admin_headers)
    resp = client.post(
        f"/api/v1/conferences/{conf_id}/slots",
        json=[
            {"start_time": "2026-09-01T10:00:00",
             "end_time": "2026-09-01T10:30:00"},
            {"start_time": "2026-09-01T11:00:00",
             "end_time": "2026-09-01T11:30:00"},
        ],
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.get_json()
    assert len(resp.get_json()["data"]) == 2

    resp = client.post(
        f"/api/v1/conferences/{conf_id}/slots",
        json={"teacher_id": str(_uuid.uuid4()),
              "start_time": "2026-09-01T12:00:00",
              "end_time": "2026-09-01T12:30:00"},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "teacher_id" in resp.get_json()["error"]


def test_slot_booking_flow_and_conflict(client, db, school, admin_headers):
    conf_id = _make_conference(client, admin_headers)
    student = _make_student(db, school)
    resp = client.post(
        f"/api/v1/conferences/{conf_id}/slots",
        json={"start_time": "2026-09-01T10:00:00",
              "end_time": "2026-09-01T10:30:00"},
        headers=admin_headers,
    )
    slot_id = resp.get_json()["data"][0]["id"]

    # bogus student → 400, not 500
    resp = client.post(
        f"/api/v1/conferences/slots/{slot_id}/book",
        json={"student_id": str(_uuid.uuid4())},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    # legit booking
    resp = client.post(
        f"/api/v1/conferences/slots/{slot_id}/book",
        json={"student_id": str(student.id)},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["is_booked"] is True

    # double-book → 409
    resp = client.post(
        f"/api/v1/conferences/slots/{slot_id}/book", json={},
        headers=admin_headers)
    assert resp.status_code == 409

    # cancel then rebook
    resp = client.post(f"/api/v1/conferences/slots/{slot_id}/cancel", json={},
                       headers=admin_headers)
    assert resp.status_code == 200 and resp.get_json()["data"]["is_booked"] is False

    # notes on unknown slot → 404
    resp = client.put(f"/api/v1/conferences/slots/{_uuid.uuid4()}/notes",
                      json={"notes": "x"}, headers=admin_headers)
    assert resp.status_code == 404


# ── Notices (E33) ────────────────────────────────────────────────────────────

def test_event_requires_start_date_and_valid_date(client, db, admin_headers):
    resp = client.post("/api/v1/notices/events", json={"title": "Sports Day"},
                       headers=admin_headers)
    assert resp.status_code == 400

    resp = client.post("/api/v1/notices/events",
                       json={"title": "Sports Day", "start_date": "garbage"},
                       headers=admin_headers)
    assert resp.status_code == 400

    resp = client.post("/api/v1/notices/events",
                       json={"title": "Sports Day", "start_date": "2026-10-15"},
                       headers=admin_headers)
    assert resp.status_code == 201
    event_id = resp.get_json()["data"]["id"]

    resp = client.put(f"/api/v1/notices/events/{event_id}",
                      json={"start_date": "nope"}, headers=admin_headers)
    assert resp.status_code == 400


def test_notice_create_sanitizes_script(client, db, admin_headers):
    resp = client.post(
        "/api/v1/notices",
        json={"title": "T", "content": "<p>ok</p><script>alert(1)</script>"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    assert "<script>" not in resp.get_json()["data"]["content"]


# ── Notifications center ─────────────────────────────────────────────────────

def test_notification_center_flow(client, db, school, admin_user, admin_headers):
    from app.api.v1.notifications import create_notification

    uid = str(admin_user.id)
    n1 = create_notification(school.id, uid, "Fee reminder", "due",
                             category="fee", priority="high")
    n2 = create_notification(school.id, uid, "Notice", "pinned", category="notice")
    n3 = create_notification(school.id, uid, "Exam", "published", category="exam")

    resp = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert resp.get_json()["data"]["unread_count"] == 3

    resp = client.get("/api/v1/notifications?category=fee", headers=admin_headers)
    assert len(resp.get_json()["data"]) == 1

    resp = client.post(f"/api/v1/notifications/{n1.id}/read", headers=admin_headers)
    assert resp.get_json()["data"]["is_read"] is True

    resp = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert resp.get_json()["data"]["unread_count"] == 2

    resp = client.post("/api/v1/notifications/mark-all-read", headers=admin_headers)
    assert resp.get_json()["data"]["marked_read"] == 2

    resp = client.delete(f"/api/v1/notifications/{n3.id}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.get("/api/v1/notifications", headers=admin_headers)
    assert all(n["id"] != str(n3.id) for n in resp.get_json()["data"])


def test_notification_read_isolated_per_user(client, db, school, admin_user,
                                             teacher_user):
    from app.api.v1.notifications import create_notification

    n = create_notification(school.id, str(admin_user.id), "Only admin", "secret")
    teacher = User.query.filter_by(role="teacher").first()
    teacher.set_password("Test@1234")
    teacher.email = "teacher@test.edu.np"
    db.session.commit()

    t_headers = get_auth_headers(client, "teacher@test.edu.np", "Test@1234")
    resp = client.post(f"/api/v1/notifications/{n.id}/read", headers=t_headers)
    assert resp.status_code == 404


# ── g.current_user resolution for header-based (mobile) auth ────────────────

def test_current_user_resolved_for_header_auth(client, db, school, admin_user):
    """Endpoints reading g.current_user must not 500 for X-School-Slug
    (mobile-style) requests — the user is resolved before school context."""
    _seed_plugin(db, "sms_notifications")
    db.session.add(SchoolPlugin(school_id=school.id,
                                plugin_slug="sms_notifications", active=True))
    db.session.commit()

    u = User.query.filter_by(role="school_admin").first()
    u.set_password("Test@1234")
    u.email = "admin@test.edu.np"
    db.session.commit()
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@test.edu.np", "password": "Test@1234"},
        headers={"X-School-Slug": "test-academy"})
    token = resp.get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}",
               "X-School-Slug": "test-academy"}

    resp = client.post("/api/v1/sms/send",
                       json={"phones": ["9812345678"], "message": "hi"},
                       headers=headers)
    assert resp.status_code == 201, resp.get_json()
    log_id = resp.get_json()["data"]["log_ids"][0]
    row = db.session.get(SMSLog, log_id)
    db.session.refresh(row)
    assert str(row.sent_by_id) == str(u.id)


def test_wa_auto_reply_exact_match_does_not_fall_through_to_contains():
    """E121: an exact-match rule that does not equal the text must not be
    re-matched by the trailing contains check ("SL4EXACT2" must NOT trigger
    the exact rule "SL4EXACT"); contains/regex rules keep their semantics."""
    from app.api.webhooks import _wa_match_auto_reply

    rules = [
        {"keyword": "fees", "response": "R1"},
        {"keyword": "SL4EXACT", "match_type": "exact", "response": "R2"},
        {"keyword": r"^bus\d+$", "match_type": "regex", "response": "R3"},
    ]
    assert _wa_match_auto_reply(rules, "What are the FEES?")["keyword"] == "fees"
    assert _wa_match_auto_reply(rules, "SL4EXACT")["keyword"] == "SL4EXACT"
    assert _wa_match_auto_reply(rules, "sl4exact")["keyword"] == "SL4EXACT"
    assert _wa_match_auto_reply(rules, "SL4EXACT2") is None
    assert _wa_match_auto_reply(rules, "bus12")["keyword"] == r"^bus\d+$"
    assert _wa_match_auto_reply(rules, "busx") is None
    assert _wa_match_auto_reply(rules, "hello there") is None


def test_broadcast_push_delivers_in_app_notifications(client, db, school,
                                                      admin_user, admin_headers):
    """E122: channel=push now performs real delivery — one InAppNotification
    per audience user, school-scoped — instead of a fake `accepted` no-op."""
    parent = User(
        school_id=school.id,
        role="parent",
        full_name="Push Parent",
        phone="9807654321",
        email="push.parent@test.edu.np",
        is_active=True,
    )
    db.session.add(parent)
    db.session.commit()

    resp = client.post("/api/v1/communications/broadcast", json={
        "channel": "push", "audience": "all_parents",
        "message": "PTA meeting Friday"},
        headers=admin_headers)
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()["data"]
    assert body["channel"] == "push"
    assert body["status"] == "sent"
    assert body["queued"] == 1 and body["recipients"] == 1

    rows = InAppNotification.query.filter_by(
        school_id=school.id, user_id=parent.id, category="broadcast").all()
    assert len(rows) == 1
    assert rows[0].body == "PTA meeting Friday"


def test_broadcast_whatsapp_honest_skip_without_credentials(client, db,
                                                            school, admin_headers):
    """E122: channel=whatsapp with no configured credentials reports
    status=skipped + reason (never a fake success), and channel=email that
    cannot send reports status=failed with the SMTP reason."""
    resp = client.post("/api/v1/communications/broadcast", json={
        "channel": "whatsapp", "audience": "all_parents",
        "message": "wa probe"}, headers=admin_headers)
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()["data"]
    # No parents exist in this fixture school -> honest zero recipients
    if body["recipients"] == 0:
        assert body["queued"] == 0
        assert body["status"] == "sent"  # nothing to deliver, honestly 0
    else:
        assert body["status"] == "skipped"
        assert body["reason"] == "whatsapp_not_configured"
        assert body["queued"] == 0

    parent = User(
        school_id=school.id,
        role="parent",
        full_name="WA Parent",
        phone="9801111222",
        email="wa.parent@test.edu.np",
        is_active=True,
    )
    db.session.add(parent)
    db.session.commit()

    resp = client.post("/api/v1/communications/broadcast", json={
        "channel": "whatsapp", "audience": "all_parents",
        "message": "wa probe 2"}, headers=admin_headers)
    body = resp.get_json()["data"]
    assert body["recipients"] == 1
    assert body["status"] == "skipped"
    assert body["reason"] == "whatsapp_not_configured"

    resp = client.post("/api/v1/communications/broadcast", json={
        "channel": "email", "audience": "all_parents", "subject": "Hi",
        "message": "email probe"}, headers=admin_headers)
    body = resp.get_json()["data"]
    assert body["recipients"] == 1
    assert body["status"] == "failed"
    assert body["reason"] == "email_not_configured_or_smtp_error"
    assert body["queued"] == 0
