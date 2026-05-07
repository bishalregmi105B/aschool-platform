"""Auth & access control decorators."""
from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import get_jwt, verify_jwt_in_request


def role_required(*allowed_roles):
    """Decorator: restrict endpoint to specific user roles."""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role not in allowed_roles:
                return (
                    jsonify(
                        success=False,
                        data=None,
                        error="Insufficient permissions",
                    ),
                    403,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def school_required(f):
    """Decorator: ensures request has a resolved school context."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not g.get("school_id"):
            return (
                jsonify(
                    success=False,
                    data=None,
                    error="School context required. Use a school subdomain.",
                ),
                400,
            )
        return f(*args, **kwargs)

    return decorated_function


def superadmin_required(f):
    """Decorator: restrict to ASchool platform superadmin only."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "superadmin":
            return jsonify(success=False, data=None, error="Superadmin only"), 403
        return f(*args, **kwargs)

    return decorated_function
