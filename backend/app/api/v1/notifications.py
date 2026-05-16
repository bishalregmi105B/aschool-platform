"""Notification Center API — in-app notifications with read/unread tracking.

Provides the backend for the notification bell icon in both the
dashboard and the Flutter mobile apps.
"""
from datetime import datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.notification import InAppNotification
from app.utils.decorators import school_required
from app.utils.pagination import paginate
from app.utils.response import error_response, success_response
from extensions import db

notifications_bp = Blueprint("notifications", __name__, url_prefix="/notifications")


@notifications_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def list_notifications():
    """List in-app notifications for the current user.

    Query params:
        - unread_only: if "true", only return unread notifications
        - category: filter by category (attendance, fee, notice, exam, system)
        - limit: max results (default 50)
    """
    user_id = get_jwt_identity()

    query = InAppNotification.query.filter_by(
        school_id=g.school_id,
        user_id=user_id,
        is_deleted=False,
    )

    if request.args.get("unread_only", "").lower() == "true":
        query = query.filter_by(is_read=False)

    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)

    query = query.order_by(InAppNotification.created_at.desc())
    items, meta = paginate(query, default_per_page=50)

    return success_response(
        [_notification_dict(n) for n in items],
        meta={"pagination": meta},
    )


@notifications_bp.route("/unread-count", methods=["GET"])
@jwt_required()
@school_required
def unread_count():
    """Return the count of unread notifications (for badge display)."""
    user_id = get_jwt_identity()

    count = InAppNotification.query.filter_by(
        school_id=g.school_id,
        user_id=user_id,
        is_read=False,
        is_deleted=False,
    ).count()

    return success_response({"unread_count": count})


@notifications_bp.route("/<uuid:notification_id>/read", methods=["POST"])
@jwt_required()
@school_required
def mark_read(notification_id):
    """Mark a single notification as read."""
    user_id = get_jwt_identity()

    notification = InAppNotification.query.filter_by(
        id=notification_id,
        user_id=user_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()

    if not notification:
        return error_response("Notification not found", 404)

    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    db.session.commit()

    return success_response(_notification_dict(notification))


@notifications_bp.route("/mark-all-read", methods=["POST"])
@jwt_required()
@school_required
def mark_all_read():
    """Mark all notifications as read for the current user."""
    user_id = get_jwt_identity()

    updated = (
        InAppNotification.query.filter_by(
            school_id=g.school_id,
            user_id=user_id,
            is_read=False,
            is_deleted=False,
        )
        .update(
            {"is_read": True, "read_at": datetime.now(timezone.utc)},
            synchronize_session=False,
        )
    )
    db.session.commit()

    return success_response({"marked_read": updated})


@notifications_bp.route("/<uuid:notification_id>", methods=["DELETE"])
@jwt_required()
@school_required
def delete_notification(notification_id):
    """Soft-delete a notification."""
    user_id = get_jwt_identity()

    notification = InAppNotification.query.filter_by(
        id=notification_id,
        user_id=user_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()

    if not notification:
        return error_response("Notification not found", 404)

    notification.soft_delete()
    return success_response({"deleted": True})


# ── Helper to create notifications from other modules ───────────────────


def create_notification(
    school_id: str,
    user_id: str,
    title: str,
    body: str,
    category: str = "general",
    priority: str = "normal",
    data: dict | None = None,
    action_url: str | None = None,
) -> InAppNotification:
    """Create an in-app notification entry.

    This should be called alongside push notifications so users can
    review missed notifications in the dashboard.
    """
    notification = InAppNotification(
        school_id=school_id,
        user_id=user_id,
        title=title,
        body=body,
        category=category,
        priority=priority,
        data=data or {},
        action_url=action_url,
    )
    db.session.add(notification)
    db.session.commit()
    return notification


# ── Serializer ──────────────────────────────────────────────────────────


def _notification_dict(n: InAppNotification) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "body": n.body,
        "category": n.category,
        "priority": n.priority,
        "data": n.data or {},
        "is_read": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "action_url": n.action_url,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
