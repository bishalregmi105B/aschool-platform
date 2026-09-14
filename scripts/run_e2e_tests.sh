#!/usr/bin/env bash
# ==============================================================================
# ASchool Dual-Track E2E Test Suite Runner
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Detect virtualenv python and pytest
if [ -x "${PROJECT_ROOT}/backend/.venv/bin/python" ]; then
    PYTHON_BIN="${PROJECT_ROOT}/backend/.venv/bin/python"
    PYTEST_BIN="${PROJECT_ROOT}/backend/.venv/bin/pytest"
elif [ -x "${PROJECT_ROOT}/.venv/bin/python" ]; then
    PYTHON_BIN="${PROJECT_ROOT}/.venv/bin/python"
    PYTEST_BIN="${PROJECT_ROOT}/.venv/bin/pytest"
else
    PYTHON_BIN="$(which python3 || echo "python")"
    PYTEST_BIN="$(which pytest || echo "pytest")"
fi

export PYTHONPATH="${PROJECT_ROOT}:${PROJECT_ROOT}/backend:${PYTHONPATH:-}"

RUNNER_SCRIPT="${PROJECT_ROOT}/tests/e2e/runner.py"

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

ASchool End-to-End Test Suite & Acceptance Benchmark Runner.

Options:
  --benchmarks     Run all 6 Acceptance Benchmark Verifiers (BM1-BM6)
  --tier 1         Run Tier 1 Feature Coverage test suite
  --tier 2         Run Tier 2 Boundary & Corner test suite
  --tier 3         Run Tier 3 Pairwise Combinatorial test suite
  --tier 4         Run Tier 4 Real-World Application Scenarios
  --all            Execute the full E2E test suite (benchmarks + tiers 1-4)
  -v, --verbose    Enable verbose pytest output with detailed stdout
  -h, --help       Display this help message and exit

Examples:
  ./scripts/run_e2e_tests.sh --benchmarks
  ./scripts/run_e2e_tests.sh --tier 1
  ./scripts/run_e2e_tests.sh --all
EOF
}

if [ $# -eq 0 ]; then
    # Default to running benchmarks and summary
    exec "${PYTHON_BIN}" "${RUNNER_SCRIPT}" --all
fi

case "$1" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        exec "${PYTHON_BIN}" "${RUNNER_SCRIPT}" "$@"
        ;;
esac
