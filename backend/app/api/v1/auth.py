"""Auth API routes — OTP, login, token refresh, me."""
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.services.auth_service import AuthService
from app.models.user import User
from app.utils.response import error_response, success_response
from app.utils.validators import validate_password_strength

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
ACCESS_COOKIE_MAX_AGE = 3600  # keep in sync with JWT_ACCESS_TOKEN_EXPIRES
REFRESH_COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 days


def _cookie_params():
    """Cookie attributes: HttpOnly always; Secure + Domain configurable.

    COOKIE_DOMAIN (e.g. ".aschool.com.np") makes the session visible to the
    app. subdomain middleware; unset -> host-only cookie (dev/single host).
    COOKIE_SECURE forces the Secure attribute; "auto" (default) enables it
    only outside development/testing so the Flask test client still works.
    """
    secure_setting = str(current_app.config.get("COOKIE_SECURE", "auto")).lower()
    if secure_setting == "auto":
        secure = current_app.config.get("FLASK_ENV") == "production"
    else:
        secure = secure_setting in ("1", "true", "yes")
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "Lax",
        "domain": current_app.config.get("COOKIE_DOMAIN") or None,
        "path": "/",
    }


def _tokens_response(result, status_code=200):
    """Build the standard success response and mirror tokens into HttpOnly cookies."""
    resp = jsonify({"success": True, "data": result, "error": None, "meta": {}})
    resp.status_code = status_code
    access = result.get("access_token")
    refresh = result.get("refresh_token")
    params = _cookie_params()
    if access:
        resp.set_cookie(ACCESS_COOKIE, access, max_age=ACCESS_COOKIE_MAX_AGE, **params)
    if refresh:
        resp.set_cookie(REFRESH_COOKIE, refresh, max_age=REFRESH_COOKIE_MAX_AGE, **params)
    return resp


def _clear_auth_cookies(resp):
    params = _cookie_params()
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        resp.set_cookie(name, "", max_age=0, expires=0, **params)
    return resp


def _refresh_token_from_cookie():
    """Allow browser clients to refresh via HttpOnly cookie (no JS-readable token)."""

    def wrapper(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            if not request.headers.get("Authorization"):
                token = request.cookies.get(REFRESH_COOKIE)
                if token:
                    request.environ["HTTP_AUTHORIZATION"] = f"Bearer {token}"
            return fn(*args, **kwargs)

        return inner

    return wrapper


@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    """Send OTP to phone number."""
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    if not phone:
        return error_response("Phone number is required", 400)

    from app.utils.validators import validate_nepal_phone, validate_password_strength
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
    return _tokens_response(result)


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
    return _tokens_response(result)


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
    return _tokens_response(result)


@auth_bp.route("/refresh", methods=["POST"])
@_refresh_token_from_cookie()
@jwt_required(refresh=True)
def refresh_token():
    """Refresh access token using refresh token (Bearer header or HttpOnly cookie)."""
    user_id = get_jwt_identity()
    used_refresh_jti = get_jwt().get("jti")
    result = AuthService.refresh_tokens(user_id, current_refresh_jti=used_refresh_jti)
    if "error" in result:
        return error_response(result["error"], 401)
    return _tokens_response(result)


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

    ok, pw_error = validate_password_strength(new_password)
    if not ok:
        return error_response(pw_error, 400)

    if not user.check_password(current_password):
        return error_response("Current password is incorrect", 401)

    user.set_password(new_password)

    from extensions import db
    db.session.commit()
    return success_response({"message": "Password changed successfully"})


@auth_bp.route("/register", methods=["POST"])
def register_school():
    """Public school self-registration — creates school + admin user, then sends OTP."""
    import re
    from extensions import db
    from app.models.school import School
    from app.utils.validators import validate_nepal_phone, validate_password_strength

    data = request.get_json(silent=True) or {}

    # ── Required fields ──────────────────────────────────────────────────────
    required = ["school_name", "full_name", "phone", "password"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", 400)

    phone = data["phone"].strip()
    if not validate_nepal_phone(phone):
        return error_response("Invalid Nepali phone number", 400)

    # ── Duplicate checks ──────────────────────────────────────────────────────
    if User.query.filter_by(phone=phone, is_deleted=False).first():
        return error_response("An account with this phone number already exists", 409)

    email = (data.get("email") or "").strip() or None
    if email and User.query.filter_by(email=email, is_deleted=False).first():
        return error_response("An account with this email already exists", 409)

    # ── Generate unique slug from school name ─────────────────────────────────
    base_slug = re.sub(r"[^a-z0-9]+", "-", data["school_name"].lower()).strip("-")[:60]
    slug = base_slug
    counter = 1
    while School.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # ── Plan mapping (frontend "pro" → DB "growth") ───────────────────────────
    plan_map = {"free": "free", "starter": "starter", "pro": "growth", "growth": "growth", "enterprise": "enterprise"}
    plan = plan_map.get(data.get("plan", "free"), "free")

    # ── Create School ─────────────────────────────────────────────────────────
    school = School(
        name=data["school_name"].strip(),
        slug=slug,
        district=(data.get("district") or "").strip() or None,
        municipality=(data.get("municipality") or "").strip() or None,
        plan=plan,
        status="trial",
    )
    # Optional fields
    if data.get("type") in ("public", "private", "community", "boarding", "international", "technical", "college"):
        school.type = data["type"]
    if data.get("level") in ("primary", "lower_secondary", "secondary", "higher_secondary"):
        school.level = data["level"]
    if email:
        school.email = email

    db.session.add(school)
    db.session.flush()  # get school.id before creating user

    # ── Create school admin user ──────────────────────────────────────────────
    user = User(
        school_id=school.id,
        role="school_admin",
        full_name=data["full_name"].strip(),
        phone=phone,
        email=email,
        is_active=True,
    )
    ok, pw_error = validate_password_strength(data["password"])
    if not ok:
        return error_response(pw_error, 400)

    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()  # get user.id

    # Link owner
    school.owner_id = user.id

    db.session.commit()

    # ── Auto-install core plugins ─────────────────────────────────────────────
    try:
        from app.plugins.billing import install_plugin
        for plugin_slug in ["attendance", "notices", "academics", "basic_reports", "basic_website"]:
            install_plugin(str(school.id), plugin_slug)
    except Exception:
        pass  # Non-fatal — plugins can be installed later

    # ── Send OTP for phone verification ──────────────────────────────────────
    otp_result = AuthService.send_otp(phone)

    payload = {
        "message": "School registered successfully. Please verify your phone.",
        "school": {"id": str(school.id), "name": school.name, "slug": school.slug, "plan": school.plan},
        "otp_sent": "error" not in otp_result,
    }
    # Log OTP only to server-side debug log; never expose it in API responses
    if otp_result.get("otp"):
        from flask import current_app
        current_app.logger.debug("DEV OTP for %s: %s", phone, otp_result["otp"])

    return success_response(payload, status_code=201)


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Revoke the current access token (mobile logout / session invalidation)."""
    claims = get_jwt()
    jti = claims.get("jti")
    if jti:
        from app.models.revoked_token import RevokedToken
        from datetime import timedelta
        from flask import current_app
        delta = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES", timedelta(hours=1))
        from datetime import datetime, timezone
        expires_at = datetime.now(timezone.utc) + delta
        RevokedToken.revoke(jti=jti, token_type="access", expires_at=expires_at)
    resp = jsonify({"success": True, "data": {"message": "Logged out successfully"}, "error": None, "meta": {}})
    return _clear_auth_cookies(resp)


@auth_bp.route("/logout-all", methods=["POST"])
@jwt_required()
def logout_all_sessions():
    """Revoke all active tokens for the current user by rotating their JWT secret seed.

    Works by storing a per-user 'invalidate_before' timestamp. All tokens
    issued before this timestamp are rejected.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    from datetime import datetime, timezone
    from extensions import db
    user.last_password_change = datetime.now(timezone.utc)
    db.session.commit()

    # Also revoke the current token
    claims = get_jwt()
    jti = claims.get("jti")
    if jti:
        from app.models.revoked_token import RevokedToken
        from datetime import timedelta
        from flask import current_app
        delta = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES", timedelta(hours=1))
        RevokedToken.revoke(jti=jti, token_type="access", expires_at=datetime.now(timezone.utc) + delta)

    return success_response({"message": "All sessions revoked"})


@auth_bp.route("/totp/setup", methods=["POST"])
@jwt_required()
def totp_setup():
    """Generate a TOTP secret and provisioning URI for authenticator app setup.

    Returns:
        secret: base32 TOTP secret (store securely, show once)
        uri: otpauth:// URI to encode as QR code
        qr_data_url: base64 PNG QR code (optional, requires qrcode lib)
    """
    try:
        import pyotp
    except ImportError:
        return error_response("TOTP support not installed (pip install pyotp)", 503)

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    secret = pyotp.random_base32()
    issuer = "ASchool"
    label = user.email or user.phone or str(user.id)
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)

    # Temporarily store secret (pending confirmation) — never activate until verified
    from extensions import cache
    cache.set(f"totp_pending:{user_id}", secret, timeout=600)

    payload = {"secret": secret, "uri": uri}

    # Optionally include QR code PNG as data URL
    try:
        import qrcode, io, base64
        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        payload["qr_data_url"] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        pass  # qrcode not installed — client generates QR from uri

    return success_response(payload)


@auth_bp.route("/totp/verify", methods=["POST"])
@jwt_required()
def totp_verify():
    """Verify a TOTP code and activate MFA for the user.

    Body:
        code (str): 6-digit TOTP code from authenticator app
    """
    try:
        import pyotp
    except ImportError:
        return error_response("TOTP support not installed", 503)

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip()
    if not code:
        return error_response("TOTP code is required", 400)

    from extensions import cache, db
    pending_secret = cache.get(f"totp_pending:{user_id}")
    if not pending_secret:
        return error_response("No pending TOTP setup found. Call /totp/setup first.", 400)

    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(code, valid_window=1):
        return error_response("Invalid or expired TOTP code", 401)

    # Activate MFA — store secret in user settings
    settings = user.permissions or {}
    settings["totp_secret"] = pending_secret
    settings["mfa_enabled"] = True
    user.permissions = settings
    db.session.commit()
    cache.delete(f"totp_pending:{user_id}")

    return success_response({"message": "MFA enabled successfully", "mfa_enabled": True})


@auth_bp.route("/totp/disable", methods=["POST"])
@jwt_required()
def totp_disable():
    """Disable TOTP MFA. Requires current password confirmation.

    Body:
        password (str): Current password
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    if not user.check_password(password):
        return error_response("Incorrect password", 401)

    from extensions import db
    settings = user.permissions or {}
    settings.pop("totp_secret", None)
    settings["mfa_enabled"] = False
    user.permissions = settings
    db.session.commit()

    return success_response({"message": "MFA disabled", "mfa_enabled": False})


@auth_bp.route("/totp/challenge", methods=["POST"])
def totp_challenge():
    """Validate a TOTP code during login (step-2 of MFA flow).

    Body:
        mfa_token (str): Temporary token returned by /login when MFA is required
        code (str): 6-digit TOTP code
    """
    try:
        import pyotp
    except ImportError:
        return error_response("TOTP support not installed", 503)

    data = request.get_json(silent=True) or {}
    mfa_token = data.get("mfa_token", "").strip()
    code = str(data.get("code", "")).strip()
    if not mfa_token or not code:
        return error_response("mfa_token and code are required", 400)

    from extensions import cache
    user_id = cache.get(f"mfa_pending:{mfa_token}")
    if not user_id:
        return error_response("MFA token expired or invalid", 401)

    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    totp_secret = (user.permissions or {}).get("totp_secret")
    if not totp_secret:
        return error_response("MFA not configured for this account", 400)

    totp = pyotp.TOTP(totp_secret)
    if not totp.verify(code, valid_window=1):
        return error_response("Invalid or expired TOTP code", 401)

    cache.delete(f"mfa_pending:{mfa_token}")

    from app.services.auth_service import AuthService
    tokens = AuthService.create_tokens(user)
    return _tokens_response({
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": user.to_dict(),
    })



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


@auth_bp.route("/register-onesignal", methods=["POST"])
@jwt_required()
def register_onesignal():
    """Register OneSignal player ID and associate device with school + role.

    Called after login on the Flutter app to link the device with the user's
    school and role for targeted push notifications.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id") or data.get("onesignal_player_id")
    if not player_id:
        return error_response("player_id is required", 400)

    # Store player ID on user
    player_ids = user.onesignal_player_ids or []
    if player_id not in player_ids:
        player_ids.append(player_id)
        # Keep max 5 devices per user
        if len(player_ids) > 5:
            player_ids = player_ids[-5:]
        user.onesignal_player_ids = player_ids

        from extensions import db
        db.session.commit()

    # Register tags with OneSignal for school-scoped targeting
    if user.school_id:
        try:
            from app.services.communications.onesignal_service import OneSignalService

            OneSignalService.register_player_tags(
                player_id=player_id,
                tags={
                    "school_id": str(user.school_id),
                    "role": user.role or "user",
                    "user_id": str(user.id),
                },
            )
        except Exception:
            pass  # Non-fatal — tags can be set later

    return success_response({"message": "OneSignal player registered"})
