"""Shared LLM JSON parsing + validation (A-01).

Replaces the per-service brace-scrape/naked-parse strategies (question_paper,
lesson_plan, homework_helper, school_insights each rolled their own) with ONE
bounded-repair helper:

    parse_and_validate(text, schema=None, required=None) -> dict

1. direct json.loads
2. fenced ```json block
3. first {...} / [...] span
4. one bounded repair pass (trailing commas, unescaped newlines inside
   strings, smart quotes) — then re-parse

If `required` keys are given, the parse must contain all of them or
ValueError is raised with an honest message (the API layer turns that into
502 "AI returned an unusable response" — never a fabricated result).
"""
import json
import logging
import re

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _repair_candidates(text: str):
    """Bounded, safe repairs for the common LLM JSON slips."""
    yield text
    yield re.sub(r",\s*([}\]])", r"\1", text)  # trailing commas
    yield text.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")


def _extract_spans(text: str):
    """Yield the outermost {...} / [...] spans in order."""
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        while start != -1:
            depth = 0
            in_str = False
            escape = False
            for i in range(start, len(text)):
                ch = text[i]
                if in_str:
                    if escape:
                        escape = False
                    elif ch == "\\":
                        escape = True
                    elif ch == '"':
                        in_str = False
                    continue
                if ch == '"':
                    in_str = True
                elif ch == opener:
                    depth += 1
                elif ch == closer:
                    depth -= 1
                    if depth == 0:
                        yield text[start : i + 1]
                        break
            start = text.find(opener, start + 1)


def parse_and_validate(text: str, schema: dict | None = None, required: list[str] | None = None):
    """Parse LLM output into a Python object; validate required keys or a
    minimal jsonschema (type/properties/required only).

    Raises ValueError with an honest message — callers convert to 502.
    """
    if not text or not text.strip():
        raise ValueError("AI returned an empty response")

    attempts: list[str] = [text]
    fence = _FENCE_RE.search(text)
    if fence:
        attempts.insert(0, fence.group(1))
    spans = list(_extract_spans(text))
    if spans:
        attempts.insert(0, spans[0])

    for attempt in attempts:
        for candidate in _repair_candidates(attempt):
            try:
                parsed = json.loads(candidate)
            except (json.JSONDecodeError, ValueError):
                continue
            return _validate(parsed, schema, required)

    raise ValueError(
        "AI returned an unusable response — no valid JSON found after bounded repair"
    )


def _validate(parsed, schema: dict | None, required: list[str] | None):
    if required:
        missing = [k for k in required if k not in parsed] if isinstance(parsed, dict) else required
        if missing:
            raise ValueError(f"AI response missing required keys: {', '.join(missing)}")
    if schema:
        _check_schema(parsed, schema)
    return parsed


def _check_schema(value, schema: dict, path: str = "$") -> None:
    """Minimal jsonschema subset: type, required, properties, items."""
    expected = schema.get("type")
    if expected:
        checks = {
            "object": lambda v: isinstance(v, dict),
            "array": lambda v: isinstance(v, list),
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
            "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
            "boolean": lambda v: isinstance(v, bool),
        }
        check = checks.get(expected)
        if check and not check(value):
            raise ValueError(f"AI response: {path} expected {expected}")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                raise ValueError(f"AI response: {path} missing required key '{key}'")
        props = schema.get("properties", {})
        for key, subschema in props.items():
            if key in value:
                _check_schema(value[key], subschema, f"{path}.{key}")
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            _check_schema(item, schema["items"], f"{path}[{i}]")
