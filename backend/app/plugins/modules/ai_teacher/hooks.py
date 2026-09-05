"""AI Teacher plugin lifecycle hooks.

Hooks are NEVER fatal — `plugins.py::_run_plugin_hook` logs and swallows
failures — so every step here is idempotent and independently retryable
from the plugin settings screen. TOOL_KEY = "ai_teacher_lesson" is the
workbench registry row that gives the lesson tool the kill switch / tier /
consent gates and the AI Nutrition Facts.
"""
import logging
import secrets

logger = logging.getLogger(__name__)

TOOL_KEY = "ai_teacher_lesson"

_CONFIG_DEFAULTS = {
    "default_language": "ne",
    "lesson_max_minutes": 25,
    "lesson_target_chapters": 4,
    "allow_free_topic": False,
    "require_guardian_consent": True,
    "moderation_strictness": "standard",
    "monthly_cost_ceiling_npr": 3000,
    "transcript_retention_days": 180,
}


def _owned_models():
    from app.models.ai_teacher import (
        AITeacherLearningEvent,
        AITeacherLesson,
        AITeacherLessonChapter,
        AITeacherMastery,
        AITeacherMessage,
        AITeacherServiceKey,
    )
    from app.models.teaching_content import (
        TeachingContentReview,
        TeachingContentSnapshot,
        TeachingExamTip,
        TeachingExample,
        TeachingFormula,
        TeachingKeyTerm,
        TeachingMedia,
        TeachingMisconception,
        TeachingNote,
        TeachingSection,
        TeachingSectionOutcome,
        TeachingSectionVersion,
    )

    return [
        AITeacherServiceKey,
        AITeacherLesson,
        AITeacherLessonChapter,
        AITeacherMessage,
        AITeacherMastery,
        AITeacherLearningEvent,
        TeachingSection,
        TeachingSectionVersion,
        TeachingSectionOutcome,
        TeachingNote,
        TeachingExample,
        TeachingMisconception,
        TeachingFormula,
        TeachingExamTip,
        TeachingKeyTerm,
        TeachingMedia,
        TeachingContentSnapshot,
        TeachingContentReview,
    ]


def activate(db) -> None:
    """Idempotent activate: tables, credential, registry row, default config."""
    from flask import current_app

    # 1. Tables (idempotent — create_all with checkfirst)
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)

    # 2. Per-school service credential (sha256 stored; plaintext shown once)
    school_id = current_app.config.get("ASCHOOL_ACTIVATING_SCHOOL_ID")
    if school_id:
        _provision_school(db, school_id)

    # 3. Workbench tool registration so the kill switch / tier / consent
    #    gates apply to AI Teacher lessons like any other AI tool.
    _register_workbench_tool(db)

    # 4. Default config for unset keys only (never clobber admin choices)
    _apply_default_config(db)


def _provision_school(db, school_id) -> None:
    from app.models.ai_teacher import AITeacherServiceKey
    from app.plugins.modules.ai_teacher.service_client import provision_tenant

    existing = AITeacherServiceKey.query.filter_by(
        school_id=school_id, revoked_at=None
    ).first()
    if existing:
        return
    try:
        secret = secrets.token_urlsafe(48)
        key = AITeacherServiceKey.issue(school_id=school_id, secret=secret)
        db.session.add(key)
        db.session.commit()
        try:
            provision_tenant(school_id, key.key_id, secret)
        except Exception as exc:  # noqa: BLE001 — provisioning is retryable
            logger.warning(
                "ai_teacher: tenant provisioning deferred for school %s (%s) — "
                "the admin can retry from Settings",
                school_id,
                exc,
            )
    finally:
        secret = None  # never let the plaintext linger in local scope


def _register_workbench_tool(db) -> None:
    from app.models.ai_workbench import AINutritionFacts, AIToolRegistry

    if not AIToolRegistry.query.filter_by(tool_key=TOOL_KEY).first():
        db.session.add(
            AIToolRegistry(
                tool_key=TOOL_KEY,
                name="AI Teacher lesson",
                name_ne="एआई शिक्षक पाठ",
                category="tutor",
                min_plan_tier="ai_suite",
                roles_allowed=["student", "teacher", "school_admin"],
                status="beta",
            )
        )
    if not AINutritionFacts.query.filter_by(tool_key=TOOL_KEY).first():
        db.session.add(
            AINutritionFacts(
                tool_key=TOOL_KEY,
                model_name="external-service",
                provider="ai_teacher_service",
                data_accessed=[
                    "published curriculum content",
                    "lesson transcript",
                    "mastery per learning outcome",
                ],
                data_not_accessed=[
                    "marks",
                    "attendance",
                    "fees",
                    "health records",
                    "student photos",
                    "documents",
                ],
                retention_days=180,
                no_training_guarantee=True,
                human_review_required=False,
                limitations=(
                    "Teaches only from published curriculum content; may make "
                    "mistakes; not a substitute for a teacher. Voice and "
                    "whiteboard rendering are produced by an external service."
                ),
                supported_language="en+ne",
            )
        )
    db.session.commit()


def _apply_default_config(db) -> None:
    from flask import current_app

    from app.models.plugin import SchoolPlugin

    school_id = current_app.config.get("ASCHOOL_ACTIVATING_SCHOOL_ID")
    if not school_id:
        return
    sp = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug="ai_teacher"
    ).first()
    if sp is None:
        return
    sp.config = {**_CONFIG_DEFAULTS, **(sp.config or {})}
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(sp, "config")
    db.session.commit()


def deactivate(db) -> None:
    """Stop teaching, keep everything. Live lessons must not survive."""
    from flask import current_app

    from app.models.ai_teacher import AITeacherLesson

    school_id = current_app.config.get("ASCHOOL_ACTIVATING_SCHOOL_ID")
    if not school_id:
        return
    live = AITeacherLesson.query.filter(
        AITeacherLesson.school_id == school_id,
        AITeacherLesson.status.in_(["ready", "teaching", "paused"]),
        AITeacherLesson.is_deleted.is_(False),
    ).all()
    for lesson in live:
        try:
            from app.plugins.modules.ai_teacher.service_client import stop_lesson

            stop_lesson(lesson)
        except Exception as exc:  # noqa: BLE001 — warn-and-continue
            logger.warning("ai_teacher: stop_lesson failed for %s: %s", lesson.id, exc)
        lesson.status = "ended"
        lesson.end_reason = "plugin_deactivated"
    db.session.commit()

    try:
        from app.plugins.modules.ai_teacher.service_client import disable_tenant

        disable_tenant(school_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ai_teacher: disable_tenant failed: %s", exc)


def uninstall(db) -> None:
    """Revoke credentials, drop module-owned config. Lessons, mastery and
    teaching content are DATA and are kept (WordPress semantics)."""
    from datetime import datetime, timezone

    from flask import current_app

    from app.models.ai_teacher import AITeacherServiceKey
    from app.models.plugin import SchoolPlugin

    school_id = current_app.config.get("ASCHOOL_ACTIVATING_SCHOOL_ID")
    if not school_id:
        return
    now = datetime.now(timezone.utc)
    for key in AITeacherServiceKey.query.filter_by(
        school_id=school_id, revoked_at=None
    ).all():
        key.revoked_at = now
    sp = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug="ai_teacher"
    ).first()
    if sp and sp.config:
        sp.config = {k: v for k, v in sp.config.items() if k == "last_payment"}
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(sp, "config")
    db.session.commit()
