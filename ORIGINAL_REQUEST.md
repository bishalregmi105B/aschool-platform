# Original User Request

## Initial Request — 2026-09-13T14:32:31Z

# Teamwork Project Prompt — Production UI/UX Rewrite & Full Platform Hardening

> Status: Launched
> Goal: Complete page-by-page UI/UX rewrite, security & bug fixes, demo data seeding, and multi-app user experience overhaul for ASchool
> Requested team: Full team

Execute a complete, end-to-end production-grade rewrite and hardening of the ASchool platform across Web (Next.js 14 AOS desktop & mobile shell, 237 dashboard pages, public site), Mobile (Flutter apps: admin, teacher, student, parent, user), and Backend (Flask API, Celery, PostgreSQL). Ensure the user experience is dead simple, intuitive, beautiful, fully localized in English and Nepali, responsive, and backed by robust data integrity.

Working directory: /home/bishal-regmi/Desktop/ASchool
Integrity mode: development

## Requirements

### R1. Backend Security Hardening & Bug Fixes (Phase 0)
Eliminate all known P0/P1/P2 vulnerabilities and bugs in the backend:
1. Fix path traversal vulnerability in `app/api/v1/files.py` and `app/utils/file_upload.py` by strictly sanitizing and rejecting directory traversal (`..`) or absolute paths.
2. Fix dead import causing `GET /benchmarking/rankings` 500 error in `app/api/v1/benchmarking.py`.
3. Fix coordinate formula typo in child-safety geofence distance calculation (`app/tasks/gps_processing.py`).
4. Secure `ai_teacher` webhook by binding API key to lesson school and adding `(lesson_id, event_id)` replay protection (`app/plugins/modules/ai_teacher/routes.py`).
5. Restrict FAQ write operations (`POST`, `PUT`, `DELETE`) to authorized school administrators in `app/api/v1/faqs.py`.
6. Compute LMS quiz scores server-side rather than trusting client submissions (`app/api/v1/lms.py`).
7. Purge 308-row student PII XLSX files from `iemis_templates/` and replace with sanitized synthetic templates.
8. Resolve all remaining correctness fixes: conference slot race locks, payroll transitions, WhatsApp audit logging, GPS push role enums, Unsplash key protection, and elibrary manifest blueprint pointer.

### R2. Comprehensive Demo Data Seeding & First-Run Setup
Enable complete, out-of-the-box evaluation without empty-state blocks:
1. Expand `backend/seed.py` / `seed_test_data.py` to seed a rich Nepali demo school:
   - Full academic year, 10 grades (Class 1 to 10), multiple sections (A, B, C).
   - Realistic synthetic Nepali student profiles (names, guardians, blood groups, addresses, BS dates).
   - Teachers and staff with assigned classes, subjects, and timetables.
   - Comprehensive fee structures, sample invoices, receipts, and offline payment slips.
   - Term examinations, grading scales (NEB standard), entered marks, and generated report cards.
   - Active notices, bus routes with geofences and mock stops, library catalog with physical and digital items.
2. Ensure demo logins for all roles (`school_admin`, `teacher`, `student`, `parent`, `superadmin`) work seamlessly.
3. Build a first-run setup wizard triggered when a school has 0 classes, guiding users through Academic Year → Classes → Sections → Subjects → Fees.

### R3. Web UI/UX Complete Overhaul (AOS Desktop & Mobile Web)
Revitalize every screen, component, and interaction in the web frontend:
1. **Typography & Theming**: Fix Mukta Devanagari font CSP loading in `next.config.js` and `@font-face` in `globals.css` so Nepali renders flawlessly everywhere.
2. **Design System & Components**:
   - Enhance `components/ui/tabs.tsx` with pill, underline, and segmented variants while preserving Win11 styling and Radix keyboard navigation.
   - Expand `data-table.tsx` with row grouping, sticky headers/first columns, inline editing for marks, print modes, and responsive density toggles.
   - Implement `printRef` and print-twin stylesheets across `page-header.tsx` and all printable documents (fee receipts, registers, admit cards, report cards).
   - Upgrade `empty-state.tsx` to support 3 distinct variants: Never-used, Filtered-empty, and Dependency-missing (with direct deep-link CTA).
   - Standardize all modal dialogs, replace native `confirm()` with `ConfirmDialog` across all 25 call sites.
3. **AOS Shell & Navigation**:
   - Addressable deep-link URLs (`/dashboard/<module>/<subroute>?window=<id>`) with browser history and bookmark support.
   - Prefetch pinned dock modules to reduce warm click-to-content latency from 1.57s to <500ms.
   - Full keyboard navigation and ARIA accessibility for dock, desktop folders, and window manager.
   - Reorganize desktop folders into 9 clean domains, merging Incidents into a single tiered app, SMS into Communications, and creating a unified AI Hub.
4. **Core Academic & Operational Pages**:
   - Page-by-page review and rewrite of Students, Academics, Attendance (keyboard P/A/L/E marking), Fees (POS collect, day closure), Exams (marks grid, tabulation), and Notices (audience targeting by class/section).
   - Fix Designer LayersPanel duplicate keys and finish/clean the Writer document editor.
   - Fix public website template null checks (e.g. `"null, Kathmandu"`).

### R4. Flutter Mobile Apps Complete Parity & UI/UX Polish
Upgrade all 5 Flutter mobile apps (`flutter_admin`, `flutter_teacher`, `flutter_student`, `flutter_parent`, `flutter_user`):
1. **Infrastructure**:
   - Configure push notification handlers and deep-linking tap callbacks.
   - Standardize design tokens, eliminate hardcoded light/white backgrounds in dialogs, and support dark mode cleanly.
   - Expand bilingual Nepali/English `t(en, ne)` localization across all user-facing screens.
2. **Role Apps**:
   - **flutter_admin**: Replace fake/static Assignments and Promote screens with real live endpoints; add global search and leave approval actions.
   - **flutter_teacher**: Implement assignment rubric/grading, mobile marks entry grid, and syllabus/content browsing.
   - **flutter_student**: Wire stateful AI Tutor session conversations, real homework file uploads, and exam runner polish.
   - **flutter_parent**: Enhance live bus tracking with socket updates, call-driver action, radius alerts, and fee receipt viewing.
   - **flutter_user**: Enhance driver trip lifecycle, stop-by-stop navigation coaching, and student pickup scanning.

## Acceptance Criteria

### Automated Verification
- [ ] Backend tests (`pytest backend/tests/`) pass cleanly with 0 regressions.
- [ ] `python backend/scripts/api_route_audit.py` passes with zero 500 errors.
- [ ] `python backend/scripts/plugin_doctor.py` passes with 42/42 valid manifests.
- [ ] `python backend/scripts/check_migration_drift.py` reports zero schema drift.
- [ ] Frontend builds without TypeScript errors (`npx tsc --noEmit`).
- [ ] Frontend Jest tests pass (`npx jest`).
- [ ] Flutter analysis (`flutter analyze`) passes without errors across all apps.

### User Experience Benchmarks
- [ ] Marking attendance for a class of 40 students takes < 60 seconds with keyboard shortcuts.
- [ ] Fee collection and receipt printing takes < 90 seconds.
- [ ] Publishing a class-specific notice takes < 45 seconds.
- [ ] Every empty state provides an actionable setup link rather than a dead-end blank screen.
- [ ] Nepali font rendering is crisp, consistent, and free of CSP console errors.
- [ ] Zero native browser `alert()` or `confirm()` calls remain in production code.
