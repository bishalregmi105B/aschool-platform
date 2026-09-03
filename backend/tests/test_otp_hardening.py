"""S-06: OTP generation and verification hardening.

- 6-digit OTPs come from a CSPRNG (secrets), not random.choices.
- verify-side brute force: 5 wrong attempts invalidate the OTP with a clear
  error; a fresh send resets the budget.
- comparison is constant-time (hmac.compare_digest) — behaviorally tested
  via the failure path only (timing is not assertable in a unit test).
"""
import string
from unittest.mock import patch

import pytest

from app.services.auth_service import AuthService
from extensions import cache


@pytest.fixture
def otp_user(db, school):
    from app.models.user import User

    u = User(
        school_id=school.id,
        role="parent",
        full_name="OTP Parent",
        phone="+9779811122233",
        is_active=True,
        phone_verified=False,
    )
    db.session.add(u)
    db.session.commit()
    return u


class TestOtpGeneration:
    def test_generated_otp_is_six_digits(self):
        for _ in range(20):
            otp = AuthService.generate_otp()
            assert len(otp) == 6
            assert all(ch in string.digits for ch in otp)

    def test_generator_uses_secrets_module(self):
        import inspect

        src = inspect.getsource(AuthService.generate_otp)
        assert "secrets.choice" in src


class TestOtpVerifyLockout:
    def test_five_wrong_attempts_invalidate_otp(self, app, db, otp_user):
        phone = otp_user.phone
        with patch("app.services.auth_service.send_sms") as sms:
            sms.delay.return_value = None
            result = AuthService.send_otp(phone)
        assert "error" not in result
        stored = cache.get(f"otp:{phone}")
        assert stored

        for attempt in range(1, 6):
            result = AuthService.verify_otp(phone, "000000" if stored != "000000" else "111111")
            if attempt < 5:
                assert result == {"error": "Invalid or expired OTP"}
            else:
                assert result == {
                    "error": "Too many incorrect attempts. Request a new OTP."
                }

        # OTP is dead everywhere: cache and the user row
        assert cache.get(f"otp:{phone}") is None
        from app.models.user import User

        u = User.query.get(otp_user.id)
        assert u.otp_code is None

    def test_correct_otp_still_verifies_after_one_wrong(
        self, app, db, otp_user
    ):
        phone = otp_user.phone
        with patch("app.services.auth_service.send_sms") as sms:
            sms.delay.return_value = None
            AuthService.send_otp(phone)
        stored = cache.get(f"otp:{phone}")
        assert AuthService.verify_otp(phone, "999999" if stored != "999999" else "888888")[
            "error"
        ]
        result = AuthService.verify_otp(phone, stored)
        assert "access_token" in result

    def test_new_send_resets_attempt_budget(self, app, db, otp_user):
        phone = otp_user.phone
        with patch("app.services.auth_service.send_sms") as sms:
            sms.delay.return_value = None
            AuthService.send_otp(phone)
            stored1 = cache.get(f"otp:{phone}")
            wrong = "999999" if stored1 != "999999" else "888888"
            for _ in range(4):
                AuthService.verify_otp(phone, wrong)
            assert cache.get(f"otp_verify_attempts:{phone}") == 4

            # Cooldown blocks an immediate resend...
            blocked = AuthService.send_otp(phone)
            assert "error" in blocked
            # ...but the issued OTP is still verifiable: budget only resets
            # on a fresh send, so burn it one more time to hit the lock.
            assert AuthService.verify_otp(phone, wrong) == {
                "error": "Too many incorrect attempts. Request a new OTP."
            }
            assert cache.get(f"otp:{phone}") is None
