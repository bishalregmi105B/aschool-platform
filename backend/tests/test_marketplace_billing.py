"""Tests for marketplace trial / subscribe endpoints and stub delisting."""
from app.models.plugin import Plugin, SchoolPlugin
from tests.conftest import get_auth_headers


def _seed_plugin(db, slug="lms", **kwargs):
    defaults = dict(
        slug=slug,
        name=slug.replace("_", " ").title(),
        category="growth",
        price_monthly=499,
        price_yearly=4990,
        is_free=False,
        is_published=True,
        version="1.0.0",
    )
    defaults.update(kwargs)
    plugin = Plugin(**defaults)
    db.session.add(plugin)
    db.session.commit()
    return plugin


def _admin(client, db, school):
    from app.models.user import User

    u = User(
        school_id=school.id,
        role="school_admin",
        full_name="Market Admin",
        email=f"market-{school.slug}@test.edu.np",
        phone="+9779841000051",
        is_active=True,
        phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()
    return get_auth_headers(client, u.email, "Test@1234")


def test_trial_then_subscribe_flow(client, db, school):
    headers = _admin(client, db, school)
    _seed_plugin(db)

    trial = client.post("/api/v1/plugins/lms/trial", headers=headers)
    assert trial.status_code == 201
    body = trial.get_json()["data"]
    assert body["is_trial"] is True

    # Second trial must be refused.
    again = client.post("/api/v1/plugins/lms/trial", headers=headers)
    assert again.status_code == 409

    # E5: without payment proof the activation must be refused (402) and the
    # install must stay a trial — never silently marked paid.
    sub = client.post(
        "/api/v1/plugins/lms/subscribe",
        json={"billing_cycle": "yearly"},
        headers=headers,
    )
    assert sub.status_code == 402
    sp = SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug="lms").one()
    assert sp.is_trial is True

    # With a payment reference the subscription activates.
    sub = client.post(
        "/api/v1/plugins/lms/subscribe",
        json={
            "billing_cycle": "yearly",
            "payment": {"provider": "stripe", "transaction_id": "pi_test_123"},
        },
        headers=headers,
    )
    assert sub.status_code == 200
    data = sub.get_json()["data"]
    assert data["is_trial"] is False
    assert data["billing_cycle"] == "yearly"
    assert data["payment_provider"] == "stripe"

    sp = SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug="lms").one()
    assert sp.is_trial is False


def test_unpublished_stub_plugins_cannot_be_installed(client, db, school):
    """multi_branch/biometric were the original 'unimplemented stub' probes;
    both are REAL published plugins today (E234 premium band, NPR 299), so
    the delisting half of this test now uses withdrawn/unpublished slugs.
    E230 (2026-08-31): social_hub is withdrawn from the catalog and ai_grading
    is folded into the ai_suite bundle — manifests say published: false, and
    the registry-backed marketplace must not offer them even if a stale
    mirror row exists."""
    headers = _admin(client, db, school)
    _seed_plugin(db, slug="social_hub", name="Social Media Hub", is_published=False)
    _seed_plugin(db, slug="ai_grading", name="AI Grading", is_published=False)

    for slug in ("social_hub", "ai_grading"):
        resp = client.post(
            "/api/v1/plugins/install",
            json={"plugin_slug": slug},
            headers=headers,
        )
        assert resp.status_code in (400, 404), f"{slug} install should fail"

        market = client.get("/api/v1/plugins/marketplace", headers=headers)
        slugs = {p["slug"] for p in market.get_json()["data"]}
        assert slug not in slugs


def test_trial_on_unknown_plugin_404(client, db, school):
    headers = _admin(client, db, school)
    resp = client.post("/api/v1/plugins/does_not_exist/trial", headers=headers)
    assert resp.status_code == 404
