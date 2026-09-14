# Execution Plan: ASchool Production UI/UX Rewrite & Full Platform Hardening

## Overview
This plan orchestrates the end-to-end delivery of the ASchool platform requirements in ORIGINAL_REQUEST.md adhering strictly to the Project Pattern (Dual Track: Implementation Track + E2E Testing Track) and Dispatch-Only orchestrator constraints.

## Phases

### Phase 0: Step 0 Survey & Scope Mapping
1. Dispatch 3 parallel survey agents:
   - Survey Agent 1 (Backend & Security Focus): Investigate backend architecture, R1 security vulnerabilities and bugs, database migrations, plugin doctor, API route audit scripts, and R2 seeding requirements.
   - Survey Agent 2 (Frontend Web Focus): Investigate Next.js frontend, design system components, font CSP/Nepali loading, AOS desktop/dock/window manager, dashboard pages (Students, Academics, Attendance, Fees, Exams, Notices, Designer, Writer, public site), and test runners.
   - Survey Agent 3 (Mobile Flutter & E2E Testing Focus): Investigate all 5 Flutter mobile apps (admin, teacher, student, parent, user), existing test infrastructure, E2E test harness opportunities, and acceptance benchmark verifiers.
2. Synthesize survey results into `PROJECT.md` with:
   - Architecture & Code Layout
   - Complete Feature Inventory mapped to milestones
   - Milestones definition with strict interface contracts
   - Feature Inventory cross-check (every feature assigned)

### Phase 1: Milestone Decomposition & Track Launch
1. Launch E2E Testing Track:
   - Spawn E2E Testing Orchestrator to build requirement-driven opaque-box test suite across Tiers 1-4.
2. Launch Implementation Track Milestones:
   - M1: R1 Backend Security Hardening & Bug Fixes (Phase 0 backend)
   - M2: R2 Comprehensive Demo Data Seeding & First-Run Setup
   - M3: R3 Web UI/UX Complete Overhaul (AOS Desktop & Mobile Web)
   - M4: R4 Flutter Mobile Apps Complete Parity & UI/UX Polish
   - M5: Final Milestone - 100% E2E Test Pass (Tiers 1-4) & Adversarial Hardening (Tier 5)

### Phase 2: Monitoring, Iteration Loops & Verification Gates
- Sub-orchestrators run the full Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
- Enforce strict AND gates: build/tests pass, all reviewers APPROVE, challengers pass, auditor CLEAN.
- Audit veto enforcement: Any INTEGRITY VIOLATION fails immediately.

### Phase 3: Final Acceptance Benchmarks & Sentinel Reporting
- Verify all automated verification items:
  - pytest backend/tests/ passes with 0 regressions
  - python backend/scripts/api_route_audit.py passes with 0 500 errors
  - python backend/scripts/plugin_doctor.py passes with 42/42 valid manifests
  - python backend/scripts/check_migration_drift.py passes with 0 drift
  - npx tsc --noEmit and npx jest pass cleanly
  - flutter analyze passes across all 5 apps
- Verify all UX benchmarks.
- Compile final synthesis and handoff to Sentinel.
