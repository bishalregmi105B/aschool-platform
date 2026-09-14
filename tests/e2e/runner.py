#!/usr/bin/env python3
"""ASchool E2E Test Suite CLI Runner.

Executes pytest suites across tiers and acceptance benchmarks, aggregates metrics,
and renders structured summary tables.
"""

import sys
import os
import time
import argparse
import subprocess
from typing import List, Dict, Any, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TESTS_ROOT = os.path.join(PROJECT_ROOT, "tests", "e2e")

# Auto-locate project Python and Pytest
VENV_PYTHON = os.path.join(PROJECT_ROOT, "backend", ".venv", "bin", "python")
VENV_PYTEST = os.path.join(PROJECT_ROOT, "backend", ".venv", "bin", "pytest")

if not os.path.exists(VENV_PYTEST):
    VENV_PYTEST = os.path.join(PROJECT_ROOT, ".venv", "bin", "pytest")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

TIER_MAP = {
    "benchmarks": {
        "name": "Acceptance Benchmarks (BM1-6)",
        "path": os.path.join(TESTS_ROOT, "benchmarks"),
    },
    "1": {
        "name": "Tier 1: Feature Coverage",
        "path": os.path.join(TESTS_ROOT, "tier1_features"),
    },
    "2": {
        "name": "Tier 2: Boundary & Corner",
        "path": os.path.join(TESTS_ROOT, "tier2_boundaries"),
    },
    "3": {
        "name": "Tier 3: Pairwise Combinatorial",
        "path": os.path.join(TESTS_ROOT, "tier3_pairwise"),
    },
    "4": {
        "name": "Tier 4: Real-World Scenarios",
        "path": os.path.join(TESTS_ROOT, "tier4_scenarios"),
    },
}


def run_suite(suite_key: str, verbose: bool = False) -> Dict[str, Any]:
    suite_info = TIER_MAP[suite_key]
    target_path = suite_info["path"]

    result_data = {
        "key": suite_key,
        "name": suite_info["name"],
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "duration": 0.0,
        "status": "NOT_RUN",
        "output": "",
    }

    if not os.path.exists(target_path):
        result_data["status"] = "SKIPPED"
        return result_data

    # Check if there are any test files in target_path
    test_files = [f for f in os.listdir(target_path) if f.startswith("test_") and f.endswith(".py")]
    if not test_files:
        result_data["status"] = "NO_TESTS"
        return result_data

    pytest_cmd = [
        VENV_PYTEST if os.path.exists(VENV_PYTEST) else "pytest",
        target_path,
        "-v" if verbose else "-q",
        "-s",
        "--disable-warnings",
        f"-o", f"pythonpath={PROJECT_ROOT} {os.path.join(PROJECT_ROOT, 'backend')}",
    ]

    start_t = time.perf_counter()
    env = os.environ.copy()
    env["PYTHONPATH"] = f"{PROJECT_ROOT}:{os.path.join(PROJECT_ROOT, 'backend')}:{env.get('PYTHONPATH', '')}"

    proc = subprocess.run(
        pytest_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
        cwd=PROJECT_ROOT,
    )
    duration = time.perf_counter() - start_t

    result_data["duration"] = duration
    result_data["output"] = proc.stdout

    # Parse pytest output summary lines (e.g. "6 passed in 1.45s")
    for line in proc.stdout.splitlines():
        line_clean = line.strip()
        if "passed" in line_clean or "failed" in line_clean or "error" in line_clean:
            parts = line_clean.split(",")
            for part in parts:
                part = part.strip()
                if "passed" in part:
                    try:
                        result_data["passed"] = int(part.split()[0].replace("=", ""))
                    except Exception:
                        pass
                if "failed" in part:
                    try:
                        result_data["failed"] = int(part.split()[0].replace("=", ""))
                    except Exception:
                        pass
                if "skipped" in part:
                    try:
                        result_data["skipped"] = int(part.split()[0].replace("=", ""))
                    except Exception:
                        pass

    if proc.returncode == 0:
        result_data["status"] = "PASS"
    else:
        result_data["status"] = "FAIL"
        if result_data["failed"] == 0 and result_data["passed"] == 0:
            result_data["failed"] = 1  # error encountered

    return result_data


def print_summary_table(results: List[Dict[str, Any]]):
    print("\n" + "=" * 88)
    print("                      ASCHOOL E2E TEST EXECUTION SUMMARY")
    print("=" * 88)
    print(f" {'Suite / Tier':<34} | {'Passed':>6} | {'Failed':>6} | {'Skipped':>7} | {'Duration':>10} | {'Status':<8}")
    print("-" * 35 + "+" + "-" * 8 + "+" + "-" * 8 + "+" + "-" * 9 + "+" + "-" * 12 + "+" + "-" * 10)

    total_passed = 0
    total_failed = 0
    total_skipped = 0
    total_duration = 0.0
    overall_pass = True

    for r in results:
        passed_str = str(r["passed"]) if r["status"] in ("PASS", "FAIL") else "-"
        failed_str = str(r["failed"]) if r["status"] in ("PASS", "FAIL") else "-"
        skipped_str = str(r["skipped"]) if r["status"] in ("PASS", "FAIL") else "-"
        dur_str = f"{r['duration']:.2f}s" if r["status"] in ("PASS", "FAIL") else "-"

        total_passed += r["passed"]
        total_failed += r["failed"]
        total_skipped += r["skipped"]
        total_duration += r["duration"]

        if r["status"] == "FAIL":
            overall_pass = False

        status_display = r["status"]
        print(f" {r['name']:<34} | {passed_str:>6} | {failed_str:>6} | {skipped_str:>7} | {dur_str:>10} | {status_display:<8}")

    print("-" * 35 + "+" + "-" * 8 + "+" + "-" * 8 + "+" + "-" * 9 + "+" + "-" * 12 + "+" + "-" * 10)
    overall_status = "OVERALL PASS" if overall_pass and total_failed == 0 else "OVERALL FAIL"
    print(f" {'TOTAL':<34} | {total_passed:>6} | {total_failed:>6} | {total_skipped:>7} | {total_duration:>9.2f}s | {overall_status:<8}")
    print("=" * 88 + "\n")


def main():
    parser = argparse.ArgumentParser(description="ASchool E2E Test Suite Runner")
    parser.add_argument("--tier", choices=["1", "2", "3", "4"], help="Run tests for a specific tier")
    parser.add_argument("--benchmarks", action="store_true", help="Run the 6 Acceptance Benchmark Verifiers")
    parser.add_argument("--all", action="store_true", help="Run all tiers and acceptance benchmarks")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose test output")

    args = parser.parse_args()

    targets: List[str] = []
    if args.benchmarks:
        targets.append("benchmarks")
    if args.tier:
        targets.append(args.tier)
    if args.all or not targets:
        targets = ["benchmarks", "1", "2", "3", "4"]

    print(f"\n[E2E-RUNNER] Starting test execution for targets: {', '.join(targets)}")
    results = []

    for t in targets:
        res = run_suite(t, verbose=args.verbose)
        if args.verbose or res["status"] == "FAIL":
            if res.get("output"):
                print(res["output"])
        results.append(res)

    print_summary_table(results)

    # Return exit code 0 if all executed suites passed, else 1
    has_failure = any(r["status"] == "FAIL" for r in results)
    sys.exit(1 if has_failure else 0)


if __name__ == "__main__":
    main()
