"""Database backup management API — trigger backups and list backup status."""
from flask import g
from flask_jwt_extended import jwt_required

from app.utils.decorators import role_required

from app.utils.response import success_response, error_response
from app.tasks.db_backup import db_backup_daily

db_backup_api_bp = __import__("flask", fromlist=["Blueprint"]).Blueprint(
    "db_backup_api", __name__, url_prefix="/database-backup"
)


@db_backup_api_bp.route("", methods=["GET"])
@jwt_required()
def backup_status():
    """Return last backup info and scheduled next backup time (superadmin
    only — F5: platform ops data must not serve tenant tokens)."""
    from app.utils.decorators import superadmin_required as _sa
    from app.utils.response import error_response as _er
    from flask_jwt_extended import get_jwt as _gj
    if _gj().get("role") != "superadmin":
        return _er("Superadmin only", 403)
    """Return last backup info and scheduled next backup time."""
    from datetime import datetime, timezone, timedelta
    import os

    # P-02: honest state from the system_settings KV table (written by the
    # nightly task); fall back to the legacy env var, then None.
    last_backup = None
    try:
        from app.models.system import SystemSetting

        row = SystemSetting.query.filter_by(key="last_db_backup_at").first()
        if row and isinstance(row.value, dict):
            last_backup = row.value.get("at")
            size_mb = row.value.get("size_mb")
        else:
            size_mb = None
    except Exception:  # noqa: BLE001 — status endpoint must never 500
        size_mb = None
    last_backup = last_backup or os.environ.get("LAST_DB_BACKUP_AT")
    backup_dest = os.environ.get("DB_BACKUP_DEST", "r2" if os.environ.get("R2_BUCKET_NAME") else "local")

    return success_response({
        "last_backup_at": last_backup,
        "last_backup_size_mb": size_mb,
        "backup_destination": backup_dest,
        "scheduled_time": "03:00 UTC daily",
        "status": "configured",
    })


@db_backup_api_bp.route("/trigger", methods=["POST"])
@jwt_required()
@role_required("superadmin")
def trigger_backup():
    """Manually trigger a database backup (superadmin only)."""
    role = getattr(g, "current_user_role", None) or getattr(g, "role", None)
    if role not in ("superadmin", "school_admin"):
        return error_response("Insufficient permissions", 403)
    try:
        task = db_backup_daily.apply_async()
        return success_response({
            "message": "Backup task queued",
            "task_id": task.id,
        })
    except Exception as exc:
        return error_response(f"Failed to queue backup: {exc}", 500)
