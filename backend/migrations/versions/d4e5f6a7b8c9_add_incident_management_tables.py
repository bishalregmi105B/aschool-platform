"""add incident management extension tables + incidents workflow columns (E41)

The incident_management plugin (growth, NPR 399) is the management tier on
top of the base `incidents` reporting plugin. Assignment, escalation and the
workflow audit trail had no storage: this adds two SchoolModel tables and
workflow columns on the shared `incidents` table (assigned staff member,
latest escalation pointer, parent-notified / conference flags used by the
management-tier web pages).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    # ── workflow columns on the existing incidents table ────────────────────
    op.add_column(
        "incidents",
        sa.Column("assigned_to_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("escalated_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("escalated_to_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("parent_notified", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    op.add_column(
        "incidents",
        sa.Column("conference_scheduled", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    op.add_column(
        "incidents",
        sa.Column("conference_scheduled_at", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_incidents_assigned_to", "incidents", "users",
        ["assigned_to_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_incidents_escalated_to", "incidents", "users",
        ["escalated_to_id"], ["id"],
    )
    op.create_index(
        "ix_incidents_assigned_to_id", "incidents", ["assigned_to_id"]
    )

    # ── escalation rows ──────────────────────────────────────────────────────
    op.create_table(
        "incident_escalations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("escalated_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("escalated_to_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("escalated_to_role", sa.String(length=50), nullable=True),
        sa.Column("severity_before", sa.String(length=20), nullable=True),
        sa.Column("severity_after", sa.String(length=20), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("conference_scheduled", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("conference_scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("conference_notes", sa.Text(), nullable=True),
        # BaseModel columns
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_incident_escalations_school_id"
        ),
        sa.ForeignKeyConstraint(
            ["incident_id"], ["incidents.id"], name="fk_incident_escalations_incident"
        ),
        sa.ForeignKeyConstraint(
            ["escalated_by_id"], ["users.id"], name="fk_incident_escalations_by"
        ),
        sa.ForeignKeyConstraint(
            ["escalated_to_id"], ["users.id"], name="fk_incident_escalations_to"
        ),
    )
    op.create_index(
        "ix_incident_escalations_school_id", "incident_escalations", ["school_id"]
    )
    op.create_index(
        "ix_incident_escalations_incident_id", "incident_escalations", ["incident_id"]
    )

    # ── workflow audit trail ─────────────────────────────────────────────────
    op.create_table(
        "incident_workflow_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_value", sa.String(length=100), nullable=True),
        sa.Column("to_value", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # BaseModel columns
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_incident_workflow_events_school"
        ),
        sa.ForeignKeyConstraint(
            ["incident_id"], ["incidents.id"], name="fk_incident_workflow_events_incident"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name="fk_incident_workflow_events_actor"
        ),
    )
    op.create_index(
        "ix_incident_workflow_events_school_id", "incident_workflow_events",
        ["school_id"],
    )
    op.create_index(
        "ix_incident_workflow_events_incident_id", "incident_workflow_events",
        ["incident_id"],
    )


def downgrade():
    op.drop_index("ix_incident_workflow_events_incident_id", table_name="incident_workflow_events")
    op.drop_index("ix_incident_workflow_events_school_id", table_name="incident_workflow_events")
    op.drop_table("incident_workflow_events")
    op.drop_index("ix_incident_escalations_incident_id", table_name="incident_escalations")
    op.drop_index("ix_incident_escalations_school_id", table_name="incident_escalations")
    op.drop_table("incident_escalations")
    op.drop_index("ix_incidents_assigned_to_id", table_name="incidents")
    op.drop_constraint("fk_incidents_escalated_to", "incidents", type_="foreignkey")
    op.drop_constraint("fk_incidents_assigned_to", "incidents", type_="foreignkey")
    op.drop_column("incidents", "conference_scheduled_at")
    op.drop_column("incidents", "conference_scheduled")
    op.drop_column("incidents", "parent_notified")
    op.drop_column("incidents", "escalated_to_id")
    op.drop_column("incidents", "escalated_at")
    op.drop_column("incidents", "assigned_to_id")
