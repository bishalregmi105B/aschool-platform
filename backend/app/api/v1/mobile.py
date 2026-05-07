"""Plan-compatible mobile bootstrap API for Flutter clients."""

from uuid import UUID

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required
from sqlalchemy.orm.attributes import flag_modified

from app.models.notice import Notice
from app.models.plugin import SchoolPlugin
from app.models.school import School
from app.models.student import Guardian, Student
from app.models.user import User
from app.utils.decorators import role_required, school_required
from app.utils.response import success_response
from extensions import db

mobile_bp = Blueprint("mobile", __name__, url_prefix="/mobile")


@mobile_bp.route("/bootstrap", methods=["GET"])
@jwt_required()
@school_required
def bootstrap():
    claims = get_jwt()
    role = claims.get("role")
    user_id = claims.get("sub")

    plugins = [
        item.plugin_slug
        for item in SchoolPlugin.query.filter_by(school_id=g.school_id, active=True, is_deleted=False).all()
    ]

    payload = {
        "role": role,
        "school_id": str(g.school_id),
        "installed_plugins": plugins,
        "visibility": _visibility_for_role(role, plugins),
        "dashboard": _dashboard_for_role(role, user_id),
    }
    return success_response(payload)


@mobile_bp.route("/version", methods=["GET"])
@jwt_required()
@school_required
def get_mobile_version():
    config = _mobile_version_config()
    app_name = request.args.get("app")
    current_version = request.args.get("version")
    force_update = bool(config.get("force_update", False))
    if app_name and current_version:
        min_version = config.get(f"{app_name}_min_version")
        if min_version and _compare_versions(current_version, min_version) < 0:
            force_update = True

    return success_response(
        {
            **config,
            "force_update": force_update,
        }
    )


@mobile_bp.route("/version", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_mobile_version():
    school = School.query.filter_by(id=g.school_id, is_deleted=False).first()
    if not school:
        return success_response(_default_mobile_version_config())

    data = request.get_json(silent=True) or {}
    settings = dict(school.settings or {})
    current = dict(settings.get("mobile_version") or _default_mobile_version_config())
    allowed = {
        "force_update",
        "message",
        "student_min_version",
        "teacher_min_version",
        "parent_min_version",
        "admin_min_version",
        "student_store_url",
        "teacher_store_url",
        "parent_store_url",
        "admin_store_url",
    }
    for key in allowed:
        if key in data:
            current[key] = data[key]

    settings["mobile_version"] = current
    school.settings = settings
    flag_modified(school, "settings")
    db.session.commit()
    return success_response(current)


def _dashboard_for_role(role: str | None, user_id: str | None) -> dict:
    try:
        parsed_user_id = UUID(str(user_id)) if user_id else None
    except (TypeError, ValueError):
        parsed_user_id = None

    if role == "teacher":
        teacher = User.query.filter_by(id=parsed_user_id, school_id=g.school_id, is_deleted=False).first()
        notices = (
            Notice.query.filter_by(school_id=g.school_id, is_deleted=False)
            .order_by(Notice.created_at.desc())
            .limit(5)
            .all()
        )
        return {
            "teacher_name": teacher.full_name if teacher else None,
            "recent_notices": [
                {"id": str(item.id), "title": item.title, "published_at": item.published_at.isoformat() if item.published_at else None}
                for item in notices
            ],
        }

    if role == "parent":
        wards = (
            Student.query.join(Guardian, Guardian.student_id == Student.id)
            .filter(
                Guardian.user_id == parsed_user_id,
                Student.school_id == g.school_id,
                Student.is_deleted.is_(False),
                Guardian.is_deleted.is_(False),
            )
            .all()
        )

        unique_wards = []
        seen = set()
        for ward in wards:
            sid = str(ward.id)
            if sid in seen:
                continue
            seen.add(sid)
            unique_wards.append(ward)

        return {
            # Backward compatible key used by older clients.
            "ward": unique_wards[0].to_dict() if unique_wards else None,
            # Multi-child aware payload for newer clients.
            "wards": [ward.to_dict() for ward in unique_wards],
        }

    if role == "student":
        student = Student.query.filter_by(user_id=parsed_user_id, school_id=g.school_id, is_deleted=False).first()
        return {
            "student": student.to_dict() if student else None,
        }

    return {}


def _visibility_for_role(role: str | None, installed_plugins: list[str]) -> dict:
    plugin_set = set(installed_plugins or [])
    bus_enabled = "bus_tracking" in plugin_set or "gps_tracking" in plugin_set

    if role == "student":
        return _build_visibility(
            rules=[
                ("dashboard", None, None),
                ("timetable", None, None),
                ("homework", None, None),
                ("results", None, None),
                ("subjects", None, None),
                ("notices", None, None),
                ("exams", "exams", None),
                ("diary", None, None),
                ("transport", None, bus_enabled),
                ("teachers", None, None),
                ("chat", None, None),
                ("holidays", None, None),
                ("gallery", None, None),
                ("guardians", None, None),
                ("library", "library_management", None),
                ("elibrary", "elibrary", None),
                ("lms", "lms", None),
                ("ai_tutor", "ai_tutor", None),
                ("classmates", None, None),
                ("portfolio", "student_portfolio", None),
                ("achievements", "student_portfolio", None),
                ("wellbeing", "wellbeing", None),
            ],
            plugin_set=plugin_set,
            quick_actions=[
                "ai_tutor",
                "homework",
                "timetable",
                "results",
                "exams",
                "library",
                "notices",
            ],
            more_actions=[
                "subjects",
                "teachers",
                "diary",
                "holidays",
                "gallery",
                "guardians",
                "transport",
                "elibrary",
                "lms",
                "classmates",
                "portfolio",
                "achievements",
                "wellbeing",
                "chat",
            ],
            drawer_sections=[
                {
                    "id": "overview",
                    "title": "Overview",
                    "items": ["dashboard", "subjects", "homework"],
                },
                {
                    "id": "academics",
                    "title": "Academics",
                    "items": [
                        "timetable",
                        "notices",
                        "exams",
                        "results",
                        "diary",
                    ],
                },
                {
                    "id": "community",
                    "title": "Community",
                    "items": [
                        "transport",
                        "teachers",
                        "chat",
                        "holidays",
                        "gallery",
                        "guardians",
                    ],
                },
                {
                    "id": "learning",
                    "title": "Library & Learning",
                    "items": ["library", "elibrary", "lms"],
                },
                {
                    "id": "others",
                    "title": "Others",
                    "items": [
                        "ai_tutor",
                        "classmates",
                        "portfolio",
                        "achievements",
                        "wellbeing",
                    ],
                },
            ],
            bottom_tabs=["dashboard", "timetable", "homework", "results"],
        )

    if role == "parent":
        return _build_visibility(
            rules=[
                ("dashboard", None, None),
                ("attendance", None, None),
                ("fees", "fees", None),
                ("results", None, None),
                ("reports", "exams", None),
                ("homework", None, None),
                ("timetable", None, None),
                ("subjects", None, None),
                ("teachers", None, None),
                ("notices", None, None),
                ("holidays", None, None),
                ("gallery", None, None),
                ("chat", None, None),
                ("bus_tracker", None, bus_enabled),
                ("wellbeing", "wellbeing", None),
            ],
            plugin_set=plugin_set,
            quick_actions=[
                "attendance",
                "results",
                "homework",
                "timetable",
                "fees",
                "chat",
            ],
            more_actions=[
                "subjects",
                "teachers",
                "reports",
                "notices",
                "holidays",
                "gallery",
                "bus_tracker",
                "wellbeing",
            ],
            drawer_sections=[
                {
                    "id": "overview",
                    "title": "Overview",
                    "items": ["dashboard", "attendance", "fees", "results", "reports"],
                },
                {
                    "id": "academics",
                    "title": "Academics",
                    "items": ["homework", "timetable", "subjects", "teachers"],
                },
                {
                    "id": "school_info",
                    "title": "School Info",
                    "items": ["notices", "holidays", "gallery", "chat"],
                },
                {
                    "id": "others",
                    "title": "Others",
                    "items": ["bus_tracker", "wellbeing"],
                },
            ],
            bottom_tabs=["dashboard", "attendance", "fees", "results"],
        )

    if role in {"teacher", "staff", "school_admin", "superadmin"}:
        return _build_visibility(
            rules=[
                ("dashboard", None, None),
                ("class_section", None, None),
                ("students", None, None),
                ("lessons", None, None),
                ("topics", None, None),
                ("timetable", None, None),
                ("attendance", None, None),
                ("holidays", None, None),
                ("assignments", "assignments", None),
                ("marks", "exams", None),
                ("offline_exam", "exams", None),
                ("online_exam", "exams", None),
                ("report_cards", "exams", None),
                ("diary", "notices", None),
                ("announcements", None, None),
                ("notices", None, None),
                ("chat", None, None),
                ("leave", None, None),
                ("my_attendance", None, None),
                ("payroll", None, None),
                ("ai_tools", "ai_tutor", None),
            ],
            plugin_set=plugin_set,
            quick_actions=[
                "attendance",
                "marks",
                "assignments",
                "students",
                "timetable",
                "lessons",
                "topics",
            ],
            more_actions=[
                "class_section",
                "offline_exam",
                "online_exam",
                "report_cards",
                "diary",
                "announcements",
                "notices",
                "chat",
                "leave",
                "my_attendance",
                "payroll",
                "holidays",
                "ai_tools",
            ],
            drawer_sections=[
                {
                    "id": "academic_management",
                    "title": "Academic Management",
                    "items": [
                        "dashboard",
                        "class_section",
                        "students",
                        "lessons",
                        "topics",
                        "timetable",
                    ],
                },
                {
                    "id": "attendance",
                    "title": "Attendance",
                    "items": ["attendance", "holidays"],
                },
                {
                    "id": "exam_performance",
                    "title": "Exam & Performance",
                    "items": [
                        "assignments",
                        "marks",
                        "offline_exam",
                        "online_exam",
                        "report_cards",
                    ],
                },
                {
                    "id": "communication",
                    "title": "Communication & Media",
                    "items": ["diary", "announcements", "notices", "chat"],
                },
                {
                    "id": "personnel",
                    "title": "Personnel Management",
                    "items": ["leave", "my_attendance", "payroll"],
                },
                {
                    "id": "tools",
                    "title": "Tools",
                    "items": ["ai_tools"],
                },
            ],
            bottom_tabs=["dashboard", "attendance", "marks", "ai_tools"],
        )

    return {
        "modules": [],
        "quick_actions": [],
        "more_actions": [],
        "drawer_sections": [],
        "bottom_tabs": [],
    }


def _build_visibility(
    rules: list[tuple[str, str | None, bool | None]],
    plugin_set: set[str],
    quick_actions: list[str],
    more_actions: list[str],
    drawer_sections: list[dict],
    bottom_tabs: list[str],
) -> dict:
    enabled_modules = {
        module
        for module, plugin_slug, allowed
        in rules
        if (allowed is None or allowed)
        and (plugin_slug is None or plugin_slug in plugin_set)
    }

    filtered_sections = []
    for section in drawer_sections:
        items = [item for item in section.get("items", []) if item in enabled_modules]
        if not items:
            continue
        filtered_sections.append(
            {
                "id": section.get("id"),
                "title": section.get("title"),
                "items": items,
            }
        )

    return {
        "modules": [module for module, _, _ in rules if module in enabled_modules],
        "quick_actions": [item for item in quick_actions if item in enabled_modules],
        "more_actions": [item for item in more_actions if item in enabled_modules],
        "drawer_sections": filtered_sections,
        "bottom_tabs": [item for item in bottom_tabs if item in enabled_modules],
    }


def _mobile_version_config() -> dict:
    settings = getattr(g.school, "settings", None) or {}
    config = dict(settings.get("mobile_version") or {})
    return {**_default_mobile_version_config(), **config}


def _default_mobile_version_config() -> dict:
    return {
        "force_update": False,
        "message": "A newer ASchool app version is available.",
        "student_min_version": "1.0.0",
        "teacher_min_version": "1.0.0",
        "parent_min_version": "1.0.0",
        "admin_min_version": "1.0.0",
        "student_store_url": None,
        "teacher_store_url": None,
        "parent_store_url": None,
        "admin_store_url": None,
    }


def _compare_versions(current: str, minimum: str) -> int:
    current_parts = _version_parts(current)
    minimum_parts = _version_parts(minimum)
    for index in range(max(len(current_parts), len(minimum_parts))):
        left = current_parts[index] if index < len(current_parts) else 0
        right = minimum_parts[index] if index < len(minimum_parts) else 0
        if left != right:
            return 1 if left > right else -1
    return 0


def _version_parts(value: str) -> list[int]:
    parts = []
    for part in str(value).split("."):
        digits = "".join(char for char in part if char.isdigit())
        parts.append(int(digits or 0))
    return parts
