"""Benchmark 6 Verifier: Zero Native Browser Dialogs in Production Code.

Requirement from ORIGINAL_REQUEST.md:
"Zero native browser alert() or confirm() calls remain in production code."

Verification Scope:
Static analysis scanner checking web production source directories:
- `frontend/app`
- `frontend/components`

Rules:
1. Rejects any `window.alert(...)`, `alert(...)`
2. Rejects any `window.confirm(...)`, `confirm("...")` (native modal confirms with message strings)
3. Rejects any `window.prompt(...)`, `prompt(...)`
4. Ignores comments (`//`, `/*`), test files, and the implementation of ConfirmDialog itself.
5. Asserts total violations == 0.
"""

import os
import re
import pytest
from typing import List, Dict, Any

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCAN_DIRS = [
    os.path.join(PROJECT_ROOT, "frontend", "app"),
    os.path.join(PROJECT_ROOT, "frontend", "components"),
]

# Patterns detecting native browser dialog execution
DIALOG_PATTERNS = [
    (re.compile(r"\bwindow\.(alert|confirm|prompt)\s*\("), "Native window.<dialog>() invocation"),
    (re.compile(r"(?<![a-zA-Z0-9_\$])alert\s*\("), "Native alert() invocation"),
    (re.compile(r"(?<![a-zA-Z0-9_\$])prompt\s*\("), "Native prompt() invocation"),
    (re.compile(r"(?<![a-zA-Z0-9_\$])confirm\s*\(\s*[\"\`\']"), "Native confirm('message') invocation"),
]


def is_comment(line: str) -> bool:
    line_trimmed = line.strip()
    return (
        line_trimmed.startswith("//")
        or line_trimmed.startswith("/*")
        or line_trimmed.startswith("*")
        or line_trimmed.endswith("*/")
    )


def test_zero_native_dialogs_in_web_production_code():
    """Scan frontend web code for native alert, confirm, and prompt calls."""
    violations: List[Dict[str, Any]] = []
    total_files_scanned = 0
    scanned_extensions = (".ts", ".tsx", ".js", ".jsx")

    for scan_dir in SCAN_DIRS:
        assert os.path.isdir(scan_dir), f"Directory not found: {scan_dir}"
        for root, _, files in os.walk(scan_dir):
            for file in files:
                if not file.endswith(scanned_extensions):
                    continue

                # Exclude tests and confirm-dialog wrapper itself
                if "__tests__" in root or file.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")):
                    continue
                if file == "confirm-dialog.tsx":
                    continue

                total_files_scanned += 1
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, PROJECT_ROOT)

                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    in_block_comment = False
                    for line_num, line in enumerate(f, 1):
                        line_str = line.strip()

                        if "/*" in line_str and "*/" not in line_str:
                            in_block_comment = True
                            continue
                        if in_block_comment:
                            if "*/" in line_str:
                                in_block_comment = False
                            continue

                        if is_comment(line_str):
                            continue

                        for pattern, rule_desc in DIALOG_PATTERNS:
                            if pattern.search(line):
                                violations.append({
                                    "file": rel_path,
                                    "line": line_num,
                                    "rule": rule_desc,
                                    "snippet": line.strip(),
                                })

    print(f"\n{'='*75}")
    print(f"STATIC ANALYSIS SCANNER: Zero Native Dialog Audit (BM6)")
    print(f"{'-'*75}")
    print(f"  Target Directories:    frontend/app, frontend/components")
    print(f"  Total Files Scanned:   {total_files_scanned}")
    print(f"  Violations Detected:   {len(violations)}")
    print(f"{'-'*75}")

    if violations:
        print("  VIOLATIONS LIST:")
        for idx, v in enumerate(violations, 1):
            print(f"  {idx}. {v['file']}:{v['line']} -> {v['snippet']} ({v['rule']})")
        print(f"{'='*75}\n")
    else:
        print("  All production web files comply with modern non-blocking UX standards.")
        print(f"{'='*75}\n")

    assert len(violations) == 0, (
        f"Found {len(violations)} native browser dialog calls in production code! "
        f"Use ConfirmDialog or Sonner toast instead."
    )
