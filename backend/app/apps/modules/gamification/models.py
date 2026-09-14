"""Gamification models: Points, Badges, Houses, Rewards."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Badge(SchoolModel):
    __tablename__ = "badges"

    name = Column(String(100), nullable=False)
    name_nepali = Column(String(100))
    description = Column(Text)
    icon_url = Column(Text)
    criteria = Column(JSONB, default=dict)  # {type: "attendance_streak", value: 30}
    points_value = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class StudentBadge(SchoolModel):
    __tablename__ = "student_badges"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id"), nullable=False)
    awarded_at = Column(DateTime)
    awarded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    student = relationship("Student", backref="badges_earned")
    badge = relationship("Badge")
    awarded_by = relationship("User")


class PointsLog(SchoolModel):
    __tablename__ = "points_logs"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    points = Column(Integer, nullable=False)
    reason = Column(String(200))
    category = Column(String(50))  # attendance, academic, behavior, sports
    awarded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    awarded_at = Column(DateTime)

    student = relationship("Student", backref="points_logs")
    awarded_by = relationship("User")


class House(SchoolModel):
    __tablename__ = "houses"

    name = Column(String(100), nullable=False)
    color = Column(String(7))  # hex
    motto = Column(String(200))
    logo_url = Column(Text)
    total_points = Column(Integer, default=0)
    captain_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))

    captain = relationship("Student")


class Reward(SchoolModel):
    __tablename__ = "rewards"

    name = Column(String(200), nullable=False)
    description = Column(Text)
    points_required = Column(Integer, nullable=False)
    icon_url = Column(Text)
    quantity_available = Column(Integer)
    is_active = Column(Boolean, default=True)
