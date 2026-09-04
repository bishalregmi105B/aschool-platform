"""W-04: school profile fields (about_us/vision/mission/principal_*)

Revision ID: a7c3e9b1d5f4
Revises: f9b4e1c6d2a8
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c3e9b1d5f4"
down_revision = "f9b4e1c6d2a8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("schools", sa.Column("about_us", sa.Text(), nullable=True))
    op.add_column("schools", sa.Column("vision", sa.Text(), nullable=True))
    op.add_column("schools", sa.Column("mission", sa.Text(), nullable=True))
    op.add_column("schools", sa.Column("principal_name", sa.String(length=300), nullable=True))
    op.add_column("schools", sa.Column("principal_message", sa.Text(), nullable=True))
    op.add_column("schools", sa.Column("principal_photo", sa.Text(), nullable=True))
    op.add_column("schools", sa.Column("principal_designation", sa.String(length=200), nullable=True))


def downgrade():
    for col in ("principal_designation", "principal_photo", "principal_message",
                "principal_name", "mission", "vision", "about_us"):
        op.drop_column("schools", col)
