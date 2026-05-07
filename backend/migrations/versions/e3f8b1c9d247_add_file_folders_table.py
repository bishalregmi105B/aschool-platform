"""add file_folders table and folder_id to managed_files

Revision ID: e3f8b1c9d247
Revises: 4a2c369d23ed
Create Date: 2026-04-24 10:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e3f8b1c9d247'
down_revision: Union[str, None] = '4a2c369d23ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create file_folders table
    op.create_table(
        'file_folders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['file_folders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_file_folders_school_id', 'file_folders', ['school_id'])
    op.create_index('ix_file_folders_is_deleted', 'file_folders', ['is_deleted'])

    # Add folder_id column to managed_files
    op.add_column(
        'managed_files',
        sa.Column('folder_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_managed_files_folder_id',
        'managed_files', 'file_folders',
        ['folder_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_managed_files_folder_id', 'managed_files', ['folder_id'])


def downgrade() -> None:
    op.drop_index('ix_managed_files_folder_id', table_name='managed_files')
    op.drop_constraint('fk_managed_files_folder_id', 'managed_files', type_='foreignkey')
    op.drop_column('managed_files', 'folder_id')
    op.drop_index('ix_file_folders_is_deleted', table_name='file_folders')
    op.drop_index('ix_file_folders_school_id', table_name='file_folders')
    op.drop_table('file_folders')
