"""Celery application entry point for workers and beat."""
import os

from app import create_app
from extensions import celery

flask_app = create_app(os.getenv("FLASK_ENV", "development"))
flask_app.app_context().push()

# Import the task package so Celery workers and beat register all task names.
import app.tasks  # noqa: F401,E402

# Celery looks for an `app` attribute in the module
app = celery
