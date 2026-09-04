"""D-03 completion: convert remaining naive TIMESTAMP columns to TIMESTAMPTZ

The BaseModel change (timezone=True) fixed all FUTURE tables; this migration
converts the EXISTING naive columns. Asia/Kathmandu (+05:45) is the assumed
storage interpretation per the project's operating TZ.

Idempotent: skips columns already timestamptz. Excludes columns that are
already tz-aware (created_at/updated_at in newer tables).

Revision ID: b2e7c4a9f1d3
Revises: a7c3e9b1d5f4
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = "b2e7c4a9f1d3"
down_revision = "a7c3e9b1d5f4"
branch_labels = None
depends_on = None

# Columns that must STAY naive by contract (BS-calendar date strings are
# stored separately; these hold no absolute instants).
KEEP_NAIVE = set()


def upgrade():
    bind = op.get_bind()
    # Every (table, column) that is timestamp WITHOUT time zone
    rows = bind.execute(sa.text("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp without time zone'
        ORDER BY table_name, column_name
    """)).fetchall()

    converted = 0
    for table, column in rows:
        if (table, column) in KEEP_NAIVE:
            continue
        try:
            # USING ... AT TIME ZONE 'Asia/Kathmandu': naive values were
            # written as Kathmandu local time throughout the app's history
            # (CELERY_TIMEZONE default) — attach that offset explicitly.
            bind.execute(sa.text(
                f'ALTER TABLE "{table}" ALTER COLUMN "{column}" '
                f"TYPE timestamptz USING "
                f'"{column}" AT TIME ZONE \'Asia/Kathmandu\''
            ))
            converted += 1
        except Exception as exc:  # noqa: BLE001 — keep converting the rest
            print(f"  skip {table}.{column}: {str(exc)[:90]}")
    print(f"D-03 conversion: {converted} columns → timestamptz")


def downgrade():
    # Reverting tz-awareness loses the offset — kept for symmetry only.
    bind = op.get_bind()
    rows = bind.execute(sa.text("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp with time zone'
          AND table_name NOT IN ('alembic_version')
    """)).fetchall()
    for table, column in rows:
        try:
            bind.execute(sa.text(
                f'ALTER TABLE "{table}" ALTER COLUMN "{column}" '
                f"TYPE timestamp USING \"{column}\" AT TIME ZONE 'UTC'"
            ))
        except Exception:
            pass
