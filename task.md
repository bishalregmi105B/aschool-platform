# ASchool Implementation Tasks

## Codex Verification Update — 2026-05-05

### Completed in this pass
- [x] Logged in as `admin@demo.aschool.com.np` and reproduced the reported browser 500s.
- [x] Fixed the runtime schema drift by upgrading Postgres Alembic state through `c0a1b2c3d4e5`.
- [x] Resolved Alembic branch drift for the pre-existing `designer_templates` table.
- [x] Confirmed these screenshot routes now return 200: `/academics/subjects`, `/academics/classes`, and `/users?role=teacher`.
- [x] Added repeatable live API route audit helper at `backend/scripts/api_route_audit.py`.
- [x] Audited 449 live route probes: 218 authenticated GET routes + 231 safe OPTIONS probes, with 0 server errors.
- [x] Fixed remaining live-audit 500s in teacher analytics and reports dashboard.
- [x] Updated fee/report helpers, AI fee predictor, fee reminders, website builder service, timetable solver, and scheduled task imports to match current ASchool models.
- [x] Added Next ESLint config and fixed blocking JSX lint errors.
- [x] Re-ran strict unfinished-content scan; no active ASchool TODO/FIXME/coming-soon/mock/demo/dummy/fake/not-implemented/API-placeholder matches remain.

### Verification
- [x] `docker compose exec -T flask python -m compileall app scripts`
- [x] `docker compose exec -T flask python -m pytest` — 614 passed
- [x] `docker compose exec -T nextjs npm run lint` — exits 0 with non-blocking image/hook warnings
- [x] `docker compose exec -T flask python scripts/api_route_audit.py` — 449 probes, 0 server errors
- [x] Fee report route with required dates returns 200

### Reference Comparison Notes
- [x] eSchool reference major flows are covered in ASchool: student/parent/teacher academics, attendance, assignments, exams, online exams, lessons/topics/materials, diary, notices, sliders, fees/receipts, payroll, gallery, transport, reports, website settings, and certificate/design tooling.
- [x] Mighty/eSchool SaaS administration areas are covered or exceeded by ASchool's plugin marketplace, multi-tenant schools, website builder, design studio, IEMIS, Nepal gateways, AI modules, wellbeing, portfolio, GPS, incident, inventory, visitor, and social modules.
- [x] Remaining competitor-only differences are strategic, not broken-plan blockers: eSchool has extra global payment gateways such as Razorpay/Paystack/Flutterwave and more granular transport pickup/order/request screens; ASchool intentionally prioritizes Nepal payments plus GPS/bus/route/stop coverage.

## Codex Verification Update — 2026-05-04

### Completed in this pass
- [x] Fixed Flutter compile blockers across `flutter_shared`, `flutter_student`, `flutter_teacher`, `flutter_parent`, and `flutter_admin`
- [x] Added shared `AppDrawer` used by the teacher shell
- [x] Aligned shared assignment/exam/timetable/plugin models with current Flutter screen expectations
- [x] Added backend LMS lesson/topic/study-material compatibility routes
- [x] Added backend online exam models/routes and migration
- [x] Added backend teacher mobile routes: dashboard, classes, students, timetable, assignments
- [x] Added attendance/student compatibility routes used by Flutter
- [x] Fixed assignment API field mismatches and grade-submission compatibility route
- [x] Fixed Stripe plugin webhook activation field/import mismatch
- [x] Fixed Flutter plugin provider parsing for `/plugins/installed`
- [x] Added backend academic dimensions: semesters, mediums, streams, shifts, class/section/subject/student links, API CRUD, and Alembic migration
- [x] Completed teacher assignment submissions sheet with view, status, marks, feedback, and grade/update workflow
- [x] Modernized parent app routing with `StatefulShellRoute`, shared bottom nav/drawer, Riverpod dashboard state, child selector, and child-scoped attendance/fees/results/wellbeing/bus flows
- [x] Modernized admin app routing with `StatefulShellRoute`, shared bottom nav, and shared drawer module grouping
- [x] All Flutter packages pass `flutter analyze`
- [x] All Flutter package tests pass
- [x] Backend Python compilation passes with `PYTHONPYCACHEPREFIX=/tmp/aschool_pycache`

### Still pending / blocked from the master plan
- [ ] Complete remaining Phase 2+ feature parity: full chat UI, online exam timer/MCQ UI, banner/slider admin CRUD, diary CRUD, report charts, gallery year filters, fee receipts/PDFs, settings/force-update, and guardian profile detail
- [ ] Finish broad provider/repository rewrites for every remaining parent/admin screen beyond the routing and critical child-scoped flows
- [ ] Comprehensive backend route audit and API tests across all modules
- [ ] Real frontend lint/test verification after installing frontend dependencies
- [ ] Backend pytest verification after installing `pytest`

## Decisions Locked
- **State Mgmt:** Riverpod AsyncNotifierProvider
- **UI Design:** eSchool-style UI/UX
- **Billing:** Plugin marketplace + package tiers
- **Phase Order:** P0 → P1 → P2 → P3 → P4
- **Backend Audit:** In parallel with P0

---

## Phase 0 — Foundation Layer

### Flutter Shared — Data Models
- [x] Core academic models (academic_year, class, section, subject)
- [x] Student models (student, student_details, guardian)
- [x] Attendance models (attendance, attendance_day)
- [x] Assignment model
- [x] Exam models (exam, exam_result, online_exam, question)
- [x] Fee models (fee, fee_transaction)
- [x] Timetable model (timetable_slot)
- [x] LMS models (lesson, topic, study_material)
- [x] Communication models (notice, announcement, diary)
- [x] Slider/banner model
- [x] Chat models (chat_message, chat_contact)
- [x] Transport model
- [x] HR models (payroll_slip, leave_request)
- [x] Gamification/wellbeing/portfolio models
- [x] Update aschool_shared.dart exports

### Flutter Shared — Repository Layer
- [x] academic_repository.dart
- [x] student_repository.dart
- [x] attendance_repository.dart
- [x] assignment_repository.dart
- [x] exam_repository.dart
- [x] fee_repository.dart
- [x] timetable_repository.dart
- [x] lesson_repository.dart
- [x] notice_repository.dart
- [x] chat_repository.dart
- [x] transport_repository.dart
- [x] hr_repository.dart
- [x] gallery_repository.dart

### Flutter Shared — Riverpod Providers
- [x] dashboard_provider.dart
- [x] academic_provider.dart
- [x] attendance_provider.dart
- [x] assignments_provider.dart
- [x] exams_provider.dart
- [x] results_provider.dart
- [x] fees_provider.dart
- [x] timetable_provider.dart
- [x] lessons_provider.dart
- [x] notices_provider.dart
- [x] chat_provider.dart

### Flutter Shared — Common Widgets
- [x] error_container.dart
- [x] no_data_container.dart
- [x] shimmer_loading_list.dart
- [x] shimmer_loading_grid.dart
- [x] banner_carousel.dart
- [x] stat_card.dart
- [x] section_header.dart
- [x] custom_app_bar.dart
- [x] filter_chip_row.dart
- [x] animated_toggle.dart
- [x] calendar_widget.dart
- [x] paginated_list.dart
- [x] search_bar_widget.dart
- [x] custom_bottom_sheet.dart
- [x] pull_to_refresh.dart

### Backend Audit
- [x] Audit all 56 API route modules for completeness
- [x] Verify session year / semester / stream / shift / medium support
- [x] Verify lesson → topic → study material CRUD
- [x] Verify online exam engine

### Next.js Frontend
- [x] Audit frontend for needed changes
- [x] Align with backend API patterns

---

## Phase 1 — UI/UX Transformation

### App Shell Refactoring
- [x] Replace flat GoRouter with StatefulShellRoute in all four apps
- [x] Create DynamicBottomNav widget matching eSchool animations
- [x] Implement customizable AppDrawer with dynamic height headers

### Dashboard Rewrite (Pilot)
- [x] Rip out 461-line monolith in student_dashboard.dart
- [x] Implement DashboardNotifier (Riverpod)
- [x] Build UI: BannerCarousel, StatCard grid, LatestNotices list
- [x] Wrap with PullToRefresh and ShimmerLoadingGrid

## Phase 2 — Feature Parity (Academics)
- [x] Rewrite HomeworkScreen with assignmentsProvider
- [x] Rewrite StudentTimetable with timetableProvider
- [x] Rewrite StudentExamsScreen with examsProvider
- [x] Rewrite StudentResults with resultsProvider

## Phase 3 — SaaS Web Billing & Administration
- [x] Frontend Plugin Marketplace (SaaS Packages UI + Individual Plugins)
- [x] Backend Plugin Activation (Stripe Webhook for tenant_plugins)
- [x] Flutter pluginProvider real-time unlocking

## Phase 4 — Teacher App Migration (Pilot)
- [x] Refactor flutter_teacher router to use StatefulShellRoute
- [x] Implement Teacher ShellScreen with dynamic drawer
- [x] Rewrite Teacher Dashboard with Riverpod & eSchool UI

## Phase 5 — Teacher Feature Parity
- [x] Rewrite AttendanceScreen with attendanceProvider
- [x] Rewrite MarksEntryScreen with examsProvider
- [x] Refactor Student/Class Management screens

## Phase 6 — Teacher Academic Management
- [x] Rewrite CreateLessonScreen with Riverpod
- [x] Rewrite CreateTopicScreen with Riverpod
- [x] Rewrite AssignmentsScreen (View/Grade Submissions)

---

## Codex Audit — 2026-05-04

### Mock / Demo / Dead Action Cleanup
- [x] Added real backend diary tables, migration, category CRUD, and diary entry create/list API.
- [x] Replaced web diary category mock data and diary entry add route with real communications APIs.
- [x] Removed website `/api/placeholder` gallery/hero fallbacks; empty galleries now show an empty state.
- [x] Replaced hardcoded exam report metrics and expense chart placeholders with live API-backed summaries and CSV exports.
- [x] Replaced student bulk-import "coming soon" template action with a real CSV download.
- [x] Rewired Flutter student assignment/results repositories to student-facing APIs.
- [x] Added Flutter student assignment attachment URL submission/opening, LMS quiz player, online exam player, portfolio sharing, and counselor request recording.
- [x] Replaced empty admin/teacher Flutter actions with API-backed dialogs or removed unsupported boost UI.
- [x] Strict scan is clean for TODO/FIXME/coming soon/mock data/demo data/dummy data/fake data/not implemented/chart placeholder and `/api/placeholder`.

### Remaining Master-Plan Scope
- [x] Full chat UI/API parity completed for shared/admin/teacher/student clients and parent chat persistence.
- [x] Banner/slider backend CRUD and admin web management page added.
- [x] Fee receipt records, receipt PDF download, parent online-payment route compatibility, and webhook receipt persistence completed.
- [x] Settings, school update, and mobile force-update/version policy completed.
- [x] Gallery real image data and year filters completed for web, admin Flutter, and student Flutter.
- [x] Guardian profile detail completed for web and admin Flutter.
- [x] Teacher report summaries/distribution charts added.
- [x] Backend route audit artifact added at `backend_route_audit.md`.
- [x] Frontend lint is now configured and passes in the `nextjs` container; remaining output is non-blocking image/hook warnings.
