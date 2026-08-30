"""add_tokens_invalid_before_to_user

Revision ID: 27312847ace7
Revises: bc3748a7a194
Create Date: 2026-08-27 00:37:18.004564
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27312847ace7'
down_revision: Union[str, None] = 'bc3748a7a194'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('tokens_invalid_before', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'tokens_invalid_before')
