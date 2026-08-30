"""social hub moderation + real group membership (audit slice-4)

E194: hub_posts gains moderation state (is_hidden / hidden_by_id) so
moderation endpoints can flip post state instead of only hard-deleting.
E195: hub_posts gains group_id and a hub_group_members table exists so
group membership is real: non-members cannot post to a group, and group
posts are only visible to members.

Revision ID: e5b7c1d9a3f8
Revises: c2d7e9a1b4f6
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e5b7c1d9a3f8"
down_revision = "c2d7e9a1b4f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hub_posts",
        sa.Column("is_hidden", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
    )
    op.add_column(
        "hub_posts",
        sa.Column("hidden_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "hub_posts",
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_hub_posts_is_hidden", "hub_posts", ["is_hidden"])
    op.create_index("ix_hub_posts_group_id", "hub_posts", ["group_id"])
    op.create_foreign_key(
        "fk_hub_posts_hidden_by", "hub_posts", "users",
        ["hidden_by_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_hub_posts_group", "hub_posts", "hub_groups",
        ["group_id"], ["id"],
    )

    op.create_table(
        "hub_group_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_in_group", sa.String(length=20), nullable=False,
                  server_default="member"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["hub_groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "user_id",
                            name="uq_hub_group_member"),
    )
    op.create_index("ix_hub_group_members_school_id", "hub_group_members",
                    ["school_id"])
    op.create_index("ix_hub_group_members_group_id", "hub_group_members",
                    ["group_id"])
    op.create_index("ix_hub_group_members_user_id", "hub_group_members",
                    ["user_id"])


def downgrade():
    op.drop_index("ix_hub_group_members_user_id", table_name="hub_group_members")
    op.drop_index("ix_hub_group_members_group_id", table_name="hub_group_members")
    op.drop_index("ix_hub_group_members_school_id", table_name="hub_group_members")
    op.drop_table("hub_group_members")
    op.drop_constraint("fk_hub_posts_group", "hub_posts", type_="foreignkey")
    op.drop_constraint("fk_hub_posts_hidden_by", "hub_posts", type_="foreignkey")
    op.drop_index("ix_hub_posts_group_id", table_name="hub_posts")
    op.drop_index("ix_hub_posts_is_hidden", table_name="hub_posts")
    op.drop_column("hub_posts", "group_id")
    op.drop_column("hub_posts", "hidden_by_id")
    op.drop_column("hub_posts", "is_hidden")
