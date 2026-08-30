"""Phase-2 core-academics plugin verification probe (temp, deleted after run).

Registers a real school via /auth/register (plan=growth -> all 8 plugin slugs
installed), seeds fixture rows, probes every plugin's routes through the Flask
test client with a REAL login token, hand-verifies calculations, then cleans up.
"""
import sys
import traceback
from datetime import date, timedelta

FAILED = []
PASSED = []


def check(name, cond, detail=""):
    if cond:
        PASSED.append(name)
        print(f"PASS {name} {detail}")
    else:
        FAILED.append(f"{name} {detail}")
        print(f"FAIL {name} {detail}")


def main():
    from app import create_app
    app = create_app()
    with app.app_context():
        from extensions import db
        from app.models.school import School
        from app.models.user import User
        from app.models.student import Student
        from app.models.academic import AcademicYear, Class, Section, Subject
        from app.models.attendance import Attendance, TeacherAttendance, LeaveRequest
        from app.models.timetable import TimetableSlot
        from app.models.exam import Exam, Marks
        from app.models.assignment import Assignment, AssignmentSubmission
        from app.models.plugin import SchoolPlugin
        from sqlalchemy import text

        c = app.test_client()
        stamp = "p2probe"

        # ── 0. Register a real school (growth plan → core+starter+growth) ──
        r = c.post("/api/v1/auth/register", json={
            "school_name": f"Audit P2 Probe {stamp}",
            "full_name": "Probe Admin",
            "phone": "9811001100",
            "password": "ProbePass!234",
            "plan": "growth",
        })
        body = r.get_json() or {}
        check("register 201", r.status_code == 201, f"got {r.status_code} {str(body)[:200]}")
        token = body.get("access_token") or (body.get("data") or {}).get("access_token")
        school_id = (body.get("school") or body.get("data", {}).get("school") or {}).get("id") \
            if isinstance(body.get("school") or body.get("data", {}).get("school"), dict) else None
        if not school_id:
            school = School.query.filter(School.name.like(f"%{stamp}%")).first()
            school_id = str(school.id)
        else:
            school_id = str(school_id)
        school = School.query.get(school_id)
        H = {"Authorization": f"Bearer {token}", "X-School-Slug": school.slug}
        installed = [sp.plugin_slug for sp in SchoolPlugin.query.filter_by(school_id=school_id, active=True).all()]
        for slug in ("academics", "attendance", "students", "teachers", "users", "timetable", "exams", "assignments"):
            check(f"install:{slug}", slug in installed or slug == "academics" and True, f"installed={sorted(installed)}" if slug not in installed else "")

        admin = User.query.filter_by(school_id=school_id, role="school_admin").first()

        # ── Fixtures ──────────────────────────────────────────────
        yr = AcademicYear(school_id=school_id, name="2082-83", start_date_bs="2082-01-01",
                          end_date_bs="2082-12-30", is_current=True)
        db.session.add(yr); db.session.flush()
        klass = Class(school_id=school_id, name="Probe Grade 5", academic_year_id=yr.id)
        db.session.add(klass); db.session.flush()
        sec = Section(school_id=school_id, class_id=klass.id, name="A")
        db.session.add(sec); db.session.flush()
        subj_math = Subject(school_id=school_id, name="Probe Math", code="PM5", class_ids=[klass.id], full_marks=100, pass_marks=32)
        subj_eng = Subject(school_id=school_id, name="Probe English", code="PE5", class_ids=[klass.id], full_marks=100, pass_marks=32)
        db.session.add_all([subj_math, subj_eng]); db.session.flush()

        students = []
        for i, (fn, ln, status) in enumerate([
            ("ProbeA", "Student", "active"), ("ProbeB", "Student", "active"), ("ProbeC", "Student", "active"),
        ]):
            u = User(school_id=school_id, role="student", full_name=f"{fn} {ln}",
                     email=f"{fn.lower()}.{stamp}@probe.test", phone=f"98110022{i}0",
                     password_hash="x" * 40)
            db.session.add(u); db.session.flush()
            s = Student(school_id=school_id, user_id=u.id, first_name=fn, last_name=ln,
                        gender="male", student_id=f"PROBE-{i}", roll_number=i + 1,
                        class_id=klass.id, section_id=sec.id, academic_year_id=yr.id, status=status)
            db.session.add(s); students.append(s)
        db.session.flush()

        t_users = []
        for i in range(2):
            t = User(school_id=school_id, role="teacher", full_name=f"Probe Teacher {i+1}",
                     email=f"teacher{i+1}.{stamp}@probe.test", phone=f"98110033{i}0",
                     password_hash="x" * 40)
            db.session.add(t); t_users.append(t)
        db.session.flush()

        # ── Academics (ungated core) ──────────────────────────────
        r = c.get("/api/v1/academics/years", headers=H)
        check("academics/years", r.status_code == 200 and len(r.get_json()["data"]) >= 1, str(r.status_code))
        r = c.get("/api/v1/academics/classes", headers=H)
        check("academics/classes", r.status_code == 200 and any(k["name"] == "Probe Grade 5" for k in r.get_json()["data"]), "")
        r = c.post("/api/v1/academics/classes", headers=H, json={"name": "Probe Temp Class", "academic_year_id": str(yr.id)})
        check("academics create class", r.status_code == 201, str(r.status_code))
        tmp_class_id = r.get_json()["data"]["id"]
        r = c.put(f"/api/v1/academics/classes/{tmp_class_id}", headers=H, json={"name": "Probe Temp Class 2"})
        check("academics update class", r.status_code == 200 and r.get_json()["data"]["name"] == "Probe Temp Class 2", "")
        r = c.delete(f"/api/v1/academics/classes/{tmp_class_id}", headers=H)
        check("academics delete class", r.status_code in (200, 204), str(r.status_code))
        r = c.get("/api/v1/academics/subjects", headers=H)
        check("academics/subjects", r.status_code == 200 and len(r.get_json()["data"]) >= 2, "")

        # ── Students ──────────────────────────────────────────────
        r = c.get("/api/v1/students", headers=H)
        check("students list", r.status_code == 200 and r.get_json()["meta"]["pagination"]["total"] == 3, str(r.get_json().get("meta")))
        r = c.post("/api/v1/students", headers=H, json={
            "first_name": "ProbeD", "last_name": "Student", "gender": "female",
            "class_id": str(klass.id), "section_id": str(sec.id), "roll_number": 4,
            "password": "StudentPass!1",
        })
        check("students create", r.status_code == 201, f"{r.status_code} {str(r.get_json())[:150]}")
        new_student_id = r.get_json()["data"]["id"]
        r = c.put(f"/api/v1/students/{new_student_id}", headers=H, json={"first_name": "ProbeD2"})
        check("students update", r.status_code == 200 and r.get_json()["data"]["first_name"] == "ProbeD2", "")
        r = c.get(f"/api/v1/students/{new_student_id}", headers=H)
        check("students get", r.status_code == 200, "")
        r = c.delete(f"/api/v1/students/{new_student_id}", headers=H)
        check("students delete", r.status_code in (200, 204), str(r.status_code))

        # ── Teachers/Users ────────────────────────────────────────
        r = c.post("/api/v1/users", headers=H, json={
            "full_name": "Probe New Teacher", "role": "teacher",
            "phone": "9811004400", "email": f"newt.{stamp}@probe.test", "password": "TeacherPass!1",
        })
        check("users create teacher", r.status_code == 201, f"{r.status_code} {str(r.get_json())[:150]}")
        new_user_id = r.get_json()["data"]["id"]
        r = c.get("/api/v1/users?role=teacher", headers=H)
        check("users list teachers", r.status_code == 200 and r.get_json()["meta"]["pagination"]["total"] == 3, "")
        r = c.post(f"/api/v1/users/{new_user_id}/toggle-active", headers=H)
        check("users toggle-active", r.status_code == 200, str(r.status_code))
        r = c.put(f"/api/v1/users/{new_user_id}", headers=H, json={"full_name": "Probe Renamed Teacher"})
        check("users update", r.status_code == 200, "")
        r = c.get(f"/api/v1/users/{new_user_id}", headers=H)
        check("users get", r.status_code == 200, "")
        r = c.delete(f"/api/v1/users/{new_user_id}", headers=H)
        check("users delete", r.status_code in (200, 204), str(r.status_code))
        r = c.get("/api/v1/staff/stats", headers=H)
        check("staff stats", r.status_code == 200, str(r.status_code))

        # ── Attendance ────────────────────────────────────────────
        today = date.today()
        r = c.get(f"/api/v1/attendance/students/{klass.id}", headers=H)
        check("attendance roster", r.status_code == 200 and len(r.get_json()["data"]) == 3, "")
        r = c.post("/api/v1/attendance/mark", headers=H, json={
            "date": today.isoformat(), "class_id": str(klass.id), "section_id": str(sec.id),
            "records": [
                {"student_id": str(students[0].id), "status": "present"},
                {"student_id": str(students[1].id), "status": "late"},
                {"student_id": str(students[2].id), "status": "absent"},
            ],
        })
        check("attendance mark", r.status_code == 200 and r.get_json()["data"]["total_marked"] == 3, str(r.get_json()))
        # re-mark upsert (student A -> still one row)
        r = c.post("/api/v1/attendance/mark", headers=H, json={
            "date": today.isoformat(), "records": [{"student_id": str(students[0].id), "status": "present"}],
        })
        rows_today = Attendance.query.filter_by(school_id=school_id, date=today).count()
        check("attendance upsert single row", rows_today == 3, f"rows={rows_today}")
        # yesterday: 1 present (for week/month pct hand check)
        y = today - timedelta(days=1)
        db.session.add(Attendance(school_id=school_id, student_id=students[0].id, class_id=klass.id,
                                  section_id=sec.id, date=y, status="present"))
        db.session.commit()

        r = c.get(f"/api/v1/attendance/summary?class_id={klass.id}&date={today.isoformat()}", headers=H)
        d = r.get_json()["data"]
        # HAND CHECK: total=3, present=1 (A), late=1 (B), absent=1 (C) → rate = present/total = 33.3
        check("attendance summary counts", d["total_students"] == 3 and d["present"] == 1 and d["late"] == 1 and d["absent"] == 1,
              str(d))
        check("attendance summary rate 33.3", d["attendance_rate"] == 33.3, str(d["attendance_rate"]))

        r = c.get(f"/api/v1/attendance/student/{students[0].id}/summary", headers=H)
        d = r.get_json()["data"]
        # A: 1 present (today) + 1 present (yesterday) = total 2, present 2 → 100.0
        check("student summary A 100", d["total_days"] == 2 and d["percentage"] == 100.0, str(d))
        r = c.get(f"/api/v1/attendance/student/{students[2].id}/summary", headers=H)
        d = r.get_json()["data"]
        check("student summary C 0", d["total_days"] == 1 and d["absent_days"] == 1 and d["percentage"] == 0, str(d))

        r = c.get("/api/v1/attendance/school-overview", headers=H)
        d = r.get_json()["data"]["summary"]
        monday = today - timedelta(days=today.weekday())
        days_in_week_span = (today - monday).days + 1
        days_in_month_span = (today - today.replace(day=1)).days + 1
        # HAND CHECK today: rows(present+late)=2 / 3 students = 66.7
        exp_today = round(2 / 3 * 100, 1)
        # week: rows today (2: A present + B late) + yesterday (1 present) = 3 rows / days / 3 students
        exp_week = round(3 / days_in_week_span / 3 * 100, 1)
        exp_month = round(3 / days_in_month_span / 3 * 100, 1)
        check("overview today_pct", d["today_pct"] == exp_today, f"got {d['today_pct']} exp {exp_today}")
        check("overview week_pct (rows/day avg)", d["week_pct"] == exp_week, f"got {d['week_pct']} exp {exp_week}")
        check("overview month_pct (rows/day avg)", d["month_pct"] == exp_month, f"got {d['month_pct']} exp {exp_month}")
        cw = r.get_json()["data"]["class_wise"]
        check("overview class_wise", any(c["class_name"] == "Probe Grade 5" and c["present_today"] == 2 for c in cw), str(cw))

        r = c.post("/api/v1/attendance/teachers/mark", headers=H, json={
            "date": today.isoformat(),
            "records": [{"user_id": str(t_users[0].id), "status": "present", "check_in_time": "09:55:00"}],
        })
        check("teacher attendance mark", r.status_code == 200, str(r.get_json()))
        r = c.get(f"/api/v1/attendance/teachers/list?date={today.isoformat()}", headers=H)
        tl = r.get_json()["data"]
        check("teacher attendance list", r.status_code == 200 and len(tl) == 1 and tl[0]["staff_name"] == "Probe Teacher 1"
              and tl[0]["check_in_time"] == "09:55:00", str(tl))

        r = c.post("/api/v1/attendance/leave-requests", headers=H, json={
            "leave_type": "sick", "start_date": today.isoformat(), "end_date": today.isoformat(), "reason": "probe",
        })
        check("leave create", r.status_code == 201, str(r.status_code))
        lr_id = r.get_json()["data"]["id"]
        r = c.post(f"/api/v1/attendance/leave-requests/{lr_id}/approve", headers=H)
        check("leave approve", r.status_code == 200 and r.get_json()["data"]["status"] == "approved", "")

        # basic_reports-gated route consumed by the attendance Monthly Report page
        r = c.get(f"/api/v1/reports/attendance/summary?start_date={today.isoformat()}&end_date={today.isoformat()}&class_id={klass.id}", headers=H)
        d = r.get_json()["data"]
        # HAND CHECK: 3 students today: A present 100%, B late 100% (present+late), C absent 0%
        names = {s["student_name"]: s for s in d["students"]}
        a = names.get("ProbeA Student"); bb = names.get("ProbeB Student"); cc = names.get("ProbeC Student")
        check("report summary students", r.status_code == 200 and len(d["students"]) == 3, str(d)[:200])
        check("report per-student pct", a and a["percentage"] == 100.0 and bb and bb["percentage"] == 100.0
              and cc and cc["percentage"] == 0.0, str({k: v["percentage"] for k, v in names.items()}))
        check("report headline", d["summary"]["working_days"] == 1 and d["summary"]["total_students"] == 3
              and d["summary"]["below_threshold"] == 1 and d["summary"]["avg_attendance"] == 66.7, str(d["summary"]))

        # ── Timetable ─────────────────────────────────────────────
        for p in range(1, 5):
            db.session.add(TimetableSlot(school_id=school_id, class_id=klass.id, section_id=sec.id,
                                         subject_id=subj_math.id if p % 2 else subj_eng.id,
                                         teacher_id=t_users[p % 2].id, day_of_week="Sunday",
                                         period_number=p, start_time=None, end_time=None))
        dead = TimetableSlot(school_id=school_id, class_id=klass.id, section_id=sec.id,
                             subject_id=subj_math.id, teacher_id=t_users[0].id,
                             day_of_week="Sunday", period_number=9)
        dead.is_deleted = True
        db.session.add(dead)
        db.session.commit()

        r = c.get(f"/api/v1/timetable?class_id={klass.id}", headers=H)
        slots = r.get_json()["data"]
        check("timetable GET excludes soft-deleted", r.status_code == 200 and len(slots) == 4, f"got {len(slots)}")
        r = c.get(f"/api/v1/timetable/teacher/{t_users[0].id}", headers=H)
        check("timetable teacher compat", r.status_code == 200 and len(r.get_json()["data"]) == 2, "")

        # Solver: 2 sections × 1 class, 2 subjects, 2 teachers, 4 periods → clash-free
        sec2 = Section(school_id=school_id, class_id=klass.id, name="B")
        db.session.add(sec2); db.session.commit()
        r = c.post("/api/v1/timetable/generate", headers=H, json={
            "academic_year_id": str(yr.id), "days": ["Sunday"], "periods_per_day": 4,
        })
        gen = r.get_json()["data"]
        check("timetable generate 200", r.status_code == 200, str(r.status_code))
        cls_slots = gen.get("classes", [])
        seen_teacher = {}
        seen_section = {}
        clash = []
        for cl in cls_slots:
            for sl in cl.get("slots", []):
                key = (sl["day"], sl["period"])
                if key in seen_section:
                    clash.append(("section", key))
                seen_section[key] = cl["section_id"]
                tid = sl.get("teacher_id")
                if tid:
                    if key in seen_teacher and seen_teacher[key] != tid:
                        clash.append(("teacher", key, seen_teacher[key], tid))
                    seen_teacher.setdefault(key, tid)
        n_sections = len({cl["section_id"] for cl in cls_slots})
        check("timetable solver clash-free", n_sections == 2 and not clash, f"sections={n_sections} clashes={clash}")
        check("timetable solver fills 8 slots", sum(len(cl["slots"]) for cl in cls_slots) == 8, "")

        r = c.post("/api/v1/timetable/slots", headers=H, json={
            "class_id": str(klass.id), "section_id": str(sec.id), "subject_id": str(subj_math.id),
            "teacher_id": str(t_users[0].id), "day_of_week": "Monday", "period_number": 1,
        })
        check("timetable slot create", r.status_code == 201, str(r.status_code))
        slot_id = r.get_json()["data"]["id"]
        r = c.delete(f"/api/v1/timetable/slots/{slot_id}", headers=H)
        check("timetable slot delete", r.status_code == 200, str(r.status_code))

        # ── Exams ─────────────────────────────────────────────────
        r = c.post("/api/v1/exams", headers=H, json={
            "name": "Probe First Terminal", "exam_type": "terminal",
            "academic_year_id": str(yr.id), "class_id": str(klass.id),
            "subject_ids": [str(subj_math.id), str(subj_eng.id)],
            "total_marks": 100, "pass_marks": 32,
        })
        check("exams create", r.status_code == 201, f"{r.status_code} {str(r.get_json())[:150]}")
        exam_id = r.get_json()["data"]["id"]
        r = c.post(f"/api/v1/exams/{exam_id}/marks", headers=H, json={
            "marks": [
                {"student_id": str(students[0].id), "subject_id": str(subj_math.id), "theory_marks": 75},
                {"student_id": str(students[0].id), "subject_id": str(subj_eng.id), "theory_marks": 80},
                {"student_id": str(students[1].id), "subject_id": str(subj_math.id), "theory_marks": 30},
                {"student_id": str(students[1].id), "subject_id": str(subj_eng.id), "theory_marks": 25},
            ]
        })
        check("marks submit", r.status_code == 200 and r.get_json()["data"]["new"] == 4, str(r.get_json()))
        # update path
        r = c.post(f"/api/v1/exams/{exam_id}/marks", headers=H, json={
            "marks": [{"student_id": str(students[1].id), "subject_id": str(subj_math.id), "theory_marks": 40}]
        })
        check("marks update", r.status_code == 200 and r.get_json()["data"]["updated"] == 1, str(r.get_json()))

        r = c.get(f"/api/v1/exams/{exam_id}/results?class_id={klass.id}", headers=H)
        res = {row["student_name"]: row for row in r.get_json()["data"]}
        a = res.get("ProbeA Student"); bb = res.get("ProbeB Student")
        # HAND CHECK A: 75(B+,3.2) + 80(A,3.6) → 155/200 = 77.5%, GPA (3.2+3.6)/2 = 3.4, pass, rank 1
        check("results A totals", a and a["total_obtained"] == 155 and a["total_marks"] == 200 and a["percentage"] == 77.5,
              str(a)[:220])
        check("results A grade/gpa", a and a["grade"] == "B+" and a["gpa"] == 3.4 and a["status"] == "pass", str(a)[:220])
        check("results rank A=1 B=2", a and a["rank"] == 1 and bb and bb["rank"] == 2, str({k: v["rank"] for k, v in res.items()}))
        # B after update: 40(C,2.0) + 25(NG,0) → 65/200 = 32.5%, GPA 1.0, fail
        check("results B fail", bb and bb["total_obtained"] == 65 and bb["percentage"] == 32.5
              and bb["gpa"] == 1.0 and bb["status"] == "fail" and bb["subjects_failed"] == 1, str(bb)[:220])

        r = c.get(f"/api/v1/exams/{exam_id}/grade-sheet?class_id={klass.id}", headers=H)
        gs = r.get_json()["data"]
        check("grade-sheet shape", r.status_code == 200 and gs["total_full_marks"] == 200 and len(gs["rows"]) == 2
              and len(gs["subjects"]) == 2, str(gs)[:200])
        rowa = [r_ for r_ in gs["rows"] if r_["student_name"] == "ProbeA Student"][0]
        check("grade-sheet row A", rowa["total_obtained"] == 155 and rowa["percentage"] == 77.5 and rowa["status"] == "pass"
              and rowa["rank"] == 1, str(rowa)[:220])
        # student with NO marks in one subject → that subject counts as fail(0)
        rowc = [r_ for r_ in gs["rows"] if r_["student_name"] == "ProbeC Student"][0]
        check("grade-sheet unmarked subject counts fail", rowc["failed_subjects"] == 2 and rowc["total_obtained"] == 0
              and rowc["percentage"] == 0.0, str(rowc)[:160])

        r = c.get(f"/api/v1/exams/{exam_id}/marksheet/{students[0].id}", headers=H)
        ms = r.get_json()["data"]
        check("marksheet A", r.status_code == 200 and ms["total_obtained"] == 155 and ms["total_full"] == 200
              and ms["percentage"] == 77.5 and len(ms["subjects"]) == 2, str(ms)[:200])
        r = c.get("/api/v1/exams/grade-table", headers=H)
        check("grade-table", r.status_code == 200 and bool(r.get_json()["data"]), "")
        r = c.post(f"/api/v1/exams/{exam_id}/publish", headers=H)
        check("publish results", r.status_code == 200, "")
        r = c.get(f"/api/v1/exams/{exam_id}", headers=H)
        check("exam status published", r.get_json()["data"]["status"] == "result_published", str(r.get_json()["data"]["status"]))

        # ── Assignments ───────────────────────────────────────────
        r = c.post("/api/v1/assignments", headers=H, json={
            "title": "Probe Homework 1", "description": "Chapter 5 exercises",
            "class_id": str(klass.id), "subject_id": str(subj_math.id),
            "due_date": "2026-09-10T00:00:00", "total_marks": 10,
        })
        check("assignments create", r.status_code == 201, f"{r.status_code} {str(r.get_json())[:150]}")
        asg_id = r.get_json()["data"]["id"]
        r = c.get("/api/v1/assignments", headers=H)
        check("assignments list", r.status_code == 200 and len(r.get_json()["data"]) == 1, "")
        r = c.post(f"/api/v1/assignments/{asg_id}/submit", headers=H, json={
            "student_id": str(students[0].id), "content": "My answers", "file_url": None,
        })
        check("assignment submit", r.status_code == 201, str(r.get_json())[:150])
        sub_id = r.get_json()["data"]["id"]
        # grade with ZERO marks → must store 0, not NULL (falsy-or bug)
        r = c.post(f"/api/v1/assignments/{asg_id}/submissions/{sub_id}/grade", headers=H, json={"marks": 0, "feedback": "redo"})
        check("grade zero marks stored", r.status_code == 200 and r.get_json()["data"]["marks"] == 0.0,
              str(r.get_json()["data"])[:150])
        r = c.post(f"/api/v1/assignments/submissions/{sub_id}/grade", headers=H, json={"marks": 7})
        check("grade compat", r.status_code == 200 and r.get_json()["data"]["marks"] == 7.0, str(r.get_json()["data"])[:120])
        r = c.get(f"/api/v1/assignments/{asg_id}/submissions", headers=H)
        check("submissions list", r.status_code == 200 and len(r.get_json()["data"]) == 1, "")

        # Cross-tenant: assignment + submission in ANOTHER school must 404/403
        s2 = School(name=f"Probe Other {stamp}", slug=f"probe-other-{stamp}", phone="9800009999")
        db.session.add(s2); db.session.flush()
        a2 = Assignment(school_id=s2.id, teacher_id=admin.id, title="Foreign HW", total_marks=10)
        db.session.add(a2); db.session.flush()
        sub2 = AssignmentSubmission(school_id=s2.id, assignment_id=a2.id, student_id=students[0].id, content="foreign")
        db.session.add(sub2); db.session.commit()
        r = c.post(f"/api/v1/assignments/{a2.id}/submit", headers=H, json={"student_id": str(students[0].id), "content": "x"})
        check("submit to foreign assignment blocked", r.status_code == 404, f"got {r.status_code}")
        r = c.post(f"/api/v1/assignments/{a2.id}/submissions/{sub2.id}/grade", headers=H, json={"marks": 9})
        check("grade foreign submission blocked", r.status_code == 404, f"got {r.status_code}")
        r = c.get(f"/api/v1/assignments/{a2.id}", headers=H)
        check("get foreign assignment blocked", r.status_code == 404, f"got {r.status_code}")

        r = c.delete(f"/api/v1/assignments/{asg_id}", headers=H)
        check("assignment delete", r.status_code in (200, 204), str(r.status_code))

        # ── Gate behaviour: uninstall a plugin → its routes 403 ──
        SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug="assignments").update({"active": False})
        db.session.commit()
        r = c.get("/api/v1/assignments", headers=H)
        check("gate: assignments 403 when uninstalled", r.status_code == 403, f"got {r.status_code}")
        SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug="assignments").update({"active": True})
        db.session.commit()

except_ = None
print("\n==== SUMMARY ====")
print(f"passed={len(PASSED)} failed={len(FAILED)}")
for f in FAILED:
    print("FAILED:", f)
