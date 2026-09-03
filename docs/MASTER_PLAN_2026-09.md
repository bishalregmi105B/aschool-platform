# ASCHOOL MASTER IMPLEMENTATION PLAN — 2026-09-03

**Status:** Research + deep audit complete. No code has been changed. Every finding below is evidence-backed (file:line) in `audits/deep2026/`.
**Audience:** AI coding agents / developers who will implement. Each work item is self-contained: problem → evidence → exact change → acceptance criteria. Evidence bank: `audits/deep2026/00–08` (08 = API supplement + research top-up; 07 = market research).

**Companion spec:** `docs/AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md` (codename `ai_workbench`) is the deep spec for the AI Teaching & Learning Ecosystem — the ~65-tool teacher/student AI suite shipped as one plugin. It is **required reading together with this plan** and is integrated below as **Phase 2b (work items AW-01…AW-12)**. Its dependency contract (A-01, A-02, A-03, A-04, A-05, A-06, A-07, §10 plugin architecture, D-06) is already part of this plan; where the two documents touch, the ecosystem doc is the detailed spec and this plan holds the sequencing, gates, and cross-phase wiring.

---

## 0. HOW TO USE THIS PLAN

1. **Read `audits/deep2026/` first** — `00_OWN_FINDINGS.md` (repo-level), `01_FRONTEND.md`, `02_FLUTTER.md`, `03_AI.md`, `04_DATAMODEL.md`, `05_PLUGINS.md`, `06_BACKEND_INFRA_WEBSITE_DESIGNER.md`, plus the prior `audits/MASTER_PRODUCTION_AUDIT_2026-08-30.md` (⚠️ partially stale: lockout 500 E237 is FIXED, M1 push-init is FIXED in code but dead in CI config).
2. Work items have stable IDs (`S-xx` security, `D-xx` data, `P-xx` platform, `A-xx` AI, `F-xx` frontend, `M-xx` mobile, `W-xx` website, `N-xx` Nepal moat, `I-xx` innovation). Implement in phase order; within a phase, P0s before P1s.
3. **Every change must update `audits/AUDIT_INDEX.md`** (project rule in `.cursorrules`).
4. Do not rewrite the things marked ✅ GOOD (section 12). They are correct and commented for specific reasons.
5. Every backend change gets a pytest; every frontend fix gets a jest or RTL test where feasible; every Celery change gets a task-behavior test. Tests are the acceptance criteria.

---

## 1. SYSTEM SNAPSHOT (verified)

| Layer | Reality |
|---|---|
| Backend | Flask 3 + SQLAlchemy 2 (Postgres 16 + pgvector *installed, unused*) + Redis + Celery + Socket.IO. 68 blueprints, **680 routes**, 161 model classes / 158 tables, 32 migrations, single head `c7d9e1f3a5b2` |
| Frontend | Next.js 14 App Router, **222 pages** (192 dashboard), 71.5k LOC, TanStack Query everywhere, plugin-driven sidebar from YAML manifests, 10 themes, fabric-v6 designer, TipTap writer |
| Mobile | 5 Flutter apps + `aschool_shared`. 129 routes / 124 screens: 47 full, 66 partial, 5 stub |
| Plugins | **59 manifests** (46 published), filesystem-as-catalog, per-school `SchoolPlugin` rows, 300 s Redis gate cache |
| Tests | 389 backend tests (money paths well-tested; **beat tasks and website surface ~untested**), 9 frontend files (0% coverage of `app/`), 4 real Flutter test files |

**The five structural themes of everything that follows:**
1. **Money integrity** — no ledger (partial payments live in a parseable substring of an admin-writable `notes` field), duplicate receipt numbers, enum drift, discounts silently skipped, unverified subscription payments.
2. **Entitlement inversion** — anyone can self-register as `plan:"pro"` and receive NPR 2,879/mo of paid plugins forever; `/subscribe` accepts typed-in fake transaction IDs; premium analytics completely ungated.
3. **Silent failure everywhere** — 20 Celery tasks on an unconsumed queue, backups never ran (pg_dump not installed), token revocation fails open, WhatsApp webhook signature always skipped, `except: pass` swallowing billing logic.
4. **AI is one gateway + 21 prompt wrappers, half unreachable** — no structured outputs, no validation, temperature 1.0 on grading, no question bank, no curriculum data, pgvector 100% unused, 4 AI pages with UI contracts that can never render success.
5. **No shared frontend layer** — 85 pages hand-roll the same table/loading/error/empty triad; no error.tsx anywhere; dark mode unreachable dead code; zero i18n despite a Nepali-first product; three role portals that are "Coming soon" cards.

---

## 2. PHASE 0 — STOP THE BLEEDING (P0 security/money/data; ~2 weeks, do in this order)

### S-01 Tenant isolation on `X-School-Slug` (and subdomains)
**Evidence** `app/__init__.py:339-345` — header sets `g.school_id` with zero cross-check against the JWT claim or `g.current_user.school_id`. Valid school-A token + `X-School-Slug: school-b` = full read/write of school B. No test exists.
**Change** in `_set_school_context()`: after resolving school, if `g.current_user` and `g.role != "superadmin"` and `str(g.current_user.school_id) != str(school.id)` → 403. Apply to all three resolution paths (subdomain, header, JWT-fallback).
**Accept** new `tests/test_tenant_isolation.py`: token(A)+header(B) → 403 on students/fees/marks endpoints; same-school → 200; superadmin → 200 anywhere.

### S-02 Anchor the CORS/CSRF origin regex
**Evidence** `app/__init__.py:107` `rf"https://[^./]+\.{_re.escape(_base)}"` — empirically verified: `https://demo.brighternepal.com.attacker.example` receives `Access-Control-Allow-Credentials: true`; same list is the CSRF allowlist.
**Change** `rf"^https://[^./]+\.{_re.escape(_base)}$"`.
**Accept** test asserting the attacker origin is rejected, the legit subdomain is allowed.

### S-03 Secrets and prod validation
**Evidence** `config.py:33,43` literal fallbacks; `validate()` allowlist `{"change-me","change-me-jwt",""}` does not match actual `.env` placeholders (`change-me-to-a-random-string`, `change-me-jwt-secret`) → **prod boot passes with published placeholders**. `validate()` runs only when `FLASK_ENV=="production"`; default is development.
**Change** (a) in `BaseConfig`, if `FLASK_ENV not in ("development","testing")` and any secret is empty → generate per-process `secrets.token_urlsafe(48)` + log a loud warning; delete literals. (b) `validate()`: require `len(secret) >= 32`, reject any value appearing in `.env.example`. (c) extend `validate()`: `ISR_REVALIDATE_SECRET` non-empty, `POSTGRES_PASSWORD` non-empty, `FLOWER_PASSWORD` non-empty, `STRIPE_WEBHOOK_SECRET` non-empty **iff** Stripe enabled, `R2_*` set iff `FILE_STORAGE_BACKEND=r2`, `WHATSAPP_APP_SECRET` set iff WhatsApp token set.
**Accept** boot with example values → RuntimeError naming the offender.

### S-04 Cookie Secure + CSRF posture
**Evidence** `auth.py:83-87` reads `current_app.config.get("FLASK_ENV")` — key doesn't exist in Flask 3 → `secure` always False. `JWT_COOKIE_SECURE=False` hardcoded (`config.py:56`), `JWT_COOKIE_CSRF_PROTECT=False` (`:58`).
**Change** add `ENV = config_name` to each config class; `secure = current_app.config["ENV"] == "production"`; set `JWT_COOKIE_SECURE` from the same. Decide: keep SameSite=Lax but add CSRF double-submit for cookie-auth mutating routes, OR scope cookies to the app host only (not `.base`) — implement one, document why.
**Accept** `/auth/login` response sets `Secure` in prod config; test asserts it.

### S-05 Token revocation must fail closed / succeed correctly
**Evidence** `models/revoked_token.py:52,59` naive-vs-aware comparison, wrapped by `except Exception: return False` (`app/__init__.py:93-97`) → logout silently does nothing. Same bug family: OTP expiry `auth_service.py:124` (500), unguarded `.replace(tzinfo=)` in `assignments.py:360` and `plugins/billing.py:110`.
**Change** short term: `datetime.now(timezone.utc).replace(tzinfo=None)` at both comparisons; remove the bare `except: return False` (let a real DB error 500 loudly). Long term: Phase 1 D-02 migrates all timestamps to `TIMESTAMPTZ`.
**Accept** `tests/test_auth.py`: login → logout → old access token rejected with 401.

### S-06 OTP hardening
**Evidence** `auth_service.py:64` `random.choices`; `:111-157` no verify-side attempt counter (deleted on success, never checked), non-constant-time compare.
**Change** `secrets.choice` per digit; add `otp_attempts` increment + lock at 5; `hmac.compare_digest`.
**Accept** 6 wrong OTPs → OTP invalidated with a clear error; 7th send allowed only after cooldown.

### S-07 Socket.IO connect auth
**Evidence** `app/realtime.py` — no `connect` handler; `join_school` joins any `school_id` from client payload. Live child-bus GPS, emergency alerts, attendance/marks/fee events are cross-tenant readable. (Independently found by two audits.)
**Change** add `@socketio.on("connect")` that verifies JWT (cookie or `Authorization`), stores `session["school_id"]` + role, `disconnect()` on failure; `join_school` **ignores the client value** and joins only the session's school; superadmin may pass an explicit school_id after ownership check.
**Accept** test with a socket client: unauthenticated connect dropped; token(A) join(B) refused; join(A) receives events emitted for A only.

### S-08 AI + public-form rate limiting, ProxyFix
**Evidence** zero `@limiter.limit` in the codebase; `ai_rate_limit` defined (`utils/rate_limiter.py:101`) and applied nowhere; no `ProxyFix` → all clients share the nginx IP bucket; nginx keys zones on `$binary_remote_addr` behind Cloudflare = always 127.0.0.1.
**Change** (a) `app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)`; (b) nginx: `real_ip_header CF-Connecting-IP` + `set_real_ip_from` Cloudflare ranges, and `X-Forwarded-For $proxy_add_x_forwarded_for`; (c) `@limiter.limit("5/minute")` on `/auth/login`, `/auth/send-otp`, `/auth/student-login`, `/auth/forgot-password`; (d) `@ai_rate_limit(20, 3600)` keyed `(school_id, user_id)` on **every** AI route; (e) `@limiter.limit("5/hour;20/day", key_func=slug+IP)` on public contact/admission-inquiry/result-check.
**Accept** hammering `/auth/login` → 429; AI route → 429 with quota-shaped body.

### S-09 Delete the lying domain-verify stub; use the real one
**Evidence** `website_builder.py:695` unconditionally sets `domain_verified=True`; `:657-677` accepts `domain_verified` from the body; `:645` `ssl_active: True` hardcoded. The correct implementation exists: `services/website/white_label.py:384-490` (real dnspython CNAME+A, three-way verdict). `School.custom_domain` has **no unique constraint** (`c1f55f2f9905_initial.py:94`) and no collision check → domain hijack.
**Change** (a) delete `POST /website-builder/domain/verify`; point the builder UI at `POST /schools/white-label/domain/verify`. (b) never accept `domain_verified` from request bodies. (c) migration: `CREATE UNIQUE INDEX uq_school_custom_domain ON schools (lower(custom_domain)) WHERE custom_domain IS NOT NULL AND is_deleted = false` → 409 on collision. (d) add TXT-record ownership proof (`_verify.<domain>` TXT with per-school token) alongside CNAME. (e) `ssl_active` reflects real state (false until TLS exists; see S-10).
**Accept** claiming an already-claimed domain → 409; verify with no DNS → `pending`.

### S-10 TLS (blocker for custom domains + cookies)
**Evidence** all 4 nginx server blocks `listen 80` hardcoded to brighternepal.com; no 443, no certs, no ACME; docs reference an `nginx/ssl` mount that doesn't exist; Cloudflare→origin is plaintext.
**Change** add TLS at origin (certbot/Caddy sidecar or Cloudflare Origin CA), a default-catch-all server block that 421s unknown hosts, `listen 443 ssl` everywhere, real `./nginx/ssl` mount, and document Cloudflare Full (strict). Add a CSP on Next HTML responses (`next.config.js headers()`): `default-src 'self'` + allowances for Google Fonts/maps iframes, `frame-ancestors 'none'` for dashboard routes.
**Accept** `curl -I https://<slug-domain>` → 200 with `Strict-Transport-Security`; unknown host → 421.

### S-11 Stored XSS via `customizations.colors` (cross-tenant)
**Evidence** `PUT /website/config` (`website.py:329-387`) setattrs `customizations` wholesale; `layout.tsx:157-164` interpolates `colorOverrides.surface` + `generateThemeCSS` colors into `<style dangerouslySetInnerHTML>` **unsanitized** while the sibling `custom_css` is sanitized on both sides. `COOKIE_DOMAIN=.base` + same-origin API on school subdomains ⇒ superadmin visiting a malicious school site executes attacker JS as themselves.
**Change** (a) backend: validate every `customizations.colors.*` against `^#([0-9a-fA-F]{3}|{6})$` in `update_website_config` and `ThemeEngineService.synced_colors/apply_theme`; replace wholesale setattr with an allowlist of the keys the product reads; (b) frontend: wrap the whole concatenated CSS block in `sanitizeCss()` (the editor at `editor/page.tsx:441-444` already does — mirror it), hex-validate `surface`; (c) prefer `style={{'--color-primary': …}}` on the wrapper div (React escapes; no `</style>` escape exists); (d) apply the same to `EditorSectionRenderer`'s `about_us` path once liveData is wired (currently latent).
**Accept** test: setting `colors.primary` to the `</style><script>` payload stores a rejected/neutralized value; public page contains no `</style>` injection.

### S-12 Publish/serve authz on the website surface
**Evidence** `GET /website/public/<slug>/pages/<page_slug>` (`website.py:253-257`) and the home lookup (`:205-207`) filter school+slug+is_deleted but **not `is_published`** → drafts are public. Public gallery (`:138-160`) returns **all** school images with no `is_public` filter (scanned documents leak). `/uploads/<path>` (`app/__init__.py:615-620`) serves the upload dir unauthenticated and never consults `ManagedFile.is_public`; nginx caches it 7d public.
**Change** (a) add `is_published.is_(True)` to both page lookups; (b) gallery: require `is_public == "public"` AND an explicit gallery folder/tag opt-in (add `ManagedFile.in_gallery` bool or a gallery folder convention); (c) `/uploads`: resolve `ManagedFile` by key, enforce visibility (session required for `school_only`/`private`; presign for private), `Cache-Control: private` for non-public.
**Accept** tests: draft page 404s publicly; private file without session → 401/403; gallery payload excludes non-public files.

### S-13 Payment/refund correctness
**Evidence** (a) refund path sets `payment_status="refunded"` which is not in the enum (`fees.py:1958` vs `models/fee.py:70`) → money leaves the merchant account, commit raises `DataError`, ledger unchanged; zero refund tests. (b) `webhooks/__init__.py:591` computes outstanding from raw base while `_apply_fee_payment` uses base+fine−discount → late-fine overpayment silently vanishes. (c) Stripe webhook: no event-id replay guard, no school-ownership check, activates arbitrary slug strings.
**Change** (a) migration adds `refunded` to the enum + write a `FeeRefund` row (new model: student, collection, amount, reason, approved_by, gateway_ref, status) in the same transaction **before** calling the gateway. (b) `total_amount = _collection_payable(collection)` at line 591. (c) `processed_webhook_events(provider, event_id)` table with UQ, inserted in-transaction; verify `metadata.school_id` belongs to the paying session's customer; validate the slug exists + is published + coming_soon guard.
**Accept** tests: refund → ledger shows refund + collection `refunded`; duplicate Stripe event → second call is a no-op; over-fine payment recorded in full.

### D-01 Live data-integrity migrations (bundle the 500s first)
**Evidence** `04_DATAMODEL.md` P0-1/2/6/12: `student_scholarships` has **no migration** (scholarship endpoints 500; discount application swallowed by `except: pass` at `fees.py:2415` → **students silently billed full fees**); `models/__init__.py` never imports `faq.py`/`hostel.py` (autogenerate blind, may drop tables); `designer_document_revisions` created without `is_deleted` (every revision save → `UndefinedColumn`); `qr_pay` in DB enum but not model → `LookupError` on read.
**Change** one migration on head `c7d9e1f3a5b2`: create `student_scholarships` (with `ix_…_school_id`, `ix_…_student_id`); add `is_deleted` to `designer_document_revisions`; `ALTER TYPE payment_method ADD VALUE 'qr_pay'` + add to model enum. Then add the two imports to `models/__init__.py`. Remove the `except: pass` at `fees.py:2415` (fail loud).
**Accept** `alembic upgrade head` on a fresh DB → all scholarship/revision endpoints work; `test_fees_discount_stacking` covers the scholarship path with a real table.

### D-02 Uniqueness constraints (money + identity)
**Evidence** no UQ on `marks(exam,student,subject)` (duplicate marks double every aggregate); `fee_receipts.receipt_number` not unique + `COUNT(*)+1` race (`webhooks/__init__.py:807-818`, `fees.py:2679`); `students` identity columns all nullable-unconstrained; `staff_payroll(school,user,month)` (double payroll); plus 22 more in `04_DATAMODEL.md` §P1-14.
**Change** one migration adding partial unique indexes (`WHERE is_deleted = false`): marks, receipt numbers (per school), student `student_id`/`admission_number`/`(year,class,section,roll)`, staff_payroll, report_cards, academic_years+classes+sections+subjects, buses, houses, student_badges, enrollments, student_progress, immunizations, hub_group_members (+school_id), payment_initiations, timetable grid. Replace count-based receipt numbering with a `school_receipt_counters` row updated `SELECT … FOR UPDATE`, format `{school_prefix}/{fiscal_year_bs}/{seq:05d}` (IRD-expected school-level series).
**Accept** concurrency test: 2 parallel receipts → distinct sequential numbers; duplicate marks insert → IntegrityError handled with a clear 409.

### S-14 Repo hygiene (1 hour)
Delete from git: `backend/tmp_*.py`, `backend/probe_phase2_tmp.py`, `backend/_probe_campus_ops.py`, `backend/tests/{_dbg6_patch,test_dbg_login5,test_dbg_tmp}.py`, `frontend/tsconfig.tsbuildinfo` (+ gitignore it), `class_scoped.pdf`. Add `.dockerignore` to both services (`.venv`, `node_modules`, `.next`, `tests`, `tmp_*`, `*probe*`, `seed_test_data.py`, `uploads`, `celerybeat-schedule`, `.pytest_cache`, `.git`, `templates_demo`). Decide and remove `frontend/templates_demo/` (70 MB GPL sites in the build context) — design intent already captured in `lib/school-website/templates.ts`; keep the "Inspired by" attributions. Remove the two vendored PHP ERPs from disk (extract their feature checklist — done in `00_OWN_FINDINGS.md` — then delete; "Nulled" pirated code is a legal hazard).

---

## 2b. PHASE 0.5 — BUSINESS-LOGIC CORRECTNESS (from `08_API_SUPPLEMENT_AND_TOPUP.md`; fold into M0)

- **B-01 Marks entry accepts marks above full marks.** `exams.py:630-788` — the (otherwise excellent, E17-class) pre-validation loop checks ids/tenant/teacher-scope but never `theory + practical <= full_marks`; 150/100 stores and grades A+. Add the check to the pre-validation loop with `records[idx]` context. Test: 400 naming the row.
- **B-02 Concurrent marks submissions duplicate rows.** `exams.py:733-737` check-then-insert, no unique constraint, no lock (only 2 `with_for_update` uses exist in the whole API). Covered by D-02's `marks` unique constraint + `ON CONFLICT DO UPDATE` upsert — implement together.
- **B-03 Broadcast silently caps recipients at 500.** `communications.py:339` `_users_for_audience(..., limit=500)` — a school with 800 parents sends "all_parents"; 300 get nothing, no warning. Paginate the audience or return `recipients_capped` in meta + toast.
- **B-04 Library checkout race.** `library.py:175/211/237` — check-then-act on `available_copies`, no lock → negative stock. `FOR UPDATE` on the Book row, or conditional `UPDATE … WHERE available_copies > 0` with rowcount check.
- **B-05 Exam ranks have no tie handling.** `exams.py:972-975`, `:1123-1126` — sequential ranks for equal percentages; Nepali report cards expect competition ranking (1,1,3). Assign `1 + count(strictly greater)`.
- **B-06 Payroll tax is one flat rate on basic** (`hr_payroll.py:225-287`) — documented simplification; the real structure (SSF/PF split, SST slabs, computed on the right base) lands with N-07 staff profiles + C-10 normalization.

Verified-good this pass (no action): attendance `(P+L)/T` math, inclusive VAT extraction (`fees.py:2754`), timetable conflict detection (`timetable.py:176-224`), parent-app child scoping via the Guardian join, promotion status guards.

Research top-ups folded into the plan (from `08`): spec grids model as `BlueprintCell` rows with a copyable "CDC default grid" per grade+subject; `bge-m3` (1024-dim, hybrid dense+sparse) as the embedding for `document_chunks`; Langfuse (self-hostable) for AI observability; batch API for report-card remark runs; WeasyPrint stays the PDF pipeline (Pango shapes Devanagari correctly — Typst still lags on conjuncts); DOCX exporter must set `w:rFonts w:cs` complex-script properties; WCAG 2.2 AA adds 24×24px target size (2.5.8) and accessible-authentication (3.3.8, affects OTP flows) to the frontend a11y sweep; MagicSchool's ~70-tool inventory is the concrete feature checklist for the teacher AI suite (Phase 6).

---

## 3. PHASE 1 — DATA & PLATFORM CORRECTNESS (~3 weeks)

### D-03 Timestamps
All 411 `DateTime` columns → `TIMESTAMPTZ` (three tables already are); `BaseModel` → `DateTime(timezone=True)`; replace all 41 `datetime.utcnow()` sites with `datetime.now(timezone.utc)`; add `server_default=text("now()")` for timestamps, `server_default=sa.false()` for `is_deleted`, `server_default=sa.text("gen_random_uuid()")` for `id` on new tables; fix the 6 subclasses that re-declare `is_deleted` as nullable (`website.py:20`, `lms.py:31,58`, `social.py:196,208,222`); add `TZ=Asia/Kathmandu` to all compose services so `date.today()` in tasks matches beat.

### D-04 Indexes
One migration: index every unindexed FK (226 of them; priority list in `04_DATAMODEL.md` §P1-12), the 12 tenant-leading composites (§P1-13), partial indexes on `is_deleted` for students/users/attendance/marks/fee_collections, `users.email`/`users.phone` (also fixes the login full-scan), `schools.custom_domain`.

### D-05 `academic_year_id` rollout (do BEFORE a school's second year exists)
Add `academic_year_id UUID FK NOT NULL` to the 34 year-critical tables listed in `04_DATAMODEL.md` §P1-19 (`marks`, `report_cards`, `attendance`, `fee_receipts`, `sections`, `subjects`, `timetable_*`, `assignments*`, `book_transactions`, `staff_payroll`, `leave_requests`, `student_progress`, `enrollments`, `quizzes*`, `online_exams*`, `points_logs`, `student_badges`, `student_transfers`, `expenses`, `incidents`, `pt_conferences*`, `health_profiles`, `learning_paths`, `mastery_records`, `alumni`); drop the 6 free-text `academic_year String` columns in favor of the FK; add `for_school_and_year()` helper; backfill from `students.academic_year_id` / `exams.academic_year_id`.

### D-06 Normalize the two money-bearing JSONBs
(a) `fee_structures.fee_items` → `fee_structure_items(fee_plan_id, fee_head_id, amount Numeric(12,2), frequency, due_day_bs)`; (b) `subjects.class_ids`/`teacher_ids` → `class_subjects(school, year, class, subject, subject_type, credit_hours, theory_full/pass, practical_full/pass)` + `section_subject_teachers(section, class_subject, teacher, is_primary)` (this unblocks the whole exam/teacher-scope model and Nepal domain gap C-2/C-4). Money in code: introduce `app/utils/money.py` with `Decimal` helpers; sweep `float()` money math out of `fees.py`/`hr_payroll.py`/`webhooks`.

### D-07 Audit trail
SQLAlchemy `before_flush` listener writing `audit_logs` for a configured table set (marks, fee_collections/receipts, report_cards, payroll, scholarships, students, users, plugins); add `created_by_id`/`updated_by_id` to the sensitive tables missing them (list in `04_DATAMODEL.md` §P1-20); `marks_history` append-only table for grade changes; strip `totp_secret` from `User.to_dict()` and move TOTP secrets out of `permissions` into a `user_mfa` table; remove `permissions` from the `_populate_user` allowlist.

### P-01 Celery: queues, locking, idempotency
**Evidence** 20/44 tasks on the unconsumed default `celery` queue (no `task_routes`; workers `-Q default,ai,notifications,gps`) → 9 beat schedules silently never run (incl. `expire_trials`); no locks; beat schedule is a file in-container (lost on restart → re-fired reminders); fee reminders have no dedupe state.
**Change** (a) `task_routes={"*": {"queue": "default"}}` + add `celery` to `-Q` as transition; (b) `app/utils/task_locks.py`: `redis_lock(key, ttl)` decorator using `SET NX EX`; wrap `send_fee_reminders`, `auto_generate_monthly_fees`, `payroll_monthly_process`, `academic_rollover_daily`, `poll_firebase_gps`, `social_publish_scheduled`, `bulk` tasks; (c) add `FeeCollection.last_reminder_sent_at` (+ check before send) and a `reminder_log`; (d) volume-mount `celerybeat-schedule`; (e) `acks_late=True` + `task_acks_on_failure_or_timeout=False` **after** idempotency exists; set `task_time_limit`; (f) `expires` on the 15 s GPS beat entry; (g) fix `gps_processing.py:149` haversine (`lon2 - lon1`) + alert dedupe window; (h) add `GPSLog` retention task (partition or delete >90 days).
**Accept** integration test: two workers run `send_fee_reminders` concurrently → exactly one send per defaulter; beat restart mid-window → no duplicate sends.

### P-02 Backups/DR
Install `postgresql-client` in the Dockerfile (or run pg_dump via the postgres image); encrypt dumps (`age`/gpg with a key NOT in `.env`); fix retention (`except` → raise); restore drill: `gunzip | psql` documented + scripted + actually executed once; back up `uploads_data` (R2 sync); write real `LAST_DB_BACKUP_AT` to DB; `db_backup_api` superadmin-only; multipart upload.

### P-03 Deploy pipeline
`flask db upgrade` **before** `up -d` (expand-then-contract migrations); health gate on `/ready`; keep previous SHA tag; prune only images older than 2 deploys; auto-rollback `up -d` with previous SHA on failed health check; remove `git reset --hard` (or back up local state first); fix Flower (remove `ports:`, SSH-tunnel only; define `FLOWER_USER/PASSWORD` in `.env.example`; compose fails loudly if unset); CI: remove `|| true` on flutter test, add `pip install --require-hashes` or at least pinned hashes, add image scanning (Trivy), fail on lockfile drift (`npm ci` without fallback in CI; keep fallback in Dockerfile only).

### P-04 Observability
`logging.config.dictConfig` JSON formatter in `app/__init__.py` (level from `LOG_LEVEL`), request-ID middleware (`X-Request-ID` in → logged + echoed, propagated to Celery headers), wire `/ready` into compose healthcheck + deploy gate, add Prometheus `/metrics` (request latency, queue depth, SMS spend, AI tokens, webhook 4xx rate) or minimally statsd, Sentry alerts on: backup failure, queue depth > N, webhook 4xx spike, quota exhaustion.

### P-05 Entitlement & billing repair (the business model)
1. `register_school` **always creates `plan="free"`**; plan upgrades move behind the payment webhook (`PaymentInitiation` mode=plan). Fix B1 (NPR 5,670/mo free for `plan:"enterprise"` self-registration).
2. `/plugins/<slug>/subscribe`: verify the reference against the gateway (services already exist) or restrict to superadmin-recorded offline payments with an approval workflow. Fix B3 (typed fake txn id = permanent plugin).
3. Plan change → `reconcile_plan_plugins(school, plan)`: deactivate rows above the new tier that carry no `last_payment`; enforce `School.status`/`plan_expires_at` in `_set_school_context` (suspended/cancelled → read-only or 402). Fix B5.
4. Repoint the **revenue leak**: `design_studio.py:585/607/627/640/653` gates `digital_content`/`ai_insights`/`ai_tutor` → `ai_suite`. Fix "elibrary(99) unlocks ai_suite(399) AI generation".
5. Trial fixes: `trial_expiry` must not stamp `uninstalled_at`; `/trial` must check a persistent `trial_consumed` flag not `trial_started_at` (B9 infinite trials); add `next_billing_date` enforcement (a daily beat job that lapses unpaid subscriptions).
6. `max_students` derived from plan at signup (B11); SMS `credits_topup` enforced before send (B12).
7. Gate fixes (H1-H7): wrap `fees`/`exams` roots in PluginGate; `@plugin_required("advanced_analytics")` on analytics overview/academic/financial, `benchmarking` on `analytics.py:479`; gate the 6 website-builder subpages + 3 backend theme/section routes; enforce theme `tier:"pro"` in `apply_theme`; gate hr/transport/designer pages; **gate mobile read endpoints** on their owning plugin (parent_app 16 routes, student_app 9, teacher 4); gate `/communications` chat or document it core; add `@school_required` + `@role_required` to all of `faqs.py`.
8. Plugin cache: one shared `_invalidate_plugin_cache` (delete 3 duplicates), `after_commit` listener on `SchoolPlugin` writes, invalidate on `refresh_registry`, add `is_deleted` filter to the gate, fix the per-process `PluginLoader._plugins` (move registry to DB-read with 60 s cache or Redis).
9. Authz sweep: add `@role_required` to the 51 bare endpoints (prioritize `db_backup_api`, files, procurement, gps-logs, online-exam submit, payslip); add object-level owner checks to the 204 read endpoints (payslip, health records, attendance, receipts, marksheet/report-card per-student); append `"superadmin"` to the 83 role lists that omit it; fix `analytics.py` 6 ungated routes.

### P-06 Frontend shared layer (removes ~6-8k LOC and fixes UX class-wide)
1. `app/global-error.tsx`, `app/error.tsx`, `app/not-found.tsx` + per-group (`dashboard/`, `school/[slug]/`, portals) `error.tsx`/`loading.tsx`.
2. Primitives in `components/ui/`: `DataTable` (columns/rows/loading/error/empty/retry/pagination/sortable/responsive-stack), `QueryBoundary` (the 54× repeated triad), `EmptyState`, `ErrorState`, `Pagination`, `Skeleton`, `StatCard`/`StatGrid`, `Breadcrumbs`, `FormField` (RHF+zod + `useId` label pairing + `aria-invalid`/`aria-describedby`), `ClassSectionFilter`.
3. Migrate the 85 table pages to `DataTable` incrementally (start with the 30 pages that have **no isError handling**).
4. Shared query hooks + `queryKeys` factory (`useClasses`, `useStudents`, `useTeachers`, `useAcademicYears`, `useSubjects`) replacing 28×12×11×10 duplicated `useQuery` defs; add optimistic updates (`onMutate`) for toggles/deletes; add `invalidateQueries` to the 29 mutations missing it.
5. Wire dark mode: `next-themes` in `providers.tsx`, toggle in header, delete the dead Zustand store (`lib/store.ts`, 115 lines, zero importers).
6. Delete `.compact-content` (12 `!important`s shrinking all type); define a real type scale.
7. Mobile: sidebar → Radix `Sheet` below `md`, `hidden md:flex` desktop aside, hamburger in header; replace 5 hand-rolled modals with Radix dialog; rebuild `bs-date-input` on Radix Popover with keyboard grid.
8. `cmdk` command palette indexing routes + entities + actions (192 pages need it).
9. eslint: add `jsx-a11y/recommended` + `@typescript-eslint`; then the mechanical sweep: `type="button"` ×188, `aria-label` ×71 icon buttons, skip link, `htmlFor` ×309, `scope="col"` in `ui/table`.
10. Fix the 25 broken nav links (build or remove: all 10 `social-hub`, 5 `ai-tools` subitems, 4 `analytics`, 2 `benchmarking`, 2 `conferences`, 2 `portfolio`), retire deprecated-plugin sidebar entries (9 alias slugs still ship manifests), collapse 12 nav sections → 6-7, surface the 49 orphan pages (certificates/* and communications/* modules first).
11. Security: sanitize `EditorSectionRenderer` draft path; DOMPurify the `ExplorePanel` SVG; run `surfaceOverride` through `sanitizeCss`; validate `header.tsx` notification `action_url` is same-origin/path-relative; fix `app/api/revalidate/route.ts` to fail closed when `ISR_REVALIDATE_SECRET` unset; fix `middleware.ts` 172.0.0.0/8 CIDR.
12. Perf: dynamic-import JSZip/tiptap-stack/recharts/docx; `next/image` migration (26 raw `<img>`); `@tanstack/react-virtual` on the 5 large grids; memo the fees/collect aggregation; gitignore tsbuildinfo; consolidate the 3 font loads; delete the two `<style>:root` re-declarations in `app/page.tsx` and `(auth)/layout.tsx`; fix the broken Mukta `@font-face` (points at a CSS URL) via `next/font/google`.

### F-01 Role portals (the "Coming soon" wall)
Build the 15 stub routes for real (they all have working backend endpoints): parent attendance/results/fees/notices/bus/chat; student timetable/results/library/lms/ai-tutor; teacher attendance/timetable/notices/ai-tools. Replace the fabricated `app/student/page.tsx` (hardcoded teachers, XP, homework — zero API calls) with the real student dashboard. Replace the entirely fake `settings/roles/page.tsx` (hardcoded counts, buttons with no onClick) with a real RBAC editor backed by `users.permissions` (after P-05 audit work) or remove it. Wire the landing demo form (`app/page.tsx:551-602` has no onSubmit — every lead discarded) to a real `DemoRequest` endpoint + inbox. Fix the fake trust badges/contact numbers on the landing page.

### F-02 i18n (Nepali-first is the product claim)
Add `next-intl` (cookie-locale, not `[locale]` routing initially); locale from `User.preferred_language` (field exists, read by nothing); **read `label_nepali` in the sidebar (already transmitted, never read) — one-hour win for all 155 nav items**; extract the ~3,600 strings with a codemod (2,483 JSX nodes + 653 attributes + 498 toasts); parameterize `formatCurrency`/`formatNepaliDate` by locale; fix `<html lang>` to follow locale; per-locale type scale (Devanagari needs +15% line-height and the 11px scale is unreadable); Flutter: add `flutter_localizations` + `.arb`, start with the 4 shared screens; backend `utils/i18n.py` is dead — replace with a real catalog or delete.

---

## 4. PHASE 2 — AI PLATFORM REBUILD (the user's headline ask)

> This phase is the **foundation** for Phase 2b (`ai_workbench` ecosystem). A-01 (token hub v2), A-02 (prompt library/evals), A-04 (curriculum model) and A-05 (RAG) are hard prerequisites for the ecosystem's E0/E2 gates — see the milestone table (M3 → M3b).

### A-01 AITokenHub v2 (foundation for everything else)
Contract: keep `AITokenHub.request(...)` signature, add:
- **Timeouts + retries**: read the declared-but-never-read `AI_TIMEOUT_FAST/QUALITY` and `AI_MAX_RETRIES` from env; pass `timeout=` to both clients; `tenacity`-style bounded retry with backoff+jitter on 429/5xx/connection errors only; circuit breaker per provider (open after N consecutive failures, half-open after cooldown) so a dead Groq doesn't add its full timeout to every call.
- **Atomic quota**: Redis `INCRBY ai:quota:{school}:{YYYYMMDD} {max_tokens}` reservation *before* the call (TTL 48h), reconcile to actual usage after; DB row for the month; move day boundaries to `Asia/Kathmandu`.
- **Cost accounting**: `ai_model_prices(provider, model, prompt_rate, completion_rate, effective_from)` table; `AIUsageLog.cost_usd Numeric(10,6)` + `cost_npr`; enforce quota on **cost**, not tokens (Groq vs Claude differ ~40×); separate per-user and per-feature limits (`ai_user_quotas`, `ai_feature_limits`); make the stored-but-never-evaluated `alert_at` fire an in-app notification.
- **Structured outputs**: provider JSON mode / tool-forcing + a shared `parse_and_validate(schema, text)` helper with one bounded repair retry (replaces the three inconsistent brace-scrape/naked-parse strategies).
- **Prompt/PII hygiene**: always store `sha256(prompt)` + `prompt_version`; persist full prompt/response only for consequential features (grading, remarks, risk) in an access-controlled, retention-limited table; pseudonymise students before sending ("Student A" + local id map) — currently real names go into prompts **and** `ai_usage_logs.metadata`.
- **Streaming**: SSE variant for question-paper/copy generation (infra exists at `api/v1/sse.py`); log usage on stream completion.
- Fix `AI_QUOTA_ENFORCEMENT` parsing (`"1"` silently disables all cost control today); `usage` sums must filter `is_deleted` (or forbid soft-delete on the audit table — correct choice); failed calls logged with partial usage; `_resolve_user_id` replaced with `actor_type` (`user|system|task`); usage written on a dedicated short session (currently commits the caller's half-built state).
- **Provider model from env**: `_call_groq` must read `GROQ_MODEL_FAST/QUALITY` from config (currently hardcoded constants; the env vars are dead).

### A-02 Prompt library + evals
Extract every inline f-string prompt to `backend/app/prompts/<feature>.md` (versioned, with YAML frontmatter: model tier, temperature, max_tokens, output schema, few-shot examples); set **temperature 0.0-0.2 for grading/structured**, ≤0.4 for documents (today every AI call runs temperature 1.0 incl. grading — same answer grades differently on re-run); add 1-3 curated exemplars per feature; add `prompt_version` to usage logs; build a small golden-set eval harness (`backend/tests/ai_evals/`) with LLM-as-judge for: question paper, remarks (en+ne), lesson plan, grading; run in CI nightly (not per-PR).

### A-03 **Question Bank + AI Question Paper Generator v2** (flagship)
Today: one LLM call, f-string prompt, brace-scrape, temperature 1.0, output never persisted, UI dumps raw JSON into a `<pre>`, `instructions` and `question_types` inputs silently dropped, duplicate endpoint gated on the cheaper plugin, `grade:"Class 10"` interpolated unquoted into the JSON exemplar (invalid JSON in the schema).

**New architecture (blueprint-first, bank-backed):**
1. **Models** (migration + `models/question_bank.py`):
   - `QuestionBankItem(SchoolModel)`: school_id, subject_id, class_subject_id (after D-06), chapter/unit, topic, question_text, question_text_ne, type enum(mcq|short|long|very_short|numerical|assertion_reason|case_based|fill_blank|true_false|match), options JSONB, correct_answer, marking_scheme JSONB (step marks), marks Numeric(5,2), difficulty enum(easy|medium|hard), bloom enum(remember…create), competency_code, source enum(ai|manual|past_paper), past_paper_ref (year/board/set), usage_count, times_used_in_papers, discrimination Numeric(4,3) nullable, created_by, is_approved, dedup_hash (sha256 of normalized text) UQ(school, dedup_hash).
   - `PaperBlueprint(SchoolModel)`: school, class_subject_id, exam_type, total_marks, duration_minutes, language enum(en|ne|bilingual), sections JSONB → normalize to `BlueprintSection(blueprint_id, name, instructions_en/ne, choice_rule jsonb {attempt_m, of_n})`, `BlueprintCell(section_id, question_type, count, marks_each, bloom_target, difficulty_target, topic_ids jsonb, weight_pct)`.
   - `GeneratedPaper(SchoolModel)`: blueprint_id, status enum(draft|review|approved|archived), sections_snapshot JSONB, answer_key_jsonb, marking_scheme_jsonb, provenance JSONB (prompt_version, model, provider, cost), approved_by, approved_at.
   - `GeneratedPaperQuestion(paper_id, sequence, cell_id, bank_item_id nullable, question_text, marks, bloom, difficulty, options, answer, scheme)`.
2. **Pipeline** (`services/ai/question_paper_v2.py`):
   a. Validate blueprint server-side → marks arithmetic **guaranteed before any LLM call** (sum(cells) == section marks == total; otherwise 400 with the exact discrepancy).
   b. For each cell: first try the **bank** (filter type/bloom/difficulty/topic, order by usage_count asc, exclude items used in this school's last N papers — spaced reuse); fill the remainder with per-cell LLM generation (cheap tier, temperature 0.3, structured output, ~300 tokens each — parallel via Celery chord) → each generated item is **saved to the bank** with `source="ai"` for review.
   c. Assemble → validate again → persist → return.
3. **API**: `POST /question-bank/items` (CRUD + bulk CSV import), `GET /question-bank/items?filters`, `POST /question-papers/blueprints`, `POST /question-papers/generate`, `POST /question-papers/{id}/approve` (teacher review: edit any question before approval; edits update the bank item), `GET /question-papers/{id}/pdf` + `/answer-key/pdf`.
4. **PDF**: new designer template `question_paper` (header block: board/school, exam name, subject+code, class/section, date BS, time, F.M./P.M., instructions line in Nepali+English; Group A/B/C sections; marks in the margin; internal choice "वा"/OR; two-column MCQ option grid; answer space rules) rendered via WeasyPrint with Noto Devanagari. Add an OMR sheet generator (50/100/200-question layouts, bubble grid, student-id boxes) as a designer template.
5. **UI**: rewrite `ai-tools/question-paper/page.tsx` from JSON-`<pre>` to a blueprint builder (section → cell grid with marks autocalc + running total), a review screen with per-question edit, and Export PDF / Send to Designer actions. Surface the currently-dropped `instructions` and `question_types` inputs. Show estimated AI cost before generate.
6. **Bilingual + Nepal specifics**: `language` param must actually reach prompts with Devanagari script instructions (today Nepali output is unreachable from any web AI page); include the school's real syllabus units from `class_subjects`/curriculum (A-04); Bloom percentages configurable per blueprint (today hardcoded in prose); sets A/B/C = same blueprint, different bank selections, difficulty-balanced.
7. **Fix the gates**: delete the duplicate `design_studio.py:585/607` endpoints (or repoint to `ai_suite`).
**Accept** tests: blueprint validation rejects mark-sum mismatch with the exact cell; generation with bank-only fill makes zero LLM calls; generated paper totals exactly; PDF renders Nepali questions in Noto Sans Devanagari (pdffonts check); two generated papers from the same blueprint share no more than the configured reuse.

### A-04 Curriculum model (grounding for A-03, lesson plans, RAG)
`CurriculumFramework(school_id nullable=platform, board enum(neb|cdc|cbse|ib|custom), grade, subject_code)` → `CurriculumUnit(framework_id, unit_no, title_en/ne, periods, weight_pct)` → `LearningOutcome(unit_id, code, statement_en/ne, bloom)`. Seed the platform-level CDC/NEB frameworks for grades 1-12 core subjects (research-derived; the NEB/SEE subject list is ~139 subjects with THFM/THPM/PRFM/PRPM — store as `SubjectOffering(subject_code, grade, theory_full, theory_pass, practical_full, practical_pass)`). All AI prompts inject the relevant unit/outcome subset; question papers can then be truly syllabus-aligned. School-level overrides via `class_subjects` (D-06).

### A-05 RAG that actually ships (pgvector for real)
Current state: `Student.embedding Vector(1536)` exists, is written and read by **nothing**, has no index, and the provider set (Groq/Anthropic) has no embedding API. Fix:
1. `CREATE EXTENSION IF NOT EXISTS vector` into the migration path; drop `students.embedding`.
2. `document_chunks(school_id, source_type enum(curriculum|textbook|notice|policy|past_paper|lesson), source_id, chunk_index, text, text_ne, embedding vector(1024), tsv tsvector, metadata jsonb)` + HNSW index (cosine) + GIN on tsv + `(school_id, source_type)` btree; **multi-tenant filter always `school_id =`**.
3. Embedding provider: OpenAI `text-embedding-3-small` (or self-hosted `bge-m3`/`multilingual-e5` for Nepali+English; decide in A-06 research) via a new `AITokenHub.embed()`.
4. Retrieval service `services/ai/rag.py`: hybrid BM25+cosine with RRF fusion, top-k rerank, span-cited answers (citation = source_type/source_id/chunk).
5. First consumers: question-paper "align to my syllabus" toggle, AI tutor (homework-helper) grounded on textbook with exam-mode deflection ("this is on your exam — try it yourself first"), school policy Q&A for the parent WhatsApp/website bot.
6. Wire the WhatsApp bot to RAG + replace the keyword-matching auto-replies with LLM+RAG (the frontend "AI Settings" page already exists and its stored `ai_persona` is read by nothing today).

### A-06 AI grading v2 + honesty layer
1. Rubric model: `Rubric(assignment_id)` → `RubricCriterion(name, max_marks, weight, descriptors jsonb)`; grading returns per-criterion `{awarded, max, justification}` with the total derived server-side (today: one number, temperature 1.0, no validation, no audit).
2. **Persist the decision**: write `ai_suggested_marks`, `ai_feedback`, `ai_model`, `ai_prompt_version`, `ai_graded_at` to `assignment_submissions.ai_feedback` (column exists, never written) + `teacher_marks` + `override_reason` on save → gives the AI-vs-teacher disagreement signal and the appeal trail.
3. **Handwritten work**: reject photo-only submissions with a clear message NOW; add vision-model ingestion (photo → transcribed text + confidence) as a follow-up; grade typed text only until then.
4. Validate output server-side: clamp `marks_awarded` to `[0, max]`, recompute percentage + NEB letter from marks; prompt-injection guard (student answer is delimited + rules restated after it; cheap classifier pass on the answer).
5. Copy the **exemplary pattern** from `ai_adaptive_learning` everywhere: deterministic fallback labeled `source="rule_based_fallback"` in UI, teacher override recorded as `source="manual"`, no feature ever pretends a fallback was AI. Apply this to: website designer (delete the `_default_variation` fabrication — quota-exhausted schools currently see three fake "AI-generated" designs), insights, remarks.
6. Fix the 4 broken UI contracts: insights page reads `data.insights` (never exists) → page can never display success; lesson-plan page shows raw JSON (wrong keys); AI-builder crashes on genuine success (`v.copy.hero_heading` undefined); question paper drops `instructions`. Rewrite each against the real service contract.
7. **Delete or wire the 9 orphan services**: `attendance_ai` (ImportError — dead), `plagiarism`, `fee_predictor` (math is meaningless — measures data-entry lag, `due_date` doesn't exist), `risk_detector` (duplicates school_insights with different thresholds), `wellbeing_ai` (hardcoded child-crisis guidance with no clinician review — delete the escalation strings), `sentiment`, `social_ai` (hardcoded posting times), `translator` (token bug `len(text)*3`), `content_gen` (duplicates), `report_remarks` (superseded), `benchmarking_ai` (hardcoded "above_average"). Manifests reference 8 of these by module paths that don't exist — clean `manifests` to match reality.
8. Fix `timetable_solver` honesty: it is marketed as "AI Timetable Generator… clash-free in 30 seconds" but is a greedy loop that assigns all subjects to every section, picks any free teacher regardless of subject, and hardcodes `conflicts: []` while the UI renders a conflict card that can never fire. Either make it real (constraint solver over `section_subject_teachers` + teacher load caps + the 2083 five-day week) or rename it honestly and fix the assignment logic.

### A-07 AI transparency + metering (trust features, cheap)
1. "AI Nutrition Facts" page + per-feature badge: model, provider, data accessed, retention, no-training guarantee, limitations (competitor research: Canvas/Kahoot made this table stakes; EU AI Act Art. 50 bites Aug 2026). **Generalized into an enforced schema by Phase 2b:** every `ai_workbench` tool must have an `AINutritionFacts` row (AW-04/CI gate a); the standalone page renders from the same table.
2. Metered credits with a hard stop: free monthly allowance, features pause at zero, optional top-up — never an overage bill (Arbor's model beats PowerSchool's; for NPR-tier schools an surprise bill = churn).
3. Superadmin cross-tenant AI cost dashboard + global kill switch (nothing exists today; the party paying the bill has no view). Phase 2b extends this down to per-tool granularity via `AIToolAnalyticsDaily`.
4. Guardian-visible AI transcripts for student-facing features + flagged-content alerts (PowerSchool/SchoolAI both treat this as mandatory).

---

## 4b. PHASE 2b — AI TEACHING & LEARNING ECOSYSTEM (`ai_workbench`)

Full spec: `docs/AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md` (§ refs below are to that document). One plugin bundle (~65 sub-capabilities), built on A-01/A-02/A-03/A-04/A-05/A-06/A-07 and gated through the existing plan-tier model. Nothing here calls a model provider directly; AITokenHub is the only door. Work items:

- **AW-01 Registry + orchestrator (ecosystem §5.2, §7.1).** `AIToolRegistry` + `SchoolAIToolSettings` tables; the generic `POST /ai/generate/<tool_key>` dispatcher with guardrail pipeline ordering (input spotlighting → injection detection → AITokenHub call → schema validation + one repair retry → moderation scan → persist). Adding tool #66 = one prompt file + one handler + one registry row + zero routes/pages — assert this with a fixture "test tool" integration test.
- **AW-02 Data model (ecosystem §5).** One migration: `CurriculumTopic` (under A-04), `AIGeneration` ledger (the single provenance row every tool writes; feature tables like A-03's `GeneratedPaper`/A-06's `Rubric` get nullable `ai_generation_id` FK back to it), `AIContentLibraryItem`, `TutorSessionPlan`/`TutorSession`/`TutorMessage`, `IEPPlan`, `AINutritionFacts`, `GuardianAIConsent`, `ModerationFlag`, `AIToolAnalyticsDaily`, narrow `StudentAIProfile`; `mastery_records` gains `curriculum_topic_id`/`source`/`evidence_ref` (extend, don't duplicate). All `SchoolModel`, TIMESTAMPTZ, `academic_year_id`, partial UQs — the D-02/D-03/D-04/D-05 conventions.
- **AW-03 Seed the 8 highest-value planning tools (E0).** Lesson plan, worksheet, exit ticket, rubric wrapper (delegates to A-06), parent-email drafter, differentiation engine (§9.3), study-guide generator, flashcards. Each: one prompt file (en+ne), one handler, one registry row, one Nutrition-Facts row.
- **AW-04 Guardrails + safety layer (ecosystem §11).** Input spotlighting + cheap injection classifier; output schema validation reusing A-01's `parse_and_validate`; moderation flags with `critical` self-harm severity routed to the **existing** wellbeing-alert path (no second alerting mechanism); `GuardianAIConsent` gate before any student-facing tool; no named tutor persona; `StudentAIProfile` stays narrow (no behavioural profiling — DPDP bar).
- **AW-05 Content library + school/district overrides (E1).** Library CRUD + visibility (private/school/district/public_template); `SchoolAIToolSettings.field_overrides`/`custom_prompt_suffix` admin UI (the MagicSchool-Enterprise pattern); per-tool kill switch wired through `enabled=false` → 403 within one request.
- **AW-06 Tutor engine (E2, ecosystem §9.5).** Socratic state machine over `TutorSessionPlan` → `TutorSession` → `TutorMessage`: no plan → no chat (no free-standing chatbot); exam-mode deflection; per-turn pipeline with injection detection on retrieved RAG content; self-harm flags escalate immediately; reflection prompt on close; teacher aggregate monitor (poll, not realtime, v1). **Red-team pass before `ga`** (ecosystem §13.3) with results logged in `known_failure_modes`. **DECIDED (§14.2): ships to all grades at launch — the guardrail/consent pipeline (AW-04) and red-team pass are hard launch blockers, and a moderation-review workflow must be staffed before go-live.**
- **AW-07 IEP drafter (E3, ecosystem §5.6/§9.4).** Strictest gate in the catalog: draft-only status machine; `status=active` requires `reviewed_by` with `can_review_iep` (hard-code to `principal|special_ed_coordinator` until the real RBAC editor lands); evidence-citation required per generated goal; `human_review_required` hard-true, not district-toggleable.
- **AW-08 Capture tools (E3, ecosystem §6.7).** Voice-first Nepali data entry (ASR → structured attendance/marks with confirmation step) and photo→structured-data (paper register/marksheet → review queue, **never auto-commit**); two-stage generation logged as one `AIGeneration`; offline queue-and-sync reusing the M-01.3 outbox pattern (no second offline strategy). **DECIDED (§14.3): providers are Google/Azure cloud ASR + Document-AI-class OCR, added to AITokenHub as new `speech`/`vision` provider kinds with the same quota/cost/logging discipline.**
- **AW-09 PD coach + AI-literacy micro-lessons (E3).** PD coach grounded in the UNESCO teacher framework (seed as `source_type='policy'` chunks, RAG scope pinned); `teacher_pd_progress` checklist join table (not a score); student AI-literacy micro-lessons mapped to the OECD/EC AILit four domains.
- **AW-10 Delivery-time tools (E4, ecosystem §9.7).** Live poll/quiz + think-pair-share prompts: sub-2s presentation surface, ephemeral (aggregate analytics only, not reviewable `AIGeneration` artifacts).
- **AW-11 Standards exports (E4, ecosystem §12).** Caliper-shaped events for every `AIGeneration`/`TutorMessage` from day one (internal event log; the district dashboard reads this, not `ai_generations` directly); QTI 3.0 export over A-03's bank; LTI 1.3 OIDC-launch stub scaffolded (no full build).
- **AW-12 Frontend + mobile surfaces (parallel with AW-01).** `/dashboard/ai-workbench` (catalog grid, generic schema-driven `ToolRunner`, `GenerationReview` with `edit_distance_pct` tracking, `CostEstimateChip` before every generation), `/student/ai-workbench` (session-scoped only), `/parent/ai-transparency` (nutrition facts + consent + transcripts); `<AIQuickAction>` selection-triggered embedding in writer/gradebook/lesson pages (the Brisk pattern — not a v2 nice-to-have); mobile = one role-parameterized feature folder in `aschool_shared` (not five app forks).

**Category-level golden-set evals** (ecosystem §13.1): ~9 sets (one per category, not per tool) added to `backend/tests/ai_evals/`; evidence-grounded tools (report-card remarks, parent emails, IEP) get a **citation-presence check** — every claim about a student must trace to a real record ID.

**Ecosystem CI gates (add to §13's verification):** (a) no tool `status=ga` without an `AINutritionFacts` row; (b) fixture-tool generic-runner test; (c) pseudonymization test — no rendered prompt may contain a student name from that school's `students` table; (d) context-builder tenant-isolation test mirroring S-01; (e) writing-feedback output schema has no `revised_text` field **at the type level**; (f) cost-estimate-before-generate reconciles (within tolerance) with the recorded `cost_usd`; (g) every seeded prompt file has `_en` and `_ne` variants.

**Packaging note:** the registry's `min_plan_tier` supports any split; which tools are free vs `ai_suite` vs a new tier is a founder pricing decision (see §14).

---

## 5. PHASE 3 — WEBSITE BUILDER + PUBLIC SITES

### W-01 Fix the renderer seams (P0s first)
1. One renderer: port the editor's key handling into `SectionRenderer` (`hero.height`, `teachers.columns`, `facilities.subtitle`, `map.show_contact_info`, divider styles, `use_api` gating, `principal.quote`) — the editor currently lies to the user.
2. Key mismatches that break the live site: read `item.name ?? item.title` (programs/facilities cards currently render **empty headings**); `c.message ?? c.quote`; `c.subheading ?? c.subtitle`.
3. **CTAs are dead `<span>`s** — no renderer reads any `*_link` key; render `<a href>` with a scheme allowlist (`/`, `https:`, `mailto:`, `tel:`) routed through `livePath`.
4. Finish the in-progress diff: populate `liveData.pages` in all 3 callers + types; extend to `SchoolNavbar`/footer (nav is hardcoded; custom pages are unreachable); keep hardcoded lists as empty-state fallback.
5. Iframe allowlist for `embed_url` (+ `sandbox`, `referrerpolicy`, `lazy`).
6. Merge `getSchoolData`'s 6 near-identical copies; distinguish "not found" from "temporarily unavailable"; add `loading.tsx`/`error.tsx`/`not-found.tsx` for the segment.

### W-02 Builder capabilities
Draft/live separation (`draft_config` column exists, unused — editor autosaves currently publish to the public internet every 1.5 s); undo/redo in the editor; mobile preview toggle; menu builder; media library (wire the existing `FilePicker`); per-page SEO UI (fields exist on the model, no UI, no reader); template apply as one transactional endpoint (currently 20+ sequential calls, half-wipes on failure, no rollback); version history (`WebsitePageRevision` — the document revision table is the pattern).

### W-03 SEO/analytics/i18n deliverables
`app/school/[slug]/sitemap.ts` + `robots.ts` (wire or delete the two dead Celery sitemap tasks); canonical URLs (4 URLs per school today, zero canonicals); JSON-LD as real `<script>` (currently emitted into a meta map where Google can't read it); `og_image_url` + `google_analytics_id`/`facebook_pixel_id` actually rendered (stored, never rendered today); twitter cards; per-page `generateMetadata`; favicon per school; kill nginx's 5-minute school-page cache (defeats the unpublish guard) or add purge; make the no-store publish guard cheap (10-15 s cache + tag revalidation on publish state); real iframe preview for themes using the existing unused `preview-css`; **i18n for public sites**: select `Notice.title_nepali`/`content_nepali` (exist, never selected), locale-aware renderer, language switcher widget, Devanagari theme fonts (none of the 14 theme fonts covers Devanagari today).
**Missing section types** (priority order): rich-text/free block (the single biggest WordPress gap — anything outside the 17 fixed sections is unbuildable), downloads/documents centre, events widget, video/YouTube embed, FAQ accordion (public FAQ endpoint exists, unused), image+text split, announcement bar, fee structure table, columns/grid container, logo strip, site search.

### W-04 Contact inbox + School profile fields
Persist public contact submissions to a `ContactMessage` model (or the dead `WebsiteFormSubmission`) with `is_read`, an admin inbox page with unread badge, and an email/SMS notification to the school — today the form says "the school will get back to you" and **no human can ever read the message** (it's in `audit_logs`). Add `School.about_us/vision/mission/principal_name/principal_message/principal_photo/principal_designation` (the About section of every school site is permanently placeholder text today via `getattr` defaults) + a dashboard form. Publish notice `attachment_urls` (exists, dropped by the public payload).

---

## 6. PHASE 4 — DESIGNER/WRITER + FLUTTER

### G-01 Designer P0s (verified by execution)
1. `fc.toJSON(CUSTOM_PROPS)` → `toObject(CUSTOM_PROPS)` (4 sites) — fabric v6's toJSON takes no args; **layer names, merge-field tokens, QR payloads and locks are silently destroyed on every save** (verified headlessly).
2. `document_renderer.py`: double-quote style attributes + `html.escape(quote=True)` — restores **all** server-PDF typography (bold/italic/color/images currently dropped).
3. Route writer2 documents away from the fabric renderer in `/export/pdf` (currently exports blank A4s).
4. Bulk: include `template_width/height/canvas_json` in items (non-A4 output currently clipped); fix `_impose_sheet` page-break (`Pages: 1` for 12 cards — **students silently lost**); add Celery + job row + batch limits + per-row error report; pass the section filter; map the `"all"` sentinel; give admit cards/certificates the QR + photo fallbacks.
5. Devanagari: add Noto Sans/Serif Devanagari + Mukta to the canvas font picker; fix 8 writer templates + 12 canvas templates that set Times New Roman/Poppins on Devanagari text; add BS long-form + Nepali-numeral tokens (`format_bs_nepali` exists unused); add `student.symbol_number` **column** (the bulk generator reads it via getattr today and silently prints the admission number).
6. `/writer/research`: define `_esc` (NameError → 502 today) + SSRF guard (private-IP block post-DNS, https-only, redirect cap).
7. Templates: sync `width/height/page_size` in `_ensure_seeded` (file edits invisible forever; a hardcoded workaround for one template proves it bit); strip `canvas_json` from `GET /templates` (2.97 MB); expose `name_nepali`/`tags`/`autofill`; make the 5 unreachable categories visible; JSON-schema-validate `canvas_json`; template versioning.
8. Canvas: autosave + `beforeunload` (work lost on navigation today); snapshot from `PropertiesPanel` (font/color/opacity edits bypass history); cap undo stack by bytes; downscale images before base64; make align/distribute reachable (implemented in the hook, `ElementToolbar` calls methods that don't exist and isn't rendered); single-zoom-independent export DPI.

### G-02 New templates for Nepal (drawn from the Nepal-need matrix)
exam paper + answer sheet + OMR (see A-03), timetable grid, transcript (see N-03), PAN/VAT fee receipt with amount-in-words-Nepali, IRD bill series, logo auto-injection (4 of 40 templates reference `{school_logo}` today), report-card v2 with CAS columns + letter-grade-only mode for basic level, NEB character/transfer certificates with registration number + ledger reference + "issued in lieu of" clause, attendance register with signature column + holiday shading.

### M-01 Flutter P0s
1. **CI**: write `key.properties` from secrets (all 5 published APKs are **debug-signed**); `--dart-define=ONESIGNAL_APP_ID=… API_BASE_URL=…` (push is completely inert without it — no google-services.json, no Gradle plugin, dart-define never passed); versionCode bump (`--build-number`); remove `|| true` from tests.
2. **Icons/splash**: `flutter_launcher_icons` + `flutter_native_splash` (all 5 apps ship the identical default Flutter icon — md5-verified).
3. **Offline attendance + outbox**: local DB (drift) in `aschool_shared`; outbox table with `POST` replay; offline attendance marking with conflict resolution keyed `(class_id,date,student_id)`; explicit sync state UI. This is the single highest-value mobile fix for Nepal (a teacher loses 40 students' attendance on any connection drop today).
4. Fix the 18 endpoint mismatches (list in `02_FLUTTER.md` — `/fees/pay`, `/announcements`, `/student/classmates` etc. are 404s in production); route everything through `safeMapList`/`safeDateTime`; fix the `..removeWhere` crash on `const []` in marks entry.
5. Auth: `logout()` must call `/auth/logout`, disconnect socket, unregister push, invalidate providers; distinguish connection-error from 401 on restore (silent logouts today); add OTP/biometric login screens (methods exist unused).
6. Release: ProGuard/R8, deep links + `assetlinks.json` (payment cannot return to the app today), per-flavor env, commit lockfiles + pin the five `any` constraints, fix the contradictory `web:` overrides, either ship iOS properly (bundle id, usage descriptions, plist background modes) or remove the folder.
7. Web↔mobile parity: admin fees collection + student CRUD (a principal cannot run the school from the phone today), reports hub (literally dumps a raw map), certificates, live bus map, homework authoring; move the ~4,000 duplicated LOC (12 clusters listed in `02_FLUTTER.md`) into `aschool_shared` as role-parameterized screens following the `shared_chat_screen`/`emergency_screen` pattern; convert admin's 18 plain StatefulWidgets to the parent-app provider pattern; promote `_paymentErrorMessage` to shared error copy (41 sites show raw Dio dumps).
8. Realtime: wire the 7 declared-but-unlistened socket events or delete `SocketService` (currently bus tracking polls).

---

## 7. PHASE 5 — NEPAL MOAT FEATURES (nobody in the market has these)

Sequence per the competitor research: this bundle is mandatory (not discretionary) spend for Nepali schools and is absent from every Nepali competitor's roadmap.

### N-01 IEMIS Readiness Engine
Maintain every IEMIS field continuously: add `students.iemis_student_id` (the importer currently stuffs the EMIS id into `students.student_id`, colliding with the roll identifier), `schools.iemis_code/see_code/hseb_code`, `staff_profiles` (C-12 below) with `iemis_teacher_id`, plus the missing EMIS fields (disability card/severity, repeater, scholarship category, distance-from-school, guardian occupation code, ece_attended). One button emits the exact CEHRS/IEMIS Excel; a pre-submission validator catches unreconciled transfers, ghost students, prior-year carry-forward, blank fields, and implausible year-over-year deltas. Converts the twice-yearly 1-day-to-2-week crisis into minutes. (The importer parses Designation/Level/Appointment/TeachingSubject today and **discards them**.)

### N-02 NEB/SEE Assessment Engine
Per-subject THFM/THPM/PRFM/PRPM (139 SEE subjects; 75/25 default, 50/50 for the listed subjects), the Class-12-only theory-35% NG override, A+→NG mapping with credit-weighted GPA, grade-increment re-sit replacement, board registration with symbol numbers (`board_registrations` model — C-7), OCE-format internal-assessment export with **irreversibility warning + two-person sign-off**, grace marks (`marks.grace_marks` + reason + approver — C-8), supplementary exams. The current `nepal_grading.py` bands are correct (verified) but must become **per-school data** (`SchemeGrade`/`scheme_grades` table exists — wire it) not Python constants, and the contradiction (grade B+ / status fail) fixed.

### N-03 Certificate registry
`certificate_issues(school, year, student, type, serial_number UQ per school+type, issued_on_bs/ad, issued_by, snapshot jsonb, pdf_file_id, verification_hash, revoked_at)` — character/transfer/migration/transcript/provisional are serially numbered legal documents that must be reproducible and **verifiable years later**: add a public QR verification page (the result-checker pattern is already good).

### N-04 Fee Compliance Guardrail
Encode the 14 permitted fee headings (2072 directive) in the data model; block heading invention; hard-check admission-fee-once ≤ 1 month's tuition, annual ≤ 2 months, exam ≤ 50% of monthly, materials = 10% once yearly, tuition ≤ 12 months; store the local-government approval per grade per year; inspection-ready pack + refund register. Directly answers a Supreme Court interim order + 753-local-government enforcement drive + Rs 25,000 fines.

### N-05 Fee ledger v2 (completes the money fix)
`amount_paid` column backfilled from the notes markers; receipts as the append-only journal (`SUM(fee_receipts.amount)` is the truth); `fee_installments` + `late_fee_rules` + `concession_policies` + `sponsors` (C-10); refunds + deposits (C-11); `fee_refunds` written before gateway calls; per-school sender IDs and MDR transparency for wallets.

### N-06 BS-native temporal core
Backend already has `nepali-datetime`; frontend has a 2000-2089 table. Consolidate to **one source**: backend exposes `/utils/bs-calendar` (or a shared JSON artifact) consumed by frontend+Flutter; BS date pickers in Flutter (none exist — the only mobile date input is Gregorian); BS in every report/receipt/ledger automatically; fiscal-year rollups.

### N-07 Staff profiles (C-12)
`models/staff.py` is literally `Staff = User`. Real `staff_profiles`: employee_code, designation, staff_type, appointment_status, level/grade, joining/confirmation dates, qualification, teaching licence, PAN, PF/SSF, bank, emergency contact. Payroll and IEMIS staff reporting both need it.

### N-08 Messaging channels (Nepal reality, not the India playbook)
Facebook/Messenger reach 89.6% of Nepali internet users; Viber hit #1 on Play; WhatsApp isn't in the top-10 stats. Add Messenger + Viber adapters to the comms layer with per-family channel preference and cost-aware routing (SMS fallback at NPR 0.50-2.00). Keep WhatsApp (already built) as one channel among four. Plus the SMS fixes from Phase 0/1 (cap, opt-out, DND, quiet hours, UCS-2 segmentation).

---

## 8. PHASE 6 — INNOVATION ROADMAP (competitor-informed; the "what to build next" list)

From the market research (`audits/deep2026/07_MARKET_RESEARCH.md`; Nepal price anchor NPR 599-2,500/mo; AI is free-at-point-of-use globally, so defensible AI must sit on proprietary school data, Nepal curriculum/board logic, or workflow execution):

**Tier 1 (quarter of engineering, impossible for PowerSchool/Toddle to justify, mandatory spend):** N-01..N-04 + A-07 (transparency + honest metering) + published NPR pricing with a per-student calculator (the market norm is "public feature list, private number" — transparency is a wedge; Sycamore/Bromcom prove it works upmarket).
**Tier 2 (teacher time; benchmark: weekly AI users save 5.9 hrs/week — Gallup):** A-03 question papers, A-06 grading with visible reasoning + mandatory teacher approval, evidence-grounded report-card remarks (every sentence linked to the mark/attendance/behaviour record that justifies it, in Nepali + English), real auto-timetable (the 2083 Saturday-Sunday weekend change forces every school to rebuild timetables — a timed, universal, painful event), phone-camera OMR, voice-first Nepali data entry, photo→structured-data (snap a paper register/marksheet → validated records with a review queue), differentiation/reading-level adaptation, meeting notetaker for parent conferences.
**Tier 3 (trust):** N-02 sign-off flows, AI Nutrition Facts, pre-model PII stripping, role-scoped access + immutable audit + rollback-ready AI writes (reasoning trace + approver chain + dry-run preview + one-click reversal — precondition for agents touching records), advisory-only risk scoring **explicitly firewalled from money** (the Nevada at-risk model cut 205,000 students and defunded poor schools — ship the capability with the guardrail as the headline), DPDP-grade minor-consent built now (Nepal's draft PDP Policy 2082 + IT Bill are coming; India's DPDP bans profiling minors outright).
**Tier 4 (differentiation):** **IRT/psychometrics inside the exam module** (item difficulty, discrimination, distractor analysis, DIF, reliability, self-cleaning item bank) — no school ERP anywhere ships this; it makes A-03 compound in quality every term, and pays off on the student side through the `ai_workbench` practice generator (ecosystem §9.2). Teacher-in-the-loop AI tutor on the Edo-State structure (the only rigorous causal evidence: ~0.3 SD in six weeks — the structure, not the model, is the finding) — **this is AW-06, no longer a future idea.** Founder/owner multi-school console (Veda validated demand with its Founder's App); the district custom-tool/prompt-push capability is scaffolded inside Phase 2b (ecosystem §10). Collection-rate intelligence (predict late payers, sequence reminders by channel — pays for the software out of recovered cash; the only ROI argument a principal needs). **MCP server over the school's own data** (Compass + Canvas made "bring your own model to your SIS" a 2026 expectation; converts Big Tech's free AI from competitor into distribution) — sequenced as AW-11/E4 after the in-product catalog is stable, per the ecosystem doc §12.4. Admissions voice agent in Nepali (EduxenOS proved the pattern commercially in South Asia). Municipality/palika tier dashboard (moves from 8,941 private schools to a channel over 25,623 community schools); the multi-school analytics rollup is a `GROUP BY` over `AIToolAnalyticsDaily` once the per-school table exists.
**Standards (international credibility):** LTI 1.3 + OneRoster 1.2 + QTI 3.0 (question interchange — makes A-03/A-04 portable; TAO shipped a full open assessment stack AGPLv3 with zero AI — a build-on-top opportunity) + Google/Microsoft SSO + rostering.

---

## 9. SCHEMA ADDITIONS SUMMARY (from domain gap analysis; full detail in `04_DATAMODEL.md` §Task C)

Priority order: `terms` + `term_result_policy` (C-1) · `subject_groups`/`class_subjects`/`student_subjects`/`section_subject_teachers` (C-2/4, also D-06) · `assessment_components` + component marks (C-5) · `exam_rooms`/`exam_seat_allocations`/`invigilation_duties` (C-6) · `board_registrations` (C-7) · grace/re-exam (C-8) · `certificate_issues` (N-03) · fee heads/plans/installments/late-fee-rules/concessions/scholarships/sponsors (C-10) · `fee_refunds`/`fee_deposits` (C-11) · `staff_profiles` (N-07) · then P1: substitution pay, transfer registry (TC serial, dues-cleared), `families`+sibling linkage (C-15 — most common Nepali concession), guardian custody/comms prefs (C-16), `students.house_id` + `house_points` (C-17 — house system cannot award anything today), `behaviour_records`/`disciplinary_actions` (C-18), `activities`/`activity_enrollments` (C-19), `staff_trainings` (C-20), `leave_types`/`leave_balances`/`holiday_calendar` (C-21 — attendance currently counts festival days as absences), `counselling_cases` with ACL + access log (C-22), `book_copies`/reservations/waivers (C-23), `route_fares`/`transport_enrollments` (C-24), `student_credentials` biometric/rfid (C-25), `gate_passes` (C-26), depreciation + budgets (C-27), vendors/POs/GRNs (C-28), `statutory_reports` normalized Flash I/II/III (C-30), admission tests/merit lists/waitlist offers (C-32), `document_types`/`student_documents` with expiry chase (C-33), mess/canteen (C-34), uniform/book sales (C-35).

---

## 10. PLUGIN ARCHITECTURE COMPLETION (from `05_PLUGINS.md` §10)

1. Registration API: kill the 6-core-files requirement (`STATICALLY_MOUNTED_MODULES`, `SLUG_SECTION_MAP`, `CORE_ALWAYS_SLUGS`, `PLUGIN_SLUG_ALIASES`, `PLUGIN_LABELS`, sidebar order maps) — module manifests should carry section/order/labels; loader derives everything.
2. Scoped hooks `(db, school_id)` + `upgrade(db, from, to)`; call `deactivate` (never called today).
3. Plugin-provided migrations (Alembic integration, version tracking) — `__table__.create(checkfirst=True)` has no upgrade path.
4. Capability system: plugins contribute permissions; `Plugin.visible_to_roles` is dead; the RBAC editor (F-01) becomes real.
5. Settings enforcement: `PUT /config` validates against `config_schema.yaml` (today parsed, rendered, **never enforced** — `{"fines.per_day": "not-a-number"}` is stored and used in float math); schema for `hr_payroll` + `sms_notifications` (billing-relevant, currently arbitrary); materialize defaults; kill the arbitrary key/value editor; `GET /config` needs `@role_required`.
6. Events: implement the declared graph or delete the declarations (manifests use a different naming convention than the code — `fees.collected` vs emitted `fee.paid`); call `register_plugin_events`; wire the 4 orphan events; make `emit_async` the default for fan-out (a notice currently creates up to 500 notification rows and commits mid-request); scope listeners by plugin installation.
7. Marketplace: ratings/reviews, screenshots (columns exist, nothing writes them), real checkout (current one lists what's missing and has a Close button), purge option on uninstall, dependency auto-install with transitive resolution, reverse-dependency check on uninstall.

---

## 11. SEQUENCING & MILESTONES

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M0 (wk 1-2)** | Phase 0 complete | All P0 tests green; tenant-isolation + CORS + secrets + receipts + enum fixes landed; no 500-class data bugs |
| **M0.5 (wk 2)** | Phase 0.5 complete | Marks-over-full validation, marks dedupe, broadcast cap, library lock, rank ties shipped |
| **M1 (wk 3-6)** | D-03..D-07, P-01..P-05 | Celery beat actually runs everything; backups restore-tested; entitlements cannot be self-granted; plugin gates closed |
| **M2 (wk 5-8, parallel)** | P-06, F-01 | error boundaries + shared table live on top-30 pages; portals real; dark mode + palette shipped |
| **M3 (wk 7-12)** | A-01..A-04, A-06, A-07 | Token hub v2 + question bank + paper generator v2 shipped; grading audited; all AI pages render real results; 9 orphans deleted |
| **M3b (wk 8-14)** | **Phase 2b ecosystem E0→E2** | AW-01/02/03 (registry + ledger + 8 planning tools) shipped once A-01/A-02/A-04 land; AW-05 library/overrides once D-06 lands; **AW-06 tutor only after A-05 RAG is live + red-team pass complete** |
| **M4 (wk 10-14)** | W-01..W-04, G-01..G-02 | Renderer unified; contact inbox; SEO deliverables; designer P0s fixed; 10 Nepal templates |
| **M4b (wk 14-18)** | **Ecosystem E3→E4** | AW-07 IEP gate, AW-08 capture tools (needs ASR/vision provider choice, §14), AW-09 PD coach, AW-10 delivery tools, AW-11 Caliper/QTI export; everything else `ga` with Nutrition-Facts rows |
| **M5 (wk 12-16)** | M-01..M-02 | Signed + iconned + offline-capable APKs in CI; parity gaps closed; `ai_workbench` mobile feature folder ships with M-01.3's outbox |
| **M6 (wk 14-18)** | N-01..N-08 | IEMIS engine + NEB engine + certificate registry + fee guardrail demoable end-to-end |
| **M7 (ongoing)** | Phase 6 innovations by ROI | IRT analytics → MCP server (AW-11 scaffold) → palika tier |

**Team parallelization:** backend data/money (1 agent), AI platform (1), frontend shared layer (1), mobile (1), website/designer (1). Phases 0 and 5 need a single reviewer (money + legal surfaces).

---

## 12. DO NOT REWRITE (verified good; preserving comments/invariants matters)

Payment webhook integrity (`webhooks/__init__.py:572-750`: five ordered idempotency rules, per-school credentials, `PaymentInitiation` anchoring, savepoint race guard) · biometric ingestion (reference implementation for atomic batches + replay guards) · multi-branch tenancy (partial UQs with `postgresql_where`) · password-reset flow · `app/utils/password.py` default-password generator · response-envelope discipline (678/680 routes) · `nepal_grading.py` math (tests-verified; needs per-school config, not a rewrite) · `canvasImages.ts` · `lib/sanitize.ts` CSS allowlist · `lib/api.ts` single-flight refresh + middleware "maybe authenticated for routing only" + super-admin server-side re-verification · public-site publish guard (E201) with fail-closed + self-healing retry · `ThemeEngineService.synced_colors` precedence · `WhiteLabelService.verify_domain_dns` (S-09 just needs it wired) · `ensure_default_pages` idempotency · `ai_adaptive_learning`'s honest-fallback pattern (copy everywhere) · plugin discovery/registry architecture · teacher scoping where applied · trial-expiry request-path defense · Celery `Asia/Kathmandu` beat timezone · Devanagari fonts + `fc-cache` in the Dockerfile · `JSON_ENSURE_ASCII=False` · the audit trail discipline in `audits/` itself.

---

## 13. VERIFICATION REQUIREMENTS (applies to every implementer)

1. Every backend fix: pytest covering the **failure mode** (not just the happy path) — tenant crossers, duplicate submits, enum values, naive/aware datetimes, concurrent receipt minting.
2. Every AI change: assert output schema + temperature + provider-fallback behavior; add to the golden-set eval where one exists.
3. Every frontend fix: RTL test for the regression (e.g. the `name ?? title` blank-card bug gets a renderer test feeding registry-shaped data).
4. Every Celery change: prove the task actually runs (queue routing test) + idempotency test (run twice).
5. Run `alembic upgrade head` against a **fresh** DB in CI before merging any migration (would have caught P0-1/2/12).
6. Render one of each artifact to PDF/PNG in CI (question paper, ID card, report card, Nepali notice) and `pdffonts`-check Devanagari embedding.
7. Update `audits/AUDIT_INDEX.md` per the project rule after each work item.
8. **Ecosystem gates (Phase 2b, from `AI_TEACHING_ECOSYSTEM_PROMPT` §5.7/§14):** no tool `status=ga` without an `AINutritionFacts` row; fixture-tool proves the generic runner needs zero new routes/pages; pseudonymization test (no rendered prompt contains a real student name); context-builder tenant-isolation test; writing-feedback schema has no `revised_text` field at the type level; cost-estimate reconciliation; bilingual prompt-file lint.

---

## 14. FOUNDER DECISIONS — **DECIDED 2026-09-03** (was: ecosystem doc §15 open questions)

1. **Tool packaging — DECIDED: fold into `ai_suite`.** All ~65 `ai_workbench` tools carry `min_plan_tier` resolving to the existing `ai_suite` bundle (NPR 399/mo); a small teaser set of planning tools (lesson plan, differentiation, study guide, flashcards — 4 tools) ships free to drive adoption. One AI SKU; the ecosystem doc's registry supports finer splits later without schema change.
2. **Tutor launch scope — DECIDED: all grades at launch.** Consequences locked in: the AW-04 guardrail/consent pipeline (guardian consent gate, moderation, self-harm escalation) and the E2 red-team pass are **hard launch blockers**, not polish; default guardian visibility = `full_transcript` with per-student override; moderation review workflow must be staffed before the tutor goes live. The "no plan → no chat" rule stays universal.
3. **Capture-tool providers — DECIDED: cloud (Google/Azure).** Nepali ASR + Devanagari handwriting OCR via Google Document AI / Azure Document Intelligence / Google STT, routed through **AITokenHub as new provider kinds** (`vision`, `speech`) — A-01's scope grows from text-LLM gateway to model gateway (same quota/cost/logging discipline, same `AIGeneration` ledger rows). Estimated per-call cost must appear in `CostEstimateChip` like every other tool.
4. **District/palika commercial terms — OPEN (non-blocking).** Architecture is ready (AW-05 overrides + `AIToolAnalyticsDaily` rollups); packaging is a business decision that does not gate any build item.
5. **Assessment-half gating repair sequencing — CONFIRMED.** The elibrary(99)→ai_suite(399) leak fix (P-05.4) lands in M1, before any ecosystem tool becomes purchasable; the new registry's `min_plan_tier` gate gets a regression test for the alias-chain class of leak.
