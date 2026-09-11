"""S12 content review API — human gate over agent-ingested corpus content.

Platform/school admins review what the ingestion agent staged: sources with
coverage manifests, units, chunks (verbatim text + page/bbox provenance).
Publishing is a deliberate human action; agents never self-publish.
"""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import error_response, success_response
from extensions import db

content_admin_bp = Blueprint("content_admin", __name__, url_prefix="/content")


@content_admin_bp.route("/sources", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "teacher")
def list_sources():
    """Ingested sources visible to this school: platform corpus (school_id
    NULL) + the school's own uploads."""
    from app.models.content_spine import ContentSource, ContentUnit

    status = request.args.get("status")
    kind = request.args.get("kind")
    query = ContentSource.query.filter(
        ContentSource.is_deleted.is_(False),
        (ContentSource.school_id.is_(None)) | (ContentSource.school_id == g.school_id),
    )
    if status:
        query = query.filter(ContentSource.ingest_status == status)
    if kind:
        query = query.filter(ContentSource.kind == kind)

    items, meta = paginate(query.order_by(ContentSource.created_at.desc()))
    unit_counts = {
        row[0]: row[1]
        for row in (
            db.session.query(ContentUnit.source_id, db.func.count(ContentUnit.id))
            .filter(ContentUnit.is_deleted.is_(False))
            .group_by(ContentUnit.source_id)
            .all()
        )
    }
    return success_response(
        [
            {
                "id": str(s.id),
                "kind": s.kind,
                "grade": s.grade,
                "subject_code": s.subject_code,
                "title_en": s.title_en,
                "title_ne": s.title_ne,
                "medium": s.medium,
                "edition_bs": s.edition_bs,
                "ingest_status": s.ingest_status,
                "page_count": s.page_count,
                "manifest": s.manifest,
                "unit_count": unit_counts.get(s.id, 0),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in items
        ],
        meta={"pagination": meta},
    )


@content_admin_bp.route("/sources/<uuid:source_id>", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "teacher")
def get_source(source_id):
    """One source with its unit tree + chunk counts, for the review queue."""
    from app.models.content_spine import ContentChunk, ContentSource, ContentUnit

    source = ContentSource.query.filter(
        ContentSource.id == source_id,
        ContentSource.is_deleted.is_(False),
        (ContentSource.school_id.is_(None)) | (ContentSource.school_id == g.school_id),
    ).first()
    if source is None:
        return error_response("Content source not found", 404)

    units = (
        ContentUnit.query.filter_by(source_id=source.id, is_deleted=False)
        .order_by(ContentUnit.unit_path)
        .all()
    )
    chunk_counts = {
        row[0]: {"total": row[1], "published": row[2], "flagged": row[3]}
        for row in (
            db.session.query(
                ContentChunk.unit_id,
                db.func.count(ContentChunk.id),
                db.func.count(ContentChunk.id).filter(ContentChunk.is_published.is_(True)),
                db.func.count(ContentChunk.id).filter(ContentChunk.qa_status == "flagged"),
            )
            .filter(ContentChunk.source_id == source.id, ContentChunk.is_deleted.is_(False))
            .group_by(ContentChunk.unit_id)
            .all()
        )
    }
    return success_response(
        {
            "id": str(source.id),
            "kind": source.kind,
            "grade": source.grade,
            "subject_code": source.subject_code,
            "title_en": source.title_en,
            "title_ne": source.title_ne,
            "medium": source.medium,
            "ingest_status": source.ingest_status,
            "manifest": source.manifest,
            "units": [
                {
                    "id": str(u.id),
                    "unit_path": u.unit_path,
                    "unit_no_ascii": u.unit_no_ascii,
                    "title_en": u.title_en,
                    "title_ne": u.title_ne,
                    "title_chain": u.title_chain,
                    "page_start": u.page_start,
                    "page_end": u.page_end,
                    "curriculum_unit_id": str(u.curriculum_unit_id) if u.curriculum_unit_id else None,
                    "align_method": u.align_method,
                    "is_published": u.is_published,
                    "chunks": chunk_counts.get(u.id, {"total": 0, "published": 0, "flagged": 0}),
                }
                for u in units
            ],
        }
    )


@content_admin_bp.route("/sources/<uuid:source_id>/chunks", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "teacher")
def list_source_chunks(source_id):
    """Chunk-level review: verbatim text + page/bbox provenance, filterable
    by unit / qa_status / page."""
    from app.models.content_spine import ContentChunk, ContentSource

    source = ContentSource.query.filter(
        ContentSource.id == source_id,
        ContentSource.is_deleted.is_(False),
        (ContentSource.school_id.is_(None)) | (ContentSource.school_id == g.school_id),
    ).first()
    if source is None:
        return error_response("Content source not found", 404)

    query = ContentChunk.query.filter_by(source_id=source.id, is_deleted=False)
    if request.args.get("unit_id"):
        query = query.filter(ContentChunk.unit_id == request.args["unit_id"])
    if request.args.get("qa_status"):
        query = query.filter(ContentChunk.qa_status == request.args["qa_status"])
    if request.args.get("page"):
        query = query.filter(ContentChunk.page_no == int(request.args["page"]))
    items, meta = paginate(query.order_by(ContentChunk.page_no, ContentChunk.ordinal))
    return success_response(
        [
            {
                "id": str(c.id),
                "unit_id": str(c.unit_id),
                "ordinal": c.ordinal,
                "kind": c.kind,
                "language": c.language,
                "text_display": (c.text_display or "")[:2000],
                "page_no": c.page_no,
                "bbox": c.bbox,
                "page_image_path": c.page_image_path,
                "qa_status": c.qa_status,
                "qa_flags": c.qa_flags,
                "is_published": c.is_published,
                "content_sha256": c.content_sha256,
            }
            for c in items
        ],
        meta={"pagination": meta},
    )


@content_admin_bp.route("/sources/<uuid:source_id>/publish", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def publish_source(source_id):
    """Human publish action: flips source + units + chunks to published and
    records who approved. Re-runnable; idempotent."""
    from app.models.content_spine import ContentChunk, ContentSource, ContentUnit

    source = ContentSource.query.filter(
        ContentSource.id == source_id,
        ContentSource.is_deleted.is_(False),
        (ContentSource.school_id.is_(None)) | (ContentSource.school_id == g.school_id),
    ).first()
    if source is None:
        return error_response("Content source not found", 404)

    flagged = (
        ContentChunk.query.filter_by(
            source_id=source.id, qa_status="flagged", is_deleted=False
        ).count()
    )
    if flagged and request.json.get("force") is not True:
        return error_response(
            f"{flagged} flagged chunk(s) need review — pass force:true to publish anyway",
            409,
        )

    from datetime import datetime, timezone

    manifest = dict(source.manifest or {})
    manifest["published_by"] = str(g.user_id)
    manifest["published_at"] = datetime.now(timezone.utc).isoformat()
    source.manifest = manifest
    source.ingest_status = "published"
    source.ingest_error = None
    ContentUnit.query.filter_by(source_id=source.id).update({"is_published": True})
    ContentChunk.query.filter_by(source_id=source.id).update({"is_published": True})
    db.session.commit()
    return success_response({"id": str(source.id), "ingest_status": "published"})


@content_admin_bp.route("/chunks/<uuid:chunk_id>", methods=["PATCH"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "teacher")
def review_chunk(chunk_id):
    """Reviewer verdict on one chunk: pass it, flag it, or correct its text
    (corrections keep the original sha256 in meta for the audit trail)."""
    import hashlib
    import unicodedata

    from app.models.content_spine import ContentChunk

    chunk = ContentChunk.query.filter(
        ContentChunk.id == chunk_id,
        ContentChunk.is_deleted.is_(False),
        (ContentChunk.school_id.is_(None)) | (ContentChunk.school_id == g.school_id),
    ).first()
    if chunk is None:
        return error_response("Chunk not found", 404)

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    if action == "pass":
        chunk.qa_status = "passed"
        chunk.qa_flags = []
    elif action == "flag":
        chunk.qa_status = "flagged"
        if data.get("reason"):
            chunk.qa_flags = list(chunk.qa_flags or []) + [str(data["reason"])[:200]]
    elif action == "correct":
        new_text = (data.get("text_display") or "").strip()
        if not new_text:
            return error_response("text_display is required for corrections", 400)
        normalized = unicodedata.normalize("NFC", new_text).replace("\u200c", "")
        meta = dict(chunk.meta or {})
        meta["reviewer_correction"] = {
            "by": str(g.user_id),
            "original_sha256": chunk.content_sha256,
            "original_text": (chunk.text_display or "")[:2000],
        }
        chunk.meta = meta
        # keep the embed prefix (title-chain + contextualizer) intact and
        # swap only the trailing verbatim segment
        parts = chunk.text_embed.rsplit(" ▸ ", 1) if chunk.text_embed else ["", ""]
        chunk.text_embed = " ▸ ".join([parts[0], new_text]) if len(parts) == 2 else new_text
        chunk.text_display = new_text
        chunk.content_sha256 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        chunk.qa_status = "passed"
    else:
        return error_response("action must be pass|flag|correct", 400)
    db.session.commit()
    return success_response(
        {"id": str(chunk.id), "qa_status": chunk.qa_status,
         "content_sha256": chunk.content_sha256}
    )
