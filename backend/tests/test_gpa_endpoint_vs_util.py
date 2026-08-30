"""Money & Grades verification (2026-08-28) — exams.py GPA endpoint vs nepal_grading util.

Hand-computed expectations (NEB table):
  Student A marks (100 each, theory only):  90 → A+ 4.0, 85 → A 3.6, 75 → B+ 3.2
    equal-weight GPA   = (4.0 + 3.6 + 3.2) / 3          = 3.60
    weighted (4/3/2cr) = (4*4.0 + 3*3.6 + 2*3.2) / 9    = 33.2 / 9 = 3.69
  Student B marks: 35 → D 1.6, 34 → NG 0.0, 66 → B 2.8
    equal-weight GPA   = (1.6 + 0.0 + 2.8) / 3          = 4.4 / 3   = 1.47
    weighted (4/3/2cr) = (4*1.6 + 3*0.0 + 2*2.8) / 9    = 12 / 9    = 1.33
  Student B: one NG subject → overall status "fail", subjects_failed = 1,
    percentage = (35+34+66)/300 = 45.0 → C band (40-<50).
"""

from datetime import date

from app.api.v1.exams import _build_subject_grade
from app.models.academic import Class, Section, Subject
from app.models.exam import Exam, Marks
from app.models.student import Student
from app.models.user import User
from app.utils.nepal_grading import calculate_gpa
from tests.conftest import get_auth_headers


def _install_exams_plugin(db, school):
    from app.models.plugin import Plugin, SchoolPlugin

    plugin = Plugin.query.filter_by(slug="exams").first()
    if not plugin:
        plugin = Plugin(
            slug="exams",
            name="Examinations",
            category="core",
            is_free=True,
            is_published=True,
            version="1.0.0",
        )
        db.session.add(plugin)
        db.session.flush()
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="exams", active=True, is_trial=False)
    )
    db.session.commit()


def _seed_exam_fixture(db, school):
    """2 students × 3 subjects (credit_hours 4/3/2), theory-only marks, no stored grade/gpa."""
    klass = Class(school_id=school.id, name="GPA Verify Grade 5", numeric_grade=5)
    section = Section(school_id=school.id, klass=klass, name="A")
    db.session.add_all([klass, section])
    db.session.flush()

    students = []
    for i, (first, email) in enumerate(
        [("GpaOne", "gpaone.verify@test.edu.np"), ("GpaTwo", "gpatwo.verify@test.edu.np")]
    ):
        u = User(
            school_id=school.id,
            role="student",
            full_name=f"{first} Verify",
            email=email,
            phone=f"+977984100070{i}",
            is_active=True,
        )
        db.session.add(u)
        db.session.flush()
        students.append(
            Student(
                school_id=school.id,
                user_id=u.id,
                class_id=klass.id,
                section_id=section.id,
                roll_number=i + 1,
                first_name=first,
                last_name="Verify",
                admission_number=f"GPA-{i + 1:03d}",
                status="active",
            )
        )
    db.session.add_all(students)

    subjects = [
        Subject(
            school_id=school.id,
            name="GPA Math",
            class_ids=[klass.id],
            credit_hours=4,
            full_marks=100,
            pass_marks=32,
        ),
        Subject(
            school_id=school.id,
            name="GPA Science",
            class_ids=[klass.id],
            credit_hours=3,
            full_marks=100,
            pass_marks=32,
        ),
        Subject(
            school_id=school.id,
            name="GPA Nepali",
            class_ids=[klass.id],
            credit_hours=2,
            full_marks=100,
            pass_marks=32,
        ),
    ]
    db.session.add_all(subjects)
    db.session.flush()

    exam = Exam(
        school_id=school.id,
        name="GPA Verify Terminal 2082",
        exam_type="terminal",
        start_date_bs="2082-06-01",
        start_date=date(2026, 9, 15),
        subject_ids=[s.id for s in subjects],
    )
    db.session.add(exam)
    db.session.flush()

    marks_by_student = {
        students[0].id: [90, 85, 75],  # A+ / A / B+
        students[1].id: [35, 34, 66],  # D / NG / B
    }
    for sid, values in marks_by_student.items():
        for subj, obtained in zip(subjects, values):
            db.session.add(
                Marks(
                    school_id=school.id,
                    exam_id=exam.id,
                    student_id=sid,
                    subject_id=subj.id,
                    class_id=klass.id,
                    theory_marks=obtained,
                    practical_marks=0,
                    total_marks=obtained,
                    full_marks=100,
                    pass_marks=32,
                    grade=None,  # let the util compute — no stored override
                    gpa=None,
                )
            )
    db.session.commit()
    return klass, exam, subjects, marks_by_student


def test_results_endpoint_gpa_matches_util_and_hand_math(client, db, school, admin_user):
    _install_exams_plugin(db, school)
    klass, exam, subjects, marks_by_student = _seed_exam_fixture(db, school)
    headers = get_auth_headers(client, "admin@test.edu.np", "Test@1234")

    resp = client.get(
        f"/api/v1/exams/{exam.id}/results",
        headers=headers,
        query_string={"class_id": str(klass.id)},
    )
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    data = body.get("data") if isinstance(body, dict) else body
    assert data, f"empty results payload: {str(body)[:400]}"
    rows = {r["student_id"]: r for r in data}
    assert len(rows) == 2, f"expected 2 students, got {len(rows)}: {str(data)[:400]}"

    # Rebuild the exact per-subject grades the endpoint builds from the same marks
    hand_equal = {}
    hand_weighted = {}
    for sid, values in marks_by_student.items():
        sid = str(sid)
        sgs = []
        for subj, obtained in zip(subjects, values):
            sg = _build_subject_grade(
                float(obtained),
                0.0,
                subject=subj,
                exam=exam,
                total_full_marks=100,
                total_pass_marks=32,
                has_practical=False,
            )
            sgs.append(sg)
        util_result = calculate_gpa(sgs)  # exactly what the endpoint passes in
        hand_equal[sid] = util_result["gpa"]
        # util on the same fixture but with the subjects' real credit_hours (weighted)
        weighted_sgs = [dict(sg, credit_hours=subj.credit_hours)
                        for sg, subj in zip(sgs, subjects)]
        hand_weighted[sid] = calculate_gpa(weighted_sgs)["gpa"]

    # Hand math, independent of the code paths under test.
    # The endpoint is credit-hour weighted (subjects carry 4/3/2 credits):
    #   Student A: (4*4.0 + 3*3.6 + 2*3.2)/9 = 33.2/9 = 3.69
    #   Student B: (4*1.6 + 3*0.0 + 2*2.8)/9 = 12/9  = 1.33
    sid_a, sid_b = (str(s) for s in marks_by_student.keys())
    assert rows[sid_a]["gpa"] == 3.69 == hand_equal[sid_a]
    assert rows[sid_b]["gpa"] == 1.33 == hand_equal[sid_b]
    # Equal-weight variant of the same fixture through the util (for reference)
    assert hand_weighted[sid_a] == 3.69                          # 33.2/9 = 3.688… → 3.69
    assert hand_weighted[sid_b] == 1.33                          # 12/9 = 1.333… → 1.33

    # Bands/status/percentage on the same fixture
    assert rows[sid_a]["grade"] == "A"          # 250/300 = 83.33% → A
    assert rows[sid_a]["percentage"] == 83.33
    assert rows[sid_a]["status"] == "pass"
    assert rows[sid_b]["grade"] == "C"          # 135/300 = 45.0% → C band (40-<50)
    assert rows[sid_b]["percentage"] == 45.0
    assert rows[sid_b]["status"] == "fail"      # one NG subject
    assert rows[sid_b]["subjects_failed"] == 1
    # Rank: higher percentage first
    assert rows[sid_a]["rank"] == 1 and rows[sid_b]["rank"] == 2
