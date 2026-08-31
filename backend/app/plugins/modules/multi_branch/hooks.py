"""Multi-Branch Chain — WP-style plugin lifecycle hooks.

activate(db)   : creates the plugin-owned tables (checkfirst — idempotent).
deactivate(db) : no-op — WP deactivation is deliberately light; chains and
                 memberships stay intact for re-activation.
uninstall(db)  : removes ONLY module-owned config rows. Chains/branch links
                 are data and are kept (WordPress keeps data on uninstall
                 too); multi_branch owns no separate config rows, so this is
                 a documented no-op.
"""

import logging

logger = logging.getLogger(__name__)


def _owned_models():
    from app.models.school_chain import SchoolChain, SchoolChainMember

    return [SchoolChain, SchoolChainMember]


def activate(db) -> None:
    """Create the school-chain tables if they do not exist (checkfirst)."""
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)
    logger.info(
        "multi_branch activate: ensured tables %s",
        [m.__tablename__ for m in _owned_models()],
    )


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """No module-owned config rows — chain tables are data (kept)."""
    return None
