# FRONTEND_INVENTORY.md — ASchool `frontend/` (Next.js 14 App Router)

Scope: `/home/bishal-regmi/Desktop/ASchool/frontend` only. Inventory, not audit. All paths relative to `frontend/` unless absolute.
Counts: 215 `page.tsx` + 1 `route.ts` (`app/api/revalidate`) + 9 layouts. Deps of note: axios 1.7, @tanstack/react-query, fabric 6.9, jspdf 4.2, jszip 3.10, html2canvas, socket.io-client.

## 1. Routes

Auth guard layers: `middleware.ts:101-122` (JWT `access_token` cookie expiry check → redirect `/login`, only for `/dashboard` and `/website-builder` prefixes); `app/dashboard/layout.tsx:8-19` (client-side `useAuth` check, no role check). Portals have NO auth guard in layout or middleware (see §1.3/§1.6). **FIXED:** `/super-admin` is now guarded by `middleware.ts` (token present + unexpired + decoded JWT `role === "superadmin"` → else 307 `/login`) plus a server-component check in `app/super-admin/layout.tsx` that re-verifies the cookie against backend `GET /auth/me` (signature-verified, role must be `superadmin`) and redirects otherwise. Verified: unauthenticated and forged-token curls both 307→`/login`; seeded superadmin session gets 200.

### 1.1 Public / root
| Route | Page file | Purpose | Gated? | Role check |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Marketing landing page | No | No |
| `/login` | `app/(auth)/login/page.tsx` | Login (route group `(auth)`, shared `app/(auth)/layout.tsx`) | No | No |
| `/register` | `app/(auth)/register/page.tsx` | Registration + OTP send | No | No |
| `/verify-otp` | `app/(auth)/verify-otp/page.tsx` | OTP verification | No | No |
| `/api/revalidate` (POST) | `app/api/revalidate/route.ts` | ISR revalidate endpoint, secret-checked | n/a | Secret only (line 8) |

### 1.2 Public school website `/school/[slug]/*` (ISR, revalidate 300)
All fetch server-side via `API_URL` (see §3). No gating, no role checks. Subdomain rewrite handled by `middleware.ts:67-88` (e.g. `gv.aschool.com.np` → `/school/gv`).
| Route | Purpose |
|---|---|
| `/school/[slug]` | Home (SSR fetch) |
| `/school/[slug]/{about,academics,admission,alumni,contact,events,facilities,gallery,news,notices,results,teachers}` | Section pages; `admission/AdmissionForm.tsx` + `contact/ContactForm.tsx` are client POST forms; `news/[articleSlug]` article detail |

### 1.3 Parent / Student / Teacher portals — STUBS
| Route | Page file | Purpose | Gated? | Role check |
|---|---|---|---|---|
| `/parent`, `/student`, `/teacher` | `app/{parent,student,teacher}/page.tsx` | Portal dashboards | No | No |
| `/parent/[slug]`, `/student/[slug]`, `/teacher/[slug]` | same-named `page.tsx` | Whitelisted sections → `<PortalSectionPage>` = "Coming soon" card (`components/portal/portal-section-page.tsx:24-38`), 404 otherwise via `lib/portal-route-meta.ts` | No | **No auth at all** (layouts are plain wrappers) |
| `/teacher/{assignments,marks}` | `app/teacher/*/page.tsx` | Teacher tools | No | No |

### 1.4 Super admin
| Route | Page file | Purpose | Gated? | Role check |
|---|---|---|---|---|
| `/super-admin` | `app/super-admin/page.tsx` | Platform dashboard (`GET /analytics/superadmin`) | Yes (middleware + layout) | **FIXED — `middleware.ts` role-claim check + `app/super-admin/layout.tsx` server-side `/auth/me` role check; unauthenticated → 307 `/login` (verified by curl)** |

### 1.5 Dashboard `/dashboard/*` (185 pages; auth-only layout, role checks only where noted)
Gated? column = `<PluginGate slug="...">` slug @ first-gate line in that page file. `=redir` = redirect stub. `ui-only` = no data fetch (§4.3).

| Route(s) | Slug gate (line) | Notes |
|---|---|---|
| `/dashboard` (index) | — | `GET /analytics/dashboard`; role check: none |
| `/dashboard/academics` | — | Tabs page (years/classes/subjects/teachers) |
| `/dashboard/academics/{subjects,class-sections}` | — | ui-only re-export of academics page |
| `/dashboard/academics/{classes,class-teachers}` | — | ui-only/redirect variants |
| `/dashboard/academics/{year,years}` | — | `=redir` |
| `/dashboard/admission` | admission @52 | Slug not in `PLUGIN_LABELS` (lib/plugins.tsx:182-203) |
| `/dashboard/ai-tools` | ai_tools @20 | Hub |
| `/dashboard/ai-tools/{lesson-plan,letter-writer,question-paper,report-remarks,timetable}` | ai_tools @18-21 | 5 generator pages |
| `/dashboard/ai-tools/{insights,progress}` | ai_adaptive_learning @14/@16 | 2nd AI slug |
| `/dashboard/alumni` | alumni @21 | |
| `/dashboard/assignments` | assignments @67 | Slug not in PLUGIN_LABELS |
| `/dashboard/attendance` | attendance @82 | role check: `isTeacher` (line 91) |
| `/dashboard/attendance/{holidays,reports}` | holidays→**notices** @35 (!), attendance @16 | holiday mgmt gated as notices; reports `isTeacher` @21 |
| `/dashboard/attendance/mark` | — | client redirect → `/dashboard/attendance` |
| `/dashboard/benchmarking` | benchmarking @13 | not in PLUGIN_LABELS |
| `/dashboard/biometric{,/devices,/logs}` | biometric @14/@19/@17 | not in PLUGIN_LABELS |
| `/dashboard/bulk-uploads/{csv,iemis,history}` | — | CSV/IEMIS import |
| `/dashboard/certificates` | — | ui-only link hub |
| `/dashboard/certificates/{id-settings,staff-id,student-id,templates}` | — | `=redir` to sibling pages |
| `/dashboard/certificates/{students,staff,character,transfer}` | — | fabric + iframe-print certificate generators (§5) |
| `/dashboard/communications` | communications @14 | alias→`sms_notifications` |
| `/dashboard/communications/{broadcast,templates}` | communications @17/@20 | |
| `/dashboard/communications/{announcements,diary,gallery,sliders}` | notices @39/@44/@27/@50 | gated as `notices` |
| `/dashboard/communications/whatsapp` | whatsapp_bot @42 | |
| `/dashboard/communications/diary/categories` | — | ui-only? (not in gate list) |
| `/dashboard/compliance` | compliance @15 | not in PLUGIN_LABELS |
| `/dashboard/conferences` | — | |
| `/dashboard/designer` | — | Docs/designer hub |
| `/dashboard/designer/{editor,bulk,templates}` | design_studio @26/@22/@37 | fabric editor |
| `/dashboard/designer/writer` | — | letter writer (layout `writer/layout.tsx`) |
| `/dashboard/disaster{,/alerts,/drills,/plans}` | disaster_management @14/@13/@21/@19 | not in PLUGIN_LABELS |
| `/dashboard/dismissal` | dismissal @18 | not in PLUGIN_LABELS |
| `/dashboard/elibrary{,/past-papers,/upload}` | elibrary @19/@17/@17 | |
| `/dashboard/emergency` | emergency @18 | not in PLUGIN_LABELS |
| `/dashboard/exams` | — | UI-only-ish (term select hardcoded, incl. "see_mock" @67) |
| `/dashboard/exams/{grades,marks,online,report-cards,results,schedule}` | exams @33/@76/@50/@37/@124/@44 | results also `usePluginEnabled("design_studio")` @144 |
| `/dashboard/exams/online/questions` | — | broken print button (§5) |
| `/dashboard/fees{,/collect,/defaulters,/reports,/scholarships,/structure,/types}` | fees @263/@15/@15/@24/@47/@49/@39 | 7 gated pages |
| `/dashboard/files` | file_management @99 | |
| `/dashboard/gamification{,/badges,/houses,/leaderboard,/rewards}` | gamification @55/@20/@20/@20/@20 | 5 gated pages |
| `/dashboard/health-records{,/allergies,/records,/vaccinations}` | health_records @46/@26/@21/@21 | not in PLUGIN_LABELS |
| `/dashboard/hostel` | hostel @27 | |
| `/dashboard/hr{,/appraisal,/leaves,/leaves/report,/expense-categories,/expenses,/payroll,/payroll/settings,/staff-attendance}` | hr @22/@21/@18 (5 gated; rest ungated) | alias→`hr_payroll` |
| `/dashboard/iemis-import{,/history}` | iemis_importer @76 | |
| `/dashboard/incident-management{,/active,/escalations,/reports}` | incident_management @14/@21/@16/@16 | not in PLUGIN_LABELS |
| `/dashboard/incidents` | incidents @21 | overlaps incident-management |
| `/dashboard/inventory` | inventory @19 | not in PLUGIN_LABELS |
| `/dashboard/library{,/books,/catalog,/checkout,/overdue}` | library @46/@19/@19/@18/@16 | 5 gated |
| `/dashboard/library/transactions` | — | `=redir` |
| `/dashboard/lms` | lms @* (plugin prop form, `lib/plugin-gate.tsx`) | see §2 |
| `/dashboard/marketplace` | — | plugin store |
| `/dashboard/multi-branch{,/analytics,/branches,/dashboard}` | multi_branch @14/@14/@19/@12 | not in PLUGIN_LABELS |
| `/dashboard/{notices,notifications}` | notices @54 | notifications = service-driven, ui-only pattern |
| `/dashboard/parents{,/parents/[id]}` | — | guardian directory |
| `/dashboard/portfolio` | student_portfolio @27 | not in PLUGIN_LABELS |
| `/dashboard/profile` | — | ui-only |
| `/dashboard/reports{,/exam,/expense,/teacher}` | basic_reports @56 (index only) | slug not in PLUGIN_LABELS |
| `/dashboard/settings{,/backup,/integrations,/notifications,/website-design}` | — | roles page hardcoded (§4.3) |
| `/dashboard/settings/roles` | — | ui-only, hardcoded arrays @8/@19 |
| `/dashboard/sms` | sms_notifications @61 | `isAdmin` role check @70 |
| `/dashboard/social-hub{,/campaigns}` | social_hub @39 / social_ads @19 | slugs not in PLUGIN_LABELS |
| `/dashboard/staff{,/bulk-upload}` | — | bulk-upload `=redir` |
| `/dashboard/students{,/new,/[id],/bulk-import,/guardians,/profile-images,/promote,/reset-password,/roll-numbers,/transfers}` | — | `/students/guardians` `=redir` |
| `/dashboard/teachers{,/bulk-upload}` | — | bulk-upload `=redir` |
| `/dashboard/timetable{,/generate,/teacher}` | timetable @35/@31 (2 of 3) | |
| `/dashboard/transport{,/allocation,/buses,/logs,/map,/pickup-points,/routes,/stops}` | gps_tracking @19/@16/@29/@18 (buses/logs/map/stops) | alias→`gps_tracking`; pickup-points/routes ungated |
| `/dashboard/users` | — | user mgmt |
| `/dashboard/visitors` | visitors @20 | alias→`visitor_management` |
| `/dashboard/website-builder{,/ai-builder,/domain,/editor,/pages,/seo,/themes}` | — | auth-guarded by middleware only, no plugin gate |
| `/dashboard/wellbeing{,/counselor,/moods,/surveys}` | wellbeing @52/@19/@29/@20 | not in PLUGIN_LABELS |
| `/dashboard/white-label{,/branding,/domain,/theme}` | white_label @14/@16/@17/@15 | not in PLUGIN_LABELS |

## 2. Plugin-gating mechanism
**FIXED (E70/E71, 2026-08-29):** the duplicate `lib/plugin-gate.tsx` was DELETED — `lib/plugins.tsx` is the single source of truth (its `PluginGate` prop `slug`, inline one-click install, plus the migrated `usePluginEnabled` hook). Sole straggler import (`app/dashboard/exams/results/page.tsx`) migrated. All 43 distinct gating slugs verified present in the live 55-plugin published catalog (no lockout slugs); the 24 slugs that fell back to raw display got labels matching marketplace names in `PLUGIN_LABELS`.

Usage total: **106 `<PluginGate>` instances** (104 with `slug=`, 2 with `plugin=`) + 1 `usePluginEnabled("design_studio")` (`app/dashboard/exams/results/page.tsx:144`) = **107 gating usages**. Full per-route slug/line map in §1.5. Distinct slugs (40): ai_tools(7) notices(6) fees(6) exams(6) library(5) gamification(5) white_label(4) wellbeing(4) multi_branch(4) incident_management(4) hr(4) health_records(4) gps_tracking(4) disaster_management(4) elibrary(3) design_studio(3) communications(3) biometric(3) timetable(2) attendance(2) ai_adaptive_learning(2) admission assignments alumni basic_reports benchmarking compliance dismissal emergency file_management hostel iemis_importer incidents inventory sms_notifications social_ads social_hub student_portfolio visitors whatsapp_bot (1 each).
- Alias map `PLUGIN_SLUG_ALIASES` (`lib/plugins.tsx:55-63`): communications→sms_notifications, hr→hr_payroll, transport→gps_tracking, visitors→visitor_management, library→library_management, digital_content→elibrary, design_studio→digital_content.
- ~~**18 slugs used in gates but absent from `PLUGIN_LABELS`**~~ **FIXED (E71):** labels added for all 24 post-alias missing slugs (the 18 above + conferences, timetable, ai_adaptive_learning, incidents, elibrary + library_management), each matching the live catalog `Plugin.name`.
- Backend 403 handler in `lib/api.ts:87-107` toasts "Plugin Required" + marketplace redirect.

## 3. Data fetching
- Client: axios instance `lib/api.ts:15-22` — `baseURL = ${NEXT_PUBLIC_API_URL||""}/api/v1`, `withCredentials: true`, 30s timeout, 401→`POST /api/v1/auth/refresh` retry, 403-plugin toast.
- **523 `api.*` calls** in app/lib/components: 278 GET, 164 POST, 44 PUT, 29 DELETE, 8 PATCH. All call **relative paths** (e.g. `/students`, `/fees/collections`, `/academics/classes`, `/website-builder/pages/{id}`, `/design-studio/templates`, `/transport/buses`, `/wellbeing/mood`, `/iemis/formats`, `/plugins/installed`, `/plugins/sidebar`) → all effectively `/api/v1/*`. Service layer: `lib/services/{files,iemis,notifications,payment-methods}.service.ts` + `lib/services/dashboard/{academics,fees,students,teachers}.service.ts`. 169 files use react-query.
- **37 raw `fetch(` calls**: 26 in `app/school/[slug]/*` + `middleware.ts:53` (`GET /api/v1/website/public-domain?host=`) + `app/(auth)/register:585`, `verify-otp:43,61` (`/api/v1/auth/*`) + blob downloads (`fetch(mf.url)` in bulk-import:23, iemis-import:140, bulk-uploads/csv:35, bulk-uploads/iemis:70, files/page.tsx:725) + `certificates/students/page.tsx:65`.
- **Error-state sweep (E73, 2026-08-29):** 33 more pages converted to the established `retry: 1` + error-card pattern (fees overview/defaulters/collect, exams ×5, hr, super-admin, analytics ×3, multi-branch ×3, reports ×3, website-builder ×4, biometric ×2, communications ×2, library, benchmarking, transport ×2, timetable/teacher, students/reset-password, social-hub, ai-tools/insights). Fee overview previously rendered Rs. 0 KPIs on API failure.
- **Stale-path sweep (E72, 2026-08-29):** 240 distinct frontend paths diffed against the live Flask url_map — 0 unmatched after fixes: portfolio page rewired to the real `/portfolio/students/:id/items` contract (old `/portfolio` CRUD never existed); new backend route `POST /ai-tools/letter-writer` (was a guaranteed 404 on Generate).
- Socket: `lib/socket.ts` socket.io, `NEXT_PUBLIC_WS_URL` fallback origin, cookie auth.

Suspicious / flagged (no non-`/api/v1` backend path found — flags are config/consistency):
1. **`http://flask:5000` hardcoded fallback** in `middleware.ts:6`, `next.config.js:21`, and 8 server components (`app/school/[slug]/layout.tsx:7` etc.) via non-public `process.env.API_URL` — Docker-internal hostname; breaks any non-Docker/dev-proxy setup, and bare `""` fallback in client pages yields relative URLs (works only because `next.config.js:20-32` rewrites `/api/*`,`/uploads/*` to flask).
2. **`app/dashboard/certificates/students/page.tsx:59-65`** reads `access_token` from `document.cookie` to set an Authorization header — contradicts `lib/api.ts:19` ("HttpOnly cookies… never JS-readable", same claim in `lib/socket.ts`); header will effectively never be set.
3. `middleware.ts:48-60` does a synchronous per-request backend fetch (no timeout/cache) for custom-domain resolution on every non-main-host request.
4. `app/dashboard/transport/allocation/page.tsx:64` `GET /students?limit=500` — hard 500-cap pagination hack.
5. `lib/plugins.tsx:242` `POST /plugins/install` triggered directly from UI gate with hardcoded `billing_cycle: "monthly"` — client-initiated purchase-side effect.

## 4. Shared component library
`components/` dirs: `ui/` (21 shadcn-style primitives: button, card, dialog, table, tabs, select, bs-date-input, spinner…), `layout/` (dashboard-layout 16L wrapper, sidebar 510L plugin-driven nav, header 309L), `designer/` (CanvasEditor 557L, PropertiesPanel 434L, ElementToolbar, DataFillPanel, AIAssistPanel), `website/` (18 school-site widgets + SectionRenderer 690L), `transport/` (LiveBusMap 127L), `files/` (FilePicker), `portal/` (portal-section-page 41L).
- **Stub**: `components/portal/portal-section-page.tsx` renders a static "Coming soon" card for every parent/student/teacher portal section — all portal nav links (parent layout `/parent/attendance|results|fees|notices|bus|chat`) land here.
- **Hardcoded data**: `settings/roles/page.tsx:8,19` (roles+modules arrays, no backend); `components/website/SectionRenderer.tsx:220,264,310,403,436,519` and `Testimonials.tsx:11`, `SchoolStats.tsx:18`, `ProgramCards.tsx:16` (default/fallback arrays); `components/transport/LiveBusMap.tsx:26` `KATHMANDU_CENTER` fallback; `app/dashboard/exams/page.tsx:67` hardcoded term list incl. "SEE Mock".
- Loading/error states: react-query pages generally use `PageLoader`; **LiveBusMap has no loading/empty state** (renders markers only, no spinner/skeleton); portal stub obviously static. Charts exist only as ad-hoc CSS bars in analytics pages (no chart lib).
- `themes/registry.ts`: 20 themes (5 free/15 pro) → CSS var generation used by `app/school/[slug]/layout.tsx` via `sanitizeCss` (`lib/sanitize.ts`).

## 5. Document render/export paths
- **fabric.js designer**: `components/designer/CanvasEditor.tsx` (A4/A5/A3/ID/Letter/Legal pages via `lib/hooks/useCanvas.ts` PAGE_SIZES, undo/redo) → exports via `lib/hooks/useExport.ts`: `exportPDF` (jsPDF, multipage) and `exportPNG` (fabric `toDataURL` multiplier 3 + html2canvas compositing). Used by `/dashboard/designer/editor` and certificate pages.
- **jsPDF** imports: `lib/hooks/useExport.ts:94` only.
- **JSZip**: `app/dashboard/certificates/students/page.tsx:232-233` — renders each certificate page to PNG, zips and downloads (bulk student ID/certificates).
- **Print**: `certificates/students/page.tsx:112-123` builds hidden iframe + `document.write` + print (works); ~~broken string attributes `onclick="window.print()"`~~ **FIXED** at `certificates/character/page.tsx`, `certificates/staff/page.tsx`, `certificates/transfer/page.tsx`, `exams/online/questions/page.tsx` — these buttons lived inside `document.write` popup HTML strings; each now has `id="print-btn"` and a real `addEventListener("click", () => newWin.print())` bound after `document.close()` (zero `onclick="` string attributes remain in `app/`); `ai-tools/letter-writer/page.tsx:90` uses real `onClick={window.print}` (works). Produced artifacts: PDF/PNG documents, ZIP of PNGs, printed ID cards/certificates.

## 6. Design tokens
- `tailwind.config.js`: shadcn CSS-var tokens (primary/secondary/destructive/muted/accent/card/popover/border/ring via `hsl(var(--*))`), radius var, fonts Inter + Mukta (`font-nepali`), tailwindcss-animate. Brand palette hardcoded **inside the config itself**: ocean/mint/sun/fog/ink (lines 17-39).
- `themes/registry.ts` + `themes/{vidyalaya,himal-school}/`: theme color/font tokens injected as CSS vars for public sites.
- **FIXED (E75, 2026-08-29):** 16 arbitrary-value hex classes replaced with ocean/mint/sun/ink tokens in `app/(auth)/login/page.tsx` (13) + `register/page.tsx` (3). Remainders kept honestly: `app/page.tsx` hexes are CSS-var definitions, `(auth)/layout.tsx` hexes are plain CSS, dashboard semantic greens/ambers/reds have no brand-token equivalents. (Original counts:) Hardcoded hex colors (grep `#[0-9a-f]{3,6}`) per directory: **app/ 130** (app/dashboard 77, app/school 23), **components/ 95** (components/website 79, components/designer 11), **lib/ 89**. portal/layout/ui dirs: 0. Website widgets and portal layouts (`app/parent/layout.tsx` `bg-blue-700`, student `bg-violet-700`, teacher `bg-emerald-700`) bypass tokens wholesale.

## 7. Dead links
- ~~`app/page.tsx:683,691,699` — footer column links rendered from loops with `href="#"`; `app/page.tsx:707-709` — "Privacy", "Terms", "Support" all `href="#"`. (6 instances, landing page only.)~~ **FIXED:** footer links now point to real on-page anchors — Platform → `#features`/`#pricing`/`#mobile-apps` (apps showcase section given `id="mobile-apps"`), Solutions → `#institutions`, Support → `#contact`. Company column (About Us/Blog/Careers/Privacy Policy/Terms of Service) and bottom-bar Privacy/Terms removed — no such pages exist anywhere under `app/`. Rendered landing HTML greps 0 `href="#"`.
- `app/parent/layout.tsx:15-21` nav links (`/parent/attendance|results|fees|bus|chat`) and student/teacher portal nav equivalents are not dead (they hit `[slug]` whitelist) but resolve to "Coming soon" placeholder pages — functionally dead ends.
- No other `href="#"` or unresolvable internal hrefs found in `components/layout/*` or sidebar (plugin nav routes come from backend manifests).
