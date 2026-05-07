"""
Plugin event system — lightweight pub/sub for inter-plugin communication.

Plugins declare events they emit/listen to in their YAML manifests.
This module provides the runtime dispatch.

IMPORTANT: Events only fire for schools that have the relevant plugin
installed and active. Use emit_for_school() for school-scoped events.
"""
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

_listeners: dict[str, list] = defaultdict(list)

# Map event prefixes to plugin slugs (e.g. "lms.*" → "lms")
_event_plugin_map: dict[str, str] = {}


def register_plugin_events(plugin_slug: str, event_prefixes: list[str]):
    """Register which plugin owns which event prefixes."""
    for prefix in event_prefixes:
        _event_plugin_map[prefix] = plugin_slug


def on(event_name: str):
    """Decorator: register a function as a listener for an event."""

    def decorator(f):
        _listeners[event_name].append(f)
        logger.debug("Registered listener for '%s': %s", event_name, f.__name__)
        return f

    return decorator


def _school_has_plugin(school_id: str, plugin_slug: str) -> bool:
    """Check if a school has a specific plugin installed and active."""
    try:
        from app.models.plugin import SchoolPlugin
        from extensions import db

        record = SchoolPlugin.query.filter_by(
            school_id=school_id,
            plugin_slug=plugin_slug,
            active=True,
        ).first()
        return record is not None
    except Exception:
        logger.exception("Failed to check plugin status for school %s", school_id)
        return False


def _get_required_plugin(event_name: str) -> str | None:
    """Resolve the plugin slug required for an event based on its prefix."""
    # Direct match first
    if event_name in _event_plugin_map:
        return _event_plugin_map[event_name]
    # Prefix match: "lms.class_started" → check "lms"
    prefix = event_name.split(".")[0] if "." in event_name else None
    if prefix and prefix in _event_plugin_map:
        return _event_plugin_map[prefix]
    return None


def emit(event_name: str, **kwargs):
    """Emit an event, calling all registered listeners synchronously."""
    listeners = _listeners.get(event_name, [])
    for listener in listeners:
        try:
            listener(**kwargs)
        except Exception:
            logger.exception(
                "Error in event listener %s for '%s'",
                listener.__name__,
                event_name,
            )


def emit_for_school(event_name: str, school_id: str, **kwargs):
    """Emit an event scoped to a school — only fires if the school has
    the relevant plugin installed and active.

    This is the preferred method for all plugin-dependent notifications,
    background task triggers, and inter-plugin communication.
    """
    required_plugin = _get_required_plugin(event_name)
    if required_plugin and not _school_has_plugin(school_id, required_plugin):
        logger.debug(
            "Skipping event '%s' for school %s — plugin '%s' not active",
            event_name,
            school_id,
            required_plugin,
        )
        return

    kwargs["school_id"] = school_id
    emit(event_name, **kwargs)


def emit_async(event_name: str, **kwargs):
    """Emit an event via Celery task for async processing."""
    from app.tasks import process_plugin_event

    process_plugin_event.delay(event_name, kwargs)


def emit_async_for_school(event_name: str, school_id: str, **kwargs):
    """Async version of emit_for_school — checks plugin status in worker."""
    from app.tasks import process_plugin_event_for_school

    process_plugin_event_for_school.delay(event_name, school_id, kwargs)


def get_listeners(event_name: str) -> list:
    """Return registered listeners for an event."""
    return _listeners.get(event_name, [])


def clear():
    """Clear all listeners (for testing)."""
    _listeners.clear()
    _event_plugin_map.clear()
