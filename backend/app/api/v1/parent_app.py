"""Parent app API endpoints for Flutter parent client and web parent portal."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.models.assignment import Assignment, AssignmentSubmission
from app.models.attendance import Attendance
from app.models.exam import Marks, ReportCard
from app.models.fee import FeeCollection
from app.models.notice import Notice
from app.models.school import School
from app.models.student import Guardian, Student
from app.models.timetable import TimetableSlot
from app.models.transport import Bus, BusStop, GPSLog
from app.models.user import User
from app.services.chat_service import (
    contact_payload,
    list_contact_users,
    list_messages as list_chat_messages,
    message_payload,
    parse_user_id,
    send_message as persist_chat_message,
)
from app.models.wellbeing import CounselorNote, MoodEntry
from app.utils.decorators import role_required, school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.response import error_response, success_response

parent_app_bp = Blueprint("parent_app", __name__, url_prefix="/parent")


def _current_parent_user_id() -> UUID | None:
    user_id = get_jwt_identity()
    if not user_id:
        return None
    try:
        return UUID(str(user_id))
    except (TypeError, ValueError):
        return None


def _wards_for_parent(parent_user_id: UUID | None) -> list[Student]:
    if not parent_user_id:
        return []

    rows = (
        Student.query.join(Guardian, Guardian.student_id == Student.id)
        .filter(
            Student.school_id == g.school_id,
            Student.is_deleted.is_(False),
            Guardian.school_id == g.school_id,
            Guardian.user_id == parent_user_id,
            Guardian.is_deleted.is_(False),
        )
        .order_by(Student.first_name, Student.last_name)
        .all()
    )

    # Guard against accidental duplicate guardian rows for the same child.
    unique = []
    seen_ids = set()
    for student in rows:
        sid = str(student.id)
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        unique.append(student)
    return unique


def _pick_students(wards: list[Student], requested_student_id: str | None) -> list[Student]:
    if not wards:
        return []
    if not requested_student_id:
        return wards

    requested = str(requested_student_id)
    for ward in wards:
        if str(ward.id) == requested:
            return [ward]
    return []


def _student_display_name(student: Student) -> str:
    return f"{student.first_name or ''} {student.last_name or ''}".strip()


def _extract_partial_paid(collection: FeeCollection) -> float:
    if collection.payment_status == "paid":
        return float(collection.amount or 0)

    notes = collection.notes or ""
    marker = "[partial_paid:"
    if marker not in notes:
        return 0

    try:
        value = notes.split(marker, 1)[1].split("]", 1)[0]
        return float(value)
    except (ValueError, TypeError, IndexError):
        return 0


def _student_fee_due(student_id) -> float:
    collections = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.student_id == student_id,
        FeeCollection.is_deleted.is_(False),
    ).all()

    due = 0.0
    for collection in collections:
        total_amount = float(collection.amount or 0)
        paid_amount = _extract_partial_paid(collection)
        due += max(total_amount - paid_amount, 0)
    return round(due, 2)


def _assignment_row(assignment: Assignment) -> dict[str, object]:
    return {
        "id": str(assignment.id),
        "title": assignment.title,
        "description": assignment.description,
        "subject": assignment.subject.name if assignment.subject else None,
        "teacher": assignment.teacher.full_name if assignment.teacher else None,
        "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
        "due_date_bs": ad_to_bs(assignment.due_date) if assignment.due_date else None,
        "is_overdue": bool(
            assignment.due_date and assignment.due_date.date() < date.today()
        ),
        "attachments": assignment.attachment_urls or [],
        "attachment_urls": assignment.attachment_urls or [],
        "total_marks": assignment.total_marks,
    }


@parent_app_bp.route("/dashboard", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_dashboard():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)

    children = []
    today = date.today()
    for ward in wards:
        attendance_rows = Attendance.query.filter(
            Attendance.school_id == g.school_id,
            Attendance.student_id == ward.id,
            Attendance.is_deleted.is_(False),
        ).all()

        total_days = len(attendance_rows)
        present_like = len([r for r in attendance_rows if r.status in ("present", "late", "half_day")])
        attendance_pct = round((present_like / total_days) * 100, 1) if total_days else 0

        today_row = Attendance.query.filter(
            Attendance.school_id == g.school_id,
            Attendance.student_id == ward.id,
            Attendance.date == today,
            Attendance.is_deleted.is_(False),
        ).first()

        children.append(
            {
                "id": str(ward.id),
                "student_id": str(ward.id),
                "name": _student_display_name(ward),
                "class_name": ward.klass.name if ward.klass else ward.academic_year,
                "roll_no": ward.roll_number,
                "attendance_pct": attendance_pct,
                "fees_due": _student_fee_due(ward.id),
                "today_status": today_row.status if today_row else None,
                "rank": None,
                "photo_url": ward.photo_url,
            }
        )

    notice_rows = (
        Notice.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(Notice.created_at.desc())
        .limit(40)
        .all()
    )
    recent_notices = []
    for notice in notice_rows:
        audience = notice.target_audience or []
        if audience and "parent" not in audience:
            continue
        recent_notices.append(
            {
                "id": str(notice.id),
                "title": notice.title,
                "date": (notice.published_at or notice.created_at).strftime("%Y-%m-%d")
                if (notice.published_at or notice.created_at)
                else None,
            }
        )
        if len(recent_notices) >= 10:
            break

    return success_response({"children": children, "recent_notices": recent_notices})


@parent_app_bp.route("/child-attendance", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_child_attendance():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected_students = _pick_students(wards, request.args.get("student_id"))
    if not selected_students:
        return success_response({"summary": {"present": 0, "absent": 0, "late": 0, "total_days": 0, "percentage": 0}, "records": []})

    student_ids = [student.id for student in selected_students]
    name_by_id = {str(student.id): _student_display_name(student) for student in selected_students}

    rows = (
        Attendance.query.filter(
            Attendance.school_id == g.school_id,
            Attendance.student_id.in_(student_ids),
            Attendance.is_deleted.is_(False),
        )
        .order_by(Attendance.date.desc())
        .limit(300)
        .all()
    )

    present = len([row for row in rows if row.status in ("present", "half_day")])
    absent = len([row for row in rows if row.status == "absent"])
    late = len([row for row in rows if row.status == "late"])
    total_days = len(rows)

    records = [
        {
            "date": row.date.isoformat() if row.date else None,
            "status": row.status,
            "note": row.remarks,
            "student_id": str(row.student_id),
            "student_name": name_by_id.get(str(row.student_id)),
        }
        for row in rows
    ]

    return success_response(
        {
            "summary": {
                "present": present,
                "absent": absent,
                "late": late,
                "total_days": total_days,
                "percentage": round((present / total_days) * 100, 1) if total_days else 0,
            },
            "records": records,
        }
    )


@parent_app_bp.route("/assignments", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_assignments():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected_students = _pick_students(wards, request.args.get("student_id"))
    if not selected_students:
        return success_response({"pending": [], "submitted": []})

    student_ids = [student.id for student in selected_students]
    class_ids = {student.class_id for student in selected_students if student.class_id}
    if not class_ids:
        return success_response({"pending": [], "submitted": []})

    assignments = (
        Assignment.query.filter(
            Assignment.school_id == g.school_id,
            Assignment.class_id.in_(tuple(class_ids)),
            Assignment.is_deleted.is_(False),
        )
        .order_by(Assignment.due_date.asc())
        .all()
    )
    submissions = AssignmentSubmission.query.filter(
        AssignmentSubmission.school_id == g.school_id,
        AssignmentSubmission.student_id.in_(student_ids),
        AssignmentSubmission.is_deleted.is_(False),
    ).all()
    submission_by_key = {
        (str(submission.student_id), str(submission.assignment_id)): submission
        for submission in submissions
    }

    pending = []
    submitted = []
    for student in selected_students:
        for assignment in assignments:
            if assignment.class_id != student.class_id:
                continue
            if assignment.section_id and assignment.section_id != student.section_id:
                continue

            row = _assignment_row(assignment)
            row["student_id"] = str(student.id)
            row["student_name"] = _student_display_name(student)
            submission = submission_by_key.get((str(student.id), str(assignment.id)))
            if submission:
                row["marks"] = (
                    float(submission.marks) if submission.marks is not None else None
                )
                row["feedback"] = submission.feedback
                row["status"] = submission.status
                submitted.append(row)
            else:
                row["status"] = "pending"
                pending.append(row)

    return success_response({"pending": pending, "submitted": submitted})


@parent_app_bp.route("/child-results", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_child_results():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected_students = _pick_students(wards, request.args.get("student_id"))
    if not selected_students:
        return success_response([])

    student_ids = [student.id for student in selected_students]
    student_name_by_id = {str(student.id): _student_display_name(student) for student in selected_students}

    cards = (
        ReportCard.query.filter(
            ReportCard.school_id == g.school_id,
            ReportCard.student_id.in_(student_ids),
            ReportCard.is_deleted.is_(False),
        )
        .order_by(ReportCard.created_at.desc())
        .all()
    )

    payload = []
    for card in cards:
        marks = Marks.query.filter_by(
            school_id=g.school_id,
            exam_id=card.exam_id,
            student_id=card.student_id,
            is_deleted=False,
        ).all()

        payload.append(
            {
                "student_id": str(card.student_id),
                "student_name": student_name_by_id.get(str(card.student_id)),
                "exam_name": card.exam.name if card.exam else "Exam",
                "rank": card.rank,
                "gpa": float(card.overall_gpa) if card.overall_gpa is not None else None,
                "subjects": [
                    {
                        "subject": mark.subject.name if mark.subject else "Subject",
                        "full_marks": float(mark.full_marks) if mark.full_marks is not None else float(mark.total_marks or 100),
                        "obtained": float(mark.total_marks) if mark.total_marks is not None else float(mark.obtained_marks or 0),
                    }
                    for mark in marks
                ],
            }
        )

    return success_response(payload)


@parent_app_bp.route("/child-timetable", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_child_timetable():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected_students = _pick_students(wards, request.args.get("student_id"))
    if not selected_students:
        return success_response({"periods": []})

    student = selected_students[0]
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

    slots = query.order_by(TimetableSlot.day_of_week.asc(), TimetableSlot.period_number.asc()).all()

    return success_response(
        {
            "periods": [
                {
                    "id": str(slot.id),
                    "day_of_week": slot.day_of_week,
                    "period_number": slot.period_number,
                    "start_time": slot.start_time.strftime("%H:%M") if slot.start_time else None,
                    "end_time": slot.end_time.strftime("%H:%M") if slot.end_time else None,
                    "subject": slot.subject.name if slot.subject else None,
                    "teacher": slot.teacher.full_name if slot.teacher else None,
                    "is_break": slot.is_break,
                }
                for slot in slots
            ]
        }
    )


@parent_app_bp.route("/outstanding-fees", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_outstanding_fees():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected_students = _pick_students(wards, request.args.get("student_id"))
    if not selected_students:
        return success_response([])

    student_ids = [student.id for student in selected_students]
    student_name_by_id = {str(student.id): _student_display_name(student) for student in selected_students}

    collections = (
        FeeCollection.query.filter(
            FeeCollection.school_id == g.school_id,
            FeeCollection.student_id.in_(student_ids),
            FeeCollection.is_deleted.is_(False),
        )
        .order_by(FeeCollection.created_at.desc())
        .all()
    )

    rows = []
    for collection in collections:
        total_amount = float(collection.amount or 0)
        paid_amount = _extract_partial_paid(collection)
        due_amount = max(total_amount - paid_amount, 0)
        if due_amount <= 0:
            continue

        month_parts = [part for part in [collection.month_bs, collection.year_bs] if part]
        rows.append(
            {
                "id": str(collection.id),
                "student_id": str(collection.student_id),
                "student_name": student_name_by_id.get(str(collection.student_id)),
                "fee_type": collection.fee_item_name,
                "month": " ".join(month_parts) if month_parts else "Due",
                "amount": due_amount,
                "status": collection.payment_status,
            }
        )

    return success_response(rows)


@parent_app_bp.route("/child-wellbeing", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_child_wellbeing():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected_students = _pick_students(wards, request.args.get("student_id"))
    if not selected_students:
        return success_response({"avg_mood": 0, "mood_count": 0, "recent_moods": [], "counselor_notes": []})

    student_ids = [student.id for student in selected_students]
    student_name_by_id = {str(student.id): _student_display_name(student) for student in selected_students}

    mood_rows = (
        MoodEntry.query.filter(
            MoodEntry.school_id == g.school_id,
            MoodEntry.student_id.in_(student_ids),
            MoodEntry.is_deleted.is_(False),
        )
        .order_by(MoodEntry.created_at.desc())
        .limit(50)
        .all()
    )

    mood_score = {
        "happy": 5,
        "excited": 5,
        "okay": 3,
        "neutral": 3,
        "sad": 2,
        "anxious": 1,
        "angry": 1,
    }
    scores = [mood_score.get((row.mood or "").lower(), 3) for row in mood_rows]
    avg_mood = round(sum(scores) / len(scores), 1) if scores else 0

    recent_moods = [
        {
            "student_id": str(row.student_id),
            "student_name": student_name_by_id.get(str(row.student_id)),
            "mood": row.mood,
            "note": row.notes,
            "date": row.created_at.strftime("%Y-%m-%d") if row.created_at else None,
        }
        for row in mood_rows[:15]
    ]

    note_rows = (
        CounselorNote.query.filter(
            CounselorNote.school_id == g.school_id,
            CounselorNote.student_id.in_(student_ids),
            CounselorNote.is_deleted.is_(False),
        )
        .order_by(CounselorNote.created_at.desc())
        .limit(20)
        .all()
    )
    counselor_notes = [
        {
            "student_id": str(note.student_id),
            "student_name": student_name_by_id.get(str(note.student_id)),
            "counselor_name": note.counselor.full_name if note.counselor else "Counselor",
            "note": note.content,
            "date": note.created_at.strftime("%Y-%m-%d") if note.created_at else None,
        }
        for note in note_rows
    ]

    return success_response(
        {
            "avg_mood": avg_mood,
            "mood_count": len(mood_rows),
            "recent_moods": recent_moods,
            "counselor_notes": counselor_notes,
        }
    )


@parent_app_bp.route("/bus-info", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_bus_info():
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected = _pick_students(wards, request.args.get("student_id"))

    active_child = selected[0] if selected else None
    if not active_child:
        for ward in wards:
            if ward.bus_stop_id:
                active_child = ward
                break

    if not active_child or not active_child.bus_stop_id:
        return success_response(None)

    bus_stop = BusStop.query.filter_by(
        id=active_child.bus_stop_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not bus_stop:
        return success_response(None)

    bus = Bus.query.filter_by(
        school_id=g.school_id,
        route_id=bus_stop.route_id,
        is_deleted=False,
        is_active=True,
    ).first()
    if not bus:
        return success_response(None)

    school = School.query.get(g.school_id)
    latest_log = (
        GPSLog.query.filter_by(school_id=g.school_id, bus_id=bus.id, is_deleted=False)
        .order_by(GPSLog.timestamp.desc())
        .first()
    )

    children_for_bus = [
        {
            "student_id": str(ward.id),
            "name": _student_display_name(ward),
        }
        for ward in wards
        if ward.bus_stop_id == bus_stop.id
    ]

    payload = {
        "bus_id": str(bus.id),
        "bus_number": bus.vehicle_number,
        "driver_name": bus.driver.full_name if bus.driver else None,
        "driver_phone": bus.driver.phone if bus.driver else None,
        "child": {
            "student_id": str(active_child.id),
            "name": _student_display_name(active_child),
        },
        "children": children_for_bus,
        "school_location": {
            "lat": float(school.latitude) if school and school.latitude is not None else None,
            "lng": float(school.longitude) if school and school.longitude is not None else None,
        },
        "stop_location": {
            "lat": float(bus_stop.latitude) if bus_stop.latitude is not None else None,
            "lng": float(bus_stop.longitude) if bus_stop.longitude is not None else None,
        },
        "status_text": "Bus is on route" if latest_log else "Bus location not available",
        "eta_minutes": bus.route.estimated_time_mins if bus.route else None,
        "speed": float(latest_log.speed_kmh) if latest_log and latest_log.speed_kmh is not None else 0,
        "last_updated": latest_log.timestamp.isoformat() if latest_log and latest_log.timestamp else None,
    }
    return success_response(payload)


@parent_app_bp.route("/bus-location/<uuid:bus_id>", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_bus_location(bus_id):
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)

    bus = Bus.query.filter_by(id=bus_id, school_id=g.school_id, is_deleted=False).first()
    if not bus:
        return error_response("Bus not found", 404)

    # Ensure this parent is linked to at least one child on this bus route.
    if wards:
        route_ids = set()
        for ward in wards:
            if not ward.bus_stop_id:
                continue
            stop = BusStop.query.filter_by(id=ward.bus_stop_id, school_id=g.school_id, is_deleted=False).first()
            if stop and stop.route_id:
                route_ids.add(str(stop.route_id))
        if route_ids and str(bus.route_id) not in route_ids:
            return error_response("Not authorized for this bus", 403)

    latest_log = (
        GPSLog.query.filter_by(school_id=g.school_id, bus_id=bus.id, is_deleted=False)
        .order_by(GPSLog.timestamp.desc())
        .first()
    )

    if latest_log:
        return success_response(
            {
                "lat": float(latest_log.latitude),
                "lng": float(latest_log.longitude),
                "speed": float(latest_log.speed_kmh) if latest_log.speed_kmh is not None else 0,
                "eta_minutes": bus.route.estimated_time_mins if bus.route else None,
                "last_updated": latest_log.timestamp.isoformat() if latest_log.timestamp else None,
                "status_text": "Live location",
                "boarded": None,
            }
        )

    return success_response(
        {
            "lat": None,
            "lng": None,
            "speed": 0,
            "eta_minutes": bus.route.estimated_time_mins if bus.route else None,
            "last_updated": None,
            "status_text": "No live GPS location available",
            "boarded": None,
        }
    )


@parent_app_bp.route("/chat-threads", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_chat_threads():
    current_user_id = _current_parent_user_id()
    if not current_user_id:
        return error_response("Valid parent identity is required", 401)

    contacts = list_contact_users(g.school_id, current_user_id, get_jwt().get("role"))
    payload = []
    for contact in contacts:
        item = contact_payload(g.school_id, current_user_id, contact)
        payload.append(
            {
                **item,
                "id": item["user_id"],
                "teacher_id": item["user_id"],
                "teacher_name": item["name"],
                "time": item["last_message_time"],
            }
        )
    return success_response(payload)


@parent_app_bp.route("/chat/<thread_id>/messages", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_chat_messages(thread_id):
    current_user_id = _current_parent_user_id()
    if not current_user_id:
        return error_response("Valid parent identity is required", 401)

    contact_user_id = parse_user_id(thread_id)
    if not contact_user_id:
        return error_response("Valid chat contact id is required", 400)

    target = User.query.filter_by(
        id=contact_user_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not target:
        return error_response("Chat contact not found", 404)

    try:
        _, messages = list_chat_messages(
            g.school_id,
            current_user_id,
            contact_user_id,
            mark_read=True,
        )
    except ValueError as exc:
        return error_response(str(exc), 400)

    return success_response([message_payload(message, current_user_id) for message in messages])


@parent_app_bp.route("/chat/<thread_id>/messages", methods=["POST"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_send_chat_message(thread_id):
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or data.get("message") or "").strip()
    if not content:
        return error_response("Message content is required", 400)

    current_user_id = _current_parent_user_id()
    if not current_user_id:
        return error_response("Valid parent identity is required", 401)

    contact_user_id = parse_user_id(thread_id)
    if not contact_user_id:
        return error_response("Valid chat contact id is required", 400)

    target = User.query.filter_by(
        id=contact_user_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not target:
        return error_response("Chat contact not found", 404)

    try:
        message = persist_chat_message(
            g.school_id,
            current_user_id,
            contact_user_id,
            content,
        )
    except ValueError as exc:
        return error_response(str(exc), 400)

    return success_response({**message_payload(message, current_user_id), "sent": True}, status_code=201)
