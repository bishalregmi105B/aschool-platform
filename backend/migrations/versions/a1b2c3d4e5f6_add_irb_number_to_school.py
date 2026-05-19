"""add irb_number to school

Revision ID: a1b2c3d4e5f6
Revises: f2d4c7a9b001
Create Date: 2026-05-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f2d4c7a9b001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schools', sa.Column('irb_number', sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column('schools', 'irb_number')
