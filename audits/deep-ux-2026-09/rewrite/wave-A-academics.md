# Wave A rewrite report — students / academics / attendance / timetable

Agent: Wave A (students, academics, attendance, timetable page ownership).
Convention decisions applied module-wide:

- **URL state**: the rewrite spec names `useUrlFilters`, but in this build the
  browser URL is owned by the AOS shell (window route mirrored via raw
  history). `useUrlFilters`'s `router.replace` fights that mirror, so
  filter/tab state is synced with `useAOSRouteParams()` +
  `useAOSRouterNavigate()` (the same mechanism `library` uses for `?tab=`),
  with `useDebounced` for text search. Effect is identical to the spec
  (shareable, refresh-safe) and correct inside windows + `aos_embed`
  (navigate falls back to `router.push`).
- Text search is deliberately NOT pushed per keystroke (window-history spam);
  selects / tabs / pagination are URL-backed.
- Destructive: row delete → `undoableDelete`; bulk/destructive ops →
  `useConfirm()`. No native dialogs anywhere in my dirs.
- Empty states: 3-variant taxonomy (never-used / filtered / dependency) via
  `ui/empty-state`, dependency ones deep-link to `/dashboard/academics`.
- Bilingual: `t(en, ne)` added on chrome everywhere (several pages were
  English-only).

Tooling note: the sandbox has no `WebSearch` tool (search engines block
`WebFetch`); research = direct fetches of expert articles + the improvement
plan's own cited competitor patterns (InfixEdu/InstiKit/eSchool per Part 11).

---

## 1. students/page.tsx (hub + A1 list)

**Research note** — NN/g "Web Form Design"/tables guidance + plan 22-row1:
one search box + ≤3 URL-backed filters, skeleton rows for first paint, and
delete-by-undo beats confirm for routine row actions. Applied: URL-backed
class/section/gender/status filters + `?page=`, QuickLinks kit component,
removed the duplicate primary "Add Student" from the table toolbar,
`skeleton` loading inside DataTable (no early-return spinner), filtered-empty
vs never-used states, `undoableDelete` on row delete (bulk keeps confirm).
Clicks: add student 2 (was 2); share filtered roster now 0 extra (URL).
Removed: dead `AddStudentDialog` (header routes to /new) ≈ −270 L.

## 2. students/new (A3 form)

**Research note** — NN/g: single column momentum, explicit required marks,
cut deferable fields; plan 16.5 says keep the field set (IEMIS-justified) but
not all visible. Applied: AOSPage header with back action; first screen =
identity(6) + academic(5) + guardian(3) with only 4 required marks; blood/
religion/ethnicity/nationality/address/emails/previous-school folded into
`win11-expander` "Advanced details"; second-guardian into an expander;
unsaved-changes guard via `useConfirm` on Back/Cancel; submit-gating hint
names the missing field ("Select a class to continue"); class-picker
dependency hint + loading copy kept.

## 3. students/[id] (A2 detail)

**Research note** — eSchool/InfixEdu student screens + plan A2: persona
header first, ≤6 same-entity views as tabs, micro-edits inline. Applied:
`ObjectHeader` (avatar, name EN+NE, enrollment code, StatusChip, actions),
KPI band (attendance % / fees / due), `Tabs variant="underline"` synced to
`?tab=` (overview|attendance|fees|account), related queries lazy (`enabled`
per tab), `EditableField` inline for phone/email, honest not-found + retry,
skeleton first paint. **Bug fixed**: password-reset previously fired
regardless of the confirm answer.

## 4. students/promote (A4 wizard)

**Research note** — wizard best practice (plan 8.15/InfixEdu 3-step import
pattern): one decision per step, finish blocked until valid, review names
consequence, failures retry in place. Applied: 3 steps (Choose → Review
preview-diff → Confirm). Preview auto-loads on step-2 mount and step-2
blocks until loaded (per-item target section/roll diff, section mapping
chips, conflict list). Dependency empty state when no classes. All endpoints
and payloads unchanged.

## 5. students/roll-numbers (A1 + inline edit)

**Research note** — enterprise-grid inline editing: numeric narrow editor,
visible dirty count, one bulk default. Applied: `?class=&section=` URL
pickers, Save label carries the changed count ("Save (12 changed)"), dirty
diff computed per row, dependency/empty/skeleton states, bilingual.

## 6. students/transfers (A1 + A3 dialog)

**Research note** — registry+dialog grammar (plan 31.3 "≤4 fields →
Dialog"): list with debounced search mirrored to `?q=`, dialog with
Enter-to-submit, disabled primary until student chosen, StatusChip instead
of badges, filtered-empty with clear CTA + never-used with the one CTA.

## 7. students/reset-password

**Research note** — destructive bulk ops need an explicit consequence
statement (audit §11 "25 native confirms", rule 3). Applied: the bulk reset
now goes through `useConfirm` (**previously it fired with zero
confirmation**); URL-backed class filter; skeletons; dependency empty state;
password-format explanation moved to a `win11-infobar`.

## 8. students/profile-images (grid uploader)

**Research note** — batch uploaders must state the naming contract up front
and never delete on miss (InfixEdu pattern). Applied: AOSPage anatomy,
keyboard-operable drop target (role=button/Enter/Space), real progress,
result KPI band + per-file StatusChip rows, "how it works" as infobar.

## 9. students/bulk-import (A4 wizard)

**Research note** — CSV import wizard research (plan 8.15: upload → map →
validate-preview with per-row errors; failure offers retry-from-step-N):
gave the exact column contract in step 1 + downloadable template, client
header pre-flight for CSVs in step 2, per-row server errors in step 3 with
"fix + re-import updates by Student Id" copy; finish is double-import-safe
(step validate blocks re-commit). `.xlsx` cannot be parsed client-side →
step 2 honestly says the server validates it
(`// TODO(rewrite-wave-A)` considered — no new API added).

## 10. students/guardians — NOT rewritten (5-line Next-route redirect into
parents; registry already launches `parents` directly). Left as-is.

---

## 11. academics/page.tsx (hub, A5)

**Research note** — plan G2 explicitly lists academics as one of the 4
hand-rolled tab strips to replace; InfixEdu's multi-year axis (8.1) + Feishu
pivot-tab patterns. Applied: hand-rolled strip → kit `Tabs` (win11-tablist,
Radix keyboard nav) synced to `?tab=years|classes|subjects`; the legacy
re-export subroutes (class-sections/subjects, which AOSRouteTable still
launches as windows) now resolve to the right tab from the window path
(Part 33 "subroute deep-links into a tab"); Quick Links rebuilt to point AT
tabs + the two mapping pages (the old 4 stub URLs were dead-ends) and the
separate ACADEMIC_TOOLS card band folded into the same grid (one launcher
grammar); bespoke delete Dialog → `useConfirm`; skeletons; session chip in
the header + year filter on Classes tab when payload carries
`academic_year_id` (year axis, 8.1); bilingual. Sections remain INSIDE the
Classes tab (plan 34: tabs Years/Classes/Sections/Subjects — sections have
their own editor column, no separate tab).

**Stubs:** `academics/classes|year|years` redirect pages DELETED (≤5-line
pure redirects, unreferenced). `class-sections` + `subjects` are 4-5 L but
are hub RE-EXPORTS still imported by `AOSRouteTable`
(`academics__class-sections`, `academics__classes`, `academics__subjects`)
— deleting them breaks the registry (can't touch). Kept with updated
comments; flagged for removal with their 3 registry lines.

## 12. academics/class-subjects (A1)

**Research note** — mapping grids: master picker + per-row inline teacher
assign; failures must not be silent. Applied: `?class=` URL picker,
dependency empty state → Academics, guided pick state, Quick Assign
promoted to header (was a buried strip), "all mapped" honesty line,
StatusChip, i18n, skeleton.

## 13. academics/class-teachers (A1 workspace)

**Research note** — same grammar as class-subjects (two pages, one task):
identical picker + empty-state treatment so the pair feels like one tool.
Subject-teacher panel links back to class-subjects with the class prefilled
(`?class=`); no-classes dependency state; skeletons; i18n.

## 14. attendance/page.tsx (mark — A1 variant)

**Research note** — plan 16.2: the existing flow (explicit-unmarked gate,
P/A/L/E + 1-4, arrows, All-Absent confirm) is best-in-corpus → keep; audit
gap list: "select a class" → dependency chain + print twin. Applied:
date/class/section + Mark/View tab moved to the window URL (`?date=&class=
&section=&tab=`), kit `Tabs` replaces the hand-rolled strip, `QuickLinks`
kit for the 5 utilities, `DependencyMissingEmptyState` ("Create your first
class →" kept as component), skeletons, full bilingual chrome. Register
print-twin deferred with `// TODO(rewrite-wave-A)` — the kit's printRef
(plan 9.5) doesn't exist yet and I may not touch the kit.

## 15. attendance/holidays (A1)

Applied: shared EmptyState-with-CTA + ErrorState (was raw markup), skeleton,
i18n. Delete stays `useConfirm` (affects notifications). Endpoints unchanged
(/notices/events).

## 16. attendance/import (A4 wizard)

**Research note** — plan 8.15 (InfixEdu 3-step: upload → validate → per-row
errors, retry-from-step). The page already did this but with a hand-rolled
stepper and a server-preview button that could be skipped. Applied: kit
`Wizard`; server preview runs INSIDE step-2's async validation (can't commit
unvalidated); per-row error tables kept; commit on the finish button with
the valid count; keyboard drop target. Endpoints unchanged
(/attendance/import/preview + commit).

## 17. attendance/leave-requests (A1 + inline approve/reject)

Already 3-variant-empty + skeleton + StatusPill (kept). Applied: status
chips → URL `?status=` (pending default), i18n on chips/columns/dialog.
Reject-with-reason dialog unchanged (the corpus-recommended pattern per
4.3/6-8.2).

## 18. attendance/subject (A1-variant marking)

Print-twin + states already present; deltas: scope to URL
(`?date=&class=&section=&subject=`), dependency-missing state, skeletons,
i18n. P/A/L/H/Leave interaction kept.

## 19. attendance/reports (A7)

**Research note** — analytics pages need zero-data honesty + drill-down CTA
(plan A7, 19.3). Applied: scope URL-backed (`?class=&month=`), month picker
kept as 24-option select, error now retries via refetch (was
`window.location.reload()` — dropped the whole shell!), skeleton, honest
empty → "Mark attendance" CTA, StatusChip threshold coloring, i18n.

## 20. attendance/mark/page.tsx (23-L redirect)

Plan says DELETE; `AOSRouteTable` line `attendance__mark` imports it →
kept but converted to shell-navigation redirect (`useAOSRouterNavigate`,
focuses the Attendance window + real URL instead of forcing a Next
navigation). Flagged for registry-line removal.

## 21. timetable/page.tsx (A6 grid workspace)

**Research note** — timetable grids: clash visibility without opening
anything (Mighty's dynamic editing pattern), grid read-first/edit-by-
exception. Applied: scope URL-backed, teacher double-booking detected per
day+period across sections (⚠ chip on both clashing cells + a "clashes
visible" chip on the panel), 1-card "Quick Links" panel deleted (its links
are now header actions incl. the missing Per-teacher entry), Nepali day
labels, undoableDelete for slot removal after `useConfirm`, dependency/
error/skeleton states, i18n. Grid stays hand-composed (A6 permits custom
chrome for workspace grids).

## 22. timetable/generate (A4 wizard)

**Research note** — generation flows: async step with progress, always
review before replace, surface conflicts (8.3 said conflict visualization
was MISSING). Applied: 3-step kit Wizard; solver runs inside step-2 async
validation (failure = retry-in-place, never restart); previously-IGNORED
`result.conflicts[]` now rendered as a warning infobar list; save step
states replace-semantics and requires `useConfirm` (was one unconfirmed
click replacing live slots); nothing-solvable dependency state →
class-subjects. Same payloads (periods_per_day 8, scoped save).

## 23. timetable/teacher (A7 per-teacher grid)

Applied: `?teacher=` URL + searchable picker (was a raw Select over 100
names), load KPIs (periods this week / classes taught / free cells),
NE day labels, guidance/empty/error states, i18n.

---

## Gate results

`tsc --noEmit` grep on `dashboard/(students|academics|attendance|timetable)`:
**0 error lines** (final run). Only remaining repo errors during gates were
in another agent's `transport/routes` (untouched, per lane rules).

## Registry / route-table flags (NOT implemented — other lane)

1. `AOSRouteTable` stub-key cleanup: drop `academics__class-sections`,
   `academics__classes`, `academics__subjects`, `academics__year`,
   `academics__years` and point the tab deep links to `academics?tab=…`;
   then delete `academics/class-sections/page.tsx` +
   `academics/subjects/page.tsx` (kept as re-export shims only because the
   registry imports them).
2. Drop `attendance__mark` route key + `attendance/mark/page.tsx` redirect
   once menu/manifest entries stop referencing it (backend attendance
   manifest lists a Mark subpage).
3. `students/guardians` registry key already points at the parents page;
   the 5-L Next redirect stays for direct URL compat.
4. Plan 9.5 `printRef` on `AOSPageHeader` — needed for the attendance
   register print twin (TODO left in code).
5. Plugin manifests (academics/timetable `ui.nav.subitems`) still advertise
   the deleted `/academics/classes|year|years` subroutes — desktop-folder
   links to them will 404 the Next route (window launches via registry
   still work through the shim keys until item 1 lands).

