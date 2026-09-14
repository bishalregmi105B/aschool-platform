"""Portfolio models."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class StudentPortfolio(SchoolModel):
    __tablename__ = "student_portfolios"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    bio = Column(Text)
    interests = Column(JSONB, default=list)
    skills = Column(JSONB, default=list)
    is_public = Column(Boolean, default=False)

    student = relationship("Student", backref="portfolio")
    items = relationship("PortfolioItem", back_populates="portfolio")


class PortfolioItem(SchoolModel):
    __tablename__ = "portfolio_items"

    portfolio_id = Column(
        UUID(as_uuid=True), ForeignKey("student_portfolios.id"), nullable=False
    )
    title = Column(String(300), nullable=False)
    description = Column(Text)
    item_type = Column(String(50))  # project, artwork, essay, certificate
    media_urls = Column(JSONB, default=list)
    tags = Column(JSONB, default=list)

    portfolio = relationship("StudentPortfolio", back_populates="items")


class MicroCredential(SchoolModel):
    __tablename__ = "micro_credentials"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    title = Column(String(300), nullable=False)
    description = Column(Text)
    issuer = Column(String(200))
    issued_at = Column(DateTime)
    credential_url = Column(Text)
    verification_hash = Column(String(255))
    badge_url = Column(Text)

    student = relationship("Student", backref="micro_credentials")
