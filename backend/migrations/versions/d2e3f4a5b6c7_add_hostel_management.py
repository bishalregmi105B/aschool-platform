"""add hostel management tables

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-25 11:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Hostels table
    op.create_table(
        "hostels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.String(20), nullable=False, server_default="boys"),
        sa.Column("warden_name", sa.String(200)),
        sa.Column("warden_phone", sa.String(20)),
        sa.Column("total_capacity", sa.Integer, server_default="0"),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_deleted", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hostels_school_id", "hostels", ["school_id"])

    # Hostel rooms table
    op.create_table(
        "hostel_rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hostel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hostels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("room_number", sa.String(50), nullable=False),
        sa.Column("floor", sa.String(20)),
        sa.Column("capacity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("room_type", sa.String(50), server_default="standard"),
        sa.Column("monthly_fee", sa.Numeric(10, 2), server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_deleted", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hostel_rooms_school_id", "hostel_rooms", ["school_id"])
    op.create_index("ix_hostel_rooms_hostel_id", "hostel_rooms", ["hostel_id"])

    # Hostel allocations table
    op.create_table(
        "hostel_allocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hostel_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("check_in_date", sa.Date, nullable=False),
        sa.Column("check_out_date", sa.Date),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hostel_allocations_school_id", "hostel_allocations", ["school_id"])
    op.create_index("ix_hostel_allocations_room_id", "hostel_allocations", ["room_id"])
    op.create_index("ix_hostel_allocations_student_id", "hostel_allocations", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_hostel_allocations_student_id", table_name="hostel_allocations")
    op.drop_index("ix_hostel_allocations_room_id", table_name="hostel_allocations")
    op.drop_index("ix_hostel_allocations_school_id", table_name="hostel_allocations")
    op.drop_table("hostel_allocations")
    op.drop_index("ix_hostel_rooms_hostel_id", table_name="hostel_rooms")
    op.drop_index("ix_hostel_rooms_school_id", table_name="hostel_rooms")
    op.drop_table("hostel_rooms")
    op.drop_index("ix_hostels_school_id", table_name="hostels")
    op.drop_table("hostels")
