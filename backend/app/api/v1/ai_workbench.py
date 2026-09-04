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
