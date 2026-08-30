"""TEMPORARY verification probe (timetable / assignments / attendance-late / exams-marks).

Covers this batch's fixes over live HTTP inside aschool-flask-1:
- timetable: create_slot conflict detection (teacher/class double-book -> 409,
  free slot -> 201, time-window overlap -> 409) + GET filters;
- assignments: create guards, submit flow, is_late, bogus-student rollback,
  forced commit-failure rollback (in-process), grade flow;
- attendance: uniform late rule (present + late count toward rates) on
  /attendance/student/<id>/summary, /attendance/summary, /parent/child-attendance,
  /reports/attendance/summary, /analytics/overview;
- exams marks: E24 class fallback persisted, bogus-student/garbage-id 400 with
  zero rows, numeric-overflow mid-batch failure -> 500 + zero rows.

Run: docker compose exec flask python tmp_probe_e24_batch.py
Creates a throwaway school, cleans it up at the end.
"""
import json
import sys
import uuid as uuid_mod
from datetime import date, datetime, timedelta, timezone

import requests

BASE = "http://localhost:5000/api/v1"
SUFFIX = uuid_mod.uuid4().hex[:6]
SLUG = f"e24batch-{SUFFIX}"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:300]))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {str(detail)[:300]}")


from app import create_app  # noqa: E402
from extensions import db  # noqa: E402

CLEANUP_STMTS = [
    "DELETE FROM assignment_submissions WHERE school_id=:s",
    "DELETE FROM assignments WHERE school_id=:s",
    "DELETE FROM marks WHERE school_id=:s",
    "DELETE FROM report_cards WHERE school_id=:s",
    "DELETE FROM exams WHERE school_id=:s",
    "DELETE FROM attendance WHERE school_id=:s",
    "DELETE FROM timetable_slots WHERE school_id=:s",
    "UPDATE students SET user_id=NULL WHERE school_id=:s",
    "DELETE FROM guardians WHERE school_id=:s",
    "DELETE FROM students WHERE school_id=:s",
    "DELETE FROM subjects WHERE school_id=:s",
    "DELETE FROM sections WHERE school_id=:s",
    "DELETE FROM classes WHERE school_id=:s",
    "DELETE FROM school_plugins WHERE school_id=:s",
    "DELETE FROM in_app_notifications WHERE school_id=:s",
    "DELETE FROM users WHERE school_id=:s",
    "DELETE FROM schools WHERE id=:s",
]


def cleanup_school(sid, label=""):
    from sqlalchemy import text
    for stmt in CLEANUP_STMTS:
        try:
            db.session.execute(text(stmt), {"s": sid})
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"cleanup stmt failed ({label}):", stmt.split("WHERE")[0], str(e).split("\n")[0])


app = create_app()
created = {"school_id": None, "user_ids": []}

with app.app_context():
    from app.models.school import School

    # Sweep leftovers from prior runs of this probe
    for s in School.query.filter(School.slug.like("e24batch-%")).all():
        cleanup_school(str(s.id), "sweep")
    db.session.commit()

    from app.models.user import User
    from app.models.student import Guardian, Student
    from app.models.academic import Class, Section, Subject
    from app.models.plugin import SchoolPlugin

    school = School(
        name="E24 Batch Probe", slug=SLUG, type="private", level="secondary",
        district="Kathmandu", plan="growth", is_active=True,
    )
    db.session.add(school)
    db.session.flush()
    created["school_id"] = str(school.id)

    def mkuser(role, full_name, phone):
        u = User(
            school_id=str(school.id), role=role, full_name=full_name,
            phone=phone, email=f"{phone}@{SLUG}.test", is_active=True,
        )
        u.set_password("ProbePass123!")
        db.session.add(u)
        db.session.flush()
        created["user_ids"].append(str(u.id))
        return u

    admin = mkuser("school_admin", "Batch Admin", "9803330001")
    teacher = mkuser("teacher", "Batch Teacher", "9803330002")
    teacher2 = mkuser("teacher", "Batch Teacher Two", "9803330004")
    parent = mkuser("parent", "Batch Parent", "9803330003")

    for slug in ["timetable", "assignments", "attendance", "exams", "basic_reports"]:
        db.session.add(SchoolPlugin(
            school_id=str(school.id), plugin_slug=slug, active=True, is_trial=False,
        ))

    klass_a = Class(school_id=str(school.id), name="Five")
    db.session.add(klass_a)
    db.session.flush()
    sec1 = Section(school_id=str(school.id), class_id=klass_a.id, name="A", class_teacher_id=teacher.id)
    sec2 = Section(school_id=str(school.id), class_id=klass_a.id, name="B")
    db.session.add_all([sec1, sec2])
    db.session.flush()
    subject = Subject(school_id=str(school.id), name="Mathematics", code="MTH", full_marks=100, pass_marks=32)
    db.session.add(subject)
    db.session.flush()

    def mkstudent(first, last, roll, section):
        u = User(
            school_id=str(school.id), role="student", full_name=f"{first} {last}",
            phone=f"980441{roll:04d}", email=f"s{roll}@{SLUG}.test", is_active=True,
        )
        u.set_password("ProbePass123!")
        db.session.add(u)
        db.session.flush()
        st = Student(
            school_id=str(school.id), user_id=u.id, first_name=first, last_name=last,
            roll_number=roll, class_id=klass_a.id, section_id=section.id, status="active",
        )
        db.session.add(st)
        db.session.flush()
        return st

    s1 = mkstudent("Anish", "Karki", 1, sec1)
    s2 = mkstudent("Bina", "Rai", 2, sec1)
    s3 = mkstudent("Chandra", "Tamang", 3, sec2)

    db.session.add(Guardian(
        school_id=str(school.id), student_id=s1.id, user_id=parent.id,
        full_name="Batch Parent", phone="9803330003", relation="father",
    ))
    db.session.commit()

    IDS = {
        "school": str(school.id), "teacher": str(teacher.id),
        "teacher2": str(teacher2.id), "parent": str(parent.id),
        "class_a": str(klass_a.id), "sec1": str(sec1.id), "sec2": str(sec2.id),
        "subject": str(subject.id), "s1": str(s1.id), "s2": str(s2.id), "s3": str(s3.id),
    }

TOKENS = {}


def login(role, phone):
    r = requests.post(f"{BASE}/auth/login", json={"email": f"{phone}@{SLUG}.test", "password": "ProbePass123!"})
    ok = r.status_code == 200 and r.json().get("data", {}).get("access_token")
    TOKENS[role] = r.json()["data"]["access_token"]
    check(f"login {role}", ok, r.status_code)


def H(role="admin"):
    return {"Authorization": f"Bearer {TOKENS[role]}"}


def call(method, path, role="admin", **kw):
    return requests.request(method, BASE + path, headers=H(role), **kw)


# ═══ 1. TIMETABLE ═══════════════════════════════════════════════════════════
print("\n── timetable ──")
login("admin", "9803330001")
login("teacher", "9803330002")

r = call("GET", "/timetable")
check("timetable GET empty", r.status_code == 200 and r.json()["data"] == [], r.text[:120])

# free slot -> 201
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "section_id": IDS["sec1"], "subject_id": IDS["subject"],
    "teacher_id": IDS["teacher"], "day_of_week": "Monday", "period_number": 1,
    "start_time": "10:00", "end_time": "10:45",
})
check("timetable free slot accepted", r.status_code == 201, r.text[:200])
slot1 = r.json()["data"]["id"] if r.status_code == 201 else None

# two sections same teacher/time -> 409 (hand-built conflict example)
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "section_id": IDS["sec2"], "subject_id": IDS["subject"],
    "teacher_id": IDS["teacher"], "day_of_week": "Monday", "period_number": 1,
    "start_time": "10:00", "end_time": "10:45",
})
check("timetable teacher double-book (2 sections) rejected 409", r.status_code == 409, r.text[:200])

# same class/section different teacher -> 409
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "section_id": IDS["sec1"], "subject_id": IDS["subject"],
    "teacher_id": IDS["teacher2"], "day_of_week": "Monday", "period_number": 1,
})
check("timetable class/section double-book rejected 409", r.status_code == 409, r.text[:200])

# same teacher different day -> 201 (free)
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "section_id": IDS["sec2"], "subject_id": IDS["subject"],
    "teacher_id": IDS["teacher"], "day_of_week": "Tuesday", "period_number": 1,
})
check("timetable same teacher other day accepted", r.status_code == 201, r.text[:150])
slot2 = r.json()["data"]["id"] if r.status_code == 201 else None

# teacher double-booked via an OVERLAPPING time window even with a different
# period number (teacher booked 10:00-10:45, now 10:30-11:15) -> 409
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "section_id": IDS["sec2"], "subject_id": IDS["subject"],
    "teacher_id": IDS["teacher"], "day_of_week": "Monday", "period_number": 99,
    "start_time": "10:30", "end_time": "11:15",
})
check("timetable teacher overlapping time window rejected 409", r.status_code == 409, r.text[:200])

# legit overlap: DIFFERENT teacher AND different class/section -> 201 (free slot)
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "section_id": IDS["sec2"], "subject_id": IDS["subject"],
    "teacher_id": IDS["teacher2"], "day_of_week": "Monday", "period_number": 99,
    "start_time": "10:30", "end_time": "11:15",
})
check("timetable overlapping ok for different teacher+section", r.status_code == 201, r.text[:150])
if r.status_code == 201:
    call("DELETE", f"/timetable/slots/{r.json()['data']['id']}")

# garbage body ids -> 400 (was DataError 500)
r = call("POST", "/timetable/slots", json={
    "class_id": "garbage", "day_of_week": "Monday", "period_number": 3,
})
check("timetable garbage class_id 400", r.status_code == 400, r.text[:150])

# valid UUID but unknown teacher/subject -> 400 (was FK IntegrityError 500)
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "subject_id": IDS["subject"],
    "teacher_id": str(uuid_mod.uuid4()), "day_of_week": "Saturday", "period_number": 2,
})
check("timetable unknown teacher 400", r.status_code == 400, r.text[:150])
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "teacher_id": IDS["teacher"],
    "subject_id": str(uuid_mod.uuid4()), "day_of_week": "Saturday", "period_number": 2,
})
check("timetable unknown subject 400", r.status_code == 400, r.text[:150])
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "day_of_week": "Monday", "period_number": "three",
})
check("timetable garbage period_number 400", r.status_code == 400, r.text[:150])

# bad inputs -> 400
r = call("POST", "/timetable/slots", json={"day_of_week": "Monday", "period_number": 3})
check("timetable missing class_id 400", r.status_code == 400, r.text[:150])
r = call("POST", "/timetable/slots", json={
    "class_id": IDS["class_a"], "day_of_week": "Monday", "period_number": 3,
    "start_time": "notatime",
})
check("timetable bad start_time 400", r.status_code == 400, r.text[:150])

# teacher cannot see other teachers' classes; admin GET filter by class + teacher name
r = call("GET", f"/timetable?class_id={IDS['class_a']}")
ok = r.status_code == 200 and len(r.json()["data"]) == 2
check("timetable GET filter by class", ok, f"n={len(r.json()['data']) if r.status_code==200 else '?'}")
if ok:
    d = r.json()["data"][0]
    check("timetable slot serializer names", d["class_name"] == "Five" and d["subject_name"] == "Mathematics" and d["teacher_name"] == "Batch Teacher", json.dumps(d)[:200])

r = call("DELETE", f"/timetable/slots/{slot2}")
check("timetable delete slot", r.status_code == 200, r.text[:120])
r = call("GET", f"/timetable?class_id={IDS['class_a']}")
check("timetable delete reflected", len(r.json()["data"]) == 1, "")

# plugin gate: school without timetable plugin -> covered by decorators elsewhere (E3 batch). Skip.

# ═══ 2. ASSIGNMENTS ═════════════════════════════════════════════════════════
print("\n── assignments ──")
r = call("GET", "/assignments")
check("assignments GET empty", r.status_code == 200 and r.json()["data"] == [], r.text[:120])

r = call("POST", "/assignments", json={"title": "No class"})
check("assignments missing class_id 400", r.status_code == 400, r.text[:150])
r = call("POST", "/assignments", json={"title": "Bogus", "class_id": IDS["s1"], "subject_id": IDS["subject"]})
check("assignments bogus class_id 400", r.status_code == 400, r.text[:150])

future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
r = call("POST", "/assignments", json={
    "title": "Algebra worksheet", "description": "Ch 3 exercises",
    "class_id": IDS["class_a"], "section_id": IDS["sec1"], "subject_id": IDS["subject"],
    "due_date": future, "total_marks": 10,
})
check("assignments create (teacher) 201", r.status_code == 201, r.text[:200])
asg_ok = r.json()["data"]["id"] if r.status_code == 201 else None
check("assignment status active + due future", r.json()["data"]["status"] == "active", r.text[:150])

r = call("POST", "/assignments", json={
    "title": "Overdue worksheet", "class_id": IDS["class_a"], "subject_id": IDS["subject"],
    "due_date": past, "total_marks": 10,
})
asg_late = r.json()["data"]["id"] if r.status_code == 201 else None
check("assignment past due -> status past", r.status_code == 201 and r.json()["data"]["status"] == "past", r.text[:150])

# student login and submit on time
login("parent", "9803330003")  # for /parent/child-attendance below
r = requests.post(f"{BASE}/auth/login", json={"email": f"s1@{SLUG}.test", "password": "ProbePass123!"})
check("login student", r.status_code == 200 and r.json().get("data", {}).get("access_token"), r.text[:200])
TOKENS["student"] = r.json()["data"]["access_token"] if r.status_code == 200 else ""

r = call("POST", f"/assignments/{asg_ok}/submit", role="student", json={"content": "My worksheet answers"})
check("student submits on time 201", r.status_code == 201 and r.json()["data"]["is_late"] is False, r.text[:250])

# late submission against the past-due assignment
r = call("POST", f"/assignments/{asg_late}/submit", role="student", json={"content": "sorry, late"})
check("late submission is_late True", r.status_code == 201 and r.json()["data"]["is_late"] is True, r.text[:250])

# bogus student -> 400, no row written
r = call("GET", f"/assignments/{asg_ok}/submissions")
before = len(r.json()["data"])
bogus_uuid = str(uuid_mod.uuid4())
r = call("POST", f"/assignments/{asg_ok}/submit", json={"student_id": bogus_uuid, "content": "x"})
check("assignments bogus student 400", r.status_code == 400, r.text[:150])
r = call("GET", f"/assignments/{asg_ok}/submissions")
check("assignments bogus student wrote no row", len(r.json()["data"]) == before, f"count={len(r.json()['data'])}")

# non-UUID garbage student -> 400 (was DataError 500)
r = call("POST", f"/assignments/{asg_ok}/submit", json={"student_id": "not-a-uuid", "content": "x"})
check("assignments garbage student_id 400", r.status_code == 400, r.text[:150])

# cross-tenant assignment -> 404
r = call("POST", f"/assignments/{uuid_mod.uuid4()}/submit", role="student", json={"content": "x"})
check("assignments unknown assignment 404", r.status_code == 404, r.text[:120])

# teacher grades the on-time submission
r = call("GET", f"/assignments/{asg_ok}/submissions", role="teacher")
sub_id = r.json()["data"][0]["id"]
r = call("POST", f"/assignments/{asg_ok}/submissions/{sub_id}/grade", role="teacher",
         json={"marks": 8.5, "feedback": "Good work"})
check("teacher grades submission", r.status_code == 200 and r.json()["data"]["marks"] == 8.5 and r.json()["data"]["status"] == "graded", r.text[:200])
r = call("GET", f"/assignments/{asg_ok}")
check("assignment submitted_count", r.json()["data"]["submitted_count"] == 1, r.text[:150])

# FORCED mid-write failure on submit: patch commit to raise, assert no partial rows
print("── assignments rollback (forced commit failure) ──")
with app.test_client() as tc:
    from extensions import db as ext_db
    orig_commit = ext_db.session.commit
    app.config["PROPAGATE_EXCEPTIONS"] = False  # return 500 instead of re-raising

    def boom():
        raise RuntimeError("forced commit failure")

    ext_db.session.commit = boom  # type: ignore[assignment]
    try:
        resp = tc.post(
            f"{BASE}/assignments/{asg_ok}/submit",
            json={"student_id": IDS["s2"], "content": "should never persist"},
            headers={"Authorization": f"Bearer {TOKENS['student']}"},
        )
        check("forced commit failure -> 500", resp.status_code == 500, resp.status_code)
    finally:
        ext_db.session.commit = orig_commit  # type: ignore[assignment]

with app.app_context():
    from app.models.assignment import AssignmentSubmission
    n = AssignmentSubmission.query.filter_by(school_id=IDS["school"], student_id=IDS["s2"]).count()
    check("forced commit failure wrote ZERO rows (rollback)", n == 0, f"s2 rows={n}")

# ═══ 3. ATTENDANCE LATE RULE ════════════════════════════════════════════════
print("\n── attendance late rule ──")
today = date.today()
dates = [today - timedelta(days=i) for i in (1, 2, 3, 4, 5, 6, 7)]
plan = [("present", dates[0]), ("late", dates[1]), ("present", dates[2]),
        ("late", dates[3]), ("present", dates[4]), ("absent", dates[5]), ("half_day", dates[6])]
for status, d in plan:
    r = call("POST", "/attendance/mark", json={
        "records": [{"student_id": IDS["s1"], "status": status, "class_id": IDS["class_a"]}],
        "date": d.isoformat(),
    })
    assert r.status_code == 200, r.text

# teacher marks S2 late today, S3 present today (class-level rate check)
r = call("POST", "/attendance/mark", role="teacher", json={
    "records": [
        {"student_id": IDS["s2"], "status": "late", "class_id": IDS["class_a"]},
        {"student_id": IDS["s3"], "status": "present", "class_id": IDS["class_a"]},
    ],
    "date": today.isoformat(),
})
check("attendance mark today (late+present)", r.status_code == 200, r.text[:150])

r = call("GET", f"/attendance/student/{IDS['s1']}/summary")
d = r.json()["data"]
# present 3 + late 2 = 5 of 7 -> 71.4 (late counts; half_day/absent do not)
check("student summary percentage counts late", r.status_code == 200 and d["present_days"] == 3 and d["late_days"] == 2 and d["percentage"] == 71.4, json.dumps(d)[:200])

r = call("GET", f"/attendance/summary?class_id={IDS['class_a']}&date={today.isoformat()}")
d = r.json()["data"]
# today: s2 late + s3 present; rate numerator = present + late = 2 of 3 students
# (old rule counted only the 1 present -> 33.3)
check("class summary rate counts late (66.7 not 33.3)", r.status_code == 200 and d["present"] == 1 and d["late"] == 1 and d["attendance_rate"] == 66.7, json.dumps(d)[:200])

r = call("GET", f"/parent/child-attendance?student_id={IDS['s1']}", role="parent")
d = r.json()["data"]["summary"]
check("parent child-attendance counts late", r.status_code == 200 and d["present"] == 3 and d["late"] == 2 and d["half_day"] == 1 and d["percentage"] == 71.4, json.dumps(d)[:250])

r = call("GET", f"/reports/attendance/summary?start_date={(today - timedelta(days=7)).isoformat()}&end_date={today.isoformat()}")
d = r.json()["data"]
# school-wide: 9 rows, present-or-late = 3+2+1+1 = 7 -> 77.8 (old rule: 4/9 = 44.4);
# the per-student row for s1 must still show 71.4 (5/7)
check("reports attendance_rate counts late (77.8)", r.status_code == 200 and d["attendance_rate"] == 77.8, json.dumps(d)[:250])

r = call("GET", "/analytics/overview")
d = r.json()["data"]
# 30-day window: 9 rows (7 for s1: 3p+2l+1a+1hd, today: s2 late + s3 present)
# numerator = 3+2+1+1 = 7 -> 77.8 (old rule: 4/9 = 44.4); today = 2/2 = 100
check("analytics today% counts late (100)", r.status_code == 200 and d["attendance_today_percent"] == 100.0 and d["attendance_rate"] == 77.8, f"today={d.get('attendance_today_percent')} 30d={d.get('attendance_rate')}")

# ═══ 4. EXAMS MARKS (E24 + rollback) ════════════════════════════════════════
print("\n── exams marks ──")
r = call("POST", "/exams", json={
    "name": "Unit Test 1", "exam_type": "unit_test", "academic_year_id": None,
    "subject_ids": [IDS["subject"]], "total_marks": 100, "pass_marks": 32,
})
check("exam create 201", r.status_code == 201, r.text[:200])
exam_id = r.json()["data"]["id"] if r.status_code == 201 else None

# NO class_id anywhere in the payload — the E24 fix resolves it from the student
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [
        {"student_id": IDS["s1"], "subject_id": IDS["subject"], "theory_marks": 78},
        {"student_id": IDS["s2"], "subject_id": IDS["subject"], "theory_marks": 45},
    ],
})
check("marks submit without class_id 200", r.status_code == 200 and r.json()["data"]["new"] == 2, r.text[:200])

r = call("GET", f"/exams/{exam_id}/results?class_id={IDS['class_a']}")
ok = r.status_code == 200 and len(r.json()["data"]) == 2
check("E24: results filter by class finds marks (class persisted)", ok, r.text[:200])

# bogus student in a 2-record batch -> 400, zero rows (rollback of the good one)
r = call("GET", f"/exams/{exam_id}/marks")
before_count = len(r.json()["data"])
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [
        {"student_id": IDS["s3"], "subject_id": IDS["subject"], "theory_marks": 66},
        {"student_id": str(uuid_mod.uuid4()), "subject_id": IDS["subject"], "theory_marks": 50},
    ],
})
check("marks bogus student 400", r.status_code == 400, r.text[:200])
r = call("GET", f"/exams/{exam_id}/marks")
check("marks bogus student wrote ZERO rows", len(r.json()["data"]) == before_count, f"after={len(r.json()['data'])} before={before_count}")

# garbage student id (non-UUID) -> 400 (was DataError 500)
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [{"student_id": "garbage", "subject_id": IDS["subject"], "theory_marks": 50}],
})
check("marks garbage student_id 400", r.status_code == 400, r.text[:200])

# bogus subject / class -> 400
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [{"student_id": IDS["s3"], "subject_id": str(uuid_mod.uuid4()), "theory_marks": 50}],
})
check("marks unknown subject 400", r.status_code == 400, r.text[:200])
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [{"student_id": IDS["s3"], "subject_id": IDS["subject"], "class_id": str(uuid_mod.uuid4()), "theory_marks": 50}],
})
check("marks unknown class 400", r.status_code == 400, r.text[:200])

# FORCED mid-batch failure: numeric(6,2) overflow on record 2 autoflushes during
# record 2's existing-check (batch insert order) — 500 + zero partial rows.
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [
        {"student_id": IDS["s3"], "subject_id": IDS["subject"], "theory_marks": 55},
        {"student_id": IDS["s1"], "subject_id": IDS["subject"], "theory_marks": 100000},
    ],
})
check("marks overflow mid-batch -> 500", r.status_code == 500, r.status_code)
r = call("GET", f"/exams/{exam_id}/marks")
check("marks overflow wrote ZERO partial rows", len(r.json()["data"]) == before_count, f"after={len(r.json()['data'])} before={before_count}")

# re-submit updates existing rows (upsert) and E24 fallback still holds
r = call("POST", f"/exams/{exam_id}/marks", json={
    "marks": [{"student_id": IDS["s1"], "subject_id": IDS["subject"], "theory_marks": 88}],
})
check("marks resubmit updates (new=0)", r.status_code == 200 and r.json()["data"]["updated"] == 1 and r.json()["data"]["new"] == 0, r.text[:150])

print("\n════ SUMMARY ══")
failed = [r for r in results if not r[1]]
print(f"total={len(results)} pass={len(results)-len(failed)} fail={len(failed)}")

# ═══ CLEANUP ════════════════════════════════════════════════════════════════
with app.app_context():
    from app.models.school import School
    cleanup_school(created["school_id"], "final")
    left = School.query.filter(School.slug.like("e24batch-%")).count()
    print(f"cleanup: leftover e24batch schools = {left}")

sys.exit(1 if failed else 0)
