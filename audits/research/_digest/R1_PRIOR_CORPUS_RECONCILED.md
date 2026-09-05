# R1 — Prior Corpus Reconciled (17 reports + index + master plan)

Date: 2026-09-05 · Method: full read (no grep/partial) of the 17 assigned reports plus
`audits/AUDIT_INDEX.md` and `docs/MASTER_PLAN_2026-09.md`. This file replaces re-reading
them. It reconciles claims, records every disagreement, and consolidates the open backlog.
No source file was modified; nothing here was re-verified against the working tree — that
is §D's job list for a verifier.

Tags used in §A: **[VERIFIED-IN-REPORT]** = the report backs the claim with a file:line,
command output, or quoted code · **[UNVERIFIED-ASSERTION]** = asserted from memory, from
another document, from marketing copy, or as a plan/recommendation with no evidence anchor.

Corpus read (absolute paths, line counts as read):

| # | File | Lines | Date |
|---|---|---|---|
| 1 | `/home/bishal-regmi/Desktop/ASchool/audits/research/AI_TEACHER_INTEGRATION_BLUEPRINT.md` | 53 (**truncated**) | 2026-09-04 |
| 2 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md` | 238 | 2026-09-04 |
| 3 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_CURRENT_STATE.md` | 241 | 2026-09-04 |
| 4 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_FLUTTER_WIDGET_AUDIT.md` | 209 | 2026-09-04 |
| 5 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_MOBILE_APPS_INVENTORY.md` | 362 | 2026-09-04 |
| 6 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` | 159 | 2026-09-04 |
| 7 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_WEB_UI_INVENTORY.md` | 319 | 2026-09-04 |
| 8 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASCHOOL_WEB_WIDGET_AUDIT.md` | 386 | 2026-09-04 |
| 9 | `/home/bishal-regmi/Desktop/ASchool/audits/research/ASHLYA_AI_DEEPDIVE.md` | 608 | 2026-09-04 |
| 10 | `/home/bishal-regmi/Desktop/ASchool/audits/research/COMPETITOR_LANDSCAPE_NEPAL.md` | 233 | 2026-09-04 |
| 11 | `/home/bishal-regmi/Desktop/ASchool/audits/research/PLUGIN_UI_SPEC_ALL.md` | 395 (**truncated**) | 2026-09-04/05 |
| 12 | `/home/bishal-regmi/Desktop/ASchool/audits/research/SAHAYATRI_SPEC_INVENTORY.md` | 341 | 2026-09-04 |
| 13 | `/home/bishal-regmi/Desktop/ASchool/audits/research/SAHAYATRI_BACKEND_CODE.md` | 306 | 2026-09-04 |
| 14 | `/home/bishal-regmi/Desktop/ASchool/audits/research/SAHAYATRI_CLIENTS_UX.md` | 461 | 2026-09-04 |
| 15 | `/home/bishal-regmi/Desktop/ASchool/audits/research/UNIFIED_ROADMAP_2026-09.md` | 247 | 2026-09-05 |
| 16 | `/home/bishal-regmi/Desktop/ASchool/audits/research/_digest/D4_COMPETITOR_REFRESH.md` | 95 | 2026-09-05 |
| 17 | `/home/bishal-regmi/Desktop/ASchool/audits/research/_digest/D5_DAY_IN_THE_LIFE_REVIEW.md` | 124 | 2026-09-05 |
| 18 | `/home/bishal-regmi/Desktop/ASchool/audits/AUDIT_INDEX.md` | 199 | header says 2026-08-27, newest entry 2026-09-05 |
| 19 | `/home/bishal-regmi/Desktop/ASchool/docs/MASTER_PLAN_2026-09.md` | 448 | 2026-09-03 |

> **Corpus integrity finding (new, applies before anything else):** two of the 17 files are
> **structurally incomplete** — they end on an unfilled append marker and never deliver the
> content their own table of contents promises.
> - `AI_TEACHER_INTEGRATION_BLUEPRINT.md` ends at line 53 with `<!-- APPEND-MARKER-A -->`
>   directly under the heading "## 1.3 Pedagogy stack (what is designed vs what actually runs)".
>   Its TOC (lines 15-25) promises 7 chapters incl. "§3 the wire protocol", "§4 data model",
>   "§6 quality verdict … (file:line)" and "§7 the ASchool integration blueprint". **None exist.**
>   Anything citing this file for endpoints/DDL/prompts is citing a document that stops at §1.2.
>   (The 1,540-line `ATEACHER_INTEGRATION_BLUEPRINT.md` — different filename, another agent's
>   scope — is the complete one; the two names differ by one word and are easily confused.)
> - `PLUGIN_UI_SPEC_ALL.md` declares scope "**39 published plugins**" (line 5) and a
>   "PART 1 — … (13 plugins)" header (line 35), but contains only **4** plugin specs
>   (`academics`, `attendance`, `exams`, `fees`) and ends at line 395 with `<!--APPEND-->`.
>   35 of 39 plugin UI specs do not exist. `UNIFIED_ROADMAP` never cites it, but `AUDIT_INDEX`
>   does not list it at all either — it is an orphaned, 10%-complete deliverable.

---

# §A. PER-REPORT PRECIS + LOAD-BEARING CLAIMS

## A1. `AI_TEACHER_INTEGRATION_BLUEPRINT.md` (53 lines, INCOMPLETE)

Intended as the ARIA/ATeacher→ASchool port blueprint sourced from
`/home/bishal-regmi/Desktop/Ashlya Academy Latest/ashlya_academy/ATeacher/ai_teacher`
(described as Flask + Flask-SocketIO ≈6.4k LOC backend, Flutter ≈6.6k LOC client). What
survives is a product definition of ARIA — a live one-to-one whiteboard tutor that speaks via
Edge-TTS while hand-writing text and drawing labelled SVG on an animated canvas, interruptible
mid-lesson ("Ask") by text/voice/tap, resuming where it paused, emitting a lesson summary and
per-concept mastery map — plus the persona-as-data claim. Everything technical (protocol, DDL,
defect list, integration plan) is missing.

Load-bearing claims:
- Owner decision recorded: ASchool does **not** get the Sahayatri offline whiteboard; it gets
  ARIA instead (lines 7-8). [VERIFIED-IN-REPORT] (as a decision record, echoed by roadmap §3.2)
- The board is the primary output channel and speech is generated from the *same token stream*
  as the draw commands, so narration and writing are inherently synchronised (lines 38-40).
  [UNVERIFIED-ASSERTION] (no file:line; contradicts nothing but rests on the missing §3)
- 5 teacher personas live as **rows** in `ateacher_teachers`, not code, seeded by
  `backend/seed_teachers.py:42-408`, modelled at `backend/models/database.py:49-133`; each row
  has 4 independently editable prompt columns (`safety_rails`, `persona_block`,
  `teaching_style_prompt`, `board_style_note`) assembled by
  `backend/services/prompt_composer.py:70-131`; "adding a teacher is an INSERT, not a deploy."
  [VERIFIED-IN-REPORT] (corroborated independently by ASHLYA_AI_DEEPDIVE §1.1)
- Method claim: "every ATeacher backend service and Flutter file read in full" (line 9).
  [UNVERIFIED-ASSERTION] — the deliverable does not contain that reading.

## A2. `ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md` (238 lines)

Feature-completeness sweep of `backend/app/api/v1/**`, the 7 real plugin modules, services,
models and tasks, done by mapping every `@*_bp.route`, spot-reading load-bearing handlers,
grepping stub markers, and cross-checking each URL fragment against `frontend/app|components|lib`
plus the five `flutter_*/lib` trees. Verdict: the backend is far ahead of the UI — ~90-95% of
buyer-expected features have real tenant-scoped implementations — with gaps concentrated in
subject-wise attendance, transcripts, custom grading scales, Nepali payroll tax, non-Khalti
refunds, timetable quality, and ~20 fully-built endpoints nobody consumes.

Load-bearing claims:
- **680 routes / ~1,300 methods across 68 blueprints; 577 routes plugin-gated; 507 tests**
  (§headline). [VERIFIED-IN-REPORT] (method stated; counts not reproducible from the text)
- "Backend is ~92% feature-complete" (§7) with per-domain percentages: auth 98, students 95,
  academics 95, attendance 85, fees 90, exams 88, timetable 75, HR 88, comms 92, transport 85,
  admission 95, library 95, LMS 90, assignments 95, website 92, analytics 85, files 95,
  hostel 90, inventory 85, safety 90. [UNVERIFIED-ASSERTION] (percentages are judgement calls)
- Absent-alert delivery is broken: `app/tasks/attendance_alerts.py` emits
  `attendance.student_absent` (beat 16:30) but `app/plugins/listeners.py` registers 18 events,
  none of them that one → "Alerts are logged, not delivered" (§1.4, §5.1). [VERIFIED-IN-REPORT]
  — **superseded**: W0 wired it (`listeners.py:69`), see §B-1.
- Leave approve/reject only flips status (`attendance.py:586-620`), writes no Attendance rows,
  and rejection reason is explicitly not persisted (`attendance.py:612-614`). [VERIFIED-IN-REPORT]
  — **superseded** by migration `d5c8f2a7b4e1`.
- Timetable "AI solver" is a greedy stub: `app/services/ai/timetable_solver.py:44-88` assigns
  round-robin (`subject_queue = list(subjects) * 2`), builds `teacher_map` at line 40 and never
  consults it, and returns `"conflicts": []  # Would contain detected clashes` (line 88). No room
  model exists at all. [VERIFIED-IN-REPORT]
- Refunds are Khalti-only, full-amount only: `fees.py:1897-1990` returns 422 for esewa/fonepay
  (§1.5; §5.7 cites `fees.py:1907-1909`). [VERIFIED-IN-REPORT]
- Payroll tax is a flat `taxRate` % of basic at `hr_payroll.py:226,287-288`; no TDS slabs, no
  SSF/PF employer split, no annual certificate. [VERIFIED-IN-REPORT]
- `GRADE_TABLE` is a module constant in `app/utils/nepal_grading.py`; `/grade-table` is read-only
  (`exams.py:205-216`) → no per-school grading scale. [VERIFIED-IN-REPORT]
- No transcript endpoint exists (grep found only AI-audio "transcript" hits). [VERIFIED-IN-REPORT]
- `models/curriculum.py` (`curriculum_frameworks`, `subject_offerings`) has **no API routes** —
  dead unless wired (§1.3, §3). [VERIFIED-IN-REPORT] — **superseded**: W0 added 3 read routes at
  `academics.py:983+`.
- `document_chunks` is written only by `services/ai/extensions.seed_pd_framework` (called at boot,
  `app/__init__.py:569-571`) and read by RAGService → "half-dead"; no school-facing upload path.
  [VERIFIED-IN-REPORT]
- `plugin_usage_logs` has zero callers. [VERIFIED-IN-REPORT] (same finding as plugin audit §4.11)
- 20-item NO-UI list (§4), ranked: leave-requests (0/0), `school-overview` (flutter-only),
  visitor appointments (3 routes 0/0), procurement + `/assets/scan/<qr>`, `compliance/audit-logs`
  (flutter-only), `alerts/<id>/headcount` (flutter-only), alumni donations (flutter-only),
  `POST /ai/iep` + moderation flags (0/0), capture photo/voice confirm, `/ai/ext/qti/export`
  (0/0), `/insights/risk-alerts`, `/generated-papers/<id>`, students transfers list, receipts
  alias + statement pdf, white-label domain verify button, payslip PDF, notification-settings,
  `/database-backup`, `/chain/analytics`, `GET /search`. Self-flagged as grep-based and needing
  spot-verification. [VERIFIED-IN-REPORT with stated caveat]
- Security notes: device-facing biometric ingest has no per-device rate limit
  (`biometric/routes.py:582`) [VERIFIED-IN-REPORT] — **superseded** (`device_rate_limit()` added);
  `sms_gateway.py:8,25` speaks plain `http://` to Sparrow [VERIFIED-IN-REPORT] — **superseded**;
  `/attendance/school-overview`, `/analytics/*`, `/ai-usage/*` role-guarded but **not**
  plugin-gated [VERIFIED-IN-REPORT]; PDF/DOCX endpoints 501 honestly when WeasyPrint/python-docx
  absent and "deployment must install these" [VERIFIED-IN-REPORT] — python-docx since declared.
- Legacy 2-line re-export shims still mounted for biometric/white_label/multi_branch/
  disaster_management/incident_management/adaptive_learning/social_ads. [VERIFIED-IN-REPORT]
  (`social_ads` since deleted.)

## A3. `ASCHOOL_CURRENT_STATE.md` (241 lines)

The ground-truth digest for planning: what ASchool *is* (multi-tenant Nepal school OS, plugin
marketplace, 5 Flutter apps, BS/NEB/IEMIS/eSewa-Khalti-FonePay Nepal layer), followed by an
item-by-item status table for every master-plan ID (S/D/B/P/F/A/AW/W/G/M/N), a ranked open
backlog, an AI-ecosystem design-vs-live comparison, a deferred/cut list, and the mandatory
conventions (process rules, coding rules, migration rules, test invocation, plugin creation
steps). Compiled from docs + prior audits + git rather than from code, and it says so.

Load-bearing claims (the status table is the single most load-bearing artifact in the corpus —
every later plan reads "already built" from it):
- Architecture counts: "Next.js 14 (215–222 pages dashboard…)", "Flask 3 API (~60 route
  blueprints / **560–680 routes**, **146–161 models**)", "manifests (**59**; **55 published**
  after dedupe)". The ranges are the report hedging between sources. [UNVERIFIED-ASSERTION]
- Pricing/packaging decisions: plugin categories core free / starter 199-399 / growth 199-799 /
  premium 999-2,999; `ai_suite` = **NPR 399/mo (decided 2026-09-03)**; 4 free teaser tools
  (lesson_plan, differentiation, study_guide, flashcards). [VERIFIED-IN-REPORT] (decision record)
- Phase 0 S-01…S-14 + D-01/D-02 all **done** with test counts (7/5/11/…); D-05 **partial**
  (expand done, NOT-NULL phase deliberately deferred); D-07 **mostly done**, remaining
  `marks_history` + `user_mfa`. [VERIFIED-IN-REPORT] (traced to IMPLEMENTATION_AUDIT + git SHAs
  `3e55438`, `0475b7b`, commits 097e39c→e3d5589)
- P-05 entitlement repair is the largest open cluster: remaining = reconcile_plan_plugins (B5),
  trial-consumed flag (B9), max_students (B11), SMS credits (B12), gate sweep H1-H7, **authz
  sweep: 51 bare endpoints, 204 object-level checks, 83 role lists**, plugin-cache dedupe,
  elibrary→ai_suite gate repoint. [UNVERIFIED-ASSERTION] (counts inherited from deep2026)
- S-14 residual: two vendored PHP ERP dirs (`Mighty School Pro v1.6`, `eSchool SaaS v1.8.0
  Nulled`) still exist **on disk**, untracked, though the plan said delete. [VERIFIED-IN-REPORT]
- AI: A-01 "mostly done & LIVE-verified" incl. atomic Redis cost reservation; AW-01…AW-12 status
  per item with AW-06 tutor **red-team PASS (13 live adversarial cases vs gpt-oss-120b)**, report
  at `backend/audits/ai_redteam/known_failure_modes.md`. [VERIFIED-IN-REPORT]
- The documented AI catalog is **~65 tools in 9 categories** (§4 lists all of them by name);
  **10 registry tools seeded**; "the other ~55 catalog tools are **not built**".
  [VERIFIED-IN-REPORT] — collides with the later 153-tool catalog, see §B-4.
- Launch blockers that are not code: production deploy needs an operator (TLS certs at
  `./nginx/ssl`, real secrets ≥32 chars, SMS prod config); **moderation-review workflow must be
  staffed before tutor go-live (founder decision 2)**; backup restore drill; parent-consent /
  privacy flow; student/parent mobile login provisioning. [VERIFIED-IN-REPORT]
- Eight open product decisions enumerated: E22a ai_grading gate, E22b insights dual-gate, E95
  landing demo form endpoint, E97 real RBAC editor vs remove fake page, E14 library double
  listing, iOS ship-or-remove, A-07 metered-credit pricing. [VERIFIED-IN-REPORT]
- Conventions that bind all future work: read audits before touching code; append a dated entry
  to `audits/AUDIT_INDEX.md` after every significant change; response envelope
  `{"success","data","error","meta"}`; single-head Alembic verified up/down from scratch;
  Forest Green tokens (`#0e3b2e` / `#c5f4dd` / `#f7f5f0` / `#0d1f14`); `make test` needs a live
  Postgres; per-suite `TEST_DATABASE_URL` because shared `aschool_test` TRUNCATE-deadlocks.
  [VERIFIED-IN-REPORT]
- "Do-NOT-rewrite list (plan §12)" is reproduced in compressed form. [VERIFIED-IN-REPORT]

## A4. `ASCHOOL_FLUTTER_WIDGET_AUDIT.md` (209 lines)

Widget-level (not screen-level) audit of the six Flutter packages: every shared widget read, all
six pubspecs, all routers/shells, key feature screens, ~30 cross-app primitive greps, and explicit
verification that l10n/a11y/deep-link infrastructure is absent. Conclusion: `aschool_shared` is a
genuine core (models/repos/services/theme/gating) but its widget layer is ~60% of what's needed —
it has state wrappers and cards and **zero domain widgets**, so each app privately re-implements
timetable grids, marks grids, attendance grids, payment sheets, maps, chat and charts. Ends with
25 ranked UX upgrades and a 15-widget shared-kit roadmap.

Load-bearing claims:
- 30 shared widgets enumerated with file names and behaviour (AppTheme, AnimatedToggle, AppDrawer,
  AttachmentViewer/UploadButton, BannerCarousel, CalendarWidget, CustomAppBar, CustomBottomSheet,
  DynamicBottomNav, ErrorContainer, NoDataContainer, ESchool* primitives, ESchoolDialog family,
  FeatureLockedScreen, FilterChipRow, ForceUpdateDialog, LoadingShimmer, Shimmer grids,
  SharedLoginScreen, ModuleScreenTemplate, NepaliDateDisplay, NotificationCenterScreen,
  NotificationBell, PaginatedList, PluginGate, PullToRefresh, ResponsiveActionGrid,
  SearchBarWidget, SectionHeader, SharedChatScreen, StatCard). [VERIFIED-IN-REPORT]
- `PaginatedList` exists but is **used by zero screens**; admin students screen re-rolls its own
  scroll listener. [VERIFIED-IN-REPORT]
- Notification tap deep-link is a commented no-op at `notification_center_screen.dart:133-137`;
  `setOnTapCallback` is never registered by any app. [VERIFIED-IN-REPORT]
- Absent by grep across all 6 packages: `DataTable`/`DataRow` (0), any chart in
  teacher/student/parent (`fl_chart` declared in student+teacher pubspecs, **never imported**),
  `showTimePicker`, `Stepper`, `SearchAnchor`/`Autocomplete`, M3 `Badge`, `Hero`, `Semantics`
  (0 anywhere), debounce/`Timer` search (admin students fires a GET per keystroke,
  `students_screen.dart:107-110`), video_player, audio record/play, signature pad, rich text,
  markdown renderer (`flutter_markdown` declared in student, never imported), PDF viewer,
  QR/barcode **scan** (`mobile_scanner` declared in shared, never imported; admin dismissal says
  "QR scanner … Coming soon" at `dismissal_screen.dart:307`), `connectivity_plus` (declared in
  student+shared, 0 imports). [VERIFIED-IN-REPORT]
- `FileUploadService.pickAndUploadFile` actually calls `pickImage` → non-image files cannot be
  picked (`file_upload_service.dart:82-94`). [VERIFIED-IN-REPORT]
- **No `.arb` files anywhere, no `flutter_localizations` in any pubspec, zero Nepali strings**;
  admin settings has a `_nepaliLanguage` bool that "toggles nothing". [VERIFIED-IN-REPORT]
- Hardcoded `Colors.white` surfaces: **41 teacher, 19 parent, 18 student, 8 admin, 9 user**
  (§1.3) — restated in §4 as "~95 `Colors.white`". [VERIFIED-IN-REPORT] (but see §B-6 for the
  105 figure in D5)
- Shared theme primary is `#22577A` steel blue with `#57CC99` accent — "the **eSchool blue**, not
  the web brand Forest Green `#0e3b2e`"; per-screen off-brand accents named (`0xFFF59E0B→0xFFD97706`
  admin AI brief, `0xFF2563EB` mode-select/module-template, `0xFF8B5CF6` marketplace premium).
  [VERIFIED-IN-REPORT]
- Student homework submission attachment is a **paste-URL dialog** (`_showAttachmentDialog`,
  `homework_screen.dart:358-390`). [VERIFIED-IN-REPORT]
- Teacher attendance is "the best screen in the portfolio" but **fails outright offline** (comment
  at `attendance_screen.dart:193`: "there is no offline queue"). [VERIFIED-IN-REPORT]
- Admin promote screen is GET-only — "grep shows **no POST anywhere**" (`promote_screen.dart`).
  [VERIFIED-IN-REPORT]
- Bus tracking uses `Timer.periodic` 15 s polling; `eventBusLocation` constant is unused.
  [VERIFIED-IN-REPORT]
- flutter_user has **no go_router at all** — an `EntryStage` stage machine hosting each role app's
  own `MaterialApp` (`role_app_host.dart:19-44`), which "breaks the entry app's `context`… and
  blocks deep links". [VERIFIED-IN-REPORT]
- Deep-link readiness: no VIEW intent-filter host/scheme in any AndroidManifest; the
  `<data android:scheme="https">` blocks present are inert autofill `<intent>` tags.
  [VERIFIED-IN-REPORT]
- Proposed 15 shared widgets (AschoolSearchField, BsAdDatePicker, TimetableGrid, AttendanceGrid,
  MarksGrid, PaymentMethodSheet+ReceiptView, MapCard, ChatThread v2, RichTextView, AppImageViewer,
  FilePickUploadButton, OfflineBanner+OutboxScaffold, EmptyState/ErrorState v2, GradeBadge+
  TrendChart, RoleSwitcherSheet) and a token system for `aschool_shared/lib/theme/`.
  [UNVERIFIED-ASSERTION] (design proposal)

## A5. `ASCHOOL_MOBILE_APPS_INVENTORY.md` (362 lines)

Screen-level inventory of all five apps + shared package: per-app file/screen counts, a
REAL/PARTIAL/STUB verdict per screen with the endpoint each calls, the common architecture
(Riverpod, go_router, Dio with single-flight 401 refresh, secure storage, OneSignal+FCM), a
redundancy analysis, the 51-plugin ↔ app-UI matrix, the AI surface, 22 UX gaps vs international
apps, 12 code-health findings, and a P0/P1/P2 work list.

Load-bearing claims:
- Portfolio table: admin 41 files/38 screens, teacher 30/26, student 29/25, parent 25/20,
  user 9/8, shared 104 files (19 models, 15 repositories, 15 providers, 7 services, 30 widgets).
  All Android-only **except flutter_user** (only app with ios/, web, windows, macos, linux). All
  last touched 2026-08-31. [VERIFIED-IN-REPORT]
- Per-app verdicts: admin **31 REAL / 6 PARTIAL / 1 STUB**, teacher 24/2/0, student 24/1/0,
  parent 19/1/0 (text then says "1 PARTIAL (none — all real…)" — internal wobble), user 8 REAL.
  [VERIFIED-IN-REPORT]
- The one STUB: `flutter_admin/lib/features/assignments/assignments_screen.dart` is a static
  `ModuleScreenTemplate` with hardcoded "24 Open / 6 Due Today" and dead buttons — "principals see
  fabricated numbers". [VERIFIED-IN-REPORT]
- Push is dead end-to-end: no `google-services.json` in any app, `ONESIGNAL_APP_ID` unwired,
  `setOnTapCallback` never called, `NotificationService.init()` runs before the school slug is set.
  [VERIFIED-IN-REPORT]
- Offline is absent everywhere: no sqflite/hive/drift anywhere; only secure-storage caching.
  [VERIFIED-IN-REPORT]
- flutter_user **imports flutter_student/flutter_parent/flutter_teacher as path packages** and
  hosts the matching role app after login; admin roles get an "Use Admin App" dead end.
  [VERIFIED-IN-REPORT]
- **Consolidation recommendation: ship 2 apps** — flutter_user (student+parent+teacher) +
  flutter_admin; stop publishing standalone student/parent/teacher binaries, keep them as feature
  packages. [UNVERIFIED-ASSERTION] (recommendation; adopted as roadmap decision §3.8)
- Plugin↔app matrix over "**51 backend plugins**": "Zero app UI (❌): **15 plugins**" followed by a
  list of **20** slugs and the parenthetical "(≈20 of 51…)" — internally inconsistent count
  (§4). [VERIFIED-IN-REPORT as text, self-contradictory]
- Dependency-version fragility: shared pins `share_plus ^9` + teacher pins `web: 0.5.1` while
  flutter_user overrides `web ^1.0.0` + `share_plus ^10` — conflicting majors across the path-package
  graph, documented only in a pubspec comment. [VERIFIED-IN-REPORT]
- Dead deps: `speech_to_text` (teacher — "the voice feature doesn't exist"), `mobile_scanner`,
  `geolocator`, `retrofit`, `freezed`, `riverpod_annotation` (codegen never run).
  [VERIFIED-IN-REPORT]
- Tests: every app's only test pumps a `SizedBox`; `aschool_shared` has 3 real test files.
  [VERIFIED-IN-REPORT]
- `per_page: 100` caps with no pagination in ~10 list screens. [VERIFIED-IN-REPORT]
- Stale docs: `flutter_admin/README.md` is the default Flutter template; `flutter_user/README.md`
  references `../flutter_shared` which does not exist. [VERIFIED-IN-REPORT]
- Apps consume only the `ai_tools` plugin's synchronous endpoints; ai_workbench, ai_capture,
  ai_extensions, tutor sessions and adaptive learning "have no client". [VERIFIED-IN-REPORT]

## A6. `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` (159 lines)

The architecture/duplication reference: how the WordPress-style filesystem catalog + Odoo-style
module folders + request-time gating actually work (with the exact loader/decorator line numbers),
a per-plugin table (slug, tier/price, owned models, blueprint, registry state M/D/S, module LOC,
web UI, flutter), eight duplication clusters A-H each with a merge verdict, 18 ranked "other
issues", and a P0→P3 remediation checklist. This is the file every plugin decision cites.

Load-bearing claims:
- Catalog mechanics: `PluginLoader._scan_manifests()` (`loader.py:43-77`) scans
  `app/plugins/modules/*/manifest.yaml` then legacy flat `app/plugins/manifests/*.yaml`, module
  wins on collision (`loader.py:94-99`); **no AVAILABLE_PLUGINS constant, no seed** — the
  directory *is* the catalog (`loader.py:10-13`); `refresh_registry()` (`loader.py:281-363`,
  called from `app/__init__.py:544-548`) mirrors into `plugins` and **unpublishes** vanished
  folders, never deletes. [VERIFIED-IN-REPORT]
- Gating: `@plugin_required(slug)` (`decorators.py:81-117`); `resolve_school`
  (`app/__init__.py:378-522`) with cross-tenant 403 at `:427-446`; `g.installed_plugins` cached
  300 s under `school:{id}:plugins` (`:492-521`); alias expansion `_acceptable_plugin_slugs()`
  (`decorators.py:56-78`) is deliberately **single-hop non-transitive**; `PLUGIN_SLUG_ALIASES`
  at `decorators.py:13-53`; the frontend **hand-copies** the table in `frontend/lib/plugins.tsx`
  (~line 56). [VERIFIED-IN-REPORT]
- Blueprint mounting is split: core statically mounts almost everything via
  `STATICALLY_MOUNTED_MODULES` (`app/api/v1/__init__.py:9`); the loader mounts only manifests whose
  blueprint is not in that set (`loader.py:150-203`). [VERIFIED-IN-REPORT]
- **P0-1 "AI gate split-brain":** 16 routes in `api/v1/ai_tools.py` and 7 in the adaptive-learning
  module gate legacy slugs while siblings gate `ai_suite`; "A school whose legacy row was migrated
  to `ai_suite` alone gets 403… alias `ai_tools→ai_suite` only works in the other direction."
  [VERIFIED-IN-REPORT as reasoning] — **contradicted by the roadmap's runtime test**, see §B-2.
- **P0-2:** `grant_plan_plugins` does not consult the manifest, so `coming_soon`/`deprecated`
  plugins (conferences, gps_tracking, whatsapp_bot) can be installed via plan grants (§4.12).
  [VERIFIED-IN-REPORT] — **superseded** (`entitlements.py:63-90`).
- ~10 dead `services/ai/*` modules with 0 importers: `admission_bot`, `attendance_ai`,
  `content_gen`, `fee_predictor`, `report_remarks`, `sentiment`, `social_ai`, `translator`,
  `wellbeing_ai` (~630 LOC) + `plagiarism` (self-reference only). [VERIFIED-IN-REPORT]
- **Manifest `services:`/`tasks:` headers are fiction**: of ~35 declared service paths, **20 do
  not exist**, each named (lead_scoring, weekly_insights, grading_engine, lesson_planner,
  remark_generator, ai/tutor, designer.pdf_generator, emergency.earthquake_api/alert_system/
  gps_processor, payments.esewa/khalti/fonepay → real files are `*_gateway.py`,
  social.meta_ads/facebook/instagram/tiktok, communications.sparrow_sms/whatsapp → real is
  `whatsapp_cloud.py`, website.theme_engine, compliance.emis_export, lms.content_engine).
  Recommends a loader validator. [VERIFIED-IN-REPORT] — validator since landed (19 fixed).
- `benchmarking.py:52-66` loops every active school calling `_overview_payload(school.id)` and
  returns per-school rates — "a cross-tenant data-mining surface" with no caching;
  `benchmarking.py:69` hardcodes a top-20 cap. [VERIFIED-IN-REPORT] — **superseded** (rewritten).
- `ai_suite` module folder is **not a Python package** (no `__init__.py`) while
  `modules/ai_tools/__init__.py` is a stub whose routes live elsewhere (§4.6).
  [VERIFIED-IN-REPORT] — **superseded**.
- Duplicate health concept: `student_health_records` (`models/student.py:225`) vs `health_profiles`
  (`models/health_records.py:17`), plus a `models/health.py` re-export shim. [VERIFIED-IN-REPORT]
- `billing.log_usage()` (`billing.py:237`) + `plugin_usage_logs` have **zero callers**;
  `install_count` is incremented directly. [VERIFIED-IN-REPORT]
- Pricing inconsistencies: `incident_management` (full workflow, growth 199) **cheaper than**
  `incidents` (base CRUD, premium 299); `design_studio` comment says NPR 499 at
  `decorators.py:50` vs manifest 149. [VERIFIED-IN-REPORT]
- `models/report.py` does not exist although `basic_reports` declares
  `models_module: app.models.report`. [VERIFIED-IN-REPORT]
- Legacy flat-manifest dir holds only non-plugin UI manifests **plus `hostel`** — recommends
  folding hostel into `modules/` and retiring the dir. [VERIFIED-IN-REPORT]
- Test coverage gaps: **zero test files for `alumni`**; thin/1-file coverage for elibrary public
  routes, white_label, website_builder, compliance, dismissal. [VERIFIED-IN-REPORT]
- Hardcoded values: `BASE_DOMAIN` default `brighternepal.com` (`app/__init__.py:450`); mastery
  thresholds 80/60 (`modules/ai_adaptive_learning/routes.py:54-55`); trial-days default 14 in DB
  vs config. [VERIFIED-IN-REPORT]
- Per-plugin table counts (the numbers other reports inherit): 7 real module folders totalling
  **4,374 LOC** (biometric 736, incident_management 822, disaster_management 664, multi_branch 638,
  ai_adaptive_learning 649, white_label 216, social_ads 656 — the 7th being social_ads which the
  §2 table also marks deprecated); **41 stub module folders** are docstring-only `__init__.py`.
  [VERIFIED-IN-REPORT] — note 736+822+664+638+649+216+656 = 4,381, a 7-line arithmetic drift.

## A7. `ASCHOOL_WEB_UI_INVENTORY.md` (319 lines)

Route-level inventory of the Next.js frontend: every page file → URL → purpose → persona →
REAL/PARTIAL/STUB/REDIR, the nav source-of-truth analysis (backend-driven sidebar) with both
directions of nav↔route mismatch, the plugin↔UI matrix over 53 manifest folders, a design-system
census, the data layer, public school sites, 20 prioritized UX gaps, and code-health issues.

Load-bearing claims:
- "**~226 page files** (193 under `/dashboard`, 17 public `/school/[slug]`, 4 auth, 4 portal homes,
  3 portal section catch-alls…)"; status split "**REAL 165 · PARTIAL 6 · STUB 19 · REDIR 17 ·
  landing PARTIAL 1**. Public site: 17 REAL." [VERIFIED-IN-REPORT]
- Nav truth: `components/layout/sidebar.tsx` (568 ln) renders **only** `GET /plugins/sidebar`
  built by `PluginLoader.get_frontend_sidebar()` (`backend/app/plugins/loader.py:478`) +
  `CORE_ALWAYS_SLUGS` + `BOTTOM_NAV_ALWAYS_SLUGS`; zero hardcoded frontend nav; `pickLabel()`
  reads `localStorage.preferred_language` **defaulting to "ne"**; "all 155 nav items carry
  Nepali". [VERIFIED-IN-REPORT]
- 404 nav entries (manifest promises no page): `/dashboard/ai-tools/remarks`,
  `/dashboard/analytics/weekly|at-risk|predictions`, `/dashboard/benchmarking/rankings|compare`,
  all `/dashboard/social-hub/**`. [VERIFIED-IN-REPORT]
- Orphan pages (no nav entry): ai-workbench, faqs, staff, incidents + incident-management
  subpages, bulk-uploads/*, certificates/*, communications/* hub, designer/writer|writer2,
  website-builder/domain, timetable/teacher, parents/[id], plugins, profile, analytics/ai-usage,
  ai-tools/letter-writer. [VERIFIED-IN-REPORT]
- Portals: `/student/page.tsx` is a **fully hardcoded mock** ("Class 10A", "12 Day Streak", fake
  timetable), 0 API calls; `student|parent|teacher/[slug]` catch-alls render "Coming soon"
  (`PortalSectionPage`); "**15 of 19 portal section routes are honest stubs**" and separately
  "15/19 … are 'coming soon' cards" in §7. [VERIFIED-IN-REPORT] — collides with D5's 18-of-24,
  see §B-3.
- `settings/roles/page.tsx` is a static fake (hardcoded roles/counts, buttons with no handlers);
  `profile/page.tsx` is read-only. [VERIFIED-IN-REPORT]
- Design system: `components/ui/` has **20 components** (enumerated), "No data-grid, no command
  palette, no drawer/sheet, no date-range picker, no stepper"; `--font-mukta` declared but
  **Mukta never loaded**; dark-mode tokens + zustand theme store exist with **no toggle anywhere**
  → dead code; `super-admin/page.tsx` hardcodes `bg-gray-900`. [VERIFIED-IN-REPORT] — collides
  with the widget audit's 21, see §B-5.
- Data layer: `lib/api.ts` axios + withCredentials + 401 single-flight refresh + 403-plugin toast;
  **544 `any`/`as any` casts across 111 files**; 184 files use react-query; **270
  `invalidateQueries` call-sites**; exactly **1 quasi-optimistic update** (backup page);
  services layer for only 8 domains; socket.io used **only** by the transport map; notifications
  poll every 30 s. [VERIFIED-IN-REPORT]
- Public sites: ISR 300 s + tag revalidation, publish guard, `generateMetadata`, per-school
  sitemap/robots, 10 themes, 20+ section components. Gaps: "robots sitemap URL is wrong: points at
  `/school/sitemap.xml`", sitemap enumerates only 8 static sections; "**no JSON-LD (School
  schema)**". [VERIFIED-IN-REPORT] — the JSON-LD claim is stale, see §B-8.
- Giant files needing extraction: `fees/collect` 1652, `files` 1174, `CanvasEditor` 1171,
  `academics` 1119, `students` 1060, `SectionRenderer` 1019, `useCanvas` 1016, `writer2` 971,
  `exams/results` 912. [VERIFIED-IN-REPORT]
- Only **6 of 53** plugins ship `config_schema.yaml` (attendance, fees, library_management,
  website_builder, whatsapp_bot + ai_tools deprecated). [VERIFIED-IN-REPORT]
- `html lang="ne"` while dashboard copy is English; tsconfig `target ES2017` forces
  `Array.from(map)` workarounds; eslint is bare `next/core-web-vitals` with no a11y plugin;
  **24 `aria-*` attributes in the entire codebase**. [VERIFIED-IN-REPORT]

## A8. `ASCHOOL_WEB_WIDGET_AUDIT.md` (386 lines)

The widget-level companion to A7: what each page is *made of* and what's missing. Inventories the
21 `components/ui/` primitives with per-primitive usage counts, the installed-but-idle dependency
list, a 50-row EXISTS/PARTIAL/MISSING checklist of ERP-essential widgets, per-plugin feature→UI
mapping for the 16 highest-traffic plugin areas with concrete file:line defects and 1-5 ratings
(density/scanability/feedback/keyboard/mobile/empty/i18n), a cross-cutting UX-pattern audit, 25
ranked upgrades, and a 3-tier widget roadmap.

Load-bearing claims:
- **21 primitives** with usage counts: Button 196, Card 179, Badge 127, Spinner/PageLoader 158,
  Input 120, Label 107, Table 85, Dialog 68, Select 61, Textarea 42, BSDateInput 16, Switch 11,
  DropdownMenu 9, Tabs 8, Checkbox 6, Separator 5, Avatar 5, Tooltip 3, Popover 3, Slider 3,
  Progress 3. [VERIFIED-IN-REPORT]
- MISSING outright: DataTable, FilterBar/saved views, ConfirmDialog, EmptyState, Skeleton
  ("0 results for `Skeleton`"), Sheet/Drawer, command palette, DateRangePicker, AD DatePicker,
  TagPicker, PhoneNumberInput, CurrencyInput, PercentageInput, FileDropzone, ImageCropper,
  MarkdownRenderer+KaTeX, CalendarView, Timeline, KanbanBoard, RatingInput, SignaturePad,
  QRCode, PDFViewer, DiffViewer, MediaPlayer, VoiceRecorder, CommentThread, InfiniteScroll/
  VirtualizedList, SortableList, TreeView, Accordion. [VERIFIED-IN-REPORT]
- `window.confirm` in **22 files** (student delete, timetable slot, library catalog, designer,
  plugins uninstall named with lines). [VERIFIED-IN-REPORT]
- `formatCurrency`-style `Rs. ${value.toLocaleString()}` re-implemented in **33 files**;
  `formatNepaliCurrency` used in exactly **1**. [VERIFIED-IN-REPORT]
- **Zero sortable columns anywhere** (all `TableHead` usages checked). Pagination re-implemented
  in ≥14 pages. Five pages hardcode `per_page` 100/200/500 instead of paginating
  (fees/collect 500 at `:316`, attendance 200, exams/marks + results 200, assignments 200).
  [VERIFIED-IN-REPORT]
- `lib/hooks/useExport.ts` (413 ln) is **imported by zero pages** — dead code; CSV export
  hand-built in 8 pages. [VERIFIED-IN-REPORT]
- AI outputs render as `whitespace-pre-wrap` plain text (`ai-tools/lesson-plan:64`); no markdown,
  no KaTeX, no docx/pdf export; report-remarks loops students with sequential `await` (`:61-67`)
  and "will time out for 40 students". [VERIFIED-IN-REPORT]
- `plugins/[slug]/settings/page.tsx` (541 ln) is "the JSONSchemaForm seed" but supports only 4
  field kinds (string/number/boolean/json), no enum/select, no groups, no help text.
  [VERIFIED-IN-REPORT]
- Best-in-class pages named: `fees/collect` (1652 ln POS, "best page in the product"),
  `website-builder/editor` (839 ln, autosave-to-draft with save-state badge at `:696-701`),
  designer `CanvasEditor` (1171 ln), `iemis-import` ("the best import UX in the app").
  [VERIFIED-IN-REPORT]
- Installed-and-idle deps: recharts (3 files), react-hook-form+zod (login/register only),
  date-fns (0 real use), jszip, qrcode (0 use), @radix-ui/react-toast (superseded by sonner),
  jspdf/html2canvas (designer only), pptxgenjs (writer only). Absent from package.json:
  `cmdk`, `vaul`, `react-day-picker`, `dnd-kit`, virtualization, `katex`, `diff`.
  [VERIFIED-IN-REPORT]
- Tier-1 widget list (DataTable, ConfirmDialog, EmptyState, ErrorState, Skeleton+TableSkeleton,
  PageHeader, FilterBar, Pagination, StatusPill, Sheet) with props sketches and effort.
  [UNVERIFIED-ASSERTION] (design proposal — later adopted as roadmap B2)

## A9. `ASHLYA_AI_DEEPDIVE.md` (608 lines)

Deep read of the Ashlya Academy monorepo as a source of AI patterns for ASchool's AI plugin. Finds
**four independent AI stacks** (ATeacher/ARIA, skilldarbar_api, ANotes, data_ingestion), inventories
each one's features with file paths, compares providers/models, quotes ~12 production prompts
verbatim, contrasts RAG/agent/cost/safety designs against ASchool's, walks the ingestion pipeline
stage by stage, reviews the AI UX screen by screen, then ranks 15 "add to ASchool" items by
value÷effort and lists 12 Ashlya anti-patterns to avoid.

Load-bearing claims:
- Maturity verdict per stack: ATeacher "strongest… best pedagogy engineering"; skilldarbar
  "broadest surface, weakest hygiene"; ANotes "cleanest architecture… best provenance/economics
  discipline"; data_ingestion "prototype, but the prompts are production-grade".
  [UNVERIFIED-ASSERTION] (judgement, but each backed by file inventories)
- What ASchool already does better: tenant isolation, quota/cost enforcement, injection scanning,
  pseudonymization, guardian consent, moderation escalation, schema-validated output with repair
  retry, nutrition facts, registry-as-DB-row plugin model. [UNVERIFIED-ASSERTION]
- `ai_gateway.py` is "the most directly transferable file": **10 task classes** (enumerated as a
  Python enum) each with model, token cap, temperature and **p95 latency budget**, plus
  `p95_latency()`/`latency_report()` and a fallback chain. ASchool's `token_hub.py` routes only
  `fast|smart`. [VERIFIED-IN-REPORT]
- Verbatim prompt assets (a)-(l): pedagogical analyzer (`session_analyzer.py::_ANALYZER_SYSTEM`),
  session planner with named research citations and 7 hard constraints
  (`session_planner.py::_PLANNER_SYSTEM`), 5-class response classifier, adaptive-reteach note
  (`groq_service.py::_remediation_note`), 8 per-slide-type directives, the ~200-line whiteboard
  command policy with **explicit cursor arithmetic** (WRITE height 8, gap exactly 2,
  `NEXT_SLIDE` past y=85) and semantic colours, diagram generator+critic (`<thinking>` phase,
  PASS/FAIL gate), the **Nepali/English code-switching rule** (`prompt_composer.py` — "triangle
  NOT tribhuj"), shared safety rails, ANotes tutor contract (HTML-subset output, "never do graded
  work"), Socratic photo-scan methodology, audio-script pacing (150-160 wpm).
  [VERIFIED-IN-REPORT]
- ATeacher uses **no vector DB**: `groq_service._prepare_context_for_chapter` does prompt-time
  section selection (~1200-char sections, always keep first two + last, keyword-overlap score,
  greedy fill, restore document order, annotate omissions), MD5-fingerprint cache with 64-entry
  LRU, budgets 80k chars planning / 110k streaming. [VERIFIED-IN-REPORT]
- Three tool-calling mechanisms ranked: skilldarbar XML-in-prose (fragile `{[^}]+}` regex),
  ANotes native OpenAI tools (MAX_TOOL_ROUNDS=3, forced close, deduped `sources` max 8 persisted
  on the message), ASchool schema-validated single-shot. [VERIFIED-IN-REPORT]
- ANotes credit table quoted with integer costs (chat_turn 1, image_scan 3, mock_test_generation
  10, flashcard_deck 5, quiz_generation 4, summary_generation 2, suggest_answer 2,
  voice_transcribe 2, review_explanation 1), `SELECT … FOR UPDATE` ledger with `balance_after`,
  free-tier auto-grant 15 credits, and the **same table mirrored client-side**
  (`anotes-web/lib/ai.ts::CREDIT_COSTS`) so price shows before the click. [VERIFIED-IN-REPORT]
- skilldarbar bills input tokens at `INPUT_TOKEN_WEIGHT = 0.5`. [VERIFIED-IN-REPORT]
- Model-decommission warning: `skilldarbar_api/shared/utils/ai_ocr.py` documents that Groq
  **decommissioned** llama-4-scout/maverick/kimi/qwen32 by 2026-09 and remaps to
  `qwen/qwen3.8-27b` + `openai/gpt-oss-120b`; `data_ingestion/ocr_pdf.py` still points at dead IDs;
  "ASchool's `token_hub.py` already uses the live catalog." [VERIFIED-IN-REPORT]
- Ranked 15 additions, top 5: (1) TeachingBlueprint analyzer pre-pass **S**, (2) task-class model
  router with latency budgets **M**, (3) per-feature credit costs + ledger + pre-action price **M**,
  (4) prompt-time section selection for long docs **S**, (5) multi-round tool-calling tutor with
  persisted source chips **M**. Then SM-2 (6), guided/direct modes (7), ingestion (8, L),
  whiteboard SDL (9, L), response classifier (10), output sanitisation (11), voice (12),
  DB-editable prompt parts (13), diagram-first formatting (14), lesson-summary artifact (15).
  [UNVERIFIED-ASSERTION] (recommendations)
- Anti-patterns to avoid, with evidence: ~15 repo-root `fix_*.py` churn scripts; **secrets in git**
  (live DB passwords, JWT secrets, Groq keys in `skilldarbar_api.env`, `ateacher_api.env`,
  `.deploy_bash_history`, and a hardcoded Groq key fallback in `data_ingestion/ocr_pdf.py` ~line
  628); three parallel chat stacks; dead prompt constants beside a DB prompt engine; identity from
  request body (IDOR class); unbillable g4f fallback; synchronous long AI work in request handlers;
  in-memory session state (`_session_plans`/`_session_blueprints`/`_active_streams` dicts, SQLite
  knowledge graph, JSON-file "database"); mock-looking shipped surfaces; filename duplication
  (`ocr_pdf copy.py`); latency budgets that only log; **no user feedback capture on AI output
  anywhere**. [VERIFIED-IN-REPORT]

## A10. `COMPETITOR_LANDSCAPE_NEPAL.md` (233 lines)

Nepal market map built from direct site fetches, Play/iTunes API scraping and search sweeps: deep
profiles of Veda and Paathshala, a survey of eZone/Mero School/MiDas/Vidyalaya/Fedena/Entab/
Teachmint and 9 vendors with no findable product, a 30-row feature matrix, 22 gaps ASchool must
close, 20 ranked differentiators, an NPR pricing recommendation, and a per-competitor migration
plan. Explicitly marks unverifiable claims as "not published".

Load-bearing claims:
- Veda: claims **1,300+ schools**, 99% renewal 6 years, 32 cities, live in 10 days, 15+ support
  staff "24h"; founded Mar 2015; directors incl. WorldLink and Khalti co-founders; runs a
  **dealer/reseller program**; **pricing not published** (plans page 404 on 2026-09-04); apps
  "Veda - Students App" Play 50K+/3.9★ and **iTunes 2.9★ / 946 ratings**, "Veda Guru" Play
  100K+/4.1★, iOS 3.4★; **dozens of white-label per-school apps** under `com.ingrails.*`;
  no AI, no IEMIS/BS/Nepali-UI on marketing pages; support hours 8-5 Sun-Fri contradict the "24
  hours" claim. [VERIFIED-IN-REPORT]
- Paathshala: **14+ years, 1,200+ schools**, ISO 27001:2022, IRD verified, "EMIS compliant";
  **100% free software+services+hardware** (free apps, website, GPS, ZKTeco biometric, RFID) with
  revenue from a **paid Smart RFID student ID card** (price not published) — "the inverse of Veda's
  SaaS model"; Play 10K+/**4.4★**, iOS 3.7★; most Nepali-forward marketing.
  [VERIFIED-IN-REPORT]
- **eZone e-School is the only Nepali player with published per-student pricing**: Rs. 0 lifetime /
  **Rs.10 / Rs.20 / Rs.40 per student/month**, with a "50% off for 3 years" banner (so listed
  figures may be post-discount); Standard/Enterprise name eSewa+Khalti and **FonePay/ConnectIPS**.
  [VERIFIED-IN-REPORT]
- Mero School is consumer learning (Rs.999/30 days), **kullabs.com redirects there**; MiDas pivoted
  to online tuition; Fedena publishes $999/$1,399/$1,699 per year; Vidyalaya has "AI-branded modules"
  but is India-only; Teachmint Nepal sells Teachmint X hardware. [VERIFIED-IN-REPORT]
- 22-item gap list (§3) — the source of Phase-E scope: IRD-verified billing, SMS fallback, **custom
  marksheet/report-card print design ("Veda's most-loved moat")**, certificates+ID cards, ZKTeco
  biometric, RFID one-card events, **feature-barring on unpaid fees**, discounts/scholarships,
  voucher-grade accounting, canteen+hostel, reception/visitor/birthday "care" features, CAS/SPA
  analytics, Excel-import everywhere, white-label per-school apps, Zoom/Jitsi, SMS+usage audit
  logs, Nepali UI + BS calendar, trust badges (ISO/IRD/UGC), FonePay/ConnectIPS + bank rec, GPS
  parent-alert polish, admissions CRM, store ratings. [VERIFIED-IN-REPORT]
- 20 ranked differentiators (§4) topped by: AI teaching layer that actually ships; Nepali-speaking
  tutor; offline-first Flutter; Nepali UI + BS everywhere; **one-click IEMIS export**; transparent
  public pricing; white-label builds; 4.6★-grade parent UX; Smart SMS 2.0; open API + marketplace;
  **zero-cost migration kit per competitor**. [UNVERIFIED-ASSERTION] (strategy)
- Pricing recommendation: Free ≤100 students · **Standard Rs.18/student/mo** · Premium Rs.35 ·
  AI add-on Rs.49/student/term (or Rs.150/yr) · white-label build Rs.25,000-75,000 one-time · SMS
  pass-through at cost +10%. Explicit instruction: **do not quote competitors' unpublished prices**.
  [UNVERIFIED-ASSERTION] (recommendation) — collides with the ai_suite NPR 399/mo decision, §B-10.
- Migration plan per source (Veda → students/staff/fee ledgers/results/documents; Paathshala →
  EMIS datasets + ZKTeco re-registration + RFID card ID mapping; eZone → module exports;
  Fedena → DB dump; generic → IEMIS XML/CSV) with tooling musts (DOB+name+guardian-phone dedupe,
  BS↔AD normalization, parallel-run mode, same-day cutover target). [UNVERIFIED-ASSERTION] (plan)

## A11. `PLUGIN_UI_SPEC_ALL.md` (395 lines, 4 of 39 plugins — INCOMPLETE)

Intended as the definitive per-plugin UI spec (web + mobile + public site) under the owner mandate
"every published plugin gets dedicated, fully-working screens — nothing 'coming soon'". Delivers a
reusable convention block (screen archetypes L/D/C/E/W/G/B/Q/R/S, a **7-part screen contract**,
`widgets.yaml` record grammar, mobile app codes, endpoint marks ✔/⚠/✖, P0-P3 priority) and then
four exhaustive specs: `academics`, `attendance`, `exams`, `fees`. Each spec lists every backend
route with its gate, every current web screen with **file:line defects**, a target screen set,
`widgets.yaml` records, mobile now→target, public-site sections, a `config_schema.yaml` field list,
and a numbered build order. It is the most defect-dense document in the corpus.

Load-bearing claims (only the four delivered plugins):
- Conventions that later work must honour: the 7-part screen contract (PageHeader → URL-synced
  FilterBar → DataTable → Sheet with `←/→` row walking → sticky dirty bar with `⌘S` → Skeleton/
  EmptyState/ErrorState/LockedState → ConfirmDialog + 5 s undo + `formatNPR()`/`fullName()`/
  `BSDateInput`/`PrintFrame`/`useExport`); widget types and slot catalogue (`dashboard.main|.side|
  .wide|.actions`, `plugin_page.*`, `*_profile.tab`, `settings.section`, `drawer`, `dialog`,
  `mobile.*`, `website.section`, `pdf.block`); `renderer: spec` unless a `component:` token is named.
  [VERIFIED-IN-REPORT] (self-consistent contract; depends on the widget contract in D2)
- **academics**: 37 routes, of which **16 orphan CRUD routes** (semesters/mediums/streams/shifts,
  4 each) have zero UI; `POST /academics/classes/<id>/subjects` is a read-modify-write on an array
  column → lost update; teacher assignment writes `subject.teacher_ids[0]` **globally**, so
  assigning in Class 9 changes Class 10 (`class-subjects/page.tsx` + backend
  `_apply_subject_payload`); `class-teachers/page.tsx:143-145` is a literal placeholder card;
  `academics/page.tsx` has **two confirm idioms in one file** (`:635` raw `confirm()` vs radix
  `RowActions` at `:160`); no pagination though all three endpoints `paginate()`; per-(class,subject)
  teacher model does not exist → a correct assignment matrix is **impossible** without a new
  endpoint. Also: `/teacher/my-students?class_id=` **silently drops** `class_id`
  (`teacher.py:83-95`) and `class_section_screen.dart:435` reads `attendance_percent` while the
  serializer emits `attendance_pct` (`teacher.py:244`) → badge never renders. [VERIFIED-IN-REPORT]
- **attendance**: 13 routes; `GET /attendance/me` **does not exist** (grep) yet
  `flutter_teacher/.../my_attendance_screen.dart:30` calls it → screen permanently errors; web
  `attendance/page.tsx:160-169` **defaults every unmarked student to `present` and sets
  hasChanges=true** (reload+Save marks a class present with no intent) — same bug in
  `attendance_screen.dart:24`; `:94` seeds the date with `new Date().toISOString()` (UTC) so after
  18:15 NPT the default date is **tomorrow**; `half_day` is accepted by the API and absent from the
  UI union (`:41`) and from the Flutter enum (`:549`); Flutter posts no `date` so **back-dating is
  impossible**; the reports page calls `/reports/attendance/summary` and is therefore gated by
  **`basic_reports`, not `attendance`** (`reports.py:262`) → 403 with no LockedState; the holidays
  page is gated `PluginGate slug="notices"` and hits `/notices/events` — **owned by the wrong
  plugin**; `BSDateInput` at `holidays/page.tsx:183` has **no `onChange`** so the edit dialog cannot
  change a date; the 4 `leave-requests` routes (incl. the only code path that stamps
  `TeacherAttendance` for a range, `:614-637`) have **no UI anywhere**, while
  `flutter_teacher/leave_screen.dart:176` posts to `/hr/leave` instead — staff leave lives in two
  subsystems. [VERIFIED-IN-REPORT]
- **exams**: 21 routes; the plugin **emits `marks.submitted`/`results.published`** (`:834`, `:1405`)
  while the manifest declares `exams.marks_entered`/`exams.result_published` — **manifest/code event
  drift, so manifest-wired listeners never fire**; `GET /exams/online/<id>` **includes
  `correct_answer`** → a student token can read the answer key; no attempt-list/review endpoint at
  all; `report-cards/page.tsx:81-88` reads `data.data.download_url` that the endpoint **never
  returns** (returns `{message, exam_id}`) → dead success path and a toast that lies ("generated"
  when a Celery task was merely queued), with no task-status endpoint to poll; `marks/page.tsx:63-72`
  `nebGrade()` duplicates the backend scale — **the NEB scale exists in 3-4 divergent copies**
  (`nepal_grading.GRADE_TABLE`, `exams/page.tsx:567-583`, `marks/page.tsx:63`, `grades/page.tsx`);
  `marks/page.tsx:167` **drops rows with 0 marks** from the payload so a genuine zero cannot be
  saved; no `is_absent` toggle though the API accepts it; exams hub has **no `PluginGate`** (`:82`);
  BS dates are free-text `Input` (`:726-739`); `schedule/page.tsx:97` is **N+1** (one query per exam
  card); no per-subject exam date/time/room model exists. [VERIFIED-IN-REPORT]
- **fees**: 27 routes, largest API (2882 ln); manifest declares `fees.collected|overdue|
  reminder_sent` while the code emits **`fee.paid`** (`fees.py:1483`) — second manifest/code event
  drift; `POST /fees/collections/<id>/pay` is "the most carefully written endpoint in the codebase"
  (idempotency key with cross-tenant namespacing `:1394-1402`, NPT back-dating, IRD receipt series
  under `SELECT … FOR UPDATE`); **three orphan endpoints have no admin UI at all** —
  `PUT /fees/payment-methods`, `POST /fees/payment-methods/upload-qr`,
  `POST /fees/collections/<id>/refund` → **online payment cannot be configured from the product**;
  `GET /fees/summary` loads every FeeCollection into Python (`:396`) and loops classes×collections
  (`:499`), `/fees/defaulters` likewise; `fees/collect/page.tsx:307` fetches `per_page:"500"` then
  groups client-side (`:319-340`) with no virtualization → a 2000-bill school silently truncates;
  search is un-debounced **inside the query key** → a request per keystroke; **zero keyboard
  shortcuts** on the cashier's screen; partial payments are parsed out of a
  `[partial_paid:…]` marker inside `notes` server-side; `fees/page.tsx:53` and the structure page
  create-then-bill flow has **no dry-run, no confirm, no undo** on a money-generating action;
  `/fees/initiate-payment` refuses more than one fee id (`fees.py:1778`) while the parent app lets
  you select many; `fees.py:2424-2434` stacks discounts additively capped at base with no UI saying
  so; VAT percent lives in `school.fee_config.vat_percent` with **no UI**; receipt prefix is derived
  from `school.slug` (`fees.py:2711`) and not configurable. [VERIFIED-IN-REPORT]
- Scope claim "39 published plugins … skipping ai_adaptive_learning (`published: false` +
  `deprecated: true`) and the 11 other deprecated slugs" + 8 platform-core manifests in Appendix P.
  [UNVERIFIED-ASSERTION] — Appendix P and 35 specs do not exist; the 39 count also disagrees with
  every other plugin count in the corpus (§B-7).

## A12. `SAHAYATRI_SPEC_INVENTORY.md` (341 lines)

Durable inventory of the standalone Sahayatri product (Ashlya's Nepal AI education platform, v5.1
May 2026) built **from its planning documents only** — master spec, AUDIT.md, finalprompt.md,
implementation_plan.md, PROGRESS.md, README — to decide what ports into ASchool. Covers product
identity and the five problems it claims to solve, architecture, a complete feature inventory
(content pipeline, whiteboard, 3D, quiz, learning science, 61 teacher + 60 student AI tools,
generative file tools, dashboards), AI details (models, prompt architecture, the no-vector-DB
"RAG-lite", agents, guardrails, cost control, voice, vision), the 30+-table data model,
integrations, UX patterns worth stealing, Nepal-specific design, known gaps/bugs, and a
three-tier PORT list.

Load-bearing claims:
- Product framing: "120+ AI tools (60+ teacher, 60+ student)", 7-stage CDC textbook vision
  ingestion, offline IFP whiteboard, 3D, adaptive learning, full Devanagari, NEB/SEE/HSEB
  alignment. [UNVERIFIED-ASSERTION] (from vendor's own spec)
- **The Preeti-encoding insight**: CDC textbook PDFs use legacy Devanagari font encoding, so text
  extraction yields garbage (`"फलन (Function)"` → `"P]lR5s ul0ft"`); the fix is rasterize →
  Groq Vision → clean Markdown, which "sidesteps the font-encoding garbage entirely".
  [VERIFIED-IN-REPORT] (quoted from spec; the single most reusable technical insight)
- **The anti-MCQ insight**: a single अभ्यास section mixes MCQ/short/long/proof/construction/
  numerical/fill-blank/match/comprehension — **19 Nepal exercise types with Nepali trigger verbs**
  — so forcing an MCQ schema destroys data; store exercises as Markdown blocks.
  "Core differentiating insight." [VERIFIED-IN-REPORT]
- Only ~30% of Nepali schools have reliable internet while IFP adoption rises → the whiteboard must
  work fully offline with no login/socket. [UNVERIFIED-ASSERTION] (vendor claim)
- Token economy: Free 0 (500 tokens) · Student Plus NPR 199 (5,000) · Teacher Pro 299 (8,000) ·
  Institution Basic 2,999 (50k, ≤100 students) · Standard 5,999 (120k, ≤300) · Premium 9,999
  (300k, unlimited); per-tool costs listed in Appendix A (voice tutor 15-40, question paper
  150-300, video 200, TTS 5; ingestion ~21k tokens per 298-page textbook, 30-40 min end-to-end);
  **no payment gateway implemented** — subscriptions activate without payment verification.
  [VERIFIED-IN-REPORT]
- Confidence thresholds: ≥0.90 chapter / ≥0.85 exercise auto-approve, <0.30 reject; Jaccard
  duplicate detection at **0.72**; Bloom auto-tagger from Nepali+English keyword verbs.
  [VERIFIED-IN-REPORT]
- SM-2 spaced repetition (ease floor 1.3, 1→6→interval×EF, quality 0-5, statuses learning/review/
  graduated), adaptive path (weak = avg ease <2.1), gamification (XP per event 5/10/10/15/20/25/30,
  **11 levels 0-4000 XP, 6 badges**, streaks, institution leaderboard). [VERIFIED-IN-REPORT]
- "Embeddings / vector DB: **None** — deliberately absent"; RAG = structured `chapter_ai_context` +
  token-overlap ranking + raw markdown excerpts (6,000 chars for voice tutor).
  [VERIFIED-IN-REPORT]
- Scorecard from AUDIT.md: Backend ~78%, Web ~94%, Mobile ~65%, Whiteboard ~82%, Infra ~85-88% →
  **total ~81%**. [VERIFIED-IN-REPORT] (quoted)
- Known gaps: no Nepal payment gateway, iOS pending, whiteboard TTS/offline-AI-cache/PPT/circle-search
  stubs at audit time, no IEMIS integration, no push notifications, no service worker, **no BS↔AD
  conversion utility**, 7 empty marshmallow schema files, ~25% test coverage.
  [VERIFIED-IN-REPORT]
- Named bugs: live quiz trusted client `is_correct` (fixed); room state in-memory (fixed to Redis
  12 h TTL); **voice tutor chat un-token-gated (revenue leak)**; community posts Redis-only;
  hardcoded `http://10.0.2.2:5000`; default `SECRET_KEY="sahayatri-dev-secret"`, CORS `*`;
  Flutter-web PNG export broken; `Subject.name` vs `.title` crash. [VERIFIED-IN-REPORT]
- Tier-1 PORT list (8 items): ingestion pipeline + import hub, Chapter AI Context KB, exercise
  blocks as Markdown, token gating + usage ledger, SMS integration API + institution API keys,
  question paper generator + WeasyPrint, SM-2 + adaptive path, gamification.
  **Do NOT port**: Sahayatri auth, subscription CRUD, Groq-specific wrapper, hardcoded emulator
  URLs, **Redis-only persistence ("the single biggest Sahayatri architectural mistake")**, the
  shared `run_text_tool()` catch-all. [UNVERIFIED-ASSERTION] (recommendations, later adopted)

## A13. `SAHAYATRI_BACKEND_CODE.md` (306 lines)

The as-implemented counterpart to A12: reads Sahayatri's actual backend. Maps the stack with
file:line anchors, groups ~323 route decorators by blueprint, tables all 36 models, dissects the
services (LLM client, prompts, "RAG", orchestration, validation, fallback, metering, STT/TTS/vision,
the ingestion pipeline), covers jobs/realtime/storage, reviews the 794-line test suite, splits
production-grade from stub/broken, lists 12 patterns better than typical Flask CRUD, and maps every
capability to an ASchool destination.

Load-bearing claims:
- One-line verdict: "single-tenant Flask 3 monolith with **~323 REST endpoints, 36 SQLAlchemy 2
  tables** (38 tables), a Groq-only LLM layer, no vector RAG, a solid 7-stage vision ingestion
  pipeline, Redis-backed realtime, and a good token-metering design — but with a broken
  `GroqService.chat()` signature that breaks every JSON-mode tool call."
  [VERIFIED-IN-REPORT] — note this contradicts A12's "323 routes / 38 tables" framing only in
  wording; see §B-11 for the 30+ vs 36 vs 38 table drift.
- **CRITICAL BUG, quoted with call sites**: `chat()` is `(messages, *, model, max_tokens,
  temperature)` and does **not** accept `system=` or `response_format=`, yet 8+ call sites pass
  them (`generic_tool.py:866-873`, `tools/base_service.py:34-40`,
  `tools/quiz_generator/service.py:54-60`, `video_tasks.py:57-63`) → "All JSON-mode tool calls will
  raise `TypeError` at runtime (this path is evidently untested)." [VERIFIED-IN-REPORT]
- **Security**: `.env.example` contains a real-looking Groq API key committed to the repo
  (`backend/.env.example:17`) and compose mounts `.env.example` as the live `env_file`
  (`compose.yaml:6-7`) — "Do not copy this pattern." [VERIFIED-IN-REPORT]
- Token gate mechanics worth copying: `@require_tokens(slug, default_cost=50)` → 402 with
  `{tokens_remaining, tokens_needed}` → `finalize_deduction()` after success writes the wallet
  decrement + `TokenUsageLog` in one commit (`token_gate.py:41-83`, `:86-120`); **but check-then-
  deduct is not row-locked** (SELECT then UPDATE without `with_for_update`) so concurrent spend can
  race. [VERIFIED-IN-REPORT]
- `ContextGeneratorService` is **not LLM-based** — heuristic markdown mining (regex for `$…$`,
  headings, bold terms) with `generated_by_model="heuristic-markdown-v1"`, i.e. "regex heuristics
  posing as AI generation". [VERIFIED-IN-REPORT]
- PDF chat fetches an arbitrary client-supplied `document_url` server-side → **SSRF**
  (`app/api/ai/pdf_chat.py`); port must allow-list. [VERIFIED-IN-REPORT]
- Ingestion pipeline detail (the strongest subsystem): 7 Celery stages with `max_retries=3` and
  `countdown=60*retry_count`, pypdfium2 @150 DPI → JPEG q85 → S3 `imports/textbooks/{job}/pages/
  page-NNN.jpg`, per-page vision classification committing every 10 pages, TOC → DraftChapters,
  chapter markdown with `![FIGURE_N](PLACEHOLDER)` resolved by naive vertical-band cropping + per-
  figure alt-text vision call, exercise-block extraction, `awaiting_review`, then publish with
  back-reference idempotency (`published_topic_id`/`published_exercise_id`) and Jaccard ≥0.72
  dedupe (`duplicate_detection_service.py:14`). [VERIFIED-IN-REPORT]
- Realtime: `whiteboard_socket.py` room `wb:<code>` with **Redis-persisted state (12 h TTL)** and
  `board_state_request` full-snapshot sync for late joiners; `live_quiz_socket.py` room `lq:<code>`
  with **authoritative server-side scoring** ignoring client `is_correct` (`:96-116`);
  `live_class_socket.py` is in-memory-dict only. [VERIFIED-IN-REPORT]
- Tests: 794 lines / 7 files; conftest **patches `redis.Redis` and `celery.Celery` globally with
  MagicMocks** so none of the blacklist/quiz-state logic is really tested; `test_ai.py` mocks
  `GroqService.generate` and routes that **no longer exist** → passes only via loose
  `status_code in (200,402)` assertions. No tests for sockets, ingestion, video, context generator,
  vision, research agent, paper-upload publish, SMS API keys, subscription purchase.
  [VERIFIED-IN-REPORT]
- Stubs named: parent portal, `sms/v1` attendance/fees/results (empty lists), `tokens/purchase`
  (no gateway), study-material upload (no file handling); `question_paper_service._fetch_blocks`
  orders by a **nonexistent** `ExerciseBlock.block_number` column; emotion detection exists in
  **3 implementations**. [VERIFIED-IN-REPORT]
- Capability→ASchool destination table (24 rows) naming the exact ASchool files to extend
  (`services/ai/token_hub.py`, `workbench.py`, `rag.py`, `tool_handlers.py`, `tool_schemas.py`,
  `adaptive_learning.py`, `question_paper_v2.py`, plugins `ai_suite`/`ai_tutor`/`exams`/
  `gamification`/`wellbeing`/`sms_notifications`/`elibrary`/`lms`). [UNVERIFIED-ASSERTION] (plan)

## A14. `SAHAYATRI_CLIENTS_UX.md` (461 lines)

Read-only review of all three Sahayatri clients — 191 web pages, 44 components, 37 mobile Dart
files, 45 whiteboard Dart files — to know what UI must be rebuilt in ASchool. Covers the web
stack/design system/shell/auth/route inventory, **the AI tool template system** (the headline
asset), realtime/uploads/offline, an i18n reality check, a11y, then the mobile app screen by screen,
then the whiteboard app feature by feature with its realtime protocol, then 12 ranked UX patterns
worth stealing, a maturity split, the 13 surfaces ASchool does not have, and a port checklist.

Load-bearing claims:
- **The template factory**: all 121 tool pages are ~11 lines — import a template, pass props — and
  are **machine-generated** by `web/scripts/gen-ai-pages.mjs` holding `STUDENT_TOOLS`/`TEACHER_TOOLS`
  arrays; the catalog *listing* is separately server-driven from `GET /ai/tools/?role=` returning
  `{slug, name, description, icon, category, frontend_path, badge, is_premium, ui_type}` so grid and
  routes stay in sync by convention. **10 student templates + ~10 teacher workspaces cover 121
  tools.** Each template is named with its line count and the tools that use it.
  [VERIFIED-IN-REPORT]
- Result-shape parsing with graceful degradation is a first-class pattern: `AiSolverPage` promotes
  `Step N` lines to numbered badges and `Answer/∴/Therefore` to a boxed answer;
  `TeacherPresentationWorkspace` splits on `Slide N:`; `TeacherAnalyticsWorkspace`
  **regex-extracts** Average/Median/Highest/Lowest/Pass-rate/Std-dev out of prose into a metrics
  strip; `AiFlashcardsPage` falls back to a `Q:/A:/Hint:` parser; whiteboard renders `Math.tex` with
  `onErrorFallback`. [VERIFIED-IN-REPORT]
- Shared result primitives to copy verbatim: `TopicSelector`, `ResultText` with floating Copy,
  `ContextBadge` ("✓ Based on your chapter context"), `FollowUpChips`, `ErrorBanner`, Ctrl+Enter
  submit; plus "form left, result right" splitting only once a result exists
  (`gridTemplateColumns: displayResult ? "1fr 1fr" : "1fr"`). [VERIFIED-IN-REPORT]
- **Scope-selection asymmetry to fix on port**: student tools scope subject→topic from the logged-in
  student, but teacher tools scope institution→teacher→subject→topic **starting from
  `GET /admin/institutions/`** — "teacher tools are wired as an admin-impersonation demo". The
  mobile `AiScopeSelectorCard` (321 ln) repeats it (institution→student→topic).
  [VERIFIED-IN-REPORT]
- i18n reality: `next-intl` with fully parallel en/ne catalogs (166 lines each, ICU interpolation,
  complete Errors/Toast sets) and `hi.json` at 17 lines — but **`useTranslations` is called in
  exactly one component (`LocaleSwitcher`)**; every page hardcodes English while `error.tsx`/
  `loading.tsx`/`not-found.tsx` are hardcoded **Nepali**. "Bilingual on paper." [VERIFIED-IN-REPORT]
- Mobile: 37 files / 6,234 lines, Android-only, **raw `dart:io` HttpClient with a hand-assembled
  multipart body** (no http/dio), flat `MaterialApp.routes` (no go_router, no bottom nav), only
  `AuthProvider` is real, amber M3 seed contradicted by inline indigo/violet, `usesCleartextTraffic="true"`,
  **no push at all**. `quiz_screen.dart` (1004 lines) has **every class declared twice** → "will not
  compile"; `dashboard_screen.dart` is 100% hardcoded mock; `ai_tools_screen.dart` has 9 of 18 tiles
  as `_comingSoon()` SnackBars; `nepali_text_renderer.dart` is an 11-line no-op.
  [VERIFIED-IN-REPORT]
- Whiteboard: 45 files / 3,653 lines, separate deployable (multi-stage Dockerfile → nginx :8090),
  `perfect_freehand` canvas, 50-step undo, multi-page, **local persistence to SharedPreferences
  (`wb_board_v1`) restored on first frame with no account**, PNG export, AI drawer, Circle-to-Search,
  AI PPT panel, Sketchfab bridge with `highlightNode`, TTS, two-tier offline AI cache (memory L1 +
  persisted L2, 24 h TTL). **Honest gap: `BoardProvider` never calls `SocketService`** — "strokes are
  never emitted or applied, so today the 'live session' shares presence and a code — not ink";
  `SyncStatusIndicator` is a 13-line hardcoded "Offline" chip; `CircleSearchOverlay`, `AiPptPanel`,
  `TtsService`, `OfflineAiCache`, `ModelAiOverlay`, `SketchfabBridgeService` are implemented but
  **mounted by no screen**; API base URL hardcoded in **6 files** with no `String.fromEnvironment`.
  [VERIFIED-IN-REPORT]
- Web mobile nav gap: `.sidebar.open` CSS exists but **no hamburger button anywhere sets it** → the
  mobile sidebar is unreachable. `web/app/{error,loading,not-found}.tsx` + `error-boundary.tsx` use
  **Tailwind class names in a project with no Tailwind** → render unstyled. 19 legacy
  `student|teacher/tools/*` pages are orphaned prototypes. `chapters/[topicId]` hard-errors without
  `?studentId=`. `teacher/dashboard` identifies "the teacher" as `admin/users/?role=teacher` item[0].
  [VERIFIED-IN-REPORT]
- Maturity split: "**~70% of the web app is production-shaped**, ~10% partial, ~20% dead/legacy.
  **Mobile is ~60% real** with one non-compiling file and a mock dashboard. **Whiteboard is ~50%
  wired**." [UNVERIFIED-ASSERTION] (judgement)
- 13 surfaces ASchool does not have (§6) — the net-new list: AI tool catalog + template factory,
  chapter-grounded answers with provenance badge, voice tutor loop, doubt solver, 3D simulation
  library, collaborative live whiteboard, content-ingestion supply chain UI, SM-2 + adaptive path,
  gamification hub, AI token metering UX, live quiz game, teacher community feed, Nepali
  localization infrastructure. [VERIFIED-IN-REPORT] (as a cross-reference exercise)
- Anti-patterns not to copy: `useEffect`+`useState` per fetch, 1,100 lines of hand-written global
  CSS, admin-impersonation scope selectors, `DEMO_STUDENT_ID`, visible demo credentials in the login
  UI, hardcoded Nepali outside i18n, panels built but never mounted. [VERIFIED-IN-REPORT]

## A15. `UNIFIED_ROADMAP_2026-09.md` (247 lines) — **PLAN OF RECORD (v3 FINAL)**

The reconciled plan after the full re-audit, superseding v2 (2026-09-04) and basing itself on the
13 source reports + 5 digests + "a ground-truth verification pass of the working tree (commit
`1b6d295`)". Contains: the evidence base table, what is DONE and verified, an explicit **staleness
ledger correcting the 2026-09-04 corpus**, 8 locked decisions, a build-progress ledger with commit
SHAs, then phases B (W0-close + design system + portals), C (AI Teacher plugin P1-P5), D (Sahayatri
in as `nepal_curriculum` + ai_suite surface, D-1…D-5), E (Nepal competitive modules, 16 ranked),
F (mobile + market), a sequencing diagram, and anti-goals.

Load-bearing claims:
- **W0 is landed** (commit `1b6d295` + working tree): social_ads + social_hub deleted end-to-end
  incl. `models/social.py`, tests, tasks and migration `e8b1c4d6a9f2`; 7 deprecated AI manifests
  deleted; `ai_suite` has `__init__.py` + `config_schema.yaml`; `attendance.student_absent` listener
  wired at `listeners.py:69`; leave write-through + `rejection_reason` (migration `d5c8f2a7b4e1`);
  `grant_plan_plugins` skips coming_soon/deprecated (`entitlements.py:63-90`); benchmarking
  `/rankings` set-based + 10-min cache + anonymous; loader pointer validator + new
  `backend/app/plugins/validator.py` (**0 errors, 1 warning over 48 manifests**); curriculum read API
  at `academics.py:983+`; Sparrow on HTTPS; WeasyPrint + python-docx in requirements;
  `scripts/migrate.py`. [VERIFIED-IN-REPORT] (verification pass claimed against the tree)
- **The alias split-brain finding is declared STALE**: "`decorators.py:36-42` is **bidirectional in
  effect** (verified by running `_acceptable_plugin_slugs`: an `ai_suite` install passes
  `ai_tools`/`ai_adaptive_learning`/`benchmarking` gates AND a legacy install passes `ai_suite`
  gates) — v2's 'split-brain 403' finding was stale; the remaining legacy gates are cosmetic."
  [VERIFIED-IN-REPORT] (runtime evidence claimed) — directly contradicts A6 P0-1, see §B-2.
- Test-environment state: "project Postgres/Redis on **5435/6383**; `aschool_test` recreated clean
  (vector/pg_trgm/uuid-ossp); suite = **561 collected**. (Baseline run was invalid: **343 errors from
  a stale-schema DB + 5 real failures** — rerun on the fresh DB is the first CI gate of Phase B.)"
  [VERIFIED-IN-REPORT] — **so no valid full-suite result exists as of 2026-09-05**; this collides
  with the 507-tests and 192-passed claims elsewhere (§B-12).
- Still open from W0 (carried into B1): canonicalize the **23 legacy AI gates** (16 `ai_tools` +
  7 `ai_adaptive_learning`); delete `ai_adaptive_learning/manifest.yaml` after row migration;
  `/plugins/catalog` endpoint + delete the frontend alias mirror (`frontend/lib/plugins.tsx:55`);
  delete 10 dead `services/ai/*`; `student_health_records`→`health_profiles` merge; guardian
  edit/delete; `log_usage`/`plugin_usage_logs`; `basic_reports` manifest fix. [VERIFIED-IN-REPORT]
- **Staleness ledger §2** (corrections to the 2026-09-04 corpus): `TC §3.14`'s "10 registry rows" is
  a runtime-seeded `TOOLS` list, not 4 rows; "13 unmounted services" is now **11** (`curriculum_seed`
  and `rag` ARE mounted); **no `ai_teacher`/`teaching_content` models exist** (greenfield confirmed);
  `teaching_media.file_id` must reference **`managed_files.id`** (there is no `files` table);
  `AIToolRegistry` has **14 columns** (5-6 new catalog columns need a migration); **`min_plan_tier`
  is a literal `ai_suite` membership check, not tier comparison** → AI Teacher must NOT alias to
  `ai_suite` and must assert guardian consent explicitly (the orchestrator only does it for category
  tutor/student); `app/realtime.py` is **159 lines with only school rooms** — lesson rooms are new
  code; **`design_studio.py` hosts 7 `/ai/*` routes duplicating `ai_tools.py`**; `exportPPTX` bug
  confirmed at `useExport.ts:314`. [VERIFIED-IN-REPORT]
- 8 locked decisions: (1) AI Teacher = **separate premium plugin `ai_teacher`**, separate service
  topology, NOT aliased into ai_suite; (2) **no AI whiteboard**; (3) **no OCR/vision ingestion** —
  all teaching content admin-entered; (4) Sahayatri lands as **one new starter plugin
  `nepal_curriculum` (NPR 199)** + extensions to ai_suite/ai_adaptive_learning/gamification/exams/
  elibrary/wellbeing, with **only 4 genuinely new tables** beyond D1's 12 (`spaced_rep_cards`,
  `student_xp_state`, `live_quiz_sessions`, `exercise_section_links`); (5) plugin/theme/widget/config
  **v2 with a `schema_version: 2` ratchet** and a **public-site parity lock** (byte-equal theme CSS +
  3-school Playwright visual diff at threshold 0) **before any theme code changes**; (6) Edge-TTS
  default voice, Whisper STT, **every AI call incl. TTS/STT metered**, 402 semantics; (7) publish
  only OUR pricing, never competitors'; (8) flutter_user is THE consumer app.
  [VERIFIED-IN-REPORT] (decision record)
- Build-progress ledger with SHAs: **B1 W0-close `461dde5` done**; **B3 portals `461dde5` done**
  ("mock /student killed, 18 coming-soon routes → real pages, catch-alls 404"); C-P1 teaching-content
  spine `c4b09af` done (12 tables, 12 tests); C-P2 `c4b09af` backend done, **runtime service +
  player remaining**; C-P3 `e291f4b` v1 done, **in-app player remaining**; D-1 `e291f4b` done;
  D-2 `9de7cfe` done (11 catalog columns + 13 new tools) with **100+ tools remaining**; D-4
  `9de7cfe` markdown+KaTeX on 4 pages done, **emitters remaining**; plus a fixed defect: platform
  RAG seed failed every boot (`document_chunks.school_id` NOT NULL vs platform NULL). E and F not
  started. [VERIFIED-IN-REPORT] — **this makes several 2026-09-04 findings obsolete**, see §D.
- Phase-E ordering (16 items) and the anti-goals list ("No whiteboard. No OCR ingestion. No AI
  outside the workbench guardrails… Never publish claimed competitor pricing. The live public site's
  rendered design does not change"). [VERIFIED-IN-REPORT]

## A16. `_digest/D4_COMPETITOR_REFRESH.md` (95 lines)

A verification delta, not a new survey: live WebFetch of Veda and Paathshala on 2026-09-05 plus a
re-read of `COMPETITOR_LANDSCAPE_NEPAL.md`, recording only what changed, what was re-confirmed on
ASchool's own side, and the net position statement.

Load-bearing claims:
- Veda unchanged: no AI anywhere, pricing still gated ("Explore Plans" page still gated), no
  Nepali-UI claim, no offline, no API; IRD/UGC/ISO badges are the trust story; product suite
  unchanged. [VERIFIED-IN-REPORT] (live fetch)
- **New finding**: the Veda homepage simultaneously claims "**Over 1300 schools**" (hero) and
  "**Trusted by more than 900 schools and colleges**" (trust section) — a newly confirmed internal
  contradiction; plus "15+ members, available 24 hours" vs footer "( 8 A.M - 5 P.M ) ( SUN - FRI )".
  Implication: "never mirror their claimed numbers." [VERIFIED-IN-REPORT]
- App-store ratings from 2026-09-04 were **not re-scraped**; "treat as unchanged until the next
  refresh." [VERIFIED-IN-REPORT] (explicit staleness disclosure)
- Paathshala `/features` fetched cleanly and confirms the module list, incl. fingerprint + card
  attendance and gateways named "**IME Pay, Khalti, Esewa**" (FonePay/ConnectIPS still absent — eZone
  remains the only player naming bank rails), "Free Mobile App + Free Website" both asterisked
  "On purchase of full module" (**the "free" model is bundle-conditional**), ISO certified, "more
  than 11 years of experience", visitor counter 178,549. The 2026-09-04 "1,200+ schools" and
  RFID-monetization findings "stand (from the JS bundle; **not re-extracted today**)".
  [VERIFIED-IN-REPORT] — note **11 years here vs 14+ years in A10**, see §B-13.
- Own-side deltas re-verified against the working tree: benchmarking `/rankings` rewritten
  (`backend/app/api/v1/benchmarking.py`); absent-alert listener consumed
  (`backend/app/plugins/listeners.py:69`); leave write-through + rejection reason
  (`backend/app/api/v1/attendance.py`, migration `d5c8f2a7b4e1`); social plugins deleted + AI catalog
  consolidated + plugin-contract validator (`backend/app/plugins/validator.py` — **0 errors over 48
  manifests**); curriculum/NEB read API (`backend/app/api/v1/academics.py:983+`).
  [VERIFIED-IN-REPORT]
- Still-missing vs competitors, re-confirmed: IRD-verified billing polish, transcripts, per-school
  grading scales, payroll TDS/SSF, non-Khalti refunds, **marksheet print designer (Veda's moat)**,
  ZKTeco/RFID, feature-barring on arrears, canteen/hostel POS, Excel-import everywhere, admissions
  CRM kanban, white-label app pipeline, FonePay/ConnectIPS. [VERIFIED-IN-REPORT]
- Cites "the D1 digest's **153-tool catalog** and document/deck emitter contract" as the answer to
  the international AI-for-teachers north star. [VERIFIED-IN-REPORT] (cross-reference; see §B-4)

## A17. `_digest/D5_DAY_IN_THE_LIFE_REVIEW.md` (124 lines)

Four click-by-click persona traces (teacher, student, parent, admin) through the actual frontend
routes and the `/api/v1/*` endpoints each page calls, with a BLOCKER/FRICTION/MOCK/OK verdict per
step, then 7 cross-cutting findings and the fix order that produced roadmap phase B3. Method states
web findings are verified against running code and mobile findings come from code greps, not device
testing.

Load-bearing claims:
- Teacher: survivable day; the two marquee flows (AI lesson-plan output formatting, marks keyboard
  entry) are the slowest; **AI Teacher absent by design pending W3**; approving a student leave is a
  **BLOCKER — "`/attendance/leave-requests` endpoints exist; zero UI anywhere (grep verified)"**;
  absent→parent alert now fires but "no UI feedback on the marking page that alert was sent".
  [VERIFIED-IN-REPORT]
- Student: **`/student` is MOCK** — hardcoded "Hey, Student! 🎓", "Class 10A • Roll No. 15", fake
  streak "12 Day", fake XP, fake timetable with "Mr. Sharma", **zero API calls (grep: 0 hits)** —
  "Any real student sees a stranger's life"; results/timetable/library/LMS/AI-tutor all render
  coming-soon cards while `student_app.py` endpoints exist (**library at `student_app.py:417,455`,
  LMS at `:494`**); results card at `portal-route-meta.ts:59-63`; web submit is not wired (app-only)
  and the Flutter submit is paste-a-URL. [VERIFIED-IN-REPORT]
- Parent: dashboard works, then coming-soon for every daily task while **19 real endpoints sit
  unconsumed**, each cited: `/parent/child-attendance` (`parent_app.py:218`), `/parent/child-results`
  (`:340`), `/parent/bus-info` + `/bus-location/<id>` (`:567,645`), chat-threads (`:701-764`),
  conferences (`:809,867`), `/parent/child-health` (`:932`); **web payment = impossible**
  (`/outstanding-fees` is read-only). Fix pattern already exists: teacher/marks and
  teacher/assignments are **one-line re-exports** of dashboard pages. [VERIFIED-IN-REPORT]
- Admin: "genuinely strong — the completeness audit's '~92% backend' holds in practice"; daily pains
  are timetable quality (greedy stub, `conflicts: []` re-confirmed), notice targeting, missing
  guardian edit; **only 6 of 43 plugins ship `config_schema.yaml`**; `/compliance/audit-logs` is
  flutter-only. [VERIFIED-IN-REPORT]
- Cross-cutting: "**18 of 24 portal routes render `PortalSectionPage`'s 'Coming soon' card** while
  their endpoints exist"; the mock `/student` page is a release blocker; every ai-tools page prints
  `whitespace-pre-wrap` with no markdown/KaTeX and no docx/pdf export "(pptxgenjs+docx are already
  installed but unwired for this)"; marks entry and fees POS have zero keyboard accelerators;
  "Backend > UI everywhere" (leave requests, visitor appointments, procurement, headcount, donations,
  IEP, moderation, QTI, transfers list); "**No `DataTable`/`Skeleton`/`ConfirmDialog`/`Sheet`/
  `EmptyState` primitives exist** (components/ui inventory re-verified today)"; mobile release
  blockers "unchanged": 0 .arb, 0 google-services.json, `setOnTapCallback` never invoked,
  **105 hardcoded `Colors.white`**. [VERIFIED-IN-REPORT] — the 18/24 and 105 numbers collide with
  A7 and A4 (§B-3, §B-6).
- Fix order that became roadmap B3→B2→keyboard→C: portals first (kill the mock page), then Tier-1
  widgets, then marks/fees/attendance keyboard + AI output rendering, then the AI Teacher.
  [VERIFIED-IN-REPORT]

<!--APPEND-A-->
