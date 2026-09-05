"""AI Teacher plugin routes — lesson lifecycle + mastery + service webhook.

Every route: @jwt_required() @school_required @plugin_required("ai_teacher")
The create-lesson sequence (AT §B.3) runs ALL gates before anything is spent:
kill switch → tier → role → consent → content resolution (published only,
422 otherwise) → injection scan → budget reserve → ASchool row → service call.
"""
import hashlib
import json
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from app.models.ai_teacher import (
    AITeacherLesson,
    AITeacherMastery,
    AITeacherServiceKey,
)
from app.models.ai_workbench import SchoolAIToolSettings
from app.models.student import Student
from app.plugins.config_store import plugin_config_value
from app.plugins.decorators import plugin_required
from app.plugins.modules.ai_teacher.service_client import ServiceUnavailableError
from app.services.ai.workbench import (
    ToolPipelineError,
    _require_plan_tier,
    detect_injection,
)
from app.utils.decorators import role_required, school_required
from app.utils.rate_limiter import ai_rate_limit
from app.utils.response import created_response, error_response, success_response
from extensions import db

ai_teacher_bp = Blueprint("ai_teacher", __name__, url_prefix="/ai-teacher")


def _cfg(key, default=None):
    return plugin_config_value(str(g.school_id), "ai_teacher", key, default)


def _kill_switch_on() -> bool:
    settings = SchoolAIToolSettings.query.filter_by(
        school_id=g.school_id, tool_key="ai_teacher_lesson"
    ).first()
    if settings is not None and not settings.enabled:
        return True
    return bool(_cfg("kill_switch", False))


def _resolve_published_section(section_id):
    """Published section for THIS school: school override → platform row."""
    from app.models.teaching_content import TeachingSection, TeachingSectionVersion

    section = TeachingSection.query.filter(
        TeachingSection.id == section_id,
        TeachingSection.is_deleted.is_(False),
    ).first()
    if not section:
        return None, None
    if section.school_id is not None and str(section.school_id) != str(g.school_id):
        return None, None
    version = section.published_version
    if version is None and section.overrides_section_id:
        platform = TeachingSection.query.get(section.overrides_section_id)
        version = platform.published_version if platform else None
    if version is None:
        return section, None
    return section, version


def _build_context_document(version, language: str) -> dict:
    """Structured document from the published version (the read API §C.7)."""
    from app.models.curriculum import LearningOutcome

    outcome_ids = [o.outcome_id for o in (version.outcome_links or [])]
    outcomes = (
        LearningOutcome.query.filter(LearningOutcome.id.in_(outcome_ids)).all()
        if outcome_ids
        else []
    )
    outcome_by_id = {str(o.id): o for o in outcomes}

    def _pair(en, ne):
        if language == "ne":
            return {"text": ne or en}
        if language == "mixed":
            return {"text": en, "gloss": ne}
        return {"text": en}

    return {
        "version_id": str(version.id),
        "language": language,
        "outcomes": [
            {
                "mastery_key": link.mastery_key,
                "emphasis": link.emphasis,
                "statement": _pair(
                    outcome_by_id[str(link.outcome_id)].statement_en,
                    outcome_by_id[str(link.outcome_id)].statement_ne,
                )
                if str(link.outcome_id) in outcome_by_id
                else None,
            }
            for link in (version.outcome_links or [])
        ],
        "notes": [
            {
                "no": n.block_no,
                "type": n.block_type,
                "heading": _pair(n.heading_en, n.heading_ne) if n.heading_en else None,
                "body": _pair(n.body_en, n.body_ne),
                "speaker_note": _pair(n.speaker_note_en, n.speaker_note_ne)
                if n.speaker_note_en
                else None,
                "board_hint": n.board_hint,
            }
            for n in (version.notes or [])
        ],
        "examples": [
            {
                "no": e.example_no,
                "kind": e.kind,
                "difficulty": e.difficulty,
                "prompt": _pair(e.prompt_en, e.prompt_ne),
                "given": _pair(e.given_en, e.given_ne) if e.given_en else None,
                "steps": e.steps or [],
                "answer": _pair(e.answer_en, e.answer_ne) if e.answer_en else None,
                "answer_latex": e.answer_latex,
                "marks": e.marks,
            }
            for e in (version.examples or [])
        ],
        "misconceptions": [
            {
                "wrong": _pair(m.wrong_belief_en, m.wrong_belief_ne),
                "why": _pair(m.why_students_think_en, m.why_students_think_ne)
                if m.why_students_think_en
                else None,
                "correction": _pair(m.correction_en, m.correction_ne),
                "diagnostic": _pair(
                    m.diagnostic_question_en, m.diagnostic_question_ne
                )
                if m.diagnostic_question_en
                else None,
                "severity": m.severity,
            }
            for m in (version.misconceptions or [])
        ],
        "formulas": [
            {
                "name": _pair(f.name_en, f.name_ne),
                "latex": f.latex,
                "spoken": _pair(f.spoken_en, f.spoken_ne),
                "conditions": _pair(f.conditions_en, f.conditions_ne)
                if f.conditions_en
                else None,
                "derivable": bool(f.derivable),
                "must_memorize": bool(f.must_memorize),
            }
            for f in (version.formulas or [])
        ],
        "exam_tips": [
            {
                "type": t.tip_type,
                "body": _pair(t.body_en, t.body_ne),
                "board": t.exam_board,
                "pattern": t.question_pattern,
                "marks": t.typical_marks,
            }
            for t in (version.exam_tips or [])
        ],
        "key_terms": [
            {
                "term": k.term_en,
                "term_ne": k.term_ne,
                "keep_in_english": bool(k.keep_in_english),
                "definition": _pair(k.definition_en, k.definition_ne)
                if k.definition_en
                else None,
            }
            for k in (version.key_terms or [])
        ],
        # media is REFERENCE ONLY — the AI gets alt text, never pixels
        "media": [
            {
                "type": m.media_type,
                "alt": _pair(m.alt_text_en, m.alt_text_ne),
                "caption": _pair(m.caption_en, m.caption_ne) if m.caption_en else None,
            }
            for m in (version.media or [])
        ],
    }


def _estimate_lesson_cost_usd(lesson) -> float:
    """Chapters × measured per-chapter envelope (blueprint ≈ 8-15k prompt /
    3-6k completion — ATEACHER_INTEGRATION_BLUEPRINT §10.1)."""
    from app.services.ai.token_hub import estimate_cost_usd

    chapters = _cfg("lesson_target_chapters", 4) or 4
    prompt_tokens = chapters * 11_500
    completion_tokens = chapters * 4_500
    return estimate_cost_usd("groq", "openai/gpt-oss-120b", prompt_tokens,
                             completion_tokens)


@ai_teacher_bp.route("/lessons", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin", "teacher", "student")
@ai_rate_limit()
def create_lesson():
    # ── 1. Gates first — nothing is spent before they pass ─────────────
    if _kill_switch_on():
        return error_response("AI Teacher is temporarily disabled.", 403)
    try:
        _require_plan_tier("ai_suite")
    except ToolPipelineError as exc:
        return error_response(str(exc), 402)

    allowed_roles = _cfg("allowed_roles", ["student", "teacher"]) or []
    if g.role not in ("superadmin",) and g.role not in allowed_roles:
        return error_response("Your role cannot start AI Teacher lessons.", 403)

    data = request.get_json(silent=True) or {}
    section_id = data.get("section_id")
    topic = (data.get("topic") or "").strip()
    allow_free = bool(_cfg("allow_free_topic", False))

    student_id = None
    student_user_id = None
    if g.role == "student":
        student = Student.query.filter_by(
            user_id=g.user_id, school_id=g.school_id, is_deleted=False
        ).first()
        if not student:
            return error_response("No student profile linked to this account", 404)
        student_id = student.id
        student_user_id = g.user_id
    else:
        sid = data.get("student_id")
        if not sid:
            return error_response("student_id is required", 400)
        student = Student.query.filter_by(
            id=sid, school_id=g.school_id, is_deleted=False
        ).first()
        if not student:
            return error_response("student_id does not match a student at this school", 400)
        student_id = student.id
        student_user_id = student.user_id

    # guardian consent (tutor scope) — platform-enforced for under-13
    from app.models.ai_workbench import GuardianAIConsent

    consent = GuardianAIConsent.query.filter_by(
        school_id=g.school_id, student_id=student_id, granted=True, is_deleted=False
    ).first()
    if consent is None and _cfg("require_guardian_consent", True):
        return error_response(
            "Guardian AI consent has not been granted for this student.", 403
        )

    # hours window for students
    if g.role == "student":
        window = (_cfg("student_hours_window", "06:00-21:00") or "").split("-")
        if len(window) == 2:
            try:
                now = datetime.now().time()
                start = datetime.strptime(window[0].strip(), "%H:%M").time()
                end = datetime.strptime(window[1].strip(), "%H:%M").time()
                if not (start <= now <= end):
                    return error_response(
                        "AI lessons are available between "
                        f"{window[0]} and {window[1]} only.", 403
                    )
            except ValueError:
                pass

    language = data.get("language") or _cfg("default_language", "ne")
    if language not in ("en", "ne", "mixed"):
        return error_response("language must be en|ne|mixed", 400)
    level = data.get("level") or "beginner"
    if level not in ("beginner", "intermediate", "advanced"):
        return error_response("level must be beginner|intermediate|advanced", 400)
    max_minutes = min(
        int(data.get("max_minutes") or _cfg("lesson_max_minutes", 25)),
        int(_cfg("lesson_max_minutes", 25) or 25),
    )

    # ── 2. Resolve content, not prose ──────────────────────────────────
    context_document = None
    grounded = True
    version = None
    section = None
    if section_id:
        section, version = _resolve_published_section(section_id)
        if not section:
            return error_response("Teaching section not found", 404)
        if version is None:
            return error_response(
                "This section has no published content yet — the AI teacher "
                "only teaches published curriculum.", 422
            )
        context_document = _build_context_document(version, language)
    elif topic and allow_free:
        grounded = False
    else:
        return error_response(
            "section_id is required (or enable free-topic lessons in settings)",
            400,
        )

    if topic:
        injected, _why = detect_injection(topic)
        if injected:
            return error_response("Topic failed the safety check.", 400)

    # ── 3. Budget: reserve before the service is called ────────────────
    from app.services.ai.token_hub import _check_quota

    estimated_usd = _estimate_lesson_cost_usd(None)
    estimated_npr = round(estimated_usd * 135, 2)
    ceiling = float(_cfg("monthly_cost_ceiling_npr", 3000) or 0)
    if ceiling and estimated_npr > ceiling:
        return error_response(
            "This lesson exceeds your AI Teacher cost ceiling — raise it in "
            "settings or reduce target chapters.", 429
        )
    try:
        _check_quota(g.school_id, est_cost_usd=estimated_usd)
    except Exception as exc:  # QuotaExceededError → honest 429
        return error_response(f"AI quota exceeded: {exc}", 429)

    # concurrency cap
    live_count = AITeacherLesson.query.filter(
        AITeacherLesson.school_id == g.school_id,
        AITeacherLesson.status.in_(["ready", "teaching", "paused"]),
        AITeacherLesson.is_deleted.is_(False),
    ).count()
    max_concurrent = int(_cfg("max_concurrent_lessons", 25) or 25)
    if live_count >= max_concurrent:
        return error_response(
            "The school is at its concurrent-lesson limit — try again shortly.", 409
        )

    # ── 4. ASchool's row FIRST (our UUID is canonical) ─────────────────
    lesson = AITeacherLesson(
        school_id=g.school_id,
        student_id=student_id,
        student_user_id=student_user_id,
        created_by_id=g.user_id,
        section_id=section.id if section else None,
        content_snapshot_id=version.id if version else None,
        grounded=grounded,
        topic=(topic or (section.title_en if section else None) or "Lesson")[:300],
        persona_slug=data.get("persona_slug") or _cfg("default_persona_slug", "aria"),
        language=language,
        voice=data.get("voice") or _cfg("default_voice", "ne-NP-HemkalaNeural"),
        level=level,
        max_minutes=max_minutes,
        status="pending",
        estimated_cost_npr=estimated_npr,
    )
    db.session.add(lesson)
    db.session.commit()

    # ── 5. Service call (S2S) ───────────────────────────────────────────
    try:
        from app.plugins.modules.ai_teacher.service_client import create_session

        base_url = (
            request.url_root.rstrip("/")
        )
        result = create_session(
            school_id=g.school_id,
            lesson=lesson,
            context_document=context_document or {},
            callback_url=f"{base_url}/api/v1/ai-teacher/webhooks/lesson-event",
            callback_secret_id="primary",
            plaintext_secret=data.get("_plaintext_secret", ""),
        )
    except ServiceUnavailableError as exc:
        lesson.status = "failed"
        lesson.end_reason = "service_unavailable"
        db.session.commit()
        return error_response(
            f"{exc} You can still read the published chapter notes.", 503
        )

    lesson.service_session_id = result.get("service_session_id")
    lesson.status = "ready"
    db.session.commit()

    # Player embed: the player is a Flutter-web build on ITS OWN origin,
    # launched by query params (W4/A2 §5) — context is pulled service-side
    # from the session row, so nothing content-bearing goes in the URL.
    # The 24h service token must reach the browser for the player's API
    # calls; the dashboard CSP needs frame-src for the player origin.
    player_base = (_cfg("player_base_url", "") or "").rstrip("/")
    player_url = None
    service_token = result.get("service_token")
    if player_base and lesson.service_session_id:
        from urllib.parse import urlencode

        player_url = (
            f"{player_base}?"
            + urlencode(
                {
                    "session_id": lesson.service_session_id,
                    "token": service_token or "",
                    "topic": lesson.topic,
                    "user_id": str(lesson.student_user_id or lesson.created_by_id),
                    "autostart": "true",
                }
            )
        )
    return created_response(
        {
            "lesson_id": str(lesson.id),
            "player_url": player_url,
            "service_session_id": lesson.service_session_id,
            # Live monitoring rooms are the service's own socket rooms
            # (keyed by service_session_id), not host-invented lesson rooms.
            "socket_room": (
                f"lesson:{lesson.service_session_id}"
                if lesson.service_session_id
                else None
            ),
            "status": lesson.status,
            "estimated_cost_npr": estimated_npr,
            "grounded": grounded,
            "content_snapshot_id": (
                str(version.id) if version else None
            ),
        }
    )


@ai_teacher_bp.route("/lessons", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
def list_lessons():
    query = AITeacherLesson.query.filter(
        AITeacherLesson.school_id == g.school_id,
        AITeacherLesson.is_deleted.is_(False),
    )
    if g.role == "student":
        query = query.filter(AITeacherLesson.student_user_id == g.user_id)
    elif g.role == "parent":
        from app.models.student import Guardian

        child_ids = [
            gd.student_id
            for gd in Guardian.query.filter_by(user_id=g.user_id, is_deleted=False).all()
        ]
        query = query.filter(AITeacherLesson.student_id.in_(child_ids or ["00000000-0000-0000-0000-000000000000"]))
    else:
        sid = (request.args.get("student_id") or "").strip()
        if sid:
            query = query.filter(AITeacherLesson.student_id == sid)
    status = (request.args.get("status") or "").strip()
    if status:
        query = query.filter(AITeacherLesson.status == status)
    lessons = query.order_by(AITeacherLesson.created_at.desc()).limit(100).all()
    return success_response([l.to_dict() for l in lessons])


@ai_teacher_bp.route("/lessons/<uuid:lesson_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
def get_lesson(lesson_id):
    lesson = AITeacherLesson.query.filter_by(
        id=lesson_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not lesson:
        return error_response("Lesson not found", 404)
    if g.role == "student" and str(lesson.student_user_id) != str(g.user_id):
        return error_response("Forbidden", 403)
    data = lesson.to_dict(include_chapters=True)
    data["messages"] = [
        {
            "role": m.role,
            "speaker_name": m.speaker_name,
            "content": m.content,
            "sequence": m.sequence,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in (lesson.messages or [])
    ]
    return success_response(data)


@ai_teacher_bp.route("/lessons/<uuid:lesson_id>/stop", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
def stop_lesson_route(lesson_id):
    lesson = AITeacherLesson.query.filter_by(
        id=lesson_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not lesson:
        return error_response("Lesson not found", 404)
    if g.role == "student" and str(lesson.student_user_id) != str(g.user_id):
        return error_response("Forbidden", 403)
    if lesson.status in ("ended", "abandoned", "failed"):
        return success_response(lesson.to_dict())
    lesson.status = "ended"
    lesson.end_reason = "user_stopped"
    lesson.ended_at = datetime.now(timezone.utc)
    if lesson.started_at:
        lesson.duration_seconds = int((lesson.ended_at - lesson.started_at).total_seconds())
    db.session.commit()
    return success_response(lesson.to_dict())


@ai_teacher_bp.route("/mastery", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
def mastery():
    """Mastery rollup. Students see their own; parents their children;
    staff any student via ?student_id=."""
    student_id = (request.args.get("student_id") or "").strip()
    if g.role == "student":
        student = Student.query.filter_by(
            user_id=g.user_id, school_id=g.school_id, is_deleted=False
        ).first()
        if not student:
            return error_response("No student profile", 404)
        student_id = str(student.id)
    elif g.role == "parent":
        from app.models.student import Guardian

        child_ids = [
            str(gd.student_id)
            for gd in Guardian.query.filter_by(user_id=g.user_id, is_deleted=False).all()
        ]
        if student_id and student_id not in child_ids:
            return error_response("Forbidden", 403)
        if not student_id:
            return success_response(
                [
                    m.to_dict()
                    for m in AITeacherMastery.query.filter(
                        AITeacherMastery.school_id == g.school_id,
                        AITeacherMastery.student_id.in_(child_ids or ["00000000-0000-0000-0000-000000000000"]),
                        AITeacherMastery.is_deleted.is_(False),
                    ).all()
                ]
            )
    elif not student_id:
        return error_response("student_id is required", 400)

    rows = AITeacherMastery.query.filter_by(
        school_id=g.school_id, student_id=student_id, is_deleted=False
    ).all()
    return success_response([m.to_dict() for m in rows])


@ai_teacher_bp.route("/usage", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def usage():
    """Per-school minutes + cost rollup for the admin Usage & Cost page."""
    from sqlalchemy import func

    month_start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    rows = (
        db.session.query(
            func.count(AITeacherLesson.id),
            func.coalesce(func.sum(AITeacherLesson.duration_seconds), 0),
            func.coalesce(func.sum(AITeacherLesson.cost_npr), 0),
        )
        .filter(
            AITeacherLesson.school_id == g.school_id,
            AITeacherLesson.is_deleted.is_(False),
            AITeacherLesson.created_at >= month_start,
            AITeacherLesson.status.in_(["ended", "abandoned"]),
        )
        .first()
    )
    ceiling = float(_cfg("monthly_cost_ceiling_npr", 3000) or 0)
    spent = float(rows[2] or 0)
    return success_response(
        {
            "lessons_this_month": rows[0],
            "minutes_this_month": round(float(rows[1]) / 60, 1),
            "cost_npr_this_month": round(spent, 2),
            "ceiling_npr": ceiling,
            "ceiling_used_pct": round(spent / ceiling * 100, 1) if ceiling else None,
            "alert": bool(ceiling and spent >= ceiling * float(_cfg("cost_alert_percent", 80) or 80) / 100),
        }
    )


@ai_teacher_bp.route("/webhooks/lesson-event", methods=["POST"])
def webhook_lesson_event():
    """THE SERVICE CALLS THIS. No JWT — HMAC-authenticated, idempotent by
    (lesson_id, event_id). See AT §B.6: results coming home."""
    import hmac as _hmac
    import hashlib as _hashlib

    raw = request.get_data()
    key_id = request.headers.get("X-ASchool-Key", "")
    timestamp = request.headers.get("X-ASchool-Timestamp", "")
    signature = request.headers.get("X-ASchool-Signature", "")
    secrets_map = current_app.config.get("ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})
    secret = secrets_map.get(key_id)
    if not secret:
        # Deployment map not populated → fall back to the encrypted envelope
        # provisioning stored in the school's ai_teacher plugin config
        # (hooks._provision_school). HMAC needs the plaintext, which sha256
        # can never recover — hence the decryptable copy.
        secret = _webhook_secret_for_key(key_id)
    if not secret:
        return error_response("Unknown service key", 401)
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return error_response("Bad timestamp", 401)
    if abs(datetime.now(timezone.utc).timestamp() - ts) > 300:
        return error_response("Stale timestamp", 401)
    expected = _hmac.new(
        secret.encode(), timestamp.encode() + raw, _hashlib.sha256
    ).hexdigest()
    if not _hmac.compare_digest(expected, signature):
        return error_response("Bad signature", 401)

    event = request.get_json(silent=True) or {}
    lesson_id = event.get("lesson_id")
    event_id = event.get("event_id")
    etype = event.get("type", "")
    payload = event.get("payload") or {}

    lesson = AITeacherLesson.query.filter_by(
        id=lesson_id, is_deleted=False
    ).first()
    if not lesson:
        return error_response("Lesson not found", 404)

    return success_response(apply_event(lesson, etype, payload, event_id))


def apply_event(lesson, etype: str, payload: dict, event_id=None) -> dict:
    """Apply one service event to a lesson row — the single applier shared
    by the webhook (service → us) and the reconciler (poll-derived events
    go through identical code, tasks.py). Returns a response-ready dict."""
    from app.models.ai_teacher import (
        AITeacherLearningEvent,
        AITeacherLessonChapter,
        AITeacherMessage,
    )

    if etype == "lesson.started":
        lesson.status = "teaching"
        lesson.started_at = datetime.now(timezone.utc)
    elif etype == "chapter.completed":
        chapter = AITeacherLessonChapter.query.filter_by(
            lesson_id=lesson.id, chapter_no=int(payload.get("chapter_no", 0))
        ).first()
        if not chapter:
            chapter = AITeacherLessonChapter(
                school_id=lesson.school_id, lesson_id=lesson.id,
                chapter_no=int(payload.get("chapter_no", 0)),
            )
            db.session.add(chapter)
        chapter.title = payload.get("title") or chapter.title
        chapter.status = "completed"
        chapter.slide_count = payload.get("slide_count")
        chapter.quiz_score = payload.get("quiz_score")
        chapter.confusion_count = payload.get("confusion_count", 0)
        chapter.outcome_ids = payload.get("outcome_ids") or []
        lesson.chapters_completed = (
            AITeacherLessonChapter.query.filter_by(
                lesson_id=lesson.id, status="completed"
            ).count()
        )
    elif etype == "question.asked":
        message = AITeacherMessage(
            school_id=lesson.school_id,
            lesson_id=lesson.id,
            role="student",
            content=payload.get("text", ""),
            event_id=event_id,
            sequence=payload.get("sequence"),
        )
        db.session.add(message)
        lesson.questions_asked = (lesson.questions_asked or 0) + 1
        # moderation on every student utterance
        from app.services.ai.workbench import moderate

        category, _ = moderate(payload.get("text", ""))
        if category in ("self_harm", "violence"):
            from app.models.ai_workbench import ModerationFlag

            db.session.add(
                ModerationFlag(
                    school_id=lesson.school_id,
                    tool_key="ai_teacher_lesson",
                    severity="critical",
                    snippet=(payload.get("text", "") or "")[:500],
                )
            )
    elif etype == "mastery.updated":
        _upsert_mastery(lesson, payload)
    elif etype == "lesson.summary":
        lesson.summary_text = payload.get("summary")
        lesson.summary_evidence = payload.get("evidence") or {}
    elif etype == "lesson.ended":
        lesson.status = "ended"
        lesson.end_reason = payload.get("reason") or "completed"
        lesson.ended_at = datetime.now(timezone.utc)
        if lesson.started_at:
            lesson.duration_seconds = int(
                (lesson.ended_at - lesson.started_at).total_seconds()
            )
        lesson.chapters_completed = payload.get("chapters_completed", lesson.chapters_completed)
    elif etype == "lesson.error":
        lesson.status = "failed"
        lesson.end_reason = (payload.get("error") or "service_error")[:40]
    elif etype == "usage.reported":
        from app.services.ai.token_hub import (
            estimate_cost_usd,
            reconcile_quota_reservation,
        )

        cost_usd = estimate_cost_usd(
            payload.get("provider", "groq"),
            payload.get("model", "unknown"),
            int(payload.get("prompt_tokens", 0)),
            int(payload.get("completion_tokens", 0)),
        )
        lesson.cost_npr = round(cost_usd * 135, 2)
        lesson.cost_source = "measured"
        db.session.add(
            _usage_log(lesson, payload, cost_usd)
        )
        reconcile_quota_reservation(
            lesson.school_id,
            float(lesson.estimated_cost_npr or 0) / 135,
            cost_usd,
        )
    else:
        return {"ignored": etype}

    db.session.add(
        AITeacherLearningEvent(
            school_id=lesson.school_id,
            lesson_id=lesson.id,
            student_id=lesson.student_id,
            verb=etype.replace(".", "_"),
            object_type="lesson_event",
            object_id=event_id,
            context=payload,
        )
    )
    db.session.commit()
    return {"received": True}


def _webhook_secret_for_key(key_id: str) -> str | None:
    """Plaintext webhook secret for a service key_id, from the encrypted
    envelope provisioning stored in the owning school's plugin config.
    None when the key is unknown or the envelope is unreadable (rotated
    platform key) — the caller then 401s honestly."""
    from app.models.ai_teacher import AITeacherServiceKey
    from app.models.plugin import SchoolPlugin
    from app.plugins.config_schema import decrypt_secret

    key = AITeacherServiceKey.query.filter_by(key_id=key_id).first()
    if not key:
        return None
    sp = SchoolPlugin.query.filter_by(
        school_id=key.school_id, plugin_slug="ai_teacher"
    ).first()
    envelope = (sp.config or {}).get("webhook_secret") if sp else None
    if not isinstance(envelope, dict):
        return None
    return decrypt_secret(envelope)


def _upsert_mastery(lesson, payload):
    from app.models.ai_teacher import AITeacherMastery

    concept_key = (payload.get("concept_key") or "")[:80]
    if not concept_key or not lesson.student_id:
        return
    row = AITeacherMastery.query.filter_by(
        school_id=lesson.school_id,
        student_id=lesson.student_id,
        concept_key=concept_key,
    ).first()
    if not row:
        row = AITeacherMastery(
            school_id=lesson.school_id,
            student_id=lesson.student_id,
            concept_key=concept_key,
            outcome_id=payload.get("outcome_id"),
        )
        db.session.add(row)
    score = float(payload.get("mastery_score", 0))
    row.mastery_score = score
    row.mastery_level = (
        "advanced" if score >= 80 else
        "proficient" if score >= 60 else
        "developing" if score >= 30 else "novice"
    )
    row.last_reviewed_at = datetime.now(timezone.utc)


def _usage_log(lesson, payload, cost_usd):
    from app.models.ai_token import AIUsageLog

    return AIUsageLog(
        school_id=lesson.school_id,
        user_id=lesson.created_by_id,
        feature="ai_teacher:lesson",
        model=payload.get("model", "unknown"),
        provider=payload.get("provider", "ai_teacher_service"),
        prompt_tokens=int(payload.get("prompt_tokens", 0)),
        completion_tokens=int(payload.get("completion_tokens", 0)),
        total_tokens=int(payload.get("total_tokens", 0)),
        latency_ms=int(payload.get("latency_ms", 0)),
        status="success",
        metadata_={"lesson_id": str(lesson.id), "cost_usd": cost_usd},
    )
