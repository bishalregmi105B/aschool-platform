"""Widget contract tests — loading, normalization, and the server-side gate.

The gate is the security-relevant part: `GET /plugins/widgets` must OMIT a
widget whose plugin the school has not installed, whose role does not match, or
whose surface was not asked for. "Hidden in the client" is not a gate, so these
tests assert absence from the payload, not a flag on it.
"""

import pytest

from app.plugins.loader import PluginLoader
from app.plugins.widgets import (
    default_layout,
    load_plugin_widgets,
    reset_cache,
    widgets_for,
)


@pytest.fixture(autouse=True)
def _scan():
    reset_cache()
    PluginLoader._scan_manifests()
    yield
    reset_cache()


class TestLoading:
    def test_attendance_ships_widgets(self):
        widgets = load_plugin_widgets("attendance")
        assert widgets, "attendance/widgets.yaml should declare widgets"
        keys = {w["key"] for w in widgets}
        assert "today_attendance" in keys
        assert "pending_leave_requests" in keys

    def test_ids_are_namespaced_by_slug(self):
        for widget in load_plugin_widgets("fees"):
            assert widget["id"] == f"fees.{widget['key']}"
            assert widget["plugin_slug"] == "fees"

    def test_shorthand_slots_are_normalized(self):
        """A slot may be a bare string in YAML; the payload is always objects."""
        for slug in ("attendance", "fees", "exams"):
            for widget in load_plugin_widgets(slug):
                for slot in widget["slots"]:
                    assert isinstance(slot, dict)
                    assert isinstance(slot["id"], str)
                    assert isinstance(slot["order"], int)
                    assert isinstance(slot["default"], bool)

    def test_plugin_without_widgets_yaml_returns_empty(self):
        assert load_plugin_widgets("alumni") == []

    def test_sizes_have_defaults(self):
        for widget in load_plugin_widgets("attendance"):
            assert widget["size"]["default"]["w"] >= 1
            assert widget["size"]["min"]["w"] >= 1


class TestGate:
    def test_uninstalled_plugin_contributes_nothing(self):
        assert widgets_for([], "school_admin", "web") == []

    def test_installed_plugin_contributes_its_widgets(self):
        ids = {w["id"] for w in widgets_for(["attendance"], "school_admin", "web")}
        assert "attendance.today_attendance" in ids
        # fees is NOT installed in this call, so none of its widgets may appear.
        assert not any(i.startswith("fees.") for i in ids)

    def test_role_mismatch_hides_the_widget(self):
        admin = {w["id"] for w in widgets_for(["attendance"], "school_admin", "web")}
        student = {w["id"] for w in widgets_for(["attendance"], "student", "web")}
        assert "attendance.pending_leave_requests" in admin
        assert "attendance.pending_leave_requests" not in student

    def test_surface_filter(self):
        web = {w["id"] for w in widgets_for(["attendance"], "parent", "web")}
        mobile = {w["id"] for w in widgets_for(["attendance"], "parent", "mobile")}
        assert "attendance.mobile_attendance_card" in mobile
        assert "attendance.mobile_attendance_card" not in web

    def test_slot_filter(self):
        main = widgets_for(["attendance"], "school_admin", "web", "dashboard.main")
        assert {w["id"] for w in main} == {"attendance.today_attendance"}

    def test_alias_install_satisfies_the_canonical_slug(self):
        """A school holding a legacy slug still gets the canonical widgets.

        Same single-hop alias semantics as @plugin_required, so an ai_tools-era
        install is not silently stripped of its dashboard.
        """
        ids = {w["id"] for w in widgets_for(["library"], "school_admin", "web")}
        canonical = {
            w["id"] for w in widgets_for(["library_management"], "school_admin", "web")
        }
        assert ids == canonical

    def test_permission_filter_is_applied_when_supplied(self):
        with_perm = {
            w["id"]
            for w in widgets_for(
                ["exams"], "teacher", "web", permissions={"exams.enter_marks"}
            )
        }
        without = {
            w["id"] for w in widgets_for(["exams"], "teacher", "web", permissions=set())
        }
        assert "exams.marks_entry_grid" in with_perm
        assert "exams.marks_entry_grid" not in without

    def test_ordering_follows_slot_order(self):
        widgets = widgets_for(
            ["attendance", "fees", "exams"], "school_admin", "web", "dashboard.actions"
        )
        orders = [
            next(s["order"] for s in w["slots"] if s["id"] == "dashboard.actions")
            for w in widgets
        ]
        assert orders == sorted(orders)

    def test_default_layout_only_lists_default_true(self):
        widgets = widgets_for(["fees"], "school_admin", "web", "dashboard.main")
        layout = default_layout(widgets, "dashboard.main")
        assert layout == ["fees.collection_summary"]


class TestEndpointOwnership:
    def test_every_api_widget_points_at_its_own_plugin_domain(self):
        """A widget must not fetch another plugin's API.

        Endpoints are checked loosely (first path segment) because several
        plugins legitimately serve role-scoped prefixes such as /parent-app.
        """
        allowed_extra = {"parent-app", "student-app", "teacher-app"}
        aliases = {
            "library_management": {"library"},
            "gps_tracking": {"transport"},
            "sms_notifications": {"communications", "sms"},
            "hr_payroll": {"hr"},
        }
        for slug in PluginLoader.get_all_manifests():
            for widget in load_plugin_widgets(slug):
                endpoint = (widget.get("data") or {}).get("endpoint")
                if not endpoint:
                    continue
                first = endpoint.strip("/").split("/")[0]
                acceptable = {slug, slug.replace("_", "-")} | aliases.get(slug, set())
                assert first in acceptable | allowed_extra, (
                    f"{widget['id']} fetches /{first}, which is not its own domain"
                )


class TestWidgetsEndpoint:
    def test_requires_auth(self, client):
        resp = client.get("/api/v1/plugins/widgets")
        assert resp.status_code in (401, 422)

    def test_returns_only_installed_widgets(self, client, db, school, admin_user):
        from tests.conftest import get_auth_headers

        headers = get_auth_headers(client, admin_user.email, "Test@1234")
        resp = client.get(
            "/api/v1/plugins/widgets?surface=web&slot=dashboard.main",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["surface"] == "web"
        assert data["slot"] == "dashboard.main"
        returned = {w["plugin_slug"] for w in data["widgets"]}
        # Whatever came back, every plugin must be one the school actually has.
        from app.models.plugin import SchoolPlugin

        installed = {
            sp.plugin_slug
            for sp in SchoolPlugin.query.filter_by(
                school_id=school.id, active=True
            ).all()
        }
        from app.plugins.decorators import _acceptable_plugin_slugs

        for slug in returned:
            assert _acceptable_plugin_slugs(slug) & installed, (
                f"{slug} widgets served to a school that has not installed it"
            )
