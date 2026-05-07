"""add ai token tables and designer documents

Revision ID: b7e2a1f3c849
Revises: e3f8b1c9d247
Create Date: 2026-04-24 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b7e2a1f3c849'
down_revision = 'e3f8b1c9d247'
branch_labels = None
depends_on = None


def upgrade():
    # ── ai_school_quotas ─────────────────────────────────────────────────────
    op.create_table(
        'ai_school_quotas',
        sa.Column('id',            postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('school_id',     postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('monthly_limit', sa.Integer, nullable=False, server_default='100000'),
        sa.Column('daily_limit',   sa.Integer, nullable=False, server_default='10000'),
        sa.Column('alert_at',      sa.Integer, nullable=False, server_default='80'),
        sa.Column('is_active',     sa.Boolean, nullable=False, server_default='true'),
        sa.Column('plan_type',     sa.String(50), server_default='standard'),
        sa.Column('created_at',    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('is_deleted',    sa.Boolean, server_default='false', nullable=False),
        sa.UniqueConstraint('school_id', name='uq_ai_school_quotas_school_id'),
    )
    op.create_index('idx_ai_school_quotas_school', 'ai_school_quotas', ['school_id'])

    # ── ai_usage_logs ────────────────────────────────────────────────────────
    op.create_table(
        'ai_usage_logs',
        sa.Column('id',                postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('school_id',         postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('schools.id'), nullable=False),
        sa.Column('user_id',           postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('feature',           sa.String(100), nullable=False),
        sa.Column('model',             sa.String(100), nullable=False, server_default='unknown'),
        sa.Column('provider',          sa.String(50),  nullable=False, server_default='anthropic'),
        sa.Column('prompt_tokens',     sa.Integer, nullable=False, server_default='0'),
        sa.Column('completion_tokens', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_tokens',      sa.Integer, nullable=False, server_default='0'),
        sa.Column('latency_ms',        sa.Integer, server_default='0'),
        sa.Column('status',            sa.String(20), nullable=False, server_default='success'),
        sa.Column('error_message',     sa.Text),
        sa.Column('metadata',          postgresql.JSONB),
        sa.Column('created_at',        sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',        sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('is_deleted',        sa.Boolean, server_default='false', nullable=False),
    )
    op.create_index('idx_ai_usage_school_date', 'ai_usage_logs',
                    ['school_id', sa.text('created_at DESC')])
    op.create_index('idx_ai_usage_feature',     'ai_usage_logs', ['feature'])
    op.create_index('idx_ai_usage_user',        'ai_usage_logs', ['user_id'])

    # ── designer_documents ───────────────────────────────────────────────────
    op.create_table(
        'designer_documents',
        sa.Column('id',            postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('school_id',     postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name',          sa.String(300), nullable=False),
        sa.Column('template_type', sa.String(100), server_default='custom'),
        sa.Column('canvas_state',  postgresql.JSONB),
        sa.Column('thumbnail_url', sa.Text, server_default=''),
        sa.Column('created_at',    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('is_deleted',    sa.Boolean, server_default='false', nullable=False),
    )
    op.create_index('idx_designer_docs_school', 'designer_documents',
                    ['school_id', sa.text('updated_at DESC')])


def downgrade():
    op.drop_table('designer_documents')
    op.drop_table('ai_usage_logs')
    op.drop_table('ai_school_quotas')
