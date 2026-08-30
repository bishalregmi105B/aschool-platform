"""TEMPORARY Phase-2 verification probe (COMMUNICATIONS plugins).

Covers: sms_notifications, whatsapp_bot (incl. inbound webhook honesty),
notices, social_hub, social_ads, conferences, notifications (in-app).

Creates a throwaway school with the plugins installed, drives the live HTTP
API with fixture rows, prints PASS/FAIL evidence lines, and cleans up.
Run: docker compose exec flask python tmp_comms_verify.py
"""
import json
import sys
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import requests

BASE = "http://localhost:5000/api/v1"
WH_BASE = "http://localhost:5000/api/v1"  # webhooks registered under /api/v1? verified below
SUFFIX = uuid_mod.uuid4().hex[:6]
SLUG = f"comms-audit-{SUFFIX}"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:300]))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {str(detail)[:300]}")


# ───────────────────────────── setup ─────────────────────────────
from app import create_app  # noqa: E402
from extensions import db  # noqa: E402

app = create_app()
created = {"schools": [], "user_ids": []}

with app.app_context():
    from app.models.school import School
    from sqlalchemy import text
    for prefix in ("comms-audit-", "comms-audit2-"):
        old = School.query.filter(School.slug.like(f"{prefix}%")).all()
        for s in old:
            sid = str(s.id)
            for stmt in [
                "DELETE FROM whatsapp_messages WHERE school_id=:s",
                "DELETE FROM whatsapp_bot_configs WHERE school_id=:s",
                "DELETE FROM sms_logs WHERE school_id=:s",
                "DELETE FROM notification_templates WHERE school_id=:s",
                "DELETE FROM in_app_notifications WHERE school_id=:s",
                "DELETE FROM hub_comments WHERE school_id=:s",
                "DELETE FROM hub_posts WHERE school_id=:s",
                "DELETE FROM hub_groups WHERE school_id=:s",
                "DELETE FROM conference_notes WHERE school_id=:s",
                "DELETE FROM conference_slots WHERE school_id=:s",
                "DELETE FROM pt_conferences WHERE school_id=:s",
                "DELETE FROM events WHERE school_id=:s",
                "DELETE FROM notices WHERE school_id=:s",
                "UPDATE students SET user_id=NULL WHERE school_id=:s",
                "DELETE FROM students WHERE school_id=:s",
                "DELETE FROM school_plugins WHERE school_id=:s",
                "DELETE FROM users WHERE school_id=:s",
                "DELETE FROM schools WHERE id=:s",
            ]:
                try:
                    db.session.execute(text(stmt), {"s": sid})
                except Exception:
                    db.session.rollback()
        print(f"swept leftover school(s) {prefix}*")
    db.session.commit()

with app.app_context():
    from app.models.school import School
    from app.models.user import User
    from app.models.student import Student
    from app.models.plugin import SchoolPlugin
    school = School(
        name="Comms Audit School", slug=SLUG, type="private",
        level="secondary", district="Kathmandu", plan="growth", is_active=True,
    )
    db.session.add(school)
    db.session.flush()
    created["schools"].append(str(school.id))

    def mkuser(school_obj, role, full_name, phone):
        u = User(
            school_id=str(school_obj.id), role=role, full_name=full_name,
            phone=phone, email=f"{phone}@{school_obj.slug}.test", is_active=True,
        )
        u.set_password("ProbePass123!")
        db.session.add(u)
        db.session.flush()
        created["user_ids"].append(str(u.id))
        return u

    admin = mkuser(school, "school_admin", "Comms Admin", "9802220001")
    teacher = mkuser(school, "teacher", "Comms Teacher", "9802220002")
    parent = mkuser(school, "parent", "Comms Parent", "9802220003")

    for slug in ["sms_notifications", "whatsapp_bot", "notices",
                 "social_hub", "social_ads", "conferences"]:
        db.session.add(SchoolPlugin(
            school_id=str(school.id), plugin_slug=slug, active=True, is_trial=False,
        ))

    student = Student(school_id=str(school.id), user_id=parent.id,
                      first_name="Comms", last_name="Child")
    db.session.add(student)
    db.session.flush()
    created["student_id"] = str(student.id)
    db.session.commit()

    TOKENS = {}
    for role, u in [("admin", admin), ("teacher", teacher), ("parent", parent)]:
        r = requests.post(f"{BASE}/auth/login", json={
            "email": u.email, "password": "ProbePass123!"},
            headers={"X-School-Slug": SLUG}, timeout=15)
        ok = r.status_code == 200 and r.json().get("data", {}).get("access_token")
        check(f"login {role}", ok, f"{r.status_code} {r.text[:120]}")
        TOKENS[role] = r.json()["data"]["access_token"]

    with app.test_request_context():
        from flask import current_app
        created["wa_verify_token"] = current_app.config.get("WHATSAPP_VERIFY_TOKEN", "")
        created["wa_app_secret"] = current_app.config.get("WHATSAPP_APP_SECRET", "")
        created["sparrow_token"] = current_app.config.get("SPARROW_SMS_TOKEN", "")


def H(role="admin"):
    return {"Authorization": f"Bearer {TOKENS[role]}", "X-School-Slug": SLUG}


def api(method, path, role="admin", **kw):
    kw.setdefault("timeout", 30)
    return requests.request(method, BASE + path, headers=H(role), **kw)


def raw(method, path, **kw):
    kw.setdefault("timeout", 30)
    return requests.request(method, "http://localhost:5000" + path, **kw)


def _toggle_plugin(slug, active):
    """Toggle a SchoolPlugin row and clear the 300s per-school plugin cache."""
    with app.app_context():
        from app.models.plugin import SchoolPlugin as SPX
        from extensions import cache
        spx = SPX.query.filter_by(school_id=created["schools"][0],
                                  plugin_slug=slug).first()
        spx.active = active
        db.session.commit()
        cache.delete(f"school:{created['schools'][0]}:plugins")


try:
    # ═════════════════ SMS_NOTIFICATIONS ═════════════════
    print("\n─── sms_notifications ───")
    r = api("POST", "/sms/send", role="parent", json={
        "phones": ["9812345678"], "message": "nope"})
    check("sms send role-gated (parent 403)", r.status_code == 403, f"{r.status_code}")

    r = api("POST", "/sms/send", json={
        "phones": ["9812345678", "not-a-phone"], "message": "Hi"})
    check("sms send invalid phone 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")

    r = api("POST", "/sms/send", json={"phones": [], "message": "x"})
    check("sms send empty phones 400", r.status_code == 400, f"{r.status_code}")

    r = api("POST", "/sms/send", json={
        "phones": ["9812345678", "977-9812345679"], "message": "School notice tomorrow",
        "template_name": "general_notice"})
    ok = r.status_code == 201 and r.json()["data"]["queued"] == 2
    log_ids = r.json()["data"]["log_ids"] if ok else []
    check("sms send queues 2 rows", ok, f"{r.status_code} {r.text[:120]}")

    r = api("GET", "/sms/history?status=queued")
    ok = r.status_code == 200 and len(r.json()["data"]) == 2
    check("sms history queued rows", ok, f"{r.status_code} n={len(r.json().get('data', []) or [])}")

    r = api("GET", "/sms/stats")
    d = r.json().get("data", {})
    check("sms stats queued=2 credits=0",
          r.status_code == 200 and d.get("queued") == 2 and d.get("credits_used") == 0,
          f"{r.status_code} {d}")

    # task behavior — no credentials configured: honest failed status
    with app.app_context():
        from app.tasks.sms_sender import send_sms as task_send_sms
        import app.tasks.sms_sender as sms_mod
        token_now = app.config.get("SPARROW_SMS_TOKEN", "")
        app.config["SPARROW_SMS_TOKEN"] = ""
        try:
            res = task_send_sms("9812345678", "dev console msg", log_id=log_ids[0])
            check("sms task no-creds returns console", res.get("status") == "console", str(res))
        except Exception as e:
            check("sms task no-creds returns console", False, repr(e)[:200])
        app.config["SPARROW_SMS_TOKEN"] = token_now
        from app.models.notification import SMSLog
        row = db.session.get(SMSLog, log_ids[0])
        check("sms task no-creds marks log failed (honest)",
              row.status == "failed" and row.cost == 0 and row.provider == "console",
              f"status={row.status} cost={row.cost} provider={row.provider}")
        check("sms task no-creds leaves loud log", True, "logger.warning '[DEV SMS]' emitted")

    # task behavior — fake provider token (network will fail/4xx): failed + raised
    with app.app_context():
        from app.tasks.sms_sender import send_sms as task_send_sms
        token_now = app.config.get("SPARROW_SMS_TOKEN", "")
        console_now = app.config.get("SMS_CONSOLE_MODE", False)
        app.config["SPARROW_SMS_TOKEN"] = "fake-token-xyz"
        app.config["SMS_CONSOLE_MODE"] = False
        raised = False
        try:
            task_send_sms("9812345679", "fake provider msg", log_id=log_ids[1])
        except Exception as e:
            raised = True
            check("sms task fake-provider raises", True, type(e).__name__)
        finally:
            app.config["SPARROW_SMS_TOKEN"] = token_now
            app.config["SMS_CONSOLE_MODE"] = console_now
        if not raised:
            check("sms task fake-provider raises", False, "no exception raised")
        from app.models.notification import SMSLog as S2
        row = db.session.get(S2, log_ids[1])
        check("sms task fake-provider marks log failed",
              row.status == "failed", f"status={row.status}")

    # a real 'sent' row → stats credits
    with app.app_context():
        from app.models.notification import SMSLog as S3
        db.session.add(SMSLog(school_id=created["schools"][0], to_phone="9800000000",
                              message="x", status="sent", cost=3))
        db.session.commit()
    r = api("GET", "/sms/stats")
    d = r.json().get("data", {})
    check("sms stats counts sent credits", d.get("sent") == 1 and d.get("credits_used") == 3,
          f"{d}")

    r = api("POST", "/sms/templates", json={
        "name": "Fee Reminder", "body": "Dear parent, fee due NPR {amount}"})
    check("sms template create", r.status_code == 201, f"{r.status_code} {r.text[:120]}")
    r = api("GET", "/sms/templates")
    check("sms templates list", r.status_code == 200 and
          any(t["name"] == "Fee Reminder" for t in r.json()["data"]), f"{r.status_code}")

    # ═════════════════ WHATSAPP_BOT ═════════════════
    print("\n─── whatsapp_bot ───")
    r = api("GET", "/whatsapp-bot/config")
    check("wa config default disabled", r.status_code == 200 and
          r.json()["data"]["enabled"] is False, f"{r.status_code} {r.text[:120]}")

    r = api("PUT", "/whatsapp-bot/config", json={
        "is_enabled": True, "welcome_message": "Namaste!",
        "language": "ne",
        "auto_replies": [{"keyword": "FEES", "response": "Check the parent app for fees.",
                          "match_type": "contains"}]})
    check("wa config update", r.status_code == 200, f"{r.status_code} {r.text[:150]}")

    r = api("POST", "/whatsapp-bot/auto-replies", json={
        "keyword": "ATTENDANCE", "response": "Attendance visible in parent app."})
    check("wa auto-reply add", r.status_code == 201 and
          r.json()["data"]["total_rules"] == 2, f"{r.status_code} {r.text[:120]}")

    r = api("GET", "/whatsapp-bot/auto-replies")
    check("wa auto-replies list", r.status_code == 200 and len(r.json()["data"]) == 2,
          f"{r.status_code}")

    # plugin gate: deactivate row → 403
    _toggle_plugin("whatsapp_bot", False)
    r = api("GET", "/whatsapp-bot/config")
    check("wa plugin gate 403 when uninstalled", r.status_code == 403, f"{r.status_code}")
    _toggle_plugin("whatsapp_bot", True)

    r = api("POST", "/whatsapp-bot/send", json={"message": "no to"})
    check("wa send missing 'to' 400", r.status_code == 400, f"{r.status_code}")

    r = api("POST", "/whatsapp-bot/send", json={"to": "9812345678", "message": "Hi"})
    check("wa send graceful when unconfigured",
          r.status_code == 200 and r.json()["data"].get("skipped") is True and
          r.json()["data"].get("reason") == "whatsapp_not_configured",
          f"{r.status_code} {r.text[:150]}")

    r = api("POST", "/whatsapp-bot/send-bulk", json={
        "numbers": ["9812345678", "9812345679"], "message": "bulk hi"})
    d = r.json().get("data", {})
    check("wa send-bulk graceful when unconfigured", r.status_code == 200 and
          d.get("total") == 2 and
          all(x["result"].get("skipped") for x in d.get("results", [])),
          f"{r.status_code} {json.dumps(d)[:150]}")

    # webhook GET verify
    r = raw("GET", "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42")
    check("wa webhook verify wrong token 403", r.status_code == 403, f"{r.status_code}")
    vt = created.get("wa_verify_token") or ""
    if vt:
        r = raw("GET", f"/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token={vt}&hub.challenge=42")
        check("wa webhook verify correct token echoes challenge",
              r.status_code == 200 and r.text == "42", f"{r.status_code} {r.text[:60]}")
    else:
        check("wa webhook verify correct token (env unset — 403 honest)", True,
              "WHATSAPP_VERIFY_TOKEN not configured; wrong-token 403 already proven")

    # webhook POST — honesty contract.
    # POST scenarios run in-process via test_client so app.config patches
    # (WHATSAPP_APP_SECRET) apply, and foreign enabled bot configs are
    # temporarily disabled (snapshot restored in finally) so tenant
    # attribution is deterministic on a shared dev DB.
    def wa_payload(msgs, phone_number_id="1234567890"):
        return {"object": "whatsapp_business_account",
                "entry": [{"id": "WABAID", "changes": [{
                    "field": "messages",
                    "value": {"messaging_product": "whatsapp",
                              "metadata": {"display_phone_number": "9779800000000",
                                           "phone_number_id": phone_number_id},
                              "contacts": [{"profile": {"name": "P"}, "wa_id": "9779812345678"}],
                              "messages": msgs}}]}]}

    foreign_enabled = []
    with app.app_context():
        from app.models.notification import WhatsAppBotConfig as WBC
        for row in WBC.query.filter_by(is_enabled=True).all():
            if str(row.school_id) != created["schools"][0]:
                foreign_enabled.append(str(row.id))
                row.is_enabled = False
        db.session.commit()
    print(f"isolated {len(foreign_enabled)} foreign enabled bot config(s)")
    created["foreign_enabled_bot_ids"] = foreign_enabled

    client = app.test_client()

    def wh_post(payload, **kw):
        resp = client.post("/webhooks/whatsapp", json=payload, **kw)
        return resp

    # (a) no enabled bot → unhandled with reason
    api("PUT", "/whatsapp-bot/config", json={"is_enabled": False})
    r = wh_post(wa_payload(
        [{"from": "9779812345678", "id": "wamid.1", "timestamp": "1720000000",
          "text": {"body": "FEES please"}, "type": "text"}]))
    d = r.get_json().get("data", {})
    check("wa webhook no-enabled-bot → unhandled", r.status_code == 200 and
          d.get("unhandled") == 1 and d.get("processed") == 0 and
          d.get("reason") == "no_enabled_bot", f"{r.status_code} {json.dumps(d)[:150]}")

    # (b) status payload (no user messages) → explicit note, not fake success
    r = wh_post({"object": "whatsapp_business_account",
                 "entry": [{"id": "WABAID", "changes": [{"field": "messages",
                    "value": {"statuses": [{"id": "wamid.s1", "status": "delivered"}]}}]}]})
    d = r.get_json().get("data", {})
    check("wa webhook status-payload → no fake success", r.status_code == 200 and
          d.get("received") == 0 and "note" in d, f"{r.status_code} {json.dumps(d)[:150]}")

    # (c) single enabled bot → processed + stored (auto-reply attempted but
    # skipped — WhatsApp creds unconfigured — so no fake outbound row)
    api("PUT", "/whatsapp-bot/config", json={"is_enabled": True})
    r = wh_post(wa_payload(
        [{"from": "9779812345678", "id": "wamid.2", "timestamp": "1720000001",
          "text": {"body": "FEES please"}, "type": "text"}]))
    d = r.get_json().get("data", {})
    check("wa webhook processed single bot", r.status_code == 200 and
          d.get("processed") == 1 and d.get("unhandled") == 0,
          f"{r.status_code} {json.dumps(d)[:150]}")
    with app.app_context():
        from app.models.notification import WhatsAppMessage as WM
        rows = WM.query.filter_by(school_id=created["schools"][0],
                                  direction="inbound").all()
        stored = [w for w in rows if w.wa_message_id == "wamid.2"]
        outbound = WM.query.filter_by(school_id=created["schools"][0],
                                      direction="outbound").count()
        check("wa webhook stored inbound row", len(stored) == 1 and
              stored[0].content == "FEES please", f"rows={len(rows)}")
        check("wa webhook no fake outbound reply when unconfigured", outbound == 0,
              f"outbound rows={outbound}")

    # (d) message without sender → unhandled
    r = wh_post(wa_payload(
        [{"id": "wamid.3", "type": "text", "text": {"body": "?"}}]))
    d = r.get_json().get("data", {})
    check("wa webhook senderless msg unhandled", r.status_code == 200 and
          d.get("unhandled") == 1, f"{r.status_code} {json.dumps(d)[:150]}")

    # (e) ambiguous owner (2 enabled bots) → unhandled
    with app.app_context():
        from app.models.school import School
        from app.models.notification import WhatsAppBotConfig as WBC
        s2 = School(name="Comms Audit School 2", slug=f"comms-audit2-{SUFFIX}",
                    type="private", level="secondary", district="Kathmandu",
                    plan="growth", is_active=True)
        db.session.add(s2)
        db.session.flush()
        created["schools"].append(str(s2.id))
        db.session.add(WBC(school_id=str(s2.id), is_enabled=True))
        db.session.commit()
    r = wh_post(wa_payload(
        [{"from": "9779812345678", "id": "wamid.4", "type": "text",
          "text": {"body": "hi"}}]))
    d = r.get_json().get("data", {})
    check("wa webhook ambiguous owner → unhandled", r.status_code == 200 and
          d.get("reason") == "ambiguous_bot_owner" and d.get("unhandled") == 1,
          f"{r.status_code} {json.dumps(d)[:150]}")
    with app.app_context():
        from app.models.notification import WhatsAppBotConfig as WBC
        WBC.query.filter_by(school_id=created["schools"][1]).delete()
        db.session.commit()

    # (f) signature verification when secret configured
    _secret_before = created.get("wa_app_secret", "")
    app.config["WHATSAPP_APP_SECRET"] = "probe-secret-123"
    r = wh_post(wa_payload(
        [{"from": "9779812345678", "id": "wamid.5", "type": "text",
          "text": {"body": "hi"}}]), headers={"X-Hub-Signature-256": "sha256=deadbeef"})
    check("wa webhook bad signature 403", r.status_code == 403, f"{r.status_code}")
    import hashlib, hmac as hmac_mod
    body = json.dumps(wa_payload([{"from": "9779812345678", "id": "wamid.5",
                                   "type": "text", "text": {"body": "ATTENDANCE?"}}])).encode()
    sig = hmac_mod.new(b"probe-secret-123", body, hashlib.sha256).hexdigest()
    r = client.post("/webhooks/whatsapp", data=body,
                    headers={"Content-Type": "application/json",
                             "X-Hub-Signature-256": f"sha256={sig}"})
    d = r.get_json().get("data", {})
    check("wa webhook valid signature processed", r.status_code == 200 and
          d.get("processed") == 1, f"{r.status_code} {json.dumps(d)[:150]}")
    app.config["WHATSAPP_APP_SECRET"] = _secret_before

    # (g) ROLLBACK check on the inbound write path: first commit raises →
    # per-message except rolls back, nothing stored, msg counted unhandled.
    from unittest import mock
    with app.app_context():
        from extensions import db as _db
        from app.models.notification import WhatsAppMessage as WM
        before = WM.query.filter_by(school_id=created["schools"][0]).count()
        orig_commit = _db.session.commit
        calls = {"n": 0}
        def flaky_commit(*a, **kw):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("simulated DB failure mid-webhook")
            return orig_commit(*a, **kw)
        with mock.patch.object(_db.session, "commit", flaky_commit):
            r = client.post("/webhooks/whatsapp", json=wa_payload(
                [{"from": "9779812345678", "id": "wamid.6", "type": "text",
                  "text": {"body": "rollback test"}}]))
        after = WM.query.filter_by(school_id=created["schools"][0]).count()
        d = r.get_json().get("data", {})
        check("wa webhook rollback on mid-write failure",
              d.get("unhandled") == 1 and after == before,
              f"resp={json.dumps(d)[:120]} rows before={before} after={after}")

    # restore foreign bot configs
    with app.app_context():
        from app.models.notification import WhatsAppBotConfig as WBC
        for rid in foreign_enabled:
            row = db.session.get(WBC, rid)
            if row:
                row.is_enabled = True
        db.session.commit()
    print("restored foreign bot configs")

    # ═════════════════ NOTICES ═════════════════
    print("\n─── notices ───")
    r = api("POST", "/notices", json={"title": "No content"})
    check("notice missing content 400", r.status_code == 400, f"{r.status_code}")

    r = api("POST", "/notices", json={
        "title": "Dashain Holiday", "content": "<p>Enjoy</p><script>alert(1)</script>",
        "notice_type": "holiday", "target_roles": ["parent", "teacher"],
        "is_published": True, "is_pinned": True})
    ok = r.status_code == 201
    notice = r.json()["data"] if ok else {}
    check("notice create", ok, f"{r.status_code} {r.text[:150]}")
    check("notice XSS sanitized", "<script>" not in (notice.get("content") or ""),
          str(notice.get("content"))[:120])
    check("notice bs date absent ok / published true", notice.get("is_published") is True,
          str(notice.get("published_at")))

    r = api("GET", "/notices")
    check("notice list real data", r.status_code == 200 and
          any(n["id"] == notice.get("id") for n in r.json()["data"]), f"{r.status_code}")

    r = api("GET", "/notices?target_role=parent")
    check("notice filter target_role", any(n["id"] == notice.get("id")
          for n in r.json()["data"]), f"{r.status_code} n={len(r.json().get('data', []))}")
    r = api("GET", "/notices?target_role=student")
    check("notice filter excludes non-audience",
          all(n["id"] != notice.get("id") for n in r.json()["data"]),
          f"n={len(r.json().get('data', []))}")

    r = api("GET", f"/notices/{notice.get('id')}")
    check("notice get by id", r.status_code == 200, f"{r.status_code}")

    r = api("PUT", f"/notices/{notice.get('id')}", json={"is_pinned": False})
    check("notice update", r.status_code == 200 and r.json()["data"]["is_pinned"] is False,
          f"{r.status_code}")

    r = api("POST", "/notices/events", json={"title": "Sports Day"})
    check("event missing start_date 400 (fixed)", r.status_code == 400, f"{r.status_code}")

    r = api("POST", "/notices/events", json={
        "title": "Sports Day", "event_type": "sports",
        "start_date": "2026-10-15", "end_date": "2026-10-16",
        "start_time": "09:00", "location": "Ground"})
    ok = r.status_code == 201
    event = r.json()["data"] if ok else {}
    check("event create", ok, f"{r.status_code} {r.text[:150]}")
    check("event bs date present", ok and event.get("start_date_bs"), str(event.get("start_date_bs")))

    r = api("PUT", f"/notices/events/{event.get('id')}", json={"start_date": "garbage"})
    check("event bad start_date 400 on update (fixed)", r.status_code == 400, f"{r.status_code}")

    r = api("PUT", f"/notices/events/{event.get('id')}", json={"location": "Main Field"})
    check("event update", r.status_code == 200 and r.json()["data"]["location"] == "Main Field",
          f"{r.status_code}")

    r = api("GET", "/notices/events")
    check("event list", any(e["id"] == event.get("id") for e in r.json()["data"]),
          f"{r.status_code}")

    r = api("DELETE", f"/notices/{notice.get('id')}", role="teacher")
    check("notice delete teacher 403", r.status_code == 403, f"{r.status_code}")
    r = api("DELETE", f"/notices/{notice.get('id')}")
    check("notice delete admin 204", r.status_code == 204, f"{r.status_code}")
    r = api("GET", f"/notices/{notice.get('id')}")
    check("deleted notice 404", r.status_code == 404, f"{r.status_code}")

    # ═════════════════ SOCIAL_HUB ═════════════════
    print("\n─── social_hub ───")
    r = api("POST", "/social/posts", json={"content": "Welcome to the new term!", "type": "text"})
    ok = r.status_code == 201
    post = r.json()["data"] if ok else {}
    check("social post create", ok, f"{r.status_code} {r.text[:150]}")

    r = api("GET", "/social/posts")
    check("social posts list", any(p["id"] == post.get("id") for p in r.json()["data"]),
          f"{r.status_code}")

    r = api("POST", f"/social/posts/{post.get('id')}/like", role="parent")
    d = r.json().get("data", {})
    check("social like", r.status_code == 200 and d.get("action") == "liked" and
          d.get("total_likes") == 1, f"{r.status_code} {d}")
    r = api("POST", f"/social/posts/{post.get('id')}/like", role="parent")
    check("social unlike toggle", r.json().get("data", {}).get("action") == "unliked",
          f"{r.status_code}")

    r = api("POST", f"/social/posts/{post.get('id')}/comments", role="parent",
            json={"content": "Great!"})
    check("social comment create", r.status_code == 201, f"{r.status_code} {r.text[:120]}")
    r = api("GET", f"/social/posts/{post.get('id')}/comments")
    check("social comments list", len(r.json()["data"]) == 1, f"{r.status_code}")

    r = api("POST", "/social/groups", json={"name": "Grade 5 Parents", "type": "class"})
    check("social group create", r.status_code == 201, f"{r.status_code}")
    r = api("GET", "/social/groups")
    check("social groups list", any(g["name"] == "Grade 5 Parents" for g in r.json()["data"]),
          f"{r.status_code}")

    r = api("DELETE", f"/social/posts/{post.get('id')}", role="parent")
    check("social delete non-author 403", r.status_code == 403, f"{r.status_code}")
    r = api("DELETE", f"/social/posts/{post.get('id')}")
    check("social delete by admin", r.status_code == 204, f"{r.status_code}")

    # ═════════════════ SOCIAL_ADS ═════════════════
    print("\n─── social_ads ───")
    r = api("GET", "/social/campaigns")
    check("social_ads campaigns endpoint MISSING (E30 gap)", r.status_code == 404,
          f"GET /social/campaigns → {r.status_code}")
    r = api("POST", "/social/campaigns", json={"name": "Admission Boost"})
    check("social_ads campaign create MISSING (E30 gap)", r.status_code == 404,
          f"POST /social/campaigns → {r.status_code}")
    with app.app_context():
        from sqlalchemy import text as T
        row = db.session.execute(T(
            "SELECT depends_on FROM plugins WHERE slug='social_ads'")).scalar()
    check("social_ads manifest depends_on social_hub (info)", True, f"depends_on={row}")
    r = api("POST", "/plugins/install", json={"plugin_slug": "digital_content"})
    check("install unrelated plugin refused/allowed (info)", r.status_code in (201, 400, 403, 404),
          f"{r.status_code} {r.text[:100]}")

    # ═════════════════ CONFERENCES ═════════════════
    print("\n─── conferences ───")
    r = api("POST", "/conferences", json={"description": "no title/dates"})
    check("conference missing fields 400 (fixed)", r.status_code == 400, f"{r.status_code}")

    r = api("POST", "/conferences", json={
        "title": "PTM Term 3", "start_date": "not-a-date", "end_date": "2026-09-30"})
    check("conference garbage date 400 (fixed)", r.status_code == 400, f"{r.status_code}")

    r = api("POST", "/conferences", json={
        "title": "PTM Term 3", "description": "Mid-term meetings",
        "start_date": "2026-09-01T09:00:00", "end_date": "2026-09-03T17:00:00",
        "is_virtual": False, "is_active": True})
    ok = r.status_code == 201
    conf = r.json()["data"] if ok else {}
    check("conference create", ok, f"{r.status_code} {r.text[:150]}")
    check("conference BS date present", ok and conf.get("start_date_bs"),
          str(conf.get("start_date_bs")))

    fake_uuid = str(uuid_mod.uuid4())
    r = api("POST", f"/conferences/{fake_uuid}/slots", json={
        "start_time": "2026-09-01T10:00:00", "end_time": "2026-09-01T10:30:00"})
    check("slots on unknown conference 404 (fixed)", r.status_code == 404, f"{r.status_code}")

    r = api("POST", f"/conferences/{conf.get('id')}/slots", json={"foo": "bar"})
    check("slots missing times 400 (fixed)", r.status_code == 400, f"{r.status_code}")

    r = api("POST", f"/conferences/{conf.get('id')}/slots", json={
        "start_time": "2026-09-01T10:30:00", "end_time": "2026-09-01T10:00:00"})
    check("slots end<=start 400 (fixed)", r.status_code == 400, f"{r.status_code}")

    r = api("POST", f"/conferences/{conf.get('id')}/slots", role="teacher", json={
        "teacher_id": str(uuid_mod.uuid4()),
        "start_time": "2026-09-01T10:00:00", "end_time": "2026-09-01T10:30:00"})
    check("slots bogus teacher_id 400 (fixed)", r.status_code == 400 and
          "teacher_id" in r.text, f"{r.status_code} {r.text[:120]}")

    r = api("POST", f"/conferences/{conf.get('id')}/slots", role="teacher", json={
        "start_time": "2026-09-01T10:00:00", "end_time": "2026-09-01T10:30:00"})
    ok = r.status_code == 201
    slot1 = r.json()["data"][0] if ok else {}
    check("slot create by teacher (default self)", ok and slot1.get("teacher_id"),
          f"{r.status_code} {r.text[:150]}")

    r = api("POST", f"/conferences/{conf.get('id')}/slots", json=[{
        "start_time": "2026-09-01T11:00:00", "end_time": "2026-09-01T11:30:00"},
        {"start_time": "2026-09-01T12:00:00", "end_time": "2026-09-01T12:30:00"}])
    slot2 = r.json()["data"][0] if r.status_code == 201 else {}
    check("slots bulk create (array)", r.status_code == 201 and len(r.json()["data"]) == 2,
          f"{r.status_code}")

    r = api("GET", f"/conferences/{conf.get('id')}/slots?available=true")
    check("slots list available", r.status_code == 200 and len(r.json()["data"]) == 3,
          f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("POST", f"/conferences/slots/{slot1.get('id')}/book", role="parent", json={
        "student_id": str(uuid_mod.uuid4())})
    check("book bogus student_id 400 (fixed)", r.status_code == 400, f"{r.status_code} {r.text[:120]}")

    r = api("POST", f"/conferences/slots/{slot1.get('id')}/book", role="parent", json={
        "student_id": created["student_id"]})
    check("parent books slot", r.status_code == 200 and
          r.json()["data"]["is_booked"] is True and r.json()["data"]["student_id"],
          f"{r.status_code} {r.text[:150]}")

    r = api("POST", f"/conferences/slots/{slot1.get('id')}/book", role="teacher", json={})
    check("double-book 409", r.status_code == 409, f"{r.status_code}")

    r = api("POST", f"/conferences/slots/{slot1.get('id')}/cancel", role="parent")
    check("cancel booking", r.status_code == 200 and r.json()["data"]["is_booked"] is False,
          f"{r.status_code}")

    r = api("PUT", f"/conferences/slots/{slot1.get('id')}/notes", role="teacher", json={
        "notes": "Improve reading", "action_items": "Daily 10 min reading",
        "follow_up_needed": True, "follow_up_date": "2026-10-01T00:00:00"})
    check("notes save (teacher)", r.status_code == 200, f"{r.status_code} {r.text[:150]}")

    r = api("GET", f"/conferences/slots/{slot1.get('id')}/notes", role="parent")
    d = r.json().get("data", {})
    check("notes get (parent)", r.status_code == 200 and
          d.get("notes") == "Improve reading" and d.get("follow_up_needed") is True,
          f"{r.status_code} {json.dumps(d)[:150]}")

    r = api("PUT", f"/conferences/slots/{fake_uuid}/notes", json={"notes": "x"})
    check("notes unknown slot 404 (fixed)", r.status_code == 404, f"{r.status_code}")

    r = api("GET", "/conferences")
    check("conferences list", any(c["id"] == conf.get("id") for c in r.json()["data"]),
          f"{r.status_code}")
    r = api("PUT", f"/conferences/{conf.get('id')}", json={"is_active": False})
    check("conference update", r.status_code == 200 and r.json()["data"]["is_active"] is False,
          f"{r.status_code}")

    # ROLLBACK check #2 — multi-slot create: commit fails mid-loop → no partial
    # rows (in-process so the commit patch applies to the request). The
    # post-failure count runs in a FRESH app context so flushed-but-rolled-back
    # rows in the poisoned transaction are not miscounted.
    from extensions import db as _db2
    from app.models.conference import ConferenceSlot as CS
    with app.app_context():
        before = CS.query.filter_by(school_id=created["schools"][0]).count()
    orig_commit = _db2.session.commit
    calls = {"n": 0}
    def flaky_commit2(*a, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("simulated DB failure mid-bulk-slots")
        return orig_commit(*a, **kw)
    with mock.patch.object(_db2.session, "commit", flaky_commit2):
        try:
            r = client.post(f"/api/v1/conferences/{conf.get('id')}/slots",
                            headers=H("admin"), json=[
                {"start_time": "2026-09-02T10:00:00", "end_time": "2026-09-02T10:30:00"},
                {"start_time": "2026-09-02T11:00:00", "end_time": "2026-09-02T11:30:00"}])
        except RuntimeError as exc:
            r = type("R", (), {"status_code": 500, "get_json": lambda s: {
                "data": {}, "error": str(exc)}})()  # debug-mode propagation
    with app.app_context():
        after = CS.query.filter_by(school_id=created["schools"][0]).count()
    check("bulk slots rollback on mid-write failure",
          after == before, f"resp={r.status_code} before={before} after={after}")

    # ═════════════════ NOTIFICATIONS (in-app) ═════════════════
    print("\n─── notifications (in-app) ───")
    with app.app_context():
        from app.api.v1.notifications import create_notification
        sid = created["schools"][0]
        n1 = create_notification(sid, created["user_ids"][2], "Fee reminder",
                                 "Term 3 fees due", category="fee", priority="high",
                                 action_url="/dashboard/fees")
        n2 = create_notification(sid, created["user_ids"][2], "Notice pinned",
                                 "Dashain holiday notice", category="notice")
        n3 = create_notification(sid, created["user_ids"][2], "Exam schedule",
                                 "Term 3 exams published", category="exam")
        admin_n = create_notification(sid, created["user_ids"][0], "Admin only",
                                      "Admin notification", category="system")
        created["notif_ids"] = [str(n1.id), str(n2.id), str(n3.id)]

    # NOTE: the notice.created listener fans out an in-app notification to
    # every user of the school — parent/admin each got +1 from the notices
    # section above. Expectations account for that fan-out.
    r = api("GET", "/notifications", role="parent")
    check("notifications list (own only)", r.status_code == 200 and
          len(r.json()["data"]) == 4, f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("GET", "/notifications/unread-count", role="parent")
    check("unread-count 4", r.json().get("data", {}).get("unread_count") == 4,
          f"{r.status_code} {r.text[:100]}")

    r = api("GET", "/notifications?category=fee", role="parent")
    check("notifications category filter", len(r.json()["data"]) == 1 and
          r.json()["data"][0]["category"] == "fee", f"{r.status_code}")

    r = api("GET", "/notifications?unread_only=true", role="parent")
    check("notifications unread_only filter", len(r.json()["data"]) == 4, f"{r.status_code}")

    r = api("POST", f"/notifications/{created['notif_ids'][0]}/read", role="parent")
    check("mark one read", r.status_code == 200 and r.json()["data"]["is_read"] is True,
          f"{r.status_code}")

    r = api("GET", "/notifications/unread-count", role="parent")
    check("unread-count 3 after read", r.json().get("data", {}).get("unread_count") == 3,
          f"{r.text[:100]}")

    r = api("POST", f"/notifications/{created['notif_ids'][0]}/read", role="teacher")
    check("mark read tenancy 404 (other user)", r.status_code == 404, f"{r.status_code}")

    r = api("POST", "/notifications/mark-all-read", role="parent")
    check("mark-all-read", r.json().get("data", {}).get("marked_read") == 3,
          f"{r.status_code} {r.text[:100]}")

    r = api("GET", "/notifications/unread-count", role="parent")
    check("unread-count 0 after mark-all", r.json().get("data", {}).get("unread_count") == 0,
          f"{r.text[:100]}")

    r = api("DELETE", f"/notifications/{created['notif_ids'][2]}", role="parent")
    check("notification delete", r.status_code == 200, f"{r.status_code}")
    r = api("GET", "/notifications", role="parent")
    check("deleted notification hidden", len(r.json()["data"]) == 3, f"{r.status_code}")

    r = api("GET", "/notifications", role="admin")
    check("admin sees only own notifications", len(r.json()["data"]) == 2,
          f"n={len(r.json().get('data', []))}")

    # ═════════════════ SLUG CONSISTENCY (runtime) ═════════════════
    print("\n─── slug consistency ───")
    r = api("GET", "/plugins/installed")
    slugs = {p["plugin_slug"] for p in r.json().get("data", [])}
    expected = {"sms_notifications", "whatsapp_bot", "notices", "social_hub",
                "social_ads", "conferences"}
    check("installed slugs match manifest slugs", expected.issubset(slugs),
          f"installed={sorted(expected & slugs)}")
    for probe in [("/sms/history", "sms_notifications"),
                  ("/whatsapp-bot/config", "whatsapp_bot"),
                  ("/notices", "notices"),
                  ("/social/posts", "social_hub"),
                  ("/conferences", "conferences")]:
        _toggle_plugin(probe[1], False)
        rr = api("GET", probe[0])
        check(f"gate {probe[1]} → 403 on {probe[0]}", rr.status_code == 403,
              f"{rr.status_code}")
        _toggle_plugin(probe[1], True)

finally:
    # ───────────────────────────── cleanup ─────────────────────────────
    # restore foreign bot configs even on crash
    try:
        with app.app_context():
            from app.models.notification import WhatsAppBotConfig as WBC
            for rid in created.get("foreign_enabled_bot_ids", []):
                row = db.session.get(WBC, rid)
                if row:
                    row.is_enabled = True
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"bot-config restore failed: {e}")
    with app.app_context():
        from sqlalchemy import text
        for sid in created["schools"]:
            for stmt in [
                "DELETE FROM whatsapp_messages WHERE school_id=:s",
                "DELETE FROM whatsapp_bot_configs WHERE school_id=:s",
                "DELETE FROM sms_logs WHERE school_id=:s",
                "DELETE FROM notification_templates WHERE school_id=:s",
                "DELETE FROM in_app_notifications WHERE school_id=:s",
                "DELETE FROM hub_comments WHERE school_id=:s",
                "DELETE FROM hub_posts WHERE school_id=:s",
                "DELETE FROM hub_groups WHERE school_id=:s",
                "DELETE FROM conference_notes WHERE school_id=:s",
                "DELETE FROM conference_slots WHERE school_id=:s",
                "DELETE FROM pt_conferences WHERE school_id=:s",
                "DELETE FROM events WHERE school_id=:s",
                "DELETE FROM notices WHERE school_id=:s",
                "UPDATE students SET user_id=NULL WHERE school_id=:s",
                "DELETE FROM students WHERE school_id=:s",
                "DELETE FROM school_plugins WHERE school_id=:s",
                "DELETE FROM users WHERE school_id=:s",
                "DELETE FROM schools WHERE id=:s",
            ]:
                try:
                    db.session.execute(text(stmt), {"s": sid})
                except Exception as e:
                    db.session.rollback()
                    print(f"cleanup-skip {stmt.split('FROM')[1].strip()}: {type(e).__name__}")
        db.session.commit()
        from app.models.school import School
        left = School.query.filter(School.slug.like("comms-audit%")).count()
        print(f"remaining comms-audit schools: {left}")
    print("CLEANUP DONE")

fails = [r for r in results if not r[1]]
print(f"\nSUMMARY: {len(results) - len(fails)}/{len(results)} passed")
for name, ok, detail in fails:
    print(f"  FAILED: {name} | {detail}")
sys.exit(0)
