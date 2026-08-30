"""WhatsApp Bot API — chatbot config, auto-replies, conversation management."""
from sqlalchemy import func as sa_func
from sqlalchemy.orm import aliased

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

whatsapp_bot_bp = Blueprint("whatsapp_bot", __name__, url_prefix="/whatsapp-bot")


def _inbound_with_reply_exists():
    """Build (inbound_alias, reply_exists_clause) for the handled derivation.

    E210: WhatsAppMessage has no handled flag — handled-ness is DERIVED from
    the message history: an inbound message is 'handled' when a later-or-equal
    outbound reply to the same phone exists (bot auto-reply OR manual send),
    so the badge can never disagree with reality.
    """
    from app.models.notification import WhatsAppMessage

    inbound = aliased(WhatsAppMessage)
    outbound = aliased(WhatsAppMessage)
    reply_exists = (
        db.session.query(outbound.id)
        .filter(
            outbound.school_id == inbound.school_id,
            outbound.direction == "outbound",
            outbound.to_phone == inbound.from_phone,
            outbound.created_at >= inbound.created_at,
        )
        .exists()
    )
    return inbound, reply_exists


def _handled_inbound_ids(school_id, phones=None):
    """Return the ids of inbound messages that have a subsequent reply."""
    inbound, reply_exists = _inbound_with_reply_exists()
    q = db.session.query(inbound.id).filter(
        inbound.school_id == school_id,
        inbound.direction == "inbound",
        reply_exists,
    )
    if phones:
        q = q.filter(inbound.from_phone.in_(phones))
    return {str(row[0]) for row in q.all()}


@whatsapp_bot_bp.route("/config", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
def get_bot_config():
    """Get WhatsApp bot configuration for the school."""
    from app.models.notification import WhatsAppBotConfig

    config = WhatsAppBotConfig.query.filter_by(school_id=g.school_id).first()
    if not config:
        return success_response({
            "enabled": False,
            "welcome_message": "",
            "auto_replies": [],
            "notification_types": [],
        })

    return success_response({
        "enabled": config.is_enabled,
        "welcome_message": config.welcome_message,
        "auto_replies": config.auto_replies or [],
        "notification_types": config.notification_types or [],
        "language": config.language or "en",
    })


@whatsapp_bot_bp.route("/config", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin")
def update_bot_config():
    from app.models.notification import WhatsAppBotConfig

    data = request.get_json(silent=True) or {}
    config = WhatsAppBotConfig.query.filter_by(school_id=g.school_id).first()
    if not config:
        config = WhatsAppBotConfig(school_id=g.school_id)
        db.session.add(config)

    for key in ("is_enabled", "welcome_message", "auto_replies", "notification_types", "language"):
        if key in data:
            setattr(config, key, data[key])

    db.session.commit()
    return success_response({"updated": True})


@whatsapp_bot_bp.route("/auto-replies", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
def list_auto_replies():
    """Get configured auto-reply rules."""
    from app.models.notification import WhatsAppBotConfig

    config = WhatsAppBotConfig.query.filter_by(school_id=g.school_id).first()
    return success_response(config.auto_replies if config else [])


@whatsapp_bot_bp.route("/auto-replies", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin")
def add_auto_reply():
    """Add a new auto-reply rule."""
    from app.models.notification import WhatsAppBotConfig

    data = request.get_json(silent=True) or {}
    config = WhatsAppBotConfig.query.filter_by(school_id=g.school_id).first()
    if not config:
        config = WhatsAppBotConfig(school_id=g.school_id)
        db.session.add(config)

    # Build a NEW list — appending to the loaded JSONB list in place and
    # assigning the same object back is a no-op for SQLAlchemy change
    # detection, so the rule would be silently lost on commit.
    rules = list(config.auto_replies or [])
    rules.append({
        "keyword": data.get("keyword", ""),
        "response": data.get("response", ""),
        "match_type": data.get("match_type", "contains"),  # exact, contains, regex
    })
    config.auto_replies = rules
    db.session.commit()
    return created_response({"total_rules": len(rules)})


@whatsapp_bot_bp.route("/auto-replies/<int:rule_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin")
def update_auto_reply(rule_id):
    """Edit an auto-reply rule (E211). `rule_id` is the rule's 0-based index —
    the JSONB rule list has no stable ids, so the Templates UI always works on
    the list it just fetched."""
    from app.models.notification import WhatsAppBotConfig

    data = request.get_json(silent=True) or {}
    config = WhatsAppBotConfig.query.filter_by(school_id=g.school_id).first()
    rules = list(config.auto_replies or []) if config else []
    if rule_id < 0 or rule_id >= len(rules):
        return error_response("Auto-reply rule not found", 404)

    rule = dict(rules[rule_id])
    for key in ("keyword", "response", "match_type"):
        if key in data:
            rule[key] = data[key]
    if not (rule.get("keyword") or "").strip() or not (rule.get("response") or "").strip():
        return error_response("keyword and response are required", 400)
    if rule.get("match_type") not in ("exact", "contains", "regex"):
        rule["match_type"] = "contains"

    rules[rule_id] = rule
    config.auto_replies = rules  # fresh list — JSONB change detection
    db.session.commit()
    return success_response({"updated": True, "rule": rule})


@whatsapp_bot_bp.route("/auto-replies/<int:rule_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin")
def delete_auto_reply(rule_id):
    """Delete an auto-reply rule (E211) by 0-based index."""
    from app.models.notification import WhatsAppBotConfig

    config = WhatsAppBotConfig.query.filter_by(school_id=g.school_id).first()
    rules = list(config.auto_replies or []) if config else []
    if rule_id < 0 or rule_id >= len(rules):
        return error_response("Auto-reply rule not found", 404)

    removed = rules.pop(rule_id)
    config.auto_replies = rules
    db.session.commit()
    return success_response({"deleted": True, "rule": removed, "total_rules": len(rules)})


# ── Conversations (E210) ─────────────────────────────────────────────────


@whatsapp_bot_bp.route("/conversations", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
def list_conversations():
    """WhatsApp conversations grouped by parent phone, newest activity first.

    Every conversation reports inbound/outbound counts and a handled badge:
    handled = the conversation's LATEST inbound message already has a reply
    after it (bot auto-reply or a manual send). Derived from history — never
    a stored flag that can drift.
    """
    from app.models.notification import WhatsAppMessage

    school_id = g.school_id
    rows = (
        WhatsAppMessage.query.filter(
            WhatsAppMessage.school_id == school_id,
            WhatsAppMessage.direction == "inbound",
        )
        .with_entities(
            WhatsAppMessage.from_phone,
            sa_func.count(WhatsAppMessage.id).label("inbound_count"),
            sa_func.max(WhatsAppMessage.created_at).label("last_inbound_at"),
        )
        .group_by(WhatsAppMessage.from_phone)
        .order_by(sa_func.max(WhatsAppMessage.created_at).desc())
        .all()
    )
    if not rows:
        return success_response([])

    phones = [r.from_phone for r in rows]
    counts = dict(
        WhatsAppMessage.query.filter(
            WhatsAppMessage.school_id == school_id,
            WhatsAppMessage.direction == "outbound",
            WhatsAppMessage.to_phone.in_(phones),
        )
        .with_entities(WhatsAppMessage.to_phone, sa_func.count(WhatsAppMessage.id))
        .group_by(WhatsAppMessage.to_phone)
        .all()
    )
    # Latest inbound row per phone (DISTINCT ON on Postgres).
    inbound_alias = aliased(WhatsAppMessage)
    last_rows = (
        db.session.query(inbound_alias)
        .filter(
            inbound_alias.school_id == school_id,
            inbound_alias.direction == "inbound",
            inbound_alias.from_phone.in_(phones),
        )
        .order_by(
            inbound_alias.from_phone,
            inbound_alias.created_at.desc(),
        )
        .distinct(inbound_alias.from_phone)
        .all()
    )
    last_by_phone = {m.from_phone: m for m in last_rows}
    handled_ids = _handled_inbound_ids(school_id, phones=phones)

    conversations = []
    for r in rows:
        last = last_by_phone.get(r.from_phone)
        preview = None
        if last:
            preview = last.content or (f"{last.message_type} message" if last.message_type else None)
        conversations.append({
            "phone": r.from_phone,
            "inbound_count": int(r.inbound_count or 0),
            "outbound_count": int(counts.get(r.from_phone, 0) or 0),
            "last_message": preview,
            "last_message_at": last.created_at.isoformat() if last and last.created_at else None,
            "status": "handled" if (last and str(last.id) in handled_ids) else "unhandled",
        })
    return success_response(conversations)


@whatsapp_bot_bp.route("/conversations/<phone>/messages", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
def list_conversation_messages(phone):
    """Full message history of one WhatsApp conversation (oldest first)."""
    from app.models.notification import WhatsAppMessage

    school_id = g.school_id
    # Conversation thread = inbound FROM the phone + outbound TO the phone.
    thread = (
        WhatsAppMessage.query.filter(
            WhatsAppMessage.school_id == school_id,
            (
                (WhatsAppMessage.direction == "inbound")
                & (sa_func.lower(WhatsAppMessage.from_phone) == phone.lower())
            )
            | (
                (WhatsAppMessage.direction == "outbound")
                & (sa_func.lower(WhatsAppMessage.to_phone) == phone.lower())
            ),
        )
        .order_by(WhatsAppMessage.created_at.asc(), WhatsAppMessage.id.asc())
        .all()
    )
    handled_ids = _handled_inbound_ids(school_id, phones=[phone])

    return success_response([
        {
            "id": str(m.id),
            "direction": m.direction,
            "content": m.content,
            "message_type": m.message_type,
            "media_url": m.media_url,
            "status": m.status,
            "is_bot_reply": bool(m.is_bot_reply),
            "bot_command": m.bot_command,
            "handled": str(m.id) in handled_ids if m.direction == "inbound" else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in thread
    ])


# ── Analytics (E213) ─────────────────────────────────────────────────────


@whatsapp_bot_bp.route("/analytics", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
def get_analytics():
    """Real counts from whatsapp_messages — no synthetic numbers.

    Returns per-day inbound/outbound for the last 14 days, the share of
    inbound messages that were handled (a reply exists), and the top senders.
    """
    from datetime import datetime, timedelta

    from app.models.notification import WhatsAppMessage

    school_id = g.school_id
    days = min(max(int(request.args.get("days", 14) or 14), 1), 90)
    since = datetime.utcnow() - timedelta(days=days)

    daily = (
        WhatsAppMessage.query.filter(
            WhatsAppMessage.school_id == school_id,
            WhatsAppMessage.created_at >= since,
        )
        .with_entities(
            sa_func.date(WhatsAppMessage.created_at).label("day"),
            WhatsAppMessage.direction,
            sa_func.count(WhatsAppMessage.id),
        )
        .group_by(sa_func.date(WhatsAppMessage.created_at), WhatsAppMessage.direction)
        .all()
    )
    by_day: dict = {}
    for day, direction, count in daily:
        key = day.isoformat() if hasattr(day, "isoformat") else str(day)
        entry = by_day.setdefault(key, {"date": key, "inbound": 0, "outbound": 0})
        entry["inbound" if direction == "inbound" else "outbound"] = int(count or 0)
    timeline = [by_day[key] for key in sorted(by_day)]

    # Handled share over the same window (derived, see _inbound_with_reply_exists).
    inbound, reply_exists = _inbound_with_reply_exists()
    inbound_14d = int(
        db.session.query(sa_func.count(inbound.id))
        .filter(
            inbound.school_id == school_id,
            inbound.direction == "inbound",
            inbound.created_at >= since,
        )
        .scalar()
        or 0
    )
    handled_14d = int(
        db.session.query(sa_func.count(inbound.id))
        .filter(
            inbound.school_id == school_id,
            inbound.direction == "inbound",
            inbound.created_at >= since,
            reply_exists,
        )
        .scalar()
        or 0
    )

    sender_rows = (
        WhatsAppMessage.query.filter(
            WhatsAppMessage.school_id == school_id,
            WhatsAppMessage.direction == "inbound",
        )
        .with_entities(
            WhatsAppMessage.from_phone,
            sa_func.count(WhatsAppMessage.id),
            sa_func.max(WhatsAppMessage.created_at),
        )
        .group_by(WhatsAppMessage.from_phone)
        .order_by(sa_func.count(WhatsAppMessage.id).desc())
        .limit(5)
        .all()
    )
    sender_phones = [r[0] for r in sender_rows]
    handled_by_phone = {}
    if sender_phones:
        inbound_h, reply_exists_h = _inbound_with_reply_exists()
        handled_by_phone = dict(
            db.session.query(inbound_h.from_phone, sa_func.count(inbound_h.id))
            .filter(
                inbound_h.school_id == school_id,
                inbound_h.direction == "inbound",
                inbound_h.from_phone.in_(sender_phones),
                reply_exists_h,
            )
            .group_by(inbound_h.from_phone)
            .all()
        )
    top_senders = [
        {
            "phone": phone,
            "inbound_count": int(count or 0),
            "handled_count": int(handled_by_phone.get(phone, 0) or 0),
            "last_message_at": last.isoformat() if last else None,
        }
        for phone, count, last in sender_rows
    ]

    totals = dict(
        WhatsAppMessage.query.filter(WhatsAppMessage.school_id == school_id)
        .with_entities(WhatsAppMessage.direction, sa_func.count(WhatsAppMessage.id))
        .group_by(WhatsAppMessage.direction)
        .all()
    )
    return success_response({
        "days": days,
        "timeline": timeline,
        "inbound_last_window": inbound_14d,
        "handled_last_window": handled_14d,
        "handled_pct_last_window": round(handled_14d / inbound_14d * 100, 1) if inbound_14d else None,
        "totals": {
            "inbound": int(totals.get("inbound", 0) or 0),
            "outbound": int(totals.get("outbound", 0) or 0),
        },
        "top_senders": top_senders,
    })


@whatsapp_bot_bp.route("/send", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin", "teacher")
def send_message():
    """Send a WhatsApp message to a specific number."""
    from app.models.notification import WhatsAppMessage
    from app.services.communications.whatsapp_cloud import WhatsAppCloudService

    data = request.get_json(silent=True) or {}
    to = data.get("to")
    message = data.get("message")

    if not to or not message:
        return error_response("'to' and 'message' are required", 400)

    result = WhatsAppCloudService.send_text(to, message)

    # E210: record the outbound send so manual replies appear in the
    # Conversations view (and count as "handled" replies). Skipped sends
    # (WhatsApp not configured) are NOT recorded — nothing was delivered.
    if not result.get("skipped"):
        wa_id = None
        if isinstance(result.get("messages"), list) and result["messages"]:
            wa_id = result["messages"][0].get("id")
        db.session.add(WhatsAppMessage(
            school_id=g.school_id,
            to_phone=to,
            direction="outbound",
            message_type="text",
            content=message,
            wa_message_id=wa_id,
            status="failed" if result.get("error") else "sent",
        ))
        db.session.commit()

    return success_response(result)


@whatsapp_bot_bp.route("/send-bulk", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin")
def send_bulk_message():
    """Send bulk WhatsApp messages."""
    from app.services.communications.whatsapp_cloud import WhatsAppCloudService

    data = request.get_json(silent=True) or {}
    numbers = data.get("numbers", [])
    message = data.get("message", "")
    template = data.get("template")

    results = []
    for number in numbers:
        if template:
            r = WhatsAppCloudService.send_template(number, template)
        else:
            r = WhatsAppCloudService.send_text(number, message)
        results.append({"to": number, "result": r})

    return success_response({
        "total": len(numbers),
        "results": results,
    })
