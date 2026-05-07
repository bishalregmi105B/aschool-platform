"""Plan-compatible webhook catalog under API v1."""

from flask import Blueprint, current_app
from flask_jwt_extended import jwt_required

from app.utils.decorators import superadmin_required
from app.utils.response import success_response

webhooks_v1_bp = Blueprint("webhooks_v1", __name__, url_prefix="/webhooks")


@webhooks_v1_bp.route("", methods=["GET"])
@jwt_required()
@superadmin_required
def catalog():
    base = current_app.config.get("PUBLIC_API_BASE_URL", "").rstrip("/")
    return success_response(
        {
            "payment": {
                "esewa": f"{base}/webhooks/esewa/callback" if base else "/webhooks/esewa/callback",
                "khalti": f"{base}/webhooks/khalti/callback" if base else "/webhooks/khalti/callback",
                "fonepay": f"{base}/webhooks/fonepay/callback" if base else "/webhooks/fonepay/callback",
            },
            "communications": {
                "whatsapp": f"{base}/webhooks/whatsapp" if base else "/webhooks/whatsapp",
            },
        }
    )
