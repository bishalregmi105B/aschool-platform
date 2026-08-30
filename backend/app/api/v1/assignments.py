"""Assignments API — create, submit, grade assignments."""
import uuid as uuid_mod
from datetime import datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.academic import Class, Section, Subject
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

assignments_bp = Blueprint("assignments", __name__, url_prefix="/assignments")


def _safe_ad_to_bs(ad_date):
    """ad_to_bs that degrades to None instead of OverflowError — dates beyond
    the nepali_datetime conversion range (e.g. far-future due dates) used to
    500 the response AFTER the row was committed."""
    if not ad_date:
        return None
    try:
        return ad_to_bs(ad_date)
    except (OverflowError, ValueError, TypeError):
        return None


@assignments_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("assignments")
def list_assignments():
    query = Assignment.query.filter_by(school_id=g.school_id, is_deleted=False)
    class_id = request.args.get("class_id")
    subject_id = request.args.get("subject_id")
    if class_id:
        query = query.filter_by(class_id=class_id)
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    query = query.order_by(Assignment.due_date.desc())
    items, meta = paginate(query)
    return success_response([_assignment_dict(a) for a in items], meta={"pagination": meta})


@assignments_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin", "teacher")
def create_assignment():
    data = request.get_json(silent=True) or {}
    # class_id/subject_id/teacher_id are NOT NULL on the model — validate them
    # (and their school scope) up front so a bad payload is a 400, not an
    # IntegrityError 500 at commit.
    class_id = _coerce_uuid(data.get("class_id"))
    subject_id = _coerce_uuid(data.get("subject_id"))
    if not g.user_id:
        return error_response("Only school users can create assignments", 403)
    if not class_id or not subject_id:
        return error_response("class_id and subject_id are required and must be valid ids", 400)
    if not Class.query.filter_by(id=class_id, school_id=g.school_id, is_deleted=False).first():
        return error_response("class_id does not match a class at this school", 400)
    if not Subject.query.filter_by(id=subject_id, school_id=g.school_id, is_deleted=False).first():
        return error_response("subject_id does not match a subject at this school", 400)
    section_id = _coerce_uuid(data.get("section_id"))
    if section_id and not Section.query.filter_by(
        id=section_id, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("section_id does not match a section at this school", 400)
    a = Assignment(
        school_id=g.school_id,
        teacher_id=g.user_id,
        title=data.get("title") or "Untitled Assignment",
        description=data.get("description"),
        class_id=class_id,
        section_id=section_id,
        subject_id=subject_id,
        due_date=_parse_datetime(data.get("due_date")) or datetime.now(timezone.utc),
        total_marks=data.get("total_marks") or data.get("max_marks"),
        attachment_urls=data.get("attachment_urls") or ([data["attachment_url"]] if data.get("attachment_url") else None),
    )
    db.session.add(a)
    db.session.commit()

    # Notify students/parents about new assignment
    try:
        from app.plugins.events import emit_for_school
        emit_for_school(
            "assignment.created",
            school_id=str(g.school_id),
            assignment_id=str(a.id),
            title=a.title,
            class_id=str(a.class_id) if a.class_id else None,
        )
    except Exception:
        pass

    return created_response(_assignment_dict(a))


@assignments_bp.route("/<assignment_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("assignments")
def get_assignment(assignment_id):
    aid = _coerce_uuid(assignment_id)
    a = (
        Assignment.query.filter_by(id=aid, school_id=g.school_id).first()
        if aid
        else None
    )
    if not a:
        return error_response("Assignment not found", 404)
    return success_response(_assignment_dict(a))


@assignments_bp.route("/<assignment_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin", "teacher")
def update_assignment(assignment_id):
    aid = _coerce_uuid(assignment_id)
    a = (
        Assignment.query.filter_by(id=aid, school_id=g.school_id).first()
        if aid
        else None
    )
    if not a:
        return error_response("Assignment not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("title", "description", "total_marks"):
        if key in data:
            setattr(a, key, data[key])
    if "due_date" in data:
        a.due_date = _parse_datetime(data["due_date"]) or a.due_date
    if "attachment_urls" in data:
        a.attachment_urls = data["attachment_urls"]
    db.session.commit()
    return success_response(_assignment_dict(a))


@assignments_bp.route("/<assignment_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin")
def delete_assignment(assignment_id):
    aid = _coerce_uuid(assignment_id)
    a = (
        Assignment.query.filter_by(id=aid, school_id=g.school_id).first()
        if aid
        else None
    )
    if not a:
        return error_response("Assignment not found", 404)
    a.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Submissions ───────────────────────────────────────────

@assignments_bp.route("/<assignment_id>/submissions", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("assignments")
def list_submissions(assignment_id):
    aid = _coerce_uuid(assignment_id)
    assignment = (
        Assignment.query.filter_by(
            id=aid,
            school_id=g.school_id,
            is_deleted=False,
        ).first()
        if aid
        else None
    )
    if not assignment:
        return error_response("Assignment not found", 404)
    query = AssignmentSubmission.query.filter_by(
        assignment_id=assignment_id,
        school_id=g.school_id,
        is_deleted=False,
    ).order_by(AssignmentSubmission.submitted_at.desc())
    items, meta = paginate(query)
    return success_response([_submission_dict(s) for s in items], meta={"pagination": meta})


@assignments_bp.route("/<assignment_id>/submit", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("assignments")
def submit_assignment(assignment_id):
    data = request.get_json(silent=True) or {}
    student = _current_student()
    student_id = _coerce_uuid(data.get("student_id")) or (student.id if student else None)
    if not student_id:
        return error_response("student_id is required and must be a valid id", 400)
    # Students may only submit their own work — otherwise a student token can
    # impersonate a classmate by passing their student_id.
    if g.role == "student" and (not student or student_id != student.id):
        return error_response("You can only submit your own assignment", 403)
    aid = _coerce_uuid(assignment_id)
    # The assignment must exist in the submitting school (prevents writing a
    # submission that points at another tenant's assignment).
    assignment = (
        Assignment.query.filter_by(
            id=aid, school_id=g.school_id, is_deleted=False
        ).first()
        if aid
        else None
    )
    if not assignment:
        return error_response("Assignment not found", 404)
    # The student must exist in the same school (valid-UUID foreign student
    # used to pass validation and die at commit with an FK IntegrityError 500).
    student_row = Student.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not student_row:
        return error_response(
            "student_id does not match a student at this school", 400
        )
    submitted_at = datetime.now(timezone.utc)
    due = (
        assignment.due_date.replace(tzinfo=timezone.utc)
        if assignment.due_date and assignment.due_date.tzinfo is None
        else assignment.due_date
    )
    sub = AssignmentSubmission(
        school_id=g.school_id,
        assignment_id=assignment_id,
        student_id=student_id,
        content=data.get("content") or data.get("remarks") or data.get("note") or "",
        attachment_urls=data.get("attachment_urls") or ([data["file_url"]] if data.get("file_url") else None),
        submitted_at=submitted_at,
        # The model's is_late column was never populated — compute it from the
        # assignment's due date (late = submitted after the deadline).
        is_late=bool(due and submitted_at > due),
    )
    db.session.add(sub)
    db.session.commit()

    from app.plugins.events import emit
    emit(
        "assignment.submitted",
        school_id=str(g.school_id),
        assignment_id=str(assignment_id),
        student_id=str(student_id),
        submission_id=str(sub.id),
    )

    return created_response(_submission_dict(sub))


@assignments_bp.route("/<assignment_id>/submissions/<sub_id>/grade", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin", "teacher")
def grade_submission(assignment_id, sub_id):
    aid = _coerce_uuid(assignment_id)
    sid = _coerce_uuid(sub_id)
    sub = (
        AssignmentSubmission.query.filter_by(
            id=sid,
            assignment_id=aid,
            school_id=g.school_id,
        ).first()
        if aid and sid
        else None
    )
    if not sub:
        return error_response("Submission not found", 404)
    data = request.get_json(silent=True) or {}
    sub.marks = data["marks"] if "marks" in data else data.get("marks_obtained")
    sub.feedback = data.get("feedback", "")
    sub.graded_by_id = g.user_id
    sub.graded_at = datetime.now(timezone.utc)
    sub.status = "graded"
    db.session.commit()
    return success_response(_submission_dict(sub))


@assignments_bp.route("/submissions/<sub_id>/grade", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin", "teacher")
def grade_submission_compat(sub_id):
    """Compatibility route used by Flutter shared repository."""
    sid = _coerce_uuid(sub_id)  # E178: garbage id used to 500 (DataError)
    sub = (
        AssignmentSubmission.query.filter_by(id=sid, school_id=g.school_id).first()
        if sid
        else None
    )
    if not sub:
        return error_response("Submission not found", 404)
    data = request.get_json(silent=True) or {}
    sub.marks = data["marks"] if "marks" in data else data.get("marks_obtained")
    sub.feedback = data.get("feedback", "")
    sub.graded_by_id = g.user_id
    sub.graded_at = datetime.now(timezone.utc)
    sub.status = "graded"
    db.session.commit()
    return success_response(_submission_dict(sub))


@assignments_bp.route("/<assignment_id>/ai-grade", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin", "teacher")
def ai_grade_submission(assignment_id):
    """Use AI auto-grader for a submission."""
    from app.services.ai.auto_grader import AutoGraderService

    data = request.get_json(silent=True) or {}
    a = Assignment.query.filter_by(id=assignment_id, school_id=g.school_id).first_or_404()
    # E178: garbage submission_id 500ed (DataError) and the lookup skipped the
    # school_id filter — resolve inside this school only.
    sub_id = _coerce_uuid(data.get("submission_id"))
    sub = (
        AssignmentSubmission.query.filter_by(
            id=sub_id,
            assignment_id=assignment_id,
            school_id=g.school_id,
        ).first()
        if sub_id
        else None
    )
    if not sub:
        return error_response("Submission not found", 404)

    result = AutoGraderService.grade_submission(
        question=a.description or a.title,
        answer=sub.content or "",
        max_marks=a.total_marks or 10,
        subject=data.get("subject", ""),
    )
    return success_response(result)


def _assignment_dict(a):
    submission_count = len([s for s in a.submissions if not s.is_deleted])
    total_students = Student.query.filter_by(
        school_id=a.school_id,
        class_id=a.class_id,
        section_id=a.section_id,
        status="active",
        is_deleted=False,
    ).count()
    status = "past" if a.due_date and a.due_date.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc) else "active"
    return {
        "id": str(a.id), "title": a.title, "description": a.description,
        "class_id": str(a.class_id) if a.class_id else None,
        "class_name": a.klass.name if a.klass else None,
        "section_id": str(a.section_id) if a.section_id else None,
        "section_name": a.section.name if a.section else None,
        "subject_id": str(a.subject_id) if a.subject_id else None,
        "subject_name": a.subject.name if a.subject else None,
        "subject": a.subject.name if a.subject else None,
        "due_date": str(a.due_date) if a.due_date else None,
        "due_date_bs": _safe_ad_to_bs(a.due_date),
        "max_marks": a.total_marks,
        "total_marks": a.total_marks,
        "attachment_url": (a.attachment_urls or [None])[0],
        "attachment_urls": a.attachment_urls or [],
        "status": status,
        "created_by_id": str(a.teacher_id) if a.teacher_id else None,
        "created_by_name": a.teacher.full_name if a.teacher else None,
        "submitted_count": submission_count,
        "total_students": total_students or submission_count or 1,
    }


def _submission_dict(s):
    student_name = None
    if s.student:
        student_name = f"{s.student.first_name or ''} {s.student.last_name or ''}".strip()
    return {
        "id": str(s.id),
        "assignment_id": str(s.assignment_id),
        "assignment_title": s.assignment.title if s.assignment else None,
        "student_id": str(s.student_id),
        "student_name": student_name,
        "roll_number": s.student.roll_number if s.student else None,
        "photo_url": s.student.photo_url if s.student else None,
        "content": s.content,
        "remarks": s.content,
        "file_url": (s.attachment_urls or [None])[0],
        "attachment_urls": s.attachment_urls or [],
        "max_marks": s.assignment.total_marks if s.assignment else None,
        "marks": float(s.marks) if s.marks is not None else None,
        "marks_obtained": float(s.marks) if s.marks is not None else None,
        "feedback": s.feedback,
        "graded_by_id": str(s.graded_by_id) if s.graded_by_id else None,
        "graded_by_name": s.graded_by.full_name if s.graded_by else None,
        "graded_at": str(s.graded_at) if s.graded_at else None,
        "status": s.status,
        "is_late": bool(s.is_late),
        "submitted_at": str(s.submitted_at or s.created_at) if hasattr(s, "created_at") else None,
    }


def _coerce_uuid(value):
    """Coerce to UUID; None when the value is absent or not a valid UUID
    (garbage ids would otherwise reach the ORM and die with a DataError 500)."""
    if isinstance(value, uuid_mod.UUID):
        return value
    if not value:
        return None
    try:
        return uuid_mod.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _current_student():
    if not g.user_id:
        return None
    return Student.query.filter_by(
        school_id=g.school_id,
        user_id=g.user_id,
        is_deleted=False,
    ).first()


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
