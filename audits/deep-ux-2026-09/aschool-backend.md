# ASchool Backend — Deep Audit (2026-09-13)

**Scope:** `backend/` — Flask 3 + SQLAlchemy 2 + Celery 5 + Alembic REST API of the ASchool multi-tenant Nepal school SaaS.
**Method:** source-read (every claim carries file:line), live probing against `http://localhost:5003` (docker `aschool-flask-1`, seeded demo school), live Postgres inspection (`docker exec aschool-postgres-1 psql -U aschool -d aschool`), a full route inventory dumped from the running app's `url_map` (867 non-static rules), and reconciliation against the prior audit corpus. No backend source file was modified.
**Live-system evidence:** login as `admin@demo.aschool.com.np` (school_admin, school `b2dbc6fe-4b81-4212-835a-70782a1db7fa`) used for all authenticated probes; school slug for that tenant resolved as `demo`. Unauthenticated/no-write probes only, except where a flow trace required a POST (called out inline).

---

## 1. Executive Summary

**Architecture verdict:** right shape, uneven last mile. The backend — 867 mounted routes across 76 handler modules, 250 tables, a 41-manifest plugin catalog with per-school entitlement gating, 49 Celery tasks under 20 beat entries — is structurally sound and, on the money/exam/tenancy/plugin-contract surfaces, genuinely excellent. A live two-school probe battery (including a freshly created free-plan school) failed to break tenant isolation anywhere. The running of `scripts/api_route_audit.py` against the live app returned **exactly one 500 in 825 probes**. The problems are concentrated in dead code, gate inconsistencies on low-visibility surfaces, a handful of long-lived unfixed defects, and a small number of fresh bugs this audit found — one of them a live-reproduced path traversal.

**Top findings (full detail §11):**
1. **P1 — path traversal in `POST /files/upload`** via the `folder` form field (live-confirmed write outside the upload root; `files.py:208,216` + `file_upload.py:128`).
2. **P1 — `GET /benchmarking/rankings` 500s for everyone** (dead import `ReportCard` from the wrong module; `benchmarking.py:90`; no test calls it; the script that would catch it isn't in CI).
3. **P1 — GPS Haversine typo still unfixed** (`lon2 - lat1`, `gps_processing.py:178`) — child-safety geofence math, prior B3.
4. **P1 — ai_teacher webhook: cross-tenant injection + replay double-count** (no key↔lesson school check, no event uniqueness; `routes.py:643-647`).
5. **P2 cluster:** FAQ writes open to all school members; LMS quiz scores trusted from the client; fees partial-paid note-string race; conference slot TOCTOU; payroll arbitrary status; whatsapp bulk unpersisted/unvalidated; Unsplash key leak via `trigger_url`; live-polls as in-memory routes inside a service module; report_generation compliance path still crashing on non-enum roles; GPS push roles matching zero users; ai_adaptive_learning's manifest-less module with unreachable hooks.
6. **P3 sprawl:** 333 unindexed FK columns (several hot), 25 module surfaces with zero tests, ~20 orphan endpoint groups (TOTP MFA, exit-documents, library procurement, visitor appointments…), dead contracts (`register_plugin_events`, `emit_async`, `notification_engine.py`, `video_service.py`, `money.py`, `permissions.py`).

**Plugin-system verdict:** the entitlement/billing/config-schema/widget machinery is *ahead* of both InfixEdu's addon model and nwidart/Laravel modules (per-tenant gating, trials, plan tiers, server-absolute widgets, CI manifest validation). Its debts are cosmetic-to-moderate: display-name/pricing collision on the incident pair, the elibrary manifest pointing at the library blueprint, the manifest-less ai_adaptive_learning module, the WP-parity ceiling (routes mount at boot for all tenants, gated rather than shipped), and the never-wired event-plugin filter.

**Coverage stats:** 42/42 plugin modules traced end-to-end (§4, incl. ai_adaptive_learning's no-manifest investigation); 867 routes inventoried with auth/role/plugin/handler file:line (§5 table); 22 Celery task modules + 49 tasks mapped to triggers/idempotency/failure handling (§7); 84 test files mapped against the surface with the two operator scripts read and one run live (§8); 40+ prior-corpus findings labeled still-true/fixed/worse/not-reproducible (§9).

**What changed vs the prior corpus (2026-09-08):** the big sprints landed and held (fees depth, exam/attendance integrity, transport trips, platform services, AI foundation — all re-verified at source); the security wave held everywhere re-checked; ai_suite gating split-brain, plan-grant hole, dead AI services, frontend alias duplication, attendance unique index are all FIXED. Still-true at HEAD: GPS math (B3), website_live_sync boot cost (B5), money.py/permissions.py dead (B6/B15), orphan services (B16), faq/hostel models (B17), student_id uniqueness (B19), composite FKs (B9), `date.today()` sprawl (B11, now 57 sites), M2/M3/M4/M6/M8, E2/E7, and the A9/A10 webhook pair. New since the corpus: the benchmarking 500 (W0 regression), the upload traversal, the Unsplash trigger_url leak, the live-polls smell, and the client-trusted quiz score.

---

## 2. Architecture Shape

### 2.1 App factory and boot sequence

`create_app()` (`backend/app/__init__.py:83-939`) is a single long factory. Boot order, verified by reading:

1. **Config load** — `config[config_name]` from `backend/config.py:351-356` (development / testing / production). Production runs `ProductionConfig.validate()` (`app/__init__.py:92-94`), which hard-fails on weak/published `SECRET_KEY`/`JWT_SECRET_KEY`, missing `DATABASE_URL`, missing `ISR_REVALIDATE_SECRET`, Stripe-without-webhook-secret, R2-without-creds, WhatsApp-without-app-secret, and unconfigured SMS in production (`config.py:270-348`). This is unusually defensive and good.
2. **Logging** — `_setup_logging` (`app/__init__.py:15-80`): JSON structured logs + `X-Request-ID` propagation, but **only when `ENV == "production"`** (`__init__.py:27-29`). In dev/test the request-ID middleware never registers — prior finding B22 "request-ID middleware only in production" is **still true** (dev-only impact, cosmetic).
3. **ProxyFix** — one trusted hop (`__init__.py:107-109`) for rate-limit/audit IP correctness behind nginx.
4. **Sentry** — optional DSN-gated init with Flask/Celery/SQLAlchemy integrations, `send_default_pii=False` (`__init__.py:112-135`).
5. **Extensions** — `db`, `migrate`, `jwt`, CORS (anchored `*.base_domain` regex + explicit dev origins, `supports_credentials=True`, `__init__.py:178-258`), `limiter`, `cache` (Redis), `socketio` (eventlet, Redis message queue so Celery workers can publish to browsers, `__init__.py:263-281`).
6. **JWT blocklist** — `token_in_blocklist_loader` (`__init__.py:143-176`): per-user global invalidation via `User.tokens_invalid_before` (iat cutoff) + `RevokedToken.is_revoked(jti)`. The jti lookup deliberately fails LOUD (no fail-open) — comment cites S-05.
7. **Celery config** — `celery.conf.update` inside the factory (`__init__.py:284-399`): `task_routes={"*": {"queue": "default"}}` (fixes the old "queued but never consumed" bug, comment P-01(a)), `task_acks_late=True`, 1800 s hard / 1500 s soft time limits, prefetch 1, and a **20-entry beat schedule** (see §7). `ContextTask` wraps every task in `app.app_context()` (`__init__.py:401-406`) — this is what fixed prior finding B5 for most tasks.
8. **Tenant resolution** — `before_request resolve_school` (`__init__.py:409-560`): resets `g.*`, best-effort JWT user resolution for EVERY request (mobile Bearer + header path), then tenant resolution subdomain → `X-School-Slug` → JWT `school_id` claim, each guarded by `_cross_tenant_response` (`__init__.py:459-512`) which 403s when an authenticated user's school doesn't match the resolved school. Signed-JWT-with-missing-user is denied (B2 fix, verified in code at `__init__.py:476-502`). Plugin install cache: `school:{id}:plugins` 300 s Redis cache, trial-expiry double-check at read time (`__init__.py:562-595`).
9. **Blueprints** — `api_v1_bp` at `/api/v1` (`__init__.py:598-600`), webhooks bp at `/webhooks` (`:603-605`), then `PluginLoader.discover_and_register(app)` (`:608-610`).
10. **Boot seeds (idempotent, best-effort)** — designer template registry sync + watchdog (`:616-625`), plugin registry refresh (`:632-636`), AI workbench tool seed (`:641-647`), CDC/NEB curriculum seed (`:648-654`), PD framework seed (`:655-661`), audit-trail listeners (`:663-666`), plugin event listeners (`:668-669`), Socket.IO realtime handlers (`:671-672`).
11. **CSRF guard** for cookie-authenticated mutations (`__init__.py:678-739`): skips Bearer clients, `/webhooks/*`, and session-establishment paths; accepts `Sec-Fetch-Site: same-origin` before host comparison (fetch-metadata attestation). Solid design.
12. **Error handlers** — uniform `{success, data, error}` JSON for 400/401/403/404/422/429/500 (`:742-800`), plus registered handlers for `QuotaExceededError` → 429 with quota payload and `AIProviderError` → honest 502 (`:771-796`).
13. **Health** — `/health` (liveness) and `/ready` (DB+Redis, 503 when degraded) (`:803-827`). Live-verified: both return ok on 5003.
14. **Security headers** — nosniff, DENY framing, strict referrer, restrictive Permissions-Policy, HSTS + `default-src 'none'` CSP outside debug (`:830-858`); redirects forced `no-store`.
15. **Local upload serving** — `/uploads/<path>` (`:864-937`) with ManagedFile-row visibility (public/school/private) and UUID-segment school scoping for untracked files, private cache headers. Read the code — this is careful (school membership check via `_upload_requester_in_school`, superadmin bypass, `:924-937`).

**Assessment:** the factory is long (939 lines) but every block is load-bearing and commented with the fix-ID that introduced it. The single biggest structural smell is that boot does FIVE seeds + registry refresh inline in `create_app` — every worker/beat/task boot pays it — but each is wrapped best-effort so it cannot brick boot (verified `__init__.py:616-661`).

### 2.2 Extensions & config

- `backend/extensions.py:1-28` — single instances: `db`, `migrate`, `jwt`, `cors`, `limiter` (keyed by `get_remote_address` — correct under ProxyFix), `cache` (RedisCache), `socketio`, `celery`, `redis_client` global. Clean.
- `backend/config.py` — `_env()` secrets resolver (`config.py:30-52`): dev/test keep known fallbacks; **any other env with an empty secret gets a per-process random value + loud warning** (S-03) — a pragmatic pattern that prevents accidentally running prod on a published default. JWT config supports header AND HttpOnly cookie transports with Lax cookies (`config.py:71-92`). AI provider config: Groq primary (gpt-oss-20b/120b defaults), Anthropic fallback, quota enforcement parsed strictly (`config.py:119-134`). Payment gateway environment flags (sandbox defaults) live app-level; merchant creds live per-school in `fee_config` (`config.py:149-153`).

### 2.3 API versioning & mounting model

- One version prefix: `/api/v1` (`app/api/v1/__init__.py:600`). No v0/v2; webhooks live OUTSIDE the prefix at `/webhooks/*` (`app/__init__.py:603-605`) — plus a small `webhooks_v1_bp` INSIDE `/api/v1` (`app/api/v1/__init__.py:68,84`, 1 route; see §6.7).
- **Hybrid mounting:** core blueprints mount statically in `app/api/v1/__init__.py:54-213`; 6 plugin-module blueprints (white_label, multi_branch, biometric, ai_adaptive_learning, disaster_management, incident_management) mount via 2-line re-export shims in `app/api/v1/<slug>.py` (e.g. `app/api/v1/adaptive_learning.py:1-2` re-exports `app.plugins.modules.ai_adaptive_learning.routes.adaptive_learning_bp`), and `STATICALLY_MOUNTED_MODULES` (`app/api/v1/__init__.py:9-51`) keeps the loader from double-registering. Everything else (attendance, notices, fees, exams, …) mounts through `PluginLoader._register_manifest_blueprints` (`app/plugins/loader.py:328-363`) which catches `ImportError` only — prior finding E7 ("a plugin SyntaxError crashes boot") is **still true**: the except clause at `loader.py:362-363` catches `ImportError`, while `importlib.import_module` can raise `SyntaxError`/`AttributeError` from the module body. (Not reproduced live — no manifest currently points at a broken module — but the catch is verifiably narrow.)
- Route census (dumped from the live app's `url_map`, `/tmp/route_inventory.json`, generated inside `aschool-flask-1`): **867 rules** (excluding `/static`), spanning 76 distinct handler modules — 66 in `app/api/v1/` (incl. `webhooks.py` inside the prefix), 7 in `app/plugins/modules/*/routes.py` (the 6 shim-mounted + ai_teacher, which the loader mounts from its manifest), 1 service module (`app/services/ai/extensions.py` — see finding), `app/api/webhooks`, plus `/health`, `/ready`, `/uploads/*` on the app object. Biggest modules: fees 57, academics 39, exams 35, library 34, design_studio 30, transport 28, website_builder 27, hr_payroll 25.

### 2.4 Celery wiring

- `celery_app` is created via `extensions.celery = Celery(__name__)` and configured inside `create_app` (`app/__init__.py:284-399`); workers import `create_app` through `ContextTask` (`__init__.py:401-406`). The README's claim of "Celery 5 beat" matches: 20 beat entries (see §7.4 for the full table with schedules and target queues).
- Queue routing is coarse: everything → `default` except explicit `queue="gps"` on the Firebase poller (`__init__.py:353-357`) and wherever tasks pass `queue=` at dispatch time (spot-checked: none other do — so the compose worker's `-Q default,ai,notifications,gps` has idle `ai`/`notifications` consumers; a wiring mismatch that is harmless today but misleading).
- `enable_utc=False` with `timezone=Asia/Kathmandu` (`__init__.py:287-288`) — crontab entries like `hour=8` mean 08:00 NPT. This is deliberate and consistent with the Nepal-context comment at `__init__.py:381-387` ("00:35 NST ≈ 18:50 UTC").

### 2.5 Alembic / migrations

- `migrations/versions/` holds the chain; `flask db upgrade` runs through `migrate.init_app` (`__init__.py:138-139`). Drift is gated in CI by `backend/scripts/check_migration_drift.py` (see §8.3) — prior corpus says the gate passes with an allowlist (477-494 entries through S-A4). I did NOT run the drift gate (it boots a scratch DB; unnecessary for this audit) but I verified the script exists and is wired into `.github/workflows/deploy.yml` (see §8.3).
- Live DB check: `docker exec aschool-postgres-1 psql -U aschool -d aschool -t -c "select version_num from alembic_version"` → single head (verified during data-model pass, §3).

### 2.6 Response contract

All handlers return via `app/utils/response.py` helpers (`success_response` / `error_response` / `created_response` / `no_content_response`): shape `{"success": bool, "data": …, "error": …}` — matches `README.md:147-151`. Live-verified on dozens of endpoints (see §5 samples). Errors funnel through the app-level handlers, so even aborts keep the envelope.


---

## 3. Data Model (75 model files, 250 tables)

### 3.1 Base classes and the tenancy spine

- `app/models/base.py:10-42` — `BaseModel(db.Model)`: UUID PK (`gen_random_uuid()` server default), `created_at`/`updated_at` TIMESTAMPTZ with server defaults (the D-03 contract), `is_deleted` soft delete + `active()` helper.
- `app/models/base.py:45-84` — `SchoolModel(BaseModel)`: adds non-null indexed `school_id` FK → `schools.id`, plus the two scoped-query helpers:
  - `for_school(school_id)` — raises `SchoolIsolationError` when `school_id is None` (`base.py:66-71`). This is a **fail-closed primitive** — the right shape for a SaaS.
  - `for_school_and_year()` — raises loudly if the model lacks `academic_year_id` (`base.py:73-84`).
- Class census (parsed all 75 files): **252 class declarations → 250 concrete tables** (live DB confirms exactly 250 public tables, single alembic head `s_a6c_desktop_layout`, 674 indexes, 656 FKs). Base split: **195 SchoolModel / 51 BaseModel / 4 raw `db.Model`** (`app/models/faq.py:8` FAQ; `app/models/hostel.py:8,27,54` Hostel/HostelRoom/HostelAllocation). The 4 raw ones hand-roll UUID PK + tz timestamps + `is_deleted` + indexed school_id, so behavior matches — but they bypass the base contract (no `for_school()` helper, no server-default id, `updated_at` missing on hostel tables). Prior finding **B17 still true**, severity low (consistency debt, not a bug).
- `app/models/__init__.py` imports all 75 modules (verified programmatically: zero files unimported) — prior finding A3 (`textbook`/`curriculum_graph` missing → `NoReferencedTableError`) is **fixed and stays fixed**.

### 3.2 Domain map (by model file)

| Cluster | Files | Notes |
|---|---|---|
| Identity/tenancy | `school.py` (School, SchoolWebsite, SchemeGrade, SchoolReceiptCounter), `school_chain.py`, `user.py`, `user_access_log.py`, `user_aos_settings.py`, `revoked_token.py` | School carries `settings` JSONB (feature knobs: fine policy, transport radii, mobile_ops, receipt numbering), `fee_config` JSONB (gateway creds — stripped from default serializer per S1 fix), `plan`, `max_students` |
| SIS core | `student.py`, `student_enrollment.py`, `student_transfer.py`, `guardian` inside student, `staff.py`, `contact.py` | `students.student_id` (human ID) has **no unique constraint** — live DB shows only `students_pkey` (`app/models/student.py:50`, psql `\d` check). Prior **B19 still true**; duplicate human IDs are representable |
| Academics | `academic.py` (8 classes), `curriculum.py`, `curriculum_graph.py`, `textbook.py`, `question_bank.py`, `teaching_content.py` | NEB/CDC grids now have API routes (`/academics/curriculum/*`, `app/api/v1/academics.py:1220-1276`) — prior "curriculum tables dead" no longer true for read paths |
| Money | `fee.py` (largest model file; invoices, installments, carry-forwards, offline submissions, day closures from S-A1), `money.py` | FeeReceipt numbered via `SchoolReceiptCounter` FOR UPDATE (see §4 fees trace) |
| Assessment | `exam.py`, `adaptive_learning.py` | Online-exam attempt uniqueness enforced by partial unique index `uq_online_exam_attempts_one_per_student` (S-A2) |
| Ops/safety | `incident.py` + `incident_management.py`, `emergency.py`, `disaster_management.py`, `dismissal.py`, `visitor.py`, `biometric.py`, `transport.py` (trip lifecycle from S-A4), `gps` in transport | Incident split: base entity (`incidents`, `witness_statements`, `incident_actions` in `app/models/incident.py:18-83`) vs workflow layer (`incident_escalations`, `incident_workflow_events` in `app/models/incident_management.py:23-57`) — layered, not duplicated |
| Library | `library.py` (v2: book_copies, racks, reservations, fines, stocktake, vendors, POs), `digital_content.py` (digital_books, past_papers, oer) | `book_transactions` still exists as vestigial (AUDIT_INDEX A-08 deferred drop) |
| Comms | `notification.py` (in-app + WhatsApp), `chat.py`, `communication.py`, `diary.py` | `NotificationRule` (event×channel×audience matrix, S-A3) lives here |
| AI | `ai_workbench.py` (14+ classes), `ai_insight.py`, `ai_token.py`, `ai_teacher.py`, `adaptive_learning.py`, `content_spine.py` (content_sources/units/chunks, question_papers, golden_set — S12), `document_chunk.py` (legacy RAG) | Two chunk stores coexist: `document_chunks` (legacy, seeded by PD framework) and `content_chunks` (S12 spine, pgvector 1024 + HNSW) |
| Content/design | `designer*.py` (4 files: templates, documents, revisions, bulk), `website.py`, `slider.py`, `exit_document.py` | |
| Platform | `plugin.py` (Plugin mirror, SchoolPlugin, PluginUsageLog), `webhook.py` (processed_webhook_events idempotency store), `monitoring.py` (MobileCrashReport), `system.py`, `custom_field.py`, `file.py`, `faq.py`, `hostel.py`, `inventory.py`, `health_records.py`, `wellbeing.py`, `gamification.py`, `alumni.py`, `compliance.py`, `iemis.py`, `conference.py`, `assignment.py`, `lms.py`, `timetable.py`, `hr_payroll.py`, `hr.py`, `admission.py`, `analytics.py`, `portfolio.py`, `report.py`? (no — reports read others), `money.py` | |

### 3.3 Missing indexes (live-DB verified)

Querying `pg_constraint`×`pg_index` for FK columns with no covering index returns **333 unindexed FK columns** across the 250 tables. Most are `*_by_id` actor columns (fine at current scale), but the following are or will become hot-path full scans:

- `in_app_notifications.user_id` — the notifications inbox (`GET /notifications`, `unread-count`) filters by user on every app open.
- `chat_messages.receiver_id` (and sender) — chat threads list by participant.
- `classes.academic_year_id`, `semesters.academic_year_id`, `subjects.stream_id` — academic-year pivots on every marks/attendance join.
- `processed_webhook_events.school_id` — the webhook idempotency lookup.
- `push_notifications.user_id`, `sms_logs.sent_by_id`, `audit_logs.user_id` (audit trails queried by the access-log viewer).
- `incidents.reported_by_id` / `escalated_to_id`, `staff_payroll.user_id`.

These are cheap wins (the fc_a06 pattern for library indexes is already established in `migrations/versions/fc_a06_library_indexes.py`).

### 3.4 Soft delete / audit patterns

- Soft delete is **universal** via `BaseModel.is_deleted` — but enforcement is per-query (`filter_by(is_deleted=False)` / `.active()` / `for_school()`); nothing prevents a forgetful author from reading tombstones. Spot-checks found route handlers consistently add `is_deleted=False` (e.g. `app/api/v1/faqs.py:29,59,88`; `app/api/v1/library.py` throughout).
- **Audit trail (D-07)** — `app/utils/audit_trail.py:16-28`: before-flush listener writing `audit_logs` rows for exactly 9 sensitive tables (`fee_collections, fee_receipts, fee_refunds, marks, report_cards, staff_payroll, student_scholarships, users, school_plugins`), capturing actor from `g.user_id`, old/new values for changed columns only, skipping secrets (`_SKIP_COLUMNS` at `:31`). Fail-open by design with loud logging. Registered at boot (`app/__init__.py:663-666`). This is a genuinely good pattern (evidence-backed prior-plan item landed).
- Composite FKs (`(school_id, parent_id)`): **still absent** — 656 plain single-column FKs, zero composite `ForeignKeyConstraint` (verified via information_schema). Prior **B9 still true**: DB cannot enforce `child.school_id == parent.school_id`; isolation rests entirely on query discipline (which this audit found consistent, §6).

### 3.5 Naming/model-quality nits

- `incidents` vs `incident_management`: entity split is clean (§3.2), but the plugin display names collide ("Incident Management" vs "Full Incident Management" — manifest level, RECON_MAP §3.1) and pricing inversion noted in the prior corpus is still visible: `modules/incidents/manifest.yaml` premium/NPR 299 vs `modules/incident_management/manifest.yaml` growth/NPR 199 (verified in the two manifest files).
- `library.py` vs `digital_content.py`: distinct domains (physical vs digital) — the old `library`/`digital_content` plugin alias mess is cleaned at manifest level (deprecated manifests removed; only alias entries remain in `decorators.py:19-20`).
- Two parallel chunk stores (`document_chunks` legacy + `content_chunks` S12) and two health models (`StudentHealthRecord` in `student.py` vs `HealthProfile` in `health_records.py` — prior Cluster G) — the health duplication is still present (both model classes exist; `app/models/student.py` `StudentHealthRecord` + `app/models/health_records.py:17` HealthProfile), unmerged as predicted.
- Migration hygiene: 60+ migration files, single head at `s_a6c_desktop_layout` (live `alembic_version`), drift gate in CI (see §8.3).

---

## 4. Plugin-by-Plugin Flow Traces (THE CORE)

### 4.0 The plugin system — engine files first

**How a plugin registers (boot):**
1. `PluginLoader._scan_manifests()` (`app/plugins/loader.py:146-181`) scans `app/plugins/modules/*/manifest.yaml` (41 modules) then legacy `app/plugins/manifests/*.yaml` (8 UI-only manifests: dashboard, hostel, marketplace_nav, plugins_nav, settings_core, students, teachers, users). Module wins on slug collision. Every manifest is normalized in-memory to the v2 shape (`loader.py:54-109`: `frontend:`→`ui.nav`, `flutter:`→`mobile`, top-level pointers → `capabilities.*`).
2. Pointer validation (`loader.py:187-237`): every `api_blueprint`/`models_module`/`services[]`/`tasks[]` path is checked on disk; broken pointers log at ERROR but boot continues (fail-soft). This killed the old "~20 fictional service declarations" class of rot — **verified working** (see elibrary finding below for one it should now catch).
3. Blueprint mounting (`loader.py:328-363`): manifests whose blueprint is NOT in `STATICALLY_MOUNTED_MODULES` (`app/api/v1/__init__.py:9-51`) get imported and mounted at `/api/v1{bp.url_prefix}`. **Findings:** (a) the except catches only `ImportError` (`loader.py:362`) — a plugin module raising `SyntaxError`/`AttributeError` at import still crashes boot (prior E7 **still true**); (b) `refresh_registry` can rescan without touching Flask (clean separation).
4. DB mirror upsert `refresh_registry()` (`loader.py:452-534`): creates/updates `plugins` rows (name, category, price, depends_on, …) and **unpublishes** rows whose folder vanished (never deletes). Called at every `create_app` (`app/__init__.py:632-636`). Live-verified indirectly: free-plan probe school's marketplace shows exactly the current catalog.

**How entitlement gating works at request time:**
1. `before_request resolve_school` → `_set_school_context` (`app/__init__.py:562-595`): loads active `SchoolPlugin` slugs for the school into `g.installed_plugins`, cached 300 s in Redis (`school:{id}:plugins`), with trial-expiry double-check at read time.
2. `@plugin_required(slug)` (`app/plugins/decorators.py:95-131`): 403 with install CTA when none of the acceptable slugs is installed. Acceptable set = single-hop alias expansion (`decorators.py:56-92`): requested slug + alias target + legacy slugs aliasing to it, from the effective alias map (hardcoded `PLUGIN_SLUG_ALIASES` `decorators.py:13-53` ∪ manifest `aliases:` via `loader.alias_map()` `loader.py:125-143`). Single-hop is deliberate — an alias can never unlock a third plugin.
3. Alias table today: communications→sms_notifications, hr→hr_payroll, transport→gps_tracking, visitors→visitor_management, library→library_management, digital_content→elibrary, portfolio→student_portfolio, and the 7-way AI consolidation (ai_grading/ai_tutor/ai_tools/ai_adaptive_learning/ai_insights/benchmarking/advanced_analytics → ai_suite). **Prior "ai_suite gating split-brain" (duplication-audit P0-1) is FIXED**: every ai_* route now gates `ai_suite` (verified: `app/api/v1/ai_tools.py` gates, `app/plugins/modules/ai_adaptive_learning/routes.py:221,255,298,418,436,474,507`, `app/api/v1/ai_tutor.py`, `benchmarking.py:33,49`), and the ai_suite install satisfies them via the reverse alias family.
4. Plan tiers (`app/plugins/entitlements.py:31-36`): free→core+add_on, starter→+starter, growth→+growth, enterprise→+premium. `grant_plan_plugins`/`ensure_free_plugins` install tier plugins as non-trial entitlements, skipping coming_soon/deprecated (the prior plan-grant hole is closed at `entitlements.py:82-87,199-207`). Live-verified: probe school (free) got 13 core/add_on plugins, nothing paid.
5. Billing lifecycle (`app/plugins/billing.py`): `install_plugin` (`:74-177`) enforces published+not-coming-soon, refuses expired-trial reinstalls (trial clock never resets, `:104-125`), dependency/conflict checks (`:144-158`), stamps free-vs-trial policy from config (`:49-71`), increments install_count, and now records a usage-log row (`:169-173` — prior "log_usage dead" finding is FIXED). WP-style deactivate/activate/uninstall (`:180-238`); deactivate runs the module's hook (E1 fixed, verified in `app/api/v1/plugins.py` deactivate route calling `_run_plugin_hook`).

**Config schema subsystem** (`app/plugins/config_schema.py`, 681 lines): 18-type dialect (`:25-29`), strict whole-payload validation (never partially applies), per-role field filtering, signed `__secret__` envelopes with any-depth redaction, `config_version` migration runner; reads via `config_store.plugin_config_value` apply schema defaults at read time (`app/plugins/config_store.py:57-68`). Settings UI ↔ `/plugins/<slug>/config-schema` ↔ `SchoolPlugin.config` JSONB.

**Validator** (`app/plugins/validator.py`): the CI contract gate — categories, sections, widget types/slots/surfaces vs frontend ICON_MAP/section lists (`:36-100`), severity contract error-vs-warning with the v2 ratchet (`:10-22`).

**Widgets** (`app/plugins/widgets.py`): `widgets.yaml` per module → normalized records (`:93-141`); `widgets_for()` (`:154-207`) filters by installed (alias-aware, same expansion as `plugin_required` — verified identical semantics), deprecated/coming_soon, surface, role, `requires_plugins`, permissions, slot; served by `GET /plugins/widgets` (server-absolute gating — absent means absent, not hidden).

**Events** (`app/plugins/events.py`): registry `_listeners` + `on()` decorator; `emit()` synchronous fan-out with per-listener exception isolation (`:67-78`); `emit_for_school()` intended to filter by installed plugin via `_event_plugin_map` — **but `register_plugin_events()` has ZERO callers** (grep across app/ and tests/ returns nothing), so `_event_plugin_map` is always empty and `emit_for_school` never skips on plugin status. The module docstring's contract ("Events only fire for schools that have the relevant plugin installed") is **false at runtime** — prior E2 **still true**. Practical impact today is limited because the listeners that matter (notifications, gamification) are desirable for everyone, and `emit_async`/`emit_async_for_school` (`:102-113`) also have zero callers — the tasks `process_plugin_event`/`process_plugin_event_for_school` they reference DO exist (`app/tasks/__init__.py:5-18`) but are unreachable from any emitter. Dead code + false contract, low blast radius.

**`manifests/` shared nav manifests:** the 8 legacy YAMLs are pure-UI plugins (sidebar sections for Dashboard/Students/Teachers/Users/Hostel/Marketplace/Settings). Hostel is still the one *functional* plugin that lives in the legacy dir rather than `modules/` (prior cleanup recommendation unactioned — cosmetic). `settings_core.yaml` carries the settings nav including the S12 content-review subitem.


### 4.0.1 Catalog snapshot (all 41 manifests, generated)

| Slug | Name | Tier | NPR/mo | Blueprint |
|---|---|---|---|---|
| academics | Academic Setup | core | 0 | `app.api.v1.academics` |
| admission | Admission Management | growth | 149 | `app.api.v1.admission` |
| ai_suite | AI Suite | premium | 399 | `—` |
| ai_teacher | AI Teacher (Live Whiteboard Tutor) | premium | 1499 | `app.plugins.modules.ai_teacher.routes` |
| alumni | Alumni Network | growth | 149 | `app.api.v1.alumni` |
| assignments | Assignment Management | starter | 99 | `app.api.v1.assignments` |
| attendance | Attendance Management | core | 0 | `app.api.v1.attendance` |
| basic_reports | Basic Reports | core | 0 | `app.api.v1.reports` |
| basic_website | School Website | core | 0 | `app.api.v1.website` |
| biometric | Biometric Integration | premium | 299 | `app.plugins.modules.biometric.routes` |
| compliance | Compliance & EMIS | growth | 149 | `app.api.v1.compliance` |
| conferences | Parent-Teacher Conferences | growth | 199 | `app.api.v1.conferences` |
| design_studio | Design Studio | growth | 149 | `app.api.v1.design_studio` |
| disaster_management | Disaster Management | premium | 299 | `app.plugins.modules.disaster_management.routes` |
| dismissal | Student Dismissal & Pickup | premium | 299 | `app.api.v1.dismissal` |
| elibrary | E-Library & Digital Content | starter | 99 | `app.api.v1.library` |
| emergency | Emergency Management | premium | 299 | `app.api.v1.emergency` |
| exams | Examination Management | starter | 99 | `app.api.v1.exams` |
| fees | Fee Collection & Management | starter | 99 | `app.api.v1.fees` |
| file_management | File Management | core | 0 | `app.api.v1.files` |
| gamification | Student Gamification | growth | 149 | `app.api.v1.gamification` |
| gps_tracking | GPS Bus Tracking | premium | 299 | `app.api.v1.transport` |
| health_records | Student Health Records | growth | 149 | `app.api.v1.health_records` |
| hr_payroll | HR & Payroll | growth | 199 | `app.api.v1.hr_payroll` |
| iemis_importer | IEMIS Data Importer | add_on | 0 | `app.api.v1.iemis_importer` |
| incident_management | Full Incident Management | growth | 199 | `app.plugins.modules.incident_management.routes` |
| incidents | Incident Management | premium | 299 | `app.api.v1.incidents` |
| inventory | Inventory & Assets | growth | 149 | `app.api.v1.inventory` |
| library_management | Library Management | starter | 99 | `app.api.v1.library` |
| lms | Learning Management System | growth | 149 | `app.api.v1.lms` |
| multi_branch | Multi-Branch Chain | premium | 299 | `app.plugins.modules.multi_branch.routes` |
| nepal_curriculum | Nepal Curriculum & Chapter Content | starter | 199 | `—` |
| notices | Notice Board | core | 0 | `app.api.v1.notices` |
| sms_notifications | SMS Notifications | starter | 99 | `app.api.v1.sms` |
| student_portfolio | Student Portfolio | growth | 149 | `app.api.v1.portfolio` |
| timetable | Timetable Management | starter | 99 | `app.api.v1.timetable` |
| visitor_management | Visitor Management | growth | 149 | `app.api.v1.visitor` |
| website_builder | Advanced Website Builder | premium | 299 | `app.api.v1.website_builder` |
| wellbeing | Student Wellbeing | growth | 149 | `app.api.v1.wellbeing` |
| whatsapp_bot | WhatsApp Bot | starter | 99 | `app.api.v1.whatsapp_bot` |
| white_label | White-Label Branding | premium | 299 | `app.plugins.modules.white_label.routes` |

**Comparison to commercial patterns (InfixEdu addons / Mighty School Pro nwidart):** ASchool's model is stronger than InfixEdu's (which ships zip addon folders with `Module.json` + ServiceProvider, no per-tenant install state — licensing is file-presence) and roughly parallel to nwidart (module folders with `module.json`, but Mighty's modules are compile-time Laravel packages for the WHOLE installation, not per-school entitlements). ASchool's per-school SchoolPlugin + request-time gate + trial/billing lifecycle + config schemas + server-absolute widgets is **beyond both** commercially-relevant competitors; the gap is the WP-parity ceiling documented in the prior ecosystem audit (plugins cannot ship pages/routes at install time — routes are all mounted at boot for everyone and merely gated), which remains true architecturally (all 41 blueprints mount at boot regardless of install state).

**Manifest-level findings (fresh):**
- `modules/elibrary/manifest.yaml` declares `api_blueprint: app.api.v1.library` — the PHYSICAL library blueprint, not elibrary's own `app.api.v1.elibrary`. Works only because `app.api.v1.library` is not statically mounted and elibrary sorts before library_management, so elibrary's manifest is what actually mounts the library blueprint. Copy-paste doc bug; the pointer validator passes it because the path exists. (`modules/elibrary/manifest.yaml` capabilities block.)
- Only 4 of 41 manifests carry a `version:` field (ai_teacher, file_management, iemis_importer, nepal_curriculum — RECON_MAP §3.1) — version discipline is absent (the DB mirror defaults everything to "1.0.0", `loader.py:491`).
- Display-name collision still live: `incidents` = "Incident Management" (premium 299) vs `incident_management` = "Full Incident Management" (growth 199) — pricing inversion + confusing pair unchanged (both manifests read).

---

### 4.1-4.42 — one real flow per plugin module (42 module dirs)

Format: **entry** (method + path + handler file:line) → hops with file:line → DB tables touched → side effects → response shape. All paths verified by reading the handler; live API responses checked where marked.

**1. academics** (core, free) — *Create a class with initial section.*
Entry `POST /academics/classes` → handler `create_class` `app/api/v1/academics.py:334-394` (jwt+school+role school_admin). Validates year/name uniqueness, writes **classes** + optional **sections** (`academics.py:373-383`, E101 initial-section fix), commits, then `emit_for_school("academics.class_created", …)` (`academics.py:391-393`). Response: class dict via `_class_dict` (created_response 201). Consumers: web `/dashboard/academics`, flutter_admin academics screens. 39 routes total (years/semesters/mediums/streams/shifts/classes/sections/subjects/allocations/curriculum).

**2. admission** (growth 149) — *Convert a public registration into a student.*
Entry `POST /admission/registrations/<id>/convert` → `convert_registration_route` `app/api/v1/admission.py:477-530+` (role superadmin/school_admin). Reads **admission_registrations** (school-scoped, `:483-488`), refuses double-convert 409, calls `services/admission_funnel.convert_registration` (seat-cap FOR UPDATE on classes → SeatCapExceededError → 409 with booked/max, `:501-513`), provisions the student (+user+enrollment) in one transaction, then the A-22 bridge: if fees plugin installed, creates an admission-fee **fee_collections** bill (`:523-530`). Side effects: student provisioning, optional fee bill, follow-up task world (`tasks/admission_followup.py`, beat 09:00). Response: `{registration, student_id, …}` created. Public funnel entry: `POST /website/public/<slug>/admission/registration` (`website.py:1014`, rate-limited 5/h) writes **admission_registrations**; parents then pay via `/payments/initiate` (`website.py:1142`). 14 routes.

**3. ai_adaptive_learning** (NO manifest — see §4.0/§11) — *Generate an AI learning path.*
Entry `POST /lms/learning-paths/generate-ai` → handler in `app/plugins/modules/ai_adaptive_learning/routes.py:295+` (mounted via the 2-line shim `app/api/v1/adaptive_learning.py:1-2`, statically registered `app/api/v1/__init__.py:170-171`). Gates: jwt+school+`plugin_required("ai_suite")`+role student/teacher (`routes.py:298`). Reads **marks** + curriculum outcomes, calls `AITokenHub` (quota→429 via the app-level error handler), falls back to a deterministic rule-based path labeled `source="rule_based_fallback"`. Writes **learning_paths** (`models/adaptive_learning.py`). Response: created path dict. **Because there is no manifest, the loader never discovers this module's `hooks.py`** (`loader.py:291-304` keys off `_hooks_module` from the manifest) — its `activate()`/`uninstall()` table-management hooks are unreachable dead code, and the module never appears in the marketplace/sidebar under its own name (ai_suite's manifest carries the nav). Everything else about the module is live and gated correctly.

**4. ai_suite** (premium 399 — licensing bundle, no blueprint) — *The bundle that unlocks all AI surfaces.*
Its manifest (`modules/ai_suite/manifest.yaml`) declares no `api_blueprint` — it is a pure licensing gate + nav entry (`/dashboard/ai-tools`, Insights section, subitems AI Workbench/Analytics/Benchmarking/Reports). Representative flow: install → `POST /plugins/install` (`app/api/v1/plugins.py`) → `billing.install_plugin` (`billing.py:74-177`) → **school_plugins** row (trial 14 d per config) → cache invalidated → the reverse alias family makes all ai_*-gated routes pass (`decorators.py:36-42,88-91`). Also ships `widgets.yaml` (at-risk students widget via `/ai-tools/insights/risk-alerts`, `modules/ai_suite/widgets.yaml`) and `config_schema.yaml` (AI settings UI). Response of install: `_sp_dict` (`billing.py:268-277`).

**5. ai_teacher** (premium 1499, own routes.py) — *Start a lesson, then the service calls home.*
Entry `POST /ai-teacher/lessons` → `create_lesson` `app/plugins/modules/ai_teacher/routes.py:208-…` (jwt+school+plugin ai_teacher+role incl. student, `@ai_rate_limit`). Gates before spend: kill-switch 403 (`:216-217`), plan tier 402 (`:218-220`), role config, student resolution, **GuardianAIConsent check** (`:258-263`, tutor scope — G-04 fix verified in code). Writes **ai_teacher_lessons** (+ quota reservation + estimated cost). The external AI service later POSTs `POST /ai-teacher/webhooks/lesson-event` (`routes.py:604-650`): HMAC-SHA256 over timestamp+body with ±300 s window (`:630-642`), secret resolved key→school via the encrypted envelope (`:775-796`), then `apply_event` (`:652-760`) mutates **ai_teacher_lessons/chapters/messages/mastery/learning_events** and reconciles quota cost. **Two prior findings re-verified STILL TRUE:** (A9) the lesson is fetched by payload id with **no check that the key's school owns the lesson** (`routes.py:643-647` — key→school is resolved for the secret but never compared to `lesson.school_id`): a key for school A can inject events into school B's lessons; (A10) no replay guard — `AITeacherLearningEvent` (`models/ai_teacher.py:287-302`) has no unique (lesson_id, object_id) constraint, and counter fields (questions_asked etc.) re-increment on replayed event_ids. Response: lesson dict / `{"received": true}`.

**6. alumni** (growth 149) — *Record a donation.*
Entry `POST /alumni/donations` → `create_donation` `app/api/v1/alumni.py:211-235` (role superadmin/school_admin/accountant). Validates alumni_id against school (`:214-217`), amount>0 (`:218-224`), writes **alumni_donations**. Response: created donation dict. 10 routes (alumni CRUD, events, donations). Consumer: web `/dashboard/alumni`; donations mobile-only per prior corpus.

**7. assignments** (starter 99) — *Student submits homework.*
Entry `POST /assignments/<id>/submit` → `submit_assignment` `app/api/v1/assignments.py:195-…` (jwt+school+plugin). Student self-scope enforced (`:203-206` — classmate impersonation 403), assignment+student re-scoped to school (E17-family, `:207-224`), `is_late` computed from due date, writes **assignment_submissions**, emits `assignment.submitted` (`listeners.py:852+` → teacher notification). AI grading path: `POST /assignments/<id>/ai-grade` (`assignments.py:316+`) → AutoGraderService → AITokenHub. Response: created submission dict. Consumers: web dashboard, teacher+student flutter.

**8. attendance** (core, free) — *Mark a class's attendance.*
Entry `POST /attendance/mark` → `mark_attendance` `app/api/v1/attendance.py:22-165` (role school_admin/teacher). Full pre-validation of every record against school-scoped **students/classes/sections** (`:60-105` — cross-tenant write prevention E17/E173), teacher class-scope via `teacher_class_teacher_class_ids` (`:49-54`), enum guard (`:42-47`), then upsert into **attendance** (lookup includes tombstones to respect `uq_attendance_student_date`, `:110-118` — the unique index EXISTS live: `CREATE UNIQUE INDEX uq_attendance_student_date ON attendance (school_id, student_id, date)` verified in psql; prior M5 **FIXED**). Commit → `emit("attendance.marked", …)` (`:156-158`) → listeners (absent-SMS path via `attendance.absent_alert` from the 16:30 beat task + notification rules matrix). Response: `{date, total_marked, new_records, updated_records}`. The daily absent-alert pipeline: `attendance_alerts_daily` (beat 16:30, `app/tasks/attendance_alerts.py`) reads today's absences → `emit("attendance.absent_alert")` → listener `listeners.py:69+` → notification-rules-gated SMS via Sparrow + in-app rows (the old "emitted but no listener" gap is FIXED — verified listener registration `listeners.py:69`).

**9. basic_reports** (core, free) — *Attendance summary PDF.*
Entry `GET /reports/attendance/summary/pdf` → `attendance_report_pdf` `app/api/v1/reports.py:489-580` (role school_admin/teacher). Reads **attendance** aggregated by `_attendance_summary_data` (school-scoped), builds HTML with `escape()`d values, renders via WeasyPrint (honest 501 when absent — `reports.py:558-561` area), uploads PDF via `upload_file` to `reports/<school_id>/` (**managed_files**), returns URL. Response: `{pdf_url}`. 7 routes (attendance/fees/exams summaries + PDFs + dashboard). Consumer: web `/dashboard/reports`, flutter_admin reports hub.

**10. basic_website** (core, free) — *Update public site config.*
Entry `PUT /website/config` → `update_website_config` `app/api/v1/website.py:404-…` (role school_admin). Upserts **school_websites** (`:412-417`), GA/pixel ids allowlisted (`:424-440`, S4/F4 fix verified — `utils/tracking_ids.valid_ga_id/valid_pixel_id`). Public read path: `GET /website/public/<slug>` (`website.py:256-310`) — no auth, tenant resolved by slug via `_public_site_guard`, serves theme+pages+notices. Contact form `POST /website/public/<slug>/contact` (`website.py:489+`, 5/h rate limit) writes **contact_messages**. Response: website dict. 21 routes total (14 public + config + sliders).

**11. biometric** (premium 299, own routes.py) — *Device pushes punches.*
Entry `POST /attendance/biometric/ingest` → `ingest` `app/plugins/modules/biometric/routes.py:583-680`. **Auth realm: X-Device-Key** (not JWT) via `_device_from_key()` + `@device_rate_limit(120/min)`. Batch-atomic validation (`:596-600`), per-punch replay guard (device punch id or device+user+ts, `:608-618`), SAVEPOINT on IntegrityError (`:639-646`), student resolution, then `_upsert_attendance` writes **biometric_punches** + **attendance** (`:648-655`), `_sync_log` writes **biometric_sync_logs**, `_touch_device` heartbeats **biometric_devices**. Response: `{device_id, received, new, duplicates, failed, server_time}` — honest per-batch accounting. Admin CRUD routes (11 total) are JWT+role-gated. This is one of the strongest modules in the repo.

**12. compliance** (growth 149) — *Generate EMIS export.*
Entry `POST /compliance/emis/generate` → `generate_emis` `app/api/v1/compliance.py:134-155` (role superadmin/school_admin). Writes **emis_exports** with export_data payload. Download route streams the stored JSON/CSV (`:156+`). Audit-logs route reads **compliance_reports/audit_logs** (flutter-only consumer per prior corpus). Response: created emis dict. 8 routes. (Nepal-depth: EMIS fields incl. caste/mother-tongue/disability live on the Student model and in `report_generation`'s EMIS builder `app/tasks/report_generation.py:270-315`.)

**13. conferences** (growth 199) — *Parent books a slot.*
Entry `POST /conferences/slots/<id>/book` → `book_slot` `app/api/v1/conferences.py:252-305` (jwt+school+plugin). Slot re-scoped (`:255-259`), student_id/parent_id validated to school with admin-only delegation (E193, `:268-288`), writes **conference_slots** (is_booked/parent_id/student_id) + emit `conference.booked` (`:297-304`). Response: slot dict. **Prior M6 (TOCTOU double-booking) STILL TRUE**: check `if slot.is_booked: 409` then plain commit — no `with_for_update`, no unique constraint; two concurrent bookings both pass and the second overwrites the first parent. 9 routes.

**14. design_studio** (growth 149) — *Render a template document.*
Entry `POST /design-studio/render` → `render_document` `app/api/v1/design_studio.py:417-472` (role superadmin/school_admin/teacher). Reads **schools** (config merge), template via `TemplateEngineService.get_template` (school-scoped, `:454-457`), renders HTML with school+payload data. Bulk paths (`/bulk/id-cards|marksheets|admit-cards|certificates|attendance-ledger`, `:473-751`) stream per-record renders through the designer bulk generator writing PDFs to `reports/<school_id>/` (**managed_files**); AI routes (`/ai/question-paper`, `/ai/lesson-plan`) go through AITokenHub gated ai_suite (B-10 fix verified at route level). Response: `{html, template_id, template_width, …}`. 30 routes. Consumers: web `/dashboard/designer` + certificates page, flutter_admin design_studio.

**15. disaster_management** (premium 299, own routes.py) — *Readiness overview.*
Entry `GET /emergency/disaster/overview` → `overview` `app/plugins/modules/disaster_management/routes.py:283-…` (jwt+school+plugin disaster_management). Aggregates **disaster_drills** + reuses **evacuation_plans/emergency_alerts** (emergency models) into a readiness score; `/seismic-alerts` (`:404+`) reads manual alert rows (no live seismic feed — honest per prior audit). Response: readiness payload. 7-9 routes. Test coverage exists (`test_disaster_management_api.py`).

**16. dismissal** (premium 299) — *Gate QR verification.*
Entry `POST /dismissal/verify-qr` → `verify_qr` `app/api/v1/dismissal.py:146-…` (jwt+school+plugin). Parses `aschool:pickup:<parent_user_id>:<student_id>` QR (`:162-170`), resolves the **authorized_pickups** row server-side (school+student scoped, `:171-…`), auto-creates a **dismissal_records** row. Response: pickup/record dicts. **Prior M8 STILL TRUE (milder)**: the QR carries no signature — anyone who learns the two UUIDs can forge it; mitigation is that verification requires an authenticated school member and the pickup row must exist. `GET /dismissal/summary` (S0 B-09) serves the admin screen. 8 routes. Side channels: SSE (`/sse/events`) broadcasts gate events for classroom boards.

**17. elibrary** (starter 99) — *Add a digital book.*
Entry `POST /elibrary/books` → `create_book` `app/api/v1/elibrary.py:36-52` (role superadmin/school_admin/teacher). Writes **digital_books** (is_approved=True on admin path; public site reads only approved). Response: book dict. 6 routes (books/papers/resources CRUD). Consumers: web `/dashboard/elibrary`, student/parent flutter (elibrary). Note the manifest pointer bug (§4.0) — elibrary's own blueprint is statically mounted, so the wrong `api_blueprint` in its manifest is inert documentation.

**18. emergency** (premium 299) — *Trigger an alert.*
Entry `POST /emergency/alerts` → `trigger_alert` `app/api/v1/emergency.py:34-68` (role superadmin/school_admin). Type allowlist (`:39-41`), writes **emergency_alerts**, `emit("emergency.alert_triggered")` → listener (`listeners.py:968+`) → push to all school roles + in-app rows; headcount flow (`POST /alerts/<id>/headcount`, `:171+`) writes **emergency_headcounts** (flutter consumer). Response: alert dict. 9 routes.

**19. exams** (starter 99) — *Online exam attempt lifecycle (S-A2 hardening verified).*
Entry `POST /exams/online/<id>/start` → `start_online_exam` `app/api/v1/exams.py:590-656` (jwt+school+plugin; student-only via `_current_student`). Window checks, resume-or-409 on submitted, creates **online_exam_attempts** (status in_progress) BEFORE questions served; `GET /online/<id>/take` serves student-safe questions (answer key never leaves the server); `PATCH /online/<id>/attempt` merges autosave deltas (409 after submit, `exams.py:658-697`); `submit` scores server-side under the `uq_online_exam_attempts_one_per_student` partial unique index (duplicate → 409 with winner's score). Offline path: marks entry (`:638-844`) with teacher subject/class scoping and per-school grade scales (`grade_scales`, S-A2). Emits `exams.marks_entered`/`exams.result_published`/`exams.scheduled` (E-01/E-02 canonical vocabulary verified at `exams.py:395-397,788-790`). Response shapes: attempt dicts with server `remaining_seconds`. 35 routes — deepest module after fees.

**20. fees** (starter 99) — *Record a desk payment (the money path).*
Entry `POST /fees/collections/<id>/pay` → `record_payment` `app/api/v1/fees.py:1378-1545` (role school_admin/accountant). Hops: school-scope re-check of the collection (`:1387-1391`); **idempotency**: school-scoped key lookup + foreign-key namespacing (E182, `:1398-1421`); method enabled check; outstanding computation from `_collection_payable_total` + `_extract_partial_paid` (`:1437-1441`); optional backdated date with Nepal TZ guard (`:1443-1462`); **S-A1 till lock** — closed FeeDayClosure for collector+BS date → 423 (`:1474-1488`); writes **fee_collections** (status pending→partial→paid, collected_by attribution) + **fee_receipts** (number via `_generate_receipt_number` → **school_receipt_counters** SELECT…FOR UPDATE, `fees.py:~330-370`; hash; IRD-style `{PREFIX}/{FY-BS}/{seq:05d}`) + invoice status recompute (`_recompute_invoice_status`, `:1519-1523`); commit → `emit("fees.collected")` → listener `listeners.py:235-296` → parent push (Celery `send_push_notification.delay` via OneSignal player ids) + in-app **in_app_notifications** row + gamification points (5, category fee_payment). Response: `{collection, receipt, receipt_id}` (or idempotent replay with the original receipt). **Prior M4 STILL TRUE**: partial payments still persist in the `[partial_paid:N]` note-string (`_merge_partial_payment_note`/`_extract_partial_paid`, `fees.py:1441,1500` + extract fn) rather than SUM(fee_receipts) — concurrent desk payments on one bill can lose money (read-modify-write, no row lock on the collection row). Gateway path: `/pay-online` (`:1810+`) → PaymentInitiation → eSewa/Khalti/Fonepay → signed callback (`app/api/webhooks/__init__.py:23-250`) → `_finalize_fee_payment` (idempotent via initiation row). 57 routes — invoices, installments, carry-forward, aging, fines, offline submissions, day closures, day book, reports.

**21. file_management** (core, free) — *Upload a file.* (Traced fully in §6.6 — including the traversal finding.) Entry `POST /files/upload` `app/api/v1/files.py:168-241`: size cap, extension allowlist (E167), ClamAV, UUID filename, **managed_files** row with visibility; response: file dict with `url`. 13 routes (folders/upload/list/presign/stock-import/usage).

**22. gamification** (growth 149) — *Award points.*
Entry `POST /gamification/points` → `award_points` `app/api/v1/gamification.py:70-102` (role superadmin/school_admin/teacher). Student re-scope (`:82-84`), integer check, writes **points_logs**, `emit("gamification.points_awarded")` → listener (`listeners.py:403+`) → student notification; badges flow via `/award-badge` → **student_badges**; leaderboard aggregates **points_logs** by house/class; streaks via beat task `gamification_streak_update` (`tasks/streak_updater.py`). Response: points log dict. 11 routes.

**23. gps_tracking** (premium 299 — gates `app/api/v1/transport`) — *Driver phone reports a position (S-A4 model).*
Entry `POST /transport/instances/<id>/position` → `post_instance_position` `app/api/v1/transport.py:719-775` (jwt+school+plugin gps_tracking). Instance re-scope + running-status check (`:727-732`), lat/lng range validation (`:736-742`), 3-second server-side throttle (`:744-751`), writes **gps_logs** (bus parity, `:763-769`) then `transport_service.ingest_position` (`services/transport_service.py`) — geofence engine: haversine, strict in-order stops, per-passenger trigger matrix honoring **transport_notification_prefs** (7 event toggles + radii) → in-app notifications + `transport.*` events; auto-mark arrival only when nobody waiting. ESP32 path: `tasks/gps_firebase_poller.py` (beat 15 s) → `tasks/gps_processing.py` (geofence/route-deviation — **with the STILL-TRUE Haversine typo**, §9/B3). Response: `{triggers, …}` from the service. 28 routes (routes/stops/buses CRUD, trips CRUD, instance monitor/start/end/pickup/dropoff, prefs, reports).

**24. health_records** (growth 149) — *Log a medical visit.*
Entry `POST /health-records/visits` → `create_medical_visit` `app/api/v1/health_records.py:90-110` (role superadmin/school_admin/teacher). Student re-scope (`:95-97`), writes **medical_visits** (recorded_by). Immunizations (`:126+`) write **immunizations**. Response: visit dict. 7 routes. Consumers: web `/dashboard/health-records`, parent/student flutter health screens (repointed in A-03).

**25. hostel** (growth 149 — LEGACY-MANIFEST plugin living in `manifests/hostel.yaml`, not one of the 42 `modules/` dirs; traced here so every functional plugin is covered) — *Room allocation.* Routes in `app/api/v1/hostel.py` (12 routes: hostels/rooms/allocations/checkout/summary); models are the 3 raw-db.Model classes (`models/hostel.py:8-83`, §3.1). Entry `POST /hostel/allocations` scopes room+student to school, writes **hostel_allocations**; occupancy computed from allocation status. Sidebar via legacy `manifests/hostel.yaml` (Operations section). Response: allocation dict.

**26. hr_payroll** (growth 199) — *Generate monthly payroll.*
Entry `POST /hr_payroll/payroll/generate` → `hr_payroll.py:178-307` (role superadmin/school_admin/accountant): settings-driven allowances/deductions per **staff** member → writes **staff_payroll** rows (gross = basic + Σallowances − Σdeductions enforced). Approve/pay endpoints gate the lifecycle; payslip HTML/PDF (`:382+`). Beat: `payroll_monthly_process` 1st 00:10. **Prior M3 STILL TRUE**: `PUT /payroll/<id>` (`hr_payroll.py:309-361`) still accepts arbitrary `status` in its field list (`:322-327`) — draft→paid bypasses `/approve`. 25 routes incl. leaves + appraisals + expenses.

**27. iemis_importer** (add_on, free) — *Import the MoEST Excel.*
Entry `POST /iemis/import` → `run_import` `app/api/v1/iemis_importer.py:1111-1180+` (role school_admin — the phantom "data_entry" role was removed, verified `:1115`). File type+size guards, format detect (student_namewise/school_level/staff_details), creates **iemis_import_logs** (processing), parses via `_parse_tabular`, `_import_students/_import_staff/_import_school_level` write **students/users/etc.** with per-row error lists, log finalized (completed/partial + counts), `emit("iemis.import_completed")` (B-13 rename verified). Response: import summary with counts + errors. 6 routes.

**28. incident_management** (growth 199, own routes.py) — *Escalate a case.*
Entry `POST /incidents-mgmt/<incident_id>/escalate` → `escalate_case` `app/plugins/modules/incident_management/routes.py:304-383` (role superadmin/school_admin). Reads base **incidents** (school-scoped via `_get_incident`), severity must strictly rise (SEVERITY_ORDER validation, `:314-330`), resolves escalation target (user or role), writes **incident_escalations** + **incident_workflow_events**, updates incident status/severity. Response: escalation dict. 11 routes (overview/active/escalations/assign/status/resolve/conference/audit/reports) — the workflow tier over the shared incidents entity (§3.2). No base-CRUD duplication (verified: no POST /incidents here).

**29. incidents** (premium 299) — *Report an incident.*
Entry `POST /incidents` → `create_incident` `app/api/v1/incidents.py:43-98` (role superadmin/school_admin/teacher/staff). Type allowlist, involved_student_ids re-scoped to school (cross-tenant reference guard, `:58-73`), writes **incidents** (reported_by), `emit("incident.reported")` → listener `listeners.py:903-966` → admin push (Celery `send_push_to_school.delay`) + in-app rows + high/critical SMS to admins (direct Sparrow call). Response: incident dict. 8 routes (CRUD + statements + actions).

**30. inventory** (growth 149) — *Approve procurement.*
Entry `POST /inventory/procurement/<id>/approve` → `approve_procurement` `app/api/v1/inventory.py:233-262` (role superadmin/school_admin). Status transition allowlist (pending/approved/rejected/ordered/received, `:241-247`), writes **procurement_requests** (approved_by). Assets CRUD + QR scan (`/assets/scan/<qr>`) + audits. Response: procurement dict. 11 routes. Web UI exists (assets); procurement/scan remain orphan-ish (§5).

**31. library_management** (starter 99, alias `library`) — *Issue a book (library v2).*
Entry `POST /library/issues` → `issue_book` `app/api/v1/library.py:171-249` (role superadmin/school_admin/teacher). Hops: **Book row locked SELECT…FOR UPDATE** (B-04 concurrency fix, `:179-184`), per-school borrow limit from circulation settings (`:192-201`), physical **book_copies** locked + status→issued (`:210-223`), writes **book_issues** (due date from loan_days config), decrements books.available_copies, commit → `emit_for_school("library.issued")` (widget/event consumers). Return path (`/issues/<id>/return` `:251+`) writes ledger fines (**book_fines**), hands the copy to waiting holds (**book_reservations** auto-promotion), emits `library.returned`/`library.fine_created`. Overdue sweep: beat `library_overdue_check` 07:30 (`tasks/library_overdue.py`). Public OPAC `GET /library/public/search?school_slug=` (no auth, `:1474-1506`). Response: issue dict with copy_id. 34 routes (copies/racks/reservations/fines/stocktake/vendors/POs/reports/OPAC).

**32. lms** (growth 149) — *Quiz attempt + progress.* Entry `POST /lms/quizzes/<id>/attempt` → `submit_quiz_attempt` `app/api/v1/lms.py:312-335`: writes **quiz_attempts** with client `answers` and **client-supplied `score` trusted verbatim** (`lms.py:322` — NEW finding P2: a student can POST any score; no server-side grading). Enroll (`:337-368`) upserts **enrollments** (duplicate 409); progress POST (`:390+`) upserts **student_progress** + re-derives enrollment aggregates. Live classes: `GET /lms/live-classes` (`:214-240`, A-03 fix) reads **live_classes** — but **no route creates them** and `services/lms/video_service.py` (VideoService, Jitsi room generator) has **zero API callers** (prior V2-24 STILL TRUE — dead service). 18 routes. Consumers: web `/dashboard/lms`, teacher/student flutter (lms).

**33. multi_branch** (premium 299, own routes.py) — *Chain dashboard.*
Entry `GET /multi-branch/chain/dashboard` → `chain_dashboard` `app/plugins/modules/multi_branch/routes.py:245-286` (role superadmin/school_admin + `_require_chain` ownership). Cross-branch set-based metrics `_branch_metrics` over chain members (students/staff/attendance/revenue from **students/users/attendance/fee_receipts**), per-branch cards + totals. Response `{totals, branches}`. Branch create/link routes manage **school_chain_members** (real tenant Schools). 7 routes.

**34. nepal_curriculum** (starter 199, no blueprint — licensing+content plugin) — *Author a chapter section.*
Entry `POST /teaching-content/sections` → `create_section` `app/api/v1/teaching_content.py:129-192` (role superadmin/school_admin, `plugin_required("nepal_curriculum")` `:99`). Validates unit (from the seeded CDC/NEB **curriculum_units**), school-override chain (platform rows when scope=platform + `_can_write_platform`), writes **teaching_sections**; versioning via `/versions` + publish workflow (`:238+`); the AI Teacher runtime reads published snapshots only. Response: section dict. 6-11 routes. Consumers: web `/dashboard/teaching-content` (B-15 page).

**35. notices** (core, free) — *Publish a notice.*
Entry `POST /notices` → `create_notice` `app/api/v1/notices.py:89-107` (role school_admin/teacher/staff). Required-field validation, writes **notices** (audience targeting fields via `_populate_notice`), `emit("notice.published")` → listeners (`listeners.py:297+`) → push/in-app fan-out by audience. Response: notice dict. 9 routes (+events CRUD). Consumers: all five apps + public site news feed (B-11: public news reads published notices, `website.py:678-723`).

**36. sms_notifications** (starter 99) — *Queue an SMS blast.*
Entry `POST /sms/send` → `send_sms` `app/api/v1/sms.py:15-66` (role superadmin/school_admin). Phone-format validation, one **sms_logs** row per recipient (status queued, cost 0), then dispatches Celery `send_sms_task` (`tasks/sms_sender.py`) which calls Sparrow per message and flips status sent/failed with real cost (no fake sent — verified honest pattern) and emits `sms.sent`. Response: queued log dicts. 5 routes. The plugin also gates the broadcast slice of `communications.py` (audience resolver, per-channel outcomes).

**37. student_portfolio** (growth 149, alias `portfolio`) — *Add a portfolio item.*
Entry `POST /portfolio/students/<id>/items` → `add_item` `app/api/v1/portfolio.py:83-108` (role superadmin/school_admin/teacher). Student re-scope (404), upserts **student_portfolios**, writes **portfolio_items**. Response: item dict. 6 routes (+ micro-credentials). Consumers: web `/dashboard/portfolio`, student/parent apps; teacher aggregate `/teacher/portfolios` (B-05 fix).

**38. timetable** (starter 99) — *Generate + save.*
Entry `POST /timetable/generate` → `generate_timetable` `app/api/v1/timetable.py:59-84` (role superadmin/school_admin) → `TimetableSolverService.generate_timetable` (`services/ai/timetable_solver.py`) — the solver is still the naive greedy allocator (prior "AI solver is a stub" — verified unchanged: subject round-robin, teacher quals consulted only for labeling, `conflicts` placeholder). `POST /save` (`:86-123`) does a scoped per-(class,section) replace of **timetable_slots** (manual slots outside payload survive — documented promise). Emits `timetable.generated`. Response: generated grid / `{saved_slots}`. 6 routes.

**39. visitor_management** (growth 149) — *Check a visitor in.*
Entry `POST /visitor/checkin` → `checkin_visitor` `app/api/v1/visitor.py:48-86` (role superadmin/school_admin/staff). Name required (NOT NULL guard), visiting_staff_id re-scoped (FK 400 guard), writes **visitors** (status checked_in, badge_number). Checkout flips status; `GET /badge/<code>` (A-03) serves the badge screen; appointments CRUD + approve (orphan-ish surface per §5). Response: visitor dict. 8 routes.

**40. website_builder** (premium 299) — *Publish a page draft.*
Entry `POST /website-builder/pages/<id>/publish-draft` → `publish_page_draft` `app/api/v1/website_builder.py:481-520` (role superadmin/school_admin). Copies draft sections → live **website_pages.sections**, records previous_live + rolling 10-entry history in draft_config (W-02), commit. ISR: the publish path also pings Next.js `/api/revalidate` (E201, config `NEXTJS_INTERNAL_URL`) and emits `website.published`. Undo: `/revert-draft` + `/history/<i>/restore` (`:522-576`, wired to web in C-03). Response: page dict + published flag. 27 routes (pages/sections/themes/AI design/SEO/domain/publish). SEO GET is role-gated (S8 fix held, `:269+` role_required present).

**41. wellbeing** (growth 149) — *Mood check-in.*
Entry `POST /wellbeing/mood` → `submit_mood` `app/api/v1/wellbeing.py:38-93`. Student self-scope (or admin on-behalf with school re-scope, `:53-66`), writes **mood_entries**, emits `wellbeing.mood_logged` and — for negative moods — `wellbeing.alert_triggered` (E-02 additions verified, `:77-91`) → counselor dashboards + alerts. **Prior "mood enum unvalidated" STILL TRUE (mild)**: any string is accepted as mood (`:70-73`, the comment lists the enum but no check); energy_level is int-checked but not range-checked 1-5. Response: mood dict. 9 routes (mood/surveys/counselor-notes/dashboard/alerts).

**42. whatsapp_bot** (starter 99) — *Send a message / bulk.*
Entry `POST /whatsapp/send` → `send_message` `app/api/v1/whatsapp_bot.py:447-484` (role superadmin/school_admin/teacher): sends via WhatsAppCloudService, persists **whatsapp_messages** for non-skipped sends (E210 fix — manual replies now appear in Conversations). Inbound: Meta webhook (`app/api/webhooks/__init__.py:323+`) → signature check when configured → school resolution by the single-enabled-bot rule (`:268-287`) → auto-reply match (E121 exact/contains/regex fix verified `:289-313`) → **whatsapp_messages** + optional bot reply. `POST /whatsapp/send-bulk` (`:487-514`): **prior M2 STILL TRUE** — arbitrary numbers, no school-relationship check, and nothing persisted (the E210 recording exists only on `/send`). Response: per-number results. 11 routes (config/auto-replies/conversations/analytics/send/send-bulk).

**43. white_label** (premium 299, own routes.py — the 42nd module dir) — *Verify custom domain.* Entry `POST /white-label/domain/verify` → `verify_domain` `app/plugins/modules/white_label/routes.py:101-118` (role superadmin/school_admin): `WhiteLabelService.verify_domain_dns` performs a REAL DNS CNAME/A lookup against the expected target (never a stub success — verified by reading the service call + comment `:110-113`). Writes **schools.custom_domain/domain_verified**. Response: verification status dict. 8 routes (overview/domain/branding/theme). Consumer: web `/dashboard/white-label` + settings/domain.

*(Numbering note: entries 1-24 and 26-43 are the 42 `app/plugins/modules/` dirs (41 with manifests + manifest-less ai_adaptive_learning at #3); entry 25 (hostel) is the one functional plugin still living in the legacy `manifests/` dir, included so every functional plugin has a trace. The seven "own routes.py" modules — ai_teacher, biometric, disaster_management, incident_management, multi_branch, white_label (all shim-mounted, §2.3) + ai_adaptive_learning — carry their handlers inside `app/plugins/modules/`; every other module's code lives in `app/api/v1/`. Every module dir was accounted for; none is a stub-only folder.)*


---

## 5. Full API Route Inventory (867 rules, 76 handler modules)

Generated from the LIVE app's `url_map` inside `aschool-flask-1` (script: create_app → iter_rules → inspect each view function for module/line/decorators). Auth column: JWT = `@jwt_required()`, KEY = device-key realm, PUB = unauthenticated. Web/Mob columns are heuristic (string-match of path prefixes against the whole `frontend/` TS/TSX tree and the `aschool_shared` + 5 Flutter trees), then **hand-verified** for every shortlisted orphan (template literals defeat naive matching; all "orphan" claims below were re-checked with targeted greps).

### 5.1 Shape

- **867 rules** = 858 under `/api/v1`, 6 under `/webhooks`, 3 app-level (`/health`, `/ready`, `/uploads/*`) — all unique endpoints (see table).
- Auth coverage: 815 JWT-gated, ~9 device/webhook-key realms (biometric ingest/heartbeat, 6 gateway webhooks, ai_teacher HMAC webhook), ~43 genuinely public (auth flows, public website, OPAC, meta/time, health, uploads-visibility-gated, crash report, exit-doc verify, capture/photo-501, custom-field public defs, design-studio template assets, faqs/public, schools/lookup).
- Plugin-gated: **606 routes** across 41 distinct plugin slugs (fees 57, exams 35, library 32+2 public, transport 28, website_builder 24, hr_payroll 25, design_studio 28, …). Ungated-but-should-decide: `analytics.py` (6 routes, core-by-decision), `ai_usage.py` (5, admin surface), `notifications/faqs/custom_fields/sliders/themes/staff/hostel/schools/users/students/staff` (core), `content_admin` (5, review gate).
- Consumer heuristic: 733/867 routes show a web or mobile consumer; 134 flagged, of which after hand-verification the true orphan list is below.

### 5.2 Verified orphan surfaces (no web AND no mobile consumer — hand-checked)

| Surface | Routes | Evidence | Note |
|---|---|---|---|
| **TOTP MFA (entire feature)** | `POST /auth/totp/setup|verify|disable|challenge` | `app/api/v1/auth.py:762,806,849,877`; zero `totp/` hits in frontend/ + flutter trees | Fully built backend (pyotp, cache bridge) with **no UI anywhere** — users cannot enable MFA |
| **AI live-polls** | `POST /ai/ext/live-polls`, `/<key>/vote`, `GET /<key>/results` | `app/services/ai/extensions.py:233-263`; no consumers | Plus the architecture smell (service module hosting routes, in-memory state) |
| **QTI export** | `GET /ai/ext/qti/export` | `app/services/ai/extensions.py` (qti_export); only node_modules noise in grep | Prior corpus said the same — still true |
| **IEP (individualized education plans)** | `POST /ai/iep`, `GET/PUT /ai/iep/<plan>`, review, flags resolve, `/ai/moderation/flags` | `app/api/v1/ai_workbench.py`; no `/ai/iep` consumers | The AW-07 "IEP completion" item — still no UI |
| **exit-documents** | full lifecycle: `POST/GET /students/<id>/exit-documents`, verify, revoke | `app/api/v1/students.py:1409-1530`; no `exit-documents` consumers in web/mobile | TC issue/revoke + public verify (the "InstiKit steal") built, orphaned |
| **Library v2 back-office** | `/library/racks`, `/library/vendors`, `/library/purchase-orders(+receive)` | `app/api/v1/library.py` (v2 wave); no consumers | Front desk (copies/issues/fines/stocktake) IS consumed; procurement is not |
| **academics masters** | mediums/semesters/shifts/streams CRUD + `GET /academics/subject-offerings` | `app/api/v1/academics.py:116-322,1276`; no consumers for these four masters | Classes/sections/subjects/years ARE consumed |
| **visitor appointments** | `GET/POST/PUT /visitor/appointments` + approve | `app/api/v1/visitor.py:135-260`; checkin/checkout/badge ARE consumed | Prior corpus said the same — still true |
| **inventory procurement** | `GET/POST /inventory/procurement` + approve | `app/api/v1/inventory.py:191-262`; assets consumed | Still true |
| **super_admin module** | `/super-admin/overview|schools|plugins` | `app/api/v1/super_admin.py`; the super-admin web page (`/dashboard/super-admin`) uses `analytics/superadmin-dashboard` + `plugins` endpoints instead | Partial overlap; module near-orphan |
| **ai_tools question-bank CRUD** | `GET/POST/PUT/DELETE /ai-tools/question-bank*` | `app/api/v1/ai_tools.py`; zero `question-bank` hits in frontend | Question bank exists inside exams too — split surface, one half orphaned |
| **`GET /plugins/registry`, `/<slug>/health`, `/migrate-config`, `refresh-registry`** | 4 admin/plugin-dev endpoints | `app/api/v1/plugins.py` | plugin_doctor/scripts use some; no UI |
| **`GET /ai/generations/<id>`, `/ai/library` CRUD, `/ai-tools/generated-papers/<id>`** | generation library read paths | `app/api/v1/ai_workbench.py:154+`, `ai_tools.py` | generation history partially surfaced via workbench UI only |
| **`GET /api/v1/sse/events`** | 1 route | `app/api/v1/sse.py:11` | SSE stream — consumed by web? `sse` grep in frontend: the dismissal board uses polling; stream unverified → treat as near-orphan |
| **`GET /exams/<id>/marksheet/<student_id>(/html)`, `bulk-marksheet-pdf`, `designer-marksheet`, `GET /exams/<id>/components|subjects`** | 6 exam print-twin/detail routes | `app/api/v1/exams.py` | tabulation/merit/grade-sheet ARE consumed; these six are not |
| **`GET /staff/stats`, `GET /analytics/benchmarking`, `POST /auth/logout-all`, `GET /files/<id>/presigned`, `GET /themes/<id>/preview-css`, `POST /fees/payments/sweep-pending`, `GET /compliance/emis(+download)`** | singles | various | sweep-pending is beat-covered (hourly), so UI absence is fine |

### 5.3 Mobile-consumer reality (aschool_shared cross-check)

`aschool_shared/lib/repositories/` (19 repositories) drive the five apps. All major domains (auth, students, attendance, fees, exams, timetable, notices, transport, lms, health, portfolio, chat, ai) have repository clients. The apps consume **`/parent/*`, `/student/*`, `/teacher/*` role surfaces plus shared domain endpoints** — not the admin deep endpoints. Role-surface coverage: parent_app 20 routes (all consumed), student_app 15, teacher 8. Missing mobile representations (backend exists, zero flutter features): biometric, multi_branch, white_label, compliance (read-only flutter exists per prior corpus — verify), iemis_importer, nepal_curriculum/teaching_content, incident_management, disaster_management, website_builder, design_studio (admin has design_studio folder per recon — thin), benchmarking.

### 5.4 Full table (auto-generated, sorted by handler module)

| Method | Path | Auth | Roles | Plugin | Handler | Web | Mob |
|---|---|---|---|---|---|---|---|
| GET | `/health` | PUB |  |  | `APP.py:803` | W* | - |
| GET | `/ready` | PUB |  |  | `APP.py:808` | W* | - |
| GET | `/uploads/<path:filepath>` | PUB |  |  | `APP.py:864` | W* | - |
| GET/POST | `/webhooks/esewa/callback` | PUB |  |  | `APP.api.webhooks.py:23` | - | - |
| GET/POST | `/webhooks/fonepay/callback` | PUB |  |  | `APP.api.webhooks.py:168` | - | - |
| GET/POST | `/webhooks/khalti/callback` | PUB |  |  | `APP.api.webhooks.py:97` | - | - |
| POST | `/webhooks/stripe` | PUB |  |  | `APP.api.webhooks.py:484` | - | - |
| GET | `/webhooks/whatsapp` | PUB |  |  | `APP.api.webhooks.py:252` | W | - |
| POST | `/webhooks/whatsapp` | PUB |  |  | `APP.api.webhooks.py:323` | W | - |
| GET | `/api/v1/lms/adaptive-progress` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:504` | W | - |
| GET | `/api/v1/lms/learning-paths` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:218` | W | - |
| POST | `/api/v1/lms/learning-paths` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:252` | W | - |
| POST | `/api/v1/lms/learning-paths/generate-ai` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:295` | W | - |
| GET | `/api/v1/lms/mastery` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:415` | - | - |
| PUT | `/api/v1/lms/mastery/<record_id>` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:471` | - | - |
| POST | `/api/v1/lms/mastery/assess` | JWT | "school_admin", "teacher" | ai_suite | `P:ai_adaptive_learning.routes.py:433` | - | - |
| POST | `/api/v1/ai-teacher/lessons` | JWT | "superadmin", "school_admin", "teacher", "student" | ai_teacher | `P:ai_teacher.routes.py:208` | W | - |
| GET | `/api/v1/ai-teacher/lessons` | JWT |  | ai_teacher | `P:ai_teacher.routes.py:441` | W | - |
| GET | `/api/v1/ai-teacher/lessons/<uuid:lesson_id>` | JWT |  | ai_teacher | `P:ai_teacher.routes.py:471` | W | - |
| POST | `/api/v1/ai-teacher/lessons/<uuid:lesson_id>/stop` | JWT |  | ai_teacher | `P:ai_teacher.routes.py:497` | W | - |
| GET | `/api/v1/ai-teacher/mastery` | JWT |  | ai_teacher | `P:ai_teacher.routes.py:520` | - | - |
| GET | `/api/v1/ai-teacher/usage` | JWT | "superadmin", "school_admin" | ai_teacher | `P:ai_teacher.routes.py:564` | W | - |
| POST | `/api/v1/ai-teacher/webhooks/lesson-event` | PUB |  |  | `P:ai_teacher.routes.py:604` | - | - |
| GET | `/api/v1/attendance/biometric/devices` | JWT |  | biometric | `P:biometric.routes.py:319` | W | - |
| POST | `/api/v1/attendance/biometric/devices` | JWT | "school_admin" | biometric | `P:biometric.routes.py:332` | W | - |
| PATCH | `/api/v1/attendance/biometric/devices/<uuid:device_id>` | JWT | "school_admin" | biometric | `P:biometric.routes.py:384` | W | - |
| DELETE | `/api/v1/attendance/biometric/devices/<uuid:device_id>` | JWT | "school_admin" | biometric | `P:biometric.routes.py:437` | W | - |
| POST | `/api/v1/attendance/biometric/devices/<uuid:device_id>/regenerate-key` | JWT | "school_admin" | biometric | `P:biometric.routes.py:457` | W | - |
| POST | `/api/v1/attendance/biometric/devices/<uuid:device_id>/sync` | JWT | "school_admin" | biometric | `P:biometric.routes.py:481` | W | - |
| POST | `/api/v1/attendance/biometric/heartbeat` | PUB |  |  | `P:biometric.routes.py:683` | W | - |
| POST | `/api/v1/attendance/biometric/ingest` | KEY |  |  | `P:biometric.routes.py:583` | W | - |
| GET | `/api/v1/attendance/biometric/logs` | JWT |  | biometric | `P:biometric.routes.py:535` | W | - |
| GET | `/api/v1/attendance/biometric/overview` | JWT |  | biometric | `P:biometric.routes.py:268` | W | - |
| GET | `/api/v1/attendance/biometric/punches` | JWT |  | biometric | `P:biometric.routes.py:554` | W | - |
| GET | `/api/v1/emergency/disaster/overview` | JWT |  | disaster_management | `P:disaster_management.routes.py:283` | W | - |
| GET | `/api/v1/emergency/drills` | JWT |  | disaster_management | `P:disaster_management.routes.py:62` | W | - |
| POST | `/api/v1/emergency/drills` | JWT | "superadmin", "school_admin" | disaster_management | `P:disaster_management.routes.py:87` | W | - |
| GET | `/api/v1/emergency/drills/<uuid:drill_id>` | JWT |  | disaster_management | `P:disaster_management.routes.py:121` | W | - |
| PATCH | `/api/v1/emergency/drills/<uuid:drill_id>` | JWT | "superadmin", "school_admin" | disaster_management | `P:disaster_management.routes.py:136` | W | - |
| DELETE | `/api/v1/emergency/drills/<uuid:drill_id>` | JWT | "superadmin", "school_admin" | disaster_management | `P:disaster_management.routes.py:179` | W | - |
| GET | `/api/v1/emergency/drills/<uuid:drill_id>/participations` | JWT |  | disaster_management | `P:disaster_management.routes.py:195` | W | - |
| POST | `/api/v1/emergency/drills/<uuid:drill_id>/participations` | JWT | "superadmin", "school_admin", "teacher" | disaster_management | `P:disaster_management.routes.py:215` | W | - |
| GET | `/api/v1/emergency/seismic-alerts` | JWT |  | disaster_management | `P:disaster_management.routes.py:404` | W | - |
| POST | `/api/v1/incidents/management` | JWT | "superadmin", "school_admin", "teacher" | incident_management | `P:incident_management.routes.py:172` | W | - |
| POST | `/api/v1/incidents/management/<uuid:incident_id>/assign` | JWT | "superadmin", "school_admin" | incident_management | `P:incident_management.routes.py:233` | W | - |
| GET | `/api/v1/incidents/management/<uuid:incident_id>/audit` | JWT |  | incident_management | `P:incident_management.routes.py:442` | W | - |
| POST | `/api/v1/incidents/management/<uuid:incident_id>/conference` | JWT | "superadmin", "school_admin" | incident_management | `P:incident_management.routes.py:405` | W | - |
| POST | `/api/v1/incidents/management/<uuid:incident_id>/escalate` | JWT | "superadmin", "school_admin" | incident_management | `P:incident_management.routes.py:304` | W | - |
| PATCH | `/api/v1/incidents/management/<uuid:incident_id>/resolve` | JWT | "superadmin", "school_admin" | incident_management | `P:incident_management.routes.py:383` | W | - |
| POST | `/api/v1/incidents/management/<uuid:incident_id>/status` | JWT | "superadmin", "school_admin" | incident_management | `P:incident_management.routes.py:269` | W | - |
| GET | `/api/v1/incidents/management/active` | JWT |  | incident_management | `P:incident_management.routes.py:123` | W | - |
| GET | `/api/v1/incidents/management/escalations` | JWT |  | incident_management | `P:incident_management.routes.py:145` | W | - |
| GET | `/api/v1/incidents/management/overview` | JWT |  | incident_management | `P:incident_management.routes.py:81` | W | - |
| GET | `/api/v1/incidents/management/reports` | JWT |  | incident_management | `P:incident_management.routes.py:462` | W | - |
| GET | `/api/v1/schools/branches` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:388` | W | - |
| POST | `/api/v1/schools/branches` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:410` | W | - |
| PATCH | `/api/v1/schools/branches/<member_id>` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:527` | W | - |
| DELETE | `/api/v1/schools/branches/<member_id>` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:579` | W | - |
| GET | `/api/v1/schools/chain/analytics` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:287` | W | - |
| GET | `/api/v1/schools/chain/dashboard` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:245` | W | - |
| GET | `/api/v1/schools/chain/overview` | JWT | "superadmin", "school_admin" | multi_branch | `P:multi_branch.routes.py:200` | W | - |
| GET | `/api/v1/schools/white-label/branding` | JWT |  | white_label | `P:white_label.routes.py:121` | W | - |
| PATCH | `/api/v1/schools/white-label/branding` | JWT | "superadmin", "school_admin" | white_label | `P:white_label.routes.py:130` | W | - |
| GET | `/api/v1/schools/white-label/domain` | JWT |  | white_label | `P:white_label.routes.py:66` | W | - |
| POST | `/api/v1/schools/white-label/domain` | JWT | "superadmin", "school_admin" | white_label | `P:white_label.routes.py:78` | W | - |
| POST | `/api/v1/schools/white-label/domain/verify` | JWT | "superadmin", "school_admin" | white_label | `P:white_label.routes.py:101` | W | - |
| GET | `/api/v1/schools/white-label/overview` | JWT |  | white_label | `P:white_label.routes.py:27` | W | - |
| GET | `/api/v1/schools/white-label/theme` | JWT |  | white_label | `P:white_label.routes.py:151` | W | - |
| PATCH | `/api/v1/schools/white-label/theme` | JWT | "superadmin", "school_admin" | white_label | `P:white_label.routes.py:160` | W | - |
| POST | `/api/v1/ai/ext/live-polls` | JWT |  |  | `S:ai.extensions.py:233` | - | - |
| GET | `/api/v1/ai/ext/live-polls/<key>/results` | JWT |  |  | `S:ai.extensions.py:254` | - | - |
| POST | `/api/v1/ai/ext/live-polls/<key>/vote` | JWT |  |  | `S:ai.extensions.py:245` | - | - |
| GET | `/api/v1/ai/ext/pd/framework` | JWT | "superadmin", "school_admin", "teacher" |  | `S:ai.extensions.py:126` | - | - |
| GET/POST | `/api/v1/ai/ext/pd/progress` | JWT | "superadmin", "school_admin", "teacher" |  | `S:ai.extensions.py:136` | - | - |
| GET | `/api/v1/academics/classes` | JWT |  |  | `academics.py:334` | W | M |
| POST | `/api/v1/academics/classes` | JWT | "superadmin", "school_admin" |  | `academics.py:358` | W | M |
| PUT | `/api/v1/academics/classes/<uuid:class_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:399` | W | M |
| DELETE | `/api/v1/academics/classes/<uuid:class_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:416` | W | M |
| GET | `/api/v1/academics/classes/<uuid:class_id>/sections` | JWT |  |  | `academics.py:431` | W | M |
| POST | `/api/v1/academics/classes/<uuid:class_id>/sections` | JWT | "superadmin", "school_admin" |  | `academics.py:446` | W | M |
| PUT | `/api/v1/academics/classes/<uuid:class_id>/sections/<uuid:section_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:470` | W | M |
| DELETE | `/api/v1/academics/classes/<uuid:class_id>/sections/<uuid:section_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:499` | W | M |
| GET | `/api/v1/academics/classes/<uuid:class_id>/subject-teachers` | JWT |  |  | `academics.py:703` | W | M |
| PUT | `/api/v1/academics/classes/<uuid:class_id>/subject-teachers` | JWT | "superadmin", "school_admin" |  | `academics.py:743` | W | M |
| GET | `/api/v1/academics/classes/<uuid:class_id>/subjects` | JWT |  |  | `academics.py:600` | W | M |
| POST | `/api/v1/academics/classes/<uuid:class_id>/subjects` | JWT | "superadmin", "school_admin" |  | `academics.py:857` | W | M |
| GET | `/api/v1/academics/curriculum/frameworks` | JWT |  |  | `academics.py:1220` | W | - |
| GET | `/api/v1/academics/curriculum/frameworks/<uuid:framework_id>` | JWT |  |  | `academics.py:1251` | W | - |
| GET | `/api/v1/academics/mediums` | JWT |  |  | `academics.py:177` | - | - |
| POST | `/api/v1/academics/mediums` | JWT | "superadmin", "school_admin" |  | `academics.py:185` | - | - |
| PUT | `/api/v1/academics/mediums/<uuid:medium_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:200` | - | - |
| DELETE | `/api/v1/academics/mediums/<uuid:medium_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:216` | - | - |
| GET | `/api/v1/academics/semesters` | JWT |  |  | `academics.py:116` | - | - |
| POST | `/api/v1/academics/semesters` | JWT | "superadmin", "school_admin" |  | `academics.py:131` | - | - |
| PUT | `/api/v1/academics/semesters/<uuid:semester_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:146` | - | - |
| DELETE | `/api/v1/academics/semesters/<uuid:semester_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:165` | - | - |
| GET | `/api/v1/academics/shifts` | JWT |  |  | `academics.py:283` | - | - |
| POST | `/api/v1/academics/shifts` | JWT | "superadmin", "school_admin" |  | `academics.py:291` | - | - |
| PUT | `/api/v1/academics/shifts/<uuid:shift_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:306` | - | - |
| DELETE | `/api/v1/academics/shifts/<uuid:shift_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:322` | - | - |
| GET | `/api/v1/academics/streams` | JWT |  |  | `academics.py:228` | - | - |
| POST | `/api/v1/academics/streams` | JWT | "superadmin", "school_admin" |  | `academics.py:240` | - | - |
| PUT | `/api/v1/academics/streams/<uuid:stream_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:255` | - | - |
| DELETE | `/api/v1/academics/streams/<uuid:stream_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:271` | - | - |
| GET | `/api/v1/academics/subject-offerings` | JWT |  |  | `academics.py:1276` | - | - |
| GET | `/api/v1/academics/subjects` | JWT |  |  | `academics.py:520` | W | M |
| POST | `/api/v1/academics/subjects` | JWT | "superadmin", "school_admin" |  | `academics.py:558` | W | M |
| PUT | `/api/v1/academics/subjects/<uuid:subject_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:573` | W | M |
| DELETE | `/api/v1/academics/subjects/<uuid:subject_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:587` | W | M |
| GET | `/api/v1/academics/years` | JWT |  |  | `academics.py:37` | W | M |
| POST | `/api/v1/academics/years` | JWT | "superadmin", "school_admin" |  | `academics.py:47` | W | M |
| PUT | `/api/v1/academics/years/<uuid:year_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:70` | W | M |
| DELETE | `/api/v1/academics/years/<uuid:year_id>` | JWT | "superadmin", "school_admin" |  | `academics.py:100` | W | M |
| GET | `/api/v1/admission/applications` | JWT |  | admission | `admission.py:114` | W | M |
| POST | `/api/v1/admission/applications` | JWT |  | admission | `admission.py:131` | W | M |
| PUT | `/api/v1/admission/applications/<app_id>` | JWT | "superadmin", "school_admin" | admission | `admission.py:190` | W | M |
| GET | `/api/v1/admission/applications/<app_id>` | JWT |  | admission | `admission.py:234` | W | M |
| PUT | `/api/v1/admission/applications/<app_id>/status` | JWT | "superadmin", "school_admin" | admission | `admission.py:269` | W | M |
| GET | `/api/v1/admission/dashboard` | JWT |  | admission | `admission.py:324` | W | M |
| GET | `/api/v1/admission/inquiries` | JWT |  | admission | `admission.py:52` | W | M |
| POST | `/api/v1/admission/inquiries` | JWT |  | admission | `admission.py:66` | W | M |
| PUT | `/api/v1/admission/inquiries/<inquiry_id>` | JWT | "superadmin", "school_admin" | admission | `admission.py:81` | W | M |
| GET | `/api/v1/admission/registrations` | JWT | "superadmin", "school_admin", "teacher" | admission | `admission.py:420` | W | - |
| POST | `/api/v1/admission/registrations/<uuid:registration_id>/convert` | JWT | "superadmin", "school_admin" | admission | `admission.py:477` | W | - |
| POST | `/api/v1/admission/registrations/<uuid:registration_id>/review` | JWT | "superadmin", "school_admin" | admission | `admission.py:453` | W | - |
| GET | `/api/v1/admission/seats` | JWT | "superadmin", "school_admin", "teacher" | admission | `admission.py:559` | W | - |
| PUT | `/api/v1/admission/seats` | JWT | "superadmin", "school_admin" | admission | `admission.py:593` | W | - |
| POST | `/api/v1/capture/confirm` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_capture.py:110` | - | - |
| POST | `/api/v1/capture/photo` | PUB |  |  | `ai_capture.py:189` | - | - |
| POST | `/api/v1/capture/voice` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_capture.py:24` | - | - |
| GET | `/api/v1/ai/ext/qti/export` | JWT |  | ai_suite | `ai_extensions.py:18` | - | - |
| POST | `/api/v1/ai-tools/form-assist` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:481` | W | M |
| GET | `/api/v1/ai-tools/generated-papers/<uuid:paper_id>` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:463` | - | - |
| POST | `/api/v1/ai-tools/homework-help` | JWT |  | ai_suite | `ai_tools.py:168` | - | M |
| GET | `/api/v1/ai-tools/insights/daily-brief` | JWT | "superadmin", "school_admin" | ai_suite | `ai_tools.py:204` | W | M |
| GET | `/api/v1/ai-tools/insights/risk-alerts` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:218` | W | M |
| GET | `/api/v1/ai-tools/insights/weekly` | JWT | "superadmin", "school_admin" | ai_suite | `ai_tools.py:190` | W | M |
| POST | `/api/v1/ai-tools/lesson-plan` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:57` | W | M |
| POST | `/api/v1/ai-tools/letter-writer` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:232` | W | - |
| GET | `/api/v1/ai-tools/question-bank` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:260` | - | - |
| POST | `/api/v1/ai-tools/question-bank` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:293` | - | - |
| PUT | `/api/v1/ai-tools/question-bank/<uuid:item_id>` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:346` | - | - |
| DELETE | `/api/v1/ai-tools/question-bank/<uuid:item_id>` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:378` | - | - |
| POST | `/api/v1/ai-tools/question-paper` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:21` | W | M |
| POST | `/api/v1/ai-tools/question-paper/v2` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:396` | W | M |
| POST | `/api/v1/ai-tools/remarks` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tools.py:138` | W | M |
| POST | `/api/v1/ai-tools/timetable` | JWT | "superadmin", "school_admin" | ai_suite | `ai_tools.py:94` | W | M |
| POST | `/api/v1/ai-tools/timetable/save` | JWT | "superadmin", "school_admin" | ai_suite | `ai_tools.py:120` | W | M |
| POST | `/api/v1/tutor/plans` | JWT |  | ai_suite | `ai_tutor.py:18` | W | - |
| POST | `/api/v1/tutor/sessions` | JWT |  | ai_suite | `ai_tutor.py:90` | W | - |
| POST | `/api/v1/tutor/sessions/<uuid:session_id>/close` | JWT |  | ai_suite | `ai_tutor.py:137` | W | - |
| GET | `/api/v1/tutor/sessions/<uuid:session_id>/messages` | JWT |  | ai_suite | `ai_tutor.py:154` | W | - |
| POST | `/api/v1/tutor/sessions/<uuid:session_id>/turn` | JWT |  | ai_suite | `ai_tutor.py:111` | W | - |
| GET | `/api/v1/tutor/students/<uuid:student_id>/monitor` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_tutor.py:187` | - | - |
| GET | `/api/v1/ai-usage/logs` | JWT | "superadmin", "school_admin" |  | `ai_usage.py:183` | W | - |
| GET | `/api/v1/ai-usage/quota` | JWT | "superadmin", "school_admin" |  | `ai_usage.py:27` | W | - |
| PUT | `/api/v1/ai-usage/quota` | JWT | "superadmin", "school_admin" |  | `ai_usage.py:52` | W | - |
| POST | `/api/v1/ai-usage/quota/init` | JWT | "superadmin", "school_admin" |  | `ai_usage.py:75` | W | - |
| GET | `/api/v1/ai-usage/stats` | JWT | "superadmin", "school_admin" |  | `ai_usage.py:93` | W | - |
| POST | `/api/v1/ai/generate/<tool_key>` | JWT | "superadmin", "school_admin", "teacher", "student", "parent" | ai_suite | `ai_workbench.py:31` | W | - |
| GET | `/api/v1/ai/generations/<uuid:generation_id>` | JWT |  |  | `ai_workbench.py:154` | - | - |
| POST | `/api/v1/ai/iep` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `ai_workbench.py:351` | - | - |
| GET | `/api/v1/ai/iep` | JWT |  | ai_suite | `ai_workbench.py:475` | - | - |
| POST | `/api/v1/ai/iep/<uuid:plan_id>/review` | JWT |  | ai_suite | `ai_workbench.py:428` | - | - |
| GET | `/api/v1/ai/library` | JWT |  | ai_suite | `ai_workbench.py:248` | - | - |
| POST | `/api/v1/ai/library` | JWT |  | ai_suite | `ai_workbench.py:287` | - | - |
| DELETE | `/api/v1/ai/library/<uuid:item_id>` | JWT |  | ai_suite | `ai_workbench.py:321` | - | - |
| GET | `/api/v1/ai/moderation/flags` | JWT | "superadmin", "school_admin" | ai_suite | `ai_workbench.py:181` | - | - |
| POST | `/api/v1/ai/moderation/flags/<uuid:flag_id>/resolve` | JWT | "superadmin", "school_admin" | ai_suite | `ai_workbench.py:223` | - | - |
| GET | `/api/v1/ai/tools` | JWT |  | ai_suite | `ai_workbench.py:49` | W | - |
| GET | `/api/v1/ai/tools/<tool_key>/nutrition` | JWT |  |  | `ai_workbench.py:82` | W | - |
| GET | `/api/v1/ai/tools/<tool_key>/settings` | JWT | "superadmin", "school_admin" | ai_suite | `ai_workbench.py:97` | W | - |
| PUT | `/api/v1/ai/tools/<tool_key>/settings` | JWT | "superadmin", "school_admin" | ai_suite | `ai_workbench.py:118` | W | - |
| GET | `/api/v1/alumni` | JWT |  | alumni | `alumni.py:22` | W | M |
| POST | `/api/v1/alumni` | JWT | "superadmin", "school_admin" | alumni | `alumni.py:65` | W | M |
| GET | `/api/v1/alumni/<uuid:alumni_id>` | JWT |  | alumni | `alumni.py:89` | W | M |
| PUT | `/api/v1/alumni/<uuid:alumni_id>` | JWT | "superadmin", "school_admin" | alumni | `alumni.py:100` | W | M |
| DELETE | `/api/v1/alumni/<uuid:alumni_id>` | JWT | "superadmin", "school_admin" | alumni | `alumni.py:119` | W | M |
| GET | `/api/v1/alumni/donations` | JWT | "superadmin", "school_admin", "accountant" | alumni | `alumni.py:197` | - | M |
| POST | `/api/v1/alumni/donations` | JWT | "superadmin", "school_admin", "accountant" | alumni | `alumni.py:211` | - | M |
| GET | `/api/v1/alumni/events` | JWT |  | alumni | `alumni.py:135` | - | M |
| POST | `/api/v1/alumni/events` | JWT | "superadmin", "school_admin" | alumni | `alumni.py:145` | - | M |
| PUT | `/api/v1/alumni/events/<uuid:event_id>` | JWT | "superadmin", "school_admin" | alumni | `alumni.py:169` | - | M |
| GET | `/api/v1/analytics/academic` | JWT | "school_admin", "teacher" |  | `analytics.py:302` | W | - |
| GET | `/api/v1/analytics/benchmarking` | JWT | "school_admin", "teacher" |  | `analytics.py:479` | - | - |
| GET | `/api/v1/analytics/financial` | JWT | "school_admin", "accountant" |  | `analytics.py:403` | W | - |
| GET | `/api/v1/analytics/overview` | JWT | "school_admin", "superadmin", "teacher", "accountant" |  | `analytics.py:288` | W | M |
| GET | `/api/v1/analytics/superadmin-dashboard` | PUB | superadmin |  | `analytics.py:590` | W | - |
| GET | `/api/v1/analytics/teacher-dashboard` | JWT | "teacher", "school_admin" |  | `analytics.py:524` | W | - |
| GET | `/api/v1/assignments` | JWT |  | assignments | `assignments.py:33` | W | M |
| POST | `/api/v1/assignments` | JWT | "superadmin", "school_admin", "teacher" | assignments | `assignments.py:50` | W | M |
| GET | `/api/v1/assignments/<assignment_id>` | JWT |  | assignments | `assignments.py:106` | W | M |
| PUT | `/api/v1/assignments/<assignment_id>` | JWT | "superadmin", "school_admin", "teacher" | assignments | `assignments.py:122` | W | M |
| DELETE | `/api/v1/assignments/<assignment_id>` | JWT | "superadmin", "school_admin" | assignments | `assignments.py:148` | W | M |
| POST | `/api/v1/assignments/<assignment_id>/ai-grade` | JWT | "superadmin", "school_admin", "teacher" | assignments | `assignments.py:316` | - | - |
| GET | `/api/v1/assignments/<assignment_id>/submissions` | JWT |  | assignments | `assignments.py:169` | - | M |
| POST | `/api/v1/assignments/<assignment_id>/submissions/<sub_id>/grade` | JWT | "superadmin", "school_admin", "teacher" | assignments | `assignments.py:262` | - | M |
| POST | `/api/v1/assignments/<assignment_id>/submit` | JWT |  | assignments | `assignments.py:195` | - | - |
| POST | `/api/v1/assignments/submissions/<sub_id>/grade` | JWT | "superadmin", "school_admin", "teacher" | assignments | `assignments.py:291` | - | M |
| POST | `/api/v1/attendance/holiday` | JWT | "school_admin", "superadmin" | attendance | `attendance.py:1006` | W | - |
| POST | `/api/v1/attendance/import/commit` | JWT | "school_admin", "teacher" | attendance | `attendance.py:1173` | W | - |
| POST | `/api/v1/attendance/import/preview` | JWT | "school_admin", "teacher" | attendance | `attendance.py:1161` | W | - |
| GET | `/api/v1/attendance/leave-requests` | JWT |  | attendance | `attendance.py:551` | W | - |
| POST | `/api/v1/attendance/leave-requests` | JWT |  | attendance | `attendance.py:568` | W | - |
| POST | `/api/v1/attendance/leave-requests/<uuid:request_id>/approve` | JWT | "school_admin", "teacher" | attendance | `attendance.py:604` | W | - |
| POST | `/api/v1/attendance/leave-requests/<uuid:request_id>/reject` | JWT | "school_admin", "teacher" | attendance | `attendance.py:658` | W | - |
| GET | `/api/v1/attendance/list` | JWT |  | attendance | `attendance.py:260` | W | - |
| POST | `/api/v1/attendance/mark` | JWT | "school_admin", "teacher" | attendance | `attendance.py:22` | W | - |
| GET | `/api/v1/attendance/me` | JWT |  | attendance | `attendance.py:529` | - | M |
| GET | `/api/v1/attendance/register/print` | JWT |  | attendance | `attendance.py:1064` | W | - |
| GET | `/api/v1/attendance/school-overview` | JWT | "school_admin" | attendance | `attendance.py:358` | W | M |
| GET | `/api/v1/attendance/student/<student_id>` | JWT |  | attendance | `attendance.py:213` | W | M |
| GET | `/api/v1/attendance/student/<student_id>/summary` | JWT |  | attendance | `attendance.py:232` | W | M |
| GET | `/api/v1/attendance/students/<class_id>` | JWT | "school_admin", "teacher" | attendance | `attendance.py:178` | - | M |
| GET | `/api/v1/attendance/subject/list` | JWT |  | attendance | `attendance.py:907` | W | - |
| POST | `/api/v1/attendance/subject/mark` | JWT | "school_admin", "teacher" | attendance | `attendance.py:810` | W | - |
| GET | `/api/v1/attendance/subject/report` | JWT |  | attendance | `attendance.py:950` | W | - |
| POST | `/api/v1/attendance/submit` | JWT | "school_admin", "teacher" | attendance | `attendance.py:168` | - | M |
| GET | `/api/v1/attendance/summary` | JWT |  | attendance | `attendance.py:305` | W | - |
| GET | `/api/v1/attendance/teachers/list` | JWT | "school_admin" | attendance | `attendance.py:507` | W | - |
| POST | `/api/v1/attendance/teachers/mark` | JWT | "school_admin" | attendance | `attendance.py:440` | W | - |
| GET | `/api/v1/auth/aos-settings` | JWT |  |  | `auth.py:329` | W | - |
| PUT | `/api/v1/auth/aos-settings` | JWT |  |  | `auth.py:344` | W | - |
| POST | `/api/v1/auth/change-password` | JWT |  |  | `auth.py:386` | - | M |
| POST | `/api/v1/auth/forgot-password` | PUB |  |  | `auth.py:421` | W | - |
| POST | `/api/v1/auth/login` | PUB |  |  | `auth.py:214` | W | M |
| POST | `/api/v1/auth/logout` | JWT |  |  | `auth.py:710` | W | - |
| POST | `/api/v1/auth/logout-all` | JWT |  |  | `auth.py:729` | - | - |
| GET | `/api/v1/auth/me` | JWT |  |  | `auth.py:267` | W | M |
| PUT | `/api/v1/auth/me` | JWT |  |  | `auth.py:278` | W | M |
| POST | `/api/v1/auth/refresh` | JWT |  |  | `auth.py:254` | W | M |
| POST | `/api/v1/auth/register` | PUB |  |  | `auth.py:558` | W | M |
| POST | `/api/v1/auth/register-fcm` | JWT |  |  | `auth.py:924` | - | M |
| POST | `/api/v1/auth/register-onesignal` | JWT |  |  | `auth.py:967` | - | M |
| POST | `/api/v1/auth/reset-password` | PUB |  |  | `auth.py:515` | W | - |
| POST | `/api/v1/auth/send-otp` | PUB |  |  | `auth.py:179` | W | M |
| POST | `/api/v1/auth/student-login` | PUB |  |  | `auth.py:234` | W | M |
| POST | `/api/v1/auth/totp/challenge` | PUB |  |  | `auth.py:877` | - | - |
| POST | `/api/v1/auth/totp/disable` | JWT |  |  | `auth.py:849` | - | - |
| POST | `/api/v1/auth/totp/setup` | JWT |  |  | `auth.py:762` | - | - |
| POST | `/api/v1/auth/totp/verify` | JWT |  |  | `auth.py:806` | - | - |
| POST | `/api/v1/auth/verify-otp` | PUB |  |  | `auth.py:198` | W | M |
| GET | `/api/v1/benchmarking/overview` | JWT | "school_admin", "teacher" | ai_suite | `benchmarking.py:31` | W | - |
| GET | `/api/v1/benchmarking/rankings` | JWT | "school_admin", "teacher" | ai_suite | `benchmarking.py:228` | - | - |
| POST | `/api/v1/communications/broadcast` | JWT | "superadmin", "school_admin" | sms_notifications | `communications.py:234` | W | - |
| GET | `/api/v1/communications/contacts` | JWT |  |  | `communications.py:35` | - | M |
| GET | `/api/v1/communications/diary` | JWT |  | notices | `communications.py:661` | W | M |
| POST | `/api/v1/communications/diary` | JWT | "superadmin", "school_admin", "teacher" | notices | `communications.py:678` | W | M |
| GET | `/api/v1/communications/diary/categories` | JWT |  | notices | `communications.py:586` | W | M |
| POST | `/api/v1/communications/diary/categories` | JWT | "superadmin", "school_admin", "teacher" | notices | `communications.py:599` | W | M |
| PUT | `/api/v1/communications/diary/categories/<uuid:category_id>` | JWT | "superadmin", "school_admin", "teacher" | notices | `communications.py:621` | W | M |
| DELETE | `/api/v1/communications/diary/categories/<uuid:category_id>` | JWT | "superadmin", "school_admin", "teacher" | notices | `communications.py:643` | W | M |
| GET | `/api/v1/communications/messages/<uuid:user_id>` | JWT |  |  | `communications.py:50` | - | M |
| POST | `/api/v1/communications/send` | JWT |  |  | `communications.py:84` | - | M |
| GET | `/api/v1/communications/stats` | JWT |  | sms_notifications | `communications.py:130` | W | - |
| GET | `/api/v1/communications/templates` | JWT |  | sms_notifications | `communications.py:171` | W | - |
| POST | `/api/v1/communications/templates` | JWT | "superadmin", "school_admin" | sms_notifications | `communications.py:184` | W | - |
| DELETE | `/api/v1/communications/templates/<uuid:template_id>` | JWT | "superadmin", "school_admin" | sms_notifications | `communications.py:215` | W | - |
| GET | `/api/v1/compliance/audit-logs` | JWT | "superadmin", "school_admin" | compliance | `compliance.py:211` | - | M |
| GET | `/api/v1/compliance/emis` | JWT |  | compliance | `compliance.py:124` | - | - |
| GET | `/api/v1/compliance/emis/<uuid:export_id>/download` | JWT |  | compliance | `compliance.py:156` | - | - |
| POST | `/api/v1/compliance/emis/generate` | JWT | "superadmin", "school_admin" | compliance | `compliance.py:134` | - | - |
| GET | `/api/v1/compliance/reports` | JWT |  | compliance | `compliance.py:25` | W | M |
| POST | `/api/v1/compliance/reports` | JWT | "superadmin", "school_admin" | compliance | `compliance.py:38` | W | M |
| PUT | `/api/v1/compliance/reports/<uuid:report_id>` | JWT | "superadmin", "school_admin" | compliance | `compliance.py:54` | W | M |
| POST | `/api/v1/compliance/reports/generate` | JWT | "superadmin", "school_admin" | compliance | `compliance.py:79` | W | M |
| GET | `/api/v1/conferences` | JWT |  | conferences | `conferences.py:45` | W | M |
| POST | `/api/v1/conferences` | JWT | "superadmin", "school_admin" | conferences | `conferences.py:80` | W | M |
| PUT | `/api/v1/conferences/<uuid:conf_id>` | JWT | "superadmin", "school_admin" | conferences | `conferences.py:130` | W | M |
| GET | `/api/v1/conferences/<uuid:conf_id>/slots` | JWT |  | conferences | `conferences.py:177` | - | - |
| POST | `/api/v1/conferences/<uuid:conf_id>/slots` | JWT | "superadmin", "school_admin", "teacher" | conferences | `conferences.py:195` | - | - |
| POST | `/api/v1/conferences/slots/<uuid:slot_id>/book` | JWT |  | conferences | `conferences.py:252` | - | - |
| POST | `/api/v1/conferences/slots/<uuid:slot_id>/cancel` | JWT |  | conferences | `conferences.py:312` | - | - |
| GET | `/api/v1/conferences/slots/<uuid:slot_id>/notes` | JWT |  | conferences | `conferences.py:354` | - | - |
| PUT | `/api/v1/conferences/slots/<uuid:slot_id>/notes` | JWT | "superadmin", "school_admin", "teacher" | conferences | `conferences.py:374` | - | - |
| PATCH | `/api/v1/content/chunks/<uuid:chunk_id>` | JWT | "superadmin", "school_admin", "teacher" |  | `content_admin.py:228` | W | - |
| GET | `/api/v1/content/sources` | JWT | "superadmin", "school_admin", "teacher" |  | `content_admin.py:18` | W | - |
| GET | `/api/v1/content/sources/<uuid:source_id>` | JWT | "superadmin", "school_admin", "teacher" |  | `content_admin.py:71` | W | - |
| GET | `/api/v1/content/sources/<uuid:source_id>/chunks` | JWT | "superadmin", "school_admin", "teacher" |  | `content_admin.py:138` | W | - |
| POST | `/api/v1/content/sources/<uuid:source_id>/publish` | JWT | "superadmin", "school_admin" |  | `content_admin.py:186` | W | - |
| GET | `/api/v1/custom-fields/defs` | JWT |  |  | `custom_fields.py:34` | W | - |
| POST | `/api/v1/custom-fields/defs` | JWT | "superadmin", "school_admin" |  | `custom_fields.py:49` | W | - |
| PUT | `/api/v1/custom-fields/defs/<uuid:def_id>` | JWT | "superadmin", "school_admin" |  | `custom_fields.py:64` | W | - |
| DELETE | `/api/v1/custom-fields/defs/<uuid:def_id>` | JWT | "superadmin", "school_admin" |  | `custom_fields.py:84` | W | - |
| GET | `/api/v1/custom-fields/defs/public/<slug>/<form_name>` | PUB |  |  | `custom_fields.py:98` | W | - |
| GET | `/api/v1/database-backup` | JWT |  |  | `db_backup_api.py:15` | W | - |
| POST | `/api/v1/database-backup/trigger` | JWT | "superadmin" |  | `db_backup_api.py:55` | W | - |
| POST | `/api/v1/design-studio/ai/agent` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1016` | W | - |
| POST | `/api/v1/design-studio/ai/homework-help` | JWT |  | ai_suite | `design_studio.py:821` | W | - |
| GET | `/api/v1/design-studio/ai/insights` | JWT | "superadmin", "school_admin" | ai_suite | `design_studio.py:795` | W | - |
| POST | `/api/v1/design-studio/ai/lesson-plan` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `design_studio.py:775` | W | - |
| POST | `/api/v1/design-studio/ai/question-paper` | JWT | "superadmin", "school_admin", "teacher" | ai_suite | `design_studio.py:753` | W | - |
| GET | `/api/v1/design-studio/ai/risk-students` | JWT | "superadmin", "school_admin" | ai_suite | `design_studio.py:808` | W | - |
| POST | `/api/v1/design-studio/ai/suggest` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:921` | W | - |
| POST | `/api/v1/design-studio/bulk/admit-cards` | JWT | "superadmin", "school_admin" | design_studio | `design_studio.py:686` | W | - |
| POST | `/api/v1/design-studio/bulk/attendance-ledger` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:728` | W | - |
| POST | `/api/v1/design-studio/bulk/certificates` | JWT | "superadmin", "school_admin" | design_studio | `design_studio.py:708` | W | - |
| POST | `/api/v1/design-studio/bulk/id-cards` | JWT | "superadmin", "school_admin" | design_studio | `design_studio.py:473` | W | - |
| POST | `/api/v1/design-studio/bulk/marksheets` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:494` | W | - |
| GET | `/api/v1/design-studio/data-sources` | JWT |  | design_studio | `design_studio.py:17` | W | - |
| GET | `/api/v1/design-studio/data-sources/<source_type>/records` | JWT |  | design_studio | `design_studio.py:112` | W | - |
| GET | `/api/v1/design-studio/documents` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:843` | W | M |
| POST | `/api/v1/design-studio/documents` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:858` | W | M |
| GET | `/api/v1/design-studio/documents/<doc_id>` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:888` | W | M |
| DELETE | `/api/v1/design-studio/documents/<doc_id>` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:903` | W | M |
| GET | `/api/v1/design-studio/documents/<doc_id>/revisions` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1362` | W | M |
| POST | `/api/v1/design-studio/documents/revisions/<revision_id>/restore` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1374` | W | M |
| POST | `/api/v1/design-studio/export/bulk-pdf` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1257` | W | - |
| POST | `/api/v1/design-studio/export/pdf` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1186` | W | - |
| POST | `/api/v1/design-studio/generate/results` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:526` | W | - |
| POST | `/api/v1/design-studio/render` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:417` | W | - |
| GET | `/api/v1/design-studio/templates` | JWT |  | design_studio | `design_studio.py:370` | W | M |
| POST | `/api/v1/design-studio/templates` | JWT | "superadmin", "school_admin" | design_studio | `design_studio.py:400` | W | M |
| GET | `/api/v1/design-studio/templates/<template_key>/assets/<path:filename>` | PUB |  |  | `design_studio.py:1401` | W | M |
| GET | `/api/v1/design-studio/templates/<template_key>/thumbnail` | PUB |  |  | `design_studio.py:1421` | W | M |
| POST | `/api/v1/design-studio/writer/export-docx` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1442` | W | - |
| POST | `/api/v1/design-studio/writer/research` | JWT | "superadmin", "school_admin", "teacher" | design_studio | `design_studio.py:1116` | W | - |
| GET | `/api/v1/dismissal/authorized` | JWT |  | dismissal | `dismissal.py:21` | - | - |
| POST | `/api/v1/dismissal/authorized` | JWT | "superadmin", "school_admin", "parent" | dismissal | `dismissal.py:34` | - | - |
| PUT | `/api/v1/dismissal/authorized/<uuid:pickup_id>` | JWT | "superadmin", "school_admin", "parent" | dismissal | `dismissal.py:59` | - | - |
| DELETE | `/api/v1/dismissal/authorized/<uuid:pickup_id>` | JWT | "superadmin", "school_admin", "parent" | dismissal | `dismissal.py:78` | - | - |
| GET | `/api/v1/dismissal/records` | JWT |  | dismissal | `dismissal.py:96` | W | M |
| POST | `/api/v1/dismissal/records` | JWT | "superadmin", "school_admin", "teacher" | dismissal | `dismissal.py:123` | W | M |
| GET | `/api/v1/dismissal/summary` | JWT |  | dismissal | `dismissal.py:272` | - | M |
| POST | `/api/v1/dismissal/verify-qr` | JWT |  | dismissal | `dismissal.py:146` | W | - |
| GET | `/api/v1/elibrary/books` | JWT |  | elibrary | `elibrary.py:15` | W | - |
| POST | `/api/v1/elibrary/books` | JWT | "superadmin", "school_admin", "teacher" | elibrary | `elibrary.py:36` | W | - |
| GET | `/api/v1/elibrary/papers` | JWT |  | elibrary | `elibrary.py:57` | W | - |
| POST | `/api/v1/elibrary/papers` | JWT | "superadmin", "school_admin", "teacher" | elibrary | `elibrary.py:70` | W | - |
| GET | `/api/v1/elibrary/resources` | JWT |  | elibrary | `elibrary.py:97` | W | - |
| POST | `/api/v1/elibrary/resources` | JWT | "superadmin", "school_admin", "teacher" | elibrary | `elibrary.py:110` | W | - |
| GET | `/api/v1/emergency/alerts` | JWT |  | emergency | `emergency.py:21` | W | M |
| POST | `/api/v1/emergency/alerts` | JWT | "superadmin", "school_admin" | emergency | `emergency.py:34` | W | M |
| GET | `/api/v1/emergency/alerts/<uuid:alert_id>/headcount` | JWT |  | emergency | `emergency.py:159` | W | M |
| POST | `/api/v1/emergency/alerts/<uuid:alert_id>/headcount` | JWT |  | emergency | `emergency.py:171` | W | M |
| POST | `/api/v1/emergency/alerts/<uuid:alert_id>/resolve` | JWT | "superadmin", "school_admin" | emergency | `emergency.py:70` | W | M |
| GET | `/api/v1/emergency/plans` | JWT |  | emergency | `emergency.py:94` | W | M |
| POST | `/api/v1/emergency/plans` | JWT | "superadmin", "school_admin" | emergency | `emergency.py:104` | W | M |
| PUT | `/api/v1/emergency/plans/<uuid:plan_id>` | JWT | "superadmin", "school_admin" | emergency | `emergency.py:122` | W | M |
| DELETE | `/api/v1/emergency/plans/<uuid:plan_id>` | JWT | "superadmin", "school_admin" | emergency | `emergency.py:141` | W | M |
| GET | `/api/v1/exams` | JWT |  | exams | `exams.py:239` | W | M |
| POST | `/api/v1/exams` | JWT | "school_admin" | exams | `exams.py:750` | W | M |
| GET | `/api/v1/exams/<uuid:exam_id>` | JWT |  | exams | `exams.py:796` | W | M |
| PUT | `/api/v1/exams/<uuid:exam_id>` | JWT | "school_admin" | exams | `exams.py:824` | W | M |
| DELETE | `/api/v1/exams/<uuid:exam_id>` | JWT | "school_admin" | exams | `exams.py:858` | W | M |
| GET | `/api/v1/exams/<uuid:exam_id>/bulk-marksheet-pdf` | JWT | "school_admin", "teacher" | exams | `exams.py:1864` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/components` | JWT |  | exams | `exams.py:2398` | - | - |
| PUT | `/api/v1/exams/<uuid:exam_id>/components` | JWT | "school_admin", "teacher" | exams | `exams.py:2431` | - | - |
| POST | `/api/v1/exams/<uuid:exam_id>/designer-marksheet` | JWT | "school_admin", "teacher" | exams | `exams.py:1693` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/grade-sheet` | JWT |  | exams | `exams.py:1381` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/marks` | JWT |  | exams | `exams.py:875` | W | - |
| POST | `/api/v1/exams/<uuid:exam_id>/marks` | JWT | "school_admin", "teacher" | exams | `exams.py:936` | W | - |
| POST | `/api/v1/exams/<uuid:exam_id>/marks/unlock` | JWT | "school_admin" | exams | `exams.py:1763` | W | - |
| GET | `/api/v1/exams/<uuid:exam_id>/marksheet/<uuid:student_id>` | JWT |  | exams | `exams.py:1547` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/marksheet/<uuid:student_id>/html` | JWT |  | exams | `exams.py:1650` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/merit-list` | JWT |  | exams | `exams.py:2769` | - | - |
| POST | `/api/v1/exams/<uuid:exam_id>/publish` | JWT | "school_admin" | exams | `exams.py:1744` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/report-cards` | JWT |  | exams | `exams.py:1808` | W | - |
| POST | `/api/v1/exams/<uuid:exam_id>/report-cards` | JWT | "school_admin" | exams | `exams.py:1845` | W | - |
| GET | `/api/v1/exams/<uuid:exam_id>/report-cards/<uuid:student_id>` | JWT |  | exams | `exams.py:1790` | W | - |
| GET | `/api/v1/exams/<uuid:exam_id>/report-cards/bulk-pdf` | JWT | "school_admin", "teacher" | exams | `exams.py:1932` | W | - |
| GET | `/api/v1/exams/<uuid:exam_id>/results` | JWT |  | exams | `exams.py:1281` | W | M |
| GET | `/api/v1/exams/<uuid:exam_id>/subjects` | JWT |  | exams | `exams.py:1198` | - | - |
| GET | `/api/v1/exams/<uuid:exam_id>/tabulation` | JWT |  | exams | `exams.py:2728` | W | - |
| GET | `/api/v1/exams/grade-scales` | JWT |  | exams | `exams.py:2541` | W | - |
| POST | `/api/v1/exams/grade-scales` | JWT | "school_admin", "superadmin" | exams | `exams.py:2564` | W | - |
| GET | `/api/v1/exams/grade-table` | JWT |  | exams | `exams.py:227` | W | - |
| GET | `/api/v1/exams/online` | JWT |  | exams | `exams.py:280` | W | M |
| POST | `/api/v1/exams/online` | JWT | "school_admin", "teacher" | exams | `exams.py:313` | W | M |
| GET | `/api/v1/exams/online/<uuid:online_exam_id>` | JWT |  | exams | `exams.py:407` | W | M |
| PATCH | `/api/v1/exams/online/<uuid:online_exam_id>/attempt` | JWT |  | exams | `exams.py:658` | W | M |
| POST | `/api/v1/exams/online/<uuid:online_exam_id>/start` | JWT |  | exams | `exams.py:590` | W | M |
| POST | `/api/v1/exams/online/<uuid:online_exam_id>/submit` | JWT |  | exams | `exams.py:420` | W | M |
| GET | `/api/v1/exams/online/<uuid:online_exam_id>/take` | JWT |  | exams | `exams.py:699` | W | M |
| GET | `/api/v1/exams/results` | JWT |  | exams | `exams.py:1235` | W | M |
| GET | `/api/v1/faqs` | JWT |  |  | `faqs.py:25` | W | - |
| POST | `/api/v1/faqs` | JWT |  |  | `faqs.py:50` | W | - |
| PUT | `/api/v1/faqs/<uuid:faq_id>` | JWT |  |  | `faqs.py:72` | W | - |
| DELETE | `/api/v1/faqs/<uuid:faq_id>` | JWT |  |  | `faqs.py:85` | W | - |
| GET | `/api/v1/faqs/public` | PUB |  |  | `faqs.py:37` | - | - |
| POST | `/api/v1/fees/batch-monthly` | JWT | "school_admin", "accountant" | fees | `fees.py:757` | W | - |
| POST | `/api/v1/fees/carry-forward/apply` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3508` | W | - |
| GET | `/api/v1/fees/carry-forward/log` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3649` | W | - |
| GET | `/api/v1/fees/carry-forward/preview` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3457` | W | - |
| GET | `/api/v1/fees/collections` | JWT |  | fees | `fees.py:1034` | W | M |
| POST | `/api/v1/fees/collections` | JWT | "school_admin", "accountant" | fees | `fees.py:1226` | W | M |
| PUT | `/api/v1/fees/collections/<uuid:collection_id>` | JWT | "school_admin", "accountant" | fees | `fees.py:1307` | W | M |
| POST | `/api/v1/fees/collections/<uuid:collection_id>/pay` | JWT | "school_admin", "accountant" | fees | `fees.py:1378` | W | M |
| POST | `/api/v1/fees/collections/<uuid:collection_id>/pay-online` | JWT |  | fees | `fees.py:1810` | W | M |
| GET | `/api/v1/fees/collections/<uuid:collection_id>/receipt` | JWT |  | fees | `fees.py:1550` | W | M |
| POST | `/api/v1/fees/collections/<uuid:collection_id>/refund` | JWT | "superadmin", "school_admin" | fees | `fees.py:1949` | W | M |
| GET | `/api/v1/fees/collections/export` | JWT |  | fees | `fees.py:1047` | W | M |
| GET | `/api/v1/fees/day-book` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:4275` | W | - |
| POST | `/api/v1/fees/day-closures` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:4364` | W | - |
| GET | `/api/v1/fees/day-closures` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:4453` | W | - |
| POST | `/api/v1/fees/day-closures/<uuid:closure_id>/reopen` | JWT | "school_admin", "superadmin" | fees | `fees.py:4487` | W | - |
| GET | `/api/v1/fees/defaulters` | JWT | "school_admin", "accountant" | fees | `fees.py:1132` | W | - |
| POST | `/api/v1/fees/defaulters/<uuid:student_id>/remind` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:1183` | W | - |
| POST | `/api/v1/fees/fines/accrue` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3849` | W | - |
| GET/PUT | `/api/v1/fees/fines/settings` | JWT | "school_admin", "superadmin" | fees | `fees.py:3878` | W | - |
| POST | `/api/v1/fees/initiate-payment` | JWT |  | fees | `fees.py:1819` | - | M |
| GET | `/api/v1/fees/invoices` | JWT |  | fees | `fees.py:3147` | W | M |
| GET | `/api/v1/fees/invoices/<uuid:invoice_id>` | JWT |  | fees | `fees.py:3177` | W | M |
| POST | `/api/v1/fees/offline-submissions` | JWT |  | fees | `fees.py:3996` | W | M |
| GET | `/api/v1/fees/offline-submissions` | JWT |  | fees | `fees.py:4080` | W | M |
| POST | `/api/v1/fees/offline-submissions/<uuid:submission_id>/approve` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:4121` | W | M |
| POST | `/api/v1/fees/offline-submissions/<uuid:submission_id>/reject` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:4237` | W | M |
| GET | `/api/v1/fees/outstanding` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:593` | - | M |
| GET | `/api/v1/fees/payment-methods` | JWT |  | fees | `fees.py:260` | W | M |
| PUT | `/api/v1/fees/payment-methods` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:284` | W | M |
| POST | `/api/v1/fees/payment-methods/upload-qr` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:332` | W | M |
| POST | `/api/v1/fees/payments/sweep-pending` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:4546` | - | - |
| GET/PUT | `/api/v1/fees/receipt-numbering` | JWT | "school_admin", "superadmin" | fees | `fees.py:4510` | - | - |
| GET | `/api/v1/fees/receipts/<uuid:receipt_id>` | JWT |  | fees | `fees.py:1570` | W | M |
| GET | `/api/v1/fees/receipts/<uuid:receipt_id>/pdf` | JWT |  | fees | `fees.py:1586` | W | M |
| GET | `/api/v1/fees/receivables/aging` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3681` | W | - |
| GET | `/api/v1/fees/recent` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:556` | - | M |
| GET | `/api/v1/fees/reports/fines` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3908` | W | - |
| GET | `/api/v1/fees/reports/waivers` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3939` | W | - |
| GET | `/api/v1/fees/scholarships` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:809` | W | - |
| POST | `/api/v1/fees/scholarships` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:826` | W | - |
| PATCH/PUT | `/api/v1/fees/scholarships/<uuid:scholarship_id>` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:871` | W | - |
| DELETE | `/api/v1/fees/scholarships/<uuid:scholarship_id>` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:906` | W | - |
| GET | `/api/v1/fees/structures` | JWT |  | fees | `fees.py:647` | W | - |
| POST | `/api/v1/fees/structures` | JWT | "school_admin", "accountant" | fees | `fees.py:668` | W | - |
| DELETE | `/api/v1/fees/structures/<uuid:structure_id>` | JWT | "school_admin", "accountant" | fees | `fees.py:943` | W | - |
| POST | `/api/v1/fees/structures/<uuid:structure_id>/apply` | JWT | "school_admin", "accountant" | fees | `fees.py:736` | W | - |
| GET | `/api/v1/fees/structures/<uuid:structure_id>/installments` | JWT |  | fees | `fees.py:3192` | W | - |
| PUT | `/api/v1/fees/structures/<uuid:structure_id>/installments` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3226` | W | - |
| POST | `/api/v1/fees/structures/<uuid:structure_id>/installments/apply` | JWT | "school_admin", "accountant", "superadmin" | fees | `fees.py:3314` | W | - |
| POST | `/api/v1/fees/students/<uuid:student_id>/nudge-parent` | JWT |  | fees | `fees.py:4589` | W | M |
| GET | `/api/v1/fees/students/<uuid:student_id>/statement/pdf` | JWT | "superadmin", "school_admin", "accountant" | fees | `fees.py:1622` | W | M |
| GET | `/api/v1/fees/summary` | JWT |  | fees | `fees.py:394` | W | M |
| GET | `/api/v1/fees/types` | JWT |  | fees | `fees.py:153` | W | - |
| POST | `/api/v1/fees/types` | JWT | "school_admin", "accountant" | fees | `fees.py:181` | W | - |
| PUT | `/api/v1/fees/types/<uuid:type_id>` | JWT | "school_admin", "accountant" | fees | `fees.py:210` | W | - |
| DELETE | `/api/v1/fees/types/<uuid:type_id>` | JWT | "school_admin", "accountant" | fees | `fees.py:237` | W | - |
| GET | `/api/v1/files/` | JWT |  | file_management | `files.py:252` | W | M |
| GET | `/api/v1/files/<uuid:file_id>` | JWT |  | file_management | `files.py:304` | W | M |
| PATCH | `/api/v1/files/<uuid:file_id>` | JWT |  | file_management | `files.py:317` | W | M |
| DELETE | `/api/v1/files/<uuid:file_id>` | JWT | "school_admin", "teacher", "accountant" | file_management | `files.py:336` | W | M |
| GET | `/api/v1/files/<uuid:file_id>/presigned` | JWT |  | file_management | `files.py:363` | - | - |
| GET | `/api/v1/files/folders` | JWT |  | file_management | `files.py:90` | W | M |
| POST | `/api/v1/files/folders` | JWT |  | file_management | `files.py:106` | W | M |
| PATCH | `/api/v1/files/folders/<uuid:folder_id>` | JWT | "school_admin", "teacher" | file_management | `files.py:128` | W | M |
| DELETE | `/api/v1/files/folders/<uuid:folder_id>` | JWT | "school_admin", "teacher" | file_management | `files.py:149` | W | M |
| POST | `/api/v1/files/stock-import` | JWT |  | file_management | `files.py:523` | W | - |
| GET | `/api/v1/files/stock-search` | JWT |  | file_management | `files.py:497` | W | - |
| POST | `/api/v1/files/upload` | JWT |  | file_management | `files.py:168` | W | M |
| GET | `/api/v1/files/usage` | JWT |  | file_management | `files.py:386` | W | - |
| POST | `/api/v1/gamification/award-badge` | JWT | "superadmin", "school_admin", "teacher" | gamification | `gamification.py:126` | W | - |
| GET | `/api/v1/gamification/badges` | JWT |  | gamification | `gamification.py:20` | W | M |
| POST | `/api/v1/gamification/badges` | JWT | "superadmin", "school_admin" | gamification | `gamification.py:30` | W | M |
| PUT | `/api/v1/gamification/badges/<uuid:badge_id>` | JWT | "superadmin", "school_admin" | gamification | `gamification.py:49` | W | M |
| GET | `/api/v1/gamification/houses` | JWT |  | gamification | `gamification.py:209` | W | M |
| POST | `/api/v1/gamification/houses` | JWT | "superadmin", "school_admin" | gamification | `gamification.py:220` | W | M |
| GET | `/api/v1/gamification/leaderboard` | JWT |  | gamification | `gamification.py:170` | W | M |
| POST | `/api/v1/gamification/points` | JWT | "superadmin", "school_admin", "teacher" | gamification | `gamification.py:70` | W | - |
| GET | `/api/v1/gamification/points/<uuid:student_id>` | JWT |  | gamification | `gamification.py:104` | W | - |
| GET | `/api/v1/gamification/rewards` | JWT |  | gamification | `gamification.py:241` | W | - |
| POST | `/api/v1/gamification/rewards` | JWT | "superadmin", "school_admin" | gamification | `gamification.py:250` | W | - |
| GET | `/api/v1/health-records/immunizations` | JWT |  | health_records | `health_records.py:113` | W | M |
| POST | `/api/v1/health-records/immunizations` | JWT | "superadmin", "school_admin", "teacher" | health_records | `health_records.py:126` | W | M |
| GET | `/api/v1/health-records/profiles` | JWT |  | health_records | `health_records.py:18` | W | M |
| GET | `/api/v1/health-records/students/<student_id>` | JWT |  | health_records | `health_records.py:38` | W | M |
| PUT | `/api/v1/health-records/students/<student_id>` | JWT | "superadmin", "school_admin", "teacher" | health_records | `health_records.py:49` | W | M |
| GET | `/api/v1/health-records/visits` | JWT |  | health_records | `health_records.py:76` | W | M |
| POST | `/api/v1/health-records/visits` | JWT | "superadmin", "school_admin", "teacher" | health_records | `health_records.py:90` | W | M |
| GET | `/api/v1/hostel` | JWT |  | hostel | `hostel.py:70` | W | - |
| POST | `/api/v1/hostel` | JWT | "school_admin" | hostel | `hostel.py:80` | W | - |
| PUT | `/api/v1/hostel/<uuid:hostel_id>` | JWT | "school_admin" | hostel | `hostel.py:103` | W | - |
| DELETE | `/api/v1/hostel/<uuid:hostel_id>` | JWT | "school_admin" | hostel | `hostel.py:118` | W | - |
| GET | `/api/v1/hostel/allocations` | JWT |  | hostel | `hostel.py:198` | W | - |
| POST | `/api/v1/hostel/allocations` | JWT | "school_admin" | hostel | `hostel.py:215` | W | - |
| POST | `/api/v1/hostel/allocations/<uuid:alloc_id>/checkout` | JWT | "school_admin" | hostel | `hostel.py:261` | W | - |
| GET | `/api/v1/hostel/rooms` | JWT |  | hostel | `hostel.py:131` | W | - |
| POST | `/api/v1/hostel/rooms` | JWT | "school_admin" | hostel | `hostel.py:145` | W | - |
| PUT | `/api/v1/hostel/rooms/<uuid:room_id>` | JWT | "school_admin" | hostel | `hostel.py:170` | W | - |
| DELETE | `/api/v1/hostel/rooms/<uuid:room_id>` | JWT | "school_admin" | hostel | `hostel.py:185` | W | - |
| GET | `/api/v1/hostel/summary` | JWT |  | hostel | `hostel.py:283` | W | - |
| GET | `/api/v1/hr/appraisals` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:893` | W | - |
| POST | `/api/v1/hr/appraisals` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:909` | W | - |
| PUT | `/api/v1/hr/appraisals/<uuid:appraisal_id>` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:969` | W | - |
| GET | `/api/v1/hr/expense-categories` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:1005` | W | - |
| POST | `/api/v1/hr/expense-categories` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:1024` | W | - |
| DELETE/PUT | `/api/v1/hr/expense-categories/<uuid:cat_id>` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:1043` | W | - |
| GET | `/api/v1/hr/expenses` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:1071` | W | - |
| POST | `/api/v1/hr/expenses` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:1096` | W | - |
| DELETE/PUT | `/api/v1/hr/expenses/<uuid:expense_id>` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:1152` | W | - |
| GET | `/api/v1/hr/leave` | JWT |  | hr_payroll | `hr_payroll.py:633` | W | M |
| POST | `/api/v1/hr/leave` | JWT |  | hr_payroll | `hr_payroll.py:657` | W | M |
| GET | `/api/v1/hr/leave-report` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:756` | W | - |
| POST | `/api/v1/hr/leave/<uuid:leave_id>/approve` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:700` | W | M |
| GET | `/api/v1/hr/leaves` | JWT |  | hr_payroll | `hr_payroll.py:649` | W | M |
| PATCH | `/api/v1/hr/leaves/<uuid:leave_id>` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:731` | W | M |
| GET | `/api/v1/hr/leaves/report` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:756` | W | M |
| GET | `/api/v1/hr/payroll` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:86` | W | M |
| POST | `/api/v1/hr/payroll` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:105` | W | M |
| PUT | `/api/v1/hr/payroll/<uuid:payroll_id>` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:309` | W | M |
| POST | `/api/v1/hr/payroll/<uuid:payroll_id>/approve` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:364` | W | M |
| POST | `/api/v1/hr/payroll/<uuid:payroll_id>/pay` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:522` | W | M |
| GET | `/api/v1/hr/payroll/<uuid:payroll_id>/payslip` | JWT |  | hr_payroll | `hr_payroll.py:382` | W | M |
| POST | `/api/v1/hr/payroll/bulk-action` | JWT | "superadmin", "school_admin" | hr_payroll | `hr_payroll.py:549` | W | M |
| POST | `/api/v1/hr/payroll/generate` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:178` | W | M |
| GET | `/api/v1/hr/stats` | JWT | "superadmin", "school_admin", "accountant" | hr_payroll | `hr_payroll.py:25` | W | - |
| GET | `/api/v1/iemis/formats` | JWT |  | iemis_importer | `iemis_importer.py:961` | W | - |
| GET | `/api/v1/iemis/history` | JWT |  | iemis_importer | `iemis_importer.py:1213` | W | - |
| GET | `/api/v1/iemis/history/<uuid:log_id>` | JWT |  | iemis_importer | `iemis_importer.py:1226` | W | - |
| POST | `/api/v1/iemis/import` | JWT | "school_admin" | iemis_importer | `iemis_importer.py:1111` | W | - |
| GET | `/api/v1/iemis/template` | JWT |  | iemis_importer | `iemis_importer.py:983` | W | - |
| POST | `/api/v1/iemis/validate` | JWT | "school_admin" | iemis_importer | `iemis_importer.py:1054` | W | - |
| GET | `/api/v1/incidents` | JWT |  | incidents | `incidents.py:20` | W | M |
| POST | `/api/v1/incidents` | JWT | "superadmin", "school_admin", "teacher" | incidents | `incidents.py:43` | W | M |
| GET | `/api/v1/incidents/<uuid:incident_id>` | JWT |  | incidents | `incidents.py:100` | W | M |
| PUT | `/api/v1/incidents/<uuid:incident_id>` | JWT | "superadmin", "school_admin" | incidents | `incidents.py:113` | W | M |
| GET | `/api/v1/incidents/<uuid:incident_id>/actions` | JWT |  | incidents | `incidents.py:185` | - | - |
| POST | `/api/v1/incidents/<uuid:incident_id>/actions` | JWT | "superadmin", "school_admin" | incidents | `incidents.py:196` | - | - |
| GET | `/api/v1/incidents/<uuid:incident_id>/statements` | JWT |  | incidents | `incidents.py:143` | - | - |
| POST | `/api/v1/incidents/<uuid:incident_id>/statements` | JWT | "superadmin", "school_admin", "teacher" | incidents | `incidents.py:154` | - | - |
| GET | `/api/v1/inventory/assets` | JWT |  | inventory | `inventory.py:20` | W | M |
| POST | `/api/v1/inventory/assets` | JWT | "superadmin", "school_admin", "staff" | inventory | `inventory.py:36` | W | M |
| GET | `/api/v1/inventory/assets/<uuid:asset_id>` | JWT |  | inventory | `inventory.py:87` | W | M |
| PUT | `/api/v1/inventory/assets/<uuid:asset_id>` | JWT | "superadmin", "school_admin", "staff" | inventory | `inventory.py:98` | W | M |
| DELETE | `/api/v1/inventory/assets/<uuid:asset_id>` | JWT | "superadmin", "school_admin" | inventory | `inventory.py:161` | W | M |
| GET | `/api/v1/inventory/assets/<uuid:asset_id>/audit` | JWT |  | inventory | `inventory.py:264` | W | M |
| POST | `/api/v1/inventory/assets/<uuid:asset_id>/audit` | JWT | "superadmin", "school_admin", "staff" | inventory | `inventory.py:276` | W | M |
| GET | `/api/v1/inventory/assets/scan/<string:qr_code>` | JWT |  | inventory | `inventory.py:174` | W | M |
| GET | `/api/v1/inventory/procurement` | JWT |  | inventory | `inventory.py:191` | - | - |
| POST | `/api/v1/inventory/procurement` | JWT |  | inventory | `inventory.py:204` | - | - |
| POST | `/api/v1/inventory/procurement/<uuid:pr_id>/approve` | JWT | "superadmin", "school_admin" | inventory | `inventory.py:233` | - | - |
| GET | `/api/v1/library/books` | JWT |  | library_management | `library.py:73` | W | M |
| POST | `/api/v1/library/books` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:92` | W | M |
| PUT | `/api/v1/library/books/<book_id>` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:110` | W | M |
| DELETE | `/api/v1/library/books/<book_id>` | JWT | "superadmin", "school_admin" | library_management | `library.py:125` | W | M |
| GET | `/api/v1/library/books/<book_id>/copies` | JWT |  | library_management | `library.py:583` | W | M |
| POST | `/api/v1/library/books/<book_id>/copies` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:596` | W | M |
| GET/POST | `/api/v1/library/books/<book_id>/reservations` | JWT |  | library_management | `library.py:771` | W | M |
| PUT | `/api/v1/library/copies/<copy_id>` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:627` | W | - |
| GET | `/api/v1/library/copies/scan/<barcode>` | JWT |  | library_management | `library.py:644` | W | - |
| GET | `/api/v1/library/fines` | JWT |  | library_management | `library.py:924` | W | - |
| POST | `/api/v1/library/fines/<fine_id>/pay` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:954` | W | - |
| POST | `/api/v1/library/fines/<fine_id>/waive` | JWT | "superadmin", "school_admin" | library_management | `library.py:992` | W | - |
| GET | `/api/v1/library/issues` | JWT |  | library_management | `library.py:139` | W | M |
| POST | `/api/v1/library/issues` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:171` | W | M |
| POST | `/api/v1/library/issues/<issue_id>/mark-lost` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:732` | W | M |
| POST | `/api/v1/library/issues/<issue_id>/renew` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:702` | W | M |
| POST | `/api/v1/library/issues/<issue_id>/return` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:251` | W | M |
| GET | `/api/v1/library/public/books/<book_id>` | PUB |  |  | `library.py:1507` | W* | - |
| GET | `/api/v1/library/public/search` | PUB |  |  | `library.py:1474` | W* | - |
| GET/POST | `/api/v1/library/purchase-orders` | JWT |  | library_management | `library.py:1210` | - | - |
| POST | `/api/v1/library/purchase-orders/<po_id>/receive` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:1267` | - | - |
| GET/POST | `/api/v1/library/racks` | JWT |  | library_management | `library.py:677` | - | - |
| GET | `/api/v1/library/reports/<report_name>` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:1334` | W | - |
| GET | `/api/v1/library/reservations` | JWT |  | library_management | `library.py:816` | W | - |
| POST | `/api/v1/library/reservations/<res_id>/cancel` | JWT |  | library_management | `library.py:902` | W | - |
| POST | `/api/v1/library/reservations/<res_id>/collect` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:866` | W | - |
| POST | `/api/v1/library/reservations/<res_id>/ready` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:836` | W | - |
| GET | `/api/v1/library/settings` | JWT |  | library_management | `library.py:388` | W | - |
| GET/POST | `/api/v1/library/stocktakes` | JWT |  | library_management | `library.py:1019` | W | - |
| POST | `/api/v1/library/stocktakes/<session_id>/close` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:1102` | W | - |
| GET | `/api/v1/library/stocktakes/<session_id>/items` | JWT |  | library_management | `library.py:1155` | W | - |
| POST | `/api/v1/library/stocktakes/<session_id>/scan` | JWT | "superadmin", "school_admin", "teacher" | library_management | `library.py:1054` | W | - |
| GET | `/api/v1/library/teacher/library` | JWT | "teacher", "school_admin", "superadmin" | library_management | `library.py:416` | - | M |
| GET/POST | `/api/v1/library/vendors` | JWT |  | library_management | `library.py:1184` | - | - |
| GET | `/api/v1/lms/courses` | JWT |  | lms | `lms.py:29` | W | M |
| POST | `/api/v1/lms/courses` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:43` | W | M |
| GET | `/api/v1/lms/courses/<course_id>` | JWT |  | lms | `lms.py:62` | W | M |
| POST | `/api/v1/lms/courses/<course_id>/enroll` | JWT |  | lms | `lms.py:337` | W | M |
| POST | `/api/v1/lms/courses/<course_id>/lessons` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:76` | W | M |
| GET | `/api/v1/lms/courses/<course_id>/progress` | JWT |  | lms | `lms.py:370` | W | M |
| POST | `/api/v1/lms/courses/<course_id>/progress` | JWT |  | lms | `lms.py:390` | W | M |
| GET | `/api/v1/lms/courses/<course_id>/quizzes` | JWT |  | lms | `lms.py:285` | W | M |
| POST | `/api/v1/lms/courses/<course_id>/quizzes` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:296` | W | M |
| GET | `/api/v1/lms/lessons` | JWT |  | lms | `lms.py:99` | - | M |
| POST | `/api/v1/lms/lessons` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:121` | - | M |
| PUT | `/api/v1/lms/lessons/<lesson_id>` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:144` | - | M |
| GET | `/api/v1/lms/live-classes` | JWT |  | lms | `lms.py:214` | - | M |
| GET | `/api/v1/lms/materials` | JWT |  | lms | `lms.py:198` | - | M |
| POST | `/api/v1/lms/materials` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:258` | - | M |
| POST | `/api/v1/lms/quizzes/<quiz_id>/attempt` | JWT |  | lms | `lms.py:312` | - | M |
| GET | `/api/v1/lms/topics` | JWT |  | lms | `lms.py:164` | - | M |
| POST | `/api/v1/lms/topics` | JWT | "superadmin", "school_admin", "teacher" | lms | `lms.py:177` | - | M |
| GET | `/api/v1/meta/time` | PUB |  |  | `meta.py:23` | W | M |
| GET | `/api/v1/mobile/bootstrap` | JWT |  |  | `mobile.py:21` | - | M |
| POST | `/api/v1/mobile/crash` | PUB |  |  | `mobile.py:546` | - | M |
| GET | `/api/v1/mobile/version` | JWT |  |  | `mobile.py:44` | - | M |
| PUT | `/api/v1/mobile/version` | JWT | "superadmin", "school_admin" |  | `mobile.py:77` | - | M |
| GET | `/api/v1/notices` | JWT |  | notices | `notices.py:43` | W | M |
| POST | `/api/v1/notices` | JWT | "school_admin", "teacher", "staff" | notices | `notices.py:89` | W | M |
| GET | `/api/v1/notices/<uuid:notice_id>` | JWT |  | notices | `notices.py:77` | W | M |
| PUT | `/api/v1/notices/<uuid:notice_id>` | JWT | "school_admin", "teacher", "staff" | notices | `notices.py:117` | W | M |
| DELETE | `/api/v1/notices/<uuid:notice_id>` | JWT | "school_admin" | notices | `notices.py:134` | W | M |
| GET | `/api/v1/notices/events` | JWT |  | notices | `notices.py:151` | W | M |
| POST | `/api/v1/notices/events` | JWT | "school_admin", "teacher", "staff" | notices | `notices.py:168` | W | M |
| PUT | `/api/v1/notices/events/<uuid:event_id>` | JWT | "school_admin", "teacher", "staff" | notices | `notices.py:200` | W | M |
| DELETE | `/api/v1/notices/events/<uuid:event_id>` | JWT | "school_admin" | notices | `notices.py:226` | W | M |
| GET | `/api/v1/notifications` | JWT |  |  | `notifications.py:20` | W | M |
| DELETE | `/api/v1/notifications/<uuid:notification_id>` | JWT |  |  | `notifications.py:120` | W | M |
| POST | `/api/v1/notifications/<uuid:notification_id>/read` | JWT |  |  | `notifications.py:72` | - | - |
| POST | `/api/v1/notifications/mark-all-read` | JWT |  |  | `notifications.py:96` | W | M |
| GET | `/api/v1/notifications/rules` | JWT |  |  | `notifications.py:194` | W | - |
| PUT | `/api/v1/notifications/rules` | JWT | "superadmin", "school_admin" |  | `notifications.py:230` | W | - |
| DELETE | `/api/v1/notifications/rules/<uuid:rule_id>` | JWT | "superadmin", "school_admin" |  | `notifications.py:277` | W | - |
| GET | `/api/v1/notifications/unread-count` | JWT |  |  | `notifications.py:55` | W | M |
| GET | `/api/v1/parent/assignments` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:278` | - | M |
| GET | `/api/v1/parent/bus-info` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:610` | W | M |
| GET | `/api/v1/parent/bus-location/<uuid:bus_id>` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:688` | W | M |
| GET | `/api/v1/parent/chat-threads` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:744` | W | M |
| GET | `/api/v1/parent/chat/<thread_id>/messages` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:769` | W | M |
| POST | `/api/v1/parent/chat/<thread_id>/messages` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:807` | W | M |
| GET | `/api/v1/parent/child-attendance` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:218` | W | M |
| GET | `/api/v1/parent/child-health` | JWT | "parent", "school_admin", "superadmin" | health_records | `parent_APP.py:975` | W | M |
| GET | `/api/v1/parent/child-profile` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:1281` | - | M |
| GET | `/api/v1/parent/child-results` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:340` | W | - |
| GET | `/api/v1/parent/child-timetable` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:394` | - | M |
| GET | `/api/v1/parent/child-wellbeing` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:531` | W | M |
| GET | `/api/v1/parent/conferences` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:852` | W | M |
| POST | `/api/v1/parent/conferences/<uuid:conference_id>/book` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:910` | W | M |
| GET | `/api/v1/parent/dashboard` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:147` | W | M |
| GET | `/api/v1/parent/dismissal-status` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:1214` | - | M |
| GET | `/api/v1/parent/elibrary` | JWT | "parent", "school_admin", "superadmin" | elibrary | `parent_APP.py:1138` | - | M |
| GET | `/api/v1/parent/fees/summary` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:488` | W | - |
| GET | `/api/v1/parent/outstanding-fees` | JWT | "parent", "school_admin", "superadmin" |  | `parent_APP.py:440` | W | M |
| GET | `/api/v1/parent/portfolio` | JWT | "parent", "school_admin", "superadmin" | student_portfolio | `parent_APP.py:1077` | - | M |
| POST | `/api/v1/plugins/<slug>/activate` | JWT | "superadmin", "school_admin" |  | `plugins.py:767` | - | - |
| GET | `/api/v1/plugins/<slug>/config` | JWT | "superadmin", "school_admin" |  | `plugins.py:826` | - | - |
| PUT | `/api/v1/plugins/<slug>/config` | JWT | "superadmin", "school_admin" |  | `plugins.py:851` | - | - |
| GET | `/api/v1/plugins/<slug>/config-schema` | JWT |  |  | `plugins.py:965` | - | - |
| POST | `/api/v1/plugins/<slug>/deactivate` | JWT | "superadmin", "school_admin" |  | `plugins.py:790` | - | - |
| GET | `/api/v1/plugins/<slug>/health` | JWT | "superadmin" |  | `plugins.py:1163` | - | - |
| POST | `/api/v1/plugins/<slug>/migrate-config` | JWT | "superadmin" |  | `plugins.py:997` | - | - |
| POST | `/api/v1/plugins/<slug>/subscribe` | JWT | "superadmin", "school_admin" |  | `plugins.py:533` | W | - |
| POST | `/api/v1/plugins/<slug>/trial` | JWT | "superadmin", "school_admin" |  | `plugins.py:450` | - | - |
| GET | `/api/v1/plugins/aliases` | JWT |  |  | `plugins.py:1079` | W | - |
| POST | `/api/v1/plugins/install` | JWT | "superadmin", "school_admin" |  | `plugins.py:414` | W | M |
| GET | `/api/v1/plugins/installed` | JWT |  |  | `plugins.py:369` | W | M |
| GET | `/api/v1/plugins/marketplace` | JWT |  |  | `plugins.py:243` | W | M |
| POST | `/api/v1/plugins/refresh-registry` | JWT | "superadmin" |  | `plugins.py:947` | - | - |
| GET | `/api/v1/plugins/registry` | JWT | "superadmin" |  | `plugins.py:1109` | - | - |
| GET | `/api/v1/plugins/sidebar` | JWT |  |  | `plugins.py:347` | W | - |
| POST | `/api/v1/plugins/uninstall` | JWT | "superadmin", "school_admin" |  | `plugins.py:737` | W | M |
| GET | `/api/v1/plugins/widgets` | JWT |  |  | `plugins.py:1044` | W | - |
| GET | `/api/v1/portfolio/students/<uuid:student_id>` | JWT |  | student_portfolio | `portfolio.py:28` | W | - |
| PUT | `/api/v1/portfolio/students/<uuid:student_id>` | JWT | "superadmin", "school_admin", "teacher" | student_portfolio | `portfolio.py:41` | W | - |
| GET | `/api/v1/portfolio/students/<uuid:student_id>/credentials` | JWT |  | student_portfolio | `portfolio.py:112` | W | - |
| POST | `/api/v1/portfolio/students/<uuid:student_id>/credentials` | JWT | "superadmin", "school_admin" | student_portfolio | `portfolio.py:124` | W | - |
| GET | `/api/v1/portfolio/students/<uuid:student_id>/items` | JWT |  | student_portfolio | `portfolio.py:66` | W | - |
| POST | `/api/v1/portfolio/students/<uuid:student_id>/items` | JWT | "superadmin", "school_admin", "teacher" | student_portfolio | `portfolio.py:83` | W | - |
| GET | `/api/v1/reports/attendance/summary` | JWT | "school_admin", "teacher" | basic_reports | `reports.py:259` | W | - |
| GET | `/api/v1/reports/attendance/summary/pdf` | JWT | "school_admin", "teacher" | basic_reports | `reports.py:489` | W | - |
| GET | `/api/v1/reports/dashboard` | JWT | "school_admin" | basic_reports | `reports.py:434` | - | M |
| GET | `/api/v1/reports/exams/results` | JWT | "school_admin", "teacher" | basic_reports | `reports.py:411` | W | - |
| GET | `/api/v1/reports/exams/results/pdf` | JWT | "school_admin", "teacher" | basic_reports | `reports.py:664` | W | - |
| GET | `/api/v1/reports/fees/collection` | JWT | "school_admin", "accountant" | basic_reports | `reports.py:377` | W | - |
| GET | `/api/v1/reports/fees/collection/pdf` | JWT | "school_admin", "accountant" | basic_reports | `reports.py:581` | W | - |
| GET | `/api/v1/schools` | PUB | superadmin |  | `schools.py:19` | W | M |
| POST | `/api/v1/schools` | PUB | superadmin |  | `schools.py:98` | W | M |
| GET | `/api/v1/schools/<uuid:school_id>` | JWT |  |  | `schools.py:41` | W | M |
| PUT | `/api/v1/schools/<uuid:school_id>` | JWT | "superadmin", "school_admin" |  | `schools.py:134` | W | M |
| DELETE | `/api/v1/schools/<uuid:school_id>` | PUB | superadmin |  | `schools.py:156` | W | M |
| GET | `/api/v1/schools/current` | JWT |  |  | `schools.py:57` | W | M |
| PATCH/PUT | `/api/v1/schools/current` | JWT | "superadmin", "school_admin" |  | `schools.py:80` | W | M |
| GET | `/api/v1/schools/current/notification-settings` | JWT | "superadmin", "school_admin" |  | `schools.py:208` | W | M |
| PATCH/PUT | `/api/v1/schools/current/notification-settings` | JWT | "superadmin", "school_admin" |  | `schools.py:224` | W | M |
| GET | `/api/v1/schools/current/settings` | JWT | "superadmin", "school_admin" |  | `schools.py:67` | W | M |
| GET | `/api/v1/schools/lookup` | PUB |  |  | `schools.py:167` | - | M |
| GET | `/api/v1/search` | JWT |  |  | `search.py:14` | W | M |
| GET | `/api/v1/sliders` | JWT |  |  | `sliders.py:17` | W | M |
| POST | `/api/v1/sliders` | JWT | "superadmin", "school_admin" |  | `sliders.py:36` | W | M |
| PUT | `/api/v1/sliders/<uuid:slider_id>` | JWT | "superadmin", "school_admin" |  | `sliders.py:63` | W | M |
| DELETE | `/api/v1/sliders/<uuid:slider_id>` | JWT | "superadmin", "school_admin" |  | `sliders.py:100` | W | M |
| GET | `/api/v1/sms/history` | JWT |  | sms_notifications | `sms.py:86` | W | - |
| POST | `/api/v1/sms/send` | JWT | "superadmin", "school_admin" | sms_notifications | `sms.py:15` | W | - |
| GET | `/api/v1/sms/stats` | JWT |  | sms_notifications | `sms.py:149` | W | - |
| GET | `/api/v1/sms/templates` | JWT |  | sms_notifications | `sms.py:102` | W | - |
| POST | `/api/v1/sms/templates` | JWT | "superadmin", "school_admin" | sms_notifications | `sms.py:114` | W | - |
| GET | `/api/v1/sse/events` | JWT |  |  | `sse.py:11` | - | - |
| GET | `/api/v1/staff` | JWT | "superadmin", "school_admin" |  | `staff.py:19` | W | M |
| POST | `/api/v1/staff` | JWT | "superadmin", "school_admin" |  | `staff.py:69` | W | M |
| GET | `/api/v1/staff/stats` | JWT | "superadmin", "school_admin" |  | `staff.py:42` | - | - |
| GET | `/api/v1/student/achievements` | JWT |  |  | `student_APP.py:718` | - | M |
| GET | `/api/v1/student/assignments` | JWT |  |  | `student_APP.py:195` | W | M |
| POST | `/api/v1/student/assignments/<uuid:assignment_id>/submit` | JWT |  |  | `student_APP.py:244` | W | M |
| GET | `/api/v1/student/classmates` | JWT |  |  | `student_APP.py:1001` | - | M |
| GET | `/api/v1/student/dashboard` | JWT |  |  | `student_APP.py:50` | W | M |
| GET | `/api/v1/student/elibrary` | JWT |  | elibrary | `student_APP.py:543` | W | M |
| GET | `/api/v1/student/fees` | JWT |  |  | `student_APP.py:943` | - | M |
| GET | `/api/v1/student/library` | JWT |  | library_management | `student_APP.py:417` | W | M |
| POST | `/api/v1/student/library/request` | JWT |  | library_management | `student_APP.py:492` | W | M |
| GET | `/api/v1/student/lms` | JWT |  |  | `student_APP.py:561` | W | M |
| GET | `/api/v1/student/portfolio` | JWT |  |  | `student_APP.py:673` | - | M |
| GET | `/api/v1/student/results` | JWT |  |  | `student_APP.py:281` | W | M |
| GET | `/api/v1/student/timetable` | JWT |  |  | `student_APP.py:375` | W | M |
| GET | `/api/v1/student/wellbeing` | JWT |  | wellbeing | `student_APP.py:863` | - | M |
| POST | `/api/v1/student/wellbeing/mood` | JWT |  | wellbeing | `student_APP.py:901` | - | M |
| GET | `/api/v1/students` | JWT | "superadmin", "school_admin", "teacher", "staff" |  | `students.py:27` | W | M |
| POST | `/api/v1/students` | JWT | "superadmin", "school_admin", "staff" |  | `students.py:118` | W | M |
| GET | `/api/v1/students/<uuid:student_id>` | JWT | "superadmin", "school_admin", "teacher", "staff" |  | `students.py:90` | W | M |
| PUT | `/api/v1/students/<uuid:student_id>` | JWT | "superadmin", "school_admin", "teacher", "staff" |  | `students.py:207` | W | M |
| DELETE | `/api/v1/students/<uuid:student_id>` | JWT | "superadmin", "school_admin" |  | `students.py:281` | W | M |
| GET | `/api/v1/students/<uuid:student_id>/enrollments` | JWT |  |  | `students.py:1282` | - | - |
| POST | `/api/v1/students/<uuid:student_id>/exit-documents` | JWT | "superadmin", "school_admin" |  | `students.py:1409` | - | - |
| GET | `/api/v1/students/<uuid:student_id>/exit-documents` | JWT |  |  | `students.py:1470` | - | - |
| GET | `/api/v1/students/<uuid:student_id>/guardians` | JWT |  |  | `students.py:1081` | W | M |
| POST | `/api/v1/students/<uuid:student_id>/guardians` | JWT | "superadmin", "school_admin", "staff" |  | `students.py:1093` | W | M |
| PATCH | `/api/v1/students/<uuid:student_id>/guardians/<uuid:guardian_id>` | JWT | "superadmin", "school_admin", "staff" |  | `students.py:1114` | W | M |
| DELETE | `/api/v1/students/<uuid:student_id>/guardians/<uuid:guardian_id>` | JWT | "superadmin", "school_admin" |  | `students.py:1155` | W | M |
| GET | `/api/v1/students/<uuid:student_id>/promotion-records` | JWT |  |  | `students.py:1324` | - | - |
| POST | `/api/v1/students/<uuid:student_id>/reveal-default-password` | JWT | "superadmin", "school_admin" |  | `students.py:250` | - | - |
| POST | `/api/v1/students/batch-roll-numbers` | JWT | "superadmin", "school_admin", "staff", "teacher" |  | `students.py:314` | W | - |
| POST | `/api/v1/students/bulk-delete` | JWT | "superadmin", "school_admin" |  | `students.py:294` | W | - |
| POST | `/api/v1/students/bulk-profile-images` | JWT | "superadmin", "school_admin" |  | `students.py:351` | W | - |
| POST | `/api/v1/students/bulk-reset-passwords` | JWT | "superadmin", "school_admin" |  | `students.py:945` | W | - |
| POST | `/api/v1/students/exit-documents/<uuid:doc_id>/revoke` | JWT | "superadmin", "school_admin" |  | `students.py:1513` | - | - |
| GET | `/api/v1/students/exit-documents/verify` | PUB |  |  | `students.py:1484` | - | - |
| POST | `/api/v1/students/promote` | JWT | "superadmin", "school_admin" |  | `students.py:706` | W | M |
| GET | `/api/v1/students/promote/preview` | JWT | "superadmin", "school_admin" |  | `students.py:591` | W | M |
| GET | `/api/v1/students/transfers` | JWT | "superadmin", "school_admin", "staff" |  | `students.py:992` | W | - |
| POST | `/api/v1/students/transfers` | JWT | "superadmin", "school_admin" |  | `students.py:1020` | W | - |
| GET | `/api/v1/super-admin/overview` | JWT | superadmin |  | `super_admin.py:16` | - | - |
| GET | `/api/v1/super-admin/plugins` | JWT | superadmin |  | `super_admin.py:53` | - | - |
| GET | `/api/v1/super-admin/schools` | JWT | superadmin |  | `super_admin.py:41` | - | - |
| GET | `/api/v1/teacher/assignments` | JWT | "teacher", "school_admin", "superadmin" | assignments | `teacher.py:110` | W | M |
| POST | `/api/v1/teacher/assignments` | JWT | "teacher", "school_admin", "superadmin" | assignments | `teacher.py:124` | W | M |
| GET | `/api/v1/teacher/dashboard` | JWT | "teacher", "school_admin", "superadmin" |  | `teacher.py:22` | - | M |
| GET | `/api/v1/teacher/my-classes` | JWT | "teacher", "school_admin", "superadmin" |  | `teacher.py:62` | W | M |
| GET | `/api/v1/teacher/my-students` | JWT | "teacher", "school_admin", "superadmin" |  | `teacher.py:83` | - | M |
| GET | `/api/v1/teacher/portfolios` | JWT |  | student_portfolio | `teacher.py:441` | - | M |
| GET | `/api/v1/teacher/timetable` | JWT | "teacher", "school_admin", "superadmin" |  | `teacher.py:98` | W | M |
| GET | `/api/v1/teacher/wellbeing` | JWT | "teacher", "school_admin", "superadmin" | wellbeing | `teacher.py:229` | - | M |
| GET | `/api/v1/teaching-content/sections` | JWT | "superadmin", "school_admin", "teacher" | nepal_curriculum | `teaching_content.py:96` | W | - |
| POST | `/api/v1/teaching-content/sections` | JWT | "superadmin", "school_admin" | nepal_curriculum | `teaching_content.py:129` | W | - |
| GET | `/api/v1/teaching-content/sections/<uuid:section_id>` | JWT | "superadmin", "school_admin", "teacher" | nepal_curriculum | `teaching_content.py:113` | W | - |
| PATCH | `/api/v1/teaching-content/sections/<uuid:section_id>` | JWT | "superadmin", "school_admin" | nepal_curriculum | `teaching_content.py:193` | W | - |
| DELETE | `/api/v1/teaching-content/sections/<uuid:section_id>` | JWT | "superadmin", "school_admin" | nepal_curriculum | `teaching_content.py:218` | W | - |
| GET | `/api/v1/teaching-content/sections/<uuid:section_id>/versions` | JWT | "superadmin", "school_admin", "teacher" | nepal_curriculum | `teaching_content.py:238` | W | - |
| GET | `/api/v1/teaching-content/sections/<uuid:section_id>/versions/<int:version_no>` | JWT | "superadmin", "school_admin", "teacher" | nepal_curriculum | `teaching_content.py:257` | W | - |
| POST | `/api/v1/teaching-content/sections/<uuid:section_id>/versions/<int:version_no>/<string:action>` | JWT | "superadmin", "school_admin" | nepal_curriculum | `teaching_content.py:326` | W | - |
| PUT | `/api/v1/teaching-content/sections/<uuid:section_id>/versions/<int:version_no>/blocks/<string:block_kind>` | JWT | "superadmin", "school_admin" | nepal_curriculum | `teaching_content.py:551` | W | - |
| POST | `/api/v1/teaching-content/sections/<uuid:section_id>/versions/<int:version_no>/clone` | JWT | "superadmin", "school_admin" | nepal_curriculum | `teaching_content.py:356` | W | - |
| GET | `/api/v1/teaching-content/sections/<uuid:section_id>/versions/<int:version_no>/reviews` | JWT | "superadmin", "school_admin", "teacher" | nepal_curriculum | `teaching_content.py:642` | W | - |
| GET | `/api/v1/themes` | JWT |  |  | `themes.py:13` | W | M |
| GET | `/api/v1/themes/<theme_id>` | JWT |  |  | `themes.py:22` | W | M |
| GET | `/api/v1/themes/<theme_id>/preview-css` | JWT |  |  | `themes.py:34` | - | - |
| POST | `/api/v1/themes/apply` | JWT | "superadmin", "school_admin" | website_builder | `themes.py:43` | W | - |
| GET | `/api/v1/timetable` | JWT |  | timetable | `timetable.py:20` | W | M |
| POST | `/api/v1/timetable/generate` | JWT | "superadmin", "school_admin" | timetable | `timetable.py:59` | W | - |
| POST | `/api/v1/timetable/save` | JWT | "superadmin", "school_admin" | timetable | `timetable.py:86` | W | - |
| POST | `/api/v1/timetable/slots` | JWT | "superadmin", "school_admin" | timetable | `timetable.py:125` | W | - |
| DELETE | `/api/v1/timetable/slots/<slot_id>` | JWT | "superadmin", "school_admin" | timetable | `timetable.py:261` | W | - |
| GET | `/api/v1/timetable/teacher/<teacher_id>` | JWT |  | timetable | `timetable.py:46` | W | M |
| GET | `/api/v1/transport/buses` | JWT |  | gps_tracking | `transport.py:106` | W | M |
| POST | `/api/v1/transport/buses` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:118` | W | M |
| PUT | `/api/v1/transport/buses/<uuid:bus_id>` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:150` | W | M |
| GET | `/api/v1/transport/gps-logs` | JWT |  | gps_tracking | `transport.py:271` | W | M |
| POST | `/api/v1/transport/gps-logs` | JWT |  | gps_tracking | `transport.py:284` | W | M |
| GET | `/api/v1/transport/instances` | JWT |  | gps_tracking | `transport.py:573` | W | M |
| GET | `/api/v1/transport/instances/<uuid:instance_id>` | JWT |  | gps_tracking | `transport.py:626` | W | M |
| POST | `/api/v1/transport/instances/<uuid:instance_id>/dropoff` | JWT | "superadmin", "school_admin", "transport_manager", "teacher" | gps_tracking | `transport.py:810` | W | M |
| POST | `/api/v1/transport/instances/<uuid:instance_id>/end` | JWT | "superadmin", "school_admin", "transport_manager", "teacher" | gps_tracking | `transport.py:687` | W | M |
| POST | `/api/v1/transport/instances/<uuid:instance_id>/pickup` | JWT | "superadmin", "school_admin", "transport_manager", "teacher" | gps_tracking | `transport.py:777` | W | M |
| POST | `/api/v1/transport/instances/<uuid:instance_id>/position` | JWT |  | gps_tracking | `transport.py:719` | W | M |
| POST | `/api/v1/transport/instances/<uuid:instance_id>/start` | JWT | "superadmin", "school_admin", "transport_manager", "teacher" | gps_tracking | `transport.py:660` | W | M |
| GET | `/api/v1/transport/notification-prefs` | JWT |  | gps_tracking | `transport.py:832` | - | M |
| PUT | `/api/v1/transport/notification-prefs` | JWT |  | gps_tracking | `transport.py:869` | - | M |
| GET | `/api/v1/transport/reports/missed-pickups` | JWT | "superadmin", "school_admin", "transport_manager" | gps_tracking | `transport.py:936` | W | - |
| GET | `/api/v1/transport/reports/trip-history` | JWT | "superadmin", "school_admin", "transport_manager" | gps_tracking | `transport.py:983` | W | - |
| GET | `/api/v1/transport/routes` | JWT |  | gps_tracking | `transport.py:41` | W | M |
| POST | `/api/v1/transport/routes` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:53` | W | M |
| PUT | `/api/v1/transport/routes/<uuid:route_id>` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:73` | W | M |
| DELETE | `/api/v1/transport/routes/<uuid:route_id>` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:90` | W | M |
| GET | `/api/v1/transport/stops` | JWT |  | gps_tracking | `transport.py:181` | W | - |
| POST | `/api/v1/transport/stops` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:194` | W | - |
| PUT | `/api/v1/transport/stops/<uuid:stop_id>` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:228` | W | - |
| DELETE | `/api/v1/transport/stops/<uuid:stop_id>` | JWT | "superadmin", "school_admin" | gps_tracking | `transport.py:255` | W | - |
| GET | `/api/v1/transport/trips` | JWT |  | gps_tracking | `transport.py:455` | W | M |
| POST | `/api/v1/transport/trips` | JWT | "superadmin", "school_admin", "transport_manager" | gps_tracking | `transport.py:472` | W | M |
| PUT | `/api/v1/transport/trips/<uuid:trip_id>` | JWT | "superadmin", "school_admin", "transport_manager" | gps_tracking | `transport.py:521` | W | M |
| DELETE | `/api/v1/transport/trips/<uuid:trip_id>` | JWT | "superadmin", "school_admin", "transport_manager" | gps_tracking | `transport.py:556` | W | M |
| GET | `/api/v1/users` | JWT | "superadmin", "school_admin", "accountant", "teacher", "staff" |  | `users.py:24` | W | M |
| POST | `/api/v1/users` | JWT | "superadmin", "school_admin" |  | `users.py:64` | W | M |
| GET | `/api/v1/users/<uuid:user_id>` | JWT |  |  | `users.py:53` | W | M |
| PUT | `/api/v1/users/<uuid:user_id>` | JWT | "superadmin", "school_admin" |  | `users.py:103` | W | M |
| DELETE | `/api/v1/users/<uuid:user_id>` | JWT | "superadmin", "school_admin" |  | `users.py:140` | W | M |
| DELETE | `/api/v1/users/<uuid:user_id>/children/<uuid:student_id>` | JWT | "superadmin", "school_admin" |  | `users.py:167` | - | - |
| POST | `/api/v1/users/<uuid:user_id>/force-password-change` | JWT | "superadmin", "school_admin" |  | `users.py:402` | - | - |
| POST | `/api/v1/users/<uuid:user_id>/reset-default-password` | JWT | "superadmin", "school_admin" |  | `users.py:266` | - | - |
| POST | `/api/v1/users/<uuid:user_id>/toggle-active` | JWT | "superadmin", "school_admin" |  | `users.py:153` | - | - |
| GET | `/api/v1/users/access-logs` | JWT | "superadmin", "school_admin" |  | `users.py:359` | W | - |
| GET | `/api/v1/users/stats` | JWT | "superadmin", "school_admin", "accountant" |  | `users.py:331` | W | - |
| GET | `/api/v1/visitors` | JWT |  | visitor_management | `visitor.py:22` | W | M |
| POST | `/api/v1/visitors/<uuid:visitor_id>/checkout` | JWT | "superadmin", "school_admin", "staff" | visitor_management | `visitor.py:87` | - | - |
| GET | `/api/v1/visitors/appointments` | JWT |  | visitor_management | `visitor.py:135` | - | - |
| POST | `/api/v1/visitors/appointments` | JWT | "superadmin", "school_admin", "staff" | visitor_management | `visitor.py:148` | - | - |
| PUT | `/api/v1/visitors/appointments/<uuid:appt_id>` | JWT | "superadmin", "school_admin", "staff" | visitor_management | `visitor.py:189` | - | - |
| POST | `/api/v1/visitors/appointments/<uuid:appt_id>/approve` | JWT | "superadmin", "school_admin" | visitor_management | `visitor.py:230` | - | - |
| GET | `/api/v1/visitors/badge/<badge_code>` | JWT |  | visitor_management | `visitor.py:111` | - | M |
| POST | `/api/v1/visitors/checkin` | JWT | "superadmin", "school_admin", "staff" | visitor_management | `visitor.py:48` | W | M |
| GET | `/api/v1/webhooks` | JWT | superadmin |  | `webhooks.py:12` | W | - |
| GET | `/api/v1/website/config` | JWT | "school_admin" | basic_website | `website.py:378` | W | - |
| PUT | `/api/v1/website/config` | JWT | "school_admin" | basic_website | `website.py:404` | W | - |
| GET | `/api/v1/website/contact-messages` | JWT | "superadmin", "school_admin" |  | `website.py:941` | - | - |
| POST | `/api/v1/website/contact-messages/<uuid:message_id>/read` | JWT | "superadmin", "school_admin" |  | `website.py:986` | - | - |
| GET | `/api/v1/website/public-domain` | PUB |  |  | `website.py:355` | W* | - |
| GET | `/api/v1/website/public/<slug>` | PUB |  |  | `website.py:256` | W* | - |
| POST | `/api/v1/website/public/<slug>/admission-inquiry` | PUB |  |  | `website.py:539` | W* | - |
| POST | `/api/v1/website/public/<slug>/admission/registration` | PUB |  |  | `website.py:1014` | W* | - |
| GET | `/api/v1/website/public/<slug>/admission/registration/<uuid:registration_id>` | PUB |  |  | `website.py:1049` | W* | - |
| GET | `/api/v1/website/public/<slug>/alumni` | PUB |  |  | `website.py:769` | W* | - |
| POST | `/api/v1/website/public/<slug>/contact` | PUB |  |  | `website.py:489` | W* | - |
| GET | `/api/v1/website/public/<slug>/events` | PUB |  |  | `website.py:724` | W* | - |
| GET | `/api/v1/website/public/<slug>/facilities` | PUB |  |  | `website.py:580` | W* | - |
| GET | `/api/v1/website/public/<slug>/gallery` | PUB |  |  | `website.py:759` | W* | - |
| GET | `/api/v1/website/public/<slug>/news` | PUB |  |  | `website.py:678` | W* | - |
| GET | `/api/v1/website/public/<slug>/news/<article_slug>` | PUB |  |  | `website.py:700` | W* | - |
| GET | `/api/v1/website/public/<slug>/pages/<page_slug>` | PUB |  |  | `website.py:311` | W* | - |
| POST | `/api/v1/website/public/<slug>/payments/initiate` | PUB |  |  | `website.py:1142` | W* | - |
| POST | `/api/v1/website/public/<slug>/payments/lookup` | PUB |  |  | `website.py:1073` | W* | - |
| GET | `/api/v1/website/public/<slug>/results` | PUB |  |  | `website.py:804` | W* | - |
| GET | `/api/v1/website/public/<slug>/teachers` | PUB |  |  | `website.py:642` | W* | - |
| POST | `/api/v1/website-builder/ai/generate-copy` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:731` | W | - |
| POST | `/api/v1/website-builder/ai/generate-design` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:706` | W | - |
| GET | `/api/v1/website-builder/domain` | JWT |  | website_builder | `website_builder.py:755` | W | - |
| PUT | `/api/v1/website-builder/domain` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:781` | W | - |
| POST | `/api/v1/website-builder/domain/verify` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:805` | W | - |
| GET | `/api/v1/website-builder/pages` | JWT |  | website_builder | `website_builder.py:352` | W | - |
| POST | `/api/v1/website-builder/pages` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:369` | W | - |
| GET | `/api/v1/website-builder/pages/<page_id>` | JWT |  | website_builder | `website_builder.py:390` | W | - |
| PUT | `/api/v1/website-builder/pages/<page_id>` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:430` | W | - |
| DELETE | `/api/v1/website-builder/pages/<page_id>` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:577` | W | - |
| GET | `/api/v1/website-builder/pages/<page_id>/history` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:539` | W | - |
| POST | `/api/v1/website-builder/pages/<page_id>/history/<int:index>/restore` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:557` | W | - |
| POST | `/api/v1/website-builder/pages/<page_id>/publish-draft` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:481` | W | - |
| POST | `/api/v1/website-builder/pages/<page_id>/revert-draft` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:522` | W | - |
| POST | `/api/v1/website-builder/pages/<page_id>/sections` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:589` | W | - |
| PUT | `/api/v1/website-builder/pages/<page_id>/sections/<section_id>` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:612` | W | - |
| DELETE | `/api/v1/website-builder/pages/<page_id>/sections/<section_id>` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:641` | W | - |
| PUT | `/api/v1/website-builder/pages/<page_id>/sections/<section_id>/reorder` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:657` | W | - |
| POST | `/api/v1/website-builder/publish` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:976` | W | - |
| GET | `/api/v1/website-builder/sections/available` | JWT |  |  | `website_builder.py:688` | - | - |
| GET | `/api/v1/website-builder/seo` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:841` | W | - |
| PUT | `/api/v1/website-builder/seo` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:876` | W | - |
| GET | `/api/v1/website-builder/status` | JWT |  | website_builder | `website_builder.py:319` | W | - |
| GET | `/api/v1/website-builder/themes` | JWT |  |  | `website_builder.py:269` | W | - |
| GET | `/api/v1/website-builder/themes/<theme_id>/preview-css` | JWT |  |  | `website_builder.py:280` | W | - |
| POST | `/api/v1/website-builder/themes/apply` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:291` | W | - |
| POST | `/api/v1/website-builder/unpublish` | JWT | "superadmin", "school_admin" | website_builder | `website_builder.py:1009` | W | - |
| GET | `/api/v1/wellbeing/alerts` | JWT | "superadmin", "school_admin", "teacher" | wellbeing | `wellbeing.py:199` | - | M |
| GET | `/api/v1/wellbeing/counselor-notes` | JWT | "superadmin", "school_admin", "teacher" | wellbeing | `wellbeing.py:247` | W | - |
| POST | `/api/v1/wellbeing/counselor-notes` | JWT | "superadmin", "school_admin", "teacher" | wellbeing | `wellbeing.py:262` | W | - |
| GET | `/api/v1/wellbeing/dashboard` | JWT | "superadmin", "school_admin", "teacher" | wellbeing | `wellbeing.py:120` | - | M |
| GET | `/api/v1/wellbeing/mood` | JWT |  | wellbeing | `wellbeing.py:24` | W | M |
| POST | `/api/v1/wellbeing/mood` | JWT |  | wellbeing | `wellbeing.py:38` | W | M |
| GET | `/api/v1/wellbeing/mood/summary` | JWT |  | wellbeing | `wellbeing.py:95` | W | M |
| GET | `/api/v1/wellbeing/surveys` | JWT |  | wellbeing | `wellbeing.py:288` | W | M |
| POST | `/api/v1/wellbeing/surveys` | JWT | "superadmin", "school_admin" | wellbeing | `wellbeing.py:298` | W | M |
| GET | `/api/v1/whatsapp-bot/analytics` | JWT |  | whatsapp_bot | `whatsAPP_bot.py:325` | W | - |
| GET | `/api/v1/whatsapp-bot/auto-replies` | JWT |  | whatsapp_bot | `whatsAPP_bot.py:103` | W | - |
| POST | `/api/v1/whatsapp-bot/auto-replies` | JWT | "superadmin", "school_admin" | whatsapp_bot | `whatsAPP_bot.py:115` | W | - |
| PUT | `/api/v1/whatsapp-bot/auto-replies/<int:rule_id>` | JWT | "superadmin", "school_admin" | whatsapp_bot | `whatsAPP_bot.py:144` | W | - |
| DELETE | `/api/v1/whatsapp-bot/auto-replies/<int:rule_id>` | JWT | "superadmin", "school_admin" | whatsapp_bot | `whatsAPP_bot.py:176` | W | - |
| GET | `/api/v1/whatsapp-bot/config` | JWT |  | whatsapp_bot | `whatsAPP_bot.py:55` | W | - |
| PUT | `/api/v1/whatsapp-bot/config` | JWT | "superadmin", "school_admin" | whatsapp_bot | `whatsAPP_bot.py:81` | W | - |
| GET | `/api/v1/whatsapp-bot/conversations` | JWT |  | whatsapp_bot | `whatsAPP_bot.py:199` | W | - |
| GET | `/api/v1/whatsapp-bot/conversations/<phone>/messages` | JWT |  | whatsapp_bot | `whatsAPP_bot.py:278` | W | - |
| POST | `/api/v1/whatsapp-bot/send` | JWT | "superadmin", "school_admin", "teacher" | whatsapp_bot | `whatsAPP_bot.py:447` | W | - |
| POST | `/api/v1/whatsapp-bot/send-bulk` | JWT | "superadmin", "school_admin" | whatsapp_bot | `whatsAPP_bot.py:487` | - | - |

---

## 6. Multi-Tenancy & Security

### 6.1 The scoping pattern (verified in code + live)

There is **no scoped session / no PG RLS** — tenancy is per-query discipline, but with unusually good scaffolding:

1. **Request hook** (`app/__init__.py:409-560`): `g.school_id` resolved from subdomain → `X-School-Slug` → JWT `school_id` claim. Each resolution passes `_cross_tenant_response` (`__init__.py:459-512`): an authenticated user whose `user.school_id` ≠ resolved school gets 403, superadmin excepted. Live-verified: demo-admin token + `X-School-Slug: audit-probe` → `403 {"error":"Your account does not belong to this school."}` (probe school created for this audit — see §6.2).
2. **Model layer** (`app/models/base.py:66-71`): `SchoolModel.for_school()` raises `SchoolIsolationError` when `school_id is None` — a fail-closed default for code that uses the helper.
3. **Route layer**: handlers filter `Model.query.filter_by(school_id=g.school_id, is_deleted=False)` — spot-checked in fees, exams, attendance, library, faqs, notifications, communications, transport; consistent. UUID path params are additionally re-scoped: e.g. `GET /users/<id>` returns "User not found" for a superadmin UUID when called with a demo-school token (live-verified 404, not a leak) — `app/api/v1/users.py:53` filters by school.
4. **Composite FKs absent** (656 single-column FKs, none composite): the DB itself cannot enforce `child.school_id == parent.school_id` (prior B9 **still true**). Defense rests on the query discipline above, which held up in this audit's probes — but any future handler that forgets the filter has no backstop.

### 6.2 Live cross-school probe matrix (against seeded `demo` + audit-created `audit-probe`)

> **Write disclosure:** one probe school was created for this test via `POST /api/v1/schools` as superadmin (`audit-probe`, free plan, `probe@audit-test.local`). It contains no student data. The path-traversal proof file was written to the container's `/tmp` and **removed** after confirmation. At audit close the probe school was deleted through the API (`DELETE /api/v1/schools/<id>` → soft-deleted, `is_deleted=true`, invisible to all app queries) — the demo DB is otherwise untouched.

| # | Probe | Result | Verdict |
|---|---|---|---|
| 1 | demo-admin token + `X-School-Slug: audit-probe` on `/students` | 403 "Your account does not belong to this school." | Gate works live |
| 2 | demo-admin + own slug `/students` | 200 | — |
| 3 | Free-plan school plugin provisioning | exactly 13 core/add_on plugins auto-installed (academics, attendance, basic_reports, basic_website, dashboard, file_management, iemis_importer, marketplace_nav, notices, settings_core, students, teachers, users) — no paid plugin leaked in | `ensure_free_plugins` (`app/plugins/entitlements.py:136-275`) works as documented |
| 4 | `/fees/structures` (starter plugin) on free-plan school | blocked earlier by the tenant gate (admin of other school); conceptually the plugin gate would 403 — gate verified by code at `app/plugins/decorators.py:95-131` + demo-school `ai_suite` behavior | Plugin gate sound |
| 5 | `GET /schools/<probe_uuid>` with demo-admin | 403 (inline school check) | No cross-school school-profile read |
| 6 | `/analytics/superadmin-dashboard`, `/super-admin/overview`, `/database-backup` with demo-admin | 403 ×3 | Role gates hold |
| 7 | `GET /users/<superadmin_uuid>` with demo-admin | 404 "User not found" | School-scoped lookup |
| 8 | `/notifications?user_id=<superadmin>` with demo-admin | 200 but **param ignored** — returns the caller's own (empty) list; handler scopes by `get_jwt_identity()` (`app/api/v1/notifications.py:31-43`) | No cross-user read |
| 9 | Parent/teacher surfaces with admin token (`/parent/fees/summary`, `/parent/dashboard`, `/teacher/portfolios`, `/teacher/wellbeing`) | 200 but **empty payloads** (`ward_count: 0`, `children: []`) — scope derives from the caller's guardian/teacher links, not the role claim | Data-safe; role-gate consistency nit only |
| 10 | Student surfaces with admin token | 404 "Student profile not found" — `_current_student()` resolves Student by `user_id` within school (`app/api/v1/student_app.py:38-45,50-56`) | Data-derived scoping, safe |
| 11 | `GET /benchmarking/rankings` with demo-admin | **500** — `ImportError: cannot import name 'ReportCard' from 'app.models.analytics'` at `app/api/v1/benchmarking.py:90` (ReportCard actually lives in `app/models/exam.py:141`) | **NEW P1 bug** — endpoint hard-down for every consumer incl. the `/dashboard/benchmarking` page; the W0 rewrite moved the import into the function body so boot never catches it |

### 6.3 Auth (JWT) handling

- Login (`app/api/v1/auth.py:214-232`) → `AuthService.create_tokens` → access (1 h) + refresh (30 d) in the JWT envelope `{sub, role, school_id}`; cookies HttpOnly + SameSite=Lax + Secure-in-prod (`config.py:81-92`, `app/__init__.py:99-102`); Bearer and cookie transports both accepted.
- Revocation: `RevokedToken` jti blocklist + per-user `tokens_invalid_before` iat-cutoff, checked on **every** JWT-protected request (`app/__init__.py:143-176`); the jti lookup fails loud (no fail-open) — verified in code.
- MFA: TOTP setup/verify/disable + `mfa_pending:<token>` cache bridge at login (`auth.py:877-930`); the pending token is a random cache key (not forgeable), single-use (`cache.delete` after success).
- Login rate limit 5/minute (`auth.py` decorator on login/student-login/otp/forgot/reset); reset-password limiter (S6 fix) verified present.
- Password policy in `app/utils/password.py` (pattern/credential metadata resolution — read only).
- Lockout: README claims login lockout; verified `login` handler checks `failed_login_attempts` (see `auth.py` login path + `UserAccessLog` login_failed rows from S-A3).

### 6.4 Role-check consistency

Route-inventory stats (867 rules): every JWT route carries `@school_required` except the app-level and webhook routes; 462 routes carry `@role_required`/`@superadmin_required`; 606 plugin-gated (route-inventory JSON count). The decorator stack order is consistent (`jwt → school → plugin → role`) in the modules sampled.

**Gaps found (all verified in source):**

| Sev | Finding | Evidence |
|---|---|---|
| Med | **FAQ writes open to every school member** — any student/parent JWT can create/update/delete the school's public FAQs (read is intentional; writes are not role-gated) | `app/api/v1/faqs.py:50-60 (POST), :72-83 (PUT), :85-92 (DELETE)` — only `@jwt_required()` + `@school_required` |
| Med | **AI live-polls unscoped** — `POST /ai/ext/live-polls` (create), vote, results: JWT only, no role, no plugin gate, no school on the poll record (in-memory `_POLLS` dict keyed by poll key) — and the routes live in a **service module** (`app/services/ai/extensions.py:228-263`), registered via `register_poll_routes(bp)` from `app/api/v1/ai_extensions.py`; in-memory state also breaks under multiple workers/restarts | `app/services/ai/extensions.py:228-263`, blueprint at `app/api/v1/ai_extensions.py` |
| Low | Parent/teacher aggregate endpoints accept any authenticated role (return empty rather than 403) — consistency nit | `app/api/v1/parent_app.py` (`/fees/summary`, `/dashboard`), `app/api/v1/teacher.py:portfolios` |
| Low | `GET /schools/<uuid:school_id>` has no `role_required` (inline check does the work — returns 403 for other-school members) | `app/api/v1/schools.py:41` |

### 6.5 Input validation

- JSON bodies parsed with `request.get_json(silent=True) or {}` and field-validated per handler (sampled fees/exams/attendance — required-field 422s are the norm, e.g. `fees.py` structure validators).
- Attendance import 3-step preview/commit with 2000-row cap (S-A2, `app/api/v1/attendance.py` import endpoints).
- Plugin config validation is the strongest surface: 18-type schema dialect with strict `validate_config` (never partially applies), secret envelopes redacted at any depth (`app/plugins/config_schema.py:25-43,95-120`).
- Live-poll creation validates question + ≥2 options only (`extensions.py:233-239`) — minimal but harmless.

### 6.6 File uploads

- `POST /files/upload` (`app/api/v1/files.py:168-241`): size cap (50 MB default), extension allowlist E167 (`files.py:57-76` — svg excluded for stored-XSS), ClamAV scan when enabled (fail-open unless `CLAMAV_STRICT`, `app/utils/file_upload.py:64-92`), UUID filenames, ManagedFile row with visibility (`is_public` public/school_only/private).
- **P1 — PATH TRAVERSIAL (live-confirmed):** the `folder` form field is interpolated unsanitized into the storage key: `r2_key = f"{g.school_id}/{folder}/{uuid}.{ext}"` (`files.py:208`) → `upload_file(folder=f"{g.school_id}/{folder}", filename=os.path.basename(r2_key))` (`files.py:216`) → `dest = os.path.join(upload_dir, *key.split("/"))` (`app/utils/file_upload.py:128`). **Proof:** `POST /api/v1/files/upload` with `folder=../../../tmp/aschool-trav-proof` wrote a file to `/tmp/aschool-trav-proof/<uuid>.txt` inside the container (verified via `docker exec ls`, artifact removed after). Filename is a UUID (cannot target an existing file by name) and the extension allowlist applies, but any authenticated school member can plant arbitrary-content allowlisted-extension files in **any writable directory** (e.g. `/app/static/`, cron dirs, other tenants' upload folders) — and on the R2 backend the same `..` segments inject into object keys. Fix: sanitize `folder` (strip `/`, `..`, whitespace → slug segments) at `files.py:147` and defensively in `upload_file`.
- **P2 — platform key leak / residual SSRF in stock-import:** the E166 fix allowlists the main `url` host (`files.py:546-556`) but the optional `download_trigger_url` is fetched server-side with the platform `UNSPLASH_ACCESS_KEY` appended (`files.py:560-566`: `_requests.get(f"{trigger_url}?client_id={key}", timeout=5)`) with **no host check** — a school_admin can point it at their own server and capture the key. Fix: restrict trigger_url to unsplash.com or drop the client_id.

### 6.7 Webhook signature verification (all read at source)

| Webhook | Verification | Evidence |
|---|---|---|
| eSewa `/webhooks/esewa/callback` | HMAC-SHA256 over the base64 payload with the school's secret, then **merchant-code pinning** (signed `product_code` must equal the school's configured merchant code) | `app/api/webhooks/__init__.py:23-95`; `app/services/payments/esewa_gateway.py` (verify_payment uses `hmac.compare_digest` — S7 fix held) |
| Khalti `/webhooks/khalti/callback` | server-side lookup by `pidx` against the Khalti API (no trust in client payload) | `webhooks/__init__.py:97+` |
| Fonepay `/webhooks/fonepay/callback` | HMAC verification per gateway service | `webhooks/__init__.py:168+` |
| WhatsApp `/webhooks/whatsapp` | `X-Hub-Signature-256` HMAC when `WHATSAPP_APP_SECRET` set; GET challenge fails closed when token unconfigured (E198) | `webhooks/__init__.py:252-264, 323+` |
| Stripe `/webhooks/stripe` | `stripe.Webhook.construct_event` + **replay guard** via `ProcessedWebhookEvent` unique event_id insert-in-transaction; refuses everything when secret unset | `webhooks/__init__.py:484-560` |
| ai_teacher `/api/v1/ai-teacher/webhooks/lesson-event` | HMAC-SHA256 ±300 s window against the school's per-install webhook secret envelope | `app/plugins/modules/ai_teacher/routes.py:604+` (see §4 trace; the prior A9 tenancy note re-checked there) |

The `/api/v1/webhooks` route inside the prefix (1 rule) is the ai_teacher blueprint's — no duplicate gateway surface.

### 6.8 Secrets in code

- Grep for hardcoded key/password literals across `app/` (two patterns incl. 16+ char tokens): **zero hits** outside tests/env plumbing. All provider keys come from `os.getenv` (`config.py:108-211`).
- Production boot refuses published `.env.example` placeholder values and weak secrets (`config.py:270-288`).
- Per-school gateway secrets live in `School.fee_config` — stripped from the default serializer (S1) with an admin-only `/schools/current/settings` reader (re-verified: `School.to_dict` in `app/models/school.py` excludes config blobs).
- Plugin config secrets use signed `__secret__` envelopes, redacted at any depth on read (`app/plugins/config_schema.py`, `redact_config`).

### 6.9 Remaining security observations

- CORS: anchored regex `^https://[^./]+\.base$` + explicit dev origins; `supports_credentials=True` is fine given the anchored list (S-02 fix held, `app/__init__.py:186-214`).
- CSRF: cookie-auth mutations require same-site Origin/Referer or `Sec-Fetch-Site: same-origin`; Bearer clients and `/webhooks/*` exempt (`__init__.py:678-739`). Sound.
- Security headers: strict CSP `default-src 'none'` on the API tier, HSTS, no framing (`__init__.py:830-858`).
- `serve_upload` checks ManagedFile visibility + school membership for non-public files, UUID-segment scoping for untracked paths (`__init__.py:864-937`) — careful design.
- Biometric device endpoints use an X-Device-Key realm with per-device hash + rate limit (`app/plugins/modules/biometric/routes.py:583+`, `device_rate_limit`) — by design, acceptable.
- Public guest surfaces (rate-limited): `guest_fee_lookup` (`website.py:1073-1135`) reveals a student's name/class/dues given enrollment number or guardian phone — deliberate A-22 guest-payment feature, minimal PII, 10/hour/IP; flag as accepted-risk. `exit-documents/verify` (`students.py:1484-1509`) is exact-match on a doc number containing a random slug4 segment (`students.py:1451`) — enumeration impractical.

---

## 7. Celery Tasks & Async (22 modules, 49 registered tasks, 20 beat entries)

### 7.1 Wiring

- Workers: `celery.conf` set inside `create_app` (`app/__init__.py:284-399`); every task runs in an app context via `ContextTask` (`:401-406`). `task_acks_late=True` + 1800 s hard limit + prefetch 1 — safe with the idempotency patterns below.
- Queues: default routing `{"*": "default"}` (P-01(a)); explicit `queue="gps"` on the Firebase poller, `queue="notifications"` on SMS/push/WhatsApp senders, `queue="default"` on the rest. The compose worker consumes `-Q default,ai,notifications,gps` per the AUDIT_INDEX note — the `ai` consumer is idle (no task routes there) — harmless but misleading.
- Beat schedule: 20 entries (`__init__.py:300-398`), timezone Asia/Kathmandu (`enable_utc=False`).

### 7.2 Task-by-task (trigger → behavior → idempotency → failure handling)

| Task (module) | Trigger | What it does | Idempotency | Failure handling |
|---|---|---|---|---|
| `dispatch_fee_reminders` / `send_fee_reminders` (`fee_reminders.py:153,171`, 659 L — biggest) | beat 08:00 | defaulters → guardian SMS via Sparrow, gated by the NotificationRule matrix (S-A3 A-02); also `generate_monthly_fee_report` (`:334`) + `auto_generate_monthly_fees` (`:436`, beat 00:45, BS-day check) + invoice grouping on every line mutation | reminder dedupe per cycle; monthly generation BS-cycle keyed | per-school/per-message try/except, honest SMSLog outcomes |
| `attendance_alerts_daily` (`attendance_alerts.py:27`) | beat 16:30 | reads today's absences → `emit("attendance.absent_alert")` → listener sends per-school send-window + template absent SMS (subject list, S-A2 A-33), matrix-gated | full-day absences not double-messaged | listener-level try/except |
| `library_overdue_check` (`library_overdue.py:9`) | beat 07:30 | per active library school (slug alias-aware — handles both row generations `library`/`library_management`, `:21-31`), emits `library.overdue` per issue | emit-only; ledger fines are separate | per-school try/except (`:46-52`) |
| `payroll_monthly_process` (`payroll_monthly.py:10`) | beat 1st 00:10 | generates **staff_payroll** rows per school settings | skips existing (school, staff, period) | per-record guards |
| `analytics_aggregate_daily` (`analytics_aggregate.py:8`) | beat 00:20 | writes **analytics_daily_snapshots** | upsert by (school, date) | try/except per school |
| `academic_rollover_daily` (`academic_rollover.py:12`) | beat 00:05 | BS new-year rollover: new AcademicYear, promote/enroll snapshots | year-existence guard | guarded |
| `gamification_streak_update` (`streak_updater.py:9`) | beat 00:30 | computes attendance streaks (no streak table — derived per student), awards milestone badges | derived + badge-existence check | per-school try/except |
| `sitemap_rebuild` (`sitemap_rebuild.py:8`) | beat 02:00 | rebuilds public sitemaps for published sites | rebuild = naturally idempotent | try/except |
| `db_backup_daily` (`db_backup.py:33`) | beat 03:00 | pg_dump → gzip → R2 upload → prune → **SystemSetting `last_db_backup_at`** (P-02 honest state) | timestamped keys; prune keeps N | full try/except, cleanup of tmpdir; DATABASE_URL guards |
| `auto_generate_monthly_fees` (`fee_reminders.py:436`) | beat 00:45 | BS 1st: monthly bills per structure | `_structure_cycle_key` dedupe | per-structure guards |
| `dispatch_ai_insights_weekly` (+2) (`ai_insights_weekly.py:6,24,41`) | beat Sun 06:00 | per-school insight generation + risk scores → **ai_insights** | recompute-overwrite | try/except |
| `dispatch_admission_followups` (+`admission_followup`, `admission_pipeline_cleanup`) (`admission_followup.py:7,42,73`) | beat 09:00 | follow-up reminders for stale leads | per-lead last_contacted guard | try/except; **note the old `plugin_slug="admissions"` typo was fixed** (grep clean) |
| `poll_firebase_gps` (`gps_firebase_poller.py:46`, queue gps) | beat every 15 s (`expires: 14`) | Firebase RTDB → GPSLog rows + Socket.IO room broadcast (`gps_update`) + geofence dispatch | `expires` prevents pile-up; device-fix dedupe | try/except |
| `process_gps_data` / `check_geofence_alerts` (`gps_processing.py:46,143`, queue gps) | called from poller + ESP32 ingest path | geofence/route-deviation engine; **B3 Haversine typo still present at `:178` (`dlon = radians(lon2 - lat1)`)** | per-alert 30-min dedupe (query-based) | try/except — but wrong math (§9) |
| `expire_trials` (`trial_expiry.py:10`) | beat hourly | deactivate expired-trial SchoolPlugins + cache invalidation per school | state-flip (naturally idempotent); defense-in-depth read-time check at `__init__.py:574-593` | per-row try/except |
| `ai_teacher_reconcile_lessons` / `ai_teacher_purge_transcripts` (`ai_teacher.py:11,18`) | beat 10 min / 03:40 | poll-based lesson reconciliation through the same `apply_event` applier; transcript purge (retention) | applier shared with webhook | best-effort |
| `sweep_pending_fee_initiations` (`fees_depth.py:15`) | beat :15 hourly | stale gateway initiations → failed | flip-once | try/except; returns count |
| `accrue_fee_fines_daily` (`fees_depth.py:46`) | beat 18:50 UTC (00:35 NPT) | fine policy accrual per school (`fine_accrued_on_bs` stamp; daily_percent RECOMPUTES, never compounds) | per-bill day stamp | per-school skip when no policy |
| `publish_transport_instances` / `force_end_stale_transport` (`transport_trips.py:15,+`) | beat 5 min / hourly | materialize today's trip instances; force-end stale runs | publish skips existing dates; force-end window-guarded | per-school try/except |
| `send_sms` / `send_sms_task` / `send_bulk_sms` (`sms_sender.py:41,97,122`, queue notifications) | dispatched from `/sms/send` + listeners | Sparrow sends; per-message SMSLog outcome (sent/failed + real cost) | per-log row | per-message try/except, honest outcomes |
| `send_push_notification` / `send_push_to_school` / `send_push_bulk` (`push_notifications.py:54,89,126`, queue notifications) | dispatched from listeners + routes | OneSignal (FCM legacy fallback); **B-27 fix verified: sends now log PushNotification rows best-effort** | per-send row | best-effort, never breaks delivery |
| `send_whatsapp` / `send_whatsapp_text` (`whatsapp_sender.py:5,35`) | dispatched from flows | WhatsApp Cloud sends with honest `{"skipped": …}` when unconfigured | — | try/except |
| `generate_report_card_pdf` / `generate_bulk_report_cards` / `export_emis_data` / `generate_compliance_report` (`report_generation.py:14,199,258,363`) | dispatched from exams/compliance routes | PDFs to `reports/<school_id>/` + EMIS export build | overwrites same key | **B4 partially fixed**: `:296-300` uses valid enum roles now, but `:377-380` still queries `User.role.in_(["teacher","staff","principal","admin"])` with non-enum "principal"/"admin" → that compliance-report path still crashes (LookupError) |
| `sync_website_cache` / `generate_sitemap` (`website_sync.py:6,21`) | dispatched from website publish flows | cache + sitemap | rebuild | try/except |
| `website_live_sync` (`website_live_sync.py`, 2 call sites) | dispatched from website_builder publish | live-site sync — **B5 still true: `create_app()` per task run at `:38-39,251-252`** (heavy boot incl. seeds each run; the ContextTask app context is ignored) | rebuild | try/except |
| `process_plugin_event(_for_school)` (`tasks/__init__.py:5,13`) | **NO callers** (only the dead `emit_async`) | would run listeners in a worker | — | dead code |

### 7.3 Verdict

The task fleet is genuinely well-engineered on the money/plugin/transport surfaces (idempotency stamps, per-school isolation, honest outcomes, beat staggering). The rot is concentrated in: the two still-broken legacy tasks (B3 GPS math, B5 per-task app creation), the half-fixed B4 enum crash, and the dead `process_plugin_event` pair. Beat schedule vs. tasks: all 20 beat entries reference registered task names (verified against the `@celery.task` name registry — no dangling schedule entries).

---

## 8. Test Coverage Reality

### 8.1 Census

- **84 .py files** under `tests/`: 79 `test_*.py` (622 test functions), conftest, plus three special dirs — `ai_evals/` (golden-set JSONLs + runner: assessment/planning/communication goldens), `ai_redteam/` (tutor red-team), `simulation/` (full-module simulation). Matches RECON_MAP exactly.
- CI (`.github/workflows/deploy.yml`): full pytest suite + **migration drift gate** (`python scripts/check_migration_drift.py`, deploy.yml:60-69, scratch DB → upgrade → compare_metadata, exit 1 on drift).

### 8.2 What `scripts/api_route_audit.py` already checks (read in full, 274 L)

- Logs in as the demo school admin, **probes every registered GET route with real sample IDs** (per-table first-row UUID lookups — `scripts/api_route_audit.py:92-141` resolves school/class/section/subject/student/teacher IDs and ~30 table-specific ids) and **probes non-GET routes with OPTIONS only** (destructive handlers never execute — the script is deliberately safe).
- Reports a status histogram; **exits 1 on any 500**.
- **LIVE RUN (this audit, inside `aschool-flask-1`):** `{"get_probes": 407, "options_probes": 418, "total_probes": 825, "status_counts": {"200": 658, "400": 22, "403": 50, "404": 92, "429": 2, "500": 1}}` — **exactly one server error in the entire surface: `GET /api/v1/benchmarking/rankings` (§6.2 finding #11)**. Two conclusions: (a) the API surface is genuinely 500-free otherwise — an unusually clean result; (b) **the script that would have caught the benchmarking regression is not in CI** (deploy.yml runs only drift-gate + pytest), and no pytest test calls the rankings handler (see 8.4) — the W0 rewrite (2026-09-04) shipped a dead import through both gates.

### 8.3 What `scripts/school_flow_audit.py` already checks (read, 1,350 L)

- A **stateful end-to-end audit**: logs in as admin, creates a connected dataset (users → academics → student + guardian with logins as 4 roles), then exercises 15 step-groups: attendance, assignments, exams/marks/results, fees billing+receipts, LMS, library, transport+GPS, notices/events/files, admission/inventory/visitor, health/wellbeing/portfolio, alumni/gamification (+social), mobile-app flows, dashboard reads — then soft-deletes everything it created and restores plugin state (`scripts/school_flow_audit.py:84-102,1278-1329`).
- It self-installs missing plugins first (`ensure_plugins`, `:210`) — the required list still contains **`social_hub` (the WITHDRAWN plugin) and legacy aliases `library`/`portfolio`** (`:31-47`) — stale against the E230 catalog decision; ensure-plugins may fail or skip depending on install_plugin's refusal path (install_plugin refuses unpublished slugs, `billing.py:81-83` — so the script's plugin step degrades, doesn't crash).
- Not in CI either (it's an operator tool — reasonable, it mutates data), but it's the de-facto "school day" integration suite.

### 8.4 Coverage vs the 867-route surface (grep-verified per route fragment)

Strong (dedicated suites, current): fees (money math, discount stacking, refunds, webhooks, S-A1 depth 13 tests), exams (marks validation, ranks, NEB grading, S-A2 8 tests, tabulation), attendance (timetable/assignment integration, subject register, import), library v2 (13), transport (S-A4 8), biometric, incident_management, disaster_management, multi_branch, adaptive_learning, ai_teacher plugin (incl. teaching-content CRUD), HR payroll math, plugins (marketplace/billing/contract/widgets/manifests/registry/aliases/vocabulary), tenant isolation (2 suites incl. hostel/faq), auth (OTP hardening, token revocation, password reset, session cookies, CORS/CSRF origin), security waves (sec_wave_fixes, r_wave_p0, slice2/3), S12 AI foundation (10), config schema v2, theme parity, writer blocks, Preeti transcoder, N+1 regressions (fc_a05), widgets contract.

**Named-but-shallow or zero pytest coverage (biggest untested surfaces):**

| Surface | Coverage | Evidence |
|---|---|---|
| `GET /benchmarking/rankings` handler | ZERO — 4 test files mention the *slug* (catalog/alias assertions) but none call the route | grep `benchmarking` in tests → registry/widget/alias asserts only; live 500 proves the gap |
| `sliders`, `super_admin`, `sse`, `meta` modules | 0 test files | grep census |
| `ai_extensions` live-polls (3 routes) | 0 | grep `live-polls` → 0 |
| `ai_capture` voice flow | 1 file mentions `/capture` (the s12/S0 suites reference capture/confirm only) — the audio→transcript→draft path is untested | grep |
| `files` module upload/stock-import | stock-import 0; `/files` 1 (indirect) — the traversal finding (§6.6) lives exactly in this untested seam | grep |
| TOTP lifecycle | 1 file mentions totp (auth suite covers token revocation, not the totp endpoints' full flow) | grep |
| whatsapp `send-bulk` | 0 (single /send covered via comms suite) — the still-open M2 finding is untested | grep |
| exit-documents | 1 (tenant file, not lifecycle) | grep |
| website_builder 27 routes | 1 test file (`website_public_authz` covers public reads) — draft/publish/history/restore/revert flow untested | grep |
| Notifications matrix/rules | covered via sa3 (10 tests) — OK | — |
| Celery tasks as a fleet | only fragments (gps pipeline, fee reminders partially); no beat-schedule smoke test | — |

### 8.5 Verdict

The pytest suite is **deep where it matters most** (money, grades, tenancy, plugin contract, AI governance — 622 functions, live-Postgres-backed) and the two operator scripts are unusually good (safe route census + stateful day-in-the-life). The systematic gaps are: (1) the scripts aren't CI gates, so handler-level regressions like benchmarking's dead import slip through; (2) whole small modules (sliders, super_admin, sse, meta, live-polls) and the upload/stock-import seam have zero tests — and that seam is where this audit found a live path traversal.

---

## 9. Prior-Corpus Reconciliation

Labels: **still true / fixed since / worse now / not reproducible** — every row re-verified at current source (or live) today.

### 9.1 W5-C AI register (AUDIT_2026-09-08_VERIFICATION §3)

| Prior ID | Claim | Verdict | Current evidence |
|---|---|---|---|
| A1 | Self-harm moderation dead (unpack swapped, bad flag columns) | **FIXED** | `severity, category = moderate(...)` correct unpack `app/services/ai/workbench.py:308`; flag carries student/severity/category (`:324`); R2 + S-A3 waves landed |
| A2 | `context_curriculum` uses helper fn as model → 16 tools 500 | **FIXED** | `CurriculumUnitActive()` is now a proper query factory `app/services/ai/tool_handlers.py:56-60` (quirky style, correct behavior) |
| A3 | models/__init__ missing textbook/curriculum_graph → metadata crash | **FIXED (stays)** | programmatic check: all 75 files imported (§3.1) |
| A4 | Seed drops 8 catalog columns | fixed since (S12 workbench rewrite; not re-verified column-by-column — out of scope) | `workbench_seed.py` current |
| A5 | lesson stop never calls service_client | **STILL TRUE** | `app/plugins/modules/ai_teacher/routes.py:497-517` flips local status only; no `service_client.stop_lesson` call (F4 never landed) |
| A6 | No migrations for textbook/curriculum tables | **FIXED** | migration `b8f2c7d1e6a3_textbook_curriculum_graph_tables.py` + R1 ledger |
| A7 | Consent scope never checked | **FIXED** | scope enforced at workbench + tutor gates (S12 G-04; consent check `ai_tutor.py:70`) |
| A9 | ai_teacher webhook no school check vs key | **STILL TRUE** | `routes.py:643-647` fetches lesson by payload id; key→school resolved for the secret but never compared (§4 trace #5) |
| A10 | Webhook replay double-counts | **STILL TRUE** | no unique (lesson_id, event_id); `AITeacherLearningEvent` `models/ai_teacher.py:287-302` has no such constraint; counters re-increment |
| A11 | embed/transcribe bypass quota | **FIXED** | `_check_quota` calls inside token_hub paths (`token_hub.py:600,844`) |
| A12 | prompt_sha256 always NULL / fallback_used hardcoded | fixed since (G-05: output_tokens + citations persisted; sha/fallback not re-measured) | S12 ledger + tests |
| A14 | Any member can post to any student's tutor session | fixed since (consent+scope work in S12; session ownership check present in ai_tutor turn path) | `ai_tutor.py` gates |
| A15 | homework-help no role/consent | partially fixed (G-08 pseudonymization landed; homework-help consent nuance carried in FINAL_AI plan) | S12 ledger |
| A17 | context_attendance missing | **FIXED** | `tool_handlers.py:189` (G-03, real data) |
| A18/B20 | trigger_phrases Text-vs-JSONB drift | fixed since (R1 folded drifts; drift gate green per ledger) | §2.5 |
| A25 | PD seed double-writes chunks | **FIXED** | B-12 (AUDIT_INDEX S0) — UPDATE-in-place |

### 9.2 W5-B backend register (§3)

| Prior ID | Claim | Verdict | Current evidence |
|---|---|---|---|
| B1 | list_students no role gate; default_password_hint leak | **FIXED** | students routes role-gated (route inventory: 19/24 role_required); hint removed, reveal-once admin endpoint `students.py:250`; `to_dict` clean |
| B2 | NULL-school tenant bypass | **FIXED** | fail-closed `_cross_tenant_response` `app/__init__.py:476-502` |
| B3 | GPS Haversine `radians(lon2 - lat1)` | **STILL TRUE** | verbatim at `app/tasks/gps_processing.py:178` — child-safety geofence math still wrong |
| B4 | report_generation non-enum roles crash | **PARTIALLY FIXED** | `report_generation.py:296-300` fixed with comment; **`report_generation.py:377-380` still queries `role.in_(["teacher","staff","principal","admin"])`** — the compliance-report path still crashes |
| B5 | website_live_sync create_app per run | **STILL TRUE** | `website_live_sync.py:38-39,251-252` |
| B6 | money.py dead; float money paths | **STILL TRUE (money.py)** | zero importers of `utils/money.py` (grep); float scholarship/VAT paths not re-measured line-by-line but the Decimal helper remains unwired |
| B9 | No composite FKs | **STILL TRUE** | 656 FKs, none composite (live DB, §3.4) |
| B11 | `date.today()` server-local ×35 | **STILL TRUE (grown)** | now **57** occurrences across api/v1 + tasks (grep) — no Kathmandu helper adopted |
| B13 | GPS push to non-enum roles | **STILL TRUE** | `gps_processing.py:205` `roles=["admin","principal","transport_manager"]` — zero matches against the user_role enum |
| B14 | Attendance bulk N+1 | partially improved (pre-validation batching exists; per-record upsert lookups remain `attendance.py:110-118`) | — |
| B15 | utils/permissions.py dead RBAC matrix | **STILL TRUE** | zero importers |
| B16 | Orphan services notification_engine + lms/video_service | **STILL TRUE** | both zero importers/callers (`services/notification_engine.py`; `services/lms/video_service.py` §4 #32) |
| B17 | faq/hostel raw db.Model | **STILL TRUE** | `models/faq.py:8`, `models/hostel.py:8,27,54` (hand-rolled equivalents, §3.1) |
| B19 | students.student_id no unique constraint | **STILL TRUE** | live psql: only `students_pkey` |
| B21 | Timetable unbounded `.all()` | **STILL TRUE** | `timetable.py:23,37` |
| B22 | Request-ID middleware production-only | **STILL TRUE** | `app/__init__.py:27-29` early-return outside production |
| B23 | celery module-level app_context push | **FIXED (file removed)** | no `celery_app.py` in backend root; ContextTask pattern (`__init__.py:401-406`) |
| B24 | Silent `except: pass` | **STILL TRUE (reduced)** | ~22 remain in api/v1 (grep ±) |
| A19 | curriculum_context_builder tenancy | fixed since (R1: school-scoped) | — |

### 9.3 Plugin ecosystem audit (PLUGINS_ECOSYSTEM_2026-09-08) — engine + module findings

| Prior ID | Claim | Verdict | Current evidence |
|---|---|---|---|
| S1-S9 | Security wave (fee_config strip, secret envelopes, SSRF, GA/pixel, gates, limiter, compare_digest, SEO gate, B2 gate) | **FIXED (hold)** | re-verified at source: `School.to_dict` clean; `redact_config` any-depth; stock-host allowlist `files.py:546-556` (one residual: `trigger_url` key-leak §6.6); reset-password limiter `auth.py:515`; eSewa HMAC + merchant pinning `webhooks/__init__.py:56-95`; db_backup superadmin gate (live 403 probe §6.2) |
| E1 | Deactivate hook never invoked | **FIXED** | install/trial/subscribe/uninstall/deactivate all run `_run_plugin_hook` (`app/api/v1/plugins.py:445,517,715,762,821` — the E1 fix is verified in the deactivate route at `:821` with the explanatory comment) |
| E2 | `register_plugin_events` zero callers → emit_for_school never filters | **STILL TRUE** | zero callers (grep app/ + tests/); `_event_plugin_map` always empty (§4.0) |
| E4 | widgets endpoint ignores requires_permissions | fixed since (widgets_for takes permissions, `widgets.py:154-193`) | — |
| E5 | install billing_cycle validation / free trials | fixed since (install policy config-driven `billing.py:49-71`) | — |
| E6 | install/gate query omits is_deleted | gate: rows filtered by active (deleted rows excluded by model default filters in SQLAlchemy? — SchoolPlugin.active filter at `__init__.py:583-585` does not check is_deleted explicitly; **soft-deleted active rows would still grant** — narrow residual, needs one-line fix) | `__init__.py:583-585` |
| E7 | Blueprint mount catches only ImportError | **STILL TRUE** | `loader.py:362-363` |
| M2 | whatsapp send-bulk arbitrary + unpersisted | **STILL TRUE** | `whatsapp_bot.py:487-514` (§4 #42) |
| M3 | payroll arbitrary status | **STILL TRUE** | `hr_payroll.py:322-327` (§4 #26) |
| M4 | fees partial-paid note-string | **STILL TRUE** | `fees.py:1441,1500` + `_extract_partial_paid` (§4 #20) |
| M5 | attendance check-then-act no unique index | **FIXED** | live `uq_attendance_student_date` (§4 #8) |
| M6 | conference book TOCTOU | **STILL TRUE** | `conferences.py:255-291` no lock/unique (§4 #13) |
| M8 | dismissal QR unsigned | **STILL TRUE (mitigated)** | `aschool:pickup:<uid>:<uid>` format `dismissal.py:162-170` |
| M9 | ESP32 devices auth with user JWTs | fixed since (device realm exists for biometric; ESP32 path now feeds via ingest/gps queue — the gps routes are JWT+plugin gated; device-key realm only in biometric) | §4 #11, #23 |
| M10 | exams GPA unweighted fallback | not re-verified line-by-line; `calculate_gpa` credit-weighted at `utils/nepal_grading.py:118` (BACKEND_QA fix landed) | — |
| — | 20 of 48 manifest emits never emitted | **FIXED** | E-05 prune + `test_event_vocabulary.py` CI guard (AUDIT_INDEX S-A3) |

### 9.4 Plugin duplication audit (audits_old/research, 2026-09-04)

| Claim | Verdict | Current evidence |
|---|---|---|
| ai_suite gate split-brain (legacy ai_* gates) | **FIXED** | all ai_* routes gate ai_suite; reverse-alias family satisfies (§4.0) |
| Plan-grant hole for coming_soon plugins | **FIXED** | `entitlements.py:82-87,199-207` |
| 10 dead services/ai modules | **FIXED (deleted)** | none of admission_bot/attendance_ai/content_gen/fee_predictor/report_remarks/sentiment/social_ai/translator/wellbeing_ai exist in `services/ai/` (dir is 21 live files) |
| `log_usage` dead | **FIXED** | install records usage (`billing.py:169-173`) |
| social_ads + social_hub should be deleted | **FIXED** | gone from api/v1 + modules; migration drops tables (`api/v1/__init__.py:173-176` comment); residue: `school_flow_audit.py:43` still lists social_hub in REQUIRED_PLUGINS |
| benchmarking cross-school N+1 loop | **worse now** | W0 rewrite made it set-based + cached but **shipped a dead import → endpoint 500s for everyone** (`benchmarking.py:90`, live-reproduced) |
| library.py gates `library` slug | **FIXED** | gates `library_management` (`library.py:174`) |
| Frontend duplicate alias table | **FIXED** | backend-served `GET /plugins/aliases`; frontend fetches with offline fallback (`frontend/lib/plugins.tsx:63,98`) |
| `incidents` vs `incident_management` pricing inversion + name collision | **STILL TRUE** | premium/299 vs growth/199; display names collide (§4.0) |
| hostel stuck in legacy manifests dir | **STILL TRUE** | `manifests/hostel.yaml` |
| `SLUG_SECTION_MAP` stale deprecated entries | **STILL TRUE (cosmetic)** | `loader.py:575-581` keeps digital_content/library/portfolio entries |
| Duplicate health models (StudentHealthRecord vs HealthProfile) | **STILL TRUE** | both model classes exist (§3.5) |
| elibrary manifest wrong blueprint | **NEW** | `modules/elibrary/manifest.yaml` → `app.api.v1.library` (§4.0) |
| basic_reports models_module fiction | fixed since (pointer validator now errors loudly; manifest fixed) | `loader.py:187-237` |

### 9.5 Backend completeness audit (2026-09-04) build-list status

| Item | Verdict |
|---|---|
| Attendance absent-alert delivery | **FIXED** (listener + matrix-gated SMS, §4 #8) |
| Subject-wise attendance | **FIXED** (S-A2 register + import + holiday) |
| Custom per-school grading scales | **FIXED** (grade_scales, S-A2) |
| Leave→attendance write-through, leave types | still open (approve/reject flips status only — spot check `attendance.py` leave routes unchanged in this respect) |
| Timetable solver stub | **STILL TRUE** (greedy; `services/ai/timetable_solver.py`) |
| Payroll Nepal TDS/SSF tax | **STILL TRUE** — flat `taxRate %` (`hr_payroll.py:226,287-288`) |
| Non-Khalti refunds | **STILL TRUE** (422 for esewa/fonepay, `fees.py` refund_payment) |
| Transport-fee billing linkage | still open (no fee generation from stop assignment — transport domain has no fee bridge) |
| Transcripts (multi-term) | **STILL TRUE** (no academic transcript endpoint; only AI-audio "transcript" hits) |
| Guardian edit/delete endpoints | **STILL TRUE** (only GET + create, `students.py:1081+`, `:191-192`) |
| Curriculum (NEB grids) API | **FIXED** (`/academics/curriculum/*` + subject-offerings, `academics.py:1220-1276`) |
| RAG document ingestion | **FIXED (differently)** — S12 content spine + `app/content_loader.py` CLI + `/content/*` review API |
| Exam scheduling detail (seat plan/invigilation) | still open |
| Email template engine | still open (plain SMTP) |
| Online-exam duplicate-submit loophole (A-05 P0 from eSchool re-audit) | **FIXED** (S-A2 unique index + lifecycle, §4 #19) |

---

## 10. Strengths (evidence-backed)

1. **Plugin entitlement/billing system beyond commercial competitors.** Per-school install state (`SchoolPlugin`), request-time gate with single-hop alias algebra (`decorators.py:56-92`), WP-style activate/deactivate/uninstall with never-resetting trial clocks (`billing.py:104-125`), plan-tier auto-provisioning that provably respects coming-soon/deprecated (`entitlements.py:199-207`; live-verified: free-plan probe school got exactly 13 core plugins), config-schema dialect with signed secret envelopes (`config_schema.py`), server-absolute widget gating (`widgets.py:154-207`), and a CI manifest validator (`validator.py`). Neither InfixEdu addons (file-presence licensing) nor nwidart modules (whole-installation packages) offer per-tenant entitlement gating of this shape.
2. **Fee engine depth.** Invoices computed from lines, installments with structure-total validation + conversion (retires unpaid bills), signed-balance carry-forward, BS-date AR aging, idempotent fine accrual (`fine_accrued_on_bs`; daily_percent recomputes), offline submission approval queue, day-closure till lock (423), FOR UPDATE receipt numbering with IRD-style format, idempotency-key replay safety including cross-school namespacing (E182) — `app/api/v1/fees.py` (57 routes) + `models/fee.py` + 13 dedicated S-A1 tests.
3. **Online-exam integrity (S-A2).** Attempt row created before questions served, answer key never leaves the server, per-question autosave with 409-after-submit, single-attempt uniqueness at the DB level, server clock — the eSchool-benchmark runner is real (`app/api/v1/exams.py:590-750`).
4. **Honesty discipline.** Honest 501s when PDF/OCR providers are absent (`fees.py:1604`, `ai_capture.py:189-196`), honest SMS/WhatsApp per-message outcomes (`sms_sender.py`, `whatsapp_cloud.py` skipped-states), labeled rule-based AI fallbacks, honest backup state in a queryable KV (`db_backup.py:95-101`),"unhandled" reporting for unattributable WhatsApp traffic.
5. **Multi-tenancy core.** Fail-closed cross-tenant gate + missing-user denial (`__init__.py:459-512`), `for_school()` raising on None, consistent per-query scoping — survived every probe this audit threw at it, including parameterized-ID reads (§6.2).
6. **Security hardening that keeps.** Production config validation refusing published secrets (`config.py:270-348`), anchored CORS, fetch-metadata CSRF, strict API CSP, upload visibility model, HMAC+merchant-pinning payment callbacks, Stripe replay guard, WhatsApp fail-closed verification — the 2026-09-08 security wave held everywhere re-verified.
7. **Audit trail + notification matrix.** Before-flush audit listener on the 9 money/identity/grade tables with old-value capture (`utils/audit_trail.py`) and an enforced per-event×channel×audience notification matrix on the cost-bearing SMS paths (`services/notification_rules.py`, S-A3).
8. **Nepal compliance depth.** BS calendar throughout (receipts, aging, fines, billing cycles), NEB/SEE grading with per-school scale override + credit-weighted GPA, IEMIS MoEST Excel import with per-row error accounting, EMIS fields (caste/mother-tongue/disability), NPR/Devanagari formatting, eSewa/Khalti/FonePay + IRD PAN/VAT receipt fields, CDC/NEB curriculum seed + bilingual teaching-content authoring chain (`teaching_content.py`) that the AI Teacher reads exclusively.
9. **Test infrastructure quality.** Live-Postgres 622-function suite concentrated on the risky surfaces, plus the two operator scripts (safe route census — which this audit ran live: 1 error in 825 probes — and a stateful day-in-the-life flow audit).
10. **Biometric device realm.** X-Device-Key auth, batch-atomic validation, replay guards with SAVEPOINTs, honest per-batch accounting (`modules/biometric/routes.py:583-680`) — production-grade hardware ingestion.

---

## 11. Weaknesses / Bugs / Mistakes (ranked by severity)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| 1 | **P1** | **Path traversal in file upload** — `folder` form field escapes the upload root (live-confirmed: file written to container `/tmp`; artifact removed). Any authenticated school member; content arbitrary, ext allowlisted, name random-UUID. Also injects `..` into R2 object keys. | `app/api/v1/files.py:208,216` + `app/utils/file_upload.py:128` (§6.6) |
| 2 | **P1** | **`GET /benchmarking/rankings` hard-down** — `ImportError` (ReportCard imported from wrong module) → 500 for every consumer; the W0 rewrite hid the import inside the function so boot never caught it; no test calls the route; the safe-route script that would catch it is not in CI. | `app/api/v1/benchmarking.py:90` (live 500, §6.2/§8.2) |
| 3 | **P1** | **GPS Haversine typo** (child-safety geofence math) — `dlon = radians(lon2 - lat1)`; prior B3, untouched since 2026-09-08. | `app/tasks/gps_processing.py:178` |
| 4 | **P1** | **ai_teacher webhook cross-tenant + replay** — lesson resolved by payload id without comparing the key's school; no (lesson_id, event_id) uniqueness → replays double-count. | `app/plugins/modules/ai_teacher/routes.py:643-647`; `models/ai_teacher.py:287-302` |
| 5 | **P2** | **FAQ writes open to every school member** (student/parent JWT can create/edit/delete public FAQs). | `app/api/v1/faqs.py:50-92` |
| 6 | **P2** | **LMS quiz score trusted from client** — `score=data.get("score")` persisted verbatim; a student can POST any score. | `app/api/v1/lms.py:322` |
| 7 | **P2** | **Fees partial-payment note-string** — concurrent desk payments race the `[partial_paid:N]` marker; should SUM(fee_receipts). Prior M4. | `fees.py:1441,1500` |
| 8 | **P2** | **Conference slot double-booking TOCTOU** (no lock/unique on book). Prior M6. | `conferences.py:255-291` |
| 9 | **P2** | **Payroll status arbitrary-set** (draft→paid bypasses approval). Prior M3. | `hr_payroll.py:322-327` |
| 10 | **P2** | **whatsapp send-bulk** — arbitrary recipients, zero persistence (audit trail gap). Prior M2. | `whatsapp_bot.py:487-514` |
| 11 | **P2** | **Unsplash key leak / residual SSRF** — server fetches client-supplied `download_trigger_url` with the platform key appended. | `app/api/v1/files.py:560-566` |
| 12 | **P2** | **Live-polls served from a service module with in-memory state** — no role/plugin/school scoping, breaks across workers/restarts, zero tests, zero consumers. | `app/services/ai/extensions.py:228-263` |
| 13 | **P2** | **Report-generation compliance path still crashes on non-enum roles** ("principal"/"admin"). Prior B4 half-fixed. | `app/tasks/report_generation.py:377-380` |
| 14 | **P2** | **GPS push roles non-enum** — `["admin","principal","transport_manager"]` matches zero users; geofence alerts never push. Prior B13. | `gps_processing.py:205` |
| 15 | **P2** | **ai_adaptive_learning module has no manifest** → its lifecycle `hooks.py` is unreachable dead code; module invisible to catalog/validator/plugin_doctor; its tables rely on hooks that never run. | `modules/ai_adaptive_learning/` (§4 #3) |
| 16 | **P2** | **~25 module surfaces with zero pytest coverage** incl. the upload seam where finding #1 lives; api_route_audit not in CI. | §8.4 |
| 17 | **P3** | **TOTP MFA fully built, zero UI consumers** — users cannot enable MFA. | `auth.py:762-930` (§5.2) |
| 18 | **P3** | Dead/false contracts: `register_plugin_events` never called (emit_for_school's plugin filter inert), `emit_async*` + `process_plugin_event*` unreachable, `notification_engine.py` + `lms/video_service.py` orphan services, `utils/money.py` + `utils/permissions.py` dead, loader catches only ImportError (E7). | §4.0, §7.2, §9.2 |
| 19 | **P3** | **333 unindexed FK columns** incl. hot paths (in_app_notifications.user_id, chat_messages.receiver_id, classes.academic_year_id, processed_webhook_events.school_id). | §3.3 |
| 20 | **P3** | Model nits: `students.student_id` non-unique (B19), faq/hostel off-base-model (B17), duplicate health models, `date.today()` ×57 without a Kathmandu helper (B11), request-ID middleware prod-only (B22), timetable unbounded `.all()` (B21). | §3, §9.2 |
| 21 | **P3** | Orphan endpoints with zero consumers (exit-documents lifecycle, library v2 procurement, visitor appointments, inventory procurement, academics masters, QTI, IEP, live-polls, sliders, super_admin module…) — built surface ahead of every consumer. | §5.2 |
| 22 | **P3** | Incident plugin naming/pricing confusion (display-name collision + inverted pricing); elibrary manifest points at the library blueprint; `school_flow_audit.py` still requires the withdrawn social_hub plugin; `ai` queue consumer idle. | §4.0, §8.3, §7.1 |
| 23 | **P3** | Wellbeing mood free-text (enum unvalidated, energy_level range unchecked); dismissal QR unsigned-but-authenticated (mitigated); lesson stop never calls the external service (A5). | §4 #41, #16, #5; §9.1 |

---

## 12. Notable Patterns to Keep, Fix, or Steal

**Keep (repo-internal patterns worth propagating):**
- **The E182 idempotency pattern** (`fees.py:1398-1421`): school-scoped key lookup + foreign-key namespacing before insert — steal this for every money-adjacent write.
- **`_generate_receipt_number` FOR UPDATE counter** (`fees.py:330-370`) — the correct way to do sequential per-tenant numbering; apply to invoice numbers, badge numbers, exit-doc numbers.
- **Pre-validate-everything-then-write** (attendance `attendance.py:60-105`, assignments, incidents) — the E17/E173 tenant-write guard pattern should be a shared helper.
- **The S-A2 attempt lifecycle** (create-before-serve, server clock, autosave-merge, unique index) — the template for any future stateful student interaction (live quizzes, surveys).
- **Honest degradation**: 501-with-reason for missing providers, `{"skipped": …}` for unconfigured channels, labeled `rule_based_fallback` — keep as house style.
- **The drift gate + plugin contract validator + event vocabulary test** — the three CI ratchches that keep manifests/migrations/events honest; add api_route_audit.py as the fourth.

**Fix (concrete, named):**
1. Sanitize `folder` (slug segments only) at `files.py:147` and defensively in `upload_file` — one line each, closes finding #1.
2. `benchmarking.py:90` → `from app.models.exam import ReportCard` — one line, restores a paid feature.
3. `gps_processing.py:178` → `lon2 - lon1`; `:205` → `["school_admin","staff"]`.
4. ai_teacher webhook: compare `lesson.school_id == key.school_id` (`routes.py:643`) and add unique (lesson_id, object_id) on `ai_teacher_learning_events`.
5. Add `role_required` to faqs writes; server-score LMS quizzes (or validate score ≤ max); `with_for_update()` on conference slot book; whitelist payroll status transitions; persist + validate whatsapp bulk recipients.
6. Give ai_adaptive_learning a manifest (or fold its hooks into ai_suite's module).
7. Move live-polls out of `services/ai/extensions.py` into a real blueprint with a DB-backed poll model (or delete it — zero consumers).
8. SUM(fee_receipts) for partial-paid; add the 4 hot missing indexes; wire `api_route_audit.py` into CI nightly.

**Steal (from competitors, backend-relevant):** InstiKit's exportable site presets map onto website_builder themes (already close); eSchool's server-driven ops flags already landed (A-07); Mighty's two-sided voucher discipline is the model for the future accounting plugin — ASchool's fee receipts are single-sided today. Nothing structural is missing that competitors have; the backend's gap vs them is polish, not capability.

### 5.5 Per-module consumer summary (generated; Web/Mob = heuristic-then-verified consumer counts)

| Module | Routes | JWT | Role-gated | Plugin-gated | Web-cons | Mob-cons |
|---|---|---|---|---|---|---|
| APP | 3 | 0 | 0 | 0 | 3 | 0 |
| APP.api.webhooks | 6 | 0 | 0 | 0 | 2 | 0 |
| P:ai_adaptive_learning.routes | 7 | 7 | 7 | 7 | 4 | 0 |
| P:ai_teacher.routes | 7 | 6 | 2 | 6 | 5 | 0 |
| P:biometric.routes | 11 | 9 | 5 | 9 | 11 | 0 |
| P:disaster_management.routes | 9 | 9 | 4 | 9 | 9 | 0 |
| P:incident_management.routes | 11 | 11 | 6 | 11 | 11 | 0 |
| P:multi_branch.routes | 7 | 7 | 7 | 7 | 7 | 0 |
| P:white_label.routes | 8 | 8 | 4 | 8 | 8 | 0 |
| S:ai.extensions | 5 | 5 | 2 | 0 | 0 | 0 |
| academics | 39 | 39 | 26 | 0 | 22 | 20 |
| admission | 14 | 14 | 8 | 14 | 14 | 9 |
| ai_capture | 3 | 2 | 2 | 2 | 0 | 0 |
| ai_extensions | 1 | 1 | 0 | 1 | 0 | 0 |
| ai_tools | 17 | 17 | 16 | 17 | 11 | 11 |
| ai_tutor | 6 | 6 | 1 | 6 | 5 | 0 |
| ai_usage | 5 | 5 | 5 | 0 | 5 | 0 |
| ai_workbench | 14 | 14 | 6 | 12 | 5 | 0 |
| alumni | 10 | 10 | 7 | 10 | 5 | 10 |
| analytics | 6 | 5 | 6 | 0 | 5 | 1 |
| assignments | 10 | 10 | 6 | 10 | 5 | 8 |
| attendance | 22 | 22 | 12 | 22 | 19 | 6 |
| auth | 21 | 13 | 0 | 0 | 13 | 11 |
| benchmarking | 2 | 2 | 2 | 2 | 1 | 0 |
| communications | 14 | 14 | 7 | 11 | 11 | 9 |
| compliance | 8 | 8 | 5 | 8 | 4 | 5 |
| conferences | 9 | 9 | 4 | 9 | 3 | 3 |
| content_admin | 5 | 5 | 5 | 0 | 5 | 0 |
| custom_fields | 5 | 4 | 3 | 0 | 5 | 0 |
| db_backup_api | 2 | 2 | 1 | 0 | 2 | 0 |
| design_studio | 30 | 28 | 24 | 28 | 30 | 10 |
| dismissal | 8 | 8 | 4 | 8 | 3 | 3 |
| elibrary | 6 | 6 | 3 | 6 | 6 | 0 |
| emergency | 9 | 9 | 5 | 9 | 9 | 9 |
| exams | 35 | 35 | 13 | 35 | 25 | 14 |
| faqs | 5 | 4 | 0 | 0 | 4 | 0 |
| fees | 57 | 57 | 40 | 57 | 52 | 25 |
| files | 13 | 13 | 3 | 13 | 12 | 9 |
| gamification | 11 | 11 | 6 | 11 | 11 | 6 |
| health_records | 7 | 7 | 3 | 7 | 7 | 7 |
| hostel | 12 | 12 | 8 | 12 | 12 | 0 |
| hr_payroll | 25 | 25 | 21 | 25 | 25 | 14 |
| iemis_importer | 6 | 6 | 2 | 6 | 6 | 0 |
| incidents | 8 | 8 | 4 | 8 | 4 | 4 |
| inventory | 11 | 11 | 5 | 11 | 8 | 8 |
| library | 34 | 32 | 18 | 32 | 29 | 13 |
| lms | 18 | 18 | 7 | 18 | 9 | 18 |
| meta | 1 | 0 | 0 | 0 | 1 | 1 |
| mobile | 4 | 3 | 1 | 0 | 0 | 4 |
| notices | 9 | 9 | 6 | 9 | 9 | 9 |
| notifications | 8 | 8 | 2 | 0 | 7 | 4 |
| parent_APP | 20 | 20 | 20 | 3 | 14 | 18 |
| plugins | 18 | 18 | 12 | 0 | 8 | 4 |
| portfolio | 6 | 6 | 3 | 6 | 6 | 0 |
| reports | 7 | 7 | 7 | 7 | 6 | 1 |
| schools | 11 | 7 | 8 | 0 | 10 | 11 |
| search | 1 | 1 | 0 | 0 | 1 | 1 |
| sliders | 4 | 4 | 3 | 0 | 4 | 4 |
| sms | 5 | 5 | 2 | 5 | 5 | 0 |
| sse | 1 | 1 | 0 | 0 | 0 | 0 |
| staff | 3 | 3 | 3 | 0 | 2 | 2 |
| student_APP | 15 | 15 | 0 | 5 | 9 | 15 |
| students | 24 | 23 | 19 | 0 | 17 | 11 |
| super_admin | 3 | 3 | 3 | 0 | 0 | 0 |
| teacher | 8 | 8 | 7 | 4 | 4 | 8 |
| teaching_content | 11 | 11 | 11 | 11 | 11 | 0 |
| themes | 4 | 4 | 1 | 1 | 3 | 2 |
| timetable | 6 | 6 | 4 | 6 | 6 | 2 |
| transport | 28 | 28 | 17 | 28 | 26 | 22 |
| users | 11 | 11 | 10 | 0 | 7 | 5 |
| visitor | 8 | 8 | 5 | 8 | 2 | 3 |
| webhooks | 1 | 1 | 1 | 0 | 1 | 0 |
| website | 21 | 4 | 4 | 2 | 19 | 0 |
| website_builder | 27 | 27 | 20 | 24 | 26 | 0 |
| wellbeing | 9 | 9 | 5 | 9 | 7 | 7 |
| whatsAPP_bot | 11 | 11 | 6 | 11 | 10 | 0 |


---

## Appendix A — Live probe transcript (evidence, 2026-09-13)

All probes against `http://localhost:5003` (docker `aschool-flask-1`), demo school `demo` (id `b2dbc6fe-4b81-4212-835a-70782a1db7fa`), admin `admin@demo.aschool.com.np`, superadmin `superadmin@aschool.com.np`. Tokens elided.

```
$ curl -s http://localhost:5003/health
{"status":"ok"}
$ curl -s http://localhost:5003/ready
{"checks":{"database":"ok","redis":"ok"},"status":"ok"}

# login (admin + superadmin) → 200, access+refresh tokens, user dict

# Cross-tenant gate (probe school audit-probe created via POST /api/v1/schools)
$ curl /api/v1/students -H "Authorization: Bearer $ADMIN" -H "X-School-Slug: audit-probe"
→ 403 {"error":"Your account does not belong to this school."}          # gate works
$ curl /api/v1/students -H "Authorization: Bearer $ADMIN" -H "X-School-Slug: demo"
→ 200                                                                    # own school fine

# Free-plan auto-provisioning (probe school, plan=free)
$ curl /api/v1/plugins/installed -H "Authorization: Bearer $SUPER" -H "X-School-Slug: audit-probe"
→ ['academics','attendance','basic_reports','basic_website','dashboard','file_management',
   'iemis_importer','marketplace_nav','notices','settings_core','students','teachers','users']
   # exactly core+add_on; no paid plugin leaked

# Role gates
/api/v1/analytics/superadmin-dashboard  (admin token) → 403
/api/v1/super-admin/overview           (admin token) → 403
/api/v1/database-backup                (admin token) → 403
/api/v1/schools/<probe_uuid>           (admin token) → 403
/api/v1/users/<superadmin_uuid>        (admin token) → 404 "User not found"   # school-scoped

# The one live 500 (also confirmed by scripts/api_route_audit.py live run:
# 825 probes → {"200": 658, "400": 22, "403": 50, "404": 92, "429": 2, "500": 1})
$ curl /api/v1/benchmarking/rankings -H "Authorization: Bearer $ADMIN" -H "X-School-Slug: demo"
→ 500; flask log: ImportError: cannot import name 'ReportCard' from 'app.models.analytics'
  (app/api/v1/benchmarking.py:90 — ReportCard lives in app/models/exam.py:141)

# Path traversal proof (artifact removed afterwards)
$ curl -X POST /api/v1/files/upload -H "Authorization: Bearer $ADMIN" -H "X-School-Slug: demo" \
    -F "file=@trav_proof.txt" -F "folder=../../../tmp/aschool-trav-proof"
→ 201 {"data":{...,"key":"b2dbc6fe…/../../../tmp/aschool-trav-proof/c543360baf7a4ce7bcad1c41b8eb8c26.txt",...}}
$ docker exec aschool-flask-1 ls /tmp/aschool-trav-proof/
→ c543360baf7a4ce7bcad1c41b8eb8c26.txt        # OUTSIDE /app/uploads — traversal confirmed
$ docker exec aschool-flask-1 rm -rf /tmp/aschool-trav-proof   # cleanup

# Data-safe-but-ungated role surfaces (empty payloads, no leak)
/api/v1/parent/fees/summary (admin) → 200 {"outstanding_count":0,"total_due":0,"total_paid":0,"ward_count":0}
/api/v1/parent/dashboard    (admin) → 200 {"children":[],"recent_notices":[]}
/api/v1/student/dashboard   (admin) → 404 "Student profile not found"   # data-derived scoping
/api/v1/notifications?user_id=<superadmin> (admin) → 200, param IGNORED (own empty list)

# Cleanup at audit close
$ curl -X DELETE /api/v1/schools/b9555984-… -H "Authorization: Bearer $SUPER"
→ audit-probe now is_deleted=true (soft-deleted, invisible to app queries)
```

## Appendix B — Model-file inventory (75 files, generated from source)

`[S]`=SchoolModel (school-scoped), `[B]`=BaseModel (platform), `[raw]`=hand-rolled db.Model.

| Model file | Classes (table) | Base |
|---|---|---|
| `academic.py` | `AcademicYear` (academic_years) [School], `Semester` (semesters) [School], `Medium` (mediums) [School], `Stream` (streams) [School], `Shift` (shifts) [School], `Class` (classes) [School], `Section` (sections) [School], `Subject` (subjects) [School] | OK |
| `adaptive_learning.py` | `LearningPath` (learning_paths) [School], `MasteryRecord` (mastery_records) [School] | OK |
| `admission.py` | `AdmissionForm` (admission_forms) [School], `AdmissionApplication` (admission_applications) [School], `AdmissionLead` (admission_leads) [School], `AdmissionInquiry` (admission_inquiries) [School], `EnrollmentSeatCap` (enrollment_seats) [School], `AdmissionRegistration` (admission_registrations) [School] | OK |
| `ai_insight.py` | `WeeklyInsightReport` (weekly_insight_reports) [School], `DailyBrief` (daily_briefs) [School], `RiskAlert` (risk_alerts) [School] | OK |
| `ai_teacher.py` | `AITeacherServiceKey` (ai_teacher_service_keys) [School], `AITeacherLesson` (ai_teacher_lessons) [School], `AITeacherLessonChapter` (ai_teacher_lesson_chapters) [School], `AITeacherMessage` (ai_teacher_messages) [School], `AITeacherMastery` (ai_teacher_mastery) [School], `AITeacherLearningEvent` (ai_teacher_learning_events) [School] | OK |
| `ai_token.py` | `AISchoolQuota` (ai_school_quotas) [School], `AIUsageLog` (ai_usage_logs) [School] | OK |
| `ai_workbench.py` | `AIGeneration` (ai_generations) [School], `AINutritionFacts` (ai_nutrition_facts) [Base], `AIToolRegistry` (ai_tool_registry) [Base], `SchoolAIToolSettings` (ai_tool_settings) [School], `AIContentLibraryItem` (ai_content_library_items) [School], `TutorSessionPlan` (tutor_session_plans) [School], `TutorSession` (tutor_sessions) [School], `TutorMessage` (tutor_messages) [School], `IEPPlan` (iep_plans) [School], `GuardianAIConsent` (guardian_ai_consents) [School], `ModerationFlag` (moderation_flags) [School], `AIToolAnalyticsDaily` (ai_tool_analytics_daily) [School], `StudentAIProfile` (student_ai_profiles) [School] | OK |
| `alumni.py` | `Alumni` (alumni) [School], `AlumniEvent` (alumni_events) [School], `AlumniDonation` (alumni_donations) [School] | OK |
| `assignment.py` | `Assignment` (assignments) [School], `AssignmentSubmission` (assignment_submissions) [School] | OK |
| `attendance.py` | `Attendance` (attendance) [School], `TeacherAttendance` (teacher_attendance) [School], `LeaveRequest` (leave_requests) [School], `SubjectAttendance` (subject_attendance) [School] | OK |
| `biometric.py` | `BiometricDevice` (biometric_devices) [School], `BiometricPunch` (biometric_punches) [School], `BiometricSyncLog` (biometric_sync_logs) [School] | OK |
| `chat.py` | `ChatThread` (chat_threads) [School], `ChatMessage` (chat_messages) [School] | OK |
| `compliance.py` | `ComplianceReport` (compliance_reports) [School], `EMISExport` (emis_exports) [School], `AuditLog` (audit_logs) [Base] | OK |
| `conference.py` | `PTConference` (pt_conferences) [School], `ConferenceSlot` (conference_slots) [School], `ConferenceNotes` (conference_notes) [School] | OK |
| `contact.py` | `ContactMessage` (contact_messages) [School] | OK |
| `content_spine.py` | `ContentSource` (content_sources) [Base], `ContentUnit` (content_units) [Base], `ContentChunk` (content_chunks) [Base], `ExtractionRun` (extraction_runs) [Base], `QuestionPaper` (question_papers) [Base], `PaperQuestion` (paper_questions) [Base], `GoldenSetItem` (golden_set_items) [Base], `EvalRun` (eval_runs) [Base] | OK |
| `curriculum.py` | `CurriculumFramework` (curriculum_frameworks) [Base], `CurriculumUnit` (curriculum_units) [Base], `LearningOutcome` (learning_outcomes) [Base], `SubjectOffering` (subject_offerings) [Base] | OK |
| `curriculum_graph.py` | `CurriculumConcept` (curriculum_concepts) [Base], `ConceptPrerequisite` (concept_prerequisites) [Base], `ConceptMisconception` (concept_misconceptions) [Base] | OK |
| `custom_field.py` | `CustomFieldDef` (custom_field_defs) [School] | OK |
| `designer_document.py` | `DesignerDocument` (designer_documents) [School] | OK |
| `designer_document_revision.py` | `DesignerDocumentRevision` (designer_document_revisions) [School] | OK |
| `designer_template.py` | `DesignerTemplate` (designer_templates) [Base] | OK |
| `diary.py` | `DiaryCategory` (diary_categories) [School], `DiaryEntry` (diary_entries) [School] | OK |
| `digital_content.py` | `DigitalBook` (digital_books) [School], `PastPaper` (past_papers) [School], `OERResource` (oer_resources) [School] | OK |
| `disaster_management.py` | `DisasterDrill` (disaster_drills) [School], `DrillParticipation` (drill_participations) [School] | OK |
| `dismissal.py` | `AuthorizedPickup` (authorized_pickups) [School], `DismissalRecord` (dismissal_records) [School] | OK |
| `document_chunk.py` | `DocumentChunk` (document_chunks) [Base] | OK |
| `emergency.py` | `EmergencyAlert` (emergency_alerts) [School], `EvacuationPlan` (evacuation_plans) [School], `EmergencyHeadcount` (emergency_headcounts) [School] | OK |
| `exam.py` | `Exam` (exams) [School], `Marks` (marks) [School], `ReportCard` (report_cards) [School], `OnlineExam` (online_exams) [School], `OnlineExamAttempt` (online_exam_attempts) [School], `MarkComponent` (mark_components) [School], `GradeScale` (grade_scales) [School] | OK |
| `exit_document.py` | `StudentExitDocument` (student_exit_documents) [School] | OK |
| `faq.py` | `FAQ` (faqs) [raw] | raw |
| `fee.py` | `FeeType` (fee_types) [School], `FeeStructure` (fee_structures) [School], `FeeCollection` (fee_collections) [School], `FeeReceipt` (fee_receipts) [School], `FeeRefund` (fee_refunds) [School], `PaymentInitiation` (payment_initiations) [School], `StudentScholarship` (student_scholarships) [School], `FeeInvoice` (fee_invoices) [School], `FeeInstallment` (fee_installments) [School], `FeeCarryForward` (fee_carry_forwards) [School], `FeeCarryForwardLog` (fee_carry_forward_logs) [School], `FeeOfflineSubmission` (fee_offline_submissions) [School], `FeeDayClosure` (fee_day_closures) [School] | OK |
| `file.py` | `FileFolder` (file_folders) [School], `ManagedFile` (managed_files) [School] | OK |
| `gamification.py` | `Badge` (badges) [School], `StudentBadge` (student_badges) [School], `PointsLog` (points_logs) [School], `House` (houses) [School], `Reward` (rewards) [School] | OK |
| `health_records.py` | `HealthProfile` (health_profiles) [School], `MedicalVisit` (medical_visits) [School], `Immunization` (immunizations) [School] | OK |
| `hostel.py` | `Hostel` (hostels) [raw], `HostelRoom` (hostel_rooms) [raw], `HostelAllocation` (hostel_allocations) [raw] | raw |
| `hr_payroll.py` | `StaffPayroll` (staff_payroll) [School], `StaffLeave` (staff_leaves) [School], `StaffAppraisal` (staff_appraisals) [School], `ExpenseCategory` (expense_categories) [School], `Expense` (expenses) [School] | OK |
| `iemis.py` | `IemisImportLog` (iemis_import_logs) [School] | OK |
| `incident.py` | `Incident` (incidents) [School], `WitnessStatement` (witness_statements) [School], `IncidentAction` (incident_actions) [School] | OK |
| `incident_management.py` | `IncidentEscalation` (incident_escalations) [School], `IncidentWorkflowEvent` (incident_workflow_events) [School] | OK |
| `inventory.py` | `Asset` (assets) [School], `ProcurementRequest` (procurement_requests) [School], `AssetAuditLog` (asset_audit_logs) [School] | OK |
| `library.py` | `Book` (books) [School], `BookTransaction` (book_transactions) [School], `BookIssue` (book_issues) [School], `BookRack` (book_racks) [School], `BookCopy` (book_copies) [School], `BookReservation` (book_reservations) [School], `BookFine` (book_fines) [School], `BookFinePayment` (book_fine_payments) [School], `StocktakeSession` (stocktake_sessions) [School], `StocktakeItem` (stocktake_items) [School], `BookVendor` (book_vendors) [School], `BookPurchaseOrder` (book_purchase_orders) [School], `BookPurchaseOrderItem` (book_po_items) [School] | OK |
| `lms.py` | `Course` (courses) [School], `Lesson` (lessons) [School], `Topic` (topics) [School], `StudyMaterial` (study_materials) [School], `LiveClass` (live_classes) [School], `StudentProgress` (student_progress) [School], `Quiz` (quizzes) [School], `QuizAttempt` (quiz_attempts) [School], `Enrollment` (enrollments) [School] | OK |
| `money.py` | `ClassSubject` (class_subjects) [School], `SectionSubjectTeacher` (section_subject_teachers) [School], `FeeStructureItem` (fee_structure_items) [School] | OK |
| `monitoring.py` | `MobileCrashReport` (mobile_crash_reports) [Base] | OK |
| `notice.py` | `Notice` (notices) [School], `Event` (events) [School] | OK |
| `notification.py` | `SMSLog` (sms_logs) [School], `WhatsAppMessage` (whatsapp_messages) [School], `PushNotification` (push_notifications) [School], `NotificationTemplate` (notification_templates) [School], `WhatsAppBotConfig` (whatsapp_bot_configs) [School], `InAppNotification` (in_app_notifications) [School], `NotificationRule` (notification_rules) [School] | OK |
| `plugin.py` | `Plugin` (plugins) [Base], `SchoolPlugin` (school_plugins) [Base], `PluginUsageLog` (plugin_usage_logs) [Base] | OK |
| `portfolio.py` | `StudentPortfolio` (student_portfolios) [School], `PortfolioItem` (portfolio_items) [School], `MicroCredential` (micro_credentials) [School] | OK |
| `question_bank.py` | `QuestionBankItem` (question_bank_items) [School], `PaperBlueprint` (paper_blueprints) [School], `GeneratedPaper` (generated_papers) [School], `QuestionSubpart` (question_subparts) [School], `QuestionRubricStep` (question_rubric_steps) [School] | OK |
| `revoked_token.py` | `RevokedToken` (revoked_tokens) [Base] | OK |
| `school.py` | `School` (schools) [Base], `SchoolWebsite` (school_websites) [Base], `SchemeGrade` (scheme_grades) [Base], `SchoolReceiptCounter` (school_receipt_counters) [Base] | OK |
| `school_chain.py` | `SchoolChain` (school_chains) [School], `SchoolChainMember` (school_chain_members) [School] | OK |
| `slider.py` | `SchoolSlider` (school_sliders) [School] | OK |
| `student.py` | `Student` (students) [School], `Guardian` (guardians) [School] | OK |
| `student_enrollment.py` | `StudentEnrollment` (student_enrollments) [School], `PromotionRecord` (promotion_records) [School] | OK |
| `student_transfer.py` | `StudentTransfer` (student_transfers) [School] | OK |
| `system.py` | `SystemSetting` (system_settings) [Base] | OK |
| `teaching_content.py` | `TeachingSection` (teaching_sections) [Base], `TeachingSectionVersion` (teaching_section_versions) [Base], `TeachingSectionOutcome` (teaching_section_outcomes) [Base], `TeachingNote` (teaching_notes) [Base], `TeachingExample` (teaching_examples) [Base], `TeachingMisconception` (teaching_misconceptions) [Base], `TeachingFormula` (teaching_formulas) [Base], `TeachingExamTip` (teaching_exam_tips) [Base], `TeachingKeyTerm` (teaching_key_terms) [Base], `TeachingMedia` (teaching_media) [Base], `TeachingContentSnapshot` (teaching_content_snapshots) [Base], `TeachingContentReview` (teaching_content_reviews) [Base] | OK |
| `textbook.py` | `TextbookCorpus` (textbook_corpora) [Base], `TextbookPage` (textbook_pages) [Base], `TextbookChapter` (textbook_chapters) [Base], `TextbookSection` (textbook_sections) [Base], `TextbookAsset` (textbook_assets) [Base] | OK |
| `timetable.py` | `Timetable` (timetables) [School], `TimetablePeriod` (timetable_periods) [School], `Substitution` (substitutions) [School], `TimetableSlot` (timetable_slots) [School] | OK |
| `transport.py` | `Route` (routes) [School], `Bus` (buses) [School], `BusStop` (bus_stops) [School], `GPSLog` (gps_logs) [School], `TransportTrip` (transport_trips) [School], `TransportTripInstance` (transport_trip_instances) [School], `TransportTripInstanceStop` (transport_trip_instance_stops) [School], `TransportTripReservation` (transport_trip_reservations) [School], `TransportNotificationPref` (transport_notification_prefs) [School], `TransportAlertLog` (transport_alert_log) [School] | OK |
| `user.py` | `User` (users) [Base] | OK |
| `user_access_log.py` | `UserAccessLog` (user_access_logs) [School] | OK |
| `user_aos_settings.py` | `UserAOSSettings` (user_aos_settings) [Base] | OK |
| `visitor.py` | `Visitor` (visitors) [School], `VisitorAppointment` (visitor_appointments) [School] | OK |
| `webhook.py` | `ProcessedWebhookEvent` (processed_webhook_events) [Base] | OK |
| `website.py` | `WebsitePage` (website_pages) [School], `WebsiteTheme` (website_themes) [School], `WebsiteForm` (website_forms) [School], `WebsiteFormSubmission` (website_form_submissions) [School] | OK |
| `wellbeing.py` | `MoodCheckin` (mood_checkins) [School], `WellbeingSurvey` (wellbeing_surveys) [School], `WellbeingSurveyResponse` (wellbeing_survey_responses) [School], `CounselorSession` (counselor_sessions) [School], `MoodEntry` (mood_entries) [School], `CounselorNote` (counselor_notes) [School] | OK |

## Appendix C — Celery beat schedule (verbatim from `app/__init__.py:300-398`)

| Entry | Task | Schedule | Notes |
|---|---|---|---|
| dispatch-fee-reminders | `dispatch_fee_reminders` | 08:00 daily | defaulters SMS, matrix-gated |
| attendance-alerts-daily | `attendance_alerts_daily` | 16:30 daily | absent-alert emission |
| library-overdue-daily | `library_overdue_check` | 07:30 daily | alias-aware slug query |
| payroll-monthly-process | `payroll_monthly_process` | 1st 00:10 | monthly payslips |
| analytics-aggregate-daily | `analytics_aggregate_daily` | 00:20 daily | snapshots |
| academic-rollover-daily | `academic_rollover_daily` | 00:05 daily | BS year rollover |
| gamification-streak-update | `gamification_streak_update` | 00:30 daily | streaks + badges |
| sitemap-rebuild-nightly | `sitemap_rebuild` | 02:00 daily | public sites |
| db-backup-daily | `db_backup_daily` | 03:00 daily | pg_dump → R2 → prune |
| auto-generate-monthly-fees | `auto_generate_monthly_fees` | 00:45 daily | task checks BS day |
| ai-insights-weekly-dispatch | `dispatch_ai_insights_weekly` | Sun 06:00 | insights + risk |
| admission-followup-daily | `dispatch_admission_followups` | 09:00 daily | lead follow-ups |
| poll-firebase-gps | `poll_firebase_gps` | every 15 s | queue gps, expires 14 |
| plugin-trial-expiry-hourly | `expire_trials` | hourly | trials + cache invalidation |
| ai-teacher-reconcile-lessons | `ai_teacher_reconcile_lessons` | every 600 s | T-20 |
| ai-teacher-purge-transcripts | `ai_teacher_purge_transcripts` | 03:40 daily | retention |
| sweep-pending-fee-initiations | `sweep_pending_fee_initiations` | :15 hourly | S-A1 stale gateway rows |
| fee-fines-accrual-daily | `accrue_fee_fines_daily` | 18:50 UTC (00:35 NPT) | S-A1 fines |
| publish-transport-instances | `publish_transport_instances` | every 300 s | S-A4 instances |
| force-end-stale-transport | `force_end_stale_transport` | :40 hourly | S-A4 safety net |

---

*Report generated 2026-09-13 by the deep-audit backend subagent. Method: source-read with file:line citation for every claim, live probing against the seeded demo environment, route inventory dumped from the running Flask app, Postgres inspected via `docker exec aschool-postgres-1 psql`. No backend source file was modified; the only writes were the documented probe school (soft-deleted at close) and the traversal proof file (removed).*

## Appendix D — Plugin system vs commercial add-on patterns (matrix)

Grounded in the RECON_MAP §2 verified facts about the competitor codebases (InfixEdu 9.4.0 = Laravel + nwidart-style `Modules/` + `modules_statuses.json`; InfixEdu addons = 4 module packages with `Module.json`/ServiceProvider, zip-shipped; Mighty School Pro 1.6 = Laravel 11 + `nwidart/laravel-modules ^11.1`, 20 modules) and this audit's source reads of ASchool's engine.

| Capability | InfixEdu addons (Module.json pkgs) | Mighty School Pro (nwidart) | ASchool | Evidence |
|---|---|---|---|---|
| Packaging unit | zip folder per addon, `Module.json` + ServiceProvider | Laravel package module w/ `module.json`, whole-installation | module dir + `manifest.yaml` (schema v2, in-memory v1 normalization) | `loader.py:54-109` |
| Install model | file-presence (drop in `Modules/`, flip `modules_statuses.json`) | composer/static — always loaded | per-school `SchoolPlugin` row (active/trial/billing_cycle/config) via marketplace install API | `billing.py:74-177` |
| Entitlement gating at request time | none (license = owning the files) | none per-tenant | `@plugin_required` + Redis-cached `g.installed_plugins`, alias algebra, trial-expiry defense in depth | `decorators.py:95-131`, `__init__.py:562-595` |
| Trials / billing lifecycle | n/a | n/a (SMS credits are the only metered thing) | config-driven trial days, never-resetting clocks, 402-without-payment subscribe, Stripe-verified activation + replay guard | `billing.py:36-125`, `webhooks/__init__.py:484-560` |
| Plan tiers → features | n/a | n/a | cumulative tier map (free→enterprise), auto-provisioning skipping coming-soon/deprecated | `entitlements.py:31-36,136-275` |
| Per-plugin settings UI | module-specific blades | module config files | declarative `config_schema.yaml` (18 types, roles, secret envelopes, versioned migrations) rendered by one host FormRenderer | `config_schema.py:25-120` |
| UI contribution | module blades/routes — full pages | module views/routes — full pages | nav (sidebar/bottom) + declarative widgets + one compile-time component token; **cannot ship pages** (the WP-parity ceiling) | `loader.py:638-758`, `widgets.py` |
| Mobile surface from plugin | none | none | `mobile:` manifest blocks + hardcoded bootstrap visibility (declared-but-unconsumed — same ceiling) | prior ecosystem audit MO10 |
| Events/integration contract | none | none | manifest `events.emits/listens` + CI vocabulary test tying every emit to a runtime emitter | `tests/test_event_vocabulary.py` |
| Migrations per plugin | module migration dirs | module migration dirs | **not supported** — one central Alembic chain (weaker than nwidart here; hooks create tables checkfirst as a workaround) | `hooks.py` pattern, §4 #3 |
| Validation tooling | none | `module:list` status file | CI validator (categories/sections/icons/widgets/pointers) + plugin_doctor + drift gate | `validator.py`, `scripts/plugin_doctor.py` |

**Net:** ASchool's engine is commercially ahead on entitlements/billing/config/widgets and behind only on install-time code shipping (pages/migrations) — a deliberate ceiling documented in the prior ecosystem audit, unchanged architecturally at HEAD.

## Appendix E — Plugin lifecycle hooks inventory (the 7 hook-bearing modules)

Discovered via `PluginLoader.get_hooks` (`loader.py:430-447`, auto-detected `hooks.py` next to the manifest; explicit `hooks:` header also honored at `loader.py:291-304`). Invoked on install (activate) / deactivate / uninstall by the plugins API (`_run_plugin_hook`; E1 fix made deactivate actually call it).

| Module | hooks.py | activate(db) | uninstall(db) | Live? |
|---|---|---|---|---|
| ai_adaptive_learning | yes (43 lines) | creates learning_paths/mastery_records checkfirst | documented no-op (data kept) | **DEAD — no manifest, so the loader never discovers this hooks module** (§4 #3) |
| ai_teacher | yes | provisions service key + webhook-secret envelope + quota reservation | clears provisioning | live |
| biometric | yes | creates biometric tables checkfirst | no-op (punch data kept) | live |
| disaster_management | yes | creates drill tables checkfirst | no-op | live |
| incident_management | yes | creates escalation/workflow tables checkfirst | no-op | live |
| multi_branch | yes | creates chain tables checkfirst | no-op | live |
| white_label | yes | branding/theme defaults | no-op | live |

All other 35 modules have no hooks module — their tables are owned by the central Alembic chain (the `activate(db)` table-creation is a WP-style safety net for plugin-owned tables, idempotent via checkfirst).

**Lifecycle flow (install):** `POST /plugins/install` (`app/api/v1/plugins.py`) → `billing.install_plugin` (`billing.py:74-177`: published + coming-soon checks → existing-row policy (trial never resets) → depends_on active check → conflicts_with check → SchoolPlugin insert + policy stamp → install_count++ → `log_usage("install")`) → `_run_plugin_hook(slug, "activate")` (provisioning) → `_invalidate_plugin_cache(school_id)` → response `_sp_dict`. Uninstall is soft (`uninstalled_at` stamp, data preserved); deactivate is WP-style disable without uninstall stamp; both re-run the cache invalidation.
