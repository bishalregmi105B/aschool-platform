"""White-Label Branding — WP-style plugin lifecycle hooks.

activate(db)     : no module-owned tables (branding lives on the shared
                   School model), so activation creates nothing.
deactivate(db)   : no-op — WP deactivation is deliberately light.
uninstall(db)    : removes ONLY the module-owned config rows (the
                   ``School.settings["white_label"]`` key). Branding/business
                   data on School columns is kept (WordPress keeps data on
                   uninstall too); the plugin simply falls back to defaults.
"""

import logging

logger = logging.getLogger(__name__)


def activate(db) -> None:
    """No plugin-owned tables to create (config rides on School.settings)."""
    return None


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """Drop the module-owned config key from every school's settings."""
    from app.models.school import School

    removed = 0
    for school in School.query.filter(School.settings.isnot(None)).all():
        settings = dict(school.settings or {})
        if "white_label" in settings:
            settings.pop("white_label", None)
            school.settings = settings
            removed += 1
    if removed:
        db.session.commit()
    logger.info("white_label uninstall: removed config key from %d schools", removed)
