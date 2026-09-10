"""FC Sprint-0 regression tests — endpoints added to clear the exploration
defect backlog (docs/MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md, Part 2):

- B-05  GET /teacher/portfolios   (teacher app screen 404'd in production)
- B-07  GET /student/classmates   (app leaked the whole roster via /students)
- B-09  GET /dismissal/summary    (admin app overview tab 404'd)
- B-04  GET /parent/fees/summary  (mobile fee card widget fetched a dead path)
- B-11  GET /website/public/<slug>/news[/<article>] (public news pages 404'd)

Widget spec fixes (B-01/B-02) are guarded in test_plugin_widgets.py.
"""
from datetime import datetime, timedelta

import pytest

from app.models.academic import Class, Section
from app.models.dismissal import DismissalRecord
from app.models.fee import FeeCollection
from app.models.student import Guardian
from app.models.notice import Notice
from app.models.plugin import Plugin, SchoolPlugin
from app.models.portfolio import PortfolioItem, StudentPortfolio
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


@pytest.fixture
def admin_headers(client, db, school, admin_user):
    return get_auth_headers(client, "admin@test.edu.np", "Test@1234")


def _install(db, school, *slugs):
    for slug in slugs:
        if not Plugin.query.filter_by(slug=slug).first():
            db.session.add(Plugin(
                slug=slug, name=slug.replace("_", " ").title(),
                category="growth", is_free=True, is_published=True,
            ))
        if not SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug=slug).first():
            db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True))
    db.session.commit()


def _student(db, school, first, last, klass=None, section=None):
    u = User(
        school_id=school.id, role="student", full_name=f"{first} {last}",
        email=f"{first.lower()}.{last.lower()}.{datetime.utcnow().timestamp()}"
              f"{id(klass) % 9999}@test.edu.np",
        phone=f"+977984{abs(hash(first + last)) % 10**7:07d}",
        is_active=True,
    )
    db.session.add(u)
    db.session.flush()
    s = Student(
        school_id=school.id, user_id=u.id, first_name=first, last_name=last,
        status="active", class_id=klass.id if klass else None,
        section_id=section.id if section else None,
    )
    db.session.add(s)
    db.session.commit()
    return s


def _class_section(db, school, name="Grade 10", section_name="A"):
    klass = Class(school_id=school.id, name=name)
    db.session.add(klass)
    db.session.flush()
    sec = Section(school_id=school.id, class_id=klass.id, name=section_name)
    db.session.add(sec)
    db.session.commit()
    return klass, sec


def _login(client, user):
    from extensions import db

    if not user.password_hash:
        user.set_password("Test@1234")
        db.session.commit()
    resp = client.post("/api/v1/auth/login", json={"email": user.email, "password": "Test@1234"})
    if resp.status_code != 200:
        resp = client.post("/api/v1/auth/login", json={"phone": user.phone, "password": "Test@1234"})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["data"]["access_token"]


# ── B-07: student classmates ─────────────────────────────────────────────────

def test_student_classmates_scoped_to_own_class(client, db, school):
    klass, sec = _class_section(db, school)
    other_klass, _ = _class_section(db, school, name="Grade 9", section_name="A")

    me = _student(db, school, "Class", "Mate", klass=klass, section=sec)
    mate1 = _student(db, school, "Anisha", "Rai", klass=klass, section=sec)
    _student(db, school, "Bibek", "Shrestha", klass=klass, section=sec)
    _student(db, school, "Outsider", "Student", klass=other_klass, section=None)

    token = _login(client, me.user)
    resp = client.get(
        "/api/v1/student/classmates",
        headers={"Authorization": f"Bearer {token}", "X-School-Slug": school.slug},
    )
    assert resp.status_code == 200
    rows = resp.get_json()["data"]
    names = {r["name"] for r in rows}
    assert names == {"Anisha Rai", "Bibek Shrestha", "Class Mate"}
    me_row = next(r for r in rows if r["name"] == "Class Mate")
    assert me_row["is_me"] is True


# ── B-05: teacher portfolios ─────────────────────────────────────────────────

def test_teacher_portfolios_scoped_to_own_classes(client, db, school, teacher_user):
    _install(db, school, "student_portfolio")
    klass, sec = _class_section(db, school)
    other_klass, _ = _class_section(db, school, name="Grade 8", section_name="B")
    sec.class_teacher_id = teacher_user.id
    db.session.commit()

    mine = _student(db, school, "Portfolio", "Owner", klass=klass, section=sec)
    other = _student(db, school, "Hidden", "Student", klass=other_klass, section=None)

    p1 = StudentPortfolio(school_id=school.id, student_id=mine.id, bio="art and code")
    p2 = StudentPortfolio(school_id=school.id, student_id=other.id, bio="must not leak")
    db.session.add_all([p1, p2])
    db.session.flush()
    db.session.add(PortfolioItem(
        school_id=school.id, portfolio_id=p1.id, title="Science fair project",
        item_type="project",
    ))
    db.session.commit()

    token = _login(client, teacher_user)
    resp = client.get(
        "/api/v1/teacher/portfolios",
        headers={"Authorization": f"Bearer {token}", "X-School-Slug": school.slug},
    )
    assert resp.status_code == 200
    rows = resp.get_json()["data"]
    ids = {r["student_id"] for r in rows}
    assert str(mine.id) in ids
    assert str(other.id) not in ids
    row = next(r for r in rows if r["student_id"] == str(mine.id))
    assert row["item_count"] == 1
    assert row["student_name"] == "Portfolio Owner"


# ── B-04: parent fees summary ────────────────────────────────────────────────

def test_parent_fees_summary_totals(client, db, school, admin_user):
    _install(db, school, "fees")
    klass, _ = _class_section(db, school)
    s = _student(db, school, "Fee", "Child", klass=klass, section=None)

    parent = User(
        school_id=school.id, role="parent", full_name="Fee Guardian",
        email=f"guardian.{datetime.utcnow().timestamp()}@test.edu.np",
        phone="+9779851111111", is_active=True,
    )
    parent.set_password("Test@1234")
    db.session.add(parent)
    db.session.flush()
    db.session.add(Guardian(
        school_id=school.id, student_id=s.id, user_id=parent.id,
        relation="mother", full_name="Fee Guardian",
    ))
    # unpaid 1000, partial 800/200-paid, settled 500 → due 1600, paid 700
    db.session.add(FeeCollection(
        school_id=school.id, student_id=s.id, fee_item_name="Monthly",
        amount=1000, payment_status="pending",
    ))
    db.session.add(FeeCollection(
        school_id=school.id, student_id=s.id, fee_item_name="Terminal",
        amount=800, payment_status="partial", notes="[partial_paid:200]",
    ))
    db.session.add(FeeCollection(
        school_id=school.id, student_id=s.id, fee_item_name="Annual",
        amount=500, payment_status="paid", notes="[partial_paid:500]",
    ))
    db.session.commit()

    token = _login(client, parent)
    resp = client.get(
        "/api/v1/parent/fees/summary",
        headers={"Authorization": f"Bearer {token}", "X-School-Slug": school.slug},
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["total_due"] == 1600
    assert data["outstanding_count"] == 2
    assert data["total_paid"] == 700
    assert data["ward_count"] == 1


# ── B-09: dismissal summary ──────────────────────────────────────────────────

def test_dismissal_summary_counts(client, db, school, admin_headers):
    _install(db, school, "dismissal")
    klass, _ = _class_section(db, school)
    s1 = _student(db, school, "Gone", "Home", klass=klass, section=None)
    s2 = _student(db, school, "Still", "Here", klass=klass, section=None)

    db.session.add(DismissalRecord(
        school_id=school.id, student_id=s1.id,
        picked_up_by="Mother", dismissed_at=datetime.utcnow(),
        qr_verified=True,
    ))
    db.session.commit()

    resp = client.get("/api/v1/dismissal/summary", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["dismissed_today"] == 1
    assert data["pending"] == data["total_enrolled"] - 1
    row = next(c for c in data["class_breakdown"] if c["class_id"] == str(klass.id))
    assert row["dismissed"] == 1 and row["total"] == 2


# ── B-11: public news feed ───────────────────────────────────────────────────

def test_public_news_feed_and_article(client, db, school):
    published = Notice(
        school_id=school.id, title="Sports Week 2082", content="<p>Annual sports week.</p>",
        notice_type="general", published_at=datetime.utcnow() - timedelta(days=1),
    )
    draft = Notice(
        school_id=school.id, title="Internal memo", content="not for the public",
        notice_type="general", published_at=None,
    )
    db.session.add_all([published, draft])
    db.session.commit()

    resp = client.get(f"/api/v1/website/public/{school.slug}/news")
    assert resp.status_code == 200
    articles = resp.get_json()["data"]["articles"]
    titles = [a["title"] for a in articles]
    assert "Sports Week 2082" in titles
    assert "Internal memo" not in titles
    art = next(a for a in articles if a["title"] == "Sports Week 2082")
    assert art["slug"] == str(published.id)
    assert "Annual sports week" in art["excerpt"]

    resp = client.get(f"/api/v1/website/public/{school.slug}/news/{published.id}")
    assert resp.status_code == 200
    assert resp.get_json()["data"]["title"] == "Sports Week 2082"

    # drafts and garbage slugs must 404, never leak
    resp = client.get(f"/api/v1/website/public/{school.slug}/news/{draft.id}")
    assert resp.status_code == 404
    resp = client.get(f"/api/v1/website/public/{school.slug}/news/not-a-slug")
    assert resp.status_code == 404


# ── B-05 companion: admin login headers fixture reused cleanly ───────────────

def test_admin_sees_all_portfolios(client, db, school, admin_headers, admin_user):
    """Admins bypass the class-teacher scope and see the whole school."""
    _install(db, school, "student_portfolio")
    klass, _ = _class_section(db, school)
    s = _student(db, school, "Anyone", "Enrolled", klass=klass, section=None)
    db.session.add(StudentPortfolio(school_id=school.id, student_id=s.id))
    db.session.commit()

    resp = client.get("/api/v1/teacher/portfolios", headers=get_auth_headers(
        client, admin_user.email, "Test@1234"))
    assert resp.status_code == 200
    ids = {r["student_id"] for r in resp.get_json()["data"]}
    assert str(s.id) in ids
