"""Attendance plugin API — mark, list, reports."""
import uuid as uuid_mod
from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import String, func

from app.models.academic import Class, Section
from app.models.attendance import Attendance, TeacherAttendance, LeaveRequest
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from app.utils.teacher_scope import teacher_class_teacher_class_ids
from extensions import db

attendance_bp = Blueprint("attendance", __name__, url_prefix="/attendance")


@attendance_bp.route("/mark", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin", "teacher")
def mark_attendance():
    """Mark attendance for students in a class/section."""
    data = request.get_json(silent=True) or {}
    records = data.get("records", [])
    attendance_date = _parse_date(data.get("date"))
    if data.get("date") and not attendance_date:
        return error_response("date must use YYYY-MM-DD format", 400)
    if not attendance_date:
        attendance_date = date.today()
    default_class_id = data.get("class_id")
    default_section_id = data.get("section_id")

    # status is a Postgres ENUM (present/absent/late/half_day/leave) — anything
    # else dies at commit with InvalidTextRepresentation (500). Reject early.
    allowed_statuses = {"present", "absent", "late", "half_day", "leave"}

    allowed_class_ids = None
    allowed_class_ids_set = set()
    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_class_teacher_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
        if not allowed_class_ids_set:
            return error_response("No assigned classes for this teacher", 403)

    if not records:
        return error_response("No attendance records provided", 400)

    for idx, rec in enumerate(records):
        status = rec.get("status", "present")  # present, absent, late, half_day, leave
        if str(status).lower() not in allowed_statuses:
            return error_response(
                f"records[{idx}]: status must be one of {sorted(allowed_statuses)}", 400
            )

    # Pre-validate EVERY record before any write (E17-family, E173): unknown
    # students used to be silently skipped while the response still claimed
    # `total_marked: N`; with a request-level class_id a FOREIGN student's id
    # passed straight through into an INSERT — a cross-tenant write (or an FK
    # IntegrityError 500 for a bogus id). Same for class_id/section_id.
    cleaned = []
    for idx, rec in enumerate(records):
        student_id = _coerce_uuid(rec.get("student_id"))
        if not student_id:
            return error_response(
                f"records[{idx}]: student_id is required and must be a valid id", 400
            )
        student = Student.query.filter_by(
            id=student_id,
            school_id=g.school_id,
            is_deleted=False,
        ).first()
        if not student:
            return error_response(
                f"records[{idx}]: student_id does not match a student at this school", 400
            )

        class_id = _coerce_uuid(rec.get("class_id") or default_class_id)
        if rec.get("class_id") or default_class_id:
            # caller-provided class must be usable — no silent fallback
            if not class_id:
                return error_response(
                    f"records[{idx}]: class_id is not a valid id", 400
                )
        if class_id and not Class.query.filter_by(
            id=class_id, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response(
                f"records[{idx}]: class_id does not match a class at this school", 400
            )
        section_id = _coerce_uuid(rec.get("section_id") or default_section_id)
        if (rec.get("section_id") or default_section_id) and not section_id:
            return error_response(
                f"records[{idx}]: section_id is not a valid id", 400
            )
        if section_id and not Section.query.filter_by(
            id=section_id, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response(
                f"records[{idx}]: section_id does not match a section at this school", 400
            )
        if not class_id:
            class_id = student.class_id
        if not class_id:
            return error_response(f"records[{idx}]: unable to resolve a class for this student", 400)

        if allowed_class_ids is not None and str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to mark attendance for this class", 403)

        cleaned.append((student_id, str(rec.get("status", "present")).lower(), class_id, section_id, rec))

    created = []
    updated = 0
    for student_id, status, class_id, section_id, rec in cleaned:
        # Upsert: check if already marked. The lookup MUST include soft-deleted
        # rows — uq_attendance_student_date spans (school_id, student_id, date)
        # including tombstones, so skipping them made the INSERT die with a
        # UniqueViolation 500 for any student with a deleted row on that date.
        existing = Attendance.query.filter_by(
            school_id=g.school_id,
            student_id=student_id,
            date=attendance_date,
        ).first()

        if existing:
            existing.is_deleted = False
            existing.status = status
            existing.remarks = rec.get("remarks")
            existing.marked_by_id = get_jwt_identity()
            if class_id:
                existing.class_id = class_id
            if section_id:
                existing.section_id = section_id
            updated += 1
        else:
            attendance = Attendance(
                school_id=g.school_id,
                student_id=student_id,
                class_id=class_id,
                section_id=section_id,
                date=attendance_date,
                status=status,
                remarks=rec.get("remarks"),
                marked_by_id=get_jwt_identity(),
            )
            db.session.add(attendance)
            created.append(student_id)

    db.session.commit()

    # Emit event for other plugins
    from app.plugins.events import emit
    emit("attendance.marked", school_id=str(g.school_id), date=attendance_date, count=len(cleaned))

    return success_response({
        "date": attendance_date.isoformat(),
        "total_marked": len(cleaned),
        "new_records": len(created),
        "updated_records": updated,
    })


@attendance_bp.route("/submit", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin", "teacher")
def submit_attendance_compat():
    """Compatibility route used by Flutter repositories."""
    return mark_attendance()


@attendance_bp.route("/students/<class_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin", "teacher")
def list_students_for_attendance(class_id):
    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_class_teacher_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to view this class", 403)
    query = Student.query.filter_by(
        school_id=g.school_id,
        class_id=class_id,
        status="active",
        is_deleted=False,
    )
    section_id = request.args.get("section_id")
    if section_id:
        query = query.filter_by(section_id=section_id)
    students = query.order_by(Student.roll_number, Student.first_name).all()
    return success_response([
        {
            "id": str(student.id),
            "student_id": student.student_id,
            "roll_no": student.roll_number or 0,
            "name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
            "photo_url": student.photo_url,
            "class_id": str(student.class_id) if student.class_id else None,
            "section_id": str(student.section_id) if student.section_id else None,
        }
        for student in students
    ])


@attendance_bp.route("/student/<student_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
def list_student_attendance(student_id):
    query = Attendance.query.filter_by(
        school_id=g.school_id,
        student_id=student_id,
        is_deleted=False,
    )
    year = request.args.get("year")
    month = request.args.get("month")
    if year and month:
        prefix = f"{year}-{str(month).zfill(2)}"
        query = query.filter(Attendance.date.cast(String).like(f"{prefix}%"))
    records = query.order_by(Attendance.date.desc()).all()
    return success_response([_att_dict(record) for record in records])


@attendance_bp.route("/student/<student_id>/summary", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
def student_attendance_summary(student_id):
    records = Attendance.query.filter_by(
        school_id=g.school_id,
        student_id=student_id,
        is_deleted=False,
    ).all()
    counts = {}
    for record in records:
        counts[record.status] = counts.get(record.status, 0) + 1
    total = len(records)
    present = counts.get("present", 0)
    late = counts.get("late", 0)
    percentage = round(((present + late) / total * 100), 1) if total else 0
    return success_response({
        "total_days": total,
        "present_days": present,
        "absent_days": counts.get("absent", 0),
        "late_days": late,
        "half_day_days": counts.get("half_day", 0),
        "leave_days": counts.get("leave", 0),
        "percentage": percentage,
    })


@attendance_bp.route("/list", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
def list_attendance():
    """Get attendance records with filters."""
    query = Attendance.query.filter_by(school_id=g.school_id, is_deleted=False)

    # Teachers can only see attendance for their assigned classes
    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_class_teacher_class_ids(g.school_id, g.user_id)
        if not allowed_class_ids:
            return success_response([], meta={"pagination": {}})
        query = query.filter(Attendance.class_id.in_(allowed_class_ids))

    attendance_date = request.args.get("date")
    if attendance_date:
        query = query.filter_by(date=attendance_date)

    class_id = request.args.get("class_id")
    if class_id:
        # Ensure teacher isn't querying a class outside their scope
        if g.role == "teacher" and g.user_id:
            allowed = {str(cid) for cid in teacher_class_teacher_class_ids(g.school_id, g.user_id)}
            if str(class_id) not in allowed:
                return error_response("Not allowed to view this class", 403)
        query = query.filter_by(class_id=class_id)

    section_id = request.args.get("section_id")
    if section_id:
        query = query.filter_by(section_id=section_id)

    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    query = query.order_by(Attendance.date.desc())
    items, meta = paginate(query)
    return success_response([_att_dict(a) for a in items], meta={"pagination": meta})


@attendance_bp.route("/summary", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
def attendance_summary():
    """Get attendance summary for a date/class."""
    attendance_date = _parse_date(request.args.get("date")) or date.today()
    class_id = request.args.get("class_id")

    if not class_id:
        return error_response("class_id is required", 400)

    # Teachers can only view summary for their assigned classes
    if g.role == "teacher" and g.user_id:
        allowed = {str(cid) for cid in teacher_class_teacher_class_ids(g.school_id, g.user_id)}
        if str(class_id) not in allowed:
            return error_response("Not allowed to view this class", 403)

    total_students = Student.query.filter_by(
        school_id=g.school_id, class_id=class_id, status="active", is_deleted=False
    ).count()

    present = Attendance.query.filter_by(
        school_id=g.school_id, class_id=class_id, date=attendance_date, status="present", is_deleted=False
    ).count()
    absent = Attendance.query.filter_by(
        school_id=g.school_id, class_id=class_id, date=attendance_date, status="absent", is_deleted=False
    ).count()
    late = Attendance.query.filter_by(
        school_id=g.school_id, class_id=class_id, date=attendance_date, status="late", is_deleted=False
    ).count()
    # Any row (half_day/leave included) means the student WAS marked — only
    # students with no row at all are unmarked. Subtracting only the three
    # statuses above counted half_day/leave students as unmarked.
    marked = Attendance.query.filter_by(
        school_id=g.school_id, class_id=class_id, date=attendance_date, is_deleted=False
    ).count()

    return success_response({
        "date": attendance_date.isoformat(),
        "class_id": class_id,
        "total_students": total_students,
        "present": present,
        "absent": absent,
        "late": late,
        "not_marked": max(total_students - marked, 0),
        # Uniform late rule (matches /attendance/student/<id>/summary and
        # school-overview): a late student DID attend, so the rate counts
        # present + late. half_day/leave/excused never count toward the rate.
        "attendance_rate": round(((present + late) / total_students * 100), 1) if total_students else 0,
    })


@attendance_bp.route("/school-overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin")
def school_attendance_overview():
    """Aggregated school-wide attendance: today/week/month percentages and per-class breakdown."""
    from app.models.academic import Class

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def _pct(school_id, start, end=None):
        end_date = end or start
        total_students = Student.query.filter_by(
            school_id=school_id, status="active", is_deleted=False
        ).count()
        if not total_students:
            return 0.0
        # Count present (or late) attendance ROWS. mark_attendance upserts one
        # row per student per date, so the row count is the sum over days of
        # students present that day — averaging rows/(days × students) gives
        # the true average daily attendance rate. (Counting DISTINCT students
        # instead understated weekly/monthly rates by roughly the day count:
        # a student present every day of a 5-day week contributed only 1/5.)
        present_rows = db.session.query(func.count(Attendance.id)).filter(
            Attendance.school_id == school_id,
            Attendance.is_deleted.is_(False),
            Attendance.status.in_(["present", "late"]),
            Attendance.date >= start,
            Attendance.date <= end_date,
        ).scalar() or 0
        if start != end_date:
            days = max((end_date - start).days + 1, 1)
            return round(present_rows / days / total_students * 100, 1)
        return round(present_rows / total_students * 100, 1)

    today_pct = _pct(g.school_id, today)
    week_pct = _pct(g.school_id, week_start, today)
    month_pct = _pct(g.school_id, month_start, today)

    # Per-class breakdown for today
    classes = Class.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).order_by(Class.name).all()

    class_wise = []
    for klass in classes:
        total = Student.query.filter_by(
            school_id=g.school_id, class_id=klass.id, status="active", is_deleted=False
        ).count()
        if not total:
            continue
        present_today = Attendance.query.filter_by(
            school_id=g.school_id,
            class_id=klass.id,
            date=today,
            is_deleted=False,
        ).filter(Attendance.status.in_(["present", "late"])).count()
        class_wise.append({
            "class_id": str(klass.id),
            "class_name": klass.name,
            "section_name": None,
            "total_students": total,
            "present_today": present_today,
            "present_pct": round(present_today / total * 100, 1),
        })

    return success_response({
        "summary": {
            "today_pct": today_pct,
            "week_pct": week_pct,
            "month_pct": month_pct,
        },
        "class_wise": class_wise,
    })


# ── Teacher Attendance ─────────────────────────────────────


@attendance_bp.route("/teachers/mark", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin")
def mark_teacher_attendance():
    """Mark attendance for teachers/staff."""
    from uuid import UUID as _UUID

    from app.models.user import User

    data = request.get_json(silent=True) or {}
    records = data.get("records", [])
    attendance_date = _parse_date(data.get("date")) or date.today()
    if data.get("date") and not _parse_date(data.get("date")):
        return error_response("date must use YYYY-MM-DD format", 400)

    allowed_statuses = {"present", "absent", "late", "leave", "half_day"}
    cleaned = []
    for idx, rec in enumerate(records):
        user_id = rec.get("user_id")
        if not user_id:
            return error_response(f"records[{idx}]: user_id is required", 400)
        try:
            user_uuid = _UUID(str(user_id))
        except (TypeError, ValueError, AttributeError):
            return error_response(f"records[{idx}]: user_id is not a valid id", 400)
        status = str(rec.get("status", "present")).lower()
        if status not in allowed_statuses:
            return error_response(
                f"records[{idx}]: status must be one of {sorted(allowed_statuses)}", 400
            )
        # The staff member must belong to this school — otherwise the insert is
        # a cross-tenant write (or an FK IntegrityError 500).
        if not User.query.filter_by(id=user_uuid, school_id=g.school_id, is_deleted=False).first():
            return error_response(
                f"records[{idx}]: user_id does not match a user at this school", 400
            )
        cleaned.append((user_uuid, status, rec))

    for user_uuid, status, rec in cleaned:
        # Same tombstone rule as mark_attendance: the unique index spans
        # (school_id, user_id, date) INCLUDING soft-deleted rows.
        existing = TeacherAttendance.query.filter_by(
            school_id=g.school_id, user_id=user_uuid, date=attendance_date
        ).first()

        if existing:
            existing.is_deleted = False
            existing.status = status
            existing.check_in_time = rec.get("check_in_time")
            existing.check_out_time = rec.get("check_out_time")
        else:
            ta = TeacherAttendance(
                school_id=g.school_id,
                user_id=user_uuid,
                date=attendance_date,
                status=status,
                check_in_time=rec.get("check_in_time"),
                check_out_time=rec.get("check_out_time"),
            )
            db.session.add(ta)

    db.session.commit()
    return success_response({"date": attendance_date.isoformat(), "total_marked": len(records)})


@attendance_bp.route("/teachers/list", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin")
def list_teacher_attendance():
    """Get teacher/staff attendance records."""
    query = TeacherAttendance.query.filter_by(school_id=g.school_id, is_deleted=False)
    
    attendance_date = request.args.get("date")
    if attendance_date:
        query = query.filter_by(date=attendance_date)
        
    user_id = request.args.get("user_id")
    if user_id:
        query = query.filter_by(user_id=user_id)
        
    query = query.order_by(TeacherAttendance.date.desc())
    items, meta = paginate(query)
    return success_response([_teacher_att_dict(a) for a in items], meta={"pagination": meta})



# ── Leave Requests ─────────────────────────────────────────


@attendance_bp.route("/leave-requests", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("attendance")
def list_leave_requests():
    """List leave requests."""
    query = LeaveRequest.query.filter_by(school_id=g.school_id, is_deleted=False)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    query = query.order_by(LeaveRequest.created_at.desc())
    items, meta = paginate(query)
    return success_response([_leave_dict(lr) for lr in items], meta={"pagination": meta})


@attendance_bp.route("/leave-requests", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("attendance")
def create_leave_request():
    """Submit a leave request."""
    data = request.get_json(silent=True) or {}
    start_date = _parse_date(data.get("start_date"))
    end_date = _parse_date(data.get("end_date"))
    if not start_date or not end_date:
        return error_response("start_date and end_date are required", 400)
    # E174: user_id used to flow straight from the payload into the INSERT —
    # a foreign (other-school) user id created a cross-tenant leave row, a
    # bogus id died at commit with an FK IntegrityError 500. Default to the
    # caller; a provided id must be a user at this school.
    from app.models.user import User

    user_id = _coerce_uuid(data.get("user_id")) or get_jwt_identity()
    if not user_id:
        return error_response("user_id is required", 400)
    if not User.query.filter_by(id=user_id, school_id=g.school_id, is_deleted=False).first():
        return error_response("user_id does not match a user at this school", 400)
    lr = LeaveRequest(
        school_id=g.school_id,
        user_id=user_id,
        leave_type=data.get("leave_type", "sick"),
        start_date=start_date,
        end_date=end_date,
        reason=data.get("reason"),
        status="pending",
    )
    db.session.add(lr)
    db.session.commit()
    return created_response(_leave_dict(lr))


@attendance_bp.route("/leave-requests/<uuid:request_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin", "teacher")
def approve_leave_request(request_id):
    """Approve a leave request."""
    lr = LeaveRequest.query.get(request_id)
    if not lr or lr.is_deleted or str(lr.school_id) != str(g.school_id):
        return error_response("Leave request not found", 404)
    lr.status = "approved"
    lr.approved_by_id = get_jwt_identity()
    lr.approved_at = datetime.now(timezone.utc)
    db.session.commit()
    return success_response(_leave_dict(lr))


@attendance_bp.route("/leave-requests/<uuid:request_id>/reject", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("attendance")
@role_required("school_admin", "teacher")
def reject_leave_request(request_id):
    """Reject a leave request."""
    lr = LeaveRequest.query.get(request_id)
    if not lr or lr.is_deleted or str(lr.school_id) != str(g.school_id):
        return error_response("Leave request not found", 404)
    data = request.get_json(silent=True) or {}
    lr.status = "rejected"
    # No dedicated rejection_reason column exists on LeaveRequest; the note
    # (if any) is not persisted — same as the previous silent behavior.
    lr.approved_by_id = get_jwt_identity()
    lr.approved_at = datetime.now(timezone.utc)
    db.session.commit()
    return success_response(_leave_dict(lr))


# ── Serializers ────────────────────────────────────────────


def _att_dict(a):
    return {
        "id": str(a.id),
        "student_id": str(a.student_id),
        "class_id": str(a.class_id) if a.class_id else None,
        "section_id": str(a.section_id) if a.section_id else None,
        "date": str(a.date),
        "date_bs": a.date_bs,
        "status": a.status,
        "check_in_time": str(a.check_in_time) if a.check_in_time else None,
        "check_out_time": str(a.check_out_time) if a.check_out_time else None,
        "remarks": a.remarks,
        "marked_by": str(a.marked_by_id) if a.marked_by_id else None,
        "marked_by_id": str(a.marked_by_id) if a.marked_by_id else None,
    }


def _leave_dict(lr):
    # LeaveRequest has no student_id column (staff/user leaves only) — reading
    # one 500'd the whole list/create/approve/reject responses.
    return {
        "id": str(lr.id),
        "user_id": str(lr.user_id) if lr.user_id else None,
        "leave_type": lr.leave_type,
        "start_date": str(lr.start_date),
        "end_date": str(lr.end_date),
        "reason": lr.reason,
        "status": lr.status,
    }


def _teacher_att_dict(a):
    return {
        "id": str(a.id),
        "user_id": str(a.user_id),
        "staff_name": a.user.full_name if getattr(a, "user", None) else None,
        "date": str(a.date),
        "status": a.status,
        # check_in_time/check_out_time are datetime.time columns — left raw they
        # are not JSON serializable and 500 the whole list response.
        "check_in_time": a.check_in_time.strftime("%H:%M:%S") if a.check_in_time else None,
        "check_out_time": a.check_out_time.strftime("%H:%M:%S") if a.check_out_time else None,
    }


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(str(value))
        except ValueError:
            return None


def _coerce_uuid(value):
    """Coerce to UUID; None when absent/not a valid UUID (garbage ids would
    otherwise reach the ORM and die with a DataError 500)."""
    if isinstance(value, uuid_mod.UUID):
        return value
    if not value:
        return None
    try:
        return uuid_mod.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None
