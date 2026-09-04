# ASchool Web Widget-Level UI Audit (plugin-oriented)

Audited: 2026-09-04 · Scope: `/home/bishal-regmi/Desktop/ASchool/frontend` (read-only), cross-checked against backend endpoints in `/home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/` and plugin manifests in `backend/app/plugins/modules/`. Complements the route-level inventory in `ASCHOOL_WEB_UI_INVENTORY.md` (that document covers *which pages exist*; this one covers *what widgets each page is made of and what's missing*).

Method: every reusable component read; the 15 highest-traffic plugin pages read or structurally grepped line-by-line; backend blueprints enumerated per plugin (`@bp.route` decorators) and diffed against the UI that consumes them.

---

## 1. Widget library inventory

### 1.1 What exists — `components/ui/` (21 primitives, shadcn/radix-style)

| Primitive | File | Used in (files) | Notes |
|---|---|---|---|
| Button (6 variants, 4 sizes) | `components/ui/button.tsx` | 196 | Solid base; no `loading` prop (spinner is hand-inserted everywhere) |
| Card | `components/ui/card.tsx` | 179 | Standard |
| Badge | `components/ui/badge.tsx` | 127 | Has `success` variant (custom) |
| Spinner / PageLoader | `components/ui/spinner.tsx` | 158 | The *only* loading idiom; no skeletons |
| Input | `components/ui/input.tsx` | 120 | h-8, 12px text; no prefix/suffix/icon slots |
| Label | `components/ui/label.tsx` | 107 | |
| Table (dumb parts) | `components/ui/table.tsx` | 85 | Markup only — no DataTable behavior anywhere |
| Dialog | `components/ui/dialog.tsx` | 68 | Radix; used for create/edit/confirm/details/preview — everything |
| Select | `components/ui/select.tsx` | 61 | Radix; no search/multi/virtualization (60+ items = scroll dump) |
| Textarea | `components/ui/textarea.tsx` | 42 | |
| BSDateInput | `components/ui/bs-date-input.tsx` | 16 | **Genuine differentiator**: BS calendar picker emitting AD strings; hand-rolled dropdown (not Popover), no AD toggle, no range |
| Switch | `components/ui/switch.tsx` | 11 | |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | 9 | Under-used — most pages inline 2–3 ghost Buttons per row instead |
| Tabs (radix) | `components/ui/tabs.tsx` | 8 | Most pages hand-roll tab strips with `useState` instead (attendance, admission, sms, transport, library…) — inconsistent a11y & URL sync |
| Checkbox | `components/ui/checkbox.tsx` | 6 | Used for row selection in 2 tables |
| Separator (5), Avatar (5), Tooltip (3), Popover (3), Slider (3), Progress (3) | — | — | Tooltip almost unused; Progress effectively unused |

**App-level components worth counting as "kit":** `components/files/FilePicker.tsx` (404 ln — dialog file browser + upload; the closest thing to an upload widget), `components/plugins/subscribe-dialog.tsx`, `components/transport/LiveBusMap.tsx` (Leaflet + socket.io), designer suite (`CanvasEditor` 1171 ln, `PropertiesPanel`, `LayersPanel`, `DataFillPanel`, `AIChatPanel`…), writer suite (tiptap-based, ~1600 ln), website `SectionRenderer`/`EditorSectionRenderer`, `components/portal/portal-section-page.tsx`.

### 1.2 Dependency inventory (what's installed but idle, and what's absent)

- **Installed & unused / barely used:** `recharts` (3 files: reports, whatsapp/analytics, ai-usage), `react-hook-form` + `zod` + `@hookform/resolvers` (only login/register), `date-fns` (0 real use), `jszip`, `qrcode` (0 use — no QR anywhere despite ID cards/receipts), `@radix-ui/react-toast` (superseded by sonner), `jspdf`/`html2canvas` (only designer), `pptxgenjs` (writer).
- **Installed & central:** sonner toasts (132 files), react-query v5 (184 files), socket.io (transport map only), leaflet (map), fabric (designer), tiptap (writer).
- **Absent from package.json (no widget exists):** `cmdk` (command palette), `vaul`/sheet, `react-day-picker` (range), `embla`/carousel, `dnd-kit` (drag-reorder), `recharts` wrapper components, `virtua`/`react-window` (virtualization), `mjml`/print lib, `katex`, `diff`.

### 1.3 Missing-widget checklist (school-ERP essentials) — EXISTS / PARTIAL / MISSING

| Widget needed by an ERP | Status | Where / evidence |
|---|---|---|
| **DataTable** (server pagination + sort + filter + column config + bulk bar + CSV) | **MISSING** | Only dumb `ui/table.tsx`; pagination re-implemented in ≥14 pages (`students/page.tsx:563-577`, `hr/leaves`, `parents`, `users`, `fees/scholarships`…). No sortable column in the whole app |
| Pagination control | **PARTIAL** | Prev/next chevrons only (`students/page.tsx:563`); no page-size selector, no jump-to-page, no total-pages input |
| FilterBar / saved views | **MISSING** | Ad-hoc `Select` rows per page; filters die on nav (only attendance class/section persists via zustand) |
| ConfirmDialog | **MISSING** | Raw `window.confirm` in 22 files (`students/page.tsx:237`, `timetable/page.tsx:180`, `library/catalog`, `designer/page.tsx`, `plugins/page.tsx`) — browser chrome, unstyleable, no undo pattern |
| EmptyState | **MISSING** | Ad-hoc ("No students found." `students/page.tsx:527`; best-in-class is fees/collect:573-580 and PluginGate) |
| ErrorState | **PARTIAL** | Inline "Failed to load… Retry" cards duplicated per page (`students/page.tsx:239`, `timetable/page.tsx:141`, `exams/marks:350`) |
| Skeleton | **MISSING** | 0 results for `Skeleton`; only `PageLoader` + `animate-pulse` in 9 files |
| Sheet / Drawer | **MISSING** | No side panel anywhere; row detail = full Dialog or separate page |
| Command palette (⌘K) | **MISSING** | Header search only (`components/layout/header.tsx:50-68`, debounced `/search`), no shortcut, no nav-jump |
| DateRangePicker | **MISSING** | `attendance/reports/page.tsx:101` uses raw `<input type="month">`; fees/reports hand-builds date strings |
| DatePicker (AD) | **MISSING** | Only BS picker exists; several pages fall back to native `type="date"`-style ISO strings (`fees/collect:697` payDate is ISO `new Date().toISOString()`) |
| TagPicker / MultiSelect | **MISSING** | SMS recipients = comma-separated `<textarea>` (`sms/page.tsx:124`) |
| PhoneNumberInput (NP) | **MISSING** | Placeholder-only validation `"98XXXXXXXX"` (`students/page.tsx:796`) |
| CurrencyInput (NPR) | **MISSING** | Bare `type=number` inputs; `formatCurrency` re-implemented in **33 files** (`fees/collect:163` `Rs. ${value.toLocaleString()}`); `lib/nepali-utils.ts` `formatNepaliCurrency` used in only 1 file |
| PercentageInput | **MISSING** | bare number inputs |
| FileDropzone (drag-drop, progress, multi) | **MISSING** | `FilePicker` is dialog-based `<input type=file>`; uploads lack progress bars (only assignments passes `onUploadProgress`) |
| ImageCropper | **MISSING** | profile-images page does no crop; no EXIF/orientation handling |
| RichTextEditor | **PARTIAL** | Full tiptap kit exists but **only inside designer/writer**; notices, diary, announcements, assignments use plain `<Textarea>` |
| MarkdownRenderer + KaTeX | **MISSING** | AI outputs (question-paper, lesson-plan, remarks) rendered as `whitespace-pre-wrap` plain text (`ai-tools/lesson-plan:64`) |
| Chart wrappers (line/bar/pie/heat) | **PARTIAL** | recharts used in 3 pages only; dashboards are number-card grids; no attendance trend, no fee collection chart |
| CalendarView (month grid) | **MISSING** | website `EventCalendar.tsx` is 29 ln (list, not grid); holidays/events have no visual calendar |
| TimetableGrid (drag-drop) | **PARTIAL** | raw `<table>` with hover-delete buttons (`timetable/page.tsx:150-195`); add via Dialog form; no drag, no conflict highlighting, no teacher-view cross-check |
| Timeline | **MISSING** | admission pipeline = 8 stat cards + next-stage button; no visual pipeline |
| KanbanBoard | **MISSING** | admission stages, leave approvals, incident escalations all tables |
| Stepper / Wizard | **PARTIAL** | iemis-import hand-rolls a 3-step flow (`iemis-import/page.tsx:87`); no shared Wizard; no wizard for student create / fee structure / exam setup |
| RatingInput | **MISSING** | appraisals use bare number inputs |
| SignaturePad | **MISSING** | dismissal/visitors capture none |
| QRCode | **MISSING** | `qrcode` dep unused; receipts/ID cards/library books show none |
| Barcode / ID-card canvas | **PARTIAL** | designer fabric canvas does ID cards (strong), but no barcode/QR element, no bulk-print preview |
| PrintLayout (print stylesheet) | **PARTIAL** | `@media print` blocks in 4 certificate pages + exams/online/questions; no global print styles, no print for tables/ledger/lists |
| PDFViewer | **MISSING** | marksheets/report-cards download as blob; never previewed in-app |
| DiffViewer | **MISSING** | website page history has restore (`website_builder.py /history`) but no visual diff |
| MapView wrapper | **PARTIAL** | `LiveBusMap` (transport-only); no geofence/route polyline, no stop editor on map |
| MediaPlayer (audio/video) | **MISSING** | LMS lesson content types include video but no player widget (`lms/page.tsx:147`); elibrary is a link list |
| VoiceRecorder | **MISSING** | diary/notes text-only |
| NotificationBell (with panel) | **PARTIAL** | header polls unread count every 30 s (`header.tsx:103`) + dropdown hand-rolled; separate page duplicates it; socket.io unused |
| CommentThread | **MISSING** | assignments grading has one-shot feedback textarea; no threaded discussion |
| ApprovalWorkflow widget | **PARTIAL** | hr/leaves approve/reject buttons in table; no batch, no comments, no delegation |
| StatusPill | **PARTIAL** | per-page Badge+tailwind maps (`fees/collect:132`, `attendance:43`, `students:65`) — 3 conflicting status palettes |
| CopyButton | **PARTIAL** | ai-tools pages hand-roll `navigator.clipboard` calls (no "copied" state on button) |
| InfiniteScroll / VirtualizedList | **MISSING** | fees/collect fetches `per_page: 500` and renders all (`fees/collect:316`); attendance fetches 200 students |
| SearchInput (debounced) | **PARTIAL** | header has `useDebounce` (300 ms); students page fires a query on **every keystroke** (`students/page.tsx:297` no debounce) |
| SortableList (drag to reorder) | **MISSING** | website page sections have a `reorder` API (`website_builder.py`) but editor reorder is button-based |
| TreeView | **MISSING** | file manager is flat list; academics class→section hierarchy flattened |
| Accordion / FAQ | **MISSING** | faqs page (orphaned) hand-renders |
| JSONSchemaForm (plugin config) | **PARTIAL** | `/plugins/[slug]/settings` renders typed fields from `config_schema.yaml` (string/number/boolean/json) — good; but only 6 of 53 plugins ship a schema, and there's no select/enum/color/date field types, no sections/groups |
| Wizard-form validation (zod+RHF) | **PARTIAL** | login/register only; every dashboard form is raw `useState` + manual `required` |

---

## 2. Per-plugin feature → UI mapping (the core output)

Rating scale per page: density, scanability, feedback, keyboard, mobile, empty states, i18n (1–5, where 3 = acceptable).

### 2.1 attendance — `app/dashboard/attendance/page.tsx` (589 ln)
**Backend:** `/attendance/mark, submit, list, summary, school-overview, students/<class>, student/<id>/summary, teachers/mark, teachers/list, leave-requests (+approve/reject)` (api/v1/attendance.py).

| Feature | UI needed | Present? | Gap |
|---|---|---|---|
| Daily marking | student grid + status toggles + date picker | ✅ Good: per-row 4-button status strip (`:476-490`), BSDateInput, All Present/Absent bulk (`:337-352`), sticky save bar (`:501`) | No keyboard marking (j/k or 1-4), no per-student note, no "unmarked" remainder state after edit, no biometric/late-arrival merge view |
| Summary | live counts + % | ✅ 5-tile strip (`:396-423`) | No mini bar-chart, no week strip to jump days |
| History view | month heat-grid per student | ❌ "Today's Summary" tab is the same list re-rendered (`:529-586`) — the `/attendance/student/<id>/summary` endpoint has **no UI at all** | Build StudentAttendanceHeatmap (month × status grid) as drawer on row click |
| Leave requests | approval queue | ❌ `leave-requests` endpoints have **no page anywhere** | ApprovalQueue widget (bulk approve, reason preview) |
| School overview | attendance% by class | ❌ `school-overview` endpoint unused | Heat-bar rows on dashboard |
| Reports | month summary + CSV | ✅ separate page | Raw `<input type="month">` (AD!) while marking uses BS — inconsistent; no class-level chart |

Ratings: density 4, scanability 4, feedback 4, keyboard 1, mobile 2 (5-col grid + wide table), empty 4, i18n 2.

### 2.2 fees — `fees/collect/page.tsx` (1652 ln) + types/structure/defaulters/scholarships/reports
**Backend:** collections CRUD, pay, pay-online, refund, receipts(+pdf), statement/pdf, structures(+apply), batch-monthly, types, payment-methods(+QR upload), defaulters(+remind), scholarships, summary, recent, outstanding, collections/export (api/v1/fees.py).

| Feature | Present? | Gap |
|---|---|---|
| POS workspace | ✅ Best page in app: master-detail (student accounts left `:620-688`, workbench right), summary tiles, overdue-first sort, bill create/adjust dialog with BS month defaulting (`:853-889`), partial payments, online-gateway redirect, receipt PDF download, statement PDF | No keyboard flow at all (no `/` to focus search, no F2 collect) despite being the page clerks live in; search fires un-debounced; no "collect next in queue"; refund endpoint has **no UI** |
| Receipts | ✅ PDF blob download | No printable 80mm thermal layout, no in-app preview, no reprint queue |
| Payment methods | ✅ schema-driven service (`lib/services/payment-methods.service.ts`) | QR upload exists in backend (`/payment-methods/upload-qr`) — no admin UI to manage QR/upi images |
| Defaulters | ✅ table + per-row remind | No bulk remind, no message preview, no filtering by amount/days |
| Structures | ✅ table + apply + batch dialog | Apply confirmation is a plain toast-level action; no dry-run preview of generated bills; no matrix editor (class × fee-type grid) |
| Scholarships/types | ✅ CRUD tables | No percentage-vs-amount smart input |
| Export | ✅ CSV on reports page only | No CSV on collect desk itself |

Ratings: density 5, scanability 4, feedback 4, keyboard 1, mobile 1 (three-pane), empty 5, i18n 2.

### 2.3 exams — hub (811) + marks (450) + results (912) + report-cards (232) + schedule/grades/online
**Backend:** marks CRUD, subjects, results, grade-sheet, marksheet(+html), designer-marksheet, publish, report-cards(+bulk-pdf), bulk-marksheet-pdf, online exams (+submit), grade-table (api/v1/exams.py).

| Feature | Present? | Gap |
|---|---|---|
| Mark entry | ✅ spreadsheet-like table with live total/%/grade/GPA preview and pass-fail color (`marks:360-443`), entered/pass/fail counters | **No Enter-to-next-row keyboard flow** (the single biggest mark-entry accelerator), no paste-from-Excel into the grid, no abs/absent sentinel, no undo, no per-exam save-draft state indicator |
| Results | ✅ rank table, stats, marks-ledger tab, designer-marksheet template preview, per-student HTML marksheet | No distribution histogram, no subject-wise analysis, no failure-list one-click |
| Report cards | ✅ bulk PDF via backend | No in-app PDF preview; no "print all for one class directly" |
| Publish | endpoint exists (`/publish`) | No publish workflow UI in results page (no locked/unlocked state indicator) |
| Online exams | ✅ create + AI question generator + questions page with print CSS | No question bank, no per-question preview render (MCQ options as plain text), no timer UI |
| Grade table | ✅ read-only table | Not editable despite backend POST — actually read-only; fine |

Ratings (marks): density 5, scanability 4, feedback 3, keyboard 1, mobile 1, empty 3, i18n 2.

### 2.4 timetable — `timetable/page.tsx` (350) + generate + teacher
**Backend:** `/timetable/slots(+<id>), /generate, /save, /teacher/<id>` (api/v1/timetable.py).

| Feature | Present? | Gap |
|---|---|---|
| Grid view | ✅ day × period raw `<table>` (`:150-195`) | No subject color coding, no teacher-conflict highlighting, no break/period-time row header, maxPeriods derived not configurable |
| Slot edit | Dialog form with **raw `<select>`** (not radix Select) for day (`:325`), hover-only delete button (undiscoverable, no touch affordance) | Click-to-add on empty cell, drag-to-move between cells, click slot → popover edit |
| Auto-generate | separate page | No conflict report UI / acceptance diff (compare generated vs current) |
| Teacher timetable | thin page | `/timetable/teacher/<id>` unused in class view; no teacher-substitution/absence flow |

Ratings: density 3, scanability 3, feedback 3, keyboard 1, mobile 1 (horizontal scroll), empty 3, i18n 2.

### 2.5 lms — `lms/page.tsx` (264) 
**Backend:** courses CRUD, lessons, topics, materials, quizzes(+attempt), enroll, progress (api/v1/lms.py).

| Feature | Present? | Gap |
|---|---|---|
| Courses | ✅ list + create dialog + detail panel | Lessons are non-reorderable cards; no content editor (video upload, rich text), no material attach flow using FilePicker |
| Quizzes | endpoints exist | **No quiz builder UI, no attempt review UI** — biggest LMS gap |
| Progress | endpoints exist | No progress bars / completion % anywhere in UI |
| Enrollment | endpoint exists | No student picker UI |

### 2.6 assignments — `assignments/page.tsx` (744)
**Backend:** CRUD, submissions, submit, grade, ai-grade.

| Feature | Present? | Gap |
|---|---|---|
| Create/edit | ✅ dialog with attachment upload (progress!) via `/files/upload` (`:236-252`) | No rich text for instructions; due date is plain date input, no BS; no class-section multi-target |
| Grading | ✅ submissions dialog + grade modal + **AI grade button** | No side-by-side (submission ↔ grade) layout, no annotations, no bulk-grade-by-status, no returned/regrade states |
| Status tracking | table columns | No "X/Y submitted" progress bar, no missing-submission list one-click, no reminder send |

### 2.7 library_management + elibrary — `library/page.tsx`, `library/{books,catalog,checkout,overdue}`, `elibrary/*`
**Backend:** books CRUD, issues(+return), settings, teacher/library; elibrary books/papers/resources.

| Feature | Present? | Gap |
|---|---|---|
| Books catalog | ✅ table + add dialog | No ISBN barcode/QR generate/print, no cover thumbnails, no duplicate detection |
| Issues | ✅ tab + issue + return | No scanner input (barcode wedge works but no focus-target field), no overdue fine calculator shown at return time, no bulk return |
| Overdue | ✅ list | No send-reminder action (backend has none either — SMS plugin could be wired) |
| e-library | ✅ list + add-by-URL dialog | **No file upload integration in the main page** (upload is a separate page), no PDF viewer/player, no reading progress, no class-wise visibility controls |

### 2.8 transport / gps_tracking — `transport/page.tsx` (+routes/buses/stops/pickup-points/allocation/logs/map)
**Backend:** routes/buses/stops CRUD, gps-logs (api/v1/transport.py) + socket.io `gps_update`.

| Feature | Present? | Gap |
|---|---|---|
| Live map | ✅ **the only realtime widget in the app** (`LiveBusMap.tsx`: socket + 15 s poll fallback, staleness halo) | No route polyline, no stop markers, no ETA, no geofence alerts, no per-bus history playback from gps-logs |
| Routes/buses/stops | ✅ tabs + dialogs | No map-based stop picker (lat/lng hand-entered presumably), no student allocation matrix |
| Logs | ✅ table | No date-range filter UI polish, no export |

### 2.9 hr_payroll — `hr/page.tsx` + payroll(+settings) + leaves(+report) + staff-attendance + appraisal + expenses
**Backend:** payroll CRUD/generate/approve/payslip/pay/bulk-action, leaves(+approve/report), appraisals, expenses(+categories), stats (api/v1/hr_payroll.py, 1434 ln).

| Feature | Present? | Gap |
|---|---|---|
| Payroll run | ✅ month picker, generate, editable rows (components map→rows `:63-80`), bulk approve/pay dialog, payslip | No payslip PDF preview inline, no variance-vs-last-month column, no lock/payroll-period state machine visible |
| Leave approval | ✅ filter chips + approve/reject | No reason/attachment preview, no balance display, no bulk approve |
| Appraisals | page exists | RatingInput missing (bare numbers) |
| Expenses | page + categories | No receipt attachment flow |
| Staff attendance | page exists | Reuses nothing from student attendance grid (duplication) |

### 2.10 notices / sms_notifications — `notices/page.tsx` (295) + `sms/page.tsx` (648)
**Backend:** notices(+events CRUD), sms send/history/templates/stats; communications.py (contacts, messages, broadcast, diary).

| Feature | Present? | Gap |
|---|---|---|
| Notice create | ✅ dialog, publish toggle | **No audience targeting UI** (class/section picker), no attachment, no rich text, no schedule-publish, no Nepali/English bilingual body fields despite i18n ambitions |
| Events | ✅ tab + dialog | BS date handling via displayEventDate only |
| SMS send | ✅ template select, live SMS-credit counter (`sms:233`), comma-separated recipients | No recipient picker from groups (class/guardians/defaulters), no per-class quick-fill, no cost preview, no delivery report per recipient |
| Diary/communications hub | pages exist | Diary categories CRUD ok; no parent-side thread view (portal stub) |

### 2.11 admission — `admission/page.tsx` (602)
**Backend:** inquiries CRUD, applications CRUD + status transitions, dashboard (api/v1/admission.py).

| Feature | Present? | Gap |
|---|---|---|
| Pipeline | ✅ stat cards per stage + **encoded legal-transition machine client-side** (`:71-88`) + detail dialog + convert inquiry→application | No kanban drag between stages, no follow-up reminders/dates, no source analytics, no note timeline on applicant |
| Inquiries | ✅ table + status update | No follow-up-due filter, no call-log |
| Application form | long dialog | Not a wizard; document upload absent (birth cert, photo) |

### 2.12 iemis_importer — `iemis-import/page.tsx` + history; `bulk-uploads/csv`
**Backend:** formats, template, validate, import, history(+log) (api/v1/iemis_importer.py, 1235 ln).

| Feature | Present? | Gap |
|---|---|---|
| 3-step flow | ✅ hand-rolled upload→preview→done stepper with StatBoxes and error list (`:202-380`) | The **best import UX in the app**, but: no column-mapping UI, no inline row-level fix, error list not copyable/downloadable, no diff (new vs update) preview |
| CSV bulk uploads | ✅ template download + result summary card | Same gaps; "reached only via students manifest subitems" (orphan nav) |

### 2.13 website_builder — `website-builder/editor/page.tsx` (839) + pages/themes/seo/ai-builder/domain
**Backend:** themes(+preview-css, apply), status, pages(+publish-draft, revert-draft, history+restore), sections(+reorder, available), ai/generate-design, ai/generate-copy, domain(+verify), seo, publish (api/v1/website_builder.py).

| Feature | Present? | Gap |
|---|---|---|
| Visual editor | ✅ palette + rendered preview + per-section property panel + **autosave to draft with save-state badge** (`:696-701`) — most modern page in the app | Reorder is button-based though a `reorder` API exists (needs dnd); no device-width preview toggle (desktop/mobile); no undo/redo; no page-level diff/history UI despite backend history+restore endpoints |
| Themes/SEO/domain | ✅ pages | SEO has no preview snippet (SERP preview widget missing); domain verify has no step guidance |
| AI builder | ✅ generate-design/copy wired | No prompt-history, no before/after compare |

### 2.14 design_studio — `designer/page.tsx` + editor (CanvasEditor 1171 ln) + writer2 (971) + bulk
**Backend:** templates CRUD, data-sources(+records) (api/v1/design_studio.py).

| Feature | Present? | Gap |
|---|---|---|
| Fabric canvas editor | ✅ properties/layers/graphics/AI panels, shortcuts lib (153 ln), snapping, version history button | Strong; but no multi-page document, no barcode/QR elements, no data-fill CSV column preview (DataFillPanel exists — check) |
| Writer | ✅ tiptap doc editor, export DOCX/PDF, print, find/replace | No Nepali complex-text niceties documented; no collaborative presence |
| Bulk generate | ✅ page | No progress/queue UI for hundreds of cards |

### 2.15 ai_suite — `ai-tools/*` (question-paper, lesson-plan, report-remarks, timetable, learning-paths, progress, insights), `ai-workbench`, `analytics/ai-usage`
**Backend:** ai_tools.py + ai_tutor.py + adaptive_learning.py + analytics.py.

| Feature | Present? | Gap |
|---|---|---|
| Generate UX | ✅ form → spinner → plaintext result + copy | **Result is plain `<pre>`-style text everywhere** — no markdown render, no KaTeX for math questions, no export to docx/pdf, no regenerate-with-changes, no streaming |
| Report remarks | ✅ loops students, per-student generate + copy-all | Sequential `await` per student (`:61-67`) — no batch endpoint usage/queue UI; will time out for 40 students |
| Timetable AI | page exists | No conflict visualization |
| Insights/learning-paths | wired | No charts (recharts idle) |

### 2.16 Plugin system surfaces (marketplace + installed + settings)
- `marketplace/page.tsx` (720): lifecycle-state machine documented in-file (FREE/PAID × trial), category grouping, install filter, search (deep `matchesMarketplacePluginSearch`), SubscribeDialog. Good. Gaps: no plugin screenshots/gallery, no reviews/ratings, no "what's new", no comparison of plans, install lacks confirm-dialog for paid (goes straight to trial).
- `plugins/page.tsx`: WP-style activate/deactivate/uninstall — uninstall uses `window.confirm`.
- `plugins/[slug]/settings/page.tsx` (541): schema-driven typed fields with dot-path merge — **the JSONSchemaForm seed**. Gaps: only 4 field kinds (string/number/boolean/json); no enum/select, no group headings, no per-field help text from schema descriptions, JSON kind = raw textarea.

---

## 3. Cross-cutting UX patterns audit

**Tables/pagination/sorting/filtering — inconsistent by construction.**
- Pagination: students page=20 with prev/next only; fees/collect `per_page:500` no pagination; attendance `per_page:200`; exams/marks & results `per_page:200`; assignments `per_page:200`; library issues unpaginated. Five pages hardcode `per_page:100`/`500`/`200` instead of real pagination.
- Sorting: **zero sortable columns anywhere** (checked all TableHead usages — none interactive).
- Filtering: every page re-implements a select row; `clearFilters` duplicated; only 4 dashboard pages sync anything to the URL (`useSearchParams` in 7); refresh loses all state.
- Row actions: 2–3 inline ghost buttons per row (students) vs DropdownMenu (9 files) — inconsistent; no right-click context menu.

**Forms/validation.** react-hook-form+zod installed but used in exactly 2 auth pages. Dashboard forms: raw useState, HTML `required`, single generic `toast.error("Failed to update student")` — no field-level errors surfaced from backend (backend errors like `error.response.data.error` are shown only in fees). AddStudentDialog packs student+guardians+password into one dialog with `max-h-[60vh]` scroll — should be a wizard.

**Modals vs pages.** Dialogs (68 files) for create/edit/detail/confirm/preview; deepest forms (student edit, payroll row, fee bill) overflow dialogs. No Drawer/Sheet for read-only detail (student detail is a full page — fine — but admission detail, assignment submissions, plugin settings preview would be better as drawers).

**Destructive confirmation.** `window.confirm` × 22 files including student delete. Only a few radix Confirm dialogs (academics has a real one `academics/page.tsx:160`). No typed-confirmation for irreversible ops, no undo toasts anywhere (sonner `action` unused).

**Optimistic updates.** Exactly 1 quasi-`onMutate` (settings/backup). Everything else invalidates and re-fetches — tables flash `PageLoader` on every save.

**Toasts vs inline.** Sonner everywhere (132 files) — good. But success messages often bury the useful payload (receipt number) with no action button ("View receipt" possible via sonner action).

**Date handling AD/BS.** `BSDateInput` exists (16 files) but: attendance reports uses native AD month input; fees payDate is ISO string; students DOB in edit dialog is a raw text input `placeholder="2065-04-15"` (`students/page.tsx:1042`) while add dialog also raw — BS picker not used there; `displayBS` used ad hoc. No date-range picker, no BS month selector component. `html lang="ne"` with English copy.

**Money formatting.** `Rs. ${value.toLocaleString()}` duplicated in 33 files; `formatNepaliCurrency` (with Nepali digits) used once. No cents policy; no NPR suffix option; no accounting-style right alignment class standard.

**Name ordering.** everywhere `{first_name} {last_name}` concatenated inline (~dozens of sites) — no central `fullName()` helper; sorting is backend-order only (no alphabetical column sort).

**Exports/prints.** CSV export hand-built in 8 pages (attendance/reports, fees/reports, reports/*, hr/leaves/report) each re-implementing blob+anchor; `lib/hooks/useExport.ts` (413 ln) exists but is **imported by zero pages** — dead code. `window.print` in 4 pages with per-page `@media print` CSS. No global print stylesheet, no print preview.

**Upload flows.** FilePicker dialog is decent (type filter, multi, preselect) but no drag-drop, no progress (except assignments), no image preview grid, no crop. Files page is 1174 ln monolith with its own keyboard handlers.

**Search.** header global search debounced 300 ms against `/search` (limit 8) — good core; missing: ⌘K, recent items, keyboard nav of results. In-table searches: students (no debounce), fees (no debounce), elibrary (query-per-keystroke).

**Navigation depth.** API-driven sidebar of 155 items with Nepali labels, 228 px fixed; collapse works; **no mobile drawer at all** (`dashboard-layout.tsx` is 16 ln, sidebar hidden classes absent); breadcrumbs absent; deep pages (students/[id], parents/[id]) have no "back to list" affordance beyond browser back. Notification bell polls 30 s; socket idle.

**Role-based landing.** `/dashboard` = analytics/overview KPI cards + active-plugin card + quick actions (static links). No per-role widgets, no onboarding checklist, no "continue where you left".

**Loading/feedback.** 1 route-level `loading.tsx`; everything else per-page `PageLoader`/spinner; no skeletons → layout jumps; no `useTransition` on filters.

---

## 4. IDEATION — 25 concrete upgrades, ranked by user impact

Impact ⇒ (S ≤1d, M ≤3d, L >3d). Each tied to a screen + widget.

1. **Marks-entry keyboard flow** — exams/marks: Enter moves to next student's theory cell, arrows navigate, "A" = absent, paste 2-column Excel range into grid (HiddenInput capture). Widget: `MarksGrid` wrapper. Impact ★★★★★ Effort M.
2. **Shared DataTable** with server pagination/sort/URL-sync/column-visibility/bulk bar — adopt first on students, fees collections, defaulters, library books, hr leaves. Impact ★★★★★ L (amortizes into every screen).
3. **Attendance keyboard + unmarked state** — attendance: 1-4 keys set status for focused row, j/k navigation, show "12 unmarked" chip in save bar instead of silently defaulting all-present on reload. Widget: `StatusToggleGroup` + `Kbd`. ★★★★★ S.
4. **⌘K command palette** — nav jump (155 sidebar items!), "collect fee for <student>", "mark attendance 10A", recent entities; reuse header `/search`. Widget: `CommandPalette` (cmdk). ★★★★★ M.
5. **ConfirmDialog + undo toasts** — replace 22 `window.confirm` (student delete, uninstall plugin, remove slot, delete book) with radix AlertDialog; sonner undo (5 s) for deletes/slot-removal. ★★★★☆ S.
6. **Drawer detail views** — admission applicant, assignment submissions, leave request, notification digest: radix Sheet-like side panel (build `Sheet` primitive) so list context is kept. ★★★★☆ M.
7. **Fee-collect keyboard POS** — `/` focus search, Enter opens first outstanding, Ctrl+Enter collect, receipt toast with "Print" action; per_page:500 → virtualized list (`VirtualList`). ★★★★☆ M.
8. **Attendance month heatmap** — per-student month grid in a drawer from `/attendance/student/<id>/summary`; row click in reports. Widget: `HeatmapCalendar`. ★★★★☆ M.
9. **Admission pipeline board** — kanban columns = stages, drag = status transition (transition rules already encoded client-side `:71-88`); card shows days-in-stage; stage SLA color. Widget: `KanbanBoard` (dnd-kit). ★★★★☆ M.
10. **URL-synced filter state + saved views** — `useSearchParams` for class/section/status/search on students/fees/attendance; "Save view" chip row stored in zustand-persist per user. Widget: `FilterBar`. ★★★★☆ M.
11. **Student create wizard** — 3 steps (Student → Guardians → Review) with live preview of generated login; use BSDateInput for DOB (currently raw text!); RHF+zod. ★★★★☆ M.
12. **Notices: audience targeting + rich text + attachments** — class/section/role multi-select (TagPicker), tiptap minimal editor reused from writer, FilePicker attach, schedule-send; bilingual (ne/en) body tabs. ★★★★☆ M.
13. **Global print stylesheet + table print/export** — `@media print` defaults (hide sidebar/header/actions, A4 table repeat-header), plus one "Export CSV" on every DataTable via the dead `useExport` hook finally wired. ★★★★☆ M.
14. **Skeletons + row-level loading** — `<Skeleton/>` primitive + table/query presets per page instead of full-page PageLoader; fixes layout jump on every filter change. ★★★☆☆ S.
15. **Leave/approval queue with bulk actions** — hr/leaves + attendance leave-requests (endpoint currently has no UI at all): checkbox bulk approve/reject with comment, balance column. ★★★☆☆ S.
16. **SMS recipients group picker** — replace comma textarea with cohort select (class, section, guardians of defaulters, fee-overdue) + count preview + cost estimate; delivery report table per send. ★★★☆☆ M.
17. **Timetable drag grid + conflict engine** — drag slots between cells (dnd-kit), red outline for teacher double-booking, click-empty-cell to add, period-time header row. ★★★☆☆ M.
18. **AI results as rendered markdown/KaTeX + export** — question-paper/lesson-plan render markdown, KaTeX for math, one-click docx/pdf export (docx dep already present); batch remarks with progress bar. ★★★☆☆ M.
19. **IEMIS import column-mapping + row-fix table** — mapping step between upload and validate, downloadable/copyable error table, inline cell edit before commit. ★★★☆☆ M.
20. **Notification center realtime + preferences** — socket.io (already connected for buses) drives bell; panel with mark-read/filter; per-event preference toggles via plugin settings schema. ★★★☆☆ M.
21. **NPR currency + name helpers** — `formatNPR()` and `fullName()` in lib/utils adopted via codemod across 33 files; Nepali-digit toggle in settings. ★★★☆☆ S.
22. **Mobile dashboard shell** — off-canvas sidebar (Sheet), table cards under `md:` breakpoint for the 6 hottest lists (students, fees, attendance, notices, library, leaves). ★★★☆☆ L.
23. **Onboarding checklist** — /dashboard card: "Add classes → add students → fee structure → first bill → first notice" with live completion checks and deep links; hides when done. ★★★☆☆ M.
24. **Report-cards/marksheet in-app PDF preview + publish flow** — iframe/blob preview before bulk download; publish/unpublish toggle with locked-state badge on results page. ★★☆☆☆ S.
25. **Plugin settings schema v2** — enum/select, group sections, help text, color/date field kinds; ship `config_schema.yaml` for the 10 most-installed plugins (sms, exams, library already partial). ★★☆☆☆ M.

---

## 5. Widget roadmap (design-system backlog)

Priority = new shared components, with props sketch, used-by projection, effort.

**Tier 1 — build now (every plugin screen benefits)**
| Widget | Props (sketch) | Used by | Effort |
|---|---|---|---|
| `DataTable<T>` | `columns, fetcher(params)→{rows,pagination}, serverSort, filters, bulkActions[], rowActions, exportable, stickyHeader, columnVisibility, onRowClick, emptyState, isFetching` | students, fees/collect, defaulters, library, leaves, admission, assignments, books, users, parents, logs… (~15 screens) | L |
| `ConfirmDialog` | `title, description, confirmLabel, destructive, requireTyped?` | 22 call-sites | S |
| `EmptyState` | `icon, title, description, action` | ~30 screens | S |
| `ErrorState` | `error, retry` | ~25 screens | S |
| `Skeleton` + `TableSkeleton rows, cols` | — | ~40 screens | S |
| `PageHeader` | `title, subtitle, actions, breadcrumb` | every dashboard page (kill 30 hand-rolled headers) | S |
| `FilterBar` | `filters[], values, onChange, savedViews, urlSync` | students, fees, attendance, library, admission, sms history | M |
| `Pagination` | `page, pages, total, onPage, pageSize?` | all paginated tables | S |
| `StatusPill` | `status, map` (single source for paid/pending/overdue/present/absent/published palettes) | ~20 screens | S |
| `Sheet` (drawer) | radix dialog side variant | detail views (§4 #6) | S |

**Tier 2 — plugin drivers**
| Widget | Props | Used by | Effort |
|---|---|---|---|
| `CommandPalette` | `commands[], entitySearch` | global | M |
| `Wizard` / `Stepper` | `steps[], onNext, review` | student create, admission application, fee structure apply, IEMIS import, exam setup | M |
| `DateRangePicker` (BS+AD dual) | `value{from,to}, presetToday/ThisMonth/ThisBSMonth` | attendance/reports, fees/reports, sms history, gps logs, exam results | M |
| `TagPicker/MultiSelect` (searchable) | `options, selected, virtualized` | SMS recipients, class targeting, section filter (60+ items) | M |
| `KanbanBoard` | `columns, cards, onMove(legal transitions)` | admission, leave approvals, incident escalations | M |
| `HeatmapCalendar` | `days × statuses, legend` | attendance summaries, wellbeing moods | M |
| `RichTextEditor` (light) + `MarkdownRenderer`(+KaTeX) | tiptap preset; `source` | notices, diary, assignments, AI outputs, announcements | M |
| `FileDropzone` | `accept, multiple, progress, maxSize, onUploaded` (wraps FilePicker) | elibrary, portfolio, health records, admission docs, website media | M |
| `CurrencyInput` / `PhoneNumberInput(NP)` / `PercentageInput` | masked, validate | fees, payroll, students, admission | S |
| `Kbd` + `useHotkeys` | — | attendance, marks, fees POS, palette | S |

**Tier 3 — specialist**
| Widget | Props | Used by | Effort |
|---|---|---|---|
| `TimetableGrid` | `slots, onMove, conflicts, editable` | timetable, teacher view, generate diff | M |
| `MarksGrid` | `students, config, onChange, pasteHandler` | exams/marks (+AI remark loop) | M |
| `ChartKit` (line/bar/pie/heat recharts wrappers w/ tokens) | `data, type, loading` | analytics, attendance, fees, gamification, ai-usage | M |
| `ApprovalQueue` | `items, onBulkDecision, comment` | hr leaves, attendance leave-requests, payroll bulk | S |
| `PrintFrame` | `children, orientation, size` (+global print CSS) | certificates, marksheets, receipts (thermal), lists | M |
| `QRCodeWidget` / `BarcodeField` | `value, size` (qrcode dep already installed) | library books, ID cards, receipts, visitor passes | S |
| `VirtualList` | `items, rowHeight, render` | fees 500-row fetch, attendance 200, files | S |
| `MediaPlayer` | `src, type` | lms lessons, elibrary | M |
| `MapView` (generic leaflet wrapper) | `markers, polyline, fit` | transport stops editor, routes | M |
| `NotificationPanel` | `items, onRead, realtime` | header bell (replace 30 s poll) | M |
| `OnboardingChecklist` | `steps with done-predicates` | dashboard | M |
| `JSONSchemaForm` v2 (promote from plugin settings) | `schema, value, onChange` (add enum/section/help) | 47 plugins on generic settings | M |

---

## 6. Verdict in one paragraph

The kit is a solid 21-primitive shadcn base with two genuine differentiators (BSDateInput, plugin schema settings) and two strong bespoke apps (designer canvas, website editor with autosave-to-draft), but everything between "Card grid" and "fabric canvas" is hand-rolled per page: 14+ private pagination implementations, 0 sortable columns, 22 native confirms, 1 loading idiom, 3 conflicting status palettes, 33 copies of currency formatting, a dead 413-line export hook, and a recharts/tiptap/docx stack that only 3–4 screens actually touch. The plugin system's own surfaces (marketplace, WP-style lifecycle, schema settings) are ahead of the feature pages they gate — the fastest path to better UX is Tier-1 widgets above, adopted screen-by-screen starting with students, fees/collect, attendance, and exams/marks.
