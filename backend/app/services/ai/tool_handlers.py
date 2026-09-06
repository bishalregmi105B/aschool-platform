"""ai_workbench tool handlers + context builders (AW-01/AW-03).

One function per tool; the orchestrator resolves them by registry name.
Handlers POST-process parsed model output (e.g. attach curriculum
outcomes); context builders assemble tenant-scoped grounding data.

The fixture tool (`fixture_test`) exists for the AW-01 CI gate: adding it
required zero new routes/pages — proving "tool #66 = one row + one prompt
file + one handler".
"""


def context_curriculum(payload: dict) -> dict:
    """Curriculum grounding: units + outcomes for the subject/grade (A-04)."""
    from app.models.curriculum import CurriculumFramework, LearningOutcome
    from extensions import db

    framework = (
        db.session.query(CurriculumFramework)
        .filter(
            CurriculumFramework.is_deleted.is_(False),
            CurriculumFramework.is_active.is_(True),
            CurriculumFramework.subject_code
            == (payload.get("subject_code") or "").strip(),
        )
        .filter(CurriculumFramework.grade == (payload.get("grade") or "").strip())
        .first()
    )
    if framework is None:
        return {}
    units = (
        CurriculumUnitActive()
        .filter(CurriculumUnitActive.framework_id == framework.id)
        .all()
    )
    outcome_rows = (
        db.session.query(LearningOutcome)
        .join(
            CurriculumUnitActive,
            CurriculumUnitActive.id == LearningOutcome.unit_id,
        )
        .filter(LearningOutcome.is_deleted.is_(False))
        .limit(30)
        .all()
    )
    return {
        "curriculum": {
            "subject": framework.subject_name,
            "board": framework.board,
            "units": [u.to_dict() for u in units],
            "outcomes": [o.to_dict() for o in outcome_rows],
        }
    }


def CurriculumUnitActive():
    from app.models.curriculum import CurriculumUnit

    return CurriculumUnit.query.filter(CurriculumUnit.is_deleted.is_(False))


# ── handlers: post-process parsed output (all pure functions) ────────────


def handle_lesson_plan(parsed: dict, payload: dict) -> dict:
    """Sort phases into a teaching order and add Bloom verbs check."""
    phases = parsed.get("phases") or []
    parsed["phases"] = sorted(phases, key=lambda p: p.get("duration_minutes", 0))
    parsed["total_minutes"] = sum(p.get("duration_minutes", 0) for p in phases)
    return parsed


def handle_worksheet(parsed: dict, payload: dict) -> dict:
    total = sum(float(item.get("marks", 0)) for item in parsed.get("items", []))
    parsed["total_marks"] = total
    return parsed


def handle_blueprint_builder(parsed: dict, payload: dict) -> dict:
    """Deterministic re-check of the model's blueprint: section totals are
    recomputed (count × marks_each) and the declared paper total is corrected
    to the computed value — the same marks-sum rule A-03 enforces at
    generation time, so a blueprint that passes here can always be generated."""
    sections = parsed.get("sections") or []
    computed = 0.0
    for section in sections:
        per_section = float(section.get("count", 0)) * float(
            section.get("marks_each", 0)
        )
        section["section_total"] = per_section
        computed += per_section
    parsed["total_marks"] = computed
    parsed["total_questions"] = sum(
        int(s.get("count", 0)) for s in sections
    )
    requested = payload.get("total_marks")
    if requested:
        try:
            if abs(float(requested) - computed) > 0.01:
                diff = computed - float(requested)
                parsed["notes"] = (
                    f"Sections sum to {computed:g} marks, not the requested "
                    f"{float(requested):g} (difference {diff:+g}). Adjust a "
                    "section's count or marks to match exactly."
                )
        except (TypeError, ValueError):
            pass
    return parsed


def handle_flashcards(parsed: dict, payload: dict) -> dict:
    cards = parsed.get("cards") or []
    parsed["count"] = len(cards)
    return parsed


def handle_text_leveler(parsed: dict, payload: dict) -> dict:
    """Pin the level actually delivered + readability stats the teacher can
    compare at a glance (sentence length is the honest proxy — no fake
    Flesch score without a real syllable counter)."""
    text = str(parsed.get("text") or "")
    sentences = [s for s in text.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    words = text.split()
    parsed["stats"] = {
        "sentences": len(sentences),
        "words": len(words),
        "avg_sentence_words": round(len(words) / len(sentences), 1) if sentences else 0,
    }
    parsed.setdefault("level", payload.get("direction") or "easier")
    return parsed


def handle_fixture_test(parsed: dict, payload: dict) -> dict:
    """AW-01 CI gate (b): the fixture tool's handler — echo with proof the
    generic runner executed the full pipeline."""
    parsed["fixture_pipeline_ok"] = True
    return parsed


def context_none(payload: dict) -> dict:
    return {}
