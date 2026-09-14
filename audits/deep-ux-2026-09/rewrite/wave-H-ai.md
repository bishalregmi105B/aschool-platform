# wave-H — AI pillar rewrite (AI Hub + 25 tool pages + AI Teacher + AI Workbench)

Date: 2026-09-14. Agent: wave-H. Scope: `frontend/app/dashboard/ai-tools/**`,
`ai-teacher/**`, `ai-workbench/**`, NEW `ai/**`. Shared components,
AOSRouteTable/registry, lib/ and backend untouched.

## 0. What this wave is

Operationalizes Part 29 / DUPLICATION_MATRIX §3 / Part 10.4 / Part 4.3 row 5 /
Part 34 rows 17–19: **one install ("AI Suite"), one desktop entry ("AI Hub"),
four tabs (Tools · Teacher · Workbench · Insights)**; deep URLs
`/dashboard/ai-tools/*` keep working (additive hub, risk R7); the 23+ tool
pages stop being 25 small different designs and become **one template**.

## 1. Research pass (honesty note)

Live web research was attempted but the sandbox returned 404/timeout for
MagicSchool, Diffit and NN/g URLs (network egress unavailable — 6 fetches).
Per-page notes below are therefore grounded in the in-repo competitor analysis
that already cites these products: `aschool-frontend.md` §15 ("MagicSchool's
tool-card deep-link-with-prefill pattern for the AI-tools hub inside Spotlight
results"), Part 4.3-5 ideal ("MagicSchool tool-card deep-link-with-prefill
over one hub; EduEx's real-Gemini lesson: AI features must be real, not
mock"), `eduex-lms-v2.0.md` §11 (mock AI cautionary tale), UX_TASK_BENCHMARKS.
Each page carries a 2-line note citing the pattern it implements. **Re-measure
MagicSchool/Diffit live before the polish pass if network access returns.**

## 2. Files (all rewritten, view layer only — every endpoint call preserved)

### New: AI Hub — `/dashboard/ai`
- `app/dashboard/ai/page.tsx` — 4-tab `Tabs variant="pills"` page (G1 fixed
  tabs inherit `win11-tablist` styling + Radix keyboard a11y), triggers carry
  `badge` counts (tools=25, recent lessons, saved outputs, at-risk alerts).
  - **Tools** = `<ToolCatalog/>` — the ai-tools catalog with search box +
    category chips (MagicSchool launcher), one grid (the old hub rendered the
    same 25 tools TWICE — tiles + cards — now deduped).
  - **Teacher** = launch card → `/dashboard/ai-teacher` + recent lessons
    (`GET /ai-teacher/lessons`) with StatusChip; content wrapped in
    `PluginGate slug="ai_teacher"` (shows the standard bilingual install card
    when the plugin isn't granted — honest, never blank).
  - **Workbench** = summary card → `/dashboard/ai-workbench` + recent saved
    outputs (`GET /ai/library`).
  - **Insights** = at-risk students (`GET /ai-tools/insights/risk-alerts`)
    with designed empty/error states ("A clean list means clean data — not a
    dead model"), link to the weekly report.
  - **Deep-link-with-prefill**: `/dashboard/ai?tool=<key>&subject=…&grade=…`
    forwards to `/dashboard/ai-tools/<key>?<rest>` on mount — the §15 steal.
- `app/dashboard/ai-tools/page.tsx` — kept as standalone deep route (R7),
  now renders the SAME `<ToolCatalog/>` + header link to the hub.

### New shared (private folder, inside wave-H scope)
- `app/dashboard/ai-tools/_components/tool-catalog.tsx` — catalog data
  (`AI_TOOLS`, 25 tools with one-line outcome copy) + searchable grid.
- `app/dashboard/ai-tools/_components/ai-tool-page.tsx` — **the one template**
  (`AiToolPage`): AOSPageHeader (bilingual one-liner + `AI Hub · Tools` back
  link) → INPUT `FormSection` (declared fields, ≤7 visible, rare ones behind
  an **Advanced (n)** expander per 31.0) → Generate button (Spinner while
  pending + optimistic disable + a visible "Required: …" gate reason) → RESULT
  `DataPanel` (skeleton while generating, ErrorState+retry on failure,
  `EmptyState` **"Generate to see output"** when idle) with Copy / Download
  .md / **Save** actions → per-tool **history** ("Saved from this tool") via
  `GET /ai/library?tool_key=` with Open-to-restore. The template also reads
  its declared field keys back out of the window URL → prefill works for every
  tool (the old `question-paper` silently IGNORED blueprint-builder's
  `?subject=&grade=&total_marks=` hand-off; fixed).

### Tool pages (all 25)
17 fully declarative rewrites (~45–105 L each, from 88–279):
accommodation-finder, annual-scheme, attendance-outreach, blueprint-builder
(custom sections view + "Continue to paper" carried via `renderResult(data,
values)`), choice-board, conference-prep, email-responder, enrichment-planner,
exam-timetable-draft, lesson-hook, lesson-plan, letter-writer (letterhead
frame + Print kept), meeting-minutes, observation-feedback, practical-exam,
text-leveler, transition-guide, vocab-support (CSV kept as result action),
writing-scaffold.
Kept custom (not generate-form pages) but conformed to the kit (bilingual
header, hub back link, ErrorState/EmptyState variants, skeletons, DataTable +
`useUrlFilters`/`useDebounced` where listed):
**question-paper** (dedicated endpoint), **insights** (A7 weekly digest),
**learning-paths** (A1 list + two Dialogs; hand-rolled table → DataTable),
**progress** (A1 list → DataTable + URL-persisted filters), **report-remarks**
(per-student loop logic + "failures stay empty" honesty kept verbatim),
**timetable** (solver grid kept; "Generate to see output" empty state +
solving panel added; unused import cleanup).

### AI Teacher (`ai-teacher/page.tsx`)
Curriculum picker flow KEPT (sections/students/lessons endpoints unchanged).
Added: **StatusTimeline** of the lesson lifecycle (`pending→ready→teaching→
ended`, paused/failed/blocked annotated) driven by clicking a row in Recent
lessons; usage/cost DataPanel (Lessons · Minutes · NPR · % of monthly
ceiling) from the same `GET /ai-teacher/usage`; `QuickLinks` component
replaces hand-rolled tiles; `variant="dependency"` EmptyState with a "Open
Teaching Content" CTA when nothing is published; button spinner + infobar
errors; hub back link. **Removed a pre-existing dead header link**
`/dashboard/ai-teacher/content` (route has never existed; the QuickLink to
`/dashboard/teaching-content` is the live replacement).

### AI Workbench (`ai-workbench/page.tsx`)
Same A6 grammar as the corpus plan: **dataset + run panels** — catalog is now
a persistent left list (`DetailSplit`, pickable rows, GA/AI Suite/Off chips)
instead of a full-page Catalog↔Runner swap; run panel = input DataPanel with
the pre-run cost estimate + Nutrition Facts transparency panel + provenance
header (model · provider · $ · gen-id) + Save/Copy; all endpoints unchanged.

## 3. Decisions & deviations (flagged)

1. **`?tab=` wiring**: instructions said `useUrlFilters`; inside AOS windows
   the browser URL is pinned to `/dashboard`, so writing it would pollute the
   shell. The hub reads with `useAOSRouteParams()` and writes with
   `useAOSRouterNavigate('/dashboard/ai?tab=x')` — same deep-link guarantee
   (`/dashboard/ai?tab=insights` opens the tab whether from a window or a
   direct URL), shell-native. `useUrlFilters` IS used for list pages outside
   the window-param concern (learning-paths, progress).
2. **"Insert into Writer": OMITTED.** Checked first per the rule:
   `lib/writer/` exposes only editorKit/exportDocx/findReplace/pagination/
   settings — no public "create writer doc from AI text" API, and writer2's
   doc format is `canvas_state:{type:"writer2",doc:tipTapJSON,config}` saved
   via `POST /design-studio/documents`. Building that bridge would mean either
   editing lib/ (off-limits) or re-implementing doc serialization per page.
   **Follow-up for the writer wave**: expose `createWriterDraft(markdown)` in
   `lib/writer`; the template then adds one result-panel button.
3. **History**: no per-tool *automatic* generation-history endpoint exists
   (`GET /ai/generations/<id>` is single-fetch only). The template uses the
   real, exposed store — the content library (`/ai/library?tool_key=`, Save
   button) — and says so ("Saved from this tool"). If the backend adds
   `GET /ai/generations?tool_key=`, swap the query; the panel is ready.
4. **No new endpoints needed** by any UI here. Consumed: `/ai/generate/*`,
   `/ai/tools/*`, `/ai/library`, `/ai-tools/{lesson-plan,letter-writer,
   question-paper,timetable,remarks,insights/weekly,insights/risk-alerts}`,
   `/ai-teacher/{lessons,usage}`, `/teaching-content/sections`, `/lms/*`,
   `/exams/*`, `/academics/classes`, `/students`.
5. `PageLoader` in result panels replaced by inline skeletons (G-loading
   taxonomy: skeletons for content, spinner for actions).

## 4. Registry entries the orchestrator must wire (AOSRouteTable + module registry)

`components/aos/AOSRouteTable.tsx` — add (dynamic-import pattern, alphabetical
before `ai-teacher`):

```ts
ai: dynamic(() => import("@/app/dashboard/ai/page"), { loading: AOSModuleLoading }), // /dashboard/ai
```

Deep-link aliases so per-app menu / Spotlight subitems land on tabs (pattern:
`library__transactions → issues tab`, Part 33 rule 2):

```ts
"ai__tools": <same component as ai>      // route → /dashboard/ai?tab=tools
"ai__teacher": <same component as ai>    // → ?tab=teacher
"ai__workbench": <same component as ai>  // → ?tab=workbench
"ai__insights": <same component as ai>   // → ?tab=insights
```

`AOSModuleRegistry.tsx` (app metadata + manifest subitems):
- New desktop app entry **AI Hub** (`ai`, icon `Sparkles`, gated
  `ai_suite`, section `Insights`) with subitems Tools / AI Teacher /
  Workbench / Insights mapping to the four tab keys above.
- Re-point existing `ai-tools`, `ai-teacher`, `ai-workbench` module entries'
  per-app menus at the hub (or keep them as deep app routes — pages work
  standalone; only the *default* desktop icon should consolidate to AI Hub).
- **Retire the legacy `lab → ai-workbench` alias** (10.4) after a usage check —
  not touched here (registry off-limits).
- Until `ai` is registered, `/dashboard/ai` renders as a plain full page
  (shell falls back to router navigation — verified `openRouteInAOS` returns
  false for unknown slugs), so tool-page "AI Hub · Tools" links degrade
  gracefully, never dead-end.
- `app/teacher/ai-tools` one-line re-export → should become the teacher-
  tailored AI view (out of wave-H scope; Part 29/§3 product note).

## 5. Verification

- `tsc --noEmit` filtered to `app/dashboard/ai*`: **0 errors** (gates run after
  batches of 3–6 pages; final gate green). Remaining project tsc errors belong
  to other waves' files (academics, teacher portal, writer chrome,
  incident-management) — untouched.
- `eslint app/dashboard/ai*` — clean (0 warnings).
- Endpoints/payloads diff-checked against the pre-wave pages — no request
  shape changed except: every template page additionally POSTs to the existing
  `/ai/library` on **Save** (user-triggered, opt-in).
- Not yet exercised in a live shell window (browser egress/running stack not
  owned by this wave) — recommend a GUI smoke of: hub tabs + `?tool=` forward,
  question-paper prefill from blueprint, workbench run panel, teacher
  lifecycle timeline.

## 6. File inventory (wave-H)

New: `app/dashboard/ai/page.tsx` · `app/dashboard/ai-tools/_components/{ai-tool-page,tool-catalog}.tsx`
Rewritten: `app/dashboard/ai-tools/page.tsx` + all 25 `ai-tools/*/page.tsx` ·
`ai-teacher/page.tsx` · `ai-workbench/page.tsx`
Net: ~4,400 lines in scope (was ~4,600 across 27 pages with 5 near-duplicate
chrome implementations → 1 shared template + declarative configs).
