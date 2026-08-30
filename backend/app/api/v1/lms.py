"""LMS API — courses, lessons, quizzes, progress tracking."""
from datetime import UTC, datetime

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.lms import (
    Course,
    Enrollment,
    Lesson,
    Quiz,
    QuizAttempt,
    StudentProgress,
    StudyMaterial,
    Topic,
)
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

lms_bp = Blueprint("lms", __name__, url_prefix="/lms")


# ── Courses ───────────────────────────────────────────────

@lms_bp.route("/courses", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def list_courses():
    query = Course.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(Course.created_at.desc())
    items, meta = paginate(query)
    return success_response([_course_dict(c) for c in items], meta={"pagination": meta})


@lms_bp.route("/courses", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def create_course():
    data = request.get_json(silent=True) or {}
    user_id = _current_user_id()
    course = Course(school_id=g.school_id, instructor_id=user_id, teacher_id=user_id)
    for key in ("title", "description", "class_id", "subject_id", "thumbnail_url", "status", "is_published"):
        if key in data:
            setattr(course, key, data[key])
    if course.status == "published":
        course.is_published = True
    db.session.add(course)
    db.session.commit()
    return created_response(_course_dict(course))


@lms_bp.route("/courses/<course_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def get_course(course_id):
    course = Course.query.filter_by(id=course_id, school_id=g.school_id).first_or_404()
    data = _course_dict(course)
    data["lessons"] = [_lesson_dict(l) for l in
                       Lesson.query.filter_by(course_id=course_id, is_deleted=False).order_by(Lesson.sort_order).all()]
    return success_response(data)


# ── Lessons ───────────────────────────────────────────────

@lms_bp.route("/courses/<course_id>/lessons", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def create_lesson(course_id):
    data = request.get_json(silent=True) or {}
    course = Course.query.filter_by(
        id=course_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not course:
        return error_response("Course not found", 404)
    if not (data.get("title") or data.get("name")):
        return error_response("title is required", 400)
    lesson = Lesson(school_id=g.school_id, course_id=course.id)
    for key in ("title", "content", "content_type", "video_url", "file_url", "sort_order", "duration_minutes"):
        if key in data:
            setattr(lesson, key, data[key])
    db.session.add(lesson)
    db.session.commit()
    return created_response(_lesson_dict(lesson))


@lms_bp.route("/lessons", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def list_lessons():
    """Compatibility route for Flutter: list lessons by class/subject/section."""
    query = Lesson.query.join(Course).filter(
        Course.school_id == g.school_id,
        Lesson.school_id == g.school_id,
        Lesson.is_deleted.is_(False),
        Course.is_deleted.is_(False),
    )
    class_id = request.args.get("class_id")
    subject_id = request.args.get("subject_id")
    if class_id:
        query = query.filter(Course.class_id == class_id)
    if subject_id:
        query = query.filter(Course.subject_id == subject_id)
    lessons = query.order_by(Lesson.sort_order, Lesson.created_at).all()
    return success_response([_lesson_dict(lesson, include_children=True) for lesson in lessons])


@lms_bp.route("/lessons", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def create_lesson_compat():
    """Create a lesson from Flutter's class/subject-oriented workflow."""
    data = request.get_json(silent=True) or {}
    course = _find_or_create_course(data)
    lesson = Lesson(
        school_id=g.school_id,
        course_id=course.id,
        title=data.get("name") or data.get("title") or "Untitled Lesson",
        content=data.get("description") or data.get("content"),
        content_type=data.get("content_type", "text"),
        sort_order=data.get("sort_order", 0),
        duration_minutes=data.get("duration_minutes"),
    )
    db.session.add(lesson)
    db.session.commit()
    return created_response(_lesson_dict(lesson, include_children=True))


@lms_bp.route("/lessons/<lesson_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def update_lesson(lesson_id):
    lesson = Lesson.query.filter_by(
        id=lesson_id, school_id=g.school_id, is_deleted=False
    ).first_or_404()
    data = request.get_json(silent=True) or {}
    for key in ("title", "content", "content_type", "video_url", "file_url", "sort_order", "duration_minutes"):
        if key in data:
            setattr(lesson, key, data[key])
    db.session.commit()
    return success_response(_lesson_dict(lesson))


# ── Topics & Study Materials ───────────────────────────────


@lms_bp.route("/topics", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def list_topics():
    lesson_id = request.args.get("lesson_id")
    query = Topic.query.filter_by(school_id=g.school_id, is_deleted=False)
    if lesson_id:
        query = query.filter_by(lesson_id=lesson_id)
    topics = query.order_by(Topic.sort_order, Topic.created_at).all()
    return success_response([_topic_dict(topic, include_materials=True) for topic in topics])


@lms_bp.route("/topics", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def create_topic():
    data = request.get_json(silent=True) or {}
    if not data.get("lesson_id"):
        return error_response("lesson_id is required", 400)
    topic = Topic(
        school_id=g.school_id,
        lesson_id=data["lesson_id"],
        title=data.get("name") or data.get("title") or "Untitled Topic",
        description=data.get("description"),
        sort_order=data.get("sort_order", 0),
    )
    db.session.add(topic)
    db.session.commit()
    return created_response(_topic_dict(topic, include_materials=True))


@lms_bp.route("/materials", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def list_study_materials():
    topic_id = request.args.get("topic_id")
    lesson_id = request.args.get("lesson_id")
    query = StudyMaterial.query.filter_by(school_id=g.school_id, is_deleted=False)
    if topic_id:
        query = query.filter_by(topic_id=topic_id)
    if lesson_id:
        query = query.filter_by(lesson_id=lesson_id)
    materials = query.order_by(StudyMaterial.sort_order, StudyMaterial.created_at).all()
    return success_response([_material_dict(material) for material in materials])


@lms_bp.route("/materials", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def create_study_material():
    data = request.get_json(silent=True) or {}
    if not data.get("topic_id") and not data.get("lesson_id"):
        return error_response("topic_id or lesson_id is required", 400)
    material = StudyMaterial(
        school_id=g.school_id,
        topic_id=data.get("topic_id"),
        lesson_id=data.get("lesson_id"),
        title=data.get("name") or data.get("title") or data.get("file_name") or "Study Material",
        description=data.get("description"),
        material_type=data.get("type") or data.get("material_type", "file"),
        file_url=data.get("file_url") or data.get("url") or "",
        thumbnail_url=data.get("thumbnail_url"),
        sort_order=data.get("sort_order", 0),
    )
    db.session.add(material)
    db.session.commit()
    return created_response(_material_dict(material))


# ── Quizzes ───────────────────────────────────────────────

@lms_bp.route("/courses/<course_id>/quizzes", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def list_quizzes(course_id):
    quizzes = Quiz.query.filter_by(
        course_id=course_id, school_id=g.school_id
    ).order_by(Quiz.sort_order).all()
    return success_response([_quiz_dict(q) for q in quizzes])


@lms_bp.route("/courses/<course_id>/quizzes", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
@role_required("superadmin", "school_admin", "teacher")
def create_quiz(course_id):
    data = request.get_json(silent=True) or {}
    quiz = Quiz(school_id=g.school_id, course_id=course_id)
    for key in ("title", "questions", "total_marks", "time_limit_minutes", "sort_order"):
        if key in data:
            setattr(quiz, key, data[key])
    db.session.add(quiz)
    db.session.commit()
    return created_response(_quiz_dict(quiz))


@lms_bp.route("/quizzes/<quiz_id>/attempt", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
def submit_quiz_attempt(quiz_id):
    quiz = Quiz.query.filter_by(
        id=quiz_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not quiz:
        return error_response("Quiz not found", 404)
    data = request.get_json(silent=True) or {}
    attempt = QuizAttempt(
        school_id=g.school_id,
        quiz_id=quiz.id,
        student_id=_current_user_id(),
        answers=data.get("answers", {}),
        score=data.get("score"),
    )
    db.session.add(attempt)
    db.session.commit()
    return created_response(_attempt_dict(attempt))


# ── Enrollment & Progress ─────────────────────────────────

@lms_bp.route("/courses/<course_id>/enroll", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
def enroll_student(course_id):
    data = request.get_json(silent=True) or {}
    course = Course.query.filter_by(
        id=course_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not course:
        return error_response("Course not found", 404)
    student_id = data.get("student_id", _current_user_id())

    from app.models.user import User

    if not student_id or not User.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first():
        return error_response("student_id does not match a user at this school", 400)

    existing = Enrollment.query.filter_by(
        course_id=course.id, student_id=student_id, school_id=g.school_id
    ).first()
    if existing:
        return error_response("Already enrolled", 409)

    enrollment = Enrollment(course_id=course.id, student_id=student_id)
    enrollment.school_id = g.school_id
    db.session.add(enrollment)
    db.session.commit()
    return created_response({"course_id": course_id, "student_id": student_id, "status": "enrolled"})


@lms_bp.route("/courses/<course_id>/progress", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("lms")
def get_progress(course_id):
    student_id = request.args.get("student_id", _current_user_id())
    enrollment = Enrollment.query.filter_by(
        course_id=course_id, student_id=student_id, school_id=g.school_id
    ).first()
    if not enrollment:
        return error_response("Not enrolled", 404)

    return success_response({
        "course_id": course_id,
        "student_id": student_id,
        "progress_percentage": enrollment.progress_percentage or 0,
        "completed_lessons": enrollment.completed_lessons or [],
    })


@lms_bp.route("/courses/<course_id>/progress", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
def record_progress(course_id):
    """Mark lesson progress for a student.

    Students self-report; admins/teachers may pass student_id (a user id) to
    record on behalf of a student. Upserts StudentProgress (the row type the
    student dashboard reads) and re-derives the Enrollment aggregates so both
    read paths stay consistent.
    """
    data = request.get_json(silent=True) or {}
    from app.models.student import Student
    from app.models.user import User

    course = Course.query.filter_by(
        id=course_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not course:
        return error_response("Course not found", 404)

    user_id = data.get("student_id", _current_user_id())
    user = User.query.filter_by(id=user_id, school_id=g.school_id, is_deleted=False).first()
    if not user:
        return error_response("student_id does not match a user at this school", 400)

    student = Student.query.filter_by(
        user_id=user.id, school_id=g.school_id, is_deleted=False
    ).first()
    if not student:
        return error_response("No student profile found for this user", 400)

    lesson_id = data.get("lesson_id")
    if lesson_id:
        lesson = Lesson.query.filter_by(
            id=lesson_id, course_id=course.id, school_id=g.school_id, is_deleted=False
        ).first()
        if not lesson:
            return error_response("Lesson not found in this course", 400)

    completed = bool(data.get("completed", True))
    now = datetime.now(UTC)

    row = StudentProgress.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        course_id=course.id,
        lesson_id=lesson_id,
        is_deleted=False,
    ).first()
    if not row:
        row = StudentProgress(
            school_id=g.school_id,
            student_id=student.id,
            course_id=course.id,
            lesson_id=lesson_id,
        )
        db.session.add(row)
    row.completed = completed
    if completed:
        row.completed_at = now
    else:
        row.completed_at = None
    if data.get("watch_time_mins") is not None:
        row.watch_time_mins = int(data["watch_time_mins"])
    if data.get("last_position_secs") is not None:
        row.last_position_secs = int(data["last_position_secs"])
    if data.get("progress_pct") is not None:
        row.progress_pct = float(data["progress_pct"])

    # Re-derive enrollment aggregates from actual lesson rows.
    total_lessons = Lesson.query.filter_by(
        course_id=course.id, school_id=g.school_id, is_deleted=False
    ).count()
    completed_ids = [
        str(p.lesson_id)
        for p in StudentProgress.query.filter_by(
            school_id=g.school_id,
            student_id=student.id,
            course_id=course.id,
            completed=True,
            is_deleted=False,
        ).all()
        if p.lesson_id
    ]
    completed_ids = list(dict.fromkeys(completed_ids))
    pct = round(len(completed_ids) / total_lessons * 100, 1) if total_lessons else 0

    enrollment = Enrollment.query.filter_by(
        course_id=course.id, student_id=user.id, school_id=g.school_id
    ).first()
    if enrollment:
        enrollment.completed_lessons = completed_ids
        enrollment.progress_percentage = pct

    db.session.commit()
    return success_response({
        "course_id": course_id,
        "student_id": user.id,
        "lesson_id": lesson_id,
        "completed": completed,
        "progress_percentage": pct,
        "completed_lessons": completed_ids,
        "total_lessons": total_lessons,
    })


def _find_or_create_course(data):
    class_id = data.get("class_id")
    subject_id = data.get("subject_id")
    course = Course.query.filter_by(
        school_id=g.school_id,
        class_id=class_id,
        subject_id=subject_id,
        is_deleted=False,
    ).first()
    if course:
        return course

    user_id = _current_user_id()
    course = Course(
        school_id=g.school_id,
        teacher_id=user_id,
        instructor_id=user_id,
        class_id=class_id,
        subject_id=subject_id,
        title=data.get("course_title") or data.get("subject_name") or "Course",
        description=data.get("course_description"),
        status="published",
        is_published=True,
    )
    db.session.add(course)
    db.session.flush()
    return course


def _current_user_id():
    return getattr(g, "user_id", None)


def _course_dict(c):
    return {
        "id": str(c.id), "title": c.title, "description": c.description,
        "instructor_id": str(c.instructor_id) if c.instructor_id else None,
        "teacher_id": str(c.teacher_id) if c.teacher_id else None,
        "class_id": str(c.class_id) if c.class_id else None,
        "subject_id": str(c.subject_id) if c.subject_id else None,
        "status": c.status,
        "thumbnail_url": c.thumbnail_url if hasattr(c, "thumbnail_url") else None,
    }


def _lesson_dict(l, include_children=False):
    data = {
        "id": str(l.id),
        "name": l.title,
        "title": l.title,
        "description": l.content,
        "content": l.content,
        "content_type": l.content_type,
        "course_id": str(l.course_id),
        "class_id": str(l.course.class_id) if l.course and l.course.class_id else None,
        "subject_id": str(l.course.subject_id) if l.course and l.course.subject_id else None,
        "sort_order": l.sort_order,
        "duration_minutes": l.duration_minutes if hasattr(l, "duration_minutes") else None,
    }
    if include_children:
        data["topics"] = [_topic_dict(topic, include_materials=True) for topic in l.topics if not topic.is_deleted]
        data["study_materials"] = [_material_dict(material) for material in l.study_materials if not material.is_deleted]
    return data


def _topic_dict(t, include_materials=False):
    data = {
        "id": str(t.id),
        "lesson_id": str(t.lesson_id),
        "name": t.title,
        "title": t.title,
        "description": t.description,
        "sort_order": t.sort_order,
    }
    if include_materials:
        data["study_materials"] = [_material_dict(material) for material in t.study_materials if not material.is_deleted]
    return data


def _material_dict(m):
    return {
        "id": str(m.id),
        "name": m.title,
        "title": m.title,
        "description": m.description,
        "type": m.material_type,
        "material_type": m.material_type,
        "file_url": m.file_url,
        "url": m.file_url,
        "thumbnail_url": m.thumbnail_url,
        "topic_id": str(m.topic_id) if m.topic_id else None,
        "lesson_id": str(m.lesson_id) if m.lesson_id else None,
        "sort_order": m.sort_order,
    }


def _quiz_dict(q):
    return {
        "id": str(q.id),
        "course_id": str(q.course_id) if q.course_id else None,
        "title": q.title,
        "questions": q.questions or [],
        "total_marks": q.total_marks,
        "time_limit_minutes": q.time_limit_minutes if hasattr(q, "time_limit_minutes") else None,
    }


def _attempt_dict(a):
    return {
        "id": str(a.id),
        "quiz_id": str(a.quiz_id) if a.quiz_id else None,
        "student_id": str(a.student_id) if a.student_id else None,
        "score": a.score,
        "submitted_at": str(a.created_at) if hasattr(a, "created_at") else None,
    }
