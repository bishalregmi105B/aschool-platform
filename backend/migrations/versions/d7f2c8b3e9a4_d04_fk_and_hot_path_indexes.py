"""D-04: index every unindexed FK + tenant-leading composites + hot lookups

Programmatic pass: any ForeignKey column without an index gets one
(`ix_<table>_<col>`). Plus the audit's priority composites and hot lookups
(login by email/phone, custom domains, tenant-first filters).

Revision ID: d7f2c8b3e9a4
Revises: c5e8a1b7d4f2
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d7f2c8b3e9a4"
down_revision = "c5e8a1b7d4f2"
branch_labels = None
depends_on = None

# tenant-first composite indexes (school_id + hot filter column) — 04_DATAMODEL §P1-13
_COMPOSITES = [
    ("ix_marks_school_exam", "marks", ["school_id", "exam_id"]),
    ("ix_marks_school_student", "marks", ["school_id", "student_id"]),
    ("ix_fee_collections_school_student", "fee_collections", ["school_id", "student_id"]),
    ("ix_fee_collections_school_status", "fee_collections", ["school_id", "payment_status"]),
    ("ix_attendance_school_student_date", "attendance", ["school_id", "student_id", "date"]),
    ("ix_attendance_school_class_date", "attendance", ["school_id", "class_id", "date"]),
    ("ix_students_school_class", "students", ["school_id", "class_id"]),
    ("ix_fee_receipts_school_collection", "fee_receipts", ["school_id", "collection_id"]),
    ("ix_book_issues_school_student", "book_issues", ["school_id", "student_id"]),
    ("ix_notifications_school_user", "in_app_notifications", ["school_id", "user_id"]),
]

# single-column hot lookups
_SINGLES = [
    ("ix_users_email", "users", ["email"]),
    ("ix_users_phone", "users", ["phone"]),
    ("ix_schools_custom_domain", "schools", ["custom_domain"]),
]

_SKIP_TABLES = {"alembic_version"}


def _existing_indexes(insp, table):
    try:
        return {ix["name"] for ix in insp.get_indexes(table)}
    except Exception:
        return set()


def _table_columns(insp, table):
    try:
        return {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return set()


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names()) - _SKIP_TABLES

    created = 0
    # ── every unindexed FK column ────────────────────────────────────────
    for table in sorted(tables):
        try:
            fks = insp.get_foreign_keys(table)
        except Exception:
            continue
        existing = _existing_indexes(insp, table)
        cols = _table_columns(insp, table)
        indexed_cols = set()
        for ix in insp.get_indexes(table):
            indexed_cols.update(ix.get("column_names", []))
        for fk in fks:
            for col in fk.get("constrained_columns", []):
                if col not in cols or col in indexed_cols:
                    continue
                name = f"ix_{table}_{col}"
                if name in existing:
                    continue
                try:
                    op.create_index(name, table, [col])
                    existing.add(name)
                    indexed_cols.add(col)
                    created += 1
                except Exception as exc:  # noqa: BLE001
                    print(f"  skip {name}: {str(exc)[:80]}")

    # ── composites + singles (guard column existence) ────────────────────
    for name, table, cols in _COMPOSITES + _SINGLES:
        if table not in tables:
            print(f"  skip {name}: table {table} missing")
            continue
        if not set(cols) <= _table_columns(insp, table):
            print(f"  skip {name}: missing columns on {table}")
            continue
        try:
            op.create_index(name, table, cols)
            created += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  skip {name}: {str(exc)[:80]}")
    print(f"D-04: created {created} indexes")


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    for name, table, cols in reversed(_COMPOSITES + _SINGLES):
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass
    # the programmatic FK indexes are left in place on downgrade (harmless)
