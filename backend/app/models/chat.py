"""School-scoped direct messaging models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class ChatThread(SchoolModel):
    __tablename__ = "chat_threads"
    __table_args__ = (
        UniqueConstraint(
            "school_id",
            "participant_a_id",
            "participant_b_id",
            name="uq_chat_thread_school_participants",
        ),
    )

    participant_a_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    participant_b_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    last_message = Column(Text)
    last_message_at = Column(DateTime)

    participant_a = relationship("User", foreign_keys=[participant_a_id])
    participant_b = relationship("User", foreign_keys=[participant_b_id])


class ChatMessage(SchoolModel):
    __tablename__ = "chat_messages"

    thread_id = Column(UUID(as_uuid=True), ForeignKey("chat_threads.id"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    file_url = Column(Text)
    file_type = Column(String(40))
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)

    thread = relationship("ChatThread", backref="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
