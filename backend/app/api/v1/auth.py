"""Auth API routes — OTP, login, token refresh, me."""
from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.services.auth_service import AuthService
from app.models.user import User
from app.utils.response import error_response, success_response

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    """Send OTP to phone number."""
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    if not phone:
        return error_response("Phone number is required", 400)

    from app.utils.validators import validate_nepal_phone
    if not validate_nepal_phone(phone):
        return error_response("Invalid Nepali phone number", 400)

    result = AuthService.send_otp(phone)
    if "error" in result:
        return error_response(result["error"], 429 if "wait" in result.get("error", "").lower() else 400)
    return success_response(result)


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """Verify OTP and return tokens."""
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    otp = data.get("otp")
    if not phone or not otp:
        return error_response("Phone and OTP are required", 400)

    result = AuthService.verify_otp(phone, otp)
    if "error" in result:
        return error_response(result["error"], 401)
    return success_response(result)


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login with email or phone + password."""
    data = request.get_json(silent=True) or {}
    email_or_phone = data.get("email") or data.get("phone")
    password = data.get("password")
    if not email_or_phone or not password:
        return error_response("Email/Phone and password are required", 400)

    result = AuthService.login_with_password(email_or_phone, password)
    if "error" in result:
        return error_response(result["error"], 401)
    return success_response(result)


@auth_bp.route("/student-login", methods=["POST"])
def student_login():
    """Login specifically for students using their student_id."""
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    password = data.get("password")
    if not student_id or not password:
        return error_response("Student ID and password are required", 400)

    result = AuthService.login_student(student_id, password)
    if "error" in result:
        return error_response(result["error"], 401)
    return success_response(result)


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh_token():
    """Refresh access token using refresh token."""
    user_id = get_jwt_identity()
    result = AuthService.refresh_tokens(user_id)
    if "error" in result:
        return error_response(result["error"], 401)
    return success_response(result)


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    """Get current authenticated user profile."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.is_deleted:
        return error_response("User not found", 404)
    return success_response(user.to_dict())


@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_me():
    """Update current user's profile (limited fields)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.is_deleted:
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    allowed = {"full_name", "full_name_nepali", "avatar_url", "preferred_language", "gender", "dob_bs", "address"}
    for key in allowed:
        if key in data:
            setattr(user, key, data[key])

    from extensions import db
    db.session.commit()
    return success_response(user.to_dict())


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Change password (for email+password users)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    if not current_password or not new_password:
        return error_response("Current and new passwords are required", 400)

    if len(new_password) < 8:
        return error_response("Password must be at least 8 characters", 400)

    if not user.check_password(current_password):
        return error_response("Current password is incorrect", 401)

    user.set_password(new_password)

    from extensions import db
    db.session.commit()
    return success_response({"message": "Password changed successfully"})


@auth_bp.route("/register-fcm", methods=["POST"])
@jwt_required()
def register_fcm():
    """Register FCM token for push notifications."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    token = data.get("fcm_token")
    if not token:
        return error_response("FCM token is required", 400)

    tokens = user.fcm_tokens or []
    if token not in tokens:
        tokens.append(token)
        user.fcm_tokens = tokens
        from extensions import db
        db.session.commit()

    return success_response({"message": "FCM token registered"})
