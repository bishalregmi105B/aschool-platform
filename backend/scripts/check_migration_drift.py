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
os.environ["DATABASE_URL"] = scratch_url
sys.path.insert(0, proj_root)  # make `app` importable when run as a script
from app import create_app  # noqa: E402
from extensions import db as _db  # noqa: E402

app = create_app("testing")
with app.app_context():
    engine = _db.engine
    with engine.connect() as conn:
        mc = MigrationContext.configure(conn)
        diff = compare_metadata(mc, _db.metadata)

if not diff:
    print("MIGRATION DRIFT CHECK: PASS — models and migrations are in sync")
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
