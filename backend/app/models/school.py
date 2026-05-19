"""School and related models."""
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
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class School(BaseModel):
    __tablename__ = "schools"

    # Identity
    name = Column(String(300), nullable=False)
    name_nepali = Column(String(300))
    slug = Column(String(100), unique=True, nullable=False)
    custom_domain = Column(String(255))
    domain_verified = Column(Boolean, default=False)
    logo_url = Column(Text)
    favicon_url = Column(Text)
    banner_url = Column(Text)

    # Plan & Status
    plan = Column(
        Enum("free", "starter", "growth", "enterprise", name="school_plan"),
        default="free",
    )
    plan_expires_at = Column(DateTime)
    status = Column(
        Enum("trial", "active", "suspended", "cancelled", name="school_status"),
        default="trial",
    )
    trial_ends_at = Column(DateTime)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    max_students = Column(Integer, default=100)

    # School Info
    type = Column(
        Enum(
            "government",
            "private",
            "community",
            "boarding",
            "international",
            "technical",
            "college",
            name="school_type",
        )
    )
    level = Column(
        Enum(
            "primary",
            "secondary",
            "higher_secondary",
            "college",
            "all",
            name="school_level",
        )
    )
    established_year_bs = Column(String(4))
    established_year_ad = Column(Integer)
    affiliated_to = Column(String(200))
    regd_number = Column(String(100))
    pan_number = Column(String(20))
    irb_number = Column(String(50))  # IRD registration number for tax receipts

    # Location
    province = Column(String(100))
    district = Column(String(100))
    municipality = Column(String(100))
    ward = Column(String(10))
    address = Column(Text)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    google_maps_url = Column(Text)

    # Contact
    phone = Column(String(20))
    phone_2 = Column(String(20))
    email = Column(String(200))
    website_external = Column(String(200))

    # Social Accounts
    facebook_page_id = Column(String(200))
    facebook_page_token = Column(Text)
    facebook_ad_account_id = Column(String(100))
    instagram_account_id = Column(String(200))
    instagram_token = Column(Text)
    tiktok_handle = Column(String(100))
    tiktok_token = Column(Text)
    youtube_channel_id = Column(String(100))
    youtube_token = Column(Text)
    whatsapp_number = Column(String(20))
    whatsapp_phone_number_id = Column(String(100))
    whatsapp_token = Column(Text)

    # Configuration (JSONB)
    settings = Column(JSONB, default=dict)
    website_config = Column(JSONB, default=dict)
    ai_config = Column(JSONB, default=dict)
    fee_config = Column(JSONB, default=dict)
    exam_config = Column(JSONB, default=dict)
    notification_config = Column(JSONB, default=dict)
    social_ai_config = Column(JSONB, default=dict)
    gamification_config = Column(JSONB, default=dict)
    admission_config = Column(JSONB, default=dict)

    # Multi-campus
    is_multichain = Column(Boolean, default=False)

    # Calendar
    academic_year_start_bs = Column(String(10))
    academic_year_end_bs = Column(String(10))
    working_days = Column(ARRAY(String))
    school_start_time = Column(Time)
    school_end_time = Column(Time)

    # Denormalized metrics
    total_students = Column(Integer, default=0)
    total_staff = Column(Integer, default=0)
    total_revenue_ytd = Column(Numeric(15, 2), default=0)
    fee_collection_rate = Column(Numeric(5, 2))

    # Currency & Language
    currency = Column(String(3), default="NPR")
    default_language = Column(String(10), default="ne")

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "name_nepali": self.name_nepali,
            "slug": self.slug,
            "custom_domain": self.custom_domain,
            "domain_verified": self.domain_verified,
            "logo_url": self.logo_url,
            "banner_url": self.banner_url,
            "plan": self.plan,
            "regd_number": self.regd_number,
            "pan_number": self.pan_number,
            "irb_number": self.irb_number,
            "plan_expires_at": self.plan_expires_at.isoformat() if self.plan_expires_at else None,
            "status": self.status,
            "type": self.type,
            "level": self.level,
            "province": self.province,
            "district": self.district,
            "municipality": self.municipality,
            "address": self.address,
            "phone": self.phone,
            "email": self.email,
            "website_external": self.website_external,
            "total_students": self.total_students,
            "total_staff": self.total_staff,
            "fee_collection_rate": float(self.fee_collection_rate) if self.fee_collection_rate else None,
            "default_language": self.default_language,
            "settings": self.settings or {},
            "fee_config": self.fee_config or {},
            "notification_config": self.notification_config or {},
            "academic_year_start_bs": self.academic_year_start_bs,
            "academic_year_end_bs": self.academic_year_end_bs,
            "working_days": self.working_days,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SchoolWebsite(BaseModel):
    __tablename__ = "school_websites"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )
    theme_slug = Column(String(100))
    customizations = Column(JSONB, default=dict)
    active_theme_version_id = Column(UUID(as_uuid=True))
    draft_config = Column(JSONB, default=dict)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime)
    custom_css = Column(Text)
    google_analytics_id = Column(String(50))
    facebook_pixel_id = Column(String(50))
    meta_title = Column(String(200))
    meta_description = Column(Text)
    og_image_url = Column(Text)

    school = relationship("School", backref="website")


class SchemeGrade(BaseModel):
    __tablename__ = "scheme_grades"

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    type = Column(
        Enum("letter", "gpa", "percentage", name="grade_scheme_type"), nullable=False
    )
    ranges = Column(JSONB, default=list)

    school = relationship("School", backref="grading_schemes")
