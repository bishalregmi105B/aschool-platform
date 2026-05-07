"""Helpers for school-scoped direct chat endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_

from app.models.chat import ChatMessage, ChatThread
from app.models.user import User
from extensions import db


def parse_user_id(value) -> UUID | None:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def role_contacts_for(role: str | None) -> list[str]:
    if role == "parent":
        return ["school_admin", "accountant", "teacher", "staff"]
    if role == "teacher":
        return ["school_admin", "accountant", "parent", "student", "staff"]
    if role == "student":
        return ["school_admin", "teacher", "staff"]
    if role in ("school_admin", "superadmin", "accountant"):
        return ["school_admin", "accountant", "teacher", "staff", "parent", "student"]
    return ["school_admin", "teacher", "staff"]


def list_contact_users(school_id, current_user_id, role: str | None) -> list[User]:
    roles = role_contacts_for(role)
    return (
        User.query.filter(
            User.school_id == school_id,
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.id != current_user_id,
            User.role.in_(roles),
        )
        .order_by(User.role, User.full_name)
        .all()
    )


def get_or_create_thread(school_id, first_user_id, second_user_id) -> ChatThread:
    first, second = _ordered_pair(first_user_id, second_user_id)
    thread = ChatThread.query.filter_by(
        school_id=school_id,
        participant_a_id=first,
        participant_b_id=second,
        is_deleted=False,
    ).first()
    if thread:
        return thread

    thread = ChatThread(
        school_id=school_id,
        participant_a_id=first,
        participant_b_id=second,
    )
    db.session.add(thread)
    db.session.commit()
    return thread


def find_thread(school_id, first_user_id, second_user_id) -> ChatThread | None:
    first, second = _ordered_pair(first_user_id, second_user_id)
    return ChatThread.query.filter_by(
        school_id=school_id,
        participant_a_id=first,
        participant_b_id=second,
        is_deleted=False,
    ).first()


def list_messages(school_id, current_user_id, other_user_id, mark_read: bool = False) -> tuple[ChatThread, list[ChatMessage]]:
    thread = get_or_create_thread(school_id, current_user_id, other_user_id)
    query = ChatMessage.query.filter_by(
        school_id=school_id,
        thread_id=thread.id,
        is_deleted=False,
    ).order_by(ChatMessage.created_at.asc())
    messages = query.all()

    if mark_read:
        unread = [
            message
            for message in messages
            if message.receiver_id == current_user_id and not message.is_read
        ]
        if unread:
            now = datetime.now(timezone.utc)
            for message in unread:
                message.is_read = True
                message.read_at = now
            db.session.commit()

    return thread, messages


def send_message(
    school_id,
    sender_id,
    receiver_id,
    content: str,
    file_url: str | None = None,
    file_type: str | None = None,
) -> ChatMessage:
    thread = get_or_create_thread(school_id, sender_id, receiver_id)
    message = ChatMessage(
        school_id=school_id,
        thread_id=thread.id,
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        file_url=file_url,
        file_type=file_type,
    )
    thread.last_message = content
    thread.last_message_at = datetime.now(timezone.utc)
    db.session.add(message)
    db.session.commit()
    return message


def contact_payload(school_id, current_user_id, user: User) -> dict:
    thread = find_thread(school_id, current_user_id, user.id)
    unread_count = 0
    if thread:
        unread_count = (
            ChatMessage.query.filter(
                ChatMessage.school_id == school_id,
                ChatMessage.thread_id == thread.id,
                ChatMessage.receiver_id == current_user_id,
                ChatMessage.is_read.is_(False),
                ChatMessage.is_deleted.is_(False),
            ).count()
        )

    return {
        "id": str(user.id),
        "user_id": str(user.id),
        "thread_id": str(thread.id) if thread else None,
        "name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "last_message": thread.last_message if thread else None,
        "last_message_time": thread.last_message_at.isoformat() if thread and thread.last_message_at else None,
        "unread_count": unread_count,
        "is_online": False,
    }


def message_payload(message: ChatMessage, current_user_id=None) -> dict:
    is_mine = current_user_id is not None and str(message.sender_id) == str(current_user_id)
    return {
        "id": str(message.id),
        "conversation_id": str(message.thread_id),
        "thread_id": str(message.thread_id),
        "sender_id": str(message.sender_id),
        "sender_name": message.sender.full_name if message.sender else None,
        "sender_role": message.sender.role if message.sender else None,
        "receiver_id": str(message.receiver_id),
        "message": message.content,
        "content": message.content,
        "file_url": message.file_url,
        "file_type": message.file_type,
        "timestamp": message.created_at.isoformat() if message.created_at else None,
        "time": message.created_at.strftime("%I:%M %p") if message.created_at else None,
        "is_read": bool(message.is_read),
        "is_mine": is_mine,
    }


def _ordered_pair(first_user_id, second_user_id) -> tuple[UUID, UUID]:
    first = parse_user_id(first_user_id)
    second = parse_user_id(second_user_id)
    if not first or not second:
        raise ValueError("Valid participant ids are required")
    if first == second:
        raise ValueError("A chat requires two different participants")
    ordered = sorted([first, second], key=lambda value: str(value))
    return ordered[0], ordered[1]
