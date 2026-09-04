# Sahayatri Client/Frontend Audit — Screens, Flows, UX Patterns

**Audited:** `/home/bishal-regmi/Desktop/Sahayatri` — `web/` (Next.js 14), `mobile/` (Flutter Android), `whiteboard/` (Flutter web+Android)
**Purpose:** inventory every user-facing capability so it can be rebuilt as an ASchool plugin with UI in `frontend/` + the five Flutter apps.
**Method:** read-only source review of all 191 web pages, 44 web components, 37 mobile Dart files, 45 whiteboard Dart files, plus `PROGRESS.md`.
**Date:** 2026-09-04

---

## 0. Executive summary

Sahayatri is a **Nepal-market AI learning platform** (NEB/SEE curriculum), not a school ERP. Its client code is essentially three things:

1. **A 121-tool AI tool catalog** (60 student + 61 teacher) rendered from ~15 reusable "workspace" templates — one thin page file per tool passing props. This is the single biggest asset and the pattern most worth stealing.
2. **A textbook-ingestion + curriculum content pipeline UI** (PDF → Vision AI → chapter markdown + exercise bank → review → publish → "chapter context" knowledge base for AI grounding).
3. **A teaching/whiteboard client** (Flutter, canvas + realtime Socket.IO session + AI panels + Sketchfab 3D) that ASchool has no equivalent of.

Design system: **hand-written CSS custom properties + BEM-ish utility classes in one 1,100-line `globals.css`** — no Tailwind, no component library, plus heavy inline `style={{}}`. Data: **plain `fetch` wrapper + `useEffect`/`useState`** — no React Query, no global store. i18n: **next-intl with `en`/`ne` complete and `hi` a 17-line stub**, but ~95% of UI strings are hardcoded English and never go through the message catalog.

Maturity: the AI tool catalog, chapters/practice/spaced-rep, import hub, 3D viewer, admin/institution CRUD, and the whiteboard canvas are **real and working against live endpoints**. Gamification/adaptive-path/parent-portal have real UI wired to endpoints that partly return "coming soon" messages. Two legacy route trees (`/student/tools/*`, `/teacher/tools/*`, 19 pages) are orphaned Tailwind-class prototypes superseded by `ai-tools/*`.

---

## 1. Web app (`Sahayatri/web`) — Next.js 14 App Router

### 1.1 Stack and configuration

| Concern | Implementation | File |
|---|---|---|
| Framework | Next.js `^14.2` App Router, React 18, `reactStrictMode` | `next.config.js` |
| Styling | **No Tailwind.** Single global stylesheet with CSS custom properties + semantic classes; heavy inline styles | `app/globals.css` (1,109 lines) |
| Component lib | **None.** No Radix, no shadcn. Hand-rolled inline SVG icon set | `components/shared/Sidebar.tsx` |
| Markdown/math | `react-markdown` + `remark-math` + `rehype-katex`, KaTeX CSS via jsDelivr CDN `<link>` | `components/markdown/*` |
| 3D | `@google/model-viewer` web component + Sketchfab Viewer API v1.12 iframe wrapper | `components/shared/ModelViewer3D.tsx`, `lib/sketchfab.ts` |
| i18n | `next-intl` v3 plugin + cookie-based locale | `i18n/request.ts`, `lib/i18n.ts` |
| Data fetching | Hand-rolled `fetch` wrapper; **no React Query / SWR / Zustand / Redux** | `lib/api.ts` |
| Tests | `scripts/test-all-routes.ts` (route smoke via `tsx`). No Jest/RTL/Playwright | `package.json` |
| PWA | **None.** No manifest, no service worker, no `next-pwa` | — |

Page counts: 191 total = 60 student AI tools + 61 teacher AI tools + 19 legacy `tools/*` + 21 admin + 10 institution + 8 student core + 6 teacher core + 3 auth + home/error/loading/not-found.

### 1.2 Design system (`app/globals.css`)

Tokens under `:root`:
- Palette `--bg #f1f5f9`, `--surface #fff`, `--surface-2/-3`; text `--text #0f172a`, `--text-muted`, `--text-soft`; borders `--border`, `--border-strong`.
- Accent indigo/violet: `--accent #6366f1`, `--accent-hover #4f46e5`, `--accent-soft #eef2ff`, `--accent-text #4338ca`.
- Semantic pairs with soft backgrounds: `--success/-soft`, `--error/-soft`, `--warning/-soft`, `--info/-soft`.
- **Role colours** — `--student-color #7c3aed`, `--teacher-color #0891b2`, `--admin-color #d97706`, `--inst-color #059669`. Used consistently for portal identity (sidebar dots, badges, metric numbers).
- Shadows `--shadow-xs|sm|(base)|lg`; layout `--sidebar-width 230px`, `--topbar-height 60px`; radii `--radius-xs 4px … --radius-xl 20px`; `--transition 150ms ease`.
- Base font size **14px**, `font-family: 'Inter', 'Noto Sans Devanagari', system-ui` — one stack serving Latin + Devanagari, loaded from Google Fonts via `@import` in CSS.

Class vocabulary (what a port must reproduce): `.app-layout/.sidebar/.sidebar__*/.main-area/.topbar/.page-content`, `.page-title/.page-subtitle/.page-header-row/.section-title/.surface-note`, `.card/.card--lg/.section-card/.route-card`, `.hero` + `.feature-grid` (glassmorphic cards on gradient), `.metrics-grid/.metric-card`, `.data-table-wrap/.data-table`, `.tab-bar/.tab/.tab-count/.tab-item`, `.btn` family (`-primary/-secondary/-ghost/-danger/-sm/-icon`) plus legacy aliases `.submit/.button-link/.text-link`, `.badge-*` (incl. per-role variants), `.pill`, `.status-banner[data-tone=error|success|warning|info]`, `.form-grid/.filter-grid/.field-group/.text-input/.select-input/.textarea-input/.checkbox-row/.search-input`, `.scope-links/.scope-link[data-active]`, `.locale-switcher`, `.collection-grid/.collection-card/.collection-meta/.card-action-row`, `.detail-list/.detail-item(--button|--compact)`, `.split-layout`, `.markdown-shell/.sketchfab-shell/.preview-shell`, `.exercise-bank-list/.exercise-card__header`, `.avatar`, `.empty-state`, `.management-shell`.

Active state is expressed with **`data-active="true"` attributes**, not class toggling — a small but nice pattern (`.tab[data-active="true"]`, `.scope-link[data-active="true"]`, `.sidebar__nav-item[data-active="true"]`).

Responsive: single `@media (max-width: 768px)` block — sidebar slides off-canvas via `.sidebar.open`, grids collapse to 1 col, metrics to 2 cols. **The off-canvas toggle has no hamburger button anywhere in the app**, so mobile web currently has no way to open the sidebar. Real gap to avoid repeating.

### 1.3 App shell, layouts, navigation

`app/layout.tsx` → `NextIntlClientProvider` → `AppChrome` wraps **every** route (including auth, which then covers it with a `position:fixed; z-index:200` gradient overlay in `app/(auth)/layout.tsx` — a hack, not a real route group split).

`components/shared/AppChrome.tsx` (25 lines): `.app-layout` = fixed `<Sidebar/>` + `.main-area` (sticky `.topbar` with `LocaleSwitcher` + static `"U"` avatar, then `<main class="page-content">`).

`components/shared/Sidebar.tsx` (231 lines) is the real navigation brain:
- Inline SVG icon dictionary (`Icons.home/book/sparkles/practice/map/cube/user/users/chalkboard/layers/upload/settings/building/import/tag/bar_chart/live/paper/logout/help/grid/key`) rendered by a tiny `<Icon d={…}/>` primitive — no icon package.
- Four nav arrays: `studentNav` (7), `teacherNav` (5), `adminNav` (11), `institutionNav` (7).
- **Role is inferred from the URL prefix** (`getRole(pathname)`), not from the JWT — so the sidebar always matches the section you're in.
- **Portal switcher** in the footer: `ALL_PORTALS` filtered by the *stored* role (`student|teacher|super_admin|institution_admin`), each with a coloured dot. Hidden when the user only has one portal.
- Footer user block: initials avatar computed from stored `full_name`, role label, logout icon button that clears tokens and `router.replace("/login")`.

Section layouts (`app/(student|teacher|admin|institution)/layout.tsx`) are 4-line pass-throughs to `components/shared/SectionLayout.tsx`, which **ignores its `area`/`description` props and renders `<>{children}</>`** — dead abstraction.

### 1.4 Auth flow

| Piece | Behaviour |
|---|---|
| `middleware.ts` | Public prefixes `/login`, `/register`, `/forgot-password`. Everything else requires cookie `sahayatri_auth`; otherwise redirect to `/login?from=<path>`. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `icons`, `fonts`, `images`. |
| `lib/auth.ts` | Stores `access_token`, `refresh_token`, `user_role`, `user_name` in **localStorage**, and mirrors the access token into a **non-httpOnly cookie** (`SameSite=Lax`, 7-day max-age) purely so middleware can gate server-side. `getDefaultRedirect(role)` → `/teacher/dashboard`, `/admin/dashboard`, `/institution/dashboard`, else `/student/dashboard`. |
| `lib/api.ts` | Auto-attaches `Authorization: Bearer` from localStorage; sets JSON content-type unless body is `FormData`; `cache: "no-store"` default; extracts `message` from error JSON; treats 204 as `undefined`. |
| Login | `POST /auth/login/`, persist tokens, then redirect to `?from` or role default. |
| Register | 4-role selector (student/teacher/institution) with a **3-step institution wizard**: (1) institution name/type/district/phone — district is a hardcoded 15-item Nepal list; (2) admin account; (3) plan selection fetched from `/subscription/plans/` with a "🎉 14-Day Free Trial · No card required" banner and NPR pricing cards. Step progress = three flex bars filling with `--accent`. |
| Forgot password | `/forgot-password` page present (130 lines). |

**Security notes for the port:** no refresh-token rotation on 401 anywhere in the client; token readable by JS in both localStorage and cookie; middleware only checks token *presence*, never validity or role, so route-level authorization is entirely server-side.

### 1.5 Web route inventory

Auth + root:

| File | Route | Purpose |
|---|---|---|
| `app/page.tsx` → `HomeHero` | `/` | Marketing hero: gradient banner, "AI-Powered Education for Nepal 🇳🇵", 4 glass feature cards (Voice Tutor, Doubt Solver, Whiteboard AI, Content Ingestion), 3 portal CTAs + 4 coloured quick-link tiles |
| `app/(auth)/login/page.tsx` | `/login` | Email/password, error box, demo-credential hint |
| `app/(auth)/register/page.tsx` | `/register` | Role select + 3-step institution onboarding + plan picker |
| `app/(auth)/forgot-password/page.tsx` | `/forgot-password` | Reset request |
| `app/loading.tsx` / `error.tsx` / `not-found.tsx` | — | Branded spinner (📚 + `लोड हुँदैछ…`), 🙁 error with retry + `गृहपृष्ठ`, `404 पृष्ठ फेला परेन`. All three use **Tailwind class names that no stylesheet defines** — they render unstyled |

Student (`/student/*`):

| File | Route | Purpose |
|---|---|---|
| `student/dashboard/page.tsx` | `/student/dashboard` | Greeting from `/student/dashboard/`, 4 metric cards (enrollments/subjects/topics/exercises), "Quick Access" 5-card grid, "AI Tools" 7-card grid |
| `student/chapters/page.tsx` | `/student/chapters` | Master–detail: subject filter chips → 280px topic list (Ch N, Nepali subtitle, word count) → `ChapterReader` markdown pane + collapsible `<details>` "View in Nepali (नेपाली)" |
| `student/chapters/[topicId]/page.tsx` | `/student/chapters/:topicId` | Chapter detail: metadata (learning objectives, Bloom levels), full markdown, per-chapter exercise blocks. **Requires `?studentId=` query param or errors** — legacy scoping |
| `student/practice/page.tsx` | `/student/practice` | Exercise-block practice across enrolled subjects |
| `student/learning-path/page.tsx` | `/student/learning-path` | **SM-2 spaced repetition review**: stats (total/due now/learning/graduated), one card at a time, "Show Answer" then 6 quality buttons (0 Blackout → 5 Easy) → `POST /student/spaced-rep/cards/:id/review/`; 🎉 session-complete state |
| `student/adaptive-path/page.tsx` | `/student/adaptive-path` | AI-recommended study order: 4 metrics (overall %, needs reinforcement, not started, in progress), Recommended/All tabs, per-topic row with chapter pill, progress bar, ease badge (Strong/Moderate/Needs work from `avg_ease`), the AI's `reason` text, "✨ Practice" → generates an exercise into a modal, "Study →" deep-link |
| `student/3d-models/page.tsx` | `/student/3d-models` | Model library: search + subject chips with emoji (🧬⚗️⚡📐💻🔬🌍📚), card grid |
| `student/3d-models/[modelId]/page.tsx` | `/student/3d-models/:id` | **Immersive full-screen dark viewer** (`position:fixed; inset:0; #080818`): gradient top bar with subject/class/hotspot-count chips, `ModelViewer3D` with AR + hotspots, right slide-in drawer (Info / Annotations / Quiz tabs), view tracked once via `POST …/view/` |
| `student/3d-models/[modelId]/quiz/page.tsx` | `/student/3d-models/:id/quiz` | Split: Sketchfab iframe + Bloom-coloured question cards with per-question answer reveal |
| `student/profile/page.tsx` | `/student/profile` | Gamification profile: 🎓 hero with XP/level/streak🔥/rank, XP→next-level progress bar, tabs Badges / XP History / Leaderboard (🥇🥈🥉, current user row highlighted + "(you)") |
| `student/ai-tools/page.tsx` | `/student/ai-tools` | Tool catalog: search box, 6 category pills with counts (All/Core Learning/Exam Prep/Adaptive/Creative & Research/Wellbeing), hover-lift cards with emoji + `AI`/`CHAT` badges, 🔍 empty state with "Clear search" |
| `student/ai-tools/<60 slugs>/page.tsx` | `/student/ai-tools/:slug` | 11-line prop-config pages over 9 templates (§1.6) |
| `student/tools/<10 slugs>/page.tsx` | `/student/tools/:slug` | **Legacy/orphaned** Tailwind-styled prototypes (math-solver, mock-test with countdown timer, flashcard-generator, socratic-tutor, concept-explainer, chemistry-solver, essay-helper, feedback-writer, revision-planner, emotion-coach). Not in sidebar, superseded |

Teacher (`/teacher/*`):

| File | Route | Purpose |
|---|---|---|
| `teacher/dashboard/page.tsx` | `/teacher/dashboard` | 4 metrics, 7 AI-tool cards, 3 quick-nav cards, prominent "Start Live Class" CTA. **Resolves "the teacher" by taking `admin/users/?role=teacher` item[0]** — demo-grade |
| `teacher/classes/page.tsx` + `[id]` | `/teacher/classes(/:id)` | Assigned classes, subject coverage, exercise readiness |
| `teacher/materials/page.tsx` | `/teacher/materials` | Study materials CRUD: search, type filter, type-coloured cards (PDF/DOC/PPT/IMG/OTHER + emoji), human file sizes. **Upload is URL-paste only — "Direct upload coming soon"** |
| `teacher/live-class/page.tsx` | `/teacher/live-class` | Session host: `POST /whiteboard/sessions/` → 6-char code, fake grid "QR" + big letter-spaced code + copy button, join URL, "Open Whiteboard" `?code=&teacher=1`, End Session with confirm. Includes a **numbered 5-step "How It Works"** panel and a 5-item "Teaching Tips" panel |
| `teacher/community/page.tsx` | `/teacher/community` | Teacher social feed: post types (📋 lesson_plan / 📝 worksheet / 📁 resource / 💡 tip), type filter pills, create form with comma-separated tags, **optimistic like with rollback on failure**, relative timestamps |
| `teacher/ai-tools/page.tsx` | `/teacher/ai-tools` | Same catalog shell as student; categories All/Lesson Planning/Assessment & Feedback/Communication/Whiteboard AI/Professional Dev |
| `teacher/ai-tools/<61 slugs>/page.tsx` | `/teacher/ai-tools/:slug` | Prop-config pages over 11 templates (§1.6) |
| `teacher/tools/<9 slugs>/page.tsx` | `/teacher/tools/:slug` | **Legacy** prototypes; notable: `video-generator` polls `/ai/tools/video-generator/status/:id/` every 4s and renders a 6-stage pipeline (script→images→tts→ffmpeg→upload→complete) with progress bar |

Admin (`/admin/*`, 21 pages):

| Route | Purpose |
|---|---|
| `/admin/dashboard` | 7 platform metrics + 9 quick-action cards |
| `/admin/import-hub` | **Textbook ingestion command centre** (467 lines): summary strip (imports total, institution uploads, approved blocks, pending review, published, published this month, textbook jobs), PDF upload form (class grade, subject, book title EN/NE, publisher, edition, curriculum type NEB, language, total pages, "queue processing" toggle), then job rows with `progress_percent`, status pill (`awaiting_review`/`published`/`uploaded`), exercise counts (total/pending/approved/rejected/published), top-4 exercise-type breakdown, and 4 review deep-links |
| `/admin/import-hub/:jobId/progress` | Stage timeline (`stages[]` with key/label/status/detail) + `recent_activity[]` |
| `/admin/import-hub/:jobId/structure` | Chapter structure review: per-chapter Approve/Reject/Edit + Approve All |
| `/admin/import-hub/:jobId/exercises` | Exercise review (433 lines): checkbox multi-select, sticky bulk action bar, filter tabs All/Pending/Approved/Rejected, rendered markdown+math per block |
| `/admin/import-hub/:jobId/publish` | Publish to chapter content + exercise bank |
| `/admin/chapter-context` + `[topicId]` | **"Chapter AI Context Manager"** — generate deterministic draft knowledge bases from published chapter markdown, then review/approve for AI grounding |
| `/admin/content/classes` | Class grades CRUD (level, label, Nepali, curriculum) |
| `/admin/content/subjects` | Subjects CRUD with class filter |
| `/admin/content/topics` | Topics/chapters CRUD with subject filter |
| `/admin/content/exercises` | `ExerciseBankClient` (721 lines) — filter, bulk-tag, delete |
| `/admin/institutions` + `[id]` | Institution CRUD, activate/deactivate; detail page (518 lines) manages classes + student enrollment |
| `/admin/users` + `[id]` | User management with role filter tabs |
| `/admin/subscriptions` | Plans and token limits |
| `/admin/simulations`, `/:modelId`, `/analytics` | 3D model CRUD, annotation + quiz manager, view-count analytics |
| `/admin/sketchfab` | Older/parallel 3D model library page (387 lines) — duplicate of `/admin/simulations` |

Institution (`/institution/*`, 10 pages):

| Route | Purpose |
|---|---|
| `/institution/dashboard` | 6 metrics (classes, students, teachers, exercise blocks, AI sessions, paper uploads) + 6 management cards |
| `/institution/classes` + `[id]` | Class sections, enrollment, teacher assignment |
| `/institution/students` | Roster + add student → assign to class section |
| `/institution/teachers` | Roster + assign to class and subject |
| `/institution/reports` | Delivery coverage, roster readiness (353 lines) |
| `/institution/paper-upload` + `/:uploadId/exercises` | Private question-paper upload → AI extraction → review → push to private exercise bank. Multipart PDF upload; **auto-fills paper title from the filename**; drafts separated by `---` |
| `/institution/api-keys` | SMS/integration API key management: create/revoke/reveal/copy, endpoint documentation table (several marked "coming soon") |
| `/institution/parent-portal` | Parent view: child profile card, tabs Overview/Attendance/Results/Notices. **Child is resolved by pasting a student UUID and a hardcoded `DEMO_STUDENT_ID` default**; attendance/results tabs just render the backend's `message` string |

### 1.6 The AI tool template system (the highest-value pattern)

Every one of the 121 tool pages is ~11 lines: `"use client"` + import a template + return it with props. Example (`student/ai-tools/voice-tutor/page.tsx`):

```tsx
<AiChatPage
  title="Voice Tutor" icon="🗣️" accentColor="#2563eb"
  description="Conversational chapter tutor backed by published textbook context and voice support."
  endpoint="/ai/voice-tutor/chat/"
  placeholder="Ask your question or tap the mic to speak…"
  enableSpeech={true}
  helpText="Select your chapter for textbook-grounded tutoring. Use the mic button to speak."
  initialMessage="Namaste! मैं तपाईंको voice tutor हुँ। आफ्नो chapter छान्नुस् र कुनै पनि प्रश्न सोध्नुस्।"
/>
```

These pages are **machine-generated** by `web/scripts/gen-ai-pages.mjs`, which holds the full `STUDENT_TOOLS` / `TEACHER_TOOLS` definition arrays (slug, component, import path, props string, function name) and writes the tree. The catalog *listing* is separately server-driven from `GET /ai/tools/?role=student|teacher`, returning `{slug, name, description, icon, category, frontend_path, badge, is_premium, ui_type}` — so the grid and the routes stay in sync by convention.

Student templates (`components/student/ai/`), all sharing `useStudentAiTool(endpoint)` + `AiShared.tsx`:

| Template | Lines | UI shape | Tools using it |
|---|---|---|---|
| `AiChatPage` | 249 | Bordered chat panel: topic bar → messages → input row. Bubbles with asymmetric radii, 3-dot typing animation, follow-up suggestion chips, "✓ Based on your chapter" trust badge, mic record→transcribe→auto-send, 🔊 speak-latest with inline `<audio autoPlay controls>`, Clear chat | voice-tutor, socratic, concept-explainer, interview-practice |
| `AiFlashcardsPage` | 191 | Generator form (chapter, −/+ card count 3–30, optional custom source text) → **3D flip card** (`perspective:1000` + `rotateY(180deg)` + `backfaceVisibility`), Prev/Next, dot strip showing reviewed cards, `n/N reviewed` counter, Restart. Includes a text→flashcard **parser fallback** (`Q:/A:/Front:/Back:/Hint:`) when the API returns prose | flashcards |
| `AiDoubtPage` | 143 | Segmented **Type Doubt / Upload Image** toggle; dashed drop-zone label that swaps to a preview thumbnail; two-column layout that appears only once there's an answer; Copy button | doubt-solver |
| `AiSolverPage` | 141 | Subject-coloured "MATH/CHEMISTRY/PHYSICS SOLVER" badge, Ctrl+Enter hint, then **line-classified output**: `Step N` lines become numbered circular-badge rows, `Answer/Final/∴/Therefore` lines become a boxed highlighted answer | math-solver, physics-solver, chemistry-solver |
| `AiExamPage` | 148 | Optional difficulty (Easy/Medium/Hard/Mixed) + question count, "EXAM PREP" badge, section-split output | exam-prep, mock-test, neb-prep, mastery-checker, mcq-strategy, marks-distribution, last-day-revision, exam-vocab, past-exercise |
| `AiPlannerPage` | 137 | Goal input + optional days selector / exam date | revision-planner, goal-setter, focus-timer, time-management-coach, learning-path-advisor |
| `AiWellbeingPage` | 148 | Gradient calm surface, 2-col **emoji feeling picker** (😔😰😡😴😊😭) or free text, "Get Support" → 💙 affirmation panel, "Start again", and a persistent footer: "🔒 Your responses are never stored or shared. This is a safe, private space." | gratitude-journal, motivation-coach, stress-management (+ standalone `emotion-check`) |
| `AiWritingPage` | 123 | Writing modes, language toggle, input/output labels | essay-helper, grammar-corrector, spelling-checker, translation, poetry-helper, creative-writing, presentation-script, long-answer-structurer, short-answer-practice |
| `AiContentPage` | 98 | Generic single-input → text result | summary, key-points, mind-map, formula-sheet, definition-finder, analogy-finder, example-generator, counter-example, debate-builder, project-ideas, research-starter, science-experiment, history-storyteller, geography-explorer, career-explorer, current-events |
| `AiAnalysisPage` | 128 | Input + analysis result framing | weak-topics, knowledge-gap, mistake-analyzer, prerequisite-checker, blooms-progressor, progress-visualizer, adaptive-practice |

Teacher templates: `TeacherAiWorkspace` (773 lines — structured renderers for `lesson_plan`, `quiz_items`, `question_paper` with sections + answer key, `rubric` criteria matrix, `feedback`), `TeacherPresentationWorkspace` (339 — parses `Slide N:` / markdown headings into a coloured slide deck preview), `TeacherDocumentWorkspace` (318 — recipient + details + tone selector formal/friendly/concise, doc icon empty state), `TeacherDiagramWorkspace` (294 — parses headings into accent-coded sections for concept maps/Venn/timeline/comparison), `TeacherAnalyticsWorkspace` (283 — **regex-extracts Average/Median/Highest/Lowest/Pass rate/Std dev out of the AI's prose into a metrics strip**), plus the lighter `teacher/ai/Teacher{Assessment,Classroom,ContentAdapt,LessonSupport,ProfDev}Page`.

Shared result-surface primitives worth copying verbatim (`AiShared.tsx` / `TeacherShared.tsx`): `TopicSelector` (subject select → chapter select → selected-chapter pill), `ResultText` (scrollable pre-wrap panel with floating Copy), `ContextBadge` ("✓ Based on your chapter context"), `FollowUpChips` ("Try next:" + clickable prompt chips), `ErrorBanner` (dismissible red bar).

**Scope-selection asymmetry to fix on port:** student tools scope by `subject → topic` from the logged-in student. Teacher tools scope by `institution → teacher → subject → topic` in a **4-level cascading selector that starts from `GET /admin/institutions/`** — i.e. teacher tools are wired as an admin-impersonation demo, not as "me, the logged-in teacher".

### 1.7 Realtime / streaming / uploads / offline

- **No token streaming.** All AI calls are single `POST` → full JSON. The "streaming" feel is faked with a CSS 3-dot typing indicator while the request is in flight.
- **No WebSocket in the web app at all.** Live-class UI only mints a session code; the actual realtime board is the Flutter client.
- **Polling** exists in exactly two places: `teacher/tools/video-generator` (4s job status) and the mock-test countdown timer. The import hub's `progress_percent` is **not** polled — it needs a manual reload.
- **Uploads:** PDF multipart in `/admin/import-hub` and `/institution/paper-upload`; image multipart in the doubt solver; audio blob multipart from `MediaRecorder`. No drag-and-drop, no chunking, no upload progress bar anywhere. `AiDoubtPage` is the only one with a styled drop-zone; the rest are bare `<input type="file">`.
- **Voice:** `navigator.mediaDevices.getUserMedia` → `MediaRecorder` with codec negotiation (`audio/webm;codecs=opus` → `audio/mp4` → default), blob → `POST /ai/voice-tutor/transcribe/` with `language=ne`, transcript auto-fills and auto-sends; TTS via `POST /ai/voice-tutor/speak/` → blob → `URL.createObjectURL` → `<audio autoPlay controls>`, with `revokeObjectURL` cleanup on unmount.
- **PWA/offline: none.** No manifest, no service worker, no cache strategy, no offline banner. Only the Flutter whiteboard is offline-first.

### 1.8 i18n reality check

`i18n/request.ts` supports `en|ne|hi` from cookie `locale`; `lib/i18n.ts` (used by the root layout) supports only `en|ne`. `LocaleSwitcher` writes the cookie and does a **full `window.location.reload()`**. Namespaces in `en.json`/`ne.json` (166 lines each, fully parallel): `Common`, `Home`, `Auth`, `Dashboard`, `AITools`, `Simulation`, `Quiz`, `Whiteboard`, `Subscription`, `Admin`, `Gamification`, `AdaptivePath`, `Errors`, `Toast`. `hi.json` has only `Common` + `Home` (17 lines).

The catalog contains exactly the right things — ICU-style interpolation (`"welcome": "Welcome back, {name}!"`, `"streak": "{days}-day streak"`, `"priceNPR": "NPR {price}/mo"`), a full `Errors` set (network/unauthorized/forbidden/notFound/serverError/rateLimited/invalidInput/insufficientTokens/featureUnavailable) and a `Toast` set (saved/deleted/copySuccess/copyFail/sessionExpired/uploadSuccess/uploadFail). **But `useTranslations` is called in exactly one component (`LocaleSwitcher`).** Every page hardcodes English. Meanwhile `error.tsx`, `loading.tsx`, `not-found.tsx` are hardcoded *Nepali*. Net effect: the app is bilingual on paper, English-with-Nepali-error-pages in practice.

Nepali-specific helpers that *are* real, in `lib/utils.ts`: `formatDate(iso, "ne-NP")`, `formatNPR()` → `रू १२,५००` via `Intl.NumberFormat("ne-NP", {currency:"NPR"})`, `nepaliNumerals()` ASCII→देवनागरी digit map, `timeAgo()`, `truncate()`, `parseMarkdown()` strip-to-text, `tokenCostBadge(cost)` → green ≤10 / amber ≤50 / red, `classifyExerciseType()` → `mcq|short|long|fill|true_false`. Content itself is bilingual at the data layer: topics carry `title_nepali`, chapters carry both `content_markdown` and `content_markdown_ne`, models carry `title_ne`/`description_ne`, plans carry `name_ne`.

### 1.9 Accessibility

Thin. `aria-label` appears on ~15 elements total (sidebar `nav`, locale switcher, a few SVGs marked `aria-hidden`). Positives: `<table>` with real `<thead>/<th>`, `<label>` bound to inputs in the CSS-class forms, `:focus` ring (`box-shadow: 0 0 0 3px rgba(99,102,241,0.12)`) on all `.text-input/.select-input/.textarea-input`, `<details>/<summary>` for the Nepali translation toggle. Negatives: icon-only buttons rely on `title` not `aria-label`; tabs are plain `<button>`s without `role="tab"`/`aria-selected`; modals (adaptive-path exercise, admin CRUD) have no focus trap, no `role="dialog"`, no Escape handler — only click-outside; emoji used as sole meaning carrier in many badges; no skip-link; the mobile sidebar is unreachable.

---

## 2. Mobile app (`Sahayatri/mobile`) — Flutter, Android-only

**Scale:** 37 Dart files, 6,234 lines. Android manifest only (no iOS runner configured — `PROGRESS.md` lists iOS as pending).

### 2.1 Architecture

| Concern | Implementation |
|---|---|
| Entry | `main.dart` → `ChangeNotifierProvider(AuthProvider()..initialize())` → `buildMobileApp()` |
| Navigation | **Flat `Map<String, WidgetBuilder>` in `MaterialApp.routes`** — no go_router, no nested shells, no bottom nav bar. Navigation is `Navigator.pushNamed` from list tiles |
| State | `provider` `ChangeNotifier`. Only `AuthProvider` is real (56 lines); `AiProvider` (8) and `SubjectProvider` (9) hold hardcoded demo lists and are never registered in the widget tree |
| Theme | `core/theme.dart`: Material 3, `ColorScheme.fromSeed(Color(0xFFD97706))` amber seed, scaffold `#F6F2E8` warm paper. **This clashes with every screen**, which hardcodes the web's indigo/violet (`#6366F1`/`#7C3AED`) or its own palette (`#1A237E`, `#FF8F00`) inline |
| HTTP | **Raw `dart:io` `HttpClient`** hand-rolled — including a manually assembled multipart body with a custom boundary. No `http`/`dio` package in the mobile pubspec. 12s connect / 20–25s response timeouts |
| Config | `core/constants.dart` uses `String.fromEnvironment('API_BASE_URL')` (default `http://10.0.2.2:5000/api` for the Android emulator) and `WS_BASE_URL`; `defaultLanguage = 'ne'` |
| Storage | `shared_preferences` via `LocalStorageService` — keys `sahayatri_token`, `_refresh`, `_user_id`, `_role`, `_name`, `_email`. Plus a vestigial in-memory `_cache` map |
| Push notifications | **None.** No FCM, no `firebase_messaging`, no local notifications |
| Deps | `provider`, `shared_preferences`, `audioplayers`, `flutter_markdown`, `flutter_math_fork`, `image_picker`, `path_provider`, `record`, `webview_flutter`, `model_viewer_plus` |
| Permissions | `CAMERA`, `INTERNET`, `RECORD_AUDIO`; `usesCleartextTraffic="true"` (dev convenience, must not ship) |
| Native features | Mic recording (`record` → AAC-LC 128kbps/16kHz `.m4a` into temp dir), audio playback (`audioplayers`), camera + gallery image picking (`image_picker`, quality 92), WebView (Sketchfab), `model_viewer_plus`. **No background execution, no offline DB (no sqflite/Hive/Isar), no biometric, no file download** |

### 2.2 Screen inventory (14 routes)

| Route | File | Lines | State |
|---|---|---|---|
| `/` | `home_screen.dart` | 147 | Real. Auth gate: `AuthState.unknown` → spinner, unauthenticated → `pushReplacementNamed(login)`. Gradient welcome banner with initials avatar + role, then 6 `AiToolCard` tiles (Dashboard, AI Tools, Exercises, Practice Quiz, 3D Viewer, Profile) |
| `/login` | `login_screen.dart` | 289 | Real. Dark `#1B2430` background, gradient "S" logo tile, white card with `Form` + validators, password visibility toggle, inline error box, spinner-in-button. **Ships a visible demo-credentials panel (`student@sahayatri.edu.np / student123`)** |
| `/dashboard` | `dashboard_screen.dart` | 229 | **Fully hardcoded mock.** "7-day streak 🔥", "1,240 XP", three fake progress bars (72/55/88%), three stat cards (24/8/5), and a static 4-item "Today's Tasks" checklist with strike-through. No API call |
| `/ai-tools` | `ai_tools_screen.dart` | 176 | Real hub, partly stubbed. 5 Nepali section headers (🎤 भाषा र सिकाइ सहायक, 📚 अध्ययन सामग्री, ✍️ लेखन र सिर्जना, 🔢 गणित र विज्ञान, 🎯 अभ्यास र मूल्यांकन), 18 coloured tiles. **9 of 18 call `_comingSoon()` → SnackBar `"<name> — छिट्टै आउँदैछ! 🚀"`**. `TokenBalanceWidget` in the AppBar |
| `/voice-tutor` | `voice_tutor_screen.dart` | 509 | Real and the most complete screen. Chat history, EN/NE language switch, mic record → transcribe → auto-send, TTS playback, status messages ("Recording started…", "Transcribing your question…"), `_MetaChip` provider/model/token metadata, optimistic-message rollback on failure (removes the user bubble and restores the text) |
| `/doubt-solver` | `doubt_solver_screen.dart` | 336 | Real. Text or image mode; `image_picker` from **camera or gallery**; scope selector; result card |
| `/chapter-reader` | `chapter_reader_screen.dart` | 289 | Real. Loads `GET /ai/chapter-context/:topicId/?excerpt_chars=1800&include_context_block=true`; renders summary/formulas/mistakes/textbook excerpt as markdown |
| `/exercise` | `exercise_screen.dart` | 235 | Real. Topic exercise blocks |
| `/practice` | `practice_screen.dart` | 383 | Real. One-question-at-a-time card flow with an AppBar `LinearProgressIndicator` bound to done/total, type + marks + "Done ✓" chips, markdown with a custom `_MathBuilder` `MarkdownElementBuilder` for inline LaTeX |
| `/quiz` | `quiz_screen.dart` | 1004 | Real but **the file is duplicated** — `QuizScreen`, `_QuizScreenState`, `_PracticeQuizTab`, `_LiveQuizTab`, `_Question` are each declared twice (lines 8/517 etc.), so it will not compile as-is. Two tabs: `अभ्यास Quiz` (AI-generated via `/ai/quiz-generator/`) and `Live Quiz` (Kahoot-style: name + 6-char code → `GET /quiz/live/:code/`, tap answer → `POST …/answer/`, server-verified `correct`, A/B/C/D circle avatars, progress bar, running अंक, 🎊 end dialog with grade) |
| `/gamification` | `gamification_screen.dart` | 279 | Real, Nepali-first. Title `उपलब्धि तथा पुरस्कार 🏆`; Level + XP card, 🔥 streak pill `N दिन`, XP progress with `Level N+1 का लागि M XP बाकी`, three stat cards (Quiz गरियो / अध्याय पढियो / सही उत्तर), badges grid, leaderboard, refresh action, dedicated `_ErrorView(onRetry)` / `_EmptyView` |
| `/adaptive-path` | `adaptive_path_screen.dart` | 280 | Real. `GET /student/adaptive-path/` → dark card with `प्रगति: n / N topics` + progress bar, then a **step timeline with completion states**; `_ErrorState(onRetry)` / `_EmptyState` |
| `/3d-viewer` | `3d_viewer_screen.dart` | 482 | Real. Model list from `/admin/sketchfab/models/?is_active=true`, cards, then a Sketchfab WebView viewer page |
| `/profile` | `profile_screen.dart` | 156 | Real. Initials avatar, role pill, info card, logout |

### 2.3 Mobile widgets

`AiScopeSelectorCard` (321 lines) is the mobile counterpart of the web `TopicSelector` — but it cascades **institution → student → topic**, again admin-flavoured rather than "the logged-in student". `TokenBalanceWidget` (81) polls `/student/token-balance/` on mount, renders a `Chip` with `1.2k` compaction and turns red under 100 tokens, tap to refresh, silently hides on error. `AiToolCard` (41) — the standard list tile: 44px tinted rounded icon square + title + subtitle + chevron. `ExerciseBlockCard`, `MathRenderer` (`flutter_math_fork` `Math.tex`), `ProgressBar`, `NepaliTextRenderer` (an 11-line no-op that just returns `Text(..., titleMedium)` — the "Nepali typography" is nothing more than the default font stack).

### 2.4 Mobile i18n

**No `flutter_localizations`, no `intl`, no ARB files.** Nepali is hardcoded inline in 5 files (`ai_tools_screen`, `gamification_screen`, `adaptive_path_screen`, `quiz_screen`, `subject_provider`), producing a code-switched register ("अभ्यास Quiz", "Join गर्नुस्", "$streak दिन") that is genuinely how Nepali students talk — but is untranslatable and inconsistent with the English-only screens (`dashboard`, `profile`, `home`, `chapter_reader`).

---

## 3. Whiteboard app (`Sahayatri/whiteboard`) — Flutter, web + Android

**Scale:** 45 Dart files, 3,653 lines. Ships as a **separate deployable**: multi-stage `Dockerfile` (Flutter → `flutter build web --release` → nginx with SPA fallback + 1y static cache), served at port 8090 per `compose.yaml`, and reached from the web app via `/whiteboard?code=XXXXXX&teacher=1`.

### 3.1 What it is and who it's for

An **offline-first digital blackboard for interactive flat panels (IFP) and tablets**, aimed at Nepali classrooms: the teacher writes on the board as normal, and the board itself can solve, explain, narrate and visualise. It is **standalone, not paired with the mobile app** — separate Flutter project, separate providers, own auth-less local mode, own token read (`sahayatri.access_token` from SharedPreferences) for cloud saves. The mobile app has no board/canvas code at all. Pairing is only by session code/QR at the *session* level.

Pedagogically it targets the three moments a Nepali teacher loses time: (1) re-deriving a worked solution → **Math Solver** on the board; (2) explaining a diagram a student points at → **Circle-to-Search**; (3) building visual aids by hand → **AI PPT outline** and **Sketchfab 3D** in a side panel. Plus TTS narration so the board can read Nepali aloud, and PNG export so students get the exact board they saw.

### 3.2 Feature set

| Area | Implementation | File |
|---|---|---|
| Canvas | `perfect_freehand` pressure-style stroke tessellation inside one unified `CustomPainter`; `ShapePainterWidget` and `ElementRenderer` are transparent pass-throughs kept only to preserve the widget tree | `widgets/canvas/stroke_painter.dart` (285) |
| Tools | Pen / Eraser / Text / Shape (rectangle, circle, line); 7-colour palette; stroke-width slider 1–18 | `widgets/toolbar/{main_toolbar,pen_options,color_picker,shape_picker}.dart` |
| Model | `BoardElement{id, type, points[], color, strokeWidth, shapeKind, shapeStart/End, text, textPosition}` with full `toJson`/`fromJson` | `models/board_element.dart` |
| Pages | `BoardState{currentPage, pages: List<List<BoardElement>>}`; horizontal **page strip** with `P1 P2 …`, tap to switch, **long-press to delete**, `+` to add | `screens/board_screen.dart` |
| Undo/redo | Snapshot stacks of the whole `pages` structure, **bounded to 50** entries, redo cleared on new edit | `providers/board_provider.dart` (246) |
| Erase | Hit-tests strokes by point distance vs `radius + strokeWidth`, shapes by centre distance | same |
| Local persistence | `saveLocal()`/`loadLocal()` → JSON in SharedPreferences key `wb_board_v1`; `loadLocal()` runs on first frame so the board survives restarts with **no account** | same |
| Cloud boards | `BoardService`: `POST/GET/PUT/DELETE /whiteboard/boards/` with `title`, `board_data`, `thumbnail_url`, `is_public`, `subject_id`, `topic_id`, `session_id`; Bearer token from SharedPreferences | `services/board_service.dart` |
| Board Library | Grid/list of saved boards, refresh, delete with a Nepali confirm dialog (`Board मेटाउने?` / `मेटाउनुस्`), FAB to create | `screens/board_library_screen.dart` (224) |
| Export | `RepaintBoundary` around the canvas → `toImage(pixelRatio: 2.0)` → PNG → `share_plus` on mobile, documents dir on web/desktop; timestamped filename | `utils/export_utils.dart` |
| AI tool drawer | Bottom panel (max 240px): FilterChips for Math Solver / Concept Explainer / Chemistry Solver, one input, result rendered with `Math.tex` **and an `onErrorFallback` to plain text** | `widgets/ai_panel/ai_tool_drawer.dart` |
| Circle-to-Search | Full-screen overlay over a screenshot of the board at 75% opacity; drag to draw a highlighted circle; on release, base64-encodes the board PNG → `POST /ai/doubt-solver/` with Nepali prompt → bottom sheet with the AI analysis. Instruction bar: `Circle drawn गर्नुस् — AI explain गर्नेछ` | `widgets/ai_panel/circle_search_overlay.dart` (205) |
| AI PPT | Topic + slide count (5/8/10/12/15) + language (नेपाली/English) → `POST /ai/ppt-generator/` → numbered `ExpansionTile` slide outline with bullets + **PPTX download** via an anchor click | `widgets/ai_panel/ai_ppt_panel.dart` (185) |
| 3D panel | Bottom panel (max 340px): model list from `/admin/sketchfab/models/?is_active=true`, then a `webview_flutter` Sketchfab embed (`ui_theme=dark&ui_controls=1&ui_infos=0&ui_watermark=0`) with branded loading state | `widgets/3d_panel/{model_browser,sketchfab_webview}.dart` |
| 3D AI overlay | Annotation list; tap → highlight the mesh; "Explain" → `explainConcept(label)` | `widgets/3d_panel/model_ai_overlay.dart` |
| Sketchfab bridge | Injects HTML that loads the Viewer API, registers a `SketchfabBridge` JS channel, exposes `highlightNode(idOrName)` and `requestScreenshot()` streaming base64 data-URLs back to Dart | `services/sketchfab_bridge_service.dart` (137) |
| TTS | `POST /ai/voice-tutor/speak/` → MP3 bytes → `html.Blob` → `AudioElement` with completion/error `Completer`; `ne`/`en`/`hi` + male/female | `services/tts_service.dart` |
| Offline AI cache | Two-tier: in-memory L1 + SharedPreferences L2 with per-entry `expiresAt`, 24h default TTL, lazy eviction on read, `readSync` for L1-only, `clearAll` by key prefix | `services/offline_ai_cache.dart` (107) |

### 3.3 Realtime protocol

`SocketService` (110 lines) — a **singleton `socket_io_client` v3** wrapper, transports `['websocket','polling']`, `disableAutoConnect` then explicit `connect()` with a 5s poll-wait loop. It multiplexes server events into its own handler registry so multiple widgets can subscribe.

Server → client events forwarded: `user_joined`, `user_left`, `stroke_added`, `stroke_erased`, `element_added`, `element_updated`, `element_deleted`, `board_state`, `cursor_moved`.
Client → server emits: `join_whiteboard{code,name}`, `leave_whiteboard`, `stroke_added{code,stroke}`, `stroke_erased{code,stroke_id}`, `element_added/updated{code,element}`, `element_deleted{code,element_id}`, `board_state_request{code}`, `cursor_move{code,name,x,y}`.

Session lifecycle (`SessionProvider`, 116 lines): host does `POST /whiteboard/sessions/{host_name,title}` → 6-char `code` → socket connect → `joinSession`. Student does `GET /whiteboard/sessions/:CODE/` to validate → connect → `joinSession` → `requestBoardState` for late-join catch-up. `leaveSession` reverts to the offline pseudo-session `code: 'LOCAL', isOnline: false`. Backend keeps rooms in **Redis with a 12h TTL** so they survive multiple workers (`PROGRESS.md` PROD-1).

Session UI: `SessionJoinScreen` with **Host / Join tabs**; host side shows `QrDisplay` — a real `qr_flutter` QR encoding the deep link `sahayatri://whiteboard/join?code=XXXXXX`, plus the code in a pill with 4px letter-spacing and a copy button. `ParticipantList` shows initial-avatar rows with a count, and an explicit "Offline Mode — Start or join a live session to see participants" card when local.

**Honest gap:** the socket layer is fully built but **`BoardProvider` never calls it**. `SessionProvider` only subscribes to `user_joined`/`user_left` for presence. Strokes are never emitted or applied, so today the "live session" shares presence and a code — not ink. `SyncStatusIndicator` is a 13-line hardcoded `Chip(cloud_off, 'Offline')` regardless of state. Likewise `CircleSearchOverlay`, `AiPptPanel`, `TtsService`, `OfflineAiCache`, `ModelAiOverlay` and `SketchfabBridgeService` are all implemented but **not referenced from any screen** — only `AiToolDrawer` and `ModelBrowser` are mounted in `BoardScreen`. `HomeScreen` is a 23-line three-button scaffold that still says "Offline-first whiteboard scaffold".

Also note the whiteboard hardcodes `http://10.0.2.2:5000/api` in **four** places (`core/constants.dart`, `board_service.dart`, `ai_service.dart`, `tts_service.dart`, `circle_search_overlay.dart`, `ai_ppt_panel.dart`) with no `String.fromEnvironment` — the mobile app does this correctly and the whiteboard does not.

---

## 4. UX patterns worth stealing

Ranked by value-to-effort for ASchool.

**1. Template-per-shape + one-file-per-tool AI catalog.** Ten student shapes and ten teacher shapes cover 121 tools. Adding a tool = one 11-line file + one registry row. The registry is *server-owned* (`GET /ai/tools/?role=`), returning `frontend_path`, `category`, `icon`, `badge`, `ui_type`, `is_premium` — so the catalog page, the routes, and plan-gating all key off one source. ASchool's AI Workbench already has a registry + Nutrition Facts; what it lacks is **shape-differentiated result UIs** (chat vs flip-card vs stepper vs slide-deck vs metrics-strip). That is the port.

**2. Chapter-context grounding as a visible trust signal.** Every tool has a `subject → chapter` scope selector, sends `topic_id`, and the response carries `used_chapter_context`. The UI then renders **"✓ Based on your chapter"** in green on the exact message. It converts an invisible RAG detail into student-legible trust — and it pairs with an admin **"Chapter AI Context Manager"** where a human approves the knowledge base before it grounds anything. This is the single most defensible product idea in the codebase and maps cleanly onto ASchool's human-review-required posture.

**3. Follow-up suggestion chips.** Every AI response returns `follow_up_suggestions[]`; the UI renders them under the bubble as "Try next:" chips that pre-fill the composer on click. Near-zero cost, large effect on session depth, and it teaches users what the tool can do without documentation.

**4. Result-shape parsing with graceful degradation.** The client doesn't demand structured JSON — it *parses prose* and upgrades it: `AiSolverPage` promotes `Step N` lines to numbered badge rows and `Answer/∴/Therefore` lines to a boxed answer; `TeacherPresentationWorkspace` splits on `Slide N:` or markdown headings into a coloured deck; `TeacherAnalyticsWorkspace` regexes Average/Median/Highest/Lowest/Pass-rate/Std-dev into a metrics strip; `AiFlashcardsPage` falls back to a `Q:/A:/Hint:` parser when `flashcards[]` is absent; the whiteboard renders `Math.tex` with `onErrorFallback` to plain text. The result never looks broken when the model misbehaves.

**5. Two-panel "form left, result right" that only splits once there's a result.** `gridTemplateColumns: displayResult ? "1fr 1fr" : "1fr"`. Full-width focus while composing, side-by-side for comparison after. Applies directly to ASchool's report/letter/question-paper generators.

**6. SM-2 spaced repetition review UI.** Six explicitly-labelled recall-quality buttons ("0 – Blackout, 1 – Wrong, 2 – Wrong (hint), 3 – Hard, 4 – Good, 5 – Easy") colour-graded red→amber→green, one card at a time, stats strip (total / due now / learning / graduated), and a 🎉 "Session complete — come back tomorrow" terminal state. Plus the "Show Answer" gate before grading. This is a complete, correct implementation of a pattern ASchool's LMS has no equivalent of.

**7. Adaptive-path rows that explain themselves.** Each recommended topic shows the chapter number as a pill, a completion bar, an ease badge derived from SM-2 `avg_ease` (Strong ≥2.5 / Moderate ≥2.1 / Needs work), the card count, **and the AI's `reason` string in the row itself**. Recommendation with a stated justification, not a black box.

**8. Progressive-disclosure empty states that carry the next action.** Not decorative: 🤖 "Ready to help with '<chapter title>'"; 🎉 "All caught up! Add flashcards from the exercise bank" + a "Browse Exercises" button; 🧊 "No models found — try a different subject" + "Clear filters"; 🔍 "No tools found for 'x'" + "Clear search"; 📖 "Chapter Preview — select a topic from the left"; and the honest data-dependency message "No subjects available. Ask your institution admin to assign you to a class." Every empty state names the fix.

**9. Guided onboarding embedded in the feature, not a separate tour.** `teacher/live-class` ships a numbered 1–5 "How It Works" card next to the Start button and a 5-item "Teaching Tips" card once live ("Display the QR on a projector", "Export the board as PNG after the session for student revision"). The institution register flow uses a 3-bar step meter + a trial banner that removes the card-required objection up front. No tour library, no dependency.

**10. Wellbeing UI with a privacy contract.** Emoji-first feeling picker (2-col, 😔😰😡😴😊😭) so a distressed student doesn't have to compose a sentence, a calm gradient surface distinct from the rest of the app, a 💙 affirmation response, an explicit footer **"🔒 Your responses are never stored or shared. This is a safe, private space."**, and a hand-off line pointing to a trusted teacher/family/counselor. ASchool has a `wellbeing` plugin with moods/surveys/counselor — this is the missing student-facing surface, and the privacy statement is the part that makes it usable.

**11. Nepal-native formatting primitives.** `formatNPR()` → `रू १२,५००`, `nepaliNumerals()` ASCII→देवनागरी, `formatDate(..., "ne-NP")`, `'Inter', 'Noto Sans Devanagari'` as a single stack so mixed-script lines don't jump baselines, bilingual content at the *data* layer (`title_nepali`, `content_markdown_ne`, `title_ne`, `name_ne`) with a `<details>` "View in Nepali (नेपाली)" toggle rather than a hard language switch, and a hardcoded Nepal district list in onboarding. The Flutter apps' code-switched register ("अभ्यास Quiz", "Join गर्नुस्", "$streak दिन") matches how Nepali students actually speak — worth keeping as a *translation register*, but via ARB files, not hardcoded.

**12. Offline-first local persistence with no account required.** The whiteboard writes the entire multi-page board to SharedPreferences (`wb_board_v1`) and restores it on first frame, so a teacher on a dead connection loses nothing and never sees a login wall. Paired with the two-tier AI cache (memory L1 + persisted L2 with 24h TTL and lazy eviction) and cloud save as an *upgrade*, not a requirement. This is the right shape for low-bandwidth Nepali schools and ASchool has nothing like it.

Honourable mentions: `data-active="true"` attribute-driven active states instead of class juggling; optimistic like with explicit rollback (`teacher/community`); optimistic chat message removal + text restore on failure (mobile voice tutor); token-balance chip that compacts to `1.2k` and turns red under 100; `tokenCostBadge()` green/amber/red cost signalling before you spend; role-coloured portal switcher with dots; the immersive full-screen dark 3D viewer with a slide-in Info/Annotations/Quiz drawer; multi-stage job UI with a stage-chip pipeline (`script→images→tts→ffmpeg→upload→complete`).

Patterns **not** to copy: `useEffect` + `useState` for every fetch (no cache, no dedupe, no retry — ASchool already has React Query, keep it); ~1,100 lines of hand-written global CSS plus inline styles (ASchool has Tailwind + Radix, keep it); scope selectors that start from `GET /admin/institutions/`; `DEMO_STUDENT_ID` constants and visible demo credentials; a full i18n catalog that nothing reads.

---

## 5. Maturity assessment

### Real and polished (port with confidence)

| Surface | Evidence |
|---|---|
| AI tool catalog + 20 workspace templates | 121 routes generated from a script, all hitting live `/ai/**` endpoints; result parsing, follow-up chips, copy, context badges, error banners all present || Voice Tutor (web + mobile) | Full mic → STT → chat → TTS loop with codec negotiation, cleanup, and rollback-on-error |
| Doubt Solver | Text/image modes, styled drop-zone, camera + gallery on mobile, multipart wired |
| Chapters reader | `react-markdown` + KaTeX, EN/NE dual markdown, master–detail with subject chips |
| Spaced repetition (`/student/learning-path`) | Complete SM-2 review loop against `/student/spaced-rep/**` |
| Adaptive path | Real recommendations + progress + AI reason + on-demand exercise generation |
| Import Hub (4-stage review) | 467 + 302 + 433 + 357 lines of genuine review workflow with bulk approve/reject |
| Admin/institution CRUD | Institutions (518-line detail page), users, classes, subjects, topics, exercise bank (721 lines), subscriptions, API keys |
| 3D model library + immersive viewer | `@google/model-viewer` with computed hotspot slots, AR, drawer tabs; admin annotation/quiz manager; analytics page |
| Teacher community | Optimistic likes with rollback, type filters, create form |
| Whiteboard canvas | `perfect_freehand` strokes, shapes, text, eraser hit-testing, 50-deep undo/redo, multi-page, local persist, PNG export/share |

### Real UI, thin or partial backing

| Surface | Issue |
|---|---|
| `/institution/parent-portal` | Child resolved by pasting a UUID with a `DEMO_STUDENT_ID` default; Attendance and Results tabs render the backend's `message` string ("coming soon") instead of data |
| `/teacher/materials` | Upload is URL-paste; label literally says "Direct upload coming soon" |
| `/institution/api-keys` | Documented endpoints for attendance/results/fees/notices marked "coming soon" |
| Import Hub progress | `progress_percent` and `stages[]` render but never poll — needs manual refresh |
| Whiteboard live session | Socket layer complete, presence works, **stroke sync never wired**; `SyncStatusIndicator` hardcoded to "Offline" |
| `/admin/sketchfab` vs `/admin/simulations` | Two parallel 3D-model manager pages (387 vs 329 lines) |

### Scaffolds, dead code, and bugs

| Item | Detail |
|---|---|
| `mobile/lib/screens/quiz_screen.dart` | **Every class declared twice** (1,004 lines = two near-identical copies). Will not compile |
| `mobile/lib/screens/dashboard_screen.dart` | 100% hardcoded mock data (7-day streak, 1,240 XP, three fake progress bars, static task list) |
| `mobile/lib/screens/ai_tools_screen.dart` | 9 of 18 tiles are `_comingSoon()` SnackBars |
| `mobile/lib/providers/{ai,subject}_provider.dart` | Hardcoded demo lists, never registered in the provider tree |
| `mobile/lib/widgets/nepali_text_renderer.dart` | 11-line no-op wrapper around `Text` |
| `mobile` theme vs screens | Amber M3 seed (`#D97706`) contradicted by inline indigo/violet everywhere |
| `whiteboard/lib/screens/home_screen.dart` | 23 lines, three buttons, text still reads "scaffold" |
| `whiteboard` unmounted features | `CircleSearchOverlay`, `AiPptPanel`, `TtsService`, `OfflineAiCache`, `ModelAiOverlay`, `SketchfabBridgeService` implemented but referenced by no screen |
| `whiteboard/lib/widgets/ai_panel/math_result_card.dart` | 9-line "placeholder" card |
| `whiteboard/lib/utils/{gesture_handler,canvas_math}.dart` | 2 and 8 lines — stubs |
| `whiteboard` API base URL | Hardcoded in 6 files, no build-time define |
| `web/components/shared/{SectionLayout,RoutePlaceholder}.tsx` | `SectionLayout` ignores its props; `RoutePlaceholder` ("This page is scaffolded") is imported by zero pages |
| `web/app/{error,loading,not-found}.tsx` + `components/error-boundary.tsx` | Written with Tailwind class names in a project with no Tailwind → render unstyled |
| `web/app/(student|teacher)/*/tools/*` (19 pages) | Orphaned pre-`ai-tools` prototypes, also Tailwind-classed, not in any nav |
| `web/i18n/hi.json` | 17 lines (Common + Home only) vs 166 for en/ne |
| `web` mobile sidebar | `.sidebar.open` CSS exists; no button anywhere sets it |
| `web/app/(student)/student/chapters/[topicId]` | Hard-errors without a `?studentId=` query param |
| `web/app/(teacher)/teacher/dashboard` | Identifies "the teacher" as `admin/users/?role=teacher` item[0] |
| Tests | Zero component tests in any of the three clients. Web has one route-smoke script; Flutter `test/` dirs are default scaffolds |

Rough split: **~70% of the web app is production-shaped**, ~10% partial, ~20% dead/legacy. **Mobile is ~60% real** with one non-compiling file and a mock dashboard. **Whiteboard is ~50% wired** — the canvas is genuinely good, the AI/realtime layer is built but unplugged.

## 6. Screens/flows ASchool would NOT already have

ASchool is a school ERP (attendance, fees, exams, timetable, notices, library, transport, LMS, website builder, AI workbench/tutor). Cross-referencing Sahayatri's inventory against that, these have no ASchool equivalent and would be net-new plugin surfaces:

1. **AI tool catalog + template factory** — backend-owned catalog (`GET /ai/tools/?role=`), category chips with counts, search, premium/CHAT badges, and shape-differentiated result UIs (chat, flip-card, stepwise solver, slide deck, metrics strip, wellbeing card). ASchool's AI workbench/tutor covers conversational tutoring only.
2. **Chapter-grounded AI answers** — subject→chapter scope selector + `used_chapter_context` provenance badge + context excerpt on every AI response; backed by an admin "Chapter AI Context Manager" with human approval before grounding. (This includes the admin content pipeline's knowledge-base side.)
3. **Voice tutor loop** — mic → MediaRecorder/`record` → server Whisper STT with `language=ne` → chat → edge-tts ne-NP playback, integrated in both web and mobile chat UIs.
4. **Doubt Solver** — photo/scan of any question → stepwise solution (text + image modes, camera/gallery on mobile); extended on the board as Circle-to-Search.
5. **3D simulation library** — Sketchfab/@google-model-viewer browsers with subject filters, immersive fullscreen dark viewer, hotspot AI annotations with node highlighting, model-linked quizzes, view analytics, admin curation.
6. **Collaborative live whiteboard** — a whole client: perfect_freehand canvas, multi-page boards, undo/redo, Socket.IO session protocol (strokes/elements/cursors/presence, Redis rooms, join-by-code/QR), board library with cloud save, PNG export/share, in-board AI math/chem solver, AI PPT outline generator with PPTX download, TTS narration, offline-first persistence + 24h TTL AI cache. Sahayatri's only "live class" concept — no video; the board is the class.
7. **Content ingestion supply chain UI** — institution exam-paper PDF upload → status pipeline (uploaded→pending→approved→rejected→published with progress % and per-type counts) → admin 4-stage import wizard (structure approve/reject → exercise review with bulk actions → progress timeline → publish) feeding both LMS content and AI grounding.
8. **Spaced repetition (SM-2) + adaptive path** — due-card review with 6 quality buttons and stats; AI topic recommendations with ease badges and per-row `reason`, on-demand adaptive exercise generation.
9. **Gamification hub** — XP, levels with progress-to-next, streak days, badge grid, leaderboard with "(you)" highlight; profile page gamified with rank/XP history.
10. **AI token metering UX** — live token-balance AppBar chip (compacts to `1.2k`, red under 100), `tokenCostBadge()` green/amber/red, premium gating surfaced in the catalog, token plans in subscriptions.
11. **Live quiz game** — Kahoot-style join-by-code answering (server-verified, REST-polled on mobile, Socket.IO/Redis on backend) plus AI quiz generation.
12. **Teacher community feed** — peer-to-peer posts (lesson plans/worksheets/resources/tips) with tags, type filters, optimistic likes. Distinct from ASchool notices (admin broadcast).
13. **Nepali localization infrastructure** — full en↔ne catalog (137 keys, ICU interpolation, complete Errors/Toast sets), Devanagari font stack, `nepaliNumerals()`/`formatNPR()`/ne-NP dates, bilingual data-layer content with in-page translation toggle, ne-NP TTS/STT voices.

Conversely, everything in ASchool's ERP domain (attendance, fees, timetable, transport, library, notices, exams/marks management, website builder) is absent from Sahayatri — its institution portal is a content-delivery roster, not an ERP.

---

## 7. UI to build in ASchool (web + app) — port checklist

**Web (`frontend/`, Next.js 14 + Tailwind/Radix)**

- [ ] **AI Workbench catalog**: role-filtered tool catalog page fed by a registry table (slug, icon, category, frontend_path, badge, ui_type, is_premium); category chips with counts; search; hover-lift cards; empty state with clear-search.
- [ ] **Tool template factory**: port the 20 shape templates (chat / flip-cards / doubt-image / stepwise solver / exam-prep / planner / wellbeing / writing / content / analysis + teacher workspace/presentation/document/diagram/analytics) as React components taking a config prop; one thin file per tool; keep server-owned registry as source of truth.
- [ ] **Shared AI result primitives**: TopicSelector, FollowUpChips, "✓ Based on your chapter" ContextBadge, ResultText with Copy, ErrorBanner, Ctrl+Enter submit.
- [ ] **Chat shell**: scope bar, typing indicator, clear-chat, mic record→STT→auto-send, speak-latest with inline audio, optimistic rollback on failure.
- [ ] **Spaced-repetition page**, **adaptive-path page** (self-explaining rows), **gamification page** (XP/level/streak/badges/leaderboard), gamified profile.
- [ ] **3D model library + immersive fullscreen viewer** with annotation drawer + quiz tab.
- [ ] **Paper-upload pipeline UI + 4-stage import wizard** + Chapter AI Context Manager.
- [ ] **Nepali i18n**: wire the full en/ne catalog into ASchool's existing i18n (Sahayatri's keys are reusable verbatim), Devanagari font pairing, numerals/NPR/date utils, LocaleSwitcher (but real message adoption — Sahayatri's mistake was a catalog nobody reads).
- [ ] Nepali error/loading/404 pages (properly styled this time).

**flutter_student**

- [ ] Home with gradient welcome + real streak/XP banner; AI tools hub with TokenBalanceWidget in AppBar; VoiceTutorScreen (record/STT/TTS + meta chips + optimistic rollback); DoubtSolverScreen (camera+gallery); QuizScreen (practice + live join-by-code); GamificationScreen (Nepali-first, triple-state); AdaptivePathScreen (timeline); ChapterReaderScreen; practice flow with inline LaTeX builder; AiScopeSelectorCard.

**flutter_teacher**

- [ ] AI tool workspace pages (lesson plan, worksheet, rubric, quiz/paper generation, parent comms); Live-class launcher (create session → code/QR → end); community feed with optimistic likes.

**Standalone or embedded whiteboard**

- [ ] Port the whiteboard as a 6th Flutter app (or embed the canvas in flutter_teacher + web): perfect_freehand canvas, pages, undo/redo, local-first persistence, Socket.IO session protocol, QR join, AI drawer (math/chem/concept), Circle-to-Search, PPT panel, TTS, offline AI cache, PNG export. **Fix Sahayatri's gaps while porting: actually wire BoardProvider↔SocketService (strokes/elements/cursors), real SyncStatusIndicator state, `String.fromEnvironment` API base, mount the implemented-but-orphaned panels.**

**Anti-patterns to avoid on port** (documented above): unstyled Tailwind classes in a no-Tailwind project; mock dashboards shipped as real screens; duplicate class files (quiz_screen.dart); admin-impersonation scope selectors; demo credentials in login UI; hardcoded Nepali outside i18n; feature panels built but never mounted.

