"""Assignments API — create, submit, grade assignments."""
from datetime import datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.assignment import Assignment, AssignmentSubmission
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.nepali_date import ad_to_bs
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

assignments_bp = Blueprint("assignments", __name__, url_prefix="/assignments")


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
    a = Assignment(
        school_id=g.school_id,
        teacher_id=g.user_id,
        title=data.get("title") or "Untitled Assignment",
        description=data.get("description"),
        class_id=data.get("class_id"),
        section_id=data.get("section_id"),
        subject_id=data.get("subject_id"),
        due_date=_parse_datetime(data.get("due_date")) or datetime.now(timezone.utc),
        total_marks=data.get("total_marks") or data.get("max_marks"),
        attachment_urls=data.get("attachment_urls") or ([data["attachment_url"]] if data.get("attachment_url") else None),
    )
    db.session.add(a)
    db.session.commit()
    return created_response(_assignment_dict(a))


@assignments_bp.route("/<assignment_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("assignments")
def get_assignment(assignment_id):
    a = Assignment.query.filter_by(id=assignment_id, school_id=g.school_id).first_or_404()
    return success_response(_assignment_dict(a))


@assignments_bp.route("/<assignment_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("assignments")
@role_required("superadmin", "school_admin", "teacher")
def update_assignment(assignment_id):
    a = Assignment.query.filter_by(id=assignment_id, school_id=g.school_id).first_or_404()
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
    a = Assignment.query.filter_by(id=assignment_id, school_id=g.school_id).first_or_404()
    a.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Submissions ───────────────────────────────────────────

@assignments_bp.route("/<assignment_id>/submissions", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("assignments")
def list_submissions(assignment_id):
    Assignment.query.filter_by(
        id=assignment_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first_or_404()
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
    student_id = data.get("student_id") or (student.id if student else None)
    if not student_id:
        return error_response("student_id is required", 400)
    sub = AssignmentSubmission(
        school_id=g.school_id,
        assignment_id=assignment_id,
        student_id=student_id,
        content=data.get("content") or data.get("remarks") or data.get("note") or "",
        attachment_urls=data.get("attachment_urls") or ([data["file_url"]] if data.get("file_url") else None),
        submitted_at=datetime.now(timezone.utc),
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
    sub = AssignmentSubmission.query.filter_by(id=sub_id, assignment_id=assignment_id).first_or_404()
    data = request.get_json(silent=True) or {}
    sub.marks = data.get("marks") or data.get("marks_obtained")
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
    sub = AssignmentSubmission.query.filter_by(id=sub_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    sub.marks = data.get("marks") or data.get("marks_obtained")
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
    sub = AssignmentSubmission.query.filter_by(id=data.get("submission_id"), assignment_id=assignment_id).first_or_404()

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
        "due_date_bs": ad_to_bs(a.due_date) if a.due_date else None,
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
        "submitted_at": str(s.submitted_at or s.created_at) if hasattr(s, "created_at") else None,
    }


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
