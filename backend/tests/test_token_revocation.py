"""S-05: token revocation must actually revoke.

Regression for the naive-vs-aware datetime mismatch in RevokedToken
(comparison silently shifted with the session timezone, and the fail-open
except in the blocklist loader turned any error into "not revoked").
"""
from datetime import datetime, timedelta, timezone

from app.models.revoked_token import RevokedToken

from tests.conftest import get_auth_headers


class TestLogoutRevokes:
    def test_logout_invalidates_access_token(
        self, app, client, school, admin_user, monkeypatch
    ):
        """login → logout → old access token rejected with 401.

        JWT expiry is stretched for this test so the 401 can only come from
        revocation, not natural expiry (testing config expires in 5s).
        """
        monkeypatch.setitem(
            app.config, "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=10)
        )
        headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        assert client.get("/api/v1/students", headers=headers).status_code == 200

        resp = client.post("/api/v1/auth/logout", headers=headers)
        assert resp.status_code == 200

        resp = client.get("/api/v1/students", headers=headers)
        assert resp.status_code == 401

    def test_non_revoked_token_still_works(
        self, app, client, school, admin_user, monkeypatch
    ):
        monkeypatch.setitem(
            app.config, "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=10)
        )
        headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        assert client.get("/api/v1/students", headers=headers).status_code == 200


class TestRevokedTokenModel:
    def test_revoke_accepts_aware_datetime(self, db):
        """Aware expires_at is normalized to naive UTC, then found revoked."""
        RevokedToken.revoke(
            "jti-aware-1",
            "access",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )
        assert RevokedToken.is_revoked("jti-aware-1") is True

    def test_revoke_accepts_naive_datetime(self, db):
        RevokedToken.revoke(
            "jti-naive-1",
            "access",
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(minutes=5),
        )
        assert RevokedToken.is_revoked("jti-naive-1") is True

    def test_default_expiry_works_with_int_config(
        self, app, db, monkeypatch
    ):
        """Some configs express expiry as int seconds — revoke() must not
        TypeError when no explicit expires_at is passed."""
        monkeypatch.setitem(app.config, "JWT_ACCESS_TOKEN_EXPIRES", 3600)
        RevokedToken.revoke("jti-int-1", "access")
        assert RevokedToken.is_revoked("jti-int-1") is True

    def test_unknown_jti_not_revoked(self, db):
        assert RevokedToken.is_revoked("no-such-jti") is False

    def test_prune_expired_removes_only_expired(self, db):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        RevokedToken.revoke("jti-live", "access", expires_at=now + timedelta(hours=1))
        RevokedToken.revoke("jti-dead", "access", expires_at=now - timedelta(hours=1))
        deleted = RevokedToken.prune_expired()
        assert deleted >= 1
        assert RevokedToken.is_revoked("jti-live") is True
        assert RevokedToken.is_revoked("jti-dead") is False
