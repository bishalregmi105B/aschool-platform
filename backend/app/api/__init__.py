"""Core API v1 blueprint."""
from flask import Blueprint

api_v1_bp = Blueprint("api_v1", __name__)


@api_v1_bp.route("/health")
def api_health():
    return {"success": True, "data": {"service": "aschool-api", "version": "1.0.0"}}
