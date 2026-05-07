"""add chat and school sliders

Revision ID: c0a1b2c3d4e5
Revises: b9d2e7f4c120
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c0a1b2c3d4e5"
down_revision: Union[str, None] = "b9d2e7f4c120"
branch_labels = None
depends_on = None


def _school_columns():
    return [
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "school_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("schools.id"),
            nullable=False,
        ),
    ]


def upgrade():
    op.add_column("fee_receipts", sa.Column("amount", sa.Numeric(10, 2), server_default="0", nullable=True))
    op.add_column("fee_receipts", sa.Column("payment_method", sa.String(length=50), nullable=True))
    op.add_column("fee_receipts", sa.Column("transaction_id", sa.String(length=200), nullable=True))

    op.create_table(
        "chat_threads",
        *_school_columns(),
        sa.Column("participant_a_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_b_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_message", sa.Text(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["participant_a_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["participant_b_id"], ["users.id"]),
        sa.UniqueConstraint(
            "school_id",
            "participant_a_id",
            "participant_b_id",
            name="uq_chat_thread_school_participants",
        ),
    )
    op.create_index(op.f("ix_chat_threads_school_id"), "chat_threads", ["school_id"], unique=False)

    op.create_table(
        "chat_messages",
        *_school_columns(),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receiver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("file_url", sa.Text(), nullable=True),
        sa.Column("file_type", sa.String(length=40), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"]),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"]),
    )
    op.create_index(op.f("ix_chat_messages_school_id"), "chat_messages", ["school_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_thread_id"), "chat_messages", ["thread_id"], unique=False)

    op.create_table(
        "school_sliders",
        *_school_columns(),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("link_url", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.Column("starts_at", sa.DateTime(), nullable=True),
        sa.Column("ends_at", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_school_sliders_school_id"), "school_sliders", ["school_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_school_sliders_school_id"), table_name="school_sliders")
    op.drop_table("school_sliders")

    op.drop_index(op.f("ix_chat_messages_thread_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_school_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_chat_threads_school_id"), table_name="chat_threads")
    op.drop_table("chat_threads")

    op.drop_column("fee_receipts", "transaction_id")
    op.drop_column("fee_receipts", "payment_method")
    op.drop_column("fee_receipts", "amount")
