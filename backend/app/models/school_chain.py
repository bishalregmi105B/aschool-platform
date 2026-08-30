"""Multi-Branch Chain models — org/branch registry linking School tenants
into a chain owned by a parent school (premium plugin, NPR 2999).

Tenancy notes:
- ``SchoolChain.school_id`` is the chain OWNER (parent organisation school).
- ``SchoolChainMember.school_id`` is the BRANCH school (a full School tenant).
  Branches are real tenants: their students/staff/fees live in their own
  school_id scope, so every aggregate query below stays tenant-scoped.
"""
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class SchoolChain(SchoolModel):
    """A chain (organisation) owned by a parent school. One per parent."""

    __tablename__ = "school_chains"

    # SchoolModel.school_id == the owning/parent school
    name = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    members = relationship(
        "SchoolChainMember",
        back_populates="chain",
        primaryjoin="and_(SchoolChainMember.chain_id == SchoolChain.id, "
        "SchoolChainMember.is_deleted == False)",
    )

    __table_args__ = (
        # Only one live chain per parent school (soft-deleted rows excluded)
        Index(
            "uq_school_chains_owner",
            "school_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id),
            "name": self.name,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SchoolChainMember(SchoolModel):
    """A branch school linked into a chain."""

    __tablename__ = "school_chain_members"

    # SchoolModel.school_id == the branch school itself
    chain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("school_chains.id"),
        nullable=False,
        index=True,
    )
    code = Column(String(50))  # branch code within the chain (e.g. KTM01)
    principal_name = Column(String(200))
    is_active = Column(Boolean, default=True, nullable=False)
    added_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    chain = relationship("SchoolChain", back_populates="members")
    school = relationship(
        "School", foreign_keys="SchoolChainMember.school_id", viewonly=True
    )

    __table_args__ = (
        # A school can be a branch of at most one live chain
        Index(
            "uq_school_chain_member_school",
            "school_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        # Branch code unique within a chain
        Index(
            "uq_school_chain_member_code",
            "chain_id",
            "code",
            unique=True,
            postgresql_where=text("is_deleted = false AND code IS NOT NULL"),
        ),
    )

    def to_dict(self):
        school = self.school
        return {
            "id": str(self.id),
            "chain_id": str(self.chain_id),
            "school_id": str(self.school_id),
            "code": self.code,
            "principal_name": self.principal_name,
            "is_active": self.is_active,
            "name": school.name if school else None,
            "address": school.address if school else None,
            "phone": school.phone if school else None,
            "email": school.email if school else None,
            "slug": school.slug if school else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
