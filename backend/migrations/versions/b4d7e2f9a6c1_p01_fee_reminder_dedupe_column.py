"""P-01(c): fee_collections.last_reminder_sent_at — reminder dedupe

Revision ID: b4d7e2f9a6c1
Revises: a9b3e7c1d5f8
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b4d7e2f9a6c1"
down_revision = "a9b3e7c1d5f8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "fee_collections",
        sa.Column("last_reminder_sent_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_column("fee_collections", "last_reminder_sent_at")
