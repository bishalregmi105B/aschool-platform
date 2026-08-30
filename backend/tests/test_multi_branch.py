"""Tests for the multi_branch plugin API (chain registry + analytics)."""
import pytest

from app.models.fee import FeeCollection
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.school_chain import SchoolChain, SchoolChainMember
from app.models.student import Student
from app.models.user import User
from extensions import db
from tests.conftest import get_auth_headers


def _install_plugin(school_id):
    if not Plugin.query.filter_by(slug="multi_branch").first():
        db.session.add(
            Plugin(
                slug="multi_branch",
                name="Multi-Branch Chain",
                category="premium",
                price_monthly=2999,
                price_yearly=29999,
                is_free=False,
                is_published=True,
            )
        )
        db.session.flush()
    db.session.add(
        SchoolPlugin(
            school_id=school_id, plugin_slug="multi_branch", active=True, is_trial=False
        )
    )
    db.session.commit()


def _make_chain(db, school, name="Test Chain"):
    chain = SchoolChain(school_id=school.id, name=name)
    db.session.add(chain)
    db.session.commit()
    return chain


def _make_branch(db, chain, name, code, n_students=0, n_staff=0, paid_total=0):
    branch = School(
        name=name, slug=f"{code.lower()}-branch", plan="free", status="active",
        is_active=True,
    )
    db.session.add(branch)
    db.session.flush()
    db.session.add(
        SchoolChainMember(school_id=branch.id, chain_id=chain.id, code=code)
    )
    studs = []
    for i in range(n_students):
        st = Student(
            first_name=f"S{i}", last_name=name[:5], school_id=branch.id,
            status="active",
        )
        db.session.add(st)
        studs.append(st)
    db.session.flush()
    for i in range(n_staff):
        db.session.add(
            User(school_id=branch.id, role="teacher", full_name=f"T{i}{code}",
                 phone=f"+97798{code.replace('-', '')[:4]}000{i}", is_active=True)
        )
    if paid_total and studs:
        db.session.add(
            FeeCollection(
                school_id=branch.id,
                student_id=studs[0].id,
                amount=paid_total,
                payment_status="paid",
            )
        )
    db.session.commit()
    return branch


@pytest.fixture
def chain_school_admin(db, school, admin_user):
    """School with the multi_branch plugin installed + its admin."""
    _install_plugin(school.id)
    return school, admin_user


def test_overview_aggregates_match_db(client, db, chain_school_admin):
    """Per-branch student/staff counts and fee totals are real aggregates."""
    school, admin_user = chain_school_admin
    chain = _make_chain(db, school)
    _make_branch(db, chain, "Branch One", "B1", n_students=4, n_staff=2)
    _make_branch(db, chain, "Branch Two", "B2", n_students=2, n_staff=1)

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.get("/api/v1/schools/chain/overview", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]

    assert data["stats"]["total_branches"] == 2
    assert data["stats"]["total_students"] == 6
    assert data["stats"]["total_staff"] == 3
    by_code = {b["code"]: b for b in data["branches"]}
    assert by_code["B1"]["student_count"] == 4
    assert by_code["B2"]["student_count"] == 2


def test_overview_requires_chain_ownership(client, db, school, admin_user):
    """A school with the plugin but no chain gets 403 on chain endpoints."""
    _install_plugin(school.id)
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.get("/api/v1/schools/chain/overview", headers=headers)
    assert resp.status_code == 403


def test_branch_list_empty_for_non_chain_school(client, db, school, admin_user):
    _install_plugin(school.id)
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.get("/api/v1/schools/branches", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["data"]["items"] == []


def test_plugin_gate_blocks_all_routes(client, db, school, admin_user):
    """Without the multi_branch install every route returns 403."""
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    for path in ("/api/v1/schools/chain/overview", "/api/v1/schools/branches"):
        resp = client.get(path, headers=headers)
        assert resp.status_code == 403


def test_create_branch_creates_school_tenant_and_member(client, db, chain_school_admin):
    school, admin_user = chain_school_admin
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.post(
        "/api/v1/schools/branches",
        json={"name": "New Branch", "code": "NB1", "address": "Bhaktahpur",
              "principal_name": "P. Rai", "phone": "+9779800000111"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.get_json()["data"]
    assert data["code"] == "NB1"

    # A real School tenant was created and linked into a chain
    tenant = School.query.filter_by(name="New Branch").one()
    assert tenant.slug.startswith("nb1")
    member = SchoolChainMember.query.filter_by(school_id=tenant.id).one()
    chain = SchoolChain.query.get(member.chain_id)
    assert chain.school_id == school.id

    # Registry lists it
    resp = client.get("/api/v1/schools/branches", headers=headers)
    items = resp.get_json()["data"]["items"]
    assert [m["code"] for m in items] == ["NB1"]


def test_create_branch_duplicate_code_rejected(client, db, chain_school_admin):
    school, admin_user = chain_school_admin
    chain = _make_chain(db, school)
    _make_branch(db, chain, "Existing", "DUP")
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.post(
        "/api/v1/schools/branches", json={"name": "Other", "code": "DUP"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_link_existing_school_as_branch(client, db, chain_school_admin):
    school, admin_user = chain_school_admin
    headers = get_auth_headers(client, admin_user.email, "Test@1234")

    other = School(name="Standalone", slug="standalone-x", plan="free",
                   status="active", is_active=True)
    db.session.add(other)
    db.session.commit()

    resp = client.post(
        "/api/v1/schools/branches", json={"school_id": str(other.id)},
        headers=headers,
    )
    assert resp.status_code == 201

    # Owner school cannot be linked to itself
    resp = client.post(
        "/api/v1/schools/branches", json={"school_id": str(school.id)},
        headers=headers,
    )
    assert resp.status_code == 400


def test_branch_management_is_chain_owner_only(client, db, chain_school_admin):
    """Another school's admin cannot read or mutate someone else's chain."""
    school, admin_user = chain_school_admin
    chain = _make_chain(db, school)
    branch = _make_branch(db, chain, "Owned Branch", "OWN")
    member = SchoolChainMember.query.filter_by(school_id=branch.id).one()

    # Second school with the plugin but its own (empty) chain scope
    other = School(name="Other Academy", slug="other-academy-x", plan="growth",
                   status="active", is_active=True)
    db.session.add(other)
    db.session.flush()  # assign other.id before linking the admin user
    other_admin = User(school_id=other.id, role="school_admin", full_name="Other Admin",
                       email="other-x@test.edu.np", phone="+9779800000222",
                       is_active=True)
    other_admin.set_password("Test@1234")
    db.session.add(other_admin)
    db.session.commit()
    _install_plugin(other.id)

    headers = get_auth_headers(client, "other-x@test.edu.np", "Test@1234")
    # The other admin's JWT points at their own school; member ops must 403/404
    resp = client.patch(f"/api/v1/schools/branches/{member.id}",
                        json={"code": "HACK"}, headers=headers)
    assert resp.status_code in (403, 404), resp.get_json()
    resp = client.delete(f"/api/v1/schools/branches/{member.id}", headers=headers)
    assert resp.status_code in (403, 404), resp.get_json()


def test_delete_branch_unlinks_but_preserves_tenant(client, db, chain_school_admin):
    school, admin_user = chain_school_admin
    chain = _make_chain(db, school)
    branch = _make_branch(db, chain, "Doomed Branch", "DEL")
    member = SchoolChainMember.query.filter_by(school_id=branch.id).one()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.delete(f"/api/v1/schools/branches/{member.id}", headers=headers)
    assert resp.status_code == 200

    db.session.expire_all()
    assert SchoolChainMember.query.get(member.id).is_deleted is True
    assert School.query.get(branch.id).is_deleted is False


def test_analytics_periods_and_rankings(client, db, chain_school_admin):
    school, admin_user = chain_school_admin
    chain = _make_chain(db, school)
    _make_branch(db, chain, "Rank A", "RA", n_students=3)
    _make_branch(db, chain, "Rank B", "RB", n_students=1)

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    resp = client.get("/api/v1/schools/chain/analytics?period=this_month",
                      headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["period"] == "this_month"
    assert len(data["metrics"]) == 3
    scores = [r["score"] for r in data["branch_rankings"]]
    assert len(scores) == 2

    resp = client.get("/api/v1/schools/chain/analytics?period=bogus",
                      headers=headers)
    assert resp.status_code == 400
