"""merge multi_branch + biometric heads

Revision ID: e7a1c4f8b2d6
Revises: b5e8f2a9c4d1, b10c5d9e2f3a
Create Date: 2026-08-28 07:45:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7a1c4f8b2d6"
down_revision: Union[str, None] = ("b5e8f2a9c4d1", "b10c5d9e2f3a")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
