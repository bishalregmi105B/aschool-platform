"""Authentication service — OTP, JWT, token refresh."""
import random
import string
from datetime import datetime, timedelta, timezone

from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token

from app.models.user import User
from extensions import cache, db


class _SendSMSProxy:
    """Lazy task proxy so tests can patch send_sms without importing all tasks."""

    @staticmethod
    def delay(*args, **kwargs):
        from app.tasks.sms_sender import send_sms as task

        return task.delay(*args, **kwargs)


send_sms = _SendSMSProxy()


class AuthService:
    """Handles OTP generation/verification and JWT token creation."""

    OTP_LENGTH = 6
    OTP_EXPIRY_SECONDS = 600  # 10 minutes
    MAX_OTP_ATTEMPTS = 3
    OTP_COOLDOWN_SECONDS = 60

    @staticmethod
    def generate_otp() -> str:
        """Generate a 6-digit OTP."""
        return "".join(random.choices(string.digits, k=AuthService.OTP_LENGTH))

    @staticmethod
    def send_otp(phone: str) -> dict:
        """Generate and send OTP to phone via Sparrow SMS."""
        # Rate limit: check cooldown
        cooldown_key = f"otp_cooldown:{phone}"
        if cache.get(cooldown_key):
            return {"error": "Please wait before requesting another OTP", "retry_after": AuthService.OTP_COOLDOWN_SECONDS}

        # Check attempt limit
        attempt_key = f"otp_attempts:{phone}"
        attempts = cache.get(attempt_key) or 0
        if attempts >= AuthService.MAX_OTP_ATTEMPTS:
            return {"error": "Too many OTP requests. Try again later."}

        otp = AuthService.generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=AuthService.OTP_EXPIRY_SECONDS)

        # Store OTP in user record
        user = User.query.filter_by(phone=phone, is_deleted=False).first()
        if user:
            user.otp_code = otp
            user.otp_expires_at = expires_at
            db.session.commit()

        # Also store in cache for verification (works even if user doesn't exist yet)
        cache.set(f"otp:{phone}", otp, timeout=AuthService.OTP_EXPIRY_SECONDS)
        cache.set(cooldown_key, True, timeout=AuthService.OTP_COOLDOWN_SECONDS)
        cache.set(attempt_key, attempts + 1, timeout=900)

        # Send SMS (async)
        msg = f"Your ASchool verification code is: {otp}. Valid for 10 minutes."
        send_sms.delay(phone, msg)

        result = {"message": "OTP sent successfully", "expires_in": AuthService.OTP_EXPIRY_SECONDS}
        # In console/dev mode, log OTP securely instead of exposing in response
        if current_app.config.get("SMS_CONSOLE_MODE") or current_app.config.get("DEBUG"):
            current_app.logger.debug("DEV OTP for %s: %s", phone, otp)
        return result

    @staticmethod
    def verify_otp(phone: str, otp: str) -> dict:
        """Verify OTP and return JWT tokens if valid."""
        # Check from cache first
        stored_otp = cache.get(f"otp:{phone}")
        if not stored_otp:
            # Fallback to DB
            user = User.query.filter_by(phone=phone, is_deleted=False).first()
            if user and user.otp_code and user.otp_expires_at:
                if user.otp_expires_at > datetime.now(timezone.utc):
                    stored_otp = user.otp_code

        if not stored_otp or stored_otp != otp:
            return {"error": "Invalid or expired OTP"}

        # Clear OTP
        cache.delete(f"otp:{phone}")
        cache.delete(f"otp_attempts:{phone}")

        user = User.query.filter_by(phone=phone, is_deleted=False).first()
        if not user:
            return {"error": "User not found. Contact your school admin."}

        if not user.is_active:
            return {"error": "Account is deactivated"}

        # Mark phone as verified
        user.phone_verified = True
        user.last_login_at = datetime.now(timezone.utc)
        user.otp_code = None
        user.otp_expires_at = None
        db.session.commit()

        # Generate tokens
        tokens = AuthService.create_tokens(user)
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "user": user.to_dict(),
        }

    # Brute-force lockout settings
    _MAX_FAILED_LOGINS = 5          # attempts before lock
    _LOCKOUT_DURATION_MINUTES = 15  # how long to lock

    @staticmethod
    def _check_lockout(user: User) -> str | None:
        """Return an error string if the user is currently locked, else None."""
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            return f"Account locked due to too many failed login attempts. Try again in {remaining} minute(s)."
        return None

    @staticmethod
    def _record_failed_login(user: User) -> None:
        """Increment failed_login_count; lock account when threshold reached."""
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= AuthService._MAX_FAILED_LOGINS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(
                minutes=AuthService._LOCKOUT_DURATION_MINUTES
            )
        db.session.commit()

    @staticmethod
    def _clear_failed_logins(user: User) -> None:
        """Reset lockout state after a successful login."""
        user.failed_login_count = 0
        user.locked_until = None

    @staticmethod
    def login_with_password(email_or_phone: str, password: str) -> dict:
        """Login with email or phone + password (for staff / admin / parents)."""
        user = User.query.filter(
            ((User.email == email_or_phone) | (User.phone == email_or_phone)),
            User.is_deleted == False
        ).first()

        if not user:
            return {"error": "Invalid credentials"}

        lockout_msg = AuthService._check_lockout(user)
        if lockout_msg:
            return {"error": lockout_msg}

        if not user.check_password(password):
            AuthService._record_failed_login(user)
            return {"error": "Invalid credentials"}

        if not user.is_active:
            return {"error": "Account is deactivated"}

        AuthService._clear_failed_logins(user)
        user.last_login_at = datetime.now(timezone.utc)
        db.session.commit()

        tokens = AuthService.create_tokens(user)
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "user": user.to_dict(),
        }

    @staticmethod
    def login_student(student_id: str, password: str) -> dict:
        """Login specifically for students using their student ID."""
        from app.models.student import Student
        student = Student.query.filter_by(student_id=student_id, is_deleted=False).first()
        if not student or not student.user_id:
            return {"error": "Invalid student ID or account not set up"}

        user = User.query.get(student.user_id)
        if not user:
            return {"error": "Invalid student ID or password"}

        lockout_msg = AuthService._check_lockout(user)
        if lockout_msg:
            return {"error": lockout_msg}

        if not user.check_password(password):
            AuthService._record_failed_login(user)
            return {"error": "Invalid student ID or password"}

        if not user.is_active:
            return {"error": "Account is deactivated"}

        AuthService._clear_failed_logins(user)
        user.last_login_at = datetime.now(timezone.utc)
        db.session.commit()

        tokens = AuthService.create_tokens(user)
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "user": user.to_dict(),
            "student_profile": student.to_dict(),
        }

    @staticmethod
    def create_tokens(user: User) -> dict:
        """Create access + refresh JWT tokens with user claims."""
        additional_claims = {
            "role": user.role,
            "school_id": str(user.school_id) if user.school_id else None,
            "full_name": user.full_name,
        }
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims,
        )
        refresh_token = create_refresh_token(
            identity=str(user.id),
            additional_claims=additional_claims,
        )
        return {"access_token": access_token, "refresh_token": refresh_token}

    @staticmethod
    def refresh_tokens(user_id: str, current_refresh_jti: str | None = None) -> dict:
        """Refresh tokens for an existing user.

        Rotation: the refresh token that was just used is revoked (its jti is
        blocklisted until its natural expiry) so a stolen/leaked refresh token
        cannot be replayed after rotation.
        """
        user = User.query.get(user_id)
        if not user or not user.is_active or user.is_deleted:
            return {"error": "Invalid user"}

        if current_refresh_jti:
            from datetime import datetime, timedelta, timezone

            from app.models.revoked_token import RevokedToken

            refresh_expires = current_app.config.get("JWT_REFRESH_TOKEN_EXPIRES", 2592000)
            if isinstance(refresh_expires, timedelta):
                expires_at = datetime.now(timezone.utc) + refresh_expires
            else:
                expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=int(refresh_expires)
                )
            RevokedToken.revoke(
                jti=current_refresh_jti, token_type="refresh", expires_at=expires_at
            )

        return AuthService.create_tokens(user)
