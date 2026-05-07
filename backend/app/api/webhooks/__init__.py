"""Webhook handlers blueprint."""
import hmac
import hashlib
from datetime import datetime, timezone

from flask import Blueprint, current_app, request

from app.utils.response import error_response, success_response
from extensions import db

webhooks_bp = Blueprint("webhooks", __name__)


@webhooks_bp.route("/esewa/callback", methods=["GET", "POST"])
def esewa_callback():
    """Handle eSewa payment callback — eSewa redirects with base64 encoded data."""
    from app.services.payments.esewa_gateway import EsewaGateway
    from app.models.fee import FeeCollection, FeeReceipt

    encoded_data = request.args.get("data") or (request.get_json(silent=True) or {}).get("data")
    if not encoded_data:
        current_app.logger.warning("eSewa callback with no data")
        return error_response("Missing callback data", 400)

    result = EsewaGateway.verify_payment(encoded_data)
    current_app.logger.info(f"eSewa verify result: {result}")

    if not result.get("verified"):
        return error_response(result.get("error", "Payment verification failed"), 400)

    collection_id = result.get("transaction_uuid")
    fc = FeeCollection.query.get(collection_id)
    if not fc:
        return error_response("Fee collection not found", 404)

    amount = float(result.get("total_amount", 0) or 0)
    recorded_amount = _apply_fee_payment(fc, amount, "esewa", result.get("ref_id"))

    receipt = FeeReceipt(
        school_id=fc.school_id,
        collection_id=fc.id,
        student_id=fc.student_id,
        receipt_number=_webhook_receipt_number(fc),
        amount=recorded_amount,
        payment_method="esewa",
        transaction_id=result.get("ref_id"),
    )
    receipt.verified_hash = _webhook_receipt_hash(receipt.receipt_number, fc, recorded_amount)
    db.session.add(receipt)
    fc.receipt_number = receipt.receipt_number
    fc.receipt_url = f"/api/v1/fees/receipts/{receipt.id}/pdf"
    receipt.pdf_url = fc.receipt_url
    db.session.commit()

    return success_response({
        "verified": True,
        "collection_id": str(fc.id),
        "status": fc.payment_status,
        "receipt_id": str(receipt.id),
    })


@webhooks_bp.route("/khalti/callback", methods=["GET", "POST"])
def khalti_callback():
    """Handle Khalti payment callback — Khalti redirects with pidx in query params."""
    from app.services.payments.khalti_gateway import KhaltiGateway
    from app.models.fee import FeeCollection, FeeReceipt

    pidx = request.args.get("pidx") or (request.get_json(silent=True) or {}).get("pidx")
    purchase_order_id = request.args.get("purchase_order_id") or (
        request.get_json(silent=True) or {}
    ).get("purchase_order_id")
    if not pidx:
        current_app.logger.warning("Khalti callback with no pidx")
        return error_response("Missing pidx", 400)

    result = KhaltiGateway.verify_payment(pidx)
    current_app.logger.info(f"Khalti verify result: {result}")

    if not result.get("verified"):
        return error_response(f"Payment not verified: {result.get('status')}", 400)

    collection_id = purchase_order_id
    fc = FeeCollection.query.get(collection_id) if collection_id else None
    if not fc:
        return error_response("Fee collection not found", 404)

    amount = float(result.get("amount_npr", 0) or 0)
    recorded_amount = _apply_fee_payment(
        fc,
        amount,
        "khalti",
        result.get("transaction_id"),
    )

    receipt = FeeReceipt(
        school_id=fc.school_id,
        collection_id=fc.id,
        student_id=fc.student_id,
        receipt_number=_webhook_receipt_number(fc),
        amount=recorded_amount,
        payment_method="khalti",
        transaction_id=result.get("transaction_id"),
    )
    receipt.verified_hash = _webhook_receipt_hash(receipt.receipt_number, fc, recorded_amount)
    db.session.add(receipt)
    fc.receipt_number = receipt.receipt_number
    fc.receipt_url = f"/api/v1/fees/receipts/{receipt.id}/pdf"
    receipt.pdf_url = fc.receipt_url
    db.session.commit()

    return success_response({
        "verified": True,
        "collection_id": str(fc.id),
        "status": fc.payment_status,
        "receipt_id": str(receipt.id),
    })


@webhooks_bp.route("/fonepay/callback", methods=["POST"])
def fonepay_callback():
    """Handle FonePay payment callback."""
    data = request.get_json(silent=True) or request.form.to_dict()
    current_app.logger.info(f"FonePay callback: {data}")
    return success_response({"received": True})


@webhooks_bp.route("/whatsapp", methods=["GET"])
def whatsapp_verify():
    """WhatsApp webhook verification (GET challenge)."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    verify_token = current_app.config.get("WHATSAPP_VERIFY_TOKEN")
    if mode == "subscribe" and token == verify_token:
        return challenge, 200
    return error_response("Verification failed", 403)


@webhooks_bp.route("/whatsapp", methods=["POST"])
def whatsapp_incoming():
    """Handle incoming WhatsApp messages."""
    data = request.get_json(silent=True) or {}
    # Process incoming WhatsApp messages — Phase 3
    current_app.logger.info(f"WhatsApp webhook: {data.get('entry', [])}")
    return success_response({"received": True})


@webhooks_bp.route("/stripe", methods=["POST"])
def stripe_webhook():
    """Handle Stripe webhooks for SaaS Plugin Subscriptions."""
    import stripe
    from app.models.plugin import SchoolPlugin
    
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature", "")
    endpoint_secret = current_app.config.get("STRIPE_WEBHOOK_SECRET")
    
    if not endpoint_secret:
        return error_response("Stripe webhook secret not configured", 500)
        
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError as e:
        return error_response("Invalid payload", 400)
    except stripe.error.SignatureVerificationError as e:
        return error_response("Invalid signature", 400)
        
    if event.type == "checkout.session.completed":
        session = event.data.object
        
        # We expect metadata to contain school_id and plugin_slug/package_id
        school_id = session.metadata.get("school_id")
        plugin_slug = session.metadata.get("plugin_slug")
        
        if school_id and plugin_slug:
            existing = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=plugin_slug).first()
            if not existing:
                new_plugin = SchoolPlugin(
                    school_id=school_id,
                    plugin_slug=plugin_slug,
                    active=True,
                    installed_at=datetime.now(timezone.utc)
                )
                db.session.add(new_plugin)
                db.session.commit()
                current_app.logger.info(f"Activated plugin {plugin_slug} for school {school_id}")
            else:
                existing.active = True
                db.session.commit()
                
    return success_response({"received": True})


def _apply_fee_payment(collection, amount, method, transaction_id):
    total_amount = float(collection.amount or 0)
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


def _extract_partial_paid(collection):
    if collection.payment_status == "paid":
        return float(collection.amount or 0)

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
