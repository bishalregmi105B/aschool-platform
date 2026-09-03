"""Base model with UUID PK, timestamps, soft delete, school_id."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID

from extensions import db


class BaseModel(db.Model):
    """Abstract base for all ASchool models."""

    __abstract__ = True

    # D-03: timezone-aware (TIMESTAMPTZ) timestamps with server defaults;
    # server-side id default so raw SQL/migrations can omit it.
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_deleted = Column(
        Boolean, default=False, nullable=False, server_default=text("false")
    )

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

    @classmethod
    def for_school_and_year(cls, school_id, academic_year_id):
        """Query scoped to one school AND one academic year (D-05).

        Only meaningful for models carrying academic_year_id; raises a clear
        error on models without the column instead of silently ignoring it.
        """
        query = cls.for_school(school_id)
        col = getattr(cls, "academic_year_id", None)
        if col is None:
            raise SchoolIsolationError(
                f"{cls.__name__} has no academic_year_id — use for_school()"
            )
        return query.filter(col == academic_year_id)


class SchoolIsolationError(Exception):
    """Raised when a query is attempted without school_id."""

    pass
