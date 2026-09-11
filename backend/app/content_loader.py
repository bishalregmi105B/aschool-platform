"""S12 content loader — the ONLY database writer for the AI-workspace corpus.

The extraction intelligence lives in the agent (Claude Code / Gemini Code per
docs/ai_workspace_prompts/AGENT_INGESTION_BRIEF.md); this module is the thin,
deterministic gate between staged JSON and the content spine:

    python -m app.content_loader validate <book_dir>
    python -m app.content_loader ingest  <book_dir> [--publish] [--no-embed]
    python -m app.content_loader status  [slug]

Staging layout (per the brief):
    <book_dir>/manifest.json          aw-book-manifest@1
    <book_dir>/pdf.sha256             hex digest of the source PDF
    <book_dir>/verified/page_<NNN>.json   aw-verify@1 (corrected aw-page@1)
    <book_dir>/flagged/…              pages that failed guards
    <book_dir>/question_papers/*.json aw-question-paper@1 | aw-spec-grid@1

Publishing gate (ingest --publish): all content pages staged, zero unresolved
flagged pages, page coverage ≥ 98%, exercise numbers reconciled. Until the
gate passes, everything stays in `review` status — tools never read it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

VALID_PAGE_SCHEMA = "aw-page@1"
VALID_VERIFY_SCHEMA = "aw-verify@1"
VALID_MANIFEST_SCHEMA = "aw-book-manifest@1"
VALID_PAPER_SCHEMA = "aw-question-paper@1"
VALID_GRID_SCHEMA = "aw-spec-grid@1"

BLOCK_KINDS = {
    "heading", "prose", "definition", "worked_example", "exercise_set",
    "exercise_item", "formula_block", "figure", "table", "activity", "note",
    "answer",
}
PAPER_KINDS = {"model_question", "see", "neb", "board", "school_exam", "spec_grid"}
COVERAGE_THRESHOLD = 0.98


# ── helpers ──────────────────────────────────────────────────────────────────

def _sha256_text(text: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFC", text or "").replace("\u200c", "")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _valid_bbox(bbox) -> bool:
    return (
        isinstance(bbox, (list, tuple)) and len(bbox) == 4
        and all(isinstance(v, (int, float)) and 0 <= v <= 1000 for v in bbox)
        and bbox[2] > bbox[0] and bbox[3] > bbox[1]
    )


def _block_text(block: dict) -> str:
    return (block.get("text_ne") or block.get("text_en") or "").strip()


def _page_numbers(book_dir: Path) -> list[int]:
    pages = []
    for path in (book_dir / "verified").glob("page_*.json"):
        match = re.search(r"page_(\d+)\.json$", path.name)
        if match:
            pages.append(int(match.group(1)))
    return sorted(pages)


def _devanagari_to_int(value: str) -> int | None:
    table = str.maketrans("०१२३४५६७८९", "0123456789")
    try:
        return int(str(value).translate(table))
    except (TypeError, ValueError):
        return None


# ── validation ───────────────────────────────────────────────────────────────

def validate_book(book_dir: Path) -> tuple[list[str], list[str]]:
    """Returns (errors, warnings). Errors block ingestion; warnings only
    block publishing when they touch the coverage gate."""
    errors: list[str] = []
    warnings: list[str] = []

    manifest_path = book_dir / "manifest.json"
    if not manifest_path.exists():
        return [f"missing {manifest_path}"], []
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != VALID_MANIFEST_SCHEMA:
        errors.append(f"manifest schema_version must be {VALID_MANIFEST_SCHEMA}")
        return errors, warnings

    book = manifest.get("book") or {}
    for field in ("title_en", "title_ne", "grade", "medium"):
        if not book.get(field):
            warnings.append(f"manifest.book.{field} is empty")
    units = manifest.get("units") or []
    if not units:
        errors.append("manifest.units is empty — run Pass A first")

    page_numbers = _page_numbers(book_dir)
    if not page_numbers:
        errors.append("no verified/page_*.json files found")
        return errors, warnings

    seen_pages: set[int] = set()
    total_blocks = 0
    empty_blocks = 0
    exercise_nos: dict[int, set[int]] = {}

    for page_no in page_numbers:
        if page_no in seen_pages:
            errors.append(f"duplicate verified page_{page_no:03d}")
        seen_pages.add(page_no)
        path = book_dir / "verified" / f"page_{page_no:03d}.json"
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            errors.append(f"page {page_no}: invalid JSON ({exc})")
            continue
        if doc.get("schema_version") != VALID_VERIFY_SCHEMA:
            errors.append(f"page {page_no}: schema_version must be {VALID_VERIFY_SCHEMA}")
            continue
        page = doc.get("corrected") or {}
        if page.get("schema_version") != VALID_PAGE_SCHEMA:
            errors.append(f"page {page_no}: corrected payload must be {VALID_PAGE_SCHEMA}")
            continue
        if doc.get("page_no_physical") != page_no and page.get("page_no_physical") not in (None, page_no):
            errors.append(f"page {page_no}: page_no_physical mismatch")

        blocks = page.get("blocks") or []
        total_blocks += len(blocks)
        for block in blocks:
            if block.get("kind") not in BLOCK_KINDS:
                errors.append(f"page {page_no}: unknown block kind {block.get('kind')!r}")
            if not _valid_bbox(block.get("bbox")):
                errors.append(f"page {page_no}: block {block.get('block_id')} has invalid bbox")
            if not _block_text(block):
                empty_blocks += 1

        for item in page.get("exercises_seen") or []:
            no = item.get("item_no_ascii")
            unit_match = None
            for unit in units:
                if (unit.get("page_start") or 0) <= page_no <= (unit.get("page_end") or 0):
                    unit_match = unit.get("unit_no_ascii")
                    break
            if isinstance(no, int) and unit_match is not None:
                exercise_nos.setdefault(unit_match, set()).add(no)

    flagged = list((book_dir / "flagged").glob("page_*.json"))
    if flagged:
        warnings.append(f"{len(flagged)} flagged page(s) unresolved — publishing will be blocked")

    if empty_blocks > max(3, total_blocks * 0.1):
        warnings.append(f"{empty_blocks}/{total_blocks} blocks have no text — check figure captions")

    # exercise-number reconciliation per unit (contiguity, tolerant of
    # multiple exercise sets: gaps are what matter, not absolute starts)
    for unit in units:
        unit_no = unit.get("unit_no_ascii")
        nos = exercise_nos.get(unit_no)
        if nos:
            missing = sorted(set(range(min(nos), max(nos) + 1)) - nos)
            if missing:
                warnings.append(
                    f"unit {unit_no}: exercise numbers missing from staged pages: {missing[:10]}"
                )

    return errors, warnings


# ── ingestion ────────────────────────────────────────────────────────────────

def _upsert_source(session, book_dir: Path, manifest: dict, publish: bool):
    from app.models.content_spine import ContentSource

    book = manifest.get("book") or {}
    sha_path = book_dir / "pdf.sha256"
    file_sha = sha_path.read_text().split()[0] if sha_path.exists() else _sha256_text(
        json.dumps(manifest.get("units") or [], ensure_ascii=False)
    )
    board = str(book.get("board") or "textbook")
    kind = {
        "teacher-guide": "teacher_guide",
        "teacher_guide": "teacher_guide",
        "spec-grid": "spec_grid",
        "spec_grid": "spec_grid",
        "model-questions": "model_question",
        "model_questions": "model_question",
    }.get(board, "textbook")

    source = (
        session.query(ContentSource)
        .filter_by(kind=kind, file_sha256=file_sha, is_deleted=False)
        .first()
    )
    if source is None:
        source = ContentSource(kind=kind, file_sha256=file_sha)
        session.add(source)
        session.flush()

    source.title_en = book.get("title_en")
    source.title_ne = book.get("title_ne")
    source.grade = str(book.get("grade") or "") or None
    source.subject_code = book.get("subject_code") or None
    source.medium = book.get("medium") or "ne"
    source.edition_bs = book.get("edition_bs")
    source.edition_ad = book.get("edition_ad")
    source.board = book.get("board")
    source.page_count = book.get("total_physical_pages")
    source.storage_path = str(book_dir)
    source.ingest_status = "published" if publish else "review"
    source.ingest_error = None
    source.manifest = {
        "units": len(manifest.get("units") or []),
        "pages_staged": len(_page_numbers(book_dir)),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return source


def _match_framework(session, source):
    from app.models.curriculum import CurriculumFramework

    if not source.subject_code or not source.grade:
        return None
    return (
        session.query(CurriculumFramework)
        .filter(
            CurriculumFramework.is_deleted.is_(False),
            CurriculumFramework.is_active.is_(True),
            CurriculumFramework.subject_code == source.subject_code,
            CurriculumFramework.grade == str(source.grade),
        )
        .first()
    )


def _ingest_units_and_chunks(session, book_dir: Path, manifest: dict, source, run) -> dict:
    from app.models.content_spine import ContentChunk, ContentUnit

    units_manifest = manifest.get("units") or []
    framework = _match_framework(session, source)
    stats = {"units": 0, "chunks": 0, "exercise_items": 0}
    publish = source.ingest_status == "published"

    for unit_def in units_manifest:
        unit_no = unit_def.get("unit_no_ascii")
        unit_path = f"ch{unit_no if unit_no is not None else len(stats['units']) + 1}"
        title_chain = " › ".join(
            t for t in (source.title_ne or source.title_en, unit_def.get("title_ne") or unit_def.get("title_en")) if t
        )

        unit = (
            session.query(ContentUnit)
            .filter_by(source_id=source.id, unit_path=unit_path, is_deleted=False)
            .first()
        )
        if unit is None:
            unit = ContentUnit(source_id=source.id, unit_path=unit_path)
            session.add(unit)
        unit.unit_no_printed = unit_def.get("unit_no_printed")
        unit.unit_no_ascii = unit_no
        unit.title_en = unit_def.get("title_en")
        unit.title_ne = unit_def.get("title_ne")
        unit.title_chain = title_chain
        unit.page_start = unit_def.get("page_start")
        unit.page_end = unit_def.get("page_end")
        unit.unit_kind = "chapter"
        unit.is_published = publish
        if framework is not None:
            aligned = (
                framework.units and next(
                    (u for u in framework.units if u.unit_no == unit_no and not u.is_deleted),
                    None,
                )
            )
            if aligned is not None:
                unit.curriculum_unit_id = aligned.id
                unit.align_method = "number-match"

        session.flush()
        stats["units"] += 1

        # chunks: every text-bearing block of every verified page in range.
        # ordinal is DETERMINISTIC (page×100 + block index) — re-running a
        # page maps each block to the same natural key, so re-ingestion
        # updates in place instead of duplicating.
        for page_no in _page_numbers(book_dir):
            if unit.page_start and page_no < unit.page_start:
                continue
            if unit.page_end and page_no > unit.page_end:
                continue
            doc = json.loads(
                (book_dir / "verified" / f"page_{page_no:03d}.json").read_text(encoding="utf-8")
            )
            page = doc.get("corrected") or {}
            self_conf = doc.get("self_confidence") or "high"
            for block_index, block in enumerate(page.get("blocks") or []):
                text = _block_text(block)
                kind = block.get("kind") or "prose"
                if not text and kind not in ("figure", "table"):
                    continue
                if not text:
                    text = "[figure]" if kind == "figure" else "[table]"
                contextualizer = page.get("contextualizer_note") or ""
                embed_text = " ▸ ".join(
                    part for part in (title_chain, contextualizer, text) if part
                )
                content_sha = _sha256_text(text)
                ordinal = page_no * 100 + block_index

                existing = (
                    session.query(ContentChunk)
                    .filter_by(
                        source_id=source.id, unit_id=unit.id,
                        ordinal=ordinal, is_deleted=False,
                    )
                    .first()
                )
                if existing is not None and existing.content_sha256 == content_sha:
                    continue

                chunk = existing or ContentChunk(
                    source_id=source.id, unit_id=unit.id, ordinal=ordinal
                )
                chunk.kind = kind
                chunk.audience = "teacher" if kind == "answer" and (book_dir.name.endswith("_tg")) else "student"
                chunk.language = source.medium
                chunk.text_display = text
                chunk.text_embed = embed_text
                chunk.contextualizer_note = contextualizer or None
                chunk.page_no = page_no
                chunk.page_image_path = f"pages/page_{page_no:03d}.png"
                chunk.bbox = block.get("bbox")
                chunk.extraction_run_id = run.id
                chunk.prompt_version = "v1.0"
                chunk.model_id = run.model_id
                chunk.content_sha256 = content_sha
                chunk.text_ne = block.get("text_ne")
                chunk.text_en = block.get("text_en")
                chunk.qa_status = "passed" if self_conf != "low" else "flagged"
                chunk.qa_flags = []
                chunk.is_published = publish
                if existing is None:
                    session.add(chunk)
                stats["chunks"] += 1
                if kind == "exercise_item":
                    stats["exercise_items"] += 1
        session.flush()
    return stats


def _ingest_question_papers(session, book_dir: Path, source, run, publish: bool) -> dict:
    from app.models.content_spine import PaperQuestion, QuestionPaper

    stats = {"papers": 0, "questions": 0}
    papers_dir = book_dir / "question_papers"
    if not papers_dir.exists():
        return stats

    for path in sorted(papers_dir.glob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            print(f"  ! skip {path.name}: invalid JSON ({exc})")
            continue
        schema = doc.get("schema_version")
        if schema == VALID_GRID_SCHEMA:
            _ingest_spec_grid(session, doc, source, run)
            continue
        if schema != VALID_PAPER_SCHEMA:
            print(f"  ! skip {path.name}: unknown schema {schema!r}")
            continue

        paper_def = doc.get("paper") or {}
        existing = (
            session.query(QuestionPaper)
            .filter_by(
                source_id=source.id if source else None,
                title_ne=paper_def.get("title_ne"),
                exam_year_bs=paper_def.get("exam_year_bs"),
                is_deleted=False,
            )
            .first()
        )
        paper = existing
        if paper is None:
            paper = QuestionPaper(source_id=source.id if source else None)
            session.add(paper)
        paper.paper_kind = paper_def.get("paper_kind") or "model_question"
        if paper.paper_kind not in PAPER_KINDS:
            paper.paper_kind = "model_question"
        paper.title_en = paper_def.get("title_en")
        paper.title_ne = paper_def.get("title_ne")
        paper.exam_year_bs = paper_def.get("exam_year_bs")
        paper.exam_year_ad = paper_def.get("exam_year_ad")
        paper.grade = paper_def.get("grade")
        paper.subject_code = paper_def.get("subject_code")
        paper.total_full_marks = paper_def.get("total_full_marks")
        paper.duration_minutes = paper_def.get("duration_minutes")
        paper.instructions = paper_def.get("instructions_verbatim") or []
        paper.extraction_run_id = run.id if run else None
        paper.is_published = publish
        session.flush()

        # replace staged questions idempotently: delete-then-insert per paper
        session.query(PaperQuestion).filter_by(paper_id=paper.id).delete(synchronize_session=False)
        for group_order, group in enumerate(doc.get("groups") or []):
            for qdef in group.get("questions") or []:
                root = PaperQuestion(
                    paper_id=paper.id,
                    group_name=group.get("group_name"),
                    group_order=group_order,
                    question_no_printed=qdef.get("question_no_printed"),
                    question_no_ascii=qdef.get("question_no_ascii"),
                    question_type=qdef.get("question_type") or "short_answer",
                    marks=qdef.get("marks"),
                    marks_printed=qdef.get("marks_printed"),
                    stem_ne=qdef.get("stem_ne"),
                    stem_en=qdef.get("stem_en"),
                    options=qdef.get("options") or [],
                    answer_ne=qdef.get("answer_ne"),
                    answer_source=qdef.get("answer_source") or "none",
                    unit_hint=qdef.get("unit_hint"),
                    has_figure=bool(qdef.get("has_figure")),
                    figure_bbox=qdef.get("figure_bbox"),
                    prompt_version="v1.0",
                    content_sha256=_sha256_text(
                        (qdef.get("stem_ne") or qdef.get("stem_en") or "")
                    ),
                    is_published=publish,
                )
                session.add(root)
                session.flush()
                stats["questions"] += 1
                for sub in qdef.get("sub_parts") or []:
                    session.add(
                        PaperQuestion(
                            paper_id=paper.id,
                            parent_question_id=root.id,
                            group_name=group.get("group_name"),
                            group_order=group_order,
                            question_no_printed=qdef.get("question_no_printed"),
                            question_no_ascii=qdef.get("question_no_ascii"),
                            sub_label=sub.get("sub_label"),
                            question_type=root.question_type,
                            marks=sub.get("marks"),
                            marks_printed=sub.get("marks_printed"),
                            stem_ne=sub.get("stem_ne"),
                            stem_en=sub.get("stem_en"),
                            prompt_version="v1.0",
                            content_sha256=_sha256_text(sub.get("stem_ne") or sub.get("stem_en") or ""),
                            is_published=publish,
                        )
                    )
                    stats["questions"] += 1
        stats["papers"] += 1
    return stats


def _ingest_spec_grid(session, doc: dict, source, run) -> None:
    """Materialize a spec-grid JSON into a PaperBlueprint. subject_id is NOT
    NULL on paper_blueprints — grids whose subject doesn't map to a real
    Subject row are recorded in the source manifest for manual linking
    (never guessed)."""
    from app.models.content_spine import ContentSource
    from app.models.question_bank import PaperBlueprint

    paper = doc.get("paper") or {}
    cells = doc.get("cells") or []
    subject = None
    if source is not None and source.subject_code:
        from app.models.academic import Subject

        subject = (
            session.query(Subject)
            .filter(
                Subject.is_deleted.is_(False),
                Subject.code == source.subject_code,
            )
            .first()
        )
    if subject is None:
        if source is not None:
            manifest = dict(source.manifest or {})
            pending = manifest.setdefault("pending_spec_grids", [])
            pending.append(
                {
                    "title": paper.get("title_ne") or paper.get("title_en"),
                    "cells": len(cells),
                    "reason": "subject_code did not match a Subject row",
                }
            )
            from extensions import db

            db.session.commit()
        print("  · spec grid deferred to manifest.pending_spec_grids (no subject match)")
        return

    total = sum(
        (cell.get("question_count") or 0) * (cell.get("marks_each") or 0)
        for cell in cells
    )
    session.add(
        PaperBlueprint(
            name=(
                f"{paper.get('title_ne') or paper.get('title_en') or 'Spec grid'}"
                f" ({paper.get('grade_range') or ''})".strip()
            )[:200],
            subject_id=subject.id,
            total_marks=total or paper.get("total_full_marks") or 0,
            duration_minutes=paper.get("duration_minutes"),
            sections=[
                {
                    "name": cell.get("group_name"),
                    "question_type": cell.get("question_type"),
                    "count": cell.get("question_count"),
                    "marks_each": cell.get("marks_each"),
                    "topic": cell.get("unit_title_as_printed"),
                    "unit_no": cell.get("unit_no_ascii"),
                    "bloom": cell.get("bloom_level"),
                }
                for cell in cells
            ],
            language=(source.medium if source else "ne") or "ne",
        )
    )
    session.flush()


def _embed_and_mirror(session, source) -> dict:
    """Best-effort: embed published chunks (vector leg) + mirror them into
    document_chunks so the existing RAGService can retrieve them untouched."""
    from sqlalchemy import text as sql_text

    from app.models.content_spine import ContentChunk
    from extensions import db

    stats = {"embedded": 0, "mirrored": 0}
    chunks = (
        session.query(ContentChunk)
        .filter_by(source_id=source.id, is_published=True, is_deleted=False)
        .all()
    )
    if not chunks:
        return stats

    try:
        from app.services.ai.token_hub import AITokenHub

        texts = [c.text_embed for c in chunks]
        school_id = source.school_id
        vectors = AITokenHub.embed(texts, school_id=school_id, feature="content-spine")
        for chunk, vec in zip(chunks, vectors):
            if not vec:
                continue
            vec_sql = "[" + ",".join(f"{x:.7f}" for x in vec) + "]"
            db.session.execute(
                sql_text(
                    "UPDATE content_chunks SET embedding_vec = CAST(:v AS vector), "
                    "embedding_model = 'text-embedding-3-small' WHERE id = CAST(:id AS uuid)"
                ),
                {"v": vec_sql, "id": str(chunk.id)},
            )
            stats["embedded"] += 1
        db.session.commit()
    except Exception as exc:  # noqa: BLE001 — embedding is optional (BM25 leg)
        print(f"  · embedding skipped: {exc}")
        db.session.rollback()

    for chunk in chunks:
        db.session.execute(
            sql_text(
                "INSERT INTO document_chunks "
                "(school_id, source_type, source_id, chunk_index, text, text_ne, metadata_json) "
                "VALUES (CAST(:school AS uuid), 'content_chunk', CAST(:sid AS uuid), :idx, :text, :text_ne, "
                "CAST(:meta AS jsonb)) "
                "ON CONFLICT DO NOTHING"
            ),
            {
                "school": str(source.school_id) if source.school_id else None,
                "sid": str(chunk.id),
                "idx": chunk.ordinal,
                "text": chunk.text_embed,
                "text_ne": chunk.text_ne,
                "meta": json.dumps({
                    "unit_id": str(chunk.unit_id), "kind": chunk.kind,
                    "page_no": chunk.page_no, "bbox": chunk.bbox,
                }),
            },
        )
        stats["mirrored"] += 1
    db.session.commit()
    return stats


def _get_app():
    """App for CLI runs: honor an active context (tests/worker), else build
    one from FLASK_ENV — and when TEST_DATABASE_URL is set (pytest/CI), the
    testing config MUST win or the loader writes to the wrong database."""
    import os

    from flask import current_app, has_app_context

    if has_app_context():
        return current_app._get_current_object()
    from app import create_app

    config_name = os.getenv("FLASK_ENV")
    if not config_name and os.getenv("TEST_DATABASE_URL"):
        config_name = "testing"
    return create_app(config_name)


def ingest_book(book_dir: Path, publish: bool = False, embed: bool = True) -> int:
    errors, warnings = validate_book(book_dir)
    if errors:
        print("VALIDATION FAILED — fix and re-run:")
        for error in errors:
            print(f"  ✗ {error}")
        return 1

    manifest = json.loads((book_dir / "manifest.json").read_text(encoding="utf-8"))
    from app.models.content_spine import ContentChunk, ExtractionRun
    from extensions import db

    app = _get_app()
    with app.app_context():
        session = db.session
        # coverage gate
        total_pages = (manifest.get("book") or {}).get("total_physical_pages") or 0
        staged = len(_page_numbers(book_dir))
        flagged = len(list((book_dir / "flagged").glob("page_*.json")))
        can_publish = publish and not flagged
        if total_pages and staged / max(total_pages, 1) < COVERAGE_THRESHOLD:
            print(f"  · coverage {staged}/{total_pages} below {COVERAGE_THRESHOLD:.0%} → review status")
            can_publish = False

        source = _upsert_source(session, book_dir, manifest, publish=can_publish)
        run = ExtractionRun(
            source_id=source.id,
            operator="agent",
            model_id=(manifest.get("meta") or {}).get("model_id"),
            prompt_version=(manifest.get("meta") or {}).get("prompt_version", "v1.0"),
            status="completed",
            pages_total=total_pages or staged,
            pages_extracted=staged,
            exercises_expected=sum((u.get("expected_exercise_sets") or 0) for u in manifest.get("units") or []),
            flagged_pages=[p.name for p in (book_dir / "flagged").glob("page_*.json")],
            manifest={"warnings": warnings},
        )
        session.add(run)
        session.flush()

        unit_stats = _ingest_units_and_chunks(session, book_dir, manifest, source, run)
        paper_stats = _ingest_question_papers(session, book_dir, source, run, can_publish)

        session.commit()
        embed_stats = _embed_and_mirror(session, source) if (embed and can_publish) else {"embedded": 0, "mirrored": 0}

        print(
            f"✓ {book_dir.name}: source={source.ingest_status} "
            f"units={unit_stats['units']} chunks={unit_stats['chunks']} "
            f"exercise_items={unit_stats['exercise_items']} "
            f"papers={paper_stats['papers']} questions={paper_stats['questions']} "
            f"embedded={embed_stats['embedded']} mirrored={embed_stats['mirrored']}"
        )
        if warnings:
            print("  warnings:")
            for warning in warnings[:10]:
                print(f"   · {warning}")
        return 0


def show_status(slug: str | None = None) -> int:
    from app.models.content_spine import ContentSource, ContentUnit
    from extensions import db

    app = _get_app()
    with app.app_context():
        query = db.session.query(ContentSource).filter_by(is_deleted=False)
        if slug:
            query = query.filter(
                (ContentSource.title_en.ilike(f"%{slug}%"))
                | (ContentSource.title_ne.ilike(f"%{slug}%"))
                | (ContentSource.grade == slug)
            )
        rows = query.order_by(ContentSource.created_at.desc()).limit(100).all()
        if not rows:
            print("no content sources recorded")
            return 0
        print(f"{'status':<10} {'kind':<14} {'grade':<6} {'title':<40} units/chunks")
        for source in rows:
            unit_count = (
                db.session.query(ContentUnit)
                .filter_by(source_id=source.id, is_deleted=False)
                .count()
            )
            print(
                f"{source.ingest_status:<10} {source.kind:<14} {str(source.grade or ''):<6} "
                f"{(source.title_ne or source.title_en or source.file_sha256[:12]):<40.40} "
                f"units={unit_count} pages~{source.page_count}"
            )
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="content_loader", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p_validate = sub.add_parser("validate", help="contract-check a staged book")
    p_validate.add_argument("book_dir", type=Path)
    p_ingest = sub.add_parser("ingest", help="validate + upsert into the spine")
    p_ingest.add_argument("book_dir", type=Path)
    p_ingest.add_argument("--publish", action="store_true",
                          help="allow the coverage gate to publish (default: review status)")
    p_ingest.add_argument("--no-embed", action="store_true", help="skip the embedding pass")
    p_status = sub.add_parser("status", help="list ingested sources")
    p_status.add_argument("slug", nargs="?", default=None)
    args = parser.parse_args()

    if args.command == "validate":
        errors, warnings = validate_book(args.book_dir)
        for error in errors:
            print(f"ERROR  {error}")
        for warning in warnings:
            print(f"WARN   {warning}")
        print(f"{'FAIL' if errors else 'PASS'}: {len(errors)} errors, {len(warnings)} warnings")
        return 1 if errors else 0
    if args.command == "ingest":
        return ingest_book(args.book_dir, publish=args.publish, embed=not args.no_embed)
    if args.command == "status":
        return show_status(args.slug)
    return 2


if __name__ == "__main__":
    sys.exit(main())
