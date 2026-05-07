"""WhatsApp Bot API — chatbot config, auto-replies, conversation management."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

whatsapp_bot_bp = Blueprint("whatsapp_bot", __name__, url_prefix="/whatsapp-bot")


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

    rules = config.auto_replies or []
    rules.append({
        "keyword": data.get("keyword", ""),
        "response": data.get("response", ""),
        "match_type": data.get("match_type", "contains"),  # exact, contains, regex
    })
    config.auto_replies = rules
    db.session.commit()
    return created_response({"total_rules": len(rules)})


@whatsapp_bot_bp.route("/send", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin", "teacher")
def send_message():
    """Send a WhatsApp message to a specific number."""
    from app.services.communications.whatsapp_cloud import WhatsAppCloudService

    data = request.get_json(silent=True) or {}
    to = data.get("to")
    message = data.get("message")

    if not to or not message:
        return error_response("'to' and 'message' are required", 400)

    result = WhatsAppCloudService.send_text(to, message)
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
