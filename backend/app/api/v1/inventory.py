"""Re-export shim — the blueprint lives in the app folder (apps architecture)."""
from app.apps.modules.inventory.routes import inventory_bp  # noqa: F401
