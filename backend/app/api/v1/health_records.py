"""Re-export shim — the blueprint lives in the app folder (apps architecture)."""
from app.apps.modules.health_records.routes import health_records_bp  # noqa: F401
