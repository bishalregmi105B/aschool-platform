"""Golden-set eval runner (A-02) — offline-skipped without GROQ_API_KEY."""
import json
import os
from pathlib import Path

import pytest

EVALS_DIR = Path(__file__).parent
HAS_KEY = bool(os.getenv("GROQ_API_KEY", "").startswith("gsk_"))


def _cases(category: str):
    path = EVALS_DIR / f"{category}_golden.jsonl"
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]


@pytest.mark.skipif(not HAS_KEY, reason="GROQ_API_KEY not set — evals run nightly")
@pytest.mark.parametrize("category", ["planning", "assessment", "communication"])
def test_category_golden_set(category):
    cases = _cases(category)
    if not cases:
        pytest.skip(f"no golden cases yet for {category}")
    from app.services.ai.workbench import AIWorkbenchOrchestrator

    for case in cases:
        out = AIWorkbenchOrchestrator.run(case.get("tool_key", "lesson_plan"), {
            "input": case["input"],
        })
        blob = json.dumps(out["result"], ensure_ascii=False)
        for needle in case.get("expect_contains", []):
            assert needle.lower() in blob.lower(), (
                f"[{category}] expected {needle!r} in generation"
            )
