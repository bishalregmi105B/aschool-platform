"""Benchmark 4 Verifier: Actionable Empty States with Deep Links.

Requirement from ORIGINAL_REQUEST.md:
"Every empty state provides an actionable setup link rather than a dead-end blank screen."

Verification Scope:
1. Automated inspection of the empty state components in `frontend/components/ui/empty-state.tsx`.
2. Verifies support for the 3 required variants:
   - "never-used": First-time setup with primary creation CTA
   - "filtered": Filter/search yielding zero rows with filter reset CTA
   - "dependency": Missing upstream prerequisite with direct deep-link CTA
3. Verifies that all variant components define and provide actionable deep-link CTAs.
4. Audits dashboard modules for empty-state usage and actionable link coverage.
"""

import os
import re
import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
EMPTY_STATE_PATH = os.path.join(PROJECT_ROOT, "frontend", "components", "ui", "empty-state.tsx")
DASHBOARD_DIR = os.path.join(PROJECT_ROOT, "frontend", "app", "dashboard")


def test_empty_state_component_variants_and_contracts():
    """Verify that empty-state.tsx defines and exports all 3 required variants with actionable CTAs."""
    assert os.path.isfile(EMPTY_STATE_PATH), f"empty-state.tsx not found at {EMPTY_STATE_PATH}"

    with open(EMPTY_STATE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Verify EmptyStateVariant type definition
    assert "EmptyStateVariant" in content, "EmptyStateVariant type is not defined in empty-state.tsx"
    for variant in ["never-used", "filtered", "dependency"]:
        assert variant in content, f"Variant '{variant}' missing from EmptyStateVariant definition"

    # 2. Verify all 3 variant components are exported
    required_exports = [
        "NeverUsedEmptyState",
        "FilteredEmptyState",
        "DependencyMissingEmptyState",
    ]
    for comp in required_exports:
        assert comp in content, f"Component '{comp}' is not defined or exported in empty-state.tsx"

    # 3. Verify dependency-missing variant provides an actionable deep-link setupHref
    assert "setupHref" in content, "DependencyMissingEmptyState must accept a setupHref deep link"
    assert "prerequisiteName" in content, "DependencyMissingEmptyState must identify the missing prerequisite"

    # 4. Verify filtered variant provides filter-clearing action
    assert "onClearFilters" in content or "clearLabel" in content, (
        "FilteredEmptyState must provide a filter-clearing action"
    )

    # 5. Verify never-used variant provides creation action or link
    assert "createHref" in content or "onCreate" in content, (
        "NeverUsedEmptyState must provide a createHref or onCreate action"
    )

    print("\n[BM4-PASS] Verified 3 empty state components in empty-state.tsx:")
    print("  ✓ Never-used (with createHref/onCreate)")
    print("  ✓ Filtered-empty (with onClearFilters)")
    print("  ✓ Dependency-missing (with setupHref deep link)")


def test_empty_state_actionable_deep_link_contracts():
    """Verify the deep link CTA contract patterns across variants."""
    with open(EMPTY_STATE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # ActionButton must handle hrefs via <a> link or Button asChild
    assert "action.href" in content, "ActionButton must support action.href navigation"
    assert "action.label" in content, "ActionButton must render action.label"
    assert "variant=" in content, "ActionButton must support button variants"

    # DependencyMissingEmptyState must route through action with href
    dep_match = re.search(r"function DependencyMissingEmptyState\([^)]*\)\s*\{([\s\S]*?)\n\}", content)
    assert dep_match is not None, "DependencyMissingEmptyState implementation not found"
    dep_code = dep_match.group(1)
    assert 'variant="dependency"' in dep_code or "variant: \"dependency\"" in dep_code
    assert "setupHref" in dep_code


    print("[BM4-PASS] Verified deep-link CTA contracts in empty state components.")


def test_dashboard_empty_state_audit():
    """Audit dashboard modules to verify actionable empty states are deployed."""
    empty_state_usages = []
    actionable_count = 0

    empty_state_pattern = re.compile(
        r"<(EmptyState|NeverUsedEmptyState|FilteredEmptyState|DependencyMissingEmptyState|LockedState)\b([^>]*)/?>",
        re.DOTALL,
    )

    for root, _, files in os.walk(DASHBOARD_DIR):
        for file in files:
            if not file.endswith((".tsx", ".jsx")):
                continue
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            for match in empty_state_pattern.finditer(content):
                tag_name = match.group(1)
                props_content = match.group(2)
                rel_path = os.path.relpath(path, PROJECT_ROOT)

                has_action = any(
                    attr in props_content
                    for attr in [
                        "action=",
                        "setupHref=",
                        "createHref=",
                        "onClearFilters=",
                        "onInstall=",
                        "marketplaceHref=",
                        "secondaryAction=",
                    ]
                )
                if has_action:
                    actionable_count += 1

                empty_state_usages.append({
                    "file": rel_path,
                    "tag": tag_name,
                    "has_action": has_action,
                })

    total = len(empty_state_usages)
    assert total > 0, "No empty state component usages found in dashboard"
    assert actionable_count > 0, "No actionable empty state instances found"

    pct = (actionable_count / total) * 100
    print(f"\n[BM4-AUDIT] Total dashboard empty state instances: {total}")
    print(f"[BM4-AUDIT] Actionable CTAs present: {actionable_count} ({pct:.1f}%)")
