"""Analytics & dashboard API for school and platform summaries."""
from collections import defaultdict
from datetime import date, datetime, timedelta

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from app.models.academic import Class, Subject
from app.models.assignment import Assignment
from app.models.attendance import Attendance
from app.models.exam import Exam, Marks, ReportCard
from app.models.fee import FeeCollection
from app.models.notice import Event, Notice
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.models.user import User
from app.utils.decorators import role_required, school_required, superadmin_required
from app.utils.response import success_response
from extensions import cache, db

analytics_bp = Blueprint("analytics", __name__, url_prefix="/analytics")


def _safe_float(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _month_key(dt):
    return dt.strftime("%Y-%m")


def _month_label(dt):
    return dt.strftime("%b %Y")


def _notice_visible_to_role(notice, role):
    audience = getattr(notice, "target_audience", None) or getattr(notice, "target_roles", None) or []
    return not audience or "all" in audience or role in audience or "school_admin" in audience


def _latest_exam_id(school_id):
    exam = (
        Exam.query.filter_by(school_id=school_id, is_deleted=False)
        .order_by(Exam.end_date_ad.desc().nullslast(), Exam.created_at.desc())
        .first()
    )
    return exam.id if exam else None


def _overview_payload(school_id):
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    total_students = Student.query.filter_by(
        school_id=school_id, status="active", is_deleted=False
    ).count()
    total_teachers = User.query.filter_by(
        school_id=school_id, role="teacher", is_deleted=False, is_active=True
    ).count()
    total_staff = User.query.filter(
        User.school_id == school_id,
        User.role.in_(("school_admin", "accountant", "staff")),
        User.is_deleted.is_(False),
        User.is_active.is_(True),
    ).count()
    active_plugins = SchoolPlugin.query.filter_by(
        school_id=school_id, active=True, is_deleted=False
    ).count()

    today_rows = Attendance.query.filter(
        Attendance.school_id == school_id,
        Attendance.date == today,
        Attendance.is_deleted.is_(False),
    ).all()
    today_total = len(today_rows)
    # Uniform late rule: late students DID attend (present + late), matching
    # /attendance/summary and /attendance/student/<id>/summary.
    today_present = sum(1 for row in today_rows if row.status in ("present", "late"))
    attendance_today_percent = round((today_present / today_total) * 100, 1) if today_total else 0

    attendance_rows = Attendance.query.filter(
        Attendance.school_id == school_id,
        Attendance.date >= thirty_days_ago,
        Attendance.is_deleted.is_(False),
    ).all()
    attendance_rate = (
        round(sum(1 for row in attendance_rows if row.status in ("present", "late")) / len(attendance_rows) * 100, 1)
        if attendance_rows
        else 0
    )

    fee_rows = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.is_deleted.is_(False),
    ).all()

    class_map = {
        str(item.id): item.name
        for item in Class.query.filter_by(school_id=school_id, is_deleted=False).all()
    }
    student_map = {
        str(item.id): item
        for item in Student.query.filter_by(school_id=school_id, is_deleted=False).all()
    }

    monthly_buckets = defaultdict(lambda: {"collected": 0.0, "pending": 0.0})
    fee_type_buckets = defaultdict(float)
    fee_class_buckets = defaultdict(lambda: {"expected": 0.0, "collected": 0.0})
    fee_collection_this_month = 0.0
    pending_fee_amount = 0.0
    total_fee_amount = 0.0
    total_paid_fee = 0.0
    now = datetime.utcnow()

    # Fee math must use the PAYABLE amount (base + late fine − discount), not
    # the raw `amount` column — the same discount-blind bug class fixed in
    # reports.py (E120 family). Paid collections under discounted bills were
    # overstating "collected" by the discount and understating nothing when a
    # fine applied; pending rows ignored fines. Reuse the canonical fees.py
    # helpers so /analytics, /reports and /fees/summary agree. Waived rows are
    # excluded from collected AND pending (nothing to collect, matches
    # /reports/fees/collection); partial payments count only their recorded
    # [partial_paid:…] value, leaving the remainder as pending.
    from app.api.v1.fees import _collection_payable_total, _extract_partial_paid

    for row in fee_rows:
        created_at = row.created_at or now
        status = getattr(row, "payment_status", None) or getattr(row, "status", "pending")
        month_bucket = monthly_buckets[_month_key(created_at)]
        if status == "waived":
            continue

        payable = _collection_payable_total(row)
        collected_amount = min(_extract_partial_paid(row), payable)
        due_amount = max(payable - collected_amount, 0.0)

        total_fee_amount += payable
        total_paid_fee += collected_amount
        pending_fee_amount += due_amount
        month_bucket["collected"] += collected_amount
        month_bucket["pending"] += due_amount
        if created_at.year == now.year and created_at.month == now.month:
            fee_collection_this_month += collected_amount
        fee_type_buckets[getattr(row, "fee_item_name", None) or "General"] += payable
        student = student_map.get(str(row.student_id))
        class_name = class_map.get(str(student.class_id), "Unassigned") if student else "Unassigned"
        fee_class_buckets[class_name]["expected"] += payable
        fee_class_buckets[class_name]["collected"] += collected_amount

    collection_rate = round((total_paid_fee / total_fee_amount) * 100, 1) if total_fee_amount else 0

    upcoming_events = Event.query.filter(
        Event.school_id == school_id,
        Event.is_deleted.is_(False),
        Event.start_date >= today,
    ).count()

    class_attendance_buckets = defaultdict(lambda: {"present": 0, "total": 0})
    for row in attendance_rows:
        class_name = class_map.get(str(row.class_id), "Unassigned")
        class_attendance_buckets[class_name]["total"] += 1
        if row.status in ("present", "late"):
            class_attendance_buckets[class_name]["present"] += 1

    attendance_by_class = []
    for class_name, stats in sorted(class_attendance_buckets.items()):
        total = stats["total"]
        percentage = round((stats["present"] / total) * 100, 1) if total else 0
        attendance_by_class.append({"class_name": class_name, "percentage": percentage})
    best_class = max(attendance_by_class, key=lambda item: item["percentage"], default=None)
    worst_class = min(attendance_by_class, key=lambda item: item["percentage"], default=None)

    monthly_trend = []
    for index in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=index * 31)).replace(day=1)
        key = _month_key(month_start)
        bucket = monthly_buckets.get(key, {"collected": 0.0, "pending": 0.0})
        monthly_trend.append(
            {
                "month": _month_label(month_start),
                "collected": round(bucket["collected"], 2),
                "pending": round(bucket["pending"], 2),
                "expected": round(bucket["collected"] + bucket["pending"], 2),
            }
        )

    latest_exam_id = _latest_exam_id(school_id)
    report_cards = (
        ReportCard.query.filter_by(school_id=school_id, exam_id=latest_exam_id, is_deleted=False).all()
        if latest_exam_id
        else []
    )
    report_percentages = [_safe_float(card.total_percentage) for card in report_cards if card.total_percentage is not None]
    average_score = round(sum(report_percentages) / len(report_percentages), 1) if report_percentages else 0
    pass_rate = (
        round(sum(1 for value in report_percentages if value >= 40) / len(report_percentages) * 100, 1)
        if report_percentages
        else 0
    )

    subject_rows = (
        db.session.query(Subject.name, func.avg(Marks.total_marks), func.max(Marks.total_marks), func.min(Marks.total_marks))
        .join(Subject, Subject.id == Marks.subject_id)
        .filter(
            Marks.school_id == school_id,
            Marks.exam_id == latest_exam_id,
            Marks.is_deleted.is_(False),
        )
        .group_by(Subject.name)
        .all()
        if latest_exam_id
        else []
    )
    subject_summary = [
        {
            "subject": name,
            "average": round(_safe_float(avg_marks), 1),
            "pass_rate": round(_safe_float(avg_marks), 1),
            "avg_score": round(_safe_float(avg_marks), 1),
            "highest": round(_safe_float(highest), 1),
            "lowest": round(_safe_float(lowest), 1),
        }
        for name, avg_marks, highest, lowest in subject_rows
    ]
    subject_summary.sort(key=lambda item: item["average"], reverse=True)

    by_fee_type = []
    for fee_type, amount in sorted(fee_type_buckets.items(), key=lambda item: item[1], reverse=True):
        by_fee_type.append(
            {
                "type": fee_type,
                "amount": round(amount, 2),
                "percentage": round((amount / total_fee_amount) * 100, 1) if total_fee_amount else 0,
            }
        )

    by_class = []
    for class_name, values in sorted(fee_class_buckets.items()):
        by_class.append(
            {
                "class_name": class_name,
                "expected": round(values["expected"], 2),
                "collected": round(values["collected"], 2),
            }
        )

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_staff": total_staff,
        "fee_collection_this_month": round(fee_collection_this_month, 2),
        "pending_fee_amount": round(pending_fee_amount, 2),
        "attendance_today_percent": attendance_today_percent,
        "upcoming_events": upcoming_events,
        "active_plugins": active_plugins,
        "attendance_rate": attendance_rate,
        "collection_rate": collection_rate,
        "pass_rate": pass_rate,
        "attendance_summary": {
            "average_percentage": attendance_rate,
            "best_class": best_class["class_name"] if best_class else None,
            "worst_class": worst_class["class_name"] if worst_class else None,
            "by_class": attendance_by_class,
        },
        "fee_summary": {
            "total_collected": round(total_paid_fee, 2),
            "total_pending": round(pending_fee_amount, 2),
            "collection_rate": collection_rate,
            "by_month": monthly_trend,
            "by_fee_type": by_fee_type,
            "by_class": by_class,
        },
        "exam_summary": {
            "average_score": average_score,
            "pass_rate": pass_rate,
            "top_subject": subject_summary[0]["subject"] if subject_summary else None,
            "by_subject": subject_summary,
        },
    }


@analytics_bp.route("/overview", methods=["GET"])
@jwt_required()
@school_required
@role_required("school_admin", "teacher", "accountant")
def overview():
    cache_key = f"analytics_overview:{g.school_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return success_response(cached)
    payload = _overview_payload(g.school_id)
    cache.set(cache_key, payload, timeout=300)
    return success_response(payload)


@analytics_bp.route("/academic", methods=["GET"])
@jwt_required()
@school_required
@role_required("school_admin", "teacher")
def academic():
    exam_id = request.args.get("exam_id") or _latest_exam_id(g.school_id)
    total_students = Student.query.filter_by(
        school_id=g.school_id, status="active", is_deleted=False
    ).count()

    report_cards = (
        db.session.query(ReportCard, Student, Class)
        .join(Student, Student.id == ReportCard.student_id)
        .outerjoin(Class, Class.id == Student.class_id)
        .filter(
            ReportCard.school_id == g.school_id,
            ReportCard.exam_id == exam_id,
            ReportCard.is_deleted.is_(False),
        )
        .all()
        if exam_id
        else []
    )

    percentages = [_safe_float(card.total_percentage) for card, _, _ in report_cards if card.total_percentage is not None]
    class_buckets = defaultdict(lambda: {"scores": [], "passed": 0, "failed": 0})
    at_risk = []
    for card, student, klass in report_cards:
        class_name = klass.name if klass else "Unassigned"
        pct = _safe_float(card.total_percentage)
        class_buckets[class_name]["scores"].append(pct)
        if pct >= 40:
            class_buckets[class_name]["passed"] += 1
        else:
            class_buckets[class_name]["failed"] += 1
            at_risk.append(
                {
                    "student_name": f"{student.first_name} {student.last_name}",
                    "class_name": class_name,
                    "avg_percentage": round(pct, 1),
                    "failed_subjects": 0,
                    "risk_level": student.risk_level or "high",
                }
            )

    class_wise = []
    for class_name, bucket in sorted(class_buckets.items()):
        total = len(bucket["scores"])
        avg_percentage = round(sum(bucket["scores"]) / total, 1) if total else 0
        class_wise.append(
            {
                "class_name": class_name,
                "total_students": total,
                "passed": bucket["passed"],
                "failed": bucket["failed"],
                "avg_percentage": avg_percentage,
                "pass_rate": round(bucket["passed"] / total * 100, 1) if total else 0,
            }
        )

    subject_rows = (
        db.session.query(Subject.name, func.avg(Marks.total_marks), func.max(Marks.total_marks), func.min(Marks.total_marks))
        .join(Subject, Subject.id == Marks.subject_id)
        .filter(
            Marks.school_id == g.school_id,
            Marks.exam_id == exam_id,
            Marks.is_deleted.is_(False),
        )
        .group_by(Subject.name)
        .all()
        if exam_id
        else []
    )
    subject_wise = [
        {
            "subject_name": name,
            "avg_score": round(_safe_float(avg_score), 1),
            "highest": round(_safe_float(highest), 1),
            "lowest": round(_safe_float(lowest), 1),
        }
        for name, avg_score, highest, lowest in subject_rows
    ]
    subject_wise.sort(key=lambda item: item["avg_score"], reverse=True)

    pass_rate = round(sum(1 for value in percentages if value >= 40) / len(percentages) * 100, 1) if percentages else 0
    avg_percentage = round(sum(percentages) / len(percentages), 1) if percentages else 0

    return success_response(
        {
            "exam_id": str(exam_id) if exam_id else None,
            "total_students": total_students,
            "pass_rate": pass_rate,
            "avg_percentage": avg_percentage,
            "class_wise": class_wise,
            "subject_wise": subject_wise,
            "at_risk_students": at_risk[:10],
            "at_risk_count": len(at_risk),
        }
    )


@analytics_bp.route("/financial", methods=["GET"])
@jwt_required()
@school_required
@role_required("school_admin", "accountant")
def financial():
    period = request.args.get("period", "yearly")
    now = datetime.utcnow()
    if period == "monthly":
        start = now - timedelta(days=30)
    elif period == "quarterly":
        start = now - timedelta(days=90)
    else:
        start = now - timedelta(days=365)

    rows = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.created_at >= start,
    ).all()

    # Payable-based money math (E170): raw `amount` ignores discount/fine and
    # partial payments — same helpers as /fees/summary and /reports/fees.
    from app.api.v1.fees import _collection_payable_total, _extract_partial_paid

    total_revenue = 0.0
    collected = 0.0
    for row in rows:
        if (getattr(row, "payment_status", None) or "pending") == "waived":
            continue
        payable = _collection_payable_total(row)
        total_revenue += payable
        collected += min(_extract_partial_paid(row), payable)
    outstanding = max(total_revenue - collected, 0)
    collection_rate = round((collected / total_revenue) * 100, 1) if total_revenue else 0
    overview = _overview_payload(g.school_id)

    return success_response(
        {
            "total_revenue": round(total_revenue, 2),
            "collected": round(collected, 2),
            "outstanding": round(outstanding, 2),
            "collection_rate": collection_rate,
            "monthly_trend": overview["fee_summary"]["by_month"],
            "by_fee_type": overview["fee_summary"]["by_fee_type"],
            "by_class": overview["fee_summary"]["by_class"],
        }
    )


def _school_metric_averages(school_ids):
    if not school_ids:
        return {"pass_rate": 0, "avg_score": 0, "attendance": 0, "ratio": 0}

    pass_rates = []
    avg_scores = []
    attendance_rates = []
    ratios = []
    for school_id in school_ids:
        payload = _overview_payload(school_id)
        pass_rates.append(payload["pass_rate"])
        avg_scores.append(payload["exam_summary"]["average_score"])
        attendance_rates.append(payload["attendance_rate"])
        ratios.append(
            round(payload["total_students"] / max(payload["total_teachers"], 1), 1)
            if payload["total_students"]
            else 0
        )

    return {
        "pass_rate": round(sum(pass_rates) / len(pass_rates), 1) if pass_rates else 0,
        "avg_score": round(sum(avg_scores) / len(avg_scores), 1) if avg_scores else 0,
        "attendance": round(sum(attendance_rates) / len(attendance_rates), 1) if attendance_rates else 0,
        "ratio": round(sum(ratios) / len(ratios), 1) if ratios else 0,
    }


@analytics_bp.route("/benchmarking", methods=["GET"])
@jwt_required()
@school_required
@role_required("school_admin", "teacher")
def benchmarking():
    school = School.query.get(g.school_id)
    overview = _overview_payload(g.school_id)
    district_ids = []
    if school and school.district:
        district_ids = [
            item.id
            for item in School.query.filter(
                School.is_deleted.is_(False),
                School.is_active.is_(True),
                School.district == school.district,
            ).all()
        ]
    national_ids = [
        item.id
        for item in School.query.filter(
            School.is_deleted.is_(False),
            School.is_active.is_(True),
        ).all()
    ]

    departments = [
        {"subject": item["subject"], "avg": item["average"], "rank": index + 1}
        for index, item in enumerate(overview["exam_summary"]["by_subject"][:5])
    ]

    return success_response(
        {
            "pass_rate": overview["pass_rate"],
            "avg_score": overview["exam_summary"]["average_score"],
            "attendance": overview["attendance_rate"],
            "ratio": round(overview["total_students"] / max(overview["total_teachers"], 1), 1)
            if overview["total_students"]
            else 0,
            "district": _school_metric_averages(district_ids),
            "national": _school_metric_averages(national_ids),
            "departments": departments,
        }
    )


@analytics_bp.route("/teacher-dashboard", methods=["GET"])
@jwt_required()
@school_required
@role_required("teacher", "school_admin")
def teacher_dashboard():
    teacher_id = get_jwt_identity()
    today_name = date.today().strftime("%A")
    all_slots = TimetableSlot.query.filter_by(
        school_id=g.school_id, teacher_id=teacher_id
    ).all()
    todays_slots = sorted(
        [slot for slot in all_slots if slot.day_of_week == today_name],
        key=lambda slot: (slot.period_number or 0),
    )
    class_ids = {str(slot.class_id) for slot in all_slots if slot.class_id}
    notices = (
        Notice.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(Notice.created_at.desc())
        .limit(12)
        .all()
    )
    visible_notices = [
        item
        for item in notices
        if _notice_visible_to_role(item, "teacher")
    ][:5]
    pending_assignments = Assignment.query.filter(
        Assignment.school_id == g.school_id,
        Assignment.teacher_id == teacher_id,
        Assignment.is_deleted.is_(False),
    ).count()

    return success_response(
        {
            "stats": {
                "my_classes": len(class_ids),
                "todays_periods": len(todays_slots),
                "pending_assignments": pending_assignments,
                "recent_notices": len(visible_notices),
            },
            "schedule": [
                {
                    "time": (
                        f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
                        if slot.start_time and slot.end_time
                        else f"Period {slot.period_number}"
                    ),
                    "subject": slot.subject.name if slot.subject else "Unassigned",
                    "class_name": slot.klass.name if slot.klass else "Unassigned",
                    "room": slot.room,
                }
                for slot in todays_slots[:6]
            ],
            "notices": [
                {
                    "id": str(item.id),
                    "title": item.title,
                    "date": item.created_at.isoformat() if item.created_at else None,
                    "urgent": bool(item.is_pinned),
                }
                for item in visible_notices
            ],
        }
    )


@analytics_bp.route("/superadmin-dashboard", methods=["GET"])
@superadmin_required
def superadmin_dashboard():
    schools = School.query.filter_by(is_deleted=False).order_by(School.created_at.desc()).all()
    total_schools = len(schools)
    active_schools = sum(1 for school in schools if school.status == "active")
    trial_schools = sum(1 for school in schools if school.status == "trial")
    total_users = User.query.filter_by(is_deleted=False).count()
    total_students = Student.query.filter_by(is_deleted=False).count()
    total_revenue_ytd = round(sum(_safe_float(school.total_revenue_ytd) for school in schools), 2)

    plan_breakdown_raw = (
        db.session.query(School.plan, func.count(School.id))
        .filter(School.is_deleted.is_(False))
        .group_by(School.plan)
        .all()
    )
    plugin_rows = (
        db.session.query(SchoolPlugin.plugin_slug, func.count(SchoolPlugin.id))
        .filter(SchoolPlugin.is_deleted.is_(False), SchoolPlugin.active.is_(True))
        .group_by(SchoolPlugin.plugin_slug)
        .order_by(func.count(SchoolPlugin.id).desc())
        .limit(5)
        .all()
    )
    plugin_names = {
        plugin.slug: plugin.name
        for plugin in Plugin.query.filter_by(is_deleted=False).all()
    }

    return success_response(
        {
            "stats": {
                "total_schools": total_schools,
                "active_schools": active_schools,
                "trial_schools": trial_schools,
                "total_users": total_users,
                "total_students": total_students,
                "total_revenue_ytd": total_revenue_ytd,
            },
            "recent_schools": [
                {
                    "id": str(school.id),
                    "name": school.name,
                    "created_at": school.created_at.isoformat() if school.created_at else None,
                    "status": school.status,
                }
                for school in schools[:5]
            ],
            "plan_breakdown": [
                {"plan": str(plan), "count": count}
                for plan, count in plan_breakdown_raw
            ],
            "top_plugins": [
                {
                    "slug": slug,
                    "name": plugin_names.get(slug, slug.replace("_", " ").title()),
                    "installs": installs,
                }
                for slug, installs in plugin_rows
            ],
        }
    )
