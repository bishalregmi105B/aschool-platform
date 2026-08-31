"""AI Adaptive Learning API — personalized learning paths + mastery records
(premium plugin, NPR 1499).

E21: the plugin was published/sold with a working service layer
(app.services.ai.adaptive_learning) but zero API routes — the web pages
(`frontend/app/dashboard/ai-tools/{learning-paths,progress}/page.tsx`) called
`/lms/learning-paths*` and `/lms/adaptive-progress`, which 404'd.

Routes (mounted under /api/v1, all gated @plugin_required("ai_adaptive_learning"),
tenant-scoped to g.school_id):
  GET  /lms/learning-paths               list paths (?search, ?student_id, ?class_name)
  POST /lms/learning-paths               manual create (teacher dialog)
  POST /lms/learning-paths/generate-ai   generate/regenerate for ONE student
  GET  /lms/mastery                      mastery records (?student_id, ?subject)
  PUT  /lms/mastery/<record_id>          teacher override (mastery_level, notes)
  POST /lms/mastery/assess               compute mastery from real Marks (service)
  GET  /lms/adaptive-progress            per-student progress rows (progress page)

LLM honesty: generate-ai routes through AITokenHub via
AdaptiveLearningAI.recommend_path (quota enforced — QuotaExceededError bubbles
to the global 429 handler). When no AI provider is configured, the provider
errors, or the LLM returns unparseable output, the endpoint falls back to a
DETERMINISTIC rule-based path computed from the student's real marks and
labels it `source="rule_based_fallback"` — it never fabricates LLM output.
"""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func, or_

from app.models.academic import Class, Subject
from app.models.adaptive_learning import LearningPath, MasteryRecord
from app.models.exam import Marks
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.services.ai.adaptive_learning import AdaptiveLearningAI
from app.services.ai.token_hub import QuotaExceededError
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

adaptive_learning_bp = Blueprint(
    "adaptive_learning", __name__, url_prefix="/lms"
)

DIFFICULTIES = ("easy", "medium", "hard", "adaptive")
MASTERY_LEVELS = ("beginner", "intermediate", "advanced")
# Same thresholds AdaptiveLearningAI.assess_mastery uses.
ADVANCED_AT = 80
INTERMEDIATE_AT = 60
MAX_STEPS = 6


# ── Helpers ───────────────────────────────────────────────────────────────

def _student_in_school(student_id):
    """Fetch a live student of the requesting school, or None."""
    try:
        return (
            Student.query.filter_by(
                id=student_id, school_id=g.school_id, is_deleted=False
            ).first()
        )
    except Exception:
        return None


def _student_class_name(student):
    if student.class_id:
        klass = db.session.get(Class, student.class_id)
        if klass:
            return klass.name
    return None


def _per_subject_scores(student_id):
    """[(subject_name, avg_score, n_marks)] from real Marks rows
    (NULL obtained_marks counts as 0 — same rule as the service)."""
    rows = (
        db.session.query(
            Subject.name,
            func.avg(func.coalesce(Marks.obtained_marks, 0)),
            func.count(Marks.id),
        )
        .join(Subject, Subject.id == Marks.subject_id)
        .filter(
            Marks.student_id == student_id,
            Marks.is_deleted.is_(False),
        )
        .group_by(Subject.name)
        .order_by(func.avg(func.coalesce(Marks.obtained_marks, 0)).asc())
        .all()
    )
    return [(name, float(avg or 0), int(n)) for name, avg, n in rows]


def _level_from_avg(avg):
    if avg is None:
        return None
    if avg >= ADVANCED_AT:
        return "advanced"
    if avg >= INTERMEDIATE_AT:
        return "intermediate"
    return "beginner"


def _build_student_data(student, scores):
    """Real performance profile fed to the LLM / rule-based generator."""
    return {
        "name": f"{student.first_name} {student.last_name}",
        "strengths": [n for n, avg, _ in scores if avg >= INTERMEDIATE_AT] or None,
        "weaknesses": [n for n, avg, _ in scores if avg < INTERMEDIATE_AT] or None,
        "scores": {n: round(avg, 1) for n, avg, _ in scores},
        "learning_style": "visual",
    }


def _rule_based_path(student_data, subject_filter=None):
    """Deterministic, honestly-labeled fallback (NOT LLM output).

    Topics/steps are derived from the student's real weakest subjects; with no
    marks at all the path is a generic starter plan (stated as such).
    """
    scores = student_data.get("scores") or {}
    if subject_filter:
        scores = {
            n: avg for n, avg in scores.items()
            if n.lower() == subject_filter.strip().lower()
        }
    level = _level_from_avg(
        round(sum(scores.values()) / len(scores), 1) if scores else None
    )

    weak = sorted(scores.items(), key=lambda kv: kv[1])[:MAX_STEPS]
    if weak:
        topics = [name for name, avg in weak]
        # Only genuinely weak subjects get "targeted revision"; strong ones
        # get advancement work — no mislabeled focus areas.
        focus = [
            f"{name}: avg {avg:.0f}% — "
            + ("targeted revision" if avg < INTERMEDIATE_AT else "extension work")
            for name, avg in weak[:3]
        ]
        intro = "Built from the student's real exam marks (weakest subjects first)."
    else:
        topics = [subject_filter] if subject_filter else ["Core subjects"]
        focus = ["No assessment data yet — start with a diagnostic quiz"]
        intro = "No exam marks found for this student yet; generic starter plan."

    difficulty = {"beginner": "easy", "intermediate": "medium", "advanced": "hard"}.get(
        level, "adaptive"
    )
    return {
        "recommended_topics": topics,
        "difficulty_level": difficulty,
        "focus_areas": focus,
        "resources": ["Textbook revision exercises", "Practice worksheets"],
        "estimated_hours": 8 if weak else 4,
        "_note": intro,
    }


def _steps_from_topics(topics, subject, known_subjects=None):
    """Turn topics into pending steps. When no single subject was requested
    but a topic IS a subject name (rule-based paths), tag it as such so the
    per-subject steps are real, not null-tagged."""
    known = {str(s).lower() for s in (known_subjects or [])}
    steps = []
    for i, topic in enumerate(topics[:MAX_STEPS]):
        step_subject = subject
        if step_subject is None and str(topic).lower() in known:
            step_subject = str(topic)
        steps.append(
            {
                "title": str(topic)[:200],
                "subject": step_subject,
                "description": f"Work through {topic} with practice and review.",
                "status": "pending",
                "order": i + 1,
            }
        )
    return steps


def _upsert_mastery(student, subject_name, assessment, source="computed"):
    """Create/update one MasteryRecord from assess_mastery output."""
    record = MasteryRecord.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        subject=subject_name,
        is_deleted=False,
    ).first()
    if record is None:
        record = MasteryRecord(
            school_id=g.school_id,
            student_id=student.id,
            subject=subject_name,
        )
        db.session.add(record)
    record.mastery_level = assessment.get("mastery_level", "beginner")
    record.avg_score = float(assessment.get("avg_score", 0.0))
    record.total_assessments = int(assessment.get("total_assessments", 0))
    record.source = source
    return record


def _assess_and_store(student, subject_name):
    """Run the REAL service for one (student, subject) and persist it."""
    assessment = AdaptiveLearningAI.assess_mastery(
        str(student.id), subject_name, school_id=str(g.school_id)
    )
    return _upsert_mastery(student, subject_name, assessment)


# ── Learning paths ────────────────────────────────────────────────────────

@adaptive_learning_bp.route("/learning-paths", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def list_learning_paths():
    """Learning paths for this school (?search, ?student_id, ?class_name)."""
    query = LearningPath.query.filter_by(school_id=g.school_id, is_deleted=False)

    student_id = (request.args.get("student_id") or "").strip()
    if student_id:
        query = query.filter_by(student_id=student_id)
    class_name = (request.args.get("class_name") or "").strip()
    if class_name:
        query = query.filter_by(class_name=class_name)
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(LearningPath.title.ilike(like), LearningPath.subject.ilike(like))
        )

    paths = query.order_by(LearningPath.created_at.desc()).all()
    return success_response(
        {
            "items": [p.to_dict() for p in paths],
            "stats": {
                "total": len(paths),
                "active": sum(1 for p in paths if p.is_active),
            },
        }
    )


@adaptive_learning_bp.route("/learning-paths", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def create_learning_path():
    """Manual path creation (teacher dialog). No steps are invented — a
    manually created path starts with an empty step list."""
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return error_response("title is required", 400)

    difficulty = data.get("difficulty") or "adaptive"
    if difficulty not in DIFFICULTIES:
        return error_response(f"difficulty must be one of {', '.join(DIFFICULTIES)}", 400)

    student_id = (data.get("student_id") or "").strip() or None
    student = None
    if student_id:
        student = _student_in_school(student_id)
        if student is None:
            return error_response("Student not found in your school", 404)

    path = LearningPath(
        school_id=g.school_id,
        student_id=student.id if student else None,
        class_name=(data.get("class_name") or "").strip() or None,
        title=title,
        subject=(data.get("subject") or "").strip() or None,
        difficulty=difficulty,
        description=(data.get("description") or "").strip() or None,
        steps=[],
        recommended_topics=[],
        focus_areas=[],
        resources=[],
        source="manual",
    )
    db.session.add(path)
    db.session.commit()
    return created_response(path.to_dict())


@adaptive_learning_bp.route("/learning-paths/generate-ai", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def generate_learning_path():
    """Generate (or regenerate) a learning path for ONE student.

    LLM route: AdaptiveLearningAI.recommend_path → AITokenHub (quota enforced;
    QuotaExceededError bubbles to the global 429 handler). Honest fallback:
    if no provider is configured, the provider errors, or the LLM output is
    unparseable/empty, a deterministic rule-based path built from the
    student's real marks is stored with source="rule_based_fallback".
    """
    data = request.get_json(silent=True) or {}
    student_id = (data.get("student_id") or "").strip()
    if not student_id:
        return error_response("student_id is required", 400)

    student = _student_in_school(student_id)
    if student is None:
        return error_response("Student not found in your school", 404)

    subject = (data.get("subject") or "").strip() or None
    scores = _per_subject_scores(student.id)
    student_data = _build_student_data(student, scores)

    llm_error = None
    rec = None
    try:
        rec = AdaptiveLearningAI.recommend_path(
            student_data, school_id=str(g.school_id)
        )
        if not (isinstance(rec, dict) and rec.get("recommended_topics")):
            llm_error = "LLM returned unparseable or empty recommendation"
            rec = None
    except QuotaExceededError:
        raise  # global handler → 429 with quota payload
    except Exception as exc:  # no provider configured / provider error
        llm_error = str(exc)
        rec = None

    if rec is not None:
        source = "ai"
        source_note = None
    else:
        rec = _rule_based_path(student_data, subject)
        source = "rule_based_fallback"
        source_note = (
            f"Deterministic rule-based path — LLM unavailable"
            f" ({llm_error or 'no AI provider configured'})."
        )[:255]

    difficulty = data.get("difficulty")
    if difficulty not in DIFFICULTIES:
        raw = rec.get("difficulty_level")
        # LLM mastery-style levels → path enum; rule-based fallback already
        # returns a valid enum value.
        difficulty = raw if raw in DIFFICULTIES else {
            "beginner": "easy", "intermediate": "medium", "advanced": "hard",
        }.get(raw)
    if difficulty not in DIFFICULTIES:
        difficulty = "adaptive"

    topics = list(rec.get("recommended_topics") or [])
    class_name = _student_class_name(student)
    display_name = student_data["name"]

    # Regenerate semantics: any previous ACTIVE path for the same
    # student (+subject when scoped) is deactivated; history is kept.
    prev_query = LearningPath.query.filter_by(
        school_id=g.school_id,
        student_id=student.id,
        is_active=True,
        is_deleted=False,
    )
    if subject:
        prev_query = prev_query.filter_by(subject=subject)
    for prev in prev_query.all():
        prev.is_active = False

    path = LearningPath(
        school_id=g.school_id,
        student_id=student.id,
        class_name=class_name,
        title=data.get("title", "").strip()
        or f"{subject or 'Personalized'} Learning Path — {display_name}",
        subject=subject,
        difficulty=difficulty,
        description=(data.get("description") or "").strip() or rec.get("_note"),
        steps=_steps_from_topics(
            topics, subject, known_subjects=list(student_data.get("scores") or {})
        ),
        recommended_topics=topics,
        focus_areas=list(rec.get("focus_areas") or []),
        resources=list(rec.get("resources") or []),
        estimated_hours=int(rec.get("estimated_hours") or 0) or None,
        source=source,
        source_note=source_note,
    )
    db.session.add(path)

    # Persist mastery from the real assess_mastery service (no LLM, no quota).
    try:
        if subject:
            _assess_and_store(student, subject)
        else:
            for name, _avg, _n in scores:
                _assess_and_store(student, name)
    except Exception as exc:
        db.session.rollback()
        return error_response(f"Failed to persist mastery: {exc}", 500)

    db.session.commit()
    return created_response(path.to_dict())


# ── Mastery records ───────────────────────────────────────────────────────

@adaptive_learning_bp.route("/mastery", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def list_mastery():
    """Mastery records for this school (?student_id, ?subject)."""
    query = MasteryRecord.query.filter_by(school_id=g.school_id, is_deleted=False)
    student_id = (request.args.get("student_id") or "").strip()
    if student_id:
        query = query.filter_by(student_id=student_id)
    subject = (request.args.get("subject") or "").strip()
    if subject:
        query = query.filter(MasteryRecord.subject.ilike(f"%{subject}%"))
    records = query.order_by(MasteryRecord.student_id, MasteryRecord.subject).all()
    return success_response({"items": [r.to_dict() for r in records]})


@adaptive_learning_bp.route("/mastery/assess", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def assess_mastery():
    """Compute mastery from real Marks via the service (no LLM, no quota)
    and upsert MasteryRecord rows. Body: {student_id, subject?} — without a
    subject every subject the student has marks in is assessed."""
    data = request.get_json(silent=True) or {}
    student_id = (data.get("student_id") or "").strip()
    if not student_id:
        return error_response("student_id is required", 400)

    student = _student_in_school(student_id)
    if student is None:
        return error_response("Student not found in your school", 404)

    subject = (data.get("subject") or "").strip() or None
    subjects = (
        [subject]
        if subject
        else [name for name, _avg, _n in _per_subject_scores(student.id)]
    )
    if not subjects:
        return error_response(
            "No marks found for this student — nothing to assess", 400
        )

    try:
        records = [_assess_and_store(student, s) for s in subjects]
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to assess mastery", 500)
    return success_response({"items": [r.to_dict() for r in records]})


@adaptive_learning_bp.route("/mastery/<record_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def update_mastery(record_id):
    """Teacher override of a mastery record (level + notes)."""
    record = MasteryRecord.query.filter_by(
        id=record_id, school_id=g.school_id, is_deleted=False
    ).first()
    if record is None:
        return error_response("Mastery record not found", 404)

    data = request.get_json(silent=True) or {}
    if not data:
        return error_response("No fields to update", 400)

    if "mastery_level" in data:
        level = data.get("mastery_level")
        if level not in MASTERY_LEVELS:
            return error_response(
                f"mastery_level must be one of {', '.join(MASTERY_LEVELS)}", 400
            )
        record.mastery_level = level
    if "notes" in data:
        record.notes = (data.get("notes") or "").strip() or None
    record.source = "manual"
    db.session.commit()
    return success_response(record.to_dict())


# ── Adaptive progress (per-student table) ─────────────────────────────────

@adaptive_learning_bp.route("/adaptive-progress", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_adaptive_learning")
@role_required("school_admin", "teacher")
def adaptive_progress():
    """Per-student progress rows for the Student Progress page. Every number
    comes from real rows: Marks (avg score), LearningPath (assigned/completed),
    MasteryRecord (level). No per-row LLM calls."""
    query = Student.query.filter_by(school_id=g.school_id, is_deleted=False)

    class_name = (request.args.get("class_name") or "").strip()
    if class_name:
        klass = Class.query.filter_by(school_id=g.school_id, name=class_name).first()
        if klass is None:
            return success_response({"students": []})
        query = query.filter(Student.class_id == klass.id)

    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
                (Student.first_name + " " + Student.last_name).ilike(like),
            )
        )

    students = query.order_by(Student.first_name.asc()).all()
    if not students:
        return success_response({"students": []})
    ids = [s.id for s in students]

    avg_by_student = dict(
        db.session.query(
            Marks.student_id,
            func.avg(func.coalesce(Marks.obtained_marks, 0)),
        )
        .filter(
            Marks.school_id == g.school_id,
            Marks.is_deleted.is_(False),
            Marks.student_id.in_(ids),
        )
        .group_by(Marks.student_id)
        .all()
    )

    paths = (
        LearningPath.query.filter_by(
            school_id=g.school_id, is_active=True, is_deleted=False
        )
        .order_by(LearningPath.created_at.desc())
        .all()
    )
    mastery_by_student = {}
    for r in MasteryRecord.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).all():
        mastery_by_student.setdefault(r.student_id, []).append(r)

    class_names = {}
    for s in students:
        class_names[s.id] = _student_class_name(s)

    rows = []
    for s in students:
        raw_avg = avg_by_student.get(s.id)
        avg_score = round(float(raw_avg), 1) if raw_avg is not None else None

        records = mastery_by_student.get(s.id, [])
        if records:
            level = _level_from_avg(
                round(sum(r.avg_score or 0 for r in records) / len(records), 1)
            )
        else:
            level = _level_from_avg(avg_score)

        assigned = [
            p for p in paths
            if p.student_id == s.id
            or (p.student_id is None and p.class_name == class_names[s.id])
        ]
        completed = [p for p in assigned if p.completion_rate >= 100]
        recommendation = None
        if assigned:
            latest = assigned[0]
            topics = latest.recommended_topics or latest.focus_areas or []
            if topics:
                recommendation = ", ".join(str(t) for t in topics[:3])

        rows.append(
            {
                "id": str(s.id),
                "student_name": f"{s.first_name} {s.last_name}",
                "class_name": class_names[s.id],
                "level": level,
                "paths_assigned": len(assigned),
                "paths_completed": len(completed),
                "avg_score": avg_score,
                "ai_recommendation": recommendation,
            }
        )

    return success_response({"students": rows})
