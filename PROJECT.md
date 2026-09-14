# Project: ASchool Production UI/UX Rewrite & Full Platform Hardening

## Architecture
ASchool is an enterprise school operating platform featuring:
- **Backend API**: Flask 3.0 REST API with SQLAlchemy 2.0 ORM, PostgreSQL (host port 5433, internal 5432), Redis (port 6379), Celery background tasks, and Socket.IO real-time gateways.
- **Web Frontend**: Next.js 14 App Router with AOS (Antigravity OS) desktop windowing shell, mobile web shell, Radix UI primitives, Tailwind CSS, Lucide icons, and bilingual English/Nepali localization.
- **Mobile Suite**: 5 role-tailored Flutter 3.x apps (`flutter_admin`, `flutter_teacher`, `flutter_student`, `flutter_parent`, `flutter_user`) powered by `aschool_shared` design tokens, Riverpod state management, and Dio/Socket.IO networking.
- **E2E Testing Infrastructure**: Requirement-driven opaque-box multi-tier test framework verifying backend APIs, web workflows, mobile contracts, and UX benchmarks.

Data Flow & Domain Boundaries:
```
  [Flutter Mobile Apps]   [Next.js AOS Web Desktop / Mobile Shell]
           │                                 │
           └────────────────┬────────────────┘
                            ▼
                   [Flask REST / Socket.IO]
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         [PostgreSQL]              [Redis / Celery]
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | File Path Traversal Hardening | Strict sanitization of `..`, `\`, leading `/` in file upload and storage keys (`files.py`, `file_upload.py`) | M1 | ORIGINAL_REQUEST R1.1 |
| 2 | Benchmarking Dead Import Cleanup | Remove unused `from app.models.academic import Class` in `benchmarking.py` | M1 | ORIGINAL_REQUEST R1.2 |
| 3 | GPS Distance Formula & Role Enums | Correct Haversine formula delta-lon in `gps_processing.py` and enforce valid `user_role` Postgres enums | M1 | ORIGINAL_REQUEST R1.3 |
| 4 | AI Teacher Webhook Security | Bind service key to school and enforce `(lesson_id, event_id)` replay deduplication in `routes.py` | M1 | ORIGINAL_REQUEST R1.4 |
| 5 | FAQ Role & School Authorization | Enforce `@role_required` and `@school_required` on FAQ create/update/delete in `faqs.py` | M1 | ORIGINAL_REQUEST R1.5 |
| 6 | LMS Quiz Server-Side Scoring | Ensure quiz attempts are scored strictly server-side ignoring client payload in `lms.py` | M1 | ORIGINAL_REQUEST R1.6 |
| 7 | IEMIS PII Template Sanitization | Ensure 308-row synthetic Nepali records in `Student_Namewise_Report20260423.xlsx` | M1 | ORIGINAL_REQUEST R1.7 |
| 8 | Backend Correctness Fixes | Slot booking locks (`conferences.py`), payroll transitions (`hr_payroll.py`), WhatsApp audit logs (`whatsapp_bot.py`), Unsplash key isolation (`files.py`), and elibrary manifest blueprint | M1 | ORIGINAL_REQUEST R1.8 |
| 9 | Comprehensive Nepali Demo School Seeding | Expand `seed.py` / `seed_test_data.py` to seed Classes 1-10 (A/B/C), synthetic Nepali profiles, teachers, timetables, fee invoices, NEB grading, bus routes, library catalog | M2 | ORIGINAL_REQUEST R2.1 |
| 10 | Standard Demo Role Logins | Enable seamless login for `school_admin`, `teacher`, `student`, `parent`, `superadmin` with canonical password `changeme123` | M2 | ORIGINAL_REQUEST R2.2 |
| 11 | First-Run Setup Status API & Wizard | Build `GET /api/v1/schools/setup-status` and first-run wizard trigger when school has 0 classes | M2 | ORIGINAL_REQUEST R2.3 |
| 12 | Mukta Devanagari Typography & CSP | Fix Mukta font CSP font-src in `next.config.js` and eliminate broken CSS2 URL `@font-face` in `globals.css` | M3 | ORIGINAL_REQUEST R3.1 |
| 13 | Tabs Component Upgrade | Add pill, underline, segmented variants to `tabs.tsx` with Win11 styling and Radix keyboard nav | M3 | ORIGINAL_REQUEST R3.2 |
| 14 | Data-Table Component Upgrade | Add row grouping, sticky headers/first column, inline marks editing, print mode, responsive density in `data-table.tsx` | M3 | ORIGINAL_REQUEST R3.2 |
| 15 | PrintRef & Print-Twin Stylesheets | Implement `printRef` on `page-header.tsx` and unified print stylesheets for receipts, registers, admit cards, report cards | M3 | ORIGINAL_REQUEST R3.2 |
| 16 | Empty-State 3-Variant System | Upgrade `empty-state.tsx` with Never-used, Filtered-empty, and Dependency-missing (with deep link CTA) variants | M3 | ORIGINAL_REQUEST R3.2 |
| 17 | Modal Dialog Standardization | Replace all 16 native `alert()`/`confirm()` and 3 `prompt()` calls with `ConfirmDialog` or Sonner `toast` | M3 | ORIGINAL_REQUEST R3.2 |
| 18 | AOS Addressable Deep Links | Preserve `/dashboard/<module>/<subroute>?window=<id>` in browser history and bookmark support without wiping | M3 | ORIGINAL_REQUEST R3.3 |
| 19 | Pinned Dock Prefetching | Implement idle and hover prefetching for pinned dock items to achieve <500ms click-to-content latency | M3 | ORIGINAL_REQUEST R3.3 |
| 20 | AOS Accessibility & ARIA | Implement ARIA roles and keyboard arrow navigation for dock, desktop icons, and window manager | M3 | ORIGINAL_REQUEST R3.3 |
| 21 | Desktop Folder Reorganization | Organize desktop folders into 9 clean operational domains, merging Incidents and SMS into Communications, unified AI Hub | M3 | ORIGINAL_REQUEST R3.3 |
| 22 | Core Operational Pages Review | Polish Students, Academics, Attendance (keyboard P/A/L/E), Fees (POS collect, day closure), Exams (marks grid), Notices (class/section targeting) | M3 | ORIGINAL_REQUEST R3.4 |
| 23 | Designer & Writer Bug Fixes | Fix Designer `LayersPanel` duplicate keys; clean `writer2` / retire `.bak` editor files | M3 | ORIGINAL_REQUEST R3.4 |
| 24 | Public Site Template Null Checks | Fix school address interpolation to prevent `"null, Kathmandu"` across public templates | M3 | ORIGINAL_REQUEST R3.4 |
| 25 | First-Run Setup Wizard UI | Complete web UI wizard guided flow (Academic Year -> Classes -> Sections -> Subjects -> Fees) | M3 | ORIGINAL_REQUEST R2.3 / R3 |
| 26 | Flutter Analysis Clean Pass | Resolve all warnings, infos, and lint errors across 5 mobile apps (`flutter analyze` exit code 0) | M4 | ORIGINAL_REQUEST R4 & Acceptance |
| 27 | Mobile Push & Deep-Linking Pipeline | Configure push notification handlers and deep-linking tap callbacks across all apps | M4 | ORIGINAL_REQUEST R4.1 |
| 28 | Mobile Design Tokens & Dark Mode | Standardize design tokens, eliminate hardcoded `Colors.white` in dialogs and containers, fix KaTeX contrast | M4 | ORIGINAL_REQUEST R4.1 |
| 29 | Mobile Bilingual Localization | Expand `t(en, ne)` bilingual localization and reactive language switching across user-facing screens | M4 | ORIGINAL_REQUEST R4.1 |
| 30 | flutter_admin Parity | Wire real endpoints for Assignments, Student Promote, Global Search, and Leave Approvals | M4 | ORIGINAL_REQUEST R4.2 |
| 31 | flutter_teacher Parity | Implement assignment rubric grading, mobile marks entry grid with next-focus, and syllabus browsing | M4 | ORIGINAL_REQUEST R4.2 |
| 32 | flutter_student Parity | Wire stateful AI Tutor session conversations (`TutorEngine`), real homework file uploads, exam runner polish | M4 | ORIGINAL_REQUEST R4.2 |
| 33 | flutter_parent Parity | Live bus tracking with SocketService, clickable call-driver action, radius alerts map view, fee receipt viewer | M4 | ORIGINAL_REQUEST R4.2 |
| 34 | flutter_user Parity | Driver trip lifecycle, stop navigation coaching, and camera/barcode student pickup scanning | M4 | ORIGINAL_REQUEST R4.2 |
| 35 | E2E Test Infrastructure & Runners | Build requirement-driven opaque-box multi-tier test harness, runner scripts, and formatters | E2E Track | ORIGINAL_REQUEST Acceptance |
| 36 | Tier 1: Feature Coverage Tests | >=5 test cases per feature covering representative isolated inputs | E2E Track | ORIGINAL_REQUEST Acceptance |
| 37 | Tier 2: Boundary & Corner Tests | >=5 boundary/corner test cases per feature (extremes, empty, invalid) | E2E Track | ORIGINAL_REQUEST Acceptance |
| 38 | Tier 3: Pairwise Cross-Feature Tests | Test feature interactions across cross-module flows | E2E Track | ORIGINAL_REQUEST Acceptance |
| 39 | Tier 4: Real-World Scenarios | 5 realistic end-to-end operational scenarios (day-in-the-life school operations) | E2E Track | ORIGINAL_REQUEST Acceptance |
| 40 | UX Benchmark Validations | Verify attendance <60s, fee POS <90s, notice <45s, empty states, Nepali fonts, 0 native alerts | M5 | ORIGINAL_REQUEST Acceptance |
| 41 | Tier 5: Adversarial Coverage Hardening | White-box source code coverage gap audit and adversarial test case injection | M5 | Dual Track Tier 5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Security Hardening & Bug Fixes | Features 1, 2, 3, 4, 5, 6, 7, 8 | none | PLANNED |
| M2 | Demo Data Seeding & Setup Status API | Features 9, 10, 11 | M1 | PLANNED |
| M3 | Web UI/UX Complete Overhaul | Features 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 | M1, M2 | PLANNED |
| M4 | Flutter Mobile Apps Complete Parity | Features 26, 27, 28, 29, 30, 31, 32, 33, 34 | M1, M2 | PLANNED |
| M5 | Final Milestone: 100% E2E Pass & Adversarial Hardening | Features 40, 41 (Phase 1: Pass Tiers 1-4; Phase 2: Tier 5 Hardening) | M3, M4, E2E Track | PLANNED |

## Interface Contracts
### Backend API ↔ Web Frontend (M1/M2 ↔ M3)
- `GET /api/v1/schools/setup-status`:
  - Request: Header `X-School-ID: <id>`, Bearer token
  - Response: `{ "is_completed": bool, "stages": { "academic_year": bool, "classes": bool, "sections": bool, "subjects": bool, "fee_heads": bool }, "current_step": str }`
- `POST /api/v1/notices`:
  - Request: `{ "title": str, "content": str, "target_roles": list[str], "target_classes": list[int], "target_sections": list[int], "priority": str }`
  - Response: `{ "message": "Notice created", "notice": { "id": int, ... } }`
- `POST /api/v1/fees/collect`:
  - Request: `{ "student_id": int, "items": [{ "fee_id": int, "amount": float }], "payment_method": str, "reference": str }`
  - Response: `{ "receipt_number": str, "amount_paid": float, "date": str, "items": [...] }` (direct in-browser thermal/A4 print receipt)

### Backend API ↔ Flutter Mobile Apps (M1/M2 ↔ M4)
- `GET /api/v1/students/promote/preview?from_class_id=<id>&to_class_id=<id>`:
  - Response: `{ "eligible_students": [{ "id": int, "name": str, "current_roll": int, "gpa": float }], "ineligible_students": [...] }`
- `POST /api/v1/students/promote`:
  - Request: `{ "from_class_id": int, "to_class_id": int, "student_ids": list[int], "academic_year_id": int }`
  - Response: `{ "success": true, "promoted_count": int }`
- `POST /api/v1/hr/leave/<int:leave_id>/approve`:
  - Request: `{ "decision": "approved" | "rejected", "remarks": str }`
  - Response: `{ "success": true, "status": str }`
- `POST /api/v1/tutor/sessions`:
  - Request: `{ "student_id": int, "subject": str, "topic": str }`
  - Response: `{ "session_id": str, "initial_message": str }`
- `POST /api/v1/tutor/sessions/<session_id>/turn`:
  - Request: `{ "message": str }`
  - Response: `{ "response": str, "confidence": float, "suggested_followups": list[str] }`
- `POST /api/v1/files/upload`:
  - Request: Multipart form-data with `file`, `folder: "homework"`
  - Response: `{ "file_url": str, "storage_key": str, "size": int }`

### E2E Test Track ↔ Implementation Track
- Entry point: `scripts/run_e2e_tests.sh`
- Output: `TEST_READY.md` documenting runner, tier breakdown, test case inventory, and pass/fail semantics.

## Code Layout
- Backend Source: `backend/app/`
  - API Blueprints: `backend/app/api/v1/`
  - Models: `backend/app/models/`
  - Tasks & Background: `backend/app/tasks/`
  - Utils: `backend/app/utils/`
  - Plugins: `backend/app/plugins/`
  - Seeding Scripts: `backend/seed.py`, `backend/seed_test_data.py`
  - Verification Scripts: `backend/scripts/api_route_audit.py`, `backend/scripts/plugin_doctor.py`, `backend/scripts/check_migration_drift.py`
  - Pytest Suite: `backend/tests/`
- Web Frontend Source: `frontend/`
  - Shell & Window Manager: `frontend/components/aos/`
  - UI Design System: `frontend/components/ui/`
  - Dashboard Modules: `frontend/app/dashboard/`
  - Public School Site: `frontend/app/school/`
  - Styles & Config: `frontend/app/globals.css`, `frontend/tailwind.config.js`, `frontend/next.config.js`
  - Unit Tests: `frontend/__tests__/`
- Mobile Apps Source:
  - Shared: `aschool_shared/`
  - Admin App: `flutter_admin/`
  - Teacher App: `flutter_teacher/`
  - Student App: `flutter_student/`
  - Parent App: `flutter_parent/`
  - User/Driver App: `flutter_user/`
- Agent Workspace Metadata: `.agents/` (metadata only, NO source code)
