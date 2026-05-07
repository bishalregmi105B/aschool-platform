"""Plan-compatible staff model aliases."""

from app.models.user import User

Staff = User
StaffMember = User

__all__ = ["Staff", "StaffMember"]
