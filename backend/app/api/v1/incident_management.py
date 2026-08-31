"""Re-export shim — the blueprint moved into the plugin module (WP-style)."""
from app.plugins.modules.incident_management.routes import incident_management_bp  # noqa: F401
