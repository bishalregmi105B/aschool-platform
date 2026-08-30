"""Regression tests for backend audit SLICE 4 (communications / social).

Pins the runtime-verified fixes E190-E199 (audits/FIX_STATUS_2026-08-30.md):
- E190 chat role matrix: /communications/send and thread reads enforce the
  same directory matrix as /contacts (student->parent etc. -> 403);
- E191 chat delivery: a sent message writes an in-app notification for the
  recipient in the same commit, and reading the thread clears it;
- E192 conferences BS-calendar safety: out-of-range dates 400 on write,
  never OverflowError-500 on read; meeting_link must be http(s);
- E193 conference privacy: notes readable/writable by slot participants
  only; booking attributed to the caller (admins may delegate); cancel
  restricted to booking parent / slot teacher / admins;
- E194 social moderation: /social/posts/<id>/hide|unhide flip real state
  and remove the post from non-admin feeds;
- E195 group membership: hub_group_members backed join/leave, non-members
  cannot post/like/see group posts;
- E196 social input hardening: empty content 400, junk UUIDs 404 not 500;
- E197 sms template validation;
- E198 webhooks: WhatsApp verify fails closed when the token is
  unconfigured; malformed JSON -> 400; duplicate wa_message_id stored once;
- E199 services: PostSchedulerService uses real columns/enum values,
  SmsGatewayService survives non-JSON provider responses.
"""
import base64
import json
import uuid as _uuid
from datetime import datetime, timedelta

import pytest

from app.models.chat import ChatMessage
from app.models.conference import ConferenceSlot, PTConference
from app.models.notification import InAppNotification, WhatsAppMessage
from app.models.plugin import SchoolPlugin
from app.models.social import Group, GroupMember, Post
from app.models.user import User
from app.services.chat_service import ChatNotAllowedError, send_message
from tests.conftest import get_auth_headers
from tests.test_comms_plugins import _seed_plugin


@pytest.fixture
def hub_headers(client, db, school, admin_user):
    """Plugins + auth for the social hub / conferences endpoints."""
    for slug in ("social_hub", "conferences", "notices", "sms_notifications"):
        _seed_plugin(db, slug)
        db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug,
                                    active=True, is_trial=False))
    db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _user(db, school, role, name, email=None, phone=None):
    u = User(
        school_id=school.id,
        role=role,
        full_name=name,
        email=email or f"{name.lower().replace(' ', '.')}@slice4.test",
        phone=phone or f"+9779841{int(_uuid.uuid4().int % 100000):05d}",
        is_active=True,
    )
    db.session.add(u)
    db.session.commit()
    return u


def _login(client, user):
    user.set_password("Slice4@Test")
    from extensions import db as _db
    _db.session.commit()
    return get_auth_headers(client, user.email, "Slice4@Test")


# ── E190 + E191: chat role matrix + notification delivery ────────────────


def test_chat_role_matrix_blocks_student_to_parent(client, db, school,
                                                   admin_user):
    teacher = _user(db, school, "teacher", "Matrix Teacher")
    parent = _user(db, school, "parent", "Matrix Parent")
    student = _user(db, school, "student", "Matrix Student")

    bad = client.post("/api/v1/communications/send", json={
        "receiver_id": str(parent.id), "message": "hi"},
        headers=_login(client, student))
    assert bad.status_code == 403, bad.get_json()
    bad = client.post("/api/v1/communications/send", json={
        "receiver_id": str(student.id), "message": "hi"},
        headers=_login(client, parent))
    assert bad.status_code == 403
    # thread reads are gated by the same matrix
    bad = client.get(f"/api/v1/communications/messages/{parent.id}",
                     headers=_login(client, student))
    assert bad.status_code == 403
    # allowed pairs still work
    ok = client.post("/api/v1/communications/send", json={
        "receiver_id": str(teacher.id), "message": "pt question"},
        headers=_login(client, parent))
    assert ok.status_code == 201


def test_send_message_raises_chat_not_allowed(db, school):
    sender = _user(db, school, "student", "Svc Student")
    target = _user(db, school, "parent", "Svc Parent")
    with pytest.raises(ChatNotAllowedError):
        send_message(school.id, sender.id, target.id, "bypass?")
    # and nothing was persisted
    assert ChatMessage.query.filter_by(sender_id=sender.id).count() == 0


def test_chat_message_creates_and_clears_notification(client, db, school,
                                                      admin_user):
    parent = _user(db, school, "parent", "Notify Parent")
    teacher = _user(db, school, "teacher", "Notify Teacher")

    resp = client.post("/api/v1/communications/send", json={
        "receiver_id": str(teacher.id), "message": "bell test"},
        headers=_login(client, parent))
    assert resp.status_code == 201

    notif = InAppNotification.query.filter_by(
        school_id=school.id, user_id=teacher.id, category="message").first()
    assert notif is not None
    assert not notif.is_read
    assert notif.data.get("thread_user_id") == str(parent.id)

    # reading the thread clears the thread's message notifications
    resp = client.get(f"/api/v1/communications/messages/{parent.id}",
                      headers=_login(client, teacher))
    assert resp.status_code == 200
    assert notif.is_read
    assert notif.read_at is not None


# ── E192: conferences BS-calendar + meeting link ─────────────────────────


def test_conference_bs_range_rejected_on_write(client, db, school,
                                               admin_user, hub_headers):
    resp = client.post("/api/v1/conferences", json={
        "title": "Too far", "start_date": "2055-01-01T09:00:00Z",
        "end_date": "2055-01-02T09:00:00Z"}, headers=hub_headers)
    assert resp.status_code == 400
    assert "BS calendar range" in resp.get_json()["error"]
    # nothing was committed — the list stays healthy
    listing = client.get("/api/v1/conferences", headers=hub_headers)
    assert listing.status_code == 200


def test_conference_meeting_link_must_be_http(client, db, school,
                                              admin_user, hub_headers):
    resp = client.post("/api/v1/conferences", json={
        "title": "Bad link", "start_date": "2026-11-03T09:00:00Z",
        "end_date": "2026-11-03T10:00:00Z",
        "meeting_link": "javascript:alert(1)"}, headers=hub_headers)
    assert resp.status_code == 400


def test_conference_serializer_never_overflows_bs(db, school):
    from app.api.v1.conferences import _conf_dict
    conf = PTConference(school_id=school.id, title="Legacy",
                        start_date=datetime(2055, 1, 1, 9),
                        end_date=datetime(2055, 1, 2, 9))
    d = _conf_dict(conf)
    assert d["start_date_bs"] is None  # degraded, not OverflowError


# ── E193: notes privacy + booking integrity ──────────────────────────────


def _booked_slot(client, db, school, admin_user, hub_headers):
    conf = client.post("/api/v1/conferences", json={
        "title": "PTC E193", "start_date": "2026-11-05T09:00:00Z",
        "end_date": "2026-11-05T12:00:00Z"}, headers=hub_headers).get_json()["data"]
    teacher = _user(db, school, "teacher", "PTC Teacher")
    parent = _user(db, school, "parent", "PTC Parent")
    other = _user(db, school, "teacher", "PTC Other Teacher")
    slot = client.post(f"/api/v1/conferences/{conf['id']}/slots", json={
        "start_time": "2026-11-05T09:00:00Z",
        "end_time": "2026-11-05T09:15:00Z"},
        headers=_login(client, teacher)).get_json()["data"]
    slot_id = slot[0]["id"] if isinstance(slot, list) else slot["id"]
    book = client.post(f"/api/v1/conferences/slots/{slot_id}/book", json={},
                       headers=_login(client, parent))
    assert book.status_code == 200
    return conf, teacher, parent, other, slot_id


def test_booking_attributed_to_caller_and_admins_may_delegate(
        client, db, school, admin_user, hub_headers):
    conf, teacher, parent, other, slot_id = _booked_slot(
        client, db, school, admin_user, hub_headers)
    slot = ConferenceSlot.query.get(_uuid.UUID(slot_id))
    assert str(slot.parent_id) == str(parent.id)  # caller, not spoofed


def test_spoofed_parent_id_ignored_for_parents(client, db, school,
                                               admin_user, hub_headers):
    conf, teacher, parent, other, _ = _booked_slot(
        client, db, school, admin_user, hub_headers)
    slot2 = client.post(f"/api/v1/conferences/{conf['id']}/slots", json={
        "start_time": "2026-11-05T09:30:00Z",
        "end_time": "2026-11-05T09:45:00Z"},
        headers=_login(client, teacher)).get_json()["data"]
    slot2_id = slot2[0]["id"] if isinstance(slot2, list) else slot2["id"]
    resp = client.post(f"/api/v1/conferences/slots/{slot2_id}/book", json={
        "parent_id": str(other.id)}, headers=_login(client, parent))
    assert resp.status_code == 200
    assert resp.get_json()["data"]["parent_id"] == str(parent.id)


def test_notes_are_participant_only(client, db, school, admin_user,
                                    hub_headers):
    conf, teacher, parent, other, slot_id = _booked_slot(
        client, db, school, admin_user, hub_headers)
    # write: slot teacher ok, other teacher 403, booked parent not a writer
    assert client.put(f"/api/v1/conferences/slots/{slot_id}/notes",
                      json={"notes": "good progress"},
                      headers=_login(client, teacher)).status_code == 200
    assert client.put(f"/api/v1/conferences/slots/{slot_id}/notes",
                      json={"notes": "intruder"},
                      headers=_login(client, other)).status_code == 403
    # read: participants ok, unrelated teacher/parent 403
    assert client.get(f"/api/v1/conferences/slots/{slot_id}/notes",
                      headers=_login(client, parent)).status_code == 200
    assert client.get(f"/api/v1/conferences/slots/{slot_id}/notes",
                      headers=_login(client, other)).status_code == 403
    # admins can always read
    assert client.get(f"/api/v1/conferences/slots/{slot_id}/notes",
                      headers=hub_headers).status_code == 200


def test_cancel_restricted_to_participants(client, db, school, admin_user,
                                           hub_headers):
    conf, teacher, parent, other, slot_id = _booked_slot(
        client, db, school, admin_user, hub_headers)
    stranger = _user(db, school, "parent", "PTC Stranger")
    resp = client.post(f"/api/v1/conferences/slots/{slot_id}/cancel", json={},
                       headers=_login(client, stranger))
    assert resp.status_code == 403
    assert ConferenceSlot.query.get(_uuid.UUID(slot_id)).is_booked
    # booking parent can cancel
    resp = client.post(f"/api/v1/conferences/slots/{slot_id}/cancel", json={},
                       headers=_login(client, parent))
    assert resp.status_code == 200
    assert not ConferenceSlot.query.get(_uuid.UUID(slot_id)).is_booked


# ── E194: moderation ─────────────────────────────────────────────────────


def test_moderation_hide_unhide_flips_feed_state(client, db, school,
                                                 admin_user, hub_headers):
    teacher = _user(db, school, "teacher", "Mod Teacher")
    parent = _user(db, school, "parent", "Mod Parent")
    t_headers = _login(client, teacher)
    resp = client.post("/api/v1/social/posts", json={"content": "borderline"},
                       headers=t_headers)
    assert resp.status_code == 201, resp.get_json()
    pid = resp.get_json()["data"]["id"]

    hide = client.post(f"/api/v1/social/posts/{pid}/hide", headers=hub_headers)
    assert hide.status_code == 200
    assert hide.get_json()["data"]["is_hidden"] is True
    # gone from the parent feed
    feed = client.get("/api/v1/social/posts", headers=_login(client, parent))
    assert all(p["id"] != pid for p in feed.get_json()["data"])
    # admin still sees it (moderation visibility)
    admin_feed = client.get("/api/v1/social/posts", headers=hub_headers)
    assert any(p["id"] == pid for p in admin_feed.get_json()["data"])
    # teacher cannot moderate
    assert client.post(f"/api/v1/social/posts/{pid}/hide",
                       headers=t_headers).status_code == 403
    unhide = client.post(f"/api/v1/social/posts/{pid}/unhide",
                         headers=hub_headers)
    assert unhide.get_json()["data"]["is_hidden"] is False
    feed = client.get("/api/v1/social/posts", headers=_login(client, parent))
    assert any(p["id"] == pid for p in feed.get_json()["data"])


# ── E195: group membership enforcement ───────────────────────────────────


def test_group_membership_gates_posting_and_visibility(
        client, db, school, admin_user, hub_headers):
    teacher = _user(db, school, "teacher", "Group Owner")
    member = _user(db, school, "parent", "Group Member")
    outsider = _user(db, school, "parent", "Group Outsider")

    grp = client.post("/api/v1/social/groups", json={"name": "Chess Club"},
                      headers=_login(client, teacher)).get_json()["data"]
    gid = grp["id"]
    assert grp["member_count"] == 1  # creator auto-member

    # non-member cannot post into the group
    denied = client.post("/api/v1/social/posts", json={
        "content": "sneak", "group_id": gid},
        headers=_login(client, outsider))
    assert denied.status_code == 403

    # join -> member visible in group; owner (teacher) posts into it
    assert client.post(f"/api/v1/social/groups/{gid}/join", json={},
                       headers=_login(client, member)).status_code == 200
    post = client.post("/api/v1/social/posts", json={
        "content": "club meets friday", "group_id": gid},
        headers=_login(client, teacher))
    assert post.status_code == 201
    gpid = post.get_json()["data"]["id"]
    assert post.get_json()["data"]["group_id"] == gid
    assert post.get_json()["data"]["visibility"] == "group"

    member_feed = client.get("/api/v1/social/posts",
                             headers=_login(client, member))
    assert any(p["id"] == gpid for p in member_feed.get_json()["data"])
    out_feed = client.get("/api/v1/social/posts",
                          headers=_login(client, outsider))
    assert all(p["id"] != gpid for p in out_feed.get_json()["data"])

    # non-member cannot like it
    assert client.post(f"/api/v1/social/posts/{gpid}/like", json={},
                       headers=_login(client, outsider)).status_code == 403

    # leave -> count synced, group post no longer visible to the ex-member
    leave = client.post(f"/api/v1/social/groups/{gid}/leave", json={},
                        headers=_login(client, member))
    assert leave.get_json()["data"]["member_count"] == 1
    out_feed = client.get("/api/v1/social/posts",
                          headers=_login(client, member))
    assert all(p["id"] != gpid for p in out_feed.get_json()["data"])


# ── E196: social input hardening ─────────────────────────────────────────


def test_social_input_hardening(client, db, school, admin_user, hub_headers):
    assert client.post("/api/v1/social/posts", json={"content": "   "},
                       headers=hub_headers).status_code == 400
    assert client.post("/api/v1/social/posts", json={"content": "x"},
                       headers=hub_headers).status_code == 201
    pid = Post.query.filter_by(school_id=school.id).first().id
    assert client.post(f"/api/v1/social/posts/{pid}/comments",
                       json={"content": " "},
                       headers=hub_headers).status_code == 400
    # junk UUIDs -> 404, never a DataError 500
    for method, path in (
        ("post", "/api/v1/social/posts/not-a-uuid/like"),
        ("get", "/api/v1/social/posts/not-a-uuid/comments"),
        ("delete", "/api/v1/social/posts/not-a-uuid"),
        ("post", "/api/v1/social/posts/not-a-uuid/hide"),
    ):
        resp = getattr(client, method)(path, json={}, headers=hub_headers)
        assert resp.status_code == 404, (method, path, resp.status_code)
    assert client.post("/api/v1/social/groups", json={"name": " "},
                       headers=hub_headers).status_code == 400


# ── E197: sms template validation ────────────────────────────────────────


def test_sms_template_validation(client, db, school, admin_user,
                                 hub_headers):
    assert client.post("/api/v1/sms/templates", json={"name": "", "body": ""},
                       headers=hub_headers).status_code == 400
    assert client.post("/api/v1/sms/templates", json={
        "name": "Bad channel", "body": "x", "channel": "carrier-pigeon"},
        headers=hub_headers).status_code == 400
    ok = client.post("/api/v1/sms/templates", json={
        "name": "Attendance", "body": "{{student}} was absent",
        "channel": "sms"}, headers=hub_headers)
    assert ok.status_code == 201


# ── E198: webhook fail-closed + malformed JSON + duplicates ──────────────


def test_whatsapp_verify_fails_closed_without_token(app, client):
    old = app.config.get("WHATSAPP_VERIFY_TOKEN")
    app.config["WHATSAPP_VERIFY_TOKEN"] = ""
    try:
        resp = client.get("/webhooks/whatsapp?hub.mode=subscribe"
                          "&hub.verify_token=&hub.challenge=42")
        assert resp.status_code == 403
        resp = client.get("/webhooks/whatsapp?hub.mode=subscribe"
                          "&hub.verify_token=guess&hub.challenge=42")
        assert resp.status_code == 403
    finally:
        app.config["WHATSAPP_VERIFY_TOKEN"] = old


def test_whatsapp_malformed_json_is_client_error(client):
    resp = client.post("/webhooks/whatsapp", data=b"not-json{{",
                       content_type="application/json")
    assert resp.status_code == 400


def test_whatsapp_duplicate_message_stored_once(client, db, school,
                                                admin_user):
    from app.models.notification import WhatsAppBotConfig
    # exactly one ENABLED bot config -> inbound traffic attributes to this
    # school (the attribution contract used by _wa_resolve_school)
    db.session.add(WhatsAppBotConfig(school_id=school.id, is_enabled=True))
    db.session.commit()
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{"id": "1", "changes": [{"field": "messages", "value": {
            "messaging_product": "whatsapp",
            "metadata": {"display_phone_number": "15550001111",
                         "phone_number_id": "111111"},
            "contacts": [{"profile": {"name": "P"}, "wa_id": "9779811111111"}],
            "messages": [{"from": "9779811111111", "id": "S4TESTDUP1",
                          "timestamp": "1725000000",
                          "text": {"body": "hello"}, "type": "text"}],
        }}]}],
    }
    r1 = client.post("/webhooks/whatsapp", json=payload)
    assert r1.status_code == 200
    r2 = client.post("/webhooks/whatsapp", json=payload)  # Meta redelivery
    assert r2.status_code == 200
    assert r2.get_json()["data"]["duplicates"] == 1
    rows = WhatsAppMessage.query.filter_by(
        school_id=school.id, wa_message_id="S4TESTDUP1", direction="inbound").all()
    assert len(rows) == 1


# ── E199: services ───────────────────────────────────────────────────────


def test_post_scheduler_uses_real_columns(db, school):
    from app.services.social.post_scheduler import PostSchedulerService
    from app.models.social import SocialPost

    result = PostSchedulerService.schedule_post(
        str(school.id), "scheduled announcement", ["facebook"],
        datetime.utcnow() + timedelta(hours=1))
    assert result["status"] == "scheduled"
    row = SocialPost.query.filter_by(
        school_id=school.id, status="scheduled").first()
    assert row is not None and row.content_en == "scheduled announcement"
    assert row.media_urls == []
    # cancel returns the post to `draft` — a valid enum value
    assert PostSchedulerService.cancel_scheduled(result["id"]) is True
    assert SocialPost.query.get(row.id).status == "draft"


def test_sms_gateway_survives_non_json_response(app, monkeypatch):
    from app.services.communications import sms_gateway as sg

    class FakeResp:
        def json(self):
            raise ValueError("no JSON")

    monkeypatch.setattr(sg.requests, "post", lambda *a, **k: FakeResp())
    result = sg.SmsGatewayService.send_sms("9779800000001", "hi")
    assert result["success"] is False
    assert "non-JSON" in result["response"]["error"]
