"""WP-style plugin registry tests (2026-08-30 architecture batch).

The plugins DIRECTORY is the catalog source of truth:
- refresh_registry() upserts the `plugins` mirror from the scanned manifests
  (missing folders created, vanished folders unpublished, zero seeding);
- /plugins/marketplace reads the registry merged with mirror fallbacks;
- module hooks (hooks.py) provide activate/deactivate/uninstall lifecycle.
"""

import pytest
from sqlalchemy import inspect, text

from app.api.v1.plugins import _catalog_entries
from app.models.plugin import Plugin, SchoolPlugin
from app.plugins.billing import install_plugin, uninstall_plugin
from app.plugins.loader import PluginLoader

# The seven plugin blueprints moved into their module folders (routes.py).
MOVED_MODULES = [
    "white_label",
    "biometric",
    "multi_branch",
    "ai_adaptive_learning",
    "social_ads",
    "disaster_management",
    "incident_management",
]

# Delisted from the catalog by their manifests (published: false).
# E230 (2026-08-31) catalog consolidation: the seven AI plugins folded into
# the `ai_suite` bundle, the `library` duplicate folded into
# `library_management`, and `social_hub` withdrawn — all unpublished exactly
# like the digital_content→elibrary and portfolio→student_portfolio merges
# (gating aliases KEPT so legacy installs still pass).
DELISTED_SLUGS = {
    "digital_content",
    "plugins_nav",
    "portfolio",
    "ai_grading",
    "ai_tutor",
    "ai_tools",
    "ai_adaptive_learning",
    "ai_insights",
    "benchmarking",
    "advanced_analytics",
    "social_hub",
    "library",
}


# ── Registry: directory scan + catalog mirror ──────────────────────────────


class TestRegistryRefresh:
    def test_scan_finds_the_full_directory(self):
        PluginLoader._scan_manifests()
        scanned = PluginLoader.get_all_manifests()
        # The directory is the catalog — both module packages and legacy
        # manifests are scanned (modules take precedence on slug clashes).
        assert len(scanned) >= 55, f"directory scan too small: {len(scanned)}"
        for slug in ("attendance", "fees", "whatsapp_bot", "ai_tools",
                     "website_builder", *MOVED_MODULES):
            assert slug in scanned, f"missing {slug}"

    def test_refresh_upserts_mirror_for_every_scanned_slug(self, db):
        result = PluginLoader.refresh_registry()
        rows = {p.slug: p for p in Plugin.query.all()}
        assert result["scanned"] == len(PluginLoader.get_all_manifests())
        for slug in PluginLoader.get_all_manifests():
            assert slug in rows, f"mirror row missing for {slug}"
        assert result["created"] >= 0

    def test_refresh_is_idempotent(self, db):
        PluginLoader.refresh_registry()
        second = PluginLoader.refresh_registry()
        assert second["created"] == 0
        assert second["deactivated"] == 0
        assert second["scanned"] == len(PluginLoader.get_all_manifests())
        # No duplicate rows were minted.
        assert Plugin.query.count() == second["scanned"]

    def test_delisted_manifests_are_unpublished_in_mirror(self, db):
        PluginLoader.refresh_registry()
        for slug in DELISTED_SLUGS:
            row = Plugin.query.filter_by(slug=slug).first()
            assert row is not None
            assert row.is_published is False, f"{slug} must be delisted"

    def test_vanished_folder_is_unpublished_by_refresh(self, db):
        """A mirror row whose plugin folder/manifest is gone gets delisted
        (never deleted — history preserved) by the next refresh."""
        ghost = Plugin(
            slug="ghost_plugin_from_2019",
            name="Ghost",
            category="starter",
            is_published=True,
        )
        db.session.add(ghost)
        db.session.commit()

        entries_before = {e["slug"] for e in _catalog_entries()}
        assert "ghost_plugin_from_2019" in entries_before  # fallback until refresh

        PluginLoader.refresh_registry()
        row = Plugin.query.filter_by(slug="ghost_plugin_from_2019").first()
        assert row is not None  # never dropped
        assert row.is_published is False
        assert "ghost_plugin_from_2019" not in {e["slug"] for e in _catalog_entries()}
        db.session.delete(ghost)
        db.session.commit()

    def test_mirror_additively_syncs_manifest_fields(self, db):
        PluginLoader.refresh_registry()
        m = PluginLoader.get_manifest("attendance")
        row = Plugin.query.filter_by(slug="attendance").first()
        assert row.name == (m.get("name") or "attendance")
        assert float(row.price_monthly) == float(m.get("price_monthly") or 0)


# ── Catalog reads: registry merged with mirror fallback ───────────────────


class TestCatalogEntries:
    def test_marketplace_catalog_lists_published_registry(self, db):
        PluginLoader.refresh_registry()
        entries = {e["slug"]: e for e in _catalog_entries()}
        for slug, m in PluginLoader.get_all_manifests().items():
            if slug in DELISTED_SLUGS:
                assert slug not in entries, f"delisted {slug} must not be offered"
                continue
            assert slug in entries, f"published {slug} missing from catalog"
        # Response shape (consumed by the marketplace page) stays stable.
        sample = entries["attendance"]
        for key in ("slug", "name", "description", "category", "price_monthly",
                    "price_yearly", "is_free", "version", "screenshots", "tags",
                    "sort_order", "is_featured", "avg_rating", "install_count",
                    "depends_on", "conflicts_with"):
            assert key in sample

    def test_manifest_values_win_over_mirror_drift(self, db):
        PluginLoader.refresh_registry()
        row = Plugin.query.filter_by(slug="attendance").first()
        row.description = "STALE MIRROR DRIFT"
        db.session.commit()
        entry = {e["slug"]: e for e in _catalog_entries()}["attendance"]
        assert entry["description"] != "STALE MIRROR DRIFT"


# ── Lifecycle hooks for the moved modules ──────────────────────────────────


class TestModuleHooks:
    def test_hooks_discoverable_for_all_moved_modules(self):
        for slug in MOVED_MODULES:
            hooks = PluginLoader.get_hooks(slug)
            assert hooks is not None, f"hooks module missing for {slug}"
            assert callable(getattr(hooks, "activate", None))
            assert callable(getattr(hooks, "deactivate", None))
            assert callable(getattr(hooks, "uninstall", None))

    def test_activate_hook_recreates_dropped_tables_checkfirst(self, db):
        """activate = create_all for module-owned models, checkfirst — prove
        it by dropping the table and letting the hook bring it back."""
        from app.models.school_chain import SchoolChain, SchoolChainMember

        # Drop the FK child FIRST — school_chain_members carries the constraint
        # pointing at school_chains, so dropping the parent alone would fail.
        SchoolChainMember.__table__.drop(db.engine, checkfirst=True)
        SchoolChain.__table__.drop(db.engine, checkfirst=True)
        assert not inspect(db.engine).has_table("school_chains")

        hooks = PluginLoader.get_hooks("multi_branch")
        hooks.activate(db)
        insp = inspect(db.engine)
        assert insp.has_table("school_chains")
        assert insp.has_table("school_chain_members")

        # Idempotent: tables already exist → checkfirst no-ops, no error.
        hooks.activate(db)

    def test_deactivate_hook_is_a_noop(self, db):
        for slug in MOVED_MODULES:
            hooks = PluginLoader.get_hooks(slug)
            assert hooks.deactivate(db) is None

    def test_white_label_uninstall_removes_only_owned_config_key(self, db):
        from app.models.school import School

        school = School(
            name="WL School",
            slug="wl-uninstall",
            plan="growth",
            status="active",
            is_active=True,
            settings={"white_label": {"branding": {"display_name": "X"}}, "keep_me": 1},
        )
        db.session.add(school)
        db.session.commit()

        hooks = PluginLoader.get_hooks("white_label")
        hooks.uninstall(db)
        db.session.expire_all()
        settings = School.query.get(school.id).settings
        assert "white_label" not in settings
        assert settings["keep_me"] == 1  # non-module keys untouched

    def test_install_uninstall_runs_hooks_and_install_state(self, db, school):
        """install → SchoolPlugin row + activate hook (tables ensured);
        uninstall → row stamped uninstalled, data tables kept."""
        PluginLoader.refresh_registry()

        result = install_plugin(str(school.id), "multi_branch")
        assert "error" not in result
        assert inspect(db.engine).has_table("school_chains")
        sp = SchoolPlugin.query.filter_by(
            school_id=school.id, plugin_slug="multi_branch"
        ).first()
        assert sp is not None and sp.active

        result = uninstall_plugin(str(school.id), "multi_branch")
        assert "error" not in result
        db.session.expire_all()
        sp = SchoolPlugin.query.filter_by(
            school_id=school_id_helper(), plugin_slug="multi_branch"
        ).first() if False else SchoolPlugin.query.filter_by(
            school_id=school.id, plugin_slug="multi_branch"
        ).first()
        assert sp.uninstalled_at is not None
        # WP keeps data on uninstall — tables stay.
        assert inspect(db.engine).has_table("school_chains")


# ── Blueprints mounted from the module folders ─────────────────────────────


class TestMovedBlueprints:
    def test_moved_blueprints_are_mounted_once(self, app):
        # Plugin blueprints are registered as children of api_v1_bp, so their
        # endpoints are namespaced ("api_v1.white_label.overview").
        def _owned(endpoints: set[str], bp: str) -> list[str]:
            return [
                e
                for e in endpoints
                if e == bp or e.startswith(f"{bp}.") or f".{bp}." in e
            ]

        endpoints = {r.endpoint for r in app.url_map.iter_rules()}
        for bp in ("white_label", "biometric", "multi_branch",
                   "adaptive_learning", "social_ads", "disaster_management",
                   "incident_management"):
            assert _owned(endpoints, bp), f"blueprint {bp} has no mounted routes"

        # No (path, method) pair is registered twice — the loader must skip
        # statically mounted module paths (a double registration would 500 at
        # boot, so a healthy url_map is itself the regression check). The same
        # path with different methods (GET vs PUT) is normal REST, not a dupe.
        from collections import Counter

        method_counts: Counter = Counter()
        for r in app.url_map.iter_rules():
            if not str(r).startswith("/api/v1"):
                continue
            for m in r.methods - {"HEAD", "OPTIONS"}:
                method_counts[(str(r), m)] += 1
        dupes = {f"{p} [{m}]": c for (p, m), c in method_counts.items() if c > 1}
        assert not dupes, f"duplicate url rules: {dupes}"

    def test_config_schema_endpoint_serves_module_schema(self, client, db, admin_user):
        from tests.conftest import get_auth_headers

        headers = get_auth_headers(client, admin_user.email, "Test@1234")
        resp = client.get("/api/v1/plugins/attendance/config-schema", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["slug"] == "attendance"
        assert data["has_schema"] is True
        keys = {f["key"] for f in data["fields"]}
        assert "absent_alerts_enabled" in keys

        # A plugin without a schema falls back to the generic editor.
        resp = client.get("/api/v1/plugins/library_management/config-schema", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["has_schema"] is False and data["fields"] == []

    def test_refresh_registry_endpoint_is_superadmin_only(
        self, client, db, admin_user, superadmin_user
    ):
        from tests.conftest import get_auth_headers

        admin_headers = get_auth_headers(client, admin_user.email, "Test@1234")
        resp = client.post("/api/v1/plugins/refresh-registry", headers=admin_headers)
        assert resp.status_code == 403

        super_headers = get_auth_headers(client, superadmin_user.email, "SuperSecret@1")
        resp = client.post("/api/v1/plugins/refresh-registry", headers=super_headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["scanned"] == len(PluginLoader.get_all_manifests())
        # Idempotent: a second refresh creates nothing (the first call — or
        # app startup — has already mirrored the directory).
        second = client.post("/api/v1/plugins/refresh-registry", headers=super_headers)
        assert second.status_code == 200
        assert second.get_json()["data"]["created"] == 0
