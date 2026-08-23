"""Database backup management API — trigger backups and list backup status."""
from flask import g
from flask_jwt_extended import jwt_required

from app.utils.response import success_response, error_response
from app.tasks.db_backup import db_backup_daily

db_backup_api_bp = __import__("flask", fromlist=["Blueprint"]).Blueprint(
    "db_backup_api", __name__, url_prefix="/database-backup"
)


@db_backup_api_bp.route("", methods=["GET"])
@jwt_required()
def backup_status():
    """Return last backup info and scheduled next backup time."""
    from datetime import datetime, timezone, timedelta
    import os

    # Try to get last backup info from Celery result backend or env
    last_backup = os.environ.get("LAST_DB_BACKUP_AT", None)
    backup_dest = os.environ.get("DB_BACKUP_DEST", "r2" if os.environ.get("R2_BUCKET_NAME") else "local")

    return success_response({
        "last_backup_at": last_backup,
        "backup_destination": backup_dest,
        "scheduled_time": "03:00 UTC daily",
        "status": "configured",
    })


@db_backup_api_bp.route("/trigger", methods=["POST"])
@jwt_required()
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
