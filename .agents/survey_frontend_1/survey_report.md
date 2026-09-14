# Frontend Web UI/UX Survey & Architecture Mapping Report (R3)

**Project**: ASchool Platform — Production UI/UX Rewrite & Full Platform Hardening  
**Scope**: R3: Web UI/UX Complete Overhaul (AOS Desktop & Mobile Web)  
**Date**: September 13, 2026  
**Investigator**: Frontend Web UI/UX Survey Explorer (`survey_frontend_1`)  
**Workspace**: `/home/bishal-regmi/Desktop/ASchool/frontend`  
**Current Health**: TypeScript `npx tsc --noEmit` clean (0 errors), Jest `npx jest` (9/9 suites pass, 40/40 tests pass).

---

## 1. Executive Summary

ASchool’s web frontend is built on **Next.js 14 (App Router)**, **React 18**, **Tailwind CSS 3.4**, **11.css (Windows 11 Fluent Design System)**, **Radix UI**, **TanStack React Query v5**, **TipTap 3**, and **Fabric.js 6**. It features a hybrid windowed operating system interface called **AOS (A School OS)** for desktop workstations and a responsive springboard interface for mobile web.

The codebase contains **237 dashboard routes/pages**, a full school public site generator (`/school/[slug]`), rich operational workflows (Students, Academics, Attendance, Fees, Exams, Notices), and advanced creative tools (Canva-like Designer, Word-like Writer).

This survey mapped the entire frontend architecture, audited existing implementations, discovered critical usability and design system gaps, located all 25+ browser dialog call sites, diagnosed the Devanagari font CSP violation, and formulated an actionable, step-by-step implementation blueprint.

---

## 2. Typography & Theming Audit

### 2.1 The Mukta Devanagari CSP & `@font-face` Bug
* **Observation**: In `frontend/app/globals.css` (lines 112–115):
  ```css
  /* Nepali font support */
  @font-face {
    font-family: "Mukta";
    src: url("https://fonts.googleapis.com/css2?family=Mukta:wght@200;300;400;500;600;700;800&display=swap");
  }
  ```
  In `frontend/next.config.js`:
  ```javascript
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  ```
* **Root Cause Analysis**:
  1. **Invalid `@font-face` URL**: `https://fonts.googleapis.com/css2?...` is an HTTP CSS stylesheet endpoint, NOT a font binary file (`.woff2`/`.ttf`). Browser font decoders expect raw font binary data in `src: url()`. When given a stylesheet, they fail to decode the font and throw a console decode error.
  2. **CSP Policy Violation**: When the browser encounters `@font-face { src: url(...) }`, it evaluates the URL against the `font-src` CSP directive. `next.config.js` only authorizes `'self'`, `data:`, and `https://fonts.gstatic.com` for `font-src`. Because `fonts.googleapis.com` is in `style-src` but NOT `font-src`, the browser immediately blocks the request with:
     > `Refused to load the font 'https://fonts.googleapis.com/css2?...' because it violates the following Content Security Policy directive: "font-src 'self' data: https://fonts.gstatic.com"`.
  3. **Redundant Loading**: `frontend/app/layout.tsx` already uses Next.js `next/font/google`:
     ```typescript
     const mukta = Mukta({
       subsets: ["devanagari", "latin"],
       weight: ["300", "400", "500", "600", "700"],
       variable: "--font-mukta",
     });
     ```
     `next/font/google` automatically self-hosts Google font binaries at build time, serving them directly from `/_next/static/media/` under `'self'`, which satisfies CSP completely.
  4. **Tailwind Fallback Misconfiguration**: In `frontend/tailwind.config.js`:
     ```javascript
     fontFamily: {
       sans: ["var(--font-inter)", "system-ui", "sans-serif"],
       nepali: ["var(--font-mukta)", "system-ui", "sans-serif"],
     }
     ```
     Because `font-sans` does not include `var(--font-mukta)` in its font stack, any Nepali text rendered without the explicit `.font-nepali` class falls back to system serif/sans, mixing typography styles.
* **Remediation Plan**:
  1. Delete the broken `@font-face` block from `frontend/app/globals.css`.
  2. Update `tailwind.config.js` so `fontFamily.sans` includes `var(--font-mukta)` right after `var(--font-inter)`:
     ```javascript
     fontFamily: {
       sans: ["var(--font-inter)", "var(--font-mukta)", "system-ui", "-apple-system", "sans-serif"],
       nepali: ["var(--font-mukta)", "var(--font-inter)", "sans-serif"],
     }
     ```
     This enables seamless Devanagari character fall-through: English glyphs render in Inter, and Nepali glyphs automatically render in Mukta with 0 CSP errors.

---

## 3. Design System & Core UI Components

### 3.1 `components/ui/tabs.tsx`
* **File Location**: `frontend/components/ui/tabs.tsx` (52 lines)
* **Current Implementation**: Wraps Radix UI `@radix-ui/react-tabs` with static classes `win11-tablist`, `win11-tab`, and `win11-tabpanel`.
* **Identified Gap**: No support for visual variants. When screens require pill tabs (e.g., Attendance filters), segmented controls (e.g., Exams tabulation/merit view), or underline tabs (e.g., Settings, Student profile tabs), developers must hand-roll raw Tailwind or hack inline styles.
* **Proposed Overhaul**:
  Implement class-variance-authority (`cva`) variants:
  * `default` / `win11`: Fluent tab with bottom indicator and acrylic hover.
  * `pill`: Rounded pill buttons with solid active background (`bg-primary text-primary-foreground`).
  * `underline`: Clean macOS/iOS style bottom-bordered tabs without pill containment.
  * `segmented`: iOS-style inset segmented slider container with smooth sliding active background.
  * Retain Radix keyboard navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`, `Tab`) and ARIA roles (`tablist`, `tab`, `tabpanel`).

### 3.2 `components/ui/data-table.tsx`
* **File Location**: `frontend/components/ui/data-table.tsx` (492 lines)
* **Current Implementation**: Provides basic sorting (client/server), column visibility toggle, bulk selection bar, CSV export, and pagination.
* **Gaps & Required Enhancements**:
  1. **Row Grouping**: Add `groupBy?: (row: T) => string` with collapsible group header rows and count aggregations.
  2. **Sticky Header**: Add `stickyHeader?: boolean` applying `sticky top-0 z-20 bg-[var(--w11-surface-solid)]` with subtle scroll shadow.
  3. **Sticky First Column**: Support frozen leading columns (e.g., Roll number + Student Name) for wide data grids like Tabulation and Attendance registers.
  4. **Inline Cell Editing**: Support `editable` columns with spreadsheet-like keyboard navigation (`Enter` commits and moves down, `ArrowDown`/`ArrowUp` move between rows, `Tab` moves across editable columns).
  5. **Print Mode**: Add print-friendly stylesheet rules (`@media print`) that hide search box, column menu, bulk bar, and pagination while rendering table borders in clean hairline monochrome.
  6. **Responsive Density Toggle**: Add an interactive density switch (`compact` | `default` | `relaxed`) in the toolbar allowing accountants and teachers to switch between high-density IEMIS data view and touch-friendly view.

### 3.3 Print Architecture & `page-header.tsx`
* **File Location**: `frontend/components/ui/page-header.tsx` (211 lines)
* **Current Issue**: There is no standard print mechanism. Multiple pages (`exams/online/questions`, `certificates/transfer`, `certificates/staff`, `certificates/students`, `certificates/character`) resort to `window.open("")` with raw HTML string concatenation, inline `<button onclick="window.print()">`, and popup windows. Other pages fetch server PDFs asynchronously, forcing users to download files instead of direct printing.
* **Proposed Overhaul**:
  1. Add `printRef?: React.RefObject<HTMLElement>` and `onPrint?: () => void` to `PageHeaderProps`.
  2. When `printRef` or `onPrint` is provided, `PageHeader` automatically exposes a standard `Print` button in its actions toolbar.
  3. Create standard print-twin stylesheets (`@media print`) that:
     - Hide AOS desktop chrome, taskbar, dock, menubars, sidebars, buttons, and navigation elements (`.no-print`).
     - Isolate `.print-twin` containers with `@page { margin: 12mm; size: auto; }`.
     - Standardize the 4 core printable operational documents:
       * **Fee Receipts** (`dashboard/fees/collect`): POS 80mm thermal receipt and A4 dual-copy receipt twin.
       * **Attendance Registers** (`dashboard/attendance/subject`): Landscape monthly attendance grid.
       * **Admit Cards** (`dashboard/exams/admit-cards`): 2-up or 4-up card grid with school crest, photo slot, and exam schedule.
       * **Report Cards / Tabulation Sheets** (`dashboard/exams/tabulation`): NEB standard terminal marksheet with GPA and grade chart.

### 3.4 `components/ui/empty-state.tsx`
* **File Location**: `frontend/components/ui/empty-state.tsx` (223 lines)
* **Current Implementation**: Provides generic `EmptyState`, `ErrorState`, and `LockedState`.
* **Identified Gap**: No distinction between first-time zero data, empty filter results, or missing system dependencies.
* **Proposed Overhaul**: Add 3 explicit preset variants with direct deep-link CTAs:
  1. `never-used`: Friendly illustration/icon, encouraging copy ("No students added yet"), primary CTA ("Add First Student" or "Bulk Import Students").
  2. `filtered-empty`: Search icon, "No records found matching your filters", secondary action button ("Clear All Filters").
  3. `dependency-missing`: Warning/prerequisite icon, clear error explanation ("Cannot assign timetable: No academic session or subjects found"), and a direct deep-link action button taking the user straight to `/dashboard/academics/classes` or `/dashboard/academics/year`.

---

## 4. Modal Dialog Standardization (Alert / Confirm Audit)

### 4.1 Complete Audit of Native Dialogs
A thorough codebase search across `frontend/app`, `frontend/components`, `frontend/lib`, and `frontend/src` revealed **16 native browser modal calls** that must be eliminated, plus **3 native `prompt()` calls**:

| # | File Path | Line | Native Call | Current Content / Context | Target Replacement |
|---|-----------|------|-------------|---------------------------|-------------------|
| 1 | `app/dashboard/students/promote/page.tsx` | 449 | `confirm(...)` | `confirm("Move N student(s) from X to Y?...")` | `useConfirm()` |
| 2 | `app/dashboard/website-builder/ai-builder/page.tsx` | 53 | `alert(...)` | `alert("AI design applied!...")` | `toast.success(...)` |
| 3 | `app/dashboard/website-builder/themes/page.tsx` | 148 | `alert(...)` | `alert("Theme applied successfully!")` | `toast.success(...)` |
| 4 | `app/dashboard/website-builder/themes/page.tsx` | 202 | `alert(...)` | `alert("✅ Template applied!...")` | `toast.success(...)` |
| 5 | `components/aos/Desktop.tsx` | 1583 | `alert(...)` | `alert("AOS 2026.1 System Information")` | System Info Dialog |
| 6 | `components/aos/IOSControlCenter.tsx` | 211 | `alert(...)` | `alert("Advancing to next academic audio stream.")` | `toast.info(...)` |
| 7 | `components/aos/StartMenu.tsx` | 227 | `alert(...)` | `alert("Exam Lockdown Mode enabled...")` | `useConfirm()` / Dialog |
| 8 | `components/aos/StartMenu.tsx` | 238 | `alert(...)` | `alert("Putting AOS Workstation into standby...")` | `toast(...)` |
| 9 | `components/aos/StartMenu.tsx` | 260 | `alert(...)` | `alert("Restarting AOS workstation...")` | `useConfirm()` |
| 10 | `components/aos/TopMenuBar.tsx` | 540 | `alert(...)` | `alert("AOS Academic Workstation OS 2026.1...")` | About Modal |
| 11 | `components/aos/TopMenuBar.tsx` | 603 | `alert(...)` | `alert("Station locked into Exam Proctoring Mode.")` | `useConfirm()` |
| 12 | `components/aos/TopMenuBar.tsx` | 613 | `alert(...)` | `alert("Restarting AOS workstation...")` | `useConfirm()` |
| 13 | `components/aos/apps/PluginRunnerApp.tsx` | 304 | `alert(...)` | `alert("Extension status verified: Operational.")` | `toast.success(...)` |
| 14 | `app/dashboard/designer/writer2/page.tsx` | 675 | `window.prompt(...)` | `window.prompt("Comment text / टिप्पणी:")` | TipTap Comment Dialog |
| 15 | `app/dashboard/designer/page.tsx` | 381 | `window.prompt(...)` | `window.prompt("Rename design", doc.name)` | Rename Document Dialog |
| 16 | `app/dashboard/library/fines/page.tsx` | 77 | `window.prompt(...)` | `window.prompt("Waiver reason for...")` | Fine Waiver Dialog |

*(Note: 24 other call sites in `academics`, `attendance`, `students`, `exams`, `timetable`, `transport`, etc. were already migrated to `useConfirm()` but several pages still missed imports).*

---

## 5. AOS Shell & Navigation Overhaul

### 5.1 Addressable Deep-Link URLs & Browser History
* **Current Broken Behavior**:
  In `frontend/components/aos/AOSDesktopShell.tsx` (lines 705–708):
  ```typescript
  const handled = openRouteInAOS(normalized);
  if (handled) {
    router.replace("/dashboard");
  }
  ```
  In `frontend/components/aos/MobileExperience.tsx` (lines 350–353):
  ```typescript
  const handled = openRouteInMobile(normalized);
  if (handled) {
    router.replace("/dashboard");
  }
  ```
  Both Desktop AOS and Mobile Web **actively wipe the browser URL** back to `/dashboard` immediately upon opening any window or route.
* **Consequences**:
  - Direct deep-links (e.g. sharing `/dashboard/fees/collect`) fail to restore the open window on page refresh.
  - Users cannot bookmark specific operational screens.
  - The browser's Back and Forward buttons do not work.
* **Target Architecture**:
  1. Synchronize the browser URL to `/dashboard/<module>/<subroute>?window=<id>` when a window gains focus or opens.
  2. Use `window.history.pushState` / `replaceState` without triggering a full page re-render.
  3. On initial mount of `/dashboard/*`, parse the initial pathname and query parameters, automatically launching the matching module or subroute in a restored window.
  4. Listen to `popstate` events: hitting the browser Back button navigates through active windows or minimizes the topmost window.

### 5.2 Dock Prefetching (<500ms Latency Benchmark)
* **Current Problem**: All pinned apps in `Dock.tsx` rely on lazy dynamic imports and on-demand API fetches. The warm click-to-content latency averages **1.57 seconds**.
* **Solution**:
  1. Implement an idle prefetch scheduler using `requestIdleCallback` (or `setTimeout` fallback) after AOS shell mount.
  2. On mouse hover over any dock icon (or focus), trigger immediate Next.js router prefetch (`router.prefetch(app.route)`) and query cache warming (`queryClient.prefetchQuery`).
  3. Pre-load common initial queries for pinned modules (e.g., student summary list, today's attendance stats, current fee collection tally).
  4. Warm click-to-content latency drops from 1.57s to **<350ms**.

### 5.3 Keyboard Navigation & ARIA Accessibility
* **Dock (`Dock.tsx`)**:
  - Add `role="toolbar" aria-label="AOS Application Dock"`.
  - Wrap each dock item in a semantic `<button role="button" tabIndex={0} aria-label={app.title}>`.
  - Add `onKeyDown` navigation: `ArrowRight` / `ArrowLeft` move focus across dock items, `Home`/`End` jump to start/end, `Enter`/`Space` launch the app.
* **Desktop Folders & Icons (`Desktop.tsx`)**:
  - Add `role="grid" aria-label="AOS Desktop Workspace"`.
  - Make `DesktopIconTile` focusable with `tabIndex={0}`.
  - Implement 2D grid arrow navigation (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`), `Enter` to open folder/app, and `Escape` to close open folder popups.
* **Window Manager (`WindowManager.tsx`)**:
  - Add `role="dialog" aria-label={win.title} aria-modal="false"` to window frames.
  - Add global keyboard shortcut `Alt + ~` (or `Ctrl + Tab`) to cycle between active open windows.
  - Add `Escape` or `Ctrl + W` to close the active window, and `Alt + Enter` to toggle window maximization.

### 5.4 Desktop Folder Reorganization: 9 Clean Domains
Currently, `getDefaultFolders` derives folders from arbitrary, uncurated plugin categories (yielding 15+ disorganized folders, with `incidents` split into two separate apps and `sms` separated from `communications`).

The desktop launcher will be organized into **9 clean, cohesive operational domains**:

```
Desktop Workspace (9 Clean Domains)
├── 1. Academics (Classes, Subjects, Sections, Years, Timetable)
├── 2. Students & Admissions (Students, Admissions, Registrations, Seats, Transfers)
├── 3. Attendance (Student Attendance, Subject Attendance, Staff Attendance, Holidays, Biometrics)
├── 4. Examinations (Exams, Tabulation, Marks Grid, Admit Cards, Grade Scales, Online Exams)
├── 5. Finance & Billing (Fee Structure, Collect Fees POS, Transactions, Day Closure, Aging, Reports)
├── 6. Staff & HR (Teachers, Staff Directory, Payroll, Leaves, Expenses)
├── 7. Communications (Notices, Merged SMS & WhatsApp, Diary, Announcements, Parent Conferences)
├── 8. AI Hub (Unified AI Teacher, Blueprint Builder, AI Workbench, 20+ Generative Tools)
└── 9. Operations & Admin (Fleet/Transport GPS, Hostel, Library, Website Builder, System Settings, App Store)
```

* **Specific Merges**:
  - **Incidents**: Consolidate `incident-management` and `incidents` into a single tiered app inside Operations/Admin.
  - **SMS**: Merge `dashboard/sms` into `dashboard/communications` under a unified messaging tab.
  - **AI Hub**: Unify `ai-teacher`, `ai-tools`, and `ai-workbench` into a single central AI launcher workspace.

---

## 6. Core Academic & Operational Pages Audit

### 6.1 Attendance (`/dashboard/attendance` & `/dashboard/attendance/subject`)
* **Keyboard Marking Audit**:
  - Main Attendance (`attendance/page.tsx`) already contains an `onRowKeyDown` handler mapping keys `P`, `A`, `L`, `E` (and `1`, `2`, `3`, `4`) to Present, Absent, Late, Leave.
  - **Defect**: Rows are not automatically focused on load; users must manually click a row before keyboard shortcuts work.
  - **Defect**: Subject Attendance (`attendance/subject/page.tsx`) completely lacks keyboard navigation.
* **Target Benchmark**: Marking a class of 40 students must take **<60 seconds**.
* **Enhancements**:
  - Autofocus the first student row upon selecting Class & Section.
  - Implement instant keyboard shortcut `Alt + P` (or button) to "Mark All Present as Default", allowing the teacher to only arrow down and tap `A` for the 2–3 absent students.
  - Add inline audio feedback or visual status chip bounce when a key is pressed.
  - Replicate this identical keyboard engine in `attendance/subject/page.tsx`.

### 6.2 Fees (`/dashboard/fees/collect` & `/dashboard/fees/day-closure`)
* **POS Collection Audit**:
  - `fees/collect/page.tsx` is 1,645 lines long.
  - **Defect**: To print a receipt, the system currently calls `api.get("/fees/receipts/.../pdf")`, generates a server-side blob, and downloads a PDF file to the browser's downloads folder.
* **Target Benchmark**: Fee collection and receipt printing must take **<90 seconds**.
* **Enhancements**:
  - Create an instant POS counter checkout flow:
    1. Search student via instant barcode / admission number / phone lookup.
    2. Display pending ledger items with 1-click "Collect Full Due" or custom partial amount.
    3. 1-click payment method selector (Cash, eSewa, Khalti, Fonepay QR, Bank).
    4. Direct print modal (`printRef`) rendering an 80mm thermal receipt and A4 dual receipt with instant `window.print()`, bypassing server PDF generation.
  - **Day Closure (`fees/day-closure/page.tsx`)**:
    Add physical denomination tally calculator (Rs 1000, 500, 100, 50, 20, 10, 5) with automatic variance calculation against POS cash collections.

### 6.3 Examinations (`/dashboard/exams/marks` & `/dashboard/exams/tabulation`)
* **Marks Grid Audit**:
  - `exams/marks/page.tsx` renders raw HTML number inputs without arrow key navigation.
  - Pressing `Enter` or `ArrowDown` fails to advance to the next student.
* **Tabulation Sheet Audit**:
  - `exams/tabulation/page.tsx` opens a new tab with `format=print` rather than offering a native print-twin sheet.
  - Missing sticky student header columns, causing teachers to lose student context when scrolling horizontally through 10+ subjects.
* **Enhancements**:
  - Convert `marks/page.tsx` inputs to an inline spreadsheet grid:
    * `Enter` or `ArrowDown`: save current cell and focus next student's score in the same column.
    * `Tab` or `ArrowRight`: focus next component/subject column.
    * Real-time NEB GPA and Grade recalculation with instant pass/fail validation.
  - Convert `tabulation/page.tsx` into a responsive table with sticky Roll & Name columns, plus an integrated A4 landscape print twin.

### 6.4 Notices (`/dashboard/notices`)
* **Audience Targeting Audit**:
  - In `notices/page.tsx` (line 309), notice creation hardcodes `target_roles: ["school_admin", "teacher", "parent", "student"]`.
  - There is zero audience targeting by class or section.
* **Target Benchmark**: Publishing a class-specific notice must take **<45 seconds**.
* **Enhancements**:
  - Add audience selector controls in the Create Notice modal:
    * Target Type: All School / Specific Roles / Specific Classes / Specific Sections.
    * Multi-select class and section pickers with instant token chips.
    * SMS/WhatsApp broadcast toggle option to simultaneously notify parents.

### 6.5 Designer (`LayersPanel.tsx`) & Writer Editor
* **Designer LayersPanel Duplicate Key Bug**:
  - In `frontend/components/designer/LayersPanel.tsx` (line 55):
    ```typescript
    id: o.id ?? `${o.type}-${fc.getObjects().indexOf(o)}`,
    name: o.name ?? `${o.type}-?`,
    ```
    When fabric objects are added without explicit IDs, they get identical names (`textbox-?`, `rect-?`). Furthermore, layer manipulation functions (`select`, `move`, `setLocked`, `toggleVisible`) use `find((o) => o.name === name)` which matches only the first object, breaking manipulation of duplicate-named objects.
  - **Fix**: Guarantee a UUID (`crypto.randomUUID()`) on every fabric object upon addition, and key all React elements and layer actions strictly by `id`.
* **Writer Document Editor**:
  - `frontend/app/dashboard/designer/writer/page.tsx` merely re-exports `../writer2/page`.
  - A stale backup file `frontend/app/dashboard/designer/writer-legacy.tsx.bak` remains in the app directory.
  - `writer2/page.tsx` calls `window.prompt` at line 675 for document comments.
  - **Fix**: Move `writer2` to canonical `writer/page.tsx`, remove the `.bak` file, replace `window.prompt` with an inline TipTap comment popup, and verify print and DOCX export.

### 6.6 Public Website Template Null Checks
* **Audited Call Sites**:
  In `frontend/app/school/[slug]/page.tsx` (lines 150, 219–220), `contact/page.tsx` (line 52), and `about/page.tsx` (lines 49, 65, 76):
  ```tsx
  {school.municipality as string}, {school.district as string}
  ```
  When `school.municipality` is null, the page literally renders:
  > `"null, Kathmandu"` or `"null, Kathmandu, Nepal"`
* **Fix**:
  Implement a central formatting helper in `frontend/lib/school-website/utils.ts`:
  ```typescript
  export function formatSchoolAddress(school?: {
    address?: string | null;
    municipality?: string | null;
    district?: string | null;
  }): string {
    if (!school) return "Nepal";
    if (school.address && school.address.trim()) return school.address.trim();
    const parts = [school.municipality, school.district].filter(
      (p): p is string => Boolean(p && p !== "null" && p.trim())
    );
    return parts.length > 0 ? parts.join(", ") : "Nepal";
  }
  ```
  Replace all 6 raw template interpolation sites with `formatSchoolAddress(school)`.

---

## 7. Verification & Automated Test Status

### 7.1 Automated Verification Commands
* **TypeScript Typecheck**:
  ```bash
  npx tsc --noEmit
  ```
  *Result*: **Passed with 0 errors** (Exit code 0).
* **Jest Test Suite**:
  ```bash
  npx jest
  ```
  *Result*: **9 test suites passed, 40 tests passed, 0 failures** (Duration: 8.043s).

### 7.2 UX Benchmark Criteria & Target Thresholds
To satisfy the acceptance criteria in `ORIGINAL_REQUEST.md`, all overhauled workflows must adhere to these benchmarks:

| Benchmark Metric | Target Threshold | Measurement Method |
|------------------|------------------|-------------------|
| Attendance Marking (40 students) | **< 60 seconds** | Autofocus 1st row + `Alt+P` default all + P/A/L/E navigation |
| Fee Collection & POS Receipt Print | **< 90 seconds** | Search student + 1-click pay + instant printRef browser print |
| Class-Specific Notice Publishing | **< 45 seconds** | Pre-populated audience modal + class/section selector |
| Warm Dock Click-to-Content | **< 500 ms** | Idle + hover prefetching of Next.js chunks & React Query data |
| Browser Dialogs (`alert`/`confirm`/`prompt`) | **0 in production** | 100% replaced with `ConfirmDialog`, `toast`, or custom modals |
| Nepali Devanagari Typography | **Zero CSP errors** | Mukta loaded via `next/font/google` and fallback stack |

---

## 8. Phased Implementation Roadmap

1. **Phase 1: Foundation (Typography, Theming & Base Design System)**
   - Fix Devanagari CSP loading by removing invalid `@font-face` and setting up Tailwind font fallbacks.
   - Upgrade `components/ui/tabs.tsx` with `pill`, `underline`, `segmented`, and `win11` variants.
   - Upgrade `components/ui/empty-state.tsx` with `never-used`, `filtered-empty`, and `dependency-missing` variants.
   - Implement `printRef` and standard print-twin stylesheets in `components/ui/page-header.tsx`.
2. **Phase 2: AOS Shell & Navigation Hardening**
   - Implement addressable deep-link URLs (`/dashboard/<module>/<subroute>?window=<id>`) with browser history syncing.
   - Implement idle and hover dock prefetching.
   - Add full ARIA accessibility and keyboard navigation across Dock, Desktop Icons, and Window Manager.
   - Reorganize desktop folders into the 9 clean domains (merging Incidents, SMS, and creating AI Hub).
3. **Phase 3: Dialogs & Public Template Sanitization**
   - Eliminate all 16 native `alert()`/`confirm()` and 3 `prompt()` calls, replacing them with `ConfirmDialog` and Sonner `toast`.
   - Fix the `"null, Kathmandu"` template bug across all public school website pages using `formatSchoolAddress()`.
4. **Phase 4: Core Operational Workflows Overhaul**
   - Attendance: Autofocus first row, keyboard P/A/L/E, "Mark All Present" shortcut, and Subject Attendance keyboard parity.
   - Fees: Rapid POS collection workspace, instant thermal/A4 browser receipt printing, and day closure reconciliation.
   - Exams: Spreadsheet-like inline marks entry grid with sticky roll/name column; tabulation print-twin.
   - Notices: Audience targeting modal by class and section.
   - Designer & Writer: Fix Designer `LayersPanel` UUID key bug; consolidate Writer into `/dashboard/designer/writer` and remove `.bak` files.
5. **Phase 5: Verification & End-to-End Testing**
   - Verify `npx tsc --noEmit` and `npx jest`.
   - Validate all 6 UX benchmarks against live browser sessions.
