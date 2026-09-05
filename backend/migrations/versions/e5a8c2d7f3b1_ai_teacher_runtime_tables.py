"""Phase C P2: AI Teacher runtime tables (lessons, chapters, messages,
mastery, learning events, service keys)

ASchool's own record of AI Teacher lessons — created before the service is
called, updated by the webhook reconciler. DDL rationale:
ATEACHER_PLUGIN_INTEGRATION.md §B.3–§B.6; models in app/models/ai_teacher.py.

Revision ID: e5a8c2d7f3b1
Revises: d4e7f1a9c2b8
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "e5a8c2d7f3b1"
down_revision = "d4e7f1a9c2b8"
branch_labels = None
depends_on = None


def _base():
    return [
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"),
                  nullable=False),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"),
                  nullable=False),
    ]


def upgrade():
    op.create_table(
        "ai_teacher_service_keys",
        *_base(),
        sa.Column("key_id", sa.String(40), nullable=False),
        sa.Column("secret_sha256", sa.String(64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("rotated_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index("uq_aitsk_key_id", "ai_teacher_service_keys", ["key_id"],
                    unique=True)

    op.create_table(
        "ai_teacher_lessons",
        *_base(),
        sa.Column("student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id"),
                  nullable=True),
        sa.Column("student_user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=True),
        sa.Column("created_by_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"),
                  nullable=False),
        sa.Column("section_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_sections.id"), nullable=True),
        sa.Column("content_snapshot_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("teaching_section_versions.id"), nullable=True),
        sa.Column("grounded", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("topic", sa.String(300)),
        sa.Column("persona_slug", sa.String(40), nullable=False, server_default="aria"),
        sa.Column("language", sa.String(8), nullable=False, server_default="ne"),
        sa.Column("voice", sa.String(60)),
        sa.Column("level", sa.String(16), nullable=False, server_default="beginner"),
        sa.Column("max_minutes", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("end_reason", sa.String(40)),
        sa.Column("service_session_id", sa.String(80)),
        sa.Column("service_token_expires_at", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("duration_seconds", sa.Integer()),
        sa.Column("chapters_planned", sa.Integer(), server_default="0"),
        sa.Column("chapters_completed", sa.Integer(), server_default="0"),
        sa.Column("questions_asked", sa.Integer(), server_default="0"),
        sa.Column("estimated_cost_npr", sa.Numeric(10, 2)),
        sa.Column("cost_npr", sa.Numeric(10, 2)),
        sa.Column("cost_source", sa.String(12)),
        sa.Column("summary_text", sa.Text()),
        sa.Column("summary_evidence", pg.JSONB(),
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("metadata", pg.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.CheckConstraint(
            "status IN ('pending','ready','teaching','paused','ended','abandoned',"
            "'failed','blocked')",
            name="ck_aitl_status"),
        sa.CheckConstraint("language IN ('en','ne','mixed')", name="ck_aitl_language"),
        sa.CheckConstraint("level IN ('beginner','intermediate','advanced')",
                           name="ck_aitl_level"),
    )
    op.create_index("ix_aitl_status", "ai_teacher_lessons", ["status"])
    op.create_index("ix_aitl_service_session", "ai_teacher_lessons",
                    ["service_session_id"])

    op.create_table(
        "ai_teacher_lesson_chapters",
        *_base(),
        sa.Column("lesson_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("ai_teacher_lessons.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("chapter_no", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(300)),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.Column("slide_count", sa.Integer()),
        sa.Column("quiz_score", sa.Numeric(5, 2)),
        sa.Column("confusion_count", sa.Integer(), server_default="0"),
        sa.Column("outcome_ids", pg.JSONB(), server_default=sa.text("'[]'::jsonb")),
        sa.CheckConstraint(
            "status IN ('planned','teaching','completed','skipped')",
            name="ck_aitlc_status"),
        sa.UniqueConstraint("lesson_id", "chapter_no", name="uq_aitlc_lesson_no"),
    )

    op.create_table(
        "ai_teacher_messages",
        *_base(),
        sa.Column("lesson_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("ai_teacher_lessons.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("speaker_name", sa.String(200)),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("event_id", sa.String(80)),
        sa.Column("sequence", sa.Integer()),
        sa.CheckConstraint("role IN ('teacher','student','system')", name="ck_aitm_role"),
        sa.UniqueConstraint("lesson_id", "event_id", name="uq_aitm_lesson_event"),
    )
    op.create_index("ix_aitm_event_id", "ai_teacher_messages", ["event_id"])

    op.create_table(
        "ai_teacher_mastery",
        *_base(),
        sa.Column("student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id"),
                  nullable=False),
        sa.Column("concept_key", sa.String(80), nullable=False),
        sa.Column("outcome_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("learning_outcomes.id"), nullable=True),
        sa.Column("ease_factor", sa.Numeric(4, 2), nullable=False, server_default="2.5"),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("lapses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mastery_level", sa.String(12), nullable=False,
                  server_default="novice"),
        sa.Column("mastery_score", sa.Numeric(5, 2), nullable=False,
                  server_default="0"),
        sa.CheckConstraint(
            "mastery_level IN ('novice','developing','proficient','advanced')",
            name="ck_aitm_level"),
        sa.UniqueConstraint("student_id", "concept_key", name="uq_aitm_student_concept"),
    )
    op.create_index("ix_aitm_due_at", "ai_teacher_mastery", ["due_at"])

    op.create_table(
        "ai_teacher_learning_events",
        *_base(),
        sa.Column("lesson_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("ai_teacher_lessons.id", ondelete="CASCADE"),
                  nullable=True),
        sa.Column("student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id"),
                  nullable=False),
        sa.Column("verb", sa.String(40), nullable=False),
        sa.Column("object_type", sa.String(40)),
        sa.Column("object_id", sa.String(80)),
        sa.Column("result_success", sa.Boolean()),
        sa.Column("result_score", sa.Numeric(5, 2)),
        sa.Column("context", pg.JSONB(), server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_aitle_student", "ai_teacher_learning_events", ["student_id"])


def downgrade():
    op.drop_table("ai_teacher_learning_events")
    op.drop_table("ai_teacher_mastery")
    op.drop_table("ai_teacher_messages")
    op.drop_table("ai_teacher_lesson_chapters")
    op.drop_table("ai_teacher_lessons")
    op.drop_table("ai_teacher_service_keys")
