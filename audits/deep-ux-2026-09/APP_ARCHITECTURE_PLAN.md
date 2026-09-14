# ASchool — Role-Based App Architecture + Full UI/UX Rewrite Plan (v2)

**Date:** 2026-09-14
**Supersedes:** APP_ARCHITECTURE_PLAN.md v1 (apps rename only) — this version adds the role-based architecture for ALL roles and the per-role page rewrite
**Research base:**
- 8 competitor deep-audits (Mighty, InfixEdu, eSchool SaaS, eSchool, InstiKit, EduEx, SBT, InfixEdu addons) — role-navigation patterns extracted per product
- Full ASchool role-handling map (web routes, AOS shell, manifests, backend decorators, 5 Flutter apps)
- Platform architecture research (WordPress, Shopify, VS Code, deb/Homebrew, MSIX, Figma)

---

## Part 0 — The Core Problem (what research revealed)

**Who is this for?** Every person in a school — not just the admin. A teacher who marks attendance at 7 AM. A student checking homework at night. A parent at the school gate tracking the bus. An accountant collecting fees.

**Today's reality (verified):**

| Gap | Evidence |
|---|---|
| Login sends EVERYONE to `/dashboard` | `login/page.tsx:51,85,97` — `router.push("/dashboard")` unconditionally |
| Parent sees an EMPTY desktop | Zero manifests declare `visible_to: parent`; parents land on the AOS shell with nothing in it |
| Student sees a near-empty desktop | Only `ai_teacher` + `elibrary` allow students |
| Role-string bug: `"admin"` vs `"school_admin"` | `Dock.tsx:224-225`, `AppDrawer.tsx`, `SpotlightSearch.tsx`, `types.ts` compare against `"admin"`; backend emits `school_admin` → admin/finance icons hidden from real admins; `currentRole === "admin"` plugin bypass is dead code |
| No frontend role guards | `/teacher/*`, `/student/*`, `/parent/*` layouts: no auth check at all. `/dashboard/*`: cookie-presence only. A student deep-linking `/dashboard/fees` gets the full fees UI (APIs 403 but the page renders) |
| Teacher locked out of own apps | `timetable` manifest is school_admin-only; teachers can't open the timetable app in their shell |
| Portals are second-class | `/teacher`, `/student`, `/parent` use a plain PortalChrome OUTSIDE the AOS shell — two visual systems, reachable only by typing the URL |
| Dock defaults admin-centric | `DEFAULT_PINNED_APPS` (students, teachers, fees…) shown to every role; students see dead icons |

**What the competitors taught us (steal list):**

| From | Pattern | Why |
|---|---|---|
| eSchool 3.3.6 | **One-payload role dashboards with inline action queues** — teacher Home embeds pending leave approvals scoped to class-teacher sections, today's timetable, exams in ONE fetch | Approvals live where the teacher already is |
| InstiKit | **Permission-composed dashboards** — 13 gated widget endpoints; each role's home assembles from permissions | Our widget registry already does this halfway |
| eSchool SaaS | **Padlocked-but-visible gating** — unlicensed items render 50% opacity + lock → upgrade dialog | Entitlement checks become sales surfaces |
| EduEx | **Route-prefix-per-role** (`/student/*`, `/instructor/*`, `/admin/*` with role middleware) + server-computed `is_accessible` flags | The client never guesses access |
| InfixEdu | **Academic-year header switcher** as a first-class visible axis | Nepal schools live in BS years |
| Mighty (anti-pattern) | Teachers sharing the admin shell with hidden items → leaks admin surfaces | What we must NOT do |
| SBT | Parent bus-tracking contract (per-stop triad, call-driver FAB, radius picker) | Parent transport UX |

**The architectural verdict:** ASchool keeps the AOS shell as the ONE shell for every role (the OS metaphor finally becomes true — every user gets "their computer"), with:
- **Role-composed surfaces**: the shell, dock, desktop, Spotlight, and every app list are assembled per role from manifests (InstiKit + eSchool pattern)
- **Role-prefixed portals INSIDE the shell**: `/teacher`, `/student`, `/parent` get role guards and render within shell chrome (EduEx route-prefix pattern)
- **One source of truth for roles**: the backend manifest `visible_to` + `@role_required`; the client renders only what the server says it may see

---

## Part I — Role-Based App Architecture

### 1.1 The role model (single source of truth)

```
superadmin      → platform console (/super-admin)
school_admin    → full AOS desktop, all admin apps
accountant      → AOS desktop, finance apps (fees, hr_payroll, reports)
teacher         → AOS desktop, teaching apps (own classes scoped)
staff           → AOS desktop, ops apps (inventory, visitors)
parent          → AOS desktop, parent apps (child-scoped)
student         → AOS desktop, learning apps (self-scoped)
```

**Fixes required (P0 — the "make it work for all roles" wave):**

1. **Post-login role routing** (`login/page.tsx`): `superadmin → /super-admin`; `student → /student`; `parent → /parent`; `teacher → /teacher`; everyone else → `/dashboard`. Deep-link support: honor `?next=` param after safety check.
2. **Kill the `"admin"` role-string bug**: normalize once — `SchoolRole = "school_admin" | "accountant" | ...`, add `isAdminLike(role)` helper, fix `Dock.tsx`, `AppDrawer.tsx`, `SpotlightSearch.tsx`, `AOSDesktopShell.tsx` default.
3. **Frontend role guards everywhere**:
   - `middleware.ts`: verify JWT `role` claim for `/dashboard/*`, `/teacher/*`, `/student/*`, `/parent/*`, `/super-admin/*` (same pattern super-admin already uses — server-side re-verify in each layout via `/auth/me`)
   - Each layout gets `allowedRoles` and redirects wrong-role users to THEIR home
4. **Manifest `visible_to` completion** — the apps architecture becomes role-based at the manifest level:

| App | Today | Becomes |
|---|---|---|
| timetable | school_admin | + teacher (own timetable view) |
| attendance | school_admin, teacher | (already correct) |
| exams | school_admin, teacher | + student (results view) |
| fees | school_admin, accountant | + parent (own child fees), + student (own fees view) |
| notices | school_admin, teacher | + student, + parent |
| lms / assignments | school_admin, teacher | + student |
| health_records | school_admin | + parent (child health) |
| conferences | school_admin, teacher | + parent (booking) |
| transport (gps_tracking) | school_admin | + parent (bus tracking), + student |
| library_management | school_admin, teacher | + student (catalog + my books) |
| wellbeing | school_admin, teacher | + student, + parent (child) |
| gamification | school_admin, teacher | + student (own badges) |

   Role access is scoped server-side: a student opening the fees app sees THEIR fees, not the school ledger — the app is the same, the data scope differs.

5. **Role-aware dock/desktop defaults**: `DEFAULT_PINNED_APPS` becomes a per-role map (teacher: attendance, marks, timetable, notices, ai; student: today, homework, timetable, results, ai-tutor; parent: home, fees, bus, notices...).
6. **Widget board defaults per role** (extend `getDefaultHomeWidgets`): student home = today's timetable + pending homework + upcoming exams + notices; parent home = child cards + fees due + bus status + notices.

### 1.2 Portals inside the shell

- `/teacher`, `/student`, `/parent` layouts gain: role guard + shell chrome variant (top menu bar with role-appropriate menus, dock with role apps, Spotlight scoped to their apps)
- PortalChrome remains for the mobile web experience; desktop portal pages render inside AOS windows like every dashboard module (the `aos_embed` mechanism already exists)
- One-payload home per role (eSchool pattern): `/teacher` home = single fetch {today's periods, pending approvals, submissions due, notices}; `/student` home = {timetable today, homework due, upcoming exams, notices}; `/parent` home = {child cards, dues, bus status, notices}

### 1.3 The apps architecture (from plan v1 — unchanged, in progress)

- `app/plugins/` → `app/apps/` (✅ done: git mv + 103 files' imports rewritten)
- Identifiers: `PluginLoader→AppLoader`, `@plugin_required→@app_required`, `Plugin/SchoolPlugin→App/SchoolApp`
- DB: `plugins→apps`, `school_plugins→school_apps`, `plugin_slug→app_slug` (Alembic)
- URLs: `/api/v1/apps/*` with legacy `/plugins/*` alias
- Frontend: `lib/apps.tsx` (`AppGate`), `/dashboard/apps`, App Store vocabulary
- Every app self-contained: `apps/modules/<slug>/{manifest.yaml, routes.py, models.py, hooks.py, config_schema.yaml, widgets.yaml}`
- Lifecycle: install/upgrade/activate/deactivate/uninstall with `owns_tables` + `data_retention`
- Manifests declare `min_core_version`, roles (`visible_to`), events, pricing — marketplace renders from metadata

---

## Part II — Per-Role Page Inventory & Rewrite (every app, every inner page)

Conventions for EVERY page (from waves A–J, now enforced everywhere): AOSPageHeader (bilingual EN/नेपाली), DataTable, `useConfirm`/undoableDelete, 3-variant empty states, URL-backed filters, print twins where paper is used, mobile-responsive at 375px.

### 2.1 Student experience (`/student/*` — 9 pages today → 12)

| Page | Rewrite |
|---|---|
| Today (home) | One-payload: today's periods, homework due, upcoming exams, notices, AI tutor CTA |
| Timetable | Week grid + "today" strip; print twin |
| Homework | Due/submitted/graded tabs, file attach (fix URL-paste), submission timeline |
| Results | Exam picker → subject cards with grades; progress vs last exam |
| Exams (NEW) | Online exam runner (productionize the staff-preview runner: palette, wakelock, auto-submit) |
| Library | Catalog search + my issues + overdue |
| E-Library | Reader + reading progress |
| LMS | Courses → chapters → topics with `is_accessible` lock icons (EduEx pattern) |
| AI Tutor | Session-based conversations (wire existing backend), history |
| Fees (NEW) | My fees, receipts download |
| Notices (NEW) | Notice feed targeted to my class |
| Profile | Own profile, password change, MFA |

### 2.2 Teacher experience (`/teacher/*` — 9 pages today → 12)

| Page | Rewrite |
|---|---|
| Today (home) | One-payload: my periods today, pending leave approvals INLINE (eSchool §4.31), submissions to grade, notices |
| My Classes | Class cards → roster, attendance shortcut, marks shortcut |
| Attendance | Keyboard marking (port admin quality), 5 statuses, print register |
| Marks | Grid with keyboard nav, component columns (CQ/practical), autosave |
| Assignments | Authoring + grading inbox with rubric |
| Timetable | My week view (now also visible as AOS app) + print |
| Lesson Plans | Planner + AI assist |
| Teaching Content | Chapter content corpus (subject → chapter → content) |
| Notices | Create for MY classes (class multi-select targeting) |
| Leave | My leave requests + approvals if class teacher |
| AI Tools | Teacher-tailored catalog (lesson-plan first) |
| Me | Profile, payslips, MFA |

### 2.3 Parent experience (`/parent/*` — 11 pages today → 11)

| Page | Rewrite |
|---|---|
| Home | Child switcher FIRST (Mighty pattern), per-child today card: attendance chip, dues, bus status |
| Attendance | Per-child calendar + monthly %, absence reasons |
| Results | Per-child results with trend |
| Fees | Per-child dues, pay online (eSewa/Khalti), receipts, payment history timeline |
| Bus | Live tracking (socket + fallback banner), call-driver FAB, radius picker (SBT patterns) |
| Notices | Feed for my children's classes |
| Homework monitor | What's due, what's late, per child |
| Conferences | Booking flow (wire parent side) |
| Health | Child health records |
| Wellbeing | Child mood/surveys |
| Profile | Multi-child management, MFA |

### 2.4 Admin/staff dashboard (`/dashboard/*` — ~60 modules, waves A–J done, remaining:)

1. `admission/**` orphan module rewrite (bilingual, DataTable, confirm-on-convert)
2. AI Hub registry wiring (`AOSRouteTable` `ai` keys)
3. Wave A registry cleanup (stale academics/attendance keys + manifest subroutes)
4. Attendance print twin (unblocked by printRef)
5. Dead-kit adoption: `ui/page-header` print (attendance, fees receipt, tabulation), `money-phone` (fees/collect, hr payroll), `field-array` (guardians, fee lines)
6. Straggler tables → DataTable: `settings/custom-fields`, `analytics/ai-usage`, `admission/seats`
7. Bilingual sweep (~90 pages: ai-tools template covers 25 at once; transport 8; library 8; certificates 7; settings 8; portals via I18nProvider mount)
8. MFA TOTP login challenge screen
9. App Store UX: store detail, tier-aware upgrade gate, trial banner
10. Backend UI-blockers: notices `target_class_ids` persistence, `export_emis_data` caller, `/iemis/validate` error_list

### 2.5 Super admin (`/super-admin/*`)

Console built (overview/tenants/plugins tabs). Remaining: billing/dunning queue, provisioning jobs, platform settings — Wave 4.

### 2.6 Mobile (5 Flutter apps — aligns with web role architecture)

- Role bootstrap already exists (`/mobile/bootstrap` with per-role dashboard/visibility) — extend with the same manifest role sets so web and mobile agree
- Student app: wire AI tutor sessions, real homework attachments
- Teacher app: marks grid quality, approval actions
- Parent app: bus socket + SBT patterns, hostel view
- All: push config (google-services.json), i18n adoption, `ESchool*`→`ASchool*` rename

---

## Part III — Execution Waves (updated)

### Wave R1 — Role fixes (P0, days) — "make it work for every role"
1. Post-login role routing + `?next=` deep-links
2. `"admin"`→`"school_admin"` normalization everywhere (shell, dock, drawer, spotlight, types)
3. Frontend role guards: middleware + per-layout `allowedRoles` (all 5 route families)
4. Manifest `visible_to` completion (table in §1.1)
5. Per-role dock/desktop defaults + widget defaults
6. Teacher timetable app access fix
7. Student/parent-appropriate 403 page (not a blank render)

### Wave R2 — Apps rename completion (in progress)
- ✅ `app/apps/` moved, imports rewritten (103 files)
- Identifiers, DB migration, `/api/v1/apps/*` + legacy alias, frontend `lib/apps.tsx`/`AppGate`/`/dashboard/apps`, Flutter shared-package rename
- Gate: boot + 42 modules registered + both URL prefixes respond + tsc/eslint clean + demo login works

### Wave R3 — Self-containment
- Routes into `apps/modules/<slug>/routes.py` (28 apps), models for single-owner domains, `owns_tables` complete, `min_core_version`, lifecycle signatures, uninstall data policy

### Wave R4 — Portal page rewrites (§2.1–2.3)
- Student 12 pages, teacher 12 pages, parent 11 pages — per the tables above
- Portals inside shell chrome; one-payload homes; I18nProvider on portal layouts

### Wave R5 — Admin dashboard completion (§2.4 items 1–10)

### Wave R6 — App Store + marketplace UX + super-admin expansion

### Wave R7 — Mobile alignment (§2.6)

---

## Verification gates (every wave)

```bash
# Role matrix smoke (automated, per wave):
for role in school_admin accountant teacher staff parent student; do
  login-as $role → assert landing route → assert sidebar app set →
  deep-link a forbidden module → assert redirect (not render)
done
# + app boot, registry sync, tsc, eslint, jest, pytest, demo-tenant walkthrough
```

## Anti-goals

1. No per-role code forks — one shell, role-composed from manifests (Mighty's leaked-shell anti-pattern)
2. No client-side-only gating — every hidden page is also backend-`@role_required` (EduEx lesson)
3. No slug renames, no micro-frontends, no behavior change in the rename wave
4. Students/parents never see school-wide data — same apps, scoped queries

---

## Part IV — Mobile Deep Audit & Rewrite Plan (Wave R7 detail)

**Audit base:** 134 screen files across 5 apps (admin 38, teacher 28, student 32, parent 29, user 7) + aschool_shared (89 dart files, 42 widgets).

### Findings per app

**flutter_admin — weakest app:**
- 124 `setState` calls, ZERO shared providers — every screen hand-rolls loading/error/data
- `assignments_screen.dart` is 100% fake: hardcoded "24 Open / 6 Due Today", dead buttons
- `promote_screen.dart` ignores backend promote endpoints (GET-only, no action)
- `reports_hub` dumps raw JSON; certificates list templates with no issuance; dismissal QR scanner "Coming soon"; wellbeing "Survey creation coming soon"
- Two AppBar regimes (shell vs local), drawer has ~45 items + duplicated Operations section
- i18n: ~11 strings total

**flutter_teacher — strongest:**
- Provider-driven dashboard/marks; coach-mark onboarding
- Marks grid (962 lines) has NO keyboard/FocusNode navigation
- Leave screen is apply-only — approvals are web-only
- 2 dead AI cards ("No backend AI tool yet")

**flutter_student — good with dead ends:**
- Best dashboard (provider + shimmer + retry); exam runner is excellent (palette/autosave/anti-cheat)
- AI tutor keeps chat in RAM — no sessions/history (backend endpoints exist)
- Homework attach is URL-paste (FileUploadService exists but unused here)
- Banner tap is a no-op; transport is a static route list; hand-rolled drawer

**flutter_parent — good core, transport polling:**
- Bus tracking polls every 15s while SocketService exists and chat already uses it
- Fees flow deepest in fleet (eSewa WebView → verify); NO hostel view at all
- Dismissal QR is display-only

**flutter_user — clean entry flow; driver mode solid MVP but no audio coaching; driver entry is a FAB overlay on the teacher app**

**Cross-cutting:**
- **Zero push**: no google-services.json in any app; OneSignal only if dart-define set — otherwise silent
- **`AsyncScreenScaffold` does not exist** — the loading/error/empty trio is re-implemented ~90+ times (the single biggest duplication tax)
- Theme conflict: light = steel blue #22577A, dark = green #57CC99 (seeds from accent) vs brand forest-green
- Nepali toggle is cosmetic fleet-wide (admin ~11 strings, others zero)
- Shared providers used ONLY by student app; admin/teacher use none
- 15+ dead shared widgets (PaginatedList, CalendarWidget, AttachmentViewer, FormFields, AiFormAssistSheet...)

### Mobile rewrite waves (R7)

**R7.1 — Platform basics (blockers):**
1. Create `AsyncScreenScaffold` in aschool_shared — kills the 90× trio duplication
2. Push config: google-services.json per app + ONESIGNAL_APP_ID build config; wire setOnTapCallback in all 5 main.darts
3. Theme unification to forest-green brand (light+dark from one seed)
4. ESchool*→ASchool* widget rename; fix ESchoolDialog hardcoded white

**R7.2 — Admin app honesty (P0 product defects):**
1. Assignments screen → real API (create + submissions)
2. Promote screen → wire GET /students/promote/preview + POST /students/promote
3. Reports hub → report catalog with downloads
4. Migrate the worst 10 setState screens to providers

**R7.3 — Student app:**
1. AI tutor sessions (create/continue/close + history — backend exists)
2. Homework: real file picker via FileUploadService
3. Wire banner taps; live transport view

**R7.4 — Parent app:**
1. Bus tracking: socket `bus_location` event (SocketService already in use for chat)
2. Hostel view (child room, warden contact, monthly fee)
3. Dismissal scan-side flow

**R7.5 — Teacher app:**
1. Marks grid keyboard navigation (FocusNode traversal)
2. Leave approve/reject actions (class-teacher scoped)

**R7.6 — i18n adoption:** extend t(en, ne) from ~11 strings to all screens; the language toggle must actually change the UI

**R7.7 — Driver (flutter_user):** audio coaching state machine at stops; promote driver mode from FAB overlay to first-class transport home
