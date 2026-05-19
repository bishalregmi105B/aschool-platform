"""Add qr_pay to payment_method enum.

Revision ID: e4f5a6b7c8d9
Revises: d6d15267f9b8
Create Date: 2026-05-18 00:00:00.000000

PostgreSQL ENUM values can only be added in a non-transactional context.
We use op.execute with COMMIT trick inside connection.execute for ALTER TYPE.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e4f5a6b7c8d9"
down_revision = "d6d15267f9b8"
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PG.
    # Alembic wraps everything in a transaction by default; we need to
    # execute this statement outside the implicit transaction.
    connection = op.get_bind()
    # Check if the enum value already exists (idempotent)
    result = connection.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'qr_pay' "
            "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')"
        )
    ).fetchone()
    if not result:
        # Must run outside transaction
        connection.execute(sa.text("COMMIT"))
        connection.execute(
            sa.text("ALTER TYPE payment_method ADD VALUE 'qr_pay'")
        )
        connection.execute(sa.text("BEGIN"))


def downgrade():
    # PostgreSQL does not support removing enum values natively.
    # A full rebuild of the enum would be needed, which is destructive.
    # This migration is intentionally irreversible — qr_pay stays.
    pass
