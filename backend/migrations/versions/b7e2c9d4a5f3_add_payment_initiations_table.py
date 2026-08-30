"""add payment_initiations table (audit E60)

Hosted-checkout initiations were never persisted server-side: eSewa/Khalti/
FonePay redirect payloads carried only the fee-collection id (or, for FonePay,
nothing usable at all), so callbacks had no anchor to compare the returned
amount against and FonePay callbacks could not resolve the collection. This
migration adds one row per checkout attempt, written BEFORE the redirect.

Revision ID: b7e2c9d4a5f3
Revises: d4e5f6a7b8c9
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b7e2c9d4a5f3"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "payment_initiations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("collection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gateway", sa.String(length=20), nullable=False),
        sa.Column("gateway_ref", sa.String(length=200), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("initiated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["collection_id"], ["fee_collections.id"]),
        sa.ForeignKeyConstraint(["initiated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_payment_initiations_school_id",
        "payment_initiations", ["school_id"],
    )
    op.create_index(
        "ix_payment_initiations_collection_id",
        "payment_initiations", ["collection_id"],
    )
    op.create_index(
        "ix_payment_initiations_gateway_ref",
        "payment_initiations", ["gateway_ref"],
    )


def downgrade():
    op.drop_index("ix_payment_initiations_gateway_ref", table_name="payment_initiations")
    op.drop_index("ix_payment_initiations_collection_id", table_name="payment_initiations")
    op.drop_index("ix_payment_initiations_school_id", table_name="payment_initiations")
    op.drop_table("payment_initiations")
