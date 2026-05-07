"""Base model with UUID PK, timestamps, soft delete, school_id."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from extensions import db


class BaseModel(db.Model):
    """Abstract base for all ASchool models."""

    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
    is_deleted = Column(Boolean, default=False, nullable=False)

    def soft_delete(self):
        self.is_deleted = True
        db.session.commit()

    @classmethod
    def active(cls):
        """Return query filtered to non-deleted records."""
        return cls.query.filter_by(is_deleted=False)


class SchoolModel(BaseModel):
    """Abstract base for models that belong to a school."""

    __abstract__ = True

    school_id = Column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )

    @classmethod
    def for_school(cls, school_id):
        """Return query filtered by school_id and non-deleted."""
        if school_id is None:
            raise SchoolIsolationError("school_id is required for all queries")
        return cls.query.filter_by(school_id=school_id, is_deleted=False)


class SchoolIsolationError(Exception):
    """Raised when a query is attempted without school_id."""

    pass
