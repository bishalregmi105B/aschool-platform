# BRIEFING — 2026-09-13T14:42:40Z

## Mission
Conduct a thorough technical survey and mapping of R3: Web UI/UX Complete Overhaul (AOS Desktop & Mobile Web) for the ASchool project. Produce a structured survey report and handoff report.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Frontend Web UI/UX Survey Explorer
- Working directory: /home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1
- Original parent: 4fe0a301-4f5f-4261-b09c-1ada51ef57e4
- Milestone: Survey Phase (Frontend Survey)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes in source code
- Working directory is /home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1 (write only here)
- Output survey_report.md and handoff.md in working directory
- Communicate via send_message to parent (id: 4fe0a301-4f5f-4261-b09c-1ada51ef57e4)

## Current Parent
- Conversation ID: 4fe0a301-4f5f-4261-b09c-1ada51ef57e4
- Updated: 2026-09-13T14:42:40Z

## Investigation State
- **Explored paths**: `frontend/app/globals.css`, `frontend/next.config.js`, `frontend/tailwind.config.js`, `frontend/app/layout.tsx`, `frontend/components/ui/tabs.tsx`, `data-table.tsx`, `empty-state.tsx`, `page-header.tsx`, `confirm-dialog.tsx`, `frontend/components/aos/*` (AOSDesktopShell, Dock, Desktop, WindowManager, MobileExperience), `frontend/app/dashboard/*` (attendance, fees, exams, notices, students, academics, designer), `frontend/components/designer/LayersPanel.tsx`, `frontend/app/school/[slug]/*`, `frontend/__tests__/*`.
- **Key findings**:
  1. Mukta font CSP violation caused by invalid `@font-face { src: url(...) }` pointing to a Google Fonts CSS endpoint not covered by `font-src`. Redundant with `next/font/google` self-hosting.
  2. Tabs lack pill, underline, and segmented variants.
  3. Data table lacks row grouping, sticky headers/first columns, inline editing, and density toggle.
  4. PageHeader lacks printRef; printables use ad-hoc raw HTML popups or slow PDF downloads.
  5. Empty-state lacks 3 variants: Never-used, Filtered-empty, Dependency-missing with CTA.
  6. Exactly 16 native alert/confirm and 3 prompt calls discovered across app and components.
  7. AOS shell actively erases URL with `router.replace("/dashboard")`; needs addressable deep-linking.
  8. Dock has 0 prefetching logic (causing 1.57s latency) and lacks ARIA/keyboard support.
  9. Desktop launcher needs 9 clean domains (merging incidents, SMS, and creating AI Hub).
  10. Attendance keyboard P/A/L/E lacks autofocus and "Mark All Present" shortcut; Subject Attendance lacks keyboard navigation entirely.
  11. Fees POS collection requires instant in-browser print rather than server PDF download.
  12. Exams marks entry grid lacks cell navigation keys; Tabulation sheet lacks sticky header and native print twin.
  13. Notice dialog hardcodes full school target roles without class/section targeting.
  14. Designer LayersPanel duplicate key bug caused by lack of stable unique IDs on fabric objects.
  15. Public website template null checks ("null, Kathmandu") located across 6 call sites in `school/[slug]`.
  16. Automated checks verified: `npx tsc --noEmit` clean (0 errors), `npx jest` 9/9 suites pass (40/40 tests).
- **Unexplored areas**: None within frontend survey scope.

## Key Decisions Made
- Completed comprehensive frontend survey report at `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/survey_report.md`.
- Completed standard 5-component handoff report at `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/handoff.md`.

## Artifact Index
- `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/DISPATCH.md` — Initial dispatch instructions
- `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/BRIEFING.md` — Situational awareness
- `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/progress.md` — Liveness heartbeat and milestone tracking
- `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/survey_report.md` — Detailed frontend survey report
- `/home/bishal-regmi/Desktop/ASchool/.agents/survey_frontend_1/handoff.md` — 5-component handoff report
