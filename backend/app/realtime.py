"""Socket.IO realtime handlers.

Registers school-scoped rooms so browsers receive live events pushed by
backend workers (gps_update, emergency_alert, notifications, ...).

Frontend contract (frontend/lib/socket.ts):
    socket.emit("join_school",  { school_id: "<uuid>" })
    socket.emit("leave_school", { school_id: "<uuid>" })
"""
import logging

from flask import request
from flask_socketio import join_room, leave_room

from extensions import socketio

logger = logging.getLogger(__name__)


def _room(school_id: str) -> str:
    return f"school-{school_id}"


@socketio.on("join_school")
def on_join_school(data):
    school_id = (data or {}).get("school_id")
    if not school_id:
        return {"success": False, "error": "school_id is required"}
    join_room(_room(str(school_id)))
    logger.debug("client %s joined room %s", request.sid, _room(str(school_id)))
    return {"success": True}


@socketio.on("leave_school")
def on_leave_school(data):
    school_id = (data or {}).get("school_id")
    if not school_id:
        return {"success": False, "error": "school_id is required"}
    leave_room(_room(str(school_id)))
    logger.debug("client %s left room %s", request.sid, _room(str(school_id)))
    return {"success": True}
