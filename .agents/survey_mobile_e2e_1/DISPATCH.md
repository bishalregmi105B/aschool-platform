## 2026-09-13T14:34:42Z

You are the Mobile & Acceptance Spec Miner for the ASchool project.
Working directory: /home/bishal-regmi/Desktop/ASchool/.agents/survey_mobile_e2e_1
Project root: /home/bishal-regmi/Desktop/ASchool
Original Request: /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md

You MUST read /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md before starting work.

Your objective is to conduct a thorough technical investigation and specification mining of:
1. R4: Flutter Mobile Apps Complete Parity & UI/UX Polish:
   - Examine all 5 Flutter mobile apps: flutter_admin, flutter_teacher, flutter_student, flutter_parent, flutter_user.
   - Infrastructure: Push notification handlers, deep-linking tap callbacks, design tokens / dark mode support (eliminate hardcoded light/white backgrounds in dialogs), bilingual Nepali/English t(en, ne) localization.
   - flutter_admin: Real endpoints for Assignments and Promote screens, global search, leave approval actions.
   - flutter_teacher: Assignment rubric/grading, mobile marks entry grid, syllabus/content browsing.
   - flutter_student: Stateful AI Tutor session conversations, real homework file uploads, exam runner polish.
   - flutter_parent: Live bus tracking with socket updates, call-driver action, radius alerts, fee receipt viewing.
   - flutter_user: Driver trip lifecycle, stop-by-stop navigation coaching, student pickup scanning.
   - Verification command: `flutter analyze` across all 5 apps.
2. E2E Test Suite & Acceptance Criteria Architecture:
   - Examine existing test harnesses, runner scripts, and E2E test capabilities across backend, web, and mobile.
   - Map out the requirement-driven E2E test inventory across Tiers 1-4:
     * Tier 1: Feature Coverage (>=5 per feature)
     * Tier 2: Boundary & Corner Cases (>=5 per feature)
     * Tier 3: Cross-Feature Combinations (pairwise coverage)
     * Tier 4: Real-World Application Scenarios
   - Verification of UX benchmarks:
     * Class of 40 attendance marking < 60 seconds.
     * Fee collection & receipt printing < 90 seconds.
     * Class-specific notice publishing < 45 seconds.
     * Actionable empty states with deep links.
     * Crisp Nepali font rendering without CSP errors.
     * Zero native browser alert() or confirm() calls.

Output requirements:
Write your complete specification and survey report to `/home/bishal-regmi/Desktop/ASchool/.agents/survey_mobile_e2e_1/survey_report.md` and write a standard `handoff.md`.
When done, notify your orchestrator via `send_message` with the report path and summary.
