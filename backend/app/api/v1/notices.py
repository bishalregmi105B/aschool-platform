"""Notices & Events plugin API."""
import bleach
from datetime import date, datetime, time, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.notice import Notice, Event
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

notices_bp = Blueprint("notices", __name__, url_prefix="/notices")

# nepali_datetime only covers roughly BS 1975-2100 (AD ~1918-2044); a date
# outside that range must be rejected with a 400 on write, and a row that
# already carries such a date (legacy/bad data) must not 500 the whole list
# serializer — see _bs_or_none.
_BS_MIN_AD = (1918, 1, 1)
_BS_MAX_AD = (2044, 12, 31)


def _bs_in_range(d: date) -> bool:
    return (_BS_MIN_AD <= (d.year, d.month, d.day) <= _BS_MAX_AD) if d else True


def _bs_or_none(ad_date):
    """ad_to_bs that degrades to None instead of OverflowError on bad rows."""
    if not ad_date:
        return None
    try:
        return ad_to_bs(ad_date)
    except (OverflowError, ValueError):
        return None


# ── Notices ────────────────────────────────────────────────


@notices_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("notices")
def list_notices():
    """List notices for the current school."""
    query = Notice.query.filter_by(school_id=g.school_id, is_deleted=False)

    notice_type = request.args.get("type")
    if notice_type:
        # E127: notice_type is a Postgres enum — an unknown value used to
        # reach the DB and surface as an unhandled DataError 500. Unknown
        # types simply match nothing.
        if notice_type not in ("general", "academic", "event", "holiday", "urgent"):
            return success_response([])
        query = query.filter_by(notice_type=notice_type)

    target = request.args.get("target_role")
    if target:
        query = query.filter(Notice.target_audience.any(target))

    is_published = request.args.get("is_published")
    if is_published is not None:
        wants_published = is_published.lower() == "true"
        if wants_published:
            query = query.filter(Notice.published_at.isnot(None))
        else:
            query = query.filter(Notice.published_at.is_(None))

    query = query.order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
    items, meta = paginate(query)
    return success_response([_notice_dict(n) for n in items], meta={"pagination": meta})


@notices_bp.route("/<uuid:notice_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("notices")
def get_notice(notice_id):
    """Get a single notice."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.is_deleted or str(notice.school_id) != str(g.school_id):
        return error_response("Notice not found", 404)
    return success_response(_notice_dict(notice))


@notices_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("school_admin", "teacher", "staff")
def create_notice():
    """Create a new notice."""
    data = request.get_json(silent=True) or {}
    required = ["title", "content"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", 400)

    notice = Notice(
        school_id=g.school_id,
        created_by_id=get_jwt_identity(),
    )
    _populate_notice(notice, data)
    db.session.add(notice)
    db.session.commit()

    # Emit event
    from app.plugins.events import emit
    emit("notice.created", school_id=str(g.school_id), notice_id=str(notice.id))

    return created_response(_notice_dict(notice))


@notices_bp.route("/<uuid:notice_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("school_admin", "teacher", "staff")
def update_notice(notice_id):
    """Update a notice."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.is_deleted or str(notice.school_id) != str(g.school_id):
        return error_response("Notice not found", 404)

    data = request.get_json(silent=True) or {}
    _populate_notice(notice, data)
    db.session.commit()
    return success_response(_notice_dict(notice))


@notices_bp.route("/<uuid:notice_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("school_admin")
def delete_notice(notice_id):
    """Delete a notice."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.is_deleted or str(notice.school_id) != str(g.school_id):
        return error_response("Notice not found", 404)
    notice.soft_delete()
    return no_content_response()


# ── Events ─────────────────────────────────────────────────


@notices_bp.route("/events", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("notices")
def list_events():
    """List school events."""
    query = Event.query.filter_by(school_id=g.school_id, is_deleted=False)

    event_type = request.args.get("type")
    if event_type:
        query = query.filter_by(event_type=event_type)

    query = query.order_by(Event.start_date.asc())
    items, meta = paginate(query)
    return success_response([_event_dict(e) for e in items], meta={"pagination": meta})


@notices_bp.route("/events", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("school_admin", "teacher", "staff")
def create_event():
    """Create a school event."""
    data = request.get_json(silent=True) or {}
    # title/start_date are NOT NULL columns — 400 up front, not a 500.
    missing = [f for f in ("title", "start_date") if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", 400)
    event = Event(
        school_id=g.school_id,
        created_by_id=get_jwt_identity(),
    )
    _populate_event(event, data)
    if not event.start_date:
        return error_response("start_date must be a valid ISO date", 400)
    bad = [f for f, d in (("start_date", event.start_date), ("end_date", event.end_date))
           if d and not _bs_in_range(d)]
    if bad:
        db.session.rollback()
        return error_response(
            f"{', '.join(bad)} is outside the supported BS calendar range "
            f"(AD 1918-2044)", 400,
        )
    db.session.add(event)
    db.session.commit()
    return created_response(_event_dict(event))


@notices_bp.route("/events/<uuid:event_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("school_admin", "teacher", "staff")
def update_event(event_id):
    """Update a school event."""
    event = Event.query.get(event_id)
    if not event or event.is_deleted or str(event.school_id) != str(g.school_id):
        return error_response("Event not found", 404)
    data = request.get_json(silent=True) or {}
    _populate_event(event, data)
    if "start_date" in data and not event.start_date:
        return error_response("start_date must be a valid ISO date", 400)
    bad = [f for f, d in (("start_date", event.start_date), ("end_date", event.end_date))
           if d and not _bs_in_range(d)]
    if bad:
        db.session.rollback()
        return error_response(
            f"{', '.join(bad)} is outside the supported BS calendar range "
            f"(AD 1918-2044)", 400,
        )
    db.session.commit()
    return success_response(_event_dict(event))


@notices_bp.route("/events/<uuid:event_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("school_admin")
def delete_event(event_id):
    """Delete a school event."""
    event = Event.query.get(event_id)
    if not event or event.is_deleted or str(event.school_id) != str(g.school_id):
        return error_response("Event not found", 404)
    event.soft_delete()
    return no_content_response()


# ── Helpers ────────────────────────────────────────────────


def _sanitize_html(value: str) -> str:
    """Strip dangerous tags; allow a safe subset for rich text."""
    allowed_tags = [
        "b", "strong", "i", "em", "u", "s", "p", "br", "ul", "ol", "li",
        "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "span",
    ]
    allowed_attrs = {"a": ["href", "title", "target"], "span": ["class"]}
    return bleach.clean(value or "", tags=allowed_tags, attributes=allowed_attrs, strip=True)


def _populate_notice(notice, data):
    for key in (
        "title",
        "title_nepali",
        "notice_type",
        "is_pinned",
        "expires_at",
        "attachment_urls",
    ):
        if key in data:
            setattr(notice, key, data[key])

    if "content" in data:
        notice.content = _sanitize_html(data["content"])
    if "content_nepali" in data:
        notice.content_nepali = _sanitize_html(data.get("content_nepali") or "")

    if "target_roles" in data:
        notice.target_audience = data.get("target_roles") or []
    elif "target_audience" in data:
        notice.target_audience = data.get("target_audience") or []

    if "publish_at" in data:
        notice.published_at = data.get("publish_at")
    elif "published_at" in data:
        notice.published_at = data.get("published_at")
    elif "is_published" in data:
        notice.published_at = datetime.now(timezone.utc) if data.get("is_published") else None


def _populate_event(event, data):
    for key in ("title", "title_nepali", "description", "event_type",
                "location", "is_all_day", "color"):
        if key in data:
            setattr(event, key, data[key])
    if "start_date" in data:
        event.start_date = _parse_date(data.get("start_date"))
    if "end_date" in data:
        event.end_date = _parse_date(data.get("end_date"))
    if "start_time" in data:
        event.start_time = _parse_time(data.get("start_time"))
    if "end_time" in data:
        event.end_time = _parse_time(data.get("end_time"))
    if data.get("is_holiday"):
        event.event_type = "holiday"


def _notice_dict(n):
    return {
        "id": str(n.id),
        "title": n.title,
        "title_nepali": getattr(n, "title_nepali", None),
        "content": n.content,
        "notice_type": getattr(n, "notice_type", None),
        "target_roles": getattr(n, "target_audience", []) or [],
        "is_pinned": getattr(n, "is_pinned", False),
        "is_published": bool(getattr(n, "published_at", None)),
        "published_at": n.published_at.isoformat() if getattr(n, "published_at", None) else None,
        "author_id": str(n.created_by_id) if getattr(n, "created_by_id", None) else None,
        "author_name": n.created_by.full_name if getattr(n, "created_by", None) else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _event_dict(e):
    return {
        "id": str(e.id),
        "title": e.title,
        "title_nepali": getattr(e, "title_nepali", None),
        "description": getattr(e, "description", None),
        "event_type": getattr(e, "event_type", None),
        "start_date": str(e.start_date) if e.start_date else None,
        "end_date": str(e.end_date) if e.end_date else None,
        "start_date_bs": _bs_or_none(e.start_date),
        "end_date_bs": _bs_or_none(e.end_date),
        "location": getattr(e, "location", None),
        "is_all_day": getattr(e, "is_all_day", True),
        "color": getattr(e, "color", None),
        "is_holiday": getattr(e, "event_type", None) == "holiday",
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _parse_time(value):
    if not value:
        return None
    if isinstance(value, time):
        return value
    text = str(value).strip()
    if len(text.split(":")) == 2:
        text = f"{text}:00"
    try:
        return time.fromisoformat(text)
    except (TypeError, ValueError):
        return None
