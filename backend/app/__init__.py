"""Flask application factory."""
import os
from uuid import UUID

from celery.schedules import crontab
from flask import Flask, g, jsonify, request

from config import config
from extensions import cache, celery, cors, db, init_redis, jwt, limiter, migrate, socketio


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialise extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/*": {"origins": "*"}})
    limiter.init_app(app)
    cache.init_app(app)
    init_redis(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode="eventlet")

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

    # Serve locally-uploaded files (dev fallback when R2 is not configured)
    @app.route("/uploads/<path:filepath>")
    def serve_upload(filepath):
        import os
        from flask import send_from_directory
        upload_dir = os.getenv("LOCAL_UPLOAD_DIR", "/app/uploads")
        return send_from_directory(upload_dir, filepath)

    return app
