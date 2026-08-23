"""Tests for the HttpOnly-cookie web session flow on /auth/*."""
from app.models.user import User
from tests.conftest import get_auth_headers


def _make_admin(client, db, school):
    u = User(
        school_id=school.id,
        role="school_admin",
        full_name="Cookie Admin",
        email="cookie.admin@test.edu.np",
        phone="+9779841000041",
        is_active=True,
        phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()
    return u


def test_login_sets_httponly_cookies(client, db, school):
    _make_admin(client, db, school)
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "cookie.admin@test.edu.np", "password": "Test@1234"},
    )
    assert resp.status_code == 200

    set_cookies = "; ".join(resp.headers.getlist("Set-Cookie"))
    assert "access_token=" in set_cookies
    assert "refresh_token=" in set_cookies
    # Tokens must never be readable by JavaScript.
    for cookie in resp.headers.getlist("Set-Cookie"):
        if cookie.startswith(("access_token=", "refresh_token=")):
            assert "HttpOnly" in cookie


def test_refresh_works_via_cookie_without_authorization_header(client, db, school):
    _make_admin(client, db, school)
    client.post(
        "/api/v1/auth/login",
        json={"email": "cookie.admin@test.edu.np", "password": "Test@1234"},
    )

    # No Authorization header — the refresh token must come from the cookie jar.
    resp = client.post("/api/v1/auth/refresh")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["access_token"]


def test_logout_clears_auth_cookies(client, db, school):
    _make_admin(client, db, school)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "cookie.admin@test.edu.np", "password": "Test@1234"},
    )
    headers = {"Authorization": f"Bearer {login.get_json()['data']['access_token']}"}

    resp = client.post("/api/v1/auth/logout", headers=headers)
    assert resp.status_code == 200

    set_cookies = "; ".join(resp.headers.getlist("Set-Cookie"))
    assert 'access_token=""' in set_cookies or "access_token=;" in set_cookies


def test_cookie_post_without_origin_is_rejected_csrf_guard(client, db, school):
    _make_admin(client, db, school)
    client.post(
        "/api/v1/auth/login",
        json={"email": "cookie.admin@test.edu.np", "password": "Test@1234"},
    )

    # Cookie-authenticated mutating request with no Origin header -> blocked.
    resp = client.post("/api/v1/auth/change-password", json={})
    assert resp.status_code == 403

    # Cross-origin Origin header -> blocked.
    resp = client.post(
        "/api/v1/auth/change-password",
        json={},
        headers={"Origin": "https://evil.example.com"},
        environ_base={"HTTP_ORIGIN": "https://evil.example.com"},
    )
    assert resp.status_code == 403

    # Same-site Origin -> allowed through to the handler (which then fails on
    # validation, not CSRF).
    resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "x", "new_password": "y"},
        environ_base={"HTTP_ORIGIN": "http://localhost"},
    )
    assert resp.status_code != 403


def test_bearer_requests_bypass_csrf_guard(client, db, school):
    """Bearer clients (mobile) are unaffected by the cookie CSRF guard."""
    _make_admin(client, db, school)
    headers = get_auth_headers(client, "cookie.admin@test.edu.np", "Test@1234")

    resp = client.put("/api/v1/auth/me", json={}, headers=headers)
    assert resp.status_code == 200
