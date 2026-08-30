"""Payment-gateway callback regression tests (audit E60 batch).

Pins the money-sacred behaviours runtime-proven by tmp_payments_verify.py:
  - eSewa  HMAC-verified callback marks the collection paid EXACTLY once;
    duplicate/tampered/unknown callbacks never double-record.
  - Khalti lookup cross-checks the gateway-echoed purchase_order_id (pidx-swap
    attack) and treats lookup network failure honestly (502).
  - FonePay callbacks resolve ONLY through the persisted PaymentInitiation
    (the old purchase_order_id/R1 guess never matched a real callback).
  - Amount mismatch vs the initiated charge -> 409, nothing recorded.
  - Overpayment with no initiation anchor -> 409, nothing recorded.
  - Stripe checkout.session.completed activates the plugin paid (the missing
    SchoolPlugin import used to 500 on every valid event).
  - Initiate routes persist a PaymentInitiation BEFORE the redirect and use
    the REGISTERED /webhooks/* callback paths (the old /api/v1 prefix 404ed).
"""
import base64
import hashlib
import hmac
import json
import time

import pytest

from app.models.fee import FeeCollection, FeeReceipt, PaymentInitiation
from app.models.plugin import Plugin, SchoolPlugin


# ─────────────────────────── helpers ───────────────────────────

def _fee_config():
    return {
        "payment_methods": [
            {"key": "esewa", "label": "eSewa", "enabled": True, "mode": "online",
             "merchant_code": "NP-ES-TEST", "secret_key": "esewa-test-secret"},
            {"key": "khalti", "label": "Khalti", "enabled": True, "mode": "online",
             "merchant_code": "khalti_test", "secret_key": "khalti-test-secret"},
            {"key": "fonepay", "label": "FonePay", "enabled": True, "mode": "online",
             "merchant_code": "4210105TEST", "secret_key": "fonepay-test-secret"},
        ]
    }


def _enable_gateways(db, school):
    school.fee_config = _fee_config()
    db.session.commit()


def _student(db, school):
    from app.models.academic import Class
    from app.models.student import Student
    from app.models.user import User

    u = User(school_id=school.id, role="student", full_name="Hook Test Student",
             email=f"hook-{school.slug}@test.edu.np", phone="+9779841100001",
             is_active=True, phone_verified=True)
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.flush()
    klass = Class(school_id=school.id, name="Hook Grade", sort_order=77)
    db.session.add(klass)
    db.session.flush()
    st = Student(school_id=school.id, user_id=u.id, first_name="Hook", last_name="Test",
                 status="active", class_id=klass.id)
    db.session.add(st)
    db.session.flush()
    return st


def _collection(db, school, student, amount=9000):
    fc = FeeCollection(school_id=school.id, student_id=student.id,
                       fee_item_name="Tuition", amount=amount, payment_status="pending")
    db.session.add(fc)
    db.session.commit()
    return fc


def _admin_headers(client, db, school):
    from app.models.user import User
    from tests.conftest import get_auth_headers

    u = User(school_id=school.id, role="school_admin", full_name="Hook Admin",
             email=f"hook-admin-{school.slug}@test.edu.np", phone="+9779841100002",
             is_active=True, phone_verified=True)
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()
    return get_auth_headers(client, u.email, "Test@1234")


def _fees_plugin(db, school):
    plugin = Plugin.query.filter_by(slug="fees").first()
    if not plugin:
        plugin = Plugin(slug="fees", name="Fees", category="starter", price_monthly=399,
                        price_yearly=3990, is_free=False, is_published=True, version="1.0.0")
        db.session.add(plugin)
        db.session.commit()
    db.session.add(SchoolPlugin(school_id=school.id, plugin_slug="fees",
                                active=True, is_trial=False))
    db.session.commit()


def _receipts(fc):
    return FeeReceipt.query.filter_by(collection_id=fc.id, is_deleted=False).all()


def _paid_amount(fc):
    notes = fc.notes or ""
    if "[partial_paid:" not in notes:
        return 0.0
    try:
        return float(notes.split("[partial_paid:", 1)[1].split("]", 1)[0])
    except (ValueError, IndexError):
        return 0.0


def _esewa_blob(total, uuid_, txn, status="COMPLETE", product="NP-ES-TEST",
                secret="esewa-test-secret"):
    data = {"transaction_code": txn, "status": status, "total_amount": str(total),
            "transaction_uuid": uuid_, "product_code": product,
            "signed_field_names": "total_amount,transaction_uuid,product_code"}
    msg = (f"total_amount={data['total_amount']},"
           f"transaction_uuid={data['transaction_uuid']},product_code={data['product_code']}")
    data["signature"] = base64.b64encode(
        hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest()).decode()
    return base64.b64encode(json.dumps(data).encode()).decode()


class FakeResp:
    def __init__(self, payload, code=200):
        self._p = payload
        self.status_code = code

    def json(self):
        return self._p


# ─────────────────────────── eSewa ───────────────────────────

def test_esewa_valid_then_duplicate_marks_paid_once(client, db, school):
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    blob = _esewa_blob(9000, str(fc.id), "ESEWA-TXN-1")

    r = client.get(f"/webhooks/esewa/callback?data={blob}")
    assert r.status_code == 200
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "paid"
    assert _paid_amount(fc) == 9000.0
    assert len(_receipts(fc)) == 1
    assert fc.transaction_id == "ESEWA-TXN-1"

    # Duplicate callback: idempotent no-op — no second receipt, no double count.
    r = client.get(f"/webhooks/esewa/callback?data={blob}")
    assert r.status_code == 200
    assert r.get_json()["data"]["duplicate"] is True
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert len(_receipts(fc)) == 1
    assert _paid_amount(fc) == 9000.0
    assert fc.payment_status == "paid"


def test_esewa_tampered_signature_records_nothing(client, db, school):
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    raw = json.loads(base64.b64decode(_esewa_blob(9000, str(fc.id), "ESEWA-TXN-2")))
    raw["total_amount"] = "1.0"  # flip amount, keep original signature
    blob = base64.b64encode(json.dumps(raw).encode()).decode()

    r = client.get(f"/webhooks/esewa/callback?data={blob}")
    assert r.status_code == 400
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "pending"
    assert _receipts(fc) == []


def test_esewa_unknown_collection_404(client, db, school):
    blob = _esewa_blob(9000, "00000000-0000-0000-0000-0000000000aa", "ESEWA-TXN-X")
    r = client.get(f"/webhooks/esewa/callback?data={blob}")
    assert r.status_code == 404


def test_esewa_overpay_without_anchor_rejected(client, db, school):
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    r = client.get("/webhooks/esewa/callback?data="
                   + _esewa_blob(12000, str(fc.id), "ESEWA-TXN-OVER"))
    assert r.status_code == 409
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "pending"
    assert _receipts(fc) == []


def test_esewa_amount_mismatch_vs_initiation_rejected(client, db, school):
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    db.session.add(PaymentInitiation(school_id=school.id, collection_id=fc.id,
                                     gateway="esewa", gateway_ref=str(fc.id),
                                     amount=9000, status="initiated"))
    db.session.commit()
    r = client.get("/webhooks/esewa/callback?data=" + _esewa_blob(5000, str(fc.id), "ESEWA-TXN-MM"))
    assert r.status_code == 409
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "pending"
    assert _receipts(fc) == []


def test_esewa_second_partial_payment_settles_then_conflict(client, db, school):
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    # legacy partial (no initiation anchor): 5000 of 9000
    r = client.get("/webhooks/esewa/callback?data=" + _esewa_blob(5000, str(fc.id), "ESEWA-P1"))
    assert r.status_code == 200
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "partial"
    # duplicate of the same transaction must not double-count
    r = client.get("/webhooks/esewa/callback?data=" + _esewa_blob(5000, str(fc.id), "ESEWA-P1"))
    assert r.status_code == 200
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert _paid_amount(fc) == 5000.0
    assert len(_receipts(fc)) == 1
    # legit second partial settles it
    r = client.get("/webhooks/esewa/callback?data=" + _esewa_blob(4000, str(fc.id), "ESEWA-P2"))
    assert r.status_code == 200
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "paid"
    assert _paid_amount(fc) == 9000.0
    # a third, different transaction after settlement -> honest conflict
    r = client.get("/webhooks/esewa/callback?data=" + _esewa_blob(100, str(fc.id), "ESEWA-P3"))
    assert r.status_code == 409
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert _paid_amount(fc) == 9000.0
    assert len(_receipts(fc)) == 2


# ─────────────────────────── Khalti ───────────────────────────

def test_khalti_valid_pidx_then_duplicate(client, db, school, monkeypatch):
    import app.services.payments.khalti_gateway as kg

    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    lookup = {"status": "Completed", "total_amount": 900000,
              "transaction_id": "KTXN-1", "purchase_order_id": str(fc.id)}
    monkeypatch.setattr(
        kg.requests, "post",
        lambda url, headers=None, json=None, timeout=None: FakeResp(lookup)
        if (json or {}).get("pidx") == "PIDX-OK" else FakeResp({"status": "NotFound"}, 404),
    )

    r = client.get(f"/webhooks/khalti/callback?pidx=PIDX-OK&purchase_order_id={fc.id}")
    assert r.status_code == 200
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "paid"
    assert len(_receipts(fc)) == 1

    r = client.get(f"/webhooks/khalti/callback?pidx=PIDX-OK&purchase_order_id={fc.id}")
    assert r.status_code == 200
    assert r.get_json()["data"]["duplicate"] is True
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert len(_receipts(fc)) == 1


def test_khalti_pidx_swap_rejected(client, db, school, monkeypatch):
    """A real COMPLETED pidx from some other tiny payment must never credit a
    different collection (attacker pays 1 NPR for themselves, points it at a
    9000 fee)."""
    import app.services.payments.khalti_gateway as kg

    _enable_gateways(db, school)
    student = _student(db, school)
    victim = _collection(db, school, student)
    lookup = {"status": "Completed", "total_amount": 100,
              "transaction_id": "KTXN-ATK", "purchase_order_id": "ATTACKERS-OWN-COLL"}
    monkeypatch.setattr(
        kg.requests, "post",
        lambda url, headers=None, json=None, timeout=None: FakeResp(lookup),
    )

    r = client.get(f"/webhooks/khalti/callback?pidx=PIDX-ATK&purchase_order_id={victim.id}")
    assert r.status_code == 400
    db.session.expire_all()
    victim = db.session.get(FeeCollection, victim.id)
    assert victim.payment_status == "pending"
    assert _receipts(victim) == []


def test_khalti_lookup_network_failure_honest_502(client, db, school, monkeypatch):
    import app.services.payments.khalti_gateway as kg

    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)

    def boom(*a, **kw):
        raise kg.requests.ConnectionError("lookup down")

    monkeypatch.setattr(kg.requests, "post", boom)
    r = client.get(f"/webhooks/khalti/callback?pidx=PIDX-X&purchase_order_id={fc.id}")
    assert r.status_code == 502
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "pending"
    assert _receipts(fc) == []


# ─────────────────────────── FonePay ───────────────────────────

def _fonepay_form(prn, amt="9000.00", ps="true", rc="successful",
                  secret="fonepay-test-secret", uid="UID1"):
    data = {"PRN": prn, "BID": "BID1", "PID": "4210105TEST", "PS": ps, "RC": rc,
            "UID": uid, "BC": "NPR", "INI": "N", "P_AMT": amt, "R_AMT": "0",
            "DT": "05/16/2026", "R1": "School Fee - Hook Test", "R2": "",
            "RU": "http://localhost/callback"}
    msg = ",".join(str(v) for v in (data["PID"], "P", data["PRN"], data["P_AMT"], "NPR",
                                    data["DT"], data["R1"], data["R2"], data["RU"]))
    data["DV"] = hmac.new(secret.encode(), msg.encode(), hashlib.sha512).hexdigest()
    return data


def test_fonepay_initiate_persists_prn_then_callback_pays_once(client, db, school, monkeypatch):
    import app.services.payments.fonepay_gateway as fg

    _fees_plugin(db, school)
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    headers = _admin_headers(client, db, school)

    monkeypatch.setattr(
        fg.requests, "get",
        lambda url, params=None, timeout=None: FakeResp({"statusCode": "success"}),
    )

    r = client.post(f"/api/v1/fees/collections/{fc.id}/pay-online",
                    headers=headers, json={"provider": "fonepay"})
    assert r.status_code == 200, r.get_json()
    prn = r.get_json()["data"]["prn"]
    # init record persisted BEFORE redirect, with the exact PRN + amount
    init = PaymentInitiation.query.filter_by(gateway="fonepay", gateway_ref=prn).one()
    assert float(init.amount) == 9000.0
    assert init.status == "initiated"
    # redirect URL must point at the REGISTERED webhook path
    assert "/webhooks/fonepay/callback" in r.get_json()["data"]["redirect_url"]

    r = client.post("/webhooks/fonepay/callback", data=_fonepay_form(prn))
    assert r.status_code == 200, r.get_json()
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "paid"
    assert len(_receipts(fc)) == 1

    # duplicate
    r = client.post("/webhooks/fonepay/callback", data=_fonepay_form(prn))
    assert r.status_code == 200
    assert r.get_json()["data"]["duplicate"] is True
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert len(_receipts(fc)) == 1


def test_fonepay_unknown_prn_404_records_nothing(client, db, school, monkeypatch):
    import app.services.payments.fonepay_gateway as fg

    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    monkeypatch.setattr(
        fg.requests, "get",
        lambda url, params=None, timeout=None: FakeResp({"statusCode": "success"}),
    )
    r = client.post("/webhooks/fonepay/callback", data=_fonepay_form("FP-NEVER-INITIATED"))
    assert r.status_code == 404
    db.session.expire_all()
    fc = db.session.get(FeeCollection, fc.id)
    assert fc.payment_status == "pending"
    assert _receipts(fc) == []


def test_fonepay_tampered_dv_rejected(client, db, school):
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    form = _fonepay_form("FP-TAMPER")
    form["P_AMT"] = "1.00"  # break the signature
    r = client.post("/webhooks/fonepay/callback", data=form)
    assert 400 <= r.status_code < 500


# ─────────────────────────── Stripe ───────────────────────────

def _stripe_headers(payload, secret):
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.{payload}".encode(), hashlib.sha256).hexdigest()
    return {"Stripe-Signature": f"t={t},v1={sig}"}


def _stripe_session_event(school_id, slug="lms", cycle="monthly"):
    return json.dumps({
        "id": "evt_test_1", "object": "event", "type": "checkout.session.completed",
        "data": {"object": {"id": "cs_test_1", "object": "checkout.session",
                            "metadata": {"school_id": str(school_id), "plugin_slug": slug,
                                         "billing_cycle": cycle}}},
    })


def test_stripe_valid_event_activates_plugin_paid_once(client, db, school, monkeypatch):
    pytest.importorskip("stripe")
    from app import create_app as _c  # noqa: F401  (app already created by fixture)

    plugin = Plugin.query.filter_by(slug="lms").first()
    if not plugin:
        plugin = Plugin(slug="lms", name="LMS", category="growth", price_monthly=799,
                        price_yearly=7990, is_free=False, is_published=True, version="1.0.0")
        db.session.add(plugin)
        db.session.commit()

    client.application.config["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"
    payload = _stripe_session_event(school.id)
    r = client.post("/webhooks/stripe", data=payload, content_type="application/json",
                    headers=_stripe_headers(payload, "whsec_test_secret"))
    assert r.status_code == 200, r.get_json()
    sp = SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug="lms").one()
    assert sp.active is True
    assert sp.is_trial is False
    assert sp.billing_cycle == "monthly"

    # replay is idempotent (no duplicate install row)
    r = client.post("/webhooks/stripe", data=payload, content_type="application/json",
                    headers=_stripe_headers(payload, "whsec_test_secret"))
    assert r.status_code == 200
    assert SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug="lms").count() == 1

    client.application.config["STRIPE_WEBHOOK_SECRET"] = ""


def test_stripe_bad_signature_rejected(client, db, school):
    pytest.importorskip("stripe")
    client.application.config["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"
    payload = _stripe_session_event(school.id)
    r = client.post("/webhooks/stripe", data=payload, content_type="application/json",
                    headers=_stripe_headers(payload, "whsec_WRONG_SECRET"))
    assert r.status_code == 400
    client.application.config["STRIPE_WEBHOOK_SECRET"] = ""


# ─────────────────── initiate routes: callback URL contract ───────────────────

def test_initiate_esewa_uses_registered_webhook_path_and_persists(client, db, school):
    _fees_plugin(db, school)
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    headers = _admin_headers(client, db, school)

    r = client.post(f"/api/v1/fees/collections/{fc.id}/pay-online",
                    headers=headers, json={"provider": "esewa"})
    assert r.status_code == 200, r.get_json()
    data = r.get_json()["data"]
    # /api/v1/webhooks/* is NOT a registered route — the callback URL must be
    # the /webhooks/* blueprint the gateways actually reach.
    assert data["form_data"]["success_url"].endswith("/webhooks/esewa/callback")
    assert "/api/v1/webhooks" not in json.dumps(data)
    init = PaymentInitiation.query.filter_by(collection_id=fc.id, gateway="esewa").one()
    assert init.status == "initiated"
    assert float(init.amount) == 9000.0


def test_initiate_rejects_unconfigured_or_offline_provider(client, db, school):
    _fees_plugin(db, school)
    _enable_gateways(db, school)
    student = _student(db, school)
    fc = _collection(db, school, student)
    headers = _admin_headers(client, db, school)

    r = client.post(f"/api/v1/fees/collections/{fc.id}/pay-online",
                    headers=headers, json={"provider": "cash"})
    assert r.status_code == 400  # offline mode
    r = client.post(f"/api/v1/fees/collections/{fc.id}/pay-online",
                    headers=headers, json={"provider": "khalti"})
    # khalti enabled+online but initiation will hit the (unpatched) network in
    # this test -> gateway failure surfaces honestly as 5xx, nothing persisted
    assert r.status_code >= 400
    assert PaymentInitiation.query.filter_by(collection_id=fc.id, gateway="khalti").count() == 0
