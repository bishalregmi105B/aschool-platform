# ASchool Web UI Inventory — Next.js 14 Frontend

Audited: 2026-09-04 · Scope: `/home/bishal-regmi/Desktop/ASchool/frontend` (read-only), cross-checked against backend plugin manifests in `/home/bishal-regmi/Desktop/ASchool/backend/app/plugins/modules/` and `app/plugins/manifests/`.

Legend: **REAL** = functional, wired to live API. **PARTIAL** = renders but incomplete (TODO markers, mock/hardcoded data, fallback content, or thin wrapper). **STUB** = placeholder/redirect-only/coming-soon shell. **REDIR** = intentional alias redirect to a canonical page.

---

## 1. Route inventory (file → URL → purpose → persona → status)

Route count: **~226 page files** (193 under `/dashboard`, 17 public `/school/[slug]`, 4 auth, 4 portal homes, 3 portal section catch-alls, plus api routes, landing, error/loading shells).

### 1.1 Root & auth

| File | URL | Purpose | Persona | Status |
|---|---|---|---|---|
| `app/page.tsx` (730 ln) | `/` | SaaS marketing landing | public | **PARTIAL** — polished but all stats hardcoded ("400+ Schools", "50K+ Students") |
| `app/(auth)/login/page.tsx` (375) | `/login` | Email/password + student login entry | public | **REAL** |
| `app/(auth)/register/page.tsx` (682) | `/register` | School sign-up | public | **REAL** |
| `app/(auth)/verify-otp/page.tsx` | `/verify-otp` | Phone OTP login | public | **REAL** |
| `app/(auth)/reset-password/page.tsx` | `/reset-password` | Password reset | public | **REAL** |
| `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` | — | 404 / error boundaries | all | **REAL** |
| `app/api/revalidate/route.ts`, `app/revalidate-site/route.ts` | — | ISR revalidation webhooks | system | **REAL** |

### 1.2 Admin dashboard (`/dashboard/**`) — school_admin / accountant (role-gated via backend sidebar `visible_to`)

**Core academics**

| File | URL | Status |
|---|---|---|
| `dashboard/page.tsx` | `/dashboard` | **REAL** — `/analytics/overview` KPIs |
| `dashboard/academics/page.tsx` (1119 ln) | `/dashboard/academics` | **REAL** — tabs: years/classes/sections/subjects/class-teachers |
| `dashboard/academics/class-subjects` `class-teachers` | deep tabs | **REAL** |
| `academics/classes`, `class-sections` | → re-export academics page w/ tab | **REDIR/wrapper** |
| `academics/year`, `academics/years` | → redirect `/dashboard/academics` | **REDIR** |
| `academics/subjects` | re-export academics page | **REDIR/wrapper** |
| `dashboard/students/page.tsx` (1060) | `/dashboard/students` | **REAL** |
| `students/new` `/students/[id]` `/students/promote` (469) `/students/roll-numbers` `/students/transfers` `/students/reset-password` `/students/profile-images` | student ops | **REAL** |
| `students/bulk-import` | CSV import | **REAL** |
| `students/guardians` | → redirect `/dashboard/parents` | **REDIR** |
| `dashboard/parents/page.tsx` + `parents/[id]` | guardians mgmt | **REAL** |
| `dashboard/teachers/page.tsx` | teachers | **REAL** |
| `dashboard/teachers/bulk-upload`, `staff/bulk-upload` | → redirect `/dashboard/bulk-uploads/csv` | **REDIR** |
| `dashboard/staff/page.tsx` | staff directory | **REAL but ORPHAN** (0 inbound links; no manifest subitem) |
| `dashboard/attendance/page.tsx` (589) | attendance mark/view | **REAL** |
| `attendance/mark` | client redirect → attendance | **REDIR** |
| `attendance/reports`, `attendance/holidays` | reports/holidays | **REAL** |
| `dashboard/timetable/page.tsx` + `generate` + `teacher` | timetable | **REAL** (teacher view **PARTIAL** — thin) |
| `dashboard/exams/page.tsx` (811) | exam hub | **REAL** |
| `exams/schedule` `marks` (450) `results` (912) `report-cards` `grades` | exam ops | **REAL** (bulk marksheet/report-card PDF via backend) |
| `exams/online` + `online/questions` | online exams | **REAL** (young feature) |
| `dashboard/assignments/page.tsx` (744) | assignments/homework | **REAL** |
| `dashboard/lms/page.tsx` | LMS courses | **REAL** |
| `dashboard/library/*` page+books+catalog+checkout+overdue | library | **REAL** (`transactions` = **REDIR** → `?tab=issues`) |
| `dashboard/elibrary` + `past-papers` + `upload` | e-library/digital content | **REAL** |
| `dashboard/portfolio/page.tsx` (557) | student portfolio | **REAL** |
| `dashboard/certificates/page.tsx` | hub of cards | **PARTIAL** — hub links only, 0 API calls |
| `certificates/students` `staff` `character` `transfer` | generators | **REAL** |
| `certificates/id-settings` `student-id` `staff-id` `templates` | → redirects (designer) | **REDIR** |

**Money / HR**

| File | URL | Status |
|---|---|---|
| `fees/page.tsx` + `types` `structure` `collect` (1652 ln) `defaulters` `scholarships` `reports` | fees suite | **REAL** (collect = POS w/ keyboard shortcuts) |
| `dashboard/admission/page.tsx` (602) | admission CRM | **REAL** |
| `hr/page.tsx` | HR hub | **REAL** |
| `hr/payroll` + `payroll/settings` `leaves` + `leaves/report` `staff-attendance` `appraisal` `expenses` `expense-categories` | HR suite | **REAL** |

**Operations / Safety**

| File | URL | Status |
|---|---|---|
| `inventory/page.tsx` | assets | **REAL** |
| `visitors/page.tsx` | visitor mgmt | **REAL** |
| `dismissal/page.tsx` | pickup/dismissal | **REAL** |
| `biometric/page.tsx` + `devices` + `logs` | biometric | **REAL** |
| `transport/page.tsx` + `routes` `buses` `stops` `pickup-points` `allocation` `logs` + `map` (leaflet) | transport + GPS | **REAL** (live map **REAL** via socket.io) |
| `hostel/page.tsx` | hostel tabs | **REAL** |
| `conferences/page.tsx` | PT conference | **REAL** (plugin is `coming_soon` — page exists but nav-hidden) |
| `incidents/page.tsx` | incident reporting | **REAL** |
| `incident-management/page.tsx` + `active` `escalations` `reports` | full incident mgmt | **REAL** |
| `disaster/page.tsx` + `plans` `drills` `alerts` | disaster mgmt | **REAL** |
| `emergency/page.tsx` | emergency alerts | **REAL** |
| `compliance/page.tsx` | gov compliance | **REAL** (thin) |

**Communication / Design & Web / Insights / Student Life / Growth / Admin**

| File | URL | Status |
|---|---|---|
| `notices/page.tsx` | notices/circulars | **REAL** |
| `sms/page.tsx` (648) | SMS/communications suite | **REAL** |
| `communications/page.tsx` | hub (announcements, diary, gallery, sliders, templates, broadcast, whatsapp) | **REAL** subpages all wired |
| `communications/whatsapp/*` (5 pages) | WhatsApp bot | **REAL** (plugin `coming_soon`, nav-hidden) |
| `faqs/page.tsx` (295) | FAQ manager | **REAL but ORPHAN** (0 inbound refs, no nav) |
| `ai-tools/page.tsx` + question-paper/lesson-plan/timetable/report-remarks/letter-writer/learning-paths/progress/insights | AI Suite pages | **REAL** (`letter-writer` ORPHAN — 0 refs; `report-remarks` has no manifest subitem) |
| `ai-workbench/page.tsx` (316) | AI workbench | **REAL but ORPHAN** (0 inbound refs) |
| `analytics/page.tsx` + `academic` `financial` `ai-usage` | analytics | **REAL** (`ai-usage` **PARTIAL** demo-ish) |
| `benchmarking/page.tsx` | school benchmarking | **REAL** (manifest deprecated→ai_suite alias; page kept) |
| `reports/page.tsx` + `exam` `expense` `teacher` | basic reports | **REAL** |
| `gamification/page.tsx` (533) + `badges` `leaderboard` `houses` `rewards` | gamification | **REAL** |
| `wellbeing/page.tsx` + `moods` `counselor` `surveys` | wellbeing | **REAL** |
| `health-records/page.tsx` + `records` `vaccinations` `allergies` | health records | **REAL** |
| `alumni/page.tsx` | alumni | **REAL** (thin) |
| `marketplace/page.tsx` (720) | plugin marketplace (catalog, install/subscribe/uninstall) | **REAL** |
| `plugins/page.tsx` | installed plugins (WP-style: activate/deactivate/settings/uninstall) | **REAL** |
| `plugins/[slug]/settings/page.tsx` (541) | generic per-plugin settings (schema-driven) | **REAL** — universal settings UI for all plugins |
| `settings/page.tsx` + `notifications` `roles` `integrations` `backup` `website-design` | school settings | **REAL**, except `roles` = **STUB** (hardcoded roles/counts, "Create Custom Role"/"Edit Permissions" do nothing) |
| `users/page.tsx` | user management | **REAL** |
| `multi-branch/page.tsx` + `branches` `dashboard` `analytics` | multi-branch chain | **REAL** (thin subpages) |
| `white-label/page.tsx` + `branding` `domain` `theme` | white-label | **REAL** |
| `website-builder/page.tsx` + `editor` (839) `pages` `themes` `seo` `ai-builder` `domain` | website builder | **REAL** |
| `designer/page.tsx` + `templates` `bulk` `editor` `writer` `writer2` (971) | Docs & Designer (fabric.js canvas + tiptap Writer) | **REAL** (`writer-legacy.tsx.bak` dead file) |
| `files/page.tsx` (1174) | file manager | **REAL** |
| `iemis-import/page.tsx` + `history` | IEMIS import | **REAL** |
| `bulk-uploads/csv` `iemis` `history` | bulk upload center | **REAL** (no nav entry — reached via students manifest subitems only) |
| `notifications/page.tsx` | notification center | **REAL** (fetch-service, not react-query — inconsistent) |
| `profile/page.tsx` | own profile | **PARTIAL** — read-only, no edit/avatar/password |

**Missing pages referenced by manifests (nav click → 404):**
`/dashboard/ai-tools/remarks` (ai_tools manifest), `/dashboard/analytics/weekly|at-risk|predictions|risk` (advanced_analytics, ai_insights), `/dashboard/benchmarking/rankings|compare` (benchmarking), `/dashboard/social-hub/**` (social_ads/social_hub — withdrawn plugins; manifest routes exist, no page), `/dashboard/communications/whatsapp/*` sub-routes exist but plugin nav-hidden (OK).

### 1.3 Role portals

| File | URL | Persona | Status |
|---|---|---|---|
| `super-admin/page.tsx` + layout | `/super-admin` | superadmin | **PARTIAL** — single platform-overview page only (6 KPI cards); no tenant management, no schools CRUD, no impersonation, no global plugin/config admin UI in web |
| `teacher/page.tsx` + layout | `/teacher` | teacher | **REAL** dashboard; `teacher/assignments` re-exports dashboard assignments page; `teacher/marks` re-exports exams/marks |
| `teacher/[slug]/page.tsx` (6 routes) | `/teacher/attendance|marks|assignments|timetable|notices|ai-tools` | teacher | **STUB** — all render "Coming soon" card (`PortalSectionPage`) |
| `student/page.tsx` | `/student` | student | **STUB** — fully hardcoded mock dashboard (Class 10A, "12 Day Streak", fake timetable), 0 API calls |
| `student/homework/page.tsx` | `/student/homework` | student | **REAL** — wired to `/assignments` API |
| `student/[slug]/page.tsx` (6 routes) | `/student/timetable|homework|results|library|lms|ai-tutor` | student | **STUB** — "Coming soon" cards |
| `parent/page.tsx` | `/parent` | parent | **REAL** — children, notices, fees due |
| `parent/[slug]/page.tsx` (6 routes) | `/parent/attendance|results|fees|notices|bus|chat` | parent | **STUB** — "Coming soon" cards |

Portal sub-nav: `/parent`, `/student`, `/teacher` layouts link these section slugs; only `/student/homework` and the re-exported teacher pages do anything. **15 of 19 portal section routes are honest stubs.**

### 1.4 Public school sites (`/school/[slug]/**`) — rendered via subdomain/custom-domain rewrite in `middleware.ts`

| File | URL | Status |
|---|---|---|
| `school/[slug]/page.tsx` (601) | school home | **REAL** — SSR+ISR (300s), builder `SectionRenderer` sections + live notices/teachers/gallery |
| `about` `academics` `teachers` `facilities` `alumni` `events` `gallery` `notices` `news` + `news/[articleSlug]` `contact` (+form) `admission` (+form) `results` (+checker) | section pages | **REAL** — builder sections first, classic auto-synced fallbacks |
| `school/[slug]/[pageSlug]` | builder custom pages | **REAL** |
| `school/[slug]/layout.tsx` | theme CSS vars, `generateMetadata` (OG/Twitter/canonical), publish guard | **REAL** |
| `sitemap.ts` `robots.ts` | per-school SEO | **REAL** (robots sitemap URL is wrong: points at `/school/sitemap.xml`, sitemap itself enumerates only 8 static sections, omits news/notices/events/admission & per-school paths) |

Route count by status (dashboard+portals, approx): **REAL 165 · PARTIAL 6 · STUB 19 · REDIR 17 · landing PARTIAL 1**. Public site: 17 REAL.

---

## 2. Navigation source of truth & nav↔route mismatches

**Source of truth is NOT the frontend** — `components/layout/sidebar.tsx` (568 ln) renders **API-driven nav only**: `GET /plugins/sidebar` built by backend `PluginLoader.get_frontend_sidebar()` (`backend/app/plugins/loader.py:478`) from plugin YAML manifests + `CORE_ALWAYS_SLUGS` (dashboard, students, teachers, users, academics, attendance, notices, basic_reports) + `BOTTOM_NAV_ALWAYS_SLUGS` (marketplace_nav, plugins_nav, settings_core). Zero hardcoded frontend nav. Nepali labels: `pickLabel()` reads `localStorage.preferred_language` (defaults **"ne"**) and renders `label_nepali` from manifests — all 155 nav items carry Nepali.

**Mismatches found:**

Nav items with NO page (404 on click):
1. `/dashboard/ai-tools/remarks` — ai_tools manifest subitem
2. `/dashboard/analytics/weekly`, `/at-risk`, `/predictions` (advanced_analytics/ai_insights manifests)
3. `/dashboard/benchmarking/rankings`, `/compare`
4. All `/dashboard/social-hub/**` subitems (social_ads, social_hub — withdrawn/deprecated manifests, kept gated)

Pages with NO nav entry (orphans, reachable only by typing URL): `/dashboard/ai-workbench`, `/dashboard/faqs`, `/dashboard/staff`, `/dashboard/incidents` + all `incident-management` subpages (incidents manifest routes are `/dashboard/incidents` only), `/dashboard/bulk-uploads/*`, `/dashboard/certificates/*` (no manifest entry; hub exists unlinked), `/dashboard/communications/*` hub & subpages (sms_notifications manifest points at `/dashboard/sms` only), `/dashboard/students/*` ops pages (promote, transfers, reset-password, roll-numbers, profile-images are manifest subitems — OK — but `bulk-uploads/iemis`, `history` are not), `/dashboard/designer/writer|writer2`, `/dashboard/website-builder/domain`, `/dashboard/timetable/teacher`, `/dashboard/parents/[id]`, `/dashboard/plugins`, `/dashboard/profile`, `/dashboard/analytics/ai-usage`, `/dashboard/ai-tools/letter-writer`.

Also: `settings_core` manifest says `/settings/*` → backend normalizes to `/dashboard/settings/*` ✓ matches. `library_management` manifest route is `/library` → normalized `/dashboard/library` ✓. Coming-soon plugins (conferences, gps_tracking, whatsapp_bot) correctly nav-hidden but pages stay mounted/gated (E231 pattern) ✓.

Portals have their own layout navs (`portal-route-meta.ts`) — all 15 section links resolve to stub cards by design.

---

## 3. Plugin ↔ UI matrix (53 manifest folders; 12 deprecated/unpublished, 3 coming-soon)

Main page = a mounted feature page reachable in dashboard; Settings = per-plugin `config_schema.yaml` or generic `/dashboard/plugins/[slug]/settings`; Market = catalog entry on `/dashboard/marketplace`.

| Plugin | Main page | Settings page | Marketplace |
|---|---|---|---|
| academics | ✅ | ✅ generic | ✅ core |
| admission | ✅ | ✅ generic | ✅ |
| ai_suite (bundle) | ✅ ai-tools + analytics | ✅ generic | ✅ |
| ai_adaptive_learning/ai_grading/ai_insights/ai_tools/ai_tutor/advanced_analytics/benchmarking | ⚠️ deprecated; pages exist & gated via aliases; benchmarking page exists | ✅ generic | ⚠️ hidden (unpublished) |
| alumni | ✅ | ✅ generic | ✅ |
| assignments | ✅ | ✅ generic | ✅ |
| attendance | ✅ | ✅ **schema** | ✅ core |
| basic_reports | ✅ | ✅ generic | ✅ core |
| basic_website | ✅ (shares website-builder) | ✅ generic | ✅ |
| biometric | ✅ (+devices/logs) | ✅ generic | ✅ |
| compliance | ✅ (thin) | ✅ generic | ✅ |
| conferences | ✅ page exists | ✅ generic | ⚠️ coming-soon card |
| design_studio | ✅ designer+writer | ✅ generic | ✅ |
| digital_content, portfolio, library | ⚠️ deprecated dups → elibrary/student_portfolio/library_management pages serve via alias | ✅ generic | ⚠️ hidden |
| disaster_management | ✅ | ✅ generic | ✅ |
| dismissal | ✅ | ✅ generic | ✅ |
| elibrary | ✅ | ✅ generic | ✅ |
| emergency | ✅ | ✅ generic | ✅ |
| exams | ✅ | ✅ generic | ✅ |
| fees | ✅ | ✅ **schema** | ✅ |
| file_management | ✅ | ✅ generic | ✅ |
| gamification | ✅ | ✅ generic | ✅ |
| gps_tracking | ✅ transport+map | ✅ generic | ⚠️ coming-soon |
| health_records | ✅ | ✅ generic | ✅ |
| hr_payroll | ✅ (+own payroll/settings) | ✅ generic | ✅ |
| iemis_importer | ✅ | ✅ generic | ✅ |
| incident_management | ✅ | ✅ generic | ✅ |
| incidents | ✅ | ✅ generic | ✅ |
| inventory | ✅ | ✅ generic | ✅ |
| library_management | ✅ | ✅ **schema** | ✅ |
| lms | ✅ (single page) | ✅ generic | ✅ |
| multi_branch | ✅ | ✅ generic | ✅ |
| notices | ✅ | ✅ generic | ✅ |
| sms_notifications | ✅ | ✅ generic | ✅ |
| social_ads / social_hub | ❌ **NO UI** (withdrawn; manifest routes → 404) | ✅ generic | ⚠️ hidden |
| student_portfolio | ✅ | ✅ generic | ✅ |
| timetable | ✅ | ✅ generic | ✅ |
| visitor_management | ✅ | ✅ generic | ✅ |
| website_builder | ✅ | ✅ **schema** | ✅ |
| wellbeing | ✅ | ✅ generic | ✅ |
| whatsapp_bot | ✅ pages exist | ✅ **schema** | ⚠️ coming-soon |
| white_label | ✅ | ✅ generic | ✅ |
| hostel (legacy manifest) | ✅ | ✅ generic | ✅ |
| **NO main feature page** | social_ads, social_hub (both withdrawn/unpublished). Everything published has a page. | | |
| **NO schema settings (generic editor only)** | all except attendance, fees, library_management, website_builder, whatsapp_bot (+ai_tools, deprecated) — 6 of 53 ship `config_schema.yaml` | | |

Settings UI note: every plugin gets the generic schema-aware settings form at `/dashboard/plugins/[slug]/settings` (WP-style, linked from Installed Plugins and marketplace "Manage"). Deep UI settings exist only for hr_payroll (`/hr/payroll/settings`), whatsapp (`/communications/whatsapp/ai-settings`), website (`/settings/website-design`), certificates/ID (`designer`).

Superadmin: no dedicated web admin console beyond `/super-admin` overview; plugin catalog admin (publishing, pricing) is backend/CLI only.

---

## 4. Design system

- **UI kit**: shadcn/radix-style primitives in `components/ui/` — 20 components (button, card, dialog, dropdown-menu, input, label, select, switch, tabs, table, textarea, tooltip, popover, badge, avatar, checkbox, slider, separator, progress, spinner, bs-date-input). No data-grid, no command palette, no drawer/sheet, no date-range picker, no stepper.
- **Tokens**: `tailwind.config.js` + `app/globals.css` HSL CSS vars (forest-green brand: `--primary 163 62% 14%`, sidebar tokens), fonts Inter + Nepali (`--font-mukta` declared but **Mukta never loaded** — only Inter in `app/layout.tsx`; landing uses Sora/Space Grotesk).
- **Dark mode**: tokens defined (`.dark` block), zustand `useAppStore.theme` exists in `lib/store.ts` — but **no toggle anywhere, no `next-themes`, html has no class switching**. Dark mode is effectively dead code; `super-admin/page.tsx` hardcodes `bg-gray-900` regardless.
- **Nepali/i18n**: sidebar Nepali via manifest `label_nepali` (default `ne`); `lib/nepali-utils.ts` (digits/currency), `lib/nepali_date.ts` (BS calendar), `components/ui/bs-date-input.tsx` BS date picker. **No i18n framework** (no next-intl/react-i18next); dashboard body copy is English-only; Nepali appears only in nav labels and school-site content.
- **Tables**: plain `components/ui/table.tsx`; ~30 pages hand-roll pagination (`page`/`per_page`); no shared DataTable, no server-side sort/filter abstraction, no column visibility, no CSV export from tables.
- **Forms**: react-hook-form + zod declared in package.json; usage is spotty — most pages use raw useState.
- **Feedback**: sonner toasts (global in `providers.tsx`), radix dialog/popover. Loading: only 2 route-level `loading.tsx` (dashboard root only) + `PageLoader`; skeletons via `animate-pulse` in 9 files; `PluginGate` shows pulse.
- **Error handling**: `app/error.tsx`, `app/global-error.tsx`, `app/dashboard/error.tsx` only; no per-portal error boundaries; most pages rely on react-query `isError` where implemented (many ignore it).
- **Empty states**: ad-hoc per page ("No notifications yet", PluginGate's install prompt is the best one); no shared EmptyState component.
- **A11y**: 24 `aria-*` attributes in entire codebase; icon-only buttons often lack labels; sidebar collapse is button-only (no keyboard nav / focus management); dialogs rely on radix (good). No skip links, no focus-visible audit, no contrast audit (sidebar `text-white/65` on green is borderline).
- **Print/export**: `window.print` in 4 places (certificates, writer, letter-writer); PDF via backend bulk marksheet/report-card endpoints; docx export (writer `exportDocx.ts`), pptxgenjs, jspdf, html2canvas available; **no export buttons on students/fees/library tables**.
- **Responsive**: sidebar is fixed-width 228px/56px, **no mobile drawer**; `DashboardLayout` is desktop-first; header search/bell only partially responsive; portals are simple enough to work on mobile. Public school sites are responsive.

---

## 5. Data layer

- `lib/api.ts`: axios instance, `withCredentials` HttpOnly-cookie session, 30s timeout, 401 → single-flight `/auth/refresh` retry → logout redirect, 403-plugin-required → sonner toast with marketplace deep-link. Typed `ApiResponse<T>` envelope but **544 `any`/`as any` casts across 111 files** (public-site lib deliberately `Record<string, any>`).
- Auth: `lib/auth-context.tsx` — `/auth/me` probe skipped on public routes; login/OTP/logout.
- React Query v5: 184 files use `useQuery/useMutation`; defaults `staleTime 60s, retry 1`; **270 `invalidateQueries` call-sites**; **1 quasi-optimistic update** (backup page `onMutate`); no `onMutate` cache-patching anywhere else. Query keys are inline strings — no key factory.
- Services layer only for 8 domains (`lib/services/*`: academics, fees, students, teachers, iemis, files, notifications, payment-methods); everything else inlines axios in pages.
- Realtime: `lib/socket.ts` (socket.io, cookie auth) used **only** by transport live map. Notifications poll every 30s instead of using the socket.
- Uploads: `FormData` across students/teachers/transport/settings; `files.service.ts` + `FilePicker` component; no drag-drop zone, no progress bars, no chunking.
- Pagination: manual `page`/`per_page` params; `ApiResponse.meta.pagination` defined and mostly honored.

---

## 6. Public school websites

Solid: ISR (300s) + tag revalidation, publish-status guard (no-store) with honest "Coming Soon"/"Not Found" states, `generateMetadata` with canonical/OG/Twitter, per-school `sitemap.ts`/`robots.ts`, subdomain + custom-domain middleware rewrite, sanitized theme CSS (`lib/sanitize`), 10 themes (`themes/registry.ts`), 20+ section components (HeroSlideshow, NoticeBoard, PhotoGallery, EventCalendar, ResultChecker, AdmissionCTA…), dynamic builder pages catch-all, contact/admission forms, results checker.

Gaps: sitemap misses dynamic sections (news, events, admission, per-school base URL uses hard-coded domain); robots sitemap URL wrong; `SectionRenderer`/`EditorSectionRenderer` (1019/875 ln) contain fallback/demo content paths; no JSON-LD (School schema); no performance budget / `next/image` audit; GA/FB pixel via separate script injection.

---

## 7. UX gaps vs modern SaaS (prioritized)

**P0 — broken/blocked journeys**
1. Student portal is a hardcoded mock — worse than no portal.
2. 15/19 parent/teacher/student section routes are "coming soon" cards.
3. Settings → Roles & Permissions page is a static fake (buttons do nothing; counts hardcoded).
4. Profile page read-only — no name/avatar/password/language edit.
5. Nav items that 404: `ai-tools/remarks`, `analytics/weekly|at-risk|predictions`, `benchmarking/rankings|compare` (manifests must be trimmed or pages built).
6. No mobile dashboard: fixed sidebar, no off-canvas nav, no responsive tables.

**P1 — high-value missing**
7. No command palette (⌘K) — header search exists but only entity search, no keyboard shortcut, no nav-jump.
8. No bulk actions on any table (students, fees, notices all row-by-row).
9. No saved filters/views; class/section filter persists via zustand but nothing else does.
10. No notification preferences surfaced to end users beyond settings page; no realtime push (socket exists, unused).
11. No onboarding wizard for new schools (setup checklist, first-student/fee-flow guidance).
12. No audit/activity feed UI (backend has events; nothing renders them).
13. No dashboard customization/widgets — all KPI grids static.
14. No PDF/CSV export on most list pages (only exams/certificates/reports); no print stylesheets.
15. No data import UX beyond raw CSV upload — no field mapping preview, no validation report UI (IEMIS closest).
16. No impersonation ("view as teacher/parent") for admins or support.
17. No global keyboard shortcuts (only designer/writer/fees-POS have their own).
18. No help center/docs/changelog UI (`faqs` page exists but is orphaned with no nav entry).
19. No multi-step wizards for complex flows (fee structure, exam setup, admission pipeline stages are single forms).
20. No empty-state guidance system, no tour/checklist, no skeletons on most pages, no offline/PWA support, no dark mode toggle despite full token support.

---

## 8. Code-health issues

- **Giant files**: `fees/collect` 1652, `files` 1174, `CanvasEditor` 1171, `academics` 1119, `students` 1060, `SectionRenderer` 1019, `useCanvas` 1016, `writer2` 971, `exams/results` 912 — need extraction.
- **Dead code**: `app/dashboard/designer/writer-legacy.tsx.bak`; `src/shims/empty.js`; dark-mode tokens + zustand theme store unused; `Header` search + notification dropdown hand-rolled instead of reusing services/hooks.
- **Duplication**: 12 deprecated plugin manifests duplicate canonical ones (library↔library_management, portfolio↔student_portfolio, digital_content↔elibrary, 7 AI plugins↔ai_suite) — handled by alias maps in 3 places (backend decorators, `lib/plugins.tsx`, `lib/api.ts`) that must stay in sync by hand; `PortalSectionPage` ×3 identical catch-alls; multiple hub pages re-implement card grids.
- **Types**: 544 `any` casts; `ApiResponse` typed but frequently bypassed; no generated API types from OpenAPI.
- **Config**: tsconfig `target ES2017` forces `Array.from(map)` workarounds (see sidebar comment); eslint is bare `next/core-web-vitals` (no strict rules, no a11y plugin); `html lang="ne"` while dashboard copy is English; jest setup exists (8 test files) but coverage is tiny vs 72k LOC.
- **Unused deps**: `date-fns`, `jszip`, `qrcode`(+types), `leaflet` used once (map), `@hookform/resolvers`+`zod` barely used relative to declaration.

---

## 9. Prioritized web-UI work needed

1. **Portals**: build real student portal (replace mock), then parent fees/results/attendance, then teacher marks/attendance — the "coming soon" cards are the single biggest credibility gap.
2. **Kill 404 nav entries**: remove/bulid `ai-tools/remarks`, `analytics/weekly|at-risk|predictions`, `benchmarking/rankings|compare` in manifests.
3. **Roles & permissions page**: real RBAC editor (backend permissions map exists on User).
4. **Mobile dashboard**: off-canvas sidebar + responsive tables.
5. **⌘K command palette** (nav + entities) and global keyboard shortcut layer.
6. **Bulk actions + table export (CSV/PDF)** shared DataTable component.
7. **Audit/activity feed** page(s) consuming backend event stream; realtime notifications via existing socket.
8. **Onboarding wizard + empty-state system**.
9. **Profile editing**; dark-mode toggle (tokens already exist).
10. **Superadmin console**: tenant CRUD, plugin publishing, impersonation.
11. Schema-driven settings for the 47 plugins on generic editor only (add `config_schema.yaml` incrementally starting with sms_notifications, exams, attendance-adjacent).
12. i18n: adopt a real i18n layer; either finish Nepali dashboard copy or default `en` (current default `ne` shows mixed-language UI).
