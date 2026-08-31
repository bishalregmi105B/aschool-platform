"""AI Adaptive Learning — WP-style plugin lifecycle hooks.

activate(db)   : creates the plugin-owned tables (checkfirst — idempotent).
deactivate(db) : no-op — WP deactivation is deliberately light; learning
                 paths and mastery records stay intact for re-activation.
uninstall(db)  : removes ONLY module-owned config rows. Learning paths and
                 mastery records are data and are kept (WordPress keeps data
                 on uninstall too); the plugin owns no separate config rows,
                 so this is a documented no-op.
"""

import logging

logger = logging.getLogger(__name__)


def _owned_models():
    from app.models.adaptive_learning import LearningPath, MasteryRecord

    return [LearningPath, MasteryRecord]


def activate(db) -> None:
    """Create the adaptive-learning tables if they do not exist (checkfirst)."""
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)
    logger.info(
        "ai_adaptive_learning activate: ensured tables %s",
        [m.__tablename__ for m in _owned_models()],
    )


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """No module-owned config rows — path/mastery tables are data (kept)."""
    return None
