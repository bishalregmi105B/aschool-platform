"""E-04: plugin-event vocabulary integrity test (P-F).

Scans the source at test time and asserts the manifest↔runtime contract:
  (a) every manifest `emits:` entry has ≥1 runtime `emit(...)` call;
  (b) every runtime emit string is declared in some manifest;
  (c) every runtime `@on(...)` listener has ≥1 runtime emit.
Kills the "events fiction" (manifest blocks that were ~60% aspirational) at
the source — a rename without the manifest, or a declaration without the
code, fails CI.

Socket-only events (`gps_update`, `join_school`) are realtime channel
messages, not plugin-bus events — allowlisted with that reason.
"""
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))

SOCKET_ONLY_EVENTS = {"gps_update", "join_school"}


def _py_sources():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for name in files:
            if name.endswith(".py"):
                yield os.path.join(base, name)


def _manifest_sources():
    plugins = os.path.join(ROOT, "plugins", "modules")
    for base, dirs, files in os.walk(plugins):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for name in files:
            if name == "manifest.yaml":
                yield os.path.join(base, name)


def _runtime_emits():
    emits = {}
    for path in _py_sources():
        src = open(path, encoding="utf-8").read()
        # NOTE: `(?<![_a-zA-Z])emit` excludes ai_teacher's local `_emit(...)`
        # document-section helper (a different concept with the same name).
        for m in re.finditer(
            r'(?<![_a-zA-Z])emit(?:_for_school|_async|_async_for_school)?\(\s*\n?\s*"([^"]+)"',
            src,
        ):
            emits.setdefault(m.group(1), set()).add(path)
    return emits


def _runtime_listeners():
    listeners = {}
    for path in _py_sources():
        src = open(path, encoding="utf-8").read()
        for m in re.finditer(r"@on\(\s*[\"']([^\"']+)[\"']\s*\)", src):
            listeners.setdefault(m.group(1), set()).add(path)
    return listeners


def _manifest_emits():
    declared = {}
    for path in _manifest_sources():
        text = open(path, encoding="utf-8").read()
        m = re.search(r"emits:\s*\n((?:[ \t]+-[ \t]+.+\n)+)", text)
        if not m:
            continue
        for line in m.group(1).splitlines():
            event = line.strip().lstrip("-").strip()
            if event:
                declared.setdefault(event, set()).add(path)
    return declared


def test_every_manifest_emission_is_emitted_at_runtime():
    runtime = _runtime_emits()
    missing = sorted(set(_manifest_emits()) - set(runtime))
    assert not missing, (
        "Manifest declares events nothing emits (the events-fiction "
        f"regression): {missing}. Either emit them or delete the declaration."
    )


def test_every_runtime_emit_is_declared():
    declared = _manifest_emits()
    undeclared = sorted(
        e for e in _runtime_emits() if e not in declared and e not in SOCKET_ONLY_EVENTS
    )
    assert not undeclared, (
        f"Runtime events not declared in any manifest: {undeclared}. "
        "Declare them (they are the plugin contract) or allowlist as socket-only."
    )


def test_every_listener_has_an_emitter():
    runtime = _runtime_emits()
    orphan_listeners = sorted(
        name for name in _runtime_listeners() if name not in runtime
    )
    assert not orphan_listeners, (
        f"@on() listeners for events nothing emits (dead code): {orphan_listeners}"
    )
