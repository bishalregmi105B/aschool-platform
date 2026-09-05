# W3-A1a — Backend Bootstrap & Request Lifecycle

Scope: `backend/app/__init__.py` (820 L), `backend/config.py` (356 L),
`backend/extensions.py`, `backend/app/extensions.py`, `backend/app/celery_app.py`,
`backend/app/realtime.py`, `backend/wsgi.py`, `backend/requirements.txt`,
`backend/Dockerfile`. Every claim carries `path:line`.

## 1.1 Entry points

| Entry | path:line | Notes |
|---|---|---|
| Gunicorn WSGI | `backend/wsgi.py:6` | `create_app(os.getenv("FLASK_ENV","development"))` — **defaults to development**, so a prod container without FLASK_ENV skips `ProductionConfig.validate()` entirely (`backend/app/__init__.py:92`). |
| Celery worker/beat | `backend/app/celery_app.py:7-8` | builds its own app and **pushes a permanent app context** (`flask_app.app_context().push()`), never popped. |
| Task registration | `backend/app/celery_app.py:11` | `import app.tasks` — only here; the web process never imports tasks, so `send_task`-by-name from web relies on the worker having them. |
| Container CMD | `backend/Dockerfile:26` | `gunicorn --worker-class eventlet -w 4 wsgi:app`; `FLASK_APP=wsgi:app` at `:23`. |

`backend/app/extensions.py:1-16` is a pure re-export alias of the top-level
`backend/extensions.py` (two import paths for the same singletons; `redis_client`
is re-exported **by value at import time** at `app/extensions.py:3`, so anything
importing `from app.extensions import redis_client` gets `None` forever because
`init_redis` rebinds only the module global in `backend/extensions.py:26-28`).

## 1.2 create_app() ordered boot sequence

| # | Step | path:line |
|---|---|---|
| 1 | `Flask(__name__)`, `config.from_object(config[name])` | `app/__init__.py:88-89` |
| 2 | `ProductionConfig.validate()` (production only) | `app/__init__.py:92-94` |
| 3 | `_setup_logging` (JSON logs only when `ENV == production`) | `app/__init__.py:97`, `:27-28` |
| 4 | `JWT_COOKIE_SECURE` derived from `COOKIE_SECURE=auto` | `app/__init__.py:101-102` |
| 5 | `ProxyFix(x_for=1,x_proto=1,x_host=1)` | `app/__init__.py:109` |
| 6 | Sentry init (Flask+Celery+SQLAlchemy, traces 0.1) | `app/__init__.py:112-135` |
| 7 | `db/migrate/jwt` init | `app/__init__.py:138-140` |
| 8 | `@jwt.token_in_blocklist_loader` | `app/__init__.py:143-176` |
| 9 | CORS origin list build | `app/__init__.py:180-225` |
| 10 | `@after_request normalize_preflight_response` (200→204) | `app/__init__.py:232-243` |
| 11 | `cors.init_app` | `app/__init__.py:245-258` |
| 12 | `limiter/cache/init_redis/socketio` | `app/__init__.py:260-281` |
| 13 | `celery.conf.update` + beat schedule | `app/__init__.py:284-364` |
| 14 | `ContextTask` wrapper | `app/__init__.py:366-371` |
| 15 | `@before_request resolve_school` | `app/__init__.py:374-483` |
| 16 | `api_v1_bp` @ `/api/v1` | `app/__init__.py:521-523` |
| 17 | `webhooks_bp` @ `/webhooks` | `app/__init__.py:526-528` |
| 18 | `PluginLoader.discover_and_register(app)` | `app/__init__.py:531-533` |
| 19 | `PluginLoader.refresh_registry()` — **DB writes at boot** | `app/__init__.py:540-544` |
| 20 | `seed_workbench_tools()` — **DB writes at boot** | `app/__init__.py:549-555` |
| 21 | `seed_curriculum()` — **DB writes at boot** | `app/__init__.py:556-562` |
| 22 | `seed_pd_framework()` — **DB writes at boot** | `app/__init__.py:563-569` |
| 23 | `register_audit_listeners()` | `app/__init__.py:572-574` |
| 24 | `app.plugins.listeners` import (registers `@on()`) | `app/__init__.py:577` |
| 25 | `app.realtime` import (socketio handlers) | `app/__init__.py:580` |
| 26 | `@before_request csrf_protect_cookie_auth` | `app/__init__.py:586-647` |
| 27 | Error handlers 400/401/403/404/422/429/500 + AI | `app/__init__.py:650-708` |
| 28 | `/health`, `/ready` | `app/__init__.py:711-735` |
| 29 | `@after_request set_security_headers` | `app/__init__.py:738-766` |
| 30 | `/uploads/<path:filepath>` | `app/__init__.py:772-803` |

## 1.3 Middleware execution order (actual runtime)

before_request, in registration order:
1. `_assign_request_id` — **production only** (`app/__init__.py:53-58`); in dev/test
   `g.request_id` never exists, so `X-Request-ID` is not echoed.
2. `resolve_school` (`app/__init__.py:374`) — can short-circuit with 403.
3. `csrf_protect_cookie_auth` (`app/__init__.py:586`).

Consequence: **CSRF runs AFTER tenancy resolution**, so a cross-origin cookie
request still performs the School lookup + JWT verification + plugin-cache read
before being rejected — wasted DB work but not a security hole.

after_request handlers run in **reverse** registration order (Flask semantics):
`set_security_headers` (registered last, runs first) → `_log_request` (prod only)
→ `flask-cors` header injection → `normalize_preflight_response` (registered
first, runs last). The comment at `app/__init__.py:228-231` documents that the
preflight rewrite is deliberately registered before `cors.init_app` so it can
observe the CORS headers.
## 1.4 `resolve_school` tenancy semantics

Sets `g.school/g.school_id/g.user_id/g.current_user_id/g.current_user/g.role/
g.installed_plugins` to None/[] first (`app/__init__.py:376-382`).

Resolution order:
1. `_resolve_jwt_user()` always runs (`app/__init__.py:386-421`): optional JWT
   verify, `g.role` from claims, `g.user_id = UUID(sub)` (falls back to the raw
   string when not a UUID — `:402-404`), then a `User.query.filter_by(id, is_deleted=False)`
   **row load on every request** (`:409-412`).
2. Subdomain: `host.endswith(BASE_DOMAIN)` and not base/www → `slug = host.replace(f".{base}","")`
   (`:445-449`). **`str.replace` is unanchored**: host `a.brighternepal.com.brighternepal.com`
   yields slug `a`; also a deep subdomain `x.y.brighternepal.com` yields slug `x.y`.
3. `X-School-Slug` header (mobile) (`:457-466`).
4. JWT `school_id` claim fallback (`:468-479`).

Cross-tenant guard `_cross_tenant_response` (`app/__init__.py:423-442`): returns
403 when an authenticated non-superadmin's `user.school_id` differs from the
resolved school. Failure modes:
- **Unauthenticated requests always pass** (`:433-434` returns None when
  `user is None`) — by design for public site/login.
- **Users with `school_id IS NULL` bypass the check** (`:435-436`: guard only
  fires when `user_school_id is not None`). `User.school_id` is nullable
  (`app/models/user.py:25`), so a null-school non-superadmin user can resolve ANY
  school by subdomain/header.
- Silent no-op when no branch matches: `g.school_id` stays None; endpoints must
  use `@school_required` (`app/utils/decorators.py:33-49`) or they operate
  unscoped.
- Every `except Exception` path does `db.session.rollback()` (`:414,419,483`), so
  a failed resolve silently discards nothing but also masks real DB errors.

`_set_school_context` (`app/__init__.py:485-518`) caches `school:<id>:plugins`
for 300 s and filters trial-expired rows in Python (`:497-516`). Invalidation
exists at `app/plugins/billing.py:281`, `app/plugins/entitlements.py:358`,
`app/tasks/trial_expiry.py:57` — no invalidation on School deactivation or on
`refresh_registry` unpublish, so a plugin unpublished at boot can stay live for
up to 5 min per school.
## 1.5 CORS / CSRF / security-header posture

CORS (`app/__init__.py:180-258`): explicit origin list + **anchored** regex
`^https://[^./]+\.{base}$` (`:189`) — single-label subdomains only, correctly
anchored at both ends. `supports_credentials=True` (`:250`), allowed headers
include `X-School-Slug` (`:253`). 18 hardcoded localhost/127.0.0.1 dev origins
(`:196-213`) are present in **all** environments including production — a prod
deployment therefore trusts `http://localhost:*` origins.
Extra origins from `CORS_ALLOW_ORIGINS` / legacy `CORS_EXTRA_ORIGINS` (`:219-225`).

Socket.IO origins are a **separate, narrower** list (`app/__init__.py:263-268`):
only ports 3000/3001/8080/8090/8091 — Flutter-web dev ports 8092-8095 can do REST
but not sockets.

CSRF (`app/__init__.py:586-647`): guard applies only when (a) method mutates,
(b) path not `/webhooks/*` (`:593`), (c) **no `Authorization` header** (`:595` —
any Bearer client is exempt), (d) an `access_token`/`refresh_token` cookie exists
(`:597`). Bypass list at `:604-614` (login, verify-otp, student-login, send-otp,
register, refresh, logout). `Sec-Fetch-Site: same-origin` short-circuits before
host comparison (`:623`). Otherwise Origin/Referer host must equal request host,
equal/end with BASE_DOMAIN, or match the CORS allow-list (`:636-644`). Because
the CORS list contains localhost entries, `Origin: http://localhost:3000` passes
CSRF in production too.

Security headers (`app/__init__.py:738-766`): nosniff, `X-Frame-Options: DENY`,
XSS-Protection, Referrer-Policy, Permissions-Policy always; HSTS + a
`default-src 'none'` CSP only when `not app.debug` (`:751-765`); 3xx responses
forced `Cache-Control: no-store` (`:744-745`).

JWT blocklist (`app/__init__.py:143-176`): per-user `tokens_invalid_before`
cutoff (fail-open, rollback on error, `:168-171`) plus `RevokedToken.is_revoked(jti)`
which is deliberately **not** wrapped (`:173-176`). Note the dead branch at
`:156-157` (`if identity and not ... == "refresh": pass`).

## 1.6 Error handlers

`400/401/403/404/422/429/500` all return `{"success":false,"data":null,"error":…}`
(`app/__init__.py:650-708`). `QuotaExceededError` → 429 with a `quota` block
(`:681-691`); `AIProviderError` → 502 (`:695-704`). Both imported from
`app.services.ai.token_hub` at `:679` — an import error there is fatal to boot.
No handler for `SchoolIsolationError` (`app/models/base.py:78`), so a missing
`school_id` surfaces as a 500.
## 1.7 Boot-time side effects (every DB write at import/boot)

| Side effect | Trigger | Writes | Idempotency |
|---|---|---|---|
| Plugin catalog mirror | `app/__init__.py:542` → `app/plugins/loader.py:441-523` | INSERT/UPDATE `plugins`; sets `is_published=False` on orphans (`:506-512`); 2 commits (`:502`, `:514`) | by `slug` lookup (`:488`) |
| AI tool registry + nutrition | `app/__init__.py:553` → `app/services/ai/workbench_seed.py:503-553` | INSERT/UPDATE `ai_tool_registry` (`:511-514`), `ai_nutrition_facts` (`:533-536`) | by `tool_key` |
| CDC/NEB curriculum | `app/__init__.py:560` → `app/services/ai/curriculum_seed.py:52-120` | INSERT `curriculum_frameworks` (50 rows: 10 grades × 5 subjects), `curriculum_units`, `subject_offerings` (8) | filter_by board/grade/subject_code with `school_id=None` (`:65-67`) |
| UNESCO PD framework RAG chunks | `app/__init__.py:567` → `app/services/ai/extensions.py:40-85` | INSERT `document_chunks` (`school_id=None`, source_type `policy`) + best-effort embeddings via `RAGService.ingest` (`:81`) — **an LLM/embedding provider call at boot** | count check (`:49-53`) + per-chunk lookup (`:57-62`) |

All four are wrapped in `try/except` with `app.logger.error` (`app/__init__.py:543,554,561,568`)
and each pushes its own `app_context()`.

Cost: **4 seed passes on every worker start**. With gunicorn `-w 4`
(`backend/Dockerfile:26`) plus celery worker + beat, that is 6 concurrent processes
racing the same idempotency checks (read-then-insert, no advisory lock, no
`ON CONFLICT`) → duplicate-key errors / duplicate rows are possible on a cold DB.

A fifth lazy DDL side effect exists **at request time**, not boot:
`app/services/ai/extensions.py:120-126` runs `CREATE TABLE IF NOT EXISTS
teacher_pd_progress (teacher_id uuid PRIMARY KEY, …)` inside the
`/ai/ext/pd/progress` handler, then `:139-142` upserts with
`ON CONFLICT (teacher_id, domain_index)` — a constraint that **does not exist**
(the PK is `teacher_id` alone), so every POST to that endpoint raises
`InvalidColumnReference`. Table is outside Alembic and outside `models/`.

## 1.8 Config posture (`backend/config.py`)

- `_env()` (`:30-52`): dev/test keep literal fallbacks; other envs get a
  **per-process random secret** + warning — tokens then break across the 4
  gunicorn workers unless the env var is set.
- Pool: `pool_size=20, pool_recycle=300, pool_pre_ping=True` (`:64-68`), no
  `max_overflow` → default 10; 6 processes × 30 = up to 180 Postgres connections.
- `JWT_TOKEN_LOCATION = ["headers","cookies"]` (`:81`), `JWT_COOKIE_CSRF_PROTECT = False`
  (`:86`) — cookie CSRF is entirely the hand-rolled guard's job.
- `ProductionConfig.validate()` (`:270-348`) fails boot on: placeholder/short
  `SECRET_KEY`/`JWT_SECRET_KEY`, missing `DATABASE_URL`, missing
  `ISR_REVALIDATE_SECRET`, Stripe key without webhook secret, `r2` backend with
  missing R2 vars, WhatsApp token without app secret, and missing/console SMS.
  It is only reachable when `FLASK_ENV=production` (`app/__init__.py:92`).
- `CELERY_TIMEZONE=Asia/Kathmandu` (`:202`) with `enable_utc=False`
  (`app/__init__.py:287`) — all beat crontabs are NPT.
## 1.9 Blueprint table

Root mounts: `api_v1_bp` → `/api/v1` (`app/__init__.py:523`), `webhooks_bp` →
`/webhooks` (`app/__init__.py:528`, defined `app/api/webhooks/__init__.py:13`,
routes: esewa/khalti/fonepay callbacks, whatsapp GET+POST, stripe — `:23,97,168,252,323,484`).

Statically mounted under `/api/v1` (registration lines in `app/api/v1/__init__.py`):

| Blueprint | url_prefix | Module | Reg. line |
|---|---|---|---|
| auth | `/auth` | `app/api/v1/auth.py:16` | `:69` |
| schools | `/schools` | `schools.py:16` | `:70` |
| super_admin | `/super-admin` | `super_admin.py:13` | `:71` |
| users | `/users` | `users.py:20` | `:72` |
| students | `/students` | `students.py:23` | `:73` |
| staff | `/staff` | `staff.py:13` | `:74` |
| plugins | `/plugins` | `plugins.py:35` | `:75` |
| academics | `/academics` | `academics.py:30` | `:76` |
| analytics | `/analytics` | `analytics.py:24` | `:77` |
| mobile | `/mobile` | `mobile.py:18` | `:78` |
| parent_app | `/parent` | `parent_app.py:39` | `:79` |
| student_app | `/student` | `student_app.py:24` | `:80` |
| teacher | `/teacher` | `teacher.py:19` | `:81` |
| sse | `/sse` | `sse.py:8` | `:82` |
| webhooks_v1 | (none) | `webhooks.py:12` | `:83` |
| search | `/search` | `search.py:11` | `:87` |
| files | `/files` | `files.py:36` | `:98` |
| iemis_importer | `/iemis` | `iemis_importer.py:36` | `:99` |
| communications | `/communications` | `communications.py:32` | `:100` |
| sliders | `/sliders` | `sliders.py:14` | `:101` |
| themes | `/themes` | `themes.py:10` | `:102` |
| elibrary | `/elibrary` | `elibrary.py:12` | `:103` |
| benchmarking | `/benchmarking` | `benchmarking.py:25` | `:104` |
| design_studio | `/design-studio` | `design_studio.py:11` | `:105` |
| ai_usage | `/ai-usage` | `ai_usage.py:20` | `:113` |
| notifications | `/notifications` | `notifications.py:17` | `:117` |
| faqs | (see file) | `faqs.py` | `:121` |
| db_backup_api | (see file) | `db_backup_api.py` | `:125` |
| hostel | `/hostel` | `hostel.py:12` | `:129` |
| white_label | `/schools/white-label` | shim `white_label.py:2` → `app/plugins/modules/white_label/routes.py:12` | `:133` |
| multi_branch | `/schools` | shim `multi_branch.py:2` → `modules/multi_branch/routes.py:36` | `:138` |
| biometric | `/attendance/biometric` | `modules/biometric/routes.py:49` | `:144` |
| adaptive_learning | `/lms` | `modules/ai_adaptive_learning/routes.py:44` | `:151` |
| disaster_management | `/emergency` | `modules/disaster_management/routes.py:47` | `:163` |
| incident_management | `/incidents/management` | `modules/incident_management/routes.py:50` | `:169` |
| workbench | `/ai` | `ai_workbench.py:21` | `:174` |
| tutor | `/tutor` | `ai_tutor.py:15` | `:178` |
| capture | `/capture` | `ai_capture.py:21` | `:182` |
| ai_extensions | `/ai/ext` | `ai_extensions.py:10` | `:186` |
| teaching_content | `/teaching-content` | `teaching_content.py:38-39` | `:193` |
| db_backup_api | `/database-backup` | `db_backup_api.py:10-11` | `:125` |
| faqs | `/faqs` | `faqs.py:10` | `:121` |

Prefix collisions worth noting: `multi_branch` mounts at bare `/schools`
(`modules/multi_branch/routes.py:36`) — the same prefix as core `schools_bp`
(`app/api/v1/schools.py:16`); Flask allows it because rule strings differ, but a
future core `/schools/<x>` rule can shadow a branch route. `disaster_management`
deliberately shares `/emergency` with the base `emergency` plugin
(`modules/disaster_management/routes.py:47`), and `adaptive_learning` shares
`/lms` with the `lms` plugin (`modules/ai_adaptive_learning/routes.py:44`).

### Dynamically mounted plugin blueprints

`PluginLoader.discover_and_register` (`app/plugins/loader.py:312-326`) mounts
every manifest `api_blueprint` **not** in the static "already mounted" set, with
`url_prefix=f"/api/v1{bp.url_prefix or ''}"` (`loader.py:349-351`). 51 manifests
exist under `app/plugins/modules/*/manifest.yaml` (43 module dirs); 41 declare an
`api_blueprint`; `nepal_curriculum` declares none and `ai_suite` explicitly opts
out (comment in its manifest). A second manifest tree exists at
`app/plugins/manifests/*.yaml` (8 files: dashboard, hostel, marketplace_nav,
plugins_nav, settings_core, students, teachers, users) — only `hostel.yaml:11`
declares an `api_blueprint`, and that blueprint is **also** statically mounted at
`app/api/v1/__init__.py:129`, so the loader's dedupe set is load-bearing.

Manifest → blueprint module pointers that resolve to core `app/api/v1/*` files
(so plugin gating is only via `@plugin_required`, not mounting): academics,
admission, alumni, assignments, attendance, basic_reports→`reports`,
basic_website→`website`, compliance, conferences, design_studio, dismissal,
elibrary→`library`, emergency, exams, fees, file_management→`files`,
gamification, gps_tracking→`transport`, health_records, hr_payroll,
iemis_importer, incidents, inventory, library_management→`library`, lms, notices,
sms_notifications→`sms`, student_portfolio→`portfolio`, timetable,
visitor_management→`visitor`, website_builder, wellbeing, whatsapp_bot.
Note **elibrary and library_management both point at `app.api.v1.library`** — two
marketplace SKUs, one blueprint/table set.
## 1.10 Socket.IO layer (`app/realtime.py`, 159 L)

Handshake auth is enforced (`app/realtime.py:53-100`): token from auth payload →
`Authorization: Bearer` → `access_token` cookie (`:40-50`), `decode_token`,
live-user + `is_active` check (`:75-79`), and the same `tokens_invalid_before`
cutoff as HTTP (`:81-87`). Returning `False` rejects the connection.

Per-connection state lives in a **process-local dict** `_sessions` keyed by
`request.sid` (`app/realtime.py:33`, populated `:92-96`). With gunicorn `-w 4`
(`backend/Dockerfile:26`) this is correct only because eventlet+`message_queue`
keeps a socket's events on the owning worker; the trade-off is that `_sessions`
grows unbounded if `disconnect` is missed (only cleanup is `:158`).

`join_school` ignores client-supplied `school_id` for non-superadmins
(`app/realtime.py:122-125`) and validates the school exists for superadmins
(`:118-121`) — no `is_active` check there, so a superadmin can join a
deactivated school's room. `leave_school` (`:134-153`) mirrors it.

Socket rooms are `school-<id>` (`app/realtime.py:36-37`). Cross-process publish
works because `socketio.init_app(message_queue=REDIS_URL)`
(`app/__init__.py:279-281`), disabled under `TESTING`.

## 1.11 Runtime/image notes

`backend/Dockerfile`: python:3.12-slim, installs `libpango*`/`libgdk-pixbuf`
for WeasyPrint and `postgresql-client` for `pg_dump` (`:5-11`), bakes Devanagari
fonts + `fc-cache` (`:15-16`). No non-root `USER` — the container runs as root.
No healthcheck directive despite `/health` + `/ready` existing
(`app/__init__.py:711-735`).

`backend/requirements.txt`: Flask 3.1.*, Flask-SQLAlchemy 3.1.*, SQLAlchemy 2.0.*,
`pgvector==0.3.*` (`:16` — so RAG embeddings expect a vector column),
`celery[redis]==5.4.*`, `eventlet==0.37.*`, `anthropic==0.42.*`,
`groq>=0.9.0` (`:25` — the only unpinned-upper AI dep), `PyJWT>=2.11.0` and
`qrcode[pil]==8.*` also unbounded. `clamd==1.0.*` (`:78`) needs a sidecar that
`docker-compose.yml` must provide or virus scanning silently degrades.

## 1.12 Lifecycle defect summary (detail + fixes in A1e)

- `wsgi.py:6` defaults to `development` → `ProductionConfig.validate()` skipped.
- `app/extensions.py:3` re-exports `redis_client` by value → permanently `None`.
- `app/services/ai/extensions.py:120-126` runs DDL at request time and
  `:139-142` upserts on a non-existent constraint.
- 4 boot seeds × 6 processes with read-then-insert idempotency.
- 18 localhost origins trusted in production (`app/__init__.py:196-213`) and
  reused by the CSRF allow-list (`:642-643`).
- `User.school_id IS NULL` bypasses `_cross_tenant_response` (`:435-436`).
- No `SchoolIsolationError` handler (raised at `app/models/base.py:78`).
