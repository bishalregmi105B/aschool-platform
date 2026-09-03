"""A-01 cost columns on ai_usage_logs + provider price sheet seeding

Revision ID: f2a6b9c3d7e1
Revises: e1c4f7a9b2d6
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f2a6b9c3d7e1"
down_revision = "e1c4f7a9b2d6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ai_usage_logs", sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True))
    op.add_column("ai_usage_logs", sa.Column("cost_npr", sa.Numeric(12, 4), nullable=True))


def downgrade():
    op.drop_column("ai_usage_logs", "cost_npr")
    op.drop_column("ai_usage_logs", "cost_usd")
