"""Design Studio API — ID cards, certificates, bulk document generation."""

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response
from extensions import db

design_studio_bp = Blueprint("design_studio", __name__, url_prefix="/design-studio")


# ── Data Sources (for auto-fill) ──────────────────────────────


@design_studio_bp.route("/data-sources", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("design_studio")
def list_data_sources():
    """List available data source types for template auto-fill."""
    sources = [
        {
            "id": "student",
            "name": "Students",
            "icon": "🎓",
            "description": "Auto-fill from student records",
            "fields": [
                "name",
                "first_name",
                "last_name",
                "roll_no",
                "class",
                "section",
                "dob",
                "gender",
                "blood_group",
                "phone",
                "address",
                "father_name",
                "mother_name",
                "guardian_phone",
                "student_id",
                "admission_number",
                "academic_year",
                "photo",
            ],
        },
        {
            "id": "teacher",
            "name": "Teachers / Staff",
            "icon": "👨‍🏫",
            "description": "Auto-fill from teacher/staff records",
            "fields": [
                "name",
                "first_name",
                "last_name",
                "designation",
                "department",
                "employee_id",
                "phone",
                "email",
                "qualification",
                "photo",
            ],
        },
        {
            "id": "school",
            "name": "School Info",
            "icon": "🏫",
            "description": "Auto-fill school details (name, address, etc.)",
            "fields": [
                "school_name",
                "school_address",
                "school_phone",
                "school_email",
                "school_website",
                "school_logo",
                "principal_name",
            ],
        },
        {
            "id": "exam_result",
            "name": "Exam Results (Marksheet)",
            "icon": "📝",
            "description": "Auto-fill student marksheet from exam results — combine with exam_id filter",
            "fields": [
                "name",
                "roll_no",
                "class",
                "section",
                "school_name",
                "exam_name",
                "total_obtained",
                "total_full",
                "percentage",
                "overall_grade",
                "overall_gpa",
                "status",
                "rank",
                "ai_remarks",
                # Per-subject fields are injected as subjects_marks list
                "subjects_marks",
            ],
            "requires_filter": ["exam_id"],
        },
    ]
    return success_response(sources)


@design_studio_bp.route("/data-sources/<source_type>/records", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("design_studio")
def list_source_records(source_type):
    """Return records for a data source type, with template field mappings."""
    from app.models.academic import Class, Section
    from app.models.school import School
    from app.models.student import Guardian, Student
    from app.models.user import User

    q = request.args.get("q", "").strip().lower()
    class_filter = request.args.get("class_id")
    limit = min(int(request.args.get("limit", 50)), 200)

    if source_type == "student":
        query = Student.query.filter_by(school_id=g.school_id, status="active")
        if class_filter:
            query = query.filter_by(class_id=class_filter)
        if q:
            query = query.filter(
                db.or_(
                    Student.first_name.ilike(f"%{q}%"),
                    Student.last_name.ilike(f"%{q}%"),
                    Student.student_id.ilike(f"%{q}%"),
                )
            )
        students = query.order_by(Student.roll_number).limit(limit).all()

        records = []
        for s in students:
            # Fetch class/section names
            klass = Class.query.get(s.class_id) if s.class_id else None
            section = Section.query.get(s.section_id) if s.section_id else None

            # Fetch guardian info
            father = Guardian.query.filter_by(
                student_id=s.id, relation="father"
            ).first()
            mother = Guardian.query.filter_by(
                student_id=s.id, relation="mother"
            ).first()

            records.append(
                {
                    "id": str(s.id),
                    "label": f"{s.first_name} {s.last_name}",
                    "subtitle": f"Roll {s.roll_number or '—'} • {klass.name if klass else '—'} {section.name if section else ''}",
                    "fields": {
                        "name": f"{s.first_name} {s.last_name}",
                        "first_name": s.first_name or "",
                        "last_name": s.last_name or "",
                        "roll_no": str(s.roll_number or ""),
                        "class": klass.name if klass else "",
                        "section": section.name if section else "",
                        "dob": s.dob_bs or (s.dob_ad.isoformat() if s.dob_ad else ""),
                        "gender": (s.gender or "").capitalize(),
                        "blood_group": s.blood_group or "",
                        "phone": (father.phone if father else "") or "",
                        "address": (
                            s.address.get("permanent", "")
                            if isinstance(s.address, dict)
                            else str(s.address or "")
                        ),
                        "father_name": father.full_name if father else "",
                        "mother_name": mother.full_name if mother else "",
                        "guardian_phone": (father.phone if father else "") or "",
                        "student_id": s.student_id or "",
                        "admission_number": s.admission_number or "",
                        "academic_year": s.academic_year or "",
                        "photo": s.photo_url or "",
                    },
                }
            )
        return success_response(records)

    elif source_type == "teacher":
        query = User.query.filter(
            User.school_id == g.school_id,
            User.role.in_(["teacher", "school_admin"]),
            User.is_active == True,
        )
        if q:
            query = query.filter(
                db.or_(
                    User.first_name.ilike(f"%{q}%"),
                    User.last_name.ilike(f"%{q}%"),
                )
            )
        users = query.order_by(User.first_name).limit(limit).all()

        records = []
        for u in users:
            records.append(
                {
                    "id": str(u.id),
                    "label": f"{u.first_name or ''} {u.last_name or ''}".strip(),
                    "subtitle": f"{u.role} • {u.email or ''}",
                    "fields": {
                        "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
                        "first_name": u.first_name or "",
                        "last_name": u.last_name or "",
                        "designation": u.role or "",
                        "department": "",
                        "employee_id": str(u.id)[:8],
                        "phone": u.phone or "",
                        "email": u.email or "",
                        "qualification": "",
                        "photo": u.avatar_url if hasattr(u, "avatar_url") else "",
                    },
                }
            )
        return success_response(records)

    elif source_type == "school":
        school = School.query.get(g.school_id)
        if not school:
            return success_response([])
        records = [
            {
                "id": str(school.id),
                "label": school.name,
                "subtitle": "School Information",
                "fields": {
                    "school_name": school.name or "",
                    "school_address": school.address or "",
                    "school_phone": school.phone or "",
                    "school_email": school.email or "",
                    "school_website": school.website_external or "",
                    "school_logo": school.logo_url or "",
                    "principal_name": "",
                },
            }
        ]
        return success_response(records)

    elif source_type == "exam_result":
        # Requires exam_id filter; returns one record per student with marks
        exam_id = request.args.get("exam_id")
        if not exam_id:
            return error_response(
                "exam_id filter is required for exam_result source", 400
            )

        from app.models.academic import Class, Section, Subject
        from app.models.exam import Exam, Marks, ReportCard
        from app.models.school import School
        from app.models.student import Student

        exam = Exam.query.filter_by(id=exam_id, school_id=g.school_id).first()
        if not exam:
            return error_response("Exam not found", 404)

        school = School.query.get(g.school_id)
        school_fields = {
            "school_name": school.name if school else "",
            "school_address": school.address if school else "",
            "school_phone": school.phone if school else "",
            "school_logo": school.logo_url if school else "",
        }

        # All marks for this exam
        marks_query = Marks.query.filter_by(
            school_id=g.school_id, exam_id=exam_id, is_deleted=False
        )
        if class_filter:
            marks_query = marks_query.filter_by(class_id=class_filter)
        all_marks = marks_query.all()

        # Group by student
        student_marks: dict = {}
        for m in all_marks:
            sid = str(m.student_id)
            if sid not in student_marks:
                student_marks[sid] = []
            student_marks[sid].append(m)

        records = []
        for sid, marks_list in student_marks.items():
            student = Student.query.get(sid)
            if not student:
                continue
            if q and q not in f"{student.first_name} {student.last_name}".lower():
                continue

            klass = Class.query.get(student.class_id) if student.class_id else None
            section = (
                Section.query.get(student.section_id) if student.section_id else None
            )
            rc = ReportCard.query.filter_by(
                school_id=g.school_id, exam_id=exam_id, student_id=sid
            ).first()

            # Build subject marks list
            subjects_marks = []
            total_obtained = 0
            total_full = 0
            for m in marks_list:
                subj = Subject.query.get(m.subject_id)
                obtained = float(m.total_marks or 0)
                full = float(m.full_marks or 100)
                total_obtained += obtained
                total_full += full
                subjects_marks.append(
                    {
                        "subject": subj.name if subj else "Unknown",
                        "full_marks": full,
                        "obtained": obtained,
                        "grade": m.grade or "",
                        "gpa": float(m.gpa or 0),
                    }
                )

            percentage = (
                round(total_obtained / total_full * 100, 1) if total_full else 0
            )
            student_name = f"{student.first_name} {student.last_name}"

            records.append(
                {
                    "id": sid,
                    "label": student_name,
                    "subtitle": f"Roll {student.roll_number or '—'} • {klass.name if klass else '—'} • {percentage}%",
                    "fields": {
                        "name": student_name,
                        "roll_no": str(student.roll_number or ""),
                        "class": klass.name if klass else "",
                        "section": section.name if section else "",
                        "exam_name": exam.name or "",
                        "total_obtained": str(total_obtained),
                        "total_full": str(total_full),
                        "percentage": str(percentage),
                        "overall_grade": rc.overall_grade if rc else "",
                        "overall_gpa": str(float(rc.overall_gpa or 0)) if rc else "",
                        "status": rc.status
                        if rc and hasattr(rc, "status")
                        else ("pass" if percentage >= 40 else "fail"),
                        "rank": str(rc.rank_in_class)
                        if rc and rc.rank_in_class
                        else "",
                        "ai_remarks": rc.ai_remarks if rc else "",
                        "subjects_marks": subjects_marks,
                        **school_fields,
                    },
                }
            )

        return success_response(records)

    return error_response(f"Unknown data source: {source_type}", 400)


@design_studio_bp.route("/templates", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("design_studio")
def list_templates():
    """List available document templates."""
    from app.services.designer.template_engine import TemplateEngineService

    category = request.args.get("category")
    return success_response(
        TemplateEngineService.list_templates_for_school(
            category=category, school_id=g.school_id
        )
    )


@design_studio_bp.route("/templates", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin")
def save_template():
    """Create or update a school-specific template override."""
    from app.services.designer.template_engine import TemplateEngineService

    data = request.get_json(silent=True) or {}
    try:
        template = TemplateEngineService.upsert_template(g.school_id, data)
    except ValueError as exc:
        return error_response(str(exc), 400)
    return success_response(template, status_code=201)


@design_studio_bp.route("/render", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def render_document():
    """Render a single document from a template."""
    from app.models.school import School
    from app.services.designer.template_engine import TemplateEngineService

    data = request.get_json(silent=True) or {}
    template_id = data.get("template_id")
    if not template_id:
        return error_response("template_id is required", 400)

    school = School.query.get(g.school_id)
    school_config = {
        "name": school.name if school else "",
        "address": school.address if school else "",
        "phone": school.phone if school else "",
        "email": school.email if school else "",
        "website": school.website_external if school else "",
        "logo_url": school.logo_url if school else "",
    }

    merged_data = {
        "school_name": school.name if school else "",
        "school_address": school.address if school else "",
        "school_phone": school.phone if school else "",
        "school_email": school.email if school else "",
        "school_website": school.website_external if school else "",
        "school_logo": school.logo_url if school else "",
    }
    merged_data.update(data.get("data", {}) or {})

    try:
        template_meta = TemplateEngineService.get_template(
            template_id, school_id=g.school_id
        )
        rendered_html = TemplateEngineService.render_html(
            template_id, merged_data, school_config, school_id=g.school_id
        )
    except ValueError as exc:
        return error_response(str(exc), 400)

    return success_response(
        {
            "html": rendered_html,
            "template_id": TemplateEngineService.resolve_template_id(template_id),
            "template_width": template_meta.get("width") if template_meta else None,
            "template_height": template_meta.get("height") if template_meta else None,
            "editor_type": template_meta.get("editor_type") if template_meta else None,
        }
    )


@design_studio_bp.route("/bulk/id-cards", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin")
def bulk_id_cards():
    """Generate ID cards for all students in a class."""
    from app.services.designer.bulk_generator import BulkGeneratorService

    data = request.get_json(silent=True) or {}
    if not data.get("class_id"):
        return error_response("class_id is required", 400)

    cards = BulkGeneratorService.generate_bulk_id_cards(
        school_id=g.school_id,
        class_id=data.get("class_id"),
        template_id=data.get("template_id"),
    )
    return success_response({"count": len(cards), "cards": cards})


@design_studio_bp.route("/bulk/marksheets", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin")
def bulk_marksheets():
    """Generate marksheets for all students in a class for an exam."""
    from app.services.designer.bulk_generator import BulkGeneratorService

    data = request.get_json(silent=True) or {}
    exam_id = data.get("exam_id")
    class_id = data.get("class_id")
    if not exam_id or not class_id:
        return error_response("exam_id and class_id are required", 400)

    marksheets = BulkGeneratorService.generate_bulk_marksheets(
        school_id=g.school_id,
        exam_id=exam_id,
        class_id=class_id,
        template_id=data.get("template_id"),
    )
    return success_response({"count": len(marksheets), "marksheets": marksheets})


# ── AI Features ───────────────────────────────────────────


@design_studio_bp.route("/ai/question-paper", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("digital_content")
@role_required("superadmin", "school_admin", "teacher")
def generate_question_paper():
    """AI-generate an exam paper."""
    from app.services.ai.question_paper import QuestionPaperService

    data = request.get_json(silent=True) or {}
    result = QuestionPaperService.generate_paper(
        subject=data.get("subject", ""),
        grade=data.get("grade", 10),
        total_marks=data.get("total_marks", 100),
        duration_minutes=data.get("duration", 180),
        topics=data.get("topics"),
        difficulty=data.get("difficulty", "medium"),
        include_answer_key=data.get("include_answer_key", True),
    )
    return success_response(result)


@design_studio_bp.route("/ai/lesson-plan", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("digital_content")
@role_required("superadmin", "school_admin", "teacher")
def generate_lesson_plan():
    """AI-generate a lesson plan."""
    from app.services.ai.lesson_plan import LessonPlanService

    data = request.get_json(silent=True) or {}
    result = LessonPlanService.generate_lesson_plan(
        subject=data.get("subject", ""),
        grade=data.get("grade", 10),
        topic=data.get("topic", ""),
        duration_minutes=data.get("duration", 45),
        learning_objectives=data.get("objectives"),
    )
    return success_response(result)


@design_studio_bp.route("/ai/insights", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_insights")
@role_required("superadmin", "school_admin")
def get_ai_insights():
    """Get AI-powered school insights report."""
    from app.services.ai.school_insights import SchoolInsightsService

    report = SchoolInsightsService.generate_weekly_report(g.school_id)
    return success_response(report)


@design_studio_bp.route("/ai/risk-students", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_insights")
@role_required("superadmin", "school_admin")
def get_risk_students():
    """Get AI-calculated at-risk student list."""
    from app.services.ai.school_insights import SchoolInsightsService

    students = SchoolInsightsService.calculate_student_risk_scores(g.school_id)
    return success_response(students)


@design_studio_bp.route("/ai/homework-help", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_tutor")
def homework_help():
    """AI homework helper (Socratic tutoring)."""
    from app.services.ai.homework_helper import HomeworkHelperService

    data = request.get_json(silent=True) or {}
    result = HomeworkHelperService.get_help(
        question=data.get("question", ""),
        subject=data.get("subject", ""),
        grade_level=data.get("grade", 10),
        conversation_history=data.get("history"),
        student_attempt=data.get("attempt"),
    )
    return success_response(result)


# ── Docs-Designer Canvas CRUD ─────────────────────────────


@design_studio_bp.route("/documents", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def list_documents():
    """List saved canvas documents for this school."""
    from app.services.designer.document_store import DocumentStoreService
    from app.utils.pagination import paginate

    doc_type = request.args.get("type")
    docs = DocumentStoreService.list_documents(g.school_id, doc_type=doc_type)
    return success_response(docs)


@design_studio_bp.route("/documents", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def save_document():
    """Create or update a canvas document."""
    from flask_jwt_extended import get_jwt

    from app.services.designer.document_store import DocumentStoreService

    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    user_id = claims.get("sub")

    if not data.get("name"):
        return error_response("Document name is required", 400)

    doc = DocumentStoreService.save_document(
        school_id=g.school_id,
        user_id=user_id,
        doc_id=data.get("id"),  # None → create new
        name=data["name"],
        template_type=data.get("template_type", "custom"),
        canvas_state=data.get("canvas_state", {}),
        thumbnail_url=data.get("thumbnail_url", ""),
    )
    return success_response(doc, status_code=201)


@design_studio_bp.route("/documents/<doc_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def get_document(doc_id):
    """Fetch a saved canvas document."""
    from app.services.designer.document_store import DocumentStoreService

    doc = DocumentStoreService.get_document(g.school_id, doc_id)
    if not doc:
        return error_response("Document not found", 404)
    return success_response(doc)


@design_studio_bp.route("/documents/<doc_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def delete_document(doc_id):
    """Soft-delete a canvas document."""
    from app.services.designer.document_store import DocumentStoreService

    ok = DocumentStoreService.delete_document(g.school_id, doc_id)
    if not ok:
        return error_response("Document not found", 404)
    return success_response({"deleted": True})


# ── Docs-Designer AI Suggest (via Token Hub) ─────────────


@design_studio_bp.route("/ai/suggest", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def ai_suggest():
    """
    AI content generation for a canvas document.
    All calls are routed through AITokenHub — quota is checked and usage is logged.
    Returns HTTP 429 if the school has exceeded its daily or monthly limit.
    """
    from flask_jwt_extended import get_jwt

    from app.services.ai.token_hub import AITokenHub, QuotaExceededError

    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    user_id = claims.get("sub")

    prompt = data.get("prompt", "").strip()
    document_type = data.get("document_type", "document")
    context = data.get("context", {})

    if not prompt:
        return error_response("prompt is required", 400)

    try:
        result = AITokenHub.request(
            school_id=g.school_id,
            user_id=user_id,
            feature="design-studio:ai-suggest",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are an expert school document content writer for schools in Nepal. "
                        f"Generate professional, concise content for {document_type} documents. "
                        "Respond with ready-to-use text only. Be formal and respectful."
                    ),
                },
                {
                    "role": "user",
                    "content": (f"Generate content for: {prompt}\nContext: {context}"),
                },
            ],
            max_tokens=600,
            model="smart",
            metadata={"document_type": document_type},
        )
    except QuotaExceededError as exc:
        return error_response(
            f"AI quota exceeded: {exc.reason}. Used {exc.used}/{exc.limit} tokens.",
            429,
        )

    return success_response(
        {
            "content": result["text"],
            "tokens_used": result["tokens_used"],
            "model": result["model"],
            "provider": result["provider"],
        }
    )
