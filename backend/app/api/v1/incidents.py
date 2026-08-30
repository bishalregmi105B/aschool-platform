"""Incident & Behavior Management API — incidents, witness statements, actions."""
import uuid as uuid_mod
from datetime import date, datetime

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.incident import Incident, WitnessStatement, IncidentAction
from app.models.student import Student
from app.models.user import User
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
    # the web incidents page filters by title as the user types (?search=)
    search = request.args.get("search")
    if search:
        query = query.filter(Incident.title.ilike(f"%{search}%"))
    items, meta = paginate(query.order_by(Incident.created_at.desc()))
    return success_response([_incident_dict(i) for i in items], meta={"pagination": meta})


@incidents_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incidents")
@role_required("superadmin", "school_admin", "teacher")
def create_incident():
    data = request.get_json(silent=True) or {}
    valid_types = {"bullying", "fighting", "vandalism", "theft", "medical", "behavioral", "other"}
    if not data.get("title"):
        return error_response("title is required", 400)
    if not data.get("incident_type") or data["incident_type"] not in valid_types:
        return error_response(f"incident_type is required (one of: {', '.join(sorted(valid_types))})", 400)
    occurred_at = _parse_datetime(data.get("occurred_at"))
    if data.get("occurred_at") and occurred_at is None:
        return error_response("occurred_at must be an ISO datetime", 400)
    student_ids, id_err = _parse_student_ids(data.get("involved_student_ids"))
    if id_err:
        return error_response(id_err, 400)
    if student_ids:
        # school-scope check — a valid-UUID id from ANOTHER school must not be
        # accepted (it would both store a foreign reference and let the
        # serializer leak that student's name across tenants)
        found = {
            s.id
            for s in Student.query.filter(
                Student.id.in_(student_ids), Student.school_id == g.school_id
            ).all()
        }
        missing = [str(sid) for sid in student_ids if sid not in found]
        if missing:
            return error_response(
                f"involved_student_ids contains a student not at this school: {', '.join(missing)}",
                400,
            )
    incident = Incident(school_id=g.school_id, reported_by_id=g.current_user.id)
    for key in ("title", "description", "incident_type", "severity",
                "location", "involved_student_ids"):
        if key in data:
            setattr(incident, key, data[key])
    incident.occurred_at = occurred_at
    if student_ids is not None:
        incident.involved_student_ids = student_ids
    db.session.add(incident)
    db.session.commit()

    from app.plugins.events import emit
    emit(
        "incident.created",
        school_id=str(g.school_id),
        incident_id=str(incident.id),
        severity=incident.severity or "low",
        title=incident.title or "",
    )

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
    if data.get("status") and data["status"] not in {"reported", "investigating", "resolved", "closed"}:
        return error_response("status must be one of: reported, investigating, resolved, closed", 400)
    resolved_at = _parse_datetime(data.get("resolved_at"))
    if data.get("resolved_at") and resolved_at is None:
        return error_response("resolved_at must be an ISO datetime", 400)
    for key in ("title", "description", "incident_type", "severity",
                "status", "resolution", "location"):
        if key in data:
            setattr(incident, key, data[key])
    if resolved_at is not None:
        incident.resolved_at = resolved_at
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
    incident = Incident.query.filter_by(
        id=incident_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not incident:
        return error_response("Incident not found", 404)
    data = request.get_json(silent=True) or {}
    if not (data.get("statement") or "").strip():
        return error_response("statement is required", 400)
    witness_id = data.get("witness_id", g.current_user.id)
    if witness_id and not User.query.filter_by(id=witness_id, school_id=g.school_id).first():
        return error_response("witness_id does not match a user at this school", 400)
    stmt = WitnessStatement(
        incident_id=incident_id,
        school_id=g.school_id,
        witness_id=witness_id,
        statement=data["statement"],
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
    incident = Incident.query.filter_by(
        id=incident_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not incident:
        return error_response("Incident not found", 404)
    data = request.get_json(silent=True) or {}
    if data.get("student_id") and not Student.query.filter_by(id=data["student_id"], school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)
    action = IncidentAction(
        incident_id=incident_id,
        school_id=g.school_id,
        taken_by_id=g.current_user.id,
    )
    taken_at = _parse_datetime(data.get("taken_at"))
    if data.get("taken_at") and taken_at is None:
        return error_response("taken_at must be an ISO datetime", 400)
    for key in ("action_type", "description", "student_id"):
        if key in data:
            setattr(action, key, data[key])
    if taken_at is not None:
        action.taken_at = taken_at
    db.session.add(action)
    db.session.commit()
    return created_response(_action_dict(action))


# ── Serializers ────────────────────────────────────────────


def _incident_dict(i):
    # resolve involved-student names for the web table's Student column
    student_names = []
    if i.involved_student_ids:
        # names resolved school-scoped — never leak a foreign tenant's names
        rows = Student.query.filter(
            Student.id.in_(i.involved_student_ids), Student.school_id == i.school_id
        ).all()
        by_id = {s.id: f"{s.first_name} {s.last_name}".strip() for s in rows}
        student_names = [by_id.get(sid) or str(sid) for sid in i.involved_student_ids]
    return {
        "id": str(i.id), "title": i.title, "description": i.description,
        "incident_type": i.incident_type, "severity": i.severity,
        "status": i.status, "location": i.location,
        "occurred_at": str(i.occurred_at) if i.occurred_at else None,
        "reported_by_id": str(i.reported_by_id),
        "reported_by_name": i.reported_by.full_name if getattr(i, "reported_by", None) else None,
        "involved_student_ids": [str(s) for s in (i.involved_student_ids or [])],
        "student_names": student_names,
        "student_name": student_names[0] if student_names else None,
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


def _parse_datetime(value):
    """Parse an ISO datetime; returns None for empty input and for unparseable
    strings (callers turn the latter into a 400)."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _parse_student_ids(value):
    """Validate involved_student_ids: None/missing → (None, None) keeps the
    client's value untouched; a list → every element must be a UUID (Postgres
    UUID[] would raise DataError → 500 on raw garbage). Returns (list, error)."""
    if value is None:
        return None, None
    if not isinstance(value, list):
        return None, "involved_student_ids must be a list of student ids"
    cleaned = []
    for item in value:
        try:
            cleaned.append(uuid_mod.UUID(str(item)))
        except (TypeError, ValueError, AttributeError):
            return None, f"involved_student_ids contains an invalid student id: {item}"
    return cleaned, None
