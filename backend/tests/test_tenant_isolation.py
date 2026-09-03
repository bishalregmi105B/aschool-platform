"""S-01: Tenant isolation on X-School-Slug / subdomain school resolution.

Subdomains and the X-School-Slug header are untrusted request data. A valid
school-A token paired with school-B resolution must be rejected with 403
before any endpoint logic runs — for the header path, the subdomain path,
and the JWT-claim fallback alike.
"""
import pytest

from tests.conftest import get_auth_headers

CROSS_TENANT_MSG = "does not belong to this school"


class TestTenantIsolation:
    def test_school_a_token_with_school_b_header_is_403(
        self, client, school, admin_user, school_b
    ):
        """token(A) + X-School-Slug: school-b → 403 on school-scoped reads."""
        token = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        resp = client.get(
            "/api/v1/students",
            headers={**token, "X-School-Slug": "school-b"},
        )
        assert resp.status_code == 403
        assert CROSS_TENANT_MSG in resp.get_json()["error"]

    def test_cross_tenant_403_fires_before_plugin_gates(
        self, client, school, admin_user, school_b
    ):
        """The 403 must come from tenant isolation, not endpoint/plugin auth —
        probe the fees and exams surfaces too."""
        token = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        for path in ("/api/v1/fees/summary", "/api/v1/exams"):
            resp = client.get(
                path, headers={**token, "X-School-Slug": "school-b"}
            )
            assert resp.status_code == 403, path
            assert CROSS_TENANT_MSG in resp.get_json()["error"], path

    def test_cross_tenant_subdomain_is_403(
        self, app, client, school, admin_user, school_b
    ):
        """token(A) + Host: school-b.<base> → 403 (subdomain path)."""
        token = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        host = f"school-b.{app.config['BASE_DOMAIN']}"
        resp = client.get("/api/v1/students", headers={**token, "Host": host})
        assert resp.status_code == 403
        assert CROSS_TENANT_MSG in resp.get_json()["error"]

    def test_same_school_header_is_allowed(
        self, client, school, admin_user
    ):
        """token(A) + X-School-Slug: test-academy → 200 (normal mobile flow)."""
        token = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        resp = client.get(
            "/api/v1/students",
            headers={**token, "X-School-Slug": school.slug},
        )
        assert resp.status_code == 200

    def test_jwt_claim_fallback_still_works(self, client, school_b, admin_b_user):
        """token(B) with no header → JWT-claim fallback resolves school B → 200."""
        token = get_auth_headers(client, "admin@schoolb.edu.np", "Test@1234")
        resp = client.get("/api/v1/students", headers=token)
        assert resp.status_code == 200

    def test_superadmin_can_access_any_school(
        self, client, school, superadmin_user, school_b
    ):
        token = get_auth_headers(client, "super@aschool.com.np", "SuperSecret@1")
        resp = client.get(
            "/api/v1/students",
            headers={**token, "X-School-Slug": "school-b"},
        )
        assert resp.status_code == 200

    def test_unauthenticated_with_header_is_not_tenant_403(
        self, client, school, school_b
    ):
        """No token + header → tenant guard passes through; endpoint auth 401s."""
        resp = client.get(
            "/api/v1/students", headers={"X-School-Slug": "school-b"}
        )
        assert resp.status_code == 401
