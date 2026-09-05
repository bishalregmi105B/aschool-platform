# C1 — All-Screens Audit (web + Flutter), 2026-09-05

Auditor: W4/C1 pass over the full surface, one day after D5 (Day-in-the-Life review,
`audits/research/_digest/D5_DAY_IN_THE_LIFE_REVIEW.md`). Method: systematic scan of every
`page.tsx` (224 files) with per-page signals (API hooks, loading, error, empty, pagination,
keyboard, native confirm), targeted file reads for the 8 daily flows, Flutter tree walk of
all 5 apps, and 5 competitor/platform fetches. **No code changes.** Every claim cites
`frontend/...` paths (all under `/home/bishal-regmi/Desktop/ASchool/`) or screen file paths.

---

## 0. State-of-play verification — D5 top findings re-checked (5 min)

| D5 finding | Status today | Evidence |
|---|---|---|
| `/student` mock page (fake "Class 10A", fake streak) | **FIXED** | `frontend/app/student/page.tsx` is now a `useQuery` client with real types (`TodayClass`, `PendingHomework`, `RecentResult`), `PageLoader`/`ErrorState`; 0 hardcoded names |
| 18 portal routes = "Coming soon" cards | **FIXED** — all 22 section routes are real | 16 dedicated `useQuery` pages (e.g. `app/parent/fees/page.tsx` → `GET /parent/outstanding-fees`, `app/student/results/page.tsx` → `GET /student/results`, `app/parent/chat/page.tsx` 7 hooks) + 6 one-line re-exports (`app/teacher/marks/page.tsx`, etc.). The 3 `[slug]` catch-alls now honest-404 (`app/student/[slug]/page.tsx`: `notFound()`). `lib/portal-route-meta.ts` deleted |
| Leave-requests UI absent | **FIXED** | `frontend/app/dashboard/attendance/leave-requests/page.tsx` — approve/reject mutations, PageHeader/Skeleton/EmptyState/StatusPill (first real consumer of the Tier-1 kit); teacher alias at `app/teacher/attendance/leave-requests/page.tsx` |
| No Tier-1 widgets | **LANDED BUT ~UNADOPTED** | Kit exists: `components/ui/{data-table,confirm-dialog,filter-bar,page-header,pagination,status-pill,skeleton,wizard}.tsx` + `components/config/form-renderer.tsx` (30.5 KB). Consumers: data-table → 1 (plugin-widgets renderers), confirm-dialog → 1 (providers), page-header → 2, status-pill → 3, skeleton → 4, empty-state → 20, **filter-bar/pagination/wizard/sheet → 0**. 30 pages still hand-roll `per_page` pagination; 18 files still call native `confirm()` |
| `window.confirm` "every delete" | **PARTLY FIXED** | Down to 18 files with native `confirm(` (grep 2026-09-05), incl. `students/page.tsx` (2×), `academics/page.tsx`, `exams/page.tsx`, `assignments/page.tsx`, `timetable/page.tsx`, `hostel`, `hr/expenses` |
| Mobile release blockers | **UNCHANGED** | 0 `.arb`, 0 `google-services.json` in all 5 apps, `setOnTapCallback` still defined-never-called (`aschool_shared/lib/services/notification_service.dart:235`), 165 `Colors.white` hits |

New since D5 (not previously reported):
- **`frontend/app/dashboard/ai-teacher/page.tsx`** (337 ln) — real AI-Teacher launch page: `POST /ai-teacher/lessons`, curriculum-section picker fed by `GET /teaching-content/sections`, per-lesson `socket_room` returned for live progress; honest `EmptyState` when nothing is published.
- **Dashboard widget system live end-to-end**: `frontend/app/dashboard/page.tsx:12,168,195-197` mounts `WidgetSlot` for `dashboard.main/wide/side`; `frontend/lib/plugin-widgets/usePluginWidgets.ts:38` fetches `GET /plugins/widgets`; generic spec renderers in `components/plugin-widgets/renderers.tsx`. Spec YAML for attendance/exams/fees verified against real endpoints (`backend/app/plugins/modules/*/widgets.yaml`).
- **MarksGridWidget with real keyboard nav exists but is unreachable** — `frontend/components/plugin-widgets/components/MarksGridWidget.tsx:128-135` implements Enter/↓/↑ column navigation; nothing links it into `/dashboard/exams/marks`, and `exams/widgets.yaml` declares it only on the `plugin_page.main` slot which no exams plugin page consumes. Meanwhile the actual daily marks page has **zero** keyboard nav. One line of wiring away from the fix D5 asked for.
- **New nav 404 introduced by widgets**: `modules/exams/widgets.yaml` `upcoming_exams` links to `/dashboard/exams/$.id` but `app/dashboard/exams/[id]/` does not exist → click-through 404.

---

## 1. WEB SCREEN CENSUS (224 `page.tsx` files: 195 `/dashboard/**` + 29 portal)

Classification signals per file: API wiring (`useQuery`/`useMutation`/`api.*`), loading
(skeleton/PageLoader), error handling (`isError`/`ErrorState`), empty states, pagination,
keyboard handlers, native `confirm()`, re-export/redirect, honest-404.

### 1.1 Totals

| Class | Count | Definition |
|---|---|---|
| **COMPLETE** | 91 | Real data + loading + error + empty states (e.g. `students/page.tsx`, `fees/collect/page.tsx`, `academics/page.tsx`, `exams/results/page.tsx`, `marketplace/page.tsx` minus error-gap) |
| **BASIC** | 102 | Works on real data but missing polish (no error boundary: 68 of these; no skeleton: 16; no pagination: 30) |
| **THIN** | 7 | Barely wired: `settings/roles` (static fake, 0 API), `profile` (read-only, 0 API, 75 ln), `ai-tools/page.tsx` (link hub, 0 API), `certificates/page.tsx` (link hub, 0 API), `notifications/page.tsx` (fetch-service, no error state, 0 react-query), `attendance/mark` (23-ln redirect), `designer/editor` (32-ln loader shim) |
| **WRAPPER/REDIR** (intentional, working) | 21 | 5 academics tabs, 4 certificates→designer redirects, `library/transactions`, `students/guardians`, `staff|teachers/bulk-upload`, 7 teacher-portal re-exports, `writer` re-export |
| **HONEST-404 catch-all** | 3 | `student/[slug]`, `parent/[slug]`, `teacher/[slug]` — all real routes now have real pages |
| **MOCK / fabricated data** | **0** | Web is now clean (was 1: student portal). Fabrication survives only in `flutter_admin` (see §3) |

Orphans (real page, no nav entry) re-confirmed via manifest grep + the 2026-09-04
inventory (`audits/research/ASCHOOL_WEB_UI_INVENTORY.md` §2): `faqs`, `ai-workbench`,
`staff`, `certificates/*` (hub 0 refs), `profile`, `plugins`, `timetable/teacher`,
`bulk-uploads/*`, `communications/*` hub+subpages, `incidents`+`incident-management/*`,
`designer/writer|writer2`, `website-builder/domain`, `parents/[id]`,
`analytics/ai-usage`, `ai-tools/letter-writer`. Nav 404s (manifest → no page) unchanged:
`ai-tools/remarks`, `analytics/weekly|at-risk|predictions`, `benchmarking/rankings|compare`,
plus the new `/dashboard/exams/$.id` widget link.

### 1.2 The 15 worst BASIC/THIN screens — what exactly is missing

Ranked by daily-use pain. "375px" = known/likely mobile breakage given the fixed
228/56px sidebar and no off-canvas nav (`components/layout/sidebar.tsx`, inventory §4).

| # | Screen | Verdict | What specifically is missing |
|---|---|---|---|
| 1 | `frontend/app/dashboard/admission/page.tsx` (602 ln) | BASIC | **0 error handling** (21 API calls, no `isError`/`ErrorState` anywhere — network failure = silent blank), **no pagination** (0 `per_page` refs — every application ever loads at once), no filter persistence, stage moves are per-row buttons with no bulk advance, no wizard despite `components/ui/wizard.tsx` existing unused. 375px: table overflows |
| 2 | `frontend/app/dashboard/settings/roles/page.tsx` (57 ln) | THIN | **Static fake**: hardcoded roles/counts, "Create Custom Role"/"Edit Permissions" buttons render but do nothing (0 API calls). D5 P0, still not fixed |
| 3 | `frontend/app/dashboard/timetable/page.tsx` (350 ln) | BASIC | 4 raw `<select>` elements (no styled Select), **hover-only delete** (no touch affordance, keyboard unreachable), day grid has no today-column highlight, no conflict highlighting, no print/export. `timetable/generate/page.tsx` still the greedy stub with `conflicts: []` placeholder (line 41 typing only) |
| 4 | `frontend/app/dashboard/profile/page.tsx` (75 ln) | THIN | Read-only: no name/avatar/password/language edit, 0 API calls. Users cannot change anything about themselves on web |
| 5 | `frontend/app/dashboard/notifications/page.tsx` (212 ln) | THIN→BASIC | Uses `fetch`-service instead of the codebase react-query stack; **no error state**; no mark-all-read keyboard; polls via service while the socket sits unused |
| 6 | `frontend/app/dashboard/attendance/page.tsx` (589 ln) | BASIC | **Silently defaults unmarked students to "present"** (lines 164, 215: `records[s.id] || "present"`), `markAll("absent")` fires with **no confirmation** (line 346) — one misclick marks a whole class absent; no keyboard marking (P/A/L keys), no undo, no "alert sent to N parents" feedback after save |
| 7 | `frontend/app/dashboard/exams/marks/page.tsx` (450 ln) | BASIC | No Enter/arrow key navigation, no Excel-paste, no undo — **while `MarksGridWidget.tsx` already implements Enter/↓ nav** and is not wired here (see §0) |
| 8 | `frontend/app/dashboard/communications/broadcast/page.tsx` (136 ln) | BASIC | No loading state, no error state on send; no audience preview ("this reaches 214 students / 180 phones"); no SMS-credit cost estimate before send |
| 9 | `frontend/app/dashboard/fees/defaulters/page.tsx` (126 ln) | BASIC | No pagination (loads all defaulters), no CSV/print export despite `fees/widgets.yaml` spec declaring `export: {csv: true, print: true}` for the same data, no class filter |
| 10 | `frontend/app/dashboard/settings/integrations/page.tsx` (402 ln) | BASIC | 4 API calls, 0 error handling; connection status has no health refresh button; keys displayed without reveal/copy affordances |
| 11 | `frontend/app/dashboard/visitors/page.tsx` (143 ln) | BASIC | No pagination, no search by phone/name; checkout flow has no native-feel confirm (uses `window.confirm` pattern family) |
| 12 | `frontend/app/dashboard/inventory/page.tsx` (156 ln) | BASIC | No pagination, no low-stock threshold alerts, no CSV export |
| 13 | `frontend/app/dashboard/analytics/ai-usage/page.tsx` (330 ln) | BASIC | Demo-ish data presentation (7 skeleton usages but 0 error states), no date-range picker, no per-teacher drill-down |
| 14 | `frontend/app/dashboard/alumni/page.tsx` (151 ln) | THIN | Minimal list, no pagination, no import path, no engagement actions |
| 15 | `frontend/app/dashboard/certificates/page.tsx` (59 ln) | THIN | Pure link hub, 0 API calls; the 4 real generators beneath it are ORPHAN (no nav) — the hub itself is unreachable from the sidebar |

Nepali-label check: nav labels are Nepali via manifest `label_nepali` (default `ne`), but
**page body copy is 100% English** on all 15 above; `NepaliCalendar`/`bs-date-input` exists
(`components/ui/bs-date-input.tsx`) but only a handful of pages use it. Loading skeletons:
only 4 files import the `Skeleton` component vs ~10 that still hand-roll `animate-pulse`.

---

## 2. HIGH-FREQUENCY FLOW AUDIT (8 daily flows)

Component trees traced through the real files. Ratings: Keyboard (0-3), Undo/safety (0-3),
Error honesty (0-3).

### 2.1 Attendance marking — `dashboard/attendance/page.tsx` (589 ln)
Tree: class/date selects → `GET /students` + `GET /attendance/list` (lines 106-141) →
status chip grid → `markAll()` (line 179) → `useMutation` bulk save.
- **Keyboard 0/3** — zero `onKeyDown`/`e.key` handlers on the whole page. P/A/L marking,
  Enter-to-next-student: none.
- **Undo/safety 1/3** — `markAll("absent")` (line 346) has **no confirmation dialog**; the
  default-present trap persists (lines 164, 215 assume `"present"` for unmarked rows);
  no undo toast; re-marking an earlier day is possible with no guard.
- **Error honesty 1/3** — `isError` handling absent; react-query defaults mask failures.
- Backend listener alert (push+SMS) fires but **the page never says so** (D5 finding, unchanged).

### 2.2 Marks entry — `dashboard/exams/marks/page.tsx` (450 ln) + `components/plugin-widgets/components/MarksGridWidget.tsx` (303 ln)
Tree: exam/class/subject selects → `GET /exams/<id>/marks` → inline-editable table with
live total/grade → single `saveMutation` (line 164).
- **Keyboard 0/3 on the live page** — no Enter/arrow navigation, no Tab-stops ordering,
  no Excel paste. **The fix already exists**: `MarksGridWidget.tsx:128-135` implements
  Enter/↓/↑ per-column movement and is declared by `modules/exams/widgets.yaml`
  (`marks_entry_grid`, `renderer: component`) — but no page consumes it on the marks route.
- **Undo/safety 1/3** — no dirty-guard (leaving the page silently discards edits), no
  after-publish lock in UI (roadmap flags marks-lock as missing backend-side too).
- **Error honesty 2/3** — students query exposes `isError`/retry (line 115); save errors
  surface via toast only.

### 2.3 Fee collection POS — `dashboard/fees/collect/page.tsx` (1,652 ln)
Tree: student search → account list → fee cards (`role="button"` + Enter/Space keyboard
select at lines 1185-1198) → method picker (cash/eSewa/Khalti/QR) → receipt PDF fetch
(lines 401-408).
- **Keyboard 1/3** — fee-card selection is keyboard-operable (good, the E206 fix), but
  there are **no global shortcuts**: no F2-collect, Ctrl+Enter submit, `/`-focus search.
  D5's "staff live here all day" still holds.
- **Undo/safety 2/3** — money mutations go through mutations + toasts; no void/refund/
  receipt-reprint undo flow; amounts are server-computed (good).
- **Error honesty 2/3** — explicit `toast.error("No receipt available")` (line 405);
  partial-payment edge states shown.

### 2.4 Homework assign/submit — `dashboard/assignments/page.tsx` (744 ln)
- Teacher assign: create dialog + attachment upload with progress — works. **But delete
  uses native `confirm()` (line 407)** — the one place the new ConfirmDialog+undo was
  needed most; no undo; instructions are a plain `Textarea` (no rich text); due date not
  BS calendar.
- Student submit on web: still **absent** — `POST /student/assignments/<id>/submit`
  exists; `app/student/homework/page.tsx` (282 ln) lists but does not offer a submit
  control (submit is app-only; Flutter submit is paste-a-URL per prior audit).

### 2.5 Notice publish — `dashboard/notices/page.tsx` (326 ln)
Create + event mutations (lines 84-97), publish toggle, bilingual body fields absent
(tiptap installed, unused here), audience targeting present. **No delete confirmation
found** on notices rows (grep: no confirm/ConfirmDialog) — destructive action is either
absent or unsafe. Keyboard 0/3, Undo 0/3, Error honesty 2/3.

### 2.6 Timetable view — `dashboard/timetable/page.tsx` (350 ln)
Raw `<select>` ×4, hover-only delete with `confirm()`, no today column, no colors,
no conflict highlight, no print. Generator: greedy stub, `conflicts: []` placeholder
(D1 re-confirmed). Keyboard 0/3, Undo 1/3, Error honesty 2/3.

### 2.7 Admissions — `dashboard/admission/page.tsx` (602 ln)
Pipeline with a clean `NEXT_STAGE` state-machine map mirroring server transitions
(lines 74-77) — genuinely good design. Missing: **0 error states** across 21 API calls,
**0 pagination**, no bulk stage-advance, no wizard (wizard.tsx exists, 0 consumers),
no document checklist per applicant. Keyboard 0/3, Undo 1/3, Error honesty 0/3.

### 2.8 Comms (SMS/broadcast/diary) — `dashboard/sms/page.tsx` (648 ln), `communications/broadcast/page.tsx` (136 ln), `communications/diary/page.tsx` (249 ln)
SMS suite is the strongest (templates, credit awareness, 9 mutation/query hooks).
Broadcast page has **no loading/error states** and no cost preview; two-way teacher↔parent
chat remains parent-app-only on web (chat-threads endpoints unconsumed on the web
teacher side). Keyboard 0/3, Undo 1/3, Error honesty 2/3.

**Flow-level flags (carried from D5, re-verified):** native `confirm(` in 18 files;
unpaginated lists on `admission`, `fees/defaulters`, `fees`, `library`, `library/overdue`,
`inventory`, `visitors`, `dismissal`, `notices`, `hr/expenses`, `health-records`,
`alumni`, `wellbeing` (grep `per_page|Pagination` = 0 hits in each); fabricated data: 0
on web, 1 in Flutter (`flutter_admin` assignments).

---

## 3. FLUTTER SCREEN AUDIT (5 apps)

Dart-file counts (find, 2026-09-05): flutter_user 9 · flutter_admin 41 (36 screens) ·
flutter_student 29 (19) · flutter_parent 25 (19) · flutter_teacher 30 (26). Plus shared
`aschool_shared/`.

### 3.1 flutter_user — THE consumer app (unified entry)
Not a content app: it is the **onboarding shell** — `splash_screen.dart`,
`onboarding_screen.dart`, `school_lookup_screen.dart`, `mode_selection_screen.dart`,
`unified_login_screen.dart`, `state/auth_flow_controller.dart` — that hands off to the
role apps after login: `widgets/role_app_host.dart:21-38` resolves role →
`student_app.ASchoolStudentApp()` / `parent_app.ASchoolParentApp()` /
`teacher_app.ASchoolTeacherApp()` (packages via path deps in `pubspec.yaml`). Admin is
deliberately not a role target here (admin = `flutter_admin`).
- `main.dart` inits `NotificationService()` at startup (FCM/OneSignal token capture) —
  but with 0 `google-services.json` the Android FCM init is dead-on-arrival.
- Missing vs web: no go_router (roadmap F confirms), no deep links, no school-site public
  surface.

### 3.2 flutter_admin (36 screens)
- **Fabricated data — release blocker (re-confirmed, unchanged since roadmap F):**
  `flutter_admin/lib/features/assignments/assignments_screen.dart` (34 ln) renders
  `ModuleScreenTemplate` with **hardcoded numbers** — "Open Tasks: 24", "Due Today: 6" —
  and fake action rows ("Create Assignment", "Bulk Publish") wired to nothing. It is the
  only screen in all 5 apps using the fabricated template.
- **Unwired screens (0 API refs):** `features/marketplace/marketplace_screen.dart`
  (319 ln of static cards), `features/academics/class_sections_screen.dart` (109),
  `class_subjects_screen.dart` (138), `features/notices/notices_screen.dart` is wired
  (`NoticesService.fetchNotices()` — real) — the four above are the thin set.
- Wired well: students, teachers, attendance overview, fees management, exams+results,
  timetable, transport, visitor, HR/payroll, health, wellbeing, incidents, emergency,
  dismissal, gamification, library, LMS, compliance, design studio (all call
  `ApiClient`/services).
- Missing vs web: no guardian detail/edit, no bulk-uploads/IEMIS, no website-builder,
  no designer/writer, no plugins/settings admin, no audit-log UI.

### 3.3 flutter_student (19 screens) — real & broad
`homework_screen`, `student_marksheet_screen`, `student_attendance_screen`,
`student_fees_screen`, `ai_tutor_screen`, `elibrary_screen`, `diary_read_screen`,
`gamification_screen`, `portfolio_screen`, `student_transport_screen`,
`student_health_screen`, `achievements`, `classmates`, `subjects`, `teachers_list`,
`guardian_details`, `profile`, plus shell. **Ahead of the web portal** in coverage
(diary, classmates, gamification have no web equivalents). Missing vs web: nothing
material — the web student portal is a thin read-only subset of this app.

### 3.4 flutter_parent (19 screens) — real & broad
`fee_payment_screen` (web has NO payment), `bus_tracking_screen`, `parent_chat_screen`
(web has NO chat), `pt_conference_screen`, `dismissal_qr_screen`, `child_wellbeing`,
`child_health`, `child_timetable`, `parent_marksheet_screen` + `results_screen`,
`homework_screen`, `parent_notices`, `parent_elibrary`, `parent_portfolio`,
`child_profile`, `child_subjects`, `teachers_screen`, shell. **The parent portal parity
story is: mobile complete, web read-mostly** (web parent fees page is explicitly
read-only pending "Phase E" per its own comment).

### 3.5 flutter_teacher (26 screens) — real & broad
`attendance_screen`, `marks_entry_screen`, `assignments_screen`, `offline_exam_screen`
+ `online_exam_screen`, `report_cards_screen`, `leave_screen` + `my_attendance_screen`,
`diary_write_screen`, `announcements`, lessons suite (`create_lesson`,
`create_topic`, `lesson_detail`, `topic_detail`), `teacher_ai_screen`, `lms_overview`,
`payroll_slips`, `student_portfolios`, `class_students`, `student_profile`,
`student_wellbeing`, `teacher_library`, `timetable`, `class_section`, `teacher_notices`.
- **Known backend gap it calls:** `GET /attendance/me` (roadmap: missing endpoint).
- Missing vs web: no ai-tools gallery parity (only `teacher_ai_screen`), no designer.

### 3.6 Cross-app release blockers (unchanged, all 5 apps)
1. **0 `.arb` files** — zero localization anywhere; Nepali users get English strings.
2. **0 `google-services.json`** — push notifications dead in every app; the backend
   listener pipeline (absent-alerts) fires into a void on Android.
3. **`setOnTapCallback` defined but never invoked** —
   `aschool_shared/lib/services/notification_service.dart:235`; tapping a notification
   routes nowhere.
4. **165 `Colors.white` hits across 56 files** — dark mode is broken-by-construction
   (theme exists in `ASchoolTheme.dark` per `role_app_host.dart` usage, but hardcoded
   whites defeat it).
5. **`flutter_admin` assignments screen ships fabricated KPIs** — the only MOCK-class
   screen left in the product.
6. No offline outbox in any app (roadmap F); flutter_user has no router (go_router
   absent), so state restoration/deep links are manual.

### 3.7 Consolidation verdict (per roadmap: student/parent/teacher folding into flutter_user)
- `flutter_user` already imports all three role apps as path packages and switches on
  role — the consolidation is *architecturally done*; what remains is (a) shipping
  `flutter_admin`'s real screens (or keeping admin desktop-only), (b) deleting the three
  standalone shells once store listings exist for the unified app, (c) the six blockers
  above, which are shared-code fixes in `aschool_shared` + per-app config.

---

## 4. UI PATTERN RESEARCH (web fetches, 2026-09-05)

Fetch results: **Linear.app ✅, MagicSchool homepage ✅, MagicSchool /magic-tools ✅,
Notion /pricing ✅, Infinite Campus /products ✅.** PowerSchool docs (help.powerschool.com,
docs.powerschool.com, powerschool.com/docs) all 404/redirect to gated portals — gradebook
details could not be fetched, so **no PowerSchool behavior is claimed below**. Veda
(vedasysnet.com) NXDOMAIN; meroschool.com TLS mismatch (cert points to smartsikshya.com) —
both skipped rather than guessed.

### 4.1 What the fetches actually showed

- **Linear** (linear.app): list-based issue UI with status columns and counts; issue
  detail with property rows (status/priority/assignee/cycle/labels); activity timeline
  with relative timestamps; sidebar with Inbox/My issues/Favorites; roadmap timeline with
  stage tags (Alpha/Beta/GA); changelog cards. (No keyboard claims on the marketing page.)
- **MagicSchool /magic-tools**: tool cards (title + one-line description); "Trending
  teacher tools" and "Top student tools" sections; **student cards deep-link with
  `?tool=<slug>` "Try it now"** straight into the app; Collections = user-curated
  shareable tool sets; login-gated full catalog ("80+ teacher tools").
- **Notion /pricing**: monthly/yearly toggle with savings note; 4 tier cards with
  audience line + inheritance framing ("Everything in Plus, and:"); "Recommended" badge;
  add-on strip; grouped feature-comparison table with "Same as X" inheritance; FAQ accordion.
- **Infinite Campus /products**: suite-based positioning; "Advanced Attendance &
  Appointments — modernize attendance taking"; "Events & Actions" triggers for automatic
  notifications; digitized Hall Pass; report-card module "around grading tasks, standards
  and courses with multilingual translation".

### 4.2 Ten patterns ASchool should adopt — each mapped to our codebase

1. **Try-it-now tool cards with deep-link params** (MagicSchool `?tool=<slug>`): the
   ai-tools hub `frontend/app/dashboard/ai-tools/page.tsx` is a static link sheet; make
   it a card gallery where each card deep-links `/dashboard/ai-tools/<tool>?prefill=…`
   and pre-fills the tool form (class, subject) from context. Pairs with the existing
   per-tool pages (lesson-plan, question-paper, …).
2. **Collections → "My toolkit"** (MagicSchool): add per-user pinned-tools strip to the
   ai-tools hub and dashboard; backend user-prefs store already exists for widget state —
   store pins the same way.
3. **Status-column worklists with counts** (Linear): the admission pipeline
   (`frontend/app/dashboard/admission/page.tsx` `NEXT_STAGE` map, lines 74-77) should
   render as Linear-style columns/kanban with per-stage counts (the page already fetches
   `pipeline: Record<string, number>` at line 63) instead of a flat table.
4. **Property-row detail panel + activity timeline** (Linear): student detail
   `frontend/app/dashboard/students/[id]/page.tsx` renders everything inline; move
   secondary facts into a right Sheet (`components/ui/sheet.tsx`, currently 0 consumers)
   and add an activity feed from the audit/event stream (backend events exist, no UI).
5. **Relative-timestamp activity feeds** (Linear "2min ago"): notices
   (`dashboard/notices/page.tsx`), diary (`communications/diary/page.tsx`) and the
   notifications page show raw dates; relative times + "new since last visit" separators.
6. **Toggle + inheritance framing for fee structures** (Notion): fee structure
   `dashboard/fees/structure/page.tsx` apply step should use a Notion-style toggle
   (monthly/annual = per-month/term billing) and "Everything in <plan>, and:" framing
   for inherited class-level fees vs student-level discounts; also add the dry-run
   preview D5 flagged.
7. **Comparison-table pattern for the pricing page** (Notion): landing has tiers but no
   `/pricing` route (roadmap F); the Notion grouped-comparison table is the model —
   plugin-gated feature rows map 1:1 to our marketplace entitlements
   (`backend/app/plugins/entitlements.py`).
8. **Suite-of-suites navigation with trigger-based automation surfaced** (Infinite
   Campus "Events & Actions"): our listeners (absent-alerts at
   `backend/app/plugins/listeners.py:69`) are invisible; an "Automations" page listing
   active triggers + last-fired time makes the backend value visible to admins.
9. **"Modernize attendance taking" quick-take row** (Infinite Campus): the attendance
   grid should support a swipe/keystone row pattern — one key or tap per student with an
   explicit "unmarked ≠ present" state; today the page defaults unmarked→present
   (`dashboard/attendance/page.tsx:164,215`).
10. **Standards-aligned report card builder** (Infinite Campus "grading tasks, standards
    and courses"): `dashboard/exams/report-cards/page.tsx` generates PDFs from marks;
    add a mapping layer (subject → NEB learning outcomes) so the generated card shows
    standard-mastery, not just totals — NEB grade table already exists
    (`GET /exams/grade-table`, `backend/app/api/v1/exams.py:205`).

---

## 5. THE PLAN — Top 20 screen-level fixes, ranked by (daily-use frequency × pain)

| # | Fix | Why this rank | File(s) |
|---|---|---|---|
| 1 | Wire `MarksGridWidget` (Enter/↓ nav, already built) into the marks page + add paste + dirty-guard | THE daily teacher flow; fix is 90% written | `frontend/app/dashboard/exams/marks/page.tsx`, `components/plugin-widgets/components/MarksGridWidget.tsx` |
| 2 | Attendance keyboard marking (P/A/L/Enter) + explicit-unmarked state + confirm on `markAll("absent")` + "alerts sent" feedback | Daily, misclick = whole-class absent alerts to parents | `frontend/app/dashboard/attendance/page.tsx:164,179,215,339-346` |
| 3 | Replace native `confirm()` in the 18 files with ConfirmDialog+undo (kit exists) | Safety + consistency across every destructive action | `students/page.tsx`, `academics/page.tsx`, `exams/page.tsx`, `assignments/page.tsx:407`, `timetable/page.tsx`, `plugins/page.tsx:237`, `students/[id]/page.tsx:146`, `hostel`, `hr/expenses`, etc. (grep `[^a-zA-Z_.]confirm\(`) |
| 4 | Global keyboard layer for fees POS (F2 collect, `/` search, Ctrl+Enter submit) + receipt reprint/void with undo | Accountants live here; keyboard 1/3 today | `frontend/app/dashboard/fees/collect/page.tsx` |
| 5 | Web homework submit for students (form + file upload on the portal) | Students currently cannot submit from web at all | `frontend/app/student/homework/page.tsx` (submit endpoint `POST /student/assignments/<id>/submit`) |
| 6 | Add pagination+filters via FilterBar/Pagination kit to the 13 unpaginated lists (admission, fees, defaulters, library ×2, inventory, visitors, dismissal, notices, hr/expenses, health-records, alumni, wellbeing) | Data grows past one screen within a term; kit has 0 consumers | files in §2 flags; kit: `components/ui/{filter-bar,pagination,data-table}.tsx` |
| 7 | Error states for the 68 pages with 0 error handling (start with the 8 daily-flow pages) | Silent blank pages on any network blip | worst: `admission/page.tsx` (21 calls, 0 error), `attendance/page.tsx`, `marketplace/page.tsx`, `files/page.tsx` |
| 8 | Roles & permissions real RBAC editor | Static fake buttons; admins believe it works | `frontend/app/dashboard/settings/roles/page.tsx` |
| 9 | Profile editing (name/avatar/password/language) | Every user, low frequency but high frustration | `frontend/app/dashboard/profile/page.tsx` |
| 10 | Exam widget link fix: `/dashboard/exams/[id]` page or retarget link to exams list | New 404 introduced by widgets.yaml | `backend/app/plugins/modules/exams/widgets.yaml` (`href: /dashboard/exams/$.id`), missing `frontend/app/dashboard/exams/[id]/` |
| 11 | Timetable modernization: styled Selects, today column, conflict highlight, non-hover delete, print | Daily view for teachers/students | `frontend/app/dashboard/timetable/page.tsx`, `timetable/teacher/page.tsx` (orphan re-export) |
| 12 | Admission kanban + bulk stage-advance + wizard wrapper | Admission season = hours saved; wizard.tsx unused | `frontend/app/dashboard/admission/page.tsx`, `components/ui/wizard.tsx` |
| 13 | Notice publish: bilingual body via tiptap (installed), delete confirm, audience preview | Weekly admin task; D5 friction stands | `frontend/app/dashboard/notices/page.tsx` |
| 14 | Broadcast cost/audience preview + loading/error states | SMS money on the line per send | `frontend/app/dashboard/communications/broadcast/page.tsx` |
| 15 | Defaulters export (CSV/print) + reminders using the fees widgets spec row_actions already defined | Spec promises it; page doesn't deliver | `frontend/app/dashboard/fees/defaulters/page.tsx` vs `backend/app/plugins/modules/fees/widgets.yaml` `defaulters_panel` |
| 16 | Nav-orphan cleanup: add manifest entries for certificates hub, staff, faqs, ai-workbench, incidents, designer writer, bulk-uploads; remove the 404 nav items (ai-tools/remarks, analytics/weekly|at-risk|predictions, benchmarking/rankings|compare) | Feature discoverability; manifests only | `backend/app/plugins/manifests/*` + inventory §2 list |
| 17 | Mobile dashboard: off-canvas sidebar + responsive tables at 375px | Every field use-case (fee collection at gate, attendance in class) | `frontend/components/layout/sidebar.tsx`, `components/layout/dashboard-layout.tsx` |
| 18 | flutter_admin: replace fabricated Assignments `ModuleScreenTemplate` with real API screen (or hide from nav until real) | Only remaining MOCK in product | `flutter_admin/lib/features/assignments/assignments_screen.dart` |
| 19 | Flutter push pipeline: add google-services.json + wire `setOnTapCallback` + start .arb extraction | Release blockers ×3 in one workstream | `aschool_shared/lib/services/notification_service.dart:235`, all 5 `*/android/app/`, `flutter_user/lib/main.dart` |
| 20 | Automations page (Listeners → visible triggers, last-fired) | Makes existing backend value discoverable; new pattern from research | new page; data: `backend/app/plugins/listeners.py:69`, events.py |

Deliberately *not* re-listed (already fixed per §0): student mock portal, 18 coming-soon
routes, leave-requests UI, missing Tier-1 kit.

— End of C1 audit. Raw per-page signal table available in-session (`/tmp/screen_scan.txt`).
