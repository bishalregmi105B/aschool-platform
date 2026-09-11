"""AW-06 tutor API — plan → session → turns → close.

Consent-gated (guardian must have granted tutor scope), role-gated to
students + staff, per-turn metering through the hub.
"""
from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.services.ai.tutor_engine import TutorEngine
from app.services.ai.workbench import ToolPipelineError
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response

tutor_bp = Blueprint("tutor", __name__, url_prefix="/tutor")


@tutor_bp.route("/plans", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def create_plan():
    """Create a tutor session plan. Students plan for themselves; staff plan
    for any student in their school."""
    from app.models.ai_workbench import GuardianAIConsent, TutorSessionPlan
    from app.models.student import Student
    from extensions import db

    data = request.get_json(silent=True) or {}
    topic = (data.get("topic") or "").strip()
    if not topic:
        return error_response("topic is required", 400)

    if g.role == "student":
        student = Student.query.filter_by(
            user_id=g.user_id, school_id=g.school_id, is_deleted=False
        ).first()
        if student is None:
            return error_response("No student profile linked to this account", 404)
        student_id = student.id
    else:
        student_id = data.get("student_id")
        st = Student.query.filter_by(
            id=student_id, school_id=g.school_id, is_deleted=False
        ).first() if student_id else None
        if st is None:
            return error_response("student_id does not match a student at this school", 400)
        student_id = st.id

    # consent gate (AW-04): tutor scope for this student
    # G-04: the consent SCOPE is enforced — a tools-only grant does not
    # unlock tutoring. Legacy NULL-scope rows stay honored as full grants.
    from sqlalchemy import or_ as _or

    consent = (
        GuardianAIConsent.query.filter(
            GuardianAIConsent.school_id == g.school_id,
            GuardianAIConsent.student_id == student_id,
            GuardianAIConsent.granted.is_(True),
            GuardianAIConsent.is_deleted.is_(False),
            _or(
                GuardianAIConsent.scope.is_(None),
                GuardianAIConsent.scope.in_(["tutor", "all"]),
            ),
        )
        .first()
    )
    if consent is None:
        return error_response(
            "Guardian AI consent has not been granted for this student.", 403
        )

    plan = TutorSessionPlan(
        school_id=g.school_id,
        student_id=student_id,
        created_by_id=g.user_id,
        subject_id=data.get("subject_id"),
        topic=topic[:300],
        grade=data.get("grade"),
        learning_objective=data.get("learning_objective"),
        socratic_focus=data.get("socratic_focus") or "guide",
        exam_mode=bool(data.get("exam_mode")),
        max_turns=int(data.get("max_turns", 20)),
    )
    db.session.add(plan)
    db.session.commit()
    return created_response({"plan_id": str(plan.id), "topic": plan.topic})


@tutor_bp.route("/sessions", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def start_session():
    from app.models.ai_workbench import TutorSessionPlan
    from extensions import db

    data = request.get_json(silent=True) or {}
    plan = TutorSessionPlan.query.filter_by(
        id=data.get("plan_id"), school_id=g.school_id, is_deleted=False
    ).first()
    if plan is None:
        return error_response("Plan not found", 404)
    try:
        session = TutorEngine.start_session(plan, g.school_id, plan.student_id)
    except ToolPipelineError as exc:
        return error_response(str(exc), exc.status_code)
    return created_response({"session_id": str(session.id), "status": session.status})


@tutor_bp.route("/sessions/<uuid:session_id>/turn", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def tutor_turn(session_id):
    from app.models.ai_workbench import TutorSession

    session = TutorSession.query.filter_by(
        id=session_id, school_id=g.school_id, is_deleted=False
    ).first()
    if session is None:
        return error_response("Session not found", 404)
    data = request.get_json(silent=True) or {}
    text = (data.get("message") or "").strip()
    if not text:
        return error_response("message is required", 400)
    try:
        result = TutorEngine.student_turn(session, text)
    except ToolPipelineError as exc:
        return error_response(str(exc), exc.status_code)
    except Exception as exc:  # noqa: BLE001 — honest 502
        current_app.logger.exception("tutor turn failed")
        return error_response(f"Tutor turn failed: {exc}", 502)
    return success_response(result)


@tutor_bp.route("/sessions/<uuid:session_id>/close", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def close_session(session_id):
    from app.models.ai_workbench import TutorSession

    session = TutorSession.query.filter_by(
        id=session_id, school_id=g.school_id, is_deleted=False
    ).first()
    if session is None:
        return error_response("Session not found", 404)
    data = request.get_json(silent=True) or {}
    result = TutorEngine.close_session(session, data.get("reflection"))
    return success_response(result)


@tutor_bp.route("/sessions/<uuid:session_id>/messages", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def session_messages(session_id):
    """Transcript — visible to the student and school staff (AW-07
    guardian-visible transcripts read this via the parent portal)."""
    from app.models.ai_workbench import TutorMessage, TutorSession

    session = TutorSession.query.filter_by(
        id=session_id, school_id=g.school_id, is_deleted=False
    ).first()
    if session is None:
        return error_response("Session not found", 404)
    msgs = (
        TutorMessage.query.filter_by(session_id=session_id, is_deleted=False)
        .order_by(TutorMessage.created_at.asc())
        .all()
    )
    return success_response(
        [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "flagged": bool(m.flagged),
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ]
    )


@tutor_bp.route("/students/<uuid:student_id>/monitor", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def tutor_monitor(student_id):
    """Teacher aggregate monitor (poll, v1): session counts + recent topics."""
    from app.models.ai_workbench import TutorSession, TutorSessionPlan
    from sqlalchemy import func

    plan_ids = [
        p.id
        for p in TutorSessionPlan.query.filter_by(
            school_id=g.school_id, student_id=student_id, is_deleted=False
        ).all()
    ]
    if not plan_ids:
        return success_response({"sessions": 0, "topics": []})
    sessions = TutorSession.query.filter(
        TutorSession.plan_id.in_(plan_ids), TutorSession.is_deleted.is_(False)
    ).all()
    topics = [
        p.topic
        for p in TutorSessionPlan.query.filter(
            TutorSessionPlan.id.in_(plan_ids)
        ).order_by(TutorSessionPlan.created_at.desc())
        .limit(10)
        .all()
    ]
    return success_response(
        {
            "sessions": len(sessions),
            "open_sessions": sum(1 for s in sessions if s.status == "open"),
            "total_turns": sum(s.turns_used or 0 for s in sessions),
            "topics": topics,
        }
    )

