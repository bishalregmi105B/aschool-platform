"""Disaster Management — WP-style plugin lifecycle hooks.

activate(db)   : creates the plugin-owned tables (checkfirst — idempotent).
                 Evacuation plans and emergency alerts belong to the base
                 `emergency` plugin; only the drill tables are module-owned.
deactivate(db) : no-op — WP deactivation is deliberately light; drills and
                 participation stay intact for re-activation.
uninstall(db)  : removes ONLY module-owned config rows. Drills/participation
                 are data and are kept (WordPress keeps data on uninstall
                 too); the plugin owns no separate config rows, so this is a
                 documented no-op.
"""

import logging

logger = logging.getLogger(__name__)


def _owned_models():
    from app.models.disaster_management import DisasterDrill, DrillParticipation

    return [DisasterDrill, DrillParticipation]


def activate(db) -> None:
    """Create the disaster-drill tables if they do not exist (checkfirst)."""
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)
    logger.info(
        "disaster_management activate: ensured tables %s",
        [m.__tablename__ for m in _owned_models()],
    )


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """No module-owned config rows — drill tables are data (kept)."""
    return None
