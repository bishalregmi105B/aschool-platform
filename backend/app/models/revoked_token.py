"""JWT token revocation (blocklist) model.

Used to invalidate access/refresh tokens before their natural expiry —
primarily for mobile logout and admin-forced session termination.

The revoked_tokens table uses the JWT `jti` (JWT ID) claim as the key.
Flask-JWT-Extended is wired to call `is_token_revoked()` on every request
when JWT_BLACKLIST_ENABLED is True.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, String

from app.models.base import BaseModel
from extensions import db


class RevokedToken(BaseModel):
    """Stores revoked JWT JTIs so they are rejected on subsequent requests."""

    __tablename__ = "revoked_tokens"

    jti = Column(String(36), nullable=False, unique=True, index=True)
    # 'access' or 'refresh'
    token_type = Column(String(10), nullable=False, default="access")
    # When this revocation entry can be safely pruned (matches token expiry)
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )

    @classmethod
    def revoke(cls, jti: str, token_type: str = "access", expires_at: datetime | None = None) -> None:
        """Add a JTI to the blocklist."""
        if expires_at is None:
            from flask import current_app
            from datetime import timedelta
            delta = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES", timedelta(hours=1))
            expires_at = datetime.now(timezone.utc) + delta

        entry = cls(jti=jti, token_type=token_type, expires_at=expires_at)
        db.session.add(entry)
        db.session.commit()

    @classmethod
    def is_revoked(cls, jti: str) -> bool:
        """Return True if the JTI is in the blocklist and not yet expired."""
        return db.session.query(
            cls.query.filter(
                cls.jti == jti,
                cls.expires_at > datetime.now(timezone.utc),
            ).exists()
        ).scalar()

    @classmethod
    def prune_expired(cls) -> int:
        """Delete entries whose token has already expired. Call periodically."""
        deleted = cls.query.filter(cls.expires_at <= datetime.now(timezone.utc)).delete()
        db.session.commit()
        return deleted
