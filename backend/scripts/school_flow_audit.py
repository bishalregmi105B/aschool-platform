"""Real school data-flow audit for ASchool.

This script is intentionally stateful: it logs in as the demo admin, creates a
small but connected school dataset, exercises write/read flows across the major
modules, and then soft-deletes the audit data it created.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import cache, db


LOGIN_EMAIL = "admin@demo.aschool.com.np"
LOGIN_PASSWORD = "changeme123"


REQUIRED_PLUGINS = [
    "admission",
    "alumni",
    "file_management",
    "gamification",
    "gps_tracking",
    "health_records",
    "inventory",
    "library",
    "lms",
    "portfolio",
    "social_hub",
    "visitor_management",
    "wellbeing",
]


@dataclass
class StepResult:
    name: str
    status: str
    details: dict[str, Any] | None = None


class FlowError(RuntimeError):
    pass


class SchoolFlowAudit:
    def __init__(self, keep_data: bool = False, keep_plugins: bool = False):
        self.app = create_app()
        self.app.config["TESTING"] = False
        self.app.config["PROPAGATE_EXCEPTIONS"] = False
        self.client = self.app.test_client()
        self.keep_data = keep_data
        self.keep_plugins = keep_plugins
        self.tag = f"sf{int(time.time()) % 1000000}"
        self.headers: dict[str, str] = {}
        self.teacher_headers: dict[str, str] = {}
        self.student_headers: dict[str, str] = {}
        self.parent_headers: dict[str, str] = {}
        self.admin_user: dict[str, Any] = {}
        self.school_id: str = ""
        self.installed_at_start: set[str] = set()
        self.installed_by_audit: list[str] = []
        self.created: list[tuple[type[Any], str]] = []
        self.steps: list[StepResult] = []
        self.ctx: dict[str, Any] = {
            "today": date.today().isoformat(),
            "tomorrow": (date.today() + timedelta(days=1)).isoformat(),
            "next_week": (date.today() + timedelta(days=7)).isoformat(),
            "now": datetime.now(timezone.utc).isoformat(),
            "later": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        }

    def run(self) -> dict[str, Any]:
        try:
            self.step("auth", self.login)
            self.step("plugins_billing", self.ensure_plugins)
            self.step("users_academics", self.users_and_academics)
            self.step("student_guardian_login", self.student_guardian_login)
            self.step("attendance", self.attendance)
            self.step("assignments", self.assignments)
            self.step("exams_marks_results", self.exams_marks_results)
            self.step("fees_billing_receipts", self.fees_billing_receipts)
            self.step("lms", self.lms)
            self.step("library", self.library)
            self.step("transport_gps", self.transport_gps)
            self.step("notices_events_files", self.notices_events_files)
            self.step("admission_inventory_visitor", self.admission_inventory_visitor)
            self.step("health_wellbeing_portfolio", self.health_wellbeing_portfolio)
            self.step("alumni_social_gamification", self.alumni_social_gamification)
            self.step("mobile_app_flows", self.mobile_app_flows)
            self.step("dashboard_reads", self.dashboard_reads)
            return self.summary("passed")
        except Exception as exc:
            db.session.rollback()
            self.steps.append(
                StepResult(
                    name="failure",
                    status="failed",
                    details={"error": f"{type(exc).__name__}: {exc}"},
                )
            )
            return self.summary("failed")
        finally:
            if not self.keep_data:
                self.cleanup_data()
            if not self.keep_plugins:
                self.cleanup_plugins()

    def step(self, name: str, func) -> None:
        details = func() or {}
        self.steps.append(StepResult(name=name, status="passed", details=details))

    def summary(self, status: str) -> dict[str, Any]:
        return {
            "status": status,
            "tag": self.tag,
            "school_id": self.school_id,
            "steps": [asdict(step) for step in self.steps],
            "installed_by_audit": self.installed_by_audit,
            "keep_data": self.keep_data,
            "keep_plugins": self.keep_plugins,
        }

    # ── HTTP helper ───────────────────────────────────────

    def api(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | list[Any] | None = None,
        data: dict[str, Any] | None = None,
        content_type: str | None = None,
        expected: tuple[int, ...] = (200,),
        allow: tuple[int, ...] = (),
        headers: dict[str, str] | None = None,
    ) -> tuple[Any, int]:
        kwargs: dict[str, Any] = {"headers": headers or self.headers}
        if json_body is not None:
            kwargs["json"] = json_body
        if data is not None:
            kwargs["data"] = data
        if content_type:
            kwargs["content_type"] = content_type

        response = self.client.open(path, method=method, **kwargs)
        payload = response.get_json(silent=True)
        status = response.status_code

        if status >= 500:
            db.session.rollback()
            raise FlowError(f"{method} {path} returned {status}: {payload or response.get_data(as_text=True)[:500]}")

        if status not in expected and status not in allow:
            raise FlowError(f"{method} {path} returned {status}, expected {expected}: {payload}")

        if status in expected and isinstance(payload, dict) and payload.get("success") is False:
            raise FlowError(f"{method} {path} returned success=false: {payload}")

        if payload is None:
            return None, status
        return payload.get("data") if isinstance(payload, dict) and "data" in payload else payload, status

    def register(self, model: type[Any], data: dict[str, Any] | None) -> str:
        if not data or not data.get("id"):
            raise FlowError(f"Cannot register {model.__name__}; response has no id: {data}")
        item_id = str(data["id"])
        self.created.append((model, item_id))
        return item_id

    # ── Flow steps ────────────────────────────────────────

    def login(self) -> dict[str, Any]:
        response = self.client.post(
            "/api/v1/auth/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        )
        payload = response.get_json(silent=True) or {}
        data = payload.get("data") or {}
        token = data.get("access_token")
        if response.status_code != 200 or not token:
            raise FlowError(f"Login failed: {response.status_code} {payload}")
        self.headers = {"Authorization": f"Bearer {token}"}
        self.admin_user = data.get("user") or {}
        self.school_id = str(self.admin_user.get("school_id") or "")
        return {"login": LOGIN_EMAIL, "role": self.admin_user.get("role")}

    def login_headers(self, email_or_phone: str, password: str) -> dict[str, str]:
        response = self.client.post(
            "/api/v1/auth/login",
            json={"email": email_or_phone, "password": password},
        )
        payload = response.get_json(silent=True) or {}
        token = ((payload.get("data") or {}).get("access_token") or "")
        if response.status_code != 200 or not token:
            raise FlowError(f"Login failed for {email_or_phone}: {response.status_code} {payload}")
        return {"Authorization": f"Bearer {token}"}

    def ensure_plugins(self) -> dict[str, Any]:
        installed, _ = self.api("GET", "/api/v1/plugins/installed")
        self.installed_at_start = {item["plugin_slug"] for item in installed}
        for slug in REQUIRED_PLUGINS:
            if slug in self.installed_at_start:
                continue
            data, _ = self.api(
                "POST",
                "/api/v1/plugins/install",
                json_body={"plugin_slug": slug, "billing_cycle": "monthly"},
                expected=(201,),
                allow=(409,),
            )
            if isinstance(data, dict) and data.get("plugin_slug") == slug:
                self.installed_by_audit.append(slug)
        cache.delete(f"school:{self.school_id}:plugins")
        installed_after, _ = self.api("GET", "/api/v1/plugins/installed")
        active = {item["plugin_slug"] for item in installed_after}
        missing = [slug for slug in REQUIRED_PLUGINS if slug not in active]
        if missing:
            raise FlowError(f"Required plugins not active after install: {missing}")
        return {"required": REQUIRED_PLUGINS, "installed_by_audit": self.installed_by_audit}

    def users_and_academics(self) -> dict[str, Any]:
        from app.models.academic import AcademicYear, Class, Medium, Section, Semester, Shift, Stream, Subject
        from app.models.user import User

        teacher, _ = self.api(
            "POST",
            "/api/v1/users",
            json_body={
                "full_name": f"ASFA Teacher {self.tag}",
                "email": f"teacher.{self.tag}@audit.aschool.local",
                "phone": self.phone(1),
                "role": "teacher",
                "password": "changeme123",
                "is_active": True,
            },
            expected=(201,),
        )
        teacher_id = self.register(User, teacher)
        self.ctx["teacher_id"] = teacher_id
        self.teacher_headers = self.login_headers(f"teacher.{self.tag}@audit.aschool.local", "changeme123")

        year, _ = self.api(
            "POST",
            "/api/v1/academics/years",
            json_body={
                "name": f"2082-{self.tag[-4:]}",
                "start_date_bs": "2082-01-01",
                "end_date_bs": "2082-12-30",
                "start_date_ad": self.ctx["today"],
                "end_date_ad": (date.today() + timedelta(days=330)).isoformat(),
            },
            expected=(201,),
        )
        year_id = self.register(AcademicYear, year)
        self.ctx["academic_year_id"] = year_id
        self.ctx["academic_year_name"] = year["name"]

        semester, _ = self.api(
            "POST",
            "/api/v1/academics/semesters",
            json_body={
                "academic_year_id": year_id,
                "name": f"Term {self.tag}",
                "start_date_ad": self.ctx["today"],
                "end_date_ad": (date.today() + timedelta(days=120)).isoformat(),
                "sort_order": 1,
            },
            expected=(201,),
        )
        self.ctx["semester_id"] = self.register(Semester, semester)

        medium, _ = self.api(
            "POST",
            "/api/v1/academics/mediums",
            json_body={"name": f"English {self.tag}", "code": f"EN{self.tag[-4:]}"},
            expected=(201,),
        )
        medium_id = self.register(Medium, medium)
        self.ctx["medium_id"] = medium_id

        stream, _ = self.api(
            "POST",
            "/api/v1/academics/streams",
            json_body={"name": f"General {self.tag}", "code": f"GN{self.tag[-4:]}"},
            expected=(201,),
        )
        stream_id = self.register(Stream, stream)
        self.ctx["stream_id"] = stream_id

        shift, _ = self.api(
            "POST",
            "/api/v1/academics/shifts",
            json_body={"name": f"Morning {self.tag}", "start_time": "09:00", "end_time": "15:30"},
            expected=(201,),
        )
        shift_id = self.register(Shift, shift)
        self.ctx["shift_id"] = shift_id

        klass, _ = self.api(
            "POST",
            "/api/v1/academics/classes",
            json_body={
                "name": f"Flow Grade {self.tag[-4:]}",
                "grade_number": 8,
                "sort_order": 8,
                "academic_year_id": year_id,
                "medium_id": medium_id,
                "stream_id": stream_id,
            },
            expected=(201,),
        )
        class_id = self.register(Class, klass)
        self.ctx["class_id"] = class_id

        section, _ = self.api(
            "POST",
            f"/api/v1/academics/classes/{class_id}/sections",
            json_body={
                "name": "A",
                "capacity": 35,
                "class_teacher_id": teacher_id,
                "medium_id": medium_id,
                "shift_id": shift_id,
            },
            expected=(201,),
        )
        section_id = self.register(Section, section)
        self.ctx["section_id"] = section_id

        subject, _ = self.api(
            "POST",
            "/api/v1/academics/subjects",
            json_body={
                "name": f"Mathematics {self.tag}",
                "code": f"M{self.tag[-5:]}",
                "class_ids": [class_id],
                "teacher_ids": [teacher_id],
                "credit_hours": 5,
                "full_marks": 100,
                "pass_marks": 35,
            },
            expected=(201,),
        )
        subject_id = self.register(Subject, subject)
        self.ctx["subject_id"] = subject_id

        self.api("GET", f"/api/v1/academics/classes/{class_id}/sections")
        self.api("GET", f"/api/v1/academics/classes/{class_id}/subjects")
        self.api("GET", f"/api/v1/users/{teacher_id}")

        return {
            "teacher_id": teacher_id,
            "class_id": class_id,
            "section_id": section_id,
            "subject_id": subject_id,
        }

    def student_guardian_login(self) -> dict[str, Any]:
        from app.models.student import Guardian, Student
        from app.models.user import User

        student_code = f"ASFA-{self.tag}"
        student, _ = self.api(
            "POST",
            "/api/v1/students",
            json_body={
                "first_name": "Asha",
                "last_name": f"Audit {self.tag}",
                "student_id": student_code,
                "roll_number": 7,
                "class_id": self.ctx["class_id"],
                "section_id": self.ctx["section_id"],
                "academic_year_id": self.ctx["academic_year_id"],
                "gender": "female",
                "phone": self.phone(2),
                "email": f"student.{self.tag}@audit.aschool.local",
                "password": "studentpass123",
                "guardians": [
                    {
                        "full_name": f"Parent Audit {self.tag}",
                        "relation": "father",
                        "phone": self.phone(3),
                        "email": f"parent.{self.tag}@audit.aschool.local",
                        "is_primary": True,
                    }
                ],
            },
            expected=(201,),
        )
        student_id = self.register(Student, student)
        self.ctx["student_id"] = student_id

        guardian, _ = self.api(
            "POST",
            f"/api/v1/students/{student_id}/guardians",
            json_body={
                "full_name": f"Mother Audit {self.tag}",
                "relation": "mother",
                "phone": self.phone(4),
                "email": f"mother.{self.tag}@audit.aschool.local",
                "is_primary": False,
            },
            expected=(201,),
        )
        self.register(Guardian, guardian)

        db_student = Student.query.get(student_id)
        if not db_student or not db_student.user_id:
            raise FlowError("Student account user was not created")
        self.ctx["student_user_id"] = str(db_student.user_id)
        self.created.append((User, str(db_student.user_id)))

        self.api("GET", f"/api/v1/students/{student_id}")
        self.api("GET", f"/api/v1/students?class_id={self.ctx['class_id']}")
        self.api("GET", f"/api/v1/students/{student_id}/guardians")

        response = self.client.post(
            "/api/v1/auth/student-login",
            json={"student_id": student_code, "password": "studentpass123"},
        )
        payload = response.get_json(silent=True) or {}
        if response.status_code != 200 or not (payload.get("data") or {}).get("access_token"):
            raise FlowError(f"Student login failed: {response.status_code} {payload}")
        self.student_headers = {"Authorization": f"Bearer {(payload.get('data') or {}).get('access_token')}"}

        parent_guardian = Guardian.query.filter_by(
            school_id=self.school_id,
            student_id=student_id,
            is_primary=True,
            is_deleted=False,
        ).first()
        if parent_guardian and parent_guardian.user_id:
            parent_user = User.query.get(parent_guardian.user_id)
            if parent_user:
                parent_user.set_password("parentpass123")
                db.session.commit()
                self.parent_headers = self.login_headers(parent_user.email or parent_user.phone, "parentpass123")

        return {"student_id": student_id, "student_login": "passed"}

    def attendance(self) -> dict[str, Any]:
        self.api(
            "POST",
            "/api/v1/attendance/mark",
            json_body={
                "date": self.ctx["today"],
                "records": [
                    {
                        "student_id": self.ctx["student_id"],
                        "class_id": self.ctx["class_id"],
                        "section_id": self.ctx["section_id"],
                        "status": "present",
                        "remarks": f"Flow audit {self.tag}",
                    }
                ],
            },
        )
        self.api("GET", f"/api/v1/attendance/list?class_id={self.ctx['class_id']}&date={self.ctx['today']}")
        self.api("GET", f"/api/v1/attendance/summary?class_id={self.ctx['class_id']}&date={self.ctx['today']}")
        self.api("GET", f"/api/v1/attendance/student/{self.ctx['student_id']}/summary")
        return {"attendance_date": self.ctx["today"]}

    def assignments(self) -> dict[str, Any]:
        from app.models.assignment import Assignment, AssignmentSubmission

        due_at = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        assignment, _ = self.api(
            "POST",
            "/api/v1/assignments",
            json_body={
                "title": f"Flow Homework {self.tag}",
                "description": "Solve the audit worksheet.",
                "class_id": self.ctx["class_id"],
                "section_id": self.ctx["section_id"],
                "subject_id": self.ctx["subject_id"],
                "due_date": due_at,
                "total_marks": 20,
            },
            expected=(201,),
        )
        assignment_id = self.register(Assignment, assignment)
        self.ctx["assignment_id"] = assignment_id

        submission, _ = self.api(
            "POST",
            f"/api/v1/assignments/{assignment_id}/submit",
            json_body={
                "student_id": self.ctx["student_id"],
                "content": "Completed all questions.",
            },
            expected=(201,),
        )
        submission_id = self.register(AssignmentSubmission, submission)

        self.api(
            "POST",
            f"/api/v1/assignments/{assignment_id}/submissions/{submission_id}/grade",
            json_body={"marks": 18, "feedback": "Clear work."},
        )
        self.api("GET", f"/api/v1/assignments?class_id={self.ctx['class_id']}")
        self.api("GET", f"/api/v1/assignments/{assignment_id}/submissions")
        return {"assignment_id": assignment_id, "submission_id": submission_id}

    def exams_marks_results(self) -> dict[str, Any]:
        from app.models.exam import Exam, OnlineExam, OnlineExamAttempt

        exam, _ = self.api(
            "POST",
            "/api/v1/exams",
            json_body={
                "name": f"First Terminal {self.tag}",
                "academic_year_id": self.ctx["academic_year_id"],
                "exam_type": "terminal",
                "class_id": self.ctx["class_id"],
                "subject_ids": [self.ctx["subject_id"]],
                "start_date": self.ctx["today"],
                "end_date": self.ctx["next_week"],
                "total_marks": 100,
                "pass_marks": 35,
            },
            expected=(201,),
        )
        exam_id = self.register(Exam, exam)
        self.ctx["exam_id"] = exam_id

        self.api(
            "POST",
            f"/api/v1/exams/{exam_id}/marks",
            json_body={
                "subject_id": self.ctx["subject_id"],
                "marks": [
                    {
                        "student_id": self.ctx["student_id"],
                        "subject_id": self.ctx["subject_id"],
                        "class_id": self.ctx["class_id"],
                        "theory_marks": 82,
                        "full_marks": 100,
                        "pass_marks": 35,
                        "remarks": "Strong performance.",
                    }
                ],
            },
        )
        self.api("GET", f"/api/v1/exams/{exam_id}/marks?class_id={self.ctx['class_id']}&subject_id={self.ctx['subject_id']}")
        self.api("GET", f"/api/v1/exams/{exam_id}/results?class_id={self.ctx['class_id']}")
        self.api("GET", f"/api/v1/exams/results?student_id={self.ctx['student_id']}")
        self.api("POST", f"/api/v1/exams/{exam_id}/publish")

        online_exam, _ = self.api(
            "POST",
            "/api/v1/exams/online",
            json_body={
                "title": f"Online Quiz {self.tag}",
                "class_id": self.ctx["class_id"],
                "section_id": self.ctx["section_id"],
                "subject_id": self.ctx["subject_id"],
                "duration_minutes": 15,
                "status": "active",
                "questions": [
                    {
                        "id": "q1",
                        "question": "2 + 2?",
                        "options": ["3", "4", "5"],
                        "correct_answer": "4",
                        "marks": 5,
                    }
                ],
            },
            expected=(201,),
        )
        online_exam_id = self.register(OnlineExam, online_exam)
        self.ctx["online_exam_id"] = online_exam_id
        attempt, _ = self.api(
            "POST",
            f"/api/v1/exams/online/{online_exam_id}/submit",
            json_body={"student_id": self.ctx["student_id"], "answers": {"q1": "4"}},
            expected=(201,),
        )
        self.register(OnlineExamAttempt, attempt)
        return {"exam_id": exam_id, "online_exam_id": online_exam_id}

    def fees_billing_receipts(self) -> dict[str, Any]:
        from app.models.fee import FeeCollection, FeeReceipt, FeeStructure

        structure, _ = self.api(
            "POST",
            "/api/v1/fees/structures",
            json_body={
                "class_id": self.ctx["class_id"],
                "academic_year": self.ctx["academic_year_name"],
                "fee_items": [
                    {"name": "Tuition", "amount": 3000},
                    {"name": "Library", "amount": 500},
                ],
                "total_annual": 42000,
                "total_monthly": 3500,
            },
            expected=(201,),
        )
        self.register(FeeStructure, structure)

        collection, _ = self.api(
            "POST",
            "/api/v1/fees/collections",
            json_body={
                "student_id": self.ctx["student_id"],
                "academic_year": self.ctx["academic_year_name"],
                "fee_item_name": "Tuition",
                "amount": 3000,
                "payment_status": "pending",
            },
            expected=(201,),
        )
        collection_id = self.register(FeeCollection, collection)
        self.ctx["fee_collection_id"] = collection_id

        payment, _ = self.api(
            "POST",
            f"/api/v1/fees/collections/{collection_id}/pay",
            json_body={"amount": 3000, "payment_method": "cash", "transaction_id": f"TXN-{self.tag}"},
        )
        receipt = payment.get("receipt") if isinstance(payment, dict) else None
        receipt_id = self.register(FeeReceipt, receipt)
        self.ctx["receipt_id"] = receipt_id

        self.api("GET", f"/api/v1/fees/collections/{collection_id}/receipt")
        self.api("GET", f"/api/v1/fees/receipts/{receipt_id}/pdf", expected=(200,), allow=(501,))

        online_collection, _ = self.api(
            "POST",
            "/api/v1/fees/collections",
            json_body={
                "student_id": self.ctx["student_id"],
                "academic_year": self.ctx["academic_year_name"],
                "fee_item_name": "Online Payment Trial",
                "amount": 100,
                "payment_status": "pending",
            },
            expected=(201,),
        )
        online_collection_id = self.register(FeeCollection, online_collection)
        self.api(
            "POST",
            f"/api/v1/fees/collections/{online_collection_id}/pay-online",
            json_body={"provider": "esewa", "return_url": "https://demo.aschool.com.np"},
        )
        return {"collection_id": collection_id, "receipt_id": receipt_id}

    def lms(self) -> dict[str, Any]:
        from app.models.lms import Course, Enrollment, Lesson, Quiz, QuizAttempt, StudyMaterial, Topic

        course, _ = self.api(
            "POST",
            "/api/v1/lms/courses",
            json_body={
                "title": f"Math Course {self.tag}",
                "description": "Flow audit course.",
                "class_id": self.ctx["class_id"],
                "subject_id": self.ctx["subject_id"],
                "status": "published",
                "is_published": True,
            },
            expected=(201,),
        )
        course_id = self.register(Course, course)
        lesson, _ = self.api(
            "POST",
            f"/api/v1/lms/courses/{course_id}/lessons",
            json_body={"title": "Numbers", "content": "Natural numbers", "content_type": "text", "sort_order": 1},
            expected=(201,),
        )
        lesson_id = self.register(Lesson, lesson)
        topic, _ = self.api(
            "POST",
            "/api/v1/lms/topics",
            json_body={"lesson_id": lesson_id, "title": "Addition", "description": "Basic addition"},
            expected=(201,),
        )
        topic_id = self.register(Topic, topic)
        material, _ = self.api(
            "POST",
            "/api/v1/lms/materials",
            json_body={"topic_id": topic_id, "title": "Worksheet", "material_type": "file", "file_url": "/audit/worksheet.pdf"},
            expected=(201,),
        )
        self.register(StudyMaterial, material)
        quiz, _ = self.api(
            "POST",
            f"/api/v1/lms/courses/{course_id}/quizzes",
            json_body={
                "title": f"Course Quiz {self.tag}",
                "total_marks": 5,
                "questions": [{"id": "q1", "question": "1+1", "correct_answer": "2", "marks": 5}],
            },
            expected=(201,),
        )
        quiz_id = self.register(Quiz, quiz)
        enroll, _ = self.api(
            "POST",
            f"/api/v1/lms/courses/{course_id}/enroll",
            json_body={"student_id": self.ctx["student_user_id"]},
            expected=(201,),
        )
        self.created.append((Enrollment, self.lookup_enrollment(course_id, self.ctx["student_user_id"])))
        attempt, _ = self.api(
            "POST",
            f"/api/v1/lms/quizzes/{quiz_id}/attempt",
            json_body={"answers": {"q1": "2"}, "score": 5},
            expected=(201,),
        )
        self.register(QuizAttempt, attempt)
        self.api("GET", f"/api/v1/lms/courses/{course_id}/progress?student_id={self.ctx['student_user_id']}")
        self.api("GET", f"/api/v1/lms/lessons?class_id={self.ctx['class_id']}&subject_id={self.ctx['subject_id']}")
        return {"course_id": course_id, "lesson_id": lesson_id}

    def library(self) -> dict[str, Any]:
        from app.models.library import Book, BookIssue

        book, _ = self.api(
            "POST",
            "/api/v1/library/books",
            json_body={
                "title": f"Flow Library Book {self.tag}",
                "author": "ASchool Audit",
                "isbn": f"ISBN-{self.tag}",
                "category": "Reference",
                "publisher": "ASchool",
                "total_copies": 2,
                "available_copies": 2,
                "shelf_location": f"A-{self.tag[-3:]}",
            },
            expected=(201,),
        )
        book_id = self.register(Book, book)
        issue, _ = self.api(
            "POST",
            "/api/v1/library/issues",
            json_body={
                "book_id": book_id,
                "student_id": self.ctx["student_id"],
                "due_date": self.ctx["next_week"],
            },
            expected=(201,),
        )
        issue_id = self.register(BookIssue, issue)
        self.api("GET", f"/api/v1/library/issues?status=issued")
        self.api("POST", f"/api/v1/library/issues/{issue_id}/return")
        return {"book_id": book_id, "issue_id": issue_id}

    def transport_gps(self) -> dict[str, Any]:
        from app.models.transport import Bus, BusStop, GPSLog, Route

        route, _ = self.api(
            "POST",
            "/api/v1/transport/routes",
            json_body={"name": f"Audit Route {self.tag}", "distance_km": 4.5, "estimated_time_mins": 25},
            expected=(201,),
        )
        route_id = self.register(Route, route)
        bus, _ = self.api(
            "POST",
            "/api/v1/transport/buses",
            json_body={
                "vehicle_number": f"BA-{self.tag[-4:]}",
                "capacity": 40,
                "gps_device_id": f"GPS-{self.tag}",
                "route_id": route_id,
            },
            expected=(201,),
        )
        bus_id = self.register(Bus, bus)
        stop, _ = self.api(
            "POST",
            "/api/v1/transport/stops",
            json_body={
                "route_id": route_id,
                "name": f"Audit Stop {self.tag}",
                "latitude": 27.7172,
                "longitude": 85.3240,
                "sequence_number": 1,
                "arrival_time_am": "08:15",
                "arrival_time_pm": "15:45",
                "student_ids": [self.ctx["student_id"]],
            },
            expected=(201,),
        )
        stop_id = self.register(BusStop, stop)
        gps, _ = self.api(
            "POST",
            "/api/v1/transport/gps-logs",
            json_body={
                "bus_id": bus_id,
                "latitude": 27.7175,
                "longitude": 85.3245,
                "speed_kmh": 18.2,
                "heading": 90,
                "accuracy_m": 6,
                "timestamp": self.ctx["now"],
            },
            expected=(201,),
        )
        self.register(GPSLog, gps)
        self.api("GET", f"/api/v1/transport/routes?active=true")
        self.api("GET", f"/api/v1/transport/stops?route_id={route_id}")
        self.api("GET", f"/api/v1/transport/gps-logs?bus_id={bus_id}")
        return {"route_id": route_id, "bus_id": bus_id, "stop_id": stop_id}

    def notices_events_files(self) -> dict[str, Any]:
        from app.models.file import FileFolder, ManagedFile
        from app.models.notice import Event, Notice

        notice, _ = self.api(
            "POST",
            "/api/v1/notices",
            json_body={
                "title": f"Flow Notice {self.tag}",
                "content": "Audit notice content.",
                "notice_type": "general",
                "target_roles": ["student", "parent"],
                "is_published": True,
            },
            expected=(201,),
        )
        self.register(Notice, notice)
        event, _ = self.api(
            "POST",
            "/api/v1/notices/events",
            json_body={
                "title": f"Flow Event {self.tag}",
                "description": "Audit calendar event.",
                "event_type": "academic",
                "start_date": self.ctx["tomorrow"],
                "end_date": self.ctx["tomorrow"],
                "start_time": "10:00",
                "end_time": "11:00",
                "location": "Audit Hall",
            },
            expected=(201,),
        )
        self.register(Event, event)

        folder, _ = self.api(
            "POST",
            "/api/v1/files/folders",
            json_body={"name": f"Audit Folder {self.tag}"},
            expected=(201,),
        )
        folder_id = self.register(FileFolder, folder)
        upload, _ = self.api(
            "POST",
            "/api/v1/files/upload",
            data={
                "folder_id": folder_id,
                "folder": "audit",
                "linked_module": "assignments",
                "linked_entity_id": self.ctx["assignment_id"],
                "file": (io.BytesIO(b"ASchool flow audit file\n"), f"flow-{self.tag}.txt"),
            },
            content_type="multipart/form-data",
            expected=(201,),
        )
        file_id = self.register(ManagedFile, upload if isinstance(upload, dict) else upload[0])
        self.api("GET", f"/api/v1/files/{file_id}")
        self.api("GET", f"/api/v1/files/{file_id}/presigned")
        self.api("GET", "/api/v1/files/usage")
        return {"folder_id": folder_id, "file_id": file_id}

    def admission_inventory_visitor(self) -> dict[str, Any]:
        from app.models.admission import AdmissionApplication, AdmissionInquiry
        from app.models.inventory import Asset, AssetAuditLog, ProcurementRequest
        from app.models.visitor import Visitor, VisitorAppointment

        inquiry, _ = self.api(
            "POST",
            "/api/v1/admission/inquiries",
            json_body={
                "student_name": f"Admission Child {self.tag}",
                "guardian_name": f"Admission Parent {self.tag}",
                "phone": self.phone(5),
                "email": f"admission.{self.tag}@audit.aschool.local",
                "class_applied": "Grade 8",
                "source": "walk_in",
                "notes": "Audit inquiry",
            },
            expected=(201,),
        )
        inquiry_id = self.register(AdmissionInquiry, inquiry)
        application, _ = self.api(
            "POST",
            "/api/v1/admission/applications",
            json_body={
                "inquiry_id": inquiry_id,
                "student_name": f"Admission Child {self.tag}",
                "guardian_name": f"Admission Parent {self.tag}",
                "guardian_phone": self.phone(5),
                "class_applied": "Grade 8",
                "previous_school": "Audit School",
                "address": "Kathmandu",
            },
            expected=(201,),
        )
        application_id = self.register(AdmissionApplication, application)
        self.api("PUT", f"/api/v1/admission/applications/{application_id}/status", json_body={"status": "accepted", "remarks": "Audit accepted"})
        self.api("GET", "/api/v1/admission/dashboard")

        asset, _ = self.api(
            "POST",
            "/api/v1/inventory/assets",
            json_body={
                "name": f"Projector {self.tag}",
                "asset_code": f"ASFA-{self.tag}",
                "qr_code": f"QR-{self.tag}",
                "category": "electronics",
                "location": "Room 8A",
                "purchase_date": self.ctx["today"],
                "purchase_price": 25000,
                "current_value": 23000,
                "condition": "new",
            },
            expected=(201,),
        )
        asset_id = self.register(Asset, asset)
        audit, _ = self.api(
            "POST",
            f"/api/v1/inventory/assets/{asset_id}/audit",
            json_body={"action": "created", "new_value": {"condition": "new"}, "notes": "Audit asset check"},
            expected=(201,),
        )
        self.register(AssetAuditLog, audit)
        procurement, _ = self.api(
            "POST",
            "/api/v1/inventory/procurement",
            json_body={
                "title": f"Procurement {self.tag}",
                "items": [{"name": "Whiteboard", "quantity": 1, "estimated_cost": 4000}],
                "total_estimated_cost": 4000,
                "justification": "Audit procurement flow",
                "vendor": "Audit Vendor",
            },
            expected=(201,),
        )
        pr_id = self.register(ProcurementRequest, procurement)
        self.api("POST", f"/api/v1/inventory/procurement/{pr_id}/approve", json_body={"status": "approved", "notes": "Audit approved"})
        self.api("GET", f"/api/v1/inventory/assets/scan/QR-{self.tag}")

        visitor, _ = self.api(
            "POST",
            "/api/v1/visitors/checkin",
            json_body={
                "name": f"Visitor {self.tag}",
                "phone": self.phone(6),
                "purpose": "Parent meeting",
                "visiting_staff_id": self.ctx["teacher_id"],
                "badge_number": f"V-{self.tag[-4:]}",
            },
            expected=(201,),
        )
        visitor_id = self.register(Visitor, visitor)
        self.api("POST", f"/api/v1/visitors/{visitor_id}/checkout")
        appt, _ = self.api(
            "POST",
            "/api/v1/visitors/appointments",
            json_body={
                "visitor_name": f"Appointment Visitor {self.tag}",
                "visitor_phone": self.phone(7),
                "purpose": "Admission discussion",
                "staff_id": self.ctx["teacher_id"],
                "scheduled_at": self.ctx["later"],
            },
            expected=(201,),
        )
        appt_id = self.register(VisitorAppointment, appt)
        self.api("POST", f"/api/v1/visitors/appointments/{appt_id}/approve")
        return {"inquiry_id": inquiry_id, "asset_id": asset_id, "visitor_id": visitor_id}

    def health_wellbeing_portfolio(self) -> dict[str, Any]:
        from app.models.health_records import HealthProfile, Immunization, MedicalVisit
        from app.models.portfolio import MicroCredential, PortfolioItem, StudentPortfolio
        from app.models.wellbeing import CounselorNote, MoodEntry, WellbeingSurvey

        profile, _ = self.api(
            "PUT",
            f"/api/v1/health-records/students/{self.ctx['student_id']}",
            json_body={
                "blood_group": "O+",
                "height_cm": 142.5,
                "weight_kg": 38.2,
                "allergies": ["dust"],
                "medical_conditions": [],
                "emergency_contact": "Parent Audit",
                "emergency_phone": self.phone(3),
                "last_checkup_date": self.ctx["today"],
            },
        )
        self.register(HealthProfile, profile)
        visit, _ = self.api(
            "POST",
            "/api/v1/health-records/visits",
            json_body={
                "student_id": self.ctx["student_id"],
                "visit_date": self.ctx["today"],
                "reason": "Routine check",
                "diagnosis": "Healthy",
                "treatment": "None",
            },
            expected=(201,),
        )
        self.register(MedicalVisit, visit)
        imm, _ = self.api(
            "POST",
            "/api/v1/health-records/immunizations",
            json_body={
                "student_id": self.ctx["student_id"],
                "vaccine_name": "Tetanus",
                "dose_number": 1,
                "date_administered": self.ctx["today"],
                "next_due_date": self.ctx["next_week"],
                "administered_by": "Audit Nurse",
            },
            expected=(201,),
        )
        self.register(Immunization, imm)

        mood, _ = self.api(
            "POST",
            "/api/v1/wellbeing/mood",
            json_body={"student_id": self.ctx["student_id"], "mood": "happy", "energy_level": 5, "notes": "Ready to learn"},
            expected=(201,),
        )
        self.register(MoodEntry, mood)
        note, _ = self.api(
            "POST",
            "/api/v1/wellbeing/counselor-notes",
            json_body={"student_id": self.ctx["student_id"], "type": "general", "content": "Positive adjustment", "is_confidential": True},
            expected=(201,),
        )
        self.register(CounselorNote, note)
        survey, _ = self.api(
            "POST",
            "/api/v1/wellbeing/surveys",
            json_body={"title": f"Wellbeing Survey {self.tag}", "questions": [{"id": "q1", "text": "How are you?"}]},
            expected=(201,),
        )
        self.register(WellbeingSurvey, survey)
        self.api("GET", "/api/v1/wellbeing/mood/summary?days=30")

        portfolio, _ = self.api(
            "PUT",
            f"/api/v1/portfolio/students/{self.ctx['student_id']}",
            json_body={"bio": "Flow audit portfolio", "interests": ["math"], "skills": ["problem solving"], "is_public": False},
        )
        self.register(StudentPortfolio, portfolio)
        item, _ = self.api(
            "POST",
            f"/api/v1/portfolio/students/{self.ctx['student_id']}/items",
            json_body={"title": f"Portfolio Item {self.tag}", "description": "Audit project", "item_type": "project", "tags": ["audit"]},
            expected=(201,),
        )
        self.register(PortfolioItem, item)
        credential, _ = self.api(
            "POST",
            f"/api/v1/portfolio/students/{self.ctx['student_id']}/credentials",
            json_body={"title": f"Math Star {self.tag}", "description": "Audit credential", "issuer": "ASchool", "issued_at": self.ctx["now"]},
            expected=(201,),
        )
        self.register(MicroCredential, credential)
        return {"health_profile": profile["id"], "portfolio": portfolio["id"]}

    def alumni_social_gamification(self) -> dict[str, Any]:
        from app.models.alumni import Alumni, AlumniDonation, AlumniEvent
        from app.models.gamification import Badge, House, PointsLog, Reward, StudentBadge
        from app.models.social import Comment, Group, Post

        alumni, _ = self.api(
            "POST",
            "/api/v1/alumni",
            json_body={
                "student_id": self.ctx["student_id"],
                "first_name": "Alumni",
                "last_name": f"Audit {self.tag}",
                "email": f"alumni.{self.tag}@audit.aschool.local",
                "phone": self.phone(8),
                "graduation_year": "2081",
                "batch": f"Batch {self.tag[-4:]}",
                "current_organization": "ASchool",
                "designation": "Mentor",
                "location": "Kathmandu",
                "is_mentor": True,
            },
            expected=(201,),
        )
        alumni_id = self.register(Alumni, alumni)
        alumni_event, _ = self.api(
            "POST",
            "/api/v1/alumni/events",
            json_body={
                "title": f"Alumni Meetup {self.tag}",
                "description": "Audit alumni event",
                "event_date": self.ctx["later"],
                "location": "School Hall",
                "event_type": "meetup",
                "max_attendees": 25,
            },
            expected=(201,),
        )
        self.register(AlumniEvent, alumni_event)
        donation, _ = self.api(
            "POST",
            "/api/v1/alumni/donations",
            json_body={
                "alumni_id": alumni_id,
                "amount": 1500,
                "currency": "NPR",
                "purpose": "Library",
                "payment_method": "cash",
                "transaction_ref": f"AD-{self.tag}",
                "donated_at": self.ctx["now"],
            },
            expected=(201,),
        )
        self.register(AlumniDonation, donation)

        post, _ = self.api(
            "POST",
            "/api/v1/social/posts",
            json_body={"content": f"Flow social post {self.tag}", "type": "text", "visibility": "school"},
            expected=(201,),
        )
        post_id = self.register(Post, post)
        self.api("POST", f"/api/v1/social/posts/{post_id}/like")
        comment, _ = self.api(
            "POST",
            f"/api/v1/social/posts/{post_id}/comments",
            json_body={"content": "Audit comment"},
            expected=(201,),
        )
        self.register(Comment, comment)
        group, _ = self.api(
            "POST",
            "/api/v1/social/groups",
            json_body={"name": f"Audit Group {self.tag}", "description": "Flow audit group", "type": "class"},
            expected=(201,),
        )
        self.register(Group, group)

        badge, _ = self.api(
            "POST",
            "/api/v1/gamification/badges",
            json_body={"name": f"Audit Badge {self.tag}", "description": "Flow badge", "criteria": {"kind": "audit"}, "points_value": 10},
            expected=(201,),
        )
        badge_id = self.register(Badge, badge)
        points, _ = self.api(
            "POST",
            "/api/v1/gamification/points",
            json_body={"student_id": self.ctx["student_id"], "points": 10, "reason": "Audit excellence", "category": "academic"},
            expected=(201,),
        )
        self.register(PointsLog, points)
        self.api("POST", "/api/v1/gamification/award-badge", json_body={"student_id": self.ctx["student_id"], "badge_id": badge_id}, expected=(201,))
        self.created.append((StudentBadge, self.lookup_student_badge(self.ctx["student_id"], badge_id)))
        house, _ = self.api(
            "POST",
            "/api/v1/gamification/houses",
            json_body={"name": f"Audit House {self.tag}", "color": "#2563eb", "motto": "Learn"},
            expected=(201,),
        )
        self.register(House, house)
        reward, _ = self.api(
            "POST",
            "/api/v1/gamification/rewards",
            json_body={"name": f"Audit Reward {self.tag}", "description": "Flow reward", "points_required": 10, "quantity_available": 5},
            expected=(201,),
        )
        self.register(Reward, reward)
        self.api("GET", f"/api/v1/gamification/points/{self.ctx['student_id']}")
        self.api("GET", "/api/v1/gamification/leaderboard")
        return {"alumni_id": alumni_id, "post_id": post_id, "badge_id": badge_id}

    def mobile_app_flows(self) -> dict[str, Any]:
        if not self.student_headers:
            raise FlowError("Student headers unavailable")
        for path in (
            "/api/v1/student/dashboard",
            "/api/v1/student/assignments",
            "/api/v1/student/results",
            "/api/v1/student/timetable",
            "/api/v1/student/library",
            "/api/v1/student/elibrary",
            "/api/v1/student/lms",
            "/api/v1/student/portfolio",
            "/api/v1/student/achievements",
            "/api/v1/student/wellbeing",
        ):
            self.api("GET", path, headers=self.student_headers)
        self.api(
            "POST",
            "/api/v1/student/wellbeing/mood",
            json_body={"mood": "happy", "note": "Mobile flow audit"},
            headers=self.student_headers,
        )

        if self.teacher_headers:
            for path in (
                "/api/v1/teacher/dashboard",
                "/api/v1/teacher/my-classes",
                "/api/v1/teacher/my-students",
                "/api/v1/teacher/timetable",
                "/api/v1/teacher/assignments",
            ):
                self.api("GET", path, headers=self.teacher_headers)

        if self.parent_headers:
            for path in (
                "/api/v1/parent/dashboard",
                "/api/v1/parent/child-attendance",
                "/api/v1/parent/child-results",
                "/api/v1/parent/outstanding-fees",
                "/api/v1/parent/child-wellbeing",
                "/api/v1/parent/bus-info",
            ):
                self.api("GET", path, headers=self.parent_headers)

        return {
            "student_paths": 11,
            "teacher_paths": 5 if self.teacher_headers else 0,
            "parent_paths": 6 if self.parent_headers else 0,
        }

    def dashboard_reads(self) -> dict[str, Any]:
        read_paths = [
            "/api/v1/plugins/marketplace",
            "/api/v1/academics/classes",
            "/api/v1/students",
            "/api/v1/fees/collections",
            "/api/v1/exams",
            "/api/v1/library/books",
            "/api/v1/transport/routes",
            "/api/v1/inventory/assets",
            "/api/v1/visitors",
            "/api/v1/alumni",
            "/api/v1/social/posts",
        ]
        for path in read_paths:
            self.api("GET", path)
        return {"read_paths": len(read_paths)}

    # ── Lookups / cleanup ─────────────────────────────────

    def lookup_enrollment(self, course_id: str, student_user_id: str) -> str:
        from app.models.lms import Enrollment

        row = Enrollment.query.filter_by(course_id=course_id, student_id=student_user_id, school_id=self.school_id).first()
        if not row:
            raise FlowError("Enrollment was not persisted")
        return str(row.id)

    def lookup_student_badge(self, student_id: str, badge_id: str) -> str:
        from app.models.gamification import StudentBadge

        row = StudentBadge.query.filter_by(student_id=student_id, badge_id=badge_id, school_id=self.school_id).first()
        if not row:
            raise FlowError("Student badge was not persisted")
        return str(row.id)

    def cleanup_data(self) -> None:
        try:
            for model, item_id in reversed(self.created):
                obj = db.session.get(model, item_id)
                if obj and hasattr(obj, "is_deleted"):
                    obj.is_deleted = True
            self.cleanup_marker_rows()
            db.session.commit()
        except Exception:
            db.session.rollback()

    def cleanup_marker_rows(self) -> None:
        from app.models.student import Guardian, Student
        from app.models.user import User
        from app.models.wellbeing import MoodEntry

        audit_student_ids = [
            student.id
            for student in Student.query.filter(
                Student.school_id == self.school_id,
                Student.student_id == f"ASFA-{self.tag}",
            ).all()
        ]
        if audit_student_ids:
            MoodEntry.query.filter(
                MoodEntry.school_id == self.school_id,
                MoodEntry.student_id.in_(audit_student_ids),
            ).update({"is_deleted": True}, synchronize_session=False)

        User.query.filter(
            User.school_id == self.school_id,
            User.full_name.ilike(f"%{self.tag}%"),
        ).update({"is_deleted": True}, synchronize_session=False)
        Student.query.filter(
            Student.school_id == self.school_id,
            Student.student_id == f"ASFA-{self.tag}",
        ).update({"is_deleted": True}, synchronize_session=False)
        Guardian.query.filter(
            Guardian.school_id == self.school_id,
            Guardian.full_name.ilike(f"%{self.tag}%"),
        ).update({"is_deleted": True}, synchronize_session=False)

    def cleanup_plugins(self) -> None:
        for slug in reversed(self.installed_by_audit):
            try:
                self.api("POST", "/api/v1/plugins/uninstall", json_body={"plugin_slug": slug})
            except Exception:
                db.session.rollback()
        if self.school_id:
            cache.delete(f"school:{self.school_id}:plugins")

    def phone(self, offset: int) -> str:
        numeric = "".join(ch for ch in self.tag if ch.isdigit())[-6:].rjust(6, "0")
        return f"98{numeric}{offset:02d}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a connected real school API flow audit.")
    parser.add_argument("--keep-data", action="store_true", help="Do not clean up audit records.")
    parser.add_argument("--keep-plugins", action="store_true", help="Do not uninstall plugins installed by this audit.")
    parser.add_argument("--json", action="store_true", help="Print formatted JSON.")
    args = parser.parse_args()

    audit = SchoolFlowAudit(keep_data=args.keep_data, keep_plugins=args.keep_plugins)
    with audit.app.app_context():
        result = audit.run()

    print(json.dumps(result, indent=2 if args.json else None, sort_keys=True))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
