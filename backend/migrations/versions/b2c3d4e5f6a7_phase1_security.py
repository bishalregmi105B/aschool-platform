"""Phase 1 security: brute-force lockout, JWT revocation, EMIS student fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-18 12:00:00.000000

Changes:
- users: add failed_login_count, locked_until
- students: add caste, mother_tongue, disability_type, permanent_* and temporary_* address fields
- revoked_tokens: new table for JWT revocation blocklist
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # ── users: brute-force lockout ────────────────────────────────────────
    op.add_column('users', sa.Column('failed_login_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))

    # ── students: EMIS compliance fields ─────────────────────────────────
    op.add_column('students', sa.Column('caste', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('mother_tongue', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('disability_type', sa.String(length=50), nullable=True))
    op.add_column('students', sa.Column('permanent_province', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('permanent_district', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('permanent_municipality', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('permanent_ward', sa.String(length=10), nullable=True))
    op.add_column('students', sa.Column('temporary_province', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('temporary_district', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('temporary_municipality', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('temporary_ward', sa.String(length=10), nullable=True))

    # ── revoked_tokens: JWT blocklist table ───────────────────────────────
    op.create_table(
        'revoked_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('jti', sa.String(length=36), nullable=False),
        sa.Column('token_type', sa.String(length=10), nullable=False, server_default='access'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_revoked_tokens_jti', 'revoked_tokens', ['jti'], unique=True)
    op.create_index('ix_revoked_tokens_expires_at', 'revoked_tokens', ['expires_at'])


def downgrade():
    op.drop_index('ix_revoked_tokens_expires_at', table_name='revoked_tokens')
    op.drop_index('ix_revoked_tokens_jti', table_name='revoked_tokens')
    op.drop_table('revoked_tokens')

    op.drop_column('students', 'temporary_ward')
    op.drop_column('students', 'temporary_municipality')
    op.drop_column('students', 'temporary_district')
    op.drop_column('students', 'temporary_province')
    op.drop_column('students', 'permanent_ward')
    op.drop_column('students', 'permanent_municipality')
    op.drop_column('students', 'permanent_district')
    op.drop_column('students', 'permanent_province')
    op.drop_column('students', 'disability_type')
    op.drop_column('students', 'mother_tongue')
    op.drop_column('students', 'caste')

    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_count')
