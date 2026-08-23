"""AI Tools Suite API — question paper, lesson plan, timetable, remarks, insights."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response
from extensions import db

ai_tools_bp = Blueprint("ai_tools", __name__, url_prefix="/ai-tools")


@ai_tools_bp.route("/question-paper", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin", "teacher")
def generate_question_paper():
    """Generate an AI-powered exam question paper."""
    from app.services.ai.question_paper import QuestionPaperService

    data = request.get_json(silent=True) or {}
    required = ("subject", "grade", "total_marks", "duration_minutes")
    missing = [f for f in required if f not in data]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    result = QuestionPaperService.generate_paper(
        subject=data["subject"],
        grade=data["grade"],
        total_marks=data["total_marks"],
        duration_minutes=data["duration_minutes"],
        topics=data.get("topics"),
        difficulty=data.get("difficulty", "medium"),
        include_answer_key=data.get("include_answer_key", True),
        question_types=data.get("question_types"),
        language=data.get("language", "english"),
    )
    if "error" in result:
        return error_response(result["error"], 500)
    return success_response(result)


@ai_tools_bp.route("/lesson-plan", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin", "teacher")
def generate_lesson_plan():
    """Generate an AI-powered lesson plan."""
    from app.services.ai.lesson_plan import LessonPlanService

    data = request.get_json(silent=True) or {}
    required = ("subject", "grade", "topic")
    missing = [f for f in required if f not in data]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    result = LessonPlanService.generate_lesson_plan(
        subject=data["subject"],
        grade=data["grade"],
        topic=data["topic"],
        duration_minutes=data.get("duration_minutes", 45),
        learning_objectives=data.get("learning_objectives"),
        teaching_method=data.get("teaching_method", "interactive"),
        language=data.get("language", "english"),
    )
    if "error" in result:
        return error_response(result["error"], 500)
    return success_response(result)


@ai_tools_bp.route("/timetable", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin")
def generate_timetable():
    """Generate an AI-optimized clash-free timetable."""
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    academic_year_id = data.get("academic_year_id")
    if not academic_year_id:
        return error_response("academic_year_id is required")

    result = TimetableSolverService.generate_timetable(
        school_id=str(g.school_id),
        academic_year_id=academic_year_id,
        days=data.get("days"),
        periods_per_day=data.get("periods_per_day", 8),
        period_duration=data.get("period_duration", 45),
        start_time=data.get("start_time", "10:00"),
    )
    return success_response(result)


@ai_tools_bp.route("/timetable/save", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin")
def save_timetable():
    """Save a generated timetable to the database."""
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    if not data.get("classes"):
        return error_response("Timetable data with 'classes' is required")

    saved = TimetableSolverService.save_timetable(str(g.school_id), data)
    return success_response({"saved_slots": saved})


@ai_tools_bp.route("/remarks", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin", "teacher")
def generate_remarks():
    """Generate AI-powered report card remarks for a student."""
    from app.services.ai.question_paper import QuestionPaperService

    data = request.get_json(silent=True) or {}
    required = ("student_name", "marks", "total", "percentage")
    missing = [f for f in required if f not in data]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    remark = QuestionPaperService.generate_remark(
        student_name=data["student_name"],
        marks=data["marks"],
        total=data["total"],
        percentage=data["percentage"],
    )
    return success_response({"remark": remark})


@ai_tools_bp.route("/homework-help", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
def homework_help():
    """AI homework helper — guided hints, not direct answers."""
    from app.services.ai.homework_helper import HomeworkHelperService

    data = request.get_json(silent=True) or {}
    question = data.get("question")
    if not question:
        return error_response("question is required")

    result = HomeworkHelperService.get_help(
        question=question,
        subject=data.get("subject"),
        grade_level=data.get("grade_level"),
    )
    return success_response(result)


@ai_tools_bp.route("/insights/weekly", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin")
def weekly_insights():
    """Get AI-generated weekly school intelligence report."""
    from app.services.ai.school_insights import SchoolInsightsService

    report = SchoolInsightsService.generate_weekly_report(str(g.school_id))
    return success_response(report)


@ai_tools_bp.route("/insights/daily-brief", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin")
def daily_brief():
    """Get AI-generated daily morning brief."""
    from app.services.ai.school_insights import SchoolInsightsService

    brief = SchoolInsightsService.generate_daily_brief(str(g.school_id))
    return success_response(brief)


@ai_tools_bp.route("/insights/risk-alerts", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_tools")
@role_required("superadmin", "school_admin", "teacher")
def risk_alerts():
    """Get at-risk student detection."""
    from app.services.ai.school_insights import SchoolInsightsService

    alerts = SchoolInsightsService.calculate_student_risk_scores(str(g.school_id))
    return success_response(alerts)
