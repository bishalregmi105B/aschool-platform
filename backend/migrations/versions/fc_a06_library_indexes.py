"""FC-A06: library hot-path indexes.

The library module's two hottest scans had no supporting indexes:

- /library/issues filters by school + (status, due_date) for the overdue page
  and joins book_id for the checkout desk's active-issue lookup — both were
  seq scans once a school passed a few thousand issues.
- /library/books always filters school_id + is_deleted and sorts by title.

Only one index existed on the whole module (ix_book_issues_school_student).
Model side mirrors these in app/models/library.py so the autogenerate-diff
gate (FC-A02) stays empty.

Revision ID: fc_a06_idx
Revises: c9d3e7f1a5b2
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "fc_a06_idx"
down_revision = "c9d3e7f1a5b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_book_issues_school_book",
        "book_issues",
        ["school_id", "book_id"],
    )
    op.create_index(
        "ix_book_issues_school_status_due",
        "book_issues",
        ["school_id", "status", "due_date"],
    )
    op.create_index(
        "ix_books_school_deleted_title",
        "books",
        ["school_id", "is_deleted", "title"],
    )


def downgrade() -> None:
    op.drop_index("ix_books_school_deleted_title", table_name="books")
    op.drop_index("ix_book_issues_school_status_due", table_name="book_issues")
    op.drop_index("ix_book_issues_school_book", table_name="book_issues")
