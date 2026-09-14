"""plugins→apps rename: tables, columns, enum, indexes

Revision ID: r2a_apps_rename
Revises: s_a7_fk_indexes
Create Date: 2026-09-14

Plugin → App ecosystem rename (deep-ux wave 8 / plan Part I):
  plugins            → apps          (catalog mirror)
  school_plugins     → school_apps   (per-tenant installs)
  plugin_usage_logs  → app_usage_logs
  school_plugins.plugin_slug → app_slug (FK retarget)
  plugin_category enum → app_category
Index/constraint names updated to match. Pure DDL rename — no data change.
"""
from alembic import op
import sqlalchemy as sa

revision = "r2a_apps_rename"
down_revision = "s_a7_fk_indexes"
branch_labels = None
depends_on = None


def upgrade():
    # ── plugin_usage_logs → app_usage_logs ─────────────────────────────
    op.rename_table("plugin_usage_logs", "app_usage_logs")
    op.execute("ALTER INDEX IF EXISTS ix_plugin_usage_logs_school_id RENAME TO ix_app_usage_logs_school_id")
    op.execute("ALTER TABLE app_usage_logs RENAME COLUMN plugin_slug TO app_slug")

    # ── school_plugins → school_apps ───────────────────────────────────
    op.execute("ALTER TABLE school_plugins DROP CONSTRAINT IF EXISTS school_plugins_plugin_slug_fkey")
    op.execute("ALTER TABLE school_plugins DROP CONSTRAINT IF EXISTS school_plugins_school_id_fkey")
    op.rename_table("school_plugins", "school_apps")
    op.execute("ALTER TABLE school_apps RENAME COLUMN plugin_slug TO app_slug")
    op.execute("ALTER INDEX IF EXISTS ix_school_plugins_school_id RENAME TO ix_school_apps_school_id")
    op.execute(
        "ALTER TABLE school_apps ADD CONSTRAINT school_apps_app_slug_fkey "
        "FOREIGN KEY (app_slug) REFERENCES plugins (slug)"
    )
    op.execute(
        "ALTER TABLE school_apps ADD CONSTRAINT school_apps_school_id_fkey "
        "FOREIGN KEY (school_id) REFERENCES schools (id)"
    )

    # ── plugins → apps ─────────────────────────────────────────────────
    # (drop dependent FKs first, re-add after rename)
    op.execute("ALTER TABLE school_apps DROP CONSTRAINT IF EXISTS school_apps_app_slug_fkey")
    op.rename_table("plugins", "apps")
    op.execute("ALTER INDEX IF EXISTS ix_plugins_is_deleted RENAME TO ix_apps_is_deleted")
    op.execute(
        "ALTER TABLE school_apps ADD CONSTRAINT school_apps_app_slug_fkey "
        "FOREIGN KEY (app_slug) REFERENCES apps (slug)"
    )

    # ── enum: plugin_category → app_category ───────────────────────────
    # Postgres enum rename keeps values; the SQLAlchemy model declares the
    # new name so this must match at DDL level.
    op.execute("ALTER TYPE plugin_category RENAME TO app_category")


def downgrade():
    op.execute("ALTER TYPE app_category RENAME TO plugin_category")
    op.execute("ALTER TABLE school_apps DROP CONSTRAINT IF EXISTS school_apps_app_slug_fkey")
    op.rename_table("apps", "plugins")
    op.execute("ALTER INDEX IF EXISTS ix_apps_is_deleted RENAME TO ix_plugins_is_deleted")
    op.execute(
        "ALTER TABLE school_apps ADD CONSTRAINT school_apps_app_slug_fkey "
        "FOREIGN KEY (app_slug) REFERENCES plugins (slug)"
    )
    op.execute("ALTER TABLE school_apps RENAME COLUMN app_slug TO plugin_slug")
    op.execute("ALTER INDEX IF EXISTS ix_school_apps_school_id RENAME TO ix_school_plugins_school_id")
    op.rename_table("school_apps", "school_plugins")
    op.execute("ALTER TABLE app_usage_logs RENAME COLUMN app_slug TO plugin_slug")
    op.execute("ALTER INDEX IF EXISTS ix_app_usage_logs_school_id RENAME TO ix_plugin_usage_logs_school_id")
    op.rename_table("app_usage_logs", "plugin_usage_logs")
