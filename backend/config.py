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


def _env(name: str, fallback: str) -> str:
    """Secrets resolver — no published literal fallbacks outside dev/test (S-03).

    - development/testing keep their well-known fallback so local boot and
      the test suite stay deterministic.
    - any other environment with an EMPTY secret gets a per-process random
      value plus a loud warning: running on a known key is worse than a
      rotated one. Set the variable explicitly for a stable signature.
    """
    value = os.getenv(name, "")
    if value:
        return value
    env = os.getenv("FLASK_ENV", "development")
    if env in ("development", "testing"):
        return fallback
    logger.warning(
        "PRODUCTION CONFIG WARNING: %s is not set — a per-process random "
        "secret was generated. Signatures will not survive restarts or be "
        "shared across workers. Set %s explicitly.",
        name,
        name,
    )
    return secrets.token_urlsafe(48)


class BaseConfig:
    """Base configuration shared by all environments."""

    # ENV is mirrored into config so runtime code can branch on it without
    # reaching for os.getenv (Flask 3 does not define app.config["ENV"];
    # S-04 cookie Secure depends on this key).
    SECRET_KEY = _env("SECRET_KEY", "change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_ENSURE_ASCII = False  # Return Nepali/Unicode text as-is, not \uXXXX escapes
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 20,
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }

    # JWT
    JWT_SECRET_KEY = _env("JWT_SECRET_KEY", "change-me-jwt")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 3600))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 2592000))
    )
    # Accept tokens from Authorization header (mobile) AND from the
    # HttpOnly cookies (web dashboard). Cookie name must match ACCESS_COOKIE
    # in app.api.v1.auth so the same value is read back.
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_ACCESS_COOKIE_NAME = "access_token"
    JWT_REFRESH_COOKIE_NAME = "refresh_token"
    JWT_COOKIE_SECURE = False  # create_app mirrors ENV: Secure in production only (S-04)
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_CSRF_PROTECT = False  # cookies are first-party; SameSite=Lax is enough

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
    GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")
    GROQ_MODEL_QUALITY = os.getenv("GROQ_MODEL_QUALITY", "openai/gpt-oss-120b")

    # AI — Anthropic (FALLBACK when Groq key absent or Groq fails)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    AI_MODEL_FAST = os.getenv("AI_MODEL_FAST", "claude-haiku-4-5-20250514")
    AI_MODEL_QUALITY = os.getenv("AI_MODEL_QUALITY", "claude-sonnet-4-20250514")

    # AI Token Hub settings
    AI_DEFAULT_DAILY_LIMIT = int(os.getenv("AI_DEFAULT_DAILY_LIMIT", "10000"))
    AI_DEFAULT_MONTHLY_LIMIT = int(os.getenv("AI_DEFAULT_MONTHLY_LIMIT", "100000"))
    # A-01: parse strictly — "1"/"0" previously fell through to True,
    # silently disabling all cost control when the operator meant off.
    AI_QUOTA_ENFORCEMENT = os.getenv("AI_QUOTA_ENFORCEMENT", "true").strip().lower() in (
        "1", "true", "yes", "on",
    )
    # A-01: provider call hygiene (declared-but-never-read before)
    AI_TIMEOUT_FAST = int(os.getenv("AI_TIMEOUT_FAST", "30"))
    AI_TIMEOUT_QUALITY = int(os.getenv("AI_TIMEOUT_QUALITY", "90"))
    AI_MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", "2"))
    # A-01: USD per 1M tokens price sheet override (JSON: provider:model:[p,c])
    AI_MODEL_PRICES_JSON = os.getenv("AI_MODEL_PRICES_JSON", "")
    # A-01 cost-quota conversion: daily token limit → USD budget at a
    # conservative blended per-M-token rate (Groq-heavy mix).
    AI_BLENDED_USD_PER_MTOKEN = float(os.getenv("AI_BLENDED_USD_PER_MTOKEN", "0.6"))

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

    # Stripe — SaaS plugin subscription webhooks (audit E5). Only the signing
    # secret is needed at app level; it is sourced from env with a default-empty
    # value so dev/test never crash, but /api/v1/webhooks/stripe refuses
    # requests (400 + logged error) while it is unset, because signature
    # verification is impossible without it.
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    # Plugin marketplace — WordPress-style install semantics (plugin-
    # architecture batch audits E160-E163; FIX_STATUS §14 has the rows —
    # the E160-E169 band was double-allocated with §11/Slice-1).
    # PLUGIN_TRIAL_DAYS: trial length granted when a PAID plugin is installed
    # (platform-level knob; supersedes the per-plugin catalog trial_days so the
    # policy stays config-controlled). PLUGIN_FREE_TIERS: tier categories that
    # install instantly with NO trial ever (is_trial=False, active immediately)
    # — a plugin is "free" when price_monthly == 0 OR its tier is listed here.
    PLUGIN_TRIAL_DAYS = int(os.getenv("PLUGIN_TRIAL_DAYS", "14"))
    PLUGIN_FREE_TIERS = [
        tier.strip().lower()
        for tier in os.getenv("PLUGIN_FREE_TIERS", "core,add_on").split(",")
        if tier.strip()
    ]

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
    # WhatsApp Cloud API (optional — service degrades to {"skipped": ...} when unset)
    WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

    FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "")
    FIREBASE_SECRET = os.getenv("FIREBASE_SECRET", "")
    FIREBASE_SERVER_KEY = os.getenv("FIREBASE_SERVER_KEY", FIREBASE_SECRET)

    # Sentry
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")

    # Domain
    BASE_DOMAIN = os.getenv("BASE_DOMAIN", "brighternepal.com")
    CELERY_TIMEZONE = os.getenv("CELERY_TIMEZONE", "Asia/Kathmandu")

    # Next.js ISR on-demand revalidation (E201): the Flask publish/unpublish
    # (and other website-builder mutations) ping the Next.js /api/revalidate
    # endpoint so /school/<slug> route + data caches purge immediately.
    # NEXTJS_INTERNAL_URL is the Docker-internal Next.js origin (compose
    # service name). Leave ISR_REVALIDATE_SECRET empty when the Next side
    # does not configure one — both sides must match.
    NEXTJS_INTERNAL_URL = os.getenv("NEXTJS_INTERNAL_URL", "http://nextjs:3000")
    ISR_REVALIDATE_SECRET = os.getenv("ISR_REVALIDATE_SECRET", "")


class DevelopmentConfig(BaseConfig):
    ENV = "development"
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://aschool:aschool@localhost:5432/aschool"
    )


class TestingConfig(BaseConfig):
    ENV = "testing"
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
    ENV = "production"
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    RATELIMIT_DEFAULT = "60/minute"

    # Signing secret for the WhatsApp Cloud API webhook — without it the
    # X-Hub-Signature-256 check cannot run and the webhook fails open (IN-4).
    WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")

    # Stripe is "enabled" for validation purposes when an account key is
    # configured; then the webhook signing secret must exist too.
    STRIPE_ENABLED = bool(os.getenv("STRIPE_SECRET_KEY", ""))

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

    @staticmethod
    def _env_example_values() -> dict:
        """KEY=VALUE pairs from the repo-root .env.example (S-03): booting
        production with a published placeholder must fail loudly."""
        from pathlib import Path

        example = Path(__file__).resolve().parent.parent / ".env.example"
        values = {}
        if example.exists():
            for line in example.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                values[key.strip()] = val.strip().strip('"').strip("'")
        return values

    @classmethod
    def validate(cls):
        """Validate production configuration — fail loudly for insecure defaults."""
        # (a) secrets: strong and not a published placeholder
        example_values = cls._env_example_values()
        for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
            value = getattr(cls, name) or ""
            if not value or value in example_values.values():
                raise RuntimeError(
                    f"FATAL: {name} is empty or uses a published placeholder. "
                    "Set a strong per-environment secret."
                )
            if len(value) < 32:
                raise RuntimeError(
                    f"FATAL: {name} must be at least 32 characters for production."
                )
        if not cls.SQLALCHEMY_DATABASE_URI:
            raise RuntimeError(
                "FATAL: DATABASE_URL is not set for production."
            )
        # (b) revalidation secret: an unset secret lets anyone purge the
        # Next.js caches by POSTing to /api/revalidate.
        if not os.getenv("ISR_REVALIDATE_SECRET", ""):
            raise RuntimeError(
                "FATAL: ISR_REVALIDATE_SECRET is not set for production — "
                "on-demand cache revalidation would be unauthenticated."
            )
        # (c) compose-level credentials: the app container usually does not
        # receive these (they belong to postgres/flower services), so they
        # are loud warnings rather than boot-fatal.
        for name in ("POSTGRES_PASSWORD", "FLOWER_PASSWORD"):
            if not os.getenv(name, ""):
                logger.warning(
                    "PRODUCTION CONFIG WARNING: %s is not visible to the app "
                    "process — ensure it is set for the %s service.",
                    name,
                    "postgres" if name == "POSTGRES_PASSWORD" else "flower",
                )
        # (d) conditional requirements
        if cls.STRIPE_ENABLED and not cls.STRIPE_WEBHOOK_SECRET:
            raise RuntimeError(
                "FATAL: STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is "
                "empty — subscription webhooks cannot be verified."
            )
        if (os.getenv("FILE_STORAGE_BACKEND", "local") == "r2"):
            missing = [
                name
                for name in (
                    "R2_ACCOUNT_ID",
                    "R2_ACCESS_KEY_ID",
                    "R2_SECRET_ACCESS_KEY",
                    "R2_BUCKET_NAME",
                    "R2_PUBLIC_URL",
                )
                if not os.getenv(name, "")
            ]
            if missing:
                raise RuntimeError(
                    f"FATAL: FILE_STORAGE_BACKEND=r2 but {', '.join(missing)} "
                    "are not set."
                )
        if os.getenv("WHATSAPP_ACCESS_TOKEN", "") and not cls.WHATSAPP_APP_SECRET:
            raise RuntimeError(
                "FATAL: WHATSAPP_ACCESS_TOKEN is set but WHATSAPP_APP_SECRET "
                "is empty — the WhatsApp webhook would accept unsigned "
                "requests (IN-4)."
            )
        # OTP logins are the primary auth path for parents/students — a
        # missing SMS provider would silently break all of them.
        sparrow_token = os.getenv("SPARROW_SMS_TOKEN", "")
        if (
            not sparrow_token
            or sparrow_token in example_values.values()
            or str(os.getenv("SMS_CONSOLE_MODE", "")).lower() in ("1", "true", "yes")
        ):
            raise RuntimeError(
                "FATAL: SMS delivery is not configured for production "
                "(empty SPARROW_SMS_TOKEN or SMS_CONSOLE_MODE enabled). "
                "OTPs would never reach users' phones."
            )


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
