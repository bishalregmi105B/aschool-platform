# wave-E — Operations rewrite (transport / hostel / library / visitors / incidents / inventory / dismissal / conferences / certificates)

Date: 2026-09-14. Agent: wave-E. Exclusive scope: `frontend/app/dashboard/transport/**`,
`hostel/**`, `library/**` (not elibrary), `visitors/**`, `incidents/**`, `incident-management/**`,
`inventory/**`, `dismissal/**`, `conferences/**`, `certificates/**`. New pages added INSIDE these
dirs: `transport/prefs`, `library/acquisition` (+ 2 additive `transport__prefs` /
`library__acquisition` lines in `components/aos/AOSRouteTable.tsx` — required for the shell to
resolve them; no other shared file touched).

## 0. Research method

The sandbox exposes no WebSearch tool and search engines refuse `WebFetch` (bot checks recorded in
the session), so per-page research notes below are drawn from the repo's own benchmark corpus —
`schoolbustrack-v2.3.md` (driver UX steal-list: radius picker, call-FAB + missing-number toast,
coaching state machine, server geofence-on-board, seat gate), `infixedu-v9.4.0.md` /
`mighty-school-pro-v1.6.md` / `instikit-v5.5.0.md` (library issue/return/fine/print twins, hostel
rooms/room-members/meal structure, discipline-incident field contract) and
`IMPROVEMENT_PLAN.md` §3.7 / §4.2 / §4.3 (3, 9, 14) / Parts 31–34.

## 1. TRANSPORT (11 pp + 1 new) — S-A4 flows verified intact (same endpoints, same mutations)

- **monitor** (`transport/monitor/page.tsx`) — *Research: SBT running-trip screen = live map + GPS
  stream + coach payload; ops consoles need an explicit feed-health line.* Added: `win11-statusbar`
  (live/offline dot from query error + isFetching, last-data time, newest fleet GPS fix, running
  count); run lifecycle `StatusTimeline` (scheduled→running/cancelled→completed) atop the instance
  drawer; **Call-driver FAB-style action** when the run's `driver_id` resolves to a user with a
  phone (`GET /users/<id>` lazily) and a `win11-infobar warning` missing-number hint when the
  driver exists but has no phone (SBT parity). Cards + polling (20 s) untouched.
- **prefs — NEW** (`transport/prefs/page.tsx`) — *Research: SBT notifications screen = per-student
  7-toggle matrix + radius picker; radius choices Off/100/300/1 km/2 km; backend clamps 50–2000 m.*
  Row per transport-allocated student (from `/transport/stops.student_ids` × `/students`), merged
  with `GET/PUT /transport/notification-prefs`; dialog = two 5-option radius `ListView`s (Off writes
  `notify_near_*=false`) + Advanced ▾ collapse for the other 5 event switches (7 visible ≤7-field).
- **trips** — *Research: trip lifecycle is instance-level; schedule editors keep optional fields
  behind a disclosure.* Added row-click A2 sheet: today's runs each render a lifecycle
  `StatusTimeline` (`/transport/instances` today filtered by `trip_id`) + schedule-chip summary;
  dialog now collapses Bus/Driver/Name/Effective behind an Advanced ▾ toggle (≤7 visible fields);
  existing useConfirm flows kept.
- **hub** — *Research: A5 = launcher + top task, never a dashboard-of-everything.* Hand-rolled
  button strip replaced with fixed `Tabs` (win11 classes) + count badges, `?tab=` deep-link via
  `useAOSRouteParams`/`useAOSRouterNavigate` (shell-safe, per wave-A convention); QuickLinks gains
  **Geofence Alerts** + reordered (Map/Monitor/Trips first); route edit dialog (was create-only);
  delete → `undoableDelete`; bilingual `t()` chrome.
- **stops / pickup-points** — *Research: stops are meaningless without a route — name the
  prerequisite.* Silent direct delete → `undoableDelete`; zero-routes case now renders
  `DependencyMissingEmptyState` deep-linking `/dashboard/transport/routes`.
- **routes** — confirm-delete → `undoableDelete` (no confirm needed for restorable ops).
- **allocation** — *Research: SBT gates seat availability at stop choice; big lists need debounced
  search.* `useDebounced` search; seat-availability warning `infobar` when selected-stop allocation
  exceeds the route fleet's summed capacity (client heuristic — flagged below); dependency empty
  state when no routes exist.
- **buses/logs/map/reports** — audited; already kit-conformant (DataTable/StatusChip/empty-states;
  map = A6 with socket + poll fallback, **kept behaviorally identical** per rule 5).

## 2. INCIDENTS + INCIDENT-MANAGEMENT — UI merge without route surgery

- `/dashboard/incidents` is now the **single hub**: Tabs [Reports | Workflow & Escalation (badge =
  open escalations)], `?tab=workflow` deep-linkable. Reports = the old CRUD (upgraded: severity
  StatusChips via explicit map, `EntityPicker` replaces the raw student-UUID input, bilingual).
  Workflow tab is independently `PluginGate`d on `incident_management` (non-payers see the install
  gate, Reports keep working) and embeds: (a) an **Escalation pipeline** panel — per-case
  `StatusTimeline` (Reported→Escalated→Conference→Resolved) + Schedule-conference/Resolve actions
  and an "Open full page" link; (b) the **same component** the active-cases route renders:
  `ActiveCasesContent` exported from a colocated `_ActiveCases.tsx` (page.tsx keeps default-only
  exports to satisfy Next's typed-routes constraint) and rendered `bare` (no window chrome).
- All four `/dashboard/incident-management/*` routes kept and working; `escalations` also gained
  nothing destructive. Federation only.

## 3. HOSTEL (1 pp) — 365-L rebuild

- *Research: InfixEdu/InstiKit hostel = rooms + members + validation (InstiKit's is unvalidated —
  do better); occupancy is the number wardens scan for.* Rebuilt as Tabs **[Rooms | Occupants
  (badge) | Rules]**: per-hostel **occupancy meters** (clickable filter cards with color-threshold
  bars) + `MetricCard` band (occupancy %, hostels, available beds, residents); room **card grid**
  with per-room bed meters; Occupants = DataTable with `useConfirm` checkout; **Rules** tab =
  the server-enforced contract documented bilingually (no rules API exists — see flags).
- **Allocate dialog**: `EntityPicker` student search that *hides already-allocated students*
  (duplicate-student client guard), free-rooms-only `AdvancedSelect` (capacity gate), `BSDateInput`
  check-in, submit blocked on duplicate. Endpoints unchanged.

## 4. LIBRARY (10 pp + 1 new)

- *Research: InfixEdu library = issue/return/fine/print-register twins; circulation desks are
  patron-first (find the borrower, then act on their loans); InstiKit posts fines onto the fee
  ledger (aging matters).*
- **hub** — A5 launcher: `QuickLinks` grid to all v2 surfaces (+ Acquisition), KPI band, hand-rolled
  strip → `Tabs` (Books | Issues, badge counts, `?tab=issues` contract preserved for
  `library__transactions` redirect). **Print-register button** on the Issues tab using the wave-C
  `PrintStyles/PrintRegion/PrintTwinButton` pattern (window.print + scoped inline styles, no global
  CSS).
- **checkout** — rebuilt as **circulation desk**: DetailSplit; left = `EntityPicker` borrower →
  their live loans (`/library/issues?student_id=`) as `ListView` rows with overdue StatusChip +
  inline Return/Renew; right = barcode `ScanPanel` (kept) + book `ListView` picker + Issue action.
  Same endpoints; policy hint line from `/library/settings` kept.
- **fines** — native `<select>` → `AdvancedSelect`; Waive now `useConfirm`d (money-adjacent, hard
  confirm) ; unpaid→error chip mapping retained.
- **overdue** — already aging-StatusChip + DataTable; audited, kept.
- **catalog** — `DetailSplit` + **`TreeView` category browser** (All/categories with counts —
  TreeView adoption G3) filtering the table; delete → `undoableDelete`; Student ID UUID fields
  untouched (none).
- **acquisition — NEW** (`library/acquisition/page.tsx`) — the v2 backend depth (`/library/vendors`,
  `/library/purchase-orders`, `/purchase-orders/<id>/receive`) had **zero web surface**; now Tabs
  [Purchase Orders | Vendors] as DataTables with status chips, a **Receive** action (bulk
  remaining-qty receipt, `useConfirm`d), PO raise dialog (append-only line items, ≤7 visible
  fields), vendor dialog, KPI strip.
- **stocktake** — hand-rolled `<table>` → `DataTable`; "Close & create lost fines" (destructive,
  money-creating) now `useConfirm`d; scan flow untouched.
- **books / reservations / reports / transactions** — audited conformant (A1/FilterCommandBar
  switchers, redirect contract); left as-is.

## 5. VISITORS / INVENTORY / DISMISSAL / CONFERENCES / CERTIFICATES

- **visitors** — *Research: gate logs print badges; visitor state = check-in → campus → check-out.*
  Added per-row **printable visitor badge** dialog (PrintRegion twin: VISITOR header, name, purpose,
  in/out times, ID line) + check-in **`StatusTimeline`** (Checked in → On campus → Checked out);
  inline checkout already present, KPI grid kept.
- **inventory** — audited (A-03 rewrite): A1 conformant, StatusChips, empty state; no changes needed.
- **dismissal** — audited (plan: keep, QR mitigated): A6-ish live board with scan-verify input +
  DataTable; conformant; no changes.
- **conferences** — *Research: PT conferencing = slots + booking; parents book on mobile, admins
  monitor occupancy.* Each conference card gains a lifecycle `StatusTimeline` (Scheduled → Ongoing
  → Completed); row action **Slots** opens a `DetailSheet` DataTable (`/conferences/<id>/slots`)
  with Booked/Open chips and booked/total subtitle. Create dialog untouched (≤7 fields already).
- **certificates** — hub: hand-rolled gradient grid replaced with the shared `QuickLinks` component
  (identical tile recipe, one implementation); the four print-twin generator pages (students/staff/
  character/transfer) audited — already use the wave print approach + DataTable; stubs
  (templates/student-id/staff-id/id-settings) are deliberate redirects and kept.

## 6. Conventions applied wave-wide

`undoableDelete` for restorable deletes / `useConfirm` for destructive-or-money actions / zero
native dialogs (grep-verified across all 10 dirs); fixed `Tabs` (win11 classes) + `?tab=` via
`useAOSRouteParams`/`useAOSRouterNavigate` instead of `useSearchParams` (shell-URL mirror — wave-A
convention); `EmptyState`/`DependencyMissingEmptyState`/`AOSEmptyState`; skeletons/loading states on
first paint; `StatusChip` everywhere a colored word stood; bilingual `t(en, ne)` added on rewritten
chrome (transport hub/monitor/prefs/trips, incidents hub, hostel, library hub/checkout, active
cases embedded view). Bilingual depth on pages left audit-only (inventory, dismissal, logs, books,
reservations, reports, certificates generators) is a follow-up.

## 7. Backend needs flagged (view-layer-only rule — nothing enforced client-side that should be server-side)

1. **Transport board-geofence check**: `board_student`/pickup path does not validate driver GPS vs
   the student's stop server-side (SBT does) — client pickup buttons remain honest but unguarded.
2. **`_instance_dict` should embed `driver_name` + `driver_phone`** — the call-driver FAB costs a
   second `GET /users/<id>` round-trip today; also no driver-app coaching payload yet.
3. **Hostel allocation**: overlap + capacity ARE validated (422) — good; **gender-vs-hostel-type
   mismatch is NOT** (a boy can be allocated to a girls hostel room via API); add room-type/floor
   PATCH surface (edit dialog deferred pending this).
4. **Hostel rules are code-only** — the Rules tab documents them; an editable `hostel_rules` config
   (quiet hours, leave policy) has no endpoint.
5. **Transport prefs GET** returns rows only for students with saved prefs (no names) — the page
   joins `/students?limit=500`; a student-scoped `GET /transport/notification-prefs?with_students=1`
   would remove the 500-cap edge.
6. **Plugin manifests** (backend): add `Geofence Alerts` to gps_tracking `ui.nav.subitems` and
   `Acquisition` to library_management's, so the per-app menu mirrors the new QuickLinks tiles.
7. **Library categories** are free-text on books (no category master) — the TreeView derives from
   data; a `library_categories` table would make the tree authoritative (InfixEdu accession-series
   pattern).
8. **Conferences slot TOCTOU** (plan 6.1-8) still open server-side; the admin slots sheet surfaces
   occupancy but double-booking needs the backend lock.

## 8. Verification

`npx tsc --noEmit` at batch boundaries after every ~3 pages; final run: **0 errors in wave-E dirs**
(remaining repo errors: `profile/page.tsx` ×2, `teachers/page.tsx` ×1 — other agents' in-flight
files). `window.confirm|alert|prompt` grep = clean across all ten dirs. No endpoint changed or
added; no route deleted; `library__transactions → ?tab=issues` and all
`/dashboard/incident-management/*` routes preserved.
