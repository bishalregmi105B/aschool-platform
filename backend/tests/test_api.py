"""Tests for core API endpoints — health, schools, users, error handling."""
import pytest


class TestHealthCheck:
    """GET /health"""

    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "ok"


class TestErrorHandlers:
    """Test custom error responses follow standard format."""

    def test_404_returns_json(self, client):
        resp = client.get("/api/v1/nonexistent-route")
        assert resp.status_code == 404
        data = resp.get_json()
        assert data["success"] is False
        assert data["error"] is not None

    def test_401_on_protected_route(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401


class TestResponseFormat:
    """All API responses must follow { success, data, error, meta } format."""

    def test_success_response_format(self, client, admin_user):
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")
        resp = client.get("/api/v1/auth/me", headers=headers)
        data = resp.get_json()
        assert "success" in data
        assert "data" in data
        assert "error" in data

    def test_error_response_format(self, client):
        resp = client.post("/api/v1/auth/login", json={})
        data = resp.get_json()
        assert data["success"] is False
        assert data["error"] is not None


class TestRoleDecorators:
    """Test role-based access control via decorators."""

    def test_school_admin_can_login(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "email": admin_user.email,
            "password": "Test@1234",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["data"]["user"]["role"] == "school_admin"

    def test_superadmin_can_login(self, client, superadmin_user):
        resp = client.post("/api/v1/auth/login", json={
            "email": superadmin_user.email,
            "password": "SuperSecret@1",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["data"]["user"]["role"] == "superadmin"


class TestInputValidation:
    """Test input validation across endpoints."""

    def test_send_otp_rejects_non_nepali_phone(self, client):
        resp = client.post("/api/v1/auth/send-otp", json={
            "phone": "+1234567890",
        })
        assert resp.status_code == 400

    def test_login_rejects_empty_body(self, client):
        resp = client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 400

    def test_verify_otp_rejects_empty_body(self, client):
        resp = client.post("/api/v1/auth/verify-otp", json={})
        assert resp.status_code == 400

    def test_update_profile_requires_auth(self, client):
        resp = client.put("/api/v1/auth/me", json={"full_name": "Hacker"})
        assert resp.status_code == 401
