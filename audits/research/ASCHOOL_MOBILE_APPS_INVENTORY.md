# ASchool Mobile Apps Inventory — Flutter Portfolio Audit

Date: 2026-09-04 · Scope: `flutter_admin`, `flutter_teacher`, `flutter_student`, `flutter_parent`, `flutter_user`, `aschool_shared` (all read-only analysis)
Method: pubspec/manifest inspection, per-file grep of API endpoints/providers (screen "REAL/PARTIAL/STUB" classification), plugin-slug grep vs `backend/app/plugins/modules/*/manifest.yaml`, git-less file-date analysis.

---

## 1. Portfolio at a glance

| App | Dart files | Screens (feature files) | Platforms | App ID | Last touched | TODOs | Verdict |
|---|---|---|---|---|---|---|---|
| flutter_admin | 41 | 38 | Android only | `np.com.aschool.aschool_admin` | 2026-08-31 | 0 | Broad but shallow; 1 fake-data stub; mostly read-only |
| flutter_teacher | 30 | 26 | Android, Web | `np.com.aschool.aschool_teacher` | 2026-08-31 | 0 | Deepest role app; write-capable workflows |
| flutter_student | 29 | 25 | Android | `np.com.aschool.aschool_student` | 2026-08-31 | 0 | Good student surface incl. AI tutor |
| flutter_parent | 25 | 20 | Android | `np.com.aschool.aschool_parent` | 2026-08-31 | 0 | Cleanest provider architecture; bus map + payments |
| flutter_user | 9 | 8 (entry-flow) | Android, iOS, Web, Win, macOS, Linux | `np.com.aschool.aschool_user` | 2026-08-31 | 2 | Thin unified shell **that embeds student+parent+teacher apps as path packages** |
| aschool_shared | 104 | 4 shared screens + 30 widgets | (package) | — | 2026-08-31 | 3 | Real shared core: models, repos, services, theme, PluginGate |

All projects are actively maintained (files updated through 2026-08-31, oldest Apr 2026), compile-configured (build/ artifacts present in each app), Flutter ≥3.16 / Dart ≥3.2, minSdk 24, no flavors, unique applicationIds, Android-only except flutter_user. Each has a `test/widget_test.dart` that only pumps a `SizedBox` (placeholder); `aschool_shared` has 3 real test files (models, nepali_formatter, plugin_gate) + a simulation dir.

### Common architecture (all apps)
- **State:** Riverpod 2.5 (`riverpod_annotation` declared but codegen never used in apps); flutter_admin/teacher/student/parent each have `lib/router.dart` using go_router 13.2 `StatefulShellRoute.indexedStack` with 4–5 branches + a drawer for the long tail.
- **Theme:** `aschool_shared/lib/theme/app_theme.dart` — `ASchoolTheme.light/dark` (dark mode everywhere via `themeModeProvider`), 17 static color tokens, google_fonts import.
- **Routing/auth:** every app redirects `→ /login` when `authProvider.user == null`; login is a 5-line wrapper around `aschool_shared/widgets/login_screen.dart` (`SharedLoginScreen`, LoginType student/staff/parent). Tokens in `flutter_secure_storage`; `ApiClient._AuthInterceptor` has a proper single-flight 401 refresh with queued retries.
- **API:** Dio singleton, `baseUrl` from `--dart-define=API_BASE_URL` (default `https://api.brighternepal.com`) + `/api/v1`, multi-tenant `X-School-Slug` header. Envelope `{success, data, error}` unwrapped via `safe_parse.dart`.
- **Push:** `NotificationService` = OneSignal primary (App ID via `--dart-define=ONESIGNAL_APP_ID`) + FCM fallback + flutter_local_notifications; player ID registered to `/auth/register-onesignal`, tags school_id/role/user_id. **But**: no `google-services.json` in any app, no ONESIGNAL_APP_ID wired, and notification-tap navigation is a no-op (`setOnTapCallback` is never called by any app; local-notification tap just logs).
- **Offline:** none. No sqflite/hive/drift anywhere. Only secure-storage caching of plugins/user/visibility + `connectivity_plus` in student app. Teacher attendance screen explicitly comments "no offline queue — the submission was NOT saved" on failure.
- **Analytics/crash reporting:** none (no Sentry/Crashlytics/Firebase Analytics).
- **Localization:** none. English-only UI; no `flutter_localizations`, no .arb files, zero Nepali strings. Nepali support = `NepaliFormatter` (NPR currency with Indian grouping, +977 phone, BS-date-preferred `preferredDateText`) and `nepali_date_converter` dep. This is a Nepali-market product with zero Nepali UI.

---

## 2. Per-app screen inventory

Legend: **REAL** = wired to live backend endpoints/providers with functional UI; **PARTIAL** = real data but read-only/thin vs the module's intent; **STUB** = no backend wiring (static/fake).

### 2.1 flutter_admin (aschool_admin) — Principal & office
Shell: 5-tab bottom nav (Dashboard/People/Academics/Operations/More) + drawer; login + NotificationCenter shared.

| File (features/…) | Screen | Purpose | Status |
|---|---|---|---|
| dashboard/principal_dashboard.dart | Principal Dashboard | KPIs `/analytics/overview` + AI daily brief `/ai-tools/insights/daily-brief` + `/fees/recent`; quick links | REAL |
| students/students_screen.dart | Students | List/search `/students` (per_page:100, no pagination UI) | REAL |
| students/guardians_screen.dart | Guardians | `/users?role=guardian` list | REAL |
| students/promote_screen.dart | Promote Students | Loads students… **but has no POST — promotion cannot actually be performed** | PARTIAL |
| teachers/teachers_screen.dart | Teachers | Staff list + detail | REAL |
| academics/class_sections_screen.dart | Class Sections | via AcademicDataService | REAL |
| academics/class_subjects_screen.dart | Class Subjects | via AcademicDataService | REAL |
| attendance/attendance_overview.dart | Attendance Overview | single GET overview | REAL |
| timetable/timetable_screen.dart | Timetable | read-only raw "Day X Period Y" list | PARTIAL |
| assignments/assignments_screen.dart | Assignments | **`ModuleScreenTemplate` static placeholder — hardcoded fake insights ("24 open"), action buttons with no onTap** | STUB |
| exams/exams_screen.dart | Exams | list/create | REAL |
| exams/results/exam_results_screen.dart | Exam Results (21 KB) | publish/browse results | REAL |
| fees/fees_management.dart | Fees Management | dashboard + recent payments | REAL |
| analytics/analytics_screen.dart | Advanced Analytics | `PluginGate('basic_reports')` | REAL (gated) |
| reports/reports_hub_screen.dart | Reports Hub | read-only `/reports/dashboard` | PARTIAL |
| certificates/certificates_screen.dart | Certificates | read-only `/design-studio/templates` | PARTIAL |
| hr_payroll/hr_payroll_screen.dart | HR & Payroll | staff/leave/payroll endpoints (not plugin-gated) | REAL |
| admission/admission_screen.dart | Admissions | gated `admission` | REAL |
| alumni/alumni_screen.dart | Alumni | gated `alumni` | REAL |
| health_records/health_records_screen.dart | Health Records | gated `health_records` | REAL |
| wellbeing/wellbeing_screen.dart | Wellbeing | gated `wellbeing` | REAL |
| lms/lms_screen.dart | LMS Admin | gated `lms` | REAL |
| library/library_screen.dart | Library | gated `library_management` | REAL |
| inventory/inventory_screen.dart | Inventory | gated `inventory` | REAL |
| gamification/gamification_screen.dart | Gamification | gated `gamification` | REAL |
| visitor_management/visitor_screen.dart | Visitors | gated `visitor_management` | REAL |
| design_studio/design_studio_screen.dart | Design Studio | gated `design_studio` | REAL |
| dismissal/dismissal_screen.dart | Dismissal | gated `dismissal` | REAL |
| emergency/emergency_screen.dart | Emergency Broadcast | gated `emergency` | REAL |
| social_hub/social_hub_screen.dart | Social Hub | gated `social_hub` | REAL |
| compliance/compliance_screen.dart | Compliance | gated `compliance` | REAL |
| incidents/incident_screen.dart | Incidents | gated `incidents` | REAL |
| transport/transport_screen.dart | Transport | routes/vehicles | REAL |
| marketplace/marketplace_screen.dart | Plugin Marketplace | browse/install/uninstall via PluginRepository (`/plugins/marketplace|install|uninstall`) + per-plugin config | REAL |
| ai_tools/ai_tools_screen.dart | AI Tools | AiRepository (lesson-plan, question-paper, remarks, timetable, weekly insights); gated `ai_tools` | REAL |
| notices/notices_screen.dart | Notices | NoticesService | REAL |
| communications/announcements_screen.dart | Announcements | send/contacts | REAL |
| settings/settings_screen.dart | Settings (22 KB) | school profile PATCH, branding, change password, mobile force-update version mgmt | REAL |

**Totals: 38 screens — 31 REAL, 6 PARTIAL, 1 STUB.** All plugin-gated screens fall back to `PluginGate`'s "Feature Not Available / contact your admin" card; marketplace can install the plugin in-place.

### 2.2 flutter_teacher (aschool_teacher)
Shell: 5 tabs (Dashboard, Attendance, Marks, AI Tools, More) + drawer.

| File | Screen | Purpose | Status |
|---|---|---|---|
| dashboard/teacher_dashboard.dart | Teacher Dashboard | today classes, quick stats | REAL |
| attendance/attendance_screen.dart (21 KB) | Mark Attendance | class/section picker, per-student toggle, POST `/attendance/submit` (no offline queue) | REAL |
| marks/marks_entry_screen.dart (32 KB) | Marks Entry | full grid entry, exams, save | REAL |
| assignments/assignments_screen.dart (40 KB) | Assignments | create/publish + attachments (FileUploadService) | REAL |
| class_section/class_section_screen.dart (23 KB) | My Class Section | section mgmt | REAL |
| students/class_students_screen.dart | Class Students | roster | REAL |
| students/student_profile_screen.dart | Student Profile | via StudentRepository | REAL |
| lessons/create_lesson_screen.dart | Create Lesson | LMS authoring | REAL |
| lessons/create_topic_screen.dart | Create Topic | + file upload | REAL |
| lessons/lesson_detail_screen.dart | Lesson Detail | + upload | REAL |
| lessons/topic_detail_screen.dart | Topic Detail | AttachmentViewer | REAL |
| exams/offline_exam_screen.dart (22 KB) | Offline Exams | schedule/enter | REAL |
| exams/online_exam_screen.dart | Online Exams | thin create/list | PARTIAL |
| exams/report_cards_screen.dart | Report Cards | generate/view per class | REAL |
| diary/diary_write_screen.dart | Diary | post class diary | REAL |
| leave/leave_screen.dart | Leave Requests | apply/list `/hr/leave` | REAL |
| leave/my_attendance_screen.dart | My Attendance | `/attendance/me` read-only | REAL |
| payroll/payroll_slips_screen.dart | Pay Slips | HrRepository `/hr/payroll` | REAL |
| announcements/announcement_screen.dart | Announcements | compose with attachments | REAL |
| notices/teacher_notices_screen.dart | Notices | NoticesService wrapper | REAL |
| library/teacher_library_screen.dart | Library | gated `library_management` | REAL |
| lms/lms_overview_screen.dart | LMS Overview | gated `lms` | REAL |
| wellbeing/student_wellbeing_screen.dart | Wellbeing | gated `wellbeing` | REAL |
| portfolio/student_portfolios_screen.dart | Student Portfolios | gated `student_portfolio` | REAL |
| ai_tools/teacher_ai_screen.dart | AI Tools | lesson-plan / question-paper / remarks / timetable / weekly insights; gated `ai_tools` | REAL |
| timetable/timetable_screen.dart | My Timetable | read-only | REAL |

**Totals: 26 screens — 24 REAL, 2 PARTIAL, 0 STUB.** Note: `speech_to_text` is a declared dependency but **never imported anywhere** — the "voice" feature doesn't exist.

### 2.3 flutter_student (aschool_student)
Shell: 4 tabs (Dashboard, Timetable, Homework, Results) + dashboard grid with legacy-route redirects; drawer.

| File | Screen | Purpose | Status |
|---|---|---|---|
| dashboard/student_dashboard.dart (25 KB) | Dashboard | dashboardProvider, currentStudentProvider, plugin-gated grid | REAL |
| timetable/student_timetable.dart | Timetable | timetableProvider | REAL |
| homework/homework_screen.dart (22 KB) | Homework | assignmentsProvider + submit; **attachment is a URL text field (`file_url`), not a camera/gallery picker** | REAL (weak submit) |
| results/student_results.dart | Results | resultsProvider | REAL |
| results/student_marksheet_screen.dart | Marksheet | per-exam marksheet | REAL |
| attendance/student_attendance_screen.dart | Attendance | month view + shared StudentAttendanceScreen | REAL |
| exams/student_exams_screen.dart | Exams | schedule/seats | REAL |
| fees/student_fees_screen.dart | My Fees | gated `fees`, dues list | REAL |
| library/student_library.dart | Library | gated `library_management` | REAL |
| lms/student_lms.dart (21 KB) | LMS | gated `lms` | REAL |
| ai_tutor/ai_tutor_screen.dart | **AI Tutor** | chat UI, subject chips (incl. Nepali/Opt. Math), typing indicator, quick prompts → POST `/ai-tools/homework-help`; gated `ai_tutor` | REAL |
| portfolio/portfolio_screen.dart | Portfolio | gated `student_portfolio` | REAL |
| achievements/achievements_screen.dart | Achievements | gated `student_portfolio` | REAL |
| gamification/gamification_screen.dart | Points/Badges | gated `gamification` | REAL |
| wellbeing/student_wellbeing.dart | Wellbeing | gated `wellbeing` | REAL |
| elibrary/elibrary_screen.dart | e-Library | gated `elibrary` | REAL |
| health_records/student_health_screen.dart | Health Records | gated `health_records` | REAL |
| notices/student_notices.dart | Notices | NoticeBoardList wrapper | REAL |
| diary/diary_read_screen.dart | Diary | read | REAL |
| subjects/subjects_screen.dart | Subjects | AcademicDataService | REAL |
| classmates/classmates_screen.dart | Classmates | `/students` | REAL |
| teachers/teachers_list_screen.dart | Teachers | `/users?role=teacher` | REAL |
| guardians/guardian_details_screen.dart | Guardians | contact info | REAL |
| transport/student_transport_screen.dart | Transport | read-only route list | PARTIAL |
| profile/student_profile_screen.dart | Profile | multi-provider | REAL |

**Totals: 25 screens — 24 REAL, 1 PARTIAL, 0 STUB.** Shared `/holidays` + `/gallery` screens (from aschool_shared) also routed.

### 2.4 flutter_parent (aschool_parent)
Shell: 4 tabs (Dashboard, Child, Fees, More) + drawer; multi-child switcher via `selectedChildIdProvider`; all child data flows through `lib/providers/parent_providers.dart` hitting `/parent/*` endpoints (`/parent/dashboard`, `child-attendance`, `child-timetable`, `child-wellbeing`, `conferences`, `dismissal-status`, `outstanding-fees`, `assignments` + marksheet/results).

| File | Screen | Purpose | Status |
|---|---|---|---|
| dashboard/parent_dashboard.dart (20 KB) | Dashboard | parentDashboardProvider, child switcher, plugin-gated tiles | REAL |
| attendance/child_attendance.dart | Child Attendance | | REAL |
| timetable/child_timetable_screen.dart | Child Timetable | | REAL |
| subjects/child_subjects_screen.dart | Child Subjects | | REAL |
| teachers/teachers_screen.dart | Teachers | contact directory | REAL |
| homework/homework_screen.dart | Homework | `/parent/assignments` read-only | REAL |
| results/results_screen.dart | Results | parentResultsProvider | REAL |
| results/parent_marksheet_screen.dart | Marksheet | parentMarksheetProvider | REAL |
| reports/child_reports_screen.dart | Report Cards | | REAL |
| fees/fee_payment_screen.dart (13 KB) | **Fee Payment** | `/fees/payment-methods` → `/fees/initiate-payment` → eSewa auto-submit form in WebView or browser | REAL |
| bus_tracker/bus_tracking_screen.dart | **Live Bus Tracker** | flutter_map + OSM tiles, bus stop markers, **15 s polling** (not socket stream); gated `gps_tracking`/`bus_tracking` | REAL |
| chat/parent_chat_screen.dart | Chat with Teachers | SharedChat services + Socket.IO `chat:message` | REAL |
| notices/parent_notices_screen.dart | Notices | | REAL |
| pt_conference/pt_conference_screen.dart | PT Conferences | gated `conferences` | REAL |
| dismissal/dismissal_qr_screen.dart | Pickup QR | QR code (qr_flutter), gated `dismissal` | REAL |
| elibrary/parent_elibrary_screen.dart | e-Library | gated `elibrary` | REAL |
| portfolio/parent_portfolio_screen.dart | Portfolio | gated `student_portfolio` | REAL |
| health_records/child_health_screen.dart | Health Records | gated `health_records` | REAL |
| wellbeing/child_wellbeing_screen.dart | Wellbeing | gated `wellbeing` | REAL |
| profile/child_profile_screen.dart (16 KB) | Child Profile | | REAL |

**Totals: 20 screens — 19 REAL, 1 PARTIAL (none — all real; homework is read-only vs parent-ack semantics), 0 STUB.** Strongest app architecturally.

### 2.5 flutter_user (aschool_user) — Unified entry app
Not a 5th feature set — a **bootstrap shell that imports flutter_student/flutter_parent/flutter_teacher as path packages** and hosts the matching role app after login (`role_app_host.dart` switches on `user.role`; admin roles get "Use Admin App" screen).

| File | Screen | Purpose | Status |
|---|---|---|---|
| screens/splash_screen.dart | Splash | loading while auth restores | REAL |
| screens/onboarding_screen.dart | Onboarding | PageView marketing carousel, first-run flag in SharedPreferences | REAL |
| screens/mode_selection_screen.dart | Mode Selection | Student / Parent / Teacher cards | REAL |
| screens/school_lookup_screen.dart | School Lookup | live school search (Dio) → sets `X-School-Slug` | REAL |
| screens/unified_login_screen.dart | Unified Login | student-ID vs phone/email per flow; own auth controller (does NOT reuse SharedLoginScreen) | REAL |
| state/auth_flow_controller.dart | Flow state | EntryStage machine, schoolSlug persistence | REAL |
| widgets/role_app_host.dart | Role host | embeds role app; UnsupportedRoleApp for admin roles | REAL |
| widgets/glow_orb.dart | Decor | | REAL |

**Totals: 8 screens, all REAL.** Full multi-platform (only app with ios/, web, windows, macos, linux).

---

## 3. Redundancy analysis & consolidation recommendation

**What flutter_user does vs the role apps:** it duplicates only the entry funnel. Everything after login is literally the student/parent/teacher app compiled in. The four standalone apps' entry funnels (SharedLoginScreen + router redirect) are 3 thin copies; the *real* duplication is:

1. **4 near-variant `shell_screen.dart`** (per-app bottom-nav + drawer definitions) — same pattern re-implemented, ~200 lines each.
2. **Admin and teacher AI screens are copy-paste twins**: both define `_AiToolCard`, `_FieldSpec`, `_AiToolDetail` with identical generate flows (19.7 KB vs 15.5 KB). Should be one shared widget with a tool list.
3. Per-app notice screens are 1.3–4 KB wrappers around shared `NoticeBoardList` (acceptable).
4. `flutter_user`'s `UnifiedLoginScreen` + `AuthFlowController` re-implements what `SharedLoginScreen` already does (2 login stacks in the codebase).
5. Zero byte-identical files across apps (checked by hash) — heavy lifting genuinely lives in `aschool_shared` (104 files: 19 models, 15 repositories, 15 providers, 7 services, 30 widgets). **Yes, aschool_shared is used by all five apps** and carries real logic (ApiClient, PluginGate, NotificationCenter, ForceUpdateDialog, chat).

**Recommendation — consolidate to 2 shipping apps (already half-done):**
- **Ship `flutter_user` as THE one app for student + parent + teacher.** It already works this way; the entry funnel (onboarding → role → school lookup → login) is the best UX in the repo and is multi-platform.
- **Keep `flutter_admin` separate** (office/principal audience, plugin marketplace with install/uninstall, school settings — inappropriate for a student-facing store listing).
- **Stop building/publishing standalone flutter_student/flutter_parent/flutter_teacher store binaries.** Keep the repos as feature packages consumed by flutter_user (as today), then merge their duplicated shells/AI screens into aschool_shared. This cuts store listings 5→2, kills the 3-way app-icon/branding/OTP-config overhead, and makes plugin-gated UI uniform (a user whose role changes keeps one app).
- Prerequisite fixes before promoting flutter_user: move FCM/OneSignal config, deep links, and icon/splash into it (it's the only app with iOS/, so this is where iOS shipping must happen anyway).

---

## 4. Plugin ↔ app-UI matrix (51 backend plugins)

`backend/app/plugins/modules/*/manifest.yaml` slugs vs Flutter surface area. ✅ = screen(s) exist and are PluginGate-gated or natively wired; ⚠️ = screen exists but not gated; ❌ = zero app UI.

| Plugin slug | Admin | Teacher | Student | Parent | Notes |
|---|---|---|---|---|---|
| academics | ✅ (class sections/subjects, core APIs) | ✅ | ✅ | ✅ | core, ungated |
| admission | ✅ gated | — | — | — | |
| advanced_analytics | ❌ (analytics screen gated on `basic_reports`, not this) | — | — | — | |
| ai_adaptive_learning | ❌ | ❌ | ❌ | ❌ | backend `adaptive_learning.py` has no client |
| ai_grading | ❌ | ❌ | ❌ | ❌ | no UI; marks entry is manual |
| ai_insights | ⚠️ dashboard checks `isInstalled('ai_insights')` + daily-brief | — | — | — | |
| ai_suite | ❌ | ❌ | ❌ | ❌ | |
| ai_tools | ✅ admin + teacher tool screens | ✅ | — | — | |
| ai_tutor | — | — | ✅ chat, gated | — | only /ai-tools/homework-help used; backend `ai_tutor.py` sessions/APIs unused |
| alumni | ✅ gated | — | — | — | |
| assignments | ⚠️ **STUB screen (fake data)** | ✅ full | ✅ | ✅ read | |
| attendance | ✅ | ✅ | ✅ | ✅ | no offline, no biometric |
| basic_reports | ✅ (analytics gate + reports hub) | — | — | ✅ reports | |
| basic_website | ❌ | — | — | — | web-only concern |
| benchmarking | ❌ | — | — | — | |
| biometric | ❌ | ❌ | ❌ | ❌ | no biometric login in any app |
| compliance | ✅ gated | — | — | — | |
| conferences | — | — | — | ✅ gated | |
| design_studio | ✅ gated (+ certificates read) | — | — | — | |
| digital_content | ❌ | — | — | — | |
| disaster_management | ❌ | — | — | — | |
| dismissal | ✅ gated | — | — | ✅ QR gated | |
| elibrary | — | — | ✅ gated | ✅ gated | |
| emergency | ✅ gated | — | — | — | parent/student receive via push only |
| exams | ✅ | ✅ | ✅ | ✅ | |
| fees | ✅ | — | ✅ gated | ✅ + eSewa payment | |
| file_management | ❌ (only ad-hoc FileUploadService) | — | — | — | |
| gamification | ✅ gated | — | ✅ gated | — | |
| gps_tracking | — | — | — | ✅ (bus map, 15 s poll) | |
| health_records | ✅ gated | — | ✅ gated | ✅ gated | |
| hr_payroll | ⚠️ screen (ungated) | ✅ pay slips | — | — | |
| iemis_importer | ❌ | — | — | — | admin-web only |
| incident_management | ❌ (apps use `incidents`) | — | — | — | **duplicate plugin** |
| incidents | ✅ gated | — | — | — | |
| inventory | ✅ gated | — | — | — | |
| library | ❌ (apps use `library_management`) | — | — | — | **duplicate plugin** |
| library_management | ✅ | ✅ | ✅ | — | |
| lms | ✅ | ✅ | ✅ | — | |
| multi_branch | ❌ | — | — | — | |
| notices | ✅ | ✅ | ✅ | ✅ | |
| portfolio | ❌ (apps use `student_portfolio`) | — | — | — | **duplicate plugin** |
| sms_notifications | ❌ | — | — | — | |
| social_ads | ❌ | — | — | — | |
| social_hub | ✅ gated | — | — | — | |
| student_portfolio | ✅ | ✅ | ✅ + achievements | ✅ | |
| timetable | ✅ (read-only) | ✅ | ✅ | ✅ | no widget |
| visitor_management | ✅ gated | — | — | — | |
| website_builder | ❌ | — | — | — | web-only |
| wellbeing | ✅ gated | ✅ gated | ✅ gated | ✅ gated | |
| whatsapp_bot | ❌ | — | — | — | |
| white_label | ❌ | — | — | — | branding is in admin settings |

**Zero app UI (❌): 15 plugins** — advanced_analytics, ai_adaptive_learning, ai_grading, ai_suite, basic_website, benchmarking, biometric, digital_content, disaster_management, file_management, iemis_importer, incident_management, library, multi_branch, portfolio, sms_notifications, social_ads, website_builder, whatsapp_bot, white_label (≈20 of 51; several are web-only or duplicate slugs). Plus 3 duplicate-slug traps (`incidents`/`incident_management`, `library`/`library_management`, `portfolio`/`student_portfolio`) where apps only use one of each pair — see `audits/research/ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md`.

---

## 5. AI features in the apps

| Surface | What exists | What it calls | Missing |
|---|---|---|---|
| Student **AI Tutor** (`ai_tutor_screen.dart`) | Full chat UI: subject chips (General/Math/…/Nepali/Opt. Math), typing indicator, quick prompts, markdown bubbles | POST `/ai-tools/homework-help` | No session history persistence, no voice, no image/photo-of-homework input, gated on `ai_tutor` plugin |
| Teacher **AI Tools** (`teacher_ai_screen.dart`) | Tool grid → form detail → "Generate" for lesson plan, question paper, remarks, timetable ideas, weekly insights | `AiRepository` → `/ai-tools/lesson-plan|question-paper|remarks|timetable`, `/ai-tools/insights/weekly` | No grading assist (ai_grading plugin unused), no adaptive learning |
| Admin **AI Tools** (`ai_tools_screen.dart`) | Same pattern (copy-paste of teacher's) + **AI Daily Brief** card on dashboard | AiRepository + `/ai-tools/insights/daily-brief` | ai_workbench.py, ai_capture.py, ai_extensions.py have no client |
| Voice | `speech_to_text: ^7.3.0` in teacher pubspec | **never imported — dead dependency** | |
| Camera/OCR | none (shared `mobile_scanner` dep also unused) | — | no homework-scan, no document capture |

So: apps use only the `ai_tools` plugin's synchronous endpoints. The backend's richer AI estate (tutor sessions, adaptive learning, grading, workbench, capture) is invisible on mobile.

---

## 6. Mobile UX gaps vs international-standard school apps

Prioritized, concrete:

1. **Push notifications don't deep-link** — tap handlers log only; `setOnTapCallback` never registered; no `intent-filter` VIEW scheme. (ClassDojo/Remind baseline: every tap lands on the object.)
2. **Push config not shipped** — no `google-services.json` in any Android app; ONESIGNAL_APP_ID unset → notifications silently disabled in production builds.
3. **No offline anything** — teacher attendance fails outright without network (explicit no-queue comment); no cached timetable/homework for students; no offline DB at all.
4. **No biometric login** despite a `biometric` plugin existing on the backend (4.4).
5. **Homework submission has no media pipeline** — student "attachment" is a pasted URL string; no image_picker/camera/document-scan in student app. (Google Classroom core flow.)
6. **No in-app receipt** after eSewa/Khalti payment (webview/browser handoff, no PDF receipt, no payment history screen with re-download).
7. **No document scanning** anywhere (mobile_scanner dep unused).
8. **No timetable/home screen widget**; no `.ics` calendar export/sync.
9. **Bus tracking is 15-second polling**, not Socket.IO `bus_location` (constant exists in shared, unused); no ETA, no route polyline.
10. **No notifications inbox per-category routing** — NotificationCenterScreen exists but taps don't route; no mute/preferences per channel.
11. **Chat is minimal** — parent↔teacher text only; no group/class channels, no attachments in chat, no read receipts.
12. **No Nepali localization** — English-only UI for a Nepali market (Veda/Paathshala ship full np locale); no Devanagari font strategy (google_fonts imported but generic); BS calendar only partially via `preferredDateText`, no BS date picker.
13. **No accessibility** — zero `Semantics`/semanticLabels in all apps; no large-font QA; contrast untested.
14. **No onboarding/permission priming in role apps** (only flutter_user has onboarding) — and no demo mode/school preview before login.
15. **No crash reporting / analytics funnels** — cannot measure retention or diagnose field crashes.
16. **Student app lacks self-service actions** — no leave request, no re-enrollment, no resource download manager (offline e-library).
17. **Admin app is read-heavy** — cannot promote students (screen has no POST), assignments screen is fake; no admissions pipeline drag actions on mobile beyond basic forms.
18. **No app-size/perf budget** — no `--split-per-abi`, no shrink config review, unused heavy deps (retrofit/freezed/mobile_scanner/geolocator in shared) inflate builds; low-end device testing undocumented.
19. **Force-update exists** (`mobile_version_service` + ForceUpdateDialog + admin version setter) — good — but no staged rollout/Irish goodbye handling of expired sessions mid-flow (refresh failure deletes storage → silent logout).
20. **No report-card PDF export/share on student/parent marksheet** (share_plus present but used sparsely); no multi-language fee SMS parity.
21. **No dark-mode-aware maps/QR polish, no skeleton-driven empty-state consistency** — mostly good via shared widgets, but a few screens use raw Center(Text(error)).
22. **App icons/branding per school (white_label) not surfaced** — single static branding.

---

## 7. Code-health findings

1. **Fake data in production path** — `flutter_admin/lib/features/assignments/assignments_screen.dart` is a static `ModuleScreenTemplate` with hardcoded "24 Open / 6 Due Today" and dead buttons; principals see fabricated numbers.
2. **Admin promote screen cannot promote** — GET `/students` only, no write call.
3. **Dead dependencies**: `speech_to_text` (teacher), `mobile_scanner`, `geolocator`, `retrofit`, `freezed_annotation`/`freezed`, `riverpod_annotation` (codegen never run) in aschool_shared.
4. **Dependency-version fragility**: aschool_shared pins `share_plus ^9` + teacher pins `web: 0.5.1`, while flutter_user overrides `web ^1.0.0` + `share_plus ^10` — the same package graph resolves to conflicting majors across apps; documented only in a pubspec comment.
5. **No tests**: every app's only test pumps a `SizedBox`. Zero coverage of ApiClient refresh logic, PluginGate in apps, or any screen.
6. **Hardcoded values**: OSM tile URL inline in bus screen; default prod URL baked into constants (dart-define mitigates); `per_page: 100` caps and no pagination in ~10 list screens (students/classmates/teachers/attendance-me) — breaks at real school sizes.
7. **Untyped JSON everywhere**: screens parse `Map<String, dynamic>` by hand despite 19 model classes existing in shared — model/contract drift risk (mitigated by `safe_parse.dart` helpers, inconsistently applied).
8. **Push lifecycle bug class**: `NotificationService.init()` runs before school-slug set; FCM registration on 401 only logs; tap deep-link callback API exists but is dead code.
9. **Stale docs**: flutter_admin/README.md is the default Flutter template; flutter_user/README.md references `../flutter_shared` (doesn't exist — actual name `aschool_shared`).
10. **No CI/flavor matrix**: single debug-style build config, no dev/staging/prod flavors, no signing config evidence, iOS exists only in flutter_user.
11. **No error-boundary UX consistency**: some screens use shared `ErrorContainer`, others raw `Center(Text(...))` (e.g., student notices).
12. **Security posture decent**: tokens in secure storage, refresh single-flight, `X-School-Slug` tenant header; no secrets committed in Flutter trees.

---

## 8. Prioritized mobile work list

**P0 — ship-blocking for flutter_user as the one app**
1. Add FCM (`google-services.json`) + OneSignal App ID to build config; verify token registration end-to-end.
2. Implement notification-tap deep linking (register `setOnTapCallback`, map payload → go_router paths, add intent-filter + iOS universal links).
3. Replace student homework URL-text attachment with image_picker/camera + FileUploadService (shared service already exists).
4. Delete/rebuild admin Assignments screen against real endpoints.
5. Pay down share_plus/web version conflict; single resolution across all path packages.

**P1 — competitive parity (first 90 days)**
6. Biometric login (local_auth) on flutter_user; mirror backend biometric plugin.
7. Offline cache + teacher attendance queue (sqflite/Isar; replay on connectivity).
8. Payment receipt: persist payment record post-callback, PDF/view + share.
9. Bus tracking via Socket.IO `bus_location` stream + ETA + route polyline.
10. Nepali locale (arb) + Devanagari fonts + BS calendar picker; language toggle in settings.
11. Notification preferences + categorized inbox routing.
12. Pagination (infinite scroll) on all `per_page:100` lists.
13. Sentry/Crashlytics + basic product analytics.

**P2 — polish**
14. Extract shared shell/AI-tool widgets into aschool_shared; drop standalone store builds for student/parent/teacher.
15. Timetable home-screen widget + .ics export.
16. Document scanning (use the already-declared mobile_scanner) for homework/notes.
17. Accessibility pass (Semantics, dynamic type, contrast) and low-end device budget (split-per-abi, remove dead deps).
18. Surface AI tutor sessions/history; wire adaptive-learning endpoints to student dashboard recommendations.
19. Real test suite: ApiClient refresh, PluginGate flows, one golden per shell.
20. Fix admin promote write action; add student leave request + report-card PDF export.
