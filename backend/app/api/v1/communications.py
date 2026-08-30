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
    ChatNotAllowedError,
    contact_payload,
    can_message,
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

    # E190: the contacts role matrix governs thread reads too — a role pair
    # you could never message is a thread you should never open.
    if not can_message(getattr(g.current_user, "role", None), target.role):
        return error_response("You are not allowed to message this user", 403)

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
    except ChatNotAllowedError:
        # E190: role pair outside the directory matrix (e.g. student ->
        # parent, parent -> student) is a permission problem, not a bad
        # request.
        return error_response("You are not allowed to message this user", 403)
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
    subject = (data.get("subject") or "").strip()

    if channel == "push":
        return _broadcast_push(
            subject or "School Announcement", message, audience, class_id
        )
    if channel == "email":
        return _broadcast_email(
            subject or "School Announcement", message, audience, class_id
        )
    if channel == "whatsapp":
        return _broadcast_whatsapp(message, audience, class_id)

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
        payload.append({"phone": phone, "message": message, "log_id": str(log.id)})

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


# ── Non-SMS broadcast channels (E122) ─────────────────────────────────────
# These used to return `status: accepted` without doing anything (fake
# success). Each channel now performs its real delivery and reports the
# honest outcome: push writes in-app notifications, email attempts SMTP
# delivery with per-recipient failures counted, WhatsApp degrades to
# `skipped` when the school has no credentials.


def _guardian_user_ids(class_id: str | None, defaulters_only: bool = False) -> list:
    """user_ids of Guardian rows (optionally scoped to a class / to parents of
    fee defaulters) — the Guardian-linked half of parent audiences."""
    from app.models.fee import FeeCollection
    from app.models.student import Guardian, Student

    query = Guardian.query.join(Student, Guardian.student_id == Student.id).filter(
        Guardian.school_id == g.school_id,
        Guardian.is_deleted.is_(False),
        Student.is_deleted.is_(False),
        Guardian.user_id.isnot(None),
    )
    if class_id:
        parsed = _parse_uuid(class_id)
        if not parsed:
            return []
        query = query.filter(Student.class_id == parsed)
    if defaulters_only:
        query = query.join(
            FeeCollection, FeeCollection.student_id == Student.id
        ).filter(
            FeeCollection.is_deleted.is_(False),
            FeeCollection.payment_status.in_(("pending", "partial")),
        )
    return [guardian.user_id for guardian in query.all()]


def _users_for_audience(audience: str, class_id: str | None, limit: int = 500):
    """Active users of this school matching a broadcast audience (push)."""
    from app.models.user import User

    query = User.query.filter(
        User.school_id == g.school_id,
        User.is_deleted.is_(False),
        User.is_active.is_(True),
    )
    if audience == "all_staff":
        query = query.filter(
            User.role.in_(("school_admin", "accountant", "teacher", "staff"))
        )
    elif audience == "all_students":
        query = query.filter(User.role == "student")
    elif audience == "class_parents":
        # E122: class_parents means ONLY the guardian-linked users of that
        # class — the same semantics as the SMS audience resolver. Unioning
        # in every parent-role user of the school would broadcast to parents
        # whose children are not in the class at all.
        ids = list(set(_guardian_user_ids(class_id)))
        if not ids:
            return []
        query = query.filter(User.id.in_(ids))
    elif audience == "fee_defaulters":
        ids = list(set(_guardian_user_ids(None, defaulters_only=True)))
        if not ids:
            return []
        query = query.filter(User.id.in_(ids))
    else:  # all_parents (default)
        parent_ids = {
            u.id for u in query.filter(User.role == "parent").with_entities(User.id)
        }
        guardian_ids = set(_guardian_user_ids(None))
        ids = list(parent_ids | guardian_ids)
        if not ids:
            return []
        query = query.filter(User.id.in_(ids))
    return query.limit(limit).all()


def _broadcast_push(title: str, message: str, audience: str, class_id: str | None):
    """In-app broadcast: one notification per matching user, shown in the
    recipient's /notifications inbox. Single commit — nothing is delivered
    half-way."""
    from app.models.notification import InAppNotification

    users = _users_for_audience(audience, class_id)
    if not users:
        return success_response(
            {
                "queued": 0,
                "recipients": 0,
                "channel": "push",
                "audience": audience,
                "status": "sent",
                "note": "no matching users in this audience",
            }
        )

    for user in users:
        db.session.add(
            InAppNotification(
                school_id=g.school_id,
                user_id=str(user.id),
                title=title[:300],
                body=message,
                category="broadcast",
                priority="normal",
                data={"channel": "push", "audience": audience},
            )
        )
    db.session.commit()
    return created_response(
        {
            "queued": len(users),
            "recipients": len(users),
            "channel": "push",
            "audience": audience,
            "status": "sent",
        }
    )


def _emails_for_audience(audience: str, class_id: str | None) -> list[dict]:
    """Email addresses matching a broadcast audience (users first, then the
    denormalized Guardian email — deduplicated, order preserved)."""
    from app.models.student import Guardian, Student
    from app.models.user import User

    emails: list[str] = []

    if audience == "all_staff":
        users = User.query.filter(
            User.school_id == g.school_id,
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.role.in_(("school_admin", "accountant", "teacher", "staff")),
            User.email.isnot(None),
        ).all()
        emails.extend(u.email for u in users if u.email)
    elif audience == "all_students":
        users = User.query.filter(
            User.school_id == g.school_id,
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.role == "student",
            User.email.isnot(None),
        ).all()
        emails.extend(u.email for u in users if u.email)
    else:
        # parent-flavoured audiences: guardian emails (optionally class- or
        # defaulter-scoped) + parent-role user emails
        guardian_query = Guardian.query.join(
            Student, Guardian.student_id == Student.id
        ).filter(
            Guardian.school_id == g.school_id,
            Guardian.is_deleted.is_(False),
            Student.is_deleted.is_(False),
            Guardian.email.isnot(None),
        )
        if audience == "class_parents":
            parsed = _parse_uuid(class_id)
            if not parsed:
                return []
            guardian_query = guardian_query.filter(Student.class_id == parsed)
        elif audience == "fee_defaulters":
            from app.models.fee import FeeCollection

            guardian_query = guardian_query.join(
                FeeCollection, FeeCollection.student_id == Student.id
            ).filter(
                FeeCollection.is_deleted.is_(False),
                FeeCollection.payment_status.in_(("pending", "partial")),
            )
        emails.extend(
            guardian.email for guardian in guardian_query.all() if guardian.email
        )
        parent_users = User.query.filter(
            User.school_id == g.school_id,
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.role == "parent",
            User.email.isnot(None),
        ).all()
        emails.extend(u.email for u in parent_users if u.email)

    seen: set[str] = set()
    cleaned: list[dict] = []
    for email in emails:
        value = (email or "").strip().lower()
        if not value or value in seen:
            continue
        seen.add(value)
        cleaned.append({"email": value})
    return cleaned


def _broadcast_email(subject: str, message: str, audience: str, class_id: str | None):
    """Email broadcast through the SMTP EmailService. Unconfigured SMTP is
    reported honestly (status failed, reason email_not_configured) — never a
    fake success."""
    from markupsafe import escape

    from app.services.communications.email_service import EmailService

    recipients = _emails_for_audience(audience, class_id)
    if not recipients:
        return success_response(
            {
                "queued": 0,
                "recipients": 0,
                "channel": "email",
                "audience": audience,
                "status": "sent",
                "note": "no matching recipients with an email address",
            }
        )

    html_body = "<p>" + escape(message).replace("\n", "<br>") + "</p>"
    result = EmailService.send_bulk_email(recipients, subject, html_body)
    sent = int(result.get("sent", 0))
    failed = int(result.get("failed", 0))
    all_failed = sent == 0 and failed > 0
    return success_response(
        {
            "queued": sent,
            "recipients": len(recipients),
            "channel": "email",
            "audience": audience,
            "status": "failed" if all_failed else "sent",
            "reason": "email_not_configured_or_smtp_error" if all_failed else None,
            "failed": failed,
        }
    )


def _broadcast_whatsapp(message: str, audience: str, class_id: str | None):
    """WhatsApp broadcast through the Cloud API service. Without school
    credentials every send degrades to `skipped` (E32 honesty contract) and
    the response says so instead of pretending delivery."""
    from app.services.communications.whatsapp_cloud import WhatsAppCloudService

    phones = _phones_for_audience(audience, class_id)
    if not phones:
        return success_response(
            {
                "queued": 0,
                "recipients": 0,
                "channel": "whatsapp",
                "audience": audience,
                "status": "sent",
                "note": "no matching recipients with a phone number",
            }
        )

    results = [WhatsAppCloudService.send_text(phone, message) for phone in phones]
    skipped = sum(1 for r in results if r.get("skipped"))
    sent = len(results) - skipped
    if skipped == len(results):
        status = "skipped"
        reason = results[0].get("reason", "whatsapp_not_configured")
    elif sent == len(results):
        status = "sent"
        reason = None
    else:
        status = "partial"
        reason = "some_recipients_skipped"
    return success_response(
        {
            "queued": sent,
            "recipients": len(phones),
            "channel": "whatsapp",
            "audience": audience,
            "status": status,
            "reason": reason,
            "failed": skipped,
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
