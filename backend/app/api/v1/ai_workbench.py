"""ai_workbench API (AW-01/AW-03/AW-05/AW-12 backend surface).

- POST /ai/generate/<tool_key>   — the ONE generic dispatcher
- GET  /ai/tools                 — catalog for the workbench grid
- GET  /ai/tools/<key>/nutrition — AI Nutrition Facts (transparency, A-07)
- GET/PUT /ai/tools/<key>/settings — per-school kill switch + overrides
- GET  /ai/generations/<id>      — provenance for a generation
- GET  /ai/moderation/flags      — counselor review queue (critical flags)

Every route is plugin-gated on ai_suite (free teaser tools pass through —
the dispatcher itself checks min_plan_tier per tool).
"""
from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.services.ai.workbench import AIWorkbenchOrchestrator, ToolPipelineError
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response

workbench_bp = Blueprint("workbench", __name__, url_prefix="/ai")


def _serialize_tool(row, settings=None):
    data = row.to_dict()
    data["enabled"] = settings.enabled if settings else True
    data["field_overrides"] = (settings.field_overrides if settings else None) or {}
    return data


@workbench_bp.route("/generate/<tool_key>", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher", "student", "parent")
def generate_with_tool(tool_key):
    """The single generic entry-point for every ai_workbench tool."""
    payload = request.get_json(silent=True) or {}
    try:
        result = AIWorkbenchOrchestrator.run(tool_key, payload)
    except ToolPipelineError as exc:
        return error_response(str(exc), exc.status_code)
    except Exception as exc:  # noqa: BLE001 — honest 502, never a fake result
        current_app.logger.exception("workbench generation failed: %s", tool_key)
        return error_response(f"AI generation failed: {exc}", 502)
    return created_response(result)


@workbench_bp.route("/tools", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def list_tools():
    """Catalog for /dashboard/ai-workbench — grouped by category."""
    from app.models.ai_workbench import AIToolRegistry, SchoolAIToolSettings

    rows = AIToolRegistry.query.filter(
        AIToolRegistry.is_deleted.is_(False),
        AIToolRegistry.status != "disabled",
    ).all()
    settings = {
        s.tool_key: s
        for s in SchoolAIToolSettings.query.filter_by(
            school_id=g.school_id, is_deleted=False
        ).all()
    }
    tools = [_serialize_tool(r, settings.get(r.tool_key)) for r in rows]
    # role filter
    visible = [
        t
        for t in tools
        if not t.get("roles_allowed")
        or (g.role in (t["roles_allowed"] or []))
        or g.role == "superadmin"
    ]
    catalog: dict = {}
    for t in visible:
        catalog.setdefault(t["category"], []).append(t)
    return success_response({"tools": visible, "catalog": catalog})


@workbench_bp.route("/tools/<tool_key>/nutrition", methods=["GET"])
@jwt_required()
@school_required
def tool_nutrition(tool_key):
    """AI Nutrition Facts for one tool (public to any authenticated member)."""
    from app.models.ai_workbench import AINutritionFacts

    facts = AINutritionFacts.query.filter_by(
        tool_key=tool_key, is_deleted=False
    ).first()
    if facts is None:
        return error_response("No nutrition facts registered for this tool", 404)
    return success_response(facts.to_dict())


@workbench_bp.route("/tools/<tool_key>/settings", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
def get_tool_settings(tool_key):
    from app.models.ai_workbench import SchoolAIToolSettings

    row = SchoolAIToolSettings.query.filter_by(
        school_id=g.school_id, tool_key=tool_key, is_deleted=False
    ).first()
    return success_response(
        {
            "tool_key": tool_key,
            "enabled": row.enabled if row else True,
            "field_overrides": (row.field_overrides if row else None) or {},
            "custom_prompt_suffix": row.custom_prompt_suffix if row else None,
        }
    )


@workbench_bp.route("/tools/<tool_key>/settings", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
def update_tool_settings(tool_key):
    """AW-05: kill switch + field overrides take effect within one request
    (the dispatcher reads this row on every generation)."""
    from app.models.ai_workbench import SchoolAIToolSettings
    from extensions import db

    row = SchoolAIToolSettings.query.filter_by(
        school_id=g.school_id, tool_key=tool_key, is_deleted=False
    ).first()
    if row is None:
        row = SchoolAIToolSettings(school_id=g.school_id, tool_key=tool_key)
        db.session.add(row)

    data = request.get_json(silent=True) or {}
    if "enabled" in data:
        row.enabled = bool(data["enabled"])
    if "field_overrides" in data:
        row.field_overrides = data["field_overrides"] or {}
    if "custom_prompt_suffix" in data:
        row.custom_prompt_suffix = data["custom_prompt_suffix"]
    db.session.commit()
    return success_response(
        {
            "tool_key": tool_key,
            "enabled": row.enabled,
            "field_overrides": row.field_overrides or {},
            "custom_prompt_suffix": row.custom_prompt_suffix,
        }
    )


@workbench_bp.route("/generations/<uuid:generation_id>", methods=["GET"])
@jwt_required()
@school_required
def get_generation(generation_id):
    """Provenance for one generation (ledger transparency)."""
    from app.models.ai_workbench import AIGeneration

    row = AIGeneration.query.filter_by(
        id=generation_id, school_id=g.school_id, is_deleted=False
    ).first()
    if row is None:
        return error_response("Generation not found", 404)
    return success_response(
        {
            "id": str(row.id),
            "tool_key": row.tool_key,
            "provider": row.provider,
            "model": row.model,
            "status": row.status,
            "cost_usd": float(row.cost_usd or 0),
            "prompt_sha256": row.prompt_sha256,
            "schema_name": row.schema_name,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    )


@workbench_bp.route("/moderation/flags", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
def moderation_flags():
    """Counselor review queue — unresolved flags, critical first."""
    from app.models.ai_workbench import ModerationFlag
    from sqlalchemy import case

    rows = (
        ModerationFlag.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(
            case(
                (ModerationFlag.severity == "critical", 0),
                (ModerationFlag.severity == "high", 1),
                (ModerationFlag.severity == "medium", 2),
                else_=3,
            ),
            ModerationFlag.created_at.desc(),
        )
        .limit(100)
        .all()
    )
    return success_response(
        [
            {
                "id": str(r.id),
                "source_type": r.source_type,
                "source_id": str(r.source_id),
                "student_id": str(r.student_id) if r.student_id else None,
                "severity": r.severity,
                "category": r.category,
                "snippet": r.snippet,
                "resolved": bool(r.resolved),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    )


@workbench_bp.route("/moderation/flags/<uuid:flag_id>/resolve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
def resolve_flag(flag_id):
    from app.models.ai_workbench import ModerationFlag
    from datetime import datetime, timezone
    from extensions import db

    flag = ModerationFlag.query.filter_by(
        id=flag_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not flag:
        return error_response("Flag not found", 404)
    flag.resolved = True
    flag.resolved_by_id = g.user_id
    flag.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return success_response({"resolved": True})


# ── AW-05: AI Content Library CRUD ────────────────────────────────────────


@workbench_bp.route("/library", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def list_library():
    """Saved AI artifacts. private = own only; school = whole school;
    district/public_template need explicit visibility."""
    from app.models.ai_workbench import AIContentLibraryItem

    query = AIContentLibraryItem.query.filter(
        AIContentLibraryItem.school_id == g.school_id,
        AIContentLibraryItem.is_deleted.is_(False),
    )
    tool_key = request.args.get("tool_key")
    if tool_key:
        query = query.filter(AIContentLibraryItem.tool_key == tool_key)
    if g.role != "superadmin" and g.role != "school_admin":
        query = query.filter(
            (AIContentLibraryItem.owner_id == g.user_id)
            | (AIContentLibraryItem.visibility.in_(("school", "district", "public_template")))
        )
    items = query.order_by(AIContentLibraryItem.created_at.desc()).limit(100).all()
    return success_response(
        [
            {
                "id": str(i.id),
                "tool_key": i.tool_key,
                "title": i.title,
                "content": i.content,
                "visibility": i.visibility,
                "owner_id": str(i.owner_id) if i.owner_id else None,
                "tags": i.tags or [],
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ]
    )


@workbench_bp.route("/library", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def save_to_library():
    from app.models.ai_workbench import AIContentLibraryItem
    from extensions import db

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    content = data.get("content")
    if not title or content is None:
        return error_response("title and content are required", 400)
    visibility = data.get("visibility") or "private"
    if visibility not in ("private", "school", "district", "public_template"):
        return error_response("invalid visibility", 400)
    if g.role not in ("superadmin", "school_admin") and visibility in ("district", "public_template"):
        return error_response("Only school admins can publish beyond school visibility", 403)

    item = AIContentLibraryItem(
        school_id=g.school_id,
        tool_key=data.get("tool_key") or "unknown",
        title=title[:300],
        content=content,
        visibility=visibility,
        owner_id=g.user_id,
        generation_id=data.get("generation_id"),
        tags=data.get("tags") or [],
    )
    db.session.add(item)
    db.session.commit()
    return created_response({"id": str(item.id), "title": item.title})


@workbench_bp.route("/library/<uuid:item_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def delete_library_item(item_id):
    from app.models.ai_workbench import AIContentLibraryItem
    from extensions import db

    item = AIContentLibraryItem.query.filter_by(
        id=item_id, school_id=g.school_id, is_deleted=False
    ).first()
    if item is None:
        return error_response("Library item not found", 404)
    if item.owner_id != g.user_id and g.role not in ("superadmin", "school_admin"):
        return error_response("You can only delete your own items", 403)
    item.is_deleted = True
    db.session.commit()
    return success_response({"deleted": True})


# ── AW-07: IEP drafter — the strictest gate in the catalog ────────────────


def _can_review_iep(user) -> bool:
    """Hard-coded reviewer gate until the real RBAC editor lands (plan)."""
    return user.role in ("principal", "special_ed_coordinator", "superadmin") or (
        bool((user.permissions or {}).get("can_review_iep"))
    )


@workbench_bp.route("/iep", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def draft_iep():
    """Generate an IEP DRAFT (status stays draft — never active on create).
    Every goal must carry evidence refs; the reviewer gate applies at
    activation time, not draft time."""
    from app.models.ai_workbench import IEPPlan
    from app.models.student import Student
    from extensions import db

    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    student = Student.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first() if student_id else None
    if student is None:
        return error_response("student_id does not match a student at this school", 400)

    from app.services.ai.token_hub import AITokenHub
    from app.utils.llm_output import parse_and_validate

    context = (data.get("context") or "").strip()
    result = AITokenHub.request(
        school_id=g.school_id, user_id=g.user_id, feature="iep:draft",
        messages=[
            {"role": "system", "content":
                "You draft Individualized Education Plan goals for school "
                "staff. Every goal MUST cite the evidence it is based on. "
                "JSON only: {\"goals\": [{\"statement\": str, \"criteria\": str, "
                "\"evidence_refs\": [str]}], \"accommodations\": [str]}"},
            {"role": "user", "content":
                f"Student: {student.first_name} {student.last_name} "
                f"(grade {student.class_id or 'n/a'}). Context/assessments: {context}"},
        ],
        model="smart", max_tokens=2000, temperature=0.2,
    )
    try:
        parsed = parse_and_validate(result["text"], required=["goals"])
    except ValueError as exc:
        return error_response(f"IEP draft failed validation: {exc}", 502)

    # evidence-citation required per goal (plan requirement)
    goals = parsed.get("goals", [])
    missing_evidence = [
        i for i, goal in enumerate(goals) if not goal.get("evidence_refs")
    ]
    if missing_evidence:
        return error_response(
            f"AI draft rejected: goals {missing_evidence} lack evidence citations "
            "(plan requires evidence per goal) — regenerate with assessments attached",
            502,
        )

    plan = IEPPlan(
        school_id=g.school_id,
        student_id=student.id,
        created_by_id=g.user_id,
        goals=goals,
        accommodations=parsed.get("accommodations", []),
        status="draft",
    )
    db.session.add(plan)
    db.session.commit()
    return created_response(
        {
            "id": str(plan.id),
            "status": plan.status,
            "human_review_required": plan.human_review_required,
            "goals": goals,
            "accommodations": plan.accommodations,
        }
    )


@workbench_bp.route("/iep/<uuid:plan_id>/review", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def review_iep(plan_id):
    """Reviewer action: activate/reject a draft. Gate: principal,
    special_ed_coordinator, superadmin, or explicit can_review_iep."""
    from app.models.ai_workbench import IEPPlan
    from app.models.user import User
    from datetime import datetime, timezone
    from extensions import db

    reviewer = User.query.get(g.user_id)
    if reviewer is None or not _can_review_iep(reviewer):
        return error_response(
            "IEP activation requires a principal, special-education "
            "coordinator, or a user with the can_review_iep permission.", 403,
        )
    plan = IEPPlan.query.filter_by(
        id=plan_id, school_id=g.school_id, is_deleted=False
    ).first()
    if plan is None:
        return error_response("IEP plan not found", 404)
    if plan.status not in ("draft", "in_review"):
        return error_response(f"Cannot review an IEP in status {plan.status}", 422)

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    if action not in ("activate", "reject", "mark_in_review"):
        return error_response("action must be activate|reject|mark_in_review", 400)

    plan.status = {
        "activate": "active",
        "reject": "rejected",
        "mark_in_review": "in_review",
    }[action]
    plan.reviewed_by_id = g.user_id
    plan.reviewed_at = datetime.now(timezone.utc)
    plan.review_notes = data.get("notes")
    plan.human_review_required = True  # hard-true, not district-toggleable
    db.session.commit()
    return success_response(
        {"id": str(plan.id), "status": plan.status,
         "reviewed_by": str(g.user_id)}
    )


@workbench_bp.route("/iep", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def list_ieps():
    from app.models.ai_workbench import IEPPlan

    query = IEPPlan.query.filter(
        IEPPlan.school_id == g.school_id, IEPPlan.is_deleted.is_(False)
    )
    status = request.args.get("status")
    if status:
        query = query.filter(IEPPlan.status == status)
    plans = query.order_by(IEPPlan.created_at.desc()).limit(50).all()
    return success_response(
        [
            {
                "id": str(p.id),
                "student_id": str(p.student_id),
                "status": p.status,
                "human_review_required": p.human_review_required,
                "goals_count": len(p.goals or []),
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in plans
        ]
    )
