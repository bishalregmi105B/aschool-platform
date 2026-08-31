"""Full Incident Management — WP-style plugin lifecycle hooks.

activate(db)   : creates the plugin-owned tables (checkfirst — idempotent).
                 The base Incident/WitnessStatement tables belong to the
                 `incidents` plugin; only escalation/workflow-event tables
                 are module-owned.
deactivate(db) : no-op — WP deactivation is deliberately light; escalations
                 and workflow events stay intact for re-activation.
uninstall(db)  : removes ONLY module-owned config rows. Escalations and
                 workflow events are data and are kept (WordPress keeps data
                 on uninstall too); the plugin owns no separate config rows,
                 so this is a documented no-op.
"""

import logging

logger = logging.getLogger(__name__)


def _owned_models():
    from app.models.incident_management import (
        IncidentEscalation,
        IncidentWorkflowEvent,
    )

    return [IncidentEscalation, IncidentWorkflowEvent]


def activate(db) -> None:
    """Create the escalation/workflow tables if they do not exist (checkfirst)."""
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)
    logger.info(
        "incident_management activate: ensured tables %s",
        [m.__tablename__ for m in _owned_models()],
    )


def deactivate(db) -> None:
    """WP-style deactivate: disable without touching data."""
    return None


def uninstall(db) -> None:
    """No module-owned config rows — escalation tables are data (kept)."""
    return None
