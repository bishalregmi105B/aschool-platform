"""Cross-tenant isolation regression tests for Hostel and FAQ endpoints.

These models don't inherit SchoolModel (they predate it) but their columns
and routes must still enforce tenant isolation — these tests pin that.
"""
from app.models.faq import FAQ
from app.models.hostel import Hostel
from app.models.user import User
from tests.conftest import get_auth_headers


def _admin(client, db, school, suffix):
    u = User(
        school_id=school.id,
        role="school_admin",
        full_name=f"Admin {suffix}",
        email=f"{suffix}-{school.slug}@test.edu.np",
        phone=f"+9779841000{60 + len(suffix) % 30}",
        is_active=True,
        phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()

    resp = client.post("/api/v1/auth/login", json={"email": u.email, "password": "Test@1234"})
    assert resp.status_code == 200, f"login failed for {u.email}: {resp.get_json()}"
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _second_school(db):
    from app.models.school import School

    beta = School(
        name="Beta Isolation Academy",
        slug="beta-isolation",
        plan="growth",
        status="active",
        is_active=True,
        phone="+9779800000099",
    )
    db.session.add(beta)
    db.session.commit()
    return beta


def _hostel(db, school):
    h = Hostel(
        school_id=school.id,
        name="Alpha Bhavan",
        type="boys",
        total_capacity=50,
    )
    db.session.add(h)
    db.session.commit()
    return h


def test_hostel_of_other_school_not_readable(client, db, school):
    from app.models.school import School

    beta = School.query.filter_by(slug="beta-isolation").first() or _second_school(db)
    hostel = _hostel(db, school)

    beta_headers = _admin(client, db, beta, "beta")

    # Cross-tenant mutation attempts must not resolve the resource.
    put = client.put(
        f"/api/v1/hostel/{hostel.id}",
        json={"name": "Hacked Hostel"},
        headers=beta_headers,
    )
    assert put.status_code == 404

    delete = client.delete(f"/api/v1/hostel/{hostel.id}", headers=beta_headers)
    assert delete.status_code == 404

    # Owner school still sees it in its scoped list.
    own_headers = _admin(client, db, school, "alpha")
    ok = client.get("/api/v1/hostel", headers=own_headers)
    names = [h.get("name") for h in ok.get_json()["data"]]
    assert "Alpha Bhavan" in names


def test_hostel_list_scoped_to_own_school(client, db, school):
    from app.models.school import School

    beta = School.query.filter_by(slug="beta-isolation").first() or _second_school(db)
    _hostel(db, school)  # belongs to alpha

    beta_headers = _admin(client, db, beta, "beta")
    resp = client.get("/api/v1/hostel", headers=beta_headers)
    names = [h.get("name") for h in resp.get_json()["data"]]
    assert "Alpha Bhavan" not in names


def test_faq_of_other_school_not_modifiable(client, db, school):
    from app.models.school import School

    beta = School.query.filter_by(slug="beta-isolation").first() or _second_school(db)
    faq = FAQ(
        school_id=school.id,
        question="What are the school hours?",
        answer="10 AM - 4 PM",
    )
    db.session.add(faq)
    db.session.commit()

    beta_headers = _admin(client, db, beta, "beta")

    update = client.put(
        f"/api/v1/faqs/{faq.id}", json={"answer": "hacked"}, headers=beta_headers
    )
    assert update.status_code == 404

    delete = client.delete(f"/api/v1/faqs/{faq.id}", headers=beta_headers)
    assert delete.status_code == 404
