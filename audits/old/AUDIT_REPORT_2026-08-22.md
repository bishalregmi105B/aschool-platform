# ASchool — Full Codebase Audit, Gap Analysis & Market Research

**Audit date:** 2026-08-22 · **Mode:** Read-only · **Auditor:** ox-alpha (autonomous pass)
**Repo:** `/home/bishal-regmi/Desktop/ASchool` · **Last commit lineage:** security patches `0339893` (2026-05-19) → pukarphulara deployment configs `f7e7c7c` (2026-07-12)
**Method:** every claim below was re-verified against current code by direct read/grep; market claims carry source URLs. Items that could not be verified are marked `❓ UNVERIFIED`.

---

## 1. Executive Summary

ASchool is a **multi-tenant Nepali school-management SaaS**: Flask 3 API (546 routes, 146 models, 45 Celery tasks, plugin/marketplace architecture), Next.js 14 web dashboard + SSR school websites (215 pages, ~274 distinct API endpoints consumed), five Flutter apps sharing one `flutter_shared` package, an ESP32 GPS tracker prototype, Docker/nginx infra, and CI/CD.

**Overall completion: ≈66%.** The backend and web dashboard are substantially real and deep; the mobile apps are real but carry config debt; the hardware loop and GPS realtime path are half-built; `flutter_user` is a monolithic shell; and production deploy configs are **broken as committed** (`docker-compose.prod.yml` points Celery at a module that does not exist).

Headline findings:

1. **No live product presence exists.** Both former production domains have been repurposed for unrelated projects: `pukarphulara.com.np` now serves "Vexel" (commerce platform) and `brighternepal.com` serves "JiguBites" (restaurants). No app-store listing or marketing site for ASchool was found.
2. **The 2026-05-19 security patch batch mostly held up:** cross-tenant write/read checks (C1/M2), OTP echo (H1), Flutter compile blockers (H3), refresh race (H4), timing-safe webhook compare (M3) are all verified fixed today. Stored-XSS hardening is only partial (server-side bleach on notices ✅, but zero frontend sanitization and weak regex-based CSS/question filtering).
3. **Latent breakage:** 10 orphaned AI service files call `AITokenHub.generate(...)`, a method that doesn't exist (19 call sites); prod compose references non-existent `app.celery`; WhatsApp Cloud config keys are commented out; frontend socket layer has zero importers.
4. **Docs vs code drift is chronic:** README claims 4 Flutter apps / 58 screens / 29 manifests; reality is 5 apps / ~123 screens / ~60 manifests. Route counts drifted 441 → 481 → "650+" → **546 measured today**.
5. **Nepal-specific core is genuinely implemented** (BS calendar via `nepali-datetime`, NEB GPA grading with theory/practical split, eSewa ePay-v2 HMAC, Khalti v2 incl. refund, FonePay HMAC-SHA512, Sparrow SMS, Devanagari numerals) — this matches or exceeds local-market baselines — except IRD PAN/VAT receipt fields, still missing.

---

## 2. Full Annotated Folder Tree

Sizes include build artifacts; file counts exclude `.git`, `node_modules`, `build`, `.dart_tool`, `__pycache__`, `.venv`, `.idea`.

```
ASchool/
├── backend/            20 MB   Flask 3 API — app factory, /api/v1 (61 route files),
│                               53 model files, 20 Celery task modules, plugin system,
│                               Alembic migrations (18 revisions), 15 pytest files, seeds
├── frontend/          1.9 GB*  Next.js 14 dashboard + SSR school websites (215 page.tsx);
│    │                          * includes node_modules/.next artifacts
│    ├── templates_demo/        ~34 MB third-party HTML school-site templates (reference only)
│    └── themes/                20-theme registry + 2 folder themes for public sites
├── flutter_admin/     301 MB   Admin app — 42 routes / 41 screen files
├── flutter_teacher/   304 MB   Teacher app — 28 routes / 30 files (+web/ target)
├── flutter_parent/    101 MB   Parent app — 23 routes / 22 files
├── flutter_student/   277 MB   Student app — 30 routes / 28 files
├── flutter_user/      542 MB   Unified entry app — single 1,566-line main.dart, 6 stages;
│    │                          only app with ios/linux/macos/windows targets
├── flutter_shared/     12 MB   Shared package `aschool_shared`: models, repositories,
│    │                          services (api_client w/ refresh queue, offline_sync,
│    │                          notifications), widgets, theme, features
├── hardware/           24 KB   ESP32_GPS_tracker: firmware.ino + wiring_diagram.md + README
├── nginx/              12 KB   nginx.conf — 4 server blocks for pukarphulara.com.np
├── tests/              24 KB   simulation/ — REPORT md + README pointing at real suites
├── docs/               28 KB   plugin-development.md, deployment.md, DEPLOY_BRIGHTERNEPAL…,
│    └── AUDIT_REPORT_2026-08-22.md  ← this file
├── iemis_templates/    48 KB   Reference templates for IEMIS export format
├── .github/workflows/          deploy.yml — backend/frontend/flutter test + ghcr + ssh deploy
│
│  Third-party / reference products (EXCLUDED from audit per scope rule):
├── eSchool SaaS v1.8.0 Nulled/   806 MB — pirated copy of competitor PHP/Laravel SaaS (reference)
└── Mighty School Pro v1.6/       338 MB — CodeCanyon #57385565 competitor ERP source (reference)

Root files:
├── docker-compose.yml       dev stack: postgres(pgvector)/redis/flask/celery×2/nextjs, no nginx
├── docker-compose.prod.yml  prod: +nginx+flower, explicit env lists, ports 8080→80, 5555
├── Makefile                 16 targets (dev/backend/frontend/test*/seed/worker/beat/clean)
├── .env / .env.example      env config (diffed in §13)
├── host_nginx_aschool.conf  host-level proxy → 127.0.0.1:8080 (Cloudflare terminates TLS)
├── fix_nginx.py             one-off: strip Vexel blocks from nginx.conf (APPLIED, obsolete)
├── fix_server.py            one-off: /opt/aschool repair — ports, de-TLS, domains, new .env
│                            (APPLIED — but baked plaintext DB password into repo)
├── url_map.txt              36 KB dump of Flask url_map @2026-04-26 (441 rules) — STALE
├── backend_route_audit.md   route inventory + stub purge notes (2026-05-04/05)
├── PLAN_AUDIT_2026-04-25.md, FULL_STACK_AUDIT_2026-05-19.md,
│   aschool_audit_part{1..4}*.md, MASTER_IMPLEMENTATION_PLAN.md,
│   IMPLEMENTATION_PLAN.md, implementation_plan.md, ASchool_ULTIMATE_v1.md,
│   ASchool_Copilot_Audit_Prompt.md, previous.md, task.md, walkthrough.md,
│   simulate.md, README.md                prior plans/audits (timeline §4)
├── download.pdf             printed sample grade sheet (Bright Star E.B.S., student ABIRAL BK)
├── image.png                screenshot of teacher-app Marks Entry screen
└── build_full.log, build_output.log, full_build.log, full_build_raw.log
                             4 near-duplicate copies of one successful next build log
```

---

## 3. Detected Tech Stack (per component)

| Component | Stack | Entry point | Evidence |
|---|---|---|---|
| Backend | Python 3.12/3.13, Flask 3.1 app-factory, SQLAlchemy 2, Flask-JWT-Extended, Flask-Limiter, Redis cache, Socket.IO (eventlet), Celery 5 beat, PostgreSQL 16 + pgvector, Alembic, Sentry optional | `backend/wsgi.py:4-6`; factory `backend/app/__init__.py:15-372` | config.py:171-176 |
| Frontend | Next.js 14.2 App Router, TypeScript, Tailwind, Radix UI (16 pkgs), react-query polling, js-cookie auth, Socket.IO client (unwired) | `frontend/app/`, middleware.ts | package.json |
| Mobile ×5 | Flutter 3.x, Riverpod, GoRouter, Dio, shared path-dep `aschool_shared`; secure token storage only in shared pkg | each `lib/main.dart` | pubspec.yaml ×5 |
| Shared | models, repositories, api/services, widgets, theme, features | `flutter_shared/lib/` | §9 |
| Hardware | Arduino C++ on ESP32, NEO-6M GPS (UART1), SIM800L GSM (UART2), Firebase RTDB REST PUT | `hardware/ESP32_GPS_tracker/firmware.ino` | §10 |
| Infra | Docker Compose ×2, nginx (4 server blocks), GitHub Actions (5 jobs), Flower (prod only) | compose files; .github/workflows/deploy.yml | §12 |

---

## 4. Prior Audit Timeline & Claimed State

Chronology reconstructed from all planning/audit docs:

| Date | Doc | Claimed state |
|---|---|---|
| 2026-03-29 | `ASchool_ULTIMATE_v1.md` | Vision spec: 35+ plugins, 20 themes, 4 apps, all-Nepal payments, `{slug}.aschool.com.np`, Yr-3 500 schools / Rs 22.8M ARR |
| 2026-03-30 | `IMPLEMENTATION_PLAN.md`, `README.md`, `docs/plugin-development.md` | 18-week/13-phase plan (43 manifests); README claims 43 plugins, 29 manifests, 7 test files, 58 Flutter screens (15/13/13/17), Fonepay listed as shipped |
| 2026-04-25 | `PLAN_AUDIT_2026-04-25.md` | Verdict "not yet complete": missing billing/trial endpoint, 18 of 20 theme folders, firmware.ino, CI files, 3 Celery tasks; ~40 compat files patched |
| 2026-04-26 | `url_map.txt` | Snapshot: **441 registered rules**, ~37 blueprints — most plugin APIs already routable |
| 2026-05-04 | `walkthrough.md`, `backend_route_audit.md` | Teacher flows done, analyze/test green; 56 route modules, 481 declarations, stub-scan clean; addendum: 449 live probes 0 errors, migrations to `c0a1b2c3d4e5`, "614 tests pass" |
| 2026-05-05 | `task.md` | Phases 0–6 ticked; eSchool/Mighty parity assessed |
| 2026-05-06 | `previous.md`, `implementation_plan.md` | UI-bug transcript (hardcoded attendance %, empty results, String/Map crash); gap table: Flutter 124 dart files vs competitor 843, models 3 vs 85+, repos 0 vs 24; declares backend/web "production-ready", Flutter 7× behind |
| 2026-05-07 | git init + `DEPLOY_BRIGHTERNEPAL_DOMAIN_FINAL.md` | Production cut over to brighternepal.com; old bn-* services stopped |
| 2026-05-09 | `docs/deployment.md` | Claims deploy.yml runs on push to main (it exists) |
| 2026-05-14→17 | commits | Vexel proxies on pukarphulara.com.np; ID-card writer/bulk PNG; BS calendar everywhere; missing plugin pages added; flutter_user served as web at app.brighternepal.com |
| 2026-05-16/18 | `aschool_audit_part1–4` then `MASTER_IMPLEMENTATION_PLAN.md` | Part 1–4: **52/100**, 4/43 plugins production-ready, ~650+ endpoints, 102 Flutter screens, integrations 3/25 wired, FonePay "NO FILE EXISTS", zero `@on()` listeners, 1,480h estimate. MASTER **overturns 8 claims** (FonePay implemented, listeners exist, 211 page.tsx not 97, headers/Sentry/SMS-bulk/password-hint all fine); confirms P0s: no backups, no virus scan, CSP unsafe-inline, **flutter_user empty**; corrected score 62/100, ~787h |
| 2026-05-19 | `FULL_STACK_AUDIT_2026-05-19.md` + `simulate.md` + `tests/simulation/…REPORT…md`; same-day commit `0339893` | Risk High: C1 tenant-write, C2 stored-XSS ×6 sites, H1 OTP echo, H2 JS-readable tokens, H3 Flutter compile blockers, H4 refresh race, M1–M5. Simulation: 12/28 pass pre-patch. Commit claims fixes for all |
| 2026-07-12 | commit `f7e7c7c` | Deployment configs switched to pukarphulara.com.np root domain |

**Contradiction highlights between docs:** FonePay existence (shipped → missing → implemented); event bus (zero `@on()` → 6+ listeners); page count (~97 → 211 → **215 today**); security headers (absent → full set); SMS bulk sync → Celery; screen counts triple-conflict (58 → 74 → 102 → **~123 today**); compliance.py length (7278 vs 201 lines within the same audit batch); domain churn (aschool.com.np → brighternepal.com → pukarphulara.com.np while `.env` still says `BASE_DOMAIN=aschool.com.np`).

**Claimed-State baseline = MASTER_IMPLEMENTATION_PLAN (2026-05-18) + FULL_STACK_AUDIT remediation (2026-05-19).**

---

## 5. Claimed-vs-Verified Findings (re-checked against code today)

Legend: ✅ Confirmed still true · 🟡 Partially true now · ❌ Not true / never true · 🆕 New since last audit

| # | Claim (source doc) | Verdict | Current evidence |
|---|---|---|---|
| 1 | C1 cross-tenant `PUT /schools/<id>` (FULL_STACK_AUDIT) → fixed 05-19 | ✅ Fixed | `schools.py:106-120` superadmin-or-own-school check at :114-116 |
| 2 | M2 broad `GET /schools/<id>` | ✅ Fixed | `schools.py:41-51` (:48-50 returns 403 foreign tenant) |
| 3 | C2 stored XSS raw HTML ×6 render sites | 🟡 Partial | Backend bleach allowlist on notices `notices.py:193-200,215-218` ✅; custom_css regex-blacklist only `website.py:159-165`, injected raw `school/[slug]/layout.tsx:119-129`; **zero DOMPurify/sanitize anywhere in frontend**; raw `dangerouslySetInnerHTML` remains at `SectionRenderer.tsx:146`, `page.tsx:200`, `notices/page.tsx:49`, `news/[articleSlug]/page.tsx:39`, `dashboard/exams/online/questions/page.tsx:170`. Mitigations: `about_us` isn't a School column; news article endpoint doesn't exist (dead page) |
| 4 | H1 OTP echoed in responses | ✅ Fixed | No `debug_otp` in repo; OTP only server-logged when console/DEBUG mode `auth_service.py:72-76`, `auth.py:247-250` |
| 5 | H2 tokens in localStorage | 🟡 Partial | Moved to js-readable cookies `lib/api.ts:24,39,49-50`, `auth-context.tsx:46,71-72,88-89`, `socket.ts:18`; not httpOnly |
| 6 | H3 Flutter compile blockers | ✅ Fixed | `student_attendance_screen.dart:42-47` → `AttendanceRepository().getAttendance` exists `attendance_repository.dart:6`; `NoDataContainer(icon:,title:,subtitle:)` matches ctor `no_data_container.dart:4-14` |
| 7 | H4 token-refresh race | ✅ Fixed | `_isRefreshing` + `_refreshQueue` Completers `flutter_shared/lib/services/api_client.dart:40-41,64-121` |
| 8 | M3 webhook `==` compare | ✅ Fixed | `hmac.compare_digest` `api/webhooks/__init__.py:264`; Stripe delegates to SDK :292 |
| 9 | hostel.py `'Student' has no 'full_name'` | ✅ Fixed | `hostel.py:52` uses first/last concat; fields exist `models/student.py:32` |
| 10 | Duplicate roll accepted | ✅ Fixed | 409 guard `students.py:124-135` |
| 11 | listeners.py JSON-date serialization bug | ✅ Fixed | date isoformat-normalized `plugins/listeners.py:34-36` |
| 12 | Exam question XSS persisted | 🟡 Partial | `_sanitize_question_text` regex strips `<script>` only `exams.py:282-285` (`<img onerror=` survives); AI paper HTML unsanitized end-to-end `design_studio.py:501-520` → rendered raw `questions/page.tsx:170` |
| 13 | MASTER P0-1 no automated DB backups | ❌ Now false | `tasks/db_backup.py` + `db_backup_api.py`; beat daily 03:00 `app/__init__.py:165-168` |
| 14 | P0-2 no virus scan | ❌ Now false | ClamAV integration `file_upload.py:7-9,47`, enforced `files.py:158-164`, `fees.py:330,353-354` |
| 15 | P0-3 CSP unsafe-inline | ✅ Still true (unfixed) | `app/__init__.py:354-357` |
| 16 | P1 no MFA/TOTP | ❌ Now false | Full pyotp flow `auth.py:303-462` |
| 17 | P1 no lockout | ❌ Now false | 5 fails/15 min lock `auth_service.py:119-145,158-163,192-197` |
| 18 | P1 no JWT revocation | ❌ Now false | blocklist checked every request `app/__init__.py:60-68`; logout revokes jti `auth.py:255-269`. Minor gap: refresh rotation doesn't revoke old refresh jti |
| 19 | P1 no password policy | 🟡 | Min 8 + upper/lower/digit on change `auth.py:132-141`; no special-char rule; registration-path enforcement unverified |
| 20 | P1 no cross-tenant tests | ❌ Now false | sec_01/sec_02/module_03/module_06 tests `tests/simulation/test_full_simulation_modules.py:296,308,436,522` |
| 21 | P1 payment idempotency missing | ❌ Now false | `fees.py:1161-1184,1227` idempotency_key replay |
| 22 | P1-7 FonePay webhook route missing | ❌ Now false | `/fonepay/callback` `webhooks/__init__.py:165-166` |
| 23 | P1-9 Khalti no refund | ❌ Now false | `refund_payment()` `khalti_gateway.py:104-128` |
| 24 | IRD PAN/VAT receipts missing | ✅ Still true | Only `validate_pan` util + `school.pan_number` column; nothing in fee receipts |
| 25 | P2 Multi-Branch zero implementation | ✅ Still true | `plugins/modules/multi_branch/__init__.py` = 1-line docstring |
| 26 | P2 Biometric zero implementation | ✅ Still true | same, `biometric/__init__.py` |
| 27 | Social Ads stub (ad_campaign.py 4 lines) | 🟡 | Model lives in `models/social.py` (real); `ad_campaign.py` is a 5-line re-export alias |
| 28 | P2-6/7 no GPS WS streaming, no driver app | ✅ Mostly still true | Frontend listens for `gps_update` `socket.ts:103-107` but backend emits none; gps_tracking module = 1-line stub; `process_gps_data` task defined but never enqueued; no driver app |
| 29 | P0-4 flutter_user empty | 🟡 Superseded | Now a real 1,566-line unified-login shell wrapping the 3 role-app barrels, but still minimal (§8E) |
| 30 | README "43 plugins / 4 apps / 58 screens / 29 manifests" | ❌ Stale | Reality: ~60 manifests, 5 apps, ~123 screens, 61 route files, 546 routes |
| 31 | url_map.txt reflects routes | ❌ Stale | 441 rules @2026-04-26 vs 546 today; hostel/chat/diary absent from map |

🆕 New since last audit (undocumented): AI-token hub + Groq primary provider; TOTP QR flow; ClamAV scanning; db_backup API; FonePay/Khalti refund/idempotency work; `flutter_user` unified app; pukarphulara cutover; four duplicate build logs at repo root; sample grade-sheet PDF/screenshot artifacts.

---

## 6. Backend Analysis

- **Framework:** Flask 3.1 factory pattern (`create_app`, `backend/app/__init__.py:15-372`); gunicorn+eventlet port 5000 (`Dockerfile:16-18`); PostgreSQL via psycopg2, pgvector extension; Redis cache db0 / broker db1 / results db2 (`config.py:53-60`).
- **Multi-tenancy:** per-request resolution subdomain → `X-School-Slug` header → JWT claim into `g.school_id` + cached installed plugins (`__init__.py:195-268`); `BaseModel.for_school()` raises `SchoolIsolationError` on None (`models/base.py:41-52`). ⚠️ Hostel/HostelRoom/HostelAllocation, FAQ, DesignerTemplate bypass SchoolModel scoping (`models/hostel.py:8,27,54`, `faq.py:8`).
- **Routes:** **546** across 59 registered files — 30 blueprints statically mounted in `api/v1/__init__.py`, remainder dynamically via plugin manifests (`loader.py:35-119`). Largest: academics 34, fees 30, exams 25, website_builder 23, hr_payroll 22, design_studio 17, lms/auth/parent_app 16. Plus `/webhooks` blueprint: esewa/khalti/fonepay callbacks, WhatsApp verify, Stripe (`api/webhooks/__init__.py:23-278`).
  - ⚠️ ~10 blueprints are double-registered (statically AND by loader), producing duplicate URL rules (e.g., hostel, academics, schools via white_label/multi_branch manifests).
  - ⚠️ Loader fallback can register unintended blueprints (`loader.py:96-106,122-132`).
- **Models:** **146 classes / 53 files**. UUID PKs, soft-delete, timestamps on BaseModel (`base.py:15-29`).
- **Celery:** **45 tasks / 20 modules**; 13 beat schedules (`__init__.py:128-185`) incl. BS-day-aware monthly fee generation (:174-178). Dead module: `tasks/lms_video_processor.py` never imported; manifest `tasks:` keys unconsumed.
- **Code hygiene:** 0 TODO/FIXME/NotImplementedError in `backend/app`.
- **Services — real implementations:** eSewa ePay v2 HMAC-SHA256 sign+verify+status lookup (`esewa_gateway.py:30-131`); Khalti v2 initiate/lookup/refund (`khalti_gateway.py:19-136`); FonePay HMAC-SHA512 DV signature chain (`fonepay_gateway.py:36-209`); Sparrow SMS (`sms_gateway.py:17-35`); OneSignal client; Meta/YouTube/TikTok social APIs; plagiarism n-gram checker; deterministic timetable solver.
- **Broken/orphaned:** **19 call sites to nonexistent `AITokenHub.generate(...)`** across 10 service files (report_remarks, content_gen, risk_detector, sentiment, translator, social_ai, benchmarking_ai, wellbeing_ai, adaptive_learning, admission_bot) — hub exposes only `request()` (`token_hub.py:250-436`); none currently routed, so latent AttributeError. WhatsApp Cloud reads `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` which are commented out (`config.py:86-88`) → any call raises KeyError. Attendance-AI/fee-predictor are heuristic-only despite imports.
- **Auth:** JWT access 1h/refresh 30d, DB blocklist, lockout, TOTP MFA with QR, OTP rate-limited (60s cooldown, 3/15min) dispatched via Celery; **out-of-the-box OTP prints to console** because `SPARROW_SMS_TOKEN=""` default + `SMS_CONSOLE_MODE` (`sms_sender.py:18-22`). Dead unreachable FCM body after return in `totp_challenge` `auth.py:465-484`.
- **Tests:** 131 functions across 15 files; require live PostgreSQL (`conftest.py:193-199` drops/recreates schema).

---

## 7. Frontend Analysis (frontend/)

- **Counts:** **215 `page.tsx`** (187 dashboard / 14 school-public / 3 auth / 9 role-portal / landing / super-admin); 7 dynamic params; ~**274 distinct API endpoints** via axios client (520 call-sites) + 16 raw-fetch SSR/form endpoints.
- **Real vs placeholder:**
  - Real: nearly all dashboard modules do live CRUD (students, fees, exams, LMS, library, HR/payroll, designer, website builder, marketplace, settings…). Website-builder pipeline is end-to-end (editor → sections → ISR-rendered public sites, revalidate 300).
  - Placeholder: 15 role-portal slugs render "Section Ready" cards (`portal-section-page.tsx:29-32`, `portal-route-meta.ts:17-111`); 8+ redirect-only pages; transport map renders an empty box labeled "Map integration required" (`transport/map/page.tsx:48-65`) though GPS data polls every 15 s; public homepage falls back to fabricated stats/testimonials (`school/[slug]/page.tsx:163-166,376-388`); `SectionRenderer.tsx` ships fake teachers always rendered (:363-397).
  - `templates_demo/` = 34 MB third-party HTML design references (documented in `lib/school-website/templates.ts:2-8`); `themes/` = 20-theme registry (5 free/15 pro) + festival overlays + 2 folder themes.
- **State/auth:** react-query polling; cookie-based JWT (`api.ts`, `auth-context.tsx`); middleware decodes JWT exp for dashboard guards (`middleware.ts:86-105`), rewrites `slug.<domain>` → `/school/<slug>` (:54-63) and resolves custom domains via `GET /website/public-domain?host=` (:31-43).
- **Dead code:** `lib/socket.ts` fully built (join_school, notification/attendance/emergency/gps/chat listeners) with **zero importers**; declared-but-unconsumed events fee_payment/notice_published/plugin_*.
- **Tests:** 9 files / 38 cases. ⚠️ `jest.config.js:4` typo `setupFilesAfterSetup` (should be `setupFilesAfterEnv`) means jest.setup never loads → matcher failures in 2 suites; `simulation.security-regression.test.ts` asserts patterns the code contradicts (SEC-06 cookies at api.ts:49/auth-context.tsx:71; C2 sanitizer absent) → **3 failing-by-inspection tests**.

---

## 8. Per-App Flutter Analysis

| | admin | teacher | parent | student | user |
|---|---|---|---|---|---|
| pubspec name / version | aschool_admin 1.0.0+1 | aschool_teacher **2.0.0+1** | aschool_parent **2.0.0+1** | aschool_student 1.0.0+1 | aschool_user 1.0.0+1 |
| Path-dep flutter_shared | ✅ | ✅ | ✅ | ✅ | ✅ (+3 sibling apps) |
| applicationId | np.com.aschool.aschool_admin | …teacher | …parent | …student | **com.ashlya.aschool_user** (off-convention) |
| minSdk | 24 pinned | 24 pinned | 24 pinned | 24 pinned | `flutter.minSdkVersion` (unpinned) |
| Manifest permissions | none | none (**speech deps need RECORD_AUDIO**) | none (**bus tracker needs location**) | none | none |
| Routes/screens | 42 / 41 | 28 / 30 | 23 / 22 | 30 / 28 | 6 stages / 1 file |
| Static/mock screens | 1 (assignments template KPIs) | 0 | 0 | 0 | 0 |
| Direct endpoint calls | ~55 | ~35 | ~30 | ~35 | 1 (`POST /schools/lookup`) |
| Release signing | debug keystore | debug keystore | debug keystore | debug keystore | debug keystore |

All apps use `SharedLoginScreen` from shared except flutter_user's own `_UnifiedLoginScreen` (delegates to same shared `authProvider`, `main.dart:1248-1252`). Tokens only via shared secure storage.

**Per-app notes**
- **A (admin):** deepest app; assignments screen renders fake KPIs via `ModuleScreenTemplate`.
- **B (teacher):** marks entry with theory/practical split; lesson/topic detail screens bypass GoRouter with raw `Navigator.push`.
- **C (parent):** fees, diary, bus tracker, emergency, gallery — all API-backed.
- **D (student):** 🐛 **AI tutor posts `/api/v1/ai-tools/homework-helper` onto a base already ending `/api/v1`** → guaranteed 404 (`ai_tutor_screen.dart:55`).
- **E (user):** monolithic 1,566-line `main.dart`; empty `lib/auth/` dir; absent from README and from CI matrix; TODO-laden applicationId.

---

## 9. Shared Flutter Package & Duplication

`flutter_shared/lib/`: models (user/school/attendance/fee/exam/notification…), repositories (attendance etc.), services (`api_client` with queued refresh, `auth_service` (⚠️ legacy `/auth/request-otp` path fixed? see §16), offline_sync, notifications), widgets (`PluginGate`, `LoadingShimmer`, `NoDataContainer`, `NotificationCenterScreen`, `SharedLoginScreen`, `NepaliDate`), `ASchoolTheme.light/dark`, features (`student_attendance_screen`).

Duplication verdict: **no harmful reimplementation** — 43/43 admin files, 31/32 teacher, 26/27 parent, 31/32 student import shared (exceptions are barrel files); zero local Theme/Login/Dio-wrapper/secure-storage duplicates. Mild structural duplication worth hoisting: holiday list ×4 (same GET `/notices/events?per_page=100`), emergency screen ×4 (`/emergency/alerts`), gallery ×3; filename collision trap: `student_diary_screen.dart` exists in both teacher (writes diary) and student (reads notices) with opposite behavior.

---

## 10. Hardware Analysis

ESP32 + NEO-6M + SIM800L ("SafeRide" bus tracker). Posts JSON `{lat,lng,speed,heading,hdop,satellites,ts,bus_id}` every 15 s + heartbeat to Firebase RTDB REST `.../schools/{SCHOOL_ID}/buses/{BUS_ID}/location.json?auth={SECRET}` (`firmware.ino:150-199`), WiFi or GPRS AT path. Wiring doc is solid (SIM800L 2A spikes, LM2596, 1000 µF).

Gaps: placeholder secrets (:26,:30); comment says PUT but GPRS sends POST (:208-209) → child-node append instead of replace; no HTTP status check on GPRS; bare `AT+HTTPSSL=1`. **Critical:** documented backend consumer `backend/tasks/gps_tasks.py` (hardware/README.md:85) doesn't exist; actual `tasks/gps_processing.py` defines `process_gps_data` but nothing enqueues it → device→Firebase→Postgres loop broken end-to-end. Prototype quality, not deployable.

---

## 11. Test Coverage

| Suite | Files | Cases | State |
|---|---|---|---|
| backend/tests | 14 + conftest | 110 fns | Need live Postgres `aschool_test`; OTP mocked |
| backend/tests/simulation | 1 (723 ln) | 21 | Includes 4 cross-tenant 403 tests |
| frontend/__tests__ | 9 | 38 | jest config typo breaks matchers; 3 security-regression tests fail-by-inspection |
| root tests/ | docs only | — | REPORT md + pointer README |
| flutter_shared/test | present | unit+widget incl. 4-group security regression | runs in CI |
| CI matrix | deploy.yml | backend+frontend+flutter(4 apps) | **flutter_user excluded** |

Coverage remains low relative to surface (546 routes / 215 pages / ~123 screens); no coverage % measurable without a run — `❓ UNVERIFIED`.

---

## 12. Infra & DevOps

**nginx/nginx.conf** upstreams flask:5000, nextjs:3000 (Docker DNS 127.0.0.11); rate-limit zones; tenant slug map; proxy cache `school_pages_cache`. Server blocks: ① apex/www (api/webhooks/health/socket.io → flask; / → nextjs), ② app.* → Flutter-web static root `/var/www/app.pukarphulara.com.np`, ③ api.* → flask, ④ regex `~^(?<slug>[^.]+)\.…$` tenant sites w/ cache + `X-School-Slug`. `host_nginx_aschool.conf`: host-level :80 → 127.0.0.1:8080 (Cloudflare TLS).

**compose drift (dev vs prod):**
- 🐛 Prod Celery runs `-A app.celery` (`docker-compose.prod.yml:126,155`) — module doesn't exist (correct: `app.celery_app`) → **prod workers/beat cannot start as committed**.
- Prod mounts `./nginx/ssl` (:8) but `nginx/ssl/` doesn't exist; mounts `/var/www/app.brighternepal.com` (:9) while nginx serves `/var/www/app.pukarphulara.com.np` (nginx.conf:103).
- Prod defines `uploads_data` volume (:188) but mounts it nowhere → uploads lost on recreate (dev mounts it).
- Env style divergence: dev `env_file: .env`; prod explicit lists only → ~30 vars (MAIL_*, FIREBASE_*, ESEWA_ENVIRONMENT…) never reach prod containers; prod needs `FLOWER_USER/PASSWORD`, `NEXT_PUBLIC_BASE_DOMAIN`, `API_URL`, `NEXT_PUBLIC_API_URL/WS_URL`, `SENTRY_DSN`, `GROQ_API_KEY` — several absent from `.env`.
- Celery Redis DB numbering differs dev(db1/db2) vs prod(db0/db0); dev hardcodes `aschool:aschool` ignoring `POSTGRES_PASSWORD`.
- Healthchecks: postgres/redis yes; flask/celery/nextjs/flower no.

**Makefile (16 targets):** dev, dev-build, down, backend, shell, migrate (⚠️ `msg` unset → `-m ""`), upgrade, downgrade, **seed → `flask seed-plugins` CLI does not exist (broken)**, worker, beat, frontend, frontend-build, test, test-cov, test-frontend, test-flutter, test-all, clean.

**fix scripts:** `fix_nginx.py` (strip Vexel blocks, rename wildcard domain) — problem gone, script obsolete. `fix_server.py` (/opt/aschool repair: ports 8080, de-TLS behind Cloudflare, regenerate .env) — applied and reflected in current configs, but it committed plaintext prod password `AschoolProd123!` (:52-56) and its brighternepal volume path residue persists.

**CI (.github/workflows/deploy.yml):** backend-test (pgvector+redis services, codecov), frontend-test (lint/tsc/jest/build), flutter-test matrix (shared+4 apps; user excluded), build-push ghcr, ssh deploy to /opt/aschool (upgrade, rolling restarts, health curl).

---

## 13. Environment Variable Diff (names only)

**Only in `.env` (9):** CORS_EXTRA_ORIGINS, FILE_STORAGE_BACKEND, LOCAL_UPLOAD_DIR, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, PEXELS_API_KEY, PUSH_PROVIDER *(referenced nowhere — dead)*, SMS_CONSOLE_MODE, UNSPLASH_ACCESS_KEY.

**Only in `.env.example` (8):** AI_DEFAULT_DAILY_LIMIT, AI_DEFAULT_MONTHLY_LIMIT, AI_QUOTA_ENFORCEMENT, API_URL, GROQ_API_KEY, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, SENTRY_DSN.

**Referenced in code but in NEITHER file:** FONEPAY_ENVIRONMENT, GROQ_MODEL_FAST/QUALITY, CELERY_TIMEZONE, FIREBASE_SERVER_KEY, CLAMAV_ENABLED/HOST/PORT/STRICT, CLAUDE_QUALITY_MODEL, DB_BACKUP_DEST, LAST_DB_BACKUP_AT, MAX_FILE_SIZE_MB, ISR_REVALIDATE_SECRET, and **R2_BUCKET** (`db_backup_api.py:22`) — inconsistent sibling of `R2_BUCKET_NAME` used everywhere else. Compose-only: FLOWER_USER, FLOWER_PASSWORD, NEXT_PUBLIC_BASE_DOMAIN. Brand residue: `.env` still `BASE_DOMAIN=aschool.com.np` vs deployed pukarphulara.com.np.

---

## 14. Online Market & Live-Presence Research

**Live presence of ASchool: NONE found.**
- `https://pukarphulara.com.np` (most recent deployment target, 2026-07-12) now serves **"Vexel — Commerce Superplatform for Nepal"** — an unrelated e-commerce product (fetched 2026-08-22).
- `https://brighternepal.com` (May-2026 deployment target) now serves **"JiguBites: Discover the Best Restaurants in Nepal"** — unrelated.
- No Google Play/App Store listing or marketing site for "ASchool" school management found (searches: brand + domain variants). Conclusion: **the product has zero public footprint today; both prior production domains were repurposed for other projects.**

**Market baseline (Nepal school SaaS) — standard feature set** (sources):
- Skolora — multi-school groups, module toggles, 24+ roles, RBAC, white-label, MFA, 99.99% uptime claim (skolora.com)
- Digital Nepal (edigitalnepal.com) — ERP+LMS+mobile, biometric attendance, live tracking, 24+ modules; Play Store presence ("API School")
- e-School/e-Zone (eschool.ezone.com.np) — accounting w/ budgeting, scholarships, payroll, inventory, admissions+payments, SMS/portal/mobile
- Vidyalaya (vidyalayedu.com) — free-beta, ID/admit-card/marksheet batch PDFs w/ QR, bilingual Nepali/English, daily backup, RBAC
- Webbank "Project School" (webbank.com.np/project-school/) — RFID attendance, eSewa fees, NPR 45k–250k licenses, 100+ schools
- EduSewa (edusewa.org), eAcademy (eacademynepal.com), SupportMeNepal, Smart School/Codelogic (Play Store) — same core set: attendance, fees+local payments, exams/GPA, library, transport, hostel, multi-role portals, SMS/push.

**Where ASchool stands vs baseline:** Ahead — website-builder + per-school SSR sites with 20 themes/festival overlays (rare locally), AI tool suite (even if partly orphaned), design studio (ID/admit/marksheet bulk PDF), plugin marketplace/tiering, three real local gateways incl. refunds+idempotency, TOTP MFA, ClamAV upload scanning, automated backups (many local competitors don't advertise these). Behind/at-risk — no biometric hardware integration (stub), no driver app/live GPS map (shell), no RFID, no ConnectIPS (spec'd in ULTIMATE, absent), portal web stubs, no published/deployed instance at all (every competitor above is live), no app-store distribution, no IRD/VAT billing.

**Nepal-specific code checks (not just docs):** Bikram Sambat ✅ real (`utils/nepali_date.py` via `nepali-datetime`, used across backend; NepaliDate widget shared); NEB grading ✅ real with theory-35/practical-40 component-fail logic (`utils/nepal_grading.py:18-121`, tested); local gateways ✅ real (eSewa/Khalti/Fonepay, §6) — exceeds many competitors who integrate fewer; IRD PAN/VAT receipts ❌ missing; disability/mother-tongue student fields ❌ not found (Part-4 checklist item, still true).

**Security/compliance expectations for the category** (encryption in transit/at rest, daily backup promises, RBAC audits — vidyalayedu.com, skolora.com FAQs): ASchool should be checked against — TLS currently relies on Cloudflare with plain HTTP origin chain (`fix_server.py` de-TLS; host conf :80); student-data privacy policy/parent-consent flows absent from code (no consent model found — recommendation, not confirmed requirement); backups exist but off-site retention/restore testing undocumented.

---

## 15. Feature Gap Matrix

| Feature / Module | Source | Status | Evidence | Notes |
|---|---|---|---|---|
| Auth (OTP+password, lockout, MFA/TOTP, revocation) | docs/code | ✅ Done | auth.py, auth_service.py | OTP console-mode until Sparrow token set |
| Multi-tenancy isolation | README | ✅ Done | __init__.py:195-268; base.py | hostel/faq/designer_template escape scoping |
| Attendance | market/docs | ✅ Done | attendance.py 14 routes; listener fixed | unique(student,date) constraint still absent |
| Gradebook/Exams (NEB) | market/docs | ✅ Done | exams.py 25 routes; nepal_grading.py | online-exam XSS sanitize weak |
| Fees + eSewa/Khalti/Fonepay | market/docs | ✅ Done | fees.py 30 routes; 3 gateways; idempotency; refunds | IRD PAN/VAT receipts missing |
| Timetable | market | ✅ Done | timetable.py + solver service | solver deterministic, not AI |
| Library / eLibrary | market | ✅ Done | library.py, elibrary.py + overdue beat job | |
| Transport/bus tracking | market/spec | 🟡 Partial | transport.py 13 routes; gps_processing task unenqueued | no driver app; no backend WS emit; HW loop broken |
| Hostel | market | ✅ Done | hostel.py 12 routes | models bypass tenant scoping |
| HR & Payroll | market | ✅ Done | hr_payroll.py 22 routes + monthly beat | |
| Inventory | market | ✅ Done | inventory.py 11 routes | |
| LMS + online exams | spec | ✅ Done | lms.py 16 routes; OnlineExam models | video processor tasks dead |
| Notices/comms (SMS/push/email/WhatsApp) | market | 🟡 Partial | communications 14 routes; sms/push tasks | WhatsApp Cloud keys commented out → KeyError |
| Parent-teacher messaging/chat | market | ✅ Done | chat models/service; diary; conferences | |
| Website builder + school sites | differentiator | ✅ Done | website_builder 23 routes; SSR+ISR; 20 themes | fake fallback content shipped |
| Design studio (ID/admit/marksheet) | differentiator | ✅ Done | design_studio.py 17 routes; bulk generator | |
| Marketplace/plugins/billing tiers | spec | 🟡 Partial | plugins.py; manifests; seed_full pricing | trial/billing endpoints still absent (PLAN_AUDIT item) |
| AI suite | spec | 🟡 Partial | token_hub real (Groq+Claude); design_studio wired | 10 orphan services call nonexistent method |
| GPS realtime (WS) + live map | spec/market | ❌ Missing | socket.ts unwired; map page shell | |
| Biometric attendance | spec/market | ❌ Missing | biometric module stub | |
| Multi-branch groups | market (Skolora/EduSewa) | ❌ Missing | multi_branch stub | competitive table-stakes locally |
| White-label | Skolora advertises | 🟡 Partial | white_label manifest → schools_bp | thin |
| Driver app / RFID | market | ❌ Missing | no such dirs/models | |
| ConnectIPS | ULTIMATE spec | ❌ Missing | grep: absent | |
| Offline-first mobile (Isar) | spec | 🟡 Partial | offline_sync service | in-memory queue only, overstated docs |
| Role portals on web (parent/student/teacher) | internal | 🟡 Partial | 15 "Section Ready" stubs | apps cover them instead |
| App-store distribution | market | ❌ Missing | debug-signed builds, no listings | |
| Deployable production config | ops | ❌ Missing | compose.prod celery path broken | blocks launch outright |

---

## 16. Dissimilarities & Inconsistencies (full list)

1. **Prod compose ↔ code:** `-A app.celery` vs existing `app.celery_app` (prod.yml:126,155).
2. **Domain triple-brain:** `.env BASE_DOMAIN=aschool.com.np` vs nginx pukarphulara.com.np vs compose brighternepal mount vs middleware allowlist mixing aschool.com.np + brighternepal.com (`middleware.ts:12-25`).
3. **Endpoint mismatches client↔server:** student AI tutor double-prefix 404 (`ai_tutor_screen.dart:55`); frontend news-article page calls `/website/public/<slug>/news/<articleSlug>` which no backend route serves (dead page); regression test expects `/auth/request-otp`-era contract — backend is `/auth/send-otp` (`auth.py:12`).
4. **Backend endpoints never called by any client (sampling):** benchmarking (2 routes), ai_usage quota endpoints, db_backup_api restore paths, super_admin plugin controls, whatsapp_bot endpoints (integration unusable), most of social_hub — no frontend/app callers found.
5. **Compose drift:** enumerated in §12 (celery module, ssl volume, brighternepal volume, uploads volume, env strategy, redis DBs, healthchecks, flower creds).
6. **flutter_shared duplication:** none harmful (§9); structural ×4/×3 screen clones listed; diary filename collision.
7. **Online-vs-code:** nothing advertised online (no presence at all) — inverse problem: substantial code (AI suite, design studio, marketplace) marketed nowhere.
8. **Docs-vs-code:** README counts wrong (apps 4→5, screens 58→~123, manifests 29→~60, routes 13 files→61); url_map stale (441 vs 546); hardware README cites nonexistent `gps_tasks.py`; simulate.md mislabels flutter_user.
9. **Orphan files:** 4 duplicate build logs; `download.pdf`/`image.png` personal artifacts; scratch_*.py ×4; `iemis_templates/` reference-only; `templates_demo/` 34 MB; dead `lms_video_processor.py`; unreachable FCM body `auth.py:465-484`; unused `nepali_date_converter` dep in shared pubspec.
10. **Naming/versioning:** folder `flutter_shared` vs package `aschool_shared`; version skew (teacher/parent 2.0.0+1 vs others 1.0.0+1); applicationId convention break `com.ashlya.*`; `R2_BUCKET` vs `R2_BUCKET_NAME`; `PUSH_PROVIDER` dead key.
11. **Test-vs-code contradictions:** 2 security-regression tests assert patterns the code violates (§7).
12. **Double-registered blueprints** creating duplicate URL rules (~10 blueprints, §6).

---

## 17. Dead Code / Orphan Files

`lib/socket.ts` (0 importers) · 10 orphaned AI services w/ 19 broken calls · `tasks/lms_video_processor.py` · `auth.py:465-484` · `whatsapp_cloud.py` (keys commented) · `ad_campaign.py` alias shim · portal stub system (15 slugs) · 8 redirect-only pages · fake-content branches in SectionRenderer/homepage · `Makefile seed` target · `url_map.txt` · build logs ×4 · scratch scripts ×4 · `fix_nginx.py`/`fix_server.py` (applied, obsolete) · declared-but-unconsumed socket events.

---

## 18. Security & Config Concerns

Fixed & verified: tenant read/write guards, OTP echo, lockout, MFA, blocklist, timing-safe webhooks, ClamAV, idempotency, refresh race, compile blockers.
Open: ① CSP `unsafe-inline`/`unsafe-eval` (`app/__init__.py:354-357`); ② no frontend HTML sanitizer + weak regex filters (custom_css, exam questions, AI paper HTML); ③ JWT in JS-readable cookies, no httpOnly; ④ plaintext prod password committed (`fix_server.py:52-56`); ⑤ plain-HTTP origin behind Cloudflare; ⑥ refresh-token rotation doesn't revoke prior jti; ⑦ debug-signed release Android builds ×5; ⑧ Android permissions undeclared for speech/location/scanner; ⑨ OTP/console-mode default; ⑩ uploads volume unmounted in prod; ⑪ no parent-consent/data-policy flows (market expectation); ⑫ two regression tests green-washing broken invariants.

---

## 19. Completion Scoring

| Component | Score | Justification |
|---|---|---|
| Backend | **78%** | 546 real routes, 146 models, genuine gateways/AI hub/Nepal utils, strong auth; minus broken AI call sites, dup registrations, WhatsApp keys, scoping escapes |
| Frontend | **70%** | 215 pages mostly live-CRUD, end-to-end site builder; minus portal stubs, map shell, unwired sockets, broken test config, unsanitized HTML |
| flutter_admin | **82%** | 42 routes, 1 mock screen; release signing/perms debt |
| flutter_teacher | **78%** | complete flows; router bypasses; perms debt |
| flutter_parent | **75%** | complete core loops; location perm missing for bus tracking |
| flutter_student | **73%** | solid; AI-tutor 404 bug |
| flutter_user | **40%** | functional unified shell but monolith, off-convention IDs, outside CI/README |
| flutter_shared | **75%** | real api/auth/theme/widgets + fixed refresh queue; offline sync overstated, legacy path remnants |
| Hardware | **35%** | compilable prototype; secrets, POST/PUT bug, backend consumer absent → loop broken |
| Infra/DevOps | **55%** | good dev compose, nginx, CI; prod compose crashes Celery, domain/volume/env drift, broken make seed |
| **Overall** | **≈66%** | Deep, genuinely functional core dragged down by undeployable prod config, unfinished realtime/GPS story, and zero public presence |

---

## 20. Prioritized Next Steps

**Must-fix (blocks launch/correctness)**
1. Fix `docker-compose.prod.yml:126,155` → `-A app.celery_app`; add env_file or complete env lists; mount uploads volume; remove/fix ssl + brighternepal volumes.
2. Fix student AI tutor URL prefix (`flutter_student/lib/.../ai_tutor_screen.dart:55`).
3. Pick one domain; align `.env`, compose, nginx, middleware, constants.dart; purge other two brands.
4. Remove plaintext prod password from `fix_server.py`; rotate credentials.
5. Repair frontend test harness (`jest.config.js:4` key) and reconcile the 2 failing security-regression assertions with reality (either add httpOnly-cookie/server-side sessions or update tests).
6. Delete or wire the 10 broken AI services (nonexistent `generate()`).

**Should-fix**
7. Add DOMPurify (or render markdown server-sanitized) for all `dangerouslySetInnerHTML` sites; strengthen exam-question/custom_css sanitization server-side.
8. Complete GPS loop: enqueue `process_gps_data` from a Firebase poller, emit `gps_update` over Socket.IO, wire `lib/socket.ts` consumers, replace map shell; fix firmware POST→PUT + status checks.
9. Add Android permissions (RECORD_AUDIO, ACCESS_FINE_LOCATION, POST_NOTIFICATIONS) + release signing configs across all 5 apps; pin flutter_user minSdk.
10. Implement Multi-Branch and Biometric modules or remove their marketplace listings; add trial/billing endpoints to marketplace.
11. IRD PAN/VAT fields on fee receipts; unique (student_id, date) attendance constraint; refresh-token rotation revocation; tighten password policy at all entry points.
12. Split `flutter_user/main.dart` into screens; add it to CI matrix; unify app versions/applicationIds under `np.com.aschool.*`.
13. CSP without unsafe-inline/unsafe-eval (nonce/hash based); httpOnly session cookies or documented threat-model exception.

**Nice-to-have**
14. Hoist duplicated holiday/emergency/gallery screens into flutter_shared; resolve diary filename collision.
15. Purge root artifacts (build logs ×4, download.pdf, image.png, scratch scripts, url_map.txt) or gitignore; regenerate route map.
16. Replace fabricated public-site fallbacks with "coming soon" states; wire declared socket events.
17. Publish anything: staging deployment + landing page — currently the market (Skolora, Vidyalaya, Digital Nepal et al.) is live while this codebase is invisible.
18. Evaluate ConnectIPS + parent-consent flows to match spec/local expectations.

---

*End of report. Generated read-only; no repository files were modified.*
