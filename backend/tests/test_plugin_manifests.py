"""Tests for plugin YAML manifest validation — structure, dependencies, routes."""
from pathlib import Path

import pytest
import yaml


MANIFESTS_DIR = Path(__file__).parent.parent / "app" / "plugins" / "manifests"

REQUIRED_FIELDS = {"slug", "name", "category"}
VALID_CATEGORIES = {"core", "starter", "growth", "premium", "add_on"}


def load_all_manifests():
    """Load all YAML manifests and return as list of (filename, data)."""
    manifests = []
    for f in sorted(MANIFESTS_DIR.glob("*.yaml")):
        if f.name.startswith("_"):
            continue
        data = yaml.safe_load(f.read_text())
        manifests.append((f.name, data))
    return manifests


ALL_MANIFESTS = load_all_manifests()
ALL_SLUGS = {m[1]["slug"] for m in ALL_MANIFESTS if m[1].get("slug")}


class TestManifestDiscovery:
    """Verify manifests directory and file count."""

    def test_manifests_directory_exists(self):
        assert MANIFESTS_DIR.exists(), f"Manifests directory missing: {MANIFESTS_DIR}"

    def test_manifests_not_empty(self):
        assert len(ALL_MANIFESTS) > 0, "No YAML manifests found"

    def test_minimum_manifest_count(self):
        # We expect at least 25 manifests (29 currently exist)
        assert len(ALL_MANIFESTS) >= 25, f"Expected 25+ manifests, found {len(ALL_MANIFESTS)}"


class TestManifestStructure:
    """Each manifest must have required fields and valid values."""

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_has_required_fields(self, filename, data):
        for field in REQUIRED_FIELDS:
            assert field in data, f"{filename} missing required field: {field}"

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_slug_matches_filename(self, filename, data):
        expected_slug = filename.replace(".yaml", "")
        assert data["slug"] == expected_slug, (
            f"Slug mismatch: file={filename} slug={data['slug']}"
        )

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_valid_category(self, filename, data):
        assert data["category"] in VALID_CATEGORIES, (
            f"{filename}: invalid category '{data['category']}'"
        )

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_has_description(self, filename, data):
        assert data.get("description"), f"{filename} missing description"


class TestManifestDependencies:
    """Dependency slugs must reference existing manifests."""

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_dependencies_resolve(self, filename, data):
        depends_on = data.get("depends_on") or []
        for dep in depends_on:
            assert dep in ALL_SLUGS, (
                f"{filename}: dependency '{dep}' not found in manifests"
            )

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_no_self_dependency(self, filename, data):
        depends_on = data.get("depends_on") or []
        assert data["slug"] not in depends_on, (
            f"{filename}: self-dependency detected"
        )

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_conflicts_resolve(self, filename, data):
        conflicts = data.get("conflicts_with") or []
        for c in conflicts:
            assert c in ALL_SLUGS, (
                f"{filename}: conflict '{c}' not found in manifests"
            )


class TestManifestRoutes:
    """API blueprint paths should follow expected patterns."""

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_api_blueprint_path_format(self, filename, data):
        bp = data.get("api_blueprint")
        if bp:
            assert bp.startswith("app."), (
                f"{filename}: api_blueprint should start with 'app.', got '{bp}'"
            )

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_frontend_route_starts_with_slash(self, filename, data):
        fe = data.get("frontend", {})
        route = fe.get("route")
        if route:
            assert route.startswith("/"), (
                f"{filename}: frontend route should start with '/', got '{route}'"
            )


class TestManifestFrontend:
    """Frontend sidebar config validation."""

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_sidebar_has_label(self, filename, data):
        sidebar = data.get("frontend", {}).get("sidebar", {})
        if sidebar:
            assert sidebar.get("label"), f"{filename}: sidebar missing label"

    @pytest.mark.parametrize("filename,data", ALL_MANIFESTS, ids=[m[0] for m in ALL_MANIFESTS])
    def test_sidebar_visible_to_is_list(self, filename, data):
        sidebar = data.get("frontend", {}).get("sidebar", {})
        visible = sidebar.get("visible_to")
        if visible is not None:
            assert isinstance(visible, list), (
                f"{filename}: visible_to should be a list"
            )


class TestUniqueSlugs:
    """All slugs must be unique across manifests."""

    def test_no_duplicate_slugs(self):
        slugs = [m[1]["slug"] for m in ALL_MANIFESTS]
        assert len(slugs) == len(set(slugs)), (
            f"Duplicate slugs found: {[s for s in slugs if slugs.count(s) > 1]}"
        )


class TestFreePlugins:
    """Core/free plugins should have zero pricing."""

    def test_free_plugins_have_zero_price(self):
        for filename, data in ALL_MANIFESTS:
            if data["category"] == "core":
                price = data.get("price_monthly", 0)
                assert price == 0, f"{filename}: core plugin should be free, got price={price}"
