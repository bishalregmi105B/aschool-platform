"""B-01 + B-05: marks entry correctness.

B-01 — a record whose marks exceed full marks (150/100) must fail the whole
batch with a 400 naming the row, before any write.
B-05 — rank ties use competition ranking (1, 1, 3), not seat position.
"""
import uuid as _uuid

import pytest

from app.models.academic import Class, Section, Subject
from app.models.exam import Marks
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from app.models.user import User
from extensions import db as _db
from tests.conftest import get_auth_headers

PLUGIN_SLUGS = ("exams",)


def _seed_plugin(db, slug):
    exists = Plugin.query.filter_by(slug=slug).first()
    if exists:
        return exists
    p = Plugin(
        slug=slug,
        name=slug.replace("_", " ").title(),
        category="core",
        is_free=True,
        is_published=True,
        version="1.0.0",
        emoji="🧪",
    )
    db.session.add(p)
    db.session.flush()
    return p


@pytest.fixture
def exam_setup(client, db, school, admin_user):
    for slug in PLUGIN_SLUGS:
        _seed_plugin(db, slug)
        db.session.add(
            SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True, is_trial=False)
        )
    db.session.commit()

    klass = Class(school_id=school.id, name="Five")
    db.session.add(klass)
    db.session.flush()
    sec_a = Section(school_id=school.id, class_id=klass.id, name="A")
    db.session.add(sec_a)
    db.session.flush()

    subject = Subject(
        school_id=school.id, name="Mathematics", code="MTH5",
        full_marks=100, pass_marks=32,
    )
    db.session.add(subject)
    db.session.flush()

    students = []
    for i, (first, last) in enumerate(
        [("Anish", "Karki"), ("Bina", "Rai"), ("Chandra", "Tamang")]
    ):
        st = Student(
            school_id=school.id,
            first_name=first,
            last_name=last,
            roll_number=i + 1,
            class_id=klass.id,
            section_id=sec_a.id,
            status="active",
        )
        db.session.add(st)
        students.append(st)
    db.session.commit()

    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")
    r = client.post(
        "/api/v1/exams",
        json={
            "name": "Unit Test 1",
            "exam_type": "unit_test",
            "subject_ids": [str(subject.id)],
            "total_marks": 100,
            "pass_marks": 32,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.get_json()
    exam_id = r.get_json()["data"]["id"]

    return {
        "headers": headers,
        "klass": klass,
        "subject": subject,
        "students": students,
        "exam_id": exam_id,
    }


def _submit(client, headers, exam_id, marks):
    return client.post(
        f"/api/v1/exams/{exam_id}/marks",
        json={"marks": marks},
        headers=headers,
    )


class TestMarksOverFullRejected:
    def test_over_full_marks_rejected_400(
        self, client, db, school, exam_setup
    ):
        s = exam_setup
        r = _submit(
            client, s["headers"], s["exam_id"],
            [{"student_id": str(s["students"][0].id),
              "subject_id": str(s["subject"].id),
              "theory_marks": 150}],
        )
        assert r.status_code == 400
        assert "records[0]" in r.get_json()["error"]
        assert "exceed full marks" in r.get_json()["error"]
        assert Marks.query.filter_by(school_id=school.id, exam_id=s["exam_id"]).count() == 0

    def test_bad_row_fails_whole_batch_with_zero_writes(
        self, client, db, school, exam_setup
    ):
        """Row 0 is valid, row 1 exceeds — the batch 400s naming records[1]
        and NOT EVEN the valid row is written (single-transaction guarantee)."""
        s = exam_setup
        r = _submit(
            client, s["headers"], s["exam_id"],
            [
                {"student_id": str(s["students"][0].id),
                 "subject_id": str(s["subject"].id), "theory_marks": 78},
                {"student_id": str(s["students"][1].id),
                 "subject_id": str(s["subject"].id), "theory_marks": 101},
            ],
        )
        assert r.status_code == 400
        assert "records[1]" in r.get_json()["error"]
        assert Marks.query.filter_by(school_id=school.id, exam_id=s["exam_id"]).count() == 0

    def test_negative_marks_rejected(self, client, db, school, exam_setup):
        s = exam_setup
        r = _submit(
            client, s["headers"], s["exam_id"],
            [{"student_id": str(s["students"][0].id),
              "subject_id": str(s["subject"].id), "theory_marks": -5}],
        )
        assert r.status_code == 400
        assert "negative" in r.get_json()["error"]

    def test_boundary_full_marks_accepted(self, client, db, school, exam_setup):
        """Exactly full marks is legitimate (100/100) and must still store."""
        s = exam_setup
        r = _submit(
            client, s["headers"], s["exam_id"],
            [{"student_id": str(s["students"][0].id),
              "subject_id": str(s["subject"].id), "theory_marks": 100}],
        )
        assert r.status_code == 200, r.get_json()
        assert Marks.query.filter_by(school_id=school.id, exam_id=s["exam_id"]).count() == 1


class TestCompetitionRanks:
    def _seed_marks(self, client, s, scores):
        marks = [
            {"student_id": str(student.id),
             "subject_id": str(s["subject"].id), "theory_marks": score}
            for student, score in zip(s["students"], scores)
        ]
        r = _submit(client, s["headers"], s["exam_id"], marks)
        assert r.status_code == 200, r.get_json()

    def test_results_ranks_tied_students_share_rank(
        self, client, db, school, exam_setup
    ):
        """78, 78, 45 → ranks 1, 1, 3 (was 1, 2, 3)."""
        s = exam_setup
        self._seed_marks(client, s, [78, 78, 45])
        r = client.get(
            f"/api/v1/exams/{s['exam_id']}/results?class_id={s['klass'].id}",
            headers=s["headers"],
        )
        assert r.status_code == 200
        rows = {row["student_id"]: row["rank"] for row in r.get_json()["data"]}
        a, b, c = (str(st.id) for st in s["students"])
        assert rows[a] == 1 and rows[b] == 1
        assert rows[c] == 3

    def test_grade_sheet_ranks_tied_students_share_rank(
        self, client, db, school, exam_setup
    ):
        s = exam_setup
        self._seed_marks(client, s, [90, 70, 70])
        r = client.get(
            f"/api/v1/exams/{s['exam_id']}/grade-sheet?class_id={s['klass'].id}",
            headers=s["headers"],
        )
        assert r.status_code == 200
        rows = {row["student_id"]: row["rank"] for row in r.get_json()["data"]["rows"]}
        a, b, c = (str(st.id) for st in s["students"])
        assert rows[a] == 1
        assert rows[b] == 2 and rows[c] == 2
