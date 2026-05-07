"""Basic Reports plugin API — attendance, fee, and exam reports."""
from datetime import date, datetime, time

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func

from app.models.academic import Subject
from app.models.attendance import Attendance
from app.models.exam import Marks
from app.models.fee import FeeCollection
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response
from extensions import db

reports_bp = Blueprint("reports", __name__, url_prefix="/reports")


def _parse_date_boundary(value, end_of_day=False):
    parsed = date.fromisoformat(value)
    return datetime.combine(parsed, time.max if end_of_day else time.min)


def _fee_paid_amount(collection):
    if collection.payment_status == "paid":
        return float(collection.amount or 0)

    notes = collection.notes or ""
    marker = "[partial_paid:"
    if marker not in notes:
        return 0

    try:
        return float(notes.split(marker, 1)[1].split("]", 1)[0])
    except (IndexError, TypeError, ValueError):
        return 0


def _fee_due_amount(collection):
    return max(float(collection.amount or 0) - _fee_paid_amount(collection), 0)


@reports_bp.route("/attendance/summary", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin", "teacher")
def attendance_report():
    """Attendance summary report for a date range."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date", date.today().isoformat())
    class_id = request.args.get("class_id")

    if not start_date:
        return error_response("start_date is required", 400)

    query = db.session.query(
        Attendance.status,
        func.count(Attendance.id).label("count"),
    ).filter(
        Attendance.school_id == g.school_id,
        Attendance.date >= start_date,
        Attendance.date <= end_date,
        Attendance.is_deleted.is_(False),
    )

    if class_id:
        query = query.filter(Attendance.class_id == class_id)

    query = query.group_by(Attendance.status)
    results = query.all()

    summary = {r.status: r.count for r in results}
    total = sum(summary.values())

    return success_response({
        "period": {"start": start_date, "end": end_date},
        "class_id": class_id,
        "summary": summary,
        "total_records": total,
        "attendance_rate": round(summary.get("present", 0) / total * 100, 1) if total else 0,
    })


@reports_bp.route("/fees/collection", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin", "accountant")
def fee_collection_report():
    """Fee collection report for a date range."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date", date.today().isoformat())

    if not start_date:
        return error_response("start_date is required", 400)

    try:
        start_at = _parse_date_boundary(start_date)
        end_at = _parse_date_boundary(end_date, end_of_day=True)
    except ValueError:
        return error_response("Dates must use YYYY-MM-DD format", 400)

    paid_collections = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.collected_at >= start_at,
        FeeCollection.collected_at <= end_at,
        FeeCollection.payment_status == "paid",
        FeeCollection.is_deleted.is_(False),
    ).all()
    total_collected = sum(_fee_paid_amount(collection) for collection in paid_collections)

    pending_collections = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.payment_status.in_(("pending", "partial")),
        FeeCollection.is_deleted.is_(False),
    ).all()
    total_pending = sum(_fee_due_amount(collection) for collection in pending_collections)

    total_students = Student.query.filter_by(
        school_id=g.school_id, status="active", is_deleted=False
    ).count()

    return success_response({
        "period": {"start": start_date, "end": end_date},
        "total_collected": float(total_collected),
        "total_pending": float(total_pending),
        "total_students": total_students,
        "payments_count": len(paid_collections),
        "collection_rate": round(float(total_collected) / (float(total_collected) + float(total_pending)) * 100, 1) if total_collected else 0,
    })


@reports_bp.route("/exams/results", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin", "teacher")
def exam_results_report():
    """Exam results summary report."""
    exam_id = request.args.get("exam_id")
    class_id = request.args.get("class_id")

    if not exam_id:
        return error_response("exam_id is required", 400)

    score_expr = func.coalesce(Marks.total_marks, Marks.obtained_marks, 0)
    full_marks_expr = func.coalesce(Marks.full_marks, 100)
    pass_marks_expr = func.coalesce(Marks.pass_marks, 40)
    failed_expr = case((score_expr < pass_marks_expr, 1), else_=0)

    query = db.session.query(
        Marks.subject_id,
        Subject.name.label("subject_name"),
        func.avg(score_expr).label("avg_marks"),
        func.max(score_expr).label("max_marks"),
        func.min(score_expr).label("min_marks"),
        func.max(full_marks_expr).label("full_marks"),
        func.max(pass_marks_expr).label("pass_marks"),
        func.count(Marks.id).label("student_count"),
        func.sum(failed_expr).label("failed_count"),
    ).filter(
        Marks.school_id == g.school_id,
        Marks.exam_id == exam_id,
        Marks.is_deleted.is_(False),
    ).outerjoin(Subject, Subject.id == Marks.subject_id)

    if class_id:
        query = query.filter(Marks.class_id == class_id)

    query = query.group_by(Marks.subject_id, Subject.name)
    results = query.all()

    subjects = []
    for r in results:
        failed_count = int(r.failed_count or 0)
        student_count = int(r.student_count or 0)
        passed_count = max(student_count - failed_count, 0)
        subjects.append({
            "subject_id": str(r.subject_id),
            "subject_name": r.subject_name,
            "avg_marks": round(float(r.avg_marks), 2),
            "max_marks": float(r.max_marks),
            "min_marks": float(r.min_marks),
            "full_marks": float(r.full_marks or 100),
            "pass_marks": float(r.pass_marks or 40),
            "student_count": student_count,
            "passed_count": passed_count,
            "failed_count": failed_count,
            "pass_rate": round((passed_count / student_count) * 100, 1) if student_count else 0,
        })

    return success_response({
        "exam_id": exam_id,
        "class_id": class_id,
        "subjects": subjects,
        "total_records": sum(subject["student_count"] for subject in subjects),
    })


@reports_bp.route("/dashboard", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin")
def dashboard_report():
    """School dashboard summary stats."""
    total_students = Student.query.filter_by(
        school_id=g.school_id, status="active", is_deleted=False
    ).count()

    today_present = Attendance.query.filter_by(
        school_id=g.school_id, date=date.today(), status="present", is_deleted=False
    ).count()
    today_absent = Attendance.query.filter_by(
        school_id=g.school_id, date=date.today(), status="absent", is_deleted=False
    ).count()

    monthly_collected = db.session.query(
        func.sum(FeeCollection.amount)
    ).filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.payment_status == "paid",
        func.extract("month", FeeCollection.collected_at) == date.today().month,
        func.extract("year", FeeCollection.collected_at) == date.today().year,
        FeeCollection.is_deleted.is_(False),
    ).scalar() or 0

    return success_response({
        "total_students": total_students,
        "today_attendance": {
            "present": today_present,
            "absent": today_absent,
            "rate": round(today_present / total_students * 100, 1) if total_students else 0,
        },
        "monthly_fee_collected": float(monthly_collected),
    })
