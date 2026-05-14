"""Flask application configuration."""
import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


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

    # AI — Anthropic (primary when Groq key absent)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    AI_MODEL_FAST = os.getenv("AI_MODEL_FAST", "claude-haiku-4-5-20250514")
    AI_MODEL_QUALITY = os.getenv("AI_MODEL_QUALITY", "claude-sonnet-4-20250514")

    # AI — Groq (used instead of Anthropic when GROQ_API_KEY is set)
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

    # AI Token Hub settings
    AI_DEFAULT_DAILY_LIMIT = int(os.getenv("AI_DEFAULT_DAILY_LIMIT", "10000"))
    AI_DEFAULT_MONTHLY_LIMIT = int(os.getenv("AI_DEFAULT_MONTHLY_LIMIT", "100000"))
    AI_QUOTA_ENFORCEMENT = os.getenv("AI_QUOTA_ENFORCEMENT", "true").lower() == "true"

    # Nepal SMS
    SPARROW_SMS_TOKEN = os.getenv("SPARROW_SMS_TOKEN", "")
    SPARROW_SMS_FROM = os.getenv("SPARROW_SMS_FROM", "ASchool")
    SMS_CONSOLE_MODE = os.getenv("SMS_CONSOLE_MODE", "false").lower() == "true"

    # WhatsApp
    WA_PHONE_NUMBER_ID = os.getenv("WA_PHONE_NUMBER_ID", "")
    WA_ACCESS_TOKEN = os.getenv("WA_ACCESS_TOKEN", "")
    WA_VERIFY_TOKEN = os.getenv("WA_VERIFY_TOKEN", "")
    WA_APP_SECRET = os.getenv("WA_APP_SECRET", "")
    WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", WA_PHONE_NUMBER_ID)
    WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", WA_ACCESS_TOKEN)

    # eSewa
    ESEWA_MERCHANT_ID = os.getenv("ESEWA_MERCHANT_ID", "")
    ESEWA_SECRET_KEY = os.getenv("ESEWA_SECRET_KEY", "")

    # Khalti
    KHALTI_SECRET_KEY = os.getenv("KHALTI_SECRET_KEY", "")
    KHALTI_PUBLIC_KEY = os.getenv("KHALTI_PUBLIC_KEY", "")

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


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
