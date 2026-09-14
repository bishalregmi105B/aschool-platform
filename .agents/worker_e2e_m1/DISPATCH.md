## 2026-09-13T14:48:45Z

You are worker_e2e_m1, an implementation and QA worker assigned to E2E-M1: Test Infrastructure & Acceptance Benchmark Verifiers for the ASchool platform.

Working Directory: /home/bishal-regmi/Desktop/ASchool/.agents/worker_e2e_m1
Project Root: /home/bishal-regmi/Desktop/ASchool

MANDATORY INPUTS — You MUST read these files first before doing any work:
- /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
- /home/bishal-regmi/Desktop/ASchool/PROJECT.md
- /home/bishal-regmi/Desktop/ASchool/.agents/survey_mobile_e2e_1/survey_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

YOUR ASSIGNMENT:
1. Initialize your working directory .agents/worker_e2e_m1/ with progress.md and BRIEFING.md.
2. Create TEST_INFRA.md at the project root (/home/bishal-regmi/Desktop/ASchool/TEST_INFRA.md) using the Dual Track Test Infra template:
   - Test Philosophy: Requirement-driven, opaque-box, derived from ORIGINAL_REQUEST.md and PROJECT.md, independent of internal module structure.
   - Methodology: Category-Partition, BVA, Pairwise Combinatorial, and Real-World Workload Testing across Tiers 1-4 + Acceptance Benchmarks.
   - Feature Inventory: All 41 features from PROJECT.md mapped with their requirement source, Tier 1, Tier 2, Tier 3, and Tier 4 allocations.
   - Test Architecture: Directory layout under `tests/e2e/`, execution instructions via `scripts/run_e2e_tests.sh`, runner flags (`--tier 1`, `--tier 2`, `--tier 3`, `--tier 4`, `--benchmarks`, `--all`), report formatting.
   - Acceptance Benchmarks definitions & thresholds.
3. Build the E2E Test Suite directory layout and foundation in `/home/bishal-regmi/Desktop/ASchool/tests/e2e/`:
   - `tests/e2e/__init__.py`
   - `tests/e2e/conftest.py`: Shared pytest fixtures, API client helper (pointing to backend baseUrl or using Flask test_client if backend is not actively running as a daemon, with fallback/offline test support), mock/contract helpers, timing utilities.
   - `tests/e2e/runner.py`: Python CLI runner executing pytest suites with structured summary table output (passed, failed, duration, tier breakdown).
4. Implement the 6 Acceptance Benchmark Verifiers in `tests/e2e/benchmarks/`:
   - `test_bm1_attendance_speed.py`: Simulates teacher attendance marking workflow for a class of 40 students with timing assertion (< 60 seconds).
   - `test_bm2_fee_collection_speed.py`: Simulates search student -> select fee invoice -> record payment -> receipt generation with timing assertion (< 90 seconds).
   - `test_bm3_notice_publish_speed.py`: Simulates composing and publishing targeted class/section notice with timing assertion (< 45 seconds).
   - `test_bm4_empty_states.py`: Automated inspection verifying empty state components provide actionable deep-link CTAs (Never-used, Filtered-empty, Dependency-missing).
   - `test_bm5_nepali_font_csp.py`: Verifies Mukta Devanagari font configuration in next.config.js and globals.css, ensuring no corrupt CSS2 font-src URLs and valid font-face/font loader setup.
   - `test_bm6_zero_native_dialogs.py`: Static analysis scanner checking web production code (frontend/app, frontend/components) for zero native window.alert(), window.confirm(), or window.prompt() calls.
5. Create executable runner script at `/home/bishal-regmi/Desktop/ASchool/scripts/run_e2e_tests.sh`:
   - Ensure it is executable (`chmod +x scripts/run_e2e_tests.sh`).
   - Supports arguments: `--tier 1`, `--tier 2`, `--tier 3`, `--tier 4`, `--benchmarks`, `--all`, `--help`.
   - Runs tests via pytest or python runner and exits with code 0 when passing.
6. Verify your implementation:
   - Run `pytest tests/e2e/benchmarks/` and `bash scripts/run_e2e_tests.sh --benchmarks`.
   - Ensure all benchmark tests execute and report detailed timings and findings.
7. Write a complete handoff report at `/home/bishal-regmi/Desktop/ASchool/.agents/worker_e2e_m1/handoff.md`:
   - Observation, Logic Chain, Created Files, Verification Commands and Output, Caveats, Conclusion.
8. Send completion message back to parent orchestrator.
