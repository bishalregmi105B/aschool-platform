"""S-08: rate limiting on credential, AI, and public-form surfaces.

- /auth/login: 6th attempt within a minute from one IP → 429.
- public website forms: 6th request/hour for one (school, IP) → 429.
- AI generation routes: 21st request/hour per (school, user) → 429.
"""
import pytest

from app.models.plugin import Plugin, SchoolPlugin
from extensions import db as _db
from tests.conftest import get_auth_headers


class TestLoginRateLimit:
    def test_sixth_login_attempt_is_429(self, client, school):
        body = {"email": "ghost@test.edu.np", "password": "wrong-password"}
        for _ in range(5):
            r = client.post("/api/v1/auth/login", json=body)
            assert r.status_code == 401  # bad credentials, still counted
        r = client.post("/api/v1/auth/login", json=body)
        assert r.status_code == 429


class TestPublicFormRateLimit:
    def test_sixth_result_check_is_429(self, client, school):
        url = f"/api/v1/website/public/{school.slug}/results?symbol_no=X&dob=2060-01-01"
        codes = [client.get(url).status_code for _ in range(6)]
        assert codes[-1] == 429
        assert codes[:5] != [429] * 5

    def test_contact_form_rate_limited(self, client, school):
        url = f"/api/v1/website/public/{school.slug}/contact"
        for i in range(5):
            r = client.post(
                url,
                json={"name": f"Spammer {i}", "phone": "9812345678",
                      "message": "spam"},
            )
            assert r.status_code in (200, 201, 400)
        r = client.post(url, json={"name": "Spam", "phone": "9812345678", "message": "spam"})
        assert r.status_code == 429


@pytest.fixture
def ai_admin(client, db, school, admin_user):
    p = Plugin.query.filter_by(slug="ai_tools").first()
    if not p:
        p = Plugin(
            slug="ai_tools", name="AI Tools", category="premium",
            is_free=True, is_published=True, version="1.0.0", emoji="🤖",
        )
        _db.session.add(p)
    _db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="ai_tools", active=True, is_trial=False)
    )
    _db.session.commit()
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


class TestAIRateLimit:
    def test_21st_ai_request_is_429(self, client, school, ai_admin):
        url = "/api/v1/ai-tools/insights/risk-alerts"
        codes = [client.get(url, headers=ai_admin).status_code for _ in range(21)]
        assert codes[0] == 200, f"first call should succeed: {codes[0]}"
        assert codes[-1] == 429
