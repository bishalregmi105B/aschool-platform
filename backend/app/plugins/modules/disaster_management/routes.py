"""Disaster Management API — drills, participation, overview, seismic alerts
(premium plugin, NPR 999; premium tier of `emergency`).

E40: the plugin was published with working emergency-tier routes
(/emergency/alerts, /emergency/plans, /emergency/headcount) but the web pages
(`frontend/app/dashboard/disaster/{page,drills,alerts}/page.tsx`) call
`/emergency/drills`, `/emergency/disaster/overview` and
`/emergency/seismic-alerts` — none of which existed.

Routes (mounted under /api/v1/emergency to match the frontend calls; all
gated @plugin_required("disaster_management"), tenant-scoped to g.school_id):
  GET    /emergency/drills                      list (?status, ?upcoming=true, ?drill_type)
  POST   /emergency/drills                      schedule a drill (admin)
  GET    /emergency/drills/<id>                 drill detail + participations
  PATCH  /emergency/drills/<id>                 reschedule / mark completed|missed|cancelled (admin)
  DELETE /emergency/drills/<id>                 soft delete (admin)
  GET    /emergency/drills/<id>/participations  per-class participation rows
  POST   /emergency/drills/<id>/participations  record class participation (admin/teacher)
  GET    /emergency/disaster/overview           aggregate stats + readiness score
  GET    /emergency/seismic-alerts              live USGS feed around the school

Reuse: overview aggregates REAL emergency-tier rows (EvacuationPlan,
EmergencyAlert) alongside drill rows. No fabricated data anywhere:
- readiness_score is a documented formula over real drill/plan/alert rows.
- seismic alerts come from the public USGS FDSN event feed (NSC publishes no
  stable JSON API); when the school has no coordinates the center defaults to
  Kathmandu (flagged in the response), and when the feed is unreachable the
  endpoint returns an empty list with `unavailable: true` — never fake events.
"""

import math
from datetime import datetime, timedelta

import requests
from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required

from app.models.disaster_management import DisasterDrill, DrillParticipation
from app.models.emergency import EmergencyAlert, EvacuationPlan
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

disaster_management_bp = Blueprint(
    "disaster_management", __name__, url_prefix="/emergency"
)

DRILL_TYPES = {"earthquake", "fire", "flood", "lockdown", "general"}
DRILL_STATUSES = {"scheduled", "completed", "missed", "cancelled"}
# Reused by the seismic endpoints.
SEISMIC_MIN_MAGNITUDE = 4.0
SEISMIC_RADIUS_KM = 200
KATHMANDU = (27.7172, 85.3240)
USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"


# ── Drills ──────────────────────────────────────────────────


@disaster_management_bp.route("/drills", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
def list_drills():
    query = DisasterDrill.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        if status not in DRILL_STATUSES:
            return error_response(
                f"status must be one of: {', '.join(sorted(DRILL_STATUSES))}", 400
            )
        query = query.filter_by(status=status)
    drill_type = request.args.get("drill_type")
    if drill_type:
        query = query.filter_by(drill_type=drill_type)
    if request.args.get("upcoming", "").lower() == "true":
        query = query.filter(
            DisasterDrill.status == "scheduled",
            DisasterDrill.scheduled_at >= datetime.utcnow(),
        )
    items, meta = paginate(query.order_by(DisasterDrill.scheduled_at.desc()))
    return success_response([_drill_dict(d) for d in items], meta={"pagination": meta})


@disaster_management_bp.route("/drills", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
@role_required("superadmin", "school_admin")
def create_drill():
    data = request.get_json(silent=True) or {}
    if not (data.get("title") or "").strip():
        return error_response("title is required", 400)
    drill_type = data.get("drill_type") or "general"
    if drill_type not in DRILL_TYPES:
        return error_response(
            f"drill_type must be one of: {', '.join(sorted(DRILL_TYPES))}", 400
        )
    scheduled_at = _parse_when(data.get("scheduled_date") or data.get("scheduled_at"))
    if scheduled_at is None:
        return error_response("scheduled_date is required (ISO date or datetime)", 400)
    duration = _parse_int(data.get("duration_minutes"), "duration_minutes")
    if isinstance(duration, str):  # error message, not a number
        return error_response(duration, 400)

    drill = DisasterDrill(
        school_id=g.school_id,
        title=data["title"].strip(),
        drill_type=drill_type,
        scheduled_at=scheduled_at,
        duration_minutes=duration,
        notes=data.get("notes"),
    )
    db.session.add(drill)
    db.session.commit()
    return created_response(_drill_dict(drill))


@disaster_management_bp.route("/drills/<uuid:drill_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
def get_drill(drill_id):
    drill = _get_drill(drill_id)
    if not drill:
        return error_response("Drill not found", 404)
    d = _drill_dict(drill)
    d["participations"] = [
        _participation_dict(p) for p in drill.participations.filter_by(is_deleted=False)
    ]
    return success_response(d)


@disaster_management_bp.route("/drills/<uuid:drill_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
@role_required("superadmin", "school_admin")
def update_drill(drill_id):
    drill = _get_drill(drill_id)
    if not drill:
        return error_response("Drill not found", 404)
    data = request.get_json(silent=True) or {}
    if "status" in data and data["status"] is not None:
        if data["status"] not in DRILL_STATUSES:
            return error_response(
                f"status must be one of: {', '.join(sorted(DRILL_STATUSES))}", 400
            )
        drill.status = data["status"]
        if data["status"] == "completed":
            drill.completed_at = datetime.utcnow()
        else:
            drill.completed_at = None
    if "drill_type" in data and data["drill_type"] is not None:
        if data["drill_type"] not in DRILL_TYPES:
            return error_response(
                f"drill_type must be one of: {', '.join(sorted(DRILL_TYPES))}", 400
            )
        drill.drill_type = data["drill_type"]
    scheduled_at = _parse_when(data.get("scheduled_date") or data.get("scheduled_at"))
    if data.get("scheduled_date") and scheduled_at is None:
        return error_response("scheduled_date must be an ISO date or datetime", 400)
    if scheduled_at is not None:
        drill.scheduled_at = scheduled_at
    duration = _parse_int(data.get("duration_minutes"), "duration_minutes")
    if isinstance(duration, str):
        return error_response(duration, 400)
    if duration is not None:
        drill.duration_minutes = duration
    for key in ("title", "notes", "conducted_by_name"):
        if key in data and data[key] is not None:
            setattr(drill, key, data[key])
    db.session.commit()
    return success_response(_drill_dict(drill))


@disaster_management_bp.route("/drills/<uuid:drill_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
@role_required("superadmin", "school_admin")
def delete_drill(drill_id):
    drill = _get_drill(drill_id)
    if not drill:
        return error_response("Drill not found", 404)
    drill.soft_delete()
    return success_response({"deleted": True})


# ── Participation ───────────────────────────────────────────


@disaster_management_bp.route(
    "/drills/<uuid:drill_id>/participations", methods=["GET"]
)
@jwt_required()
@school_required
@plugin_required("disaster_management")
def list_participations(drill_id):
    if not _get_drill(drill_id):
        return error_response("Drill not found", 404)
    query = DrillParticipation.query.filter_by(
        drill_id=drill_id, school_id=g.school_id, is_deleted=False
    )
    items, meta = paginate(
        query.order_by(DrillParticipation.recorded_at.desc())
    )
    return success_response(
        [_participation_dict(p) for p in items], meta={"pagination": meta}
    )


@disaster_management_bp.route(
    "/drills/<uuid:drill_id>/participations", methods=["POST"]
)
@jwt_required()
@school_required
@plugin_required("disaster_management")
@role_required("superadmin", "school_admin", "teacher")
def record_participation(drill_id):
    if not _get_drill(drill_id):
        return error_response("Drill not found", 404)
    data = request.get_json(silent=True) or {}
    expected = _parse_int(data.get("total_expected"), "total_expected")
    if isinstance(expected, str):
        return error_response(expected, 400)
    present = _parse_int(data.get("total_present"), "total_present")
    if isinstance(present, str):
        return error_response(present, 400)
    if expected is not None and expected < 0:
        return error_response("total_expected must be >= 0", 400)
    if present is not None and present < 0:
        return error_response("total_present must be >= 0", 400)
    if expected is not None and present is not None and present > expected:
        return error_response("total_present cannot exceed total_expected", 400)
    missing_ids, err = _parse_uuid_list(data.get("missing_student_ids"), "missing_student_ids")
    if err:
        return error_response(err, 400)

    from app.models.academic import Class, Section

    # FK guards — a raw invalid UUID into a UUID column would 500 (E17 class).
    for fk_key, model, label in (
        ("class_id", Class, "class"),
        ("section_id", Section, "section"),
    ):
        if data.get(fk_key):
            try:
                import uuid as _uuid

                fk_id = _uuid.UUID(str(data[fk_key]))
            except (TypeError, ValueError, AttributeError):
                return error_response(f"{fk_key} is not a valid id", 400)
            row = model.query.filter_by(id=fk_id, school_id=g.school_id).first()
            if not row:
                return error_response(
                    f"{fk_key} does not match a {label} at this school", 400
                )

    participation = DrillParticipation(
        school_id=g.school_id,
        drill_id=drill_id,
        recorded_by_id=get_jwt().get("sub"),
        recorded_at=datetime.utcnow(),
        notes=data.get("notes"),
    )
    for key in ("class_id", "section_id"):
        if data.get(key):
            setattr(participation, key, data[key])
    participation.total_expected = expected
    participation.total_present = present
    participation.missing_student_ids = missing_ids
    db.session.add(participation)
    db.session.commit()
    return created_response(_participation_dict(participation))


# ── Overview ────────────────────────────────────────────────


@disaster_management_bp.route("/disaster/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
def disaster_overview():
    now = datetime.utcnow()
    year_start = datetime(now.year, 1, 1)

    total_plans = EvacuationPlan.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).count()
    active_plans = EvacuationPlan.query.filter_by(
        school_id=g.school_id, is_deleted=False, is_active=True
    ).count()
    active_alerts = EmergencyAlert.query.filter_by(
        school_id=g.school_id, is_deleted=False, status="active"
    ).count()

    drills_q = DisasterDrill.query.filter_by(school_id=g.school_id, is_deleted=False)
    drills_this_year = (
        drills_q.filter(
            DisasterDrill.status != "cancelled",
            DisasterDrill.scheduled_at >= year_start,
        ).count()
    )
    completed_q = drills_q.filter(DisasterDrill.status == "completed")
    completed_this_year = completed_q.filter(
        DisasterDrill.completed_at >= year_start
    ).count()
    upcoming = (
        drills_q.filter(
            DisasterDrill.status == "scheduled",
            DisasterDrill.scheduled_at >= now,
        )
        .order_by(DisasterDrill.scheduled_at.asc())
        .all()
    )
    last_drill = (
        completed_q.order_by(DisasterDrill.completed_at.desc()).first()
    )

    readiness = _readiness_score(
        now=now,
        active_plans=active_plans,
        completed_last_year=completed_q.filter(
            DisasterDrill.completed_at >= now - timedelta(days=365)
        ).count(),
        last_completed_at=last_drill.completed_at if last_drill else None,
        stale_active_alerts=EmergencyAlert.query.filter(
            EmergencyAlert.school_id == g.school_id,
            EmergencyAlert.is_deleted.is_(False),
            EmergencyAlert.status == "active",
            EmergencyAlert.triggered_at < now - timedelta(days=7),
        ).count(),
    )

    seismic = _fetch_seismic_events()

    return success_response(
        {
            "stats": {
                "total_plans": total_plans,
                "active_plans": active_plans,
                "active_alerts": active_alerts,
                "drills_this_year": drills_this_year,
                "completed_this_year": completed_this_year,
                "upcoming_drills": len(upcoming),
                "last_drill_at": (
                    last_drill.completed_at.isoformat() if last_drill else None
                ),
                # Documented formula — see _readiness_score docstring.
                "readiness_score": readiness,
            },
            "upcoming_drills": [_drill_dict(d) for d in upcoming[:5]],
            # Seismic events around the school (same source as /seismic-alerts).
            "recent_alerts": seismic["alerts"][:5],
            "seismic": seismic["meta"],
        }
    )


def _readiness_score(now, active_plans, completed_last_year, last_completed_at, stale_active_alerts):
    """Disaster readiness score (0–100), computed ONLY from real rows:

    1. Drill recency, 0–40 — days since the last completed drill:
       <=90 days → 40, <=180 → 25, <=365 → 10, none → 0.
    2. Drill frequency, 0–30 — completed drills in the last 365 days:
       >=4 → 30, 3 → 22, 2 → 15, 1 → 8, 0 → 0.
    3. Evacuation readiness, 0–20 — active evacuation plans:
       >=2 → 20, 1 → 12, 0 → 0.
    4. Alert hygiene, 0–10 — unresolved emergency alerts older than 7 days:
       none → 10, otherwise 10 − 5×count floored at 0.
    """
    score = 0
    if last_completed_at:
        days_since = (now - last_completed_at).days
        if days_since <= 90:
            score += 40
        elif days_since <= 180:
            score += 25
        elif days_since <= 365:
            score += 10
    if completed_last_year >= 4:
        score += 30
    elif completed_last_year == 3:
        score += 22
    elif completed_last_year == 2:
        score += 15
    elif completed_last_year == 1:
        score += 8
    if active_plans >= 2:
        score += 20
    elif active_plans == 1:
        score += 12
    score += max(0, 10 - 5 * (stale_active_alerts or 0))
    return min(100, score)


# ── Seismic alerts ──────────────────────────────────────────


@disaster_management_bp.route("/seismic-alerts", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("disaster_management")
def seismic_alerts():
    result = _fetch_seismic_events()
    payload = {"alerts": result["alerts"]}
    payload.update(result["meta"])
    return success_response(payload)


def _fetch_seismic_events():
    """Live earthquakes (>= M4.0, within 200 km) from the public USGS FDSN feed.

    NSC (seismonepal.gov.np) publishes no stable JSON API, so USGS is the
    source. Center = the school's stored coordinates; when unset, Kathmandu
    (flagged as `center_default: true`). Cached 10 minutes per school. On any
    failure the result is an EMPTY list plus `unavailable: true` + the reason —
    the frontend shows its honest "no significant activity" state; nothing is
    ever fabricated.
    """
    cache_key = f"disaster:seismic:{g.school_id}"
    try:
        from extensions import cache

        cached = cache.get(cache_key)
        if cached is not None:
            return cached
    except Exception:
        cached = None  # cache down — fetch fresh

    from app.models.school import School

    school = db.session.get(School, g.school_id)
    lat, lng = None, None
    if school and school.latitude is not None and school.longitude is not None:
        lat, lng = float(school.latitude), float(school.longitude)
    center_default = lat is None
    if center_default:
        lat, lng = KATHMANDU

    params = {
        "format": "geojson",
        "starttime": (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"),
        "minmagnitude": SEISMIC_MIN_MAGNITUDE,
        "latitude": lat,
        "longitude": lng,
        "maxradiuskm": SEISMIC_RADIUS_KM,
        "orderby": "time",
        "limit": 50,
    }
    try:
        resp = requests.get(USGS_URL, params=params, timeout=5)
        resp.raise_for_status()
        features = resp.json().get("features", [])
    except Exception as exc:  # network/timeout/parse — degrade honestly
        result = {
            "alerts": [],
            "meta": {
                "source": "usgs",
                "unavailable": True,
                "reason": f"seismic feed unreachable: {exc.__class__.__name__}",
                "center": {"latitude": lat, "longitude": lng},
                "center_default": center_default,
                "radius_km": SEISMIC_RADIUS_KM,
                "min_magnitude": SEISMIC_MIN_MAGNITUDE,
                "generated_at": datetime.utcnow().isoformat(),
            },
        }
        return result

    alerts = []
    for f in features:
        props = f.get("properties") or {}
        coords = ((f.get("geometry") or {}).get("coordinates") or [None, None, None])
        ev_lat, ev_lng, depth_km = coords[1], coords[0], coords[2]
        mag = props.get("mag")
        ts = props.get("time")
        alerts.append(
            {
                "id": props.get("eventSource") or f.get("id"),
                "event_id": f.get("id"),
                "magnitude": mag,
                "location": props.get("place"),
                # epoch-ms → ISO 8601 for displayBS / direct rendering
                "time": (
                    datetime.utcfromtimestamp(ts / 1000).isoformat() + "Z"
                    if ts
                    else None
                ),
                "depth_km": depth_km,
                "distance_km": (
                    round(_haversine_km(lat, lng, ev_lat, ev_lng), 1)
                    if ev_lat is not None and ev_lng is not None
                    else None
                ),
                "url": props.get("url"),
            }
        )
    result = {
        "alerts": alerts,
        "meta": {
            "source": "usgs",
            "unavailable": False,
            "center": {"latitude": lat, "longitude": lng},
            "center_default": center_default,
            "radius_km": SEISMIC_RADIUS_KM,
            "min_magnitude": SEISMIC_MIN_MAGNITUDE,
            "generated_at": datetime.utcnow().isoformat(),
        },
    }
    try:
        from extensions import cache

        cache.set(cache_key, result, timeout=600)
    except Exception:
        pass
    return result


# ── Helpers / serializers ───────────────────────────────────


def _get_drill(drill_id):
    return DisasterDrill.query.filter_by(
        id=drill_id, school_id=g.school_id, is_deleted=False
    ).first()


def _parse_when(value):
    """ISO date ('2026-09-15') or datetime → naive datetime; None otherwise."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.replace("Z", ""), fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _parse_int(value, field):
    """None passthrough; int or error-message string."""
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return f"{field} must be an integer"


def _parse_uuid_list(value, field):
    if value is None:
        return None, None
    if not isinstance(value, list):
        return None, f"{field} must be a list of ids"
    import uuid as _uuid

    cleaned = []
    for item in value:
        try:
            cleaned.append(_uuid.UUID(str(item)))
        except (TypeError, ValueError, AttributeError):
            return None, f"{field} contains an invalid id: {item}"
    return cleaned, None


def _haversine_km(lat1, lng1, lat2, lng2):
    if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
        return None
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _drill_dict(d):
    return {
        "id": str(d.id),
        "title": d.title,
        "drill_type": d.drill_type,
        "type": d.drill_type,  # alias — the drills page reads d.drill_type ?? d.type
        "scheduled_at": d.scheduled_at.isoformat() if d.scheduled_at else None,
        "scheduled_date": d.scheduled_at.date().isoformat() if d.scheduled_at else None,
        "duration_minutes": d.duration_minutes,
        "notes": d.notes,
        "status": d.status or "scheduled",
        "completed_at": d.completed_at.isoformat() if d.completed_at else None,
        "conducted_by_name": d.conducted_by_name,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _participation_dict(p):
    return {
        "id": str(p.id),
        "drill_id": str(p.drill_id),
        "class_id": str(p.class_id) if p.class_id else None,
        "section_id": str(p.section_id) if p.section_id else None,
        "total_expected": p.total_expected,
        "total_present": p.total_present,
        "missing_student_ids": [str(s) for s in (p.missing_student_ids or [])],
        "notes": p.notes,
        "recorded_by_id": str(p.recorded_by_id) if p.recorded_by_id else None,
        "recorded_at": p.recorded_at.isoformat() if p.recorded_at else None,
    }
