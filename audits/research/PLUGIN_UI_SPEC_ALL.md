# ASchool — Definitive Per-Plugin UI Spec (Web · Mobile · Public Site)

Date: 2026-09-04 · Owner mandate: **every published plugin gets dedicated, fully-working screens and widgets on web AND in the apps — nothing "coming soon."**

Scope: **39 published plugins** enumerated from `backend/app/plugins/modules/*/manifest.yaml` (skipping `ai_adaptive_learning` — `published: false` + `deprecated: true` — and the 11 other deprecated slugs already alias-folded per `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md`), plus the 8 platform-core manifests in `app/plugins/manifests/` (Appendix P) because they own screens too.

Builds on, and deliberately does **not** repeat: `ASCHOOL_WEB_UI_INVENTORY.md` (routes), `ASCHOOL_WEB_WIDGET_AUDIT.md` (widget kit), `ASCHOOL_FLUTTER_WIDGET_AUDIT.md`, `ASCHOOL_MOBILE_APPS_INVENTORY.md`, `ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md`, `PLUGIN_THEME_TEMPLATE_ARCHITECTURE.md`. Every widget record below is a legal `widgets.yaml` entry under that contract (§2.2 types, §2.2 slot catalogue, `$`-binding tokens).

---

## 0. Conventions (read once, applies to all 39 specs)

**Screen archetypes** — `L` list/index · `D` detail (page or drawer) · `C` create · `E` edit · `W` wizard (multi-step create) · `G` grid/workspace (dense keyboard-first) · `B` board (kanban/calendar/map) · `Q` queue (approval) · `R` report/analytics · `S` settings.

**The 7-part screen contract.** Every web screen in this spec is described with the same skeleton, so "layout" below only names the deltas:
1. `PageHeader` — breadcrumb, title + Nepali subtitle, primary action, overflow (`⋯` = export/print/import/settings).
2. `FilterBar` — URL-synced (`?class=&section=&status=&q=&from=&to=`), saved views chip row, `Clear`.
3. Primary surface — `DataTable` (server sort/paginate/column-visibility/bulk bar) unless stated otherwise.
4. `Sheet` (right drawer, 480–720 px) for row detail with `←/→` to walk rows; URL-synced `?id=`.
5. Sticky action bar (bottom) whenever the screen holds unsaved state; shows dirty count + `Save`/`Discard` + `⌘S`.
6. States — `Skeleton` (never a full-page spinner), `EmptyState` (icon + one-line why + primary CTA), `ErrorState` (retry), `LockedState` (`PluginGate` → marketplace).
7. Cross-cutting: `ConfirmDialog` for destructive (never `window.confirm`), undo toast (5 s) for deletes, `formatNPR()`/`fullName()`/`BSDateInput` everywhere, print via `PrintFrame`, export via `useExport`.

**Widget records** — `key · type · slot · endpoint · roles · size(w×h)`; types/slots from the widget contract: types `stat-group｜dashboard-card｜table-panel｜chart｜list｜form｜detail-drawer｜quick-action｜settings-section｜mobile-card｜website-section`; slots `dashboard.main｜.side｜.wide｜.actions｜plugin_page.main｜.header｜student_profile.tab｜teacher_profile.tab｜class_detail.tab｜settings.section｜plugin_settings.section｜drawer｜dialog｜mobile.home｜mobile.quick_actions｜mobile.more｜mobile.<module>.tab｜website.section｜pdf.block`. `renderer: spec` unless a `component:` token is named (canvas/map/editor-grade UI only).

**Mobile app codes** — `A` flutter_admin · `T` flutter_teacher · `St` flutter_student · `P` flutter_parent · `U` flutter_user shell (hosts T/St/P). Mobile screen counts are per the app inventory; "target" counts the union across apps.

**Endpoint marks** — `✔` exists and verified in `app/api/v1/**` or `app/plugins/modules/*/routes.py` · `⚠` exists but partial/naive · `✖` must be built (flagged with effort).

**Priority** — `P0` unblocks a "coming soon" portal or a daily flow (attendance, marks, fees, homework, notices) · `P1` high-traffic weekly · `P2` monthly/administrative · `P3` differentiator/long tail.

**Counting rule.** "Web now" counts *distinct functional* screens (redirect aliases and re-export wrappers do not count). Numbers reconcile with the route inventory's 165 REAL / 19 STUB.

---
# PART 1 — Academics, Daily Ops, Money, Communication, Learning (13 plugins)

### 1. `academics` — Academic Setup

**Manifest** (`modules/academics/manifest.yaml`): `category: core` · free (0/0) · `published` (no `published:` key → default true; not coming_soon) · `api_blueprint: app.api.v1.academics` · `models_module: app.models.academic` · no `services`/`tasks` · `depends_on: []` · `frontend.sidebar.visible_to: []` (nav comes from `CORE_ALWAYS_SLUGS`, loader.py) · emits `academics.year_started`, `academics.class_created` · `flutter.admin_app` tabs `[Classes, Sections, Subjects]`, teacher/parent/student `null`.

**Backend surface: 37 routes** (`app/api/v1/academics.py`, statically mounted — listed in `api/v1/__init__.py:17`, so the manifest pointer is intentionally skipped by the loader):

| METHOD path | purpose | role gate | note |
|---|---|---|---|
| GET `/academics/years` | list years, `paginate()` | any authed + `school_required` | ✔ |
| POST/PUT/DELETE `/academics/years[/<id>]` | year CRUD, `is_current` exclusivity | superadmin·school_admin | ✔ |
| GET/POST/PUT/DELETE `/academics/semesters[/<id>]` | semester CRUD, `?academic_year_id=`, `is_current` | admin | ⚠ **4 routes, zero UI** |
| GET/POST/PUT/DELETE `/academics/mediums[/<id>]` | medium (English/Nepali) CRUD + `is_default` | admin | ⚠ **4 routes, zero UI** |
| GET/POST/PUT/DELETE `/academics/streams[/<id>]` | stream (Science/Mgmt) CRUD, `class_ids[]`, `?class_id=` | admin | ⚠ **4 routes, zero UI** |
| GET/POST/PUT/DELETE `/academics/shifts[/<id>]` | shift CRUD with `start_time`/`end_time` | admin | ⚠ **4 routes, zero UI** |
| GET `/academics/classes` | list; teacher-scoped via `teacher_allowed_class_ids`; filters `academic_year_id`,`medium_id`,`stream_id` | any authed | ✔ |
| POST `/academics/classes` | create + optional `initial_section_name`/`_capacity` (`academics.py:376-386`) | admin | ✔ |
| PUT/DELETE `/academics/classes/<id>` | update / soft-delete | admin | ✔ |
| GET/POST `/academics/classes/<id>/sections` | list/create section (`class_teacher_id`,`medium_id`,`shift_id`) | any / admin | ✔ |
| PUT/DELETE `/academics/classes/<id>/sections/<sid>` | section update/delete | admin | ✔ |
| GET `/academics/subjects` | list; `?class_id=`,`?stream_id=`; teacher subject-scoped | any authed | ✔ |
| POST/PUT/DELETE `/academics/subjects[/<id>]` | subject CRUD incl. `has_practical`, practical full/pass marks | admin | ✔ |
| GET `/academics/classes/<id>/subjects` | subjects of a class | any authed | ✔ |
| POST `/academics/classes/<id>/subjects` | append `class_id` to `subject.class_ids` | admin | ⚠ read-modify-write on an array column → lost update under concurrency |
| GET `/academics/curriculum/frameworks` | CDC/NEB frameworks (school + platform `school_id IS NULL`) | any authed | ⚠ consumed only by AI workbench — no academics UI |
| GET `/academics/curriculum/frameworks/<id>` | framework + units + outcomes | any authed | ⚠ no UI |
| GET `/academics/subject-offerings` | NEB/SEE theory+practical marks grid by grade | any authed | ⚠ no UI (would auto-fill the subject form) |

**Web now** (5 functional screens behind 8 route files):

| route | file · lines | what it really does | verdict | concrete defects (read from code) |
|---|---|---|---|---|
| `/dashboard/academics` | `academics/page.tsx` 1119 | hand-rolled 3-tab strip (`page.tsx:204-223`, `useState`, not radix Tabs, no URL sync); Years table + BS dialog; Classes table with nested section rows; Subjects table with NEB practical columns | **REAL** | `:635` raw `confirm()` for section delete while the same file has a proper radix `RowActions` ConfirmDialog at `:160` — two confirm idioms in one file; `:319/:573/:886` full-page `PageLoader` on every tab switch (no skeleton); `:1031-1039` + `:1065-1072` raw `<select>` instead of `Select` for Type/Practical; `:346` `displayBS()` only formats, dates come back as AD; no pagination controls though `/years`,`/classes`,`/subjects` all `paginate()` — a school with >20 classes silently loses rows; error state duplicated verbatim 3× (`:310`,`:564`,`:877`); every string English-only; tab state resets on nav (`:189` derives from pathname) |
| `/dashboard/academics/class-subjects` | `class-subjects/page.tsx` 222 | class picker → assigned-subject table with inline teacher `Select`; "Quick Assign" chip row of unassigned subjects | **REAL** | `:78/:103/:134` `any` casts throughout; teacher assignment writes `teacher_id` into `subject.teacher_ids[0]` globally — **not per class**, so assigning a teacher in Class 9 changes Class 10 too (backend `_apply_subject_payload` overwrites the array); `Remove` (`:167-181`) mutates `class_ids` client-side and PUTs the whole array (lost update); no confirm on remove; no empty state for "no classes yet"; no loading skeleton (`Spinner` at `:120`) |
| `/dashboard/academics/class-teachers` | `class-teachers/page.tsx` 206 | per-section cards with class-teacher `Select`; subject-teacher list below | **REAL** | `:143-145` a literal placeholder card ("Subject teachers are assigned at class level…") occupies the section card body — dead UI; same global-teacher bug as above (`:60` `updateSubject(subjectId,{teacher_id})`); mutations fire on every `onValueChange` with no optimistic state → select snaps back until refetch; no conflict check (one teacher class-teacher of two sections) |
| `/dashboard/academics/classes` | `classes/page.tsx` 4 | `redirect("/dashboard/academics/class-sections")` | **REDIR** | manifest subitem points here → double hop to a re-export |
| `/dashboard/academics/class-sections` | `class-sections/page.tsx` 4 | `export default AcademicsPage` | **REDIR/wrapper** | lands on the **Years** tab, not Classes — `getDefaultTab` (`:114`) matches `class-sections` → "classes", but `/academics/classes` redirect makes the URL `class-sections` so it works by accident only for this one alias |
| `/dashboard/academics/subjects` | `subjects/page.tsx` 5 | re-export | **REDIR/wrapper** | `getDefaultTab` uses `endsWith("/subjects")` → OK |
| `/dashboard/academics/year`, `/years` | 5 + 5 | `redirect("/dashboard/academics")` | **REDIR** | manifest subitem "Academic Year" → lands on Years tab by luck (default) |

**Web target** — 7 screens:
1. `academics.setup` **W** (wizard, P0) — first-run "Set up your academic year" 4 steps: Year (BS range) → Mediums/Shifts/Streams → Classes+Sections matrix → Subjects from `/academics/subject-offerings?grade=`. Deltas: no FilterBar; `Stepper` + sticky footer `Back/Next/Finish`; review step shows a diff table of what will be created. Nepali: BS-only date entry via `BSDateInput`, NEB grade labels (कक्षा ९) from `name_nepali`. Empty→this wizard is the EmptyState CTA of every other academics screen.
2. `academics.years` **L+E** (P1) — DataTable (name, BS start/end, semesters count, status) · row `Sheet` with semester sub-table (**wires the 4 orphan `/semesters` routes**) · "Set current" as a single-select action with ConfirmDialog (it silently un-sets every other year). Bulk: none. Keyboard: `n` new.
3. `academics.structure` **G** (P0) — the missing screen: one grid workspace with 4 tabs URL-synced (`?tab=mediums|streams|shifts|semesters`) — **the only home for the 16 orphan CRUD routes**. Each tab = DataTable + inline create row + `is_default` radio column. Nepali labels required per row (`name_nepali` exists on all four models).
4. `academics.classes` **L/G** (P0) — replace the nested-list-in-a-cell layout with master (classes DataTable, drag `sort_order`) + detail Sheet (sections DataTable: name, capacity, class teacher, medium, shift, enrolled count). Bulk: "Add section A–D to selected classes". Keyboard `⌘S`. Empty: wizard CTA.
5. `academics.subjects` **L+E** (P1) — DataTable with column groups Theory(full/pass) · Practical(full/pass) · Type · Credit; "Import NEB grid" action calling `/academics/subject-offerings` (currently unused); per-row class chips.
6. `academics.assignments` **G** (P0, replaces class-subjects + class-teachers) — class × subject matrix, cell = teacher combobox; row header = subject, column header = section; conflict highlight when one teacher exceeds a period budget (reads `/timetable/slots`). **Blocked by ✖ MUST BUILD**: a per-(class, subject) teacher table — the current `Subject.teacher_ids` is subject-global, so a correct UI is impossible without `POST /academics/classes/<id>/subjects/<sid>/teacher` (✖ MUST BUILD, M).
7. `academics.curriculum` **D/R** (P2) — framework browser (grade → subject → units → outcomes) from the two orphan `/curriculum/*` routes; read-only; deep-links into AI lesson-plan.

**Widgets it must ship (`widgets.yaml`)**
- `academics.structure_health · stat-group · dashboard.main · /academics/classes · [school_admin] · 6×2` — classes / sections / subjects / unassigned-teacher count; empty → setup wizard.
- `academics.class_roster · table-panel · class_detail.tab · /academics/classes/$context.class_id/sections · [school_admin,teacher] · 12×4`
- `academics.subject_grid · table-panel · plugin_page.main · /academics/classes/$context.class_id/subjects · [school_admin] · 12×4`
- `academics.current_year · dashboard-card · dashboard.side · /academics/years · [school_admin] · 3×1` — name + BS range + days remaining.
- `academics.setup_checklist · quick-action · dashboard.actions · /academics/classes · [school_admin] · 3×1`
- `academics.my_classes · mobile-card · mobile.home · /teacher/my-classes · [teacher] · —`
- `academics.class_subjects · mobile-card · mobile.<academics>.tab · /academics/classes/$context.class_id/subjects · [teacher,student] · —`

**Mobile now → target**
- `A` (2 screens, read-only): `flutter_admin/lib/features/academics/class_sections_screen.dart` 109 (classes → section `Chip`s; `AcademicDataService.fetchClasses()`; no create/edit; error is a bare red `Text` at `:58`), `class_subjects_screen.dart` 138 (class dropdown → subject `ListTile`s; `:89` `initialValue` on `DropdownButtonFormField` — deprecated API; no assign action). Manifest promises tab **Subjects** + **Classes** + **Sections**; only 2 of 3 exist and neither writes.
- `T`: `flutter_teacher/lib/features/class_section/class_section_screen.dart` 661 — the strongest academics surface anywhere: class cards with student/subject counts, detail tabs Students/Overview, search, per-student attendance badge, quick-action grid. Reads `/teacher/my-classes` + `/teacher/my-students?class_id=` (note: `_teacher_classes()` ignores `class_id` — the query param is silently dropped, so every class shows **all** the teacher's students; `teacher.py:83-95` confirms). `:435` reads `student['attendance_percent']` but the serializer emits `attendance_pct` (`teacher.py:244`) → the badge never renders.
- `St`/`P`: none (manifest says `null`) ✓ correct.
- Target: `A` gains **AcademicsSetupScreen** (create class/section/subject — the admin app cannot currently create anything) + **StructureScreen** (mediums/streams/shifts). `T` keeps its screen, fixes the two bugs above. No new `St`/`P` screens.

**Public-site sections** — `academics.programs · website-section · website.section · /website/public/$school_slug (school.level/type) · public · —`. The existing `/school/[slug]/academics` page already renders builder sections + classic fallback; this record only makes the class/stream list data-driven. **Design is FIXED** — no new layout, the section reuses the current academics page markup.

**Settings (`config_schema.yaml`)** — ✖ does not exist. Should declare:
`grading.scheme` (enum: `neb_gpa|percentage|letter`, default `neb_gpa`, help "NEB GPA is the SEE/NEB default", ne "मूल्याङ्कन प्रणाली") · `structure.default_section_capacity` (int, 40, ne "कक्षा क्षमता") · `structure.section_naming` (enum `A,B,C|1,2,3|क,ख,ग`, default `A,B,C`, ne "सेक्सन नामकरण") · `year.auto_rollover` (boolean, false, help "Create next year's classes when a year ends") · `year.week_start` (enum `sunday|monday`, default `sunday`, ne "हप्ताको सुरु") · `naming.show_nepali_first` (boolean, true, ne "नेपाली नाम पहिले").

**Build order**
1. `academics.structure` grid (4 orphan CRUD groups) — **M**, P0.
2. Replace `confirm()` + add TableSkeleton + pagination on all 3 tabs — **S**, P0.
3. Per-(class,subject) teacher model + endpoint, then `academics.assignments` matrix — **L**, P0.
4. Setup wizard — **M**, P0.
5. Classes master/detail Sheet + sort_order drag — **M**, P1.
6. NEB subject-offerings import — **S**, P1.
7. `config_schema.yaml` — **S**, P1.
8. Flutter admin create/edit screens — **M**, P1.
9. Curriculum browser — **S**, P2.
10. Fix `attendance_pct` key + `class_id` scope in `/teacher/my-students` — **S**, P0 (one-line each, silently wrong today).

---

### 2. `attendance` — Attendance Management

**Manifest**: `category: core` · free · published · `api_blueprint: app.api.v1.attendance` · `models_module: app.models.attendance` · no services/tasks declared (**but `app/tasks/attendance_alerts.py` exists and is the documented consumer of `config_schema.yaml` — an undeclared task pointer**) · `depends_on: []` · emits `attendance.marked`, `attendance.absent_alert` · sidebar `visible_to: [school_admin, teacher]`, 3 subitems · flutter: A `[Overview, Reports]`, T `[Mark, My Classes, History]`, P `[Child Attendance, History]`, St `[My Attendance]`.

**Backend surface: 13 routes** (`app/api/v1/attendance.py` 732 ln; every route `@plugin_required("attendance")`):

| METHOD path | purpose | role gate | note |
|---|---|---|---|
| POST `/attendance/mark` | upsert N records; pre-validates every record before any write (`:66-115`); tombstone-aware upsert (`:124`); emits `attendance.marked` | school_admin·teacher (class-teacher scoped) | ✔ |
| POST `/attendance/submit` | alias → `mark_attendance()` for Flutter | same | ✔ |
| GET `/attendance/students/<class_id>` | roster for marking: `roll_no`,`name`,`photo_url` | admin·teacher | ✔ **web does not use it** — the web page calls `/students?class_id=` instead (`page.tsx:129`) and therefore reads `first_name/last_name/roll_number` while Flutter reads `name/roll_no` |
| GET `/attendance/student/<id>` | per-student records, `?year=&month=` | any authed | ✔ (mobile only) |
| GET `/attendance/student/<id>/summary` | totals + `percentage` (late counts as attended) | any authed | ✔ mobile only — **no web UI** |
| GET `/attendance/list` | filtered records + pagination | any authed | ✔ |
| GET `/attendance/summary` | per-class day summary incl. `not_marked` | any authed | ⚠ **`not_marked` computed server-side and never shown in web** |
| GET `/attendance/school-overview` | today/week/month % + per-class breakdown | school_admin | ✔ Flutter admin only — **no web UI** |
| POST `/attendance/teachers/mark` | staff attendance upsert | school_admin | ⚠ web staff-attendance page lives under `/dashboard/hr/staff-attendance` (hr_payroll), not attendance |
| GET `/attendance/teachers/list` | staff attendance list | school_admin | ⚠ same |
| GET `/attendance/leave-requests` | staff leave list | any authed | ✖ **no UI anywhere** |
| POST `/attendance/leave-requests` | submit leave | any authed | ✖ **no UI** (Flutter teacher posts to `/hr/leave` instead — `leave_screen.dart:176`) |
| POST `/attendance/leave-requests/<id>/approve` | approve + write-through `TeacherAttendance` rows for the range (`:614-637`) | admin·teacher | ✖ **no UI** — the only place in the codebase that stamps leave into attendance |
| POST `/attendance/leave-requests/<id>/reject` | reject with `rejection_reason` | admin·teacher | ✖ **no UI** |
| — | `GET /attendance/me` | called by `flutter_teacher/.../my_attendance_screen.dart:30` | ✖ **ENDPOINT DOES NOT EXIST** (grep of the whole backend returns nothing) → that screen always shows its error empty-state |

**Web now** (3 functional + 1 redirect):

| route | file · lines | what it really does | verdict | concrete defects |
|---|---|---|---|---|
| `/dashboard/attendance` | `attendance/page.tsx` 589 | `PluginGate` → filter card (BSDate + class + section + All-Present/All-Absent) → 5-tile summary → per-row 4-button status strip → sticky save bar; 2nd tab "Today's Summary" | **REAL** | `:160-169` **defaults every unmarked student to `present` and sets `hasChanges=true`** — reloading the page and pressing Save marks a whole class present with no user intent; `:552` view tab casts `"pending" as any` into the status union; the view tab renders the *same* `records` map, so it is the mark tab minus buttons — the `/attendance/list` history and `/student/<id>/summary` heat data are never shown; `:129` `per_page:"200"` hard cap, no pagination, no virtualization; `:94` date seeded with `new Date().toISOString()` (UTC) → after 18:15 NPT the default date is **tomorrow**; no keyboard marking (no `1-4`, no `j/k`), the page clerks/teachers use daily; no per-student remark field although `mark` accepts `remarks`; no `not_marked` chip; `:397` `grid-cols-5` fixed → unusable <640 px; three colour maps (`STATUS_OPTIONS.cls` vs `.btn`) duplicated per file; `half_day` status accepted by the API but **absent from the UI union** (`:41`) |
| `/dashboard/attendance/reports` | `reports/page.tsx` 140 | month + class filter → 4 KPI cards → per-student table; CSV export | **REAL** | `:101` native `<input type="month">` = **AD month picker while marking is BS** — the two screens disagree on calendar; `:97` raw `<select>`; `:66-87` hand-rolled CSV blob (the 413-line `lib/hooks/useExport.ts` stays dead); `:62` "Retry" = `window.location.reload()`; `:47` calls `/reports/attendance/summary` → **this page is gated by `basic_reports`, not `attendance`** (`reports.py:262`) so an attendance-only school gets 403 with no `LockedState`; no chart (recharts installed, idle); no drill-down to a student |
| `/dashboard/attendance/holidays` | `holidays/page.tsx` 204 | holiday CRUD table + dialog | **REAL but mis-owned** | `:35` `PluginGate slug="notices"` and every call hits `/notices/events` — **this page belongs to `notices`, yet the attendance manifest owns the nav entry**; `:159` raw `confirm()`; `:183` `BSDateInput` has no `onChange`, relying on its hidden input → edit dialog cannot change the date; single-day only (`end_date = start_date`, `:101`) though the model supports ranges; no calendar view; `event_type` `<select>` is raw |
| `/dashboard/attendance/mark` | `mark/page.tsx` 23 | `router.replace('/dashboard/attendance')` | **REDIR** | client-side redirect (flash of spinner) where a `next/navigation` server redirect would do |

**Web target** — 7 screens:
1. `attendance.mark` **G** (P0) — keyboard-first grid: focused row + `1`=P `2`=A `3`=L `4`=Leave `5`=½day, `j/k`/arrows, `Space` cycles, `⌘S` saves, `Esc` discards. Deltas from contract: no DataTable (custom `StatusToggleGroup` grid), sticky bar shows `N unmarked · N changed` and **refuses to default anyone to present** — unmarked stays unmarked; per-row note popover (`remarks`); week strip above the grid to jump ±7 days; biometric merge column when `biometric` installed (`soft_depends_on`). Empty: "No students in Class X — add students". Error: inline retry keeping marks in state. BS: `BSDateInput` only, `$today` resolved from NPT not UTC.
2. `attendance.day_view` **R** (P0) — replaces the fake second tab: real read of `/attendance/list` for the date with `marked_by`, time, remarks, and the `not_marked` roster split out.
3. `attendance.student_history` **D** (P0) — Sheet from any row: `HeatmapCalendar` (month × status) over `/attendance/student/<id>` + `/summary` tiles; `←/→` walks the roster. **First web consumer of two existing endpoints.**
4. `attendance.overview` **R** (P0) — school-wide: today/week/month % tiles + per-class heat bars from `/attendance/school-overview` (**web has no consumer today**); click class → mark screen prefiltered.
5. `attendance.leave_queue` **Q** (P0) — approval queue over the 4 orphan `leave-requests` routes: pending list, reason preview, bulk approve/reject with a comment, and a visible warning that approval stamps `TeacherAttendance` rows for the whole range. Also the target for `flutter_teacher`'s apply-leave flow so staff leave stops living in two subsystems.
6. `attendance.reports` **R** (P1) — BS month/range via `DateRangePicker(calendar: bs)`, class+section, per-student table with sortable `%`, `<75%` filter chip, `ChartKit` class trend, CSV+PDF via `useExport` and the existing `/reports/attendance/summary/pdf`. Must render `LockedState` when `basic_reports` is absent, or move the aggregation into `attendance` (✖ MUST BUILD `GET /attendance/report`, M) — **recommended**, since gating a core plugin's report on a different plugin is the current bug.
7. `attendance.holidays` **B** (P1) — month calendar + list, date ranges, `is_holiday` toggle; keep the data in `notices/events` but **move the nav entry to `notices`** and have attendance render it as a widget instead (avoids the cross-plugin gate mismatch).

**Widgets it must ship (`widgets.yaml`)**
- `attendance.today · stat-group · dashboard.main · /attendance/summary?date=$today&class_id=$context.class_id · [school_admin,teacher] · 6×2` — present/absent/late/not_marked/%; refresh `socket: attendance.marked`.
- `attendance.school_overview · chart · dashboard.wide · /attendance/school-overview · [school_admin] · 12×3` (`renderer: component`, `component: attendance/ClassHeatBars`).
- `attendance.unmarked_classes · list · dashboard.side · /attendance/school-overview · [school_admin,teacher] · 3×3` — classes with 0 rows today, each row a deep link to mark.
- `attendance.student_heatmap · chart · student_profile.tab · /attendance/student/$context.student_id · [school_admin,teacher,parent] · 12×4` (`component: attendance/Heatmap`).
- `attendance.student_summary · stat-group · student_profile.tab · /attendance/student/$context.student_id/summary · [all] · 6×1`
- `attendance.mark_now · quick-action · dashboard.actions|mobile.quick_actions · /attendance/students/$context.class_id · [teacher] · 3×1`
- `attendance.leave_pending · dashboard-card · dashboard.side · /attendance/leave-requests?status=pending · [school_admin] · 3×1`
- `attendance.child_month · mobile-card · mobile.home · /attendance/student/$context.student_id/summary · [parent,student] · —`
- `attendance.register · table-panel · plugin_page.main · /attendance/list · [school_admin] · 12×6` (server pagination, CSV export)
- `attendance.settings · settings-section · plugin_settings.section · — · [school_admin] · —`

**Mobile now → target**
- `T` `flutter_teacher/lib/features/attendance/attendance_screen.dart` 565 — best-in-class: class picker with `attendance_marked` "Done" badge, All-Present/All-Absent with haptics, P/A/L 36 px buttons, confirm dialog with counts, retry snackbar that explicitly says nothing was saved. Gaps read from code: `enum AttendanceStatus {present, absent, late}` (`:549`) **omits leave/half_day** the API accepts; `:24` every student defaults to `present` (same silent-default problem as web); posts no `date` → server uses `date.today()` so **back-dating is impossible**; no offline queue (acknowledged in the comment at `:193`); no per-student remark.
- `T` `leave/my_attendance_screen.dart` 102 — dead (calls the non-existent `/attendance/me`); `leave/leave_screen.dart` 241 — apply-leave posts `/hr/leave` (hr_payroll), free-text `YYYY-MM-DD` `ESchoolTextEditor` fields for dates (`:205-216`) in a BS-first product.
- `A` `flutter_admin/lib/features/attendance/attendance_overview.dart` 146 — `/attendance/school-overview` tiles + per-class progress bars. Manifest promises **Reports** tab — missing.
- `St` `flutter_student/lib/features/attendance/student_attendance_screen.dart` 471 — Records list + a real month heatmap grid with legend (`:217-332`); resolves student id via `currentStudentProvider`. Gaps: `:218` current month only, no month switcher though `_selectedMonth` exists and is never set; `:235` builds AD date keys — the grid is Gregorian in a BS product; holidays never fetched (legend has an "H" that can never appear).
- `P` `flutter_parent/lib/features/attendance/child_attendance.dart` 162 — summary row + rate bar + daily records via `parentAttendanceProvider`. Gaps: no month filter, no calendar, no absence reason.
- Target: `T` gains leave/half-day statuses, a BS date picker, back-dating, offline queue, and a working **My Attendance** (needs ✖ `GET /attendance/me`, S). `A` gains **Reports** tab + a leave-approval queue. `St` gains month navigation + BS grid + holiday overlay. `P` gains month picker + heatmap (reuse `St`'s grid via `aschool_shared`).

**Public-site sections** — `attendance.highlight · website-section · website.section · ✖ MUST BUILD GET /website/public/<slug>/attendance-highlights (S) · public · —`. Optional, opt-in, single stat ("This month's attendance: 94%"). **Public design is FIXED**: it must render inside an existing stat/notice section, never a new block.

**Settings (`config_schema.yaml`)** — ✔ exists but is 1 field (`absent_alerts_enabled`, boolean, default true; real consumer `app/tasks/attendance_alerts.py`). Target fields:
`alerts.enabled` (boolean, true, ne "दैनिक अनुपस्थिति सूचना") · `alerts.channels` (multi-enum sms/whatsapp/push with `requires_plugins`, default `[push]`) · `alerts.send_at` (cron, `0 10 * * 0-4`, help "Nepal time, Sun–Thu") · `marking.default_status` (enum `present|unmarked`, **default `unmarked`** — fixes the silent-present bug at the source, ne "पूर्वनिर्धारित स्थिति") · `marking.allow_backdate_days` (int, 7, ne "पछाडि मिति") · `marking.lock_after_hours` (int, 48) · `marking.statuses` (multi-enum present/absent/late/half_day/leave, default all) · `marking.status_colors` (color-map, the 4 hexes currently hardcoded in `page.tsx:50-77`) · `rate.count_late_as_present` (boolean, true — documents the rule the backend already applies in 3 places) · `reports.low_threshold_pct` (int, 75 — hardcoded at `reports/page.tsx:108`).

**Build order**
1. Stop defaulting to present; add `unmarked` state + `not_marked` chip — **S**, P0 (correctness bug, both web and `T`).
2. Keyboard marking (`1-4`, `j/k`, `⌘S`) + `Kbd` hints — **S**, P0.
3. `attendance.leave_queue` over the 4 orphan endpoints — **M**, P0.
4. `attendance.student_history` Sheet + `HeatmapCalendar` — **M**, P0.
5. `attendance.overview` from `school-overview` — **S**, P0.
6. NPT-correct `$today` + BS `DateRangePicker` in reports; drop `<input type=month>` — **S**, P0.
7. `GET /attendance/report` inside the plugin (or explicit `basic_reports` LockedState) — **M**, P1.
8. Config schema v2 (10 fields) + wire `status_colors`/`default_status` into the grid — **M**, P1.
9. `GET /attendance/me` + revive `my_attendance_screen` — **S**, P1.
10. Move holidays nav to `notices`, expose as widget here — **S**, P1.
11. Flutter: leave/half_day, back-date, offline queue — **M**, P1.
12. `half_day` in the web status union + colour — **S**, P1.

---

### 3. `exams` — Examination Management

**Manifest**: `category: starter` · Rs 99/mo, Rs 990/yr · published · `api_blueprint: app.api.v1.exams` · `models_module: app.models.exam` · `services: [app.services.ai.question_paper]` · `tasks: [app.tasks.report_generation]` · `depends_on: [academics]` · emits `exams.scheduled|marks_entered|result_published`, listens `attendance.marked` · sidebar 8 subitems incl. one that deliberately points outside the plugin (`/dashboard/ai-tools/question-paper`, with an in-file comment that `/exams/ai-paper` never existed) · flutter A `[Schedule, Results, Report Cards]`, T `[Enter Marks, My Exams]`, P/St → `results` folder.

**Backend surface: 21 routes** (`exams.py` 1988 ln; all `@plugin_required("exams")`). Note the plugin *emits* `marks.submitted` and `results.published` (`:834`, `:1405`) while the manifest declares `exams.marks_entered`/`exams.result_published` — **event names disagree**, so any listener wired from the manifest never fires.

| METHOD path | purpose | role gate | note |
|---|---|---|---|
| GET `/exams/grade-table` | static NEB scale from `app.utils.nepal_grading.GRADE_TABLE` | any authed | ✔ |
| GET `/exams` | list; filters `academic_year_id`,`exam_type`,`status` (CSV),`class_id`; teacher scoped via class∪subject overlap | any authed | ✔ |
| POST/PUT/DELETE `/exams[/<id>]` | exam CRUD (BS + AD date columns, `subject_ids[]`, `is_practical`) | school_admin | ✔ |
| GET `/exams/<id>` | one exam, teacher-visibility filtered | any authed | ⚠ `:522` fetches `School` into an unused local |
| GET `/exams/<id>/marks` | roster+marks join when `class_id`&`subject_id` both given, else paginated raw marks | any authed | ✔ |
| POST `/exams/<id>/marks` | bulk upsert, full pre-validation, NEB auto-grade, 409 on concurrent duplicate (`:821`) | admin·teacher | ✔ best-validated write in the repo |
| GET `/exams/<id>/subjects` | subjects for the exam (or class) with resolved theory/practical marks | any authed | ✔ |
| GET `/exams/results` | Flutter student/parent compat: report cards else derived from marks | any authed | ✔ mobile only |
| GET `/exams/<id>/results` | per-student NEB result + **competition ranks** (1,1,3 — `_assign_competition_ranks`) | any authed | ✔ |
| GET `/exams/<id>/grade-sheet` | class matrix rows×subjects, absent flags, ranks | any authed | ✔ |
| GET `/exams/<id>/marksheet/<student_id>` | one student's subject rows + report-card remarks | any authed | ✔ |
| GET `/exams/<id>/marksheet/<sid>/html` | rendered marksheet HTML via `BulkGeneratorService` | any authed | ⚠ **no UI** — results page uses `designer-marksheet` POST instead |
| POST `/exams/<id>/designer-marksheet` | bulk render via design_studio (403 when that plugin absent) | admin·teacher | ✔ |
| POST `/exams/<id>/publish` | sets `status=result_published`, emits `results.published` | school_admin | ✔ (exams hub dropdown) |
| GET `/exams/<id>/report-cards` | list report cards (+`class_id`) | any authed | ✔ |
| GET `/exams/<id>/report-cards/<sid>` | one report card | any authed | ⚠ **no UI** |
| POST `/exams/<id>/report-cards` | queue `generate_bulk_report_cards.delay(...)` | school_admin | ⚠ Celery fire-and-forget: **no task-status endpoint**, so the UI cannot know when it finished |
| GET `/exams/<id>/bulk-marksheet-pdf` | one PDF of all marksheets/grade sheets, honours template page size | admin·teacher | ✔ |
| GET `/exams/<id>/report-cards/bulk-pdf` | one PDF of all report cards (inline HTML/CSS at `:1640`) | admin·teacher | ✔ |
| GET/POST `/exams/online` | online exam list/create with recursive bleach sanitization of question payloads (`:300-337`) | any / admin·teacher | ✔ |
| GET `/exams/online/<id>` | exam + questions (**includes `correct_answer` — a student token can read the answer key**) | any authed | ⚠ security |
| POST `/exams/online/<id>/submit` | attempt scoring, window enforcement, own-attempt check | any authed | ⚠ **no attempt-list/review endpoint at all** — submitted attempts are write-only |

**Web now** (7 functional screens):

| route | file · lines | what it really does | verdict | concrete defects |
|---|---|---|---|---|
| `/dashboard/exams` | `exams/page.tsx` 811 | stats, 4 quick-link cards, filter row (session/type/class), exam table with `DropdownMenu` row actions incl. status machine + publish, NEB grade reference grid, big create/edit dialog with per-subject checkbox picker | **REAL** | `:82` **no `PluginGate`** — the only exams page without one; `:541` raw `confirm("Delete this exam?")`; `:275` type/class filters are **client-side over `per_page:200`**; `:726-739` BS dates are **free-text `Input placeholder="2082-06-15"`** while `displayExamDate` (`:173`) renders them beautifully — read is BS-aware, write is not; `:567-583` the NEB scale is hardcoded a **second time** in this file while `/exams/grade-table` and `nebGrade()` in marks/page.tsx hold two more copies (**3 divergent copies**); dialog is `max-h-[60vh] overflow-y-auto` (should be a wizard); no pagination; `:254` `(exam as any)` |
| `/dashboard/exams/marks` | `marks/page.tsx` 450 | exam/class/subject selectors → config summary → 4 stat tiles → spreadsheet table with live total/%/grade/GPA/pass icon; save-all button | **REAL** | `:63-72` `nebGrade()` **duplicates the backend scale client-side** (drift risk: backend uses `nepal_grading.GRADE_TABLE`); no keyboard flow — no Enter-to-next-cell, no arrow nav, no Excel paste (the single biggest accelerator for a 40-student subject); `:167` rows with **0 marks are dropped from the payload** so a genuine zero cannot be saved; no absent (`is_absent`) toggle even though the API accepts it; no `remarks` field; `:136-148` existing marks only populate when the array is non-empty → switching subject leaves the previous subject's values on screen; `:356` full-page `PageLoader` inside the card; no unsaved-changes guard, no autosave, no dirty count; `:118` `per_page:200` |
| `/dashboard/exams/results` | `results/page.tsx` 912 | exam/class pickers with cross-filtering, stats, results table, marks-ledger tab (grade sheet), per-student marksheet dialog, designer preview via `window.open` + bulk PDF download | **REAL** | `:231-248` builds a full HTML document string and `document.write`s it into a popup — blocked by default in many browsers (handled with a toast, but no fallback); no in-app PDF preview; no distribution histogram, no subject analysis, no one-click failure list (all three are pure client-side derivations of data already fetched); no publish/locked-state indicator although `/publish` exists and the hub can call it — **results page cannot tell you if results are published**; `:220` `any[]`; no export CSV |
| `/dashboard/exams/report-cards` | `report-cards/page.tsx` 232 | exam+class → generate-with-AI, list with rank/%/grade/GPA/remarks, per-row PDF open, bulk download | **PARTIAL** | `:81-88` `onSuccess` reads `data.data.download_url` which the endpoint **never returns** (it returns `{message, exam_id}`) → the success path is dead code and the toast lies ("generated" when a Celery task was merely queued); no polling/progress, so the table stays empty until a manual refresh; `:210` remarks truncated with no expand; no per-student regenerate; no `PluginGate` on the AI dependency (generation needs `ai_suite`) |
| `/dashboard/exams/schedule` | `schedule/page.tsx` 185 | one card per exam with a nested subject table (`/exams/<id>/subjects` per card) | **REAL but naive** | **N+1 queries** — one `useQuery` per exam card (`:97`), so 40 exams = 41 requests; no date grid/calendar despite being called "Schedule"; no per-subject exam **date/time** anywhere in the model or UI — a real exam routine (subject × date × time × room) does not exist; `:63` error state has no retry |
| `/dashboard/exams/grades` | `grades/page.tsx` 99 | read-only NEB table from `/exams/grade-table` | **REAL** | fine; but it is the 4th copy of the scale in the product and is not editable (schools with a custom scale cannot change it) |
| `/dashboard/exams/online` + `/online/questions` | 282 + 202 | online exam CRUD + AI question generator with print CSS | **REAL (young)** | `:66-76` `any[]`; datetime inputs are plain strings; no question bank, no per-question preview, **no attempts/results view** (backend has no endpoint either — ✖ MUST BUILD `GET /exams/online/<id>/attempts`, S); `correct_answer` leaks to students via `GET /exams/online/<id>` (✖ MUST FIX, S) |

**Web target** — 9 screens:
1. `exams.setup` **W** (P0) — 3-step create wizard: Basics (name + Nepali + type + session) → Subjects & marks (pull `subject-offerings`, per-subject full/pass/practical override) → Schedule (per-subject date+time+room — needs ✖ `ExamSubjectSchedule` table + `PUT /exams/<id>/schedule`, M). Replaces the 60vh dialog.
2. `exams.list` **L** (P0) — server-filtered DataTable (`?type=&class=&status=&year=`), status pills, bulk publish, ConfirmDialog delete, `Sheet` detail with subject list + progress ("marks entered for 4/7 subjects").
3. `exams.marks` **G** (P0, the flagship) — `MarksGrid`: Enter→next row, `↑↓←→`, `A`=absent sentinel, paste a 1- or 2-column Excel range, per-row remark popover, "0 is a real mark" semantics, dirty count + `⌘S` + navigation guard, virtualized >100 rows, subject tab strip showing entered/total per subject. Grades come from **one** source (`/exams/grade-table`, cached) — delete `nebGrade()`.
4. `exams.results` **R** (P0) — adds distribution histogram + subject-wise pass-rate bars (`ChartKit`), failure-list chip filter, published/locked banner driven by `exam.status`, publish/unpublish action, CSV export, in-app `PDFViewer` for marksheet/report-card blobs.
5. `exams.gradesheet` **G** (P1) — the marks-ledger tab promoted to its own printable screen with `PrintFrame` (A4 landscape), sticky first column, per-subject totals row.
6. `exams.report_cards` **Q/R** (P0) — generation becomes a job: queue → progress (needs ✖ `GET /exams/<id>/report-cards/status`, S) → per-row regenerate → bulk PDF; remarks editable inline (teacher/principal remark fields exist on `ReportCard` and no UI writes them — ✖ `PUT /exams/<id>/report-cards/<sid>`, S).
7. `exams.routine` **B** (P1) — calendar/board of exam dates per class, printable; the honest "Schedule" screen. Blocked on the per-subject schedule model above.
8. `exams.online` **L+E** (P1) — question bank tab, per-question MCQ preview, duration/window pickers with BS dates, publish gate; **attempts tab** (list, score, per-question review) once the endpoint exists.
9. `exams.grades_settings` **S** (P2) — editable grade scale per school (`config_schema` `grading.scale` as a `list` of `{min_pct, grade, gpa}`), defaulting to NEB.

**Widgets it must ship (`widgets.yaml`)**
- `exams.upcoming · list · dashboard.main · /exams?status=scheduled,ongoing · [school_admin,teacher] · 6×3`
- `exams.marks_progress · stat-group · dashboard.main · /exams/$config.exam_id/subjects · [teacher] · 6×2` — entered/total per subject.
- `exams.result_distribution · chart · plugin_page.main · /exams/$route.exam_id/results · [school_admin,teacher] · 12×3` (`component: exams/GradeHistogram`)
- `exams.student_results · table-panel · student_profile.tab · /exams/results?student_id=$context.student_id · [all] · 12×4`
- `exams.class_toppers · list · class_detail.tab · /exams/$config.exam_id/results?class_id=$context.class_id · [school_admin,teacher] · 6×3`
- `exams.enter_marks · quick-action · dashboard.actions|mobile.quick_actions · /exams · [teacher] · 3×1`
- `exams.my_results · mobile-card · mobile.home · /exams/results · [student,parent] · —`
- `exams.marksheet_block · website-section|pdf.block · pdf.block · /exams/$route.exam_id/marksheet/$context.student_id · [school_admin] · —`
- `exams.settings · settings-section · plugin_settings.section · — · [school_admin] · —`

**Mobile now → target**
- `T` `marks_entry_screen.dart` 962 — the most complete mobile screen in the repo: class/exam/subject dropdowns, per-row theory+practical editors, client-side limit validation mirroring the backend (`_theoryLimit`/`_practicalLimit`, `:202-214`), confirm dialog, `_editorVersion` cache-busting. Gaps: no keyboard next-field flow, no absent toggle, no offline queue, exams filtered to `status=ongoing,completed` then `result_published` removed client-side (`:14`) — a scheduled exam cannot be marked.
- `T` `exams/offline_exam_screen.dart` 637, `online_exam_screen.dart` 180, `report_cards_screen.dart` 345 exist; manifest promises only `[Enter Marks, My Exams]` — **the app ships 3 more exam screens than the manifest declares**, so `mobile.yaml` will need all four.
- `A` `exams/exams_screen.dart` 294 + `exams/results/exam_results_screen.dart` 659 — exam cards + BS date ranges via `NepaliFormatter.preferredDateRange`, detail bottom sheet loading `/exams/<id>/subjects`. Manifest promises `Report Cards` tab — missing on admin.
- `St` `exams/student_exams_screen.dart` 540, `results/student_results.dart` 359, `results/student_marksheet_screen.dart` 282. `P` `results/results_screen.dart` 229, `results/parent_marksheet_screen.dart` 309, `reports/child_reports_screen.dart` 396.
- Target: `T` gains keyboard/absent/offline in marks; `A` gains a Report Cards tab + publish action; `St`/`P` gain a downloadable marksheet PDF (reuse `/bulk-marksheet-pdf` scoped to one student) and an online-exam attempt screen.

**Public-site sections** — `exams.result_checker · website-section · website.section · /website/public/$school_slug/results?symbol_no=&dob= (public, rate-limited 5/h) · public · —`. Already rendered by `/school/[slug]/results`; the record only makes the checker a data-driven section. **Design FIXED.** Also `exams.routine_notice` (optional, publishes the exam date range into an existing notice section).

**Settings (`config_schema.yaml`)** — ✖ does not exist. Should declare:
`grading.scale` (list of `{min_pct:int, grade:string, gpa:number}`, default = the NEB 8 rows, ne "मूल्याङ्कन तालिका") · `grading.pass_theory_pct` (int, 35) · `grading.pass_practical_pct` (int, 40 — currently a hardcoded comment in the UI) · `marks.allow_edit_after_publish` (boolean, false) · `marks.default_full_marks` (int, 100) · `marks.default_pass_marks` (int, 35) · `report_cards.template_pack` (entity-picker kind=document) · `report_cards.ai_remarks` (boolean, true, `requires_plugins: [ai_suite]`) · `report_cards.show_attendance` (boolean, true — `ReportCard.attendance_percentage` exists and no UI shows it) · `results.publish_notifies` (multi-enum sms/whatsapp/push) · `results.rank_mode` (enum `competition|sequential`, default `competition`, help "Nepali report cards use 1,1,3").

**Build order**
1. `MarksGrid` keyboard + paste + absent + zero-is-a-mark — **M**, P0.
2. Single grade-scale source; delete the 3 duplicate copies — **S**, P0.
3. `PluginGate` on the exams hub + ConfirmDialog + BS date inputs in the create dialog — **S**, P0.
4. Report-card job status endpoint + progress UI + honest toast — **M**, P0.
5. Publish/locked state surfaced on results + publish action there — **S**, P0.
6. Strip `correct_answer` from `GET /exams/online/<id>` for student tokens — **S**, P0 (answer-key leak).
7. Server-side filters + pagination on the exams list; fix schedule N+1 — **S**, P1.
8. Result distribution + subject analysis charts — **M**, P1.
9. Exam routine model (subject × date × time × room) + wizard step + printable routine — **L**, P1.
10. Online-exam attempts endpoint + review UI — **M**, P1.
11. `config_schema.yaml` (11 fields) — **M**, P1.
12. Editable grade scale screen — **S**, P2.
13. Reconcile emitted event names with the manifest — **S**, P2.

---

### 4. `fees` — Fee Collection & Management

**Manifest**: `category: starter` · Rs 99/mo · published · `api_blueprint: app.api.v1.fees` · `models_module: app.models.fee` · `services: esewa_gateway, khalti_gateway, fonepay_gateway` · `tasks: app.tasks.fee_reminders` · `depends_on: []` · emits `fees.collected|overdue|reminder_sent` (**the code emits `fee.paid` at `fees.py:1483` — singular, different name; another manifest/code drift**) · sidebar `visible_to: [school_admin, accountant]`, 7 subitems · flutter A `[POS Collection, Fee Reports, Defaulters]`, P `[Pay Fees, Payment History, Receipts]`.

**Backend surface: 27 routes** (`fees.py` 2882 ln — the largest plugin API; all `@plugin_required("fees")`):

| METHOD path | purpose | role gate | note |
|---|---|---|---|
| GET `/fees/types` | fee types, falls back to 12 `DEFAULT_FEE_TYPES` | any authed | ✔ |
| POST/PUT/DELETE `/fees/types[/<id>]` | custom type CRUD; system types protected 403 | admin·accountant | ✔ |
| GET `/fees/payment-methods` | 7 methods with `secret_key` masked to `"***"` | any authed | ✔ |
| PUT `/fees/payment-methods` | update; `"***"` sentinel = keep stored secret (`:298`); refuses to disable all | admin·accountant | ⚠ **no admin UI** — only the read side is consumed |
| POST `/fees/payment-methods/upload-qr` | QR image upload + persist to `fee_config` | admin·accountant | ✖ **no UI** |
| GET `/fees/summary` | school aggregates + `by_class` + recent payments | any authed | ⚠ loads **every** FeeCollection into Python (`:396`) and loops classes×collections (`:499`) — O(classes × bills) |
| GET `/fees/recent` | last N receipts | admin·accountant | ✔ (Flutter admin) |
| GET `/fees/outstanding` | unpaid/partial rows, `?class_id=`,`?limit=` | admin·accountant | ✔ (Flutter admin) |
| GET/POST `/fees/structures` | structure list/create; create **auto-applies** and returns `applied_summary` | any / admin·accountant | ✔ |
| POST `/fees/structures/<id>/apply` | generate bills for the current BS cycle, idempotent via notes markers | admin·accountant | ✔ |
| DELETE `/fees/structures/<id>` | soft delete | admin·accountant | ✔ |
| POST `/fees/batch-monthly` | apply every structure (optionally one class) | admin·accountant | ✔ |
| GET/POST/PUT/DELETE `/fees/scholarships[/<id>]` | discount CRUD, percent 1-100 / fixed >0 validated | admin·accountant | ✔ |
| GET `/fees/collections` | bills with filters `student_id,class_id,section_id,search,status,from,to` | any authed | ✔ |
| GET `/fees/collections/export` | CSV with BOM, same filters, 18 columns | any authed | ✔ (reports page) |
| POST `/fees/collections` | create bill; validates paid ≤ payable | admin·accountant | ✔ |
| PUT `/fees/collections/<id>` | adjust bill; refuses total < already paid | admin·accountant | ✔ |
| POST `/fees/collections/<id>/pay` | record payment; **idempotency_key** with cross-tenant namespacing (`:1394-1402`), NPT-aware back-dating, IRD receipt series via `SELECT … FOR UPDATE` counter | admin·accountant | ✔ the most carefully written endpoint in the codebase |
| GET `/fees/collections/<id>/receipt`, `/fees/receipts/<id>` | receipt record | any authed | ✔ |
| GET `/fees/receipts/<id>/pdf` | A4 receipt PDF with PAN + optional VAT split, verification hash, point-in-time outstanding | any authed | ✔ |
| GET `/fees/students/<id>/statement/pdf` | full ledger PDF with running balance | admin·accountant | ✔ |
| POST `/fees/collections/<id>/pay-online`, `/fees/initiate-payment` | eSewa/Khalti/FonePay checkout; persists `PaymentInitiation` before redirect | any authed | ✔ |
| GET `/fees/defaulters` | grouped per student with parent phone/email | admin·accountant | ⚠ loads all collections (same O(n) issue) |
| POST `/fees/defaulters/<id>/remind` | one SMS via `send_single_fee_reminder`, honours `reminder_enabled` | admin·accountant | ✔ |
| POST `/fees/collections/<id>/refund` | Khalti-only refund + `FeeRefund` ledger row + status `refunded` | superadmin·school_admin | ✖ **no UI anywhere** |

**Web now** (7 functional screens):

| route | file · lines | what it really does | verdict | concrete defects |
|---|---|---|---|---|
| `/dashboard/fees` | `fees/page.tsx` 362 | 4 quick-action tiles, 4 KPI cards using `formatNepaliCurrency`, collection progress bar, recent payments list, per-class collection bars, overdue alert strip | **REAL** | `:53` **no `PluginGate`** (the manifest gates nav, but a direct URL renders and 403s); the only page in the app that actually uses `formatNepaliCurrency` — every sibling fee page re-implements `Rs. ${n.toLocaleString()}`; `:196` `animate-pulse` on the number only (layout still jumps); no date-range control, so "This Month" is whatever the server decided; no drill-down from a class bar |
| `/dashboard/fees/collect` | `collect/page.tsx` 1652 | POS: master list of student accounts (client-side grouped from bills) + workbench with bill create/adjust dialog, partial payments, method select, receipt PDF, statement PDF, BS month defaults | **REAL — best page in the product** | `:307` `per_page:"500"` then **client-side grouping into accounts** (`:319-340`) — no server aggregation, no virtualization, no pagination: a 2000-bill school renders 500 rows and silently truncates the rest; `:163` `formatCurrency` = `Rs. ${toLocaleString()}` (one of 33 copies); search is **un-debounced** and part of the query key → a request per keystroke; **zero keyboard shortcuts** on the screen a cashier lives in (no `/` focus, no F2 collect, no Enter-to-pay); refund endpoint unused; payment-method QR/secret admin UI absent; `paid_amount` is parsed out of a **`[partial_paid:…]` marker inside `notes`** server-side — the UI has no way to show a payment history per bill because receipts-per-collection are never listed |
| `/dashboard/fees/types` | `types/page.tsx` 297 | system vs custom type lists + CRUD dialog | **REAL** | system types have no id (defaults) so the UI must branch on `!t.id` (`:61`) — a school cannot "adopt & edit" a default; no Nepali name field though every other domain has one |
| `/dashboard/fees/structure` | `structure/page.tsx` 283 | structure table + create dialog + per-row Apply + batch-monthly dialog | **REAL** | create **immediately bills every matching student** (`create` → backend `_apply_fee_structure`) with only a toast afterwards — **no dry-run, no confirm, no undo** on a money-generating action; single fee item per structure in the UI although `fee_items[]` is an array server-side (multi-item structures are unreachable); `:44` `formatLabel` re-implements title-casing; frequency/due-day are free selects with no BS month preview |
| `/dashboard/fees/defaulters` | `defaulters/page.tsx` 126 | 3 KPI cards + table + per-row Send Reminder | **REAL** | `Rs. ${toLocaleString()}` ×3 (`:78,79,94`); no bulk remind (the loop is one-by-one), no message preview, no filter by amount/age, no CSV; `:23` returns `r.data` (envelope) then reads `data?.data` — inconsistent with every sibling; reminder result toast is good |
| `/dashboard/fees/scholarships` | `scholarships/page.tsx` 417 | scholarship CRUD | **REAL** | percent-vs-fixed is a plain select + number input (no smart NPR/% toggle), BS validity dates are text |
| `/dashboard/fees/reports` | `reports/page.tsx` 303 | period select (month/quarter/year), 4 KPIs, period card, per-class bars, recent payments, CSV export (real, filtered) + PDF export via `basic_reports` | **REAL** | `:121` raw `<select>`; `Rs. ${toLocaleString()}` again; `:141` `/reports/fees/collection/pdf` is **gated by `basic_reports`** — a fees-only school gets a silent "PDF export unavailable" toast; no chart (recharts idle); no per-fee-type breakdown |

**Web target** — 10 screens:
1. `fees.collect` **G** (P0) — keep the master/detail POS, fix the foundations: server-side `GET /fees/accounts` aggregation (✖ MUST BUILD, M) replacing the 500-row client grouping; `VirtualList`; debounced search; keyboard layer (`/` search, `↓/↑` walk accounts, `Enter` open first outstanding, `⌘Enter` collect, `⌘P` print receipt, `Esc` close); receipt toast with `Print` + `WhatsApp` actions; per-bill payment history (needs ✖ `GET /fees/collections/<id>/receipts`, S); refund action behind ConfirmDialog with typed confirmation.
2. `fees.bills` **L** (P0) — the missing plain ledger: DataTable over `/fees/collections` with all 7 server filters URL-synced, bulk "mark waived", CSV via the existing export endpoint, row `Sheet` showing base/fine/discount/net/paid/due + receipts.
3. `fees.structure` **W+L** (P0) — wizard: pick scope (class/all + academic year) → add **multiple** fee items (name, type, amount, frequency, due day) → **dry-run preview table** (`✖ POST /fees/structures/<id>/preview`, M — returns what would be billed without writing) → apply. Matrix editor (class × fee-type grid) as the list view.
4. `fees.defaulters` **L/Q** (P0) — bulk select + bulk remind with template preview and cost estimate (reuses `sms_notifications`), age buckets (0-30/31-60/60+), amount filter, CSV, per-row Sheet with the student's ledger.
5. `fees.receipts` **L** (P1) — reprint queue: all receipts with search by number/student, thermal-80mm and A4 print modes via `PrintFrame`, void/refund entry point.
6. `fees.payment_methods` **S** (P0) — the missing admin screen for the 3 orphan endpoints: per-method enable/label/mode, QR image upload (dropzone → `/payment-methods/upload-qr`), merchant code + write-only secret with "Set ••••" affordance, "at least one enabled" validation surfaced inline.
7. `fees.reports` **R** (P1) — BS `DateRangePicker`, per-fee-type and per-class `ChartKit` (collection trend line, method donut), collection-rate target line, PDF that does not depend on `basic_reports` (move the aggregation into fees or render client-side).
8. `fees.scholarships` **L+E** (P1) — percent/NPR segmented input, BS validity range picker, "applies to N future bills" preview, stacking explanation (the backend stacks additively and caps at base — `fees.py:2424-2434`; no UI says so).
9. `fees.student_ledger` **D** (P0) — student-profile tab: bills, payments, running balance, statement PDF button. Pure UI over existing endpoints.
10. `fees.online_status` **R** (P2) — `PaymentInitiation` rows: initiated vs completed, stuck checkouts. Needs ✖ `GET /fees/payment-initiations`, S.

**Widgets it must ship (`widgets.yaml`)**
- `fees.collection_today · stat-group · dashboard.main · /fees/summary · [school_admin,accountant] · 6×2` — collected / outstanding / overdue / rate.
- `fees.collection_trend · chart · dashboard.wide · /fees/collections?from=$today-30&to=$today · [school_admin,accountant] · 12×3` (`component: fees/CollectionSparkline`)
- `fees.by_class · chart · dashboard.main · /fees/summary · [school_admin] · 6×3`
- `fees.recent_payments · list · dashboard.side · /fees/recent?limit=10 · [school_admin,accountant] · 3×3`
- `fees.defaulters_top · table-panel · dashboard.wide · /fees/outstanding?limit=20 · [school_admin,accountant] · 12×4`
- `fees.student_ledger · table-panel · student_profile.tab · /fees/collections?student_id=$context.student_id · [school_admin,accountant,parent] · 12×5`
- `fees.student_due · dashboard-card · student_profile.tab · /fees/collections?student_id=$context.student_id&status=pending · [all] · 3×1`
- `fees.collect_now · quick-action · dashboard.actions · /fees/collections · [accountant,school_admin] · 3×1`
- `fees.pay_now · mobile-card · mobile.home|mobile.quick_actions · /fees/payment-methods · [parent] · —`
- `fees.receipt_block · pdf.block · pdf.block · /fees/receipts/$context.receipt_id · [school_admin,accountant] · —`
- `fees.settings · settings-section · plugin_settings.section · — · [school_admin] · —`

**Mobile now → target**
- `A` `flutter_admin/lib/features/fees/fees_management.dart` 233 — gradient summary header + 3 tabs (Overview per-class bars / Recent / Outstanding) over `/fees/summary`, `/fees/recent`, `/fees/outstanding` fetched in parallel. Gaps: manifest promises **POS Collection** — there is **no way to record a payment on mobile**; `_formatAmount` (`:135`) abbreviates to `1.2L`/`3.4K` (money must never be abbreviated on a receipt-adjacent screen — the web page fixed exactly this, E205); `Rs ${p['amount']}` unformatted; no search, no student picker.
- `P` `flutter_parent/lib/features/fees/fee_payment_screen.dart` 367 — multi-select bills, gateway buttons from `/fees/payment-methods` filtered to `mode == online`, eSewa handled via an in-app `WebView` for its form POST, Khalti/FonePay via `launchUrl`, real backend error extraction. Gaps: `/fees/initiate-payment` refuses more than one fee id (`fees.py:1778`) but the UI lets the parent select many → "Select one fee record per online payment" only surfaces after tapping; no receipt download after success; no offline "pay at school" instructions even though `instructions`/`qr_image_url` are in the payload.
- `St` `flutter_student/lib/features/fees/student_fees_screen.dart` 255 — read-only overview + invoices from `/student/fees`; `Rs. ${...}` unformatted. Manifest says student_app `null` — **the app ships a screen the manifest does not declare**.
- Target: `A` gains a real POS screen (search student → outstanding bills → collect with method + partial + receipt share). `P` gains single-bill enforcement in the UI, receipt download, and an offline-QR panel. `St` becomes declared in `mobile.yaml` or is removed.

**Public-site sections** — `fees.structure_public · website-section · website.section · ✖ MUST BUILD GET /website/public/<slug>/fee-structure (S) · public · —`. Many Nepali school sites publish a fee table; today there is no public endpoint. Opt-in per school, rendered inside the existing academics/admission section styling. **Design FIXED.**

**Settings (`config_schema.yaml`)** — ✔ exists with **2** fields (`reminder_enabled`, `reminder_overdue_days`; consumer `app/tasks/fee_reminders.py`). Target (the §3.4 reference schema in `PLUGIN_THEME_TEMPLATE_ARCHITECTURE.md` is exactly right for this plugin): groups `reminders / receipts / late_fees / gateways` with
`reminders.enabled` · `reminders.overdue_days` · `reminders.channels` (multi-enum, `requires_plugins`) · `reminders.schedule` (cron) · `reminders.escalations` (list) · `receipts.template_pack` · `receipts.prefix` (pattern `^[A-Z]{1,5}$` — today the prefix is derived from `school.slug`, `fees.py:2711`, and is not configurable) · `receipts.print_size` (enum a4/thermal_80) · `receipts.footer_note` (markdown) · `receipts.vat_percent` (number, 0 — currently read from `school.fee_config.vat_percent` with **no UI**) · `late_fees.*` (enabled/mode/amount/percent/cap/grace_days) · `gateways.enabled` + per-gateway `merchant_code`/`secret` as **`type: secret`** (today they live in `school.fee_config.payment_methods[].secret_key` and are masked on read but there is no screen to write them) · `billing.auto_generate` (boolean) + `billing.generate_day` (int 1-28, BS).

**Build order**
1. `fees.payment_methods` settings screen (QR upload + gateway credentials) — **M**, P0. Without it, online payment cannot be configured at all from the product.
2. Server-side `/fees/accounts` aggregation + virtualized POS list + debounced search — **M**, P0.
3. POS keyboard layer — **S**, P0.
4. Structure dry-run preview + multi-item structures + ConfirmDialog before billing — **M**, P0.
5. `fees.bills` ledger DataTable + `fees.student_ledger` profile tab — **M**, P0.
6. `formatNPR()` adopted across the 6 fee pages (kill 33 duplicates starting here) — **S**, P0.
7. Bulk remind + template preview on defaulters — **S**, P1.
8. Refund UI (ConfirmDialog + reason + ledger row) — **S**, P1.
9. Receipts reprint queue + thermal print layout — **M**, P1.
10. Config schema v2 (~20 fields incl. secrets) — **L**, P1.
11. Reports charts + PDF independent of `basic_reports` — **M**, P1.
12. Flutter admin POS + parent single-bill fix — **M**, P1.
13. Optimize `/fees/summary` + `/fees/defaulters` to SQL aggregates — **M**, P2 (correctness is fine; it is an O(n) scan per request).

---

<!--APPEND-->
