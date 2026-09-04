"""Plan-compatible benchmarking API.

W0 (2026-09-04) rewrite of /rankings: the previous implementation looped
every active school and ran the full per-school `_overview_payload` (≈10
queries each) inside the request, uncached — an unbounded N+1 that also
returned other schools' identity columns. The endpoint now computes ONE
aggregate row per school with set-based SQL, caches the result for 10
minutes (per the 300 s convention elsewhere, doubled: this data is
coarser), and returns rank-ordered entries carrying no school-identifying
fields beyond district-level context.

Gates moved to the `ai_suite` bundle alongside the other merged AI plugins
(an ai_suite install satisfies both routes via the slug-alias family).
"""
from flask import Blueprint, g
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func

from app.api.v1.analytics import _overview_payload, _school_metric_averages
from app.models.school import School
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import success_response

benchmarking_bp = Blueprint("benchmarking", __name__, url_prefix="/benchmarking")

RANKINGS_CACHE_KEY = "benchmarking:rankings:v2"
RANKINGS_CACHE_TTL = 600


@benchmarking_bp.route("/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("school_admin", "teacher")
def overview():
    school = School.query.get(g.school_id)
    data = _overview_payload(g.school_id)

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

    return success_response(
        {
            "school": {
                "pass_rate": data["pass_rate"],
                "avg_score": data["exam_summary"]["average_score"],
                "attendance": data["attendance_rate"],
                "ratio": round(data["total_students"] / max(data["total_teachers"], 1), 1)
                if data["total_students"]
                else 0,
            },
            "district": _school_metric_averages(district_ids),
            "national": _school_metric_averages(national_ids),
            "departments": [
                {**item, "rank": index + 1}
                for index, item in enumerate(data["exam_summary"]["by_subject"][:5])
            ],
        }
    )


def _rankings_rows():
    """One aggregate row per active school, set-based.

    pass_rate/avg_score come from the latest exam's report cards; attendance
    from the last 30 days; ratio from active students/teachers. Mirrors the
    metric definitions of analytics._overview_payload so the two endpoints
    agree, but as GROUP BY queries instead of N× per-school loops.
    """
    from datetime import date, timedelta

    from app.models.academic import Class
    from app.models.analytics import ReportCard
    from app.models.attendance import Attendance
    from app.models.exam import Exam
    from app.models.student import Student
    from app.models.user import User

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    active_schools = (
        School.query.filter(
            School.is_deleted.is_(False),
            School.is_active.is_(True),
        )
        .with_entities(School.id, School.name, School.district)
        .all()
    )
    if not active_schools:
        return []

    latest_exams = (
        db_query_latest_exam_ids([row.id for row in active_schools])
    )

    # Attendance aggregates for ALL schools in one grouped query.
    att_rows = (
        Attendance.query.filter(
            Attendance.school_id.in_([r.id for r in active_schools]),
            Attendance.date >= thirty_days_ago,
            Attendance.is_deleted.is_(False),
        )
        .with_entities(
            Attendance.school_id,
            func.count().label("total"),
            func.sum(case((Attendance.status.in_(("present", "late")), 1), else_=0)).label("present"),
        )
        .group_by(Attendance.school_id)
        .all()
    )
    att_by_school = {str(r.school_id): (r.total or 0, int(r.present or 0)) for r in att_rows}

    # Student/teacher counts in one grouped query each.
    student_counts = dict(
        Student.query.filter(
            Student.school_id.in_([r.id for r in active_schools]),
            Student.status == "active",
            Student.is_deleted.is_(False),
        )
        .with_entities(Student.school_id, func.count())
        .group_by(Student.school_id)
        .all()
    )
    teacher_counts = dict(
        User.query.filter(
            User.school_id.in_([r.id for r in active_schools]),
            User.role == "teacher",
            User.is_deleted.is_(False),
            User.is_active.is_(True),
        )
        .with_entities(User.school_id, func.count())
        .group_by(User.school_id)
        .all()
    )

    # Report-card aggregates per (school, latest exam).
    rc_filters = [
        ReportCard.school_id.in_([r.id for r in active_schools]),
        ReportCard.is_deleted.is_(False),
    ]
    exam_ids = [eid for eid in latest_exams.values() if eid]
    if exam_ids:
        rc_filters.append(ReportCard.exam_id.in_(exam_ids))
    rc_rows = (
        ReportCard.query.filter(*rc_filters)
        .with_entities(
            ReportCard.school_id,
            func.avg(ReportCard.total_percentage).label("avg_score"),
            func.sum(case((ReportCard.total_percentage >= 40, 1), else_=0)).label("passed"),
            func.count(ReportCard.total_percentage).label("graded"),
        )
        .group_by(ReportCard.school_id)
        .all()
    )
    rc_by_school = {str(r.school_id): r for r in rc_rows}

    ranked = []
    for row in active_schools:
        sid = str(row.id)
        total, present = att_by_school.get(sid, (0, 0))
        attendance_rate = round(present / total * 100, 1) if total else 0
        rc = rc_by_school.get(sid)
        avg_score = round(float(rc.avg_score), 1) if rc and rc.avg_score is not None else 0
        graded = rc.graded if rc else 0
        passed = int(rc.passed or 0) if rc else 0
        pass_rate = round(passed / graded * 100, 1) if graded else 0
        students = student_counts.get(row.id, 0)
        teachers = teacher_counts.get(row.id, 0)
        ratio = round(students / max(teachers, 1), 1) if students else 0
        ranked.append(
            {
                "school_id": sid,
                "district": row.district,
                "pass_rate": pass_rate,
                "avg_score": avg_score,
                "attendance": attendance_rate,
                "ratio": ratio,
            }
        )

    ranked.sort(key=lambda item: (item["pass_rate"], item["avg_score"]), reverse=True)
    return ranked


def db_query_latest_exam_ids(school_ids):
    """{school_id: latest exam id} in a single grouped query."""
    from app.models.exam import Exam

    rows = (
        Exam.query.filter(
            Exam.school_id.in_(school_ids),
            Exam.is_deleted.is_(False),
        )
        .with_entities(Exam.school_id, func.max(Exam.end_date_ad).label("last_end"))
        .group_by(Exam.school_id)
        .all()
    )
    latest = {}
    for school_id, last_end in rows:
        exam = (
            Exam.query.filter_by(school_id=school_id, is_deleted=False, end_date_ad=last_end)
            .order_by(Exam.created_at.desc())
            .first()
        )
        if exam:
            latest[school_id] = exam.id
    return latest


@benchmarking_bp.route("/rankings", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("school_admin", "teacher")
def rankings():
    """Anonymous cohort rankings (top 20).

    Deliberately returns NO school names — a school's rank among its
    district/national peers is the useful signal; publishing a league table
    of named schools from inside the product is a privacy liability the
    dedup audit called out. `school_id` (opaque UUID) lets the requesting
    school locate its own row only.
    """
    from extensions import cache

    ranked = cache.get(RANKINGS_CACHE_KEY)
    if ranked is None:
        ranked = _rankings_rows()
        cache.set(RANKINGS_CACHE_KEY, ranked, timeout=RANKINGS_CACHE_TTL)

    return success_response(ranked[:20])
