"""GPS tracking data processing tasks.

Pipeline: ESP32 device -> Firebase RTDB -> poll_firebase_gps (beat, 15 s)
          -> process_gps_data (persist + Socket.IO broadcast)
          -> check_geofence_alerts (route-deviation alerts).
"""
from extensions import celery

_GPS_EMITTER = None


def _emit_gps_update(payload: dict, room: str) -> None:
    """Broadcast a gps_update event to browser clients in the school room.

    Celery workers run outside the Flask/Socket.IO server process, so they
    publish through the Redis message queue that the server's SocketIO is
    bound to (see socketio.init_app in the app factory).
    """
    global _GPS_EMITTER
    try:
        import os
        from flask_socketio import SocketIO

        if _GPS_EMITTER is None:
            url = (
                os.getenv("SOCKET_MESSAGE_QUEUE")
                or os.getenv("REDIS_URL")
                or "redis://localhost:6379/0"
            )
            _GPS_EMITTER = SocketIO(message_queue=url, logger=False, engineio_logger=False)
        _GPS_EMITTER.emit("gps_update", payload, room=room)
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "gps_update emit failed (room=%s) — continuing without realtime push",
            room,
            exc_info=True,
        )


@celery.task(name="process_gps_data", queue="gps")
def process_gps_data(
    bus_id,
    lat,
    lng,
    speed=None,
    timestamp=None,
    heading=None,
    accuracy_m=None,
    satellites=None,
):
    """Persist one GPS fix from an ESP32 tracker and push it to live clients."""
    from datetime import datetime, timezone

    from extensions import db
    from app.models.transport import Bus, GPSLog

    if timestamp:
        recorded_at = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    else:
        recorded_at = datetime.now(timezone.utc)

    # Address by internal UUID or by device id, as the firmware sends.
    bus = None
    try:
        import uuid as _uuid

        bus = db.session.get(Bus, _uuid.UUID(str(bus_id)))
    except (ValueError, AttributeError, TypeError):
        bus = None
    if bus is None:
        bus = Bus.query.filter_by(gps_device_id=str(bus_id), is_deleted=False).first()
    if not bus:
        return {"status": "unknown_bus", "bus_id": str(bus_id)}

    log = GPSLog(
        school_id=bus.school_id,
        bus_id=bus.id,
        latitude=lat,
        longitude=lng,
        speed_kmh=speed,
        heading=heading,
        accuracy_m=accuracy_m,
        timestamp=recorded_at,
        firebase_synced=True,
    )
    db.session.add(log)
    db.session.commit()

    _emit_gps_update(
        {
            "bus_id": str(bus.id),
            "vehicle_number": bus.vehicle_number,
            "school_id": str(bus.school_id),
            "latitude": float(lat),
            "longitude": float(lng),
            "speed": float(speed) if speed is not None else None,
            "timestamp": recorded_at.isoformat(),
        },
        room=f"school-{bus.school_id}",
    )

    return {
        "status": "ok",
        "bus_id": str(bus.id),
        "lat": float(lat),
        "lng": float(lng),
    }


@celery.task(name="check_geofence_alerts", queue="gps")
def check_geofence_alerts(bus_id, lat, lng):
    """Check if bus has left expected geofence and alert if needed."""
    import math
    import logging
    from app.models.transport import Bus, BusStop
    from app.tasks.push_notifications import send_push_to_school

    logger = logging.getLogger(__name__)

    bus = None
    try:
        import uuid as _uuid

        bus = Bus.query.filter(
            (Bus.id == _uuid.UUID(str(bus_id)))
            | (Bus.gps_device_id == str(bus_id))
        ).first()
    except (ValueError, AttributeError, TypeError):
        bus = Bus.query.filter_by(gps_device_id=str(bus_id), is_deleted=False).first()
    if not bus or not bus.route_id:
        return {"alert": False}

    # Get all stops on this bus's route as geofence corridor points
    stops = BusStop.query.filter_by(
        route_id=bus.route_id, is_deleted=False
    ).order_by(BusStop.sequence_number).all()

    if not stops:
        return {"alert": False}

    def haversine_km(lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS points in km."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lat1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Check minimum distance to any stop on the route
    GEOFENCE_RADIUS_KM = 2.0  # Alert if bus is >2km from nearest stop

    min_distance = float("inf")
    for stop in stops:
        if stop.latitude and stop.longitude:
            d = haversine_km(float(lat), float(lng), float(stop.latitude), float(stop.longitude))
            min_distance = min(min_distance, d)

    if min_distance > GEOFENCE_RADIUS_KM:
        logger.warning(
            f"Bus {bus.vehicle_number} is {min_distance:.1f}km from route "
            f"(geofence={GEOFENCE_RADIUS_KM}km)"
        )
        send_push_to_school.delay(
            bus.school_id,
            "Bus Route Alert",
            f"Bus {bus.vehicle_number} has deviated {min_distance:.1f}km from its route.",
            roles=["admin", "principal", "transport_manager"],
        )
        return {
            "alert": True,
            "bus_id": str(bus.id),
            "distance_km": round(min_distance, 2),
        }

    return {"alert": False, "bus_id": str(bus.id), "distance_km": round(min_distance, 2)}
