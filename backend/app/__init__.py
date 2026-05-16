import logging
import os
import re as _re
from uuid import UUID

from celery.schedules import crontab
from flask import Flask, g, jsonify, request

from config import config
from extensions import cache, celery, cors, db, init_redis, jwt, limiter, migrate, socketio

logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # ── Production safety: validate critical config ──────────────────────
    if config_name == "production":
        from config import ProductionConfig
        ProductionConfig.validate()

    # ── Sentry APM ───────────────────────────────────────────────────────
    sentry_dsn = app.config.get("SENTRY_DSN", "")
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration
            from sentry_sdk.integrations.celery import CeleryIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[
                    FlaskIntegration(),
                    CeleryIntegration(),
                    SqlalchemyIntegration(),
                ],
                traces_sample_rate=0.1,
                environment=config_name,
                send_default_pii=False,
            )
            logger.info("Sentry initialized (env=%s)", config_name)
        except ImportError:
            logger.warning("sentry-sdk not installed — monitoring disabled")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sentry init failed — monitoring disabled: %s", exc)

    # Initialise extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Build allowed CORS origins from environment so the Authorization header
    # is permitted and wildcard '*' is not used (required for credentialed requests).
    _base = app.config.get("BASE_DOMAIN", "aschool.com.np")
    _frontend = os.getenv("FRONTEND_URL", f"https://{_base}")
    _cors_origins = [
        _frontend,
        f"https://{_base}",
        f"https://www.{_base}",
        _re.compile(rf"https://[^./]+\.{_re.escape(_base)}"),  # *.base_domain
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8080",
    ]
    # CORS_EXTRA_ORIGINS: comma-separated list of additional allowed origins
    # (use for Flutter web dev server, local network IPs, etc.)
    _extra = os.getenv("CORS_EXTRA_ORIGINS", "")
    if _extra:
        _cors_origins.extend([o.strip() for o in _extra.split(",") if o.strip()])
    cors.init_app(app, resources={r"/*": {
        "origins": _cors_origins,
        "supports_credentials": True,
        "allow_headers": [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Accept",
            "X-School-Slug",
        ],
        "expose_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "max_age": 600,
    }})

    limiter.init_app(app)
    cache.init_app(app)
    init_redis(app)
    _socket_origins = [
        _frontend, f"https://{_base}",
        f"https://www.{_base}", f"https://api.{_base}",
        "http://localhost:3000", "http://localhost:3001", "http://localhost:8080",
    ] + ([o.strip() for o in _extra.split(",") if o.strip()] if _extra else [])
    socketio.init_app(
        app,
        cors_allowed_origins=_socket_origins,
        async_mode="eventlet",
    )

    # Celery
    celery.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
        timezone=app.config["CELERY_TIMEZONE"],
        enable_utc=False,
        beat_schedule={
            "dispatch-fee-reminders": {
                "task": "dispatch_fee_reminders",
                "schedule": crontab(hour=8, minute=0),
            },
            "attendance-alerts-daily": {
                "task": "attendance_alerts_daily",
                "schedule": crontab(hour=16, minute=30),
            },
            "library-overdue-daily": {
                "task": "library_overdue_check",
                "schedule": crontab(hour=7, minute=30),
            },
            "social-publish-scheduled": {
                "task": "social_publish_scheduled",
                "schedule": crontab(minute="*/5"),
            },
            "payroll-monthly-process": {
                "task": "payroll_monthly_process",
                "schedule": crontab(day_of_month=1, hour=0, minute=10),
            },
            "analytics-aggregate-daily": {
                "task": "analytics_aggregate_daily",
                "schedule": crontab(hour=0, minute=20),
            },
            "academic-rollover-daily": {
                "task": "academic_rollover_daily",
                "schedule": crontab(hour=0, minute=5),
            },
            "gamification-streak-update": {
                "task": "gamification_streak_update",
                "schedule": crontab(hour=0, minute=30),
            },
            "sitemap-rebuild-nightly": {
                "task": "sitemap_rebuild",
                "schedule": crontab(hour=2, minute=0),
            },
        },
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask

    # Before-request: resolve school from subdomain or JWT
    @app.before_request
    def resolve_school():
        g.school = None
        g.school_id = None
        g.user_id = None
        g.current_user_id = None
        g.current_user = None
        g.role = None
        g.installed_plugins = []

        from app.models.school import School

        # 1. Try subdomain resolution
        host = request.host.split(":")[0]
        base = app.config.get("BASE_DOMAIN", "aschool.com.np")
        if host.endswith(base) and host != base and host != f"www.{base}":
            slug = host.replace(f".{base}", "")
            school = School.query.filter_by(slug=slug, is_active=True).first()
            if school:
                _set_school_context(school)
                return

        # 2. Fallback: resolve from JWT school_id claim (for localhost / dev)
        from flask_jwt_extended import get_jwt, verify_jwt_in_request
        try:
            verify_jwt_in_request(optional=True)
            claims = get_jwt()
            identity = claims.get("sub")
            g.role = claims.get("role")
            try:
                g.user_id = UUID(identity) if identity else None
            except (TypeError, ValueError, AttributeError):
                g.user_id = identity
            g.current_user_id = g.user_id
            if g.user_id:
                from app.models.user import User
                try:
                    g.current_user = User.query.filter_by(
                        id=g.user_id,
                        is_deleted=False,
                    ).first()
                except Exception:
                    g.current_user = None
            school_id = claims.get("school_id")
            if school_id:
                school = School.query.filter_by(id=school_id, is_active=True).first()
                if school:
                    _set_school_context(school)
        except Exception:
            pass

    def _set_school_context(school):
        g.school = school
        g.school_id = school.id
        cache_key = f"school:{school.id}:plugins"
        plugins = cache.get(cache_key)
        if plugins is None:
            from app.models.plugin import SchoolPlugin
            plugins = [
                sp.plugin_slug
                for sp in SchoolPlugin.query.filter_by(
                    school_id=school.id, active=True
                ).all()
            ]
            cache.set(cache_key, plugins, timeout=300)
        g.installed_plugins = plugins

    # Register core blueprint
    from app.api.v1 import api_v1_bp

    app.register_blueprint(api_v1_bp, url_prefix="/api/v1")

    # Register webhook blueprint
    from app.api.webhooks import webhooks_bp

    app.register_blueprint(webhooks_bp, url_prefix="/webhooks")

    # Load plugins
    from app.plugins.loader import PluginLoader

    PluginLoader.discover_and_register(app)

    # Register cross-plugin event listeners
    from app.plugins import listeners  # noqa: F401 — registers @on() handlers

    # Error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify(success=False, data=None, error=str(e)), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify(success=False, data=None, error="Unauthorized"), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify(success=False, data=None, error="Forbidden"), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify(success=False, data=None, error="Not found"), 404

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify(success=False, data=None, error="Unprocessable entity"), 422

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify(success=False, data=None, error="Rate limit exceeded"), 429

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify(success=False, data=None, error="Internal server error"), 500

    # Health check
    @app.route("/health")
    def health():
        return jsonify(status="ok")

    # Readiness probe — verifies DB + Redis connectivity
    @app.route("/ready")
    def ready():
        checks = {}
        try:
            db.session.execute(db.text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as e:
            checks["database"] = f"error: {e}"
        try:
            from extensions import redis_client
            if redis_client:
                redis_client.ping()
                checks["redis"] = "ok"
            else:
                checks["redis"] = "not initialized"
        except Exception as e:
            checks["redis"] = f"error: {e}"

        all_ok = all(v == "ok" for v in checks.values())
        return jsonify(status="ok" if all_ok else "degraded", checks=checks), 200 if all_ok else 503

    # ── Security headers ─────────────────────────────────────────────────
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not app.debug:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self' https: wss:"
            )
        return response

    # Serve locally-uploaded files (dev fallback when R2 is not configured)
    @app.route("/uploads/<path:filepath>")
    def serve_upload(filepath):
        import os
        from flask import send_from_directory
        upload_dir = os.getenv("LOCAL_UPLOAD_DIR", "/app/uploads")
        return send_from_directory(upload_dir, filepath)

    return app
