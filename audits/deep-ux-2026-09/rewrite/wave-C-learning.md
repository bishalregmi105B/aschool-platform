# Wave C — Learning module rewrite (exams, assignments, lms, elibrary, teaching-content, content-review, portfolio)

Date: 2026-09-14 · Agent: Wave C (module owner) · Gate: `tsc --noEmit` → **0 errors** in all owned dirs.

Files touched (all under owned dirs only):
`app/dashboard/exams/**` (hub, marks, [id], tabulation, results, report-cards, grades, grade-scales, schedule, online, online/questions) + 2 new co-located files
(`exams/print-twin.tsx`, `exams/online/runner.tsx`),
`app/dashboard/assignments/page.tsx`, `app/dashboard/lms/page.tsx`,
`app/dashboard/elibrary/{page,past-papers/page,upload/page}.tsx`,
`app/dashboard/teaching-content/page.tsx`, `app/dashboard/content-review/page.tsx`,
`app/dashboard/portfolio/page.tsx`.

## Research notes (per screen type — sources: audit corpus + MDN; live web searches mostly 404'd, noted honestly)

The competitor corpus reports in `audits/deep-ux-2026-09/` are themselves deep audits of 8 shipped products and were used as the primary research base, plus one live fetch (MDN Printing guide, fetched OK).

**Exam question-paper builder (online/questions — AI generator):**
- Corpus: eSchool v3.3.6 ships per-exam question attach with marks and LaTeX (`eschool-v3.3.6.md` §examOnlineScreen); InfixEdu's `sm_exam_setups` treats mark distribution as its own entity (`infixedu-v9.4.0.md` §107).
- ASchool's A3 form (6 visible fields ≤7) + output panel already matches; the gap was print, not authoring.

**Exam-taking runner (online — new preview runner):**
- eSchool runner = PageView one-question-per-page, palette bottom sheet with attempted/not-attempted states, wakelock, away>5s auto-submit, client-only countdown (`eschool-v3.3.6.md:369-370, 454-455`). Its weakness: no autosave — answers live in memory (`:455`).
- ASchool's backend is the stronger base: /start /attempt(PATCH autosave) /submit with single-attempt uniqueness (S-A2, `exams.py:590-680`) — so the UI layers added are palette + away warning + autosave indicator wired to that contract, not an invented one.

**Marks entry (marks page):**
- Corpus-best already: MarksGrid Enter/↓ + Excel paste wired (`IMPROVEMENT_PLAN` §16.4). Best-practice sources agree the grid itself is the product; surrounding chrome should add read-outs (outstanding list, distribution) not new input surfaces — hence the Summary tab instead of touching the widget.

**Print twins (tabulation, results, report-cards, grades, questions):**
- MDN Printing guide (fetched live): hide chrome with visibility trick scoped by class, `break-inside: avoid`, reveal collapsed regions, `@page` size/margin, `beforeprint/afterprint` events; InfixEdu's "everything prints" discipline (`infixedu-v9.4.0.md` §22) is the bar.
- Implemented once as shared `exams/print-twin.tsx`: `PrintStyles` (inline, class-scoped, no global file), `PrintRegion`, `PrintTwinButton` (sets `document.title` → `window.print()` → restores on `afterprint`).

**LMS course/lesson list (lms):**
- EduEx = the corpus's best learning UX: `lesson_progress` (is_completed, progress_percentage, last_accessed_at) and sequential lock enforced on reads via `is_accessible` (`eduex-lms-v2.0.md` §158, §47).
- ASchool's staff-side course GET returns raw lessons, so the UI reads `is_completed`/`is_accessible` defensively (chips appear the moment the backend adds them) — hooks ready, flagged below.

**Digital library reader/grid (elibrary):**
- EduEx's designed empty states + InfixEdu print-register thinking → hub became a browsable card grid (cover-less books read better as tiles than 6 dead table columns that the DigitalBook model never fills — the old table's category/subject/class columns were always empty).
- Past papers have real subject/class/year metadata → card grid + shareable URL filters.

**Content review queue (content-review):**
- Review-queue best practice (corpus: ASchool's own leave-requests/approvals inline-action pattern + Part 34-52): queue first (status tabs with pending badge), drill second, destructive/reject actions behind confirm.
- Chunk pass/flag were already inline; reject (flag) now gates through `useConfirm` and queue/source/unit state moved to the URL for hand-off between reviewers.

**Object detail (portfolio, exams/[id]):**
- Plan A2 archetype + G6 ObjectHeader (win11-persona): persona header, tabs ≤6 as URL state; portfolio tabs = Work / Credentials / Files (backend contract has no comments endpoint — see flags).

## Page-by-page changes

### exams/page.tsx (A5 hub — kept corpus-best)
- Kept: 1-field create dialog (create-with-just-a-name still works), NEB reference card, QuickLinks, DataTable.
- Fixed: **search was wired but inert** (DataTable's box is display-only) — page now filters on debounced query; type/class/session filters moved to window-route URL state (`?type=&cls=&year=`); filtered-empty state gets "Clear filters"; delete is now `undoableDelete` (soft delete, 5-s undo, optimistic cache hide) instead of confirm+hard-delete.
- Bilingual (t(en,ne)): header, KPIs, CTA, placeholders, empty states; empty class picker in the create dialog now shows "No classes yet → Create a class first in Academics" (report §14-4 dead-end fix).

### exams/marks/page.tsx (A6 workspace — MarksGrid untouched)
- MarksGrid widget and its internals: unchanged (hard rule).
- Chrome: exam/class/subject selection moved from local state to URL state (`?exam=&cls=&subj=`) — hub row-links (?exam=) still land; added `?tab=` tabs **Marks Grid | Summary (badge = not-yet-entered count)**. Summary shows live NEB grade distribution + the outstanding-students list, derived client-side from the same state.
- Header + Save button bilingual; component-config card untouched.

### exams/[id]/page.tsx (A2 rebuild)
- AOSPageHeader → `ObjectHeader` (persona: name + Nepali name + window code + StatusChip + meta chips) → `Tabs` **Overview | Subjects (badge) | Results (badge)**, tab in URL.
- Honest 404 (EmptyState variant=filtered + Back), results-tab dependency empty state with "Enter marks" deep link. Fixed broken links: `?exam_id=` → `?exam=` (matches what marks/results pages read).

### exams/tabulation/page.tsx (A7 + print twin)
- Hand-rolled tab strip → fixed `Tabs` (win11-tablist), `?tab=` URL state.
- Print twin: `PrintRegion` wraps the sheet/merit tables (portrait→landscape via shared styles); `PrintTwinButton` sets document title ("Tabulation Sheet — <exam>") + `window.print()`. The server-rendered `format=print` flow is kept as a secondary "Server copy" (no popup dependency for the primary path — popups were blocked per its own error toast).
- Bilingual header/tabs.

### exams/results/page.tsx (A1/A7 + print twin)
- Hand-rolled nav strip → fixed `Tabs`, `?tab=marksLedger` URL state; **`?exam=` from hub links now pre-selects** (was ignored — a real deep-link bug).
- Print twins: results table, grade-sheet ledger, and the student marksheet modal each wrapped in `PrintRegion`; primary Print (document.title twin) + per-student Print button in the modal footer (16.6 delta "add print-twin + per-student print"). Server PDF/preview flows kept.
- Bilingual header/labels.

### exams/report-cards/page.tsx (A4-lite + print twin)
- `?exam=` pre-select now honored (+ auto-fill class from the exam); local search actually filters (was inert); PrintTwin over the card table; "Download All PDF" demoted to secondary, "Generate with AI" remains the single primary; bilingual chrome; kept the generate/bulk endpoints untouched. 16.6 empty state guidance already present — kept.

### exams/online/page.tsx + NEW online/runner.tsx (A1 + runner UX)
- List: search filtering fixed, skeleton loading (DataTable-owned), empty state as real empty, "Preview runner" row action added.
- **Runner**: full-screen dialog with (1) question-palette sidebar (answered/flagged/current + legend + counts), (2) leave-screen warning via `visibilitychange` (eSchool's away counter, banner + count instead of auto-submit), (3) autosave indicator (Saving…/Saved ✓/Offline) persisting the draft to localStorage per exam and resuming it. Timer from `duration_minutes`.
- **Integrity note (hard rule 5)**: the student submission path (POST /start, PATCH /attempt, POST /submit — S-A2 single-attempt, server-scored) is **untouched**; the runner is staff-side preview only and states that ("answers stay on this device, nothing is submitted") to respect the honesty discipline.

### exams/online/questions/page.tsx (A3 + twin)
- Print twin over the generated paper (portrait, title "Question Paper — <subject>") added beside Copy/legacy popup export; header bilingual. Form already ≤7 fields with defaults.

### exams/schedule/page.tsx (A1-lite)
- Card-per-exam kept; toolbar search added that actually filters (the per-card DataTable search box was inert — removed), subject-loading skeletons, bilingual chrome.

### exams/grades/page.tsx
- NEB reference table + portrait print twin ("Print scale" — wall-postable), inert search box removed, bilingual.

### exams/grade-scales/page.tsx (A8)
- Already grammar-correct (validation hints mirror the backend contract exactly); header/KPI bilingual pass only; editor dialog untouched.

### assignments/page.tsx (A1 + tabs Given/Grading/Graded)
- Hand-rolled `<Table>` → `DataTable` inside `Tabs` **Given | Grading (badge) | Graded**, active tab in `?tab=`; per-tab empty states with the right CTA; search/export/column-visibility inherited from DataTable; bilingual header/KPI/actions; AI-grade + submissions + grade dialogs kept intact (attachments now vault FilePicker — no URL-paste field on web; the mobile gap §8.4 stands).

### lms/page.tsx (A5 hub kept + progress states)
- Hub/cards layout kept (rule 5); selected course moved to `?course=` (shareable); hub loading is a card-grid skeleton (was spinner); course detail now shows a **progress rail** (Progress bar + Completed / Up-next / Locked chips) driven by `is_completed`/`is_accessible` when present, with an honest footnote until the backend serves them; lesson-type icons; bilingual; "No lessons yet" became a designed empty state.

### elibrary/page.tsx (A1 cards)
- Table → responsive **card grid** (the old table rendered three columns the DigitalBook model never stores); `?type=` file-type filter as URL state; debounced server search preserved; designed empty states (filtered vs never-used); bilingual.

### elibrary/past-papers/page.tsx (A1 cards)
- Table → card grid with subject/class/**year (derived)** filters in URL (`?subject=&cls=&year=`), clear-filters affordance, server-side search box fixed to be local+debounced (endpoint ignores params — see flags), designed empty states, bilingual.

### elibrary/upload/page.tsx (A3)
- Already correct (vault file-picker, ≤7 fields, success infobar + "Upload another"); bilingual chrome pass only.

### content-review/page.tsx (A52 queue)
- Sources list → queue with `Tabs` All / **Awaiting review (badge) / Published** via `?q=`; drill-in moved to URL state (`?source=&unit=`) so a reviewer can hand off the exact queue position; row-click opens review; skeletons for sources and chunks; **flag (reject) now confirms via useConfirm** naming the consequence; pass stays a single click (approve is not destructive). Export kept.

### portfolio/page.tsx (A2 rebuild)
- AOSPageHeader-only page → `ObjectHeader` (Avatar persona, counts meta, primary "Add Achievement" beside the header) + `Tabs` **Work (grouped achievement cards) | Credentials | Files**, all counts as badges, `?student=&tab=` URL state (student deep-linkable from student detail later). Files tab surfaces the previously invisible `media_urls` of items (with image thumbnails). Search-empty vs never-used empty states; skeleton loading; hand-rolled primary button in page header removed (single primary lives on the ObjectHeader).

## States & standards sweep (hard rule 3)
- No native `confirm/alert/prompt` remains in any owned file (verified by grep).
- No hand-rolled tab strips remain in owned files (tabulation + results + assignments converted to `ui/tabs`, badge variant used).
- Raw `<table>` survives only inside the two dense grid workspaces (tabulation sheet / results grade-sheet, plus the marks fallback grid which is the widget's own code) — allowed by 31.3 for A6 grids; every registry page uses DataTable or card grids.
- Bilingual t(en,ne): headers, CTAs, KPIs, empty/error states on every touched page (field-level copy inside long dialogs left English-first where already validated, e.g. create-exam dialog — flagged for the copy wave).
- Skeletons: online list, schedule subjects, content-review queue + chunks, portfolio cards, elibrary grids, lms hub.

## Backend needs flagged (view layer only — endpoints/payloads unchanged)
1. **LMS**: staff-side `GET /lms/courses/<id>` should include per-lesson `is_completed` / `is_accessible` (EduEx pattern, `eduex-lms-v2.0.md` §158/§47) or an enrollment-rollup endpoint; the progress chips/lock UI hooks are already wired in `lms/page.tsx`.
2. **Online exam**: no student-facing **web** runner page exists (attempt endpoints /start /attempt /submit are exercised by mobile only). The preview runner built here contains the palette/away/autosave chrome; productionizing it for students is a portal task (Wave E?) — it can reuse `exams/online/runner.tsx` minus the localStorage layer.
3. **E-library**: `GET /elibrary/papers` ignores search/subject/class/year params (all client-side today; fine under 200 items, add server filters at scale). `DigitalBook` model stores no subject/class — hub filters beyond file type are impossible until the model gains them.
4. **Portfolio**: no comments endpoint — the plan's Work/Comments/Files tab triple ships as Work/Credentials/Files; rename when comments arrive. No cross-student listing (E72 contract note in the file) — hub cannot show "recent portfolio activity".
5. **Content review**: queue SLA chip (Part 34-52) needs `submitted_at`/`reviewed_at` timestamps on chunks/units — not currently serialized.

## Process log
- Incremental per page; gates run after waves of 3 (exams wave-1, wave-2, wave-3, non-exam wave) with `timeout 180 node_modules/.bin/tsc --noEmit` filtered to owned dirs — 0 errors at every gate and final.
- Two shared primitives added inside the owned exams directory (not in components/): `print-twin.tsx` (the reusable print pattern other waves may want to lift into aos/kit in Batch-0 follow-up) and `online/runner.tsx`.
- URL-state pattern: the shell pins the browser URL, so `useUrlFilters` (which router.replaces the real URL) is shell-unsafe; every page uses the established house shim instead — read `useAOSRouteParams`, write via `useAOSRouterNavigate` — matching the students-page precedent and keeping the `useUrlFilters` contract (keys, clear-on-write, page reset).
