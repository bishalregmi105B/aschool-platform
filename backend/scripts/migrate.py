"""Programmatic Alembic driver — `python scripts/migrate.py [revision]`.

The venv's Flask-Migrate install exposes no `flask.commands` entry point,
so `flask db upgrade` is unavailable. This runs the same flask_migrate
machinery directly; DATABASE_URL selects the target database.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main() -> int:
    from app import create_app
    from flask_migrate import upgrade, downgrade, current

    app = create_app(os.getenv("FLASK_ENV", "development"))
    args = sys.argv[1:]
    with app.app_context():
        if args and args[0] == "downgrade":
            downgrade(revision=args[1] if len(args) > 1 else "-1")
        elif args and args[0] == "current":
            current()
        else:
            upgrade(revision=args[0] if args else "head")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
