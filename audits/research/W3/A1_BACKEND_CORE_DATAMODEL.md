# W3-A1 — Backend Core Runtime + Complete Data-Model Audit

Scope: `backend/app/__init__.py`, `backend/config.py`, `backend/extensions.py`, `backend/app/extensions.py`,
`backend/app/celery_app.py`, `backend/app/realtime.py`, `backend/wsgi.py`, `backend/Dockerfile`,
`backend/requirements.txt`, **all 66 files in `backend/app/models/`**, **all 22 files in `backend/app/utils/`**,
**all 21 files in `backend/app/tasks/`**. Read-only audit; no source file was modified.

Hard counts established by reading every file:

| Metric | Value | Evidence |
|---|---|---|
| Model files in `app/models/` | 66 | `backend/app/models/` (6,410 LOC) |
| Model classes carrying `__tablename__` | **196** | `grep -c __tablename__ app/models/*.py` |
| Distinct table names | **196** (no duplicate `__tablename__`) | computed set over all model files |
| Alias-only model files (0 tables) | 6 — `staff.py`, `hr.py`, `designer.py`, `analytics.py`, `communication.py`, `base.py` | see §4.1 |
| Model classes NOT referenced in `models/__init__.py` | 3 — `Expense`, `ExpenseCategory`, `InAppNotification` | §4.9 |
| Tables declared outside `app/models/` | 0 | `grep __tablename__` over `app/` excluding `app/models/` |
| Alembic revisions | 58 | `backend/migrations/versions/` |
| Utils modules | 22 (2,265 LOC) | `backend/app/utils/` |
| Celery task modules | 21 (3,106 LOC) | `backend/app/tasks/` |
| Distinct Celery task names | 39 (`@celery.task`) + 2 (`@shared_task`) = **41** | §7 |
| Beat-scheduled entries | 14 | `backend/app/__init__.py:300-363` |

---

## 1. App factory & request lifecycle

### 1.1 Entry points

| Entry | File:line | Notes |
|---|---|---|
| WSGI (gunicorn) | `backend/wsgi.py:6` | `create_app(os.getenv("FLASK_ENV","development"))` |
| Celery worker/beat | `backend/app/celery_app.py:7-14` | creates a **second** app instance and **pushes a permanent app context** (`:8`) |
| Container CMD | `backend/Dockerfile:26` | `gunicorn --worker-class eventlet -w 4 wsgi:app` |
| Extensions singleton | `backend/extensions.py:13-21` | `db, migrate, jwt, cors, limiter, cache, socketio, celery, redis_client` |
| Alias shim | `backend/app/extensions.py:3` | re-exports `extensions` for plan-named imports; **binds `redis_client` at import time** (see P1-13) |

### 1.2 Blueprint registration table

Two root blueprints are registered in the factory; everything else nests under `api_v1_bp` or is mounted by the plugin loader.

| Blueprint | Effective URL prefix | Registered at | Source module |
|---|---|---|---|
| `api_v1_bp` | `/api/v1` | `app/__init__.py:523` | `app/api/v1/__init__.py:4` |
| `webhooks_bp` | `/webhooks` | `app/__init__.py:528` | `app/api/webhooks/__init__.py` (896 LOC) |
| `auth_bp` | `/api/v1` + bp prefix | `app/api/v1/__init__.py:69` | `app/api/v1/auth.py` |
| `schools_bp` | `/api/v1/...` | `:70` | `app/api/v1/schools.py` |
| `super_admin_bp` | `/api/v1/...` | `:71` | `app/api/v1/super_admin.py` |
| `users_bp` | `/api/v1/...` | `:72` | `app/api/v1/users.py` |
| `students_bp` | `/api/v1/...` | `:73` | `app/api/v1/students.py` |
| `staff_bp` | `/api/v1/...` | `:74` | `app/api/v1/staff.py` |
| `plugins_bp` | `/api/v1/...` | `:75` | `app/api/v1/plugins.py` |
| `academics_bp` | `/api/v1/...` | `:76` | `app/api/v1/academics.py` |
| `analytics_bp` | `/api/v1/...` | `:77` | `app/api/v1/analytics.py` |
| `mobile_bp` | `/api/v1/...` | `:78` | `app/api/v1/mobile.py` |
| `parent_app_bp` | `/api/v1/...` | `:79` | `app/api/v1/parent_app.py` |
| `student_app_bp` | `/api/v1/...` | `:80` | `app/api/v1/student_app.py` |
| `teacher_bp` | `/api/v1/...` | `:81` | `app/api/v1/teacher.py` |
| `sse_bp` | `/api/v1/...` | `:82` | `app/api/v1/sse.py` |
| `webhooks_v1_bp` | `/api/v1/webhooks` | `:83` | `app/api/v1/webhooks.py` |
| `search_bp` | `/api/v1/...` | `:87` | `app/api/v1/search.py` |
| `files_bp` … `design_studio_bp` (8) | `/api/v1/...` | `:98-105` | files, iemis_importer, communications, sliders, themes, elibrary, benchmarking, design_studio |
| `ai_usage_bp` | `/api/v1/...` | `:113` | `app/api/v1/ai_usage.py` |
| `notifications_bp` | `/api/v1/...` | `:117` | `app/api/v1/notifications.py` |
| `faqs_bp` | `/api/v1/...` | `:121` | `app/api/v1/faqs.py` |
| `db_backup_api_bp` | `/api/v1/...` | `:125` | `app/api/v1/db_backup_api.py` |
| `hostel_bp` | `/api/v1/...` | `:129` | `app/api/v1/hostel.py` |
| `white_label_bp` | `/api/v1/...` | `:134` | shim → `app/plugins/modules/white_label/routes.py` |
| `multi_branch_bp` | `/api/v1/...` | `:139` | shim → `app/plugins/modules/multi_branch/routes.py` |
| `biometric_bp` | `/api/v1/...` | `:145` | shim → `app/plugins/modules/biometric/routes.py` |
| `adaptive_learning_bp` | `/api/v1/...` | `:152` | shim → `app/plugins/modules/ai_adaptive_learning/routes.py` |
| `disaster_management_bp` | `/api/v1/emergency` | `:164` | shim → `.../disaster_management/routes.py` |
| `incident_management_bp` | `/api/v1/...` | `:170` | shim → `.../incident_management/routes.py` |
| `workbench_bp` | `/api/v1/...` | `:175` | `app/api/v1/ai_workbench.py` |
| `tutor_bp` | `/api/v1/...` | `:179` | `app/api/v1/ai_tutor.py` |
| `capture_bp` | `/api/v1/...` | `:183` | `app/api/v1/ai_capture.py` |
| `extensions_bp` | `/api/v1/...` | `:187` | `app/api/v1/ai_extensions.py` |
| `teaching_content_bp` | `/api/v1/...` | `:194` | `app/api/v1/teaching_content.py` |
| **all remaining plugin blueprints** | `/api/v1{bp.url_prefix}` | `app/plugins/loader.py:349-351` | dynamic; skipped when path ∈ `STATICALLY_MOUNTED_MODULES` (`app/api/v1/__init__.py:9-50`) |

Double-registration guard: the loader treats only `STATICALLY_MOUNTED_MODULES` as already-mounted
(`app/plugins/loader.py:319-326`). Blueprint import failures are swallowed at `ImportError`
(`loader.py:362-363`) — a plugin whose module raises `ImportError` transitively is silently absent
with only a `logger.debug` line (P1-09).

### 1.3 Middleware order (registration order, and the order they actually run)

`before_request` handlers run in registration order; `after_request` handlers run in **reverse**
registration order.

| # | Hook | File:line | Purpose |
|---|---|---|---|
| B1 | `_assign_request_id` (`before_request`) | `app/__init__.py:53-58` | **production only** — `g.request_id`, `g._req_start` |
| B2 | `resolve_school` (`before_request`) | `app/__init__.py:374-483` | tenancy + JWT user resolution |
| B3 | `csrf_protect_cookie_auth` (`before_request`) | `app/__init__.py:586-647` | cookie-auth CSRF guard |
| A1 | `normalize_preflight_response` (`after_request`) | `app/__init__.py:232-243` | rewrites flask-cors 200 preflight → 204; deliberately registered **before** `cors.init_app` so it runs *after* CORS headers are attached (`:226-231`) |
| A2 | flask-cors `after_request` | `app/__init__.py:245-258` | attaches `Access-Control-*` |
| A3 | `_log_request` (`after_request`) | `app/__init__.py:60-80` | production JSON access log + `X-Request-ID` echo |
| A4 | `set_security_headers` (`after_request`) | `app/__init__.py:738-766` | nosniff, DENY, HSTS, CSP `default-src 'none'`, `Cache-Control: no-store` on 3xx |
| WSGI | `ProxyFix(x_for=1, x_proto=1, x_host=1)` | `app/__init__.py:107-109` | one trusted proxy hop |

Ordering hazard: `_assign_request_id` is registered inside `_setup_logging` which returns early for
non-production (`app/__init__.py:27-28`), so in dev/test `g.request_id` never exists — anything reading it
must use `getattr` (the log handler does, `:68`).

### 1.4 `resolve_school` semantics and failure modes

Defined `app/__init__.py:374-483`; context setter `_set_school_context` at `:485-518`.

Resolution order:
1. `g.*` reset to `None`/`[]` (`:376-382`).
2. `_resolve_jwt_user()` (`:386-421`) — `verify_jwt_in_request(optional=True)`, reads `sub`/`role`,
   loads `User` with `is_deleted=False` (`:409-412`). **Runs for every request**, including public ones.
3. Subdomain: `host.endswith(base) and host != base and host != f"www.{base}"` → `slug = host.replace(f".{base}","")`
   → `School.query.filter_by(slug=slug, is_active=True)` (`:445-456`).
4. `X-School-Slug` header (mobile) → same lookup (`:457-466`).
5. JWT `school_id` claim fallback (localhost/dev) (`:468-483`).

Cross-tenant guard `_cross_tenant_response` (`:423-442`): returns 403 when an authenticated non-superadmin
user's `school_id` differs from the resolved school. Unauthenticated requests pass (public site/login).

Failure modes found:

| # | Failure mode | Evidence | Consequence |
|---|---|---|---|
| RS-1 | `School.query.filter_by(slug=…, is_active=True)` does **not** filter `is_deleted` | `app/__init__.py:449,460,474` | a soft-deleted but still `is_active=True` school keeps resolving and serving requests |
| RS-2 | Every request issues **≥2 queries** before routing (User + School) and a third on cache miss (SchoolPlugin) | `:409`, `:449`, `:506` | fixed per-request DB cost on unauthenticated/public endpoints too |
| RS-3 | Both `except` blocks are bare `except Exception` with `db.session.rollback()` | `:416-419`, `:480-483` | a genuine DB outage is indistinguishable from "no token"; the request proceeds with `g.school_id=None` and endpoints 400 instead of 503 |
| RS-4 | Nested-subdomain slug derivation is naive: `host.replace(f".{base}","")` on `a.b.base` yields slug `a.b` | `:448` | mis-resolution rather than rejection; harmless only because no such slug exists |
| RS-5 | Plugin list cached 300 s under `school:{id}:plugins` with only 3 invalidation sites (`tasks/trial_expiry.py:57`, `plugins/billing.py:281`, `plugins/entitlements.py:358`) | `:488-517` | a plugin install/uninstall through any other path stays stale up to 5 min |
| RS-6 | `g.current_user` is loaded but `is_active` is **not** checked here (unlike the socket path, `realtime.py:78`) | `:409-412` vs `realtime.py:78` | a deactivated-but-not-deleted user still gets a populated `g.current_user`; endpoint-level checks must catch it |
| RS-7 | `_cross_tenant_response` is skipped entirely when resolution falls through all three branches | `:468-483` | request continues with `school_id=None`; correctness depends on `@school_required` discipline |

### 1.5 CORS / CSRF posture

CORS (`app/__init__.py:180-258`): explicit origin list + anchored regex
`^https://[^./]+\.{base}$` (`:189` — the anchoring is the S-02 fix; a non-anchored pattern would
match `https://demo.base.attacker.example`). `supports_credentials=True`, allowed headers include
`X-School-Slug`, `max_age=600`. Extra origins from `CORS_ALLOW_ORIGINS` / legacy `CORS_EXTRA_ORIGINS`
(`:218-225`). Nine `localhost` + nine `127.0.0.1` dev ports are **hardcoded and unconditional** — they are
present in production too (`:196-213`) (P2-05).

Socket.IO origins are a **separate, narrower** list (`:263-268`): only ports 3000/3001/8080/8090/8091 —
Flutter web dev ports 8092-8095 are allowed for HTTP but **not** for websockets (P2-06).

CSRF (`:586-647`): applies only when (a) method mutates, (b) path not under `/webhooks/`, (c) no
`Authorization` header, (d) an `access_token`/`refresh_token` cookie is present. Exempt paths:
`/auth/login`, `/verify-otp`, `/student-login`, `/send-otp`, `/register`, `/refresh`, `/logout` (`:604-615`).
Accepts `Sec-Fetch-Site: same-origin` before host comparison (`:623-624` — required because the Next.js
proxy rewrites `Host`). Otherwise the Origin/Referer host must equal `request.host`, equal `BASE_DOMAIN`,
be a `BASE_DOMAIN` subdomain, or match the CORS list/regex (`:636-644`). `JWT_COOKIE_CSRF_PROTECT=False`
(`config.py:86`) — the hand-rolled guard is the only CSRF control for cookie sessions.

### 1.6 Error handlers

| Handler | File:line | Response |
|---|---|---|
| 400 | `app/__init__.py:650-652` | `{"success":false,"error":str(e)}` — **leaks the raw werkzeug description** |
| 401 / 403 / 404 / 422 / 429 | `:654-672` | fixed strings |
| `QuotaExceededError` | `:681-691` | 429 + `quota{reason,used,limit}` |
| `AIProviderError` | `:695-704` | 502 |
| 500 | `:706-708` | `"Internal server error"` |

No handler for `Exception`, `SchoolIsolationError` (`app/models/base.py:78`), or
`VirusDetectedError` (`app/utils/file_upload.py:49`) — an unhandled `SchoolIsolationError` surfaces as a
generic 500 with no diagnostic (P2-01).

`/health` (`:711-713`) is unauthenticated and trivial; `/ready` (`:716-735`) probes DB + Redis and
returns 503 when degraded. `/uploads/<path:filepath>` (`:772-803`) enforces visibility from the
`ManagedFile` row, and for untracked files requires the first path segment to be a school id the
requester belongs to (`:786-798`).

### 1.7 Startup-wired seeds and side effects (everything executed at boot)

| Order | Call | File:line | What it writes |
|---|---|---|---|
| 1 | `ProductionConfig.validate()` (production only) | `app/__init__.py:92-94` → `config.py:269-348` | nothing; **raises RuntimeError** on bad secrets, missing `DATABASE_URL`, missing `ISR_REVALIDATE_SECRET`, Stripe key w/o webhook secret, `FILE_STORAGE_BACKEND=r2` w/o R2 vars, WhatsApp token w/o app secret, missing/placeholder `SPARROW_SMS_TOKEN` |
| 2 | `_setup_logging(app)` | `:97` | replaces root handlers (production), registers B1/A3 |
| 3 | `sentry_sdk.init` | `:120-130` | network only, `traces_sample_rate=0.1` |
| 4 | `db/migrate/jwt/cors/limiter/cache/init_redis/socketio` init | `:138-281` | `init_redis` sets the module global `extensions.redis_client` (`extensions.py:24-28`) |
| 5 | `celery.conf.update(...)` | `:284-364` | in-process config: `task_routes {"*": "default"}`, `task_acks_late=True`, time limits 1800/1500, `prefetch=1`, 14 beat entries |
| 6 | `PluginLoader.discover_and_register(app)` | `:533` → `loader.py:311-326` | scans manifests, mounts blueprints, logs broken manifest pointers at ERROR (`loader.py:230-236`) |
| 7 | `PluginLoader.refresh_registry()` | `:540-544` → `loader.py:441-523` | **WRITES `plugins` table**: inserts missing rows, additively syncs name/desc/category/price/version/emoji/icon/depends_on/conflicts_with/api_blueprint, unpublishes orphans (`is_published=False`). Two commits (`loader.py:502`, `:514`) |
| 8 | `seed_workbench_tools()` | `:550-553` → `services/ai/workbench_seed.py:503-553` | **WRITES `ai_tool_registry` + `ai_nutrition_facts`**; also creates prompt files on disk (`_ensure_prompt_files`, `:557`) |
| 9 | `seed_curriculum()` | `:556-560` → `services/ai/curriculum_seed.py:52-119` | **WRITES `curriculum_frameworks`, `curriculum_units`, `subject_offerings`** (CDC grades 1-10 + NEB 11-12), `school_id NULL` |
| 10 | `seed_pd_framework()` | `:563-567` → `services/ai/extensions.py:40-74` | **WRITES `document_chunks`** (PD framework text) |
| 11 | `register_audit_listeners()` | `:572-574` → `utils/audit_trail.py:220-231` | attaches `before_flush` + per-column `set` listeners |
| 12 | `from app.plugins import listeners` | `:577` | registers `@on()` handlers (1,022 LOC) |
| 13 | `from app import realtime` | `:580` | registers socket handlers |

Consequences: **four DB-writing seeds run on every process start** — that is every gunicorn worker
(4 per container, `Dockerfile:26`) plus the Celery worker and beat (`celery_app.py:7`), i.e. ~6 concurrent
seeders per deploy. They are idempotent by SELECT-then-INSERT, which is a race, not a guarantee
(P1-02). Each is wrapped in `try/except` logging to `app.logger.error`, so a failed seed is a log line,
not a boot failure (`:543`, `:554`, `:561`, `:568`).

### 1.8 Socket.IO (`backend/app/realtime.py`)

Handshake auth at `realtime.py:53-100`: token from auth payload → `Authorization: Bearer` → `access_token`
cookie (`:40-50`); rejects on missing/undecodable token, missing/deleted user, `not user.is_active`,
or `iat < user.tokens_invalid_before` (`:78-87`). Per-connection state lives in the **process-local dict**
`_sessions` (`:33`) because Flask 3.1 made `RequestContext.session` read-only (`app/__init__.py:272-276`,
`manage_session=False`).

`join_school` (`:103-131`) ignores the client-supplied `school_id` for non-superadmins and joins
`school-{session_school}`; superadmins may target any existing school. `leave_school` mirrors it (`:134-153`).

Defect: `_sessions` is per-worker. With `-w 4` eventlet workers plus the Redis `message_queue`
(`app/__init__.py:279-280`), a reconnect landing on a different worker has no session state, so
`join_school` returns `{"success": false, "error": "Not authorized"}` even though the handshake
succeeded on that worker — it only works because `connect` and later events share a connection.
Celery GPS workers publish via the same queue (`tasks/gps_processing.py:24-31`), which is correct.

---

## 2. Complete table catalog — 196 tables

**Legend.** `SM` = inherits `SchoolModel` (`app/models/base.py:46-75`): UUID PK
(`gen_random_uuid()` server default), `created_at`/`updated_at` `TIMESTAMPTZ NOT NULL` server-defaulted,
`is_deleted BOOLEAN NOT NULL DEFAULT false`, **`school_id UUID NOT NULL FK schools.id`, indexed**.
`BM` = inherits `BaseModel` (`base.py:10-43`): same PK/timestamps/soft-delete, **no** `school_id` unless
listed. `RAW` = declares its own columns on `db.Model` (no BaseModel) — flagged individually.
Unless a row says otherwise: PK = UUID, soft-delete = yes, timestamps = TIMESTAMPTZ.

### 2.1 Academic core

| Table | Class | file:line | Domain | Tenancy | Notable constraints / indexes | JSON/ARRAY to normalize |
|---|---|---|---|---|---|---|
| `academic_years` | AcademicYear | `models/academic.py:20` | academics | SM | none (no UQ on `school_id,name`) | — |
| `semesters` | Semester | `academic.py:32` | academics | SM | FK academic_years | — |
| `mediums` | Medium | `academic.py:48` | academics | SM | none | — |
| `streams` | Stream | `academic.py:57` | academics | SM | none | `class_ids ARRAY(UUID)` `:63` |
| `shifts` | Shift | `academic.py:68` | academics | SM | none | — |
| `classes` | Class | `academic.py:78` | academics | SM | FKs academic_years/mediums/streams | — |
| `sections` | Section | `academic.py:95` | academics | SM | FK classes NOT NULL, `class_teacher_id`→users | — |
| `subjects` | Subject | `academic.py:111` | academics | SM | none | `class_ids`, `teacher_ids` ARRAY(UUID) `:118-119` |
| `students` | Student | `models/student.py:27` | students | SM | FKs classes/sections/academic_years/semesters/streams/shifts/mediums/bus_stops/admission_applications; **no UQ on `student_id` or `admission_number`** | `address` JSONB `:47`; `strengths`,`weaknesses` ARRAY(Text) `:113-114`; `embedding` Vector(1536) **conditional on pgvector import** `:115` |
| `guardians` | Guardian | `student.py:198` | students | SM | FK students NOT NULL; no UQ on (student, relation, is_primary) | `address` JSONB `:211` |
| `student_transfers` | StudentTransfer | `models/student_transfer.py:14` | students | SM | FK students indexed | — |
| `users` | User | `models/user.py:23` | identity | BM + **`school_id` NULLABLE** `:25` | `role` Enum `user_role` (7 values); **no unique on email or phone** | `address`, `permissions` JSONB `:50,:77` (holds `totp_secret`); `fcm_tokens`, `onesignal_player_ids` ARRAY(Text) `:68,:71` |
| `schools` | School | `models/school.py:24` | platform | BM (tenant root) | `slug` unique `:29` | 9 config JSONBs `:111-119` (`settings`, `website_config`, `ai_config`, `fee_config`, `exam_config`, `notification_config`, `social_ai_config`, `gamification_config`, `admission_config`); `working_days ARRAY(String)` `:127` |
| `school_websites` | SchoolWebsite | `school.py:196` | website | BM + `school_id` NOT NULL FK `:198` | none | `customizations`, `draft_config` JSONB `:202,:204`; `active_theme_version_id` UUID **no FK** `:203` |
| `scheme_grades` | SchemeGrade | `school.py:218` | exams | BM + `school_id` NOT NULL FK | none | `ranges` JSONB `:227` |
| `school_receipt_counters` | SchoolReceiptCounter | `school.py:240` | fees | BM + `school_id` NOT NULL FK | UQ(`school_id`,`fiscal_year_bs`) `:249` | — |
| `school_chains` | SchoolChain | `models/school_chain.py:27` | multi_branch | SM (= chain owner) | partial UQ(`school_id`) where `is_deleted=false` `:43-48` | — |
| `school_chain_members` | SchoolChainMember | `school_chain.py:64` | multi_branch | SM (= branch) | partial UQ(`school_id`), partial UQ(`chain_id`,`code`) `:85-98` | — |

### 2.2 Attendance, exams, marks

| Table | Class | file:line | Domain | Tenancy | Notable constraints / indexes | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `attendance` | Attendance | `models/attendance.py:10` | attendance | SM | **UQ(`school_id`,`student_id`,`date`)** `:12-15` (not partial — soft-deleted rows block re-insert) | — |
| `teacher_attendance` | TeacherAttendance | `attendance.py:39` | attendance | SM | UQ(`school_id`,`user_id`,`date`) `:41-44` | — |
| `leave_requests` | LeaveRequest | `attendance.py:62` | hr | SM | none | — |
| `exams` | Exam | `models/exam.py:24` | exams | SM | Enums `exam_type`,`exam_status` | `class_ids`,`subject_ids` ARRAY(UUID) `:45-46` |
| `marks` | Marks | `exam.py:83` | exams | SM | **partial unique Index** (`school_id`,`exam_id`,`student_id`,`subject_id`) where `is_deleted=false` `:97-102` | — |
| `report_cards` | ReportCard | `exam.py:135` | exams | SM | **no UQ on (school,student,exam)** despite upsert-by-filter in `tasks/report_generation.py:142-147` | — |
| `online_exams` | OnlineExam | `exam.py:169` | exams | SM | none | `questions` JSONB `:179` |
| `online_exam_attempts` | OnlineExamAttempt | `exam.py:194` | exams | SM | **no UQ(exam,student)** | `answers` JSONB `:198` |
| `question_bank_items` | QuestionBankItem | `models/question_bank.py:17` | ai_suite | SM | Enums `question_bank_type`,`question_difficulty`,`question_source` | `options`, `ai_metadata` JSONB `:38,:43` |
| `paper_blueprints` | PaperBlueprint | `question_bank.py:74` | ai_suite | SM | none | `sections` JSONB `:83` |
| `generated_papers` | GeneratedPaper | `question_bank.py:105` | ai_suite | SM | none | `questions` JSONB `:120` — embeds question text + `bank_item_id` + `correct_answer` |

### 2.3 Money (fees, payroll, expenses)

| Table | Class | file:line | Domain | Tenancy | Notable constraints / indexes | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `fee_types` | FeeType | `models/fee.py:23` | fees | SM | none | — |
| `fee_structures` | FeeStructure | `fee.py:31` | fees | SM | none | **`fee_items` JSONB `:35` — superseded by `fee_structure_items` but still the only path in use** |
| `fee_collections` | FeeCollection | `fee.py:43` | fees | SM | Enums `payment_method` (incl. `qr_pay` `:63`), `payment_status` (incl. `refunded` `:79`); **no UQ; idempotency lives in `notes` substrings** | — |
| `fee_receipts` | FeeReceipt | `fee.py:95` | fees | SM | partial unique Index (`school_id`,`receipt_number`) where `is_deleted=false` `:120-125`; `idempotency_key` unique `:109` | — |
| `fee_refunds` | FeeRefund | `fee.py:135` | fees | SM | Enum `refund_status` | — |
| `payment_initiations` | PaymentInitiation | `fee.py:172` | fees | SM | `gateway_ref` indexed, **not unique** `:178` | — |
| `student_scholarships` | StudentScholarship | `fee.py:195` | fees | SM | none | — |
| `class_subjects` | ClassSubject | `models/money.py:23` | academics (D-06) | SM | UQ(`school_id`,`class_id`,`subject_id`,`academic_year_id`) `:42-45` | — |
| `section_subject_teachers` | SectionSubjectTeacher | `money.py:50` | academics (D-06) | SM | UQ(`school_id`,`section_id`,`class_subject_id`,`teacher_id`) `:64-67` | — |
| `fee_structure_items` | FeeStructureItem | `money.py:74` | fees (D-06) | SM | UQ(`school_id`,`fee_structure_id`,`name`) `:97-100` | — |
| `staff_payroll` | StaffPayroll | `models/hr_payroll.py:10` | hr_payroll | SM | **no UQ(`school_id`,`user_id`,`month`)** despite exists-check in `tasks/payroll_monthly.py:82-88` | `allowances`, `deductions` JSONB `:15-16` |
| `staff_leaves` | StaffLeave | `hr_payroll.py:31` | hr_payroll | SM | none | — |
| `staff_appraisals` | StaffAppraisal | `hr_payroll.py:49` | hr_payroll | SM | none | `scores`, `goals` JSONB `:54,:58` |
| `expense_categories` | ExpenseCategory | `hr_payroll.py:66` | hr_payroll | SM | none — **class absent from `models/__init__.py`** | — |
| `expenses` | Expense | `hr_payroll.py:73` | hr_payroll | SM | FK expense_categories NOT NULL — **class absent from `models/__init__.py`** | — |

### 2.4 Plugins, platform, files, system

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `plugins` | Plugin | `models/plugin.py:26` | platform | BM, **no school_id** (`:76` comment) | `slug` unique `:28`; Enum `plugin_category` | `frontend_sidebar_config` JSONB `:52`; `depends_on`,`conflicts_with`,`visible_to_roles`,`screenshots`,`tags` ARRAY `:55-67` |
| `school_plugins` | SchoolPlugin | `plugin.py:82` | platform | BM + `school_id` NOT NULL | **UQ(`school_id`,`plugin_slug`) — not partial, so a soft-deleted install blocks reinstall** `:83`; FK `plugin_slug`→`plugins.slug` `:88-90` | `config` JSONB `:107` |
| `plugin_usage_logs` | PluginUsageLog | `plugin.py:117` | platform | BM + `school_id` NOT NULL | none | — |
| `file_folders` | FileFolder | `models/file.py:12` | files | SM | self-FK `parent_id` ON DELETE CASCADE `:15-19`; **no UQ(school,parent,name)** | — |
| `managed_files` | ManagedFile | `file.py:46` | files | SM | FK file_folders ON DELETE SET NULL `:61-66`; Enums `managed_file_type`,`file_visibility`; **`key` not unique** `:52` | `tags` JSONB `:73`; `linked_entity_id` UUID **no FK** `:77` |
| `revoked_tokens` | RevokedToken | `models/revoked_token.py:21` | auth | BM, **no school_id** | `jti` unique `:23`; Index on `expires_at` `:32`; **`expires_at` is naive `DateTime` by design** `:29` |— |
| `processed_webhook_events` | ProcessedWebhookEvent | `models/webhook.py:16` | payments | BM + `school_id` NULLABLE `:20` | UQ(`provider`,`event_id`) `:23-25` | — |
| `system_settings` | SystemSetting | `models/system.py:13` | platform | BM, **no school_id** | `key` unique `:15` | `value` JSONB `:16` |
| `audit_logs` | AuditLog | `models/compliance.py:39` | compliance | BM + `school_id` **NULLABLE** `:41` (deliberate, D-07) | none; no index on `(resource_type,resource_id)` | `old_values`,`new_values` JSONB `:46-47` |
| `compliance_reports` | ComplianceReport | `compliance.py:10` | compliance | SM | none | `data` JSONB `:14` |
| `emis_exports` | EMISExport | `compliance.py:24` | compliance | SM | none | `export_data` JSONB `:27` |
| `iemis_import_logs` | IemisImportLog | `models/iemis.py:11` | iemis | SM | Enum `iemis_import_status`; `imported_by` UUID **no FK** `:13` | `errors`,`summary` JSONB `:25-26` |
| `contact_messages` | ContactMessage | `models/contact.py:12` | website | SM | `is_read` indexed `:21` | — |
| `faqs` | FAQ | `models/faq.py:9` | website | **RAW** `db.Model` — hand-rolled `id`/`is_deleted`/`created_at`/`updated_at`; `school_id` NOT NULL FK ON DELETE CASCADE `:12` | none | — |

### 2.5 Communication, notices, chat

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `notices` | Notice | `models/notice.py:21` | notices | SM | Enum `notice_type` | `target_audience`,`target_class_ids`,`attachment_urls` ARRAY `:31-33` |
| `events` | Event | `notice.py:45` | notices | SM | none | — |
| `sms_logs` | SMSLog | `models/notification.py:19` | communications | SM | Enum `sms_status` | — |
| `whatsapp_messages` | WhatsAppMessage | `notification.py:39` | communications | SM | Enums `wa_direction`,`wa_status`; **`wa_message_id` not unique** `:52` | `template_params` JSONB `:51` |
| `push_notifications` | PushNotification | `notification.py:64` | communications | SM | Enum `push_status` | `data` JSONB `:69` |
| `notification_templates` | NotificationTemplate | `notification.py:80` | communications | SM | **no UQ(school,name,channel)** | `variables` JSONB `:86` |
| `whatsapp_bot_configs` | WhatsAppBotConfig | `notification.py:91` | communications | SM | **no UQ(school_id)** for a singleton-per-school config | `auto_replies`,`notification_types` JSONB `:95-96` |
| `in_app_notifications` | InAppNotification | `notification.py:107` | communications | SM | `is_read` indexed `:118`; Enum `notification_priority` — **class absent from `models/__init__.py`** | `data` JSONB `:117` |
| `chat_threads` | ChatThread | `models/chat.py:10` | chat | SM | UQ(`school_id`,`participant_a_id`,`participant_b_id`) `:12-17` — **order-sensitive: (A,B) and (B,A) both insertable** | — |
| `chat_messages` | ChatMessage | `chat.py:30` | chat | SM | `thread_id` indexed | — |
| `diary_categories` | DiaryCategory | `models/diary.py:10` | diary | SM | none | — |
| `diary_entries` | DiaryEntry | `diary.py:18` | diary | SM | none | `attachment_urls` ARRAY(Text) `:27` |
| `school_sliders` | SchoolSlider | `models/slider.py:8` | website | SM | none | — |

### 2.6 LMS, assignments, digital content, library

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `courses` | Course | `models/lms.py:21` | lms | SM | two user FKs (`teacher_id` NOT NULL, `instructor_id`) `:27-28` | — |
| `lessons` | Lesson | `lms.py:41` | lms | SM | Enum `lesson_type`; **duplicate columns `duration_mins` + `duration_minutes`** `:49-50` | `resources` JSONB `:55` |
| `topics` | Topic | `lms.py:64` | lms | SM | FK lessons NOT NULL | — |
| `study_materials` | StudyMaterial | `lms.py:77` | lms | SM | none | — |
| `live_classes` | LiveClass | `lms.py:94` | lms | SM | Enum `live_class_status` | — |
| `student_progress` | StudentProgress | `lms.py:116` | lms | SM | **no UQ(student,course,lesson)** | — |
| `quizzes` | Quiz | `lms.py:134` | lms | SM | none | `questions` JSONB `:138` |
| `quiz_attempts` | QuizAttempt | `lms.py:149` | lms | SM | **`student_id` FKs `users.id`, not `students.id`** `:152` | `answers` JSONB `:153` |
| `enrollments` | Enrollment | `lms.py:163` | lms | SM | **`student_id`→`users.id`** `:166`; no UQ(course,student) | `completed_lessons` JSONB (list of ids) `:168` |
| `assignments` | Assignment | `models/assignment.py:21` | assignments | SM | none | `attachment_urls` ARRAY(Text) `:31` |
| `assignment_submissions` | AssignmentSubmission | `assignment.py:42` | assignments | SM | Enum `submission_status`; **no UQ(assignment,student)** | `attachment_urls` ARRAY(Text) `:51` |
| `digital_books` | DigitalBook | `models/digital_content.py:18` | elibrary | SM | none | — |
| `past_papers` | PastPaper | `digital_content.py:36` | elibrary | SM | none | — |
| `oer_resources` | OERResource | `digital_content.py:52` | elibrary | SM | none | `tags` ARRAY(String) `:60` |
| `books` | Book | `models/library.py:21` | library | SM | **`isbn` and `barcode` not unique** `:25,:32` | — |
| `book_transactions` | BookTransaction | `library.py:37` | library | SM | Enum `book_tx_status` — **table is dead, 0 references outside `app/models/`** | — |
| `book_issues` | BookIssue | `library.py:58` | library | SM | Enum `book_issue_status`; both `student_id` and `user_id` FKs `:61-62` | — |

### 2.7 Operations (transport, hostel, inventory, visitors, dismissal)

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `routes` | Route | `models/transport.py:22` | transport | SM | none | — |
| `buses` | Bus | `transport.py:32` | transport | SM | **`gps_device_id` not unique** `:39` although it is the ingest lookup key (`tasks/gps_processing.py:75`) | — |
| `bus_stops` | BusStop | `transport.py:53` | transport | SM | none | `student_ids` ARRAY(UUID) `:63` |
| `gps_logs` | GPSLog | `transport.py:69` | transport | SM | **no index on (`bus_id`,`timestamp`)** although `MAX(timestamp)` per bus runs every 15 s (`tasks/gps_firebase_poller.py:107-111`) | — |
| `hostels` | Hostel | `models/hostel.py:10` | hostel | **RAW** `db.Model`; `school_id` NOT NULL FK CASCADE `:13`; **`updated_at` MISSING**, `created_at` uses Python-side default `:22` | none | — |
| `hostel_rooms` | HostelRoom | `hostel.py:29` | hostel | RAW, same shape `:32-41`; no `updated_at` | **no UQ(hostel_id,room_number)** | — |
| `hostel_allocations` | HostelAllocation | `hostel.py:56` | hostel | RAW `:59-67`; no `updated_at` | none; `student` relationship is **`lazy="joined"`** `:69` | — |
| `assets` | Asset | `models/inventory.py:10` | inventory | SM | **`asset_code` unique GLOBALLY, not per school** `:13` — cross-tenant collision | — |
| `procurement_requests` | ProcurementRequest | `inventory.py:31` | inventory | SM | none | `items` JSONB `:34` |
| `asset_audit_logs` | AssetAuditLog | `inventory.py:50` | inventory | SM | none | `old_value`,`new_value` JSONB `:55-56` |
| `visitors` | Visitor | `models/visitor.py:10` | visitor | SM | none | — |
| `visitor_appointments` | VisitorAppointment | `visitor.py:30` | visitor | SM | none | — |
| `authorized_pickups` | AuthorizedPickup | `models/dismissal.py:10` | dismissal | SM | none | — |
| `dismissal_records` | DismissalRecord | `dismissal.py:28` | dismissal | SM | none | — |
| `biometric_devices` | BiometricDevice | `models/biometric.py:36` | biometric | SM | UQ(`school_id`,`serial_number`) `:38`; `api_key_hash` indexed `:50` | — |
| `biometric_punches` | BiometricPunch | `biometric.py:90` | biometric | SM | partial UQ(`device_id`,`device_punch_id`) where not null `:93-97`; UQ(`device_id`,`device_user_id`,`punched_at`) `:98`; Index(`school_id`,`status`) `:99` | `raw` JSONB `:116` |
| `biometric_sync_logs` | BiometricSyncLog | `biometric.py:139` | biometric | SM | FK devices ON DELETE SET NULL `:142` | `detail` JSONB `:153` |

### 2.8 Wellbeing, health, safety, incidents, emergency

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `mood_checkins` | MoodCheckin | `models/wellbeing.py:19` | wellbeing | SM | Enum `mood_type` — **dead, 0 refs outside models** | — |
| `wellbeing_surveys` | WellbeingSurvey | `wellbeing.py:35` | wellbeing | SM | none | `questions`,`target_class_ids` JSONB `:38-39` |
| `wellbeing_survey_responses` | WellbeingSurveyResponse | `wellbeing.py:48` | wellbeing | SM | none | `answers` JSONB `:54` |
| `counselor_sessions` | CounselorSession | `wellbeing.py:62` | wellbeing | SM | **Enum named `session_status`** `:76` — the name ai_workbench had to work around (`ai_workbench.py:199-203`); **dead, 0 refs** | — |
| `mood_entries` | MoodEntry | `wellbeing.py:84` | wellbeing | SM | none — **live replacement for `mood_checkins`** | — |
| `counselor_notes` | CounselorNote | `wellbeing.py:97` | wellbeing | SM | **`counselor` relationship declared TWICE** `:110-111` | — |
| `health_profiles` | HealthProfile | `models/health_records.py:18` | health_records | SM | **`student_id` UNIQUE globally** `:20-22` (not per school — harmless since students are tenant-scoped, but the constraint is wrong in shape) | `allergies`,`medical_conditions` ARRAY(Text) `:26-27`; `insurance_info` JSONB `:30` |
| `medical_visits` | MedicalVisit | `health_records.py:39` | health_records | SM | none | — |
| `immunizations` | Immunization | `health_records.py:57` | health_records | SM | none | — |
| `incidents` | Incident | `models/incident.py:19` | incidents | SM | Enums `incident_type`,`incident_severity`,`incident_status`; 3 user FKs `:42,:53,:56` | `involved_student_ids` ARRAY(UUID) `:43` |
| `witness_statements` | WitnessStatement | `incident.py:69` | incidents | SM | none | — |
| `incident_actions` | IncidentAction | `incident.py:83` | incidents | SM | none | — |
| `incident_escalations` | IncidentEscalation | `models/incident_management.py:31` | incident_management | SM | FK incidents indexed | — |
| `incident_workflow_events` | IncidentWorkflowEvent | `incident_management.py:57` | incident_management | SM | append-only by convention only | — |
| `emergency_alerts` | EmergencyAlert | `models/emergency.py:20` | emergency | SM | Enums `emergency_type`,`alert_status` | — |
| `evacuation_plans` | EvacuationPlan | `emergency.py:51` | emergency | SM | none | `assembly_points` JSONB `:56` |
| `emergency_headcounts` | EmergencyHeadcount | `emergency.py:63` | emergency | SM | none | `missing_student_ids` ARRAY(UUID) `:72` |
| `disaster_drills` | DisasterDrill | `models/disaster_management.py:34` | disaster_management | SM | status validated in the blueprint, **not the DB** `:45` | — |
| `drill_participations` | DrillParticipation | `disaster_management.py:59` | disaster_management | SM | none | `missing_student_ids` ARRAY(UUID) `:68` |

### 2.9 Engagement (gamification, portfolio, alumni, conferences, admission)

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `badges` | Badge | `models/gamification.py:19` | gamification | SM | none | `criteria` JSONB `:25` |
| `student_badges` | StudentBadge | `gamification.py:31` | gamification | SM | **no UQ(student,badge)** — a badge can be awarded twice | — |
| `points_logs` | PointsLog | `gamification.py:46` | gamification | SM | none | — |
| `houses` | House | `gamification.py:62` | gamification | SM | none | — |
| `rewards` | Reward | `gamification.py:75` | gamification | SM | none | — |
| `student_portfolios` | StudentPortfolio | `models/portfolio.py:10` | portfolio | SM | **no UQ(student_id)** for a 1:1 portfolio | `interests`,`skills` JSONB `:16-17` |
| `portfolio_items` | PortfolioItem | `portfolio.py:25` | portfolio | SM | none | `media_urls`,`tags` JSONB `:33-34` |
| `micro_credentials` | MicroCredential | `portfolio.py:40` | portfolio | SM | `verification_hash` **not unique** `:50` | — |
| `alumni` | Alumni | `models/alumni.py:10` | alumni | SM | none | — |
| `alumni_events` | AlumniEvent | `alumni.py:32` | alumni | SM | none | — |
| `alumni_donations` | AlumniDonation | `alumni.py:47` | alumni | SM | `transaction_ref` **not unique** `:54` — money table with no idempotency key | — |
| `pt_conferences` | PTConference | `models/conference.py:11` | conference | SM | none | — |
| `conference_slots` | ConferenceSlot | `conference.py:23` | conference | SM | **no UQ(teacher,start_time)** — double-booking possible | — |
| `conference_notes` | ConferenceNotes | `conference.py:45` | conference | SM | none | — |
| `admission_forms` | AdmissionForm | `models/admission.py:20` | admission | SM | none | `form_fields` JSONB `:25` |
| `admission_applications` | AdmissionApplication | `admission.py:36` | admission | SM | Enum `admission_status` (**no `archived` value** — see `tasks/admission_followup.py:59-63`) | `form_data`,`documents` JSONB `:55-56` |
| `admission_leads` | AdmissionLead | `admission.py:84` | admission | SM | Enum `lead_status` | — |
| `admission_inquiries` | AdmissionInquiry | `admission.py:105` | admission | SM | `status` is plain String `:113` and the follow-up task writes `"followed_up"` (`tasks/admission_followup.py:35`), a value the docstring's vocabulary does not list | — |
| `timetables` | Timetable | `models/timetable.py:17` | timetable | SM | none — **dead** (no class reference outside models) | — |
| `timetable_periods` | TimetablePeriod | `timetable.py:30` | timetable | SM | **dead** | — |
| `substitutions` | Substitution | `timetable.py:50` | timetable | SM | **dead** | — |
| `timetable_slots` | TimetableSlot | `timetable.py:73` | timetable | SM | **live** flat model; no UQ(class,section,day,period) | — |
| `website_pages` | WebsitePage | `models/website.py:10` | website | SM | **second school FK `school_id_override`** `:12-14`; no UQ(school,slug) | `content`,`sections` JSONB `:17-18` |
| `website_themes` | WebsiteTheme | `website.py:31` | website | SM (**should be platform-level**) | none | `config_schema`,`default_config` JSONB `:40-41` |
| `website_forms` | WebsiteForm | `website.py:46` | website | SM | none | `fields` JSONB `:50` |
| `website_form_submissions` | WebsiteFormSubmission | `website.py:56` | website | SM | none | `data` JSONB `:61` |
| `designer_templates` | DesignerTemplate | `models/designer_template.py:12` | design_studio | BM + **`school_id` NULLABLE and NOT a FK** `:17` | UQ(`school_id`,`template_key`) `:14` | `fields`,`canvas_json`,`writer_json`,`extra_config` JSONB `:30-33` |
| `designer_documents` | DesignerDocument | `models/designer_document.py:13` | design_studio | SM | `created_by_id` NOT NULL and **not a FK** `:15` | `canvas_state` JSONB `:18` |
| `designer_document_revisions` | DesignerDocumentRevision | `models/designer_document_revision.py:15` | design_studio | SM | `document_id` indexed, **not a FK** `:17`; FIFO cap of 10 enforced in service code only | `canvas_state` JSONB `:20` |

### 2.10 AI family (workbench, tokens, insights, RAG, adaptive)

| Table | Class | file:line | Domain | Tenancy | Notable constraints | JSON/ARRAY |
|---|---|---|---|---|---|---|
| `ai_generations` | AIGeneration | `models/ai_workbench.py:28` | ai_workbench | SM | `tool_key`,`user_id` indexed | `citations` JSONB `:45`; `meta` JSONB mapped as `ai_generation_meta` `:47` |
| `ai_nutrition_facts` | AINutritionFacts | `ai_workbench.py:54` | ai_workbench | **BM, platform-level** | `tool_key` unique `:56` | `data_accessed`,`data_not_accessed` JSONB `:59-60` |
| `ai_tool_registry` | AIToolRegistry | `ai_workbench.py:86` | ai_workbench | **BM, platform-level** | `tool_key` unique `:88` | `roles_allowed`,`trigger_phrases` JSONB `:95,:106` |
| `ai_tool_settings` | SchoolAIToolSettings | `ai_workbench.py:145` | ai_workbench | SM | UQ(`school_id`,`tool_key`) `:153` | `field_overrides` JSONB `:149` |
| `ai_content_library_items` | AIContentLibraryItem | `ai_workbench.py:160` | ai_workbench | SM | Enum `content_visibility` | `content`,`tags` JSONB `:164,:171` |
| `tutor_session_plans` | TutorSessionPlan | `ai_workbench.py:177` | ai_workbench | SM | Enums `tutor_focus`,`plan_status` | — |
| `tutor_sessions` | TutorSession | `ai_workbench.py:194` | ai_workbench | SM | Enum **`tutor_session_status`** (deliberately not `session_status`, `:199-203`); Index(`school_id`,`student_id`) `:210` | — |
| `tutor_messages` | TutorMessage | `ai_workbench.py:215` | ai_workbench | SM | Enum `tutor_msg_role` | — |
| `iep_plans` | IEPPlan | `ai_workbench.py:228` | ai_workbench | SM | Enum `iep_status`; `human_review_required` server_default true `:241` | `goals`,`accommodations` JSONB `:232-233` |
| `guardian_ai_consents` | GuardianAIConsent | `ai_workbench.py:247` | ai_workbench | SM | UQ(`student_id`,`guardian_user_id`,`scope`) `:257-258` | — |
| `moderation_flags` | ModerationFlag | `ai_workbench.py:266` | ai_workbench | SM | Enum `moderation_severity`; **`source_id` is a polymorphic UUID with no FK** `:269` | — |
| `ai_tool_analytics_daily` | AIToolAnalyticsDaily | `ai_workbench.py:282` | ai_workbench | SM | UQ(`school_id`,`day`,`tool_key`) `:293-294` | — |
| `student_ai_profiles` | StudentAIProfile | `ai_workbench.py:302` | ai_workbench | SM | UQ(`school_id`,`student_id`) `:309` — **dead, 0 refs outside models** | — |
| `ai_school_quotas` | AISchoolQuota | `models/ai_token.py:11` | ai (platform) | SM | **no UQ(school_id)** for a per-school singleton | — |
| `ai_usage_logs` | AIUsageLog | `ai_token.py:34` | ai (platform) | SM | `feature` indexed; **`user_id` has no FK** `:36` | `metadata` JSONB mapped as `metadata_` `:50` |
| `weekly_insight_reports` | WeeklyInsightReport | `models/ai_insight.py:10` | ai_insights | SM | **dead: 0 refs outside models** (the task caches to Redis instead) | `insights` JSONB `:14` |
| `daily_briefs` | DailyBrief | `ai_insight.py:21` | ai_insights | SM | **dead: 0 refs** | `brief_data` JSONB `:24` |
| `risk_alerts` | RiskAlert | `ai_insight.py:29` | ai_insights | SM | **dead: 0 refs** | `signals` JSONB `:36` |
| `document_chunks` | DocumentChunk | `models/document_chunk.py:17` | ai RAG | BM + `school_id` **NULLABLE** (platform content) `:19` | `source_id` indexed, **no FK** `:24`; **`embedding_vec vector(1024)` exists in the DB but is deliberately unmapped** `:28-29` (raw SQL in `services/ai/rag.py`) | `metadata_json` JSONB `:30` |
| `learning_paths` | LearningPath | `models/adaptive_learning.py:36` | ai_adaptive_learning | SM | Enum `learning_path_difficulty` | `steps`,`recommended_topics`,`focus_areas`,`resources` JSONB `:49-52` |
| `mastery_records` | MasteryRecord | `adaptive_learning.py:103` | ai_adaptive_learning | SM | UQ(`school_id`,`student_id`,`subject`) `:105-107`; Enum **`mastery_level`** `:115` (values `beginner/intermediate/advanced`) | — |

### 2.11 Curriculum + teaching content + AI-teacher runtime (22 tables)

| Table | Class | file:line | Tenancy | Notable constraints | JSON |
|---|---|---|---|---|---|
| `curriculum_frameworks` | CurriculumFramework | `models/curriculum.py:19` | BM + `school_id` **NULLABLE** (NULL = platform) `:21` | Enum `curriculum_board`; UQ(`board`,`grade`,`subject_code`,`school_id`) `:31-32` — **NULLs never collide in Postgres, so duplicate platform rows are insertable** | — |
| `curriculum_units` | CurriculumUnit | `curriculum.py:48` | via framework (no own school_id) | UQ(`framework_id`,`unit_no`) `:60` | — |
| `learning_outcomes` | LearningOutcome | `curriculum.py:75` | via unit | UQ(`unit_id`,`code`) `:84` | — |
| `subject_offerings` | SubjectOffering | `curriculum.py:100` | BM + `school_id` NULLABLE `:102` | UQ(`subject_code`,`grade`,`school_id`) `:114-115` — same NULL caveat | — |
| `teaching_sections` | TeachingSection | `models/teaching_content.py:45` | BM + `school_id` NULLABLE `:47` | 3 CHECKs (`kind`, `difficulty`, override-scope) `:83-94`; model declares 3 plain `UniqueConstraint`s `:95-101` while the migration creates them as **partial indexes** (`migrations/versions/d4e7f1a9c2b8_teaching_content_spine.py:84-93`) — model/DB divergence | `prerequisite_section_ids`,`tags` JSONB `:69-70` |
| `teaching_section_versions` | TeachingSectionVersion | `teaching_content.py:145` | BM + `school_id` NULLABLE | CHECK status `:227-230`; UQ(`section_id`,`version_no`) `:231`; **partial unique `uq_tsv_one_published` exists only in the migration** (`d4e7f1a9c2b8:131`), not in the model | `language_coverage` JSONB `:161-163` |
| `teaching_section_outcomes` | TeachingSectionOutcome | `teaching_content.py:282` | via version (**no school_id**) | CHECK emphasis `:301`; UQ(`version_id`,`outcome_id`) `:302` | — |
| `teaching_notes` | TeachingNote | `teaching_content.py:316` | via version | CHECK block_type `:336-340`; UQ(`version_id`,`block_no`) `:341`; FK→`teaching_media` `:333` (**cycle with `teaching_media.version_id`**) | — |
| `teaching_examples` | TeachingExample | `teaching_content.py:362` | via version | CHECKs kind/difficulty `:386-391`; UQ(`version_id`,`example_no`) `:392` | `steps` JSONB `:377` |
| `teaching_misconceptions` | TeachingMisconception | `teaching_content.py:417` | via version | CHECK severity `:440` | — |
| `teaching_formulas` | TeachingFormula | `teaching_content.py:464` | via version | none | `symbols` JSONB `:478` |
| `teaching_exam_tips` | TeachingExamTip | `teaching_content.py:503` | via version | CHECK tip_type `:524-528` | `appeared_years` JSONB `:518` |
| `teaching_key_terms` | TeachingKeyTerm | `teaching_content.py:550` | via version | UQ(`version_id`,`term_en`) `:566` | — |
| `teaching_media` | TeachingMedia | `teaching_content.py:588` | via version | CHECK media_type `:609-612`; CHECK "at least one target" `:613-616`; FK→`managed_files` `:597` | — |
| `teaching_content_snapshots` | TeachingContentSnapshot | `teaching_content.py:638` | BM + `school_id` NULLABLE | UQ(`version_id`,`language`,`document_sha256`) `:656-658` — **no writer in `app/` outside plugin hooks** | `document` JSONB `:650` |
| `teaching_content_reviews` | TeachingContentReview | `teaching_content.py:665` | BM + `school_id` NULLABLE | CHECK action `:683-686` | — |
| `ai_teacher_service_keys` | AITeacherServiceKey | `models/ai_teacher.py:50` | SM | `key_id` unique `:52`; single-live-key is a service rule, not a constraint `:59-60` | — |
| `ai_teacher_lessons` | AITeacherLesson | `ai_teacher.py:82` | SM | CHECKs status/language/level `:132-140`; `service_session_id` indexed non-unique `:103`; `metadata` mapped as `lesson_metadata` `:116` | `summary_evidence`, `metadata` JSONB `:115-116` |
| `ai_teacher_lesson_chapters` | AITeacherLessonChapter | `ai_teacher.py:181` | SM | CHECK status `:199-202`; UQ(`lesson_id`,`chapter_no`) `:203`; FK CASCADE `:185` | `outcome_ids` JSONB `:196` |
| `ai_teacher_messages` | AITeacherMessage | `ai_teacher.py:222` | SM | CHECK role `:237`; UQ(`lesson_id`,`event_id`) `:238` (webhook idempotency) | — |
| `ai_teacher_mastery` | AITeacherMastery | `ai_teacher.py:246` | SM | CHECK level `:265-268`; **UQ(`student_id`,`concept_key`) omits `school_id`** `:269`; `due_at` indexed `:257` | — |
| `ai_teacher_learning_events` | AITeacherLearningEvent | `ai_teacher.py:290` | SM | none; `verb` free String `:301` | `context` JSONB `:306` |

---

## 3. Relationship & FK map

### 3.1 Hub tables by inbound FK count (read from every model file)

| Hub | Inbound FKs (approx.) | Representative referrers |
|---|---|---|
| `users.id` | ~95 | almost every table (`created_by_id`, `approved_by_id`, `teacher_id`, `actor_id`, …) |
| `schools.id` | ~150 | every `SchoolModel` + the 8 nullable-`school_id` platform tables |
| `students.id` | ~40 | attendance, marks, fees, health, wellbeing, gamification, hostel, ai_teacher, ai_workbench |
| `classes.id` | ~20 | sections, students, exams, timetables, fee_structures, drills, headcounts |
| `subjects.id` | ~12 | marks, question_bank, class_subjects, timetable, digital_content |
| `teaching_section_versions.id` | 9 | all 8 teaching block tables + snapshots + reviews |
| `ai_teacher_lessons.id` | 3 | chapters, messages, learning_events (all CASCADE) |

### 3.2 Cross-domain FKs worth naming

| From | To | file:line | Note |
|---|---|---|---|
| `students.admission_application_id` | `admission_applications.id` | `student.py:34-37` | idempotency key for the admission→enrollment listener |
| `students.bus_stop_id` | `bus_stops.id` | `student.py:88` | core students table depends on the transport plugin's table |
| `biometric_punches.attendance_id` | `attendance.id` | `biometric.py:114` | plugin → core |
| `teaching_sections.lms_topic_id` | `topics.id` | `teaching_content.py:59` | AI-teacher content → LMS |
| `teaching_section_versions.ai_generation_id` | `ai_generations.id` | `teaching_content.py:166-168` | content → workbench provenance |
| `teaching_media.file_id` | `managed_files.id` | `teaching_content.py:597` | content → file storage |
| `teaching_exam_tips.subject_offering_id` | `subject_offerings.id` | `teaching_content.py:519-521` | content → curriculum grid |
| `ai_teacher_lessons.section_id` / `.content_snapshot_id` | `teaching_sections.id` / `teaching_section_versions.id` | `ai_teacher.py:87-92` | **`content_snapshot_id` points at a VERSION, not at `teaching_content_snapshots`** — misleading name |
| `ai_teacher_mastery.outcome_id` | `learning_outcomes.id` | `ai_teacher.py:252` | runtime → curriculum |
| `school_plugins.plugin_slug` | `plugins.slug` | `plugin.py:88-90` | **string FK**, not UUID |
| `school_chain_members.chain_id` | `school_chains.id` | `school_chain.py:67-72` | see §3.4 |
| `quiz_attempts.student_id`, `enrollments.student_id` | **`users.id`** | `lms.py:152`, `lms.py:166` | inconsistent with every other `student_id` in the schema |

### 3.3 Cascades

Only these declare DB-level cascades: `file_folders.parent_id` CASCADE and `managed_files.folder_id`
SET NULL (`file.py:15-19`, `:61-66`); `biometric_punches.device_id` CASCADE and
`biometric_sync_logs.device_id` SET NULL (`biometric.py:103`, `:142`); the hostel/faq RAW models'
`school_id` CASCADE (`hostel.py:13,32,59`, `faq.py:12`); the whole teaching-content subtree CASCADE on
`version_id`/`section_id`/`unit_id` (`teaching_content.py:52,152,286,320,366,421,468,507,554,592,672`);
`ai_teacher_lesson_chapters/messages/learning_events` CASCADE on `lesson_id`
(`ai_teacher.py:185,227,295`).

Everything else has **no** `ondelete`, which is consistent with the soft-delete model
(`BaseModel.soft_delete`, `base.py:36-38`) — but ORM-level `cascade="all, delete-orphan"` is declared on
the teaching-content relationships (`teaching_content.py:78,180,186,192,198,204,210,216,222`) and the
ai_teacher lesson children (`ai_teacher.py:121,127`). A `soft_delete()` on a parent therefore does **not**
soft-delete children anywhere in the schema (P1-06).

### 3.4 FKs crossing a tenant boundary

| Case | file:line | Analysis |
|---|---|---|
| `school_chains.school_id` = **owner**, `school_chain_members.school_id` = **branch** | `school_chain.py:29,66` | The same column name means two different tenants across two tables. `SchoolChainMember` intentionally re-declares `school` as `viewonly=True` (`:79-81`). Any generic `for_school()` filter over `school_chain_members` returns branch rows, not the owner's — a legitimate design, but it makes `school_id` non-uniform platform-wide. |
| `website_pages.school_id_override` | `website.py:12-14` | A **second** FK to `schools.id` on a `SchoolModel`. Nothing in the model says which wins; a page can carry `school_id=A` and `school_id_override=B`. This is a live cross-tenant leak vector if any read path prefers the override. |
| `ai_teacher_mastery` UQ omits `school_id` | `ai_teacher.py:269` | Uniqueness is `(student_id, concept_key)`. Correct only because `students.id` is globally unique; it silently forbids the same student id appearing under two schools (impossible today) and prevents adding `school_id` to the key later without a migration. |
| `designer_templates.school_id` has **no FK** and is nullable | `designer_template.py:17` | Orphan rows survive school deletion; no referential guarantee. |
| `document_chunks.school_id` NULL = platform | `document_chunk.py:19` | Every read must `OR school_id IS NULL`; the model docstring states reads MUST filter `school_id` but nothing enforces it. |

### 3.5 Cycles

| Cycle | file:line |
|---|---|
| `teaching_notes.media_id` → `teaching_media.id` → `teaching_media.version_id` → `teaching_section_versions.id` ← `teaching_notes.version_id` | `teaching_content.py:333`, `:592` |
| `teaching_sections.overrides_section_id` → `teaching_sections.id` (self) | `teaching_content.py:56-58` |
| `teaching_section_versions.supersedes_id` → self | `teaching_content.py:158-160` |
| `file_folders.parent_id` → self | `file.py:15-19` |
| `schools.owner_id` → `users.id` and `users.school_id` → `schools.id` | `school.py:47`, `user.py:25` — mutual; both nullable so inserts are possible, but neither can be made NOT NULL |

### 3.6 Tables with no school scoping

Legitimately platform-level: `plugins`, `revoked_tokens`, `system_settings`, `ai_nutrition_facts`,
`ai_tool_registry`.

Nullable `school_id` by design (platform-vs-school content): `users`, `audit_logs`,
`processed_webhook_events`, `curriculum_frameworks`, `subject_offerings`, `document_chunks`,
`teaching_sections`, `teaching_section_versions`, `teaching_content_snapshots`,
`teaching_content_reviews`, `designer_templates`.

**Should be school-scoped but are not:**

| Table | file:line | Problem |
|---|---|---|
| `curriculum_units` | `curriculum.py:48` | reachable only through `framework_id`; a query that joins wrongly can read another school's units |
| `learning_outcomes` | `curriculum.py:75` | same, one level deeper |
| `teaching_section_outcomes` | `teaching_content.py:282` | no `school_id` while its siblings (`snapshots`, `reviews`) have one |
| `teaching_notes` / `examples` / `misconceptions` / `formulas` / `exam_tips` / `key_terms` / `media` (7 tables) | `teaching_content.py:316-632` | **all seven block tables have no `school_id`** — tenant isolation for the entire teaching-content payload rests on always joining up to `teaching_section_versions` |
| `website_themes` | `website.py:31` | modelled as `SchoolModel` although themes are a platform catalog; every school must duplicate rows |

---

## 4. Data-model defects

### 4.1 Duplicate / overlapping tables — verdicts

| Pair asked about | Verdict | Evidence |
|---|---|---|
| `health_records.py` vs "student_health_records" | **NOT a duplicate — the second table does not exist.** `health_records.py` declares `health_profiles`, `medical_visits`, `immunizations` (`health_records.py:18,39,57`). The only mention of `student_health_records` in the whole backend is a comment in `app/plugins/validator.py:552`. Nothing to merge. |
| `hr.py` vs `hr_payroll.py` | **`hr.py` is a 5-line alias module, not a duplicate.** `hr.py:3` re-exports `StaffAppraisal, StaffLeave, StaffPayroll` from `hr_payroll`. It declares **zero** tables. `models/__init__.py:57` imports it as `HRPayrollAlias`, adding nothing to metadata. Dead indirection, no schema impact. |
| `staff.py` vs hr | **`staff.py` is an alias to `User`.** `staff.py:5-6`: `Staff = User; StaffMember = User`. Zero tables. There is **no** staff table at all — staff are `users` rows with `role in (teacher, staff, accountant, school_admin)` (`tasks/payroll_monthly.py:39`). |
| `designer.py` vs `designer_template.py` | **`designer.py` is an alias module** (`designer.py:3-5`) re-exporting `DesignerTemplate`, `DesignerDocument`, `WebsitePage`, `WebsiteTheme`. Zero tables. Real tables: `designer_templates` (`designer_template.py:12`), `designer_documents` (`designer_document.py:13`), `designer_document_revisions` (`designer_document_revision.py:15`) — three distinct, non-overlapping tables. |
| `digital_content.py` — dead? | **Alive.** `DigitalBook`/`PastPaper`/`OERResource` are read and written by `app/api/v1/elibrary.py:6,20,43,63,83,103,126` and read by `app/api/v1/parent_app.py:1103-1118`. Overlaps conceptually with `library.books` (both are "books") but the columns and purpose differ (file-based e-content vs physical copies). Keep. |
| `incident.py` vs `incident_management.py` | **Correct layering, not duplication.** `incident.py` owns `incidents`/`witness_statements`/`incident_actions`; `incident_management.py` adds `incident_escalations`/`incident_workflow_events` and the base `incidents` table carries the workflow columns inline (`incident.py:51-59`). The one real defect: `incidents.escalated_at`/`escalated_to_id`/`conference_scheduled*` duplicate `incident_escalations` columns (`incident.py:54-59` vs `incident_management.py:40-46`) — a denormalized "latest pointer" with no trigger keeping it in sync. |
| `ai_insight.py` vs `ai_workbench.py` | **`ai_insight.py` is effectively dead.** `weekly_insight_reports`, `daily_briefs`, `risk_alerts` have **0 references outside `app/models/`** (verified by grep across `app/` and `tests/`); the weekly task writes its output to the Redis cache instead (`tasks/ai_insights_weekly.py:16,33`). `ai_workbench.py` is the live 13-table AI spine. `models/analytics.py:3` re-exports the dead classes, which is why they look used. |
| `library.book_transactions` vs `book_issues` | **`book_transactions` is dead** — 0 references outside `app/models/`. Every route and the overdue task use `BookIssue` (`api/v1/library.py:143-327`, `api/v1/student_app.py:427`, `tasks/library_overdue.py:35-38`). Two near-identical tables, one abandoned; the abandoned one is the richer schema (it has `fine_amount`/`fine_paid`, which `book_issues` lacks). |
| `wellbeing.mood_checkins` vs `mood_entries` | **`mood_checkins` and `counselor_sessions` are dead** (0 refs); `mood_entries` and `counselor_notes` are live (`MoodEntry` 2 writes/13 reads, `CounselorNote` 1 write/7 reads). Pure duplication: the first generation had a `mood_type` Enum, the replacement uses a plain String. |
| `timetable.timetables/periods/substitutions` vs `timetable_slots` | **First three are dead** (`Timetable`, `TimetablePeriod`, `Substitution`: 0 class references outside models). `timetable_slots` (`timetable.py:73`) is the live flat model (2 writes/26 reads). Four tables where one is used. |
| `money.py` D-06 tables vs the JSONB they replace | **The replacements are dead.** `ClassSubject`, `SectionSubjectTeacher`, `FeeStructureItem`: 0 references outside `app/models/` (the only hit is a comment in `utils/money.py:62`). The denormalized originals — `subjects.class_ids`/`teacher_ids` ARRAY (`academic.py:118-119`) and `fee_structures.fee_items` JSONB (`fee.py:35`) — are what the code actually reads and writes (`tasks/fee_reminders.py:476-481`). The D-06 migration shipped the tables; nothing migrated onto them. |

### 4.2 Denormalized JSON/ARRAY where a proper table already exists

| Denormalized column | file:line | Normalized table that exists | Which one the code uses |
|---|---|---|---|
| `fee_structures.fee_items` JSONB | `fee.py:35` | `fee_structure_items` (`money.py:74`) | JSONB (`tasks/fee_reminders.py:476`) |
| `subjects.class_ids`, `subjects.teacher_ids` ARRAY | `academic.py:118-119` | `class_subjects`, `section_subject_teachers` (`money.py:23,50`) | ARRAY — and `utils/teacher_scope.py:27,40` queries `teacher_ids.any(user_id)`, which cannot use a b-tree index |
| `streams.class_ids` ARRAY | `academic.py:63` | none | — |
| `exams.class_ids`, `exams.subject_ids` ARRAY | `exam.py:45-46` | none | — |
| `incidents.involved_student_ids` ARRAY | `incident.py:43` | none (`incident_actions.student_id` is per-action) | — |
| `emergency_headcounts.missing_student_ids`, `drill_participations.missing_student_ids` ARRAY | `emergency.py:72`, `disaster_management.py:68` | none | — |
| `bus_stops.student_ids` ARRAY | `transport.py:63` | `students.bus_stop_id` **already exists** (`student.py:88`) — two directions of the same relation, neither authoritative | both |
| `generated_papers.questions` JSONB | `question_bank.py:120` | `question_bank_items` (referenced only as a `bank_item_id` string inside the JSON) | JSONB |
| `online_exams.questions`, `quizzes.questions` JSONB | `exam.py:179`, `lms.py:138` | `question_bank_items` | JSONB |
| `enrollments.completed_lessons` JSONB | `lms.py:168` | `student_progress` (`lms.py:116`) | both |
| `school.*_config` (9 JSONBs) | `school.py:111-119` | `system_settings` / plugin `config` | JSONB; `fee_config` holds **payment-gateway merchant credentials** (`services/payments/esewa_gateway.py:4`) and is serialized by `School.to_dict()` (`school.py:185`) |
| `users.permissions` JSONB | `user.py:77` | `ROLE_PERMISSIONS` dict (`utils/permissions.py:5`) | both; also stores the **TOTP secret** (`user.py:98-102`) |
| `school_websites.customizations` JSONB | `school.py:202` | none — the sitemap task writes a `"sitemap"` key into it (`tasks/sitemap_rebuild.py:63`) | JSONB |
| `FeeCollection.notes` free text as idempotency store | `fee.py:84` + `tasks/fee_reminders.py:507-527` | `fee_receipts.idempotency_key` exists (`fee.py:109`) | notes substring matching via `ILIKE '%marker%'` |

### 4.3 Enum collisions and naming hazards

| Enum name | Declared at | Note |
|---|---|---|
| `session_status` | `wellbeing.py:76` (`scheduled/completed/cancelled/no_show`) | Owned by the **dead** `counselor_sessions` table. `ai_workbench.py:199-203` explicitly documents having to name its enum `tutor_session_status` to avoid binding this type. A dead table is squatting a generic type name. |
| `mastery_level` | `adaptive_learning.py:115` (`beginner/intermediate/advanced`) | `ai_teacher_mastery.mastery_level` uses `novice/developing/proficient/advanced` as a **String + CHECK** (`ai_teacher.py:260-268`) — two incompatible mastery vocabularies in one schema. |
| `low/medium/high/critical` | `risk_level` (`student.py:111`), `incident_severity` (`incident.py:37`), `moderation_severity` (`ai_workbench.py:271`) | Three distinct PG types with identical value sets. |
| `payment_status` | `fee.py:78-81` | Shared name with `alumni_donations.status` which is a plain String (`alumni.py:57`) using `pending/completed/refunded`. |
| `student_gender` vs `gender_type` | `student.py:44` vs `user.py:47` | Same values, two types. |
| `book_tx_status` vs `book_issue_status` | `library.py:46` vs `library.py:68` | Identical value sets; one belongs to the dead table. |
| Enum vs String for the same concept | `admission_applications.status` Enum (`admission.py:57-70`) vs `admission_inquiries.status` String (`admission.py:113`) | The Enum lacks `archived`, which the cleanup task originally wrote — fixed by writing `rejected` + a remark (`tasks/admission_followup.py:59-66`). The String column receives `followed_up` (`:35`) which is outside its documented vocabulary. |
| Free String where a CHECK is warranted | `disaster_drills.status` (`disaster_management.py:45`, "validated in the blueprint"), `ai_teacher_learning_events.verb` (`ai_teacher.py:301`), `payment_initiations.status` (`fee.py:180`) | validation lives in Python only |

### 4.4 Naive vs aware datetime residue

`BaseModel.created_at/updated_at` are `DateTime(timezone=True)` (`base.py:23-31`) — TIMESTAMPTZ everywhere.
Explicit columns split three ways:

| Style | Examples |
|---|---|
| **Aware** `DateTime(timezone=True)` | `ai_teacher.py:54-55,104-106,257-258`; `ai_workbench.py:207,239,253-254,276,306`; `contact.py:23-25` |
| **Naive** `DateTime` (dozens) | `user.py:55,56,61,65` (`otp_expires_at`, `last_login_at`, `locked_until`, `tokens_invalid_before`); `school.py:41,46,206`; `fee.py:70,88,111,182`; `plugin.py:94,95,101,102`; `attendance.py:73`; `exam.py:141,162,180,181,201,202`; `emergency.py:38,39,58,74`; `notification.py:31,32,60,74,119` |
| **Naive by design** | `revoked_tokens.expires_at` (`revoked_token.py:29` + `_naive_utc` helper `:36-40`) |
| **Python-side default instead of server default** | `hostel.py:22,41,67`, `faq.py:19-20` (`default=lambda: datetime.now(timezone.utc)` into a `DateTime(timezone=True)`) |

Every read of a naive column that compares against an aware value needs a manual patch, and the codebase
does exactly that in at least five places: `app/__init__.py:164-166` (`tokens_invalid_before`),
`app/__init__.py:499-504` (`trial_ends_at`), `realtime.py:83-86`, `tasks/fee_reminders.py:211-217`
(`last_reminder_sent_at`), `tasks/admission_followup.py:16,50` (`.replace(tzinfo=None)` to match a naive
`created_at`… which is actually TIMESTAMPTZ, so this comparison is wrong in the other direction).
`tasks/trial_expiry.py:23,31` compares the **naive** `trial_ends_at` against an **aware** `now` with no
normalization at all — the query is executed by Postgres, which will coerce using the session timezone.

### 4.5 Missing unique constraints (highest-impact first)

| Table | Missing key | file:line | Consequence |
|---|---|---|---|
| `report_cards` | (`school_id`,`student_id`,`exam_id`) | `exam.py:135` | `tasks/report_generation.py:142-147` does filter-then-insert with no constraint → concurrent bulk generation creates duplicate report cards, and the ranking pass (`:220-244`) then ranks duplicates |
| `staff_payroll` | (`school_id`,`user_id`,`month`) | `hr_payroll.py:10` | `tasks/payroll_monthly.py:82-88` filter-then-insert; the task lock (`:11`) is the only guard, and it is Redis-based |
| `fee_collections` | any natural key | `fee.py:43` | idempotency is `notes ILIKE '%[fee_structure:id:cycle:item]%'` (`tasks/fee_reminders.py:509-527`) — unindexable, and a wildcard match can hit an unrelated note |
| `alumni_donations` | `transaction_ref` | `alumni.py:54` | money table, duplicate gateway callbacks insert twice |
| `payment_initiations` | `gateway_ref` | `fee.py:178` | indexed but not unique; two initiations can share a gateway reference |
| `ai_school_quotas` | `school_id` | `ai_token.py:11` | two quota rows per school possible; enforcement reads "the" row |
| `whatsapp_bot_configs` | `school_id` | `notification.py:91` | duplicate singleton configs |
| `student_portfolios` | `student_id` | `portfolio.py:10` | modelled 1:1 (`portfolio.py:20` backref `portfolio`, singular) but not enforced |
| `student_badges` | (`student_id`,`badge_id`) | `gamification.py:31` | duplicate awards |
| `assignment_submissions` | (`assignment_id`,`student_id`) | `assignment.py:42` | duplicate submissions |
| `online_exam_attempts` | (`online_exam_id`,`student_id`) | `exam.py:194` | duplicate attempts |
| `student_progress` | (`student_id`,`course_id`,`lesson_id`) | `lms.py:116` | duplicate progress rows |
| `enrollments` | (`course_id`,`student_id`) | `lms.py:163` | duplicate enrollments |
| `notification_templates` | (`school_id`,`name`,`channel`) | `notification.py:80` | ambiguous template lookup |
| `academic_years` | (`school_id`,`name`) and "one `is_current`" | `academic.py:20-28` | two current years possible; the rollover task flips `is_current` without a guard (`tasks/academic_rollover.py:108-109`) |
| `books` | (`school_id`,`isbn`) | `library.py:25` | duplicate catalog rows |
| `conference_slots` | (`teacher_id`,`start_time`) | `conference.py:23` | double-booking |
| `chat_threads` | canonical participant ordering | `chat.py:12-17` | (A,B) and (B,A) are two threads |
| `users` | none on `email`/`phone` | `user.py:43-44` | documented and relied on by `utils/password.py:370-378`, but it means login-identifier collisions are possible within a school |
| `assets` | `asset_code` is global-unique instead of per-school | `inventory.py:13` | **wrong direction**: school B cannot use an asset code school A used |
| `attendance`, `teacher_attendance`, `school_plugins` | UQs are **not partial on `is_deleted`** | `attendance.py:12`, `:41`, `plugin.py:83` | a soft-deleted row permanently blocks re-creating the same (school, student, date) / (school, plugin) — unlike `marks` and `fee_receipts`, which correctly use partial indexes (`exam.py:97-102`, `fee.py:120-125`) |
| `curriculum_frameworks`, `subject_offerings` | UQ includes nullable `school_id` | `curriculum.py:31-32`, `:114-115` | Postgres treats NULLs as distinct → **duplicate platform rows are insertable**, and `seed_curriculum` runs on every boot from ~6 processes (`services/ai/curriculum_seed.py:65-76`) |
| `teaching_section_versions` | `uq_tsv_one_published` exists in the migration only | `teaching_content.py:226-232` vs `d4e7f1a9c2b8:131` | a `create_all()`-built schema (tests, fresh dev DB) has **no** one-published-version guarantee, and `TeachingSection.published_version` (`teaching_content.py:104-109`) silently returns the first match |

### 4.6 N+1-prone relationship loading

| Site | file:line | Problem |
|---|---|---|
| `Student.to_dict()` | `student.py:132-194` | touches `self.klass`, `self.section`, `self.semester`, `self.stream`, `self.shift`, `self.medium`, `self.user` **and** calls `generate_default_password(self.user, self)` (`:141-144`) which itself may hit the DB (`utils/password.py:367-425`). A 200-row student list = up to 8 lazy loads + a collision query per row. |
| `HostelAllocation.student` | `hostel.py:69` | `lazy="joined"` — the only eager relationship in the schema; forces a join even for count queries (`hostel.py:47`). |
| `HostelRoom.occupied_count` / `is_full` | `hostel.py:45-51` | one COUNT per room, per render. |
| `FileFolder.to_dict()` | `file.py:28-36` | `self.files.count()` — one COUNT per folder. |
| `TeachingSectionVersion.to_dict()` | `teaching_content.py:234-253` | `len(self.notes)`, `.examples`, `.misconceptions`, `.formulas`, `.exam_tips`, `.key_terms`, `.media`, `.outcome_links` → **8 lazy collection loads per version**, executed even when `include_blocks=False` (the "counts" block). Listing 50 versions = 400 queries. |
| `TeachingSection.published_version` | `teaching_content.py:104-109` | loads the full `versions` collection to find one row. |
| `AITeacherLesson.to_dict(include_chapters=True)` | `ai_teacher.py:173-174` | per-lesson chapter load. |
| `LearningPath.to_dict()` / `MasteryRecord.to_dict()` | `adaptive_learning.py:72-78`, `:128-135` | `self.student` per row. |
| `SchoolChainMember.to_dict()` | `school_chain.py:102-116` | `self.school` per branch. |
| `tasks/streak_updater.py:50-63` | | **worst in the codebase**: an unbounded `while True` loop issuing one `Attendance.query...first()` per student per day walking backwards until a gap. For a school with a 200-day streak this is 200 queries × N students, nightly. |
| `tasks/report_generation.py:36-37` | | `Subject.query.get(m.subject_id)` inside the marks loop. |
| `tasks/fee_reminders.py:219,230` | | `Student.query.get()` + `Guardian.query.filter_by()` per overdue fee. |
| `tasks/gps_firebase_poller.py:107-111` | | `MAX(timestamp)` per bus every 15 s against an **unindexed** `gps_logs(bus_id,timestamp)`. |
| `tasks/analytics_aggregate.py:26-46` | | 4 aggregate queries per school **plus a commit inside the loop** (`:55`). |

### 4.7 Models declared but never imported in `models/__init__.py`

Verified programmatically over all 196 classes:

| Class | Table | file:line | Impact |
|---|---|---|---|
| `ExpenseCategory` | `expense_categories` | `hr_payroll.py:66` | the class **is** imported transitively (`models/__init__.py:49` imports from `hr_payroll`, which executes the whole module), so metadata is populated — but it is invisible to anyone reading `__init__.py` as the schema index. Migration `28636966600d` exists. |
| `Expense` | `expenses` | `hr_payroll.py:73` | same; actively used by `api/v1/hr_payroll.py:9,1077-1162` |
| `InAppNotification` | `in_app_notifications` | `notification.py:100` | same (module imported at `models/__init__.py:29`); used by `api/v1/notifications.py:11` and `tests/test_comms_plugins.py:25` |

No table is genuinely missing from `db.metadata`. The defect is documentation-shaped: `models/__init__.py`
claims to be the Alembic discovery surface (`:1`) and explicitly lists individual class names, so three
tables are absent from that contract.

### 4.8 Other model-level defects found while reading

| # | Defect | file:line |
|---|---|---|
| a | `Student.embedding` is conditional on a successful `pgvector` import — the column **exists or not depending on the runtime environment** | `student.py:20-23`, `:115` |
| b | `CounselorNote.counselor` relationship declared twice (second silently wins) | `wellbeing.py:110-111` |
| c | `Lesson` has both `duration_mins` and `duration_minutes` | `lms.py:49-50` |
| d | `Exam` has `total_marks` + `full_marks` aliases, and `start_date`/`end_date` alongside `start_date_ad`/`end_date_ad` | `exam.py:54-60` |
| e | `ReportCard` has `total_percentage`+`percentage` and `rank_in_class`+`rank` aliases, both written in parallel | `exam.py:150-155`, `tasks/report_generation.py:149-150`, `:242-243` |
| f | `Marks.obtained_marks` marked legacy but still a live column | `exam.py:109` |
| g | `School` carries 8 plaintext social/OAuth token columns (`facebook_page_token`, `instagram_token`, `tiktok_token`, `youtube_token`, `whatsapp_token`) | `school.py:98-108` |
| h | `School.to_dict()` returns `fee_config` — the JSONB holding **gateway merchant credentials** | `school.py:185`, cf. `services/payments/esewa_gateway.py:4` |
| i | `hostels`/`hostel_rooms`/`hostel_allocations` have **no `updated_at`** and bypass `BaseModel` entirely | `hostel.py:8-69` |
| j | `faqs` bypasses `BaseModel` | `faq.py:8-23` |
| k | `AITeacherLesson.content_snapshot_id` FKs `teaching_section_versions`, not `teaching_content_snapshots` | `ai_teacher.py:90-92` |
| l | `AIGeneration.ai_generation_meta` and `AIUsageLog.metadata_` both map a column literally named `metadata` — SQLAlchemy-reserved name worked around twice, differently | `ai_workbench.py:47`, `ai_token.py:50` |
| m | `WebsiteTheme` is school-scoped though it is a platform catalog | `website.py:31` |
| n | `TeachingSection.to_dict()` calls `self.published_version` **three times** (3 full collection scans) | `teaching_content.py:131-133` |
| o | `BaseModel.soft_delete()` commits the whole session | `base.py:36-38` — a soft delete flushes every other pending change in the request |
| p | `SchoolModel.for_school()` exists but is used **12 times total** against **812** hand-written `school_id=g.school_id` filters | `base.py:56-60`; grep counts |

---

## 5. Multi-tenancy & security assessment

### 5.1 `BaseModel` / `SchoolModel` mechanics

`backend/app/models/base.py` (81 lines) is the whole isolation primitive:

- `BaseModel` (`:10-43`): UUID PK with both a Python default and `server_default text("gen_random_uuid()")`
  (`:17-22`); `created_at`/`updated_at` TIMESTAMPTZ NOT NULL with `server_default now()` and
  `onupdate now()` (`:23-31`); `is_deleted` NOT NULL default false (`:32-34`);
  `soft_delete()` (`:36-38`); `active()` classmethod returning `filter_by(is_deleted=False)` (`:40-43`).
- `SchoolModel` (`:46-75`): adds `school_id UUID NOT NULL FK schools.id, index=True` (`:51-53`);
  `for_school(school_id)` raises `SchoolIsolationError` on `None` and returns
  `filter_by(school_id=…, is_deleted=False)` (`:56-60`); `for_school_and_year()` adds the
  `academic_year_id` filter and raises when the model lacks the column (`:62-75`).
- `SchoolIsolationError` (`:78-81`).

**There is no query-level enforcement.** No `with_loader_criteria`, no session-level event, no
`Query` subclass. `for_school()` is opt-in and is called **12 times** in the entire backend, versus
**812** hand-written `school_id=g.school_id` / `school_id == g.school_id` filters. Isolation is therefore
**route discipline, not a model invariant** — a single forgotten filter is a cross-tenant read with no
safety net. The only structural backstop is `resolve_school`'s cross-tenant 403
(`app/__init__.py:423-442`), which validates *which school was resolved*, not *what the query returned*.

Six tables cannot be filtered by `school_id` at all because they do not have the column
(`curriculum_units`, `learning_outcomes`, `teaching_section_outcomes`, plus the 7 teaching block tables —
see §3.6); their isolation depends entirely on joining up to a scoped ancestor. `app/api/v1/teaching_content.py:57-65`
does implement the correct pattern (`or_(school_id IS NULL, school_id == g.school_id)`), and
`:76-86` guards platform-row writes — but that is one blueprint's discipline, not an enforced rule.

### 5.2 Audit-trail coverage

`backend/app/utils/audit_trail.py` (252 lines), wired at `app/__init__.py:572-574`.

Audited tables — **exactly 9** (`audit_trail.py:16-26`): `fee_collections`, `fee_receipts`, `fee_refunds`,
`marks`, `report_cards`, `staff_payroll`, `student_scholarships`, `users`, `school_plugins`.

Per-column old/new tracking — **9 classes** (`:242-252`): `Marks`, `ReportCard`, `FeeCollection`,
`FeeReceipt`, `FeeRefund`, `StudentScholarship`, `User`, `StaffPayroll`, `SchoolPlugin`.

Mechanism: an attribute-level `set` listener records the committed value before it is overwritten
(`:42-57`, needed because `load_history()` returns nothing for expired attributes), then `before_flush`
(`:125-217`) emits `AuditLog` rows for `session.new` / `session.dirty` / `session.deleted`. Secrets are
skipped via `_SKIP_COLUMNS = {updated_at, password_hash, totp_secret}` (`:29`).

Gaps:

| Gap | Evidence |
|---|---|
| **Not audited despite being money or identity**: `payment_initiations`, `expenses`, `alumni_donations`, `fee_structures`, `fee_types`, `students`, `guardians`, `schools`, `staff_leaves`, `staff_appraisals`, `attendance`, `exams`, `online_exam_attempts` | absent from `AUDITED_TABLES` `:16-26` |
| `totp_secret` is skipped as a **column name**, but the TOTP secret actually lives **inside the `permissions` JSONB** (`user.py:98-102`), and `permissions` is not skipped | `audit_trail.py:29` vs `user.py:77` — a `users.permissions` update writes the TOTP secret into `audit_logs.old_values`/`new_values` |
| Fail-open by design | `:216-217` `except Exception: logger.exception` — an audit failure is invisible to the caller |
| `_SET_LEDGER` is a module-global keyed by `id(target)` | `:36` — `id()` is reused after GC; a stale entry can attribute one object's old value to another |
| One extra SELECT per audited UPDATE when attributes were expired | `:161-168` |
| `audit_logs` has no index on `(resource_type, resource_id)` or `(school_id, created_at)` | `compliance.py:39-51` |

### 5.3 Permission model

`backend/app/utils/permissions.py` (78 lines) defines `ROLE_PERMISSIONS` (`:5-60`) —
7 roles × module → `[actions]`, with `superadmin: {"*": ["*"]}` — and `has_permission(role, module, action, overrides)`
(`:63-78`) which checks user overrides first, then the wildcard, then the module list.

**`has_permission` and `ROLE_PERMISSIONS` have ZERO importers anywhere in the repository** (verified by
repo-wide grep: the only hits are the definitions themselves). The declared RBAC matrix is dead code.

What is actually enforced (`backend/app/utils/decorators.py`, 63 lines):

| Decorator | file:line | Semantics |
|---|---|---|
| `role_required(*roles)` | `decorators.py:8-30` | `verify_jwt_in_request()`, then `claims["role"] not in allowed_roles` → 403. **Coarse role gate; no module/action granularity.** 69 importing modules. |
| `school_required` | `:33-49` | `g.get("school_id")` falsy → 400 |
| `superadmin_required` | `:52-63` | `claims["role"] != "superadmin"` → 403 |

RBAC roles enumerated — the `user_role` PG enum (`user.py:26-38`) is the authoritative list:
`superadmin`, `school_admin`, `accountant`, `teacher`, `staff`, `parent`, `student`. **There is no
`principal` role**, yet `tasks/report_generation.py:311` counts `u.role == "principal"` (always 0, with an
honest comment at `:310`), `:379` filters `User.role.in_([... "principal","admin"])` (**both invalid enum
members — this query raises `DataError`**), and `tasks/gps_processing.py:176` targets
`roles=["admin","principal","transport_manager"]` (three non-existent roles → the geofence push reaches nobody).

`users.permissions` JSONB (`user.py:77`) is the intended override bag that `has_permission(overrides=…)`
would read; since nothing calls it, per-user overrides are inert. `User.to_dict()` strips only keys ending
in `_secret` (`user.py:115-119`), so the permission keys are exposed but the TOTP secret is not.

### 5.4 Teacher scoping

`backend/app/utils/teacher_scope.py` (55 lines), 6 importers:

| Function | file:line | Query |
|---|---|---|
| `teacher_class_teacher_class_ids` | `:6-19` | `Section.query.filter_by(school_id, class_teacher_id=user_id, is_deleted=False)` — used for attendance authority |
| `teacher_allowed_subject_ids` | `:22-30` | `Subject.teacher_ids.any(user_id)` on the ARRAY column |
| `teacher_allowed_class_ids` | `:33-55` | union of subject `class_ids` (ARRAY) and class-teacher sections |

Both ARRAY paths (`:27`, `:40`) do a sequential scan over `subjects` — `teacher_ids` has no GIN index
anywhere in the model or migrations. This is the concrete cost of the un-migrated D-06 normalization
(`section_subject_teachers` exists and is unused, §4.1).

### 5.5 Other security observations

| # | Observation | Evidence |
|---|---|---|
| S-a | JWT blocklist checks `RevokedToken.is_revoked(jti)` with **no fail-open wrapper** (deliberate) but the `iat` cutoff check above it **is** fail-open (`except: rollback`) | `app/__init__.py:143-176`, `:168-171` |
| S-b | `check_if_token_revoked` issues **two DB queries per protected request** (`tokens_invalid_before` + `revoked_tokens` exists) | `:159-161`, `:176` |
| S-c | Password hashing uses `werkzeug.security.generate_password_hash` (pbkdf2 default), while `bcrypt==4.2.*` is a declared dependency | `user.py:2,90` vs `requirements.txt:29` |
| S-d | `Flask-Limiter` is initialized with `get_remote_address` and `RATELIMIT_DEFAULT="60/minute"` but **no global `default_limits`** is passed to `Limiter(...)`, so the default is not applied | `extensions.py:17`, `config.py:106` |
| S-e | The custom `RateLimiter` fails **open** on Redis errors | `utils/rate_limiter.py:51-53`, `:31` |
| S-f | ClamAV scanning is opt-in (`CLAMAV_ENABLED`) and fails open unless `CLAMAV_STRICT` | `utils/file_upload.py:60`, `:78-81` |
| S-g | `_env()` generates a **per-process random secret** in non-dev when a secret is unset — different gunicorn workers then sign with different keys | `config.py:39-52` |
| S-h | Production validation is thorough (7 fatal checks incl. published-placeholder detection against `.env.example`) | `config.py:269-348` |
| S-i | CSP is `default-src 'none'` with no `unsafe-inline` | `app/__init__.py:757-765` |
| S-j | Socket auth is enforced at handshake, mirrors HTTP guards, and additionally checks `is_active` | `realtime.py:53-100` |
| S-k | Device ingest rate limiting keys on `sha256(X-Device-Key)` | `utils/rate_limiter.py:115-127` |
| S-l | `/uploads/<path>` refuses untracked files outside a school-scoped prefix and sets `Cache-Control: private` for non-public rows | `app/__init__.py:786-803` |

---

## 6. Utils assessment (22 modules, 2,265 LOC)

Importer counts measured with `grep -rl` across `backend/app/` + `backend/tests/`, excluding each module's
own file.

| Module | LOC | file | Importers | Purpose / verdict |
|---|---|---|---|---|
| `response.py` | 22 | `utils/response.py` | **74** | `success/error/created/no_content_response`. Canonical envelope `{success,data,error,meta}`. Core. |
| `decorators.py` | 63 | `utils/decorators.py` | **69** | `role_required`, `school_required`, `superadmin_required`. The real access-control layer. |
| `pagination.py` | 30 | `utils/pagination.py` | **37** | `paginate(query, schema, default_per_page)`, caps `per_page` at 100 (`:13`). Core. |
| `nepali_date.py` | 40 | `utils/nepali_date.py` | **13** | BS↔AD via `nepali_datetime`. `bs_to_ad` raises on malformed input (`:14-18`, no try/except). |
| `password.py` | 489 | `utils/password.py` | **7** | Deterministic default-credential generator with per-school pattern overrides, collision resolution and a DB fallback path (`:367-425`). Never raises (`:455-471`). Largest util; correctness-critical for logins. |
| `tenant_url.py` | 42 | `utils/tenant_url.py` | **7** | `school_site_domain/url/host` from `BASE_DOMAIN`; app-context-safe (`:24-26`). Single source of truth for tenant URLs — but `tasks/website_live_sync.py:19` hardcodes `FRONTEND_URL = "http://frontend:3000"`, bypassing it and disagreeing with `config.NEXTJS_INTERNAL_URL = "http://nextjs:3000"` (`config.py:210`). |
| `file_upload.py` | 149 | `utils/file_upload.py` | **6** | local/R2 switch, ClamAV hook, `upload_file`/`delete_file`/`generate_presigned_url`. Reads env directly rather than `current_app.config`, so it ignores config overrides (`:23,:27,:110`). |
| `llm_output.py` | 130 | `utils/llm_output.py` | **6** | `parse_and_validate` — fence extraction, brace-span scanning, bounded repair, minimal jsonschema subset. Good consolidation. |
| `teacher_scope.py` | 55 | `utils/teacher_scope.py` | **6** | see §5.4 |
| `nepal_grading.py` | 143 | `utils/nepal_grading.py` | **5** | NEB grade table, `calculate_grade`, `calculate_subject_grade` (theory 35% / practical 40% separate-pass rule `:65-81`), credit-weighted `calculate_gpa` (`:97-136`). |
| `validators.py` | 58 | `utils/validators.py` | **5** | Nepal phone/PAN/BS-date/email + `validate_password_strength`. |
| `rate_limiter.py` | 127 | `utils/rate_limiter.py` | **4** | fixed-window Redis counter (named "token-bucket" at `:13` — it is not), `rate_limit`, `ai_rate_limit`, `device_rate_limit`. |
| `task_locks.py` | 51 | `utils/task_locks.py` | **4** | `task_lock(key, ttl)` via `SET NX EX`; runs unlocked when Redis is down (`:35-37`); returns `{"skipped":"lock_held"}`. |
| `report_pdf.py` | 135 | `utils/report_pdf.py` | **2** | WeasyPrint letterhead chrome, `fmt_npr`, `render_report_pdf`. Callers must pre-escape (`:9`). |
| `audit_trail.py` | 252 | `utils/audit_trail.py` | **1** (`app/__init__.py:572`) | see §5.2 |
| `__init__.py` | 14 | `utils/__init__.py` | n/a | re-exports the response helpers |
| **`money.py`** | 115 | `utils/money.py` | **0** | **DEAD.** `to_decimal/money/add/sub/mul/pct/net_payable/split_vat_inclusive` + the 14 MoEST fee-cap headings and `classify_fee_cap_heading`. Zero importers repo-wide. Meanwhile `tasks/fee_reminders.py:283-310` re-implements net-payable in **float** (`_fee_payable_total`) and `api/v1/fees.py:2794` parses `vat_percent` as float. |
| **`permissions.py`** | 78 | `utils/permissions.py` | **0** | **DEAD.** The entire declared RBAC matrix (§5.3). |
| **`i18n.py`** | 119 | `utils/i18n.py` | **0** | **DEAD.** ~90 Nepali UI labels + `t()`/`bilingual()`. The frontend/Flutter tiers carry their own translations. |
| **`nepali_numbers.py`** | 95 | `utils/nepali_numbers.py` | **0** | **DEAD.** Devanagari digit conversion, `format_nepali_currency` (Nepali 1,00,000 grouping), ordinals, BS month/day names. Notably `format_nepali_currency` takes a `float` (`:40`) — would reintroduce float money. |
| **`image_utils.py`** | 36 | `utils/image_utils.py` | **0** | **DEAD.** `is_allowed_image`, `build_image_name`, `image_meta`. |
| **`auth.py`** | 22 | `utils/auth.py` | **0** | **DEAD.** `current_user_id/current_school_id/current_role` — routes read `g.*` directly instead. |

**Duplication between utils and elsewhere:**

| Duplication | Evidence |
|---|---|
| `utils/money.py` (Decimal helpers, 0 importers) vs `models/money.py` (the D-06 normalized tables, 0 importers) — **two unrelated things sharing a name, both dead** | `utils/money.py:1`, `models/money.py:1` |
| Money arithmetic re-implemented in float | `tasks/fee_reminders.py:283-310`, `:568-618`; `api/v1/fees.py:2794` |
| `nepal_grading.calculate_gpa` used correctly by the report-card task (`tasks/report_generation.py:77-90`) but the task **also** computes `percentage` itself (`:73`) — two sources for the same number | `tasks/report_generation.py:73` vs `:79-90` |
| Two rate limiters: `flask_limiter` (`extensions.py:17`) and the hand-rolled `utils/rate_limiter.py` | both live |
| Two Redis accessors: `extensions.redis_client` (set by `init_redis`) and `app.extensions.redis_client` (**bound at import time**, so it is `None` for any module importing it before `init_redis` runs) | `extensions.py:21-28`, `app/extensions.py:3`, consumer `tasks/website_live_sync.py:13` |
| Two `Enum` import styles for the same purpose | `conference.py:5` (`Enum as SAEnum`, then unused) vs everything else |

Total dead util code: **465 LOC across 6 modules** (money 115, i18n 119, nepali_numbers 95,
permissions 78, image_utils 36, auth 22).

---

## 7. Celery / task inventory

Worker consumes `-Q default,celery,ai,notifications,gps` in dev (`docker-compose.yml:55`) and
`-Q default,ai,notifications,gps` in production (`docker-compose.prod.yml:143`). `task_routes={"*": "default"}`
(`app/__init__.py:293`) sends every task without an explicit queue to `default`, so nothing is orphaned.
`task_acks_late=True`, `task_time_limit=1800`, `soft=1500`, `prefetch=1` (`:296-299`).
Beat schedule state is persisted to a named volume in dev (`docker-compose.yml:81`) but **not** in prod
(`docker-compose.prod.yml:180` has no `--schedule` path or volume) — a beat restart in production re-fires
its schedule from scratch.

**No task is routed to the `ai` queue.** The worker consumes it; nothing publishes to it.

| Task name | Module:line | Queue | Beat | Lock / idempotency | Writes | Output consumed by |
|---|---|---|---|---|---|---|
| `dispatch_fee_reminders` | `tasks/fee_reminders.py:153` | default | 08:00 daily (`app/__init__.py:301-304`) | `task_lock("dispatch-fee-reminders", 1800)` `:154` | nothing (fan-out) | queues `send_fee_reminders` |
| `send_fee_reminders` | `fee_reminders.py:171` | default | — | `task_lock("fee-reminders-{school_id}")` `:172`; 72 h dedupe via `last_reminder_sent_at` `:207-217` | `fee_collections.last_reminder_sent_at` `:277` | SMS + push side effects |
| `auto_generate_monthly_fees` | `fee_reminders.py:415` | default | 00:45 daily, self-gates on BS day ≤2 (`:429-431`) | `task_lock("auto-generate-fees", 6h)` `:416`; **notes-substring dedupe** `:507-527` | **`fee_collections` rows** `:539-552` | fees API |
| `generate_monthly_fee_report` | `fee_reminders.py:313` | default | — | none | nothing (returns a dict) | **nobody** — 0 call sites |
| `attendance_alerts_daily` | `tasks/attendance_alerts.py:9` | default (implicit) | 16:30 daily | **none** | nothing directly; emits `attendance.student_absent` per row `:50-55` | plugin listeners |
| `library_overdue_check` | `tasks/library_overdue.py:9` | default (implicit) | 07:30 daily | **none** | nothing; emits `library.book_overdue` `:42-49` | plugin listeners |
| `payroll_monthly_process` | `tasks/payroll_monthly.py:10` | default (implicit) | 1st @00:10 | `task_lock("payroll-monthly", 6h)` `:11` + exists-check `:82-88` (**no DB UQ**) | **`staff_payroll` draft rows** `:91-102` | HR payroll API |
| `analytics_aggregate_daily` | `tasks/analytics_aggregate.py:8` | default (implicit) | 00:20 daily | **none** | `schools.total_students` only `:50-53` (assigned twice); computes `attendance_rate` and `fees_collected` then **discards them** `:38,:41-46` | school dashboards read `total_students` |
| `academic_rollover_daily` | `tasks/academic_rollover.py:12` | default (implicit) | 00:05 daily | `task_lock("academic-rollover", 6h)` `:13` | **`students.class_id/section_id/academic_year_id/status`, `academic_years.is_current`** `:100-109` | everything academic |
| `gamification_streak_update` | `tasks/streak_updater.py:9` | default (implicit) | 00:30 daily | **none** | **nothing** — commits an empty transaction `:77`; only emits `gamification.streak_milestone` `:69-75`. Does **not** update `students.current_streak`/`longest_streak` (`student.py:119-120`), which therefore stay 0 forever | listeners only |
| `sitemap_rebuild` | `tasks/sitemap_rebuild.py:8` | default (implicit) | 02:00 daily | **none** | `school_websites.customizations["sitemap"]` `:62-65` | **nobody in this repo** — no reader of `customizations["sitemap"]` |
| `db_backup_daily` | `tasks/db_backup.py:33` | default | 03:00 daily | **none** | R2 object + `system_settings["last_db_backup_at"]` `:93-98`; prunes to 30 (`:162-185`) | `api/v1/db_backup_api.py` |
| `dispatch_ai_insights_weekly` | `tasks/ai_insights_weekly.py:41` | default | Sun 06:00 | **none** | nothing (fan-out) | queues `ai_insights_weekly` |
| `ai_insights_weekly` | `ai_insights_weekly.py:6` | default (implicit) | — | **none** | **Redis cache `weekly_report:{school_id}` only** `:16` — the `weekly_insight_reports` table is never written | **nobody** — 0 readers of that cache key |
| `calculate_risk_scores` | `ai_insights_weekly.py:24` | default (implicit) | — | **none** | Redis `risk_scores:{school_id}` `:33` | **nobody**; 0 call sites |
| `dispatch_admission_followups` | `tasks/admission_followup.py:73` | default | 09:00 daily | **none** | nothing (fan-out) | queues `admission_followup` |
| `admission_followup` | `admission_followup.py:7` | default (implicit) | — | **none** — re-running re-SMSes | `admission_inquiries.status="followed_up"` `:35` (String column, value outside the documented set) | admission UI |
| `admission_pipeline_cleanup` | `admission_followup.py:42` | default (implicit) | — | none | `admission_applications.status="rejected"` + remark `:63-66` | **0 call sites** |
| `poll_firebase_gps` | `tasks/gps_firebase_poller.py:46` | **gps** | every 15 s, `expires=14` (`app/__init__.py:352-357`) | `task_lock("poll-firebase-gps", 14)` `:47`; skips already-persisted fixes via `MAX(timestamp)` `:107-112` | nothing directly | queues `process_gps_data` + `check_geofence_alerts` |
| `process_gps_data` | `tasks/gps_processing.py:42` | **gps** | — | **none** (duplicate fixes insert duplicate rows) | **`gps_logs`** `:79-91` | Socket.IO `gps_update` `:93-104` + transport API |
| `check_geofence_alerts` | `gps_processing.py:114` | **gps** | — | none | nothing | `send_push_to_school` with **3 non-existent roles** `:176` → delivers to nobody |
| `send_sms` | `tasks/sms_sender.py:41` | notifications | — | none | `sms_logs.status/provider/cost/sent_at` `:29-35` | SMS UI |
| `send_single_sms` | `sms_sender.py:89` | notifications | — | retries 3× exp. backoff `:110-111` | nothing (delegates) | 1 call site |
| `send_bulk_sms` | `sms_sender.py:114` | notifications | — | none | nothing (fan-out) | 2 call sites |
| `send_whatsapp` / `send_whatsapp_text` | `tasks/whatsapp_sender.py:5,35` | notifications | — | none | nothing — **does not write `whatsapp_messages`** | 0 call sites; **`current_app.config["WHATSAPP_ACCESS_TOKEN"]` is read with `[]`** (`:11,:41`) so a missing key raises `KeyError` instead of degrading |
| `send_push_notification` | `tasks/push_notifications.py:13` | notifications | — | none | nothing — **does not write `push_notifications`** | called from `fee_reminders.py:264` |
| `send_push_to_school` | `push_notifications.py:43` | notifications | — | none | nothing | `gps_processing.py:172` |
| `send_push_bulk` | `push_notifications.py:75` | notifications | — | none | nothing | 0 call sites |
| `expire_trials` | `tasks/trial_expiry.py:10` | default (implicit) | hourly `:00` | **none** (idempotent by predicate) | `school_plugins.active=False`, `uninstalled_at`; **invalidates `school:{id}:plugins`** `:57` | `resolve_school` plugin list |
| `sync_website_cache` | `tasks/website_sync.py:6` | default (implicit) | — | none | Flask-Cache `website_config:{school_id}` `:15` | website builder service |
| `generate_sitemap` | `website_sync.py:21` | default (implicit) | — | none | nothing (returns URLs) | **0 call sites** |
| `website.sync_school_data` | `tasks/website_live_sync.py:28` | default (implicit) | — | retries 3× `:67` | Redis `website:public:{slug}:{school,notices,settings,pages}` + `website:sitemap:{slug}` + `website:last_sync:{id}` | **nobody reads any of those keys** |
| `website.bulk_sync_all` | `website_live_sync.py:248` | default (implicit) | **not scheduled** (docstring says "every 30 min" `:250`) | none | fan-out | — |
| `generate_report_card_pdf` | `tasks/report_generation.py:14` | default | — | filter-then-upsert, **no UQ** `:142-147` | **`report_cards`** + uploaded PDF/HTML `:149-187` | report-cards UI |
| `generate_bulk_report_cards` | `report_generation.py:199` | default | — | none | `report_cards.rank_in_class`/`rank` (competition ranking `:228-243`) | 1 call site |
| `export_emis_data` | `report_generation.py:258` | default | — | none | **`emis_exports`** + CSV upload `:343-351` | 0 call sites |
| `generate_compliance_report` | `report_generation.py:363` | default | — | none | **`compliance_reports`** `:427-434` | 0 call sites |
| `process_plugin_event` | `tasks/__init__.py:5` | default | — | none | nothing | 1 call site |
| `process_plugin_event_for_school` | `tasks/__init__.py:13` | default | — | none | nothing | plugin event bus |

### 7.1 Task-layer defects

| # | Defect | Evidence |
|---|---|---|
| T-1 | `website_live_sync.py` calls **`create_app()` inside the task body** (`:38-39`, `:251-252`) — a second Flask app per task execution, re-running all four boot seeds (§1.7) and re-mounting all plugin blueprints, every time the task runs | `website_live_sync.py:38-41`, `:254` |
| T-2 | `website_live_sync.py` uses `@shared_task` while every other module uses `@celery.task`; combined with T-1 the `ContextTask` wrapper (`app/__init__.py:366-371`) is bypassed | `:28`, `:248` |
| T-3 | `website_live_sync` reads `School.id`/`Notice.id`/`WebsitePage.id` as JSON-serializable ints and types `school_id: int` (`:29`) — **the PKs are UUIDs**, so `json.dumps` raises `TypeError` on the first cache write | `:78`, `:108`, `:152` vs `base.py:17` |
| T-4 | `website_live_sync` reads **`Notice.is_published`** (`:101`) and **`Notice.category`** (`:111`), neither of which exists on the model (`notice.py:21-41` has `published_at`, `notice_type`) → `AttributeError` | `:101`, `:111` |
| T-5 | `website_live_sync` filters `WebsitePage.filter_by(school_id=…, is_published=True)` — fine — but `bulk_sync_all` joins on `SchoolWebsite.is_published` without `is_deleted` filters | `:143-148`, `:255-260` |
| T-6 | `generate_compliance_report` filters `User.role.in_(["teacher","staff","principal","admin"])` — `principal`/`admin` are **not** in the `user_role` enum → `DataError` at query time | `report_generation.py:379` vs `user.py:26-38` |
| T-7 | `check_geofence_alerts` haversine has a **variable-name bug**: `dlon = math.radians(lon2 - lat1)` (should be `lon2 - lon1`) → every distance is wrong, so geofence alerts fire arbitrarily | `gps_processing.py:149` |
| T-8 | `check_geofence_alerts` targets `roles=["admin","principal","transport_manager"]` — none exist | `gps_processing.py:176` |
| T-9 | `gamification_streak_update` never writes any streak; the `while True` loop is unbounded and issues one query per student-day | `streak_updater.py:46-77` |
| T-10 | `analytics_aggregate_daily` computes attendance rate and fee totals then throws them away; assigns `total_students` twice; commits inside the per-school loop | `analytics_aggregate.py:38-55` |
| T-11 | 9 beat-scheduled tasks have **no lock**: `attendance_alerts_daily`, `library_overdue_check`, `analytics_aggregate_daily`, `gamification_streak_update`, `sitemap_rebuild`, `db_backup_daily`, `dispatch_ai_insights_weekly`, `dispatch_admission_followups`, `expire_trials` — with `task_acks_late=True` a worker restart re-runs them | `app/__init__.py:296` + task decorators |
| T-12 | `admission_followup` has no dedupe: any re-run re-SMSes every `status="new"` inquiry older than 3 days | `admission_followup.py:18-36` |
| T-13 | `admission_followup.py:16,50` do `datetime.now(timezone.utc).replace(tzinfo=None)` and compare against `created_at`/`updated_at`, which are **TIMESTAMPTZ** — mixing naive and aware in the same predicate | vs `base.py:23-31` |
| T-14 | `admission_followup.py:1` places `from datetime import timezone` **above the module docstring**, so the file has no `__doc__` | `:1-2` |
| T-15 | `whatsapp_sender` reads config with `[]` instead of `.get()` → `KeyError` when unset | `whatsapp_sender.py:11,41` |
| T-16 | `db_backup_daily` opens a file handle inline as `stdout=open(raw_dump,"wb")` and never closes it | `db_backup.py:61` |
| T-17 | `_extract_password` parses the DB URL by hand and never URL-decodes | `db_backup.py:124-133` |
| T-18 | `process_gps_data` has no idempotency: a re-delivered fix inserts a duplicate `gps_logs` row | `gps_processing.py:79-91` |
| T-19 | `send_fee_reminders` stamps `last_reminder_sent_at` per row but commits **once at the end** (`:280`); a mid-loop crash loses every stamp while the SMS tasks are already queued | `fee_reminders.py:277-280` |
| T-20 | The two `ai_teacher` plugin tasks (`reconcile_lessons`, `purge_transcripts`) are **plain functions with no `@celery.task` decorator** and no beat entry — the manifest declares `tasks: [app.plugins.modules.ai_teacher.tasks]` and the module docstring claims "registered on the default queue via the manifest tasks[] header", but `PluginLoader` only *validates that the path exists* (`loader.py:223-226`); it never imports or registers it. Neither task can ever run. | `app/plugins/modules/ai_teacher/tasks.py:13,66`; `loader.py:223-226`; `app/__init__.py:300-363` |

### 7.2 Beat schedule (14 entries, `app/__init__.py:300-363`)

`08:00` fee reminders · `16:30` attendance alerts · `07:30` library overdue · `1st 00:10` payroll ·
`00:20` analytics · `00:05` academic rollover · `00:30` streaks · `02:00` sitemap · `03:00` db backup ·
`00:45` auto monthly fees · `Sun 06:00` AI insights · `09:00` admission follow-ups ·
`every 15 s` Firebase GPS (queue `gps`, `expires=14`) · `hourly :00` trial expiry.

<!-- SECTION_2_ANCHOR -->







