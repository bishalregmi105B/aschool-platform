"""Socket.IO realtime handlers.

Registers school-scoped rooms so browsers receive live events pushed by
backend workers (gps_update, emergency_alert, notifications, ...).

Security contract (S-07): a socket connection is authenticated at
handshake — no token, no connection. `join_school` ignores any
client-supplied school_id and joins only the authenticated session's
school (superadmins may target an explicit school).

Frontend contract (frontend/lib/socket.ts):
    socket = io(SOCKET_URL, { withCredentials: true })  # cookie auth
    socket.emit("join_school", { school_id: "<uuid>" })  # value is advisory

Flutter contract (aschool_shared socket_service):
    socket.setAuth({'token': '<access_token>'})          # auth-payload auth
"""
import logging
from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import disconnect, join_room, leave_room

from extensions import socketio

logger = logging.getLogger(__name__)

# Per-connection auth state, keyed by socket sid (S-07). Kept in-process
# instead of flask.session — Flask 3.1 made RequestContext.session
# read-only, breaking flask-socketio's managed sessions, and a socket's
# events only ever arrive on the worker that owns the connection.
_sessions: dict[str, dict] = {}


def _room(school_id: str) -> str:
    return f"school-{school_id}"


def _extract_token(auth) -> str | None:
    """Token from the socket.io auth payload, Authorization header, or the
    HttpOnly access cookie (in that order)."""
    if isinstance(auth, dict):
        token = auth.get("token") or auth.get("access_token")
        if token:
            return str(token).strip() or None
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header.split(None, 1)[1].strip()
    return request.cookies.get("access_token")


@socketio.on("connect")
def on_connect(auth=None):
    """Authenticate at handshake; reject unauthenticated connections.

    Mirrors the HTTP guards: valid JWT, live non-deleted user, iat not
    before the user's tokens_invalid_before (logout-all / password change).
    """
    token = _extract_token(auth)
    if not token:
        return False

    try:
        claims = decode_token(token)
    except Exception:
        return False

    from app.models.user import User

    identity = claims.get("sub")
    user = None
    if identity:
        try:
            user = User.query.filter_by(id=identity, is_deleted=False).first()
        except Exception:
            user = None
    if not user or not user.is_active:
        return False

    iat = claims.get("iat")
    invalid_before = user.tokens_invalid_before
    if iat and invalid_before:
        if invalid_before.tzinfo is None:
            invalid_before = invalid_before.replace(tzinfo=timezone.utc)
        if datetime.fromtimestamp(int(iat), tz=timezone.utc) < invalid_before:
            return False

    school_id = claims.get("school_id") or (
        str(user.school_id) if user.school_id else None
    )
    _sessions[str(request.sid)] = {
        "school_id": str(school_id) if school_id else None,
        "role": claims.get("role"),
        "user_id": str(user.id),
    }
    logger.debug(
        "socket %s authenticated (user=%s school=%s)", request.sid, user.id, school_id
    )
    return True


@socketio.on("join_school")
def on_join_school(data):
    """Join this connection's school room. The client-supplied school_id is
    never trusted — except for superadmins, whose scoping is platform-wide
    (the explicit school must still exist)."""
    data = data or {}
    state = _sessions.get(str(request.sid)) or {}
    role = state.get("role")
    session_school = state.get("school_id")
    requested = data.get("school_id")

    if role == "superadmin":
        target = str(requested) if requested else session_school
        if not target:
            return {"success": False, "error": "school_id is required"}
        from app.models.school import School

        if not School.query.filter_by(id=target).first():
            return {"success": False, "error": "Unknown school"}
    elif session_school:
        if requested and str(requested) != session_school:
            return {"success": False, "error": "Forbidden"}
        target = session_school
    else:
        return {"success": False, "error": "Not authorized"}

    join_room(_room(target))
    logger.debug("socket %s joined room %s", request.sid, _room(target))
    return {"success": True, "school_id": target}


@socketio.on("leave_school")
def on_leave_school(data):
    data = data or {}
    state = _sessions.get(str(request.sid)) or {}
    role = state.get("role")
    session_school = state.get("school_id")
    requested = data.get("school_id")

    if role == "superadmin":
        target = str(requested) if requested else session_school
    elif session_school:
        if requested and str(requested) != session_school:
            return {"success": False, "error": "Forbidden"}
        target = session_school
    else:
        return {"success": False, "error": "Not authorized"}

    if target:
        leave_room(_room(target))
    return {"success": True}


@socketio.on("disconnect")
def on_disconnect(*args):
    _sessions.pop(str(request.sid), None)
    logger.debug("socket %s disconnected", request.sid)
