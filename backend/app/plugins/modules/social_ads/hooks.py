"""Social Ad Boosting — WP-style plugin lifecycle hooks.

activate(db)   : creates the plugin-owned table (checkfirst — idempotent).
                 Only AdCampaign belongs to this module; the other tables in
                 app.models.social belong to the social_hub plugin.
deactivate(db) : no-op — WP deactivation is deliberately light; campaigns
                 stay intact for re-activation.
uninstall(db)  : removes ONLY module-owned config rows. Ad campaigns are
                 data and are kept (WordPress keeps data on uninstall too);
                 the plugin owns no separate config rows, so this is a
                 documented no-op.
"""

import logging

logger = logging.getLogger(__name__)


def _owned_models():
    from app.models.social import AdCampaign

    return [AdCampaign]


def activate(db) -> None:
    """Create the ad-campaign table if it does not exist (checkfirst)."""
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)
    logger.info(
        "social_ads activate: ensured tables %s",
        [m.__tablename__ for m in _owned_models()],
    )


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """No module-owned config rows — campaign table is data (kept)."""
    return None
