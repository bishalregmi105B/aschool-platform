# Frontend audit — condensed evidence (153 findings: 26 P0 / 62 P1 / 62 P2 / 3 P3)

Source: Explore agent, read 222 pages + 68 components + lib, 71,549 LOC. No builds run.

## Verified counts
- 222 `page.tsx` (192 under `app/dashboard/`), 235 app `.tsx`, 68 components
- 197/235 app files are `'use client'` — only 38 server components, 33 of which are the public `/school/[slug]/*` tree
- **0** `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`, `template.tsx` in the whole tree
- 0 React error boundaries (`componentDidCatch`/`getDerivedStateFromError` = 0 matches)
- 172 files `useQuery`, 134 `useMutation` (377 mutations), 275 `invalidateQueries` — but only **1** `onMutate` (no optimistic updates)
- 29 files use `useMutation` with **no** `invalidateQueries`
- 30 table pages have **no `isError` handling at all** → API failure renders as "empty"
- 85 pages import `ui/table` and hand-roll scaffolding; 297 `PageLoader` sites; 63 files hand-roll the colSpan empty row; 130 hand-written "No X found"; 131 "Failed to load"; 105 `refetch()` buttons; 54 pages repeat the identical loading→error→empty triad
- 28 files independently define `useQuery(["classes"])`; 12 `["students"]`; 11 `["teachers"]`; 10 `["transport-routes"]`
- 143 files import `sonner` directly, 641 `toast.*` calls, 498 English literals
- 21 `aria-label` total in 71k LOC; **0** other `aria-*`; 1 `sr-only`; 0 skip links
- 188 of 206 `<button>` lack `type=` (default submit); 71 of 72 icon-only buttons unlabeled
- 49 `htmlFor` for 358 inputs and 587 `<Label>` renders → 309 unpaired
- 2 `scope=` across 85 table pages
- react-hook-form + zod in **2 of 38** form files; 22 files submit raw `FormData` with no validation; 50 files hand-roll `useState` forms
- 362 hardcoded hex, 124 `bg-white`, 456 gray/slate/zinc, 420 off-brand blue/indigo/violet, 532 arbitrary `x-[...]`
- 1 `next/image` vs 26 raw `<img>`; 15 `<img>` with no `alt`
- **0** `React.memo` in 71k LOC; 29 `useMemo`; 61 `useCallback`
- 557 `: any` / `as any` despite `strict: true`
- 96 of 222 pages contain zero `sm:`/`md:`/`lg:` prefixes
- 9 test files / 606 lines / 30 cases → **0% coverage of `app/` (52,453 LOC)**

## P0 findings
1. **No error/loading/not-found boundaries anywhere.** Any render throw = raw Next overlay in dev, blank page in prod. 4 routes call `notFound()` with no `not-found.tsx` to render.
2. **Dark mode is unreachable dead code.** `app/globals.css:47-85` has a complete `.dark` token block; nothing ever adds the class. `lib/store.ts:16-17,47-48` declares `theme` + `setTheme` and `useAppStore` is **imported by zero files** (115 lines of dead Zustand).
3. **No i18n framework at all.** No next-intl/react-i18next/lingui in package.json. ~3,634 hardcoded English strings (2,483 JSX text nodes + 653 attributes + 498 toasts). `<html lang="ne">` hardcoded at `app/layout.tsx:20` while the UI is English. `PluginSidebarItem.label_nepali` is typed, sent by the backend, and **never read** (`sidebar.tsx:241-258` uses `item.label` unconditionally) — the Nepali nav labels already exist in the manifests and are discarded. `User.preferred_language` and the store's `language` are read by zero components.
4. **Sidebar has zero mobile behavior.** `components/layout/sidebar.tsx:454-459` is a `sticky top-0 h-screen` aside at fixed `w-[228px]`; no `Sheet`, no `md:`, no drawer, no hamburger. On a 360px phone it eats 63% of the viewport permanently.
5. **25 sidebar routes 404.** All 10 `social-hub` routes (the entire Growth section's flagship), plus `ai-tools/{grade-queue,plagiarism,remarks,settings,usage}`, `analytics/{at-risk,predictions,risk,weekly}`, `benchmarking/{compare,rankings}`, `conferences/{history,slots}`, `portfolio/{achievements,credentials}`.
6. **No command palette for 192 pages.** No `cmdk`. `header.tsx:60-78` search returns *entities*, not routes. 58 top-level items across 12 sections, 155 subitems.
7. **`app/dashboard/settings/roles/page.tsx:9-18` is entirely fake** — hardcoded role array with invented user counts (Teacher 45, Parent 350, Student 420), "Create Custom Role" and 8× "Edit Permissions" have **no onClick**. The whole RBAC page is a mockup.
8. **`app/student/page.tsx` is 100% fabricated** — hardcoded "Class 10A • Roll No. 15", 4 literal stat cards, 6 invented teachers (Mr. Sharma/Ms. Thapa/Mr. Rai/Ms. Gurung/Mr. KC/Mr. Poudel), 3 invented homework items, fake "+50 XP" banner. **Zero API calls.**
9. **`app/page.tsx:551-602` landing demo form is inert** — no `onSubmit`, no state, no action. Every lead discarded.
10. `app/api/revalidate/route.ts:12` — `(secret ?? "") !== (process.env.ISR_REVALIDATE_SECRET ?? "")` authenticates **any** caller when the env var is unset. Open-by-default cache invalidation.

## Role portal reality (direct answer)
| Route | Lines | Reality |
|---|---|---|
| `app/student/page.tsx` | 105 | 100% fake, zero API calls |
| `app/student/homework/page.tsx` | 198 | Real (`/student/assignments`) — the only real student page |
| `app/student/[slug]/page.tsx` | 14 | "Coming soon" for timetable/results/library/lms/ai-tutor (5 of 7 nav links) |
| `app/teacher/page.tsx` | 88 | Real (`/analytics/teacher-dashboard`), no isError, hardcoded "Good Morning" |
| `app/teacher/assignments/page.tsx` | **1** | `export { default } from "../../dashboard/assignments/page"` — admin page in teacher shell |
| `app/teacher/marks/page.tsx` | **1** | Same re-export trick |
| `app/teacher/[slug]/page.tsx` | 14 | "Coming soon" ×4 |
| `app/parent/page.tsx` | 126 | Real (`/parent/dashboard`), but 5 of 6 stat cards link to "Coming soon" stubs; "Bus Status: Live" hardcoded |
| `app/parent/[slug]/page.tsx` | 14 | "Coming soon" for **all 6** links |
| `app/super-admin/page.tsx` | 89 | Real but **1 page is the entire super-admin product** — no school management, no billing, no plugin admin, no tenant switching |
Verdict: portals ~30% real; 15 of 20 sub-routes are placeholder cards.

## Other P1s worth carrying into the plan
- 49 orphan pages unreachable from nav, including the entire `certificates/*` (9 pages) and `communications/*` (8 pages) modules
- 9 deprecated AI plugin slugs alias to `ai_suite` but **each still ships its own manifest with its own sidebar entry** → a school with legacy installs sees up to 9 overlapping "Insights" entries, 5 of which 404
- `globals.css:117-158` `.compact-content` uses **12 `!important`** to shrink h1/h2/h3/text-2xl/xl/lg/base globally — 283 `text-2xl` uses under dashboard silently become 15px. Specificity war against the design system.
- `tailwind.config.js:76` `font-nepali: var(--font-mukta)` — `--font-mukta` is **never defined**, and `globals.css:112` `@font-face src:` points at a **CSS stylesheet URL, not a font file**. Nepali font loading is silently broken; `font-nepali` used by 0 files.
- `app/page.tsx:156-178` and `app/(auth)/layout.tsx:12-23` **re-declare `:root` CSS vars in `<style>` tags**, shadowing globals.css; `app/page.tsx:164` overrides `--card` to `#ffffff` globally
- Three portals invent three unrelated brand colors (student violet-700, teacher emerald, parent blue-700), none touching tokens
- `lib/plugins.tsx:141-147` — plugin-API failure silently empties the sidebar → navless dashboard with no explanation
- `lib/auth-context.tsx:61-63` — 500 on `/auth/me` is indistinguishable from logged-out → redirects authenticated users to /login
- `middleware.ts:59-61` — custom-domain lookup failure serves the **landing page** instead of the school site
- Sequential waterfall on every dashboard load: `/auth/me` → `/plugins/*` → sidebar renders (2 serial round trips before nav paints)
- `fees/collect/page.tsx:307` fetches `per_page:500` and rebuilds a Map on **every render** (`:319-361`, unmemoized); same pattern in `students/transfers`, `students/reset-password`, `students/roll-numbers`
- 5 hand-rolled modals with no `role="dialog"`, focus trap, or Escape (`exams/results:698`, `portfolio:382,470`, `website-builder/pages:290`, `themes`)
- `components/ui/bs-date-input.tsx:51-57` — the primary Nepali date input closes only on outside mousedown; no Escape, no focus trap, no keyboard grid
- Top-level heavy imports: `useExport.ts:16` JSZip, `designer/writer2/page.tsx:22-34` **13 top-level @tiptap imports (~300KB)**, recharts in 3 routes, `docx` in `exportDocx.ts:17-19`
- `sidebar.tsx:270-282` — effect creates a new Set every route change, re-rendering the whole 155-item nav; `eslint-disable exhaustive-deps` hides a stale closure
- `frontend/tsconfig.tsbuildinfo` (289,966 bytes) tracked in git, not ignored
- `.eslintrc.json` is `{"extends":"next/core-web-vitals"}` only — no jsx-a11y, no @typescript-eslint. That's why 188 untyped buttons accumulated.
- `EditorSectionRenderer.tsx:259` `dangerouslySetInnerHTML` with **no sanitize on the builder-draft path** (`website-builder/editor/page.tsx:381`); `ExplorePanel.tsx:156` injects `item.svg` fetched from the API unsanitized (SVG supports `<script>`)
- `app/school/[slug]/layout.tsx:161` `surfaceOverride` built from tenant-controlled `colorOverrides.surface` is **not** run through `sanitizeCss` (the sibling `customCss` is)
- `header.tsx:239` `window.location.href = n.action_url` — server-supplied URL, no origin check (`javascript:` executes)
- `middleware.ts:41-43` treats all of `172.0.0.0/8` as trusted main host (only 172.16-31 is private)
- 4 manifest routes carry query strings; `isActive` compares to `pathname` so they can never highlight
- 152: raw `<a href>` for internal nav in header + all 21 portal nav links → full page reloads losing the React Query cache

## Genuinely well-built (do not rewrite)
- Plugin-driven nav: zero hardcoded sidebar, single-hop-only alias expansion mirroring the backend, `ICON_MAP` registry with safe fallback, PluginGate with inline install used on 114 pages
- Auth: HttpOnly cookies + single-flight refresh + a regression test asserting the token is not JS-readable; middleware "maybe authenticated for routing only" with server-side re-verification in the super-admin layout
- `lib/sanitize.ts` — 119 lines, 48-tag/15-attr allowlist plus a hand-written CSS sanitizer blocking `url()`, `@import`, `expression()`, `behavior:`, `<`, `\` with documented rationale
- Public school sites: the one part using the App Router properly — 33 server components, `fetch` with `revalidate:300` + cache tags, `generateMetadata` + JSON-LD, on-demand invalidation, honest "not found" vs "unpublished" states
- Lazy-loading discipline for fabric/jspdf/pptxgenjs/html2canvas/leaflet/CanvasEditor; `useExport.ts` handles canvas size limits, cross-origin tainting, correct DPI math
- `lib/nepali_date.ts` (188 lines, real BS table) + `bs-date-input.tsx` emitting AD so the backend contract is unchanged
- Comments reference incident IDs (E51, E201, E215, E230, SEC-06) and explain the failure they prevent
- `themes/registry.ts` + `types.ts` (267 lines of typed theme contract) with per-theme license attribution
- login/register are the two forms done right: 3 zod schemas, Nepal phone regex, multi-step with `.refine()`
