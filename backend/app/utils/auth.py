"""Authentication helpers expected by the implementation plan."""

from flask import g
from flask_jwt_extended import get_jwt, get_jwt_identity


def current_user_id():
    """Return the authenticated user's ID from Flask globals or JWT."""
    user = getattr(g, "current_user", None)
    if user is not None:
        return getattr(user, "id", None)
    return get_jwt_identity()


def current_school_id():
    """Return the resolved school ID for the current request."""
    return getattr(g, "school_id", None)


def current_role():
    """Return the current request role from JWT claims."""
    return get_jwt().get("role")
