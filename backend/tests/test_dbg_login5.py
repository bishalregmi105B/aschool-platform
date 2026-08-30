def test_login_sanity(client, db, school, admin_user):
    from tests.conftest import get_auth_headers
    from app.models.user import User
    from extensions import db
    u = User.query.filter_by(email="admin@test.edu.np").first()
    print("USER:", u.id if u else None, u.is_active if u else None, flush=True)
    resp = client.post("/api/v1/auth/login", json={"email": "admin@test.edu.np", "password": "Test@1234"})
    print("LOGIN RESP:", resp.status_code, resp.get_json(), flush=True)
    assert resp.status_code == 200
