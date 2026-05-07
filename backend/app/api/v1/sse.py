"""Plan-compatible Server-Sent Events endpoint."""

from flask import Blueprint, Response, g
from flask_jwt_extended import jwt_required

from app.utils.decorators import school_required

sse_bp = Blueprint("sse", __name__, url_prefix="/sse")


@sse_bp.route("/events", methods=["GET"])
@jwt_required()
@school_required
def events():
    def generate():
        yield "event: ready\n"
        yield f"data: {{\"school_id\": \"{g.school_id}\", \"status\": \"connected\"}}\n\n"
        yield "event: heartbeat\n"
        yield "data: {\"ok\": true}\n\n"

    return Response(generate(), mimetype="text/event-stream")
