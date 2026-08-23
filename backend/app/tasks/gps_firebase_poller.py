"""Firebase RTDB poller for ESP32 GPS trackers.

The device firmware (hardware/ESP32_GPS_tracker/firmware.ino) PUTs a JSON fix
to  {FIREBASE_DATABASE_URL}/schools/{SCHOOL_ID}/buses/{DEVICE_ID}/location.json

This poller runs on the Celery beat every 15 seconds, reads each registered
bus's latest fix and forwards fresh ones to process_gps_data, which persists
the log and broadcasts gps_update over Socket.IO.
"""
import logging
import os

import requests
from sqlalchemy import func

from extensions import celery, db
from app.models.school import School
from app.models.transport import Bus, GPSLog
from app.tasks.gps_processing import check_geofence_alerts, process_gps_data

logger = logging.getLogger(__name__)


def _pick_latest_fix(node):
    """Return the freshest fix dict from an RTDB location node.

    Two shapes exist by transport:
      - WiFi path: firmware PUTs a flat object at location.json.
      - GPRS path: SIM800L cannot PUT, so the firmware POSTs, which appends
        push-children; take the child with the newest "ts".
    """
    if not isinstance(node, dict):
        return None
    if "lat" in node and "lng" in node:
        return node
    best, best_ts = None, ""
    for child in node.values():
        if isinstance(child, dict) and "lat" in child and "lng" in child:
            ts = str(child.get("ts") or "")
            if ts >= best_ts:
                best, best_ts = child, ts
    return best


@celery.task(name="poll_firebase_gps", queue="gps")
def poll_firebase_gps():
    """Pull latest GPS fixes from Firebase RTDB for all registered devices."""
    base_url = (os.getenv("FIREBASE_DATABASE_URL") or "").rstrip("/")
    secret = os.getenv("FIREBASE_SECRET") or os.getenv("FIREBASE_SERVER_KEY") or ""
    if not base_url:
        logger.debug("poll_firebase_gps skipped: FIREBASE_DATABASE_URL not configured")
        return {"status": "unconfigured"}

    session = requests.Session()
    dispatched = 0

    buses = (
        Bus.query.filter(Bus.is_active.is_(True))
        .filter(Bus.gps_device_id.isnot(None))
        .filter(Bus.gps_device_id != "")
        .all()
    )
    school_ids = {bus.school_id for bus in buses}
    active_school_ids = (
        {
            row[0]
            for row in db.session.query(School.id)
            .filter(School.id.in_(school_ids), School.is_active.is_(True))
            .all()
        }
        if school_ids
        else set()
    )

    for bus in buses:
        if bus.school_id not in active_school_ids:
            continue

        url = f"{base_url}/schools/{bus.school_id}/buses/{bus.gps_device_id}/location.json"
        try:
            resp = session.get(url, params={"auth": secret} if secret else {}, timeout=8)
            if resp.status_code != 200:
                continue
            node = resp.json()
        except (requests.RequestException, ValueError):
            continue

        fix = _pick_latest_fix(node)
        if not fix:
            continue

        ts_raw = fix.get("ts")
        try:
            from datetime import datetime, timezone

            ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            from datetime import datetime, timezone

            ts = datetime.now(timezone.utc)

        # Skip fixes already persisted.
        last_ts = (
            GPSLog.query.with_entities(func.max(GPSLog.timestamp))
            .filter(GPSLog.bus_id == bus.id)
            .scalar()
        )
        if last_ts is not None and ts <= last_ts:
            continue

        process_gps_data.delay(
            bus_id=str(bus.id),
            lat=fix.get("lat"),
            lng=fix.get("lng"),
            speed=fix.get("speed"),
            heading=fix.get("heading"),
            timestamp=ts.isoformat(),
            accuracy_m=fix.get("hdop"),
        )
        check_geofence_alerts.delay(str(bus.id), fix.get("lat"), fix.get("lng"))
        dispatched += 1

    return {"status": "ok", "devices": len(buses), "dispatched": dispatched}
