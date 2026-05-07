"""Regression tests for plugin alias compatibility."""

from app.models.plugin import Plugin, SchoolPlugin
from app.plugins.decorators import _acceptable_plugin_slugs
from tests.conftest import get_auth_headers


def test_acceptable_plugin_slugs_resolves_transitive_aliases():
    accepted = _acceptable_plugin_slugs("design_studio")
    assert "design_studio" in accepted
    assert "digital_content" in accepted
    assert "elibrary" in accepted


def test_design_studio_gate_accepts_elibrary_alias(client, db, school, admin_user):
    db.session.add(
        Plugin(
            slug="elibrary",
            name="eLibrary",
            category="core",
            is_free=True,
            is_published=True,
        )
    )
    db.session.add(
        SchoolPlugin(
            school_id=school.id,
            plugin_slug="elibrary",
            active=True,
        )
    )
    db.session.commit()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.post(
        "/api/v1/design-studio/bulk/id-cards",
        json={},
        headers=headers,
    )

    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False
    assert data["error"] == "class_id is required"
