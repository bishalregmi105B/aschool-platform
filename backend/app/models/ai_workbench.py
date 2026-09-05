"""ai_workbench ecosystem data model (AW-02 / A-07).

The single provenance row every AI tool writes is AIGeneration; feature
tables reference it. AINutritionFacts is the enforced transparency schema
(CI gate: no tool status=ga without a row). Tutor state machine, IEP draft
machine, guardian consent, moderation flags and per-tool analytics all
follow the D-02/D-03/D-05 conventions (SchoolModel, TIMESTAMPTZ, partial
UQs).
"""
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Index,
    Integer, Numeric, String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, SchoolModel


class AIGeneration(SchoolModel):
    """Provenance ledger — every AI generation in the platform writes one row.

    feature tables (GeneratedPaper, rubrics, tutor replies…) reference this
    via nullable ai_generation_id so any artifact can be traced to its
    model/provider/cost/prompt.
    """

    __tablename__ = "ai_generations"

    tool_key = Column(String(100), nullable=False, index=True)
    tool_version = Column(String(30), default="1.0")
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    feature = Column(String(100))                       # legacy AITokenHub feature tag
    provider = Column(String(50))
    model = Column(String(100))
    prompt_version = Column(String(30))
    prompt_sha256 = Column(String(64))
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6))
    cost_npr = Column(Numeric(12, 4))
    latency_ms = Column(Integer, default=0)
    status = Column(String(20), default="success")      # success|error|blocked
    schema_name = Column(String(100))                   # output schema key
    citations = Column(JSONB, default=list)             # [{source_type, source_id, chunk}]
    fallback_used = Column(Boolean, default=False)
    ai_generation_meta = Column("meta", JSONB, default=dict)


class AINutritionFacts(BaseModel):
    """Per-tool transparency card (A-07/CI gate a) — rendered on the
    AI Nutrition Facts page and enforced at registration."""

    __tablename__ = "ai_nutrition_facts"

    tool_key = Column(String(100), nullable=False, unique=True, index=True)
    model_name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)
    data_accessed = Column(JSONB, default=list)     # ["marks", "attendance", ...]
    data_not_accessed = Column(JSONB, default=list)
    retention_days = Column(Integer, default=30)
    no_training_guarantee = Column(Boolean, default=True)
    human_review_required = Column(Boolean, default=False)
    limitations = Column(Text)
    supported_language = Column(String(10), default="en+ne")

    def to_dict(self):
        return {
            "tool_key": self.tool_key,
            "model": self.model_name,
            "provider": self.provider,
            "data_accessed": self.data_accessed or [],
            "data_not_accessed": self.data_not_accessed or [],
            "retention_days": self.retention_days,
            "no_training_guarantee": bool(self.no_training_guarantee),
            "human_review_required": bool(self.human_review_required),
            "limitations": self.limitations,
            "supported_language": self.supported_language,
        }


class AIToolRegistry(BaseModel):
    """Catalog of ai_workbench tools (AW-01). Adding tool #66 = one row +
    one prompt file + one handler — zero new routes/pages."""

    __tablename__ = "ai_tool_registry"

    tool_key = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    name_ne = Column(String(200))
    category = Column(String(50), nullable=False)   # planning|assessment|communication|tutor|admin
    description = Column(Text)
    description_ne = Column(Text)
    min_plan_tier = Column(String(20), default="free")  # free|ai_suite
    roles_allowed = Column(JSONB, default=list)         # ["teacher","school_admin"]
    output_schema_name = Column(String(100))
    prompt_file = Column(String(200))                   # app/prompts/<tool>.md
    handler_name = Column(String(100))
    context_builder = Column(String(100))               # named context builder fn
    status = Column(String(20), default="beta")         # beta|ga|disabled
    is_fixture = Column(Boolean, default=False)         # the AW-01 CI fixture tool

    # ── Catalog columns (D1 §C.3 + D3 §D.1) ────────────────────────────
    # trigger_phrases: JSON array — the claude-skills "description is the
    # router" convention; the AI chat routes intent → tool via these.
    trigger_phrases = Column(JSONB, nullable=False, default=list)
    # budget: tier0 deterministic … tier4 audio/batch — cost badge + caps
    budget = Column(String(10), nullable=False, default="tier1")
    failure_modes = Column(Text)                        # recorded pitfalls
    reference_pack = Column(String(80))                 # app/prompts/refs/<pack>/
    # output_document_type routes the result to a document emitter
    output_document_type = Column(String(20), nullable=False, default="none")
    # ui_type decides which result component renders (web + apps)
    ui_type = Column(String(30), nullable=False, default="form")
    icon = Column(String(16))                           # catalog glyph (emoji)
    sort_order = Column(Integer, default=0)
    badge = Column(String(20))                          # popular|new|smart|beta|free
    input_schema_name = Column(String(100))             # drives the generated form
    # grounding: required (422 without published chapter) | optional | none
    grounding = Column(String(12), nullable=False, default="optional")

    def to_dict(self):
        return {
            "tool_key": self.tool_key,
            "name": self.name,
            "name_ne": self.name_ne,
            "category": self.category,
            "description": self.description,
            "description_ne": self.description_ne,
            "min_plan_tier": self.min_plan_tier,
            "status": self.status,
            "ui_type": self.ui_type,
            "icon": self.icon,
            "badge": self.badge,
            "budget": self.budget,
            "grounding": self.grounding,
            "sort_order": self.sort_order or 0,
            "output_document_type": self.output_document_type,
        }


class SchoolAIToolSettings(SchoolModel):
    """Per-school admin overrides for one tool (AW-05)."""

    __tablename__ = "ai_tool_settings"

    tool_key = Column(String(100), nullable=False, index=True)
    enabled = Column(Boolean, default=True)             # kill switch, 403 in one request
    field_overrides = Column(JSONB, default=dict)       # {"tone": "formal", ...}
    custom_prompt_suffix = Column(Text)

    __table_args__ = (
        UniqueConstraint("school_id", "tool_key", name="uq_ai_tool_settings_school_tool"),
    )


class AIContentLibraryItem(SchoolModel):
    """Reusable AI artifacts saved by teachers (AW-05)."""

    __tablename__ = "ai_content_library_items"

    tool_key = Column(String(100), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    content = Column(JSONB, nullable=False, default=dict)
    visibility = Column(
        Enum("private", "school", "district", "public_template", name="content_visibility"),
        default="private",
    )
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    generation_id = Column(UUID(as_uuid=True), ForeignKey("ai_generations.id"))
    tags = Column(JSONB, default=list)


class TutorSessionPlan(SchoolModel):
    """AW-06: no plan → no chat. A tutor session must start from a plan."""

    __tablename__ = "tutor_session_plans"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    topic = Column(String(300), nullable=False)
    grade = Column(String(20))
    learning_objective = Column(Text)
    socratic_focus = Column(
        Enum("guide", "practice", "review", name="tutor_focus"), default="guide"
    )
    exam_mode = Column(Boolean, default=False)          # deflection on
    status = Column(Enum("active", "archived", name="plan_status"), default="active")
    max_turns = Column(Integer, default=20)


class TutorSession(SchoolModel):
    __tablename__ = "tutor_sessions"

    plan_id = Column(UUID(as_uuid=True), ForeignKey("tutor_session_plans.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    status = Column(
        # NOT the PT-conference session_status enum — distinct name so the
        # guarded CREATE TYPE in the migration can't silently bind the wrong
        # type (found live: conferences own session_status already).
        Enum("open", "closed", name="tutor_session_status"),
        default="open",
    )
    turns_used = Column(Integer, default=0)
    reflection = Column(Text)                           # written on close
    closed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_tutor_sessions_school_student", "school_id", "student_id"),
    )


class TutorMessage(SchoolModel):
    __tablename__ = "tutor_messages"

    session_id = Column(UUID(as_uuid=True), ForeignKey("tutor_sessions.id"), nullable=False, index=True)
    role = Column(Enum("student", "tutor", "system", name="tutor_msg_role"), nullable=False)
    content = Column(Text, nullable=False)
    generation_id = Column(UUID(as_uuid=True), ForeignKey("ai_generations.id"))
    flagged = Column(Boolean, default=False)
    flag_severity = Column(String(20))                  # critical → wellbeing path


class IEPPlan(SchoolModel):
    """AW-07: draft-only until reviewed by a principal/special-ed reviewer."""

    __tablename__ = "iep_plans"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    goals = Column(JSONB, default=list)                 # [{statement, evidence_refs:[...], criteria}]
    accommodations = Column(JSONB, default=list)
    status = Column(
        Enum("draft", "in_review", "active", "rejected", "archived", name="iep_status"),
        default="draft",
    )
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)
    human_review_required = Column(Boolean, default=True, server_default=text("true"))


class GuardianAIConsent(SchoolModel):
    """AW-04: consent gate before any student-facing tool."""

    __tablename__ = "guardian_ai_consents"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    guardian_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    scope = Column(String(50), nullable=False)          # tutor|tools|all
    granted = Column(Boolean, default=False)
    granted_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("student_id", "guardian_user_id", "scope",
                         name="uq_guardian_consent_student_guardian_scope"),
    )


class ModerationFlag(SchoolModel):
    """AW-04 moderation pipeline output; `critical` routes to the EXISTING
    wellbeing-alert path (no second alerting mechanism)."""

    __tablename__ = "moderation_flags"

    source_type = Column(String(50), nullable=False)    # tutor_message|generation|...
    source_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    severity = Column(Enum("low", "medium", "high", "critical", name="moderation_severity"), nullable=False)
    category = Column(String(50))                       # self_harm|violence|pii|injection|other
    snippet = Column(Text)
    resolved = Column(Boolean, default=False)
    resolved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))


class AIToolAnalyticsDaily(SchoolModel):
    """Per-school per-tool daily rollup (cost/usage dashboards)."""

    __tablename__ = "ai_tool_analytics_daily"

    day = Column(Date, nullable=False, index=True)
    tool_key = Column(String(100), nullable=False, index=True)
    calls = Column(Integer, default=0)
    errors = Column(Integer, default=0)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6), default=0)

    __table_args__ = (
        UniqueConstraint("school_id", "day", "tool_key",
                         name="uq_ai_tool_analytics_day_tool"),
    )


class StudentAIProfile(SchoolModel):
    """Narrow by design (DPDP bar): no behavioural profiling — just the
    tool-usage counters the tutor needs."""

    __tablename__ = "student_ai_profiles"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    total_tutor_turns = Column(Integer, default=0)
    last_tutor_session_at = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("school_id", "student_id", name="uq_student_ai_profile"),
    )
