"""Teaching Content API — admin CRUD over sections/versions/blocks + publish.

Part of the ai_teacher plugin (Phase C P1). All content is ADMIN-ENTERED:
there is no OCR/vision ingestion path anywhere in this module by design.
The AI Teacher runtime reads the published snapshot over the read API in
api/v1/ai_teacher.py; it never writes here.

Gating: superadmin/school_admin manage content; teachers get read access to
published sections for lesson prep. Platform rows (school_id NULL) are
visible read-only to schools; only platform staff (superadmin) write them.

Workflow (state machine enforced in _transition, audited in
teaching_content_reviews):

    draft --submit--> in_review --publish--> published --(edit: clone v+1)--> draft
        ^                 |
        +----- reject ----+
    published --archive--> archived
"""
from datetime import datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.teaching_content import (
    TeachingContentReview,
    TeachingSection,
    TeachingSectionVersion,
)
from app.models.curriculum import CurriculumUnit
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

teaching_content_bp = Blueprint(
    "teaching_content", __name__, url_prefix="/teaching-content"
)

BLOCK_MODELS = {
    "notes": ("app.models.teaching_content", "TeachingNote"),
    "examples": ("app.models.teaching_content", "TeachingExample"),
    "misconceptions": ("app.models.teaching_content", "TeachingMisconception"),
    "formulas": ("app.models.teaching_content", "TeachingFormula"),
    "exam_tips": ("app.models.teaching_content", "TeachingExamTip"),
    "key_terms": ("app.models.teaching_content", "TeachingKeyTerm"),
    "media": ("app.models.teaching_content", "TeachingMedia"),
}


def _can_write_platform() -> bool:
    return g.role == "superadmin"


def _visible_sections_query(school_id):
    """A school sees its own sections plus platform-seeded (school_id NULL)."""
    from sqlalchemy import or_

    return TeachingSection.query.filter(
        TeachingSection.is_deleted.is_(False),
        or_(
            TeachingSection.school_id.is_(None),
            TeachingSection.school_id == school_id,
        ),
    )


def _load_section(section_id):
    section = TeachingSection.query.get(section_id)
    if (
        not section
        or section.is_deleted
        or (
            section.school_id is not None
            and str(section.school_id) != str(g.school_id)
        )
    ):
        return None
    return section


def _require_write_access(section):
    """Platform rows are superadmin-write; school rows are admin-write."""
    if section.school_id is None and not _can_write_platform():
        return error_response(
            "Platform curriculum content is read-only for schools.", 403
        )
    return None


# ── Sections ────────────────────────────────────────────────────────────────


@teaching_content_bp.route("/sections", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin", "teacher")
def list_sections():
    query = _visible_sections_query(g.school_id)
    unit_id = (request.args.get("unit_id") or "").strip()
    if unit_id:
        query = query.filter(TeachingSection.unit_id == unit_id)
    kind = (request.args.get("kind") or "").strip()
    if kind:
        query = query.filter(TeachingSection.kind == kind)
    items, meta = paginate(query.order_by(TeachingSection.unit_id, TeachingSection.section_no))
    return success_response([s.to_dict() for s in items], meta=meta)


@teaching_content_bp.route("/sections/<uuid:section_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin", "teacher")
def get_section(section_id):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    data = section.to_dict()
    published = section.published_version
    if published:
        data["published"] = published.to_dict(include_blocks=True)
    return success_response(data)


@teaching_content_bp.route("/sections", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def create_section():
    data = request.get_json(silent=True) or {}
    for field in ("unit_id", "section_no", "code", "title_en"):
        if not data.get(field):
            return error_response(f"{field} is required", 400)

    unit = CurriculumUnit.query.get(data["unit_id"])
    if not unit or unit.is_deleted:
        return error_response("Curriculum unit not found", 404)

    # School rows override a platform section; platform staff seed platform rows.
    is_platform = _can_write_platform() and data.get("scope") == "platform"
    school_id = None if is_platform else g.school_id

    if school_id is not None and data.get("overrides_section_id"):
        platform_section = TeachingSection.query.get(data["overrides_section_id"])
        if (
            not platform_section
            or platform_section.is_deleted
            or platform_section.school_id is not None
        ):
            return error_response(
                "overrides_section_id must name a platform section", 400
            )

    section = TeachingSection(
        school_id=school_id,
        unit_id=unit.id,
        overrides_section_id=data.get("overrides_section_id"),
        section_no=int(data["section_no"]),
        code=str(data["code"])[:60],
        kind=data.get("kind") or "concept",
        title_en=str(data["title_en"])[:300],
        title_ne=data.get("title_ne"),
        summary_en=data.get("summary_en"),
        summary_ne=data.get("summary_ne"),
        estimated_minutes=int(data.get("estimated_minutes") or 12),
        difficulty=data.get("difficulty") or "core",
        prerequisite_section_ids=data.get("prerequisite_section_ids") or [],
        tags=data.get("tags") or [],
        created_by_id=g.user_id,
    )
    db.session.add(section)
    db.session.flush()

    # Every section starts with an empty draft v1 — content attaches to it.
    version = TeachingSectionVersion(
        school_id=school_id,
        section_id=section.id,
        version_no=1,
        status="draft",
        authored_by_id=g.user_id,
        change_note="initial draft",
    )
    db.session.add(version)
    db.session.commit()
    return created_response(section.to_dict())


@teaching_content_bp.route("/sections/<uuid:section_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def update_section(section_id):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    denied = _require_write_access(section)
    if denied:
        return denied

    data = request.get_json(silent=True) or {}
    for field in (
        "title_en", "title_ne", "summary_en", "summary_ne", "kind",
        "difficulty", "estimated_minutes", "tags", "prerequisite_section_ids",
        "section_no", "is_active",
    ):
        if field in data:
            setattr(section, field, data[field])
    db.session.commit()
    return success_response(section.to_dict())


@teaching_content_bp.route("/sections/<uuid:section_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def delete_section(section_id):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    denied = _require_write_access(section)
    if denied:
        return denied
    section.is_deleted = True
    db.session.commit()
    return success_response({"id": str(section.id), "deleted": True})


# ── Versions + workflow ─────────────────────────────────────────────────────


@teaching_content_bp.route("/sections/<uuid:section_id>/versions", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin", "teacher")
def list_versions(section_id):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    versions = (
        TeachingSectionVersion.query.filter_by(
            section_id=section.id, is_deleted=False
        )
        .order_by(TeachingSectionVersion.version_no.desc())
        .all()
    )
    return success_response([v.to_dict() for v in versions])


@teaching_content_bp.route(
    "/sections/<uuid:section_id>/versions/<int:version_no>", methods=["GET"]
)
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin", "teacher")
def get_version(section_id, version_no):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    version = TeachingSectionVersion.query.filter_by(
        section_id=section.id, version_no=version_no, is_deleted=False
    ).first()
    if not version:
        return error_response("Version not found", 404)
    return success_response(version.to_dict(include_blocks=True))


def _transition(version, action, comment=None):
    """Enforce the publish state machine; write the audit row. Returns error|None."""
    transitions = {
        "submit": {"draft": "in_review"},
        "publish": {"in_review": "published", "draft": "published"},
        "reject": {"in_review": "rejected"},
        "archive": {"published": "archived"},
        "revert": {"rejected": "draft", "archived": "draft"},
    }
    allowed = transitions.get(action)
    if not allowed:
        return error_response(f"Unknown action '{action}'", 400)
    target = allowed.get(version.status)
    if not target:
        return error_response(
            f"Cannot {action} a version in status '{version.status}'", 409
        )
    if action == "publish" and target == "published":
        # exactly one published version per section: archive any existing one
        existing = TeachingSectionVersion.query.filter(
            TeachingSectionVersion.section_id == version.section_id,
            TeachingSectionVersion.status == "published",
            TeachingSectionVersion.id != version.id,
            TeachingSectionVersion.is_deleted.is_(False),
        ).first()
        if existing:
            existing.status = "archived"
            existing.archived_at = datetime.now(timezone.utc)
        version.published_by_id = g.user_id
        version.published_at = datetime.now(timezone.utc)

    review = TeachingContentReview(
        school_id=version.school_id,
        version_id=version.id,
        action=action,
        from_status=version.status,
        to_status=target,
        actor_id=g.user_id,
        comment=comment,
    )
    version.status = target
    if action == "submit":
        version.submitted_at = datetime.now(timezone.utc)
    if action == "reject":
        version.reviewed_by_id = g.user_id
        version.reviewed_at = datetime.now(timezone.utc)
    db.session.add(review)
    return None


@teaching_content_bp.route(
    "/sections/<uuid:section_id>/versions/<int:version_no>/<string:action>",
    methods=["POST"],
)
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def version_action(section_id, version_no, action):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    denied = _require_write_access(section)
    if denied:
        return denied

    version = TeachingSectionVersion.query.filter_by(
        section_id=section.id, version_no=version_no, is_deleted=False
    ).first()
    if not version:
        return error_response("Version not found", 404)

    data = request.get_json(silent=True) or {}
    error = _transition(version, action, data.get("comment"))
    if error:
        return error
    db.session.commit()
    return success_response(version.to_dict())


@teaching_content_bp.route(
    "/sections/<uuid:section_id>/versions/<int:version_no>/clone", methods=["POST"]
)
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def clone_version(section_id, version_no):
    """'Editing' a published version: deep-clone it as the next draft.

    The published version is never mutated — lessons cite immutable ids.
    """
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    denied = _require_write_access(section)
    if denied:
        return denied

    source = TeachingSectionVersion.query.filter_by(
        section_id=section.id, version_no=version_no, is_deleted=False
    ).first()
    if not source:
        return error_response("Version not found", 404)

    next_no = (
        db.session.query(db.func.max(TeachingSectionVersion.version_no))
        .filter(TeachingSectionVersion.section_id == section.id)
        .scalar()
        or 0
    ) + 1
    clone = TeachingSectionVersion(
        school_id=source.school_id,
        section_id=source.section_id,
        version_no=next_no,
        status="draft",
        supersedes_id=source.id,
        language_coverage=source.language_coverage,
        change_note=f"cloned from v{version_no}",
        authored_by_id=g.user_id,
    )
    db.session.add(clone)
    db.session.flush()

    _clone_blocks(source, clone)
    db.session.commit()
    return created_response(clone.to_dict(include_blocks=True))


def _clone_blocks(source, clone):
    from copy import deepcopy

    from app.models.teaching_content import (
        TeachingExample,
        TeachingExamTip,
        TeachingFormula,
        TeachingKeyTerm,
        TeachingMedia,
        TeachingMisconception,
        TeachingNote,
        TeachingSectionOutcome,
    )

    media_id_map: dict = {}
    for m in source.media or []:
        nm = TeachingMedia(
            version_id=clone.id,
            media_type=m.media_type,
            file_id=m.file_id,
            external_url=m.external_url,
            svg_inline=m.svg_inline,
            alt_text_en=m.alt_text_en,
            alt_text_ne=m.alt_text_ne,
            caption_en=m.caption_en,
            caption_ne=m.caption_ne,
            licence=m.licence,
            attribution=m.attribution,
            sort_order=m.sort_order,
        )
        db.session.add(nm)
        db.session.flush()
        media_id_map[m.id] = nm.id

    for n in source.notes or []:
        db.session.add(
            TeachingNote(
                version_id=clone.id,
                block_no=n.block_no,
                block_type=n.block_type,
                heading_en=n.heading_en,
                heading_ne=n.heading_ne,
                body_en=n.body_en,
                body_ne=n.body_ne,
                speaker_note_en=n.speaker_note_en,
                speaker_note_ne=n.speaker_note_ne,
                board_hint=n.board_hint,
                media_id=media_id_map.get(n.media_id),
            )
        )
    for e in source.examples or []:
        db.session.add(
            TeachingExample(
                version_id=clone.id,
                example_no=e.example_no,
                kind=e.kind,
                difficulty=e.difficulty,
                prompt_en=e.prompt_en,
                prompt_ne=e.prompt_ne,
                given_en=e.given_en,
                given_ne=e.given_ne,
                steps=deepcopy(e.steps or []),
                answer_en=e.answer_en,
                answer_ne=e.answer_ne,
                answer_latex=e.answer_latex,
                unit_label=e.unit_label,
                marks=e.marks,
                source_ref=e.source_ref,
            )
        )
    for m in source.misconceptions or []:
        db.session.add(
            TeachingMisconception(
                version_id=clone.id,
                sort_order=m.sort_order,
                wrong_belief_en=m.wrong_belief_en,
                wrong_belief_ne=m.wrong_belief_ne,
                why_students_think_en=m.why_students_think_en,
                why_students_think_ne=m.why_students_think_ne,
                correction_en=m.correction_en,
                correction_ne=m.correction_ne,
                diagnostic_question_en=m.diagnostic_question_en,
                diagnostic_question_ne=m.diagnostic_question_ne,
                severity=m.severity,
                linked_outcome_id=m.linked_outcome_id,
            )
        )
    for f in source.formulas or []:
        db.session.add(
            TeachingFormula(
                version_id=clone.id,
                sort_order=f.sort_order,
                name_en=f.name_en,
                name_ne=f.name_ne,
                latex=f.latex,
                spoken_en=f.spoken_en,
                spoken_ne=f.spoken_ne,
                symbols=deepcopy(f.symbols or []),
                conditions_en=f.conditions_en,
                conditions_ne=f.conditions_ne,
                derivable=f.derivable,
                must_memorize=f.must_memorize,
            )
        )
    for t in source.exam_tips or []:
        db.session.add(
            TeachingExamTip(
                version_id=clone.id,
                sort_order=t.sort_order,
                tip_type=t.tip_type,
                body_en=t.body_en,
                body_ne=t.body_ne,
                exam_board=t.exam_board,
                question_pattern=t.question_pattern,
                typical_marks=t.typical_marks,
                appeared_years=deepcopy(t.appeared_years or []),
                subject_offering_id=t.subject_offering_id,
            )
        )
    for k in source.key_terms or []:
        db.session.add(
            TeachingKeyTerm(
                version_id=clone.id,
                term_en=k.term_en,
                term_ne=k.term_ne,
                keep_in_english=k.keep_in_english,
                definition_en=k.definition_en,
                definition_ne=k.definition_ne,
                sort_order=k.sort_order,
            )
        )
    for o in source.outcome_links or []:
        db.session.add(
            TeachingSectionOutcome(
                version_id=clone.id,
                outcome_id=o.outcome_id,
                emphasis=o.emphasis,
                mastery_key=o.mastery_key,
                sort_order=o.sort_order,
            )
        )


# ── Block CRUD (attach to a DRAFT version only) ────────────────────────────


@teaching_content_bp.route(
    "/sections/<uuid:section_id>/versions/<int:version_no>/blocks/<string:block_kind>",
    methods=["PUT"],
)
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin")
def replace_blocks(section_id, version_no, block_kind):
    """Replace a version's block list wholesale (the admin editor's save).

    Only DRAFT versions accept block edits — published content is immutable.
    """
    if block_kind not in BLOCK_MODELS:
        return error_response(
            f"block_kind must be one of: {', '.join(sorted(BLOCK_MODELS))}", 400
        )
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    denied = _require_write_access(section)
    if denied:
        return denied

    version = TeachingSectionVersion.query.filter_by(
        section_id=section.id, version_no=version_no, is_deleted=False
    ).first()
    if not version:
        return error_response("Version not found", 404)
    if version.status != "draft":
        return error_response(
            "Only draft versions are editable — clone the published version first "
            "(POST .../clone).",
            409,
        )

    data = request.get_json(silent=True) or {}
    items = data.get("items")
    if not isinstance(items, list):
        return error_response("body must be {\"items\": [...]}", 400)

    module_name, class_name = BLOCK_MODELS[block_kind]
    model = getattr(__import__(module_name, fromlist=[class_name]), class_name)

    order_field = {"notes": "block_no", "examples": "example_no"}.get(
        block_kind, "sort_order"
    )
    for existing in getattr(version, block_kind) or []:
        db.session.delete(existing)
    db.session.flush()

    created = []
    for idx, item in enumerate(items, start=1):
        fields = _block_fields(model, item)
        fields.setdefault(order_field, idx)
        if block_kind == "notes":
            fields["version_id"] = version.id
        elif block_kind == "media":
            fields["version_id"] = version.id
        else:
            fields["version_id"] = version.id
        row = model(**fields)
        db.session.add(row)
        created.append(row)
    db.session.flush()

    _update_language_coverage(version)
    db.session.commit()
    return success_response(version.to_dict(include_blocks=True))


def _block_fields(model, item: dict) -> dict:
    """Map a JSON block dict onto model columns; unknown keys are ignored."""
    columns = set(model.__table__.columns.keys())
    skip = {"id", "created_at", "updated_at", "is_deleted", "version_id"}
    fields = {}
    for key, value in (item or {}).items():
        if key in columns and key not in skip:
            fields[key] = value
    return fields


def _update_language_coverage(version):
    """language_coverage reflects whether EN and NE content actually exist."""
    coverage = {"en": False, "ne": False}
    if version.notes:
        coverage["en"] = all(n.body_en for n in version.notes)
        coverage["ne"] = all(n.body_ne for n in version.notes)
    version.language_coverage = coverage


@teaching_content_bp.route(
    "/sections/<uuid:section_id>/versions/<int:version_no>/reviews", methods=["GET"]
)
@jwt_required()
@school_required
@plugin_required("ai_teacher")
@role_required("superadmin", "school_admin", "teacher")
def version_reviews(section_id, version_no):
    section = _load_section(section_id)
    if not section:
        return error_response("Teaching section not found", 404)
    version = TeachingSectionVersion.query.filter_by(
        section_id=section.id, version_no=version_no, is_deleted=False
    ).first()
    if not version:
        return error_response("Version not found", 404)
    reviews = (
        TeachingContentReview.query.filter_by(version_id=version.id, is_deleted=False)
        .order_by(TeachingContentReview.created_at.desc())
        .all()
    )
    return success_response([r.to_dict() for r in reviews])
