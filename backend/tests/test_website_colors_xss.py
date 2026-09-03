"""S-11: customizations.colors cannot carry a </style><script> payload.

The public site layout interpolates colors into a <style> block; the write
path must allowlist keys and reject non-color values.
"""
import pytest

from app.api.v1.website import sanitize_colors
from app.services.website.theme_engine import ThemeEngineService, _is_safe_color
from tests.conftest import get_auth_headers


class TestSanitizeColors:
    def test_style_escape_payload_dropped(self):
        payload = {
            "primary": "</style><script>alert(1)</script>",
            "secondary": "#1e3a8a",
        }
        clean = sanitize_colors(payload)
        assert clean == {"secondary": "#1e3a8a"}

    def test_unknown_keys_dropped(self):
        clean = sanitize_colors({"surface": "#f5f5f5", "evil_key": "red"})
        assert clean == {"surface": "#f5f5f5"}

    def test_hex_and_color_words_accepted(self):
        clean = sanitize_colors(
            {"primary": "#ff0000", "secondary": "#aabbccdd", "text": "black"}
        )
        assert clean == {"primary": "#ff0000", "secondary": "#aabbccdd", "text": "black"}

    def test_junk_values_dropped(self):
        clean = sanitize_colors(
            {"primary": "url(javascript:alert(1))", "bg": "not a color!!"}
        )
        assert clean == {}

    def test_non_dict_input(self):
        assert sanitize_colors(None) == {}
        assert sanitize_colors("red") == {}


class TestThemeEngineColors:
    def test_is_safe_color(self):
        assert _is_safe_color("#fff")
        assert _is_safe_color("#1e3a8a")
        assert _is_safe_color("black")
        assert not _is_safe_color("</style>x")
        assert not _is_safe_color("red;")
        assert not _is_safe_color(123)

    def test_synced_colors_filters_malicious_overrides(self):
        result = ThemeEngineService.synced_colors(
            None,
            ThemeEngineService.DEFAULT_THEME_ID,
            color_overrides={"primary": "</style><script>"},
        )
        # theme default survives; the payload is gone
        assert "<script>" not in (result or {}).get("primary", "")

    def test_synced_colors_filters_existing_colors(self):
        theme_id = ThemeEngineService.DEFAULT_THEME_ID
        existing = {"surface": "</style><script>x</script>", "primary": "#123456"}
        result = ThemeEngineService.synced_colors(existing, theme_id)
        assert (result or {}).get("surface") is None


class TestWebsiteConfigWrite:
    def test_put_config_rejects_color_payload(
        self, client, db, school, admin_user
    ):
        from app.models.plugin import Plugin, SchoolPlugin

        p = Plugin.query.filter_by(slug="basic_website").first()
        if not p:
            p = Plugin(
                slug="basic_website", name="Basic Website", category="core",
                is_free=True, is_published=True, version="1.0.0", emoji="🌐",
            )
            db.session.add(p)
        db.session.add(
            SchoolPlugin(school_id=school.id, plugin_slug="basic_website", active=True, is_trial=False)
        )
        db.session.commit()

        headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        resp = client.put(
            "/api/v1/website/config",
            json={
                "customizations": {
                    "colors": {
                        "primary": "</style><script>alert(document.cookie)</script>",
                        "bg": "#f8fafc",
                    }
                }
            },
            headers=headers,
        )
        assert resp.status_code == 200, resp.get_json()

        from app.models.school import SchoolWebsite

        website = SchoolWebsite.query.filter_by(school_id=school.id).first()
        stored = website.customizations.get("colors", {})
        assert "<script>" not in str(stored)
        assert stored.get("bg") == "#f8fafc"
