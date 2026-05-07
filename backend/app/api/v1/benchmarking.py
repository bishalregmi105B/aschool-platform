"""Plan-compatible benchmarking API."""

from flask import Blueprint, g
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.api.v1.analytics import _overview_payload, _school_metric_averages
from app.models.school import School
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import success_response

benchmarking_bp = Blueprint("benchmarking", __name__, url_prefix="/benchmarking")


@benchmarking_bp.route("/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("benchmarking")
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


@benchmarking_bp.route("/rankings", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("benchmarking")
@role_required("school_admin", "teacher")
def rankings():
    schools = School.query.filter(
        School.is_deleted.is_(False),
        School.is_active.is_(True),
    ).all()

    ranked = []
    for school in schools:
        overview = _overview_payload(school.id)
        ranked.append(
            {
                "school_id": str(school.id),
                "school_name": school.name,
                "district": school.district,
                "pass_rate": overview["pass_rate"],
                "avg_score": overview["exam_summary"]["average_score"],
                "attendance": overview["attendance_rate"],
            }
        )

    ranked.sort(key=lambda item: (item["pass_rate"], item["avg_score"]), reverse=True)
    return success_response(ranked[:20])
