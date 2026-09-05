"""Plugin contract test — the CI gate for every manifest on disk.

`tests/test_plugin_manifests.py` validates only the 8 legacy flat manifests, so
the 40 module manifests were unchecked; that is how ~20 broken code pointers, a
module folder without `__init__.py`, and 17 sidebar icons absent from the
frontend ICON_MAP all shipped.

This test runs `app.plugins.validator` over ALL manifests. Errors fail the
build; warnings are printed for visibility and become errors for any manifest
that declares `schema_version: 2` (the migration ratchet).
"""

import pytest

from app.plugins.validator import (
    PluginValidator,
    format_table,
    validate_all,
)


@pytest.fixture(scope="module")
def findings():
    return validate_all()


def test_manifests_were_found():
    v = PluginValidator()
    v.load()
    # 40 module packages + 8 legacy flat manifests at the time of writing;
    # a floor, not a ceiling, so adding a plugin never breaks this.
    assert len(v.manifests) >= 45, f"only {len(v.manifests)} manifests loaded"
    for slug in ("attendance", "fees", "exams", "ai_suite", "dashboard"):
        assert slug in v.manifests, f"{slug} manifest not discovered"


def test_no_contract_errors(findings):
    errors = [f for f in findings if f.severity == "error"]
    assert not errors, "plugin contract violations:\n" + format_table(errors)


def test_warnings_are_reported_not_ignored(findings, capsys):
    """Warnings do not fail the build, but they must be visible in CI output."""
    warnings = [f for f in findings if f.severity == "warning"]
    if warnings:
        print(format_table(warnings))
    # The count is asserted so a regression that adds 50 new warnings is
    # noticed; raise this only with a comment explaining why.
    assert len(warnings) <= 5, format_table(warnings)


def test_every_code_pointer_resolves(findings):
    """The specific check that ~20 manifests failed before W0."""
    broken = [f for f in findings if "module does not exist" in f.message]
    assert not broken, format_table(broken)


def test_every_module_folder_is_a_python_package(findings):
    """`ai_suite` shipped without __init__.py, so its hooks were unimportable."""
    broken = [f for f in findings if "not a Python package" in f.message]
    assert not broken, format_table(broken)


def test_declared_sidecar_files_exist(findings):
    broken = [f for f in findings if "the file is missing" in f.message]
    assert not broken, format_table(broken)


def test_sidebar_icons_resolve():
    """A manifest icon outside the frontend ICON_MAP renders a generic box.

    This is a warning in the validator (v1 ratchet) but asserted hard here:
    the fix is one import line, and a wrong icon is a silent UI downgrade.
    """
    findings = [f for f in validate_all() if "ICON_MAP" in f.message]
    assert not findings, format_table(findings)


def test_relations_resolve(findings):
    broken = [
        f for f in findings
        if "references unknown slug" in f.message or "points at itself" in f.message
    ]
    assert not broken, format_table(broken)


def test_widget_declarations_are_legal(findings):
    """Structural widget-contract checks over any widgets.yaml on disk."""
    broken = [f for f in findings if "widget" in f.message and f.severity == "error"]
    assert not broken, format_table(broken)


def test_component_widget_tokens_exist_in_the_frontend_registry():
    """A `renderer: component` widget must name a token the web app ships.

    The plugin declares the token in `ui/index.web.json`; the host registers it
    in `frontend/lib/plugin-widgets/registry.ts`. If the two drift, the widget
    renders a "needs a newer app version" card in production — this test catches
    it in CI instead, by parsing the tokens out of both sides.
    """
    import json
    import re
    from pathlib import Path

    backend_root = Path(__file__).resolve().parents[1]
    registry_file = (
        backend_root.parent / "frontend" / "lib" / "plugin-widgets" / "registry.ts"
    )
    if not registry_file.exists():  # frontend not checked out
        return

    source = registry_file.read_text()
    start = source.find("COMPONENT_WIDGETS")
    body = source[start:] if start != -1 else source
    registered = set(re.findall(r'"([\w/-]+/[\w/-]+)":', body))

    declared: dict[str, str] = {}
    modules = backend_root / "app" / "plugins" / "modules"
    for index_file in modules.glob("*/ui/index.web.json"):
        slug = index_file.parents[1].name
        for key, token in (json.loads(index_file.read_text()) or {}).items():
            declared[f"{slug}.{key}"] = token

    missing = {
        widget_id: token
        for widget_id, token in declared.items()
        if token not in registered
    }
    assert not missing, (
        "component widget tokens declared by plugins but not registered in "
        f"frontend/lib/plugin-widgets/registry.ts: {missing}"
    )
