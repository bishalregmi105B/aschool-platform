## 2026-09-13T15:01:59Z
You are test_writer_e2e_m2, a specialized test author assigned to E2E-M2: Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases) Test Suites for ASchool.

Working Directory: /home/bishal-regmi/Desktop/ASchool/.agents/test_writer_e2e_m2
Project Root: /home/bishal-regmi/Desktop/ASchool

MANDATORY INPUTS — You MUST read these files first before starting work:
- /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
- /home/bishal-regmi/Desktop/ASchool/PROJECT.md
- /home/bishal-regmi/Desktop/ASchool/TEST_INFRA.md
- /home/bishal-regmi/Desktop/ASchool/.agents/survey_mobile_e2e_1/survey_report.md
- /home/bishal-regmi/Desktop/ASchool/tests/e2e/conftest.py

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

YOUR ASSIGNMENT:
Write the complete Tier 1 and Tier 2 test suites in `tests/e2e/tier1_features/` and `tests/e2e/tier2_boundaries/`.

1. Tier 1: Feature Coverage (>=5 test cases per feature for all 41 features from PROJECT.md):
   Organize into clean test modules in `tests/e2e/tier1_features/`:
   - `test_t1_m1_backend_security.py`: Features 1-8 (Path traversal, Dead import, GPS Haversine & enums, AI teacher webhook replay, FAQ role auth, LMS server scoring, IEMIS template sanitization, Backend correctness fixes). >=5 test cases per feature (40+ test cases).
   - `test_t1_m2_demo_data_setup.py`: Features 9-11 (Comprehensive demo school seeding, demo role logins for 5 roles, setup-status API & wizard trigger). >=5 test cases per feature (15+ test cases).
   - `test_t1_m3_web_ux.py`: Features 12-25 (Mukta typography/CSP, Tabs variants, Data-table capabilities, PrintRef & print-twin stylesheets, Empty-state 3-variants, Modal standardization/zero native dialogs, Deep links, Dock prefetch, AOS accessibility/ARIA, Desktop folders, Core operational pages review, Designer/Writer bug fixes, Public site null checks, First-run wizard UI). >=5 test cases per feature (70+ test cases).
   - `test_t1_m4_mobile_suite.py`: Features 26-34 (Flutter analyze clean pass contract, Mobile push & deep-linking pipeline, Mobile design tokens & dark mode, Mobile bilingual localization t(en, ne), flutter_admin parity, flutter_teacher parity, flutter_student parity, flutter_parent parity, flutter_user parity). >=5 test cases per feature (45+ test cases).
   - `test_t1_e2e_infra_benchmarks.py`: Features 35-41 (E2E Test infra & runner flags, Tier 1 coverage, Tier 2 boundaries, Tier 3 pairwise, Tier 4 scenarios, UX benchmarks, Tier 5 adversarial). >=5 test cases per feature (35+ test cases).
   Total Tier 1 test cases: >= 205 test cases!

2. Tier 2: Boundary & Corner Cases (>=5 test cases per feature for all 41 features from PROJECT.md):
   Organize into clean test modules in `tests/e2e/tier2_boundaries/`:
   - `test_t2_m1_backend_security_boundaries.py`: Path traversal with URL encoding, null bytes, nested `....//`; GPS coordinates at poles, null lat/lng, rapid jumps; AI teacher replay with duplicate (lesson_id, event_id), expired keys; FAQ auth with cross-school ID spoofing; LMS quiz with negative scores, overflow marks, manipulated choices; IEMIS with malformed Excel, Unicode names; slot locking race conditions. >=5 per feature (40+ test cases).
   - `test_t2_m2_demo_setup_boundaries.py`: Seeding on already-seeded database (idempotence); missing school records; invalid roles login; setup-status with partial completion; zero classes edge cases. >=5 per feature (15+ test cases).
   - `test_t2_m3_web_ux_boundaries.py`: Empty datasets in data-table; maximum pagination boundaries; long Nepali strings in tabs and headers; corrupted print stylesheets; empty-state CTA deep-link URL validation; invalid deep-link window IDs; keyboard navigation at menu edges. >=5 per feature (70+ test cases).
   - `test_t2_m4_mobile_boundaries.py`: Missing FCM tokens; unhandled deep-link URLs; dark mode contrast extremes; rapid language toggle stress; student promote with max section capacity; marks entry exceeding full marks or decimal precision; offline bus tracking fallback; driver run completion with students still onboard blocking 409. >=5 per feature (45+ test cases).
   - `test_t2_e2e_infra_boundaries.py`: Runner with invalid flags; timing precision near threshold; zero-duration steps; stress testing runner summaries. >=5 per feature (35+ test cases).
   Total Tier 2 test cases: >= 205 test cases!

Use `conftest.py` fixtures (`api_client`, `BenchmarkTimer`, standard test payload factories).
Tests must be opaque-box and requirement-driven, testing HTTP contracts, data invariants, static structure, or simulated interactions.

3. Verify your implementation:
   Run pytest:
   `backend/.venv/bin/pytest tests/e2e/tier1_features/ -v`
   `backend/.venv/bin/pytest tests/e2e/tier2_boundaries/ -v`
   `./scripts/run_e2e_tests.sh --tier 1`
   `./scripts/run_e2e_tests.sh --tier 2`
   Verify that all test cases execute cleanly and pass.

4. Write handoff report at `/home/bishal-regmi/Desktop/ASchool/.agents/test_writer_e2e_m2/handoff.md`:
   - Observation, Logic Chain, Files Created, Test Counts per Feature, Verification Commands and Output, Caveats, Conclusion.
5. Send completion message to parent orchestrator.
