"""Parent app API endpoints for Flutter parent client and web parent portal."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.models.assignment import Assignment, AssignmentSubmission
from app.models.attendance import Attendance
from app.models.conference import PTConference, ConferenceSlot
from app.models.dismissal import AuthorizedPickup, DismissalRecord
from app.models.exam import Marks, ReportCard
from app.models.fee import FeeCollection
from app.models.notice import Notice
from app.models.school import School
from app.models.student import Guardian, Student
from app.models.timetable import TimetableSlot
from app.models.transport import Bus, BusStop, GPSLog
from app.models.user import User
from app.services.chat_service import (
    ChatNotAllowedError,
    can_message,
    contact_payload,
    list_contact_users,
    list_messages as list_chat_messages,
    message_payload,
    parse_user_id,
    send_message as persist_chat_message,
)
from app.models.wellbeing import CounselorNote, MoodEntry
from app.plugins.decorators import plugin_required
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
        # Uniform late rule: percentage counts present + late (a late student
        # attended); half_day does not count toward the rate.
        present_like = len([r for r in attendance_rows if r.status in ("present", "late")])
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

    # Per-status counters (uniform late rule: the percentage below counts
    # present + late — a late student DID attend; half_day never counts toward
    # the rate and is reported separately, matching /attendance/student/<id>/summary).
    present = len([row for row in rows if row.status == "present"])
    absent = len([row for row in rows if row.status == "absent"])
    late = len([row for row in rows if row.status == "late"])
    half_day = len([row for row in rows if row.status == "half_day"])
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
                "half_day": half_day,
                "total_days": total_days,
                "percentage": round(((present + late) / total_days) * 100, 1) if total_days else 0,
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

    # E190: thread reads honor the same directory role matrix as sends.
    if not can_message(getattr(g.current_user, "role", None), target.role):
        return error_response("You are not allowed to message this user", 403)

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
    except ChatNotAllowedError:
        # E190: role pair outside the directory matrix -> 403.
        return error_response("You are not allowed to message this user", 403)
    except ValueError as exc:
        return error_response(str(exc), 400)

    return success_response({**message_payload(message, current_user_id), "sent": True}, status_code=201)


# ── Conferences (PT Meeting) ───────────────────────────────


@parent_app_bp.route("/conferences", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_conferences():
    """List active PT conferences for this school."""
    conferences = (
        PTConference.query.filter_by(
            school_id=g.school_id, is_active=True, is_deleted=False
        )
        .order_by(PTConference.start_date.asc())
        .all()
    )

    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    student_id = request.args.get("student_id")
    selected = _pick_students(wards, student_id)
    selected_ids = {str(s.id) for s in selected}

    result = []
    for conf in conferences:
        slots = ConferenceSlot.query.filter_by(
            conference_id=conf.id, is_deleted=False
        ).all()
        available_count = sum(1 for s in slots if not s.is_booked)

        # Find parent's existing booking for any of their children
        booked_slot = None
        if parent_user_id:
            for slot in slots:
                if slot.is_booked and str(slot.parent_id) == str(parent_user_id):
                    if not selected_ids or str(slot.student_id) in selected_ids:
                        booked_slot = {
                            "slot_id": str(slot.id),
                            "start_time": slot.start_time.isoformat() if slot.start_time else None,
                            "end_time": slot.end_time.isoformat() if slot.end_time else None,
                            "teacher_name": slot.teacher.full_name if slot.teacher else None,
                            "student_id": str(slot.student_id) if slot.student_id else None,
                        }
                        break

        result.append({
            "id": str(conf.id),
            "title": conf.title,
            "description": conf.description,
            "start_date": conf.start_date.isoformat() if conf.start_date else None,
            "end_date": conf.end_date.isoformat() if conf.end_date else None,
            "is_virtual": conf.is_virtual,
            "meeting_link": conf.meeting_link,
            "total_slots": len(slots),
            "available_slots": available_count,
            "booked_slot": booked_slot,
        })

    return success_response(result)


@parent_app_bp.route("/conferences/<uuid:conference_id>/book", methods=["POST"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_book_conference_slot(conference_id):
    """Book a conference time slot."""
    conf = PTConference.query.filter_by(
        id=conference_id, school_id=g.school_id, is_deleted=False, is_active=True
    ).first()
    if not conf:
        return error_response("Conference not found", 404)

    data = request.get_json(silent=True) or {}
    slot_id = data.get("slot_id")
    student_id = data.get("student_id")

    if not slot_id:
        return error_response("slot_id is required", 400)

    # E192 companion: a junk slot_id must be a 400, never a Postgres
    # DataError 500.
    slot_uuid = parse_user_id(slot_id)
    if not slot_uuid:
        return error_response("slot_id must be a valid id", 400)
    slot = ConferenceSlot.query.filter_by(
        id=slot_uuid, conference_id=conference_id, is_deleted=False
    ).first()
    if not slot:
        return error_response("Slot not found", 404)
    if slot.is_booked:
        return error_response("This slot is already booked", 409)

    parent_user_id = _current_parent_user_id()
    # Validate the student belongs to this parent
    if student_id:
        wards = _wards_for_parent(parent_user_id)
        valid_ids = {str(w.id) for w in wards}
        if str(student_id) not in valid_ids:
            return error_response("Student not linked to your account", 403)

    slot.is_booked = True
    slot.parent_id = parent_user_id
    slot.student_id = student_id

    from app.extensions import db
    db.session.commit()

    return success_response({
        "slot_id": str(slot.id),
        "conference_title": conf.title,
        "start_time": slot.start_time.isoformat() if slot.start_time else None,
        "end_time": slot.end_time.isoformat() if slot.end_time else None,
        "teacher_name": slot.teacher.full_name if slot.teacher else None,
        "is_virtual": conf.is_virtual,
        "meeting_link": conf.meeting_link,
    }, status_code=201)


# ── Child Health / Portfolio / eLibrary (E165) ─────────────
# The Flutter parent screens (child_health, portfolio, elibrary) called these
# /parent/* paths but no such routes existed anywhere — every screen loaded
# its permanent error state even with live data. They are ward-scoped proxies
# over the existing plugin tables and enforce the same plugin gates.


@parent_app_bp.route("/child-health", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
@plugin_required("health_records")
def parent_child_health():
    """Ward-scoped child health data for the parent app.

    ?type=records (default)  → medical visits (date/diagnosis/notes/doctor)
    ?type=vaccinations       → immunizations
    ?type=allergies          → allergy + condition entries from the profile
    """
    from app.models.health_records import HealthProfile, Immunization, MedicalVisit

    data_type = (request.args.get("type") or "records").strip().lower()
    wards = _wards_for_parent(_current_parent_user_id())
    selected = _pick_students(wards, request.args.get("student_id"))
    if not selected:
        return success_response([])

    student_ids = [s.id for s in selected]

    if data_type == "vaccinations":
        rows = (
            Immunization.query.filter(
                Immunization.school_id == g.school_id,
                Immunization.student_id.in_(student_ids),
                Immunization.is_deleted.is_(False),
            )
            .order_by(Immunization.date_administered.desc())
            .all()
        )
        return success_response([
            {
                "id": str(i.id),
                "student_id": str(i.student_id),
                "student_name": _student_display_name(
                    next((s for s in selected if s.id == i.student_id), None)
                ) if len(selected) > 1 else None,
                "vaccine_name": i.vaccine_name,
                "dose_number": i.dose_number,
                "date_administered": str(i.date_administered) if i.date_administered else None,
                "next_due_date": str(i.next_due_date) if i.next_due_date else None,
                "administered_by": i.administered_by,
                "notes": i.notes,
            }
            for i in rows
        ])

    if data_type == "allergies":
        entries = []
        for profile in HealthProfile.query.filter(
            HealthProfile.school_id == g.school_id,
            HealthProfile.student_id.in_(student_ids),
            HealthProfile.is_deleted.is_(False),
        ).all():
            for allergy in profile.allergies or []:
                entries.append({
                    "student_id": str(profile.student_id),
                    "allergen": allergy,
                    "severity": "unknown",
                    "reaction": "",
                })
            for condition in profile.medical_conditions or []:
                entries.append({
                    "student_id": str(profile.student_id),
                    "allergen": condition,
                    "severity": "unknown",
                    "reaction": "Chronic condition",
                })
        return success_response(entries)

    # default: medical visit records
    rows = (
        MedicalVisit.query.filter(
            MedicalVisit.school_id == g.school_id,
            MedicalVisit.student_id.in_(student_ids),
            MedicalVisit.is_deleted.is_(False),
        )
        .order_by(MedicalVisit.visit_date.desc())
        .limit(100)
        .all()
    )
    return success_response([
        {
            "id": str(v.id),
            "student_id": str(v.student_id),
            "student_name": _student_display_name(
                next((s for s in selected if s.id == v.student_id), None)
            ) if len(selected) > 1 else None,
            "record_date": str(v.visit_date) if v.visit_date else None,
            "visit_date": str(v.visit_date) if v.visit_date else None,
            "title": v.reason or v.diagnosis or "Health visit",
            "diagnosis": v.diagnosis,
            "treatment": v.treatment,
            "notes": v.notes,
            "doctor_name": v.recorder.full_name if v.recorder else None,
        }
        for v in rows
    ])


@parent_app_bp.route("/portfolio", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
@plugin_required("student_portfolio")
def parent_portfolio():
    """Ward-scoped portfolio entries + summary for the parent app."""
    from app.models.portfolio import PortfolioItem, StudentPortfolio

    wards = _wards_for_parent(_current_parent_user_id())
    selected = _pick_students(wards, request.args.get("student_id"))
    if not selected:
        return success_response({"entries": [], "summary": {}})

    student_ids = [s.id for s in selected]
    category = (request.args.get("category") or "").strip().lower()

    entries = []
    type_counts: dict[str, int] = {}
    for portfolio in StudentPortfolio.query.filter(
        StudentPortfolio.school_id == g.school_id,
        StudentPortfolio.student_id.in_(student_ids),
        StudentPortfolio.is_deleted.is_(False),
    ).all():
        items = (
            PortfolioItem.query.filter_by(
                portfolio_id=portfolio.id, school_id=g.school_id, is_deleted=False
            )
            .order_by(PortfolioItem.created_at.desc())
            .all()
        )
        for item in items:
            if category:
                haystack = [str(item.item_type or "").lower()] + [
                    str(t).lower() for t in (item.tags or [])
                ]
                if category not in haystack:
                    continue
            type_counts[item.item_type or "other"] = type_counts.get(item.item_type or "other", 0) + 1
            entries.append({
                "id": str(item.id),
                "student_id": str(portfolio.student_id),
                "student_name": _student_display_name(
                    next((s for s in selected if s.id == portfolio.student_id), None)
                ) if len(selected) > 1 else None,
                "title": item.title,
                "description": item.description,
                "item_type": item.item_type,
                "media_urls": item.media_urls or [],
                "tags": item.tags or [],
                "created_at": item.created_at.isoformat() if item.created_at else None,
            })

    summary = {
        "total_entries": len(entries),
        "by_type": type_counts,
        "children_count": len({e["student_id"] for e in entries}) if entries else 0,
    }
    return success_response({"entries": entries, "summary": summary})


@parent_app_bp.route("/elibrary", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
@plugin_required("elibrary")
def parent_elibrary():
    """School e-library catalogue (books / past papers / OER resources) for
    the parent app. Read-only and scoped to the school."""
    from app.models.digital_content import DigitalBook, OERResource, PastPaper

    books = (
        DigitalBook.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(DigitalBook.title.asc())
        .all()
    )
    papers = (
        PastPaper.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(PastPaper.year.desc())
        .all()
    )
    resources = (
        OERResource.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(OERResource.created_at.desc())
        .all()
    )

    def _book_dict(b):
        return {
            "id": str(b.id),
            "title": b.title,
            "author": b.author,
            "file_url": b.file_url,
            "cover_url": b.cover_url,
            "file_type": b.file_type,
            "pages": b.pages,
        }

    def _paper_dict(p):
        return {
            "id": str(p.id),
            "title": p.title,
            "exam_type": p.exam_type,
            "year": p.year,
            "file_url": p.file_url,
            "answer_key_url": p.answer_key_url,
        }

    def _resource_dict(r):
        return {
            "id": str(r.id),
            "title": r.title,
            "description": r.description,
            "resource_type": r.resource_type,
            "url": r.url,
            "tags": r.tags or [],
        }

    q = (request.args.get("q") or "").strip().lower()
    book_list = [_book_dict(b) for b in books]
    paper_list = [_paper_dict(p) for p in papers]
    resource_list = [_resource_dict(r) for r in resources]
    if q:
        book_list = [b for b in book_list if q in (b["title"] or "").lower() or q in (b["author"] or "").lower()]
        paper_list = [p for p in paper_list if q in (p["title"] or "").lower()]
        resource_list = [r for r in resource_list if q in (r["title"] or "").lower()]

    return success_response({
        "books": book_list,
        "past_papers": paper_list,
        "resources": resource_list,
    })


# ── Dismissal Status ───────────────────────────────────────


@parent_app_bp.route("/dismissal-status", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_dismissal_status():
    """Return today's dismissal status + authorized pickups for a student."""
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected = _pick_students(wards, request.args.get("student_id"))

    if not selected:
        return success_response({"status": "no_child", "records": [], "authorized_pickups": []})

    student = selected[0]
    today = date.today()

    today_record = (
        DismissalRecord.query.filter(
            DismissalRecord.school_id == g.school_id,
            DismissalRecord.student_id == student.id,
            DismissalRecord.is_deleted.is_(False),
        )
        .order_by(DismissalRecord.dismissed_at.desc())
        .first()
    )

    status_val = "in_class"
    dismissed_at = None
    picked_up_by = None

    if today_record and today_record.dismissed_at:
        record_date = today_record.dismissed_at.date() if today_record.dismissed_at else None
        if record_date == today:
            status_val = "released"
            dismissed_at = today_record.dismissed_at.isoformat()
            picked_up_by = today_record.picked_up_by

    authorized_pickups = (
        AuthorizedPickup.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            is_active=True,
            is_deleted=False,
        ).all()
    )

    pickups_data = [
        {
            "id": str(p.id),
            "name": p.name,
            "relation": p.relation,
            "phone": p.phone,
            "photo_url": p.photo_url,
        }
        for p in authorized_pickups
    ]

    return success_response({
        "student_id": str(student.id),
        "student_name": _student_display_name(student),
        "status": status_val,
        "dismissed_at": dismissed_at,
        "picked_up_by": picked_up_by,
        "authorized_pickups": pickups_data,
        "parent_user_id": str(parent_user_id) if parent_user_id else None,
    })

@parent_app_bp.route("/child-profile", methods=["GET"])
@jwt_required()
@school_required
@role_required("parent", "school_admin", "superadmin")
def parent_child_profile():
    """Full profile breakdown for one of the parent's children.

    Aggregates personal, academic, attendance, fee, guardian and teacher
    info so the parent app can show a dedicated profile screen.
    """
    parent_user_id = _current_parent_user_id()
    wards = _wards_for_parent(parent_user_id)
    selected = _pick_students(wards, request.args.get("student_id"))
    if not selected:
        return error_response("Student not linked to this parent", 404)
    student = selected[0]

    # ── attendance summary ─────────────────────────────────────────
    rows = Attendance.query.filter(
        Attendance.school_id == g.school_id,
        Attendance.student_id == student.id,
        Attendance.is_deleted.is_(False),
    ).all()
    total_days = len(rows)
    present_like = len([r for r in rows if r.status in ("present", "late")])
    absent = len([r for r in rows if r.status == "absent"])
    late = len([r for r in rows if r.status == "late"])
    attendance_pct = round((present_like / total_days) * 100, 1) if total_days else 0

    # ── fees ───────────────────────────────────────────────────────
    fees_due = _student_fee_due(student.id)
    collections = FeeCollection.query.filter_by(
        school_id=g.school_id, student_id=student.id, is_deleted=False
    ).all()
    fees_paid = sum(float(c.amount_paid or 0) for c in collections)

    # ── guardians ──────────────────────────────────────────────────
    guardians = []
    for gd in Guardian.query.filter_by(
        student_id=student.id, is_deleted=False
    ).all():
        guardians.append(
            {
                "name": gd.full_name,
                "relation": gd.relation,
                "phone": gd.phone,
                "email": gd.email,
            }
        )

    # ── class teachers (from timetable) ────────────────────────────
    teacher_names: list[str] = []
    if student.class_id:
        slots = TimetableSlot.query.filter_by(
            school_id=g.school_id,
            class_id=student.class_id,
            section_id=student.section_id,
            is_deleted=False,
        ).all()
        for slot in slots:
            if slot.teacher and slot.teacher.full_name not in teacher_names:
                teacher_names.append(slot.teacher.full_name)

    # ── results snapshot (latest exam) ─────────────────────────────
    latest_card = (
        ReportCard.query.filter_by(
            school_id=g.school_id, student_id=student.id, is_deleted=False
        )
        .order_by(ReportCard.created_at.desc())
        .first()
    )

    # ── homework pending count ─────────────────────────────────────
    from app.models.assignment import Assignment

    pending_assignments = (
        Assignment.query.filter(
            Assignment.school_id == g.school_id,
            Assignment.class_id == student.class_id,
            Assignment.is_deleted.is_(False),
        ).count()
        if student.class_id
        else 0
    )

    return success_response(
        {
            "id": str(student.id),
            "student_id": str(student.id),
            "name": _student_display_name(student),
            "admission_number": student.admission_number,
            "enrollment_number": student.admission_number,
            "roll_no": student.roll_number,
            "class_name": student.klass.name if student.klass else None,
            "section_name": student.section.name if student.section else None,
            "academic_year": student.academic_year,
            "dob_bs": student.dob_bs,
            "dob_ad": student.dob_ad.isoformat() if student.dob_ad else None,
            "gender": (student.gender or "").capitalize() or None,
            "blood_group": student.blood_group,
            "address": student.address.get("permanent", "") if isinstance(student.address, dict) else str(student.address or ""),
            "phone": student.phone,
            "email": student.email,
            "photo_url": student.photo_url,
            "status": student.status,
            "attendance": {
                "percentage": attendance_pct,
                "total_days": total_days,
                "present": present_like - late,
                "absent": absent,
                "late": late,
            },
            "fees": {
                "due": fees_due,
                "paid": fees_paid,
            },
            "guardians": guardians,
            "teachers": teacher_names[:8],
            "results": {
                "latest_exam": latest_card.exam.name if latest_card and latest_card.exam else None,
                "gpa": getattr(latest_card, "gpa", None),
                "grade": getattr(latest_card, "grade", None),
                "rank": getattr(latest_card, "rank", None),
            },
            "pending_assignments": pending_assignments,
        }
    )
