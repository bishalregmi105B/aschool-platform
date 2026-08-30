"""add disaster_drills + drill_participations tables (disaster_management E40)

The disaster_management plugin (premium, NPR 999) sold drills/seismic/
overview pages whose only backend was the emergency tier (alerts/plans/
headcounts). Drill scheduling and per-class drill participation had no
storage anywhere — this adds the two SchoolModel tables the
disaster_management blueprint reads/writes.

Revision ID: c3d4e5f6a7b8
Revises: f6a9c2e4b7d1
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "f6a9c2e4b7d1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "disaster_drills",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("drill_type", sa.String(length=50), server_default="general"),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False,
                  server_default="scheduled"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("conducted_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("conducted_by_name", sa.String(length=200), nullable=True),
        # BaseModel columns
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_disaster_drills_school_id"
        ),
        sa.ForeignKeyConstraint(
            ["conducted_by_id"], ["users.id"], name="fk_disaster_drills_conducted_by"
        ),
    )
    op.create_index(
        "ix_disaster_drills_school_id", "disaster_drills", ["school_id"]
    )
    op.create_index(
        "ix_disaster_drills_scheduled_at", "disaster_drills", ["scheduled_at"]
    )

    op.create_table(
        "drill_participations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("drill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("total_expected", sa.Integer(), nullable=True),
        sa.Column("total_present", sa.Integer(), nullable=True),
        sa.Column("missing_student_ids",
                  postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=True),
        # BaseModel columns
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["school_id"], ["schools.id"], name="fk_drill_participations_school_id"
        ),
        sa.ForeignKeyConstraint(
            ["drill_id"], ["disaster_drills.id"], name="fk_drill_participations_drill"
        ),
        sa.ForeignKeyConstraint(
            ["class_id"], ["classes.id"], name="fk_drill_participations_class"
        ),
        sa.ForeignKeyConstraint(
            ["section_id"], ["sections.id"], name="fk_drill_participations_section"
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by_id"], ["users.id"], name="fk_drill_participations_recorded_by"
        ),
    )
    op.create_index(
        "ix_drill_participations_school_id", "drill_participations", ["school_id"]
    )
    op.create_index(
        "ix_drill_participations_drill_id", "drill_participations", ["drill_id"]
    )


def downgrade():
    op.drop_index("ix_drill_participations_drill_id", table_name="drill_participations")
    op.drop_index("ix_drill_participations_school_id", table_name="drill_participations")
    op.drop_table("drill_participations")
    op.drop_index("ix_disaster_drills_scheduled_at", table_name="disaster_drills")
    op.drop_index("ix_disaster_drills_school_id", table_name="disaster_drills")
    op.drop_table("disaster_drills")
