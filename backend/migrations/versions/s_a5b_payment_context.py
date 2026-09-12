"""S-A5b: PaymentInitiation.context — guest payment flows (A-22).

Revision ID: s_a5b_payment_context
Revises: s_a5_admission_funnel
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa


revision = "s_a5b_payment_context"
down_revision = "s_a5_admission_funnel"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "payment_initiations",
        sa.Column("context", sa.String(length=30), server_default="desk", nullable=True),
    )


def downgrade():
    op.drop_column("payment_initiations", "context")
