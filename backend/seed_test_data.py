"""Full-year Nepal-style test data seeder for ASchool.

Creates one-year linked data for realistic school operations:
- users: teachers, students, parents/guardians
- academics: classes, sections, subjects (Nepal curriculum style), timetable
- operations: attendance, notices, assignments/submissions, diary notes
- assessment: term exams, marks, report cards, online exams and attempts
- finance: fee structures, monthly collections, fee receipts
- LMS: courses, chapters(lessons), topics, materials, enrollments
- support modules: library, digital content, wellbeing, health, notifications

Usage:
    python seed_test_data.py
    python seed_test_data.py --school-slug demo --students-per-section 8
"""

from __future__ import annotations

import argparse
import calendar
import random
from datetime import date, datetime, time, timedelta, timezone

from app import create_app
from app.models.academic import AcademicYear, Class, Medium, Section, Shift, Subject
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.attendance import Attendance
from app.models.diary import DiaryCategory, DiaryEntry
from app.models.digital_content import DigitalBook, OERResource, PastPaper
from app.models.exam import Exam, Marks, OnlineExam, ReportCard
from app.models.fee import FeeCollection, FeeReceipt, FeeStructure
from app.models.health_records import HealthProfile, Immunization, MedicalVisit
from app.models.library import Book, BookIssue, BookTransaction
from app.models.lms import Course, Enrollment, Lesson, StudyMaterial, Topic
from app.models.notice import Notice
from app.models.notification import PushNotification, SMSLog, WhatsAppMessage
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.student import Guardian, Student
from app.models.timetable import TimetableSlot
from app.models.user import User
from app.models.wellbeing import (
    CounselorSession,
    MoodCheckin,
    WellbeingSurvey,
    WellbeingSurveyResponse,
)
from app.utils.password import generate_default_password
from extensions import db

RNG = random.Random(20260505)
SEED_TAG = "[SEED-TEST]"


REQUIRED_PLUGIN_SLUGS = [
    "academics",
    "attendance",
    "notices",
    "assignments",
    "fees",
    "exams",
    "lms",
    "library_management",
    "elibrary",
    "wellbeing",
]


NEPALI_MONTHS = [
    "Baisakh",
    "Jestha",
    "Ashadh",
    "Shrawan",
    "Bhadra",
    "Ashwin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
]


CURRICULUM_BY_GRADE = {
    1: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("My Surroundings", "MYS"),
        ("Creative Arts", "ART"),
    ],
    2: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("My Surroundings", "MYS"),
        ("Creative Arts", "ART"),
    ],
    3: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science and Health", "SAH"),
        ("Creative Arts", "ART"),
        ("Social Studies", "SOC"),
    ],
    4: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science and Health", "SAH"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
    ],
    5: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science and Health", "SAH"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
    ],
    6: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science", "SCI"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
        ("Optional Mathematics", "OMT"),
    ],
    7: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science", "SCI"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
        ("Health and Physical", "HPE"),
    ],
    8: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science", "SCI"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
        ("Moral Education", "MOR"),
    ],
    9: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science", "SCI"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
        ("Optional Mathematics", "OMT"),
    ],
    10: [
        ("Nepali", "NEP"),
        ("English", "ENG"),
        ("Mathematics", "MTH"),
        ("Science", "SCI"),
        ("Social Studies", "SOC"),
        ("Computer", "CMP"),
        ("Accountancy", "ACC"),
    ],
}


DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def _month_starts(start_date: date, end_date: date) -> list[date]:
    starts: list[date] = []
    current = date(start_date.year, start_date.month, 1)
    while current <= end_date:
        starts.append(current)
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    return starts


def _pick_school_days(start_date: date, end_date: date, step: int = 3) -> list[date]:
    # Nepal school week is generally Sunday-Friday; this keeps rows realistic but bounded.
    days: list[date] = []
    d = start_date
    while d <= end_date:
        if d.weekday() in (6, 0, 1, 2, 3, 4) and (d.toordinal() % step == 0):
            days.append(d)
        d += timedelta(days=1)
    return days


def _ensure_school(school_slug: str) -> School:
    school = School.query.filter_by(slug=school_slug, is_deleted=False).first()
    if not school:
        school = School(
            name="Demo School Nepal",
            slug=school_slug,
            plan="growth",
            status="active",
            is_active=True,
            phone="+9779800000999",
            email=f"{school_slug}@aschool.local",
            district="Kathmandu",
            municipality="Kathmandu",
            default_language="ne",
        )
        db.session.add(school)
        db.session.commit()
        print(f"Created school: {school.slug}")
    return school


def _ensure_plugins(school: School) -> None:
    master = {
        plugin.slug: plugin
        for plugin in Plugin.query.filter(
            Plugin.slug.in_(REQUIRED_PLUGIN_SLUGS),
            Plugin.is_deleted.is_(False),
        ).all()
    }

    for slug in REQUIRED_PLUGIN_SLUGS:
        if slug not in master:
            print(f"WARN: plugin '{slug}' not found in plugins table; skipping install")
            continue

        row = SchoolPlugin.query.filter_by(
            school_id=school.id,
            plugin_slug=slug,
            is_deleted=False,
        ).first()
        if row:
            row.active = True
            continue

        row = SchoolPlugin(
            school_id=school.id,
            plugin_slug=slug,
            active=True,
            is_trial=False,
            billing_cycle="monthly",
            config={},
        )
        db.session.add(row)

    db.session.commit()


def _ensure_academic_basics(school: School) -> tuple[AcademicYear, Medium, Shift, list[Class], list[Section]]:
    year = AcademicYear.query.filter_by(
        school_id=school.id,
        name="2082-83",
        is_deleted=False,
    ).first()
    if not year:
        year = AcademicYear(
            school_id=school.id,
            name="2082-83",
            name_nepali="२०८२-८३",
            is_current=True,
            start_date_ad=date(2025, 4, 14),
            end_date_ad=date(2026, 4, 13),
        )
        db.session.add(year)

    medium = Medium.query.filter_by(
        school_id=school.id,
        name="English",
        is_deleted=False,
    ).first()
    if not medium:
        medium = Medium(
            school_id=school.id,
            name="English",
            code="EN",
            is_default=True,
        )
        db.session.add(medium)

    shift = Shift.query.filter_by(
        school_id=school.id,
        name="Day",
        is_deleted=False,
    ).first()
    if not shift:
        shift = Shift(
            school_id=school.id,
            name="Day",
            start_time=time(10, 0),
            end_time=time(16, 0),
            is_default=True,
        )
        db.session.add(shift)

    db.session.flush()

    classes: list[Class] = []
    sections: list[Section] = []

    for grade in range(1, 11):
        class_name = f"Grade {grade}"
        klass = Class.query.filter_by(
            school_id=school.id,
            name=class_name,
            is_deleted=False,
        ).first()
        if not klass:
            klass = Class(
                school_id=school.id,
                name=class_name,
                numeric_grade=grade,
                sort_order=grade,
                academic_year_id=year.id,
                medium_id=medium.id,
            )
            db.session.add(klass)
            db.session.flush()

        classes.append(klass)

        for sec_name in ("A", "B"):
            sec = Section.query.filter_by(
                school_id=school.id,
                class_id=klass.id,
                name=sec_name,
                is_deleted=False,
            ).first()
            if not sec:
                sec = Section(
                    school_id=school.id,
                    class_id=klass.id,
                    name=sec_name,
                    capacity=45,
                    medium_id=medium.id,
                    shift_id=shift.id,
                )
                db.session.add(sec)
                db.session.flush()
            sections.append(sec)

    db.session.commit()
    return year, medium, shift, classes, sections


def _ensure_teacher(school: School, idx: int) -> User:
    phone = f"+97798190{idx:04d}"
    email = f"teacher{idx}@{school.slug}.test"
    teacher = User.query.filter_by(phone=phone, is_deleted=False).first()
    if teacher:
        expected_teacher_password = generate_default_password(
            teacher,
            school=school,
        )
        if not teacher.check_password(expected_teacher_password):
            teacher.set_password(expected_teacher_password)
        return teacher

    teacher = User(
        school_id=school.id,
        role="teacher",
        full_name=f"Teacher {idx}",
        phone=phone,
        email=email,
        gender="male" if idx % 2 == 0 else "female",
        is_active=True,
        phone_verified=True,
    )
    teacher.set_password(generate_default_password(teacher, school=school))
    db.session.add(teacher)
    return teacher


def _ensure_subjects(
    school: School,
    classes: list[Class],
    teachers: list[User],
) -> list[Subject]:
    subjects: list[Subject] = []

    for klass in classes:
        grade_subjects = CURRICULUM_BY_GRADE.get(
            klass.numeric_grade,
            CURRICULUM_BY_GRADE[10],
        )
        for s_idx, (name, code) in enumerate(grade_subjects, start=1):
            full_code = f"{klass.numeric_grade}-{code}"
            subject = Subject.query.filter_by(
                school_id=school.id,
                code=full_code,
                is_deleted=False,
            ).first()
            if not subject:
                teacher = teachers[(klass.numeric_grade + s_idx) % len(teachers)]
                subject = Subject(
                    school_id=school.id,
                    name=name,
                    code=full_code,
                    class_ids=[klass.id],
                    teacher_ids=[teacher.id],
                    full_marks=100,
                    pass_marks=32,
                    subject_type="compulsory",
                )
                db.session.add(subject)
                db.session.flush()
            subjects.append(subject)

    db.session.commit()
    return subjects


def _assign_class_teachers(sections: list[Section], teachers: list[User]) -> None:
    for idx, section in enumerate(sections):
        if section.class_teacher_id:
            continue
        section.class_teacher_id = teachers[idx % len(teachers)].id
    db.session.commit()


def _ensure_students_and_guardians(
    school: School,
    classes: list[Class],
    sections: list[Section],
    year: AcademicYear,
    students_per_section: int,
) -> tuple[list[Student], list[User]]:
    all_students: list[Student] = []
    parent_users: list[User] = []
    section_by_class = {}
    for section in sections:
        section_by_class.setdefault(section.class_id, []).append(section)

    student_counter = 1
    parent_counter = 1

    for klass in classes:
        for section in section_by_class.get(klass.id, []):
            for roll in range(1, students_per_section + 1):
                student_code = f"{klass.numeric_grade}{section.name}{roll:02d}"
                student_id = f"STD-{student_code}"
                student_phone = f"+97798280{student_counter:04d}"
                student_email = f"student{student_counter}@{school.slug}.test"

                user = User.query.filter_by(
                    school_id=school.id,
                    phone=student_phone,
                    is_deleted=False,
                ).first()
                if not user:
                    user = User(
                        school_id=school.id,
                        role="student",
                        full_name=f"Student {student_counter}",
                        phone=student_phone,
                        email=student_email,
                        is_active=True,
                        phone_verified=True,
                    )
                    user.set_password("Demo@1234")
                    db.session.add(user)
                    db.session.flush()

                student = Student.query.filter_by(
                    school_id=school.id,
                    student_id=student_id,
                    is_deleted=False,
                ).first()
                if not student:
                    student = Student(
                        school_id=school.id,
                        user_id=user.id,
                        first_name="Student",
                        last_name=str(student_counter),
                        student_id=student_id,
                        roll_number=roll,
                        class_id=klass.id,
                        section_id=section.id,
                        academic_year_id=year.id,
                        academic_year=year.name,
                        status="active",
                        gender="male" if student_counter % 2 == 0 else "female",
                        admission_number=f"ADM-{student_code}",
                        admission_date_ad=date.today() - timedelta(days=300),
                    )
                    db.session.add(student)
                    db.session.flush()

                expected_student_password = generate_default_password(
                    user,
                    student=student,
                    school=school,
                )
                if not user.check_password(expected_student_password):
                    user.set_password(expected_student_password)

                all_students.append(student)

                parent_phone = f"+97798370{parent_counter:04d}"
                parent_email = f"parent{parent_counter}@{school.slug}.test"
                parent = User.query.filter_by(
                    school_id=school.id,
                    phone=parent_phone,
                    is_deleted=False,
                ).first()
                if not parent:
                    parent = User(
                        school_id=school.id,
                        role="parent",
                        full_name=f"Parent {parent_counter}",
                        phone=parent_phone,
                        email=parent_email,
                        is_active=True,
                        phone_verified=True,
                    )
                    parent.set_password(
                        generate_default_password(parent, school=school),
                    )
                    db.session.add(parent)
                    db.session.flush()
                expected_parent_password = generate_default_password(
                    parent,
                    school=school,
                )
                if not parent.check_password(expected_parent_password):
                    parent.set_password(expected_parent_password)
                parent_users.append(parent)

                guardian = Guardian.query.filter_by(
                    school_id=school.id,
                    student_id=student.id,
                    user_id=parent.id,
                    is_deleted=False,
                ).first()
                if not guardian:
                    guardian = Guardian(
                        school_id=school.id,
                        student_id=student.id,
                        user_id=parent.id,
                        full_name=parent.full_name,
                        phone=parent.phone,
                        relation="father" if parent_counter % 2 == 0 else "mother",
                        is_primary=True,
                    )
                    db.session.add(guardian)

                student_counter += 1
                parent_counter += 1

    db.session.commit()
    return all_students, parent_users


def _seed_notices(school: School, teachers: list[User], year: AcademicYear) -> None:
    month_starts = _month_starts(year.start_date_ad, year.end_date_ad)
    notice_topics = [
        "Exam Routine",
        "Fee Reminder",
        "PTM Meeting",
        "Sports Event",
        "Health Camp",
        "Holiday Circular",
    ]
    for idx, m_start in enumerate(month_starts, start=1):
        notice_topic = notice_topics[(idx - 1) % len(notice_topics)]
        title = f"{SEED_TAG} {notice_topic} - {m_start.strftime('%b %Y')}"
        row = Notice.query.filter_by(
            school_id=school.id,
            title=title,
            is_deleted=False,
        ).first()
        if row:
            continue

        row = Notice(
            school_id=school.id,
            title=title,
            content=(
                f"{notice_topic} update for {m_start.strftime('%B %Y')}. "
                "Generated for one-year live testing."
            ),
            target_audience=["student", "parent", "teacher"],
            published_at=datetime.combine(m_start, time(9, 0), tzinfo=timezone.utc),
            created_by_id=teachers[idx % len(teachers)].id,
            is_pinned=(idx % 6 == 0),
        )
        db.session.add(row)
    db.session.commit()


def _seed_timetable(school: School, sections: list[Section], subjects: list[Subject]) -> None:
    subjects_by_class = {}
    for subject in subjects:
        if not subject.class_ids:
            continue
        for class_id in subject.class_ids:
            subjects_by_class.setdefault(class_id, []).append(subject)

    for section in sections:
        class_subjects = subjects_by_class.get(section.class_id, [])
        if not class_subjects:
            continue

        for day_idx, day in enumerate(DAYS):
            for period in range(1, 7):
                slot = TimetableSlot.query.filter_by(
                    school_id=school.id,
                    class_id=section.class_id,
                    section_id=section.id,
                    day_of_week=day,
                    period_number=period,
                    is_deleted=False,
                ).first()
                if slot:
                    continue

                subject = class_subjects[(day_idx + period) % len(class_subjects)]
                teacher_id = subject.teacher_ids[0] if subject.teacher_ids else None
                start = time(10 + period - 1, 0)
                end = time(10 + period - 1, 45)

                slot = TimetableSlot(
                    school_id=school.id,
                    class_id=section.class_id,
                    section_id=section.id,
                    subject_id=subject.id,
                    teacher_id=teacher_id,
                    day_of_week=day,
                    period_number=period,
                    start_time=start,
                    end_time=end,
                    is_break=False,
                    room=f"R-{period}",
                )
                db.session.add(slot)

    db.session.commit()


def _seed_attendance(
    school: School,
    students: list[Student],
    teachers: list[User],
    year: AcademicYear,
) -> None:
    target_dates = _pick_school_days(year.start_date_ad, year.end_date_ad, step=3)
    for student in students:
        for mark_date in target_dates:
            row = Attendance.query.filter_by(
                school_id=school.id,
                student_id=student.id,
                date=mark_date,
                is_deleted=False,
            ).first()
            if row:
                continue

            status = RNG.choices(
                ["present", "late", "absent", "half_day"],
                weights=[70, 10, 15, 5],
                k=1,
            )[0]
            row = Attendance(
                school_id=school.id,
                student_id=student.id,
                class_id=student.class_id,
                section_id=student.section_id,
                date=mark_date,
                status=status,
                marked_by_id=teachers[(student.roll_number or 1) % len(teachers)].id,
                remarks=f"{SEED_TAG} attendance",
            )
            db.session.add(row)

    db.session.commit()


def _seed_assignments(
    school: School,
    classes: list[Class],
    sections: list[Section],
    subjects: list[Subject],
    students: list[Student],
    year: AcademicYear,
) -> None:
    section_by_class = {}
    for section in sections:
        section_by_class.setdefault(section.class_id, []).append(section)

    students_by_section = {}
    for student in students:
        students_by_section.setdefault(student.section_id, []).append(student)

    subjects_by_class = {}
    for subject in subjects:
        for class_id in (subject.class_ids or []):
            subjects_by_class.setdefault(class_id, []).append(subject)

    month_starts = _month_starts(year.start_date_ad, year.end_date_ad)

    for klass in classes:
        class_subjects = subjects_by_class.get(klass.id, [])[:4]
        for section in section_by_class.get(klass.id, []):
            for month_idx, m_start in enumerate(month_starts, start=1):
                for s_idx, subject in enumerate(class_subjects, start=1):
                    title = (
                        f"{SEED_TAG} {klass.name} {section.name} {subject.name} "
                        f"Assignment {month_idx}"
                    )
                    assignment = Assignment.query.filter_by(
                        school_id=school.id,
                        title=title,
                        is_deleted=False,
                    ).first()
                    if not assignment:
                        due_dt = datetime.combine(
                            min(m_start + timedelta(days=20), year.end_date_ad),
                            time(23, 59),
                            tzinfo=timezone.utc,
                        )
                        assignment = Assignment(
                            school_id=school.id,
                            title=title,
                            description=(
                                "Monthly curriculum practice aligned to Nepal school flow."
                            ),
                            class_id=klass.id,
                            section_id=section.id,
                            subject_id=subject.id,
                            teacher_id=(subject.teacher_ids or [None])[0],
                            due_date=due_dt,
                            total_marks=20,
                            is_published=True,
                        )
                        db.session.add(assignment)
                        db.session.flush()

                    section_students = students_by_section.get(section.id, [])
                    for st_idx, student in enumerate(section_students):
                        submission = AssignmentSubmission.query.filter_by(
                            school_id=school.id,
                            assignment_id=assignment.id,
                            student_id=student.id,
                            is_deleted=False,
                        ).first()
                        if submission:
                            continue

                        is_submitted = st_idx % 5 != 0
                        submission = AssignmentSubmission(
                            school_id=school.id,
                            assignment_id=assignment.id,
                            student_id=student.id,
                            content=("Submitted answer" if is_submitted else ""),
                            submitted_at=(
                                datetime.combine(
                                    min(m_start + timedelta(days=18), year.end_date_ad),
                                    time(16, 0),
                                    tzinfo=timezone.utc,
                                )
                                if is_submitted
                                else None
                            ),
                            status=("graded" if is_submitted else "submitted"),
                            marks=(RNG.randint(8, 20) if is_submitted else None),
                            feedback=("Good work" if is_submitted else None),
                        )
                        db.session.add(submission)

    db.session.commit()


def _seed_fees(
    school: School,
    classes: list[Class],
    students: list[Student],
    year: AcademicYear,
    collected_by_id,
) -> None:
    for klass in classes:
        structure = FeeStructure.query.filter_by(
            school_id=school.id,
            class_id=klass.id,
            academic_year=year.name,
            is_deleted=False,
        ).first()
        if not structure:
            fee_items = [
                {"name": "Tuition", "monthly": 2500},
                {"name": "Exam", "monthly": 350},
                {"name": "Transport", "monthly": 800},
            ]
            structure = FeeStructure(
                school_id=school.id,
                class_id=klass.id,
                academic_year=year.name,
                fee_items=fee_items,
                total_monthly=3650,
                total_annual=43800,
            )
            db.session.add(structure)

    db.session.flush()

    fiscal_year_label = year.name.split("-")[0]
    for student in students:
        for m_idx, month_name in enumerate(NEPALI_MONTHS, start=1):
            exists = FeeCollection.query.filter_by(
                school_id=school.id,
                student_id=student.id,
                fee_item_name=f"{SEED_TAG} Monthly Tuition",
                month_bs=month_name,
                year_bs=fiscal_year_label,
                is_deleted=False,
            ).first()
            if exists:
                continue

            status = RNG.choice(["paid", "pending", "partial", "waived"])
            base_amount = RNG.choice([1800, 2200, 2500, 3000, 3600])
            discount_amount = 0
            late_fine_amount = 0
            is_scholarship = False
            notes = None
            paid_amount = 0

            if status == "waived":
                is_scholarship = True
                discount_amount = base_amount
                notes = "[scholarship:monthly waiver]"
            elif status == "partial":
                discount_amount = RNG.choice([150, 250, 300, 500])
                late_fine_amount = RNG.choice([0, 0, 100, 150])
                paid_amount = RNG.choice([800, 1200, 1500])
                notes = f"[partial_paid:{paid_amount}] [concession:{discount_amount}]"
            elif status == "paid":
                if m_idx % 4 == 0:
                    discount_amount = RNG.choice([100, 200, 300])
                    notes = f"[concession:{discount_amount}]"
                if m_idx % 6 == 0:
                    late_fine_amount = RNG.choice([50, 100])
                    notes = f"{notes or ''} [late_fee:{late_fine_amount}]".strip()

            payable_amount = max(base_amount + late_fine_amount - discount_amount, 0)
            if status == "paid":
                paid_amount = payable_amount
            elif status == "pending":
                notes = f"[due:{payable_amount}]"
            elif status == "waived":
                paid_amount = 0

            collected_at = (
                datetime.combine(
                    min(year.start_date_ad + timedelta(days=(m_idx * 26)), year.end_date_ad),
                    time(12, 0),
                    tzinfo=timezone.utc,
                )
                if status in ("paid", "partial")
                else None
            )
            row = FeeCollection(
                school_id=school.id,
                student_id=student.id,
                academic_year=year.name,
                fee_item_name=f"{SEED_TAG} Monthly Tuition",
                amount=base_amount,
                month_bs=month_name,
                year_bs=fiscal_year_label,
                payment_method=("cash" if status in ("paid", "partial") else None),
                receipt_number=f"RCPT-{student.student_id}-{m_idx:02d}",
                collected_by_id=collected_by_id,
                collected_at=collected_at,
                payment_status=status,
                notes=notes,
                late_fine_amount=late_fine_amount,
                discount_amount=discount_amount,
                is_scholarship=is_scholarship,
            )
            db.session.add(row)
            db.session.flush()

            if status in ("paid", "partial"):
                receipt = FeeReceipt.query.filter_by(
                    school_id=school.id,
                    collection_id=row.id,
                    is_deleted=False,
                ).first()
                if not receipt:
                    receipt = FeeReceipt(
                        school_id=school.id,
                        collection_id=row.id,
                        student_id=student.id,
                        receipt_number=row.receipt_number,
                        amount=paid_amount,
                        payment_method=row.payment_method,
                        transaction_id=f"TXN-{student.student_id}-{m_idx:02d}",
                        pdf_url="https://example.com/fee-receipt.pdf",
                        sent_via_whatsapp=(m_idx % 2 == 0),
                        sent_at=row.collected_at,
                        verified_hash=f"seed-hash-{student.student_id}-{m_idx:02d}",
                    )
                    db.session.add(receipt)

    db.session.commit()


def _seed_exams_and_marks(
    school: School,
    classes: list[Class],
    subjects: list[Subject],
    students: list[Student],
    year: AcademicYear,
    teachers: list[User],
) -> None:
    students_by_class = {}
    for student in students:
        students_by_class.setdefault(student.class_id, []).append(student)

    subjects_by_class = {}
    for subject in subjects:
        for class_id in (subject.class_ids or []):
            subjects_by_class.setdefault(class_id, []).append(subject)

    exam_defs = [
        ("First Terminal", "terminal", 45, 52),
        ("Second Terminal", "terminal", 175, 182),
        ("Final Exam", "annual", 300, 308),
    ]

    for klass in classes:
        class_students = students_by_class.get(klass.id, [])
        class_subjects = subjects_by_class.get(klass.id, [])[:6]
        if not class_subjects:
            continue

        for exam_title, exam_type, start_offset, end_offset in exam_defs:
            start_ad = min(year.start_date_ad + timedelta(days=start_offset), year.end_date_ad)
            end_ad = min(year.start_date_ad + timedelta(days=end_offset), year.end_date_ad)
            exam_name = f"{SEED_TAG} {klass.name} {exam_title}"
            exam = Exam.query.filter_by(
                school_id=school.id,
                name=exam_name,
                is_deleted=False,
            ).first()
            if not exam:
                exam = Exam(
                    school_id=school.id,
                    name=exam_name,
                    exam_type=exam_type,
                    academic_year_id=year.id,
                    class_id=klass.id,
                    subject_ids=[s.id for s in class_subjects],
                    start_date_ad=start_ad,
                    end_date_ad=end_ad,
                    total_marks=100,
                    pass_marks=32,
                    status="result_published",
                    created_by=teachers[0].id,
                )
                db.session.add(exam)
                db.session.flush()

            for student in class_students:
                total = 0.0
                for subject in class_subjects:
                    mark = Marks.query.filter_by(
                        school_id=school.id,
                        exam_id=exam.id,
                        student_id=student.id,
                        subject_id=subject.id,
                        is_deleted=False,
                    ).first()
                    score = float(RNG.randint(35, 95))
                    total += score
                    if mark:
                        continue

                    mark = Marks(
                        school_id=school.id,
                        exam_id=exam.id,
                        student_id=student.id,
                        subject_id=subject.id,
                        class_id=klass.id,
                        teacher_id=(subject.teacher_ids or [teachers[0].id])[0],
                        entered_by=teachers[0].id,
                        theory_marks=score,
                        practical_marks=0,
                        total_marks=score,
                        full_marks=100,
                        pass_marks=32,
                        grade=("A+" if score >= 90 else "A" if score >= 80 else "B" if score >= 60 else "C"),
                        gpa=(4.0 if score >= 90 else 3.6 if score >= 80 else 3.0 if score >= 60 else 2.0),
                    )
                    db.session.add(mark)

                report = ReportCard.query.filter_by(
                    school_id=school.id,
                    exam_id=exam.id,
                    student_id=student.id,
                    is_deleted=False,
                ).first()
                if not report:
                    percentage = round(total / max(len(class_subjects), 1), 2)
                    report = ReportCard(
                        school_id=school.id,
                        student_id=student.id,
                        exam_id=exam.id,
                        generated_at=datetime.now(timezone.utc),
                        total_marks=total,
                        total_percentage=percentage,
                        percentage=percentage,
                        overall_grade=("A+" if percentage >= 90 else "A" if percentage >= 80 else "B" if percentage >= 60 else "C"),
                        overall_gpa=(4.0 if percentage >= 90 else 3.6 if percentage >= 80 else 3.0 if percentage >= 60 else 2.0),
                        rank_in_class=RNG.randint(1, max(1, len(class_students))),
                        ai_remarks=f"{SEED_TAG} Consistent effort across term exams.",
                    )
                    db.session.add(report)

        online_exam = OnlineExam.query.filter_by(
            school_id=school.id,
            title=f"{SEED_TAG} {klass.name} Online Quiz",
            is_deleted=False,
        ).first()
        if not online_exam:
            online_exam = OnlineExam(
                school_id=school.id,
                title=f"{SEED_TAG} {klass.name} Online Quiz",
                description="Auto-generated online exam for testing.",
                class_id=klass.id,
                subject_id=class_subjects[0].id,
                duration_minutes=30,
                total_marks=10,
                total_questions=5,
                questions=[
                    {
                        "id": "q1",
                        "question": "Capital of Nepal?",
                        "options": ["Pokhara", "Kathmandu", "Biratnagar", "Butwal"],
                        "correct_answer": "Kathmandu",
                        "marks": 2,
                    },
                    {
                        "id": "q2",
                        "question": "2 + 3 = ?",
                        "options": ["4", "5", "6", "7"],
                        "correct_answer": "5",
                        "marks": 2,
                    },
                ],
                start_at=datetime.combine(year.start_date_ad + timedelta(days=90), time(9, 0), tzinfo=timezone.utc),
                end_at=datetime.combine(year.start_date_ad + timedelta(days=120), time(17, 0), tzinfo=timezone.utc),
                status="upcoming",
                created_by_id=teachers[0].id,
            )
            db.session.add(online_exam)
            db.session.flush()

        for student in class_students[: max(1, len(class_students) // 2)]:
            attempt = online_exam.attempts
            existing = False
            for a in attempt:
                if a.student_id == student.id and not a.is_deleted:
                    existing = True
                    break
            if existing:
                continue
            from app.models.exam import OnlineExamAttempt

            db.session.add(
                OnlineExamAttempt(
                    school_id=school.id,
                    online_exam_id=online_exam.id,
                    student_id=student.id,
                    answers={"q1": "Kathmandu", "q2": "5"},
                    score=RNG.randint(4, 10),
                    status="submitted",
                    started_at=datetime.now(timezone.utc) - timedelta(days=1),
                    submitted_at=datetime.now(timezone.utc) - timedelta(hours=20),
                )
            )

    db.session.commit()


def _seed_lms(
    school: School,
    classes: list[Class],
    subjects: list[Subject],
    students: list[Student],
    teachers: list[User],
) -> None:
    subjects_by_class = {}
    for subject in subjects:
        for class_id in (subject.class_ids or []):
            subjects_by_class.setdefault(class_id, []).append(subject)

    students_by_class = {}
    for student in students:
        students_by_class.setdefault(student.class_id, []).append(student)

    for klass in classes:
        class_subjects = subjects_by_class.get(klass.id, [])[:6]
        if not class_subjects:
            continue

        for subject in class_subjects:
            teacher_id = (subject.teacher_ids or [teachers[0].id])[0]
            title = f"{SEED_TAG} {klass.name} {subject.name} Course"

            course = Course.query.filter_by(
                school_id=school.id,
                title=title,
                is_deleted=False,
            ).first()
            if not course:
                course = Course(
                    school_id=school.id,
                    title=title,
                    description="Generated LMS course with one-year chapters/topics/materials.",
                    subject_id=subject.id,
                    class_id=klass.id,
                    teacher_id=teacher_id,
                    instructor_id=teacher_id,
                    status="published",
                    is_published=True,
                )
                db.session.add(course)
                db.session.flush()

            for lesson_no in range(1, 6):
                lesson_title = f"{SEED_TAG} Chapter {lesson_no}: {subject.name}"
                lesson = Lesson.query.filter_by(
                    school_id=school.id,
                    course_id=course.id,
                    title=lesson_title,
                    is_deleted=False,
                ).first()
                if not lesson:
                    lesson = Lesson(
                        school_id=school.id,
                        course_id=course.id,
                        title=lesson_title,
                        content=f"Core content for chapter {lesson_no} in {subject.name}.",
                        content_type="text",
                        sort_order=lesson_no,
                        duration_minutes=45,
                        is_published=True,
                    )
                    db.session.add(lesson)
                    db.session.flush()

                for topic_no in range(1, 4):
                    topic_title = f"{SEED_TAG} Topic {lesson_no}.{topic_no}"
                    topic = Topic.query.filter_by(
                        school_id=school.id,
                        lesson_id=lesson.id,
                        title=topic_title,
                        is_deleted=False,
                    ).first()
                    if not topic:
                        topic = Topic(
                            school_id=school.id,
                            lesson_id=lesson.id,
                            title=topic_title,
                            description="Generated topic content.",
                            sort_order=topic_no,
                        )
                        db.session.add(topic)
                        db.session.flush()

                    mat_title = f"{SEED_TAG} Material {lesson_no}.{topic_no}"
                    material = StudyMaterial.query.filter_by(
                        school_id=school.id,
                        topic_id=topic.id,
                        title=mat_title,
                        is_deleted=False,
                    ).first()
                    if not material:
                        material = StudyMaterial(
                            school_id=school.id,
                            lesson_id=lesson.id,
                            topic_id=topic.id,
                            title=mat_title,
                            material_type="file",
                            file_url="https://example.com/material.pdf",
                            sort_order=topic_no,
                        )
                        db.session.add(material)

            for student in students_by_class.get(klass.id, []):
                if not student.user_id:
                    continue
                enrollment = Enrollment.query.filter_by(
                    school_id=school.id,
                    course_id=course.id,
                    student_id=student.user_id,
                    is_deleted=False,
                ).first()
                if not enrollment:
                    enrollment = Enrollment(
                        school_id=school.id,
                        course_id=course.id,
                        student_id=student.user_id,
                        progress_percentage=RNG.randint(10, 90),
                        completed_lessons=[],
                        enrolled_at=datetime.now(timezone.utc) - timedelta(days=15),
                        status="active",
                    )
                    db.session.add(enrollment)

    db.session.commit()


def _seed_diary(
    school: School,
    classes: list[Class],
    sections: list[Section],
    students: list[Student],
    teachers: list[User],
) -> None:
    category = DiaryCategory.query.filter_by(
        school_id=school.id,
        name=f"{SEED_TAG} Class Notes",
        is_deleted=False,
    ).first()
    if not category:
        category = DiaryCategory(
            school_id=school.id,
            name=f"{SEED_TAG} Class Notes",
            color="blue",
            active=True,
        )
        db.session.add(category)
        db.session.flush()

    section_by_class = {}
    for section in sections:
        section_by_class.setdefault(section.class_id, []).append(section)

    students_by_section = {}
    for student in students:
        students_by_section.setdefault(student.section_id, []).append(student)

    for klass in classes:
        for section in section_by_class.get(klass.id, []):
            for month_offset in range(0, 12):
                entry_day = date.today() - timedelta(days=month_offset * 28)
                title = (
                    f"{SEED_TAG} {klass.name}-{section.name} Notes "
                    f"{entry_day.strftime('%b %Y')}"
                )
                entry = DiaryEntry.query.filter_by(
                    school_id=school.id,
                    title=title,
                    class_id=klass.id,
                    section_id=section.id,
                    is_deleted=False,
                ).first()
                if not entry:
                    entry = DiaryEntry(
                        school_id=school.id,
                        title=title,
                        content="Monthly class note generated for parent/teacher/student diary flow.",
                        category_id=category.id,
                        class_id=klass.id,
                        section_id=section.id,
                        entry_date=entry_day,
                        created_by_id=teachers[month_offset % len(teachers)].id,
                        is_published=True,
                    )
                    db.session.add(entry)

            for student in students_by_section.get(section.id, [])[:3]:
                st_title = f"{SEED_TAG} Note for {student.student_id}"
                st_entry = DiaryEntry.query.filter_by(
                    school_id=school.id,
                    title=st_title,
                    student_id=student.id,
                    is_deleted=False,
                ).first()
                if st_entry:
                    continue
                st_entry = DiaryEntry(
                    school_id=school.id,
                    title=st_title,
                    content="Individual student note generated for testing.",
                    category_id=category.id,
                    student_id=student.id,
                    class_id=klass.id,
                    section_id=section.id,
                    entry_date=date.today() - timedelta(days=7),
                    created_by_id=teachers[0].id,
                    is_published=True,
                )
                db.session.add(st_entry)

    db.session.commit()


def run_seed(school_slug: str, students_per_section: int) -> None:
    school = _ensure_school(school_slug)
    _ensure_plugins(school)

    year, _, _, classes, sections = _ensure_academic_basics(school)

    teachers = []
    for idx in range(1, 9):
        teacher = _ensure_teacher(school, idx)
        teachers.append(teacher)
    db.session.commit()

    subjects = _ensure_subjects(school, classes, teachers)
    _assign_class_teachers(sections, teachers)

    students, parents = _ensure_students_and_guardians(
        school=school,
        classes=classes,
        sections=sections,
        year=year,
        students_per_section=students_per_section,
    )

    _seed_notices(school, teachers, year)
    _seed_timetable(school, sections, subjects)
    _seed_attendance(school, students, teachers, year)
    _seed_assignments(school, classes, sections, subjects, students, year)
    _seed_fees(school, classes, students, year, teachers[0].id)
    _seed_exams_and_marks(school, classes, subjects, students, year, teachers)
    _seed_lms(school, classes, subjects, students, teachers)
    _seed_diary(school, classes, sections, students, teachers)
    _seed_library(school, students, teachers)
    _seed_digital_content(school, classes, subjects, teachers)
    _seed_wellbeing(school, classes, students, teachers, year)
    _seed_health_records(school, students, teachers, year)
    _seed_notifications(school, students, parents, teachers, year)

    print("\nDone: comprehensive test data seeded successfully.")
    print(f"School: {school.slug}")
    print(f"Classes: {len(classes)}")
    print(f"Sections: {len(sections)}")
    print(f"Teachers: {len(teachers)}")
    print(f"Students: {len(students)}")


def _seed_library(school: School, students: list[Student], teachers: list[User]) -> None:
    books = [
        ("Grade Mathematics Practice", "Local Author", "MTH"),
        ("Nepali Grammar Handbook", "Curriculum Board", "NEP"),
        ("Science for Secondary", "Science Team", "SCI"),
        ("Social Studies Nepal", "Education Press", "SOC"),
    ]
    created_books: list[Book] = []
    for idx, (title, author, category) in enumerate(books, start=1):
        existing = Book.query.filter_by(
            school_id=school.id,
            title=f"{SEED_TAG} {title}",
            is_deleted=False,
        ).first()
        if existing:
            created_books.append(existing)
            continue
        b = Book(
            school_id=school.id,
            title=f"{SEED_TAG} {title}",
            author=author,
            isbn=f"97899999{idx:05d}",
            publisher="Nepal Education Press",
            category=category,
            total_copies=20,
            available_copies=18,
            shelf_location=f"S-{idx}",
            cover_url="https://example.com/book-cover.jpg",
            barcode=f"BC-{idx:04d}",
            is_available=True,
        )
        db.session.add(b)
        db.session.flush()
        created_books.append(b)

    for idx, student in enumerate(students[: min(len(students), 40)]):
        book = created_books[idx % len(created_books)]
        issue_day = date.today() - timedelta(days=idx + 10)

        tx = BookTransaction.query.filter_by(
            school_id=school.id,
            book_id=book.id,
            student_id=student.id,
            issue_date=issue_day,
            is_deleted=False,
        ).first()
        if not tx:
            db.session.add(
                BookTransaction(
                    school_id=school.id,
                    book_id=book.id,
                    student_id=student.id,
                    issued_by_id=teachers[idx % len(teachers)].id,
                    issue_date=issue_day,
                    due_date=issue_day + timedelta(days=14),
                    return_date=(issue_day + timedelta(days=10) if idx % 3 else None),
                    status=("returned" if idx % 3 else "issued"),
                    fine_amount=(0 if idx % 3 else 20),
                    fine_paid=(idx % 6 == 0),
                )
            )

        issue = BookIssue.query.filter_by(
            school_id=school.id,
            book_id=book.id,
            student_id=student.id,
            issued_date=issue_day,
            is_deleted=False,
        ).first()
        if not issue:
            db.session.add(
                BookIssue(
                    school_id=school.id,
                    book_id=book.id,
                    student_id=student.id,
                    user_id=student.user_id,
                    issued_by=teachers[idx % len(teachers)].id,
                    issued_date=issue_day,
                    due_date=issue_day + timedelta(days=14),
                    returned_date=(issue_day + timedelta(days=10) if idx % 3 else None),
                    status=("returned" if idx % 3 else "issued"),
                )
            )
    db.session.commit()


def _seed_digital_content(
    school: School,
    classes: list[Class],
    subjects: list[Subject],
    teachers: list[User],
) -> None:
    subjects_by_class: dict = {}
    for subject in subjects:
        for class_id in (subject.class_ids or []):
            subjects_by_class.setdefault(class_id, []).append(subject)

    for klass in classes:
        class_subjects = subjects_by_class.get(klass.id, [])[:3]
        for idx, subject in enumerate(class_subjects, start=1):
            dbook_title = f"{SEED_TAG} {klass.name} {subject.name} eBook"
            dbook = DigitalBook.query.filter_by(
                school_id=school.id,
                title=dbook_title,
                is_deleted=False,
            ).first()
            if not dbook:
                db.session.add(
                    DigitalBook(
                        school_id=school.id,
                        title=dbook_title,
                        author="CDC Nepal",
                        subject_id=subject.id,
                        class_id=klass.id,
                        file_url="https://example.com/book.pdf",
                        cover_url="https://example.com/book-cover.jpg",
                        file_type="pdf",
                        pages=160,
                        is_approved=True,
                        uploaded_by_id=teachers[idx % len(teachers)].id,
                    )
                )

            paper_title = f"{SEED_TAG} {klass.name} {subject.name} Past Paper"
            past = PastPaper.query.filter_by(
                school_id=school.id,
                title=paper_title,
                is_deleted=False,
            ).first()
            if not past:
                db.session.add(
                    PastPaper(
                        school_id=school.id,
                        title=paper_title,
                        subject_id=subject.id,
                        class_id=klass.id,
                        exam_type="internal",
                        year=str(date.today().year - 1),
                        file_url="https://example.com/past-paper.pdf",
                        answer_key_url="https://example.com/answer-key.pdf",
                        uploaded_by_id=teachers[idx % len(teachers)].id,
                    )
                )

            oer_title = f"{SEED_TAG} {klass.name} {subject.name} OER"
            oer = OERResource.query.filter_by(
                school_id=school.id,
                title=oer_title,
                is_deleted=False,
            ).first()
            if not oer:
                db.session.add(
                    OERResource(
                        school_id=school.id,
                        title=oer_title,
                        description="Open educational resource for topic review.",
                        resource_type="video",
                        url="https://example.com/oer-video",
                        subject_id=subject.id,
                        class_id=klass.id,
                        tags=["nepal", "curriculum", "revision"],
                        is_approved=True,
                    )
                )

    db.session.commit()


def _seed_wellbeing(
    school: School,
    classes: list[Class],
    students: list[Student],
    teachers: list[User],
    year: AcademicYear,
) -> None:
    survey = WellbeingSurvey.query.filter_by(
        school_id=school.id,
        title=f"{SEED_TAG} Annual Wellbeing Survey",
        is_deleted=False,
    ).first()
    if not survey:
        survey = WellbeingSurvey(
            school_id=school.id,
            title=f"{SEED_TAG} Annual Wellbeing Survey",
            questions=[
                {"id": "q1", "question": "How stressed do you feel this week?", "type": "scale"},
                {"id": "q2", "question": "Do you feel supported by teachers?", "type": "yes_no"},
            ],
            target_class_ids=[str(k.id) for k in classes],
            is_anonymous=False,
            is_active=True,
            starts_at=datetime.combine(year.start_date_ad, time(8, 0), tzinfo=timezone.utc),
            ends_at=datetime.combine(year.end_date_ad, time(17, 0), tzinfo=timezone.utc),
            response_count=0,
        )
        db.session.add(survey)
        db.session.flush()

    moods = ["happy", "okay", "sad", "anxious", "angry"]
    response_count = 0
    for idx, student in enumerate(students[: min(len(students), 80)]):
        mood_date = datetime.combine(
            year.start_date_ad + timedelta(days=(idx * 4) % 330),
            time(9, 0),
            tzinfo=timezone.utc,
        )
        existing = MoodCheckin.query.filter_by(
            school_id=school.id,
            student_id=student.id,
            checked_in_at=mood_date,
            is_deleted=False,
        ).first()
        if not existing:
            db.session.add(
                MoodCheckin(
                    school_id=school.id,
                    student_id=student.id,
                    mood=moods[idx % len(moods)],
                    note="Generated mood check-in for longitudinal testing.",
                    checked_in_at=mood_date,
                )
            )

        response = WellbeingSurveyResponse.query.filter_by(
            school_id=school.id,
            survey_id=survey.id,
            student_id=student.id,
            is_deleted=False,
        ).first()
        if not response:
            db.session.add(
                WellbeingSurveyResponse(
                    school_id=school.id,
                    survey_id=survey.id,
                    student_id=student.id,
                    answers={"q1": RNG.randint(1, 5), "q2": RNG.choice(["yes", "no"])},
                    submitted_at=mood_date + timedelta(minutes=20),
                )
            )
            response_count += 1

        session_day = datetime.combine(
            min(year.start_date_ad + timedelta(days=(idx * 11) % 340), year.end_date_ad),
            time(13, 0),
            tzinfo=timezone.utc,
        )
        session_exists = CounselorSession.query.filter_by(
            school_id=school.id,
            student_id=student.id,
            scheduled_at=session_day,
            is_deleted=False,
        ).first()
        if not session_exists:
            db.session.add(
                CounselorSession(
                    school_id=school.id,
                    student_id=student.id,
                    counselor_id=teachers[idx % len(teachers)].id,
                    scheduled_at=session_day,
                    duration_mins=30,
                    notes="Routine counseling check-in.",
                    follow_up_needed=(idx % 4 == 0),
                    follow_up_date=(session_day + timedelta(days=14) if idx % 4 == 0 else None),
                    status=("completed" if idx % 3 else "scheduled"),
                )
            )

    if response_count:
        survey.response_count = (survey.response_count or 0) + response_count
    db.session.commit()


def _seed_health_records(
    school: School,
    students: list[Student],
    teachers: list[User],
    year: AcademicYear,
) -> None:
    blood_groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    vaccines = ["BCG", "DPT", "Hepatitis B", "Typhoid"]

    for idx, student in enumerate(students[: min(len(students), 100)]):
        profile = HealthProfile.query.filter_by(
            school_id=school.id,
            student_id=student.id,
            is_deleted=False,
        ).first()
        if not profile:
            db.session.add(
                HealthProfile(
                    school_id=school.id,
                    student_id=student.id,
                    blood_group=blood_groups[idx % len(blood_groups)],
                    height_cm=120 + (idx % 45),
                    weight_kg=25 + (idx % 30),
                    allergies=["dust"] if idx % 7 == 0 else [],
                    medical_conditions=["asthma"] if idx % 17 == 0 else [],
                    emergency_contact=f"Guardian {idx + 1}",
                    emergency_phone=f"+97798480{idx:04d}",
                    insurance_info={"provider": "NHI", "policy": f"NHI-{idx:05d}"},
                    doctor_name="School Medical Officer",
                    doctor_phone="+9779801010101",
                    last_checkup_date=min(year.start_date_ad + timedelta(days=(idx * 13) % 330), year.end_date_ad),
                )
            )

        visit_day = min(year.start_date_ad + timedelta(days=(idx * 9) % 320), year.end_date_ad)
        visit = MedicalVisit.query.filter_by(
            school_id=school.id,
            student_id=student.id,
            visit_date=visit_day,
            is_deleted=False,
        ).first()
        if not visit:
            db.session.add(
                MedicalVisit(
                    school_id=school.id,
                    student_id=student.id,
                    recorded_by=teachers[idx % len(teachers)].id,
                    visit_date=visit_day,
                    reason="Routine school health check",
                    diagnosis="Normal",
                    treatment="Hydration and rest",
                    referred_to="",
                    notes="Generated annual health record",
                )
            )

        vaccine_name = vaccines[idx % len(vaccines)]
        imm = Immunization.query.filter_by(
            school_id=school.id,
            student_id=student.id,
            vaccine_name=vaccine_name,
            dose_number=1,
            is_deleted=False,
        ).first()
        if not imm:
            vaccine_day = min(year.start_date_ad + timedelta(days=(idx * 7) % 300), year.end_date_ad)
            db.session.add(
                Immunization(
                    school_id=school.id,
                    student_id=student.id,
                    vaccine_name=vaccine_name,
                    dose_number=1,
                    date_administered=vaccine_day,
                    next_due_date=vaccine_day + timedelta(days=365),
                    administered_by="Municipality Health Unit",
                    batch_number=f"BATCH-{idx:05d}",
                    notes="Generated immunization record",
                )
            )
    db.session.commit()


def _seed_notifications(
    school: School,
    students: list[Student],
    parents: list[User],
    teachers: list[User],
    year: AcademicYear,
) -> None:
    message_dates = _month_starts(year.start_date_ad, year.end_date_ad)
    users = parents[:40] + teachers[:20]

    for idx, m_date in enumerate(message_dates, start=1):
        sent_at = datetime.combine(m_date, time(8, 30), tzinfo=timezone.utc)

        sms = SMSLog.query.filter_by(
            school_id=school.id,
            to_phone=users[idx % len(users)].phone,
            template_name=f"{SEED_TAG} monthly_notice",
            sent_at=sent_at,
            is_deleted=False,
        ).first()
        if not sms:
            db.session.add(
                SMSLog(
                    school_id=school.id,
                    to_phone=users[idx % len(users)].phone,
                    message=f"{SEED_TAG} Monthly update: {calendar.month_name[m_date.month]}",
                    template_name=f"{SEED_TAG} monthly_notice",
                    status="delivered",
                    provider="sparrow",
                    provider_message_id=f"MSG-{idx:04d}",
                    cost=1,
                    sent_at=sent_at,
                    delivered_at=sent_at + timedelta(minutes=1),
                    sent_by_id=teachers[idx % len(teachers)].id,
                )
            )

        wa = WhatsAppMessage.query.filter_by(
            school_id=school.id,
            to_phone=users[idx % len(users)].phone,
            wa_message_id=f"WA-{idx:04d}",
            is_deleted=False,
        ).first()
        if not wa:
            db.session.add(
                WhatsAppMessage(
                    school_id=school.id,
                    phone_number_id="ASCHOOL_BOT",
                    to_phone=users[idx % len(users)].phone,
                    from_phone="ASCHOOL",
                    direction="outbound",
                    message_type="template",
                    content=f"{SEED_TAG} Fee/attendance monthly summary.",
                    template_name="monthly_summary",
                    template_params=[str(m_date.month), str(m_date.year)],
                    wa_message_id=f"WA-{idx:04d}",
                    status="delivered",
                    is_bot_reply=True,
                    bot_command="monthly_summary",
                    sent_at=sent_at,
                )
            )

    for idx, student in enumerate(students[:40]):
        if not student.user_id:
            continue
        sent_at = datetime.now(timezone.utc) - timedelta(days=idx % 20)
        push = PushNotification.query.filter_by(
            school_id=school.id,
            user_id=student.user_id,
            title=f"{SEED_TAG} Homework Reminder",
            sent_at=sent_at,
            is_deleted=False,
        ).first()
        if not push:
            db.session.add(
                PushNotification(
                    school_id=school.id,
                    user_id=student.user_id,
                    title=f"{SEED_TAG} Homework Reminder",
                    body="Please complete today homework and check notice board.",
                    data={"type": "homework", "student_id": str(student.id)},
                    fcm_token=f"seed-token-{idx:03d}",
                    status="sent",
                    sent_at=sent_at,
                )
            )

    db.session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed complete test data for ASchool")
    parser.add_argument("--school-slug", default="demo", help="Target school slug")
    parser.add_argument(
        "--students-per-section",
        type=int,
        default=6,
        help="How many students to create in each section",
    )
    args = parser.parse_args()

    app = create_app("development")
    with app.app_context():
        run_seed(args.school_slug, max(1, args.students_per_section))


if __name__ == "__main__":
    main()
