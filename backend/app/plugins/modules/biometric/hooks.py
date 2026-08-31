"""Biometric Integration — WP-style plugin lifecycle hooks.

activate(db)   : creates the plugin-owned tables (checkfirst — idempotent,
                 safe on a DB where create_all already made them).
deactivate(db) : no-op — WP deactivation is deliberately light; device data
                 and history stay intact for re-activation.
uninstall(db)  : removes ONLY module-owned config rows. Punched attendance
                 and device records are data and are kept (WordPress keeps
                 data on uninstall too); biometric owns no separate config
                 rows, so this is a documented no-op.
"""

import logging

logger = logging.getLogger(__name__)


def _owned_models():
    from app.models.biometric import BiometricDevice, BiometricPunch, BiometricSyncLog

    return [BiometricDevice, BiometricPunch, BiometricSyncLog]


def activate(db) -> None:
    """Create the biometric tables if they do not exist (checkfirst)."""
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)
    logger.info("biometric activate: ensured tables %s", [m.__tablename__ for m in _owned_models()])


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """No module-owned config rows — device/punch/sync tables are data (kept)."""
    return None
