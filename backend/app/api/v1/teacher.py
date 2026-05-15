"""Teacher mobile API — dashboard and teacher-scoped classroom data."""
from datetime import date, datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.academic import Class
from app.models.assignment import Assignment
from app.models.attendance import Attendance
from app.models.notice import Notice
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, success_response
from app.utils.teacher_scope import teacher_allowed_class_ids, teacher_class_teacher_class_ids
from extensions import db

teacher_bp = Blueprint("teacher", __name__, url_prefix="/teacher")


@teacher_bp.route("/dashboard", methods=["GET"])
@jwt_required()
@school_required
@role_required("teacher", "school_admin", "superadmin")
def teacher_dashboard():
    today = date.today()
    classes = _teacher_classes()
    class_ids = [item["id"] for item in classes]
    slots = _teacher_slots().limit(6).all()
    marked_classes = {
        str(row.class_id)
        for row in Attendance.query.filter(
            Attendance.school_id == g.school_id,
            Attendance.class_id.in_(class_ids) if class_ids else False,
            Attendance.date == today,
            Attendance.is_deleted.is_(False),
        ).all()
    }
    pending_attendance = max(0, len(class_ids) - len(marked_classes))
    pending_assignments = Assignment.query.filter_by(
        school_id=g.school_id,
        teacher_id=g.user_id,
        is_deleted=False,
    ).count()
    notices = Notice.query.filter_by(
        school_id=g.school_id,
        is_deleted=False,
    ).order_by(Notice.created_at.desc()).limit(5).all()

    return success_response({
        "today_classes": [_dashboard_slot_dict(slot, marked_classes) for slot in slots],
        "stats": {
            "classes_today": len(slots),
            "pending_attendance": pending_attendance,
            "pending_assignments": pending_assignments,
        },
        "recent_notices": [_notice_dict(notice) for notice in notices],
    })


@teacher_bp.route("/my-classes", methods=["GET"])
@jwt_required()
@school_required
@role_required("teacher", "school_admin", "superadmin")
def my_classes():
    scope = request.args.get("scope")
    if scope == "class_teacher" and g.role == "teacher" and g.user_id:
        # Return only classes where this teacher is assigned as class teacher
        from app.models.academic import Section
        ct_class_ids = teacher_class_teacher_class_ids(g.school_id, g.user_id)
        if not ct_class_ids:
            return success_response([])
        classes = Class.query.filter(
            Class.school_id == g.school_id,
            Class.id.in_(ct_class_ids),
            Class.is_deleted.is_(False),
        ).order_by(Class.sort_order, Class.name).all()
        return success_response([_class_dict(klass) for klass in classes])
    return success_response(_teacher_classes())


@teacher_bp.route("/my-students", methods=["GET"])
@jwt_required()
@school_required
@role_required("teacher", "school_admin", "superadmin")
def my_students():
    class_ids = [item["id"] for item in _teacher_classes()]
    if g.role == "teacher" and not class_ids:
        return success_response([])
    query = Student.query.filter_by(school_id=g.school_id, status="active", is_deleted=False)
    if class_ids:
        query = query.filter(Student.class_id.in_(class_ids))
    students = query.order_by(Student.roll_number, Student.first_name).all()
    return success_response([_student_dict(student) for student in students])


@teacher_bp.route("/timetable", methods=["GET"])
@jwt_required()
@school_required
@role_required("teacher", "school_admin", "superadmin")
def teacher_timetable():
    grouped = {"mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}
    for slot in _teacher_slots().all():
        key = _day_key(slot.day_of_week)
        grouped.setdefault(key, []).append(_slot_dict(slot))
    return success_response(grouped)


@teacher_bp.route("/assignments", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("teacher", "school_admin", "superadmin")
def teacher_assignments():
    assignments = Assignment.query.filter_by(
        school_id=g.school_id,
        teacher_id=g.user_id,
        is_deleted=False,
    ).order_by(Assignment.due_date.desc()).all()
    return success_response([_assignment_dict(assignment) for assignment in assignments])


@teacher_bp.route("/assignments", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("teacher", "school_admin", "superadmin")
def create_teacher_assignment():
    data = request.get_json(silent=True) or {}
    assignment = Assignment(
        school_id=g.school_id,
        teacher_id=g.user_id,
        title=data.get("title") or "Untitled Assignment",
        description=data.get("description"),
        class_id=data.get("class_id"),
        section_id=data.get("section_id"),
        subject_id=data.get("subject_id"),
        due_date=_parse_datetime(data.get("due_date")) or datetime.now(timezone.utc),
        total_marks=data.get("total_marks") or data.get("max_marks"),
        attachment_urls=data.get("attachment_urls"),
    )
    db.session.add(assignment)
    db.session.commit()
    return created_response(_assignment_dict(assignment))


def _teacher_classes():
    query = Class.query.filter_by(school_id=g.school_id, is_deleted=False)
    if g.role == "teacher" and g.user_id:
        allowed = teacher_allowed_class_ids(g.school_id, g.user_id)
        if not allowed:
            return []
        query = query.filter(Class.id.in_(allowed))
    classes = query.order_by(Class.sort_order, Class.name).all()
    return [_class_dict(klass) for klass in classes]


def _teacher_slots():
    query = TimetableSlot.query.filter_by(school_id=g.school_id, is_deleted=False)
    if g.role == "teacher" and g.user_id:
        query = query.filter_by(teacher_id=g.user_id)
    return query.order_by(TimetableSlot.day_of_week, TimetableSlot.period_number)


def _class_dict(klass):
    student_count = Student.query.filter_by(
        school_id=g.school_id,
        class_id=klass.id,
        status="active",
        is_deleted=False,
    ).count()
    marked_today = Attendance.query.filter_by(
        school_id=g.school_id,
        class_id=klass.id,
        date=date.today(),
        is_deleted=False,
    ).count() > 0
    short = "".join(part[:1] for part in (klass.name or "CL").split()[:2]).upper()
    return {
        "id": str(klass.id),
        "name": klass.name,
        "short": short or "CL",
        "student_count": student_count,
        "attendance_marked": marked_today,
    }


def _student_dict(student):
    total = len([record for record in student.attendance_records if not record.is_deleted])
    present = len([
        record for record in student.attendance_records
        if not record.is_deleted and record.status in ("present", "late")
    ])
    attendance_pct = round(present / total * 100, 1) if total else 0
    return {
        "id": str(student.id),
        "student_id": student.student_id,
        "name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
        "roll_no": student.roll_number or 0,
        "class_name": student.klass.name if student.klass else None,
        "section_name": student.section.name if student.section else None,
        "photo_url": student.photo_url,
        "attendance_pct": attendance_pct,
    }


def _slot_dict(slot):
    time_label = ""
    if slot.start_time and slot.end_time:
        time_label = f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
    return {
        "id": str(slot.id),
        "subject": slot.subject.name if slot.subject else ("Break" if slot.is_break else ""),
        "class_name": slot.klass.name if slot.klass else "",
        "section_name": slot.section.name if slot.section else "",
        "day": slot.day_of_week,
        "time": time_label,
        "period_number": slot.period_number,
        "is_break": slot.is_break,
    }


def _dashboard_slot_dict(slot, marked_classes):
    data = _slot_dict(slot)
    data.update({
        "period": str(slot.period_number),
        "attendance_marked": str(slot.class_id) in marked_classes,
    })
    return data


def _assignment_dict(assignment):
    submitted = len([submission for submission in assignment.submissions if not submission.is_deleted])
    total_students = Student.query.filter_by(
        school_id=g.school_id,
        class_id=assignment.class_id,
        status="active",
        is_deleted=False,
    ).count()
    due_date = assignment.due_date
    status = "active"
    if due_date:
        compare_date = due_date
        if compare_date.tzinfo is None:
            compare_date = compare_date.replace(tzinfo=timezone.utc)
        if compare_date < datetime.now(timezone.utc):
            status = "past"
    return {
        "id": str(assignment.id),
        "title": assignment.title,
        "description": assignment.description,
        "subject": assignment.subject.name if assignment.subject else "",
        "subject_id": str(assignment.subject_id) if assignment.subject_id else None,
        "class_name": assignment.klass.name if assignment.klass else "",
        "class_id": str(assignment.class_id) if assignment.class_id else None,
        "due_date": assignment.due_date.date().isoformat() if assignment.due_date else None,
        "status": status,
        "submitted_count": submitted,
        "total_students": total_students or submitted or 1,
    }


def _notice_dict(notice):
    return {
        "id": str(notice.id),
        "title": notice.title,
        "date": notice.created_at.date().isoformat() if notice.created_at else None,
    }


def _day_key(day):
    normalized = (day or "").lower()
    if normalized.startswith("mon"):
        return "mon"
    if normalized.startswith("tue"):
        return "tue"
    if normalized.startswith("wed"):
        return "wed"
    if normalized.startswith("thu"):
        return "thu"
    if normalized.startswith("fri"):
        return "fri"
    if normalized.startswith("sat"):
        return "sat"
    return "sun"


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
