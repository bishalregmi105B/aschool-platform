"""Platform meta endpoints — authoritative server time for all clients.

M-01: the dashboard header previously used the *browser* clock, which lies on
misconfigured lab machines. Every client (web header, Flutter apps, form
pickers) should display the server clock; pickers also use it as "today" so
backdated entries can't silently pass validation on a wrong local date.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from flask import Blueprint

from app.utils.response import success_response

meta_bp = Blueprint("meta", __name__, url_prefix="/meta")

# Nepal doesn't observe DST; one fixed offset is exact (+05:45). ZoneInfo is
# used only for tz-aware display; the fixed offset keeps epoch math simple.
NEPAL_TZ = timezone(timedelta(hours=5, minutes=45))
NEPAL_ZONE_NAME = "Asia/Kathmandu"


@meta_bp.route("/time", methods=["GET"])
def server_time():
    """Server wall-clock time (no auth — the header needs it pre-login too)."""
    now = datetime.now(NEPAL_TZ)
    try:
        tz_name = ZoneInfo(NEPAL_ZONE_NAME).key
    except Exception:
        tz_name = NEPAL_ZONE_NAME
    return success_response(
        {
            "iso": now.isoformat(),
            "epoch_ms": int(now.timestamp() * 1000),
            "timezone": tz_name,
            "utc_offset_seconds": 20700,  # +05:45
            "date_ad": now.strftime("%Y-%m-%d"),
            "time_hhmm": now.strftime("%H:%M"),
        }
    )
