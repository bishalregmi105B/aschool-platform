"""Incident & Behavior Management API — incidents, witness statements, actions."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.incident import Incident, WitnessStatement, IncidentAction
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

incidents_bp = Blueprint("incidents", __name__, url_prefix="/incidents")


@incidents_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incidents")
def list_incidents():
    query = Incident.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    severity = request.args.get("severity")
    if severity:
        query = query.filter_by(severity=severity)
    incident_type = request.args.get("type")
    if incident_type:
        query = query.filter_by(incident_type=incident_type)
    items, meta = paginate(query.order_by(Incident.created_at.desc()))
    return success_response([_incident_dict(i) for i in items], meta={"pagination": meta})


@incidents_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incidents")
@role_required("superadmin", "school_admin", "teacher")
def create_incident():
    data = request.get_json(silent=True) or {}
    incident = Incident(school_id=g.school_id, reported_by_id=g.current_user.id)
    for key in ("title", "description", "incident_type", "severity",
                "occurred_at", "location", "involved_student_ids"):
        if key in data:
            setattr(incident, key, data[key])
    db.session.add(incident)
    db.session.commit()
    return created_response(_incident_dict(incident))


@incidents_bp.route("/<uuid:incident_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incidents")
def get_incident(incident_id):
    incident = Incident.query.filter_by(
        id=incident_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not incident:
        return error_response("Incident not found", 404)
    return success_response(_incident_detail(incident))


@incidents_bp.route("/<uuid:incident_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("incidents")
@role_required("superadmin", "school_admin")
def update_incident(incident_id):
    incident = Incident.query.filter_by(
        id=incident_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not incident:
        return error_response("Incident not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("title", "description", "incident_type", "severity",
                "status", "resolution", "resolved_at", "location"):
        if key in data:
            setattr(incident, key, data[key])
    db.session.commit()
    return success_response(_incident_dict(incident))


# ── Witness Statements ─────────────────────────────────────


@incidents_bp.route("/<uuid:incident_id>/statements", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incidents")
def list_statements(incident_id):
    items = WitnessStatement.query.filter_by(
        incident_id=incident_id, school_id=g.school_id, is_deleted=False
    ).all()
    return success_response([_statement_dict(s) for s in items])


@incidents_bp.route("/<uuid:incident_id>/statements", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incidents")
@role_required("superadmin", "school_admin", "teacher")
def add_statement(incident_id):
    data = request.get_json(silent=True) or {}
    stmt = WitnessStatement(
        incident_id=incident_id,
        school_id=g.school_id,
        witness_id=data.get("witness_id", g.current_user.id),
        statement=data.get("statement", ""),
    )
    db.session.add(stmt)
    db.session.commit()
    return created_response(_statement_dict(stmt))


# ── Actions ────────────────────────────────────────────────


@incidents_bp.route("/<uuid:incident_id>/actions", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incidents")
def list_actions(incident_id):
    items = IncidentAction.query.filter_by(
        incident_id=incident_id, school_id=g.school_id, is_deleted=False
    ).all()
    return success_response([_action_dict(a) for a in items])


@incidents_bp.route("/<uuid:incident_id>/actions", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incidents")
@role_required("superadmin", "school_admin")
def add_action(incident_id):
    data = request.get_json(silent=True) or {}
    action = IncidentAction(
        incident_id=incident_id,
        school_id=g.school_id,
        taken_by_id=g.current_user.id,
    )
    for key in ("action_type", "description", "taken_at", "student_id"):
        if key in data:
            setattr(action, key, data[key])
    db.session.add(action)
    db.session.commit()
    return created_response(_action_dict(action))


# ── Serializers ────────────────────────────────────────────


def _incident_dict(i):
    return {
        "id": str(i.id), "title": i.title, "description": i.description,
        "incident_type": i.incident_type, "severity": i.severity,
        "status": i.status, "location": i.location,
        "occurred_at": str(i.occurred_at) if i.occurred_at else None,
        "reported_by_id": str(i.reported_by_id),
        "reported_by_name": i.reported_by.full_name if getattr(i, "reported_by", None) else None,
        "involved_student_ids": [str(s) for s in (i.involved_student_ids or [])],
        "created_at": str(i.created_at),
    }


def _incident_detail(i):
    d = _incident_dict(i)
    d["witness_statements"] = [_statement_dict(s) for s in (i.witness_statements or [])]
    d["actions"] = [_action_dict(a) for a in (i.actions or [])]
    d["resolution"] = i.resolution
    d["resolved_at"] = str(i.resolved_at) if i.resolved_at else None
    return d


def _statement_dict(s):
    return {
        "id": str(s.id), "incident_id": str(s.incident_id),
        "witness_id": str(s.witness_id), "statement": s.statement,
        "recorded_at": str(s.recorded_at) if s.recorded_at else None,
    }


def _action_dict(a):
    return {
        "id": str(a.id), "incident_id": str(a.incident_id),
        "action_type": a.action_type, "description": a.description,
        "taken_by_id": str(a.taken_by_id) if a.taken_by_id else None,
        "taken_at": str(a.taken_at) if a.taken_at else None,
        "student_id": str(a.student_id) if a.student_id else None,
    }
