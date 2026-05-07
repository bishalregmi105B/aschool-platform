"""Pytest configuration and shared fixtures for ASchool backend tests."""
import uuid

import pytest
from sqlalchemy import text

from app import create_app
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.user import User
from extensions import db as _db


@pytest.fixture(scope="session")
def app():
    """Create application for testing."""
    app = create_app("testing")
    with app.app_context():
        _reset_database()
        yield app
        _reset_database()


@pytest.fixture(scope="function")
def db(app):
    """Fresh database for each test."""
    with app.app_context():
        _reset_database()
        yield _db
        _db.session.remove()


@pytest.fixture
def client(app, db):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def school(db):
    """Create a test school."""
    s = School(
        name="Test Academy",
        slug="test-academy",
        plan="growth",
        status="active",
        is_active=True,
        phone="+9779800000001",
        email="admin@test.edu.np",
        province="Bagmati",
        district="Kathmandu",
        municipality="Kathmandu Metropolitan City",
        default_language="ne",
    )
    db.session.add(s)
    db.session.commit()
    return s


@pytest.fixture
def admin_user(db, school):
    """Create a school_admin user."""
    u = User(
        school_id=school.id,
        role="school_admin",
        full_name="Admin Sharma",
        phone="+9779841000001",
        email="admin@test.edu.np",
        is_active=True,
        phone_verified=True,
    )
    u.set_password("Test@1234")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def teacher_user(db, school):
    """Create a teacher user."""
    u = User(
        school_id=school.id,
        role="teacher",
        full_name="Teacher Gurung",
        phone="+9779841000002",
        is_active=True,
        phone_verified=True,
    )
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def student_user(db, school):
    """Create a student user."""
    u = User(
        school_id=school.id,
        role="student",
        full_name="Student Tamang",
        phone="+9779841000003",
        is_active=True,
    )
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def superadmin_user(db):
    """Create a platform superadmin user."""
    u = User(
        role="superadmin",
        full_name="Super Admin",
        phone="+9779800000000",
        email="super@aschool.com.np",
        is_active=True,
        phone_verified=True,
    )
    u.set_password("SuperSecret@1")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def sample_plugin(db):
    """Create a sample published plugin."""
    p = Plugin(
        slug="attendance",
        name="Attendance Management",
        category="core",
        price_monthly=0,
        price_yearly=0,
        is_free=True,
        emoji="✅",
        icon="UserCheck",
        description="Daily student & teacher attendance",
        is_published=True,
        version="1.0.0",
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def paid_plugin(db):
    """Create a paid plugin with trial."""
    p = Plugin(
        slug="lms",
        name="Learning Management System",
        category="growth",
        price_monthly=500,
        price_yearly=5000,
        is_free=False,
        trial_days=14,
        emoji="📚",
        description="Full LMS with courses, quizzes",
        is_published=True,
        version="1.0.0",
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def installed_plugin(db, school, sample_plugin):
    """Install a plugin for the test school."""
    sp = SchoolPlugin(
        school_id=school.id,
        plugin_slug=sample_plugin.slug,
        active=True,
        is_trial=False,
    )
    db.session.add(sp)
    db.session.commit()
    return sp


def get_auth_headers(client, email, password):
    """Helper: login and return Authorization headers."""
    resp = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password,
    })
    data = resp.get_json()
    token = data["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _reset_database():
    _db.session.remove()
    _db.session.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
    _db.session.execute(text("CREATE SCHEMA public"))
    _db.session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    _db.session.commit()
    _db.create_all()
