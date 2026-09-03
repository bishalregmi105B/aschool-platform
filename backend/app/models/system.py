"""Platform-level key/value settings (P-02/P-04).

Operational state that must survive restarts and be queryable:
last_db_backup_at, last successful migration, feature flags, etc.
"""
from sqlalchemy import Column, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import BaseModel


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key = Column(String(100), nullable=False, unique=True, index=True)
    value = Column(JSONB, default=dict)

    def __repr__(self):  # pragma: no cover
        return f"<SystemSetting {self.key}={self.value}>"
