"""Communications API — dashboard stats, templates, and broadcast sending."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import func

from app.models.fee import FeeCollection
from app.models.diary import DiaryCategory, DiaryEntry
from app.models.notification import NotificationTemplate, SMSLog
from app.models.notice import Notice
from app.models.student import Guardian, Student
from app.models.user import User
from app.services.chat_service import (
    contact_payload,
    list_contact_users,
    list_messages as list_chat_messages,
    message_payload,
    parse_user_id,
    send_message as persist_chat_message,
)
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

communications_bp = Blueprint("communications", __name__, url_prefix="/communications")


@communications_bp.route("/contacts", methods=["GET"])
@jwt_required()
@school_required
def list_chat_contacts():
    current_user_id = parse_user_id(get_jwt_identity())
    if not current_user_id:
        return error_response("Valid user identity is required", 401)

    role = get_jwt().get("role")
    contacts = list_contact_users(g.school_id, current_user_id, role)
    return success_response(
        [contact_payload(g.school_id, current_user_id, contact) for contact in contacts]
    )


@communications_bp.route("/messages/<uuid:user_id>", methods=["GET"])
@jwt_required()
@school_required
def get_chat_messages(user_id):
    current_user_id = parse_user_id(get_jwt_identity())
    if not current_user_id:
        return error_response("Valid user identity is required", 401)

    target = User.query.filter_by(
        id=user_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not target:
        return error_response("Chat contact not found", 404)

    try:
        _, messages = list_chat_messages(
            g.school_id,
            current_user_id,
            user_id,
            mark_read=True,
        )
    except ValueError as exc:
        return error_response(str(exc), 400)

    return success_response([message_payload(message, current_user_id) for message in messages])


@communications_bp.route("/send", methods=["POST"])
@jwt_required()
@school_required
def send_chat_message():
    current_user_id = parse_user_id(get_jwt_identity())
    if not current_user_id:
        return error_response("Valid user identity is required", 401)

    data = request.get_json(silent=True) or {}
    receiver_id = parse_user_id(data.get("receiver_id"))
    content = (data.get("message") or data.get("content") or "").strip()
    file_url = (data.get("file_url") or "").strip() or None
    file_type = (data.get("file_type") or "").strip() or None
    if not receiver_id:
        return error_response("receiver_id is required", 400)
    if not content and not file_url:
        return error_response("message or file_url is required", 400)

    target = User.query.filter_by(
        id=receiver_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not target:
        return error_response("Chat contact not found", 404)

    try:
        message = persist_chat_message(
            g.school_id,
            current_user_id,
            receiver_id,
            content or file_type or "Attachment",
            file_url=file_url,
            file_type=file_type,
        )
    except ValueError as exc:
        return error_response(str(exc), 400)

    return created_response(message_payload(message, current_user_id))


@communications_bp.route("/stats", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
def get_stats():
    total_messages = (
        db.session.query(func.count(SMSLog.id))
        .filter_by(school_id=g.school_id, is_deleted=False)
        .scalar()
        or 0
    )
    templates_count = (
        db.session.query(func.count(NotificationTemplate.id))
        .filter_by(school_id=g.school_id, is_deleted=False)
        .scalar()
        or 0
    )
    notices_count = (
        db.session.query(func.count(Notice.id))
        .filter_by(school_id=g.school_id, is_deleted=False)
        .scalar()
        or 0
    )
    parents_reached = (
        db.session.query(func.count(func.distinct(SMSLog.to_phone)))
        .filter_by(school_id=g.school_id, is_deleted=False)
        .scalar()
        or 0
    )

    return success_response(
        {
            "total_messages": total_messages,
            "broadcasts_sent": total_messages,
            "templates_count": templates_count,
            "notices_count": notices_count,
            "parents_reached": parents_reached,
        }
    )


@communications_bp.route("/templates", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
def list_templates():
    templates = (
        NotificationTemplate.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(NotificationTemplate.created_at.desc())
        .all()
    )
    return success_response([_template_dict(template) for template in templates])


@communications_bp.route("/templates", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
@role_required("superadmin", "school_admin")
def create_template():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    content = (data.get("content") or "").strip()

    if not name or not content:
        return error_response("name and content are required")

    template = NotificationTemplate(
        school_id=g.school_id,
        name=name,
        channel=data.get("channel", "sms"),
        template_en=content,
        template_ne=data.get("content_ne"),
        variables={
            "category": data.get("category", "general"),
            "subject": data.get("subject"),
            "variables": data.get("variables", []),
        },
        is_active=data.get("is_active", True),
    )
    db.session.add(template)
    db.session.commit()
    return created_response(_template_dict(template))


@communications_bp.route("/templates/<uuid:template_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
@role_required("superadmin", "school_admin")
def delete_template(template_id):
    template = NotificationTemplate.query.filter_by(
        id=template_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not template:
        return error_response("Template not found", 404)

    template.is_deleted = True
    db.session.commit()
    return success_response({"deleted": True})


@communications_bp.route("/broadcast", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("sms_notifications")
@role_required("superadmin", "school_admin")
def send_broadcast():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return error_response("message is required")

    channel = data.get("channel", "sms")
    audience = data.get("audience", "all_parents")
    class_id = data.get("class_id")

    recipients = _phones_for_audience(audience, class_id)
    if not recipients:
        return success_response(
            {
                "queued": 0,
                "recipients": 0,
                "channel": channel,
                "audience": audience,
            }
        )

    if channel != "sms":
        return success_response(
            {
                "queued": 0,
                "recipients": len(recipients),
                "channel": channel,
                "audience": audience,
                "status": "accepted",
            }
        )

    logs = []
    payload = []
    for phone in recipients:
        log = SMSLog(
            school_id=g.school_id,
            to_phone=phone,
            message=message,
            template_name=data.get("subject") or audience,
            status="queued",
            sent_by_id=getattr(getattr(g, "current_user", None), "id", None),
        )
        db.session.add(log)
        logs.append(log)
        payload.append({"phone": phone, "message": message})

    db.session.commit()

    from app.tasks.sms_sender import send_bulk_sms

    send_bulk_sms.delay(payload)

    return created_response(
        {
            "queued": len(logs),
            "recipients": len(recipients),
            "channel": channel,
            "audience": audience,
            "log_ids": [str(log.id) for log in logs],
        }
    )


@communications_bp.route("/diary/categories", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("notices")
def list_diary_categories():
    query = DiaryCategory.query.filter_by(school_id=g.school_id, is_deleted=False)
    active = request.args.get("active")
    if active is not None:
        query = query.filter_by(active=active.lower() == "true")
    categories = query.order_by(DiaryCategory.name).all()
    return success_response([_diary_category_dict(category) for category in categories])


@communications_bp.route("/diary/categories", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("superadmin", "school_admin", "teacher")
def create_diary_category():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return error_response("name is required", 400)

    category = DiaryCategory(
        school_id=g.school_id,
        name=name,
        color=(data.get("color") or "blue").strip(),
        active=data.get("active", True),
    )
    db.session.add(category)
    db.session.commit()
    return created_response(_diary_category_dict(category))


@communications_bp.route("/diary/categories/<uuid:category_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("superadmin", "school_admin", "teacher")
def update_diary_category(category_id):
    category = DiaryCategory.query.filter_by(
        id=category_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not category:
        return error_response("Diary category not found", 404)

    data = request.get_json(silent=True) or {}
    for key in ("name", "color", "active"):
        if key in data:
            setattr(category, key, data[key])
    db.session.commit()
    return success_response(_diary_category_dict(category))


@communications_bp.route("/diary/categories/<uuid:category_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("superadmin", "school_admin", "teacher")
def delete_diary_category(category_id):
    category = DiaryCategory.query.filter_by(
        id=category_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not category:
        return error_response("Diary category not found", 404)

    category.soft_delete()
    return success_response({"deleted": True})


@communications_bp.route("/diary", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("notices")
def list_diary_entries():
    query = DiaryEntry.query.filter_by(school_id=g.school_id, is_deleted=False)
    for key in ("student_id", "class_id", "section_id", "category_id"):
        value = request.args.get(key)
        if value:
            parsed = _parse_uuid(value)
            if not parsed:
                return error_response(f"Invalid {key}", 400)
            query = query.filter(getattr(DiaryEntry, key) == parsed)
    entries = query.order_by(DiaryEntry.entry_date.desc(), DiaryEntry.created_at.desc()).all()
    return success_response([_diary_entry_dict(entry) for entry in entries])


@communications_bp.route("/diary", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("notices")
@role_required("superadmin", "school_admin", "teacher")
def create_diary_entry():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    if not title or not content:
        return error_response("title and content are required", 400)

    entry = DiaryEntry(
        school_id=g.school_id,
        title=title,
        content=content,
        category_id=_parse_uuid(data.get("category_id")),
        student_id=_parse_uuid(data.get("student_id")),
        class_id=_parse_uuid(data.get("class_id")),
        section_id=_parse_uuid(data.get("section_id")),
        entry_date=_parse_date(data.get("entry_date")) or date.today(),
        attachment_urls=data.get("attachment_urls") or [],
        created_by_id=getattr(getattr(g, "current_user", None), "id", None),
        is_published=data.get("is_published", True),
    )
    db.session.add(entry)
    db.session.commit()
    return created_response(_diary_entry_dict(entry))


def _phones_for_audience(audience: str, class_id: str | None) -> list[str]:
    if audience == "all_parents":
        parent_users = _user_phones(["parent"])
        guardian_phones = _guardian_phones()
        return _dedupe_phones(parent_users + guardian_phones)

    if audience == "class_parents":
        return _guardian_phones(class_id)

    if audience == "all_students":
        return _user_phones(["student"])

    if audience == "all_staff":
        return _user_phones(["school_admin", "accountant", "teacher", "staff"])

    if audience == "fee_defaulters":
        return _fee_defaulter_phones()

    return _user_phones(["parent"])


def _user_phones(roles: list[str]) -> list[str]:
    users = (
        User.query.filter(
            User.school_id == g.school_id,
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.role.in_(roles),
            User.phone.isnot(None),
        )
        .all()
    )
    return _dedupe_phones(user.phone for user in users)


def _guardian_phones(class_id: str | None = None) -> list[str]:
    query = Guardian.query.join(Student, Guardian.student_id == Student.id).filter(
        Guardian.school_id == g.school_id,
        Guardian.is_deleted.is_(False),
        Student.is_deleted.is_(False),
        Guardian.phone.isnot(None),
    )

    if class_id:
        try:
            query = query.filter(Student.class_id == UUID(class_id))
        except (TypeError, ValueError):
            return []

    guardians = query.all()
    return _dedupe_phones(guardian.phone for guardian in guardians)


def _fee_defaulter_phones() -> list[str]:
    guardians = (
        Guardian.query.join(Student, Guardian.student_id == Student.id)
        .join(FeeCollection, FeeCollection.student_id == Student.id)
        .filter(
            Guardian.school_id == g.school_id,
            Guardian.is_deleted.is_(False),
            Student.is_deleted.is_(False),
            FeeCollection.is_deleted.is_(False),
            FeeCollection.payment_status.in_(("pending", "partial")),
            Guardian.phone.isnot(None),
        )
        .all()
    )
    return _dedupe_phones(guardian.phone for guardian in guardians)


def _dedupe_phones(phones) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for phone in phones:
        value = (phone or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        cleaned.append(value)
    return cleaned


def _parse_uuid(value):
    if not value:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _template_dict(template: NotificationTemplate) -> dict:
    metadata = template.variables if isinstance(template.variables, dict) else {}
    variable_list = metadata.get("variables", []) if isinstance(metadata, dict) else []
    return {
        "id": str(template.id),
        "name": template.name,
        "channel": template.channel or "sms",
        "category": (
            metadata.get("category", "general")
            if isinstance(metadata, dict)
            else "general"
        ),
        "subject": metadata.get("subject") if isinstance(metadata, dict) else None,
        "content": template.template_en,
        "content_ne": template.template_ne,
        "variables": variable_list,
        "is_active": template.is_active,
        "created_at": template.created_at.isoformat() if template.created_at else None,
    }


def _diary_category_dict(category: DiaryCategory) -> dict:
    return {
        "id": str(category.id),
        "name": category.name,
        "color": category.color or "blue",
        "active": bool(category.active),
        "created_at": category.created_at.isoformat() if category.created_at else None,
    }


def _diary_entry_dict(entry: DiaryEntry) -> dict:
    return {
        "id": str(entry.id),
        "title": entry.title,
        "content": entry.content,
        "category_id": str(entry.category_id) if entry.category_id else None,
        "category_name": entry.category.name if entry.category else None,
        "student_id": str(entry.student_id) if entry.student_id else None,
        "student_name": (
            f"{entry.student.first_name or ''} {entry.student.last_name or ''}".strip()
            if entry.student
            else None
        ),
        "class_id": str(entry.class_id) if entry.class_id else None,
        "class_name": entry.klass.name if entry.klass else None,
        "section_id": str(entry.section_id) if entry.section_id else None,
        "section_name": entry.section.name if entry.section else None,
        "entry_date": entry.entry_date.isoformat() if entry.entry_date else None,
        "attachment_urls": entry.attachment_urls or [],
        "created_by_id": str(entry.created_by_id) if entry.created_by_id else None,
        "created_by_name": entry.created_by.full_name if entry.created_by else None,
        "is_published": bool(entry.is_published),
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }
