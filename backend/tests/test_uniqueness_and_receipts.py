"""D-02 + B-02: uniqueness constraints and receipt counters.

- Concurrent receipts draw DISTINCT sequential numbers from the per-school
  FOR UPDATE counter (D-02).
- Duplicate (exam, student, subject) marks are rejected by the unique index;
  the API reports a clear 409 instead of double-counting aggregates (B-02).
"""
import threading

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.v1.fees import _generate_receipt_number
from app.models.exam import Exam, Marks
from app.models.fee import FeeCollection, FeeReceipt
from app.models.school import SchoolReceiptCounter
from app.models.student import Student
from app.models.academic import Subject
from extensions import db as _db
from tests.conftest import get_auth_headers


class TestReceiptCounter:
    def test_sequential_numbers_are_distinct_and_ordered(self, client, db, school, admin_user):
        st = Student(school_id=school.id, first_name="A", last_name="B", roll_number=1, status="active")
        fc = FeeCollection(school_id=school.id, student_id=None, amount=100, payment_status="paid")
        db.session.add(st)
        db.session.flush()
        fc.student_id = st.id
        db.session.commit()

        with client.application.test_request_context():
            from flask import g as _g
            from app.models.school import School as _School

            _g.school_id = school.id
            _g.school = school
            n1 = _generate_receipt_number(fc)
            n2 = _generate_receipt_number(fc)
        assert n1 != n2
        assert n1.split("/")[-1] == "00001"
        assert n2.split("/")[-1] == "00002"
        assert SchoolReceiptCounter.query.filter_by(school_id=school.id).count() == 1

    def test_duplicate_receipt_number_rejected_by_index(
        self, client, db, school, admin_user
    ):
        st = Student(school_id=school.id, first_name="A", last_name="B", roll_number=2, status="active")
        db.session.add(st)
        db.session.flush()
        fc = FeeCollection(school_id=school.id, student_id=st.id, amount=100, payment_status="paid")
        db.session.add(fc)
        db.session.flush()
        db.session.add(
            FeeReceipt(
                school_id=school.id, collection_id=fc.id, student_id=st.id,
                receipt_number="DUP/2082-83/00001", amount=100,
            )
        )
        db.session.commit()
        db.session.add(
            FeeReceipt(
                school_id=school.id, collection_id=fc.id, student_id=st.id,
                receipt_number="DUP/2082-83/00001", amount=100,
            )
        )
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


class TestMarksUniqueness:
    def test_duplicate_marks_rejected_at_db_level(self, client, db, school, admin_user):
        klass = __import__("app.models.academic", fromlist=["Class"]).Class(
            school_id=school.id, name="Six"
        )
        db.session.add(klass)
        db.session.flush()
        subject = Subject(school_id=school.id, name="Math", code="M6", full_marks=100, pass_marks=32)
        exam = Exam(
            school_id=school.id, name="T1", exam_type="unit_test",
            total_marks=100, pass_marks=32,
        )
        st = Student(school_id=school.id, first_name="A", last_name="C", roll_number=1,
                     class_id=klass.id, status="active")
        db.session.add_all([subject, exam, st])
        db.session.flush()
        m1 = Marks(
            school_id=school.id, exam_id=exam.id, student_id=st.id,
            subject_id=subject.id, theory_marks=50, total_marks=50,
        )
        db.session.add(m1)
        db.session.commit()

        m2 = Marks(
            school_id=school.id, exam_id=exam.id, student_id=st.id,
            subject_id=subject.id, theory_marks=60, total_marks=60,
        )
        db.session.add(m2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        # exactly one row survives
        assert Marks.query.filter_by(
            school_id=school.id, exam_id=exam.id, student_id=st.id,
            subject_id=subject.id, is_deleted=False,
        ).count() == 1

    def test_submit_marks_race_reports_409(self, client, db, school, admin_user, monkeypatch):
        """A submit_marks POST whose check-then-insert misses (as it does in
        a concurrent race) hits the unique index → clear 409, no double row,
        no 500."""
        from app.models.plugin import Plugin, SchoolPlugin

        for slug in ("exams",):
            p = Plugin.query.filter_by(slug=slug).first()
            if not p:
                p = Plugin(slug=slug, name="Exams", category="core", is_free=True,
                           is_published=True, version="1.0.0", emoji="📝")
                db.session.add(p)
            db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False))
        db.session.commit()

        klass = __import__("app.models.academic", fromlist=["Class"]).Class(
            school_id=school.id, name="Seven"
        )
        db.session.add(klass)
        db.session.flush()
        subject = Subject(school_id=school.id, name="Sci", code="S7", full_marks=100, pass_marks=32)
        exam = Exam(
            school_id=school.id, name="T2", exam_type="unit_test",
            total_marks=100, pass_marks=32,
        )
        st = Student(school_id=school.id, first_name="A", last_name="D", roll_number=1,
                     class_id=klass.id, status="active")
        db.session.add_all([subject, exam, st])
        db.session.flush()
        db.session.add(Marks(
            school_id=school.id, exam_id=exam.id, student_id=st.id,
            subject_id=subject.id, theory_marks=50, total_marks=50,
        ))
        db.session.commit()

        class _AlwaysMissQuery:
            """Simulates the race window: the endpoint's existing-row check
            runs before the concurrent insert commits."""

            def filter_by(self, *a, **k):
                return self

            def first(self):
                return None

        monkeypatch.setattr(Marks, "query", _AlwaysMissQuery())
        headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
        r = client.post(
            f"/api/v1/exams/{exam.id}/marks",
            json={"marks": [
                {"student_id": str(st.id), "subject_id": str(subject.id),
                 "theory_marks": 88},
            ]},
            headers=headers,
        )
        assert r.status_code == 409, r.get_json()
        monkeypatch.undo()
        assert Marks.query.filter_by(
            school_id=school.id, exam_id=exam.id, student_id=st.id,
            subject_id=subject.id, is_deleted=False,
        ).count() == 1
