"""AI Teacher runtime models — lessons, chapters, mastery, credentials, events.

These are ASchool's own records of AI Teacher lessons (the host is never
blind): the lesson row is created BEFORE the service is called, and results
flow home through the webhook reconciler. See
audits/research/ATEACHER_PLUGIN_INTEGRATION.md §B.4 (ownership split) and
§B.6 (results coming home).

Mastery is keyed (student_id, concept_key) where concept_key is the
teaching_section_outcomes.mastery_key — i.e. a CURRICULUM outcome key, not
an LLM-invented chapter label — so mastery survives lessons and can feed
report cards.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, SchoolModel


def _sha256(value: str) -> str:
    import hashlib

    return hashlib.sha256(value.encode()).hexdigest()


class AITeacherServiceKey(SchoolModel):
    """Per-school S2S credential for the AI Teacher runtime service.

    The plaintext secret is shown ONCE at issue/rotate and is never stored —
    only its sha256 (what the HMAC verification needs). Provisioning the
    tenant at the service happens out-of-band with the plaintext.
    """

    __tablename__ = "ai_teacher_service_keys"

    key_id = Column(String(40), nullable=False, unique=True)
    secret_sha256 = Column(String(64), nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    rotated_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))

    # "one live key per school" is a service-layer rule (issue() revokes
    # predecessors) — not a DB constraint, so rotations keep their history.

    @classmethod
    def issue(cls, school_id, secret: str) -> "AITeacherServiceKey":
        # Revoke any live predecessor so verification can't accept an old key.
        for live in cls.query.filter_by(
            school_id=school_id, revoked_at=None
        ).all():
            live.revoked_at = datetime.now(timezone.utc)
        return cls(
            school_id=school_id,
            key_id=f"ask_{uuid.uuid4().hex[:16]}",
            secret_sha256=_sha256(secret),
        )

    def verify(self, secret: str) -> bool:
        return self.secret_sha256 == _sha256(secret)


class AITeacherLesson(SchoolModel):
    """One lesson. ASchool's UUID is canonical; the service session_id is a
    mirror (the structural fix for Ashlya's session-id divergence)."""

    __tablename__ = "ai_teacher_lessons"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    student_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    section_id = Column(
        UUID(as_uuid=True), ForeignKey("teaching_sections.id"), nullable=True
    )
    content_snapshot_id = Column(
        UUID(as_uuid=True), ForeignKey("teaching_section_versions.id"), nullable=True
    )
    grounded = Column(Boolean, nullable=False, default=True)
    topic = Column(String(300))
    persona_slug = Column(String(40), nullable=False, default="aria")
    language = Column(String(8), nullable=False, default="ne")  # en|ne|mixed
    voice = Column(String(60))
    level = Column(String(16), nullable=False, default="beginner")
    max_minutes = Column(Integer, nullable=False, default=25)
    status = Column(String(20), nullable=False, default="pending", index=True)
    # pending|ready|teaching|paused|ended|abandoned|failed|blocked
    end_reason = Column(String(40))
    service_session_id = Column(String(80), index=True)
    service_token_expires_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    chapters_planned = Column(Integer, default=0)
    chapters_completed = Column(Integer, default=0)
    questions_asked = Column(Integer, default=0)
    estimated_cost_npr = Column(Numeric(10, 2))
    cost_npr = Column(Numeric(10, 2))
    cost_source = Column(String(12))  # measured | estimated
    summary_text = Column(Text)
    summary_evidence = Column(JSONB, default=dict)
    lesson_metadata = Column("metadata", JSONB, default=dict)

    chapters = relationship(
        "AITeacherLessonChapter",
        backref="lesson",
        cascade="all, delete-orphan",
        order_by="AITeacherLessonChapter.chapter_no",
    )
    messages = relationship(
        "AITeacherMessage",
        backref="lesson",
        cascade="all, delete-orphan",
        order_by="AITeacherMessage.created_at",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','ready','teaching','paused','ended','abandoned',"
            "'failed','blocked')",
            name="ck_aitl_status",
        ),
        CheckConstraint("language IN ('en','ne','mixed')", name="ck_aitl_language"),
        CheckConstraint(
            "level IN ('beginner','intermediate','advanced')", name="ck_aitl_level"
        ),
    )

    def to_dict(self, include_chapters: bool = False):
        data = {
            "id": str(self.id),
            "student_id": str(self.student_id) if self.student_id else None,
            "section_id": str(self.section_id) if self.section_id else None,
            "content_snapshot_id": (
                str(self.content_snapshot_id) if self.content_snapshot_id else None
            ),
            "grounded": bool(self.grounded),
            "topic": self.topic,
            "persona_slug": self.persona_slug,
            "language": self.language,
            "voice": self.voice,
            "level": self.level,
            "max_minutes": self.max_minutes,
            "status": self.status,
            "end_reason": self.end_reason,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "duration_seconds": self.duration_seconds,
            "chapters_planned": self.chapters_planned,
            "chapters_completed": self.chapters_completed,
            "questions_asked": self.questions_asked,
            "estimated_cost_npr": (
                float(self.estimated_cost_npr) if self.estimated_cost_npr else None
            ),
            "cost_npr": float(self.cost_npr) if self.cost_npr else None,
            "cost_source": self.cost_source,
            "summary_text": self.summary_text,
        }
        if include_chapters:
            data["chapters"] = [c.to_dict() for c in (self.chapters or [])]
        return data


class AITeacherLessonChapter(SchoolModel):
    """Per-chapter progress reported by the service (chapter.completed)."""

    __tablename__ = "ai_teacher_lesson_chapters"

    lesson_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_teacher_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chapter_no = Column(Integer, nullable=False)
    title = Column(String(300))
    status = Column(String(20), nullable=False, default="planned")
    # planned|teaching|completed|skipped
    slide_count = Column(Integer)
    quiz_score = Column(Numeric(5, 2))
    confusion_count = Column(Integer, default=0)
    outcome_ids = Column(JSONB, default=list)  # teaching_section_outcomes covered

    __table_args__ = (
        CheckConstraint(
            "status IN ('planned','teaching','completed','skipped')",
            name="ck_aitlc_status",
        ),
        UniqueConstraint("lesson_id", "chapter_no", name="uq_aitlc_lesson_no"),
    )

    def to_dict(self):
        return {
            "chapter_no": self.chapter_no,
            "title": self.title,
            "status": self.status,
            "slide_count": self.slide_count,
            "quiz_score": float(self.quiz_score) if self.quiz_score else None,
            "confusion_count": self.confusion_count,
            "outcome_ids": self.outcome_ids or [],
        }


class AITeacherMessage(SchoolModel):
    """Mirrored transcript line (service master, ASchool mirror, retention =
    plugin config transcript_retention_days; nightly purge task)."""

    __tablename__ = "ai_teacher_messages"

    lesson_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_teacher_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False)  # teacher|student|system
    speaker_name = Column(String(200))
    content = Column(Text, nullable=False)
    event_id = Column(String(80), index=True)  # webhook idempotency
    sequence = Column(Integer)

    __table_args__ = (
        CheckConstraint("role IN ('teacher','student','system')", name="ck_aitm_role"),
        UniqueConstraint("lesson_id", "event_id", name="uq_aitm_lesson_event"),
    )


class AITeacherMastery(SchoolModel):
    """Per-student, per-concept mastery — keyed to CURRICULUM outcome keys so
    it survives lessons and feeds report cards / spaced repetition."""

    __tablename__ = "ai_teacher_mastery"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    concept_key = Column(String(80), nullable=False)
    outcome_id = Column(UUID(as_uuid=True), ForeignKey("learning_outcomes.id"), nullable=True)
    # SM-2 state (full SuperMemo-2 semantics shared with the adaptive engine)
    ease_factor = Column(Numeric(4, 2), nullable=False, default=2.5)
    interval_days = Column(Integer, nullable=False, default=0)
    repetitions = Column(Integer, nullable=False, default=0)
    due_at = Column(DateTime(timezone=True), index=True)
    last_reviewed_at = Column(DateTime(timezone=True))
    lapses = Column(Integer, nullable=False, default=0)
    mastery_level = Column(String(12), nullable=False, default="novice")
    # novice|developing|proficient|advanced
    mastery_score = Column(Numeric(5, 2), nullable=False, default=0)

    __table_args__ = (
        CheckConstraint(
            "mastery_level IN ('novice','developing','proficient','advanced')",
            name="ck_aitm_level",
        ),
        UniqueConstraint("student_id", "concept_key", name="uq_aitm_student_concept"),
    )

    def to_dict(self):
        return {
            "student_id": str(self.student_id),
            "concept_key": self.concept_key,
            "outcome_id": str(self.outcome_id) if self.outcome_id else None,
            "ease_factor": float(self.ease_factor),
            "interval_days": self.interval_days,
            "repetitions": self.repetitions,
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "mastery_level": self.mastery_level,
            "mastery_score": float(self.mastery_score),
            "lapses": self.lapses,
        }


class AITeacherLearningEvent(SchoolModel):
    """xAPI-shaped learning event stream (verb, object, result, context)."""

    __tablename__ = "ai_teacher_learning_events"

    lesson_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_teacher_lessons.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    verb = Column(String(40), nullable=False)  # taught|answered|asked|mastered|struggled
    object_type = Column(String(40))
    object_id = Column(String(80))
    result_success = Column(Boolean)
    result_score = Column(Numeric(5, 2))
    context = Column(JSONB, default=dict)
