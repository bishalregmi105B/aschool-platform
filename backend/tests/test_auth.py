"""Tests for authentication endpoints — OTP, login, JWT refresh, profile."""
from unittest.mock import patch

import pytest

from app.models.user import User
from app.services.auth_service import AuthService


class TestSendOTP:
    """POST /api/v1/auth/send-otp"""

    def test_send_otp_success(self, client, admin_user):
        with patch("app.services.auth_service.send_sms") as mock_sms:
            mock_sms.delay = lambda *a: None
            resp = client.post("/api/v1/auth/send-otp", json={
                "phone": admin_user.phone,
            })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "expires_in" in data["data"]

    def test_send_otp_missing_phone(self, client):
        resp = client.post("/api/v1/auth/send-otp", json={})
        assert resp.status_code == 400
        assert resp.get_json()["success"] is False

    def test_send_otp_invalid_phone(self, client):
        resp = client.post("/api/v1/auth/send-otp", json={
            "phone": "1234567890",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "Invalid" in data["error"]


class TestVerifyOTP:
    """POST /api/v1/auth/verify-otp"""

    def test_verify_otp_success(self, client, admin_user, db):
        # Manually set OTP via cache mock
        from extensions import cache
        cache.set(f"otp:{admin_user.phone}", "123456", timeout=600)

        resp = client.post("/api/v1/auth/verify-otp", json={
            "phone": admin_user.phone,
            "otp": "123456",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]
        assert data["data"]["user"]["role"] == "school_admin"

    def test_verify_otp_wrong_code(self, client, admin_user):
        from extensions import cache
        cache.set(f"otp:{admin_user.phone}", "123456", timeout=600)

        resp = client.post("/api/v1/auth/verify-otp", json={
            "phone": admin_user.phone,
            "otp": "999999",
        })
        assert resp.status_code == 401
        assert "Invalid" in resp.get_json()["error"]

    def test_verify_otp_missing_fields(self, client):
        resp = client.post("/api/v1/auth/verify-otp", json={})
        assert resp.status_code == 400


class TestLogin:
    """POST /api/v1/auth/login"""

    def test_login_success(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "email": admin_user.email,
            "password": "Test@1234",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert data["data"]["user"]["full_name"] == "Admin Sharma"

    def test_login_wrong_password(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "email": admin_user.email,
            "password": "WrongPassword",
        })
        assert resp.status_code == 401
        assert "Invalid" in resp.get_json()["error"]

    def test_login_missing_fields(self, client):
        resp = client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 400

    def test_login_nonexistent_email(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "nobody@test.com",
            "password": "whatever",
        })
        assert resp.status_code == 401


class TestGetMe:
    """GET /api/v1/auth/me"""

    def test_get_me_authenticated(self, client, admin_user):
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")

        resp = client.get("/api/v1/auth/me", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["data"]["full_name"] == "Admin Sharma"
        assert data["data"]["role"] == "school_admin"

    def test_get_me_unauthenticated(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401


class TestUpdateMe:
    """PUT /api/v1/auth/me"""

    def test_update_me_success(self, client, admin_user):
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")

        resp = client.put("/api/v1/auth/me", json={
            "full_name": "Updated Name",
            "preferred_language": "en",
        }, headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["data"]["full_name"] == "Updated Name"
        assert data["data"]["preferred_language"] == "en"

    def test_update_me_ignores_disallowed_fields(self, client, admin_user):
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")

        resp = client.put("/api/v1/auth/me", json={
            "role": "superadmin",
            "full_name": "Still Admin",
        }, headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["role"] == "school_admin"  # unchanged


class TestAuthService:
    """Unit tests for AuthService."""

    def test_generate_otp_length(self):
        otp = AuthService.generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()

    def test_create_tokens(self, app, admin_user):
        with app.app_context():
            tokens = AuthService.create_tokens(admin_user)
            assert "access_token" in tokens
            assert "refresh_token" in tokens
