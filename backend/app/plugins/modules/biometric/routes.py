"""Biometric Integration API (premium plugin, NPR 1999) — real device
management for ZKTeco-style fingerprint attendance terminals.

Two auth realms, deliberately separate:

1. School-admin endpoints (JWT + @plugin_required("biometric")) — register
   devices, monitor health, retry unmapped punches, read sync logs.
2. Device endpoints (NO JWT) — the device authenticates with a per-device
   API key in the `X-Device-Key` header (only its SHA-256 hash is stored).
   These are webhook-style endpoints a terminal or its push client calls:

   - POST /ingest    batch of punches, idempotent (safe to replay)
   - POST /heartbeat keep-alive; powers the online/offline status

Punches are mapped to students by device user id (matched against
Student.student_id code, then admission_number, or an explicit student_id in
the payload) and upserted into the daily `attendance` table. Unmapped punches
are stored anyway (status="unmapped") so nothing from the device is lost and
the manual sync can re-map them after students are enrolled/imported.

All writes are transactional: an ingest batch is validated atomically (any
malformed record → 400, nothing written), each punch insert runs in a
SAVEPOINT so a concurrent replay colliding on the unique indexes counts as a
duplicate instead of failing the batch, and any unexpected error rolls the
whole request back.
"""

import hashlib
import secrets
import time
import uuid as uuidlib
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.attendance import Attendance
from app.models.biometric import BiometricDevice, BiometricPunch, BiometricSyncLog
from app.models.plugin import SchoolPlugin
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

biometric_bp = Blueprint("biometric", __name__, url_prefix="/attendance/biometric")

MAX_BATCH = 500
ONLINE_WINDOW = timedelta(minutes=10)
DIRECTIONS = {"in", "out", "unknown", "", None}

# Attendance dates follow Nepal time (the product's market) regardless of the
# server's UTC clock: a 23:55 UTC punch belongs to the next school day.
NPT = timezone(timedelta(hours=5, minutes=45))


# ── Helpers ───────────────────────────────────────────────────────────────


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _device_from_key():
    """Authenticate a device by its API key. Returns (device, None) or (None, error_response)."""
    raw_key = (request.headers.get("X-Device-Key") or "").strip()
    if not raw_key:
        return None, error_response("Missing X-Device-Key header", 401)
    device = BiometricDevice.query.filter_by(
        api_key_hash=_hash_key(raw_key), is_deleted=False
    ).first()
    if not device:
        return None, error_response("Invalid device key", 401)
    if not device.is_active:
        return None, error_response("Device is disabled", 403)
    if not _plugin_active_for(device.school_id):
        return None, error_response("Biometric plugin is not active for this school", 403)
    return device, None


def _plugin_active_for(school_id) -> bool:
    """Direct DB check (devices have no JWT/subdomain context), trial-aware —
    mirrors the request-path gate in app.__init__._set_school_context."""
    row = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug="biometric", active=True
    ).first()
    if not row:
        return False
    if row.is_trial and row.trial_ends_at is not None:
        ends = row.trial_ends_at
        if ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        if ends < datetime.now(timezone.utc):
            return False
    return True


def _touch_device(device):
    device.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
    device.last_ip = (request.remote_addr or "")[:45] or None


def _parse_punch_ts(value):
    """Accept ISO-8601 (with or without Z/offset) or unix epoch seconds/millis.
    Returns aware-UTC datetime or raises ValueError."""
    if value is None:
        raise ValueError("timestamp is required")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    s = str(value).strip()
    if not s:
        raise ValueError("timestamp is required")
    if s.isdigit():
        n = int(s)
        if n > 10**12:  # epoch millis
            n /= 1000.0
        return datetime.fromtimestamp(n, tz=timezone.utc)
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _validate_batch(payload):
    """Strictly validate an ingest payload. Returns (records, errors)."""
    if not isinstance(payload, dict):
        return [], ["Payload must be a JSON object"]
    punches = payload.get("punches")
    if not isinstance(punches, list) or not punches:
        return [], ["'punches' must be a non-empty list"]
    if len(punches) > MAX_BATCH:
        return [], [f"Batch too large: {len(punches)} punches (max {MAX_BATCH})"]

    records, errors = [], []
    for i, p in enumerate(punches):
        try:
            if not isinstance(p, dict):
                raise ValueError("punch must be a JSON object")
            user_id = str(p.get("user_id") or p.get("device_user_id") or "").strip()
            if not user_id:
                raise ValueError("user_id is required")
            if len(user_id) > 100:
                raise ValueError("user_id too long (max 100)")
            punch_id = p.get("punch_id") or p.get("device_punch_id")
            punch_id = str(punch_id).strip() if punch_id not in (None, "") else None
            if punch_id and len(punch_id) > 100:
                raise ValueError("punch_id too long (max 100)")
            direction = p.get("direction")
            if direction not in DIRECTIONS:
                raise ValueError("direction must be 'in' or 'out'")
            ts = _parse_punch_ts(p.get("timestamp") or p.get("punched_at"))
            explicit_student = p.get("student_id")
            if explicit_student is not None:
                try:
                    explicit_student = str(explicit_student)
                    uuidlib.UUID(explicit_student)
                except (ValueError, AttributeError, TypeError):
                    raise ValueError("student_id must be a valid UUID")
            records.append({
                "punch_id": punch_id,
                "user_id": user_id,
                "ts_utc_aware": ts,
                "ts_utc": ts.replace(tzinfo=None),
                "direction": direction or "unknown",
                "student_id": explicit_student,
            })
        except (ValueError, TypeError, OSError, OverflowError) as e:
            errors.append({"index": i, "error": str(e)})
    return records, errors


def _resolve_student(school_id, device_user_id, explicit_student_id=None):
    """Map a device user id to a Student. Preference: explicit UUID payload id,
    then Student.student_id code, then admission_number."""
    if explicit_student_id:
        return Student.query.filter_by(
            id=explicit_student_id, school_id=school_id, is_deleted=False
        ).first()
    return (
        Student.query.filter_by(
            school_id=school_id, student_id=device_user_id, is_deleted=False
        ).first()
        or Student.query.filter_by(
            school_id=school_id, admission_number=device_user_id, is_deleted=False
        ).first()
    )


def _upsert_attendance(device, student, ts_utc_aware):
    """Create/update the daily Attendance row from a mapped punch.
    First punch of the day = check_in; later punches update check_out.
    A device punch overrides a manually-marked 'absent'. Returns the row
    (or None when the student has no class — attendance.class_id is NOT NULL)."""
    local_dt = ts_utc_aware.astimezone(NPT)
    punch_date, punch_time = local_dt.date(), local_dt.time().replace(microsecond=0)

    att = Attendance.query.filter_by(
        school_id=device.school_id, student_id=student.id, date=punch_date, is_deleted=False
    ).first()
    if att is None:
        if not student.class_id:
            return None
        att = Attendance(
            school_id=device.school_id,
            student_id=student.id,
            class_id=student.class_id,
            section_id=student.section_id,
            date=punch_date,
            status="present",
            check_in_time=punch_time,
            remarks=f"Biometric: {device.name}",
        )
        db.session.add(att)
        db.session.flush()
    else:
        if att.check_in_time is None:
            att.check_in_time = punch_time
        elif punch_time > att.check_in_time:
            att.check_out_time = punch_time
        if att.status == "absent":
            att.status = "present"
        if not att.class_id and student.class_id:
            att.class_id = student.class_id
    return att


def _sync_log(device, trigger, synced, failed, duplicates, started, detail=None):
    duration = round(time.monotonic() - started, 3)
    status = "success" if failed == 0 else ("failed" if synced == 0 and duplicates == 0 else "partial")
    log = BiometricSyncLog(
        school_id=device.school_id,
        device_id=device.id,
        device_name=device.name,
        trigger=trigger,
        status=status,
        records_synced=synced,
        records_failed=failed,
        duplicates=duplicates,
        duration_seconds=duration,
        detail=detail or {},
    )
    db.session.add(log)
    return log


def _device_status(device, now_utc):
    if not device.is_active:
        return "disabled"
    now_naive = now_utc.replace(tzinfo=None) if now_utc.tzinfo else now_utc
    if device.last_seen_at and (now_naive - device.last_seen_at) <= ONLINE_WINDOW:
        return "online"
    return "offline"


def _device_or_404(device_id):
    device = BiometricDevice.for_school(g.school_id).filter_by(id=device_id).first()
    if not device:
        return None, error_response("Device not found", 404)
    return device, None


# ── School-admin endpoints (JWT) ──────────────────────────────────────────


@biometric_bp.route("/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("biometric")
def overview():
    """Dashboard overview: device fleet health + today's punch pipeline."""
    now_utc = datetime.now(timezone.utc)
    devices = BiometricDevice.for_school(g.school_id).all()

    npt_now = now_utc.astimezone(NPT)
    npt_day_start_utc = (
        npt_now.replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )

    school_id = g.school_id
    today_punch_q = BiometricPunch.for_school(school_id).filter(
        BiometricPunch.punched_at >= npt_day_start_utc
    )
    punches_today = today_punch_q.count()
    unmapped_today = today_punch_q.filter(BiometricPunch.status == "unmapped").count()
    today_syncs = BiometricSyncLog.for_school(school_id).filter(
        BiometricSyncLog.created_at >= npt_day_start_utc
    ).count()

    # Users the devices have actually seen (per-device enrollment proxy)
    enrolled = dict(
        db.session.query(BiometricPunch.device_id, func.count(func.distinct(BiometricPunch.device_user_id)))
        .filter(BiometricPunch.school_id == school_id, BiometricPunch.is_deleted == False)  # noqa: E712
        .group_by(BiometricPunch.device_id)
        .all()
    )

    online = sum(1 for d in devices if _device_status(d, now_utc) == "online")
    return success_response({
        "stats": {
            "total_devices": len(devices),
            "online": online,
            "offline": len(devices) - online,
            "today_syncs": today_syncs,
            "punches_today": punches_today,
            "unmapped_today": unmapped_today,
        },
        "devices": [
            {**d.to_dict(), "status": _device_status(d, now_utc), "enrolled_count": enrolled.get(d.id, 0)}
            for d in devices
        ],
    })


@biometric_bp.route("/devices", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("biometric")
def list_devices():
    """List registered devices with computed health status."""
    now_utc = datetime.now(timezone.utc)
    devices = BiometricDevice.for_school(g.school_id).order_by(BiometricDevice.created_at).all()
    return success_response({"items": [
        {**d.to_dict(), "status": _device_status(d, now_utc)} for d in devices
    ]})


@biometric_bp.route("/devices", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("biometric")
@role_required("school_admin")
def create_device():
    """Register a device. The per-device API key is returned ONCE (only its
    SHA-256 hash is stored) — the dashboard must show it for copy-paste."""
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return error_response("name is required", 400)

    port = data.get("port", 4370)
    try:
        port = int(port)
        if not (1 <= port <= 65535):
            raise ValueError
    except (TypeError, ValueError):
        return error_response("port must be an integer between 1 and 65535", 400)

    serial = (str(data.get("serial_number")).strip() if data.get("serial_number") else None)
    if serial:
        exists = BiometricDevice.for_school(g.school_id).filter_by(serial_number=serial).first()
        if exists:
            return error_response("A device with this serial number is already registered", 409)

    raw_key = secrets.token_urlsafe(24)
    device = BiometricDevice(
        school_id=g.school_id,
        name=name[:120],
        serial_number=serial,
        ip_address=(str(data.get("ip_address")).strip() if data.get("ip_address") else None),
        port=port,
        location=(str(data.get("location")).strip() if data.get("location") else None),
        model=(str(data.get("model")).strip() if data.get("model") else None),
        api_key_hash=_hash_key(raw_key),
    )
    db.session.add(device)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Could not register device", 500)
    return created_response({
        **device.to_dict(),
        "status": "offline",
        "api_key": raw_key,
        "api_key_note": "Shown once — store it now. Devices authenticate with the X-Device-Key header on POST /api/v1/attendance/biometric/ingest and /heartbeat.",
    })


@biometric_bp.route("/devices/<uuid:device_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("biometric")
@role_required("school_admin")
def update_device(device_id):
    """Update device configuration (name, network, location, active flag)."""
    device, err = _device_or_404(device_id)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    if not data:
        return error_response("No fields to update", 400)

    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            return error_response("name cannot be empty", 400)
        device.name = name[:120]
    if "ip_address" in data:
        device.ip_address = str(data["ip_address"]).strip() or None
    if "location" in data:
        device.location = str(data["location"]).strip() or None
    if "model" in data:
        device.model = str(data["model"]).strip() or None
    if "serial_number" in data:
        serial = str(data["serial_number"]).strip() or None
        if serial:
            clash = BiometricDevice.for_school(g.school_id).filter(
                BiometricDevice.serial_number == serial, BiometricDevice.id != device.id
            ).first()
            if clash:
                return error_response("A device with this serial number is already registered", 409)
        device.serial_number = serial
    if "port" in data:
        try:
            port = int(data["port"])
            if not (1 <= port <= 65535):
                raise ValueError
        except (TypeError, ValueError):
            return error_response("port must be an integer between 1 and 65535", 400)
        device.port = port
    if "is_active" in data:
        device.is_active = bool(data["is_active"])

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Could not update device", 500)
    return success_response(device.to_dict())


@biometric_bp.route("/devices/<uuid:device_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("biometric")
@role_required("school_admin")
def delete_device(device_id):
    """Soft-delete a device. Its punch history is retained for audit."""
    device, err = _device_or_404(device_id)
    if err:
        return err
    device.is_deleted = True
    device.is_active = False
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Could not delete device", 500)
    return success_response({"deleted": True, "id": str(device.id)})


@biometric_bp.route("/devices/<uuid:device_id>/regenerate-key", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("biometric")
@role_required("school_admin")
def regenerate_key(device_id):
    """Replace a device's API key (e.g. after compromise). New key shown once."""
    device, err = _device_or_404(device_id)
    if err:
        return err
    raw_key = secrets.token_urlsafe(24)
    device.api_key_hash = _hash_key(raw_key)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Could not regenerate key", 500)
    return success_response({
        "device_id": str(device.id),
        "api_key": raw_key,
        "api_key_note": "Shown once — the previous key is now invalid.",
    })


@biometric_bp.route("/devices/<uuid:device_id>/sync", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("biometric")
@role_required("school_admin")
def sync_device(device_id):
    """Manual sync: re-map this device's pending/unmapped punches to students
    (e.g. after students were imported or ids fixed), update attendance, and
    record a BiometricSyncLog. Punches already mapped are not reprocessed."""
    device, err = _device_or_404(device_id)
    if err:
        return err

    started = time.monotonic()
    synced = failed = 0
    try:
        pending = BiometricPunch.for_school(g.school_id).filter(
            BiometricPunch.device_id == device.id,
            BiometricPunch.status.in_(("pending", "unmapped")),
        ).order_by(BiometricPunch.punched_at).all()
        for punch in pending:
            student = _resolve_student(g.school_id, punch.device_user_id)
            if not student:
                punch.status = "unmapped"
                punch.failure_reason = f"No student matches device user id '{punch.device_user_id}'"
                failed += 1
                continue
            att = _upsert_attendance(device, student, punch.punched_at.replace(tzinfo=timezone.utc))
            if att is None:
                punch.status = "unmapped"
                punch.failure_reason = "Student has no class assigned (attendance requires class_id)"
                failed += 1
                continue
            punch.status = "mapped"
            punch.mapped_student_id = student.id
            punch.attendance_id = att.id
            punch.failure_reason = None
            synced += 1

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        device.last_sync_at = now
        _sync_log(device, "manual", synced, failed, 0, started)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Sync failed; all changes rolled back", 500)
    return success_response({
        "device_id": str(device.id),
        "records_synced": synced,
        "records_failed": failed,
        "duplicates": 0,
    })


@biometric_bp.route("/logs", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("biometric")
def list_logs():
    """Sync logs (ingest batches + manual syncs), newest first."""
    query = BiometricSyncLog.for_school(g.school_id)
    status = request.args.get("status", "").strip()
    if status:
        if status not in ("success", "partial", "failed"):
            return error_response("status must be one of success|partial|failed", 400)
        query = query.filter(BiometricSyncLog.status == status)
    search = request.args.get("search", "").strip()
    if search:
        query = query.filter(BiometricSyncLog.device_name.ilike(f"%{search}%"))
    logs = query.order_by(BiometricSyncLog.created_at.desc()).limit(100).all()
    return success_response({"items": [l.to_dict() for l in logs]})


@biometric_bp.route("/punches", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("biometric")
def list_punches():
    """Recent raw punches (monitoring/debugging unmapped ids)."""
    query = BiometricPunch.for_school(g.school_id)
    if request.args.get("device_id"):
        try:
            device_uuid = uuidlib.UUID(request.args["device_id"])
        except (ValueError, AttributeError):
            return error_response("device_id must be a valid UUID", 400)
        query = query.filter(BiometricPunch.device_id == device_uuid)
    status = request.args.get("status", "").strip()
    if status:
        if status not in ("pending", "mapped", "unmapped"):
            return error_response("status must be one of pending|mapped|unmapped", 400)
        query = query.filter(BiometricPunch.status == status)
    try:
        limit = min(max(int(request.args.get("limit", 100)), 1), 500)
    except (TypeError, ValueError):
        return error_response("limit must be an integer", 400)
    punches = query.order_by(BiometricPunch.punched_at.desc()).limit(limit).all()
    return success_response({"items": [{**p.to_dict(), "device_name": p.device.name if p.device else None} for p in punches]})


# ── Device endpoints (X-Device-Key auth, no JWT) ──────────────────────────


@biometric_bp.route("/ingest", methods=["POST"])
def ingest():
    """Device punch ingestion. Auth: X-Device-Key header.

    Body: {"punches": [{"punch_id": "12", "user_id": "S001",
                        "timestamp": "2026-08-28T09:05:00+05:45",
                        "direction": "in"}, ...]}

    Idempotent: replays of the same punch (device punch id, or device+user+
    timestamp) are counted as duplicates and never double-written. Validated
    atomically — any malformed record rejects the whole batch with 400 and
    nothing is written. Mapped punches upsert the daily attendance row.
    """
    device, err = _device_from_key()
    if err:
        return err

    payload = request.get_json(silent=True)
    records, errors = _validate_batch(payload)
    if errors:
        db.session.rollback()
        return error_response("Invalid ingest payload; nothing was written", 400, data={"invalid_records": errors})

    started = time.monotonic()
    new_punches = duplicates = failed = 0
    try:
        for rec in records:
            # Replay guard: same device punch id OR same (device, user, ts).
            dup_filters = [
                BiometricPunch.school_id == device.school_id,
                BiometricPunch.device_id == device.id,
                BiometricPunch.is_deleted == False,  # noqa: E712
                and_(
                    BiometricPunch.device_user_id == rec["user_id"],
                    BiometricPunch.punched_at == rec["ts_utc"],
                ),
            ]
            if rec["punch_id"]:
                dup_filters.append(BiometricPunch.device_punch_id == rec["punch_id"])
            if BiometricPunch.query.filter(*dup_filters).first():
                duplicates += 1
                continue

            student = _resolve_student(device.school_id, rec["user_id"], rec["student_id"])

            # SAVEPOINT: a concurrent replay colliding on the unique indexes
            # rolls back only this insert and counts as a duplicate.
            punch = BiometricPunch(
                school_id=device.school_id,
                device_id=device.id,
                device_punch_id=rec["punch_id"],
                device_user_id=rec["user_id"],
                punched_at=rec["ts_utc"],
                direction=rec["direction"],
                raw={"user_id": rec["user_id"], "timestamp": rec["ts_utc"].isoformat() + "Z"},
            )
            nested = db.session.begin_nested()
            try:
                db.session.add(punch)
                db.session.flush()
            except IntegrityError:
                nested.rollback()
                duplicates += 1
                continue

            if not student:
                punch.status = "unmapped"
                punch.failure_reason = f"No student matches device user id '{rec['user_id']}'"
                failed += 1
                continue
            att = _upsert_attendance(device, student, rec["ts_utc_aware"])
            if att is None:
                punch.status = "unmapped"
                punch.failure_reason = "Student has no class assigned (attendance requires class_id)"
                failed += 1
                continue
            punch.status = "mapped"
            punch.mapped_student_id = student.id
            punch.attendance_id = att.id
            new_punches += 1

        _touch_device(device)
        _sync_log(device, "device", new_punches, failed, duplicates, started)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Ingest failed; all changes rolled back", 500)

    return success_response({
        "device_id": str(device.id),
        "received": len(records),
        "new": new_punches,
        "duplicates": duplicates,
        "failed": failed,
        "server_time": datetime.now(timezone.utc).isoformat(),
    })


@biometric_bp.route("/heartbeat", methods=["POST"])
def heartbeat():
    """Device keep-alive. Updates last_seen_at (drives online/offline status).
    Optional body: {"uptime_seconds": 123, "firmware": "..."}. Auth: X-Device-Key."""
    device, err = _device_from_key()
    if err:
        return err
    _touch_device(device)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error_response("Heartbeat failed", 500)
    return success_response({
        "device_id": str(device.id),
        "status": "ok",
        "server_time": datetime.now(timezone.utc).isoformat(),
    })
