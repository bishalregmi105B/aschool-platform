import json
"""AI Tools Suite API — question paper, lesson plan, timetable, remarks, insights.

Part of the ai_suite bundle (E230): every route gates @plugin_required("ai_suite").
The legacy `ai_tools` slug is satisfied through the alias table in
app/plugins/decorators.py, but new code gates the canonical bundle slug.
"""
from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from app.plugins.config_store import plugin_config_value
from app.plugins.decorators import plugin_required
from app.utils.rate_limiter import ai_rate_limit
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

ai_tools_bp = Blueprint("ai_tools", __name__, url_prefix="/ai-tools")


@ai_tools_bp.route("/question-paper", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def generate_question_paper():
    """Generate an AI-powered exam question paper."""
    from app.services.ai.question_paper import QuestionPaperService

    data = request.get_json(silent=True) or {}
    required = ("subject", "grade", "total_marks", "duration_minutes")
    missing = [f for f in required if f not in data]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    result = QuestionPaperService.generate_paper(
        subject=data["subject"],
        grade=data["grade"],
        total_marks=data["total_marks"],
        duration_minutes=data["duration_minutes"],
        topics=data.get("topics"),
        difficulty=data.get("difficulty", "medium"),
        include_answer_key=data.get("include_answer_key", True),
        question_types=data.get("question_types"),
        # Plugin-config default (config_schema.yaml) when request omits it.
        language=data.get("language")
        or plugin_config_value(
            str(g.school_id), "ai_suite", "default_language", "english"
        ),
    )
    if "error" in result:
        return error_response(result["error"], 500)
    return success_response(result)


@ai_tools_bp.route("/lesson-plan", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def generate_lesson_plan():
    """Generate an AI-powered lesson plan."""
    from app.services.ai.lesson_plan import LessonPlanService

    data = request.get_json(silent=True) or {}
    required = ("subject", "grade", "topic")
    missing = [f for f in required if f not in data]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    result = LessonPlanService.generate_lesson_plan(
        subject=data["subject"],
        grade=data["grade"],
        topic=data["topic"],
        duration_minutes=data.get("duration_minutes", 45),
        learning_objectives=data.get("learning_objectives"),
        # Plugin-config defaults (config_schema.yaml) when request omits them.
        teaching_method=data.get("teaching_method")
        or plugin_config_value(
            str(g.school_id), "ai_suite", "default_teaching_method", "interactive"
        ),
        language=data.get("language")
        or plugin_config_value(
            str(g.school_id), "ai_suite", "default_language", "english"
        ),
    )
    if "error" in result:
        return error_response(result["error"], 500)
    return success_response(result)


@ai_tools_bp.route("/timetable", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
@ai_rate_limit()
def generate_timetable():
    """Generate an AI-optimized clash-free timetable."""
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    academic_year_id = data.get("academic_year_id")
    if not academic_year_id:
        return error_response("academic_year_id is required")

    result = TimetableSolverService.generate_timetable(
        school_id=str(g.school_id),
        academic_year_id=academic_year_id,
        days=data.get("days"),
        periods_per_day=data.get("periods_per_day", 8),
        period_duration=data.get("period_duration", 45),
        start_time=data.get("start_time", "10:00"),
    )
    return success_response(result)


@ai_tools_bp.route("/timetable/save", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
@ai_rate_limit()
def save_timetable():
    """Save a generated timetable to the database."""
    from app.services.ai.timetable_solver import TimetableSolverService

    data = request.get_json(silent=True) or {}
    if not data.get("classes"):
        return error_response("Timetable data with 'classes' is required")

    saved = TimetableSolverService.save_timetable(str(g.school_id), data)
    return success_response({"saved_slots": saved})


@ai_tools_bp.route("/remarks", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def generate_remarks():
    """Generate AI-powered report card remarks for a student."""
    from app.services.ai.question_paper import QuestionPaperService

    data = request.get_json(silent=True) or {}
    required = ("student_name", "marks", "total", "percentage")
    missing = [f for f in required if f not in data]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    remark = QuestionPaperService.generate_remark(
        student_name=data["student_name"],
        marks=data["marks"],
        total=data["total"],
        percentage=data["percentage"],
    )
    return success_response({"remark": remark})


@ai_tools_bp.route("/homework-help", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@ai_rate_limit()
def homework_help():
    """AI homework helper — guided hints, not direct answers."""
    from app.services.ai.homework_helper import HomeworkHelperService

    data = request.get_json(silent=True) or {}
    question = data.get("question")
    if not question:
        return error_response("question is required")

    result = HomeworkHelperService.get_help(
        question=question,
        subject=data.get("subject"),
        grade_level=data.get("grade_level"),
    )
    return success_response(result)


@ai_tools_bp.route("/insights/weekly", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
@ai_rate_limit()
def weekly_insights():
    """Get AI-generated weekly school intelligence report."""
    from app.services.ai.school_insights import SchoolInsightsService

    report = SchoolInsightsService.generate_weekly_report(str(g.school_id))
    return success_response(report)


@ai_tools_bp.route("/insights/daily-brief", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin")
@ai_rate_limit()
def daily_brief():
    """Get AI-generated daily morning brief."""
    from app.services.ai.school_insights import SchoolInsightsService

    brief = SchoolInsightsService.generate_daily_brief(str(g.school_id))
    return success_response(brief)


@ai_tools_bp.route("/insights/risk-alerts", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def risk_alerts():
    """Get at-risk student detection."""
    from app.services.ai.school_insights import SchoolInsightsService

    alerts = SchoolInsightsService.calculate_student_risk_scores(str(g.school_id))
    return success_response(alerts)


@ai_tools_bp.route("/letter-writer", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def generate_letter():
    """Generate a school letter/circular draft (web AI Letter Writer)."""
    from app.services.ai.question_paper import QuestionPaperService

    data = request.get_json(silent=True) or {}
    subject = (data.get("subject") or "").strip()
    if not subject:
        return error_response("subject is required")

    letter = QuestionPaperService.generate_letter(
        letter_type=data.get("type") or "notice",
        recipient=(data.get("recipient") or "").strip(),
        subject=subject,
        context=(data.get("context") or "").strip(),
        tone=data.get("tone") or "formal",
    )
    return success_response({"content": letter})


# ── A-03: Question Bank + Paper Generator v2 ─────────────────────────────


@ai_tools_bp.route("/question-bank", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def list_question_bank():
    """List/search the school's question pool."""
    from app.models.question_bank import QuestionBankItem

    query = QuestionBankItem.query.filter(
        QuestionBankItem.school_id == g.school_id,
        QuestionBankItem.is_deleted.is_(False),
    )
    subject_id = request.args.get("subject_id")
    if subject_id:
        query = query.filter(QuestionBankItem.subject_id == subject_id)
    qtype = request.args.get("question_type")
    if qtype:
        query = query.filter(QuestionBankItem.question_type == qtype)
    difficulty = request.args.get("difficulty")
    if difficulty:
        query = query.filter(QuestionBankItem.difficulty == difficulty)
    approved = request.args.get("approved")
    if approved == "true":
        query = query.filter(QuestionBankItem.is_approved.is_(True))
    search = (request.args.get("q") or "").strip()
    if search:
        query = query.filter(QuestionBankItem.question_text.ilike(f"%{search}%"))

    items = query.order_by(QuestionBankItem.created_at.desc()).limit(200).all()
    return success_response([i.to_dict() for i in items])


@ai_tools_bp.route("/question-bank", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def add_question_bank_items():
    """Bulk-add manual questions to the bank."""
    from app.models.question_bank import QuestionBankItem
    from app.utils.llm_output import parse_and_validate

    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    if not items:
        return error_response("items is required (non-empty list)")

    created = []
    for raw in items:
        try:
            item = parse_and_validate(
                raw if isinstance(raw, str) else json.dumps(raw),
                schema={
                    "type": "object",
                    "required": ["subject_id", "question_text", "question_type"],
                    "properties": {
                        "question_type": {"type": "string"},
                        "question_text": {"type": "string"},
                    },
                },
            )
        except ValueError as exc:
            return error_response(f"invalid item: {exc}", 400)
        entry = QuestionBankItem(
            school_id=g.school_id,
            subject_id=item["subject_id"],
            class_id=item.get("class_id"),
            created_by_id=g.user_id,
            question_text=item["question_text"].strip(),
            question_type=item["question_type"],
            difficulty=item.get("difficulty") or "medium",
            marks=item.get("marks") or 1,
            topic=item.get("topic"),
            options=item.get("options") or [],
            correct_answer=item.get("correct_answer"),
            explanation=item.get("explanation"),
            source="manual",
            is_approved=True,  # manual entry is teacher-authored
        )
        db.session.add(entry)
        created.append(entry)
    db.session.commit()
    return created_response([e.to_dict() for e in created])


@ai_tools_bp.route("/question-bank/<uuid:item_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def update_question_bank_item(item_id):
    """Approve/edit a bank item (the AI-item review step)."""
    from app.models.question_bank import QuestionBankItem

    item = QuestionBankItem.query.filter_by(
        id=item_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not item:
        return error_response("Question not found", 404)

    data = request.get_json(silent=True) or {}
    if "question_text" in data:
        item.question_text = data["question_text"]
    if "correct_answer" in data:
        item.correct_answer = data["correct_answer"]
    if "difficulty" in data:
        item.difficulty = data["difficulty"]
    if "marks" in data:
        item.marks = data["marks"]
    if "topic" in data:
        item.topic = data["topic"]
    if "is_approved" in data:
        item.is_approved = bool(data["is_approved"])
    db.session.commit()
    return success_response(item.to_dict())


@ai_tools_bp.route("/question-bank/<uuid:item_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def delete_question_bank_item(item_id):
    from app.models.question_bank import QuestionBankItem

    item = QuestionBankItem.query.filter_by(
        id=item_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not item:
        return error_response("Question not found", 404)
    item.is_deleted = True
    db.session.commit()
    return success_response({"deleted": True})


@ai_tools_bp.route("/question-paper/v2", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def generate_question_paper_v2():
    """Generate a paper from a blueprint (bank-first, then AI shortfall)."""
    from app.models.question_bank import GeneratedPaper, PaperBlueprint
    from app.services.ai.question_paper_v2 import QuestionPaperServiceV2

    data = request.get_json(silent=True) or {}
    blueprint_id = data.get("blueprint_id")

    if blueprint_id:
        blueprint = PaperBlueprint.query.filter_by(
            id=blueprint_id, school_id=g.school_id, is_deleted=False
        ).first()
        if not blueprint:
            return error_response("Blueprint not found", 404)
    else:
        # inline blueprint from the request
        required = ("name", "subject_id", "total_marks", "sections")
        missing = [f for f in required if not data.get(f)]
        if missing:
            return error_response(f"Missing required fields: {', '.join(missing)}")
        blueprint = PaperBlueprint(
            school_id=g.school_id,
            name=data["name"],
            subject_id=data["subject_id"],
            class_id=data.get("class_id"),
            total_marks=data["total_marks"],
            duration_minutes=data.get("duration_minutes", 180),
            sections=data["sections"],
            language=data.get("language", "en"),
            created_by_id=g.user_id,
        )
        db.session.add(blueprint)
        db.session.flush()

    try:
        paper = QuestionPaperServiceV2.generate_from_blueprint(
            blueprint,
            school_id=g.school_id,
            user_id=g.user_id,
            title=data.get("title"),
        )
    except ValueError as exc:
        # blueprint marks-sum mismatch / unfilled sections — client error
        db.session.rollback()
        return error_response(str(exc), 400)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Paper v2 generation failed")
        return error_response(f"Paper generation failed: {exc}", 502)

    include_answers = bool(data.get("include_answer_key"))
    payload = paper.to_dict(include_answers=include_answers)
    payload["ai_generated_count"] = sum(
        1 for q in (paper.questions or []) if q.get("source") == "ai"
    )
    payload["bank_used_count"] = sum(
        1 for q in (paper.questions or []) if q.get("source") == "bank"
    )
    return created_response(payload)


@ai_tools_bp.route("/generated-papers/<uuid:paper_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def get_generated_paper(paper_id):
    """Fetch a generated paper; ?include_answer_key=true for the key."""
    from app.models.question_bank import GeneratedPaper

    paper = GeneratedPaper.query.filter_by(
        id=paper_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not paper:
        return error_response("Paper not found", 404)
    include_answers = request.args.get("include_answer_key") == "true"
    return success_response(paper.to_dict(include_answers=include_answers))


@ai_tools_bp.route("/form-assist", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
@ai_rate_limit()
def form_assist():
    """Universal AI form assistant — one endpoint any form can plug into.

    The client sends a field schema (what each field means, allowed values)
    plus either a free-text instruction ("a girl born 2018-04-15, admits to
    class 4 tomorrow, father 98XXXXXXXX") or the current partial form. The
    LLM returns ONLY valid JSON matching the schema; the client applies it
    field-by-field so this stays form-agnostic (web + Flutter share it).

    Request:  { form_id, fields: [{key,label,type,required,options,hint}],
                instruction, current? , language? }
    Response: { values: {key: value}, confidence, notes, missing: [keys] }
    """
    data = request.get_json(silent=True) or {}
    fields = data.get("fields") or []
    instruction = (data.get("instruction") or "").strip()
    if not fields:
        return error_response("fields[] schema is required")
    if len(fields) > 80:
        return error_response("Too many fields (max 80)")
    if not instruction and not data.get("current"):
        return error_response("Provide an instruction or the current form values")

    from app.services.ai.token_hub import AITokenHub

    lang = (data.get("language") or "english").lower()
    schema_lines = []
    for f in fields[:80]:
        line = f"- {f.get('key')}: {f.get('label','')} (type={f.get('type','text')}"
        if f.get("required"):
            line += ", required"
        if f.get("options"):
            opts = ", ".join(str(o) for o in f["options"][:20])
            line += f"; one of: {opts}"
        if f.get("hint"):
            line += f"; hint: {str(f['hint'])[:120]}"
        line += ")"
        schema_lines.append(line)

    current_dump = ""
    if isinstance(data.get("current"), dict):
        try:
            current_dump = json.dumps(data["current"], ensure_ascii=False)[:4000]
        except Exception:
            current_dump = ""

    system_prompt = (
        "You are a data-entry assistant inside a Nepali school management "
        "system. Fill form fields from the user's description. Respond with "
        "ONLY a JSON object, no markdown fence, of shape "
        '{"values": {field_key: value}, "notes": string}. '
        "Rules: use exactly the field keys given; omit fields you cannot "
        "determine; respect option values verbatim; dates as YYYY-MM-DD "
        "(convert BS dates like 2080-01-15 to AD); times as HH:MM 24h; "
        "numbers as numbers; keep names in the requested language. Notes max "
        "2 sentences, concise."
        + (f" Reply language for notes: {lang}." if lang else "")
    )
    user_prompt = (
        f"Form: {data.get('form_id', 'unknown')}\n"
        f"Fields:\n" + "\n".join(schema_lines)
        + (f"\n\nCurrent values:\n{current_dump}" if current_dump else "")
        + f"\n\nUser request: {instruction[:2000]}"
    )

    try:
        raw = AITokenHub.generate(
            school_id=g.school_id,
            user_id=g.user_id,
            prompt=user_prompt,
            action="form-assist",
            system_prompt=system_prompt,
            max_tokens=1200,
            model="fast",
            temperature=0.2,
        )
    except Exception as exc:
        current_app.logger.warning("form-assist AI failed: %s", exc)
        return error_response("AI assistant unavailable right now", 503)

    # Model output → strict JSON (strip fences, find outermost object)
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[-1] if "\n" in text else text
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return error_response("AI returned an unparseable response", 502)
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return error_response("AI returned an unparseable response", 502)

    allowed = {f.get("key") for f in fields}
    values = {k: v for k, v in (parsed.get("values") or {}).items() if k in allowed}
    return success_response(
        {
            "values": values,
            "notes": (parsed.get("notes") or "")[:500],
            "filled": len(values),
        }
    )
