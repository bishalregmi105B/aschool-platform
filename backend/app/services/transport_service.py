"""S-A4 transport trip service (A-10/A-11) — the geofence engine and ride
state machine.

Design notes (from the SchoolBusTrack v2 re-audit):
  - stops are visited strictly in sequence; arrival auto-marks ONLY when no
    passengers are still waiting/boarded at the stop (anti-false-arrival);
  - the driver phone is just a second GPS source: both the ESP32 poller and
    `ingest_position` feed the same engine;
  - every alert honors the per-student notification prefs and is deduped
    through TransportAlertLog (30-minute window, DB-enforced);
  - ending a trip is refused while any student is still onboard.
"""
import logging
import math
from datetime import date, datetime, time as dt_time, timedelta, timezone

logger = logging.getLogger(__name__)

DEFAULT_ARRIVAL_RADIUS_M = 100
DEFAULT_NEAR_RADIUS_M = 150
DEFAULT_SLOW_RADIUS_M = 1000


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    """Great-circle distance in metres."""
    try:
        lat1, lng1, lat2, lng2 = (
            float(lat1), float(lng1), float(lat2), float(lng2)
        )
    except (TypeError, ValueError):
        return float("inf")
    if None in (lat1, lng1, lat2, lng2):
        return float("inf")
    rad = math.pi / 180.0
    dlat = (lat2 - lat1) * rad
    dlng = (lng2 - lng1) * rad
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin(dlng / 2) ** 2
    )
    return 6371000.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def transport_radii(school) -> dict:
    cfg = {}
    if school is not None and isinstance(getattr(school, "settings", None), dict):
        cfg = school.settings.get("transport") or {}
    return {
        "arrival_radius_m": int(cfg.get("arrival_radius_m") or DEFAULT_ARRIVAL_RADIUS_M),
        "near_radius_m": int(cfg.get("near_radius_m") or DEFAULT_NEAR_RADIUS_M),
        "slow_radius_m": int(cfg.get("slow_radius_m") or DEFAULT_SLOW_RADIUS_M),
    }


def _pref_for(school_id, student_id):
    from app.models.transport import TransportNotificationPref

    return TransportNotificationPref.query.filter(
        TransportNotificationPref.school_id == school_id,
        TransportNotificationPref.student_id == student_id,
        TransportNotificationPref.is_deleted.is_(False),
    ).first()


def publish_instances_for_date(school_id, day: date) -> dict:
    """Materialize today's instances from active trip definitions (the
    every-minute publish beat calls this for the BS-today AD date)."""
    from app.models.transport import TransportTrip, TransportTripInstance
    from app.models.base import SchoolModel
    from extensions import db

    weekday = day.weekday()  # Mon=0 (ISO)
    trips = TransportTrip.query.filter(
        TransportTrip.school_id == school_id,
        TransportTrip.status == "active",
        TransportTrip.is_deleted.is_(False),
    ).all()

    created = 0
    skipped = 0
    for trip in trips:
        weekdays = trip.weekdays if isinstance(trip.weekdays, list) else []
        if weekdays and weekday not in [int(w) for w in weekdays]:
            skipped += 1
            continue
        exists = TransportTripInstance.query.filter(
            TransportTripInstance.school_id == school_id,
            TransportTripInstance.trip_id == trip.id,
            TransportTripInstance.date == day,
            TransportTripInstance.is_deleted.is_(False),
        ).first()
        if exists:
            skipped += 1
            continue
        if not trip.effective_date_bs:
            pass  # effective immediately when unset
        instance = TransportTripInstance(
            school_id=school_id,
            trip_id=trip.id,
            date=day,
            direction=trip.direction,
            driver_id=trip.driver_id,
            bus_id=trip.bus_id,
            status="scheduled",
        )
        db.session.add(instance)
        db.session.flush()
        _materialize_stops(school_id, trip, instance)
        _create_reservations(school_id, trip, instance)
        created += 1
    if created:
        db.session.commit()
    return {"created": created, "skipped": skipped}


def _materialize_stops(school_id, trip, instance) -> None:
    """Instance stop rows with planned timestamps derived from
    first_stop_time + seq × stop_to_stop_avg (local clock, tz-agnostic)."""
    from app.models.transport import TransportTripInstanceStop
    from extensions import db

    stops = sorted(
        [s for s in trip.route.stops if not s.is_deleted],
        key=lambda s: s.sequence_number or 0,
    )
    base_minutes = 0
    if trip.first_stop_time:
        base_minutes = trip.first_stop_time.hour * 60 + trip.first_stop_time.minute
    step = int(trip.stop_to_stop_avg_mins or 5)
    for seq, stop in enumerate(stops):
        planned = None
        if trip.first_stop_time:
            planned = datetime.combine(
                instance.date,
                dt_time((base_minutes + seq * step) // 60 % 24,
                        (base_minutes + seq * step) % 60),
                tzinfo=timezone.utc,
            )
        db.session.add(
            TransportTripInstanceStop(
                school_id=school_id,
                instance_id=instance.id,
                stop_id=stop.id,
                seq=seq,
                planned_ts=planned,
            )
        )


def _create_reservations(school_id, trip, instance) -> None:
    """One reservation per student assigned to the route's stops
    (BusStop.student_ids — the allocation surface). Morning: start = their
    stop, end = the LAST stop (school); afternoon: reversed."""
    from app.models.transport import TransportTripReservation
    from extensions import db

    stops = sorted(
        [s for s in trip.route.stops if not s.is_deleted],
        key=lambda s: s.sequence_number or 0,
    )
    if not stops:
        return
    school_stop = stops[-1] if trip.direction == "morning" else stops[0]
    seen = set()
    for stop in stops:
        for sid in (stop.student_ids or []):
            key = str(sid)
            if key in seen:
                continue
            seen.add(key)
            start_stop = stop if trip.direction == "morning" else school_stop
            end_stop = school_stop if trip.direction == "morning" else stop
            db.session.add(
                TransportTripReservation(
                    school_id=school_id,
                    instance_id=instance.id,
                    student_id=sid,
                    start_stop_id=start_stop.id,
                    end_stop_id=end_stop.id,
                    ride_status=0,
                )
            )


def ingest_position(school_id, instance, lat, lng, speed_kmh=None) -> dict:
    """Driver-phone GPS ingest — the same geofence engine the ESP32 poller
    feeds via process_gps_data. Returns the trigger summary for the API."""
    from app.models.transport import TransportTripInstance
    from extensions import db

    instance.last_lat = lat
    instance.last_lng = lng
    instance.last_speed_kmh = speed_kmh
    instance.last_fix_at = datetime.now(timezone.utc)

    triggers = []
    if instance.status == "scheduled":
        instance.status = "running"
        instance.started_at = datetime.now(timezone.utc)
        triggers.append({"event": "trip_started"})

    from app.models.school import School

    school = School.query.get(school_id)
    radii = transport_radii(school)
    stops = sorted(instance.stops, key=lambda s: s.seq)
    next_stop = next((s for s in stops if s.actual_ts is None), None)
    if next_stop is not None and next_stop.stop is not None:
        dist = haversine_m(lat, lng, next_stop.stop.latitude, next_stop.stop.longitude)
        triggers.extend(
            _per_passenger_triggers(school_id, instance, next_stop, dist, radii)
        )
        waiting = any(
            r.ride_status == 0 and r.start_stop_id == next_stop.stop_id
            for r in instance.reservations
            if not r.is_deleted
        )
        onboard_here = any(
            r.ride_status == 1 and (
                (instance.direction == "afternoon" and r.end_stop_id == next_stop.stop_id)
                or instance.direction == "morning"
            )
            for r in instance.reservations
            if not r.is_deleted
        )
        if dist <= radii["arrival_radius_m"] and not waiting and not (
            instance.direction == "afternoon" and onboard_here
        ):
            next_stop.actual_ts = datetime.now(timezone.utc)
            triggers.append({"event": "stop_arrival", "stop_id": str(next_stop.stop_id)})

    db.session.commit()
    return {"triggers": triggers, "status": instance.status}


def _per_passenger_triggers(school_id, instance, instance_stop, dist_m, radii) -> list:
    """The per-passenger trigger matrix (A-11): near / arrived for the stop,
    honoring per-student prefs + 30-min dedupe. Only the boarding direction
    of this instance is relevant (morning = pickup, afternoon = dropoff)."""
    from app.models.transport import TransportAlertLog

    triggers = []
    stop = instance_stop.stop
    pickup_side = instance.direction == "morning"
    near_radius = (
        radii["near_radius_m"]
    )
    for reservation in instance.reservations:
        if reservation.is_deleted or reservation.ride_status not in (0, 1):
            continue
        relevant_stop_id = (
            reservation.start_stop_id if pickup_side else reservation.end_stop_id
        )
        if str(relevant_stop_id or "") != str(stop.id):
            continue
        pref = _pref_for(school_id, reservation.student_id)
        radius = None
        if pickup_side:
            if pref is not None and pref.near_pickup_radius_m:
                radius = int(pref.near_pickup_radius_m)
        elif pref is not None and pref.near_dropoff_radius_m:
            radius = int(pref.near_dropoff_radius_m)
        effective_near = radius or near_radius

        if not pickup_side and reservation.ride_status == 1:
            # onboard for the afternoon run — dropoff side triggers
            if dist_m <= radii["arrival_radius_m"] and _pref_allows(
                pref, "notify_arrived_dropoff"
            ):
                if _fire_alert(school_id, instance, reservation, "arrived_dropoff"):
                    triggers.append({"event": "arrived_dropoff",
                                     "student_id": str(reservation.student_id)})
            elif dist_m <= effective_near and _pref_allows(pref, "notify_near_dropoff"):
                if _fire_alert(school_id, instance, reservation, "near_dropoff"):
                    triggers.append({"event": "near_dropoff",
                                     "student_id": str(reservation.student_id)})
            continue
        if reservation.ride_status != 0 or not pickup_side:
            continue

        if dist_m <= radii["arrival_radius_m"] and _pref_allows(pref, "notify_arrived_pickup"):
            if _fire_alert(school_id, instance, reservation, "arrived_pickup"):
                triggers.append({"event": "arrived_pickup",
                                 "student_id": str(reservation.student_id)})
        elif dist_m <= effective_near and _pref_allows(pref, "notify_near_pickup"):
            if _fire_alert(school_id, instance, reservation, "near_pickup"):
                triggers.append({"event": "near_pickup",
                                 "student_id": str(reservation.student_id)})
    return triggers


def _pref_allows(pref, toggle: str) -> bool:
    if pref is None:
        return True
    return bool(getattr(pref, toggle, True))


def _fire_alert(school_id, instance, reservation, event: str) -> bool:
    """Send one guardian alert honoring prefs + dedupe. Returns False when
    the dedupe window already has this alert."""
    from app.models.transport import TransportAlertLog
    from extensions import db

    dedupe_cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    already = (
        TransportAlertLog.query.filter(
            TransportAlertLog.instance_id == instance.id,
            TransportAlertLog.student_id == reservation.student_id,
            TransportAlertLog.event == event,
            TransportAlertLog.sent_at > dedupe_cutoff,
            TransportAlertLog.is_deleted.is_(False),
        ).first()
    )
    if already is not None:
        return False  # inside the dedupe window — already alerted
    db.session.add(
        TransportAlertLog(
            school_id=school_id,
            instance_id=instance.id,
            student_id=reservation.student_id,
            event=event,
            sent_at=datetime.now(timezone.utc),
        )
    )
    db.session.flush()

    try:
        from app.models.notification import InAppNotification
        from app.models.student import Guardian
        from app.models.user import User

        guardians = Guardian.query.filter_by(
            student_id=reservation.student_id, is_deleted=False
        ).all()
        labels = {
            "near_pickup": "Bus is approaching the pickup stop",
            "arrived_pickup": "Bus has arrived at the pickup stop",
            "near_dropoff": "Bus is approaching the drop-off stop",
            "arrived_dropoff": "Bus has arrived at the drop-off stop",
            "picked_up": "Student boarded the bus",
            "missed_pickup": "Student missed the pickup",
            "dropped_off": "Student was dropped off",
        }
        title = "Transport update"
        body = labels.get(event, event.replace("_", " "))
        for guardian in guardians:
            if guardian.user_id:
                db.session.add(
                    InAppNotification(
                        school_id=school_id,
                        user_id=guardian.user_id,
                        title=title,
                        body=body,
                        category="transport",
                        data={"instance_id": str(instance.id),
                              "student_id": str(reservation.student_id),
                              "event": event},
                    )
                )
        db.session.commit()
        from app.plugins.events import emit_for_school

        emit_for_school(
            f"transport.{event}",
            school_id=str(school_id),
            student_id=str(reservation.student_id),
            instance_id=str(instance.id),
        )
    except Exception:  # noqa: BLE001 — alerting must not break the ingest
        logger.exception("transport alert delivery failed")
        try:
            db.session.rollback()
        except Exception:
            pass
    return True


def board_student(school_id, instance, student_id, missed=False) -> dict:
    """Pick-up (ride_status 1) or missed (2) — the QR/manual board flow."""
    from app.models.transport import TransportTripReservation
    from extensions import db

    reservation = TransportTripReservation.query.filter(
        TransportTripReservation.school_id == school_id,
        TransportTripReservation.instance_id == instance.id,
        TransportTripReservation.student_id == student_id,
        TransportTripReservation.is_deleted.is_(False),
    ).first()
    if reservation is None:
        return {"ok": False, "reason": "not_on_trip"}
    if reservation.ride_status in (2, 3):
        return {"ok": False, "reason": "already_final"}
    reservation.ride_status = 2 if missed else 1
    if missed:
        _fire_alert(school_id, instance, reservation, "missed_pickup")
    else:
        reservation.boarded_at = datetime.now(timezone.utc)
        _fire_alert(school_id, instance, reservation, "picked_up")
    db.session.commit()
    return {"ok": True, "ride_status": reservation.ride_status}


def drop_off_at_stop(school_id, instance, stop_id=None) -> dict:
    """Bulk drop-off: everyone onboard alights at their end stop (when it is
    the given/current stop) → ride_status 3 + alert."""
    from app.models.transport import TransportTripReservation
    from extensions import db

    dropped = 0
    for reservation in instance.reservations:
        if reservation.is_deleted or reservation.ride_status != 1:
            continue
        if stop_id is not None and str(reservation.end_stop_id or "") != str(stop_id):
            continue
        reservation.ride_status = 3
        reservation.dropped_at = datetime.now(timezone.utc)
        _fire_alert(school_id, instance, reservation, "dropped_off")
        dropped += 1
    db.session.commit()
    return {"dropped": dropped}


def end_instance(school_id, instance) -> dict:
    """End a run — refused while any student is still onboard (the safety
    guard SBT got right)."""
    from app.models.transport import TransportTripInstance
    from extensions import db

    onboard = sum(
        1 for r in instance.reservations
        if not r.is_deleted and r.ride_status == 1
    )
    if onboard:
        return {"ok": False, "onboard": onboard}
    instance.status = "completed"
    instance.ended_at = datetime.now(timezone.utc)
    remaining = sum(
        1 for r in instance.reservations
        if not r.is_deleted and r.ride_status == 0
    )
    if remaining:
        # everyone never picked up closes as missed
        for r in instance.reservations:
            if not r.is_deleted and r.ride_status == 0:
                r.ride_status = 2
        db.session.commit()
    db.session.commit()
    return {"ok": True, "missed_at_end": remaining}


def force_end_stale(school_id, max_age_hours: int = 4) -> int:
    """Beat safety net: running instances whose last fix is older than the
    window (driver app died mid-trip) close as completed with the tail
    marked missed."""
    from app.models.transport import TransportTripInstance
    from extensions import db

    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    stale = TransportTripInstance.query.filter(
        TransportTripInstance.school_id == school_id,
        TransportTripInstance.status == "running",
        TransportTripInstance.is_deleted.is_(False),
        TransportTripInstance.last_fix_at < cutoff,
    ).all() if True else []
    count = 0
    for instance in stale:
        result = end_instance(school_id, instance)
        if result.get("ok"):
            count += 1
    return count
