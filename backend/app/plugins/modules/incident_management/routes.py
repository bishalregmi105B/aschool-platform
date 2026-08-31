"""Incident Management API — workflow, escalation, analytics (growth plugin,
NPR 399; management tier of `incidents`).

E41: the plugin was published with a full web UI
(`frontend/app/dashboard/incident-management/{page,active,escalations,reports}`)
calling `/incidents/management/*` — zero such routes existed. This blueprint
implements the management tier on top of the base `incidents` plugin
(`app/api/v1/incidents.py`, which keeps its own routes — nothing duplicated):
every management route is gated @plugin_required("incident_management"),
tenant-scoped to g.school_id, and reads/writes the same Incident rows.

Routes (mounted under /api/v1/incidents/management):
  GET  /incidents/management/overview            KPI stats + recent cases
  GET  /incidents/management/active              open cases (?search, ?severity)
  POST /incidents/management                     create a management case
  POST /incidents/management/<id>/assign         assign to staff (+notify)
  POST /incidents/management/<id>/status         transition reported→investigating→resolved→closed
  POST /incidents/management/<id>/escalate       severity bump → principal/management (+notify)
  GET  /incidents/management/escalations         open escalated cases
  PATCH/incidents/management/<id>/resolve        record resolution
  POST /incidents/management/<id>/conference     schedule parent conference
  GET  /incidents/management/<id>/audit          append-only workflow audit trail
  GET  /incidents/management/reports             analytics (?period=this_week|this_month|this_year)

Status workflow (forward-only, audited): reported → investigating → resolved
→ closed. Every assign/status/escalate/resolve/conference writes an
IncidentWorkflowEvent row. Escalation bumps severity one step, flips
un-started cases into investigating, and notifies the escalation target (or
the school's admins) through the existing in-app notification service
(`notifications.create_notification`).
"""

from datetime import datetime, timedelta

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required
from sqlalchemy import func

from app.models.incident import Incident, WitnessStatement
from app.models.incident_management import IncidentEscalation, IncidentWorkflowEvent
from app.models.student import Student
from app.models.user import User
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

incident_management_bp = Blueprint(
    "incident_management", __name__, url_prefix="/incidents/management"
)

ACTIVE_STATUSES = ("reported", "investigating")
SEVERITY_ORDER = ("low", "medium", "high", "critical")
# Forward-only workflow ("open" in the product language = reported here — the
# base enum's initial state).
ALLOWED_TRANSITIONS = {
    "reported": {"investigating"},
    "investigating": {"resolved", "closed"},
    "resolved": {"closed"},
}
# The management-case create dialog offers friendlier labels than the base
# enum; map them onto it (canonical enum values pass straight through).
TYPE_MAP = {
    "behavior": "behavioral",
    "bullying": "bullying",
    "violence": "fighting",
    "academic": "other",
    "other": "other",
    "behavioral": "behavioral",
    "fighting": "fighting",
    "vandalism": "vandalism",
    "theft": "theft",
    "medical": "medical",
}


# ── Overview + listings ─────────────────────────────────────


@incident_management_bp.route("/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incident_management")
def overview():
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    year_start = datetime(now.year, 1, 1)
    school_scoped = Incident.query.filter_by(school_id=g.school_id, is_deleted=False)

    active = school_scoped.filter(Incident.status.in_(ACTIVE_STATUSES))
    active_count = active.count()
    # "Pending escalation": active cases that have never been escalated.
    pending_escalation = (
        active.filter(
            ~Incident.escalations.any(IncidentEscalation.is_deleted.is_(False))
        ).count()
    )
    resolved_this_month = school_scoped.filter(
        Incident.status.in_(("resolved", "closed")),
        Incident.resolved_at >= month_start,
    ).count()
    total_this_year = school_scoped.filter(
        Incident.created_at >= year_start
    ).count()

    recent = (
        school_scoped.order_by(Incident.created_at.desc()).limit(5).all()
    )
    return success_response(
        {
            "stats": {
                "active": active_count,
                "pending_escalation": pending_escalation,
                "resolved_this_month": resolved_this_month,
                "total_this_year": total_this_year,
            },
            "recent_cases": [_management_dict(i) for i in recent],
        }
    )


@incident_management_bp.route("/active", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incident_management")
def active_cases():
    query = Incident.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).filter(Incident.status.in_(ACTIVE_STATUSES))
    search = request.args.get("search")
    if search:
        query = query.filter(Incident.title.ilike(f"%{search}%"))
    severity = request.args.get("severity")
    if severity:
        if severity not in SEVERITY_ORDER:
            return error_response(
                f"severity must be one of: {', '.join(SEVERITY_ORDER)}", 400
            )
        query = query.filter_by(severity=severity)
    items, meta = paginate(query.order_by(Incident.created_at.desc()))
    return success_response([_management_dict(i) for i in items], meta={"pagination": meta})


@incident_management_bp.route("/escalations", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incident_management")
def escalations():
    """Open escalated cases (resolved/closed ones drop off the worklist)."""
    rows = (
        Incident.query.filter_by(school_id=g.school_id, is_deleted=False)
        .filter(
            Incident.status.in_(ACTIVE_STATUSES),
            Incident.escalated_at.isnot(None),
        )
        .order_by(Incident.escalated_at.desc())
        .all()
    )
    latest_by_incident = _latest_escalations([r.id for r in rows])
    return success_response(
        [
            _escalation_dict(i, latest_by_incident.get(i.id))
            for i in rows
        ]
    )


# ── Mutations ───────────────────────────────────────────────


@incident_management_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incident_management")
@role_required("superadmin", "school_admin", "teacher")
def create_case():
    data = request.get_json(silent=True) or {}
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    raw_type = data.get("type") or data.get("incident_type")
    if not raw_type or raw_type not in TYPE_MAP:
        return error_response(
            f"type is required (one of: {', '.join(sorted(set(TYPE_MAP)))})", 400
        )
    severity = data.get("severity") or "medium"
    if severity not in SEVERITY_ORDER:
        return error_response(
            f"severity must be one of: {', '.join(SEVERITY_ORDER)}", 400
        )

    student_id = data.get("student_id")
    if student_id:
        if not Student.query.filter_by(
            id=student_id, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response(
                "student_id does not match a student at this school", 400
            )

    witnesses = _parse_witnesses(data.get("witnesses"))

    incident = Incident(
        school_id=g.school_id,
        title=data["title"].strip(),
        description=data.get("description"),
        incident_type=TYPE_MAP[raw_type],
        severity=severity,
        reported_by_id=get_jwt().get("sub"),
        occurred_at=datetime.utcnow(),
        parent_notified=bool(data.get("parent_notified")),
    )
    if student_id:
        incident.involved_student_ids = [student_id]
    db.session.add(incident)
    db.session.flush()  # id for the audit event
    db.session.add(
        IncidentWorkflowEvent(
            school_id=g.school_id,
            incident_id=incident.id,
            event_type="created",
            actor_id=get_jwt().get("sub"),
            to_value="reported",
            notes=(
                "Witnesses reported: " + ", ".join(witnesses) if witnesses else None
            ),
        )
    )
    db.session.commit()
    return created_response(_management_dict(incident))


@incident_management_bp.route("/<uuid:incident_id>/assign", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incident_management")
@role_required("superadmin", "school_admin")
def assign_case(incident_id):
    incident = _get_incident(incident_id)
    if not incident:
        return error_response("Incident not found", 404)
    if incident.status in ("resolved", "closed"):
        return error_response("Cannot assign a resolved or closed case", 400)
    data = request.get_json(silent=True) or {}
    assignee_id = data.get("assignee_id")
    if not assignee_id:
        return error_response("assignee_id is required", 400)
    assignee = User.query.filter_by(
        id=assignee_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not assignee:
        return error_response("assignee_id does not match a user at this school", 400)

    previous = str(incident.assigned_to_id) if incident.assigned_to_id else None
    incident.assigned_to_id = assignee.id
    _audit(incident, "assign", from_value=previous, to_value=str(assignee.id),
           notes=data.get("notes") or f"Assigned to {assignee.full_name}")
    _notify(
        user_id=assignee.id,
        title="Incident assigned to you",
        body=f"Case '{incident.title}' ({incident.severity or 'medium'} severity) was assigned to you.",
        category="incident",
        incident_id=incident.id,
    )
    db.session.commit()
    return success_response(_management_dict(incident))


@incident_management_bp.route("/<uuid:incident_id>/status", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incident_management")
@role_required("superadmin", "school_admin")
def change_status(incident_id):
    incident = _get_incident(incident_id)
    if not incident:
        return error_response("Incident not found", 404)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return error_response("status is required", 400)
    allowed = ALLOWED_TRANSITIONS.get(incident.status or "reported", set())
    if new_status not in allowed:
        return error_response(
            f"Cannot move a {incident.status or 'reported'} case to {new_status}. "
            f"Allowed: {', '.join(sorted(allowed)) or 'none'}",
            400,
        )
    resolution = data.get("resolution")
    old_status = incident.status
    incident.status = new_status
    if new_status == "resolved":
        incident.resolved_at = datetime.utcnow()
        if resolution:
            incident.resolution = resolution
    elif new_status == "closed":
        incident.resolved_at = incident.resolved_at or datetime.utcnow()
    _audit(incident, "status_change", from_value=old_status, to_value=new_status,
           notes=resolution or data.get("notes"))
    db.session.commit()
    return success_response(_management_dict(incident))


@incident_management_bp.route("/<uuid:incident_id>/escalate", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incident_management")
@role_required("superadmin", "school_admin")
def escalate_case(incident_id):
    incident = _get_incident(incident_id)
    if not incident:
        return error_response("Incident not found", 404)
    if incident.status in ("resolved", "closed"):
        return error_response("Cannot escalate a resolved or closed case", 400)
    data = request.get_json(silent=True) or {}

    before = incident.severity if incident.severity in SEVERITY_ORDER else "medium"
    idx = SEVERITY_ORDER.index(before)
    if data.get("severity"):
        after = data["severity"]
        if after not in SEVERITY_ORDER:
            return error_response(
                f"severity must be one of: {', '.join(SEVERITY_ORDER)}", 400
            )
        if SEVERITY_ORDER.index(after) <= idx:
            return error_response(
                f"Escalation must raise severity (current: {before})", 400
            )
    else:
        if idx >= len(SEVERITY_ORDER) - 1:
            return error_response(
                f"Severity is already {before} — the maximum", 400
            )
        after = SEVERITY_ORDER[idx + 1]

    target, target_role = _resolve_escalation_target(data.get("escalated_to_id"))

    escalation = IncidentEscalation(
        school_id=g.school_id,
        incident_id=incident.id,
        escalated_by_id=get_jwt().get("sub"),
        escalated_to_id=target.id if target else None,
        escalated_to_role=target_role,
        severity_before=before,
        severity_after=after,
        reason=data.get("reason"),
    )
    old_status = incident.status
    db.session.add(escalation)
    incident.severity = after
    incident.escalated_at = datetime.utcnow()
    incident.escalated_to_id = target.id if target else None
    if incident.status == "reported":
        # An escalation means management is now looking at it.
        incident.status = "investigating"
        _audit(incident, "status_change", from_value=old_status,
               to_value="investigating", notes="auto: escalated")
    _audit(incident, "escalate", from_value=before, to_value=after,
           notes=data.get("reason") or (f"Escalated to {target.full_name}" if target else "Escalated to management"))
    # Commit the escalation record first — a notification failure must never
    # lose the audit trail (the notification is a best-effort side channel).
    db.session.commit()

    notified = False
    if target:
        notified = _notify(
            user_id=target.id,
            title=f"Incident escalated: {incident.title}",
            body=(
                f"Severity raised {before} → {after}."
                + (f" Reason: {data.get('reason')}" if data.get("reason") else "")
            ),
            category="incident",
            priority="high" if after in ("high", "critical") else "normal",
            incident_id=incident.id,
        )
    result = _management_dict(incident)
    result["escalation"] = _escalation_row_dict(escalation)
    result["notified"] = notified
    return success_response(result)


@incident_management_bp.route("/<uuid:incident_id>/resolve", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("incident_management")
@role_required("superadmin", "school_admin")
def resolve_case(incident_id):
    incident = _get_incident(incident_id)
    if not incident:
        return error_response("Incident not found", 404)
    if incident.status == "closed":
        return error_response("Case is already closed", 400)
    data = request.get_json(silent=True) or {}
    old_status = incident.status
    incident.status = "resolved"
    incident.resolution = data.get("resolution")
    incident.resolved_at = datetime.utcnow()
    _audit(incident, "resolve", from_value=old_status, to_value="resolved",
           notes=data.get("resolution") or data.get("notes"))
    db.session.commit()
    return success_response(_management_dict(incident))


@incident_management_bp.route("/<uuid:incident_id>/conference", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("incident_management")
@role_required("superadmin", "school_admin")
def schedule_conference(incident_id):
    incident = _get_incident(incident_id)
    if not incident:
        return error_response("Incident not found", 404)
    escalation = (
        IncidentEscalation.query.filter_by(
            incident_id=incident.id, school_id=g.school_id, is_deleted=False
        )
        .order_by(IncidentEscalation.created_at.desc())
        .first()
    )
    if not escalation:
        return error_response(
            "Only escalated cases can schedule a parent conference — escalate it first",
            400,
        )
    data = request.get_json(silent=True) or {}
    conference_at = _parse_dt(data.get("conference_at"))
    if data.get("conference_at") and conference_at is None:
        return error_response("conference_at must be an ISO datetime", 400)
    escalation.conference_scheduled = True
    escalation.conference_scheduled_at = conference_at or datetime.utcnow()
    if data.get("notes"):
        escalation.conference_notes = data["notes"]
    incident.conference_scheduled = True
    incident.conference_scheduled_at = escalation.conference_scheduled_at
    _audit(incident, "conference", to_value="scheduled",
           notes=data.get("notes") or escalation.conference_notes)
    db.session.commit()
    return success_response(_escalation_dict(incident, escalation))


@incident_management_bp.route("/<uuid:incident_id>/audit", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incident_management")
def audit_trail(incident_id):
    if not _get_incident(incident_id):
        return error_response("Incident not found", 404)
    events = (
        IncidentWorkflowEvent.query.filter_by(
            incident_id=incident_id, school_id=g.school_id, is_deleted=False
        )
        .order_by(IncidentWorkflowEvent.created_at.asc())
        .all()
    )
    return success_response([_audit_dict(e) for e in events])


# ── Analytics ───────────────────────────────────────────────


@incident_management_bp.route("/reports", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("incident_management")
def reports():
    period = request.args.get("period", "this_month")
    now = datetime.utcnow()
    if period == "this_week":
        # Monday-based week (documented; the reports page offers week/month/year)
        start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    elif period == "this_year":
        start = datetime(now.year, 1, 1)
    elif period == "this_month":
        start = datetime(now.year, now.month, 1)
    else:
        return error_response(
            "period must be one of: this_week, this_month, this_year", 400
        )

    created_q = Incident.query.filter(
        Incident.school_id == g.school_id,
        Incident.is_deleted.is_(False),
        Incident.created_at >= start,
    )
    total = created_q.count()
    resolved = created_q.filter(Incident.status.in_(("resolved", "closed"))).count()

    escalated = IncidentEscalation.query.filter(
        IncidentEscalation.school_id == g.school_id,
        IncidentEscalation.is_deleted.is_(False),
        IncidentEscalation.created_at >= start,
    ).count()

    # Time-to-resolution: avg(resolved_at − created_at) over cases created in
    # the window that have actually been resolved.
    avg_days = (
        db.session.query(
            func.avg(
                func.extract("epoch", Incident.resolved_at - Incident.created_at)
                / 86400.0
            )
        )
        .filter(
            Incident.school_id == g.school_id,
            Incident.is_deleted.is_(False),
            Incident.created_at >= start,
            Incident.resolved_at.isnot(None),
        )
        .scalar()
    )

    by_type_rows = (
        db.session.query(Incident.incident_type, func.count(Incident.id))
        .filter(
            Incident.school_id == g.school_id,
            Incident.is_deleted.is_(False),
            Incident.created_at >= start,
        )
        .group_by(Incident.incident_type)
        .order_by(func.count(Incident.id).desc())
        .all()
    )
    by_severity_rows = (
        db.session.query(Incident.severity, func.count(Incident.id))
        .filter(
            Incident.school_id == g.school_id,
            Incident.is_deleted.is_(False),
            Incident.created_at >= start,
        )
        .group_by(Incident.severity)
        .all()
    )

    resolved_cases = (
        created_q.filter(Incident.status.in_(("resolved", "closed")))
        .order_by(Incident.resolved_at.desc())
        .limit(50)
        .all()
    )
    return success_response(
        {
            "period": period,
            "start": start.isoformat(),
            "summary": {
                "total": total,
                "resolved": resolved,
                "escalated": escalated,
                # None (no resolved cases) → the page shows "—" honestly.
                "avg_resolution_days": (
                    round(float(avg_days), 1) if avg_days is not None else None
                ),
            },
            "by_type": [
                {"type": t or "other", "count": int(c)} for t, c in by_type_rows
            ],
            "by_severity": [
                {"severity": s or "medium", "count": int(c)}
                for s, c in by_severity_rows
            ],
            "resolved_cases": [_management_dict(i) for i in resolved_cases],
        }
    )


# ── Helpers / serializers ───────────────────────────────────


def _get_incident(incident_id):
    return Incident.query.filter_by(
        id=incident_id, school_id=g.school_id, is_deleted=False
    ).first()


def _audit(incident, event_type, from_value=None, to_value=None, notes=None):
    db.session.add(
        IncidentWorkflowEvent(
            school_id=g.school_id,
            incident_id=incident.id,
            event_type=event_type,
            actor_id=get_jwt().get("sub"),
            from_value=from_value,
            to_value=to_value,
            notes=notes,
        )
    )


def _resolve_escalation_target(escalated_to_id):
    """Explicit target (validated, school-scoped) or the school's admin."""
    if escalated_to_id:
        user = User.query.filter_by(
            id=escalated_to_id, school_id=g.school_id, is_deleted=False
        ).first()
        if not user:
            return None, None
        return user, user.role
    admin = (
        User.query.filter_by(
            school_id=g.school_id, role="school_admin", is_active=True
        )
        .order_by(User.created_at.asc())
        .first()
    )
    if admin:
        return admin, "school_admin"
    return None, "management"


def _notify(user_id, title, body, category="incident", priority="normal",
            incident_id=None):
    """Best-effort in-app notification via the existing notification service.

    Called AFTER the escalation transaction has committed; a failure here
    rolls back only the notification row and is logged — the escalation
    record itself is already durable.
    """
    import logging

    from app.api.v1.notifications import create_notification

    try:
        create_notification(
            school_id=str(g.school_id),
            user_id=str(user_id),
            title=title,
            body=body,
            category=category,
            priority=priority,
            data={"incident_id": str(incident_id)} if incident_id else None,
            action_url="/dashboard/incident-management/escalations",
        )
        return True
    except Exception:
        db.session.rollback()
        logging.getLogger(__name__).exception(
            "incident_management: failed to notify user %s of %s", user_id, title
        )
        return False


def _latest_escalations(incident_ids):
    if not incident_ids:
        return {}
    rows = (
        IncidentEscalation.query.filter(
            IncidentEscalation.incident_id.in_(incident_ids),
            IncidentEscalation.is_deleted.is_(False),
        )
        .order_by(IncidentEscalation.created_at.desc())
        .all()
    )
    latest = {}
    for row in rows:
        latest.setdefault(row.incident_id, row)
    return latest


def _student_name(incident):
    if not incident.involved_student_ids:
        return None
    row = (
        Student.query.filter(
            Student.id == incident.involved_student_ids[0],
            Student.school_id == incident.school_id,
        )
        .first()
    )
    if row:
        return f"{row.first_name} {row.last_name}".strip()
    return str(incident.involved_student_ids[0])


def _management_dict(i):
    assignee = db.session.get(User, i.assigned_to_id) if i.assigned_to_id else None
    return {
        "id": str(i.id),
        "title": i.title,
        "description": i.description,
        # management tier exposes the base enum value under `type` (the web
        # pages render it as a badge label) and keep `incident_type` too
        "type": i.incident_type,
        "incident_type": i.incident_type,
        "severity": i.severity,
        "status": i.status,
        "student_name": _student_name(i),
        "witness_count": WitnessStatement.query.filter_by(
            incident_id=i.id, school_id=i.school_id, is_deleted=False
        ).count(),
        "parent_notified": bool(i.parent_notified),
        "assigned_to_id": str(i.assigned_to_id) if i.assigned_to_id else None,
        "assigned_to_name": assignee.full_name if assignee else None,
        "escalated_at": i.escalated_at.isoformat() if i.escalated_at else None,
        "escalated_to_id": str(i.escalated_to_id) if i.escalated_to_id else None,
        "conference_scheduled": bool(i.conference_scheduled),
        "conference_scheduled_at": (
            i.conference_scheduled_at.isoformat()
            if i.conference_scheduled_at
            else None
        ),
        "resolution": i.resolution,
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def _escalation_dict(incident, escalation):
    d = _management_dict(incident)
    if escalation:
        d["escalated_to"] = (
            escalation.escalated_to.full_name
            if escalation.escalated_to
            else escalation.escalated_to_role or "Principal"
        )
        d["escalation_reason"] = escalation.reason
        d["conference_scheduled"] = bool(escalation.conference_scheduled)
        d["conference_scheduled_at"] = (
            escalation.conference_scheduled_at.isoformat()
            if escalation.conference_scheduled_at
            else None
        )
    else:
        d["escalated_to"] = "Principal"
    return d


def _escalation_row_dict(e):
    return {
        "id": str(e.id),
        "incident_id": str(e.incident_id),
        "escalated_to_id": str(e.escalated_to_id) if e.escalated_to_id else None,
        "escalated_to_role": e.escalated_to_role,
        "severity_before": e.severity_before,
        "severity_after": e.severity_after,
        "reason": e.reason,
        "conference_scheduled": bool(e.conference_scheduled),
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _audit_dict(e):
    return {
        "id": str(e.id),
        "incident_id": str(e.incident_id),
        "event_type": e.event_type,
        "actor_id": str(e.actor_id) if e.actor_id else None,
        "actor_name": e.actor.full_name if e.actor else None,
        "from_value": e.from_value,
        "to_value": e.to_value,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _parse_witnesses(value):
    """Comma-separated witness names (the management create dialog collects
    names, not user accounts) → clean list; stored on the case's audit trail."""
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [part.strip() for part in str(value).split(",") if part.strip()]


def _parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
