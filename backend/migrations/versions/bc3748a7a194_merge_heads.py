"""merge_heads

Revision ID: bc3748a7a194
Revises: d2e3f4a5b6c7, e4f5a6b7c8d9
Create Date: 2026-08-16 12:20:30.585343
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc3748a7a194'
down_revision: Union[str, None] = ('d2e3f4a5b6c7', 'e4f5a6b7c8d9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
