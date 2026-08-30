"""Emergency Management API — alerts, evacuation plans, headcount."""
import uuid
from datetime import datetime

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required

from app.models.emergency import EmergencyAlert, EmergencyHeadcount, EvacuationPlan
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

emergency_bp = Blueprint("emergency", __name__, url_prefix="/emergency")


# ── Alerts ─────────────────────────────────────────────────


@emergency_bp.route("/alerts", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("emergency")
def list_alerts():
    query = EmergencyAlert.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    items, meta = paginate(query.order_by(EmergencyAlert.created_at.desc()))
    return success_response([_alert_dict(a) for a in items], meta={"pagination": meta})


@emergency_bp.route("/alerts", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("emergency")
@role_required("superadmin", "school_admin")
def trigger_alert():
    data = request.get_json(silent=True) or {}
    valid_types = {"earthquake", "fire", "flood", "lockdown", "medical", "drill", "other"}
    if not data.get("alert_type") or data["alert_type"] not in valid_types:
        return error_response(f"alert_type is required (one of: {', '.join(sorted(valid_types))})", 400)
    if not data.get("title"):
        return error_response("title is required", 400)
    claims = get_jwt()
    alert = EmergencyAlert(
        school_id=g.school_id,
        triggered_by_id=claims.get("sub"),
        triggered_at=datetime.utcnow(),
    )
    for key in ("alert_type", "title", "description"):
        if key in data:
            setattr(alert, key, data[key])
    db.session.add(alert)
    db.session.commit()

    from app.plugins.events import emit
    emit(
        "emergency.alert_broadcast",
        school_id=str(g.school_id),
        alert_id=str(alert.id),
        alert_type=alert.alert_type or "general",
        title=alert.title or "Emergency Alert",
    )

    return created_response(_alert_dict(alert))


@emergency_bp.route("/alerts/<uuid:alert_id>/resolve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("emergency")
@role_required("superadmin", "school_admin")
def resolve_alert(alert_id):
    alert = EmergencyAlert.query.filter_by(
        id=alert_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not alert:
        return error_response("Alert not found", 404)
    data = request.get_json(silent=True) or {}
    valid_status = {"active", "resolved", "false_alarm"}
    if data.get("status") and data["status"] not in valid_status:
        return error_response(f"status must be one of: {', '.join(sorted(valid_status))}", 400)
    alert.status = data.get("status") or "resolved"
    alert.resolved_at = datetime.utcnow()
    db.session.commit()
    return success_response(_alert_dict(alert))


# ── Evacuation Plans ──────────────────────────────────────


@emergency_bp.route("/plans", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("emergency")
def list_plans():
    query = EvacuationPlan.query.filter_by(school_id=g.school_id, is_deleted=False)
    items, meta = paginate(query.order_by(EvacuationPlan.name))
    return success_response([_plan_dict(p) for p in items], meta={"pagination": meta})


@emergency_bp.route("/plans", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("emergency")
@role_required("superadmin", "school_admin")
def create_plan():
    data = request.get_json(silent=True) or {}
    if not (data.get("name") or "").strip():
        return error_response("name is required", 400)
    plan = EvacuationPlan(school_id=g.school_id)
    for key in ("name", "emergency_type", "instructions", "assembly_points", "floor_plan_url", "is_active"):
        if key in data:
            setattr(plan, key, data[key])
    db.session.add(plan)
    db.session.commit()
    return created_response(_plan_dict(plan))


@emergency_bp.route("/plans/<uuid:plan_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("emergency")
@role_required("superadmin", "school_admin")
def update_plan(plan_id):
    plan = EvacuationPlan.query.filter_by(
        id=plan_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not plan:
        return error_response("Plan not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("name", "emergency_type", "instructions", "assembly_points", "floor_plan_url", "is_active"):
        if key in data:
            setattr(plan, key, data[key])
    db.session.commit()
    return success_response(_plan_dict(plan))


@emergency_bp.route("/plans/<uuid:plan_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("emergency")
@role_required("superadmin", "school_admin")
def delete_plan(plan_id):
    plan = EvacuationPlan.query.filter_by(
        id=plan_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not plan:
        return error_response("Plan not found", 404)
    plan.soft_delete()
    return success_response({"deleted": True})


# ── Headcount ──────────────────────────────────────────────


@emergency_bp.route("/alerts/<uuid:alert_id>/headcount", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("emergency")
def list_headcounts(alert_id):
    query = EmergencyHeadcount.query.filter_by(
        alert_id=alert_id, school_id=g.school_id, is_deleted=False
    )
    items, meta = paginate(query.order_by(EmergencyHeadcount.submitted_at.desc()))
    return success_response([_headcount_dict(h) for h in items], meta={"pagination": meta})


@emergency_bp.route("/alerts/<uuid:alert_id>/headcount", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("emergency")
def submit_headcount(alert_id):
    alert = EmergencyAlert.query.filter_by(
        id=alert_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not alert:
        return error_response("Alert not found", 404)
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    # Integer guards — raw strings into Integer columns would raise DataError → 500
    for int_key in ("total_expected", "total_present"):
        if int_key in data and data[int_key] is not None:
            try:
                data[int_key] = int(data[int_key])
            except (TypeError, ValueError):
                return error_response(f"{int_key} must be an integer", 400)
    # UUID-array guard — missing_student_ids is a Postgres UUID[] column
    if data.get("missing_student_ids") is not None:
        if not isinstance(data["missing_student_ids"], list):
            return error_response("missing_student_ids must be a list of student ids", 400)
        cleaned = []
        for item in data["missing_student_ids"]:
            try:
                cleaned.append(uuid.UUID(str(item)))
            except (TypeError, ValueError, AttributeError):
                return error_response(f"missing_student_ids contains an invalid student id: {item}", 400)
        data["missing_student_ids"] = cleaned
    hc = EmergencyHeadcount(
        school_id=g.school_id,
        alert_id=alert_id,
        submitted_by_id=claims.get("sub"),
        submitted_at=datetime.utcnow(),
    )
    for key in ("class_id", "section_id", "total_expected", "total_present", "missing_student_ids"):
        if key in data:
            setattr(hc, key, data[key])
    db.session.add(hc)
    db.session.commit()
    return created_response(_headcount_dict(hc))


# ── Serializers ────────────────────────────────────────────


def _alert_dict(a):
    return {
        "id": str(a.id),
        "alert_type": a.alert_type,
        "title": a.title,
        "description": a.description,
        "triggered_by_id": str(a.triggered_by_id) if a.triggered_by_id else None,
        "triggered_at": str(a.triggered_at) if a.triggered_at else None,
        "resolved_at": str(a.resolved_at) if a.resolved_at else None,
        "status": a.status,
        "sms_sent": a.sms_sent,
        "push_sent": a.push_sent,
    }


def _plan_dict(p):
    return {
        "id": str(p.id),
        "name": p.name,
        "emergency_type": p.emergency_type,
        "instructions": p.instructions,
        "assembly_points": p.assembly_points,
        "floor_plan_url": p.floor_plan_url,
        "last_drilled_at": str(p.last_drilled_at) if p.last_drilled_at else None,
        "is_active": p.is_active,
    }


def _headcount_dict(h):
    return {
        "id": str(h.id),
        "alert_id": str(h.alert_id),
        "class_id": str(h.class_id) if h.class_id else None,
        "section_id": str(h.section_id) if h.section_id else None,
        "total_expected": h.total_expected,
        "total_present": h.total_present,
        "missing_student_ids": [str(s) for s in (h.missing_student_ids or [])],
        "submitted_by_id": str(h.submitted_by_id) if h.submitted_by_id else None,
        "submitted_at": str(h.submitted_at) if h.submitted_at else None,
    }
