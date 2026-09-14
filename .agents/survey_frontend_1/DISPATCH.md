## 2026-09-13T14:34:42Z

You are the Frontend Web UI/UX Survey Explorer for the ASchool project.
Working directory: /home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1
Project root: /home/bishal-regmi/Desktop/ASchool
Original Request: /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md

You MUST read /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md before starting work.

Your objective is to conduct a thorough technical survey and mapping of:
1. R3: Web UI/UX Complete Overhaul (AOS Desktop & Mobile Web):
   - Typography & Theming: Mukta Devanagari font CSP loading in next.config.js and @font-face in globals.css for flawless Nepali rendering.
   - Design System & Components:
     * components/ui/tabs.tsx with pill, underline, segmented variants + Win11 styling + Radix keyboard nav.
     * data-table.tsx with row grouping, sticky headers/first columns, inline editing for marks, print modes, responsive density toggles.
     * printRef and print-twin stylesheets across page-header.tsx and printable documents (fee receipts, registers, admit cards, report cards).
     * empty-state.tsx with 3 variants (Never-used, Filtered-empty, Dependency-missing with deep-link CTA).
     * Standardize modal dialogs: audit all 25 call sites of native alert/confirm and plan replacement with ConfirmDialog.
   - AOS Shell & Navigation:
     * Addressable deep-link URLs (/dashboard/<module>/<subroute>?window=<id>) with browser history and bookmarks.
     * Dock prefetching for pinned modules (<500ms latency).
     * Keyboard navigation and ARIA accessibility for dock, desktop folders, window manager.
     * Desktop folders reorganization into 9 clean domains (merging Incidents, SMS into Communications, unified AI Hub).
   - Core Academic & Operational Pages:
     * Page-by-page audit: Students, Academics, Attendance (keyboard P/A/L/E marking), Fees (POS collect, day closure), Exams (marks grid, tabulation), Notices (audience targeting).
     * Designer LayersPanel duplicate keys fix; Writer document editor finish/clean.
     * Public website template null checks (e.g. "null, Kathmandu").
2. Verification commands:
   - npx tsc --noEmit
   - npx jest
   - UX benchmarks (Attendance < 60s, Fee collection < 90s, Notice publishing < 45s, Nepali font rendering, zero alert/confirm).

Explore the frontend codebase, locate components, files, tests, identify gaps, and enumerate all frontend features, dependencies, and overhaul strategies.

Output requirements:
Write your complete, structured survey report to `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/survey_report.md` and write a standard `handoff.md`.
When done, notify your orchestrator via `send_message` with the report path and summary.
