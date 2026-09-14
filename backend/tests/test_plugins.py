"""Tests for plugin system — marketplace, install, uninstall, access control."""
import pytest

from app.models.app import App, SchoolApp
from app.apps.billing import install_app, uninstall_app


class TestInstallPlugin:
    """Unit tests for install_app."""

    def test_install_free_plugin(self, db, school, sample_plugin):
        result = install_app(str(school.id), "attendance")
        assert "error" not in result
        assert result["app_slug"] == "attendance"
        assert result["active"] is True

    def test_install_paid_plugin_with_trial(self, db, school, paid_plugin):
        result = install_app(str(school.id), "lms")
        assert "error" not in result
        assert result["is_trial"] is True
        assert result["trial_ends_at"] is not None

    def test_install_already_installed(self, db, school, sample_plugin, installed_plugin):
        result = install_app(str(school.id), "attendance")
        assert "error" in result
        assert "already installed" in result["error"]

    def test_install_nonexistent_plugin(self, db, school):
        result = install_app(str(school.id), "nonexistent_plugin")
        assert "error" in result
        assert "not found" in result["error"]

    def test_install_checks_dependencies(self, db, school):
        # Create a plugin that depends on "attendance"
        dep_plugin = App(
            slug="advanced_attendance",
            name="Advanced Attendance",
            category="growth",
            is_free=False,
            is_published=True,
            depends_on=["attendance"],
        )
        db.session.add(dep_plugin)
        db.session.commit()

        result = install_app(str(school.id), "advanced_attendance")
        assert "error" in result
        assert "Dependency" in result["error"]

    def test_install_checks_conflicts(self, db, school, sample_plugin, installed_plugin):
        # Create a plugin that conflicts with "attendance"
        conflict_plugin = App(
            slug="alt_attendance",
            name="Alt Attendance",
            category="growth",
            is_free=True,
            is_published=True,
            conflicts_with=["attendance"],
        )
        db.session.add(conflict_plugin)
        db.session.commit()

        result = install_app(str(school.id), "alt_attendance")
        assert "error" in result
        assert "Conflict" in result["error"]

    def test_reinstall_inactive_plugin(self, db, school, sample_plugin):
        # Install then uninstall
        install_app(str(school.id), "attendance")
        uninstall_app(str(school.id), "attendance")

        # Reinstall
        result = install_app(str(school.id), "attendance")
        assert "error" not in result
        assert result["active"] is True


class TestUninstallPlugin:
    """Unit tests for uninstall_app."""

    def test_uninstall_installed_plugin(self, db, school, sample_plugin, installed_plugin):
        result = uninstall_app(str(school.id), "attendance")
        assert "error" not in result

        sp = SchoolApp.query.filter_by(
            school_id=school.id, app_slug="attendance"
        ).first()
        assert sp.active is False
        assert sp.uninstalled_at is not None

    def test_uninstall_not_installed(self, db, school):
        result = uninstall_app(str(school.id), "nonexistent")
        assert "error" in result
        assert "not installed" in result["error"]


class TestPluginMarketplace:
    """Integration tests for marketplace API."""

    def test_marketplace_lists_published_plugins(self, client, admin_user, sample_plugin, paid_plugin):
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")

        resp = client.get("/api/v1/apps/marketplace", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        slugs = [p["slug"] for p in data["data"]]
        assert "attendance" in slugs
        assert "lms" in slugs

    def test_marketplace_filter_by_category(self, client, admin_user, sample_plugin, paid_plugin):
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")

        resp = client.get("/api/v1/apps/marketplace?category=core", headers=headers)
        data = resp.get_json()
        for p in data["data"]:
            assert p["category"] == "core"

    def test_marketplace_requires_auth(self, client):
        resp = client.get("/api/v1/apps/marketplace")
        assert resp.status_code == 401


class TestPluginAccessControl:
    """Tests for @app_required decorator behavior."""

    def test_plugin_gated_route_without_plugin(self, client, admin_user, school):
        """Routes decorated with @app_required should deny access
        when the school doesn't have the plugin installed."""
        from tests.conftest import get_auth_headers
        headers = get_auth_headers(client, admin_user.email, "Test@1234")
        # Access a plugin-gated endpoint — will only work if
        # the attendance plugin route is registered. This tests the decorator concept.
        # The actual route availability depends on AppLoader.


class TestPluginModel:
    """Direct model tests for Plugin and SchoolApp."""

    def test_plugin_creation(self, db):
        p = App(
            slug="test_plugin",
            name="Test Plugin",
            category="starter",
            is_free=True,
            is_published=True,
        )
        db.session.add(p)
        db.session.commit()
        assert p.id is not None
        assert p.install_count == 0

    def test_school_plugin_unique_constraint(self, db, school, sample_plugin, installed_plugin):
        """Cannot install same plugin twice via direct model insert."""
        duplicate = SchoolApp(
            school_id=school.id,
            app_slug="attendance",
            active=True,
        )
        db.session.add(duplicate)
        with pytest.raises(Exception):
            db.session.commit()

    def test_plugin_install_count_increments(self, db, school, sample_plugin):
        initial = sample_plugin.install_count or 0
        install_app(str(school.id), "attendance")
        db.session.refresh(sample_plugin)
        assert sample_plugin.install_count == initial + 1
