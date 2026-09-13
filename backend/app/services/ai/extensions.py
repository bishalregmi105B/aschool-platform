"""AW-09/10/11: PD coach seed, live-poll ephemeral surface, Caliper events
+ QTI export.

- AW-09: seed the UNESCO teacher PD framework as RAG `policy` chunks +
  `teacher_pd_progress` checklist table.
- AW-10: live poll/quiz — ephemeral in-memory store (aggregate analytics
  only, deliberately NOT reviewable AIGeneration artifacts).
- AW-11: Caliper-shaped event emission for every AIGeneration/TutorMessage
  + QTI 3.0 export over the A-03 question bank.
"""
import logging
import time

logger = logging.getLogger(__name__)

# ── AW-09: PD coach ─────────────────────────────────────────────────────

UNESCO_PD_FRAMEWORK = [
    ("1. Understanding ICT in Education Policy",
     "Teachers understand national ICT-in-education policy and curriculum "
     "goals, and can articulate how technology supports the curriculum."),
    ("2. Curriculum and Assessment",
     "Teachers use technology to locate, adapt and create curriculum "
     "resources, and to design formative assessment with digital tools."),
    ("3. Pedagogy",
     "Teachers integrate technology into learner-centred pedagogy: "
     "collaboration, problem solving, and project-based learning."),
    ("4. Application of Digital Skills",
     "Teachers demonstrate and model digital skills relevant to their "
     "subject, including productivity tools and open educational resources."),
    ("5. Organization and Administration",
     "Teachers use technology for planning, record keeping, and "
     "communication with parents and the school community."),
    ("6. Teacher Professional Learning",
     "Teachers continuously develop their own practice using online "
     "communities and open courses, and mentor peers."),
]


def seed_pd_framework(school_id=None) -> int:
    """Seed the UNESCO framework as RAG policy chunks (idempotent by
    source_id). Returns chunks written."""
    import uuid

    from app.models.document_chunk import DocumentChunk
    from extensions import db

    existing = DocumentChunk.query.filter_by(
        source_type="policy", source_id=_framework_source_id(), is_deleted=False
    ).count()
    if existing >= len(UNESCO_PD_FRAMEWORK):
        return 0
    written = 0
    framework_id = _framework_source_id()
    for i, (title, body) in enumerate(UNESCO_PD_FRAMEWORK):
        chunk = DocumentChunk.query.filter_by(
            source_type="policy", source_id=framework_id, chunk_index=i,
            is_deleted=False,
        ).first()
        if chunk:
            continue
        text = f"{title}\n\n{body}"
        chunk = DocumentChunk(
            school_id=school_id,
            source_type="policy",
            source_id=framework_id,
            chunk_index=i,
            text=text,
            metadata_json={"framework": "unesco-ict-cft", "title": title},
        )
        db.session.add(chunk)
        written += 1
    db.session.commit()
    # Embeddings are best-effort (BM25-only degradation without a key).
    # B-12: this used to call RAGService.ingest, which INSERTs — duplicating
    # every row the idempotent block above had already written. Embed the
    # existing rows in place instead.
    try:
        from sqlalchemy import text as sql_text

        from app.services.ai.token_hub import AITokenHub

        rows = db.session.execute(
            sql_text(
                "SELECT id, text FROM document_chunks "
                "WHERE source_type = 'policy' AND source_id = :sid "
                "AND is_deleted = false AND embedding_vec IS NULL"
            ),
            {"sid": framework_id},
        ).fetchall()
        if rows:
            vectors = AITokenHub.embed(
                [row.text for row in rows], school_id=school_id, feature="rag-ingest"
            )
            for row, vec in zip(rows, vectors):
                if not vec:
                    continue
                vec_sql = "[" + ",".join(f"{x:.7f}" for x in vec) + "]"
                db.session.execute(
                    sql_text(
                        "UPDATE document_chunks SET embedding_vec = CAST(:v AS vector) "
                        "WHERE id = :id"
                    ),
                    {"v": vec_sql, "id": str(row.id)},
                )
            db.session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.info("PD framework embed skipped: %s", exc)
    return written


def _framework_source_id():
    import uuid

    return str(uuid.uuid5(uuid.NAMESPACE_URL, "unesco-ict-cft"))


def register_pd_routes(bp) -> None:
    """PD coach endpoints: framework checklist + progress toggles."""
    from app.models.ai_workbench import AIGeneration
    from flask import g, request
    from app.utils.decorators import role_required
    from app.utils.response import success_response, error_response
    from extensions import db

    @bp.route("/pd/framework", methods=["GET"])
    @jwt_required_ext()
    @role_required("superadmin", "school_admin", "teacher")
    def pd_framework():
        return success_response(
            {"framework": "unesco-ict-cft",
             "domains": [{"index": i, "title": t, "summary": b}
                         for i, (t, b) in enumerate(UNESCO_PD_FRAMEWORK)]}
        )

    @bp.route("/pd/progress", methods=["GET", "POST"])
    @jwt_required_ext()
    @role_required("superadmin", "school_admin", "teacher")
    def pd_progress():
        from app.models.ai_workbench import AIToolRegistry  # noqa: F401
        from sqlalchemy import text as _t

        # checklist join table created lazily (tiny, no migration ceremony)
        db.session.execute(_t(
            "CREATE TABLE IF NOT EXISTS teacher_pd_progress ("
            " teacher_id uuid PRIMARY KEY, domain_index int NOT NULL,"
            " completed bool NOT NULL DEFAULT false, updated_at timestamptz"
            " NOT NULL DEFAULT now())"
        ))
        db.session.commit()
        if request.method == "GET":
            rows = db.session.execute(_t(
                "SELECT domain_index, completed FROM teacher_pd_progress"
                " WHERE teacher_id = :t"
            ), {"t": str(g.user_id)}).fetchall()
            return success_response(
                {str(r.domain_index): r.completed for r in rows}
            )
        data = request.get_json(silent=True) or {}
        idx = data.get("domain_index")
        if idx is None or not 0 <= int(idx) < len(UNESCO_PD_FRAMEWORK):
            return error_response("domain_index out of range", 400)
        db.session.execute(_t(
            "INSERT INTO teacher_pd_progress (teacher_id, domain_index, completed)"
            " VALUES (:t, :d, :c) ON CONFLICT (teacher_id, domain_index)"
            " DO UPDATE SET completed = :c, updated_at = now()"
        ), {"t": str(g.user_id), "d": int(idx),
            "c": bool(data.get("completed", True))})
        db.session.commit()
        return success_response({"saved": True})


def jwt_required_ext():
    from flask_jwt_extended import jwt_required

    return jwt_required()


# ── AW-10 live polls REMOVED 2026-09-13 (audit 6.1-12): zero consumers,
# in-memory state broke across workers/restarts, no plugin/role/school
# gating, zero tests. Restore only as a real gated route module with a
# persistent store and a consumer.

# ── AW-11: Caliper events + QTI export ──────────────────────────────────

def caliper_event(event_type: str, obj: dict, school_id, user_id=None) -> dict:
    """Caliper-shaped event written to the internal event log (the district
    dashboard consumes this, not ai_generations directly)."""
    from app.models.system import SystemSetting
    from extensions import db
    import json as _json

    event = {
        "sensor": f"aschool://{school_id}",
        "sendTime": _iso_now(),
        "data": [{
            "type": event_type,
            "eventTime": _iso_now(),
            "actor": {"type": "Person", "id": str(user_id) if user_id else None},
            "object": obj,
            "edApp": {"type": "SoftwareApplication", "id": "aschool"},
        }],
    }
    row = SystemSetting.query.filter_by(key=f"caliper:{school_id}").first()
    if row is None:
        row = SystemSetting(key=f"caliper:{school_id}", value={"events": []})
        db.session.add(row)
    events = row.value.get("events", []) if isinstance(row.value, dict) else []
    events.append(event)
    row.value = {"events": events[-500:]}  # bounded ring
    db.session.commit()
    return event


def qti_export(items) -> str:
    """QTI 3.0 (QTI 3 package stub) XML for a list of QuestionBankItem."""
    from xml.sax.saxutils import escape

    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiv3p1" identifier="aschool-paper">',
             '<qti-assessment-part identifier="part1">',
             '<qti-assessment-section identifier="sec1" title="Generated Section">']
    for i, item in enumerate(items, 1):
        ident = f"item-{i}"
        parts.append(f'<qti-assessment-item identifier="{ident}" title="Q{i}">')
        parts.append(f'<qti-item-body><p>{escape(item.question_text or "")}</p></qti-item-body>')
        if item.question_type == "mcq" and item.options:
            parts.append('<qti-choice-interaction response-identifier="RESPONSE" shuffle="false">')
            for opt in item.options:
                key = escape(str(opt.get("key", "")))
                text = escape(str(opt.get("text", "")))
                parts.append(
                    f'<qti-simple-choice identifier="{key}">{text}</qti-simple-choice>')
            parts.append("</qti-choice-interaction>")
        parts.append("</qti-assessment-item>")
    parts.append("</qti-assessment-section></qti-assessment-part></qti-assessment-test>")
    return "\n".join(parts)


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
