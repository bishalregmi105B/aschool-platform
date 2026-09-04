# ASchool Plugin Architecture — Duplication, Overlap & Dead-Code Audit

Date: 2026-09-04 · Scope: `backend/app/plugins/**`, `backend/app/api/v1/**`, `backend/app/services/ai/**`, `frontend/app`, `flutter_*`. Read-only audit; nothing was refactored.

---

## 1. The registry / manifest mechanism

WordPress-style catalog with Odoo-style module folders, gated per-school at request time.

1. **Catalog source of truth = the filesystem.** `PluginLoader._scan_manifests()` (`backend/app/plugins/loader.py:43-77`) scans `app/plugins/modules/*/manifest.yaml` first, then legacy flat `app/plugins/manifests/*.yaml` (module wins on slug collision, `loader.py:94-99`). There is **no AVAILABLE_PLUGINS constant and no seed** — the WP comment at `loader.py:10-13` says the directory IS the catalog. Manifest header fields: `slug, name, name_nepali, category, price_monthly/yearly, is_free, emoji, icon, api_blueprint, models_module, services, tasks, depends_on, conflicts_with, frontend.sidebar, flutter, coming_soon, deprecated, published`.
2. **DB is a mirror + install-state store.** `refresh_registry()` (`loader.py:281-363`, called from `create_app` at `app/__init__.py:544-548`) upserts the `plugins` table (`app/models/plugin.py:23-77`, columns `slug/name/category/price_monthly/is_free/is_published/depends_on/…`) and **unpublishes rows whose folder vanished** (never deletes). Per-school installs live in `school_plugins` (`SchoolPlugin`, `plugin.py:79`, `active/is_trial/trial_ends_at/billing_cycle/config JSONB`) plus `plugin_usage_logs` (`plugin.py:114`).
3. **Request-time gating via `@plugin_required(slug)`** (`app/plugins/decorators.py:81-117`). `before_request resolve_school` (`app/__init__.py:378-522`) resolves tenant (subdomain → `X-School-Slug` header → JWT `school_id` claim, with a cross-tenant 403 at `__init__.py:427-446`) and caches `g.installed_plugins` for 300 s (`cache_key = school:{id}:plugins`, `__init__.py:492-521`), excluding expired trials. Alias expansion `_acceptable_plugin_slugs()` (`decorators.py:56-78`) is deliberately **single-hop non-transitive**. The alias table `PLUGIN_SLUG_ALIASES` (`decorators.py:13-53`) is how 7 AI plugins were merged into `ai_suite` and how `library→library_management`, `digital_content→elibrary`, `portfolio→student_portfolio` merges were done without touching routes. Frontend mirrors the same table in `frontend/lib/plugins.tsx` (`PLUGIN_SLUG_ALIASES`, ~line 56) — a **hand-duplicated copy** of backend truth.
4. **Install/subscribe/uninstall flow** in `app/api/v1/plugins.py`: `GET /marketplace` (catalog merge of manifest+mirror, `plugins.py:126-220`), `POST /install` (→ `billing.install_plugin`, `app/plugins/billing.py:74-173`, trial policy, dependency/conflict checks, activation hook), `POST /<slug>/trial`, `POST /<slug>/subscribe` (402 without gateway-verified payment — E5/P-05 fix, `plugins.py:523-619`), `/uninstall`, `/activate`, `/deactivate`, `/refresh-registry`, `/config`, `/config-schema`. Plan entitlements tier-installs whole catalogs (`app/plugins/entitlements.py:58-120`, `PLAN_PLUGIN_TIERS`). Dynamic sidebar is generated from manifests (`loader.get_frontend_sidebar`, `loader.py:477-591`) with `SLUG_SECTION_MAP` (`loader.py:392-462`), `SIDEBAR_SUPERSEDED_BY` (basic_website → website_builder, `loader.py:473-475`), `coming_soon`/`deprecated`/`visible_to` filters. Lifecycle hooks: `hooks.py` per module (`loader.get_hooks`, `loader.py:258-276`), run on install/uninstall (`plugins.py:83-102, 435, 752`). Config schemas: `config_schema.yaml` per module → `/plugins/<slug>/config-schema` → settings UI → `SchoolPlugin.config` read via `app/plugins/config_store.py:38-58` (`plugin_config_value`). Blueprint mounting is split: core statically mounts almost everything (`app/api/v1/__init__.py`, `STATICALLY_MOUNTED_MODULES` set at line 9 keeps the loader from double-registering); only manifests whose blueprint is NOT in that set are mounted by the loader (`loader.py:150-203`).

---

## 2. Per-plugin table

`Registry` column: **M** = mounted+gated (live), **D** = deprecated/unpublished manifest (routes still mounted+gated, hidden from marketplace/sidebar), **S** = stub module folder (docstring-only `__init__.py`, manifest only). LOC = plugin-module files only (routes/hooks); the real code lives in `app/api/v1/*`.

| Slug | Name | Tier/price NPR | Owns models (`app/models/`) | Blueprint | Registry | LOC | Web UI | Flutter |
|---|---|---|---|---|---|---|---|---|
| academics | Academic Setup | core/0 | academic.py (8) | api.v1.academics | M | 1 | /dashboard/academics | admin academics |
| admission | Admission Management | growth/149 | admission.py (4) | api.v1.admission | M | 1 | /dashboard/admission | admin admission |
| attendance | Attendance Management | core/0 | attendance.py (3) | api.v1.attendance | M | 1 | /dashboard/attendance | admin+teacher |
| notices | Notice Board | core/0 | notice.py (2) | api.v1.notices | M | 1 | /dashboard/notices | all 4 apps |
| basic_reports | Basic Reports | core/0 | report? (none; reads others) | api.v1.reports | M | 1 | /dashboard/reports | admin reports |
| file_management | File Management | core/0 | file.py (2) | api.v1.files | M | 1 | /dashboard/files | — |
| iemis_importer | IEMIS Importer | add_on/0 | iemis.py | api.v1.iemis_importer | M | 1 | /dashboard/iemis-import | — |
| assignments | Assignments | starter/99 | assignment.py (2) | api.v1.assignments | M | 1 | /dashboard/assignments | teacher+parent |
| exams | Exams | starter/99 | exam.py (5), question_bank | api.v1.exams | M | 1 | /dashboard/exams | admin+student |
| fees | Fees | starter/99 | fee.py (7) | api.v1.fees | M | 1 | /dashboard/fees | all 4 |
| timetable | Timetable | starter/99 | timetable.py (4) | api.v1.timetable | M | 1 | /dashboard/timetable | all 4 |
| sms_notifications | SMS Notifications | starter/99 | notification.py (6 shared) | api.v1.sms (+communications slice) | M | 1 | /dashboard/sms | admin comms |
| library_management | Library Management | starter/99 | library.py (books, book_transactions, book_issues) | api.v1.library | M | 1 | /dashboard/library | teacher+student |
| elibrary | E-Library & Digital Content | starter/99 | digital_content.py (digital_books, past_papers, oer_resources) | api.v1.elibrary | M | 1 | /dashboard/elibrary | student+parent |
| lms | LMS | growth/149 | lms.py (9) | api.v1.lms | M | 1 | /dashboard/lms | teacher+student |
| hr_payroll | HR & Payroll | growth/199 | hr_payroll.py (5) | api.v1.hr_payroll | M | 1 | /dashboard/hr | admin+teacher |
| health_records | Student Health Records | growth/149 | health_records.py (3) | api.v1.health_records | M | 1 | /dashboard/health-records | student+parent |
| wellbeing | Student Wellbeing | growth/149 | wellbeing.py (6) | api.v1.wellbeing | M | 1 | /dashboard/wellbeing | all 4 |
| student_portfolio | Student Portfolio | growth/149 | portfolio.py (3) | api.v1.portfolio | M | 1 | /dashboard/portfolio | all 4 |
| gamification | Student Gamification | growth/149 | gamification.py (5) | api.v1.gamification | M | 1 | /dashboard/gamification | admin+student |
| alumni | Alumni Network | growth/149 | alumni.py (3) | api.v1.alumni | M | 1 | /dashboard/alumni | admin |
| inventory | Inventory & Assets | growth/149 | inventory.py (3) | api.v1.inventory | M | 1 | /dashboard/inventory | admin |
| compliance | Compliance & EMIS | growth/149 | compliance.py (3) | api.v1.compliance | M | 1 | /dashboard/compliance | admin |
| visitor_management | Visitor Management | growth/149 | visitor.py (2) | api.v1.visitor | M | 1 | /dashboard/visitors | admin |
| dismissal | Dismissal & Pickup | premium/299 | dismissal.py (2) | api.v1.dismissal | M | 1 | /dashboard/dismissal | admin+parent |
| incidents | Incident Management (base) | premium/299 | incident.py (incidents, witness_statements, incident_actions) | api.v1.incidents | M | 1 | /dashboard/incidents | admin |
| incident_management | Full Incident Management | growth/199 | incident_management.py (escalations, workflow_events) | modules/incident_management.routes | M | 822 | /dashboard/incident-management | — |
| emergency | Emergency Management | premium/299 | emergency.py (3) | api.v1.emergency | M | 1 | /dashboard/emergency | all 4 |
| disaster_management | Disaster Management | premium/299 | disaster_management.py (2) + reuses emergency.py | modules/disaster_management.routes | M | 664 | /dashboard/disaster | — |
| biometric | Biometric Integration | premium/299 | biometric.py (3) | modules/biometric.routes | M | 736 | /dashboard/biometric | — |
| multi_branch | Multi-Branch Chain | premium/299 | school_chain.py (2) | modules/multi_branch.routes | M | 638 | /dashboard/multi-branch | — |
| white_label | White-Label Branding | premium/299 | none (School.settings) | modules/white_label.routes | M | 216 | /dashboard/white-label | — |
| website_builder | Advanced Website Builder | premium/299 | website.py (4 shared) | api.v1.website_builder | M | 1 | /dashboard/website-builder | — |
| basic_website | School Website | core/0 | website.py (4) | api.v1.website | M | 1 | public site + /dashboard/website | — |
| design_studio | Design Studio | growth/149 | designer_* (4 tables) | api.v1.design_studio | M | 1 | /dashboard/designer + certificates | admin |
| ai_suite | AI Suite (bundle) | premium/399 | none (gates others) | **none — licensing gate only** | M | 0 | /dashboard/ai-workbench (PluginGate ai_suite) | manifest declares, folder absent |
| social_ads | Social Ad Boosting | growth/499 | social.py (ad_campaigns) | modules/social_ads.routes | **D** (deprecated, unpublished) | 656 | none (0 grep hits) | — |
| social_hub | Social Media Hub | growth/699 | social.py (hub_*, 5 tables) | api.v1.social_hub | **D** (withdrawn) | 1 | none | admin social_hub folder |
| ai_tools | AI Tools Suite | premium/1499 | ai_workbench.py (14), question_bank | api.v1.ai_tools | **D** | 1 | /dashboard/ai-tools | admin+teacher ai_tools |
| ai_tutor | AI Tutor | premium/1499 | ai_workbench.py (tutor_*) | api.v1.ai_tutor | **D** | 1 | — | student ai_tutor |
| ai_grading | AI Auto-Grading | growth/599 | assignment.py (shared) | api.v1.assignments (AutoGrader inside) | **D** | 1 | — | — |
| ai_insights | AI School Intelligence | growth/999 | ai_insight.py (3) | api.v1.design_studio **(wrong bp)** | **D** | 1 | — | admin ai_insights refs |
| ai_adaptive_learning | AI Adaptive Learning | premium/1499 | adaptive_learning.py (2) | modules/ai_adaptive_learning.routes | **D** | 649 | ai-tools/learning-paths, /progress | — |
| advanced_analytics | Advanced Analytics | premium/999 | ai_insight.py (shared) | api.v1.reports | **D** | 1 | — | — |
| benchmarking | School Benchmarking | premium/1499 | ai_insight.py (shared) | api.v1.benchmarking | **D** | 1 | /dashboard/benchmarking | — |
| library (legacy) | Library Management (dup) | starter/99 | library.py (shared) | api.v1.library | **D** | 1 | — | — |
| digital_content (legacy) | E-Library (dup) | growth/499 | digital_content.py (shared) | api.v1.design_studio **(wrong bp)** | **D** | 1 | — | — |
| portfolio (legacy) | Student Portfolio (dup) | growth/399 | portfolio.py (shared) | api.v1.portfolio | **D** | 1 | — | all 4 flutter use `portfolio` folder |
| conferences | PT Conferences | growth/199 | conference.py (3) | api.v1.conferences | M + **coming_soon** | 1 | gate only (1) | parent pt_conference |
| gps_tracking | GPS Bus Tracking | premium/299 | transport.py (4) | api.v1.transport | M + **coming_soon** | 1 | gate only | parent bus_tracker |
| whatsapp_bot | WhatsApp Bot | starter/99 | notification.py (WhatsApp*) | api.v1.whatsapp_bot | M + **coming_soon** | 1 | gate only | — |
| **ai_tools module folder** | — | — | — | — | **S** | 0 | — | — |
| **ai_suite module** | — | — | — | — | manifest-only, no `__init__.py` (Python package broken) | — | — | — |

All module LOC totals: stub modules = 41 docstring-only `__init__.py` files; real module code = 7 modules with `routes.py`+`hooks.py` (4,374 LOC). Legacy `app/api/v1/{adaptive_learning,biometric,white_label,multi_branch,social_ads,disaster_management,incident_management}.py` are 2-line re-export shims.

---

## 3. Duplication map & merge plan

### Cluster A — AI (7 plugins + ai_suite + services/ai + api/v1/ai_*)
**State (verified):** `ai_suite` (manifest `modules/ai_suite/manifest.yaml`) is a pure licensing bundle: no blueprint, no code; 21 `ai_suite` gates in `ai_workbench.py` etc. Legacy plugins remain fully mounted and gated, alias-satisfied by an `ai_suite` install: `ai_tools` (16 routes: question-paper/v2, lesson-plan, timetable+save, remarks, homework-help, insights/weekly|daily|risk, letter-writer, question-bank CRUD, generated-papers; gated 16× `ai_tools` — NOT alias-aware), `ai_tutor` (6 routes, gated `ai_suite`), `ai_adaptive_learning` (7 routes under `/lms/*`, gated `ai_adaptive_learning`), `ai_grading` (no own routes — lives inside `assignments.py:323` AutoGraderService), `ai_insights` (no own routes; `school_insights` svc consumed by `tasks/ai_insights_weekly.py` and `ai_tools` insights), `benchmarking` (2 routes in `api/v1/benchmarking.py` — note **unbounded `_overview_payload` loop over all schools** at `benchmarking.py:52-66`), `advanced_analytics` (no own routes; `/dashboard/analytics` is ungated core `analytics.py`). Plus `ai_workbench.py` (14 routes, registry/nutrition/moderation), `ai_capture.py` (3), `ai_extensions.py` (3), `ai_usage.py` (5, ungated core), and 31 service modules of which **10 are dead code** (see §4 #3).
**Overlap:** ~85% conceptual — one product (AI), seven price tags, one bundle.
**Merge verdict:** *ALREADY MERGED at the gate; finish the cleanup.* (1) Make every ai_* gate use `@plugin_required("ai_suite")` (see inconsistency §4 #2). (2) Delete the 7 deprecated manifests **and** their alias entries only after a data migration rewrites legacy `school_plugins` rows to `ai_suite` (then aliases can go). (3) Delete the 10 dead `services/ai/*` modules. (4) Fold `ai_capture`/`ai_extensions`/`ai_usage` gates under ai_suite for consistency. (5) Fix `ai_insights`/`digital_content` manifests that point at `app.api.v1.design_studio` — wrong blueprint, pure copy-paste.

### Cluster B — Library (library, library_management, elibrary, digital_content, file_management)
**State:** `library_management` (starter 99) and `library` (starter 99) share ONE blueprint `api/v1/library.py` (9 routes: books CRUD, issues, return, settings, teacher view) and one table set (`books/book_transactions/book_issues`). `elibrary` (starter 99) owns `digital_books/past_papers/oer_resources` via `api/v1/elibrary.py` (6 routes) — digital reading, distinct. `digital_content` was a duplicate *publication* of elibrary at 5× price (growth 499) — deprecated, alias kept. `file_management` is unrelated (generic uploads, `api/v1/files.py`).
**Overlap:** library vs library_management = 100% same code, two slugs; digital_content vs elibrary = 100%.
**Merge verdict:** *Already merged via aliases; keep.* Canonical: **library_management** + **elibrary**. Delete the two deprecated manifests; migrate legacy SchoolPlugin rows; drop `library`/`digital_content` aliases after migration. `library.py` still gates `@plugin_required("library")` (lines 72-311) — flip to `library_management` for readability. Keep `file_management` separate (it is generic infra).

### Cluster C — Website (basic_website, website_builder, white_label, design_studio, social_ads, social_hub)
**State:** `basic_website` (core, free) = public site + config + contact inbox (`api/v1/website.py`, 15 routes, 3 gates). `website_builder` (premium 299) = pages/sections/drafts/history/AI design (`api/v1/website_builder.py`, 27 routes, 25 gates) — depends_on basic_website, same `website.py` tables, loader supersedes basic_website's sidebar entry when installed (`loader.py:473-475`). `white_label` (premium) = custom domain + branding on School settings, own module routes (175 LOC) — distinct concern. `design_studio` (growth 149) = Canva-like ID cards/certificates/bulk docs via designer services — distinct product, same `website.py` model file only for designer aliases. `social_ads` (deprecated, 613-LOC module) = Meta/TikTok ad-campaign CRUD with honest zero-metrics stubs (no meta_ads service exists). `social_hub` (withdrawn per E230, 12 routes, 5 hub_* tables) = private social network; moderation liability; only 1 frontend grep hit.
**Overlap:** basic_website/website_builder = same tables, tier chain (intentional two-tier, keep). social_ads/social_hub share `models/social.py` but are different features, both dead commercially.
**Merge verdict:** Keep basic_website↔website_builder as a **feature-flagged tier chain** (already correct). Keep white_label and design_studio independent (not duplicates). **Delete social_ads and social_hub** (routes, module, `models/social.py` hub/ad tables + migration) after exporting any installed rows; they are deprecated, unreferenced by any frontend page, and social_ads has zero real integrations (manifest claims `app.services.social.meta_ads/facebook/instagram/tiktok` — none exist).

### Cluster D — Reports (basic_reports, advanced_analytics, benchmarking)
**State:** `basic_reports` (core) = `api/v1/reports.py` 7 gated routes (attendance/fees/exam summaries + PDFs). `advanced_analytics` (deprecated) = no routes; `/dashboard/analytics` is served by ungated core `api/v1/analytics.py` (`overview`, `academic` — NO plugin gate). `benchmarking` (deprecated, aliased to ai_suite) = 2 routes comparing schools via `analytics._overview_payload` over **all schools in DB**.
**Overlap:** analytics.py/reports.py/benchmarking.py all aggregate the same attendance/fee/exam numbers.
**Merge verdict:** Keep **basic_reports** canonical. Move benchmarking's 2 routes into reports.py (or ai_workbench) as ai_suite-gated endpoints and delete `api/v1/benchmarking.py` + its manifest. Delete `advanced_analytics` manifest; either gate `/dashboard/analytics` (decide if it is core or ai_suite) or document it as core.

### Cluster E — Incidents / safety (incidents, incident_management, emergency, disaster_management, dismissal, visitor_management, biometric)
**State:** `incidents` (premium 299) = base CRUD + statements + actions on `incidents` table (8 routes). `incident_management` (growth 199) = workflow/assignment/escalation/conference/audit **on the same `incidents` table** plus its own 2 tables (12 routes, module). Different price tiers of one chain, sharing `models/incident.py` — the manifest comment says "no base /incidents route duplicated" and verified true. `emergency` (premium 299) = alerts/plans/headcounts (9 routes). `disaster_management` (premium 299) = drills + participation + overview + seismic alerts (10 routes), reuses `EmergencyAlert`/`EvacuationPlan` models, and its `/disaster/overview` aggregates emergency data — functionally the premium tier of emergency. `dismissal`, `visitor_management`, `biometric` are distinct features, no overlap.
**Overlap:** incidents/incident_management share the entity and a near-identical name (confusing); emergency/disaster_management overlap on overview/alerts.
**Merge verdict:** Keep both incident tiers (already layered, no route duplication) but **rename** — e.g. `incidents` → `incident_log` or fold `incidents` into `incident_management` as a free base tier with one manifest and price tiers; today the *pricing is inverted* (full product 199 < base 299). Merge `disaster_management` INTO `emergency` as a feature-flagged premium section (one manifest, one sidebar entry, `/emergency/*` URL space it already uses) — keep both routes short-term, one manifest.

### Cluster F — Portfolio (portfolio, student_portfolio)
**State:** 100% duplicate: same name "Student Portfolio", same blueprint `api/v1/portfolio.py`, same 3 tables, alias `portfolio→student_portfolio` (`decorators.py:26-27`). Manifest comments document the rename.
**Merge verdict:** *Done.* Delete the deprecated `portfolio` manifest + alias after a row migration; flutter apps still use folder name `portfolio` (cosmetic only).

### Cluster G — Wellbeing / health_records / compliance
**State:** `wellbeing` = mood checkins, surveys, counselor sessions/notes (6 tables). `health_records` = health profiles, medical visits, immunizations (3 tables). **BUT `models/student.py:225` also defines `StudentHealthRecord` (`student_health_records`) — a second, older health record table** overlapping `health_profiles`, plus alias shim `models/health.py` re-exporting both. `compliance` = EMIS/compliance docs (3 tables) — distinct.
**Merge verdict:** Keep all three plugins; **merge the two health models**: migrate `student_health_records` columns into `health_profiles` (or vice versa) and drop one table + the `models/health.py` alias shim.

### Cluster H — Notifications (sms_notifications, whatsapp_bot, notices)
**State:** `sms_notifications` gates both `api/v1/sms.py` (5 routes) and the stats/templates/broadcast slice of `api/v1/communications.py` (12 gates; communications also hosts diary routes gated by **notices**). `whatsapp_bot` (coming_soon) = WhatsApp Cloud config/auto-replies/conversations (11 routes) sharing `notification.py` tables (`WhatsAppMessage/WhatsAppBotConfig`). `notices` (core) = notice board + diary categories.
**Merge verdict:** Keep all three; rename the plugin **sms_notifications → communications** (its routes span SMS+broadcast+email via communications.py) and add alias `sms_notifications→communications`, or move the shared `communications.py` slices into the owning plugins' module folders. `communications.py` mixing two plugins' gates is the real smell.

---

## 4. Other issues found (ordered by severity)

1. **`plugin_required` gate inconsistency breaks the AI bundle.** 16 routes in `api/v1/ai_tools.py` and 7 in `adaptive_learning` module still gate the *legacy* slugs (`ai_tools`, `ai_adaptive_learning`) while sibling files gate `ai_suite`. A school whose legacy row was migrated to `ai_suite` alone gets 403 on `/ai-tools/*` and `/lms/learning-paths*` — alias `ai_tools→ai_suite` only works in the other direction (legacy `ai_tools` install satisfies `ai_tools` gate). Audit every gate: `grep -rn "ai_tools\")" app/api/v1`.
2. **Frontend duplicate alias table.** `frontend/lib/plugins.tsx` hand-copies `PLUGIN_SLUG_ALIASES`; drift risk (backend comments already warn). Serve it from `/api/v1/plugins/config-schema`-style endpoint or `/sidebar` payload.
3. **~10 dead AI service modules (0 importers):** `admission_bot`, `attendance_ai`, `content_gen`, `fee_predictor`, `report_remarks`, `sentiment`, `social_ai`, `translator`, `wellbeing_ai` (~630 LOC), plus `plagiarism` (only self-reference). Delete or wire.
4. **Manifest `services:`/`tasks:` headers are fiction.** Of ~35 declared service paths, 20 don't exist (`lead_scoring`, `weekly_insights`, `grading_engine`, `lesson_planner`, `remark_generator`, `ai/tutor`, `designer.pdf_generator`, `emergency.earthquake_api/alert_system/gps_processor`, `payments.esewa/khalti/fonepay` (files are `*_gateway.py`), `social.meta_ads/facebook/instagram/tiktok`, `communications.sparrow_sms/whatsapp` (real: `whatsapp_cloud.py`), `website.theme_engine` (real: `services/website/theme_engine.py` — declared as `app.services.website.theme_engine` but different consumers), `compliance.emis_export`, `lms.content_engine`). Nothing imports these headers, so nothing breaks — but they mislead and should be validated at manifest load (add a loader check that warns on missing paths).
5. **Pricing inconsistencies:** `incident_management` (full workflow, growth 199) is cheaper than `incidents` (base CRUD, premium 299). `ai_insights` deprecated at growth/999 vs bundle premium/399 — fine, but stale tags remain visible in mirror rows. `design_studio` description says NPR 499 in `decorators.py:50` comment vs manifest 149.
6. **`ai_suite` module folder is not a Python package** (no `__init__.py`; `modules/ai_tools/__init__.py` is a stub while its routes live in `api/v1/ai_tools.py` under a *different* module). Either give bundle modules a real package or move routes in.
7. **Benchmarking endpoint is a cross-tenant data-mining surface:** `GET /benchmarking/rankings` loops every active school and computes `_overview_payload(school.id)` per school (N+1 × full aggregates) and returns per-school pass rates/attendance — aggregated, but with no per-school caching and heavy DB load; also `/overview` computes district/national aggregates inline. Add caching + aggregate SQL.
8. **`api/v1/analytics.py` (`/overview`, `/academic`) is ungated** while deprecated `advanced_analytics` was premium 999 for the same data — decide: core or ai_suite-gated.
9. **Duplicate health concept:** `student_health_records` (models/student.py:225) vs `health_profiles` (models/health_records.py:17) — two tables, one concept (see Cluster G).
10. **`library.py` gates + settings mismatch:** file header says settings live under `library_management` slug, routes gate `library` slug — works only through the alias; confusing and fragile if aliases are ever dropped.
11. **Usage logging is dead:** `billing.log_usage()` (`billing.py:237`) and `plugin_usage_logs` table have **zero callers** — install analytics/telemetry never fires; `install_count` is incremented directly instead.
12. **Coming-soon vs installed asymmetry:** `conferences`, `gps_tracking`, `whatsapp_bot` are `coming_soon` (not installable), but their routes are mounted and gated; if any school already holds a legacy row (or a plan grant pre-dating the flag) the features are live with no marketplace card — ensure `ensure_free_plugins`/`grant_plan_plugins` skip `coming_soon` slugs (they check manifest only in `install_plugin`, not in `grant_plan_plugins` → potential bypass installing coming-soon plugins via plan grants).
13. **Stale `SLUG_SECTION_MAP` entries** (`loader.py:404-461`) contradict manifests (`digital_content` marked "deprecated dup" but map keeps entries; comment says 7 AI plugins merged, map lists 6 + advanced_analytics separately). Cosmetic but confusing.
14. **Legacy flat-manifest path (`app/plugins/manifests/*.yaml`) contains only non-plugin UI manifests** (dashboard, hostel, marketplace_nav, plugins_nav, settings_core, students, teachers, users) — i.e. `hostel` is a *plugin* with a legacy manifest, while the loader treats both dirs as plugin sources; merge hostel into modules/ and retire the legacy dir.
15. **Tests:** strong coverage for fees/HR/biometric/incident_management/disaster/multi_branch/marketplace/plugins; **zero test files for alumni** (grep = 0) and thin/no coverage for `elibrary` public routes, `white_label` (1), `website_builder` (1), `compliance` (1), `dismissal` (1).
16. **Hardcoded values:** BASE_DOMAIN default `brighternepal.com` in `app/__init__.py:450`; mastery thresholds `ADVANCED_AT=80/INTERMEDIATE_AT=60` hardcoded in `modules/ai_adaptive_learning/routes.py:54-55`; benchmarking top-20 cap hardcoded (`benchmarking.py:69`); trial-days default 14 in DB while `effective_trial_days` reads config.
17. **Public website endpoints rate-limited but not captcha'd** (`website.py:472,522,715` — 5/hour per IP; acceptable, note only). Admission-inquiry/contact are tenant-scoped by slug — OK.
18. **`models/report.py` doesn't exist** although `basic_reports` declares `models_module: app.models.report` (reports own no tables; manifest header wrong).

---

## 5. Ordered remediation checklist

1. **P0 — Fix ai_suite gating split-brain:** change all `@plugin_required("ai_tools")`/`("ai_adaptive_learning")`/`("ai_tutor")`-style legacy gates to `ai_suite` (16+7+… routes). Verify legacy installs still pass via reverse aliases. Add a test that every gate slug is either canonical or alias-resolvable in *both* directions.
2. **P0 — Close the plan-grant hole for coming_soon plugins** (`entitlements.grant_plan_plugins` must skip `coming_soon`/`deprecated` slugs).
3. **P1 — Data migration:** rewrite legacy `school_plugins` rows (`ai_*`, `benchmarking`, `advanced_analytics`, `library`, `digital_content`, `portfolio`, `communications`?) to canonical slugs; then delete deprecated manifests + `PLUGIN_SLUG_ALIASES` entries + frontend mirror table.
4. **P1 — Delete social_ads + social_hub** (module, blueprint, `hub_*`/`ad_campaigns` tables + migration, flutter_admin `social_hub` feature). Keep only if a paying customer exists (grep says none).
5. **P1 — Merge benchmarking into reports/ai_suite; delete `api/v1/benchmarking.py`;** cache or SQL-aggregate the cross-school queries.
6. **P1 — Merge disaster_management into emergency** (one manifest, premium feature-flag), or at minimum one sidebar entry + shared section.
7. **P2 — Health-model consolidation:** migrate `student_health_records` → `health_profiles`; drop `models/health.py` shim.
8. **P2 — Delete 10 dead `services/ai/*` modules;** add a manifest-load validator that warns when `services:`/`tasks:`/`models_module:` paths don't exist, then fix the ~20 fictional declarations.
9. **P2 — Restructure naming:** rename `sms_notifications` → `communications` (with alias); decide `incidents` vs `incident_management` pricing/rename; give `ai_suite` an `__init__.py`; move `ai_tools` routes into its module or rename the module.
10. **P2 — Serve `PLUGIN_SLUG_ALIASES` + display labels from the backend** and delete the frontend copy.
11. **P3 — Wire or delete `log_usage`/`plugin_usage_logs`;** fix `basic_reports` manifest `models_module`; clean `SLUG_SECTION_MAP`; retire legacy manifests dir (fold `hostel` into modules/); make `/dashboard/analytics` gating decision explicit; add tests for alumni/white_label/website_builder/compliance/dismissal/elibrary.
12. **P3 — Cosmetic:** move BASE_DOMAIN to config; externalize mastery thresholds; update stale price comments.
