"""W-04: contact_messages — public contact form inbox

Revision ID: f9b4e1c6d2a8
Revises: e5b2d8f4a7c1
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f9b4e1c6d2a8"
down_revision = "e5b2d8f4a7c1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "contact_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("subject", sa.String(length=300), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source_page", sa.String(length=300), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=True),
        sa.Column("read_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f("fk_contact_messages_school_id_schools")),
        sa.ForeignKeyConstraint(["read_by_id"], ["users.id"], name=op.f("fk_contact_messages_read_by_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contact_messages")),
    )
    op.create_index(op.f("ix_contact_messages_school_id"), "contact_messages", ["school_id"])
    op.create_index("ix_contact_messages_is_read", "contact_messages", ["is_read"])


def downgrade():
    op.drop_index("ix_contact_messages_is_read", table_name="contact_messages")
    op.drop_index(op.f("ix_contact_messages_school_id"), table_name="contact_messages")
    op.drop_table("contact_messages")
