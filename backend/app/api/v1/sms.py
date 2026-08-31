"""SMS Notifications API — send, templates, history, credits."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.notification import SMSLog, NotificationTemplate
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

sms_bp = Blueprint("sms", __name__, url_prefix="/sms")


@sms_bp.route("/send", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
@role_required("superadmin", "school_admin")
def send_sms():
    """Queue an SMS for sending via Sparrow SMS.

    Body: {"phones": [...]} (canonical) — "to" is accepted as an alias
    because the web dashboard sends it. Each recipient becomes one SMSLog
    row (status `queued`); the Celery task flips it to sent/failed with the
    real per-message outcome (cost is counted only when a message is
    actually sent).
    """
    data = request.get_json(silent=True) or {}
    phones = data.get("phones") or data.get("to") or []
    message = (data.get("message") or "").strip()
    template_name = data.get("template_name")

    if not isinstance(phones, list):
        phones = [phones]
    phones = [str(p).strip() for p in phones if str(p).strip()]
    invalid = [p for p in phones if not _valid_phone(p)]

    if not phones or not message:
        return error_response("phones and message are required")
    if invalid:
        return error_response(
            f"Invalid phone number(s): {', '.join(invalid)}", 400
        )

    logs = []
    for phone in phones:
        log = SMSLog(
            school_id=g.school_id,
            to_phone=phone,
            message=message,
            template_name=template_name,
            status="queued",
            cost=0,  # credited only on actual send (task-side)
            sent_by_id=g.current_user.id,
        )
        db.session.add(log)
        logs.append(log)

    db.session.commit()

    # Queue async sending — each task updates its SMSLog row's status.
    from app.tasks.sms_sender import send_bulk_sms

    send_bulk_sms.delay([
        {"phone": log.to_phone, "message": message, "log_id": str(log.id)}
        for log in logs
    ])

    return created_response({
        "queued": len(logs),
        "log_ids": [str(l.id) for l in logs],
    })


def _valid_phone(phone: str) -> bool:
    """Nepal-friendly E.164-ish check: optional +, then 7-15 digits
    (spaces/hyphens allowed as separators)."""
    import re

    return bool(re.fullmatch(r"\+?\d[\d\s-]{6,17}", phone)) and (
        7 <= len("".join(ch for ch in phone if ch.isdigit())) <= 15
    )


@sms_bp.route("/history", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
def sms_history():
    query = SMSLog.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    items, meta = paginate(query.order_by(SMSLog.created_at.desc()))
    return success_response([_sms_dict(s) for s in items], meta={"pagination": meta})


# ── Templates ──────────────────────────────────────────────


@sms_bp.route("/templates", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
def list_templates():
    query = NotificationTemplate.query.filter_by(
        school_id=g.school_id, is_deleted=False
    )
    items, meta = paginate(query.order_by(NotificationTemplate.created_at.desc()))
    return success_response([_template_dict(t) for t in items], meta={"pagination": meta})


@sms_bp.route("/templates", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
@role_required("superadmin", "school_admin")
def create_template():
    data = request.get_json(silent=True) or {}
    # E197: an unnamed/empty template was stored verbatim and then showed up
    # in every template picker as a blank row — validate instead.
    name = (data.get("name") or "").strip()
    body = (data.get("body") or data.get("content") or "").strip()
    if not name or not body:
        return error_response("name and body are required", 400)
    channel = data.get("channel", "sms")
    if channel not in ("sms", "email", "whatsapp", "push"):
        return error_response(
            "channel must be one of: sms, email, whatsapp, push", 400
        )
    tpl = NotificationTemplate(
        school_id=g.school_id,
        name=name,
        channel=channel,
        template_en=body,
        template_ne=data.get("template_ne"),
        variables=data.get("variables", []),
        is_active=data.get("is_active", True),
    )
    db.session.add(tpl)
    db.session.commit()
    return created_response(_template_dict(tpl))


# ── Credits / Stats ───────────────────────────────────────


@sms_bp.route("/stats", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
def sms_stats():
    from datetime import date as _date

    from sqlalchemy import func

    total = db.session.query(func.count(SMSLog.id)).filter_by(
        school_id=g.school_id, is_deleted=False
    ).scalar()
    sent = db.session.query(func.count(SMSLog.id)).filter_by(
        school_id=g.school_id, is_deleted=False, status="sent"
    ).scalar()
    failed = db.session.query(func.count(SMSLog.id)).filter_by(
        school_id=g.school_id, is_deleted=False, status="failed"
    ).scalar()
    queued = db.session.query(func.count(SMSLog.id)).filter_by(
        school_id=g.school_id, is_deleted=False, status="queued"
    ).scalar()
    # Credits are counted only for messages that were actually sent —
    # queued/failed rows cost nothing (cost is set by the sender task).
    credits_used = db.session.query(func.coalesce(func.sum(SMSLog.cost), 0)).filter_by(
        school_id=g.school_id, is_deleted=False, status="sent"
    ).scalar()

    # E236: the web Credits tab renders credits_available / this_month_sent /
    # total_sent / total_failed — none of which this response carried, so
    # every card showed "—". Remaining credits = purchased top-ups (plugin
    # config key "credits_topup") minus credits spent on sent messages; a
    # live Sparrow gateway balance wins when the integration is configured.
    from app.models.plugin import SchoolPlugin

    sp = SchoolPlugin.query.filter_by(
        school_id=g.school_id, plugin_slug="sms_notifications"
    ).first()
    topup = float((sp.config or {}).get("credits_topup") or 0) if sp else 0.0
    credits_available = max(0.0, topup - float(credits_used or 0))

    gateway = None
    try:
        from flask import current_app

        if current_app.config.get("SPARROW_SMS_TOKEN"):
            from app.services.communications.sms_gateway import SmsGatewayService

            gateway = SmsGatewayService.check_credits()
            if gateway and gateway.get("credits_available") is not None:
                credits_available = float(gateway["credits_available"])
    except Exception:  # noqa: BLE001 — a gateway outage must not break stats
        gateway = None

    month_start = _date.today().replace(day=1)
    this_month_sent = db.session.query(func.count(SMSLog.id)).filter(
        SMSLog.school_id == g.school_id,
        SMSLog.is_deleted.is_(False),
        SMSLog.status == "sent",
        SMSLog.created_at >= month_start,
    ).scalar()

    return success_response({
        "total": total, "sent": sent, "failed": failed, "queued": queued,
        "credits_used": int(credits_used),
        # Fields the web Credits tab renders (E236):
        "credits_available": int(credits_available),
        "credits_source": "gateway" if gateway else "config",
        "this_month_sent": this_month_sent,
        "total_sent": sent,
        "total_failed": failed,
    })


# ── Serializers ────────────────────────────────────────────


def _sms_dict(s):
    return {
        "id": str(s.id), "to_phone": s.to_phone, "message": s.message,
        "template_name": s.template_name, "status": s.status,
        "provider": s.provider, "cost": s.cost,
        "sent_at": str(s.sent_at) if s.sent_at else None,
        "created_at": str(s.created_at),
    }


def _template_dict(t):
    return {
        "id": str(t.id),
        "name": t.name,
        "channel": t.channel,
        "body": t.template_en,
        "template_ne": t.template_ne,
        "variables": t.variables,
        "is_active": t.is_active,
    }
