"""S-03/S-04: production config validation and cookie Secure posture.

S-03 — booting production with published `.env.example` placeholders, short
secrets, or required-but-empty conditional config must raise a RuntimeError
naming the offender.
S-04 — the auth-cookie `secure` decision reads config["ENV"] (Flask 3 has no
FLASK_ENV config key — the old lookup always returned False).
"""
import pytest

from app.api.v1.auth import _cookie_params
from config import ProductionConfig


@pytest.fixture
def prod_config(monkeypatch):
    """A baseline production environment that passes validation."""
    monkeypatch.setattr(ProductionConfig, "SECRET_KEY", "x" * 48)
    monkeypatch.setattr(ProductionConfig, "JWT_SECRET_KEY", "y" * 48)
    monkeypatch.setattr(ProductionConfig, "STRIPE_ENABLED", False)
    monkeypatch.setattr(ProductionConfig, "WHATSAPP_APP_SECRET", "")
    monkeypatch.setattr(
        ProductionConfig, "SQLALCHEMY_DATABASE_URI", "postgresql://u:p@h:5432/db"
    )
    for var in (
        "ISR_REVALIDATE_SECRET",
        "SMS_CONSOLE_MODE",
        "STRIPE_SECRET_KEY",
        "FILE_STORAGE_BACKEND",
        "WHATSAPP_ACCESS_TOKEN",
        "POSTGRES_PASSWORD",
        "FLOWER_PASSWORD",
    ):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("ISR_REVALIDATE_SECRET", "isr-secret-32-chars-minimum!!")
    monkeypatch.setenv("SPARROW_SMS_TOKEN", "live-sparrow-token-2026")
    return ProductionConfig


class TestProductionValidation:
    def test_valid_baseline_passes(self, prod_config):
        prod_config.validate()

    def test_published_placeholder_rejected(self, prod_config, monkeypatch):
        monkeypatch.setattr(
            ProductionConfig, "SECRET_KEY", "change-me-to-a-random-string"
        )
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            prod_config.validate()

    def test_short_secret_rejected(self, prod_config, monkeypatch):
        monkeypatch.setattr(ProductionConfig, "JWT_SECRET_KEY", "too-short")
        with pytest.raises(RuntimeError, match="at least 32"):
            prod_config.validate()

    def test_missing_isr_secret_rejected(self, prod_config, monkeypatch):
        monkeypatch.delenv("ISR_REVALIDATE_SECRET")
        with pytest.raises(RuntimeError, match="ISR_REVALIDATE_SECRET"):
            prod_config.validate()

    def test_stripe_without_webhook_secret_rejected(
        self, prod_config, monkeypatch
    ):
        monkeypatch.setattr(ProductionConfig, "STRIPE_ENABLED", True)
        with pytest.raises(RuntimeError, match="STRIPE_WEBHOOK_SECRET"):
            prod_config.validate()

    def test_r2_backend_without_r2_keys_rejected(
        self, prod_config, monkeypatch
    ):
        monkeypatch.setenv("FILE_STORAGE_BACKEND", "r2")
        for var in (
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET_NAME",
            "R2_PUBLIC_URL",
        ):
            monkeypatch.delenv(var, raising=False)
        with pytest.raises(RuntimeError, match="R2_ACCOUNT_ID"):
            prod_config.validate()

    def test_whatsapp_without_app_secret_rejected(
        self, prod_config, monkeypatch
    ):
        monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "eaag-token")
        with pytest.raises(RuntimeError, match="WHATSAPP_APP_SECRET"):
            prod_config.validate()

    def test_console_sms_mode_rejected(self, prod_config, monkeypatch):
        monkeypatch.setenv("SMS_CONSOLE_MODE", "true")
        with pytest.raises(RuntimeError, match="SMS"):
            prod_config.validate()


class TestCookieSecurePosture:
    def test_not_secure_outside_production(self, app):
        assert app.config["ENV"] == "testing"
        assert app.config["JWT_COOKIE_SECURE"] is False
        with app.test_request_context():
            assert _cookie_params()["secure"] is False

    def test_secure_in_production(self, app, monkeypatch):
        monkeypatch.setitem(app.config, "ENV", "production")
        with app.test_request_context():
            assert _cookie_params()["secure"] is True

    def test_explicit_cookie_secure_override_wins(self, app, monkeypatch):
        monkeypatch.setitem(app.config, "ENV", "testing")
        monkeypatch.setitem(app.config, "COOKIE_SECURE", "true")
        with app.test_request_context():
            assert _cookie_params()["secure"] is True
