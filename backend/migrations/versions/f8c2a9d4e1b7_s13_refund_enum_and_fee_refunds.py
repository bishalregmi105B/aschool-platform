"""S-13 payment correctness: 'refunded' enum value + fee_refunds ledger table

The refund endpoint set payment_status='refunded', which was not in the
payment_status enum — the commit raised DataError after the gateway had
already moved money. Also adds fee_refunds so refunds are ledger rows, not
a note substring.

Revision ID: f8c2a9d4e1b7
Revises: f3a8c2e6d9b4
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f8c2a9d4e1b7"
down_revision = "f3a8c2e6d9b4"
branch_labels = None
depends_on = None


def upgrade():
    # ENUM ALTER TYPE cannot run inside a transactional block with other DDL
    # on older PG; commit the migration transaction first.
    op.execute("COMMIT")
    op.execute(
        "ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded'"
    )
    op.execute("BEGIN")

    # Guarded enum create: DROP TABLE does not drop types, so a plain create
    # fails on re-upgrade after downgrade.
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE refund_status AS ENUM ('initiated', 'completed', 'failed'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )

    op.create_table(
        "fee_refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("collection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("gateway", sa.String(length=50), nullable=True),
        sa.Column("gateway_ref", sa.String(length=200), nullable=True),
        sa.Column("approved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        # The enum type is created explicitly below (guarded) — a bare
        # sa.Enum inside create_table would fail on re-upgrade after a
        # downgrade, because DROP TABLE does not drop enum types.
        sa.Column(
            "status",
            postgresql.ENUM(
                "initiated", "completed", "failed",
                name="refund_status", create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f("fk_fee_refunds_school_id_schools")),
        sa.ForeignKeyConstraint(["collection_id"], ["fee_collections.id"], name=op.f("fk_fee_refunds_collection_id_fee_collections")),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_fee_refunds_student_id_students")),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], name=op.f("fk_fee_refunds_approved_by_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fee_refunds")),
    )
    op.create_index(op.f("ix_fee_refunds_school_id"), "fee_refunds", ["school_id"])
    op.create_index(op.f("ix_fee_refunds_collection_id"), "fee_refunds", ["collection_id"])

    # Replay guard for signature-verified provider webhooks (S-13c).
    op.create_table(
        "processed_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("event_id", sa.String(length=200), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f("fk_processed_webhook_events_school_id_schools")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_processed_webhook_events")),
        sa.UniqueConstraint("provider", "event_id", name="uq_processed_webhook_provider_event"),
    )


def downgrade():
    op.drop_table("processed_webhook_events")
    op.drop_index(op.f("ix_fee_refunds_collection_id"), table_name="fee_refunds")
    op.drop_index(op.f("ix_fee_refunds_school_id"), table_name="fee_refunds")
    op.drop_table("fee_refunds")
    # Postgres cannot remove enum values; 'refunded' is left in place on
    # downgrade (harmless, unused by the reverted code).
