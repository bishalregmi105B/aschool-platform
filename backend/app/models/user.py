"""User model — all roles in one table."""
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel
from app.models.base import SchoolIsolationError


class User(BaseModel):
    __tablename__ = "users"

    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), index=True)
    role = Column(
        Enum(
            "superadmin",
            "school_admin",
            "accountant",
            "teacher",
            "staff",
            "parent",
            "student",
            name="user_role",
        ),
        nullable=False,
    )

    # Profile
    full_name = Column(String(300), nullable=False)
    full_name_nepali = Column(String(300))
    email = Column(String(200))
    phone = Column(String(20), nullable=False)
    phone_verified = Column(Boolean, default=False)
    avatar_url = Column(Text)
    gender = Column(Enum("male", "female", "other", name="gender_type"))
    dob_bs = Column(String(10))
    dob_ad = Column(Date)
    address = Column(JSONB)

    # Auth
    password_hash = Column(String(255))
    otp_code = Column(String(6))
    otp_expires_at = Column(DateTime)
    last_login_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

    # Brute-force lockout (per-user, independent of IP-level rate limiting)
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)  # UTC; None means not locked

    # Tokens issued before this UTC timestamp are rejected by the blocklist
    # loader (logout-all / password change). None means no global invalidation.
    tokens_invalid_before = Column(DateTime, nullable=True)

    # Push notifications
    fcm_tokens = Column(ARRAY(Text))

    # OneSignal player IDs (multi-device support)
    onesignal_player_ids = Column(ARRAY(Text))

    # Language
    preferred_language = Column(String(10), default="ne")

    # Permissions override
    permissions = Column(JSONB, default=dict)

    # Relationships
    school = relationship("School", foreign_keys=[school_id])

    @classmethod
    def for_school(cls, school_id):
        """Return active users for a specific school."""
        if school_id is None:
            raise SchoolIsolationError("school_id is required for all queries")
        return cls.query.filter_by(school_id=school_id, is_deleted=False)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_sensitive=False):
        data = {
            "id": str(self.id),
            "role": self.role,
            "full_name": self.full_name,
            "full_name_nepali": self.full_name_nepali,
            "email": self.email,
            "phone": self.phone,
            "phone_verified": self.phone_verified,
            "avatar_url": self.avatar_url,
            "gender": self.gender,
            "dob_bs": self.dob_bs,
            "preferred_language": self.preferred_language,
            "permissions": self.permissions or {},
            "is_active": self.is_active,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "school_id": str(self.school_id) if self.school_id else None,
            "login_id": self.email or self.phone,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        # Only include sensitive data when explicitly requested (admin contexts only)
        if include_sensitive:
            from app.utils.password import generate_default_password
            data["default_password_hint"] = generate_default_password(self)

        return data
