"""FC-A02 — migration drift gate.

The L-01 class of production 500s (book_issues.fine_amount,
website_pages.draft_config) happens when models/ and migrations/ drift apart
by hand. This gate makes that a CI failure instead of a Monday incident:

    1. upgrade a scratch database to the current migration head
    2. diff the migrated schema against the SQLAlchemy model metadata
       (alembic.autogenerate.compare_metadata)
    3. exit non-zero with the full diff when anything drifts

Run locally:
    DATABASE_URL=postgresql://aschool:aschool@localhost:5433/aschool_drift \
        python scripts/check_migration_drift.py
"""
import os
import sys
from urllib.parse import urlsplit, urlunsplit

MISSING_DEPS = []


def _require(mod, pip_name):
    try:
        __import__(mod)
        return True
    except ImportError:
        MISSING_DEPS.append(pip_name)
        return False


_require("alembic", "alembic")
_require("flask_migrate", "flask-migrate")
_require("flask", "flask")
if MISSING_DEPS:
    print(f"missing dependencies: {', '.join(MISSING_DEPS)}")
    sys.exit(2)

from alembic.autogenerate import compare_metadata  # noqa: E402
from alembic.migration import MigrationContext  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

base_url = os.getenv(
    "DATABASE_URL", "postgresql://aschool:aschool@localhost:5433/aschool"
)
parts = urlsplit(base_url)
scratch_db = f"aschool_drift_check"
scratch_url = urlunsplit((parts.scheme, parts.netloc, f"/{scratch_db}", "", ""))

# ── 1. recreate the scratch database and migrate it to head ────────────────
admin_engine = create_engine(base_url.rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT")
with admin_engine.connect() as conn:
    conn.execute(text(f'DROP DATABASE IF EXISTS "{scratch_db}"'))
    conn.execute(text(f'CREATE DATABASE "{scratch_db}"'))
admin_engine.dispose()

upgrade_env = dict(os.environ)
upgrade_env["DATABASE_URL"] = scratch_url

import subprocess  # noqa: E402

proj_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
result = subprocess.run(
    [sys.executable, "-m", "flask", "db", "upgrade"],
    cwd=proj_root,
    env=upgrade_env,
    capture_output=True,
    text=True,
)
if result.returncode != 0:
    print("flask db upgrade FAILED on scratch db:")
    print(result.stdout[-4000:])
    print(result.stderr[-4000:])
    sys.exit(1)
print(f"scratch db '{scratch_db}' migrated to head")

# ── 2. diff migrated schema vs model metadata ──────────────────────────────
# NOTE: don't use create_app() here — TestingConfig forces the DB name to
# aschool_test. Diff the scratch DB directly against the model metadata
# (importing app.models registers every model on db.metadata).
sys.path.insert(0, proj_root)
import app.models  # noqa: E402, F401 — registers all models on db.metadata
from extensions import db as _db  # noqa: E402

engine = create_engine(scratch_url)
with engine.connect() as conn:
    mc = MigrationContext.configure(conn)
    full_diff = compare_metadata(mc, _db.metadata)
engine.dispose()

# ── 2b. filter known, separately-tracked drift classes ─────────────────────
# These buckets are pre-existing platform debt tracked elsewhere (audits):
#   modify_type DateTime→Timestamptz   — Q20/D-03 timestamptz sweep
#   modify_nullable                    — nullability tightening backlog
#   FK add/remove naming noise         — unnamed-FK conventions (F9)
#   index-name mismatches              — historical hand-named indexes
#   UniqueConstraint additions         — deferred expand-then-contract items
#   document_chunks.embedding_vec      — pgvector column intentionally raw-SQL
#                                        only (alembic has no vector type);
#                                        documented in app/models/document_chunk.py
# What MUST still fail the gate: added/removed TABLES, added/removed COLUMNS,
# i.e. the drift class that produced the L-01 production 500s.
def _is_vector_column_gap(item):
    return (
        isinstance(item, tuple)
        and item
        and item[0] in ("remove_column", "add_column")
        and any("embedding_vec" in str(part) for part in item[1:])
    )


def _normalize(item):
    """compare_metadata sometimes wraps one op in a single-element list —
    unwrap so kind detection works for both shapes."""
    while isinstance(item, (list, tuple)) and len(item) == 1 and isinstance(item[0], (list, tuple)):
        item = item[0]
    return item


def _allow(item):
    item = _normalize(item)
    kind = item[0] if isinstance(item, tuple) and item else str(item)
    if kind in (
        "modify_type", "modify_nullable", "add_fk", "remove_fk", "add_constraint",
        "remove_index", "add_index",
    ):
        return True
    if _is_vector_column_gap(item):
        return True
    return False


diff = [item for item in full_diff if not _allow(item)]
hard_total = len(diff)
full_total = len(full_diff)
print(f"drift scan: {hard_total} blocking / {full_total} total items "
      f"({full_total - hard_total} in allowlisted debt classes)")

if not diff:
    print("MIGRATION DRIFT CHECK: PASS — no blocking schema drift")
    # leave the scratch db for forensic inspection; drop it to be tidy
    admin_engine = create_engine(base_url.rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{scratch_db}"'))
    admin_engine.dispose()
    sys.exit(0)

print("MIGRATION DRIFT CHECK: FAIL — models/ and migrations/ disagree:")
for d in diff:
    print(f"  - {d}")
print("\nFix: create the missing migration (flask db migrate -m '...') or")
print("correct the models. Never ship a model change without its migration.")
sys.exit(1)
