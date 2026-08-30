"""add school chain tables (multi_branch plugin)

Revision ID: b5e8f2a9c4d1
Revises: 27312847ace7
Create Date: 2026-08-28 07:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b5e8f2a9c4d1"
down_revision: Union[str, None] = "27312847ace7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "school_chains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        # school_id == the chain owner (parent organisation school)
        sa.Column("school_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_school_chains_school_id", "school_chains", ["school_id"])
    # One live chain per parent school (soft-deleted rows excluded)
    op.create_index(
        "uq_school_chains_owner", "school_chains", ["school_id"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "school_chain_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        # school_id == the branch school itself
        sa.Column("school_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chain_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("school_chains.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(50), nullable=True),
        sa.Column("principal_name", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("added_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_school_chain_members_school_id", "school_chain_members", ["school_id"])
    op.create_index("ix_school_chain_members_chain_id", "school_chain_members", ["chain_id"])
    # A school can be a branch of at most one live chain
    op.create_index(
        "uq_school_chain_member_school", "school_chain_members", ["school_id"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )
    # Branch code unique within a chain
    op.create_index(
        "uq_school_chain_member_code", "school_chain_members", ["chain_id", "code"], unique=True,
        postgresql_where=sa.text("is_deleted = false AND code IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_school_chain_member_code", table_name="school_chain_members")
    op.drop_index("uq_school_chain_member_school", table_name="school_chain_members")
    op.drop_index("ix_school_chain_members_chain_id", table_name="school_chain_members")
    op.drop_index("ix_school_chain_members_school_id", table_name="school_chain_members")
    op.drop_table("school_chain_members")
    op.drop_index("uq_school_chains_owner", table_name="school_chains")
    op.drop_index("ix_school_chains_school_id", table_name="school_chains")
    op.drop_table("school_chains")
