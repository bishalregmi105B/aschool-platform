"""Regression tests for plugin alias compatibility."""

from app.models.plugin import Plugin, SchoolPlugin
from app.plugins.decorators import _acceptable_plugin_slugs
from tests.conftest import get_auth_headers


def test_acceptable_plugin_slugs_is_single_hop_non_transitive():
    # design_studio is its own plugin: no alias may chain into it.
    assert _acceptable_plugin_slugs("design_studio") == {"design_studio"}

    # Single-hop rename aliases still resolve in both directions,
    # but never chain to a third slug.
    assert _acceptable_plugin_slugs("digital_content") == {
        "digital_content",
        "elibrary",
    }
    assert _acceptable_plugin_slugs("elibrary") == {"elibrary", "digital_content"}
    assert _acceptable_plugin_slugs("library_management") == {
        "library_management",
        "library",
    }
    # portfolio is the deprecated duplicate of student_portfolio (E14):
    # single-hop rename resolves in both directions.
    assert _acceptable_plugin_slugs("portfolio") == {
        "portfolio",
        "student_portfolio",
    }
    assert _acceptable_plugin_slugs("student_portfolio") == {
        "student_portfolio",
        "portfolio",
    }


def test_legacy_portfolio_install_passes_canonical_gate(client, db, school, admin_user):
    """A legacy `portfolio` install must still satisfy the canonical
    student_portfolio gate (E14 split-brain reconciliation)."""
    db.session.add(
        Plugin(
            slug="portfolio",
            name="Student Portfolio",
            category="growth",
            is_free=False,
            is_published=False,
        )
    )
    db.session.add(
        SchoolPlugin(
            school_id=school.id,
            plugin_slug="portfolio",
            active=True,
        )
    )
    db.session.commit()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.get(
        "/api/v1/portfolio/students/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )

    assert resp.status_code == 200
    assert resp.get_json()["success"] is True


def test_design_studio_gate_rejects_elibrary_only_installs(client, db, school, admin_user):
    """An elibrary (or digital_content) install must NOT unlock
    design_studio-gated routes (E3 alias-leak regression)."""
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

    assert resp.status_code == 403
    data = resp.get_json()
    assert data["success"] is False
    assert "not installed" in data["error"]
