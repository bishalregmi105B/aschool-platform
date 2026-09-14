# BRIEFING — 2026-09-13T14:35:00Z

## Mission
Investigate and authoritatively mine the specification for R4: Flutter Mobile Apps Complete Parity & UI/UX Polish (all 5 apps: flutter_admin, flutter_teacher, flutter_student, flutter_parent, flutter_user) and E2E Test Suite & Acceptance Criteria Architecture (Tiers 1-4, UX benchmarks).

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Mobile & Acceptance Spec Miner
- Working directory: /home/bishal-regmi/Desktop/ASchool/.agents/survey_mobile_e2e_1
- Original parent: 4fe0a301-4f5f-4261-b09c-1ada51ef57e4
- Milestone: Survey & Specification Mining

## 🔒 Key Constraints
- Read-only miner: Do NOT implement anything.
- Probe ALL discovered features; do NOT skip any feature no matter how obscure.
- Prioritize authoritative sources over LLM prior knowledge.
- All 5 Flutter mobile apps must be examined: flutter_admin, flutter_teacher, flutter_student, flutter_parent, flutter_user.
- Verification command: `flutter analyze` across all 5 apps.
- E2E Test Suite & Acceptance Criteria Architecture: Tiers 1-4 mapped out, UX benchmarks verified.
- Output: survey_report.md and handoff.md in working directory; send_message to parent.

## Current Parent
- Conversation ID: 4fe0a301-4f5f-4261-b09c-1ada51ef57e4
- Updated: 2026-09-13T14:35:00Z

## Task Summary
- **What to build**: Specification report for mobile apps parity & E2E acceptance criteria.
- **Success criteria**: Exhaustive catalog of features, gaps, endpoints, models, dark mode issues, localization, E2E test inventory across 4 tiers, and benchmark criteria.
- **Interface contracts**: /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
- **Code layout**: /home/bishal-regmi/Desktop/ASchool/

## Key Decisions Made
- Executed `flutter analyze` across all 5 Flutter apps and `aschool_shared`: recorded exact breakdown of warnings and infos (code 1 on 5 apps due to empty `assets:`, unused results, missing consts).
- Identified core infrastructure gaps: dead push deep linking (`setOnTapCallback` has 0 callers), hardcoded `Colors.white` in `ESchoolDialog`, only 9 translated strings in admin vs 0 in other apps.
- Audited app-by-app parity: admin fake assignments and promote screens, teacher rubric and marks grid limitations, student ephemeral AI tutor and homework URL paste, parent bus 15s polling, user driver QR scan absence.
- Mapped full requirement-driven E2E test inventory across Tiers 1-4 with >=5 test cases per feature for Tiers 1 & 2.
- Verified 6 UX benchmarks, discovering blocking defects in class notice publishing, Nepali font `@font-face` CSS URL in `globals.css`, and native `alert()` / `confirm()` calls.

## Artifact Index
- DISPATCH.md — Initial dispatch prompt
- BRIEFING.md — Situational awareness
- progress.md — Liveness heartbeat & step tracking
- survey_report.md — Complete specification and survey report
- handoff.md — 5-component handoff report

