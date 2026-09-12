"""Transport / GPS Bus Tracking API — routes, buses, stops, GPS logs +
S-A4 trip lifecycle (instances, positions, ride register, reports)."""
import uuid
from datetime import date, datetime, time, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload

from app.models.student import Student
from app.models.transport import Route, Bus, BusStop, GPSLog
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from extensions import db

transport_bp = Blueprint("transport", __name__, url_prefix="/transport")


def _coerce_transport_uuid(value):
    """Coerce to UUID; None when absent/not a valid UUID."""
    if isinstance(value, uuid.UUID):
        return value
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


# ── Routes ─────────────────────────────────────────────────


@transport_bp.route("/routes", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def list_routes():
    query = Route.query.filter_by(school_id=g.school_id, is_deleted=False)
    if request.args.get("active"):
        query = query.filter_by(is_active=True)
    items, meta = paginate(query.order_by(Route.name))
    return success_response([_route_dict(r) for r in items], meta={"pagination": meta})


@transport_bp.route("/routes", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def create_route():
    data = request.get_json(silent=True) or {}
    # routes.name is NOT NULL — validate up front so a missing name gets a
    # 400 instead of an unhandled IntegrityError (500).
    if not str(data.get("name") or "").strip():
        return error_response("name is required", 400)
    route = Route(school_id=g.school_id)
    for key in ("name", "description", "distance_km", "estimated_time_mins", "is_active"):
        if key in data:
            setattr(route, key, data[key])
    db.session.add(route)
    db.session.commit()
    return created_response(_route_dict(route))


@transport_bp.route("/routes/<uuid:route_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def update_route(route_id):
    route = Route.query.filter_by(id=route_id, school_id=g.school_id, is_deleted=False).first()
    if not route:
        return error_response("Route not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("name", "description", "distance_km", "estimated_time_mins", "is_active"):
        if key in data:
            setattr(route, key, data[key])
    db.session.commit()
    return success_response(_route_dict(route))


@transport_bp.route("/routes/<uuid:route_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def delete_route(route_id):
    route = Route.query.filter_by(id=route_id, school_id=g.school_id, is_deleted=False).first()
    if not route:
        return error_response("Route not found", 404)
    route.soft_delete()
    return success_response({"deleted": True})


# ── Buses ──────────────────────────────────────────────────


@transport_bp.route("/buses", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def list_buses():
    query = Bus.query.filter_by(school_id=g.school_id, is_deleted=False)
    if request.args.get("route_id"):
        query = query.filter_by(route_id=request.args["route_id"])
    items, meta = paginate(query.order_by(Bus.vehicle_number))
    return success_response([_bus_dict(b) for b in items], meta={"pagination": meta})


@transport_bp.route("/buses", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def create_bus():
    data = request.get_json(silent=True) or {}
    # buses.vehicle_number is NOT NULL — validate up front so a missing
    # vehicle number gets a 400 instead of an unhandled IntegrityError (500).
    if not str(data.get("vehicle_number") or "").strip():
        return error_response("vehicle_number is required", 400)
    # route_id is an FK to routes.id — make sure it points at a route of this
    # school (same contract as the GPS ingest bus_id check) before writing.
    route_id = data.get("route_id")
    if route_id:
        try:
            route_uuid = uuid.UUID(str(route_id))
        except (ValueError, AttributeError, TypeError):
            return error_response("route_id must be a valid UUID", 400)
        if not Route.query.filter_by(id=route_uuid, school_id=g.school_id, is_deleted=False).first():
            return error_response("route_id does not match a route at this school", 400)
    bus = Bus(school_id=g.school_id)
    for key in ("vehicle_number", "driver_id", "conductor_id", "capacity",
                "gps_device_id", "make", "model", "year", "insurance_expiry",
                "route_id", "is_active"):
        if key in data:
            setattr(bus, key, data[key])
    db.session.add(bus)
    db.session.commit()
    return created_response(_bus_dict(bus))


@transport_bp.route("/buses/<uuid:bus_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def update_bus(bus_id):
    bus = Bus.query.filter_by(id=bus_id, school_id=g.school_id, is_deleted=False).first()
    if not bus:
        return error_response("Bus not found", 404)
    data = request.get_json(silent=True) or {}
    # E189: route_id on update must satisfy the same school-scoped FK check
    # as POST (a bad uuid used to 500; a foreign route used to link silently).
    if data.get("route_id"):
        try:
            route_uuid = uuid.UUID(str(data["route_id"]))
        except (ValueError, AttributeError, TypeError):
            return error_response("route_id must be a valid UUID", 400)
        if not Route.query.filter_by(id=route_uuid, school_id=g.school_id, is_deleted=False).first():
            return error_response("route_id does not match a route at this school", 400)
    for key in ("vehicle_number", "driver_id", "conductor_id", "capacity",
                "gps_device_id", "make", "model", "year", "insurance_expiry",
                "route_id", "is_active"):
        if key in data:
            setattr(bus, key, data[key])
    db.session.commit()
    return success_response(_bus_dict(bus))


# ── Bus Stops ──────────────────────────────────────────────


@transport_bp.route("/stops", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def list_stops():
    query = BusStop.query.filter_by(school_id=g.school_id, is_deleted=False)
    route_id = request.args.get("route_id")
    if route_id:
        query = query.filter_by(route_id=route_id)
    items, meta = paginate(query.order_by(BusStop.sequence_number))
    return success_response([_stop_dict(s) for s in items], meta={"pagination": meta})


@transport_bp.route("/stops", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def create_stop():
    data = request.get_json(silent=True) or {}
    # bus_stops.route_id/name are NOT NULL — validate up front so bad payloads
    # get a 400 instead of an unhandled IntegrityError (500).
    missing = [
        field
        for field in ("route_id", "name")
        if not data.get(field)
    ]
    if missing:
        return error_response(
            f"Missing required field(s): {', '.join(missing)}", 400
        )
    try:
        route_uuid = uuid.UUID(str(data["route_id"]))
    except (ValueError, AttributeError, TypeError):
        return error_response("route_id must be a valid UUID", 400)
    if not Route.query.filter_by(id=route_uuid, school_id=g.school_id, is_deleted=False).first():
        return error_response("route_id does not match a route at this school", 400)
    stop = BusStop(school_id=g.school_id)
    for key in ("route_id", "name", "name_nepali", "latitude", "longitude",
                "sequence_number", "arrival_time_am", "arrival_time_pm", "student_ids"):
        if key in data:
            setattr(stop, key, data[key])
    db.session.add(stop)
    db.session.commit()
    return created_response(_stop_dict(stop))


@transport_bp.route("/stops/<uuid:stop_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def update_stop(stop_id):
    stop = BusStop.query.filter_by(id=stop_id, school_id=g.school_id, is_deleted=False).first()
    if not stop:
        return error_response("Stop not found", 404)
    data = request.get_json(silent=True) or {}
    # E189: route_id on update must satisfy the same school-scoped FK check
    # as POST.
    if data.get("route_id"):
        try:
            route_uuid = uuid.UUID(str(data["route_id"]))
        except (ValueError, AttributeError, TypeError):
            return error_response("route_id must be a valid UUID", 400)
        if not Route.query.filter_by(id=route_uuid, school_id=g.school_id, is_deleted=False).first():
            return error_response("route_id does not match a route at this school", 400)
    for key in ("route_id", "name", "name_nepali", "latitude", "longitude",
                "sequence_number", "arrival_time_am", "arrival_time_pm", "student_ids"):
        if key in data:
            setattr(stop, key, data[key])
    db.session.commit()
    return success_response(_stop_dict(stop))


@transport_bp.route("/stops/<uuid:stop_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin")
def delete_stop(stop_id):
    stop = BusStop.query.filter_by(id=stop_id, school_id=g.school_id, is_deleted=False).first()
    if not stop:
        return error_response("Stop not found", 404)
    stop.soft_delete()
    return success_response({"deleted": True})


# ── GPS Logs ───────────────────────────────────────────────


@transport_bp.route("/gps-logs", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def list_gps_logs():
    query = GPSLog.query.filter_by(school_id=g.school_id, is_deleted=False)
    bus_id = request.args.get("bus_id")
    if bus_id:
        query = query.filter_by(bus_id=bus_id)
    items, meta = paginate(query.order_by(GPSLog.timestamp.desc()))
    return success_response([_gps_dict(l) for l in items], meta={"pagination": meta})


@transport_bp.route("/gps-logs", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def ingest_gps(self=None):
    """Accept GPS data from ESP32 devices."""
    data = request.get_json(silent=True) or {}
    # bus_id/latitude/longitude are NOT NULL + bus_id is an FK to buses.id:
    # validate up front so bad payloads get 400, not an IntegrityError (500).
    bus_id = data.get("bus_id")
    try:
        bus_uuid = uuid.UUID(str(bus_id))
    except (ValueError, AttributeError, TypeError):
        return error_response("bus_id must be a valid UUID", 400)
    if not Bus.query.filter_by(id=bus_uuid, school_id=g.school_id, is_deleted=False).first():
        return error_response("bus_id does not match a bus at this school", 400)
    try:
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))
    except (TypeError, ValueError):
        return error_response("latitude and longitude are required numbers", 400)
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return error_response("latitude/longitude out of range", 400)
    log = GPSLog(school_id=g.school_id)
    for key in ("bus_id", "latitude", "longitude", "speed_kmh", "heading",
                "accuracy_m"):
        if key in data:
            setattr(log, key, data[key])
    log.timestamp = _parse_datetime(data.get("timestamp")) or datetime.now(timezone.utc)
    db.session.add(log)
    db.session.commit()
    return created_response(_gps_dict(log))


# ── Serializers ────────────────────────────────────────────


def _route_dict(r):
    return {
        "id": str(r.id), "name": r.name, "description": r.description,
        "distance_km": float(r.distance_km) if r.distance_km else None,
        "estimated_time_mins": r.estimated_time_mins,
        "is_active": r.is_active,
    }


def _bus_dict(b):
    return {
        "id": str(b.id), "vehicle_number": b.vehicle_number,
        "driver_id": str(b.driver_id) if b.driver_id else None,
        "conductor_id": str(b.conductor_id) if b.conductor_id else None,
        "capacity": b.capacity, "current_students_count": b.current_students_count,
        "gps_device_id": b.gps_device_id, "make": b.make, "model": b.model,
        "year": b.year, "route_id": str(b.route_id) if b.route_id else None,
        "is_active": b.is_active,
    }


def _stop_dict(s):
    return {
        "id": str(s.id), "route_id": str(s.route_id),
        "name": s.name, "name_nepali": s.name_nepali,
        "latitude": float(s.latitude) if s.latitude else None,
        "longitude": float(s.longitude) if s.longitude else None,
        "sequence_number": s.sequence_number,
        "arrival_time_am": str(s.arrival_time_am) if s.arrival_time_am else None,
        "arrival_time_pm": str(s.arrival_time_pm) if s.arrival_time_pm else None,
        "student_ids": [str(sid) for sid in s.student_ids] if s.student_ids else [],
    }


def _gps_dict(l):
    ts = l.timestamp.isoformat() + "Z" if l.timestamp else None  # E143: naive-UTC → ISO-Z so browser Date renders tenant-local time
    return {
        "id": str(l.id), "bus_id": str(l.bus_id),
        "latitude": float(l.latitude), "longitude": float(l.longitude),
        "speed_kmh": l.speed_kmh, "heading": l.heading,
        "accuracy_m": l.accuracy_m,
        "timestamp": ts,
    }


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except (TypeError, ValueError):
        return None


# ══════════════════════════════════════════════════════════════════════════
# S-A4 — Trip lifecycle (A-10) + notifications/prefs (A-11) + reports (A-42)
# Definition → daily instance → per-stop planned/actual → ride register.
# Driver-phone GPS is a first-class source: POST /instances/<id>/position
# feeds the same geofence engine the ESP32 poller uses.
# ══════════════════════════════════════════════════════════════════════════

def _trip_dict(t):
    return {
        "id": str(t.id),
        "name": t.name,
        "route_id": str(t.route_id),
        "route_name": t.route.name if t.route else None,
        "bus_id": str(t.bus_id) if t.bus_id else None,
        "bus": t.bus.vehicle_number if t.bus else None,
        "driver_id": str(t.driver_id) if t.driver_id else None,
        "direction": t.direction,
        "effective_date_bs": t.effective_date_bs,
        "weekdays": t.weekdays or [],
        "first_stop_time": t.first_stop_time.isoformat() if t.first_stop_time else None,
        "stop_to_stop_avg_mins": t.stop_to_stop_avg_mins,
        "status": t.status,
    }


def _instance_dict(i, with_stops=False, with_passengers=False):
    data = {
        "id": str(i.id),
        "trip_id": str(i.trip_id),
        "date": i.date.isoformat(),
        "date_bs": i.date_bs,
        "direction": i.direction,
        "driver_id": str(i.driver_id) if i.driver_id else None,
        "bus_id": str(i.bus_id) if i.bus_id else None,
        "bus": i.bus.vehicle_number if i.bus else None,
        "status": i.status,
        "started_at": i.started_at.isoformat() if i.started_at else None,
        "ended_at": i.ended_at.isoformat() if i.ended_at else None,
        "last_lat": float(i.last_lat) if i.last_lat is not None else None,
        "last_lng": float(i.last_lng) if i.last_lng is not None else None,
        "last_speed_kmh": i.last_speed_kmh,
        "last_fix_at": i.last_fix_at.isoformat() if i.last_fix_at else None,
    }
    if with_stops:
        data["stops"] = [
            {
                "id": str(s.id),
                "stop_id": str(s.stop_id),
                "stop_name": s.stop.name if s.stop else None,
                "seq": s.seq,
                "lat": float(s.stop.latitude) if s.stop and s.stop.latitude is not None else None,
                "lng": float(s.stop.longitude) if s.stop and s.stop.longitude is not None else None,
                "planned_ts": s.planned_ts.isoformat() if s.planned_ts else None,
                "actual_ts": s.actual_ts.isoformat() if s.actual_ts else None,
            }
            for s in i.stops
        ]
    if with_passengers:
        data["passengers"] = [
            {
                "id": str(r.id),
                "student_id": str(r.student_id),
                "student_name": (
                    f"{r.student.first_name or ''} {r.student.last_name or ''}".strip()
                    if r.student else None
                ),
                "start_stop_id": str(r.start_stop_id) if r.start_stop_id else None,
                "end_stop_id": str(r.end_stop_id) if r.end_stop_id else None,
                "ride_status": r.ride_status,
                "boarded_at": r.boarded_at.isoformat() if r.boarded_at else None,
                "dropped_at": r.dropped_at.isoformat() if r.dropped_at else None,
            }
            for r in i.reservations if not r.is_deleted
        ]
    return data


@transport_bp.route("/trips", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def list_trips():
    from app.models.transport import TransportTrip

    query = TransportTrip.query.filter(
        TransportTrip.school_id == g.school_id, TransportTrip.is_deleted.is_(False)
    ).options(joinedload(TransportTrip.route), joinedload(TransportTrip.bus))
    direction = (request.args.get("direction") or "").strip()
    if direction in ("morning", "afternoon"):
        query = query.filter(TransportTrip.direction == direction)
    items, meta = paginate(query.order_by(TransportTrip.created_at.desc()))
    return success_response({"trips": [_trip_dict(t) for t in items], "meta": meta})


@transport_bp.route("/trips", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager")
def create_trip():
    from app.models.transport import TransportTrip
    from app.models.academic import Class as _C  # noqa: F401 (model registry)

    data = request.get_json(silent=True) or {}
    route_id = _coerce_transport_uuid(data.get("route_id"))
    if not route_id:
        return error_response("route_id is required", 400)
    if Route.query.filter_by(id=route_id, school_id=g.school_id, is_deleted=False).first() is None:
        return error_response("route_id does not match this school", 404)
    direction = str(data.get("direction") or "").strip().lower()
    if direction not in ("morning", "afternoon"):
        return error_response("direction must be morning|afternoon", 400)
    weekdays = data.get("weekdays")
    if weekdays is not None and (
        not isinstance(weekdays, list)
        or any(not isinstance(w, int) or w < 0 or w > 6 for w in weekdays)
    ):
        return error_response("weekdays must be a list of ISO weekday ints 0-6 (Mon=0)", 400)
    first_stop_time = None
    if data.get("first_stop_time"):
        try:
            hh, mm = str(data["first_stop_time"]).split(":")[:2]
            first_stop_time = time(int(hh), int(mm))
        except (TypeError, ValueError):
            return error_response("first_stop_time must be HH:MM", 400)

    trip = TransportTrip(
        school_id=g.school_id,
        route_id=route_id,
        bus_id=_coerce_transport_uuid(data.get("bus_id")),
        driver_id=_coerce_transport_uuid(data.get("driver_id")),
        direction=direction,
        effective_date_bs=str(data.get("effective_date_bs") or "").strip() or None,
        weekdays=weekdays or [],
        first_stop_time=first_stop_time,
        stop_to_stop_avg_mins=int(data.get("stop_to_stop_avg_mins") or 5),
        name=str(data.get("name") or "").strip()[:200] or None,
    )
    db.session.add(trip)
    db.session.commit()
    return created_response(_trip_dict(trip))


@transport_bp.route("/trips/<uuid:trip_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager")
def update_trip(trip_id):
    from app.models.transport import TransportTrip

    trip = TransportTrip.query.filter_by(
        id=trip_id, school_id=g.school_id, is_deleted=False
    ).first()
    if trip is None:
        return error_response("Trip not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("bus_id", "driver_id"):
        if key in data:
            setattr(trip, key, _coerce_transport_uuid(data.get(key)))
    if "name" in data:
        trip.name = str(data.get("name") or "").strip()[:200] or None
    if "weekdays" in data and isinstance(data["weekdays"], list):
        trip.weekdays = [int(w) for w in data["weekdays"] if 0 <= int(w) <= 6]
    if "status" in data and data["status"] in ("active", "retired"):
        trip.status = data["status"]
    if "stop_to_stop_avg_mins" in data:
        trip.stop_to_stop_avg_mins = int(data["stop_to_stop_avg_mins"] or 5)
    if "first_stop_time" in data and data["first_stop_time"]:
        try:
            hh, mm = str(data["first_stop_time"]).split(":")[:2]
            trip.first_stop_time = time(int(hh), int(mm))
        except (TypeError, ValueError):
            return error_response("first_stop_time must be HH:MM", 400)
    db.session.commit()
    return success_response(_trip_dict(trip))


@transport_bp.route("/trips/<uuid:trip_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager")
def delete_trip(trip_id):
    from app.models.transport import TransportTrip

    trip = TransportTrip.query.filter_by(
        id=trip_id, school_id=g.school_id, is_deleted=False
    ).first()
    if trip is None:
        return error_response("Trip not found", 404)
    trip.soft_delete()
    return no_content_response()


@transport_bp.route("/instances", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def list_instances():
    """Daily run monitor. `?date=YYYY-MM-DD` (AD) or `?date_bs=`, default
    today; `?status=`; drivers see only their own instances."""
    from app.models.transport import TransportTripInstance
    from app.utils.nepali_date import today_bs, bs_to_ad

    query = TransportTripInstance.query.filter(
        TransportTripInstance.school_id == g.school_id,
        TransportTripInstance.is_deleted.is_(False),
    ).options(
        joinedload(TransportTripInstance.bus),
        joinedload(TransportTripInstance.trip),
    )
    day = None
    if request.args.get("date_bs"):
        day = bs_to_ad(str(request.args["date_bs"]).strip())
    elif request.args.get("date"):
        try:
            day = date.fromisoformat(str(request.args["date"]).strip())
        except ValueError:
            return error_response("date must be YYYY-MM-DD", 400)
    if day is None:
        day, _ = _transport_today()
    query = query.filter(TransportTripInstance.date == day)
    status = (request.args.get("status") or "").strip()
    if status in ("scheduled", "running", "completed", "cancelled"):
        query = query.filter(TransportTripInstance.status == status)
    if g.role == "teacher" and g.current_user is not None:
        # drivers log in as staff — show their own runs in the driver view
        query = query.filter(TransportTripInstance.driver_id == g.user_id)
    items, meta = paginate(query.order_by(TransportTripInstance.date.desc()))
    return success_response({
        "date": day.isoformat(),
        "instances": [_instance_dict(i, with_stops=True) for i in items],
        "meta": meta,
    })


def _transport_today():
    """(AD today, BS today) for the transport day queries."""
    from app.utils.nepali_date import ad_to_bs

    day = date.today()
    try:
        return day, ad_to_bs(day)
    except Exception:
        return day, None


@transport_bp.route("/instances/<uuid:instance_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def get_instance(instance_id):
    """Full run view: stops + passengers. Parents may only read instances
    their children ride."""
    from app.models.transport import TransportTripInstance, TransportTripReservation

    instance = TransportTripInstance.query.filter_by(
        id=instance_id, school_id=g.school_id, is_deleted=False
    ).first()
    if instance is None:
        return error_response("Instance not found", 404)
    if g.role == "parent":
        own_ids = {
            str(s.id) for s in Student.query.filter(
                Student.school_id == g.school_id,
                Student.is_deleted.is_(False),
                Student.guardians.any(user_id=g.user_id),
            ).all()
        }
        rides = TransportTripReservation.query.filter(
            TransportTripReservation.instance_id == instance_id,
            TransportTripReservation.student_id.in_([_u for _u in own_ids or [""]]),
            TransportTripReservation.is_deleted.is_(False),
        ).first()
        if rides is None:
            return error_response("Instance not found", 404)
    return success_response(
        _instance_dict(instance, with_stops=True, with_passengers=True)
    )


@transport_bp.route("/instances/<uuid:instance_id>/start", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager", "teacher")
def start_instance(instance_id):
    """Driver starts the run. Driver ownership is enforced (SBT's
    commented-out check is exactly the bug we do NOT ship)."""
    from app.models.transport import TransportTripInstance

    instance = TransportTripInstance.query.filter_by(
        id=instance_id, school_id=g.school_id, is_deleted=False
    ).first()
    if instance is None:
        return error_response("Instance not found", 404)
    if (instance.driver_id and str(instance.driver_id) != str(g.user_id)
            and g.role not in ("superadmin", "school_admin", "transport_manager")):
        return error_response("Only the assigned driver can start this trip", 403)
    if instance.status == "completed":
        return error_response("This trip is already completed", 409)
    if instance.status != "running":
        instance.status = "running"
        instance.started_at = datetime.now(timezone.utc)
        db.session.commit()
    return success_response(_instance_dict(instance, with_stops=True))


@transport_bp.route("/instances/<uuid:instance_id>/end", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager", "teacher")
def end_instance_route(instance_id):
    """End the run — refused while any student is still onboard (409 with
    the onboard count; drop them off first)."""
    from app.models.transport import TransportTripInstance
    from app.services import transport_service

    instance = TransportTripInstance.query.filter_by(
        id=instance_id, school_id=g.school_id, is_deleted=False
    ).first()
    if instance is None:
        return error_response("Instance not found", 404)
    if (instance.driver_id and str(instance.driver_id) != str(g.user_id)
            and g.role not in ("superadmin", "school_admin", "transport_manager")):
        return error_response("Only the assigned driver can end this trip", 403)
    result = transport_service.end_instance(str(g.school_id), instance)
    if not result.get("ok"):
        return error_response(
            {
                "message": f"{result['onboard']} student(s) are still onboard — "
                           "drop them off before ending the trip",
                "onboard": result["onboard"],
            },
            409,
        )
    return success_response(_instance_dict(instance, with_stops=True))


@transport_bp.route("/instances/<uuid:instance_id>/position", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def post_instance_position(instance_id):
    """Driver-phone GPS ingest (throttled server-side to one fix per 3 s
    per instance; faster clients just get their extras dropped)."""
    from app.models.transport import TransportTripInstance
    from app.services import transport_service

    instance = TransportTripInstance.query.filter_by(
        id=instance_id, school_id=g.school_id, is_deleted=False
    ).first()
    if instance is None:
        return error_response("Instance not found", 404)
    if instance.status in ("completed", "cancelled"):
        return error_response("This trip is not running", 409)

    data = request.get_json(silent=True) or {}
    lat = data.get("lat", data.get("latitude"))
    lng = data.get("lng", data.get("longitude"))
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return error_response("lat/lng are required numbers", 400)
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return error_response("lat/lng out of range", 400)

    now = datetime.now(timezone.utc)
    last = instance.last_fix_at.replace(tzinfo=timezone.utc) if (
        instance.last_fix_at and instance.last_fix_at.tzinfo is None
    ) else instance.last_fix_at
    if last is not None and (now - last).total_seconds() < 3:
        return success_response({"throttled": True, "triggers": []})

    speed = data.get("speed_kmh", data.get("speed"))
    try:
        speed = float(speed) if speed is not None else None
    except (TypeError, ValueError):
        speed = None

    # The driver phone doubles as a GPSLog source (replay/analytics parity
    # with the ESP32 path — what SBT structurally cannot do).
    if instance.bus_id:
        db.session.add(GPSLog(
            school_id=g.school_id,
            bus_id=instance.bus_id,
            latitude=lat, longitude=lng, speed_kmh=speed,
            timestamp=now, firebase_synced=False,
        ))

    result = transport_service.ingest_position(
        str(g.school_id), instance, lat, lng, speed
    )
    return success_response(result)


@transport_bp.route("/instances/<uuid:instance_id>/pickup", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager", "teacher")
def pickup_student(instance_id):
    """Board (or miss) one student: body {student_id, missed?: bool,
    stop_id?}. Geofence-validated loosely (the driver is at the stop when
    the engine stamped arrival; the strict SBT check produced false
    negatives with phone GPS jitter)."""
    from app.models.transport import TransportTripInstance
    from app.services import transport_service

    instance = TransportTripInstance.query.filter_by(
        id=instance_id, school_id=g.school_id, is_deleted=False
    ).first()
    if instance is None:
        return error_response("Instance not found", 404)
    data = request.get_json(silent=True) or {}
    student_id = _coerce_transport_uuid(data.get("student_id"))
    if not student_id:
        return error_response("student_id is required", 400)
    result = transport_service.board_student(
        str(g.school_id), instance, student_id,
        missed=bool(data.get("missed", False)),
    )
    if not result.get("ok"):
        return error_response(
            f"Student is not on this trip ({result.get('reason')})", 400
        )
    return success_response(result)


@transport_bp.route("/instances/<uuid:instance_id>/dropoff", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager", "teacher")
def dropoff_students(instance_id):
    """Bulk drop-off at a stop: body {stop_id?} — everyone onboard whose end
    stop matches alights (omit stop_id to drop everyone onboard)."""
    from app.models.transport import TransportTripInstance
    from app.services import transport_service

    instance = TransportTripInstance.query.filter_by(
        id=instance_id, school_id=g.school_id, is_deleted=False
    ).first()
    if instance is None:
        return error_response("Instance not found", 404)
    data = request.get_json(silent=True) or {}
    stop_id = _coerce_transport_uuid(data.get("stop_id"))
    result = transport_service.drop_off_at_stop(str(g.school_id), instance, stop_id)
    return success_response(result)


@transport_bp.route("/notification-prefs", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def get_notification_prefs():
    """Per-student transport notification toggles (parent/ admin read).
    Parents see their own children; missing rows are the defaults."""
    from app.models.transport import TransportNotificationPref

    own_ids = _transport_scoped_student_ids()
    if not own_ids:
        return success_response({"prefs": []})
    rows = TransportNotificationPref.query.filter(
        TransportNotificationPref.school_id == g.school_id,
        TransportNotificationPref.student_id.in_(list(own_ids)),
        TransportNotificationPref.is_deleted.is_(False),
    ).all()
    return success_response({
        "prefs": [
            {
                "student_id": str(p.student_id),
                "near_pickup_radius_m": p.near_pickup_radius_m,
                "near_dropoff_radius_m": p.near_dropoff_radius_m,
                "notify_next_stop_pickup": bool(p.notify_next_stop_pickup),
                "notify_near_pickup": bool(p.notify_near_pickup),
                "notify_arrived_pickup": bool(p.notify_arrived_pickup),
                "notify_picked_up": bool(p.notify_picked_up),
                "notify_missed_pickup": bool(p.notify_missed_pickup),
                "notify_near_dropoff": bool(p.notify_near_dropoff),
                "notify_arrived_dropoff": bool(p.notify_arrived_dropoff),
            }
            for p in rows
        ],
        "defaults": {"near_pickup_radius_m": 150, "near_dropoff_radius_m": 150},
    })


@transport_bp.route("/notification-prefs", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
def update_notification_prefs():
    """Upsert one student's toggles. Parents may only set their own
    children's."""
    from app.models.transport import TransportNotificationPref

    data = request.get_json(silent=True) or {}
    student_id = _coerce_transport_uuid(data.get("student_id"))
    if not student_id:
        return error_response("student_id is required", 400)
    allowed = _transport_scoped_student_ids()
    if allowed is not None and str(student_id) not in allowed:
        return error_response("You can only manage your own children's alerts", 403)

    toggles = {
        "notify_next_stop_pickup": bool,
        "notify_near_pickup": bool,
        "notify_arrived_pickup": bool,
        "notify_picked_up": bool,
        "notify_missed_pickup": bool,
        "notify_near_dropoff": bool,
        "notify_arrived_dropoff": bool,
    }
    pref = TransportNotificationPref.query.filter(
        TransportNotificationPref.school_id == g.school_id,
        TransportNotificationPref.student_id == student_id,
        TransportNotificationPref.is_deleted.is_(False),
    ).first()
    if pref is None:
        pref = TransportNotificationPref(school_id=g.school_id, student_id=student_id)
        db.session.add(pref)
    for key in ("near_pickup_radius_m", "near_dropoff_radius_m"):
        if key in data:
            try:
                pref.__setattr__(key, max(50, min(int(data[key] or 150), 2000)))
            except (TypeError, ValueError):
                return error_response(f"{key} must be an integer", 400)
    for key, cast in toggles.items():
        if key in data:
            pref.__setattr__(key, cast(data[key]))
    db.session.commit()
    return success_response({"student_id": str(student_id)})


def _transport_scoped_student_ids():
    """Student ids the caller may act on: None = staff (all), set = own."""
    if g.role in ("superadmin", "school_admin", "transport_manager", "teacher", "accountant"):
        return None
    if g.role == "parent":
        return {
            str(s.id) for s in Student.query.filter(
                Student.school_id == g.school_id,
                Student.is_deleted.is_(False),
                Student.guardians.any(user_id=g.user_id),
            ).all()
        }
    if g.role == "student":
        own = Student.query.filter_by(
            user_id=g.user_id, school_id=g.school_id, is_deleted=False
        ).first()
        return {str(own.id)} if own else set()
    return set()


@transport_bp.route("/reports/missed-pickups", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager")
def missed_pickups_report():
    """Missed-pickup register (A-42): ride_status=2 rows over a date range."""
    from app.models.transport import TransportTripReservation, TransportTripInstance

    from_d, _ = _transport_parse_date(request.args.get("from"))
    to_d, _ = _transport_parse_date(request.args.get("to"))
    query = (
        db.session.query(TransportTripReservation, TransportTripInstance)
        .join(
            TransportTripInstance,
            TransportTripInstance.id == TransportTripReservation.instance_id,
        )
        .filter(
            TransportTripReservation.school_id == g.school_id,
            TransportTripReservation.ride_status == 2,
            TransportTripReservation.is_deleted.is_(False),
            TransportTripInstance.is_deleted.is_(False),
        )
    )
    if from_d:
        query = query.filter(TransportTripInstance.date >= from_d)
    if to_d:
        query = query.filter(TransportTripInstance.date <= to_d)
    rows = query.order_by(TransportTripInstance.date.desc()).limit(500).all()
    return success_response({
        "missed": [
            {
                "student_id": str(r.student_id),
                "student_name": (
                    f"{r.student.first_name or ''} {r.student.last_name or ''}".strip()
                    if r.student else None
                ),
                "date": i.date.isoformat(),
                "date_bs": i.date_bs,
                "direction": i.direction,
                "bus": i.bus.vehicle_number if i.bus else None,
            }
            for r, i in rows
        ]
    })


@transport_bp.route("/reports/trip-history", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("gps_tracking")
@role_required("superadmin", "school_admin", "transport_manager")
def trip_history_report():
    """Per-instance post-mortem (A-42): stops visited on time vs late,
    boarded/dropped/missed counts. GPS replay rides the existing GPSLog
    history (the telemetry SBT does not keep)."""
    from app.models.transport import TransportTripInstance

    from_d, _ = _transport_parse_date(request.args.get("from"))
    to_d, _ = _transport_parse_date(request.args.get("to"))
    query = TransportTripInstance.query.filter(
        TransportTripInstance.school_id == g.school_id,
        TransportTripInstance.is_deleted.is_(False),
    )
    if from_d:
        query = query.filter(TransportTripInstance.date >= from_d)
    if to_d:
        query = query.filter(TransportTripInstance.date <= to_d)
    instances = query.order_by(TransportTripInstance.date.desc()).limit(200).all()
    reports = []
    for i in instances:
        stops = sorted(i.stops, key=lambda s: s.seq)
        on_time = sum(
            1 for s in stops
            if s.actual_ts and s.planned_ts and s.actual_ts <= s.planned_ts
        )
        visited = sum(1 for s in stops if s.actual_ts)
        boarded = sum(1 for r in i.reservations if not r.is_deleted and r.ride_status in (1, 3))
        missed = sum(1 for r in i.reservations if not r.is_deleted and r.ride_status == 2)
        reports.append({
            "instance_id": str(i.id),
            "date": i.date.isoformat(),
            "date_bs": i.date_bs,
            "direction": i.direction,
            "bus": i.bus.vehicle_number if i.bus else None,
            "status": i.status,
            "stops_total": len(stops),
            "stops_visited": visited,
            "stops_on_time": on_time,
            "boarded": boarded,
            "missed": missed,
        })
    return success_response({"trips": reports})


def _transport_parse_date(value):
    if not value:
        return None, None
    try:
        return date.fromisoformat(str(value).strip()), None
    except ValueError:
        from app.utils.nepali_date import bs_to_ad

        ad = bs_to_ad(str(value).strip())
        return (ad, value) if ad else (None, None)
