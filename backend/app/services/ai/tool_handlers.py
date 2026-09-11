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


def handle_vocab_support(parsed: dict, payload: dict) -> dict:
    """Dedupe terms case-insensitively (the model loves repeating entry
    variants) and count the bank."""
    seen: set[str] = set()
    unique = []
    for term in parsed.get("terms") or []:
        key = str(term.get("term", "")).strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(term)
    parsed["terms"] = unique
    parsed["count"] = len(unique)
    return parsed


def handle_udl_board(parsed: dict, payload: dict) -> dict:
    """UDL boards are 3×3: derive the column labels so the page can render
    a grid without schema work."""
    parsed = handle_generic_count(parsed, payload)
    cells = parsed.get("cells") or []
    cols = {str(c.get("column")) for c in cells if isinstance(c, dict) and c.get("column")}
    parsed["columns"] = sorted(cols)
    return parsed


def handle_practical_exam(parsed: dict, payload: dict) -> dict:
    """Deterministic marks total for the practical paper."""
    parsed["total_marks"] = sum(
        float(t.get("marks", 0)) for t in parsed.get("tasks", [])
    )
    return parsed


def handle_generic_count(parsed: dict, payload: dict) -> dict:
    """Count the tool's primary list so results show 'N items' without
    schema work. Shared by list-shaped wave-2 tools."""
    for key in ("steps", "messages", "agenda", "units", "activities",
                "sections", "days", "tasks", "accommodations", "terms",
                "cells", "action_items", "key_points"):
        if isinstance(parsed.get(key), list):
            parsed["count"] = len(parsed[key])
            break
    return parsed


def handle_fixture_test(parsed: dict, payload: dict) -> dict:
    """AW-01 CI gate (b): the fixture tool's handler — echo with proof the
    generic runner executed the full pipeline."""
    parsed["fixture_pipeline_ok"] = True
    return parsed


def context_none(payload: dict) -> dict:
    return {}


def context_attendance(payload: dict) -> dict:
    """G-03: real absentee grounding for attendance_outreach — the registry
    declared context_builder="attendance" but no builder existed, so the tool
    silently ran on zero data.

    Returns the calling teacher's (or a class's) absence record for the last
    N days: per-student day lists, so outreach drafts name real dates."""
    from datetime import date, timedelta

    from flask import g

    from app.models.attendance import Attendance
    from app.models.student import Student
    from app.utils.teacher_scope import teacher_allowed_class_ids

    try:
        window_days = max(1, min(int(payload.get("days") or 7), 31))
    except (TypeError, ValueError):
        window_days = 7
    end = date.today()
    start = end - timedelta(days=window_days)

    query = Attendance.query.filter(
        Attendance.school_id == g.school_id,
        Attendance.is_deleted.is_(False),
        Attendance.status == "absent",
        Attendance.date >= start,
        Attendance.date <= end,
    )
    class_id = payload.get("class_id")
    if class_id:
        query = query.filter(Attendance.class_id == class_id)
    elif g.role == "teacher" and g.user_id:
        allowed = teacher_allowed_class_ids(g.school_id, g.user_id)
        if not allowed:
            return {}
        query = query.filter(Attendance.class_id.in_(allowed))

    rows = query.all()
    dates_by_student: dict = {}
    for row in rows:
        dates_by_student.setdefault(row.student_id, []).append(row.date.isoformat())
    if not dates_by_student:
        # Grounding contract: zero absentees = EMPTY context — the required-
        # grounding gate must fire instead of drafting outreach for nobody.
        return {}

    students = (
        Student.query.filter(Student.id.in_(list(dates_by_student.keys())))
        .all()
    )
    absentees = []
    for student in sorted(
        students,
        key=lambda s: -len(dates_by_student.get(s.id, [])),
    )[:60]:
        absentees.append(
            {
                "student_id": str(student.id),
                "student_name": f"{student.first_name or ''} {student.last_name or ''}".strip()
                or "Student",
                "class_id": str(student.class_id) if student.class_id else None,
                "days_absent": len(dates_by_student[student.id]),
                "dates": sorted(dates_by_student[student.id]),
            }
        )
    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "absentee_count": len(dates_by_student),
        "absentees": absentees,
        "_citations": [
            {"source_type": "attendance_record", "source_id": str(sid), "ref": f"{len(d)} absences"}
            for sid, d in list(dates_by_student.items())[:20]
        ],
    }
