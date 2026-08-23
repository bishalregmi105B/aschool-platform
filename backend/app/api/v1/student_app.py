"""Student app API endpoints for mobile Flutter client."""
from datetime import date, datetime
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.attendance import Attendance
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.exam import Marks, ReportCard
from app.models.academic import Subject
from app.models.fee import FeeCollection
from app.models.library import Book, BookIssue
from app.models.lms import Course, Quiz, QuizAttempt, StudentProgress
from app.models.notice import Notice
from app.models.portfolio import StudentPortfolio, PortfolioItem
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.models.wellbeing import MoodEntry
from app.utils.decorators import school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.response import success_response, error_response
from extensions import db

student_app_bp = Blueprint("student_app", __name__, url_prefix="/student")


def _current_student():
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return Student.query.filter_by(
        school_id=g.school_id,
        user_id=user_id,
        is_deleted=False,
    ).first()


@student_app_bp.route("/dashboard", methods=["GET"])
@jwt_required()
@school_required
def student_dashboard():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    now = datetime.now()
    today_name = now.strftime("%A")
    current_minutes = now.hour * 60 + now.minute

    today_slots = (
        TimetableSlot.query.filter_by(
            school_id=g.school_id,
            class_id=student.class_id,
            section_id=student.section_id,
            day_of_week=today_name,
            is_deleted=False,
        )
        .order_by(TimetableSlot.period_number.asc())
        .all()
    )

    notices = (
        Notice.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(Notice.created_at.desc())
        .limit(10)
        .all()
    )

    assignments = (
        Assignment.query.filter_by(school_id=g.school_id, class_id=student.class_id, is_deleted=False)
        .order_by(Assignment.due_date.asc())
        .limit(20)
        .all()
    )

    submitted_ids = {
        str(s.assignment_id)
        for s in AssignmentSubmission.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            is_deleted=False,
        ).all()
    }

    pending_homework = [
        {
            "id": str(a.id),
            "title": a.title,
            "description": a.description,
            "subject": a.subject.name if a.subject else None,
            "subject_name": a.subject.name if a.subject else None,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "is_overdue": bool(a.due_date and a.due_date.date() < date.today()),
        }
        for a in assignments
        if str(a.id) not in submitted_ids
    ]

    recent_results = (
        ReportCard.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            is_deleted=False,
        )
        .order_by(ReportCard.created_at.desc())
        .limit(5)
        .all()
    )

    attendance_rows = Attendance.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        is_deleted=False,
    ).all()
    total_days = len(attendance_rows)
    present_days = sum(1 for row in attendance_rows if row.status == "present")
    late_days = sum(1 for row in attendance_rows if row.status == "late")
    percentage = round(((present_days + late_days) / total_days) * 100, 1) if total_days else 0

    today_classes = []
    for slot in today_slots:
        start_minutes = (
            slot.start_time.hour * 60 + slot.start_time.minute if slot.start_time else None
        )
        end_minutes = (
            slot.end_time.hour * 60 + slot.end_time.minute if slot.end_time else None
        )
        is_current = (
            start_minutes is not None
            and end_minutes is not None
            and start_minutes <= current_minutes <= end_minutes
        )

        today_classes.append(
            {
                "id": str(slot.id),
                "period": slot.period_number,
                "start_time": slot.start_time.strftime("%H:%M") if slot.start_time else None,
                "end_time": slot.end_time.strftime("%H:%M") if slot.end_time else None,
                "subject": slot.subject.name if slot.subject else ("Break" if slot.is_break else "Free Period"),
                "teacher": slot.teacher.full_name if slot.teacher else None,
                "is_break": bool(slot.is_break),
                "is_current": is_current,
            }
        )

    return success_response(
        {
            "today_classes": today_classes,
            "pending_homework": pending_homework,
            "recent_results": [
                {
                    "exam_name": rc.exam.name if rc.exam else "Exam",
                    "percentage": float(rc.percentage or 0),
                    "gpa": float(rc.overall_gpa or 0),
                    "grade": rc.overall_grade,
                    "rank": rc.rank,
                }
                for rc in recent_results
            ],
            "notices": [
                {
                    "id": str(n.id),
                    "title": n.title,
                    "content": n.content,
                    "priority": "urgent" if n.is_pinned else "normal",
                    "published_at": n.published_at.isoformat() if n.published_at else None,
                }
                for n in notices
            ],
            "attendance": {
                "percentage": percentage,
                "total_days": total_days,
                "present_days": present_days,
                "late_days": late_days,
                "absent_days": sum(1 for row in attendance_rows if row.status == "absent"),
            },
            "rank": recent_results[0].rank if recent_results else None,
        }
    )


@student_app_bp.route("/assignments", methods=["GET"])
@jwt_required()
@school_required
def student_assignments():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    all_assignments = (
        Assignment.query.filter_by(school_id=g.school_id, class_id=student.class_id, is_deleted=False)
        .order_by(Assignment.due_date.asc())
        .all()
    )

    submissions = AssignmentSubmission.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        is_deleted=False,
    ).all()

    by_assignment = {str(s.assignment_id): s for s in submissions}

    pending = []
    submitted = []
    for a in all_assignments:
        row = {
            "id": str(a.id),
            "title": a.title,
            "description": a.description,
            "subject": a.subject.name if a.subject else None,
            "teacher": a.teacher.full_name if a.teacher else None,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "due_date_bs": ad_to_bs(a.due_date) if a.due_date else None,
            "is_overdue": bool(a.due_date and a.due_date.date() < date.today()),
            "attachments": a.attachment_urls or [],
            "attachment_urls": a.attachment_urls or [],
            "total_marks": a.total_marks,
        }
        sub = by_assignment.get(str(a.id))
        if sub:
            row["marks"] = float(sub.marks) if sub.marks is not None else None
            row["feedback"] = sub.feedback
            submitted.append(row)
        else:
            pending.append(row)

    return success_response({"pending": pending, "submitted": submitted})


@student_app_bp.route("/assignments/<uuid:assignment_id>/submit", methods=["POST"])
@jwt_required()
@school_required
def submit_assignment(assignment_id):
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    assignment = Assignment.query.get(assignment_id)
    if not assignment or assignment.is_deleted or str(assignment.school_id) != str(g.school_id):
        return error_response("Assignment not found", 404)

    data = request.get_json(silent=True) or {}
    submission = AssignmentSubmission.query.filter_by(
        school_id=g.school_id,
        assignment_id=assignment.id,
        student_id=student.id,
        is_deleted=False,
    ).first()

    if not submission:
        submission = AssignmentSubmission(
            school_id=g.school_id,
            assignment_id=assignment.id,
            student_id=student.id,
        )
        db.session.add(submission)

    submission.content = data.get("note") or data.get("remarks") or ""
    submission.attachment_urls = data.get("attachment_urls") or (
        [data["file_url"]] if data.get("file_url") else submission.attachment_urls
    )
    submission.status = "submitted"
    db.session.commit()
    return success_response({"submitted": True})


@student_app_bp.route("/results", methods=["GET"])
@jwt_required()
@school_required
def student_results():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    cards = (
        ReportCard.query.filter_by(school_id=g.school_id, student_id=student.id, is_deleted=False)
        .order_by(ReportCard.created_at.desc())
        .all()
    )

    marks_rows = (
        Marks.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            is_deleted=False,
        )
        .order_by(Marks.created_at.desc())
        .all()
    )

    marks_by_exam = {}
    for mark in marks_rows:
        marks_by_exam.setdefault(str(mark.exam_id), []).append(mark)

    cards_by_exam = {str(card.exam_id): card for card in cards}
    ordered_exam_ids = []
    for card in cards:
        exam_id = str(card.exam_id)
        if exam_id not in ordered_exam_ids:
            ordered_exam_ids.append(exam_id)
    for exam_id in marks_by_exam.keys():
        if exam_id not in ordered_exam_ids:
            ordered_exam_ids.append(exam_id)

    exams = []
    for exam_id in ordered_exam_ids:
        card = cards_by_exam.get(exam_id)
        grouped_marks = marks_by_exam.get(exam_id, [])

        if card and card.exam:
            exam_name = card.exam.name
            exam_term = card.exam.exam_type
        elif grouped_marks and grouped_marks[0].exam:
            exam_name = grouped_marks[0].exam.name
            exam_term = grouped_marks[0].exam.exam_type
        else:
            exam_name = "Exam"
            exam_term = None

        subjects = [
            {
                "subject": mark.subject.name if mark.subject else "Subject",
                "subject_id": str(mark.subject_id),
                "obtained": float(mark.total_marks or mark.theory_marks or 0),
                "full_marks": float(mark.full_marks or 100),
                "grade": mark.grade or "N/A",
            }
            for mark in grouped_marks
        ]

        marks_obtained = sum(float(mark.total_marks or mark.theory_marks or 0) for mark in grouped_marks)
        total_marks = sum(float(mark.full_marks or 100) for mark in grouped_marks)
        calculated_percentage = round((marks_obtained / total_marks) * 100, 2) if total_marks else 0

        exams.append(
            {
                "id": str(card.id) if card else exam_id,
                "exam_id": exam_id,
                "exam_name": exam_name,
                "term": exam_term,
                "marks_obtained": marks_obtained,
                "total_marks": total_marks,
                "percentage": float(card.percentage or calculated_percentage) if card else calculated_percentage,
                "gpa": float(card.overall_gpa or 0) if card else 0,
                "grade": card.overall_grade if card and card.overall_grade else "-",
                "rank": card.rank if card else None,
                "remarks": (
                    card.teacher_remarks
                    or card.principal_remarks
                    or card.ai_remarks
                    if card
                    else None
                ),
                "subjects": subjects,
            }
        )

    return success_response({"exams": exams})


@student_app_bp.route("/timetable", methods=["GET"])
@jwt_required()
@school_required
def student_timetable():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    day_index = request.args.get("day", type=int)
    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    day = days[day_index] if day_index is not None and 0 <= day_index < len(days) else None

    query = TimetableSlot.query.filter_by(
        school_id=g.school_id,
        class_id=student.class_id,
        section_id=student.section_id,
        is_deleted=False,
    )
    if day:
        query = query.filter_by(day_of_week=day)

    slots = query.order_by(TimetableSlot.period_number.asc()).all()

    return success_response(
        {
            "periods": [
                {
                    "id": str(s.id),
                    "day_of_week": s.day_of_week,
                    "period_number": s.period_number,
                    "start_time": s.start_time.strftime("%H:%M") if s.start_time else None,
                    "end_time": s.end_time.strftime("%H:%M") if s.end_time else None,
                    "subject": s.subject.name if s.subject else None,
                    "teacher": s.teacher.full_name if s.teacher else None,
                    "is_break": s.is_break,
                }
                for s in slots
            ]
        }
    )


@student_app_bp.route("/library", methods=["GET"])
@jwt_required()
@school_required
def student_library():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    books = Book.query.filter_by(school_id=g.school_id, is_deleted=False).order_by(Book.title.asc()).all()
    issues = BookIssue.query.filter_by(school_id=g.school_id, student_id=student.id, is_deleted=False).all()

    return success_response(
        {
            "catalog": [
                {
                    "id": str(b.id),
                    "title": b.title,
                    "author": b.author,
                    "category": b.category,
                    "available_copies": b.available_copies,
                }
                for b in books
            ],
            "issued": [
                {
                    "id": str(i.id),
                    "title": i.book.title if i.book else None,
                    "author": i.book.author if i.book else None,
                    "due_date": i.due_date.isoformat() if i.due_date else None,
                    "is_overdue": bool(i.due_date and i.due_date < date.today() and i.status == "issued"),
                }
                for i in issues
            ],
        }
    )


@student_app_bp.route("/library/request", methods=["POST"])
@jwt_required()
@school_required
def student_library_request():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    data = request.get_json(silent=True) or {}
    book_id = data.get("book_id")
    if not book_id:
        return error_response("book_id is required", 400)

    book = Book.query.get(book_id)
    if not book or book.is_deleted or str(book.school_id) != str(g.school_id):
        return error_response("Book not found", 404)

    return success_response({"requested": True})


@student_app_bp.route("/elibrary", methods=["GET"])
@jwt_required()
@school_required
def student_elibrary():
    books = Book.query.filter_by(school_id=g.school_id, is_deleted=False).order_by(Book.title.asc()).all()
    payload = [
        {
            "id": str(b.id),
            "title": b.title,
            "subject": b.category,
            "file_size": None,
        }
        for b in books
    ]
    return success_response({"ebooks": payload, "past_papers": [], "resources": []})


@student_app_bp.route("/lms", methods=["GET"])
@jwt_required()
@school_required
def student_lms():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    courses = Course.query.filter_by(school_id=g.school_id, is_deleted=False, is_published=True).all()
    subject_ids = [course.subject_id for course in courses if course.subject_id]
    subjects = {
        str(subject.id): subject
        for subject in Subject.query.filter(
            Subject.school_id == g.school_id,
            Subject.id.in_(subject_ids) if subject_ids else False,
            Subject.is_deleted.is_(False),
        ).all()
    }
    quizzes = Quiz.query.join(Course, Quiz.course_id == Course.id).filter(
        Course.school_id == g.school_id,
        Quiz.is_deleted.is_(False),
        Quiz.is_published.is_(True),
    ).all()
    quiz_ids = [q.id for q in quizzes]
    attempts = QuizAttempt.query.filter(
        QuizAttempt.school_id == g.school_id,
        QuizAttempt.student_id == get_jwt_identity(),
        QuizAttempt.quiz_id.in_(quiz_ids) if quiz_ids else False,
        QuizAttempt.is_deleted.is_(False),
    ).all()
    attempts_by_quiz = {str(attempt.quiz_id): attempt for attempt in attempts}

    course_ids = [c.id for c in courses]
    progress_rows = StudentProgress.query.filter(
        StudentProgress.school_id == g.school_id,
        StudentProgress.student_id == student.id,
        StudentProgress.course_id.in_(course_ids) if course_ids else False,
        StudentProgress.is_deleted.is_(False),
    ).all()

    progress_by_course = {}
    for p in progress_rows:
        progress_by_course.setdefault(str(p.course_id), []).append(p)

    course_payload = []
    for c in courses:
        course_progress = progress_by_course.get(str(c.id), [])
        completed_lessons = len([p for p in course_progress if p.completed])
        total_lessons = c.total_lessons or 0
        pct = round((completed_lessons / total_lessons) * 100, 1) if total_lessons > 0 else 0
        course_payload.append(
            {
                "id": str(c.id),
                "title": c.title,
                "subject": subjects.get(str(c.subject_id)).name if c.subject_id and subjects.get(str(c.subject_id)) else None,
                "teacher": c.teacher.full_name if c.teacher else None,
                "progress": pct,
                "total_lessons": total_lessons,
                "completed_lessons": completed_lessons,
            }
        )

    return success_response(
        {
            "courses": course_payload,
            "quizzes": [
                {
                    "id": str(q.id),
                    "title": q.title,
                    "subject": (
                        subjects.get(str(q.course.subject_id)).name
                        if q.course and q.course.subject_id and subjects.get(str(q.course.subject_id))
                        else None
                    ),
                    "questions_count": len(q.questions or []),
                    "questions": q.questions or [],
                    "total_marks": q.total_marks or 0,
                    "time_limit_minutes": q.time_limit_minutes,
                    "status": "completed" if str(q.id) in attempts_by_quiz else "pending",
                    "score": (
                        attempts_by_quiz[str(q.id)].score
                        if str(q.id) in attempts_by_quiz
                        else None
                    ),
                }
                for q in quizzes
            ],
        }
    )


@student_app_bp.route("/portfolio", methods=["GET"])
@jwt_required()
@school_required
def student_portfolio():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    portfolio = StudentPortfolio.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        is_deleted=False,
    ).first()
    items = []
    if portfolio:
        items = PortfolioItem.query.filter_by(
            school_id=g.school_id,
            portfolio_id=portfolio.id,
            is_deleted=False,
        ).all()

    return success_response(
        {
            "class_name": student.klass.name if student.klass else None,
            "overall_gpa": None,
            "attendance_pct": None,
            "badges": [],
            "awards": [],
            "activities": [],
            "endorsements": [],
            "academic_records": [],
            "ai_summary": None,
            "portfolio_items": [
                {
                    "id": str(i.id),
                    "title": i.title,
                    "description": i.description,
                    "item_type": i.item_type,
                }
                for i in items
            ],
        }
    )


@student_app_bp.route("/achievements", methods=["GET"])
@jwt_required()
@school_required
def student_achievements():
    return success_response(
        {
            "total_points": 0,
            "rank": None,
            "badges": [],
            "locked_badges": [],
            "leaderboard": [],
            "history": [],
        }
    )


@student_app_bp.route("/wellbeing", methods=["GET"])
@jwt_required()
@school_required
def student_wellbeing():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    entries = (
        MoodEntry.query.filter_by(school_id=g.school_id, student_id=student.id, is_deleted=False)
        .order_by(MoodEntry.created_at.desc())
        .limit(10)
        .all()
    )

    return success_response(
        {
            "today_mood": entries[0].mood if entries else None,
            "weekly_moods": [
                {
                    "day": (e.created_at.strftime("%a") if e.created_at else ""),
                    "mood": e.mood,
                }
                for e in entries[:7]
            ],
            "recent_entries": [
                {
                    "mood": e.mood,
                    "note": e.notes,
                    "date": e.created_at.isoformat() if e.created_at else None,
                }
                for e in entries
            ],
        }
    )


@student_app_bp.route("/wellbeing/mood", methods=["POST"])
@jwt_required()
@school_required
def submit_student_mood():
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    data = request.get_json(silent=True) or {}
    mood = data.get("mood")
    if not mood:
        return error_response("mood is required", 400)

    entry = MoodEntry(
        school_id=g.school_id,
        student_id=student.id,
        mood=mood,
        notes=data.get("note"),
    )
    db.session.add(entry)
    db.session.commit()
    return success_response({"saved": True})


def _student_partial_paid(collection) -> float:
    """Paid amount for a collection, mirroring parent_app._extract_partial_paid."""
    if collection.payment_status == "paid":
        return float(collection.amount or 0)

    notes = collection.notes or ""
    marker = "[partial_paid:"
    if marker not in notes:
        return 0

    try:
        value = notes.split(marker, 1)[1].split("]", 1)[0]
        return min(max(float(value), 0), float(collection.amount or 0))
    except (ValueError, IndexError):
        return 0


@student_app_bp.route("/fees", methods=["GET"])
@jwt_required()
@school_required
def student_fees():
    """The student's own fee overview and collection history."""
    student = _current_student()
    if not student:
        return error_response("Student profile not found", 404)

    collections = (
        FeeCollection.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            is_deleted=False,
        )
        .order_by(FeeCollection.created_at.desc())
        .all()
    )

    total_fees = 0.0
    paid = 0.0
    invoices = []
    for c in collections:
        amount = float(c.amount or 0)
        paid_amount = _student_partial_paid(c)
        due_amount = max(amount - paid_amount, 0)
        total_fees += amount
        paid += paid_amount
        status = c.payment_status or "pending"
        if due_amount <= 0 and status in (None, "pending", "partial"):
            status = "paid"
        month_parts = [part for part in [c.month_bs, c.year_bs] if part]
        invoices.append(
            {
                "id": str(c.id),
                "title": c.fee_item_name or "Fee",
                "fee_type": c.fee_item_name or "Fee",
                "month": " ".join(month_parts) if month_parts else None,
                "amount": round(due_amount if due_amount > 0 else amount, 2),
                "status": status,
            }
        )

    return success_response(
        {
            "overview": {
                "total_fees": round(total_fees, 2),
                "paid": round(paid, 2),
                "due": round(max(total_fees - paid, 0), 2),
            },
            "invoices": invoices,
        }
    )
