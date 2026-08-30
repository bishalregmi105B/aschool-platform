# DISCOVERED SYSTEM INVENTORY — Independent Phase-0 Audit (2026-08-28)

> **Provenance:** This file is built from direct source reading + live runtime probes against
> `http://localhost:5003` (docker compose stack, host `./backend` mounted). It supersedes the
> 7 prior audit docs in `audits/` wherever they disagree. Living document — updated as
> verification progresses.

## Verification legend
- ✅ runtime-verified (actually executed against the running stack)
- 📖 source-verified (read in source, cited file:line)
- ❓ claimed by prior audit / agent report, not yet independently confirmed
- ⛔ blocked (needs real hardware/credentials)

---

## 1. System shape (runtime ✅ + source 📖)

| Layer | Reality | Evidence |
|---|---|---|
| Backend | Flask 3 + SQLAlchemy 2 (Postgres 16, UUID pk) + Celery + Socket.IO + Redis cache | `backend/app/__init__.py:15-467` |
| API surface | **550 route decorators / 59 files** under `/api/v1` + 6 webhook routes (`/webhooks/esewa|khalti|fonepay|whatsapp×2|stripe`) | agent sweep of `app/api/v1/`, pending my recount |
| Models | 52 files, **143 real model classes**; `BaseModel`/`SchoolModel.for_school()` tenancy (`backend/app/models/base.py:32-52`) | agent sweep |
| Frontend | Next.js 14 App Router dashboard + public school sites | `frontend/` |
| Mobile | **5 Flutter apps** (admin/teacher/parent/student/user — prompt said 4, wrong) + `aschool_shared` | repo tree |
| Plugins | **57 unique slugs**; discovery: `modules/{slug}/manifest.yaml` (50) beats legacy `manifests/*.yaml` (55); 7 legacy-only, 2 module-only | `backend/app/plugins/loader.py:34-128`, runtime marketplace dump |
| Tenancy | subdomain → `X-School-Slug` header → JWT `school_id` claim; `g.school_id`, `g.installed_plugins` (cache 300 s) | `app/__init__.py:231-307` |

## 2. Plugin registry (runtime dump of `/api/v1/plugins/marketplace`, 2026-08-28)

57 plugins. Categories (used as `tier`): core(13) starter(11) growth(21) premium(8) add_on(1). Prices NPR/monthly (yearly ≈ 10×monthly):

- **core (free):** dashboard, students, teachers, users, academics, attendance, notices, basic_reports, basic_website, basic_reports, file_management, marketplace_nav, settings_core
- **add_on (free):** iemis_importer
- **tier=free but categorized starter/growth (inconsistent):** library, timetable, hostel, portfolio, digital_content, ai_insights ← *all price 0 while sibling duplicates are paid*
- **starter (paid 199–399):** assignments 299, conferences 199, dismissal 299, elibrary 299, exams 399, fees 399, incidents 199, library_management 199, sms_notifications 199, whatsapp_bot 399
- **growth (paid 199–799):** admission 699, ai_grading 599, ai_tutor 499, alumni 299, compliance 499, design_studio 499, emergency 399, gamification 299, gps_tracking 599, health_records 299, hr_payroll 699, incident_management 399, inventory 299, lms 799, social_ads 499, social_hub 699, student_portfolio 299, visitor_management 199, website_builder 499, wellbeing 499
- **premium (paid 999–2999, 7-day trial):** advanced_analytics 999, ai_adaptive_learning 1499, ai_tools 1499, benchmarking 1499, biometric 1999, disaster_management 999, multi_branch 2999, white_label 2999

**Duplicate-slug clusters (legacy renames, papered over by `PLUGIN_SLUG_ALIASES` in `app/plugins/decorators.py:13-22`):**
- `library` ⇄ `library_management`
- `digital_content` ⇄ `elibrary` (both exist as separate published plugins! digital_content=free growth, elibrary=starter 299)
- `incidents` (starter 199) vs `incident_management` (growth 399) — *no alias, distinct feature sets?*
- `portfolio` (free) vs `student_portfolio` (growth 299) — *no alias*
- ⚠️ **`design_studio` is BOTH its own plugin (growth 499) AND an alias mapping to `digital_content`** (`decorators.py:21`) — see finding E3.

**Manifest vs DB price discrepancies** (agent read manifests; live DB differs — e.g. admission 599 vs live 699, gps_tracking 1999 vs live 599, website_builder 1499 vs live 499, ai_tutor "premium 1499" vs live growth 499). Cause: DB seeded earlier by `seed_full.py` (hardcoded price list, `seed_full.py:2,146-156`); **manifests and `seed_full.py` disagree with each other**, and DB agrees with neither fully. Needs reconciliation (finding E6).

## 3. ENTITLEMENT MODEL — how access actually works (all runtime/source verified)

Chain: `Plugin` (catalog, from manifests) → `SchoolPlugin` (per-school install row; `active`) → `g.installed_plugins` (request-scoped list, `app/__init__.py:293-307`) → `@plugin_required(slug)` (`app/plugins/decorators.py:49-85`, alias-transitive) → 403 with install URL.

### Findings (E-numbers are stable IDs used across audit docs)

| ID | Severity | Finding | Evidence | Status |
|----|----------|---------|----------|--------|
| **E1** | **P0** | Registration grants the same hardcoded 6 plugins to every plan; purchased plan grants nothing. Also swallows failures with bare `except Exception: pass`. | `app/api/v1/auth.py:302-308`; ✅ runtime: fresh `plan=growth` school got exactly `[attendance, notices, academics, basic_reports, basic_website, fees]` | CONFIRMED |
| **E1b** | P1 | Free plan silently gets `fees` (paid starter plugin) as a trial (`is_trial: true` runtime ✅) — inconsistent with "free" tier; and trials never expire (E4) so it's permanent free access | runtime ✅ | CONFIRMED |
| **E2** | **P0** | `School.plan` (free/starter/growth/enterprise) is write-only — no plan→entitlement/limit mapping anywhere; only read for superadmin analytics grouping. Signup/marketing plans are decorative. | `app/models/school.py:36-42`, only usage `app/api/v1/analytics.py:580-582`; grep for PLAN_* maps: none | CONFIRMED |
| **E3** | **P0** | Alias leak: installing `elibrary` (starter 299) unlocks every route gated `design_studio` (growth 499) — alias chain `design_studio→digital_content→elibrary` accepted by `_acceptable_plugin_slugs`. | `decorators.py:13-22,25-46`; ✅ runtime: elibrary trial → `GET /design-studio/templates` = 200 with real data | CONFIRMED |
| **E4** | **P0** | Trials never expire: no Celery job touches `trial_ends_at`; request path checks only `active=True`. Non-free installs stay accessible forever without payment. | `app/__init__.py:300-305` (active=True only); `grep trial app/tasks/` = empty | CONFIRMED |
| **E5** | **P0** | `/plugins/<slug>/subscribe` collects no money — flips `is_trial=False` + sets `next_billing_date`, which nothing ever checks. No invoice model exists. Only real money path for plugins: Stripe webhook (`STRIPE_WEBHOOK_SECRET` — read at `app/api/webhooks/__init__.py:286` but **never defined in config.py** → always 500s). | `app/api/v1/plugins.py:235-292`; grep PluginInvoice: none | CONFIRMED |
| **E6** | P1 | Marketplace pricing is inconsistent across 4 sources: manifests (flat `price_monthly`), `seed_full.py` (hardcoded), DB (depends which seeder ran), and **`seed.py:31-34` reads nested `pricing.monthly` that no manifest has → documented `make seed` path seeds every paid plugin as free/price-0**. | `seed.py:31-34` vs `manifests/fees.yaml` (flat keys) | CONFIRMED |
| **E7** | P1 | AI quota bypass: 6 services call Anthropic directly, skipping `AITokenHub` quota/usage accounting ("the ONLY entry-point" per its own docstring): `lesson_plan.py:15`, `question_paper.py:15,112`, `auto_grader.py:15`, `homework_helper.py:15`, `school_insights.py:21`, `website_designer.py:1-12` | agent + pending my spot-check | CONFIRMED (source) |
| **E8** | P1 | Multi-tenancy holes: `Hostel`, `HostelRoom`, `HostelAllocation` (`models/hostel.py:8,27,54`) and `FAQ` (`models/faq.py:8`) inherit `db.Model` directly — no `school_id` scoping via `SchoolModel` | agent | to verify runtime |
| **E9** | P2 | Registration docstring says "then sends OTP" but no OTP is sent; `phone_verified=True` set unconditionally | `auth.py:221,286` | CONFIRMED (source) |

## 4. Backend red flags (from discovery sweep; each needs independent confirmation before fixing)

- `except Exception: pass` sites: `iemis_importer.py:784`, `files.py:475`, `assignments.py:68`, `fees.py:1829`, `webhooks/__init__.py:85,154,245` (payment callbacks!), `tasks/db_backup.py:113`, `social/social_hub.py:90,97`, `designer/template_engine.py:1160,1335`
- WhatsApp incoming webhook stub — logs + acks only (`webhooks/__init__.py:269-276`)
- Jitsi hardcoded public `meet.jit.si`, no auth (`services/lms/video_service.py:11`)
- Model alias shims: staff/designer/hr/health/communication/analytics/ad_campaign (rename debris)
- Payment merchant creds are per-school `fee_config` (good), env only has env flags
- 14 beat schedules (list in agent report §6)

## 7. Document & content generation systems (discovery complete; runtime verification pending)

| System | Reality | Key evidence |
|---|---|---|
| Fee receipt PDF | WeasyPrint → streamed bytes, letterhead + IRD PAN/VAT, verified_hash | `app/api/v1/fees.py:1290,1311,2073` |
| Payslip PDF | WeasyPrint → streamed bytes, NPR hardcoded | `app/api/v1/hr_payroll.py:219,336` |
| Bulk marksheet/report-card PDF | WeasyPrint stitched, from design-studio bulk JSON | `app/api/v1/exams.py:1370-1480` |
| Designer (canvas) | fabric.js JSON templates; bulk endpoints return JSON arrays (client renders PNG/ZIP/print via fabric+jsPDF+JSZip) | `services/designer/template_engine.py`, `bulk_generator.py:69,249,305,361`; `frontend/lib/hooks/useExport.ts` |
| **G1 — broken pdf_url** | Celery `generate_report_card_pdf` builds PDF bytes then DISCARDS them; writes `rc.pdf_url="/reports/..."` which is not a served route | `app/tasks/report_generation.py:100-129` |
| **G2 — EMIS CSV discarded** | `export_emis_data` builds CSV in memory, stores only JSON row; compliance endpoints JSON-only | `app/tasks/report_generation.py:153-233`, `services/compliance/moe_reports.py` |
| IEMIS import | openpyxl Excel import works (validate/import/history routes) | `app/api/v1/iemis_importer.py:125,763-963` |
| Website builder | JSON config + CSS gen (20 themes); Next.js SSR renders; ISR sync tasks; custom_css sanitized | `services/website/theme_engine.py:170,230`, `website.py:29` |
| AI quota | `AITokenHub` enforces per-school daily/monthly quota + logs; **7 bypassers**: question_paper, lesson_plan, auto_grader, homework_helper, school_insights, timetable_solver, website_designer (direct anthropic) | `services/ai/token_hub.py:267,410`; bypass sites listed in §4/E7 |
| Backups | pg_dump→gzip→R2, retain 30; superadmin API | `app/tasks/db_backup.py` |
| QR | data-URI QR for ID cards + TOTP | `bulk_generator.py:21-42,147` |

## 6. Mobile (discovery complete; contract verification pending)

Structure: `aschool_shared` (68 files: 20 models, 14 repos, 10 services, 58 widget classes) + 5 apps (admin 38 screens, teacher 27, parent 20, student 26, user 5-stage onboarding host embedding role apps via path deps).

**Key findings (M-IDs):**
- **M1**: Push notifications dead end-to-end — `NotificationService.init()` never called in any app's `main.dart`; FCM/OneSignal tokens always null; `POST /auth/register-fcm` silently no-ops. Dead deps: firebase_*, geolocator, mobile_scanner, retrofit/freezed/json_serializable (codegen never run).
- **M2**: Notification center built (repo+widgets) but routed nowhere; unread-count unused.
- **M3**: HR split-brain: shared `HrRepository` → `/hr-payroll/*` vs teacher/admin screens → `/hr/payroll`, `/hr/leave`, `/hr/payroll/slips`. Backend blueprint prefix is `/hr` (22 routes) — `/hr-payroll/*` likely 404s. VERIFY.
- **M4**: Admin marketplace calls `POST /plugins/{slug}/install` + `DELETE /plugins/{slug}/uninstall`; backend exposes `POST /plugins/install` + `POST /plugins/uninstall`. Likely 404s. VERIFY.
- **M5**: AI split-brain: `/ai/{tool}/generate` (admin+teacher) vs backend `/ai-tools` prefix; student uses `/ai-tools/homework-help`. VERIFY.
- **M6**: Parent fee flow `POST /fees/initiate-payment` (no id in path) vs shared repo `POST /fees/initiate-payment/{collectionId}` + `POST /fees/pay`. VERIFY against backend.
- **M7**: `plugin_provider.getConfig()` always returns `const {}` — plugin config plumbing fake on mobile.
- **M8**: offline_sync.dart dead code (0 call sites; docstring claims Isar, not a dep).
- **M9**: ~35 unsafe parse sites (`as String` ids, unchecked `as List`) across shared models/repos + screen-level raw-map casts.
- **M10**: 137 silent `catch (_)` swallows; several screens set loading=false with no error UI.
- **M11**: Coverage gaps: no notification center route; student can't see live bus (REST+socket unused); no conference mgmt for teacher/admin; parent has no library/LMS view; teacher no health view; accountant/superadmin have no mobile app; admin QR scan + wellbeing survey creation are "coming soon" stubs.
- **M12**: `flutter_student/pubspec.yaml` omits flutter version constraint; no version pinning anywhere.
- Socket: only `chat:message` consumed of 7 documented events.
## 8. Prior-audit diff log (pending)

## Runtime environment (for verification)
- Stack: `docker compose up -d` → flask :5003, nextjs :3003, pg/redis internal; `flask` container mounts `./backend` (host code = runtime code)
- Seed: `docker compose exec flask python seed.py` (⚠️ E6 pricing bug — but idempotent-skips existing rows)
- Superadmin: `superadmin@aschool.com.np` / `changeme123`; demo admin `admin@demo.aschool.com.np`
- Test school created for E1 probe: `audit-test-growth-school` (growth plan), admin phone 9800000011
