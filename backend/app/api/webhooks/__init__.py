"""Webhook handlers blueprint."""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone

from flask import Blueprint, current_app, request

from app.utils.response import error_response, success_response
from extensions import db

webhooks_bp = Blueprint("webhooks", __name__)


def _school_payment_method(school, key: str) -> dict:
    """Return the stored payment method config for a given gateway key."""
    fee_config = dict(getattr(school, "fee_config", {}) or {})
    methods = fee_config.get("payment_methods") or []
    return next((m for m in methods if m.get("key") == key), {})


@webhooks_bp.route("/esewa/callback", methods=["GET", "POST"])
def esewa_callback():
    """Handle eSewa payment callback — eSewa redirects with base64 encoded data."""
    from app.models.fee import FeeCollection, FeeReceipt, PaymentInitiation
    from app.models.school import School
    from app.services.payments.esewa_gateway import EsewaGateway

    encoded_data = request.args.get("data") or (request.get_json(silent=True) or {}).get("data")
    if not encoded_data:
        current_app.logger.warning("eSewa callback with no data")
        return error_response("Missing callback data", 400)

    # Decode without verifying first to locate the school's credentials.
    try:
        raw = json.loads(base64.b64decode(encoded_data).decode())
    except Exception:
        return error_response("Invalid callback data", 400)

    collection_id = raw.get("transaction_uuid")
    fc = FeeCollection.query.get(collection_id)
    if not fc:
        return error_response("Fee collection not found", 404)

    school = School.query.get(fc.school_id)
    if not school:
        return error_response("School not found", 404)

    method_cfg = _school_payment_method(school, "esewa")
    secret_key = (method_cfg.get("secret_key") or "").strip()

    if not secret_key:
        current_app.logger.error("eSewa secret_key not configured for school %s", fc.school_id)
        return error_response("Payment gateway not configured for this school", 422)

    result = EsewaGateway.verify_payment(encoded_data, secret_key=secret_key)
    current_app.logger.info(f"eSewa verify result: {result}")

    if not result.get("verified"):
        return error_response(result.get("error", "Payment verification failed"), 400)

    # The signed payload's product_code must be THIS school's merchant code.
    merchant_code = (method_cfg.get("merchant_code") or "").strip()
    payload_product = str(raw.get("product_code") or "")
    if merchant_code and payload_product and payload_product != merchant_code:
        current_app.logger.error(
            "eSewa callback product_code mismatch for school %s: %s != %s",
            fc.school_id, payload_product, merchant_code,
        )
        return error_response("Callback does not match the school's eSewa merchant code", 400)

    # Anchor: the checkout attempt we initiated server-side (if any).
    initiation = (
        PaymentInitiation.query.filter_by(
            gateway="esewa", gateway_ref=str(collection_id), is_deleted=False
        )
        .order_by(PaymentInitiation.created_at.desc())
        .first()
    )

    try:
        amount = float(result.get("total_amount", 0) or 0)
    except (TypeError, ValueError):
        current_app.logger.error("eSewa callback total_amount not numeric: %r", result.get("total_amount"))
        return error_response("Invalid callback amount", 400)

    payload, status_code = _finalize_fee_payment(
        fc, "esewa", amount, result.get("ref_id") or "", initiation=initiation,
    )
    if status_code >= 400:
        return error_response(payload.get("error", "Payment could not be recorded"), status_code)

    return success_response(payload)


@webhooks_bp.route("/khalti/callback", methods=["GET", "POST"])
def khalti_callback():
    """Handle Khalti payment callback — Khalti redirects with pidx in query params."""
    from app.models.fee import FeeCollection, FeeReceipt, PaymentInitiation
    from app.models.school import School
    from app.services.payments.khalti_gateway import KhaltiGateway

    params = request.args.to_dict() or (request.get_json(silent=True) or {})
    pidx = params.get("pidx")
    purchase_order_id = params.get("purchase_order_id")

    if not pidx:
        current_app.logger.warning("Khalti callback with no pidx")
        return error_response("Missing pidx", 400)

    fc = FeeCollection.query.get(purchase_order_id) if purchase_order_id else None
    if not fc:
        return error_response("Fee collection not found", 404)

    school = School.query.get(fc.school_id)
    if not school:
        return error_response("School not found", 404)

    method_cfg = _school_payment_method(school, "khalti")
    secret_key = (method_cfg.get("secret_key") or "").strip()

    if not secret_key:
        current_app.logger.error("Khalti secret_key not configured for school %s", fc.school_id)
        return error_response("Payment gateway not configured for this school", 422)

    result = KhaltiGateway.verify_payment(pidx, secret_key=secret_key)
    current_app.logger.info(f"Khalti verify result: {result}")

    if not result.get("verified"):
        if result.get("network_error"):
            return error_response(
                f"Could not reach Khalti to verify the payment: {result.get('error')}", 502
            )
        return error_response(f"Payment not verified: {result.get('status')}", 400)

    # The pidx must actually belong to THIS collection. Khalti's lookup
    # response echoes the purchase_order_id the payment was initiated with —
    # a pidx from some other (possibly tiny) payment must never credit this
    # collection.
    lookup_po_id = str(result.get("purchase_order_id") or "")
    if lookup_po_id and lookup_po_id != str(fc.id):
        current_app.logger.error(
            "Khalti callback pidx %s belongs to purchase_order_id %s, not collection %s — REJECTED",
            pidx, lookup_po_id, fc.id,
        )
        return error_response("Payment reference does not match this fee collection", 400)

    # Anchor: the checkout attempt we initiated server-side (if any).
    initiation = (
        PaymentInitiation.query.filter_by(
            gateway="khalti", gateway_ref=str(pidx), is_deleted=False
        )
        .order_by(PaymentInitiation.created_at.desc())
        .first()
    )

    amount = float(result.get("amount_npr", 0) or 0)
    payload, status_code = _finalize_fee_payment(
        fc, "khalti", amount, result.get("transaction_id") or "", initiation=initiation,
    )
    if status_code >= 400:
        return error_response(payload.get("error", "Payment could not be recorded"), status_code)

    return success_response(payload)


@webhooks_bp.route("/fonepay/callback", methods=["GET", "POST"])
def fonepay_callback():
    """Handle FonePay payment callback — verifies signature and records payment."""
    from app.models.fee import FeeCollection, FeeReceipt, PaymentInitiation
    from app.models.school import School
    from app.services.payments.fonepay_gateway import FonePayGateway

    data = request.args.to_dict() or request.form.to_dict() or (request.get_json(silent=True) or {})
    current_app.logger.info(f"FonePay callback: {data}")

    prn = data.get("PRN", "")
    pid = data.get("PID", "")  # merchant code sent back by FonePay
    if not prn or not pid:
        return error_response("Missing PRN or PID", 400)

    # Find the school by its FonePay merchant_code matching PID.
    # fee_config is a JSON column; we query all schools and filter in Python
    # (acceptable — FonePay callbacks are infrequent).
    matching_school = None
    for school in School.query.filter_by(is_deleted=False).all():
        cfg = _school_payment_method(school, "fonepay")
        if (cfg.get("merchant_code") or "").strip() == pid:
            matching_school = school
            break

    if not matching_school:
        current_app.logger.error("FonePay callback: no school found for PID=%s", pid)
        return error_response("Payment gateway not configured", 422)

    method_cfg = _school_payment_method(matching_school, "fonepay")
    merchant_code = (method_cfg.get("merchant_code") or "").strip()
    secret_key = (method_cfg.get("secret_key") or "").strip()

    if not secret_key:
        return error_response("Payment gateway not configured for this school", 422)

    result = FonePayGateway.verify_payment(
        prn, data, merchant_code=merchant_code, secret_key=secret_key
    )

    if not result.get("verified"):
        if result.get("network_error"):
            return error_response(
                f"Could not reach FonePay to verify the payment: {result.get('error')}", 502
            )
        return error_response(result.get("error", "Payment verification failed"), 400)

    # Resolve the collection through the SERVER-SIDE initiation record —
    # FonePay callbacks carry only the PRN we generated at initiation time
    # (the old purchase_order_id/R1 guess never matched a real callback).
    initiation = (
        PaymentInitiation.query.filter_by(
            gateway="fonepay", gateway_ref=str(prn), is_deleted=False
        )
        .order_by(PaymentInitiation.created_at.desc())
        .first()
    )
    if not initiation or str(initiation.school_id) != str(matching_school.id):
        current_app.logger.warning(
            "FonePay: no matching payment initiation for PRN=%s (school %s)", prn, matching_school.id
        )
        return error_response(
            "No matching payment initiation found for this PRN — payment NOT recorded. "
            "Contact the school office with the transaction reference.",
            404,
        )

    fc = FeeCollection.query.filter_by(
        id=initiation.collection_id, school_id=matching_school.id, is_deleted=False
    ).first()
    if not fc:
        current_app.logger.warning("FonePay: collection missing for PRN=%s", prn)
        return error_response("Fee collection not found", 404)

    amount = float(result.get("amount", 0) or 0)
    payload, status_code = _finalize_fee_payment(
        fc, "fonepay", amount, result.get("transaction_id") or "", initiation=initiation,
    )
    if status_code >= 400:
        return error_response(payload.get("error", "Payment could not be recorded"), status_code)

    return success_response(payload)


@webhooks_bp.route("/whatsapp", methods=["GET"])
def whatsapp_verify():
    """WhatsApp webhook verification (GET challenge)."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    verify_token = current_app.config.get("WHATSAPP_VERIFY_TOKEN")
    # E198: an UNCONFIGURED verify token must fail closed. Comparing the
    # caller-supplied token against "" (or None) matched an empty
    # hub.verify_token and echoed the challenge to anyone — a 200 with
    # arbitrary challenge content while no real verification happened.
    if not (verify_token or "").strip():
        current_app.logger.error(
            "WhatsApp webhook verification rejected: WHATSAPP_VERIFY_TOKEN "
            "is not configured (fail closed)"
        )
        return error_response("Verification failed", 403)
    if mode == "subscribe" and hmac.compare_digest(token or "", verify_token):
        return challenge, 200
    return error_response("Verification failed", 403)


def _wa_resolve_school(phone_number_id: str | None, display_phone_number: str | None):
    """Resolve which tenant an inbound WhatsApp message belongs to.

    There is one shared Meta WhatsApp number for the platform (env
    WHATSAPP_PHONE_NUMBER_ID), so school attribution uses the bot opt-in:
    if exactly one school has an ENABLED WhatsApp bot config, inbound
    traffic on the platform number belongs to it. Ambiguous or
    unattributable traffic is NOT stored — it is reported as `unhandled`
    (loudly logged) so nothing is silently dropped or faked.
    """
    from app.models.notification import WhatsAppBotConfig

    configs = WhatsAppBotConfig.query.filter_by(is_enabled=True).all()
    if len(configs) == 1:
        return configs[0].school_id, None
    if len(configs) > 1:
        return None, "ambiguous_bot_owner"
    return None, "no_enabled_bot"


def _wa_match_auto_reply(rules: list, text: str) -> dict | None:
    """Return the first auto-reply rule matching the inbound text."""
    lowered = (text or "").strip().lower()
    for rule in rules or []:
        keyword = (rule.get("keyword") or "").strip()
        if not keyword:
            continue
        match_type = rule.get("match_type", "contains")
        if match_type == "exact":
            # E121: an exact rule that does NOT equal the text must skip the
            # rule entirely — falling through to the contains check below made
            # "SL4EXACT2" trigger the exact rule "SL4EXACT".
            if lowered == keyword.lower():
                return rule
            continue
        if match_type == "regex":
            import re as _re

            try:
                if _re.search(keyword, text or "", _re.IGNORECASE):
                    return rule
            except _re.error:
                continue
        if keyword.lower() in lowered:
            return rule
    return None


@webhooks_bp.route("/whatsapp", methods=["POST"])
def whatsapp_incoming():
    """Handle incoming WhatsApp messages (Meta Cloud API webhook).

    Honesty contract (audit Phase-2): every inbound user message is either
    (a) stored in `whatsapp_messages` (with an optional bot auto-reply) or
    (b) reported as `unhandled` with a reason, loudly logged. The endpoint
    never pretends an unprocessable payload succeeded. Signature
    verification runs whenever WHATSAPP_APP_SECRET is configured.
    """
    from app.models.notification import WhatsAppBotConfig, WhatsAppMessage
    from app.plugins.events import emit_for_school
    from app.services.communications.whatsapp_cloud import WhatsAppCloudService

    payload_bytes = request.get_data()
    signature = request.headers.get("X-Hub-Signature-256", "")
    if current_app.config.get("WHATSAPP_APP_SECRET"):
        if not signature or not WhatsAppCloudService.verify_signature(
            payload_bytes, signature
        ):
            current_app.logger.error(
                "WhatsApp webhook: X-Hub-Signature-256 verification failed"
            )
            return error_response("Signature verification failed", 403)

    data = {}
    if payload_bytes:
        # E198: a malformed body is a client error, not a crash — an
        # unhandled JSONDecodeError here returned 500 and triggered Meta's
        # retry storm on a payload that will never become valid.
        try:
            data = json.loads(payload_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            current_app.logger.warning(
                "WhatsApp webhook: malformed JSON body (%d bytes) — 400",
                len(payload_bytes),
            )
            return error_response("Malformed JSON payload", 400)
    messages = WhatsAppCloudService.parse_incoming(data)
    if not messages:
        # Meta also delivers delivery/read status payloads here — ack them
        # explicitly instead of pretending they were messages.
        current_app.logger.warning(
            "WhatsApp webhook: payload contained no user messages (unhandled); keys=%s",
            sorted((data.get("entry") or [{}])[0].get("changes", [{}])[0].get("value", {}).keys())
            if data.get("entry")
            else "empty",
        )
        return success_response({"received": 0, "processed": 0, "unhandled": 0,
                                 "note": "no user messages in payload"})

    value = (
        ((data.get("entry") or [{}])[0].get("changes") or [{}])[0].get("value") or {}
    )
    metadata = value.get("metadata") or {}
    phone_number_id = metadata.get("phone_number_id")
    display_phone_number = metadata.get("display_phone_number")

    school_id, resolve_error = _wa_resolve_school(phone_number_id, display_phone_number)
    if not school_id:
        current_app.logger.error(
            "WhatsApp webhook: cannot attribute inbound messages to a school "
            "(reason=%s, phone_number_id=%s) — %d message(s) UNHANDLED",
            resolve_error, phone_number_id, len(messages),
        )
        return success_response({
            "received": len(messages), "processed": 0,
            "unhandled": len(messages), "reason": resolve_error,
        })

    bot_config = WhatsAppBotConfig.query.filter_by(school_id=school_id).first()
    bot_enabled = bool(bot_config and bot_config.is_enabled)

    processed, unhandled, duplicates = 0, 0, 0
    for msg in messages:
        from_phone = msg.get("from")
        text = msg.get("text") or ""
        msg_type = msg.get("type") or "unknown"
        if not from_phone:
            unhandled += 1
            current_app.logger.error(
                "WhatsApp webhook: message without sender — UNHANDLED: %s", msg
            )
            continue
        # Idempotency: Meta redelivers on late/failed ACKs — the same
        # wa_message_id must not create a second inbound row.
        wa_message_id = msg.get("message_id")
        if wa_message_id and WhatsAppMessage.query.filter_by(
            school_id=school_id, wa_message_id=wa_message_id, direction="inbound"
        ).first():
            duplicates += 1
            current_app.logger.info(
                "WhatsApp webhook: duplicate message %s from %s — ignored",
                wa_message_id, from_phone,
            )
            continue
        try:
            inbound = WhatsAppMessage(
                school_id=school_id,
                phone_number_id=phone_number_id,
                to_phone=phone_number_id or (display_phone_number or ""),
                from_phone=from_phone,
                direction="inbound",
                message_type=msg_type,
                content=text if msg_type == "text" else None,
                media_url=msg.get("media_url"),
                wa_message_id=msg.get("message_id"),
                status="sent",  # Meta delivered it to us; delivery to us succeeded
            )
            db.session.add(inbound)

            bot_replied = False
            if bot_enabled and msg_type == "text":
                rule = _wa_match_auto_reply(
                    bot_config.auto_replies if bot_config else [], text
                )
                if rule:
                    result = WhatsAppCloudService.send_text(from_phone, rule.get("response", ""))
                    if not result.get("skipped"):
                        db.session.add(WhatsAppMessage(
                            school_id=school_id,
                            phone_number_id=phone_number_id,
                            to_phone=from_phone,
                            from_phone=phone_number_id or display_phone_number,
                            direction="outbound",
                            message_type="text",
                            content=rule.get("response", ""),
                            wa_message_id=result.get("messages", [{}])[0].get("id")
                            if isinstance(result.get("messages"), list) else None,
                            status="sent" if not result.get("error") else "failed",
                            is_bot_reply=True,
                            bot_command=rule.get("keyword"),
                        ))
                        bot_replied = True
                    else:
                        current_app.logger.warning(
                            "WhatsApp bot auto-reply for school %s skipped: %s",
                            school_id, result.get("reason"),
                        )
            db.session.commit()
            processed += 1
            emit_for_school(
                "whatsapp.message_received", str(school_id),
                from_phone=from_phone, text=text, message_type=msg_type,
                auto_replied=bot_replied,
            )
        except Exception:
            db.session.rollback()
            unhandled += 1
            current_app.logger.exception(
                "WhatsApp webhook: failed to process inbound message — UNHANDLED: %s", msg
            )

    return success_response({
        "received": len(messages),
        "processed": processed,
        "duplicates": duplicates,
        "unhandled": unhandled,
    })


@webhooks_bp.route("/stripe", methods=["POST"])
def stripe_webhook():
    """Handle Stripe webhooks for SaaS Plugin Subscriptions.

    This is a signature-verified "payment confirmed" path for plugin
    activation (audit E5). It degrades gracefully when unconfigured: a
    missing STRIPE_WEBHOOK_SECRET or missing ``stripe`` package returns
    400 with a logged error instead of crashing with 500, because
    signature verification (and therefore honest activation) is impossible
    without them.
    """
    endpoint_secret = current_app.config.get("STRIPE_WEBHOOK_SECRET") or ""
    if not endpoint_secret:
        current_app.logger.error(
            "Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured "
            "(set it in the environment to enable Stripe subscription webhooks)"
        )
        return error_response("Stripe webhook secret not configured", 400)

    try:
        import stripe
    except ImportError:
        current_app.logger.error(
            "Stripe webhook rejected: the 'stripe' package is not installed"
        )
        return error_response("Stripe integration unavailable", 400)

    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError:
        current_app.logger.warning("Stripe webhook: invalid payload")
        return error_response("Invalid payload", 400)
    except Exception:
        # SignatureVerificationError lives at stripe.error.* (older SDKs) or
        # stripe.* (v5+) — a broad catch supports both.
        current_app.logger.warning("Stripe webhook: signature verification failed")
        return error_response("Invalid signature", 400)

    if event.type == "checkout.session.completed":
        from app.models.plugin import SchoolPlugin

        session = event.data.object

        # We expect metadata to contain school_id and plugin_slug/package_id
        school_id = session.metadata.get("school_id")
        plugin_slug = session.metadata.get("plugin_slug")

        if school_id and plugin_slug:
            billing_cycle = session.metadata.get("billing_cycle")
            if billing_cycle not in ("monthly", "yearly"):
                billing_cycle = "monthly"
            existing = SchoolPlugin.query.filter_by(
                school_id=school_id, plugin_slug=plugin_slug
            ).first()
            if not existing:
                existing = SchoolPlugin(
                    school_id=school_id,
                    plugin_slug=plugin_slug,
                    active=True,
                    is_trial=False,  # payment verified by Stripe signature
                    billing_cycle=billing_cycle,
                    installed_at=datetime.now(timezone.utc),
                )
                db.session.add(existing)
            else:
                existing.active = True
                existing.uninstalled_at = None
                existing.is_trial = False
                existing.billing_cycle = billing_cycle
            db.session.commit()
            current_app.logger.info(
                f"Activated paid plugin {plugin_slug} for school {school_id} "
                f"(cycle={billing_cycle})"
            )

            from app.plugins.billing import _invalidate_plugin_cache

            _invalidate_plugin_cache(str(school_id))

    return success_response({"received": True})


_AMOUNT_EPSILON = 0.01


def _finalize_fee_payment(collection, gateway, amount, transaction_id, initiation=None):
    """Apply a gateway-verified payment exactly once (audit E60).

    Idempotency and conflict rules, in order:
      1. Same gateway transaction already recorded (receipt exists) or the
         initiation row is already completed -> idempotent no-op (200).
      2. Initiation marked failed -> 409.
      3. Initiation exists and the callback amount differs from the initiated
         amount -> 409, nothing recorded (loudly logged).
      4. No initiation anchor and the amount exceeds the outstanding balance
         -> 409, nothing recorded (loudly logged) — our own initiation always
         charges exactly the outstanding, so this is an anomaly.
      5. Collection already paid via a DIFFERENT transaction -> 409 conflict
         (a second real charge happened at the gateway; an admin must refund).

    Returns (payload_dict, http_status_code) and commits exactly once.
    """
    from app.models.fee import FeeReceipt

    total_amount = float(collection.amount or 0)
    previous_paid = _extract_partial_paid(collection)
    outstanding = max(total_amount - previous_paid, 0)

    existing_receipt = None
    if transaction_id:
        existing_receipt = FeeReceipt.query.filter_by(
            school_id=collection.school_id,
            collection_id=collection.id,
            payment_method=gateway,
            transaction_id=str(transaction_id),
            is_deleted=False,
        ).first()

    def _duplicate_payload(receipt=None):
        if receipt is None:
            # Echo the collection's existing receipt (any transaction) so the
            # duplicate response still carries something actionable.
            receipt = (
                FeeReceipt.query.filter_by(
                    school_id=collection.school_id,
                    collection_id=collection.id,
                    is_deleted=False,
                )
                .order_by(FeeReceipt.created_at.desc())
                .first()
            )
        return {
            "verified": True,
            "duplicate": True,
            "collection_id": str(collection.id),
            "status": collection.payment_status,
            "receipt_id": str(receipt.id) if receipt else None,
        }, 200

    # 1. Duplicate callback — same gateway transaction, or an initiation
    #    that has already been completed by an earlier callback.
    if initiation is not None and initiation.status == "completed":
        return _duplicate_payload(existing_receipt)
    if existing_receipt is not None:
        return _duplicate_payload(existing_receipt)

    # 5. Already fully paid by a different transaction -> honest conflict,
    #    never double-count.
    if collection.payment_status == "paid":
        same_txn = transaction_id and str(collection.transaction_id or "") == str(transaction_id)
        if same_txn:
            return _duplicate_payload(None)
        current_app.logger.error(
            "%s callback for collection %s: already PAID via transaction %r; "
            "callback transaction %r for %.2f REJECTED (possible double charge)",
            gateway, collection.id, collection.transaction_id, transaction_id, amount,
        )
        return {
            "error": "This fee is already paid in full by another transaction "
                     f"({collection.transaction_id or 'unknown'}). No payment was recorded.",
        }, 409

    # 2. Initiation was already marked failed server-side.
    if initiation is not None and initiation.status == "failed":
        return {"error": "This payment attempt was already marked failed. "
                         "No payment was recorded."}, 409

    # 3. Amount must match what the server initiated (gateway-attested).
    if initiation is not None:
        initiated_amount = float(initiation.amount or 0)
        if abs(amount - initiated_amount) > _AMOUNT_EPSILON:
            current_app.logger.error(
                "%s callback for collection %s: amount %.2f != initiated %.2f — REJECTED",
                gateway, collection.id, amount, initiated_amount,
            )
            return {
                "error": f"Callback amount ({amount:.2f}) does not match the initiated "
                         f"charge ({initiated_amount:.2f}). No payment was recorded.",
            }, 409
        if amount > outstanding + _AMOUNT_EPSILON:
            # e.g. an offline payment landed between initiation and callback.
            current_app.logger.error(
                "%s callback for collection %s: paid %.2f exceeds outstanding %.2f — "
                "recording only the outstanding part; reconcile the difference",
                gateway, collection.id, amount, outstanding,
            )
    elif amount > outstanding + _AMOUNT_EPSILON:
        # 4. No initiation anchor (legacy in-flight checkout): our own
        #    initiation always charges exactly the outstanding, so an amount
        #    ABOVE outstanding is an anomaly — refuse it rather than silently
        #    capping.
        current_app.logger.error(
            "%s callback for collection %s: amount %.2f exceeds outstanding %.2f with "
            "no initiation record — REJECTED",
            gateway, collection.id, amount, outstanding,
        )
        return {
            "error": f"Callback amount ({amount:.2f}) exceeds the outstanding balance "
                     f"({outstanding:.2f}). No payment was recorded.",
        }, 409

    recorded_amount = min(float(amount or 0), outstanding)
    _apply_fee_payment(collection, recorded_amount, gateway, transaction_id)

    idempotency_key = f"webhook:{gateway}:{collection.id}:{transaction_id or 'no-ref'}"
    if len(idempotency_key) > 100:
        idempotency_key = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
    receipt = FeeReceipt(
        school_id=collection.school_id,
        collection_id=collection.id,
        student_id=collection.student_id,
        receipt_number=_webhook_receipt_number(collection),
        amount=recorded_amount,
        payment_method=gateway,
        transaction_id=str(transaction_id) if transaction_id else None,
        idempotency_key=idempotency_key,
    )
    receipt.verified_hash = _webhook_receipt_hash(receipt.receipt_number, collection, recorded_amount)
    db.session.add(receipt)
    try:
        db.session.flush()
    except Exception:
        # Lost a race against a concurrent identical callback.
        db.session.rollback()
        current_app.logger.warning(
            "%s callback for collection %s: receipt insert raced a duplicate — treated as no-op",
            gateway, collection.id,
        )
        raced = FeeReceipt.query.filter_by(
            school_id=collection.school_id,
            collection_id=collection.id,
            payment_method=gateway,
            transaction_id=str(transaction_id) if transaction_id else None,
            is_deleted=False,
        ).first()
        return _duplicate_payload(raced)

    collection.receipt_number = receipt.receipt_number
    collection.receipt_url = f"/api/v1/fees/receipts/{receipt.id}/pdf"
    receipt.pdf_url = collection.receipt_url

    if initiation is not None:
        initiation.status = "completed"
        initiation.completed_at = datetime.now(timezone.utc)

    db.session.commit()

    try:
        from app.plugins.events import emit
        emit(
            "fee.paid",
            school_id=str(collection.school_id),
            student_id=str(collection.student_id),
            amount=recorded_amount,
        )
    except Exception:
        pass

    return {
        "verified": True,
        "collection_id": str(collection.id),
        "status": collection.payment_status,
        "receipt_id": str(receipt.id),
        "recorded_amount": recorded_amount,
    }, 200


def _apply_fee_payment(collection, amount, method, transaction_id):
    # E183: use the SAME payable math as the /fees API (base + late fine −
    # discount). The raw base previously kept discounted students at
    # "partial" forever after a fully-successful gateway payment.
    total_amount = _collection_payable(collection)
    previous_paid = _extract_partial_paid(collection)
    outstanding = max(total_amount - previous_paid, 0)
    recorded_amount = min(float(amount or 0), outstanding)
    new_paid = min(total_amount, previous_paid + recorded_amount)

    collection.payment_method = method
    collection.transaction_id = transaction_id or collection.transaction_id
    collection.collected_at = datetime.now(timezone.utc)
    collection.notes = _merge_partial_payment_note(collection.notes, new_paid)
    collection.payment_status = "paid" if new_paid >= total_amount else "partial"
    return recorded_amount


def _collection_payable(collection):
    """Net payable for a fee collection — one definition shared with the
    /fees API (base + late fine − discount, floored at 0)."""
    from app.api.v1.fees import _collection_payable_total

    return _collection_payable_total(collection)


def _extract_partial_paid(collection):
    if collection.payment_status == "paid":
        return _collection_payable(collection)

    notes = collection.notes or ""
    marker = "[partial_paid:"
    if marker not in notes:
        return 0

    try:
        value = notes.split(marker, 1)[1].split("]", 1)[0]
        return float(value)
    except (ValueError, TypeError, IndexError):
        return 0


def _merge_partial_payment_note(existing_notes, paid_amount):
    notes = existing_notes or ""
    marker = "[partial_paid:"
    if marker in notes:
        prefix = notes.split(marker, 1)[0].rstrip()
        suffix = notes.split("]", 1)[1].lstrip() if "]" in notes else ""
        notes = " ".join(part for part in (prefix, suffix) if part).strip()
    partial_note = f"[partial_paid:{paid_amount}]"
    return f"{partial_note} {notes}".strip()


def _webhook_receipt_number(collection):
    from app.models.fee import FeeReceipt

    count = (
        FeeReceipt.query.filter_by(
            school_id=collection.school_id,
            collection_id=collection.id,
            is_deleted=False,
        ).count()
        + 1
    )
    return f"RCPT-{str(collection.id).split('-')[0].upper()}-{count:02d}"


def _webhook_receipt_hash(receipt_number, collection, amount):
    payload = f"{collection.school_id}:{collection.id}:{receipt_number}:{amount}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
