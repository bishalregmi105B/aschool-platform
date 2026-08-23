"""Flask application configuration."""
import logging
import os
import secrets
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _default_celery_result_backend() -> str:
    explicit = os.getenv("CELERY_RESULT_BACKEND")
    if explicit:
        return explicit

    broker = os.getenv("CELERY_BROKER_URL")
    if not broker:
        return "redis://localhost:6379/2"

    parts = broker.rsplit("/", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return f"{parts[0]}/{int(parts[1]) + 1}"

    return broker


class BaseConfig:
    """Base configuration shared by all environments."""

    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_ENSURE_ASCII = False  # Return Nepali/Unicode text as-is, not \uXXXX escapes
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 20,
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-jwt")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 3600))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 2592000))
    )
    JWT_TOKEN_LOCATION = ["headers"]

    # HttpOnly session cookies (web dashboard). JWT_TOKEN_LOCATION stays
    # header-only so mobile Bearer auth is unaffected; cookies are an
    # additional transport set by /auth/* responses.
    COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None  # e.g. ".aschool.com.np"
    COOKIE_SECURE = os.getenv("COOKIE_SECURE", "auto")  # auto: Secure outside dev/test

    # Redis / Cache
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300

    # Celery
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND = _default_celery_result_backend()

    # Rate Limiting
    RATELIMIT_STORAGE_URI = REDIS_URL
    RATELIMIT_DEFAULT = "60/minute"

    # AI — Groq (PRIMARY provider)
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")
    GROQ_MODEL_QUALITY = os.getenv("GROQ_MODEL_QUALITY", "llama-3.3-70b-versatile")

    # AI — Anthropic (FALLBACK when Groq key absent or Groq fails)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    AI_MODEL_FAST = os.getenv("AI_MODEL_FAST", "claude-haiku-4-5-20250514")
    AI_MODEL_QUALITY = os.getenv("AI_MODEL_QUALITY", "claude-sonnet-4-20250514")

    # AI Token Hub settings
    AI_DEFAULT_DAILY_LIMIT = int(os.getenv("AI_DEFAULT_DAILY_LIMIT", "10000"))
    AI_DEFAULT_MONTHLY_LIMIT = int(os.getenv("AI_DEFAULT_MONTHLY_LIMIT", "100000"))
    AI_QUOTA_ENFORCEMENT = os.getenv("AI_QUOTA_ENFORCEMENT", "true").lower() == "true"

    # Nepal SMS
    SPARROW_SMS_TOKEN = os.getenv("SPARROW_SMS_TOKEN", "")
    SPARROW_SMS_FROM = os.getenv("SPARROW_SMS_FROM", "ASchool")
    SMS_CONSOLE_MODE = os.getenv("SMS_CONSOLE_MODE", "false").lower() == "true"

    # WhatsApp — DEFERRED (planned for future release)
    # WA_PHONE_NUMBER_ID = os.getenv("WA_PHONE_NUMBER_ID", "")
    # WA_ACCESS_TOKEN = os.getenv("WA_ACCESS_TOKEN", "")

    # OneSignal Push Notifications
    ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID", "")
    ONESIGNAL_REST_API_KEY = os.getenv("ONESIGNAL_REST_API_KEY", "")

    # Payment gateway environments (sandbox / production — deploy-level flag).
    # Merchant credentials are stored per-school in fee_config, not here.
    ESEWA_ENVIRONMENT = os.getenv("ESEWA_ENVIRONMENT", "sandbox")
    KHALTI_ENVIRONMENT = os.getenv("KHALTI_ENVIRONMENT", "sandbox")
    FONEPAY_ENVIRONMENT = os.getenv("FONEPAY_ENVIRONMENT", "sandbox")

    # R2 Storage
    R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "aschool")
    R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")

    # File storage backend: "local" or "r2"
    FILE_STORAGE_BACKEND = os.getenv("FILE_STORAGE_BACKEND", "local")
    LOCAL_UPLOAD_DIR = os.getenv("LOCAL_UPLOAD_DIR", "/app/uploads")

    # Firebase
    FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "")
    FIREBASE_SECRET = os.getenv("FIREBASE_SECRET", "")
    FIREBASE_SERVER_KEY = os.getenv("FIREBASE_SERVER_KEY", FIREBASE_SECRET)

    # Sentry
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")

    # Domain
    BASE_DOMAIN = os.getenv("BASE_DOMAIN", "aschool.com.np")
    CELERY_TIMEZONE = os.getenv("CELERY_TIMEZONE", "Asia/Kathmandu")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://aschool:aschool@localhost:5432/aschool"
    )


class TestingConfig(BaseConfig):
    TESTING = True
    _base_db_url = os.getenv(
        "DATABASE_URL", "postgresql://aschool:aschool@localhost:5432/aschool"
    )
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL",
        f"{_base_db_url.rsplit('/', 1)[0]}/aschool_test",
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=5)


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    RATELIMIT_DEFAULT = "60/minute"

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

    @classmethod
    def validate(cls):
        """Validate production configuration — fail loudly for insecure defaults."""
        insecure_defaults = {"change-me", "change-me-jwt", ""}
        if cls.SECRET_KEY in insecure_defaults:
            raise RuntimeError(
                "FATAL: SECRET_KEY is using an insecure default. "
                "Set a strong SECRET_KEY in environment variables."
            )
        if cls.JWT_SECRET_KEY in insecure_defaults:
            raise RuntimeError(
                "FATAL: JWT_SECRET_KEY is using an insecure default. "
                "Set a strong JWT_SECRET_KEY in environment variables."
            )
        if not cls.SQLALCHEMY_DATABASE_URI:
            raise RuntimeError(
                "FATAL: DATABASE_URL is not set for production."
            )


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
