"""Plugin system models."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Plugin(BaseModel):
    """Master plugin registry — managed by ASchool super admin."""

    __tablename__ = "plugins"

    slug = Column(String(100), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    name_nepali = Column(String(200))
    description = Column(Text)
    description_nepali = Column(Text)
    icon = Column(String(50))
    emoji = Column(String(10))
    category = Column(
        Enum("core", "starter", "growth", "premium", "add_on", name="plugin_category"),
        nullable=False,
    )

    # Pricing
    price_monthly = Column(Numeric(10, 2), default=0)
    price_yearly = Column(Numeric(10, 2), default=0)
    is_free = Column(Boolean, default=False)
    trial_days = Column(Integer, default=14)

    # Technical
    version = Column(String(20), default="1.0.0")
    api_blueprint = Column(String(100))
    models_module = Column(String(100))
    frontend_route = Column(String(100))
    flutter_feature = Column(String(100))
    frontend_sidebar_config = Column(JSONB)

    # Dependencies
    depends_on = Column(ARRAY(String), default=list)
    conflicts_with = Column(ARRAY(String), default=list)

    # Visibility
    visible_to_roles = Column(
        ARRAY(String),
        default=lambda: ["school_admin", "teacher", "parent", "student"],
    )

    # Marketplace
    screenshots = Column(ARRAY(Text), default=list)
    video_demo_url = Column(Text)
    tags = Column(ARRAY(String), default=list)
    sort_order = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    is_published = Column(Boolean, default=True)

    # Stats
    install_count = Column(Integer, default=0)
    avg_rating = Column(Numeric(2, 1), default=0)

    # school_id is NULL — platform-level record


class SchoolPlugin(BaseModel):
    """Per-school plugin installation record."""

    __tablename__ = "school_plugins"
    __table_args__ = (UniqueConstraint("school_id", "plugin_slug"),)

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )
    plugin_slug = Column(
        String(100), ForeignKey("plugins.slug"), nullable=False, index=True
    )

    # Status
    active = Column(Boolean, default=True)
    installed_at = Column(DateTime, default=func.now())
    uninstalled_at = Column(DateTime)

    # Billing
    billing_cycle = Column(
        Enum("monthly", "yearly", name="billing_cycle"), default="monthly"
    )
    trial_started_at = Column(DateTime)
    trial_ends_at = Column(DateTime)
    is_trial = Column(Boolean, default=True)
    next_billing_date = Column(Date)

    # Config
    config = Column(JSONB, default=dict)

    # Relationships
    plugin = relationship("Plugin")
    school = relationship("School", backref="installed_plugins")


class PluginUsageLog(BaseModel):
    """Track API calls per plugin per school for usage-based billing."""

    __tablename__ = "plugin_usage_logs"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )
    plugin_slug = Column(String(100), nullable=False, index=True)
    action = Column(String(100))
    usage_count = Column(Integer, default=1)
    usage_date = Column(Date, default=func.current_date())
    cost = Column(Numeric(10, 2), default=0)
