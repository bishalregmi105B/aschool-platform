"""D-07 follow-up: audit_logs.school_id becomes nullable

Platform-level (superadmin) actions on audited tables have no school; the
audit trail must still record them. The listener falls back to the actor's
own school; when neither exists (superadmin), school_id stays NULL.

Revision ID: d8a1f4c7b2e9
Revises: c9f2a5d8e4b7
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "d8a1f4c7b2e9"
down_revision = "c9f2a5d8e4b7"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("audit_logs", "school_id", nullable=True)


def downgrade():
    # Backfill NULLs into a sentinel school is impossible generically —
    # delete orphan platform rows on downgrade to restore NOT NULL safely.
    op.execute("DELETE FROM audit_logs WHERE school_id IS NULL")
    op.alter_column("audit_logs", "school_id", nullable=False)
