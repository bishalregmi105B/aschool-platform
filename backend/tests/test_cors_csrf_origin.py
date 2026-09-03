"""S-02: the *.base-domain CORS/CSRF origin regex must be anchored.

Unanchored, "https://demo.<base>.attacker.example" matches the pattern
(re.match pins only the start), so an attacker-controlled parent domain
received credentialed CORS headers and CSRF acceptance.
"""
import pytest

ATTACKER_ORIGIN = "https://demo.aschool.com.np.attacker.example"


def _legit_origin(app):
    return f"https://demo.{app.config['BASE_DOMAIN']}"


class TestCorsOriginAnchored:
    def test_preflight_attacker_suffix_origin_gets_no_acao(self, app, client):
        resp = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": ATTACKER_ORIGIN,
                "Access-Control-Request-Method": "POST",
            },
        )
        acao = resp.headers.get("Access-Control-Allow-Origin")
        assert not acao or acao != ATTACKER_ORIGIN

    def test_preflight_attacker_suffix_origin_gets_no_credentials(self, app, client):
        resp = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": ATTACKER_ORIGIN,
                "Access-Control-Request-Method": "POST",
            },
        )
        assert (
            resp.headers.get("Access-Control-Allow-Credentials") != "true"
        ), "attacker origin must not receive credentialed CORS"

    def test_preflight_legit_subdomain_allowed(self, app, client):
        resp = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": _legit_origin(app),
                "Access-Control-Request-Method": "POST",
            },
        )
        assert resp.headers.get("Access-Control-Allow-Origin") == _legit_origin(app)


class TestCsrfOriginAnchored:
    def test_csrf_rejects_attacker_suffix_origin(self, app, client):
        """Cookie-auth mutation with an attacker Origin → CSRF 403."""
        client.set_cookie("access_token", "bogus.cookie.token")
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "x", "new_password": "y"},
            headers={"Origin": ATTACKER_ORIGIN},
        )
        assert resp.status_code == 403
        assert "CSRF" in resp.get_json()["error"]

    def test_csrf_accepts_legit_subdomain_origin(self, app, client):
        """Same regex must still admit real subdomains past the CSRF guard —
        the request then fails endpoint auth (401/422), not CSRF (403)."""
        client.set_cookie("access_token", "bogus.cookie.token")
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "x", "new_password": "y"},
            headers={"Origin": _legit_origin(app)},
        )
        body = resp.get_json() or {}
        assert not (
            resp.status_code == 403 and "CSRF" in body.get("error", "")
        ), f"legit subdomain was CSRF-rejected: {resp.status_code} {body}"
