"""Wave R P0 regression tests (2026-09-08 plan, audits/PLAN_2026-09-08.md).

R3 — student roster/credential leak: /students is staff-only and the
deterministic default password never serializes; admins reveal it explicitly.
R4 — tenant gate: fail-closed on missing user rows, NULL-school tenant users
denied, and a non-UUID school_id claim no longer 500s school resolution.
"""
import uuid

import pytest
from flask_jwt_extended import create_access_token

from tests.conftest import get_auth_headers


@pytest.fixture()
def student_with_login(db, school):
    """A student row with a linked login (the credential-carrying case)."""
    from app.models.student import Student
    from app.models.user import User

    u = User(
        school_id=school.id,
        role="student",
        full_name="Bikash Shrestha",
        phone="+9779841000077",
        is_active=True,
    )
    u.set_password("RealPW@123")
    db.session.add(u)
    db.session.flush()
    s = Student(
        school_id=school.id,
        user_id=u.id,
        first_name="Bikash",
        last_name="Shrestha",
    )
    db.session.add(s)
    db.session.commit()
    return u, s


class TestStudentCredentialLeak:
    def test_student_token_cannot_list_roster(self, client, db, school, student_with_login):
        user, _ = student_with_login
        r = client.get("/api/v1/students", headers=get_auth_headers(client, user.phone, "RealPW@123"))
        assert r.status_code == 403, r.get_json()

    def test_student_token_cannot_read_detail(self, client, db, school, student_with_login, admin_user):
        user, student = student_with_login
        # another student's detail is equally off-limits; use admin to create a peer
        r = client.get(
            f"/api/v1/students/{student.id}",
            headers=get_auth_headers(client, user.phone, "RealPW@123"),
        )
        assert r.status_code == 403, r.get_json()

    def test_to_dict_carries_no_credential(self, db, school, student_with_login):
        _, student = student_with_login
        data = student.to_dict()
        assert "default_password_hint" not in data
        blob = str(data)
        from app.utils.password import generate_default_password

        assert generate_default_password(student.user, student) not in blob

    def test_admin_can_reveal_default_password(self, client, db, school, student_with_login, admin_user):
        _, student = student_with_login
        r = client.post(
            f"/api/v1/students/{student.id}/reveal-default-password",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 200, r.get_json()
        body = r.get_json()["data"]
        assert body["default_password"]
        assert body["login_id"]

    def test_reveal_denied_to_teacher(self, client, db, school, student_with_login):
        from app.models.user import User

        user, student = student_with_login
        t = User(
            school_id=school.id,
            role="teacher",
            full_name="Teacher Rai",
            email="teacher.rai@test.edu.np",
            phone="+9779841000088",
            is_active=True,
        )
        t.set_password("Test@1234")
        db.session.add(t)
        db.session.commit()
        r = client.post(
            f"/api/v1/students/{student.id}/reveal-default-password",
            headers=get_auth_headers(client, t.email, "Test@1234"),
        )
        assert r.status_code == 403, r.get_json()


class TestTenantGate:
    def _headers_for_claims(self, app, user_id, role, school_id_claim=None, school_slug=None):
        with app.app_context():
            claims = {"role": role}
            if school_id_claim is not None:
                claims["school_id"] = school_id_claim
            token = create_access_token(identity=str(user_id), additional_claims=claims)
        headers = {"Authorization": f"Bearer {token}"}
        if school_slug:
            headers["X-School-Slug"] = school_slug
        return headers

    def test_live_token_with_missing_user_row_denied(self, client, app, db, school):
        """B2 fail-closed: a signed JWT for a deleted/unknown user must not
        bind a school context just because its signature verifies."""
        headers = self._headers_for_claims(
            app, uuid.uuid4(), "school_admin", school_slug=school.slug
        )
        r = client.get("/api/v1/students", headers=headers)
        assert r.status_code in (401, 403), r.get_json()
        assert r.status_code != 200

    def test_non_uuid_school_claim_does_not_500(self, client, app, db, school, admin_user):
        """The ledger triage 500 (`invalid input syntax for type uuid:
        "reports"`) — a bogus school_id claim skips resolution instead."""
        headers = self._headers_for_claims(
            app, admin_user.id, "school_admin",
            school_id_claim="reports", school_slug=school.slug,
        )
        r = client.get("/api/v1/students", headers=headers)
        assert r.status_code != 500, r.get_json()
        assert r.status_code == 200  # school came from the slug, role check passes

    def test_valid_slug_login_still_works(self, client, db, school, admin_user):
        r = client.get(
            "/api/v1/students",
            headers=get_auth_headers(client, admin_user.email, "Test@1234"),
        )
        assert r.status_code == 200, r.get_json()
