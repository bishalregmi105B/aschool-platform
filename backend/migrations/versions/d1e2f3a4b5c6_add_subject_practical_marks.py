"""add subject practical marks

Revision ID: d1e2f3a4b5c6
Revises: c0a1b2c3d4e5
Create Date: 2026-05-07 00:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("subjects", sa.Column("practical_full_marks", sa.Integer(), nullable=True))
    op.add_column("subjects", sa.Column("practical_pass_marks", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("subjects", "practical_pass_marks")
    op.drop_column("subjects", "practical_full_marks")