"""GPS tracking data processing tasks."""
from extensions import celery


@celery.task(name="process_gps_data", queue="gps")
def process_gps_data(bus_id: str, lat: float, lng: float, speed: float, timestamp: str):
    """Process incoming GPS data from ESP32 tracker."""
    from app.models.transport import GPSLog, Bus
    from extensions import db
    from datetime import datetime

    log = GPSLog(
        bus_id=bus_id,
        latitude=lat,
        longitude=lng,
        speed=speed,
        recorded_at=datetime.fromisoformat(timestamp),
    )
    db.session.add(log)

    bus = Bus.query.get(bus_id)
    if bus:
        bus.current_lat = lat
        bus.current_lng = lng
        bus.last_speed = speed

    db.session.commit()


@celery.task(name="check_geofence_alerts", queue="gps")
def check_geofence_alerts(bus_id: str, lat: float, lng: float):
    """Check if bus has left expected geofence and alert if needed."""
    import math
    import logging
    from app.models.transport import Bus, BusStop
    from app.tasks.push_notifications import send_push_to_school

    logger = logging.getLogger(__name__)

    bus = Bus.query.get(bus_id)
    if not bus or not bus.route_id:
        return

    # Get all stops on this bus's route as geofence corridor points
    stops = BusStop.query.filter_by(
        route_id=bus.route_id, is_deleted=False
    ).order_by(BusStop.sequence_number).all()

    if not stops:
        return

    def haversine_km(lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS points in km."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
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
            d = haversine_km(lat, lng, float(stop.latitude), float(stop.longitude))
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
            "bus_id": bus_id,
            "distance_km": round(min_distance, 2),
        }

    return {"alert": False, "bus_id": bus_id, "distance_km": round(min_distance, 2)}
