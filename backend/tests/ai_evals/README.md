# AI Golden-Set Evals (A-02 / ecosystem §13.1)

Category-level eval sets — one per tool CATEGORY, not per tool. Each file
holds prompt/expected pairs run nightly in CI (NOT per-PR: LLM cost).

Structure: `{category}_golden.jsonl` — one JSON object per line:
    {"input": "...", "expect_contains": ["..."], "expect_schema": "lesson_plan"}

Runner: `tests/ai_evals/runner.py` (requires GROQ_API_KEY; skipped when the
key is absent so unit CI stays offline). LLM-as-judge scoring for prose
quality lands with the tutor red-team pass.
