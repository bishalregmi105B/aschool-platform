"""Re-export shim — the blueprint lives in the app folder (apps architecture)."""
from app.apps.modules.incidents.routes import incidents_bp  # noqa: F401
