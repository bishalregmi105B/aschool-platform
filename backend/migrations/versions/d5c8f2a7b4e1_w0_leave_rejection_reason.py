"""W0: leave_requests.rejection_reason — persist the reject decision note

Rejecting a leave request previously dropped the reviewer's note on the
floor (api/v1/attendance.py reject handler). This adds the column the
handler now writes, and nothing else.

Revision ID: d5c8f2a7b4e1
Revises: b2e7c4a9f1d3
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "d5c8f2a7b4e1"
down_revision = "b2e7c4a9f1d3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("leave_requests", sa.Column("rejection_reason", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("leave_requests", "rejection_reason")
