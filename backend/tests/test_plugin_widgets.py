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
        plugins legitimately serve role-scoped prefixes such as /parent.
        """
        allowed_extra = {"parent-app", "parent", "student-app", "student", "teacher-app", "teacher"}
        aliases = {
            "library_management": {"library"},
            "gps_tracking": {"transport"},
            "sms_notifications": {"communications", "sms"},
            "hr_payroll": {"hr"},
            # ai_suite is a bundle: the ai_tools/workbench/tutor blueprints are
            # all gated with plugin_required("ai_suite").
            "ai_suite": {"ai-tools", "ai", "tutor", "benchmarking"},
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

    def test_every_widget_endpoint_exists_in_the_url_map(self, app):
        """B-04 regression class: a widget whose endpoint 404s at runtime.

        Endpoint tokens (`$context.exam_id`) and rule path params
        (`<exam_id>`) are both wildcards; every other segment must match
        positionally against an /api/v1 rule of the same length.
        """
        rule_variants = []
        for rule in app.url_map.iter_rules():
            if not rule.rule.startswith("/api/v1"):
                continue
            body = rule.rule[len("/api/v1"):]
            rule_variants.append([seg for seg in body.split("/") if seg])

        def _matches(endpoint: str) -> bool:
            ep = [seg for seg in endpoint.strip("/").split("/") if seg]
            for segs in rule_variants:
                if len(segs) != len(ep):
                    continue
                ok = True
                for a, b in zip(ep, segs):
                    a_dynamic = a.startswith("$")
                    b_dynamic = b.startswith("<") and b.endswith(">")
                    if a_dynamic or b_dynamic:
                        continue
                    if a != b:
                        ok = False
                        break
                if ok:
                    return True
            return False

        for slug in PluginLoader.get_all_manifests():
            for widget in load_plugin_widgets(slug):
                endpoint = (widget.get("data") or {}).get("endpoint")
                if not endpoint:
                    continue
                assert _matches(endpoint), (
                    f"{widget['id']} fetches {endpoint}, which matches no backend route"
                )


class TestSpecContract:
    """B-01/B-02 regression class: the spec dialect the renderers actually read.

    `resolveToken` passes non-`$` strings through untouched, so a bare key in a
    list item renders the literal field name instead of the value. The working
    dialect is `$`-prefixed tokens for every value reference.
    """

    @staticmethod
    def _spec_widgets():
        for slug in PluginLoader.get_all_manifests():
            for widget in load_plugin_widgets(slug):
                if widget.get("renderer") == "spec":
                    yield widget

    def test_list_item_fields_are_tokens(self):
        for widget in self._spec_widgets():
            if widget.get("type") != "list":
                continue
            item = (widget.get("spec") or {}).get("item") or {}
            for field in ("title", "meta", "timestamp"):
                value = item.get(field)
                assert value is None or str(value).startswith("$"), (
                    f"{widget['id']} spec.item.{field}={value!r} must be a $-token "
                    "(bare keys render the literal field name)"
                )
            subtitle = item.get("subtitle")
            assert subtitle is None or "$" in str(subtitle), (
                f"{widget['id']} spec.item.subtitle={subtitle!r} must interpolate a $-token"
            )

    def test_stat_group_items_are_tokens(self):
        for widget in self._spec_widgets():
            if widget.get("type") != "stat-group":
                continue
            items = (widget.get("spec") or {}).get("items")
            assert items, f"{widget['id']} stat-group needs spec.items"
            for entry in items:
                value = entry.get("value")
                assert value is None or str(value).startswith("$"), (
                    f"{widget['id']} stat item value={value!r} must be a $-token"
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
