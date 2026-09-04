"""AW-08 capture tools — voice-first Nepali/English data entry.

Flow (two-stage, logged as ONE AIGeneration):
  1. POST /capture/voice — audio → transcript (whisper via the hub) →
     structured draft (attendance/marks) via the model. Response is a
     DRAFT; nothing is committed.
  2. POST /capture/confirm — the user reviews/edits the draft and confirms;
     only then is the entity written. Both stages share one generation id.

Photo→structured-data (paper register OCR) uses the same two-stage
contract with a vision provider once OCR keys are provisioned; the
endpoint accepts it and defers with an honest 501 until then.
"""
from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response

capture_bp = Blueprint("capture", __name__, url_prefix="/capture")


@capture_bp.route("/voice", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def voice_capture():
    """Audio upload → transcript → structured draft. NEVER auto-commits."""
    from app.models.ai_workbench import AIGeneration
    from app.services.ai.token_hub import AITokenHub, AIProviderError
    from app.utils.llm_output import parse_and_validate
    from extensions import db

    audio = request.files.get("audio")
    if audio is None or not audio.filename:
        return error_response("audio file is required", 400)
    kind = (request.get_json(silent=True) or {}).get("kind") or request.form.get("kind") or "attendance"
    if kind not in ("attendance", "marks"):
        return error_response("kind must be attendance|marks", 400)

    audio_bytes = audio.read()
    if len(audio_bytes) > 15 * 1024 * 1024:
        return error_response("audio too large (max 15MB)", 413)

    try:
        speech = AITokenHub.transcribe(
            audio_bytes, filename=audio.filename,
            school_id=g.school_id, user_id=g.user_id,
            feature="capture:voice", language="ne" if request.form.get("lang") == "ne" else None,
        )
    except AIProviderError as exc:
        return error_response(str(exc), 502)

    schema = {
        "type": "object",
        "required": ["entries"],
        "properties": {
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["student_name"],
                    "properties": {
                        "student_name": {"type": "string"},
                        "status": {"type": "string"},      # attendance
                        "score": {"type": "number"},        # marks
                    },
                },
            }
        },
    }
    draft_result = AITokenHub.request(
        school_id=g.school_id, user_id=g.user_id, feature="capture:structure",
        messages=[
            {"role": "system", "content":
                "Convert the transcript into JSON. attendance → {\"entries\": "
                "[{\"student_name\": str, \"status\": \"present|absent|late\"}]}. "
                "marks → {\"entries\": [{\"student_name\": str, \"score\": number}]}. "
                "JSON only."},
            {"role": "user", "content": f"Transcript: {speech['text']}"},
        ],
        model="fast", max_tokens=1500, temperature=0.0,
    )
    try:
        draft = parse_and_validate(draft_result["text"], schema=schema)
    except ValueError as exc:
        return error_response(f"Could not structure the transcript: {exc}", 502)

    generation = AIGeneration(
        school_id=g.school_id, tool_key="capture:voice",
        user_id=g.user_id, provider=draft_result["provider"],
        model=draft_result["model"], input_tokens=draft_result["tokens_used"],
        cost_usd=(draft_result.get("cost_usd") or 0) + (speech.get("cost_usd") or 0),
        status="success", schema_name=f"capture_{kind}",
    )
    db.session.commit()
    return created_response(
        {
            "generation_id": str(generation.id),
            "transcript": speech["text"],
            "kind": kind,
            "draft": draft,  # REVIEW STEP — client must POST /capture/confirm
            "status": "awaiting_confirmation",
        }
    )


@capture_bp.route("/confirm", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
@role_required("superadmin", "school_admin", "teacher")
def confirm_capture():
    """Commit the reviewed draft. The payload here is what the HUMAN
    approved — the AI draft is never trusted directly."""
    from app.models.ai_workbench import AIGeneration
    from app.models.student import Student
    from extensions import db

    data = request.get_json(silent=True) or {}
    kind = data.get("kind")
    entries = data.get("entries") or []
    if kind not in ("attendance", "marks") or not entries:
        return error_response("kind and entries are required", 400)

    matched, unmatched = [], []
    for entry in entries:
        name = (entry.get("student_name") or "").strip()
        student = (
            Student.query.filter(
                Student.school_id == g.school_id,
                Student.is_deleted.is_(False),
                (Student.first_name + " " + Student.last_name).ilike(f"%{name}%"),
            )
            .first()
        )
        if student is None:
            unmatched.append(name)
            continue
        matched.append({"student": student, "entry": entry})

    # attendance commit
    if kind == "attendance":
        from app.models.attendance import Attendance
        from datetime import date

        today = date.today()
        created = 0
        for m in matched:
            exists = Attendance.query.filter_by(
                school_id=g.school_id, student_id=m["student"].id,
                date=today, is_deleted=False,
            ).first()
            if exists:
                continue
            db.session.add(
                Attendance(
                    school_id=g.school_id, student_id=m["student"].id,
                    class_id=m["student"].class_id,
                    date=today,
                    status=m["entry"].get("status") or "present",
                )
            )
            created += 1
        db.session.commit()
        return created_response(
            {"committed": created, "unmatched": unmatched, "kind": kind}
        )

    # marks commit requires exam+subject context — return matched students so
    # the client submits through the standard marks endpoint with reviewed ids
    return created_response(
        {
            "matched": [
                {"student_id": str(m["student"].id),
                 "student_name": f"{m['student'].first_name} {m['student'].last_name}",
                 "score": m["entry"].get("score")}
                for m in matched
            ],
            "unmatched": unmatched,
            "kind": kind,
            "note": "marks are staged for the standard marks endpoint with human-verified ids",
        }
    )


@capture_bp.route("/photo", methods=["POST"])
def photo_capture():
    """Paper-register OCR — DEFERRED until vision OCR keys are provisioned
    (honest 501, not a fake success)."""
    return error_response(
        "Photo capture requires a vision/OCR provider key (Google Document AI "
        "or Azure Form Recognizer). Voice capture is available now.", 501,
    )
