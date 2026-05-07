"""Tests for base models — UUID PK, soft delete, school isolation, timestamps."""
import uuid

import pytest

from app.models.base import BaseModel, SchoolIsolationError, SchoolModel
from app.models.school import School
from app.models.user import User


class TestBaseModel:
    """Tests for BaseModel abstract class behavior."""

    def test_uuid_primary_key(self, db, school):
        assert isinstance(school.id, uuid.UUID)

    def test_timestamps_auto_set(self, db, school):
        assert school.created_at is not None
        assert school.updated_at is not None

    def test_soft_delete_default_false(self, db, school):
        assert school.is_deleted is False

    def test_soft_delete_method(self, db, school):
        school.soft_delete()
        db.session.refresh(school)
        assert school.is_deleted is True

    def test_active_query_excludes_deleted(self, db):
        s1 = School(name="Active School", slug="active-1", is_active=True, phone="+9779800000002")
        s2 = School(name="Deleted School", slug="deleted-1", is_active=True, phone="+9779800000003")
        db.session.add_all([s1, s2])
        db.session.commit()

        s2.soft_delete()
        active_schools = School.active().all()
        active_slugs = [s.slug for s in active_schools]
        assert "active-1" in active_slugs
        assert "deleted-1" not in active_slugs


class TestSchoolModel:
    """Tests for SchoolModel isolation."""

    def test_for_school_requires_school_id(self):
        with pytest.raises(SchoolIsolationError):
            User.for_school(None)

    def test_for_school_filters_by_school(self, db, school, admin_user, teacher_user):
        other_school = School(name="Other School", slug="other", is_active=True, phone="+9779800000004")
        db.session.add(other_school)
        db.session.commit()

        other_user = User(
            school_id=other_school.id,
            role="teacher",
            full_name="Other Teacher",
            phone="+9779841000099",
            is_active=True,
        )
        db.session.add(other_user)
        db.session.commit()

        # Query for first school should only return its users
        users = User.for_school(school.id).all()
        user_ids = [u.id for u in users]
        assert admin_user.id in user_ids
        assert teacher_user.id in user_ids
        assert other_user.id not in user_ids


class TestUserModel:
    """Tests for User model specific methods."""

    def test_set_and_check_password(self, db, school):
        u = User(
            school_id=school.id,
            role="school_admin",
            full_name="Test User",
            phone="+9779841000050",
            is_active=True,
        )
        u.set_password("MySecret@123")
        db.session.add(u)
        db.session.commit()

        assert u.check_password("MySecret@123") is True
        assert u.check_password("WrongPassword") is False

    def test_check_password_no_hash(self, db, student_user):
        # Student created without password
        assert student_user.check_password("anything") is False

    def test_to_dict_excludes_sensitive(self, db, admin_user):
        data = admin_user.to_dict()
        assert "password_hash" not in data
        assert "otp_code" not in data
        assert "id" in data
        assert "role" in data

    def test_user_roles_enum(self, db, school):
        valid_roles = ["superadmin", "school_admin", "accountant", "teacher", "staff", "parent", "student"]
        for role in valid_roles:
            u = User(
                school_id=school.id if role != "superadmin" else None,
                role=role,
                full_name=f"Test {role}",
                phone=f"+977984100{str(hash(role))[-4:]}",
                is_active=True,
            )
            db.session.add(u)
        db.session.commit()

        count = User.query.filter_by(is_deleted=False).count()
        assert count >= len(valid_roles)


class TestSchoolModel2:
    """Tests for School model."""

    def test_school_to_dict(self, db, school):
        data = school.to_dict()
        assert data["slug"] == "test-academy"
        assert data["plan"] == "growth"
        assert data["is_active"] is True

    def test_school_slug_unique(self, db, school):
        duplicate = School(
            name="Duplicate School",
            slug="test-academy",  # same slug
            is_active=True,
            phone="+9779800000005",
        )
        db.session.add(duplicate)
        with pytest.raises(Exception):
            db.session.commit()
