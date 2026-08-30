"""add fee_types table (schema drift — model had no migration)

The FeeType model (app/models/fee.py) was added without a matching Alembic
migration, so every environment provisioned only via `flask db upgrade` was
missing the `fee_types` table: GET /fees/types silently fell back to the
DEFAULT_FEE_TYPES list while POST/PUT/DELETE /fees/types raised
UndefinedTable and returned 500 — the Fee Types page on the web dashboard
could not create anything.

Revision ID: d5a9e7c1b3f2
Revises: c9d2e4f6a8b1
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d5a9e7c1b3f2"
down_revision = "c9d2e4f6a8b1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "fee_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=True),
        # BaseModel columns (SchoolModel inherits BaseModel; no deleted_at)
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_fee_types_school_id"
        ),
    )
    op.create_index("ix_fee_types_school_id", "fee_types", ["school_id"])


def downgrade():
    op.drop_index("ix_fee_types_school_id", table_name="fee_types")
    op.drop_table("fee_types")
