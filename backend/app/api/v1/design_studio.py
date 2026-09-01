"""Design Studio API — ID cards, certificates, bulk document generation."""

from flask import Blueprint, g, request, send_file
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

    from app.services.designer.bulk_generator import _absolute_url

    q = request.args.get("q", "").strip().lower()
    class_filter = request.args.get("class_id")
    section_filter = request.args.get("section_id")
    offset = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 50)), 200)

    if source_type == "student":
        query = Student.query.filter_by(school_id=g.school_id, status="active")
        if class_filter:
            query = query.filter_by(class_id=class_filter)
        if section_filter:
            query = query.filter_by(section_id=section_filter)
        if q:
            query = query.filter(
                db.or_(
                    Student.first_name.ilike(f"%{q}%"),
                    Student.last_name.ilike(f"%{q}%"),
                    Student.student_id.ilike(f"%{q}%"),
                )
            )
        students = query.order_by(Student.roll_number).offset(offset).limit(limit).all()

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
                        "photo": _absolute_url(s.photo_url or ""),
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
            query = query.filter(User.full_name.ilike(f"%{q}%"))
        users = query.order_by(User.full_name).limit(limit).all()

        records = []
        for u in users:
            # User has a single full_name column (no first/last split)
            full_name = u.full_name or ""
            first = full_name.split(" ", 1)[0] if full_name else ""
            last = full_name.split(" ", 1)[1] if " " in full_name else ""
            records.append(
                {
                    "id": str(u.id),
                    "label": full_name,
                    "subtitle": f"{u.role} • {u.email or ''}",
                    "fields": {
                        "name": full_name,
                        "first_name": first,
                        "last_name": last,
                        "designation": u.role or "",
                        "department": "",
                        "employee_id": str(u.id)[:8],
                        "phone": u.phone or "",
                        "email": u.email or "",
                        "qualification": "",
                        "photo": _absolute_url(u.avatar_url) if hasattr(u, "avatar_url") and u.avatar_url else "",
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
                    "school_logo": _absolute_url(school.logo_url or ""),
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
            "school_logo": _absolute_url(school.logo_url or "") if school else "",
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
                        "photo": _absolute_url(student.photo_url or ""),
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
    templates = TemplateEngineService.list_templates_for_school(
        category=category, school_id=g.school_id
    )

    # ── Demo thumbnails (additive): attach thumbnail_url for folder templates
    # that ship a generated thumbnail.png, and lazily render missing ones in a
    # fire-and-forget thread when the backlog is small (never blocks the list).
    try:
        from app.services.designer.thumbnails import (
            attach_thumbnail_urls,
            ensure_thumbnails_async,
        )

        attach_thumbnail_urls(templates)
        ensure_thumbnails_async()
    except Exception:
        pass

    return success_response(templates)


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


@design_studio_bp.route("/bulk/admit-cards", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin")
def bulk_admit_cards():
    """Generate admit cards for all students (optionally one class) for an exam."""
    from app.services.designer.bulk_generator import BulkGeneratorService

    data = request.get_json(silent=True) or {}
    if not data.get("exam_id"):
        return error_response("exam_id is required", 400)

    cards = BulkGeneratorService.generate_bulk_admit_cards(
        school_id=g.school_id,
        class_id=data.get("class_id"),
        exam_id=data.get("exam_id"),
        template_id=data.get("template_id"),
    )
    return success_response({"count": len(cards), "cards": cards})


@design_studio_bp.route("/bulk/certificates", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin")
def bulk_certificates():
    """Generate certificates (character/transfer/merit/participation) for a class."""
    from app.services.designer.bulk_generator import BulkGeneratorService

    data = request.get_json(silent=True) or {}

    certs = BulkGeneratorService.generate_bulk_certificates(
        school_id=g.school_id,
        class_id=data.get("class_id"),
        certificate_type=data.get("certificate_type", "character"),
        template_id=data.get("template_id"),
    )
    return success_response({"count": len(certs), "certificates": certs})


@design_studio_bp.route("/bulk/attendance-ledger", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def bulk_attendance_ledger():
    """Generate the monthly attendance ledger for a class (pages of 20 rows)."""
    from app.services.designer.bulk_generator import BulkGeneratorService

    data = request.get_json(silent=True) or {}
    if not data.get("class_id") or not data.get("month_bs"):
        return error_response("class_id and month_bs are required", 400)

    pages = BulkGeneratorService.generate_attendance_ledger(
        school_id=g.school_id,
        class_id=data.get("class_id"),
        year_bs=data.get("year_bs"),
        month_bs=data.get("month_bs"),
    )
    return success_response({"count": len(pages), "pages": pages})


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


# ── Docs-Designer AI Agent (tool-calling chat) ───────────────────────────────

AGENT_SYSTEM_PROMPT = """You are the ASchool Design & Writer Assistant for schools in Nepal.
You help teachers and admins create and edit documents and designs.

You reply ONLY with a JSON object (no markdown fences) of this shape:
{
  "reply": "<short friendly answer shown in chat>",
  "content": "<optional generated text content to insert/replace, plain text>",
  "actions": [
    {"action": "add_text", "text": "...", "fontSize": 24, "fontWeight": "bold", "fill": "#ea580c", "textAlign": "center"},
    {"action": "add_heading", "text": "..."},
    {"action": "replace_selected_text", "text": "..."},
    {"action": "insert_text_at_cursor", "text": "..."},
    {"action": "set_background", "color": "#ffffff"},
    {"action": "suggest_layout", "layout": "certificate|poster|notice|id_card|report_card"},
    {"action": "replace_document_text", "text": "..."},
    {"action": "add_bullet_points", "items": ["...", "..."]}
  ]
}

Rules:
- Use ONLY these actions. Choose actions that best fulfil the user's request; use several if needed.
- Always include "reply". Include "content" only when the user asked you to write/generate text.
- For Nepali users, if the request is in Nepali or asks for Nepali, write the content in Nepali (Devanagari).
- Keep text content concise and print-ready for a school context (notices, certificates,
  lesson plans, report remarks, event posters, admission forms, meeting minutes).
"""


@design_studio_bp.route("/ai/agent", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def ai_agent():
    """AI chat endpoint that returns executable editor actions.

    Body: {messages: [{role: "user"|"assistant", content: str}],
           mode: "designer"|"writer", context: {...}}
    The frontend executes the returned actions on the canvas / document.
    """
    import json as _json

    from flask_jwt_extended import get_jwt

    from app.services.ai.token_hub import AITokenHub, QuotaExceededError

    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    user_id = claims.get("sub")

    messages = data.get("messages") or []
    mode = data.get("mode", "designer")
    context = data.get("context") or {}
    if not messages:
        return error_response("messages is required", 400)
    if not isinstance(messages, list) or len(messages) > 24:
        return error_response("messages must be a list of at most 24 items", 400)

    convo = []
    for m in messages[-12:]:
        role = "assistant" if m.get("role") == "assistant" else "user"
        convo.append({"role": role, "content": str(m.get("content", ""))[:4000]})

    surface = (
        "The user is working in the DESIGNER (canvas: posters, certificates, ID cards, notices)."
        if mode == "designer"
        else "The user is working in the WRITER (Word-like documents: notices, lesson plans, letters, reports)."
    )
    try:
        result = AITokenHub.request(
            school_id=g.school_id,
            user_id=user_id,
            feature="design-studio:ai-agent",
            messages=[
                {"role": "system", "content": AGENT_SYSTEM_PROMPT + surface},
                {
                    "role": "user",
                    "content": (
                        f"{convo[0]['content']}\n\n"
                        f"[Context: {str(context)[:800]}]"
                        if len(convo) == 1
                        else "\n".join(f"{m['role']}: {m['content']}" for m in convo)
                        + f"\n\n[Context: {str(context)[:800]}]"
                    ),
                },
            ],
            max_tokens=1200,
            model="smart",
            metadata={"mode": mode},
        )
    except QuotaExceededError as exc:
        return error_response(
            f"AI quota exceeded: {exc.reason}. Used {exc.used}/{exc.limit} tokens.",
            429,
        )

    parsed = {"reply": result["text"], "actions": []}
    try:
        start = result["text"].find("{")
        end = result["text"].rfind("}")
        if start >= 0 and end > start:
            candidate = _json.loads(result["text"][start : end + 1])
            if isinstance(candidate, dict):
                parsed = {
                    "reply": str(candidate.get("reply") or result["text"])[:4000],
                    "content": candidate.get("content"),
                    "actions": [
                        a for a in (candidate.get("actions") or [])
                        if isinstance(a, dict) and isinstance(a.get("action"), str)
                    ][:8],
                }
    except (ValueError, TypeError):
        pass  # fall back to raw text reply — the chat still works

    return success_response(
        {
            "reply": parsed["reply"],
            "content": parsed.get("content"),
            "actions": parsed["actions"],
            "tokens_used": result["tokens_used"],
            "model": result["model"],
            "provider": result["provider"],
        }
    )


# ── Writer research (internet search + page fetch for citations) ─────────────

@design_studio_bp.route("/writer/research", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def writer_research():
    """Internet research for the Writer: search + fetch readable sources.

    Body: {query} or {url}. Uses Wikipedia's open API for search (no external
    key needed) and a readability-style extractor for fetched pages so users
    can search, verify and cite sources without leaving the document.
    """
    import re as _re
    from urllib.parse import quote as _quote
    from urllib.request import Request as _Req, urlopen as _urlopen

    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    url = (data.get("url") or "").strip()

    def _get_json(req_url, timeout=8):
        req = _Req(req_url, headers={"User-Agent": "ASchoolWriter/1.0 (school research tool)"})
        with _urlopen(req, timeout=timeout) as resp:  # nosec - fixed https endpoints
            import json as _json
            return _json.loads(resp.read().decode("utf-8", "replace"))

    try:
        if url:
            if not url.startswith(("http://", "https://")):
                return error_response("Only http(s) URLs are supported", 400)
            req = _Req(url, headers={"User-Agent": "ASchoolWriter/1.0 (school research tool)"})
            with _urlopen(req, timeout=10) as resp:  # nosec - user-provided https/http
                raw = resp.read(600_000).decode(resp.headers.get_content_charset() or "utf-8", "replace")
            # readability-lite: strip scripts/styles/tags, collapse whitespace
            raw = _re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", raw, flags=_re.S | _re.I)
            title_m = _re.search(r"<title[^>]*>(.*?)</title>", raw, _re.S | _re.I)
            text = _re.sub(r"<[^>]+>", " ", raw)
            text = _re.sub(r"\s+", " ", text).strip()
            return success_response({
                "kind": "page",
                "title": _esc(title_m.group(1).strip()) if title_m else url,
                "url": url,
                "text": text[:12000],
            })

        if not query:
            return error_response("query or url is required", 400)

        results = []
        try:
            wiki = _get_json(
                "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=" + _quote(query)
            )
            for hit in (wiki.get("query", {}).get("search") or [])[:5]:
                results.append({
                    "title": hit.get("title", ""),
                    "url": f"https://en.wikipedia.org/wiki/{str(hit.get('title', '')).replace(' ', '_')}",
                    "snippet": _re.sub(r"<[^>]+>", "", hit.get("snippet", "")),
                    "source": "Wikipedia",
                })
        except Exception:
            pass
        return success_response({"kind": "search", "query": query, "results": results})
    except Exception as exc:  # network failures must not 500 the editor
        return error_response(f"Research failed: {exc}", 502)


# ── Server-side PDF export (WeasyPrint) ──────────────────────────────────────


@design_studio_bp.route("/export/pdf", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def export_document_pdf():
    """Render a saved designer document (or template+data) to print-ready PDF.

    Body: {document_id} or {template_id, data}. Uses the server renderer so
    Nepali/Devanagari text is shaped correctly (html2canvas cannot).
    """
    from io import BytesIO

    from app.services.designer.document_renderer import document_pdf
    from app.services.designer.document_store import DocumentStoreService
    from app.services.designer.template_engine import TemplateEngineService

    payload = request.get_json(silent=True) or {}
    document_id = payload.get("document_id")
    template_id = payload.get("template_id")

    try:
        if document_id:
            doc = DocumentStoreService.get_document(g.school_id, document_id)
            if not doc:
                return error_response("Document not found", 404)
            state = doc.get("canvas_state") or {}
            # saved documents embed absolute image URLs client-side; fields
            # merge is a no-op pass-through for saved designs
            pdf_bytes = document_pdf(state, fields={}, school_config={})
        elif template_id:
            from weasyprint import HTML

            from app.services.designer.pdf_css import wrap_pdf_html

            from app.services.designer.template_engine import TemplateEngineService

            template = TemplateEngineService.get_template(template_id, school_id=g.school_id)
            if not template:
                return error_response("Template not found", 404)
            html_str = TemplateEngineService.render_html(
                template_id,
                data=payload.get("data") or {},
                school_id=g.school_id,
                template_meta=template,
            )
            # Size the sheet to the template's own design dimensions so A2 wall
            # calendars / A5 cards / square posters never clip to A4.
            try:
                tw = int(template.get("width") or 794)
                th = int(template.get("height") or 1123)
            except (TypeError, ValueError):
                tw, th = 794, 1123
            pdf_bytes = HTML(
                string=wrap_pdf_html(html_str, page_size=f"{max(1, tw)}px {max(1, th)}px")
            ).write_pdf()
        else:
            return error_response("document_id or template_id is required", 400)
    except ImportError:
        return error_response("PDF export is unavailable on this server", 501)
    except ValueError as exc:
        return error_response(str(exc), 404)

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="design.pdf",
    )


@design_studio_bp.route("/export/bulk-pdf", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def export_bulk_pdf():
    """One print-ready PDF from pre-generated bulk items.

    Body: {items: [{html?, canvas_json?, data?, template_width?, template_height?}], page_size?}.
    Items come from /bulk/* generation — html is used when present (writer
    templates), otherwise canvas_json is rendered by the document renderer.
    """
    from io import BytesIO

    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    if not items:
        return error_response("items is required", 400)

    try:
        from weasyprint import HTML

        from app.services.designer.document_renderer import document_to_html
    except ImportError:
        return error_response("PDF export is unavailable on this server", 501)

    pages_html = []
    for item in items:
        if item.get("html"):
            pages_html.append(item["html"])
        elif item.get("canvas_json"):
            width = int(item.get("template_width", 794))
            height = int(item.get("template_height", 1123))
            state = item["canvas_json"] if isinstance(item["canvas_json"], dict) else {}
            state.setdefault("width", width)
            state.setdefault("height", height)
            pages_html.append(document_to_html(state, fields=item.get("data") or {}, school_config={}))

    if not pages_html:
        return error_response("No renderable pages in items", 400)

    from app.services.designer.pdf_css import wrap_pdf_html

    orientation = payload.get("page_size", "portrait")
    layout = payload.get("layout", "one_per_page")

    if layout == "sheet":
        # N-up imposition: lay the (small) pages out in a grid on A4 sheets
        # with crop marks — what print shops actually print ID cards from.
        sheet_html = _impose_sheet(pages_html, payload)
        combined = wrap_pdf_html(sheet_html, page_size=orientation)
    else:
        # One item per sheet — size each sheet to the items' own design size
        # (bulk A5 admit cards / A2 calendars must not clip onto A4).
        try:
            bw = int(items[0].get("template_width", 794))
            bh = int(items[0].get("template_height", 1123))
        except (TypeError, ValueError):
            bw, bh = 794, 1123
        combined = wrap_pdf_html(
            "".join(pages_html), page_size=f"{max(1, bw)}px {max(1, bh)}px"
        )
    pdf_bytes = HTML(string=combined).write_pdf()

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="bulk.pdf",
    )


def _impose_sheet(pages_html: list[str], payload: dict) -> str:
    """Grid-impose card-sized pages onto A4 sheets (2 cols x 5 rows default).

    Each item is a fixed-size card rendered as a positioned div; a crop-mark
    outline is drawn at each slot so the shop can cut accurately.
    """
    card_w = int(payload.get("card_width", 300))
    card_h = int(payload.get("card_height", 189))
    cols = max(1, int(payload.get("columns", 2)))
    rows = max(1, int(payload.get("rows", 5)))
    gap_x, gap_y = 12, 12
    sheet_pad = 30

    cards = []
    for idx, page_html in enumerate(pages_html):
        col = idx % cols
        row = (idx // cols) % rows
        x = sheet_pad + col * (card_w + gap_x)
        y = sheet_pad + row * (card_h + gap_y)
        cards.append(
            f"<div style='position:absolute;left:{x}px;top:{y}px;"
            f"width:{card_w}px;height:{card_h}px;overflow:hidden;"
            f"outline:1px dashed #94a3b8;'>{page_html}</div>"
        )
        # page break after each full sheet
        if (idx + 1) % (cols * rows) == 0:
            cards[-1] = cards[-1].replace(
                "</div>",
                "</div><div style='page-break-after:always;'></div>",
                1,
            )
    return "".join(cards)

@design_studio_bp.route("/documents/<doc_id>/revisions", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def list_document_revisions(doc_id):
    """Version history — last 10 saves of a designer document."""
    from app.services.designer.document_store import DocumentStoreService

    return success_response(DocumentStoreService.list_revisions(g.school_id, doc_id))


@design_studio_bp.route("/documents/revisions/<revision_id>/restore", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def restore_document_revision(revision_id):
    """Restore a revision: the document's current state is snapshotted first,
    then the revision becomes the live state."""
    from flask_jwt_extended import get_jwt

    from app.services.designer.document_store import DocumentStoreService

    claims = get_jwt()
    rev = DocumentStoreService.get_revision(g.school_id, revision_id)
    if not rev:
        return error_response("Revision not found", 404)
    doc = DocumentStoreService.save_document(
        school_id=g.school_id,
        user_id=claims.get("sub"),
        doc_id=str(rev["document_id"]),
        name=rev.get("name") or "Restored document",
        template_type="custom",
        canvas_state=rev.get("canvas_state") or {},
        thumbnail_url=rev.get("thumbnail_url") or "",
    )
    return success_response(doc)

@design_studio_bp.route("/templates/<template_key>/assets/<path:filename>", methods=["GET"])
def template_asset(template_key, filename):
    """Serve images shipped inside a template folder (public — cards are
    rendered client-side before login-free embeds, and assets are
    non-sensitive template art)."""
    import os

    from flask import current_app, send_from_directory

    from app.services.designer.template_folders import get_folder_template

    tpl = get_folder_template(template_key)
    if not tpl or not tpl.get("_folder"):
        return error_response("Template not found", 404)
    assets_dir = os.path.join(tpl["_folder"], "assets")
    if not os.path.isdir(assets_dir):
        return error_response("No assets", 404)
    return send_from_directory(assets_dir, filename)


@design_studio_bp.route("/templates/<template_key>/thumbnail", methods=["GET"])
def template_thumbnail(template_key):
    """Serve the generated demo thumbnail PNG for a template folder
    (public, like assets — non-sensitive template art)."""
    import os

    from flask import send_file

    from app.services.designer.thumbnails import thumbnail_path

    path = thumbnail_path(template_key)
    if not os.path.isfile(path):
        return error_response("Thumbnail not found", 404)
    return send_file(path, mimetype="image/png", max_age=3600)


# ── Writer v2 — server-side DOCX export (fallback) ────────────
# The writer2 page exports .docx client-side first (lib/writer/exportDocx.ts);
# this route is the fallback that runs the same mapping with python-docx.


@design_studio_bp.route("/writer/export-docx", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("design_studio")
@role_required("superadmin", "school_admin", "teacher")
def export_writer_docx():
    """Export a writer2 (TipTap) document to .docx.

    Body: {name?: str, doc: ProseMirrorJSON, settings?: WriterSettings}.
    Returns the .docx binary as an attachment.
    """
    from io import BytesIO
    import re

    from flask import current_app

    payload = request.get_json(silent=True) or {}
    doc = payload.get("doc") or {}
    settings = payload.get("settings") or {}
    name = payload.get("name") or "document"
    if not isinstance(doc, dict) or not doc:
        return error_response("doc (ProseMirror JSON) is required", 400)

    try:
        from app.services.writer_docx import writer_doc_to_bytes
    except ImportError:
        return error_response("DOCX export is unavailable on this server (python-docx missing)", 501)

    try:
        data = writer_doc_to_bytes(doc, settings, name=name)
    except Exception:
        current_app.logger.exception("writer DOCX export failed")
        return error_response("Failed to render DOCX", 500)

    safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("_").lower() or "document"
    return send_file(
        BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=True,
        download_name=f"{safe_name}.docx",
    )
