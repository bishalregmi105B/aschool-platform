"""Basic Reports plugin API — attendance, fee, and exam reports.

Every report endpoint keeps its JSON summary (the dashboard/report pages
consume those tables) and exposes an adjacent ``/pdf`` export that renders a
real WeasyPrint document (letterhead, NPR amounts, Bikram Sambat issue date),
persists it via ``app.utils.file_upload.upload_file`` and returns a download
URL — the same pattern as the report-card Celery task.
"""
import io
import re
from datetime import date, datetime, time

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from markupsafe import escape
from sqlalchemy import case, func

from app.models.academic import Class, Subject
from app.models.attendance import Attendance
from app.models.exam import Exam, Marks
from app.models.fee import FeeCollection
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.report_pdf import build_report_html, fmt_npr, render_report_pdf
from app.utils.response import error_response, success_response
from extensions import db

reports_bp = Blueprint("reports", __name__, url_prefix="/reports")


def _parse_date_boundary(value, end_of_day=False):
    parsed = date.fromisoformat(value)
    return datetime.combine(parsed, time.max if end_of_day else time.min)


def _fee_paid_amount(collection):
    """Money actually recorded against a collection.

    Delegates to the canonical fees helpers (E120): the raw `amount` column
    stores the BASE fee, so a fully-paid DISCOUNTED bill would overstate
    collections by the discount (and understate it when a late fine applies)
    if read directly. `_extract_partial_paid` returns the payable total
    (base + fine − discount) for paid collections and the cumulative
    `[partial_paid:…]` note value otherwise — identical to /fees/summary.
    """
    from app.api.v1.fees import _extract_partial_paid

    return _extract_partial_paid(collection)


def _fee_due_amount(collection):
    from app.api.v1.fees import _collection_payable_total, _extract_partial_paid

    return max(
        _collection_payable_total(collection) - _extract_partial_paid(collection),
        0,
    )


# ── Shared data builders (used by both the JSON and the PDF endpoints) ────


def _attendance_summary_data(school_id, start_date, end_date, class_id):
    """Attendance status summary for a date range (same shape as the JSON API)."""
    query = db.session.query(
        Attendance.status,
        func.count(Attendance.id).label("count"),
    ).filter(
        Attendance.school_id == school_id,
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

    return {
        "period": {"start": start_date, "end": end_date},
        "class_id": class_id,
        "summary": summary,
        "total_records": total,
        # Uniform late rule: late students DID attend, so the rate counts
        # present + late (matches the per-student report and attendance API).
        "attendance_rate": round(
            (summary.get("present", 0) + summary.get("late", 0)) / total * 100, 1
        ) if total else 0,
    }


def _attendance_per_class(school_id, start_date, end_date):
    """Per-class status breakdown (used to enrich the PDF export)."""
    rows = (
        db.session.query(
            Class.name.label("class_name"),
            Attendance.status,
            func.count(Attendance.id).label("count"),
        )
        .join(Class, Class.id == Attendance.class_id)
        .filter(
            Attendance.school_id == school_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
            Attendance.is_deleted.is_(False),
        )
        .group_by(Class.name, Attendance.status)
        .order_by(Class.name)
        .all()
    )

    by_class = {}
    for r in rows:
        entry = by_class.setdefault(r.class_name, {})
        entry[r.status] = int(r.count)
    return by_class


def _fee_collection_summary_data(school_id, start_at, end_at):
    """Fee collection totals for a date range, plus per-payment rows for PDFs."""
    paid_collections = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.collected_at >= start_at,
        FeeCollection.collected_at <= end_at,
        FeeCollection.payment_status == "paid",
        FeeCollection.is_deleted.is_(False),
    ).all()
    total_collected = sum(_fee_paid_amount(collection) for collection in paid_collections)

    pending_collections = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.payment_status.in_(("pending", "partial")),
        FeeCollection.is_deleted.is_(False),
    ).all()
    total_pending = sum(_fee_due_amount(collection) for collection in pending_collections)

    total_students = Student.query.filter_by(
        school_id=school_id, status="active", is_deleted=False
    ).count()

    student_ids = {c.student_id for c in paid_collections}
    student_names = {}
    if student_ids:
        student_names = {
            s.id: f"{s.first_name} {s.last_name}"
            for s in Student.query.filter(Student.id.in_(student_ids)).all()
        }

    payment_rows = [
        {
            "student_name": student_names.get(c.student_id, "Unknown"),
            "fee_item_name": c.fee_item_name or "Fee",
            "amount": _fee_paid_amount(c),
            "payment_method": c.payment_method or "-",
            "collected_at": c.collected_at,
        }
        for c in paid_collections
    ]

    return {
        "period_start": start_at,
        "period_end": end_at,
        "total_collected": float(total_collected),
        "total_pending": float(total_pending),
        "total_students": total_students,
        "payments_count": len(paid_collections),
        "collection_rate": round(float(total_collected) / (float(total_collected) + float(total_pending)) * 100, 1) if total_collected else 0,
        "payment_rows": payment_rows,
    }


def _exam_results_subjects(school_id, exam_id, class_id):
    """Per-subject result stats for an exam (same shape as the JSON API)."""
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
        Marks.school_id == school_id,
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
    return subjects


# ── PDF persistence helper ────────────────────────────────────────────────


def _persist_report_pdf(pdf_bytes: bytes, filename: str) -> str:
    """Store a generated PDF via the platform's canonical upload pipeline and
    return its served URL (local /uploads/... or R2 public URL)."""
    from app.utils.file_upload import upload_file

    payload = io.BytesIO(pdf_bytes)
    payload.filename = filename
    payload.content_type = "application/pdf"
    return upload_file(payload, folder=f"reports/{g.school_id}", filename=filename)


def _report_export_response(pdf_bytes: bytes, filename: str, extra: dict | None = None):
    try:
        url = _persist_report_pdf(pdf_bytes, filename)
    except Exception as exc:
        return error_response(f"Failed to store report file: {exc}", 500)
    data = {
        "pdf_url": url,
        "filename": filename,
        "size_bytes": len(pdf_bytes),
        **(extra or {}),
    }
    return success_response(data)


# ── JSON report endpoints (unchanged response shapes) ─────────────────────


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

    data = _attendance_summary_data(g.school_id, start_date, end_date, class_id)
    # Per-student breakdown + headline stats for the attendance Monthly Report
    # page (student_name/present/absent/late/leave/percentage per student and
    # summary.working_days / avg_attendance / total_students / below_threshold).
    students, headline = _attendance_per_student(
        g.school_id, start_date, end_date, class_id
    )
    data["students"] = students
    data["summary"].update(headline)
    return success_response(data)


def _attendance_per_student(school_id, start_date, end_date, class_id=None):
    """Student-wise status counts and attendance % for a date range.

    Returns (rows, headline) where rows are sorted by student name and
    headline carries working_days / avg_attendance / total_students /
    below_threshold over the same population.
    """
    base = db.session.query(
        Attendance.student_id,
        Attendance.status,
        func.count(Attendance.id).label("cnt"),
    ).filter(
        Attendance.school_id == school_id,
        Attendance.date >= start_date,
        Attendance.date <= end_date,
        Attendance.is_deleted.is_(False),
    )
    if class_id:
        base = base.filter(Attendance.class_id == class_id)
    base = base.group_by(Attendance.student_id, Attendance.status).all()

    status_by_student: dict = {}
    for row in base:
        status_by_student.setdefault(row.student_id, {})[row.status] = int(row.cnt)

    student_ids = set(status_by_student)
    students_by_id = {}
    if student_ids:
        for s in Student.query.filter(Student.id.in_(student_ids)).all():
            students_by_id[s.id] = s

    rows = []
    totals = {"present": 0, "absent": 0, "late": 0, "leave": 0, "records": 0}
    below_threshold = 0
    for sid, counts in status_by_student.items():
        student = students_by_id.get(sid)
        name = (
            f"{student.first_name or ''} {student.last_name or ''}".strip()
            if student
            else "Unknown"
        )
        present = counts.get("present", 0)
        late = counts.get("late", 0)
        total = sum(counts.values())
        pct = round((present + late) / total * 100, 1) if total else 0.0
        if total and pct < 75:
            below_threshold += 1
        totals["present"] += present
        totals["absent"] += counts.get("absent", 0)
        totals["late"] += late
        totals["leave"] += counts.get("leave", 0)
        totals["records"] += total
        rows.append(
            {
                "student_id": str(sid),
                "student_name": name,
                "roll_number": student.roll_number if student else None,
                "present": present,
                "absent": counts.get("absent", 0),
                "late": late,
                "leave": counts.get("leave", 0),
                "total_days": total,
                "percentage": pct,
            }
        )
    rows.sort(key=lambda r: (r["student_name"],))

    working_days = (
        db.session.query(func.count(func.distinct(Attendance.date)))
        .filter(
            Attendance.school_id == school_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
            Attendance.is_deleted.is_(False),
            *([Attendance.class_id == class_id] if class_id else []),
        )
        .scalar()
        or 0
    )
    headline = {
        "working_days": working_days,
        "avg_attendance": (
            round((totals["present"] + totals["late"]) / totals["records"] * 100, 1)
            if totals["records"]
            else 0
        ),
        "total_students": len(rows),
        "below_threshold": below_threshold,
    }
    return rows, headline


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

    data = _fee_collection_summary_data(g.school_id, start_at, end_at)
    data.pop("period_start", None)
    data.pop("period_end", None)
    data.pop("payment_rows", None)

    return success_response({
        "period": {"start": start_date, "end": end_date},
        "total_collected": data["total_collected"],
        "total_pending": data["total_pending"],
        "total_students": data["total_students"],
        "payments_count": data["payments_count"],
        "collection_rate": data["collection_rate"],
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

    subjects = _exam_results_subjects(g.school_id, exam_id, class_id)

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

    # E171: `_fee_collection_summary_data` was fixed (E120) to count the
    # PAYABLE amount of paid collections, but this dashboard aggregate still
    # summed the raw base `amount` column — discount-free bills only. A fully
    # paid Rs 1000 bill with a Rs 250 discount reported Rs 1000 collected.
    month_start = datetime.combine(date.today().replace(day=1), time.min)
    month_end = _parse_date_boundary(date.today().isoformat(), end_of_day=True)
    monthly_rows = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.payment_status == "paid",
        FeeCollection.collected_at >= month_start,
        FeeCollection.collected_at <= month_end,
        FeeCollection.is_deleted.is_(False),
    ).all()
    monthly_collected = sum(_fee_paid_amount(row) for row in monthly_rows)

    return success_response({
        "total_students": total_students,
        "today_attendance": {
            "present": today_present,
            "absent": today_absent,
            "rate": round(today_present / total_students * 100, 1) if total_students else 0,
        },
        "monthly_fee_collected": float(monthly_collected),
    })


# ── PDF export endpoints (real downloadable documents) ────────────────────


def _generate_pdf(html: str):
    """Render PDF bytes, mapping WeasyPrint absence to 501 per platform convention."""
    try:
        return render_report_pdf(html)
    except ImportError:
        return None


@reports_bp.route("/attendance/summary/pdf", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin", "teacher")
def attendance_report_pdf():
    """PDF export of the attendance summary report."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date", date.today().isoformat())
    class_id = request.args.get("class_id")

    if not start_date:
        return error_response("start_date is required", 400)

    data = _attendance_summary_data(g.school_id, start_date, end_date, class_id)
    summary = data["summary"]
    total = data["total_records"]

    status_rows = ""
    for status in ("present", "absent", "late", "leave", "excused"):
        if status in summary:
            status_rows += (
                f"<tr><td>{escape(status.title())}</td>"
                f'<td class="num">{summary[status]}</td></tr>'
            )
    # Any custom statuses outside the well-known set
    for status, count in summary.items():
        if status not in ("present", "absent", "late", "leave", "excused"):
            status_rows += (
                f"<tr><td>{escape(str(status).title())}</td>"
                f'<td class="num">{count}</td></tr>'
            )

    body = f"""
  <h2 class="section">Attendance Summary ({escape(start_date)} to {escape(end_date)})</h2>
  <table>
    <thead><tr><th>Status</th><th class="num">Records</th></tr></thead>
    <tbody>
      {status_rows}
      <tr class="total-row"><td>Total</td><td class="num">{total}</td></tr>
    </tbody>
  </table>
  <p><strong>Attendance rate: {data['attendance_rate']}%</strong></p>
"""

    if not class_id:
        by_class = _attendance_per_class(g.school_id, start_date, end_date)
        if by_class:
            rows = ""
            for class_name, counts in by_class.items():
                class_total = sum(counts.values())
                present = counts.get("present", 0)
                rate = round(present / class_total * 100, 1) if class_total else 0
                rows += (
                    f"<tr><td>{escape(class_name)}</td>"
                    f'<td class="num">{class_total}</td>'
                    f'<td class="num">{present}</td>'
                    f'<td class="num">{counts.get("absent", 0)}</td>'
                    f'<td class="num">{counts.get("late", 0)}</td>'
                    f'<td class="num">{rate}%</td></tr>'
                )
            body += f"""
  <h2 class="section">Class-wise Breakdown</h2>
  <table>
    <thead><tr><th>Class</th><th class="num">Records</th><th class="num">Present</th>
    <th class="num">Absent</th><th class="num">Late</th><th class="num">Rate</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
"""

    from app.models.school import School

    html = build_report_html(
        "Attendance Report",
        body,
        school=School.query.get(g.school_id),
        subtitle="Basic Reports",
    )

    pdf_bytes = _generate_pdf(html)
    if pdf_bytes is None:
        return error_response("PDF export is unavailable on this server", 501)

    # Distinct filename per class scope so exports don't overwrite each other
    class_suffix = ""
    if class_id:
        safe_class = re.sub(r"[^A-Za-z0-9_-]+", "", str(class_id))[:12]
        class_suffix = f"_class_{safe_class}"
    filename = f"attendance_report_{start_date}_{end_date}{class_suffix}.pdf"
    return _report_export_response(pdf_bytes, filename, extra={"period": data["period"]})


@reports_bp.route("/fees/collection/pdf", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin", "accountant")
def fee_collection_report_pdf():
    """PDF export of the fee collection summary report."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date", date.today().isoformat())

    if not start_date:
        return error_response("start_date is required", 400)

    try:
        start_at = _parse_date_boundary(start_date)
        end_at = _parse_date_boundary(end_date, end_of_day=True)
    except ValueError:
        return error_response("Dates must use YYYY-MM-DD format", 400)

    data = _fee_collection_summary_data(g.school_id, start_at, end_at)

    detail_limit = 100
    rows = ""
    for row in data["payment_rows"][:detail_limit]:
        collected = (
            row["collected_at"].strftime("%Y-%m-%d") if row["collected_at"] else "-"
        )
        rows += (
            f"<tr><td>{escape(row['student_name'])}</td>"
            f"<td>{escape(row['fee_item_name'])}</td>"
            f'<td class="num">{fmt_npr(row["amount"])}</td>'
            f"<td>{escape(str(row['payment_method']))}</td>"
            f"<td>{collected}</td></tr>"
        )
    if len(data["payment_rows"]) > detail_limit:
        rows += (
            f'<tr><td colspan="5" class="muted">…and '
            f'{len(data["payment_rows"]) - detail_limit} more payments (not listed)</td></tr>'
        )

    body = f"""
  <h2 class="section">Collection Summary ({escape(start_date)} to {escape(end_date)})</h2>
  <table>
    <tbody>
      <tr><th>Total Collected</th><td class="num">{fmt_npr(data['total_collected'])}</td></tr>
      <tr><th>Total Pending</th><td class="num">{fmt_npr(data['total_pending'])}</td></tr>
      <tr><th>Payments Received</th><td class="num">{data['payments_count']}</td></tr>
      <tr><th>Active Students</th><td class="num">{data['total_students']}</td></tr>
      <tr><th>Collection Rate</th><td class="num">{data['collection_rate']}%</td></tr>
    </tbody>
  </table>
"""
    if rows:
        body += f"""
  <h2 class="section">Payments Received</h2>
  <table>
    <thead><tr><th>Student</th><th>Fee Item</th><th class="num">Amount</th>
    <th>Method</th><th>Collected On</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
"""

    from app.models.school import School

    html = build_report_html(
        "Fee Collection Report",
        body,
        school=School.query.get(g.school_id),
        subtitle="Basic Reports",
    )

    pdf_bytes = _generate_pdf(html)
    if pdf_bytes is None:
        return error_response("PDF export is unavailable on this server", 501)

    filename = f"fee_collection_report_{start_date}_{end_date}.pdf"
    return _report_export_response(pdf_bytes, filename, extra={
        "period": {"start": start_date, "end": end_date},
        "total_collected": data["total_collected"],
        "total_pending": data["total_pending"],
    })


@reports_bp.route("/exams/results/pdf", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("basic_reports")
@role_required("school_admin", "teacher")
def exam_results_report_pdf():
    """PDF export of the exam results summary report."""
    exam_id = request.args.get("exam_id")
    class_id = request.args.get("class_id")

    if not exam_id:
        return error_response("exam_id is required", 400)

    subjects = _exam_results_subjects(g.school_id, exam_id, class_id)
    if not subjects:
        return error_response("No marks found for this exam/class", 404)

    exam = Exam.query.filter_by(id=exam_id, school_id=g.school_id, is_deleted=False).first()
    exam_name = exam.name if exam else "Exam"

    rows = ""
    for subject in subjects:
        rows += (
            f"<tr><td>{escape(subject['subject_name'] or 'Unknown')}</td>"
            f'<td class="num">{subject["avg_marks"]:.2f}</td>'
            f'<td class="num">{subject["min_marks"]:g}</td>'
            f'<td class="num">{subject["max_marks"]:g}</td>'
            f'<td class="num">{subject["full_marks"]:g}</td>'
            f'<td class="num">{subject["student_count"]}</td>'
            f'<td class="num">{subject["passed_count"]}</td>'
            f'<td class="num">{subject["failed_count"]}</td>'
            f'<td class="num">{subject["pass_rate"]}%</td></tr>'
        )

    total_records = sum(subject["student_count"] for subject in subjects)

    body = f"""
  <h2 class="section">Subject-wise Results — {escape(exam_name)}</h2>
  <table>
    <thead><tr><th>Subject</th><th class="num">Avg</th><th class="num">Min</th>
    <th class="num">Max</th><th class="num">Full</th><th class="num">Students</th>
    <th class="num">Passed</th><th class="num">Failed</th><th class="num">Pass %</th></tr></thead>
    <tbody>
      {rows}
      <tr class="total-row"><td>Total Records</td><td colspan="8" class="num">{total_records}</td></tr>
    </tbody>
  </table>
"""

    from app.models.school import School

    html = build_report_html(
        "Exam Results Report",
        body,
        school=School.query.get(g.school_id),
        subtitle=exam_name,
    )

    pdf_bytes = _generate_pdf(html)
    if pdf_bytes is None:
        return error_response("PDF export is unavailable on this server", 501)

    safe_exam = re.sub(r"[^A-Za-z0-9_-]+", "_", str(exam_id))[:40]
    filename = f"exam_results_report_{safe_exam}.pdf"
    return _report_export_response(pdf_bytes, filename, extra={
        "exam_id": exam_id,
        "class_id": class_id,
        "total_records": total_records,
    })
