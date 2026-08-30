"""Transport / GPS Bus Tracking API — routes, buses, stops, GPS logs."""
import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.transport import Route, Bus, BusStop, GPSLog
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

transport_bp = Blueprint("transport", __name__, url_prefix="/transport")


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
