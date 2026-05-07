"""Plan-compatible analytics model aliases."""

from app.models.ai_insight import DailyBrief, RiskAlert, WeeklyInsightReport
from app.models.ai_token import AISchoolQuota, AIUsageLog
from app.models.plugin import PluginUsageLog

__all__ = [
    "WeeklyInsightReport",
    "DailyBrief",
    "RiskAlert",
    "AISchoolQuota",
    "AIUsageLog",
    "PluginUsageLog",
]
