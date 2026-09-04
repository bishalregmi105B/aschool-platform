"""A-04 + AW-02: curriculum framework tables + ai_workbench ecosystem tables

Revision ID: c9f2a5d8e4b7
Revises: b6d9e3f1c8a2
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c9f2a5d8e4b7"
down_revision = "b6d9e3f1c8a2"
branch_labels = None
depends_on = None


def _school_table(name, cols, uq=None):
    args = [
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        *cols,
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f(f"fk_{name}_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{name}")),
    ]
    if uq:
        args.append(sa.UniqueConstraint(*uq[0], name=uq[1]))
    return args


def _platform_table(name, cols):
    """school_id nullable - platform-seeded rows have NULL school."""
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True),
        *cols,
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f(f"fk_{name}_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{name}")),
    ]


def upgrade():
    # Guarded enum pre-creation: partial rollbacks leave types behind, and
    # DROP TABLE does not drop types (the S-13 refund_status lesson).
    for enum_name, values in (
        ("curriculum_board", "'neb', 'cdc', 'cbse', 'ib', 'custom'"),
        ("content_visibility", "'private', 'school', 'district', 'public_template'"),
        ("tutor_focus", "'guide', 'practice', 'review'"),
        ("plan_status", "'active', 'archived'"),
        ("tutor_session_status", "'open', 'closed'"),
        ("tutor_msg_role", "'student', 'tutor', 'system'"),
        ("iep_status", "'draft', 'in_review', 'active', 'rejected', 'archived'"),
        ("moderation_severity", "'low', 'medium', 'high', 'critical'"),
    ):
        op.execute(
            f"DO $$ BEGIN CREATE TYPE {enum_name} AS ENUM ({values}); "
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
        )

    # == A-04 curriculum ==================================================
    op.create_table("curriculum_frameworks",
        *_platform_table("curriculum_frameworks", [
            sa.Column("board", postgresql.ENUM("neb", "cdc", "cbse", "ib", "custom", name="curriculum_board", create_type=False), nullable=False),
            sa.Column("grade", sa.String(length=20), nullable=False),
            sa.Column("subject_code", sa.String(length=50), nullable=False),
            sa.Column("subject_name", sa.String(length=200), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=True),
        ]),
    )
    op.create_index(op.f("ix_curriculum_frameworks_school_id"), "curriculum_frameworks", ["school_id"])
    op.create_index("ix_curriculum_frameworks_board_grade", "curriculum_frameworks", ["board", "grade"])

    op.create_table("curriculum_units", *[
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("framework_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unit_no", sa.Integer(), nullable=False),
        sa.Column("title_en", sa.String(length=300), nullable=False),
        sa.Column("title_ne", sa.String(length=300), nullable=True),
        sa.Column("periods", sa.Integer(), nullable=True),
        sa.Column("weight_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["framework_id"], ["curriculum_frameworks.id"], name=op.f("fk_curriculum_units_framework_id_curriculum_frameworks")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_curriculum_units")),
        sa.UniqueConstraint("framework_id", "unit_no", name="uq_curriculum_unit_framework_no"),
    ])
    op.create_index(op.f("ix_curriculum_units_framework_id"), "curriculum_units", ["framework_id"])

    op.create_table("learning_outcomes", *[
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("statement_en", sa.Text(), nullable=False),
        sa.Column("statement_ne", sa.Text(), nullable=True),
        sa.Column("bloom", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["unit_id"], ["curriculum_units.id"], name=op.f("fk_learning_outcomes_unit_id_curriculum_units")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_learning_outcomes")),
        sa.UniqueConstraint("unit_id", "code", name="uq_learning_outcome_unit_code"),
    ])
    op.create_index(op.f("ix_learning_outcomes_unit_id"), "learning_outcomes", ["unit_id"])

    op.create_table("subject_offerings",
        *_platform_table("subject_offerings", [
            sa.Column("subject_code", sa.String(length=50), nullable=False),
            sa.Column("subject_name", sa.String(length=200), nullable=False),
            sa.Column("grade", sa.String(length=20), nullable=False),
            sa.Column("theory_full", sa.Integer(), nullable=True),
            sa.Column("theory_pass", sa.Integer(), nullable=True),
            sa.Column("practical_full", sa.Integer(), nullable=True),
            sa.Column("practical_pass", sa.Integer(), nullable=True),
            sa.Column("has_practical", sa.Boolean(), nullable=True),
            sa.Column("credit_hours", sa.Numeric(4, 1), nullable=True),
        ]),
    )
    op.create_index(op.f("ix_subject_offerings_school_id"), "subject_offerings", ["school_id"])
    op.create_index(op.f("ix_subject_offerings_subject_code"), "subject_offerings", ["subject_code"])
    op.create_unique_constraint("uq_subject_offering_code_grade", "subject_offerings", ["subject_code", "grade", "school_id"])

    # == AW-02 ai_workbench ===============================================
    op.create_table("ai_generations",
        *_school_table("ai_generations", [
            sa.Column("tool_key", sa.String(length=100), nullable=False),
            sa.Column("tool_version", sa.String(length=30), nullable=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("feature", sa.String(length=100), nullable=True),
            sa.Column("provider", sa.String(length=50), nullable=True),
            sa.Column("model", sa.String(length=100), nullable=True),
            sa.Column("prompt_version", sa.String(length=30), nullable=True),
            sa.Column("prompt_sha256", sa.String(length=64), nullable=True),
            sa.Column("input_tokens", sa.Integer(), nullable=True),
            sa.Column("output_tokens", sa.Integer(), nullable=True),
            sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
            sa.Column("cost_npr", sa.Numeric(12, 4), nullable=True),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=True),
            sa.Column("schema_name", sa.String(length=100), nullable=True),
            sa.Column("citations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("fallback_used", sa.Boolean(), nullable=True),
            sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        ]),
    )
    op.create_index(op.f("ix_ai_generations_school_id"), "ai_generations", ["school_id"])
    op.create_index(op.f("ix_ai_generations_tool_key"), "ai_generations", ["tool_key"])
    op.create_index(op.f("ix_ai_generations_user_id"), "ai_generations", ["user_id"])

    op.create_table("ai_nutrition_facts", *[
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_key", sa.String(length=100), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("data_accessed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("data_not_accessed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("retention_days", sa.Integer(), nullable=True),
        sa.Column("no_training_guarantee", sa.Boolean(), nullable=True),
        sa.Column("human_review_required", sa.Boolean(), nullable=True),
        sa.Column("limitations", sa.Text(), nullable=True),
        sa.Column("supported_language", sa.String(length=10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_nutrition_facts")),
    ])
    op.create_index("ix_ai_nutrition_facts_tool_key", "ai_nutrition_facts", ["tool_key"], unique=True)

    op.create_table("ai_tool_registry", *[
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_key", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("name_ne", sa.String(length=200), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("description_ne", sa.Text(), nullable=True),
        sa.Column("min_plan_tier", sa.String(length=20), nullable=True),
        sa.Column("roles_allowed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output_schema_name", sa.String(length=100), nullable=True),
        sa.Column("prompt_file", sa.String(length=200), nullable=True),
        sa.Column("handler_name", sa.String(length=100), nullable=True),
        sa.Column("context_builder", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("is_fixture", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_tool_registry")),
    ])
    op.create_index("ix_ai_tool_registry_tool_key", "ai_tool_registry", ["tool_key"], unique=True)

    op.create_table("ai_tool_settings",
        *_school_table("ai_tool_settings", [
            sa.Column("tool_key", sa.String(length=100), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("field_overrides", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("custom_prompt_suffix", sa.Text(), nullable=True),
        ], uq=(["school_id", "tool_key"], "uq_ai_tool_settings_school_tool")),
    )
    op.create_index(op.f("ix_ai_tool_settings_school_id"), "ai_tool_settings", ["school_id"])
    op.create_index(op.f("ix_ai_tool_settings_tool_key"), "ai_tool_settings", ["tool_key"])

    op.create_table("ai_content_library_items",
        *_school_table("ai_content_library_items", [
            sa.Column("tool_key", sa.String(length=100), nullable=False),
            sa.Column("title", sa.String(length=300), nullable=False),
            sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("visibility", postgresql.ENUM("private", "school", "district", "public_template", name="content_visibility", create_type=False), nullable=True),
            sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("generation_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_ai_content_library_items_owner_id_users")),
            sa.ForeignKeyConstraint(["generation_id"], ["ai_generations.id"], name=op.f("fk_ai_content_library_items_generation_id_ai_generations")),
        ]),
    )
    op.create_index(op.f("ix_ai_content_library_items_school_id"), "ai_content_library_items", ["school_id"])
    op.create_index(op.f("ix_ai_content_library_items_tool_key"), "ai_content_library_items", ["tool_key"])
    op.create_index(op.f("ix_ai_content_library_items_owner_id"), "ai_content_library_items", ["owner_id"])

    op.create_table("tutor_session_plans",
        *_school_table("tutor_session_plans", [
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("topic", sa.String(length=300), nullable=False),
            sa.Column("grade", sa.String(length=20), nullable=True),
            sa.Column("learning_objective", sa.Text(), nullable=True),
            sa.Column("socratic_focus", postgresql.ENUM("guide", "practice", "review", name="tutor_focus", create_type=False), nullable=True),
            sa.Column("exam_mode", sa.Boolean(), nullable=True),
            sa.Column("status", postgresql.ENUM("active", "archived", name="plan_status", create_type=False), nullable=True),
            sa.Column("max_turns", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_tutor_session_plans_student_id_students")),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name=op.f("fk_tutor_session_plans_created_by_id_users")),
            sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], name=op.f("fk_tutor_session_plans_subject_id_subjects")),
        ]),
    )
    op.create_index(op.f("ix_tutor_session_plans_school_id"), "tutor_session_plans", ["school_id"])
    op.create_index(op.f("ix_tutor_session_plans_student_id"), "tutor_session_plans", ["student_id"])

    op.create_table("tutor_sessions",
        *_school_table("tutor_sessions", [
            sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("status", postgresql.ENUM("open", "closed", name="tutor_session_status", create_type=False), nullable=True),
            sa.Column("turns_used", sa.Integer(), nullable=True),
            sa.Column("reflection", sa.Text(), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["plan_id"], ["tutor_session_plans.id"], name=op.f("fk_tutor_sessions_plan_id_tutor_session_plans")),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_tutor_sessions_student_id_students")),
        ]),
    )
    op.create_index(op.f("ix_tutor_sessions_school_id"), "tutor_sessions", ["school_id"])
    op.create_index(op.f("ix_tutor_sessions_plan_id"), "tutor_sessions", ["plan_id"])
    op.create_index(op.f("ix_tutor_sessions_student_id"), "tutor_sessions", ["student_id"])
    op.create_index("ix_tutor_sessions_school_student", "tutor_sessions", ["school_id", "student_id"])

    op.create_table("tutor_messages",
        *_school_table("tutor_messages", [
            sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("role", postgresql.ENUM("student", "tutor", "system", name="tutor_msg_role", create_type=False), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("generation_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("flagged", sa.Boolean(), nullable=True),
            sa.Column("flag_severity", sa.String(length=20), nullable=True),
            sa.ForeignKeyConstraint(["session_id"], ["tutor_sessions.id"], name=op.f("fk_tutor_messages_session_id_tutor_sessions")),
            sa.ForeignKeyConstraint(["generation_id"], ["ai_generations.id"], name=op.f("fk_tutor_messages_generation_id_ai_generations")),
        ]),
    )
    op.create_index(op.f("ix_tutor_messages_school_id"), "tutor_messages", ["school_id"])
    op.create_index(op.f("ix_tutor_messages_session_id"), "tutor_messages", ["session_id"])

    op.create_table("iep_plans",
        *_school_table("iep_plans", [
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("goals", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("accommodations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("status", postgresql.ENUM("draft", "in_review", "active", "rejected", "archived", name="iep_status", create_type=False), nullable=True),
            sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("human_review_required", sa.Boolean(), nullable=True, server_default=sa.text("true")),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_iep_plans_student_id_students")),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name=op.f("fk_iep_plans_created_by_id_users")),
            sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], name=op.f("fk_iep_plans_reviewed_by_id_users")),
        ]),
    )
    op.create_index(op.f("ix_iep_plans_school_id"), "iep_plans", ["school_id"])
    op.create_index(op.f("ix_iep_plans_student_id"), "iep_plans", ["student_id"])

    op.create_table("guardian_ai_consents",
        *_school_table("guardian_ai_consents", [
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("guardian_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("scope", sa.String(length=50), nullable=False),
            sa.Column("granted", sa.Boolean(), nullable=True),
            sa.Column("granted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_guardian_ai_consents_student_id_students")),
            sa.ForeignKeyConstraint(["guardian_user_id"], ["users.id"], name=op.f("fk_guardian_ai_consents_guardian_user_id_users")),
        ], uq=(["student_id", "guardian_user_id", "scope"], "uq_guardian_consent_student_guardian_scope")),
    )
    op.create_index(op.f("ix_guardian_ai_consents_school_id"), "guardian_ai_consents", ["school_id"])
    op.create_index(op.f("ix_guardian_ai_consents_student_id"), "guardian_ai_consents", ["student_id"])

    op.create_table("moderation_flags",
        *_school_table("moderation_flags", [
            sa.Column("source_type", sa.String(length=50), nullable=False),
            sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("severity", postgresql.ENUM("low", "medium", "high", "critical", name="moderation_severity", create_type=False), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=True),
            sa.Column("snippet", sa.Text(), nullable=True),
            sa.Column("resolved", sa.Boolean(), nullable=True),
            sa.Column("resolved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_moderation_flags_student_id_students")),
            sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], name=op.f("fk_moderation_flags_resolved_by_id_users")),
        ]),
    )
    op.create_index(op.f("ix_moderation_flags_school_id"), "moderation_flags", ["school_id"])
    op.create_index(op.f("ix_moderation_flags_source_id"), "moderation_flags", ["source_id"])
    op.create_index(op.f("ix_moderation_flags_student_id"), "moderation_flags", ["student_id"])

    op.create_table("ai_tool_analytics_daily",
        *_school_table("ai_tool_analytics_daily", [
            sa.Column("day", sa.Date(), nullable=False),
            sa.Column("tool_key", sa.String(length=100), nullable=False),
            sa.Column("calls", sa.Integer(), nullable=True),
            sa.Column("errors", sa.Integer(), nullable=True),
            sa.Column("input_tokens", sa.Integer(), nullable=True),
            sa.Column("output_tokens", sa.Integer(), nullable=True),
            sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        ], uq=(["school_id", "day", "tool_key"], "uq_ai_tool_analytics_day_tool")),
    )
    op.create_index(op.f("ix_ai_tool_analytics_daily_school_id"), "ai_tool_analytics_daily", ["school_id"])
    op.create_index(op.f("ix_ai_tool_analytics_daily_day"), "ai_tool_analytics_daily", ["day"])
    op.create_index(op.f("ix_ai_tool_analytics_daily_tool_key"), "ai_tool_analytics_daily", ["tool_key"])

    op.create_table("student_ai_profiles",
        *_school_table("student_ai_profiles", [
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("total_tutor_turns", sa.Integer(), nullable=True),
            sa.Column("last_tutor_session_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_student_ai_profiles_student_id_students")),
        ], uq=(["school_id", "student_id"], "uq_student_ai_profile")),
    )
    op.create_index(op.f("ix_student_ai_profiles_school_id"), "student_ai_profiles", ["school_id"])
    op.create_index(op.f("ix_student_ai_profiles_student_id"), "student_ai_profiles", ["student_id"])


def downgrade():
    for t in ("student_ai_profiles", "ai_tool_analytics_daily", "moderation_flags",
              "guardian_ai_consents", "iep_plans", "tutor_messages", "tutor_sessions",
              "tutor_session_plans", "ai_content_library_items", "ai_tool_settings",
              "ai_tool_registry", "ai_nutrition_facts", "ai_generations",
              "subject_offerings", "learning_outcomes", "curriculum_units",
              "curriculum_frameworks"):
        op.drop_table(t)
    # Enum types are left in place on downgrade (columns may still reference
    # them across branch history; DROP ... CASCADE would risk live columns).
    # Harmless: unreferenced types, and upgrade() recreates with a guard.
