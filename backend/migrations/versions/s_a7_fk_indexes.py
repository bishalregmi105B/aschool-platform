"""hot FK indexes + book_transactions deprecation (deep-ux 6.5 / D-21)

Revision ID: s_a7_fk_indexes
Revises: s_a6c_desktop_layout
Create Date: 2026-09-13

Adds indexes for the four hottest unindexed FK columns the audit flagged
(333 unindexed FKs total; these four are on live query paths — notification
feeds, chat, class lists, webhook processing). Also renames the vestigial
physical-library ``book_transactions`` table (v2 replaced it with
copy-based transactions; the model is exported but no route reads or writes
it) to ``book_transactions_deprecated`` — a rename, not a drop, so any
historical rows survive; the model keeps pointing at the new name so
schema-drift checks stay green.
"""
from alembic import op
import sqlalchemy as sa

revision = "s_a7_fk_indexes"
down_revision = "s_a6c_desktop_layout"
branch_labels = None
depends_on = None


def _has_index(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return name in {ix["name"] for ix in insp.get_indexes(table)}


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(table)


def upgrade() -> None:
    for name, table, col in (
        ("ix_in_app_notifications_user_id", "in_app_notifications", "user_id"),
        ("ix_chat_messages_receiver_id", "chat_messages", "receiver_id"),
        ("ix_classes_academic_year_id", "classes", "academic_year_id"),
        ("ix_processed_webhook_events_school_id", "processed_webhook_events", "school_id"),
    ):
        if _table_exists(table) and not _has_index(table, name):
            op.create_index(name, table, [col])

    if _table_exists("book_transactions") and not _table_exists("book_transactions_deprecated"):
        op.rename_table("book_transactions", "book_transactions_deprecated")


def downgrade() -> None:
    if _table_exists("book_transactions_deprecated"):
        op.rename_table("book_transactions_deprecated", "book_transactions")
    for name, table in (
        ("ix_in_app_notifications_user_id", "in_app_notifications"),
        ("ix_chat_messages_receiver_id", "chat_messages"),
        ("ix_classes_academic_year_id", "classes"),
        ("ix_processed_webhook_events_school_id", "processed_webhook_events"),
    ):
        if _table_exists(table) and _has_index(table, name):
            op.drop_index(name, table_name=table)
