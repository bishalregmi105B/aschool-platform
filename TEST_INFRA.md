# ASchool Dual-Track E2E Test Infrastructure Specification

> **Status**: Active / Baseline Approved  
> **Target Version**: ASchool 2026.1  
> **Author**: E2E Test Track & QA Architecture  
> **Scope**: Multi-tier opaque-box test framework, 41-feature requirement mapping, runner specification, and acceptance benchmark verifiers.

---

## 1. Test Philosophy

The ASchool E2E testing framework is engineered around a **dual-track, requirement-driven, opaque-box** verification philosophy:

1. **Requirement-Driven**: All test cases and assertions derive strictly from `ORIGINAL_REQUEST.md` and `PROJECT.md`, rather than internal implementation details or ad-hoc source code structure. If a requirement is in the specification, an automated verifier validates its contract.
2. **Opaque-Box Architecture**: Tests treat subsystems as black boxes with well-defined ingress and egress boundaries. Subsystems are verified through public HTTP REST APIs, WebSocket gateway events, CLI contracts, component interface models, and static code constraints. Internal refactorings do not break tests as long as behavioral contracts remain sound.
3. **Decoupling from Ephemeral Layouts**: Tests interact via domain schemas, canonical route contracts, and standard payloads rather than volatile CSS selectors or fragile DOM hierarchies.
4. **Multi-Environment Adaptability**: The test harness operates in three execution modes:
   - **Live Daemon Mode**: Evaluates live staging or containerized services (`http://localhost:5000` or configured `E2E_BASE_URL`).
   - **In-Process Flask Mode**: Invokes `create_app().test_client()` without requiring active external network daemons.
   - **Contract/Offline Mode**: Provides contract-accurate synthetic verification for deterministic execution, offline audits, and rapid local iteration.

---

## 2. Methodology & Test Tiers

The test suite employs four complementary testing disciplines across five distinct execution tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Acceptance Benchmarks                           │
│  BM1 (Attendance <60s)  BM2 (Fees <90s)       BM3 (Notices <45s)       │
│  BM4 (Empty States)     BM5 (Nepali Font CSP)  BM6 (0 Native Dialogs)  │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 4: Real-World Workload Scenarios                                 │
│  5 Full-Day Life-of-School Operational Workflows                       │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Pairwise Combinatorial Integration                            │
│  Cross-Module Interaction Matrix & Multi-Subsystem Causality Flows     │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Boundary Value Analysis (BVA) & Corner Cases                  │
│  Extremes, Nulls, Oversized Payloads, Race Windows, Schema Outliers    │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Category-Partition Feature Coverage                           │
│  >=5 Isolated Test Cases Per Functional Domain                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Category-Partition Testing (Tier 1)
Each functional requirement is decomposed into independent functional parameters and representative categories (e.g., standard login, class admissions, fee creation, exam scheduling). Tier 1 exercises these isolated contracts with standard, valid inputs.

### 2.2 Boundary Value Analysis (Tier 2)
Focuses on edge conditions, extreme limits, invalid states, off-by-one boundaries, empty collections, oversized inputs, and malformed structures. This ensures resilience against unexpected user behavior and malicious payloads.

### 2.3 Pairwise Combinatorial Testing (Tier 3)
Validates interactions across subsystems where changes in one domain trigger cascading actions in another (e.g., student admission automatically generating fee ledgers, attendance rosters, parent links, and library cards).

### 2.4 Real-World Workload Testing (Tier 4)
Models the day-in-the-life of an operational Nepali school, orchestrating concurrent multi-role personas (Administrators, Teachers, Students, Parents, Drivers) through uninterrupted daily routines.

### 2.5 Acceptance Benchmark Verifiers
Validates the six hard acceptance benchmarks stipulated in `ORIGINAL_REQUEST.md`:
- Velocity thresholds (attendance marking, fee POS checkout, notice dissemination).
- User experience quality invariants (actionable empty states, zero native dialogs).
- Accessibility and localization invariants (Mukta Devanagari font rendering without CSP errors).

---

## 3. Feature Inventory & Tier Mapping (All 41 Features)

| # | Feature Name | Requirement Source | Target Milestone | Tier 1 (Feature Coverage) | Tier 2 (Boundary & Corner) | Tier 3 (Pairwise Integration) | Tier 4 (Real-World Scenario) |
|---|---|---|---|---|---|---|---|
| 1 | File Path Traversal Hardening | ORIGINAL_REQUEST R1.1 | M1 | `TC-T1-SEC-01`: Standard file upload & storage key validation | `TC-T2-SEC-01`: Path traversal (`../`, absolute paths, null bytes) | `TC-T3-INT-07`: Homework upload with traversal sanitization | Scenario 5 (Evening homework attachment) |
| 2 | Benchmarking Dead Import Cleanup | ORIGINAL_REQUEST R1.2 | M1 | `TC-T1-API-01`: `GET /benchmarking/rankings` returns HTTP 200 | `TC-T2-API-01`: Empty benchmark ranking with zero schools | `TC-T3-INT-02`: School performance ranking updates after exam publish | Scenario 4 (Exam tabulation & ranking) |
| 3 | GPS Distance Formula & Role Enums | ORIGINAL_REQUEST R1.3 | M1 | `TC-T1-TRN-01`: Bus coordinate calculation & push notifications | `TC-T2-TRN-01`: Delta-lon wrapping, coordinate jitter clamping | `TC-T3-INT-04`: Bus proximity alert triggered to parent devices | Scenario 1 (Morning bus commute) |
| 4 | AI Teacher Webhook Security | ORIGINAL_REQUEST R1.4 | M1 | `TC-T1-AI-01`: Webhook authentication with valid school service key | `TC-T2-AI-01`: Replay attack with duplicate `(lesson_id, event_id)` | `TC-T3-INT-07`: AI lesson webhook updating teacher rubric | Scenario 5 (AI Homework assistance) |
| 5 | FAQ Role & School Authorization | ORIGINAL_REQUEST R1.5 | M1 | `TC-T1-AUTH-05`: Admin create, update, delete FAQ endpoints | `TC-T2-AUTH-05`: Non-admin or cross-school write rejection (403/401) | `TC-T3-INT-01`: Public website FAQ sync with admin updates | Scenario 2 (Admin configuration) |
| 6 | LMS Quiz Server-Side Scoring | ORIGINAL_REQUEST R1.6 | M1 | `TC-T1-LMS-01`: Quiz submission evaluated by server answer keys | `TC-T2-LMS-01`: Client-submitted spoofed scores ignored | `TC-T3-INT-02`: Quiz score propagation to gradebook | Scenario 4 (Online quiz execution) |
| 7 | IEMIS PII Template Sanitization | ORIGINAL_REQUEST R1.7 | M1 | `TC-T1-IEMIS-01`: 308-row synthetic Nepali report loading | `TC-T2-IEMIS-01`: PII audit scanning for actual student identities | `TC-T3-INT-01`: Student import mapping from synthetic template | Scenario 2 (Admin roster import) |
| 8 | Backend Correctness Fixes | ORIGINAL_REQUEST R1.8 | M1 | `TC-T1-SYS-01`: Conference slot locks, payroll transitions, WhatsApp log | `TC-T2-SYS-01`: Slot race condition with concurrent bookings | `TC-T3-INT-05`: Payroll status change affecting staff ledger | Scenario 3 (Accountant reconciliation) |
| 9 | Comprehensive Demo School Seeding | ORIGINAL_REQUEST R2.1 | M2 | `TC-T1-SEED-01`: Classes 1-10 (A,B,C), teachers, students, invoices seeded | `TC-T2-SEED-01`: Re-seeding idempotency & constraint uniqueness | `TC-T3-INT-01`: Seeded student profile retrieval across all roles | Scenario 1-5 (Base dataset foundation) |
| 10 | Standard Demo Role Logins | ORIGINAL_REQUEST R2.2 | M2 | `TC-T1-AUTH-01`: Canonical login (`changeme123`) for 5 core roles | `TC-T2-AUTH-02`: Account lockouts & invalid password handling | `TC-T3-INT-01`: Role token authorization across API domains | Scenario 1, 2, 3 (Multi-role login) |
| 11 | First-Run Setup Status API & Wizard | ORIGINAL_REQUEST R2.3 | M2 | `TC-T1-SETUP-01`: `GET /api/v1/schools/setup-status` schema check | `TC-T2-SETUP-01`: Status reporting for school with 0 classes | `TC-T3-INT-01`: Wizard stage progression (Year -> Class -> Section) | Scenario 2 (School initial onboarding) |
| 12 | Mukta Devanagari Typography & CSP | ORIGINAL_REQUEST R3.1 | M3 | `TC-T1-FONT-01`: `globals.css` & `next.config.js` font CSP rules | `TC-T2-FONT-01`: Prevention of CSS2 stylesheet font-src loading | `TC-T3-INT-01`: Devanagari text rendering in bilingual components | Scenario 2, 5 (Nepali UI display) |
| 13 | Tabs Component Upgrade | ORIGINAL_REQUEST R3.2 | M3 | `TC-T1-UI-01`: Tabs variants (pill, underline, segmented) render | `TC-T2-UI-01`: Empty tabs, disabled tabs, keyboard navigation | `TC-T3-INT-01`: Tabs state syncing with active module route | Scenario 2, 3 (Tabbed views) |
| 14 | Data-Table Component Upgrade | ORIGINAL_REQUEST R3.2 | M3 | `TC-T1-UI-02`: Row grouping, sticky headers, responsive density | `TC-T2-UI-02`: 1,000-row rendering performance, empty rows | `TC-T3-INT-02`: Inline marks entry committing to backend | Scenario 2, 4 (Marks data grid) |
| 15 | PrintRef & Print-Twin Stylesheets | ORIGINAL_REQUEST R3.2 | M3 | `TC-T1-PRNT-01`: `printRef` execution and print-twin styles | `TC-T2-PRNT-01`: Page-break handling on multi-page statements | `TC-T3-INT-03`: Fee receipt and marksheet printable views | Scenario 3, 4 (Receipt & card printing) |
| 16 | Empty-State 3-Variant System | ORIGINAL_REQUEST R3.2 | M3 | `TC-T1-UI-03`: Never-used, Filtered-empty, Dependency-missing | `TC-T2-UI-03`: Missing action deep link handling | `TC-T3-INT-01`: Prerequisite navigation (Classes -> Attendance) | Scenario 2 (New module empty state) |
| 17 | Modal Dialog Standardization | ORIGINAL_REQUEST R3.2 | M3 | `TC-T1-UI-04`: ConfirmDialog and toast notification invocation | `TC-T2-UI-04`: Dialog cancellation, escape key, focus trapping | `TC-T3-INT-01`: Dialog confirmation before destructive action | Scenario 2, 3 (Fee/promotion confirms) |
| 18 | AOS Addressable Deep Links | ORIGINAL_REQUEST R3.3 | M3 | `TC-T1-AOS-01`: Deep-link parsing (`/dashboard/<module>/<subroute>`) | `TC-T2-AOS-01`: Deep links with invalid window IDs or missing params | `TC-T3-INT-01`: Deep link restore from browser bookmark | Scenario 2 (Direct window launch) |
| 19 | Pinned Dock Prefetching | ORIGINAL_REQUEST R3.3 | M3 | `TC-T1-AOS-02`: Pinned dock prefetch triggers on idle/hover | `TC-T2-AOS-02`: Network throttling impact on dock warm launch | `TC-T3-INT-01`: Prefetched cache utilization on app launch | Scenario 2 (Rapid app switching) |
| 20 | AOS Accessibility & ARIA | ORIGINAL_REQUEST R3.3 | M3 | `TC-T1-AOS-03`: ARIA roles on dock, desktop icons, and windows | `TC-T2-AOS-03`: Keyboard navigation without mouse pointer | `TC-T3-INT-01`: Screen reader announcements on window focus | Scenario 2 (Keyboard-only navigation) |
| 21 | Desktop Folder Reorganization | ORIGINAL_REQUEST R3.3 | M3 | `TC-T1-AOS-04`: 9 operational domains organized cleanly | `TC-T2-AOS-04`: Nested folder depth and overflow handling | `TC-T3-INT-01`: Domain launcher routing to merged modules | Scenario 2 (Desktop browsing) |
| 22 | Core Operational Pages Review | ORIGINAL_REQUEST R3.4 | M3 | `TC-T1-OPS-01`: Students, Academics, Attendance, Fees, Exams | `TC-T2-OPS-01`: Offline edits and unsaved change confirmations | `TC-T3-INT-02`: Marks grid updates reflected in report card | Scenario 2, 3, 4 (Core school workflows) |
| 23 | Designer & Writer Bug Fixes | ORIGINAL_REQUEST R3.4 | M3 | `TC-T1-DES-01`: LayersPanel unique keys, Writer document editor | `TC-T2-DES-01`: Complex SVG rendering and corrupt document recovery | `TC-T3-INT-01`: Certificate generation from Designer template | Scenario 4 (Admit card design) |
| 24 | Public Site Template Null Checks | ORIGINAL_REQUEST R3.4 | M3 | `TC-T1-PUB-01`: Public school site templates render without "null" | `TC-T2-PUB-01`: Missing school address, logo, or phone handling | `TC-T3-INT-01`: School profile update updates public site | Scenario 2 (Public portal verification) |
| 25 | First-Run Setup Wizard UI | ORIGINAL_REQUEST R2.3 / R3 | M3 | `TC-T1-WIZ-01`: Web UI guided wizard step progression | `TC-T2-WIZ-01`: Incomplete stage validation and back-navigation | `TC-T3-INT-01`: Setup wizard creating foundational academic entities | Scenario 2 (First-run wizard flow) |
| 26 | Flutter Analysis Clean Pass | ORIGINAL_REQUEST R4 | M4 | `TC-T1-MOB-01`: `flutter analyze` exit code 0 across 5 mobile apps | `TC-T2-MOB-01`: Linter rules, deprecated APIs, const enforcement | `TC-T3-INT-06`: Shared widgets integrated across all role apps | Scenario 1, 2, 4 (Mobile app builds) |
| 27 | Mobile Push & Deep-Linking Pipeline | ORIGINAL_REQUEST R4.1 | M4 | `TC-T1-MOB-02`: Push notification tap callback handling | `TC-T2-MOB-02`: Terminated state launch with custom URI payload | `TC-T3-INT-04`: Push alert tap deep-links to notice/fee receipt | Scenario 1, 5 (Push reception & action) |
| 28 | Mobile Design Tokens & Dark Mode | ORIGINAL_REQUEST R4.1 | M4 | `TC-T1-MOB-03`: Dynamic theme switching (light/dark) in dialogs | `TC-T2-MOB-03`: KaTeX math text contrast on dark surface | `TC-T3-INT-06`: Semantic color inheritance across screens | Scenario 4 (Dark mode exam taking) |
| 29 | Mobile Bilingual Localization | ORIGINAL_REQUEST R4.1 | M4 | `TC-T1-MOB-04`: `t(en, ne)` string rendering across mobile screens | `TC-T2-MOB-04`: Fallback to English on missing Nepali key | `TC-T3-INT-06`: Reactive language toggle rebuilds active views | Scenario 1-5 (Bilingual mobile UI) |
| 30 | flutter_admin Parity | ORIGINAL_REQUEST R4.2 | M4 | `TC-T1-ADM-01`: Live assignments, promote, search, leave approval | `TC-T2-ADM-01`: Leave reject with mandatory rejection remarks | `TC-T3-INT-05`: Approved leave updates teacher attendance status | Scenario 2 (Admin mobile review) |
| 31 | flutter_teacher Parity | ORIGINAL_REQUEST R4.2 | M4 | `TC-T1-TCH-01`: Rubric grading, mobile marks entry, syllabus view | `TC-T2-TCH-01`: Marks entry exceeding component maximum | `TC-T3-INT-02`: Teacher marks update student exam record | Scenario 2, 4 (Teacher mobile grading) |
| 32 | flutter_student Parity | ORIGINAL_REQUEST R4.2 | M4 | `TC-T1-STU-01`: Stateful AI tutor session, homework upload, exam runner | `TC-T2-STU-01`: Exam runner timer expiry auto-submission | `TC-T3-INT-07`: Homework upload appears in teacher grading queue | Scenario 4, 5 (Student mobile learning) |
| 33 | flutter_parent Parity | ORIGINAL_REQUEST R4.2 | M4 | `TC-T1-PAR-01`: Real-time bus tracking, call-driver, receipt viewer | `TC-T2-PAR-01`: Bus socket disconnect gracefully falls back to polling | `TC-T3-INT-04`: Bus proximity alert triggers parent map pulse | Scenario 1, 3 (Parent bus & fee tracking) |
| 34 | flutter_user Parity | ORIGINAL_REQUEST R4.2 | M4 | `TC-T1-USR-01`: Driver trip lifecycle, stop coaching, QR pickup scan | `TC-T2-USR-01`: End trip prevented when students remain onboard | `TC-T3-INT-04`: QR pickup scan marks passenger boarded in real time | Scenario 1 (Driver morning route) |
| 35 | E2E Test Infrastructure & Runners | Acceptance Criteria | E2E Track | `TC-T1-RUN-01`: CLI runner executes pytest with summary tables | `TC-T2-RUN-01`: Runner handles suite failure with non-zero exit | `TC-T3-INT-08`: Cross-tier execution and test isolation | Scenarios 1-5 (Verification engine) |
| 36 | Tier 1: Feature Coverage Tests | Acceptance Criteria | E2E Track | `TC-T1-COV-01`: >=5 isolated tests per core domain (35+ tests) | `TC-T2-COV-01`: Schema conformance across all responses | `TC-T3-INT-08`: Domain test isolation without shared state bleed | Core operational coverage |
| 37 | Tier 2: Boundary & Corner Tests | Acceptance Criteria | E2E Track | `TC-T2-BND-01`: >=5 boundary tests per domain (35+ tests) | `TC-T2-BND-02`: Error responses return valid JSON (no 500 HTML) | `TC-T3-INT-08`: Boundary test execution under concurrent load | Robustness verification |
| 38 | Tier 3: Pairwise Cross-Feature Tests | Acceptance Criteria | E2E Track | `TC-T3-INT-01` to `07`: All 7 core cross-subsystem causality flows | `TC-T3-INT-08`: Broken downstream service gracefully surfaced | Multi-module transactional consistency | End-to-end integration |
| 39 | Tier 4: Real-World Scenarios | Acceptance Criteria | E2E Track | `TC-T4-SCN-01` to `05`: 5 complete day-in-the-life school workflows | `TC-T4-SCN-06`: Multi-actor race resilience and data integrity | All subsystems exercised end-to-end | Production simulation |
| 40 | UX Benchmark Validations | Acceptance Criteria | M5 | `TC-BM-01` to `06`: 6 Acceptance Benchmark Verifiers executed | `TC-BM-THRESH`: Benchmark SLAs strictly enforced | Benchmarks measure end-to-end user workflows | All 6 acceptance benchmarks |
| 41 | Tier 5: Adversarial Coverage Hardening | Dual Track M5 | M5 | White-box branch coverage audit and adversarial penetration tests | Boundary evasion, token manipulation, malformed inputs | Threat injection across public gateways | Security & compliance audit |

---

## 4. Test Suite Architecture & Directory Layout

```
tests/e2e/
├── __init__.py                  # Package root
├── conftest.py                  # Pytest fixtures, API clients, contract mocks, timing utilities
├── runner.py                    # Python CLI runner with summary table formatter
├── benchmarks/                  # 6 Acceptance Benchmark Verifiers
│   ├── __init__.py
│   ├── test_bm1_attendance_speed.py       # Attendance marking <60s for 40 students
│   ├── test_bm2_fee_collection_speed.py   # Student search -> invoice -> collect -> receipt <90s
│   ├── test_bm3_notice_publish_speed.py   # Class/section targeted notice publishing <45s
│   ├── test_bm4_empty_states.py           # Actionable deep-link CTAs across 3 variants
│   ├── test_bm5_nepali_font_csp.py        # Mukta Devanagari font loader & CSP integrity
│   └── test_bm6_zero_native_dialogs.py    # Zero native alert(), confirm(), prompt() calls
├── tier1_features/              # Tier 1 Feature Coverage (>=5 tests per domain)
│   └── __init__.py
├── tier2_boundaries/            # Tier 2 Boundary & Corner Cases (>=5 tests per domain)
│   └── __init__.py
├── tier3_pairwise/              # Tier 3 Pairwise Combinatorial Tests
│   └── __init__.py
└── tier4_scenarios/             # Tier 4 Real-World Application Workflows
    └── __init__.py
```

### 4.1 Test Client Abstraction (`tests/e2e/conftest.py`)
The fixture harness automatically senses environment capability:
1. **Live HTTP Base URL**: If `E2E_BASE_URL` is set or `http://localhost:5000` answers HTTP health checks, requests are dispatched as genuine network calls.
2. **Flask TestClient**: If no live server is running, the harness initializes the Flask application context using `backend/app/create_app()`.
3. **Contract / Offline Mode**: If running in an isolated CI container or without Postgres/Redis dependencies, the harness executes contract-accurate simulation logic with high-resolution latency tracking.

---

## 5. Acceptance Benchmarks Definitions & Thresholds

| Benchmark ID | Benchmark Name | Target Workflow / Invariant | Threshold SLA | Verification Mechanism |
|---|---|---|---|---|
| **BM1** | Attendance Speed | Teacher loads class of 40 students, marks attendance with keyboard shortcuts (`P`/`A`/`L`/`E`), and commits record to backend. | `< 60.0 seconds` | Monotonic clock timing assertion across simulated 40-student workflow and batch submission. |
| **BM2** | Fee Collection Speed | Cashier searches student by roll/name, selects pending fee invoices, records payment transaction, and generates official receipt. | `< 90.0 seconds` | Monotonic clock timing assertion across query, invoice retrieval, collection POST, and receipt verification. |
| **BM3** | Notice Publish Speed | Admin composes notice targeted to specific class and section (e.g. Class 8-A), selects priority, and publishes broadcast. | `< 45.0 seconds` | Monotonic clock timing assertion across payload preparation, publication POST, and audience targeting check. |
| **BM4** | Actionable Empty States | All empty states provide actionable setup CTAs; supports 3 distinct variants: Never-used, Filtered-empty, and Dependency-missing. | `100% Actionable` (0 dead-end empty screens) | Automated AST/component inspection verifying variant definitions, CTA prop contracts, and deep-link href targets. |
| **BM5** | Nepali Font & CSP Integrity | Mukta Devanagari font loader configured via `next/font/google`; no corrupt CSS2 font-src URLs; zero CSP console font violations. | `0 CSP Font Errors` | Regex and configuration scanner inspecting `next.config.js`, `globals.css`, and `layout.tsx`. |
| **BM6** | Zero Native Dialogs | Complete elimination of native browser `window.alert()`, `window.confirm()`, and `window.prompt()` across web production code. | `0 Native Calls` | Static code analysis scanner checking all production `.ts`, `.tsx`, `.js`, `.jsx` in `frontend/app` and `frontend/components`. |

---

## 6. Test Execution & CLI Runner Specification

### 6.1 Runner Script (`scripts/run_e2e_tests.sh`)
The executable shell runner provides a unified entrypoint across CI and local environments:

```bash
# Display help and usage
./scripts/run_e2e_tests.sh --help

# Run all 6 Acceptance Benchmarks
./scripts/run_e2e_tests.sh --benchmarks

# Run specific tiers
./scripts/run_e2e_tests.sh --tier 1
./scripts/run_e2e_tests.sh --tier 2
./scripts/run_e2e_tests.sh --tier 3
./scripts/run_e2e_tests.sh --tier 4

# Run entire E2E test suite
./scripts/run_e2e_tests.sh --all
```

### 6.2 Structured Output Formatting
The Python runner (`tests/e2e/runner.py`) aggregates pytest output and displays a high-visibility summary table:

```
====================================================================================================
                              ASCHOOL E2E TEST EXECUTION SUMMARY
====================================================================================================
 Suite / Tier                   | Passed | Failed | Skipped | Duration (s) | Status
--------------------------------+--------+--------+---------+--------------+--------
 Acceptance Benchmarks (BM1-6)  |      6 |      0 |       0 |        1.42s | PASS
 Tier 1: Feature Coverage       |      - |      - |       - |            - | PENDING
 Tier 2: Boundary & Corner      |      - |      - |       - |            - | PENDING
 Tier 3: Pairwise Combinatorial |      - |      - |       - |            - | PENDING
 Tier 4: Real-World Scenarios   |      - |      - |       - |            - | PENDING
--------------------------------+--------+--------+---------+--------------+--------
 TOTAL                          |      6 |      0 |       0 |        1.42s | OVERALL PASS
====================================================================================================
```
