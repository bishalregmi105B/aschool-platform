"""Re-export shim — the model file of record lives in the app folder
(app/apps/modules/disaster_management/models.py). Kept so existing imports
"from app.models.disaster_management import X" keep working; new code should import
from the app folder."""
from app.apps.modules.disaster_management.models import *  # noqa: F401,F403
