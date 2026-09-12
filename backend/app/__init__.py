import logging
import os
import re as _re
from uuid import UUID

from celery.schedules import crontab
from flask import Flask, g, jsonify, request

from config import config
from extensions import cache, celery, cors, db, init_redis, jwt, limiter, migrate, socketio

logger = logging.getLogger(__name__)


def _setup_logging(app: Flask) -> None:
    """P-04: structured JSON logs (LOG_LEVEL controlled) + X-Request-ID
    propagation. Every request gets an id; errors carry it for correlation
    with Sentry. Console remains human-readable outside production."""
    import json as _json
    import uuid as _uuid
    import time as _time
    from flask import request as _req

    level = os.getenv("LOG_LEVEL", "INFO" if app.config.get("ENV") != "development" else "DEBUG")
    logging.getLogger().setLevel(level)

    if app.config.get("ENV") != "production":
        return

    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)

    class _JsonFormatter(logging.Formatter):
        def format(self, record):
            payload = {
                "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
            if record.exc_info:
                payload["exception"] = self.formatException(record.exc_info)
            for key in ("request_id", "school_id", "user_id", "path", "method", "duration_ms"):
                if hasattr(record, key):
                    payload[key] = getattr(record, key)
            return _json.dumps(payload, default=str)

    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    root.addHandler(handler)

    @app.before_request
    def _assign_request_id():
        from flask import g as _g

        _g.request_id = _req.headers.get("X-Request-ID") or str(_uuid.uuid4())
        _g._req_start = _time.time()

    @app.after_request
    def _log_request(response):
        from flask import g as _g

        duration_ms = int((_time.time() - getattr(_g, "_req_start", _time.time())) * 1000)
        app.logger.info(
            "request",
            extra={
                "request_id": getattr(_g, "request_id", None),
                "method": _req.method,
                "path": _req.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "school_id": str(getattr(_g, "school_id", None) or "") or None,
                "user_id": str(getattr(_g, "user_id", None) or "") or None,
            },
        )
        rid = getattr(_g, "request_id", None)
        if rid:
            response.headers["X-Request-ID"] = rid
        return response


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

    # ── P-04: JSON log formatting + request-ID middleware ─────────────────
    _setup_logging(app)

    # JWT_COOKIE_SECURE follows the same source as the hand-rolled auth
    # cookies (S-04): Secure in production, not in dev/test.
    if str(app.config.get("COOKIE_SECURE", "auto")).lower() == "auto":
        app.config["JWT_COOKIE_SECURE"] = app.config.get("ENV") == "production"

    # Behind nginx/Cloudflare the real client IP arrives in X-Forwarded-*;
    # without ProxyFix every client shares the proxy IP bucket for rate
    # limiting and audit logging (S-08). One trusted proxy hop.
    from werkzeug.middleware.proxy_fix import ProxyFix

    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

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

    # ── JWT token blocklist (revocation) ─────────────────────────────────
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        """Called on every JWT-protected request to reject revoked tokens."""
        jti = jwt_payload.get("jti")
        if not jti:
            return False

        # Global per-user invalidation: reject tokens issued before the user's
        # logout-all / password-change timestamp.
        iat = jwt_payload.get("iat")
        if iat is not None:
            try:
                identity = jwt_payload.get("sub")
                if identity and not jwt_payload.get("type") == "refresh":
                    pass  # both token types carry sub; single lookup below
                from app.models.user import User
                cutoff = db.session.query(User.tokens_invalid_before).filter(
                    User.id == identity
                ).scalar()
                if cutoff is not None:
                    from datetime import datetime, timezone
                    issued = datetime.fromtimestamp(iat, tz=timezone.utc)
                    naive_cutoff = cutoff if cutoff.tzinfo else cutoff.replace(tzinfo=timezone.utc)
                    if issued < naive_cutoff:
                        return True
            except Exception:
                # Fail-open for the iat check specifically; jti blocklist below
                # still applies. Clear any aborted transaction state.
                db.session.rollback()

        from app.models.revoked_token import RevokedToken
        # No fail-open wrapper: a revoked-token lookup failure must be loud,
        # not silently accept revoked tokens (S-05).
        return RevokedToken.is_revoked(jti)

    # Build allowed CORS origins from environment so the Authorization header
    # is permitted and wildcard '*' is not used (required for credentialed requests).
    _base = app.config.get("BASE_DOMAIN", "brighternepal.com")
    _frontend = os.getenv("FRONTEND_URL", f"https://{_base}")
    _cors_origins = [
        _frontend,
        f"https://{_base}",
        f"https://www.{_base}",
        # Anchored: a non-anchored pattern lets "https://demo.base.attacker.example"
        # match (re.match only pins the start), handing attacker origins CORS
        # credentials and CSRF acceptance (S-02).
        _re.compile(rf"^https://[^./]+\.{_re.escape(_base)}$"),  # *.base_domain
        # Sane built-in dev defaults: Next.js dashboard ports + the Flutter
        # web dev server ports (each app gets its own `flutter run
        # -d web-server --web-port` — admin 8090/8091, teacher 8092, parent
        # 8093, student 8094, user 8095). E200: none of these were allowed,
        # so every Flutter-web preflight (OPTIONS /auth/login) came back
        # without CORS headers.
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://localhost:8090",
        "http://localhost:8091",
        "http://localhost:8092",
        "http://localhost:8093",
        "http://localhost:8094",
        "http://localhost:8095",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8090",
        "http://127.0.0.1:8091",
        "http://127.0.0.1:8092",
        "http://127.0.0.1:8093",
        "http://127.0.0.1:8094",
        "http://127.0.0.1:8095",
    ]
    # CORS_ALLOW_ORIGINS: canonical comma-separated list of additional allowed
    # origins (Flutter web dev server, LAN IPs, staging hosts, ...).
    # CORS_EXTRA_ORIGINS is kept as the legacy alias for existing deployments.
    _extra_origins: list[str] = []
    for _cors_env_key in ("CORS_ALLOW_ORIGINS", "CORS_EXTRA_ORIGINS"):
        _cors_env_val = os.getenv(_cors_env_key, "")
        if _cors_env_val:
            _extra_origins.extend(
                o.strip() for o in _cors_env_val.split(",") if o.strip()
            )
    _cors_origins.extend(_extra_origins)
    # ── Preflight normalization (E200) ───────────────────────────────────
    # flask-cors answers OPTIONS preflights with 200 + the CORS headers.
    # Rewrite those to 204 No Content (spec-preferred preflight status).
    # MUST be registered BEFORE cors.init_app: after_request handlers run in
    # reverse registration order, so this runs AFTER flask-cors has attached
    # the Access-Control-* headers and can inspect them.
    @app.after_request
    def normalize_preflight_response(response):
        if (
            request.method == "OPTIONS"
            and request.headers.get("Access-Control-Request-Method")
            and response.headers.get("Access-Control-Allow-Origin")
            and response.status_code == 200
        ):
            response.status_code = 204
            response.headers.remove("Content-Type")
            response.headers.remove("Content-Length")
        return response

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
        "http://localhost:8090", "http://localhost:8091",
    ] + _extra_origins
    socketio.init_app(
        app,
        cors_allowed_origins=_socket_origins,
        async_mode="eventlet",
        # Flask 3.1 made RequestContext.session read-only, which breaks
        # flask-socketio's managed sessions (ctx.session setter). realtime.py
        # keeps per-connection state itself, so let Flask handle sessions.
        manage_session=False,
        # External processes (Celery GPS workers) publish realtime events via
        # the same Redis message queue so connected browsers receive them.
        message_queue=app.config.get("SOCKET_MESSAGE_QUEUE")
        or (None if app.config.get("TESTING") else app.config.get("REDIS_URL")),
    )

    # Celery
    celery.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
        timezone=app.config["CELERY_TIMEZONE"],
        enable_utc=False,
        # P-01(a): 20/44 tasks (no explicit queue) were published to the
        # "celery" default queue — the worker only consumes
        # -Q default,ai,notifications,gps, so those tasks were queued but
        # never executed. Route everything unnamed to "default".
        task_routes={"*": {"queue": "default"}},
        # P-01(e): long-running beats must not pile up; idempotency via
        # task locks lands before acks_late is flipped on.
        task_acks_late=True,
        task_time_limit=1800,
        task_soft_time_limit=1500,
        worker_prefetch_multiplier=1,
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
            "db-backup-daily": {
                "task": "db_backup_daily",
                "schedule": crontab(hour=3, minute=0),
            },
            # ── Auto monthly fee generation (BS month 1st) ────────────
            "auto-generate-monthly-fees": {
                "task": "auto_generate_monthly_fees",
                "schedule": crontab(hour=0, minute=45),  # daily; task checks BS day
            },
            # ── AI insights weekly (Sunday 06:00) ─────────────────────
            "ai-insights-weekly-dispatch": {
                "task": "dispatch_ai_insights_weekly",
                "schedule": crontab(hour=6, minute=0, day_of_week=0),
            },
            # ── Admission follow-up daily (09:00) ─────────────────────
            "admission-followup-daily": {
                "task": "dispatch_admission_followups",
                "schedule": crontab(hour=9, minute=0),
            },
            # ── GPS: Firebase RTDB poller (device cadence is 15 s) ────
            "poll-firebase-gps": {
                "task": "poll_firebase_gps",
                "schedule": 15.0,
                "options": {"queue": "gps", "expires": 14},
            },
            # ── Plugin trial expiry (hourly) ──────────────────────────
            "plugin-trial-expiry-hourly": {
                "task": "expire_trials",
                "schedule": crontab(minute=0),
            },
            # ── AI Teacher reconciler (every 10 min) + nightly purge ──
            # T-20: the plugin's tasks were plain functions; these beat
            # entries plus app/tasks/ai_teacher.py make them runnable.
            "ai-teacher-reconcile-lessons": {
                "task": "ai_teacher_reconcile_lessons",
                "schedule": 600.0,
            },
            "ai-teacher-purge-transcripts": {
                "task": "ai_teacher_purge_transcripts",
                "schedule": crontab(hour=3, minute=40),
            },
            # ── S-A1 fees depth: stale gateway initiations (hourly) ───
            # Every gateway session expires inside an hour; leaving the row
            # 'initiated' forever makes dues lie and invites double-payments.
            "sweep-pending-fee-initiations": {
                "task": "sweep_pending_fee_initiations",
                "schedule": crontab(minute=15),
            },
            # ── S-A1 fees depth: daily late-fine accrual (00:35 NST ≈
            # 18:50 UTC) — schools without a fine policy are skipped inside
            # the task.
            "fee-fines-accrual-daily": {
                "task": "accrue_fee_fines_daily",
                "schedule": crontab(hour=18, minute=50),
            },
            # ── S-A4 transport: publish today's instances (every 5 min) +
            # force-end stale runs (hourly) ─────────────────────────────
            "publish-transport-instances": {
                "task": "publish_transport_instances",
                "schedule": 300.0,
            },
            "force-end-stale-transport": {
                "task": "force_end_stale_transport",
                "schedule": crontab(minute=40),
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

        def _resolve_jwt_user():
            """Resolve the authenticated user from the JWT (best-effort).

            Runs for EVERY request — including subdomain/header-resolved
            ones — because endpoints read ``g.current_user`` regardless of
            how the school was resolved. Without this, mobile clients
            (Bearer + X-School-Slug) hit AttributeError 500s on any
            endpoint touching g.current_user.
            """
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
                        g.current_user_lookup_failed = True
                        db.session.rollback()
                        g.current_user = None
            except Exception:
                # Resolution is best-effort; roll back so the request's handlers
                # start from a clean transaction instead of an aborted one.
                db.session.rollback()

        _resolve_jwt_user()

        def _cross_tenant_response(school):
            """403 response when the authenticated user resolved a school they
            do not belong to, else None (S-01 tenant isolation).

            Subdomains and the X-School-Slug header are untrusted request
            data: a valid school-A token + school-B header must not grant
            school-B access. Unauthenticated requests (public website,
            login) pass through — endpoint auth handles those. A signed JWT
            whose user row is missing (deleted account, lookup failure) is
            denied: the token must not ride a resolved school context (B2).
            """
            user = g.current_user
            if user is None:
                # Deny ONLY a verifiable-but-missing identity: a signed JWT
                # whose sub parses to a UUID but whose user row is gone
                # (deleted account / stale token) must not ride a resolved
                # school context (B2). An unparseable or absent sub passes
                # through — endpoint auth handles it, as for anonymous
                # requests; our login never issues such tokens.
                if g.role is None or g.user_id is None or not isinstance(
                    g.user_id, UUID
                ):
                    return None
                if g.get("current_user_lookup_failed"):
                    # A failed lookup can mean an aborted session (e.g. a
                    # failed startup seed) rather than a deleted user —
                    # retry once on a clean session before denying.
                    try:
                        from app.models.user import User as _U

                        db.session.rollback()
                        g.current_user = _U.query.filter_by(
                            id=g.user_id, is_deleted=False
                        ).first()
                        g.current_user_lookup_failed = False
                    except Exception:
                        db.session.rollback()
                    user = g.current_user
                if user is None:
                    from app.utils.response import error_response

                    return error_response(
                        "Your account does not belong to this school.", 403
                    )
            if g.role == "superadmin":
                return None
            user_school_id = getattr(user, "school_id", None)
            if user_school_id is not None and str(user_school_id) == str(school.id):
                return None
            from app.utils.response import error_response

            return error_response(
                "Your account does not belong to this school.", 403
            )

        # 1. Try subdomain resolution
        host = request.host.split(":")[0]
        base = app.config.get("BASE_DOMAIN", "brighternepal.com")
        if host.endswith(base) and host != base and host != f"www.{base}":
            slug = host.replace(f".{base}", "")
            school = School.query.filter_by(slug=slug, is_active=True).first()
            if school:
                denial = _cross_tenant_response(school)
                if denial is not None:
                    return denial
                _set_school_context(school)
                return

        # 1.5. Try X-School-Slug header (mobile apps)
        slug_header = request.headers.get("X-School-Slug", "").strip()
        if slug_header:
            school = School.query.filter_by(slug=slug_header, is_active=True).first()
            if school:
                denial = _cross_tenant_response(school)
                if denial is not None:
                    return denial
                _set_school_context(school)
                return

        # 2. Fallback: resolve school from JWT school_id claim (for localhost / dev)
        from flask_jwt_extended import get_jwt as _get_jwt
        try:
            claims = _get_jwt()
            school_id = claims.get("school_id")
            if school_id:
                # The claim is data, not a key: a non-UUID value ("reports")
                # must skip resolution, not 500 on a Postgres uuid cast.
                try:
                    school_uuid = UUID(str(school_id))
                except (TypeError, ValueError, AttributeError):
                    school_uuid = None
                if school_uuid is not None:
                    school = School.query.filter_by(id=school_uuid, is_active=True).first()
                    if school:
                        denial = _cross_tenant_response(school)
                        if denial is not None:
                            return denial
                        _set_school_context(school)
        except Exception:
            # Resolution is best-effort; roll back so the request's handlers
            # start from a clean transaction instead of an aborted one.
            db.session.rollback()

    def _set_school_context(school):
        g.school = school
        g.school_id = school.id
        cache_key = f"school:{school.id}:plugins"
        plugins = cache.get(cache_key)
        if plugins is None:
            from datetime import datetime, timezone

            from app.models.plugin import SchoolPlugin

            now = datetime.now(timezone.utc)

            def _trial_expired(sp) -> bool:
                """True when an active trial row's trial_ends_at has passed."""
                if not sp.is_trial or sp.trial_ends_at is None:
                    return False
                ends = sp.trial_ends_at
                if ends.tzinfo is None:
                    ends = ends.replace(tzinfo=timezone.utc)
                return ends < now

            rows = SchoolPlugin.query.filter_by(
                school_id=school.id, active=True
            ).all()
            # Defense-in-depth: even if a row is still active=True (e.g. the
            # hourly expire_trials beat task has not run yet), exclude
            # trial-expired installs so unpaid trials stop granting access.
            plugins = [
                sp.plugin_slug
                for sp in rows
                if not _trial_expired(sp)
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

    # WP-style catalog: the plugins directory is the source of truth. Sync
    # the DB mirror rows (create/update/unpublish orphans) so a fresh deploy
    # gets a full marketplace with ZERO plugin seeding. Best-effort — a
    # refresh failure must never prevent the app from starting. Needs an app
    # context (Flask-SQLAlchemy 3 session) — create_app does not push one.
    try:
        with app.app_context():
            PluginLoader.refresh_registry()
    except Exception as e:  # noqa: BLE001 — startup resilience
        app.logger.error("Plugin registry refresh failed at startup: %s", e)

    # ai_workbench: registry + nutrition facts seed (AW-01/AW-03) and the
    # platform CDC/NEB curriculum seed (A-04). Idempotent; best-effort so a
    # seed failure never blocks boot.
    try:
        with app.app_context():
            from app.services.ai.workbench_seed import seed_workbench_tools

            seed_workbench_tools()
    except Exception as e:  # noqa: BLE001
        app.logger.error("ai_workbench seed failed at startup: %s", e)
    try:
        with app.app_context():
            from app.services.ai.curriculum_seed import seed_curriculum

            seed_curriculum()
    except Exception as e:  # noqa: BLE001
        app.logger.error("curriculum seed failed at startup: %s", e)
    try:
        with app.app_context():
            from app.services.ai.extensions import seed_pd_framework

            seed_pd_framework()
    except Exception as e:  # noqa: BLE001
        app.logger.error("PD framework seed failed at startup: %s", e)

    # D-07: audit trail on the sensitive-table set (money/identity/grades)
    from app.utils.audit_trail import register_audit_listeners

    register_audit_listeners()

    # Register cross-plugin event listeners
    from app.plugins import listeners  # noqa: F401 — registers @on() handlers

    # Socket.IO rooms for realtime events (join_school / leave_school)
    from app import realtime  # noqa: F401 — registers socketio.on() handlers

    # ── CSRF guard for cookie-authenticated requests ────────────────────
    # Bearer-token clients (mobile apps, tests) are unaffected. Browser
    # sessions rely on HttpOnly cookies, so state-changing requests without
    # an Authorization header must present a same-site Origin/Referer.
    @app.before_request
    def csrf_protect_cookie_auth():
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return None
        # Gateway webhooks are authenticated by HMAC signatures / signature
        # headers, not cookies, and are POSTed by gateway servers (and by
        # eSewa's browser redirect) — the CSRF guard must never block them.
        if request.path.startswith("/webhooks/"):
            return None
        if request.headers.get("Authorization"):
            return None
        if not (request.cookies.get("access_token") or request.cookies.get("refresh_token")):
            return None
        # Session establishment/rotation endpoints are unauthenticated by
        # nature (or rotation-only) — SameSite=Lax covers them. Everything
        # else that mutates state with a cookie still requires same-site
        # Origin/Referer (e.g. /auth/change-password stays protected).
        _path = request.path.rstrip("/")
        if _path.endswith(
            (
                "/auth/login",
                "/auth/verify-otp",
                "/auth/student-login",
                "/auth/send-otp",
                "/auth/register",
                "/auth/refresh",
                "/auth/logout",
            )
        ):
            return None

        origin = request.headers.get("Origin") or request.headers.get("Referer")
        # Browser fetch-metadata attests same-origin directly. This must be
        # accepted BEFORE the host comparison: the Next.js dev/dashboard proxy
        # rewrites the Host header, so Flask sees a request_host (flask:5000)
        # that never equals the browser origin (app.aschool…/localhost:3003) —
        # the old check 403'd EVERY cookie-authenticated dashboard mutation.
        if request.headers.get("Sec-Fetch-Site") == "same-origin":
            return None
        if not origin:
            return jsonify(success=False, data=None, error="CSRF check failed: missing Origin"), 403

        from urllib.parse import urlparse

        origin = origin.rstrip("/")
        origin_host = urlparse(origin if "://" in origin else f"https://{origin}").netloc.lower()
        request_host = request.host.lower()
        base = (app.config.get("BASE_DOMAIN") or "").lower()
        # Same origin trust as the CORS layer: any origin CORS already allows
        # (explicit list entries + the *.base regex) is a legitimate dashboard.
        _string_origins = {o.rstrip("/") for o in _cors_origins if isinstance(o, str)}
        _regex_origins = [o for o in _cors_origins if hasattr(o, "match")]
        allowed = (
            origin_host == request_host
            or (base and origin_host == base)
            or (base and origin_host.endswith("." + base))
            or origin in _string_origins
            or any(o.match(origin) for o in _regex_origins)
        )
        if not allowed:
            return jsonify(success=False, data=None, error="CSRF check failed: cross-origin request"), 403
        return None

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

    # AITokenHub quota exhaustion — every AI endpoint raises this when the
    # school is over its daily/monthly token budget (or has no quota row).
    # Registered once here so NO endpoint needs its own try/except to return
    # a clear 429 instead of an opaque 500 (design_studio /ai/suggest keeps
    # its local catch — same response shape).
    from app.services.ai.token_hub import QuotaExceededError, AIProviderError

    @app.errorhandler(QuotaExceededError)
    def ai_quota_exceeded(e):
        return (
            jsonify(
                success=False,
                data=None,
                error=str(e),
                quota={"reason": e.reason, "used": e.used, "limit": e.limit},
            ),
            429,
        )

    # Provider missing/misconfigured/unreachable (bad key, provider outage).
    # Honest 502 so AI pages show a clear failure instead of an opaque 500.
    @app.errorhandler(AIProviderError)
    def ai_provider_error(e):
        return (
            jsonify(
                success=False,
                data=None,
                error=str(e),
            ),
            502,
        )

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
        # Redirects are explicitly cacheable (especially 308). A cached
        # redirect keyed on a proxied absolute URL (e.g. the docker-internal
        # host behind the Next.js /api rewrite) poisons browsers until the
        # cache expires — so never let one be cached. (E175 follow-up.)
        if 300 <= response.status_code < 400:
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not app.debug:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            # The Flask app serves JSON APIs, PDFs and uploaded files — no HTML
            # documents with inline scripts. HTML rendering lives in the Next.js
            # tier, which sets its own CSP. A deny-everything policy is therefore
            # both safe here and removes the previous unsafe-inline/unsafe-eval.
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "frame-ancestors 'none'; "
                "img-src 'self' data:; "
                "style-src 'self'; "
                "font-src 'self'; "
                "base-uri 'none'; "
                "form-action 'none'"
            )
        return response

    # Serve locally-uploaded files (dev fallback when R2 is not configured).
    # S-12: the upload dir is not world-readable by policy — visibility comes
    # from the ManagedFile row (public → anyone; school_only/private → an
    # authenticated member of the owning school), with private caching.
    @app.route("/uploads/<path:filepath>")
    def serve_upload(filepath):
        import os

        from flask import send_from_directory

        from app.models.file import ManagedFile

        upload_dir = os.getenv("LOCAL_UPLOAD_DIR")
        if not upload_dir:
            upload_dir = "/app/uploads" if os.path.isdir("/app") else os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "uploads",
            )
        record = ManagedFile.query.filter(
            ManagedFile.key.in_([filepath, filepath.lstrip("/")]),
            ManagedFile.is_deleted.is_(False),
        ).first()

        if record is None:
            # Untracked file: only serve if it lives under a school-scoped
            # path AND the requester belongs to that school. The school id
            # is whichever path segment is a UUID — folder layouts differ
            # (`reports/<school_id>/<name>.pdf`, `<school_id>/general/…`),
            # and the old first-segment-only guess queried
            # School(id="reports") → DataError 500 on every report PDF.
            from uuid import UUID as _UUID

            def _is_uuidish(value: str) -> bool:
                try:
                    _UUID(value)
                    return True
                except (ValueError, AttributeError, TypeError):
                    return False

            school_scope = next(
                (seg for seg in filepath.split("/") if _is_uuidish(seg)),
                None,
            )
            if not school_scope:
                return jsonify(success=False, error="Not found"), 404
            from app.models.school import School

            try:
                scope_school = School.query.filter_by(id=_UUID(school_scope)).first()
            except ValueError:
                return jsonify(success=False, error="Not found"), 404
            if scope_school is None:
                return jsonify(success=False, error="Not found"), 404
            if not _upload_requester_in_school(scope_school.id):
                return jsonify(success=False, error="Authentication required"), 401
        elif record.is_public != "public":
            if not _upload_requester_in_school(record.school_id):
                return jsonify(success=False, error="Authentication required"), 401

        response = send_from_directory(upload_dir, filepath)
        if record is None or record.is_public != "public":
            response.headers["Cache-Control"] = "private, max-age=0"
        return response

    def _upload_requester_in_school(school_id) -> bool:
        """True when the current request carries a valid token (cookie or
        Bearer) for a user belonging to school_id — superadmins may fetch
        any school's files."""
        from flask_jwt_extended import get_jwt, verify_jwt_in_request

        try:
            verify_jwt_in_request(optional=True)
            claims = get_jwt() or {}
            if claims.get("role") == "superadmin":
                return True
            return str(claims.get("school_id") or "") == str(school_id)
        except Exception:
            return False

    return app
