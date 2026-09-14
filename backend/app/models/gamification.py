"""Re-export shim — the model file of record lives in the app folder
(app/apps/modules/gamification/models.py). Kept so existing imports
"from app.models.gamification import X" keep working; new code should import
from the app folder."""
from app.apps.modules.gamification.models import *  # noqa: F401,F403
