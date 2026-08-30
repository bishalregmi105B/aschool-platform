"""Password recovery (E96/E164) + slice-1 regression tests (E160, E163).

Runtime-verified flow:
  POST /auth/forgot-password → time-limited single-use token (stored hashed)
  POST /auth/reset-password  → verify, single-use, invalidate sessions
Delivery is honest: "sent" only when EmailService actually succeeded,
"unavailable" when SMTP is down (token logged server-side), "skipped" when
the email matches no active account.
"""
import re
from unittest.mock import patch

import pytest


@pytest.fixture
def reset_target(db, school):
    """An active user with an email, for the reset flow."""
    from app.models.user import User

    u = User(
        school_id=school.id,
        role="staff",
        full_name="Recoverable Rita",
        phone="+9779841000042",
        email="rita@test.edu.np",
        is_active=True,
    )
    u.set_password("OldPass123")
    db.session.add(u)
    db.session.commit()
    # The cooldown lives in the shared redis (survives DB truncation between
    # tests) — clear any stale markers for this email.
    from extensions import redis_client

    if redis_client is not None:
        for k in redis_client.keys("pwreset_cooldown:rita@test.edu.np"):
            redis_client.delete(k)
        for k in redis_client.keys("pwreset:*"):
            if "cooldown" not in k:
                redis_client.delete(k)
    return u


def _extract_token(html: str) -> str:
    m = re.search(r"token=([A-Za-z0-9_-]+)", html)
    assert m, "reset link with token not found in email body"
    return m.group(1)


class TestForgotPassword:
    def test_missing_email(self, client):
        resp = client.post("/api/v1/auth/forgot-password", json={})
        assert resp.status_code == 400

    def test_invalid_email(self, client):
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "notanemail"})
        assert resp.status_code == 400

    def test_unknown_email_is_skipped_not_faked(self, client):
        resp = client.post(
            "/api/v1/auth/forgot-password", json={"email": "ghost@nowhere.test"}
        )
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["delivery"] == "skipped"

    def test_delivers_link_when_smtp_works(self, client, reset_target):
        captured = {}

        def fake_send(to, subject, html_body, text_body=None):
            captured["html"] = html_body
            return True

        with patch(
            "app.services.communications.email_service.EmailService.send_email",
            fake_send,
        ):
            resp = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["delivery"] == "sent"
        assert "reset-password?token=" in captured["html"]

    def test_smtp_down_reports_unavailable_and_still_mints_token(
        self, client, reset_target
    ):
        from extensions import redis_client

        with patch(
            "app.services.communications.email_service.EmailService.send_email",
            lambda to, subject, html_body, text_body=None: False,
        ):
            resp = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["delivery"] == "unavailable"

        if redis_client is not None:
            keys = [
                k
                for k in redis_client.keys("pwreset:*")
                if "cooldown" not in k
            ]
            assert keys, "token should be stored while delivery is unavailable"

    def test_cooldown(self, client, reset_target):
        from extensions import redis_client

        with patch(
            "app.services.communications.email_service.EmailService.send_email",
            lambda to, subject, html_body, text_body=None: False,
        ):
            first = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
            assert first.status_code == 200
            second = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
        # The cooldown lives in redis when available; a test redis is expected.
        if redis_client is not None:
            assert second.status_code == 429


class TestResetPassword:
    def test_missing_fields(self, client):
        assert client.post("/api/v1/auth/reset-password", json={}).status_code == 400

    def test_weak_password(self, client):
        assert client.post(
            "/api/v1/auth/reset-password",
            json={"token": "x", "new_password": "weak"},
        ).status_code == 400

    def test_invalid_token(self, client):
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "definitely-not-a-real-token", "new_password": "NewPass123"},
        )
        assert resp.status_code == 400

    def test_full_flow_single_use_and_session_invalidation(self, client, reset_target):
        from extensions import redis_client

        with patch(
            "app.services.communications.email_service.EmailService.send_email",
            lambda to, subject, html_body, text_body=None: True,
        ):
            resp = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
        assert resp.status_code == 200
        assert resp.get_json()["data"]["delivery"] == "sent"

        # Old password still works pre-reset.
        old_login = client.post(
            "/api/v1/auth/login",
            json={"email": reset_target.email, "password": "OldPass123"},
        )
        assert old_login.status_code == 200
        old_token = old_login.get_json()["data"]["access_token"]
        assert (
            client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {old_token}"},
            ).status_code
            == 200
        )

        # Retrieve the raw token: only its hash is stored, so re-mint and
        # capture via the fake SMTP body (most honest path).
        # NOTE: use a fresh cookie-less client — the login above set auth
        # cookies on `client`, and the CSRF cookie-guard rejects
        # cookie-authenticated state-changing requests (403).
        captured = {}

        def fake_send(to, subject, html_body, text_body=None):
            captured["html"] = html_body
            return True

        with patch(
            "app.services.communications.email_service.EmailService.send_email",
            fake_send,
        ):
            from app import create_app as _create_app

            fresh = _create_app().test_client()
            resp = fresh.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
        assert resp.status_code == 200
        token = _extract_token(captured["html"])

        # Weak password rejected (token NOT consumed — validated before store).
        weak = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "weak"},
        )
        assert weak.status_code == 400

        reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "NewPass123"},
        )
        assert reset.status_code == 200

        # Single use.
        replay = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "OtherPass1"},
        )
        assert replay.status_code == 400

        # Old password dead.
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": reset_target.email, "password": "OldPass123"},
            ).status_code
            == 401
        )
        # Pre-reset session invalidated.
        assert (
            client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {old_token}"},
            ).status_code
            == 401
        )
        # New password works.
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": reset_target.email, "password": "NewPass123"},
            ).status_code
            == 200
        )

    def test_token_survives_plugin_cache_sweeps(self, client, reset_target):
        """Regression: tokens live in the dedicated redis namespace, NOT in
        flask-caching (whose keys were observed being swept by unrelated
        batch DELs during the E96 runtime verification)."""
        from extensions import redis_client

        captured = {}

        def fake_send(to, subject, html_body, text_body=None):
            captured["html"] = html_body
            return True

        with patch(
            "app.services.communications.email_service.EmailService.send_email",
            fake_send,
        ):
            resp = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": reset_target.email},
            )
        assert resp.status_code == 200
        token = _extract_token(captured["html"])
        token_hash = __import__("hashlib").sha256(token.encode()).hexdigest()

        if redis_client is not None:
            # It must NOT be under the flask-caching namespace.
            assert redis_client.get(f"flask_cache_pwreset:{token_hash}") is None
            assert redis_client.get(f"pwreset:{token_hash}") is not None


class TestUserRoleEscalationGuard:
    """E160: PUT /users/<id> used to mass-assign role — including 'superadmin'."""

    def test_cannot_set_role_to_superadmin(self, client, admin_user):
        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_user.email, "password": "Test@1234"},
        )
        token = login.get_json()["data"]["access_token"]
        resp = client.put(
            f"/api/v1/users/{admin_user.id}",
            json={"role": "superadmin"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_cannot_set_arbitrary_role(self, client, admin_user, school):
        from app.models.user import User

        u = User(
            school_id=school.id,
            role="staff",
            full_name="Victim V",
            phone="+9779841000043",
            is_active=True,
        )
        u.set_password("Test@1234")
        from extensions import db as _db

        _db.session.add(u)
        _db.session.commit()

        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_user.email, "password": "Test@1234"},
        )
        token = login.get_json()["data"]["access_token"]
        resp = client.put(
            f"/api/v1/users/{u.id}",
            json={"role": "wizard"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_noop_role_update_still_works(self, client, admin_user):
        """The teachers edit dialog sends role: 'teacher' as a no-op — must
        not 400."""
        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_user.email, "password": "Test@1234"},
        )
        token = login.get_json()["data"]["access_token"]
        resp = client.put(
            f"/api/v1/users/{admin_user.id}",
            json={"role": "school_admin", "full_name": "Admin Sharma Renamed"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200


class TestBatchRollNumbersValidation:
    """E163: non-numeric roll numbers used to 500."""

    def test_non_numeric_roll_rejected(self, client, admin_user, school):
        from app.models.student import Student
        from extensions import db as _db

        student = Student(
            school_id=school.id,
            first_name="Roll",
            last_name="Probe",
        )
        _db.session.add(student)
        _db.session.commit()

        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_user.email, "password": "Test@1234"},
        )
        token = login.get_json()["data"]["access_token"]
        resp = client.post(
            "/api/v1/students/batch-roll-numbers",
            json={"updates": [{"student_id": str(student.id), "roll_number": "abc"}]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
