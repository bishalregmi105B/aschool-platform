"""Exams plugin API — exams, marks, results, report cards (Nepal NEB grading)."""

from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from flask import Blueprint, g, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from app.models.academic import Class, Section, Subject
from app.models.exam import Exam, Marks, OnlineExam, OnlineExamAttempt, ReportCard
from app.models.school import School
from app.models.student import Guardian, Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.nepal_grading import GRADE_TABLE, calculate_gpa, calculate_subject_grade
from app.utils.pagination import paginate
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from app.utils.teacher_scope import (
    teacher_allowed_class_ids,
    teacher_allowed_subject_ids,
)
from extensions import db

exams_bp = Blueprint("exams", __name__, url_prefix="/exams")


def _to_float(value, default=None):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _first_float(*values, default=0.0):
    for value in values:
        resolved = _to_float(value, None)
        if resolved is not None:
            return resolved
    return default


def _resolve_subject_marks_config(
    subject=None,
    exam=None,
    total_full_marks=None,
    total_pass_marks=None,
    practical_full_marks=None,
    has_practical=None,
):
    subject_has_practical = bool(getattr(subject, "has_practical", False))
    exam_has_practical = bool(getattr(exam, "is_practical", False))
    resolved_has_practical = (
        bool(has_practical)
        if has_practical is not None
        else subject_has_practical or exam_has_practical
    )

    subject_practical_full = _first_float(
        getattr(subject, "practical_full_marks", None), default=0.0
    )
    subject_practical_pass = _first_float(
        getattr(subject, "practical_pass_marks", None), default=0.0
    )

    if resolved_has_practical and subject_practical_full > 0:
        theory_full = _first_float(getattr(subject, "full_marks", None), default=0.0)
        theory_pass = _first_float(getattr(subject, "pass_marks", None), default=0.0)
        practical_full = subject_practical_full
        practical_pass = subject_practical_pass
        return {
            "has_practical": True,
            "uses_subject_practical": True,
            "theory_full_marks": theory_full,
            "theory_pass_marks": theory_pass,
            "practical_full_marks": practical_full,
            "practical_pass_marks": practical_pass,
            "total_full_marks": theory_full + practical_full,
            "total_pass_marks": theory_pass + practical_pass,
        }

    resolved_total_full = _first_float(
        total_full_marks,
        getattr(subject, "full_marks", None),
        getattr(exam, "total_marks", None),
        getattr(exam, "full_marks", None),
        default=100.0,
    )
    resolved_total_pass = _first_float(
        total_pass_marks,
        getattr(subject, "pass_marks", None),
        getattr(exam, "pass_marks", None),
        default=32.0,
    )

    resolved_practical_full = 0.0
    if resolved_has_practical:
        resolved_practical_full = min(
            _first_float(
                practical_full_marks,
                getattr(exam, "practical_marks", None),
                default=round(resolved_total_full * 0.2, 2),
            ),
            resolved_total_full,
        )

    theory_full = (
        max(resolved_total_full - resolved_practical_full, 0.0)
        if resolved_has_practical
        else resolved_total_full
    )
    return {
        "has_practical": resolved_has_practical,
        "uses_subject_practical": False,
        "theory_full_marks": theory_full,
        "theory_pass_marks": None,
        "practical_full_marks": resolved_practical_full,
        "practical_pass_marks": None,
        "total_full_marks": resolved_total_full,
        "total_pass_marks": resolved_total_pass,
    }


def _build_subject_grade(
    theory_obtained,
    practical_obtained=0,
    subject=None,
    exam=None,
    total_full_marks=None,
    total_pass_marks=None,
    practical_full_marks=None,
    has_practical=None,
):
    config = _resolve_subject_marks_config(
        subject=subject,
        exam=exam,
        total_full_marks=total_full_marks,
        total_pass_marks=total_pass_marks,
        practical_full_marks=practical_full_marks,
        has_practical=has_practical,
    )
    result = calculate_subject_grade(
        theory_obtained,
        config["theory_full_marks"],
        practical_obtained,
        config["practical_full_marks"],
        theory_pass_marks=config["theory_pass_marks"],
        practical_pass_marks=config["practical_pass_marks"],
    )
    result.update(config)
    return result


def _mark_is_pass(mark, subject=None, exam=None):
    if not mark:
        return False

    grade = (getattr(mark, "grade", None) or "").strip().upper()
    if grade:
        return grade != "NG"

    subject_grade = _build_subject_grade(
        _to_float(getattr(mark, "theory_marks", None), 0.0) or 0.0,
        _to_float(getattr(mark, "practical_marks", None), 0.0) or 0.0,
        subject=subject,
        exam=exam,
        total_full_marks=getattr(mark, "full_marks", None),
        total_pass_marks=getattr(mark, "pass_marks", None),
        has_practical=(
            bool(getattr(subject, "has_practical", False))
            or bool(getattr(exam, "is_practical", False))
            or (_to_float(getattr(mark, "practical_marks", None), 0.0) or 0.0) > 0
        ),
    )
    return subject_grade["status"] == "pass"


# ── NEB Grade Table ────────────────────────────────────────


@exams_bp.route("/grade-table", methods=["GET"])
@jwt_required()
def get_grade_table():
    """Return Nepal NEB grading scale for reference."""
    return success_response(GRADE_TABLE)


# ── Exam CRUD ──────────────────────────────────────────────


@exams_bp.route("", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def list_exams():
    query = Exam.query.filter_by(school_id=g.school_id, is_deleted=False)
    academic_year_id = request.args.get("academic_year_id")
    if academic_year_id:
        query = query.filter_by(academic_year_id=academic_year_id)
    exam_type = request.args.get("exam_type")
    if exam_type:
        query = query.filter_by(exam_type=exam_type)
    status = request.args.get("status")
    if status:
        statuses = [value.strip() for value in status.split(",") if value.strip()]
        if statuses:
            query = query.filter(Exam.status.in_(statuses))
    class_id = request.args.get("class_id")
    if class_id:
        query = query.filter_by(class_id=class_id)

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        if not allowed_class_ids and not allowed_subject_ids:
            query = query.filter(Exam.id.is_(None))
        else:
            filters = []
            if allowed_class_ids:
                filters.append(Exam.class_id.in_(allowed_class_ids))
                filters.append(Exam.class_ids.overlap(allowed_class_ids))
            if allowed_subject_ids:
                filters.append(Exam.subject_ids.overlap(allowed_subject_ids))
            query = query.filter(db.or_(*filters))
    items, meta = paginate(query.order_by(Exam.created_at.desc()))
    return success_response([_exam_dict(e) for e in items], meta={"pagination": meta})


# ── Online Exams ───────────────────────────────────────────


@exams_bp.route("/online", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def list_online_exams():
    query = OnlineExam.query.filter_by(school_id=g.school_id, is_deleted=False)
    class_id = request.args.get("class_id")
    subject_id = request.args.get("subject_id")
    status = request.args.get("status")
    if class_id:
        query = query.filter_by(class_id=class_id)
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    if status:
        query = query.filter_by(status=status)

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        if not allowed_class_ids and not allowed_subject_ids:
            return success_response([])
        filters = []
        if allowed_class_ids:
            filters.append(OnlineExam.class_id.in_(allowed_class_ids))
        if allowed_subject_ids:
            filters.append(OnlineExam.subject_id.in_(allowed_subject_ids))
        query = query.filter(db.or_(*filters))
    exams = query.order_by(
        OnlineExam.start_at.desc().nullslast(), OnlineExam.created_at.desc()
    ).all()
    return success_response([_online_exam_dict(exam) for exam in exams])


@exams_bp.route("/online", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin", "teacher")
def create_online_exam():
    data = request.get_json(silent=True) or {}
    questions = data.get("questions") or []

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        class_id = data.get("class_id")
        subject_id = data.get("subject_id")
        if not allowed_class_ids and not allowed_subject_ids:
            return error_response("Not allowed to create exams", 403)
        if class_id or subject_id:
            if (class_id and str(class_id) in {str(cid) for cid in allowed_class_ids}) or (
                subject_id and str(subject_id) in {str(sid) for sid in allowed_subject_ids}
            ):
                pass
            else:
                return error_response("Not allowed to create exams", 403)
    exam = OnlineExam(
        school_id=g.school_id,
        title=data.get("title") or data.get("name") or "Online Exam",
        description=data.get("description"),
        class_id=data.get("class_id"),
        section_id=data.get("section_id"),
        subject_id=data.get("subject_id"),
        duration_minutes=data.get("duration_minutes") or data.get("duration") or 30,
        total_marks=data.get("total_marks") or _sum_question_marks(questions),
        total_questions=data.get("total_questions") or len(questions),
        questions=questions,
        start_at=_parse_datetime(data.get("start_at") or data.get("start_date")),
        end_at=_parse_datetime(data.get("end_at") or data.get("end_date")),
        status=data.get("status", "upcoming"),
        instructions=data.get("instructions"),
        created_by_id=get_jwt_identity(),
    )
    db.session.add(exam)
    db.session.commit()
    return created_response(_online_exam_dict(exam, include_questions=True))


@exams_bp.route("/online/<uuid:online_exam_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_online_exam(online_exam_id):
    exam = OnlineExam.query.filter_by(
        id=online_exam_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not exam:
        return error_response("Online exam not found", 404)
    return success_response(_online_exam_dict(exam, include_questions=True))


@exams_bp.route("/online/<uuid:online_exam_id>/submit", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
def submit_online_exam(online_exam_id):
    exam = OnlineExam.query.filter_by(
        id=online_exam_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not exam:
        return error_response("Online exam not found", 404)

    data = request.get_json(silent=True) or {}
    student = _current_student()
    student_id = data.get("student_id") or (student.id if student else None)
    if not student_id:
        return error_response("student_id is required", 400)

    answers = data.get("answers") or {}
    score = _score_online_exam(exam.questions or [], answers)
    attempt = OnlineExamAttempt(
        school_id=g.school_id,
        online_exam_id=exam.id,
        student_id=student_id,
        answers=answers,
        score=score,
        status="submitted",
        submitted_at=datetime.now(timezone.utc),
    )
    db.session.add(attempt)
    db.session.commit()
    return created_response(
        {
            "id": str(attempt.id),
            "online_exam_id": str(exam.id),
            "student_id": str(attempt.student_id),
            "score": float(attempt.score or 0),
            "total_marks": exam.total_marks or 0,
            "status": attempt.status,
        }
    )


@exams_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin")
def create_exam():
    data = request.get_json(silent=True) or {}
    exam = Exam(school_id=g.school_id, created_by=get_jwt_identity())
    for key in (
        "name",
        "name_nepali",
        "academic_year_id",
        "exam_type",
        "class_id",
        "subject_ids",
        "start_date_bs",
        "end_date_bs",
        "start_date_ad",
        "end_date_ad",
        "total_marks",
        "pass_marks",
        "is_practical",
        "practical_marks",
        "description",
        "instructions",
    ):
        if key in data:
            setattr(exam, key, data[key])
    # Map older field names
    if "start_date" in data and not data.get("start_date_bs"):
        exam.start_date_bs = data["start_date"]
    if "end_date" in data and not data.get("end_date_bs"):
        exam.end_date_bs = data["end_date"]
    if "full_marks" in data:
        exam.total_marks = data["full_marks"]
    db.session.add(exam)
    db.session.commit()
    return created_response(_exam_dict(exam))


@exams_bp.route("/<uuid:exam_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_exam(exam_id):
    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        allowed_subject_ids_set = {str(sid) for sid in allowed_subject_ids}
        exam_class_ids = [exam.class_id] if exam.class_id else []
        exam_class_ids += exam.class_ids or []
        exam_subject_ids = exam.subject_ids or []
        if not any(str(cid) in allowed_class_ids_set for cid in exam_class_ids) and not any(
            str(sid) in allowed_subject_ids_set for sid in exam_subject_ids
        ):
            return error_response("Exam not found", 404)

    from app.models.school import School

    school = School.query.get(g.school_id)
    return success_response(_exam_dict(exam))


@exams_bp.route("/<uuid:exam_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin")
def update_exam(exam_id):
    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)
    data = request.get_json(silent=True) or {}
    for key in (
        "name",
        "name_nepali",
        "exam_type",
        "class_id",
        "subject_ids",
        "start_date_bs",
        "end_date_bs",
        "start_date_ad",
        "end_date_ad",
        "total_marks",
        "pass_marks",
        "is_practical",
        "practical_marks",
        "status",
        "description",
        "instructions",
    ):
        if key in data:
            setattr(exam, key, data[key])
    db.session.commit()
    return success_response(_exam_dict(exam))


@exams_bp.route("/<uuid:exam_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin")
def delete_exam(exam_id):
    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)
    exam.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Marks ──────────────────────────────────────────────────


@exams_bp.route("/<uuid:exam_id>/marks", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def list_marks(exam_id):
    query = Marks.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, is_deleted=False
    )
    subject_id = request.args.get("subject_id")
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    class_id = request.args.get("class_id")
    if class_id:
        query = query.filter_by(class_id=class_id)

    user_id = _current_user_uuid()
    if g.role == "teacher" and user_id:
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, user_id)
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, user_id)
        allowed_subject_ids_set = {str(sid) for sid in allowed_subject_ids}
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if not allowed_subject_ids_set and not allowed_class_ids_set:
            return success_response([])
        if class_id and str(class_id) not in allowed_class_ids_set and (
            not subject_id or str(subject_id) not in allowed_subject_ids_set
        ):
            return error_response("Not allowed to view marks for this class", 403)
        query = query.filter(
            db.or_(
                Marks.subject_id.in_(allowed_subject_ids),
                Marks.class_id.in_(allowed_class_ids),
            )
        )
    if class_id and subject_id:
        subject = Subject.query.filter_by(
            id=subject_id,
            school_id=g.school_id,
            is_deleted=False,
        ).first()
        students = (
            Student.query.filter_by(
                school_id=g.school_id,
                class_id=class_id,
                status="active",
                is_deleted=False,
            )
            .order_by(Student.roll_number)
            .all()
        )
        existing = {str(m.student_id): m for m in query.all()}
        return success_response(
            [
                _student_mark_dict(student, existing.get(str(student.id)), subject)
                for student in students
            ]
        )

    items, meta = paginate(query)
    return success_response([_marks_dict(m) for m in items], meta={"pagination": meta})


@exams_bp.route("/<uuid:exam_id>/marks", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin", "teacher")
def submit_marks(exam_id):
    """Bulk submit marks for an exam with NEB auto-grading."""
    data = request.get_json(silent=True) or {}
    records = data.get("marks", [])
    subject_id = data.get("subject_id")
    created_count = 0
    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    allowed_subject_ids = []
    allowed_class_ids = []
    subject_cache = {}
    user_id = _current_user_uuid()
    if g.role == "teacher" and user_id:
        allowed_subject_ids = [
            str(sid) for sid in teacher_allowed_subject_ids(g.school_id, user_id)
        ]
        allowed_class_ids = [
            str(cid) for cid in teacher_allowed_class_ids(g.school_id, user_id)
        ]
        if not allowed_subject_ids and not allowed_class_ids:
            return error_response("Not allowed to submit marks", 403)

    for rec in records:
        sid = rec.get("student_id")
        subj = rec.get("subject_id") or subject_id
        cls_id = rec.get("class_id") or data.get("class_id")

        if not sid or not subj:
            continue

        if g.role == "teacher":
            if (
                str(subj) not in allowed_subject_ids
                and str(cls_id) not in allowed_class_ids
            ):
                continue

        subject_key = str(subj)
        if subject_key not in subject_cache:
            subject_cache[subject_key] = Subject.query.filter_by(
                id=subj,
                school_id=g.school_id,
                is_deleted=False,
            ).first()
        subject = subject_cache[subject_key]

        theory = float(rec.get("theory_marks", rec.get("marks", 0)) or 0)
        practical = float(rec.get("practical_marks", 0) or 0)
        total = theory + practical

        grade_result = _build_subject_grade(
            theory,
            practical,
            subject=subject,
            exam=exam,
            total_full_marks=rec.get("full_marks"),
            total_pass_marks=rec.get("pass_marks"),
            has_practical=(
                bool(getattr(subject, "has_practical", False))
                or bool(getattr(exam, "is_practical", False))
                or practical > 0
            ),
        )
        full_marks = grade_result["total_full_marks"]
        pass_marks = grade_result["total_pass_marks"]

        existing = Marks.query.filter_by(
            school_id=g.school_id,
            exam_id=exam_id,
            student_id=sid,
            subject_id=subj,
            is_deleted=False,
        ).first()

        if existing:
            existing.theory_marks = theory
            existing.practical_marks = practical
            existing.total_marks = total
            existing.obtained_marks = total
            existing.full_marks = full_marks
            existing.pass_marks = pass_marks
            existing.grade = grade_result["grade"]
            existing.gpa = grade_result["gpa"]
            existing.remarks = rec.get("remarks")
            existing.is_absent = rec.get("is_absent", False)
        else:
            marks = Marks(
                school_id=g.school_id,
                exam_id=exam_id,
                student_id=sid,
                subject_id=subj,
                class_id=rec.get("class_id"),
                theory_marks=theory,
                practical_marks=practical,
                total_marks=total,
                obtained_marks=total,
                full_marks=full_marks,
                pass_marks=pass_marks,
                grade=grade_result["grade"],
                gpa=grade_result["gpa"],
                remarks=rec.get("remarks"),
                is_absent=rec.get("is_absent", False),
                entered_by=get_jwt_identity(),
            )
            db.session.add(marks)
            created_count += 1

    db.session.commit()

    from app.plugins.events import emit

    emit("marks.submitted", school_id=str(g.school_id), exam_id=str(exam_id))

    return success_response(
        {
            "total": len(records),
            "new": created_count,
            "updated": len(records) - created_count,
        }
    )


@exams_bp.route("/<uuid:exam_id>/subjects", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_exam_subjects(exam_id):
    exam = Exam.query.filter_by(
        id=exam_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not exam:
        return error_response("Exam not found", 404)

    query = Subject.query.filter_by(school_id=g.school_id, is_deleted=False)
    if exam.subject_ids:
        query = query.filter(Subject.id.in_(exam.subject_ids))
    elif request.args.get("class_id"):
        query = query.filter(Subject.class_ids.any(UUID(request.args["class_id"])))
    if g.role == "teacher" and _current_user_uuid():
        class_id = request.args.get("class_id")
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if class_id and str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to view this class", 403)
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        if not allowed_subject_ids:
            return success_response([])
        query = query.filter(Subject.id.in_(allowed_subject_ids))
    subjects = query.order_by(Subject.name).all()
    return success_response([_subject_dict(subject) for subject in subjects])


# ── Results ────────────────────────────────────────────────


@exams_bp.route("/results", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def list_student_results():
    """Compatibility route for Flutter student results."""
    student_id = request.args.get("student_id")
    student = _resolve_accessible_student(student_id)
    if student_id and not student:
        return error_response("Student not found", 404)
    if not student:
        return success_response([])

    report_cards = (
        ReportCard.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            is_deleted=False,
        )
        .order_by(
            ReportCard.generated_at.desc().nullslast(), ReportCard.created_at.desc()
        )
        .all()
    )

    if report_cards:
        return success_response(
            [_student_result_from_report_card(rc) for rc in report_cards]
        )

    marks = Marks.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        is_deleted=False,
    ).all()
    grouped = {}
    for mark in marks:
        grouped.setdefault(str(mark.exam_id), []).append(mark)
    return success_response(
        [
            _student_result_from_marks(exam_id, grouped_marks)
            for exam_id, grouped_marks in grouped.items()
        ]
    )


@exams_bp.route("/<uuid:exam_id>/results", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_results(exam_id):
    """Compute NEB-graded results for all students in an exam."""
    class_id = request.args.get("class_id")
    if not class_id:
        return error_response("class_id is required", 400)

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to view this class", 403)

    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    # Get all marks for this exam + class
    marks_query = Marks.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, is_deleted=False
    )
    if class_id:
        marks_query = marks_query.filter_by(class_id=class_id)
    all_marks = marks_query.all()

    # Group by student
    student_marks = {}
    for m in all_marks:
        sid = str(m.student_id)
        if sid not in student_marks:
            student_marks[sid] = []
        student_marks[sid].append(m)

    # Build results
    results = []
    for sid, marks_list in student_marks.items():
        student = Student.query.get(sid)
        if not student:
            continue

        subject_grades = []
        for m in marks_list:
            subject = Subject.query.get(m.subject_id)
            sg = _build_subject_grade(
                float(m.theory_marks or 0),
                float(m.practical_marks or 0),
                subject=subject,
                exam=exam,
                total_full_marks=m.full_marks,
                total_pass_marks=m.pass_marks,
                has_practical=(
                    bool(getattr(subject, "has_practical", False))
                    or bool(getattr(exam, "is_practical", False))
                    or float(m.practical_marks or 0) > 0
                ),
            )
            if m.grade is not None:
                sg["grade"] = m.grade
                sg["status"] = "pass" if str(m.grade).upper() != "NG" else "fail"
            if m.gpa is not None:
                sg["gpa"] = float(m.gpa or 0)
            sg["subject_name"] = subject.name if subject else "Unknown"
            sg["subject_id"] = str(m.subject_id)
            subject_grades.append(sg)

        overall = calculate_gpa(subject_grades)
        klass = Class.query.get(student.class_id) if student.class_id else None
        section = Section.query.get(student.section_id) if student.section_id else None

        results.append(
            {
                "student_id": sid,
                "student_name": f"{student.first_name} {student.last_name}",
                "roll_number": student.roll_number,
                "class_name": klass.name if klass else "",
                "section_name": section.name if section else "",
                "total_obtained": overall["total_obtained"],
                "total_marks": overall["total_full"],
                "percentage": overall["percentage"],
                "grade": overall["grade"],
                "gpa": overall["gpa"],
                "status": overall["status"],
                "subjects_failed": overall["subjects_failed"],
                "subject_results": subject_grades,
            }
        )

    # Sort by percentage desc, assign rank
    results.sort(key=lambda r: r["percentage"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return success_response(results)


# ── Grade Sheet (class-wide: all students × all subjects) ──────────────────


@exams_bp.route("/<uuid:exam_id>/grade-sheet", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_grade_sheet(exam_id):
    """Return a class-wide grade sheet matrix: rows=students, cols=subjects."""
    class_id = request.args.get("class_id")
    if not class_id:
        return error_response("class_id is required", 400)

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to view this class", 403)

    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    # All marks for this exam + class
    all_marks = Marks.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, class_id=class_id, is_deleted=False
    ).all()

    # Collect unique subjects (preserve insertion order)
    subjects_seen: dict = {}
    for m in all_marks:
        sid = str(m.subject_id)
        if sid not in subjects_seen:
            subj = Subject.query.get(m.subject_id)
            subjects_seen[sid] = {
                "id": sid,
                "name": subj.name if subj else "Unknown",
                "full_marks": float(m.full_marks or 100),
                "_subject": subj,
            }

    subject_list = list(subjects_seen.values())
    total_full_marks = sum(s["full_marks"] for s in subject_list)

    # Group marks by student
    student_map: dict = {}
    for m in all_marks:
        sid = str(m.student_id)
        if sid not in student_map:
            student_map[sid] = {}
        student_map[sid][str(m.subject_id)] = m

    # Build rows
    rows = []
    students = (
        Student.query.filter_by(
            school_id=g.school_id, class_id=class_id, status="active", is_deleted=False
        )
        .order_by(Student.roll_number)
        .all()
    )

    for student in students:
        sid = str(student.id)
        marks_by_subj = student_map.get(sid, {})

        subject_marks = []
        total_obtained = 0
        failed_subjects = 0

        for subj in subject_list:
            m = marks_by_subj.get(subj["id"])
            subject_model = subj.get("_subject")
            if m:
                obtained = float(m.total_marks or 0)
                grade = m.grade or ""
                gpa_val = float(m.gpa or 0)
                is_pass = _mark_is_pass(m, subject=subject_model, exam=exam)
            else:
                obtained = 0
                grade = ""
                gpa_val = 0
                is_pass = False

            if not is_pass:
                failed_subjects += 1
            total_obtained += obtained
            subject_marks.append(
                {
                    "subject_id": subj["id"],
                    "obtained": obtained,
                    "full_marks": subj["full_marks"],
                    "grade": grade,
                    "gpa": gpa_val,
                    "pass": is_pass,
                    "absent": m is None,
                }
            )

        percentage = (
            round(total_obtained / total_full_marks * 100, 1) if total_full_marks else 0
        )
        from app.utils.nepal_grading import calculate_gpa

        overall_grade = calculate_gpa([])["grade"] if not subject_marks else ""
        status = "fail" if failed_subjects > 0 else "pass"

        rows.append(
            {
                "student_id": sid,
                "student_name": f"{student.first_name} {student.last_name}",
                "roll_number": student.roll_number,
                "subject_marks": subject_marks,
                "total_obtained": total_obtained,
                "total_full": total_full_marks,
                "percentage": percentage,
                "status": status,
                "failed_subjects": failed_subjects,
            }
        )

    # Assign rank
    rows.sort(key=lambda r: r["percentage"], reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i

    klass = Class.query.get(class_id)
    return success_response(
        {
            "exam_id": str(exam_id),
            "exam_name": exam.name,
            "class_id": class_id,
            "class_name": klass.name if klass else "",
            "subjects": subject_list,
            "rows": rows,
            "total_full_marks": total_full_marks,
            "student_count": len(rows),
        }
    )


# ── Individual Student Marksheet ───────────────────────────────────────────


@exams_bp.route("/<uuid:exam_id>/marksheet/<uuid:student_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_student_marksheet(exam_id, student_id):
    """Return detailed marksheet for a single student (subject-by-subject)."""
    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    student = _resolve_accessible_student(student_id)
    if not student or str(student.id) != str(student_id):
        return error_response("Student not found", 404)

    marks_list = Marks.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, student_id=student_id, is_deleted=False
    ).all()

    subject_rows = []
    total_obtained = 0
    total_full = 0

    for m in marks_list:
        subj = Subject.query.get(m.subject_id)
        theory = float(m.theory_marks or 0)
        practical = float(m.practical_marks or 0)
        obtained = float(m.total_marks or theory + practical)
        subject_grade = _build_subject_grade(
            theory,
            practical,
            subject=subj,
            exam=exam,
            total_full_marks=m.full_marks,
            total_pass_marks=m.pass_marks,
            has_practical=(
                bool(getattr(subj, "has_practical", False))
                or bool(getattr(exam, "is_practical", False))
                or practical > 0
            ),
        )
        full = subject_grade["total_full_marks"]
        pass_m = subject_grade["total_pass_marks"]
        grade = m.grade or subject_grade["grade"] or ""
        gpa_val = float(m.gpa if m.gpa is not None else subject_grade["gpa"] or 0)
        is_pass = grade.upper() != "NG" if grade else subject_grade["status"] == "pass"

        total_obtained += obtained
        total_full += full
        subject_rows.append(
            {
                "subject_id": str(m.subject_id),
                "subject_name": subj.name if subj else "Unknown",
                "code": subj.code if subj and hasattr(subj, "code") else "",
                "theory_marks": theory,
                "practical_marks": practical,
                "obtained_marks": obtained,
                "full_marks": full,
                "pass_marks": pass_m,
                "grade": grade,
                "gpa": gpa_val,
                "pass": is_pass,
            }
        )

    percentage = round(total_obtained / total_full * 100, 1) if total_full else 0
    failed = sum(1 for s in subject_rows if not s["pass"])

    klass = Class.query.get(student.class_id) if student.class_id else None
    section = Section.query.get(student.section_id) if student.section_id else None
    school = School.query.get(g.school_id)

    # Check if report card exists for AI remarks
    rc = ReportCard.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, student_id=student_id, is_deleted=False
    ).first()

    return success_response(
        {
            "exam_id": str(exam_id),
            "exam_name": exam.name,
            "student_id": str(student_id),
            "student_name": f"{student.first_name} {student.last_name}",
            "roll_number": student.roll_number,
            "class_name": klass.name if klass else "",
            "section_name": section.name if section else "",
            "school_name": school.name if school else "",
            "subjects": subject_rows,
            "total_obtained": total_obtained,
            "total_full": total_full,
            "percentage": percentage,
            "failed_subjects": failed,
            "status": "fail" if failed else "pass",
            "ai_remarks": rc.ai_remarks if rc else None,
            "rank_in_class": rc.rank_in_class if rc else None,
            "overall_grade": rc.overall_grade if rc else None,
            "overall_gpa": float(rc.overall_gpa) if rc and rc.overall_gpa else None,
        }
    )


# ── Designer Marksheet Integration ─────────────────────────────────────────


@exams_bp.route("/<uuid:exam_id>/designer-marksheet", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin", "teacher")
def generate_designer_marksheets(exam_id):
    """Generate marksheets using the Design Studio template engine.

    Requires both 'exams' and 'design_studio' plugins to be active.
    Returns rendered HTML/canvas for each student.
    """
    from app.plugins.decorators import _school_has_plugin

    if not _school_has_plugin(str(g.school_id), "design_studio"):
        return error_response(
            "design_studio plugin is required for Designer marksheets", 403
        )

    from app.services.designer.bulk_generator import BulkGeneratorService

    data = request.get_json(silent=True) or {}
    class_id = data.get("class_id")
    template_id = data.get("template_id")

    if not class_id:
        return error_response("class_id is required", 400)

    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    marksheets = BulkGeneratorService.generate_bulk_marksheets(
        school_id=str(g.school_id),
        exam_id=str(exam_id),
        class_id=class_id,
        template_id=template_id,
    )
    return success_response(
        {
            "exam_id": str(exam_id),
            "exam_name": exam.name,
            "class_id": class_id,
            "count": len(marksheets),
            "marksheets": marksheets,
        }
    )


# ── Publish Results ────────────────────────────────────────


@exams_bp.route("/<uuid:exam_id>/publish", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin")
def publish_results(exam_id):
    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)
    exam.status = "result_published"
    db.session.commit()

    from app.plugins.events import emit

    emit("results.published", school_id=str(g.school_id), exam_id=str(exam_id))

    return success_response({"message": "Results published", "exam_id": str(exam_id)})


# ── Report Cards ───────────────────────────────────────────


@exams_bp.route("/<uuid:exam_id>/report-cards/<uuid:student_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def get_report_card(exam_id, student_id):
    """Get report card for a student."""
    student = _resolve_accessible_student(student_id)
    if not student or str(student.id) != str(student_id):
        return error_response("Report card not found", 404)

    rc = ReportCard.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, student_id=student_id, is_deleted=False
    ).first()
    if not rc:
        return error_response("Report card not found", 404)
    return success_response(_rc_dict(rc))


@exams_bp.route("/<uuid:exam_id>/report-cards", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
def list_report_cards(exam_id):
    """List all report cards for an exam."""
    class_id = request.args.get("class_id")
    if g.role == "teacher" and _current_user_uuid() and class_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to view this class", 403)
    query = ReportCard.query.filter_by(
        school_id=g.school_id, exam_id=exam_id, is_deleted=False
    )
    # Filter by class via student
    if class_id:
        student_ids = [
            str(s.id)
            for s in Student.query.filter_by(
                school_id=g.school_id, class_id=class_id, status="active"
            ).all()
        ]
        query = query.filter(ReportCard.student_id.in_(student_ids))

    items = query.all()
    result = []
    for rc in items:
        d = _rc_dict(rc)
        student = Student.query.get(rc.student_id)
        if student:
            d["student_name"] = f"{student.first_name} {student.last_name}"
            d["roll_number"] = student.roll_number
        result.append(d)
    return success_response(result)


@exams_bp.route("/<uuid:exam_id>/report-cards", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin")
def generate_report_cards(exam_id):
    """Trigger report card generation for an exam."""
    data = request.get_json(silent=True) or {}
    class_id = data.get("class_id")

    from app.tasks.report_generation import generate_bulk_report_cards

    generate_bulk_report_cards.delay(str(g.school_id), str(exam_id), class_id)

    return success_response(
        {"message": "Report card generation started", "exam_id": str(exam_id)}
    )


@exams_bp.route("/<uuid:exam_id>/report-cards/bulk-pdf", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("exams")
@role_required("school_admin", "teacher")
def bulk_report_cards_pdf(exam_id):
    """Render a single PDF containing all report cards for the selected class."""
    class_id = request.args.get("class_id")
    if not class_id:
        return error_response("class_id is required", 400)

    if g.role == "teacher" and _current_user_uuid():
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return error_response("Not allowed to view this class", 403)

    exam = Exam.query.get(exam_id)
    if not exam or exam.is_deleted or str(exam.school_id) != str(g.school_id):
        return error_response("Exam not found", 404)

    report_cards = ReportCard.query.filter_by(
        school_id=g.school_id,
        exam_id=exam_id,
        is_deleted=False,
    ).all()

    if class_id:
        student_ids = [
            str(s.id)
            for s in Student.query.filter_by(
                school_id=g.school_id, class_id=class_id, status="active"
            ).all()
        ]
        report_cards = [rc for rc in report_cards if str(rc.student_id) in student_ids]

    if not report_cards:
        return error_response("No report cards found", 404)

    school = School.query.get(g.school_id)

    try:
        from weasyprint import HTML
    except ImportError:
        return error_response("PDF export is unavailable on this server", 501)

    pages = []
    for rc in report_cards:
        student = Student.query.get(rc.student_id)
        klass = (
            Class.query.get(student.class_id) if student and student.class_id else None
        )
        student_name = (
            f"{student.first_name} {student.last_name}" if student else "Student"
        )
        pages.append(
            f"""
            <section class='page'>
              <div class='sheet'>
                <header class='hero'>
                                    <div class='school'>{school.name if school else ""}</div>
                  <div class='title'>{exam.name} - Report Card</div>
                </header>
                <div class='grid'>
                  <div><span>Student</span><strong>{student_name}</strong></div>
                  <div><span>Roll No</span><strong>{student.roll_number if student and student.roll_number is not None else "-"}</strong></div>
                  <div><span>Class</span><strong>{klass.name if klass else "-"}</strong></div>
                  <div><span>Percentage</span><strong>{float(rc.total_percentage or 0):.1f}%</strong></div>
                  <div><span>Grade</span><strong>{rc.overall_grade or "-"}</strong></div>
                  <div><span>GPA</span><strong>{float(rc.overall_gpa or 0):.1f}</strong></div>
                </div>
                <div class='remarks'>
                  <h3>AI Remarks</h3>
                  <p>{rc.ai_remarks or "—"}</p>
                </div>
                <div class='signatures'>
                  <div class='sig'>Class Teacher</div>
                  <div class='sig'>Principal</div>
                  <div class='sig'>Guardian</div>
                </div>
              </div>
            </section>
            """
        )

    html = f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'>
<style>
  @page {{ size: A4; margin: 12mm; }}
  body {{ margin: 0; font-family: Arial, sans-serif; background: #f8fafc; }}
  .page {{ page-break-after: always; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 8mm 0; box-sizing: border-box; }}
  .sheet {{ width: 190mm; min-height: 270mm; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16mm; box-sizing: border-box; }}
  .hero {{ text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 16px; }}
  .school {{ font-size: 18px; font-weight: 700; color: #0f172a; }}
  .title {{ font-size: 14px; color: #475569; margin-top: 4px; }}
  .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 16px; margin-bottom: 18px; }}
  .grid div {{ border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; }}
  .grid span {{ display: block; font-size: 10px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .04em; }}
  .grid strong {{ font-size: 14px; color: #0f172a; }}
  .remarks h3 {{ margin: 0 0 8px 0; font-size: 13px; color: #0f172a; }}
  .remarks p {{ margin: 0; min-height: 48px; color: #334155; line-height: 1.5; }}
  .signatures {{ display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; }}
  .sig {{ flex: 1; border-top: 1px solid #334155; text-align: center; padding-top: 6px; font-size: 11px; color: #475569; }}
</style></head><body>{"".join(pages)}</body></html>"""

    try:
        pdf = HTML(string=html).write_pdf()
    except Exception as exc:
        return error_response(f"Failed to generate PDF: {exc}", 500)

    buffer = BytesIO(pdf)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"report_cards_{exam_id}.pdf",
    )


# ── Serializers ────────────────────────────────────────────


def _exam_dict(e):
    return {
        "id": str(e.id),
        "name": e.name,
        "name_nepali": getattr(e, "name_nepali", None),
        "exam_type": getattr(e, "exam_type", None),
        "class_id": str(e.class_id) if e.class_id else None,
        "class_name": e.klass.name if e.klass else None,
        "subject_ids": e.subject_ids or [],
        "start_date": e.start_date_bs
        or (str(e.start_date_ad) if e.start_date_ad else None),
        "end_date": e.end_date_bs or (str(e.end_date_ad) if e.end_date_ad else None),
        "start_date_bs": e.start_date_bs,
        "end_date_bs": e.end_date_bs,
        "total_marks": e.total_marks,
        "pass_marks": e.pass_marks,
        "is_practical": getattr(e, "is_practical", False),
        "practical_marks": getattr(e, "practical_marks", None),
        "status": getattr(e, "status", "scheduled"),
        "description": getattr(e, "description", None),
        "academic_year_id": str(e.academic_year_id) if e.academic_year_id else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _online_exam_dict(exam, include_questions=False):
    data = {
        "id": str(exam.id),
        "title": exam.title,
        "name": exam.title,
        "description": exam.description,
        "class_id": str(exam.class_id) if exam.class_id else None,
        "section_id": str(exam.section_id) if exam.section_id else None,
        "subject_id": str(exam.subject_id) if exam.subject_id else None,
        "subject_name": exam.subject.name if exam.subject else None,
        "duration": exam.duration_minutes,
        "duration_minutes": exam.duration_minutes,
        "total_questions": exam.total_questions,
        "total_marks": exam.total_marks,
        "start_date": exam.start_at.isoformat() if exam.start_at else None,
        "end_date": exam.end_at.isoformat() if exam.end_at else None,
        "status": exam.status,
        "instructions": exam.instructions,
    }
    if include_questions:
        data["questions"] = exam.questions or []
    return data


def _student_mark_dict(student, mark, subject=None):
    config = _resolve_subject_marks_config(
        subject=subject,
        total_full_marks=(mark.full_marks if mark and mark.full_marks is not None else None),
        total_pass_marks=(mark.pass_marks if mark and mark.pass_marks is not None else None),
        has_practical=(
            bool(getattr(subject, "has_practical", False))
            or (_to_float(getattr(mark, "practical_marks", None), 0.0) or 0.0) > 0
        ),
    )
    return {
        "student_id": str(student.id),
        "name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
        "roll_no": student.roll_number or 0,
        "marks": float(mark.total_marks or mark.theory_marks or 0) if mark else None,
        "theory_marks": float(mark.theory_marks or 0) if mark else None,
        "practical_marks": float(mark.practical_marks or 0) if mark else None,
        "full_marks": config["total_full_marks"],
        "pass_marks": config["total_pass_marks"],
        "has_practical": config["has_practical"],
        "theory_full_marks": config["theory_full_marks"],
        "theory_pass_marks": config["theory_pass_marks"],
        "practical_full_marks": config["practical_full_marks"],
        "practical_pass_marks": config["practical_pass_marks"],
        "grade": mark.grade if mark else None,
        "gpa": float(mark.gpa or 0) if mark and mark.gpa is not None else None,
        "remarks": mark.remarks if mark else None,
    }


def _subject_dict(subject):
    config = _resolve_subject_marks_config(
        subject=subject,
        has_practical=bool(getattr(subject, "has_practical", False)),
    )
    return {
        "id": str(subject.id),
        "name": subject.name,
        "code": subject.code,
        "has_practical": bool(getattr(subject, "has_practical", False)),
        "full_marks": subject.full_marks or 100,
        "pass_marks": subject.pass_marks or 32,
        "practical_full_marks": getattr(subject, "practical_full_marks", None),
        "practical_pass_marks": getattr(subject, "practical_pass_marks", None),
        "total_full_marks": config["total_full_marks"],
        "total_pass_marks": config["total_pass_marks"],
    }


def _student_result_from_report_card(rc):
    exam = Exam.query.get(rc.exam_id)
    marks = Marks.query.filter_by(
        school_id=rc.school_id,
        student_id=rc.student_id,
        exam_id=rc.exam_id,
        is_deleted=False,
    ).all()
    return {
        "id": str(rc.id),
        "exam_id": str(rc.exam_id),
        "exam_name": exam.name if exam else "Exam Result",
        "total_marks": float(rc.total_marks or 0),
        "percentage": float(rc.total_percentage or rc.percentage or 0),
        "grade": rc.overall_grade or "N/A",
        "gpa": float(rc.overall_gpa or 0),
        "rank": rc.rank_in_class,
        "remarks": rc.teacher_remarks or rc.principal_remarks or rc.ai_remarks,
        "subjects": [_subject_result_dict(mark) for mark in marks],
    }


def _student_result_from_marks(exam_id, marks):
    exam = Exam.query.get(exam_id)
    total_obtained = sum(float(m.total_marks or 0) for m in marks)
    total_full = sum(float(m.full_marks or 100) for m in marks)
    percentage = round(total_obtained / total_full * 100, 2) if total_full else 0
    gpa = round(sum(float(m.gpa or 0) for m in marks) / len(marks), 2) if marks else 0
    grade = marks[0].grade if marks and marks[0].grade else "N/A"
    return {
        "id": str(exam_id),
        "exam_id": str(exam_id),
        "exam_name": exam.name if exam else "Exam Result",
        "total_marks": total_full,
        "marks_obtained": total_obtained,
        "percentage": percentage,
        "grade": grade,
        "gpa": gpa,
        "subjects": [_subject_result_dict(mark) for mark in marks],
    }


def _subject_result_dict(mark):
    subject = Subject.query.get(mark.subject_id)
    return {
        "subject": subject.name if subject else "Subject",
        "subject_id": str(mark.subject_id),
        "obtained": float(mark.total_marks or mark.theory_marks or 0),
        "full_marks": float(mark.full_marks or 100),
        "grade": mark.grade or "N/A",
    }


def _marks_dict(m):
    return {
        "id": str(m.id),
        "student_id": str(m.student_id),
        "subject_id": str(m.subject_id),
        "class_id": str(m.class_id) if m.class_id else None,
        "theory_marks": float(m.theory_marks) if m.theory_marks else 0,
        "practical_marks": float(m.practical_marks) if m.practical_marks else 0,
        "total_marks": float(m.total_marks) if m.total_marks else 0,
        "full_marks": float(m.full_marks) if m.full_marks else None,
        "pass_marks": float(m.pass_marks) if m.pass_marks else None,
        "grade": m.grade,
        "gpa": float(m.gpa) if m.gpa else None,
        "is_absent": getattr(m, "is_absent", False),
        "remarks": m.remarks,
    }


def _current_student():
    user_id = _current_user_uuid()
    if not user_id:
        return None
    return Student.query.filter_by(
        school_id=g.school_id,
        user_id=user_id,
        is_deleted=False,
    ).first()


def _resolve_accessible_student(student_id=None):
    requested_student_id = _coerce_uuid(student_id) if student_id else None
    if student_id and not requested_student_id:
        return None

    role = getattr(g, "role", None)
    if role == "teacher":
        if not requested_student_id:
            return None
        student = Student.query.filter_by(
            id=requested_student_id,
            school_id=g.school_id,
            is_deleted=False,
        ).first()
        if not student:
            return None
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids}
        if not allowed_class_ids_set or str(student.class_id) not in allowed_class_ids_set:
            return None
        return student
    if role == "student":
        student = _current_student()
        if not student:
            return None
        if requested_student_id and student.id != requested_student_id:
            return None
        return student

    if role == "parent":
        user_id = _current_user_uuid()
        if not user_id:
            return None

        query = Student.query.join(Guardian, Guardian.student_id == Student.id).filter(
            Student.school_id == g.school_id,
            Student.is_deleted.is_(False),
            Guardian.school_id == g.school_id,
            Guardian.user_id == user_id,
            Guardian.is_deleted.is_(False),
        )
        if requested_student_id:
            query = query.filter(Student.id == requested_student_id)
        return query.order_by(Student.first_name, Student.last_name).first()

    if requested_student_id:
        return Student.query.filter_by(
            id=requested_student_id,
            school_id=g.school_id,
            is_deleted=False,
        ).first()

    return _current_student()


def _coerce_uuid(value):
    if isinstance(value, UUID):
        return value
    if not value:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _sum_question_marks(questions):
    return sum(int(question.get("marks", 1) or 1) for question in questions)


def _score_online_exam(questions, answers):
    score = 0
    for question in questions:
        question_id = str(question.get("id") or "")
        expected = question.get("correct_answer") or question.get("correct_answers")
        if expected is None:
            continue
        given = answers.get(question_id)
        expected_values = expected if isinstance(expected, list) else [expected]
        given_values = given if isinstance(given, list) else [given]
        if {str(v) for v in expected_values} == {str(v) for v in given_values}:
            score += int(question.get("marks", 1) or 1)
    return score


def _rc_dict(rc):
    return {
        "id": str(rc.id),
        "student_id": str(rc.student_id),
        "exam_id": str(rc.exam_id),
        "total_marks": float(rc.total_marks) if rc.total_marks else None,
        "total_percentage": float(rc.total_percentage) if rc.total_percentage else None,
        "percentage": float(rc.total_percentage) if rc.total_percentage else None,
        "overall_grade": rc.overall_grade,
        "grade": rc.overall_grade,
        "overall_gpa": float(rc.overall_gpa) if rc.overall_gpa else None,
        "rank_in_class": rc.rank_in_class,
        "rank": rc.rank_in_class,
        "ai_remarks": rc.ai_remarks,
        "pdf_url": rc.pdf_url,
        "generated_at": rc.generated_at.isoformat() if rc.generated_at else None,
        "attendance_percentage": float(rc.attendance_percentage)
        if rc.attendance_percentage
        else None,
    }


def _current_user_uuid():
    value = getattr(g, "user_id", None)
    if isinstance(value, UUID):
        return value
    if not value:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None
