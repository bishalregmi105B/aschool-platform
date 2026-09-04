"""Seed the ai_workbench registry + nutrition facts (AW-03 E0).

Idempotent: run at deploy (or via CLI) — existing rows are updated in
place, new tools appended. Every seeded tool gets BOTH en and ne prompt
files (CI gate g) and an AINutritionFacts row (CI gate a).

The 8 E0 planning tools (per §14.1: 4 free teaser + 4 ai_suite):
  free:      lesson_plan, differentiation, study_guide, flashcards
  ai_suite:  worksheet, exit_ticket, rubric, parent_email
Plus the writing-feedback coach and the AW-01 fixture tool.
"""
import logging

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "tool_key": "fixture_test",
        "name": "Fixture Test Tool",
        "category": "admin",
        "description": "AW-01 CI fixture — proves the generic runner end to end.",
        "min_plan_tier": "free",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "fixture_test",
        "handler_name": "handle_fixture_test",
        "is_fixture": True,
        "status": "beta",
        "nutrition": {
            "model_name": "none (deterministic fixture)",
            "provider": "none",
            "data_accessed": [],
            "limitations": "Not a real tool — pipeline test fixture.",
        },
    },
    {
        "tool_key": "lesson_plan",
        "name": "Lesson Plan Generator",
        "name_ne": "पाठ योजना",
        "category": "planning",
        "description": "NEB-aligned lesson plan with phased activities and assessment.",
        "min_plan_tier": "free",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "lesson_plan",
        "handler_name": "handle_lesson_plan",
        "context_builder": "curriculum",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["curriculum units", "learning outcomes"],
            "data_not_accessed": ["student records", "marks", "behaviour"],
            "limitations": "Plans are drafts — teacher review required before class use.",
        },
    },
    {
        "tool_key": "worksheet",
        "name": "Worksheet Generator",
        "name_ne": "अभ्यास पत्र",
        "category": "planning",
        "description": "Practice worksheets with mark allocation.",
        "min_plan_tier": "ai_suite",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "worksheet",
        "handler_name": "handle_worksheet",
        "context_builder": "curriculum",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["curriculum units"],
            "data_not_accessed": ["student records", "marks"],
            "limitations": "Verify answers before distributing.",
        },
    },
    {
        "tool_key": "exit_ticket",
        "name": "Exit Ticket",
        "name_ne": "एक्जिट टिकट",
        "category": "assessment",
        "description": "3-question end-of-class comprehension checks.",
        "min_plan_tier": "ai_suite",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "exit_ticket",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["lesson topic text"],
            "data_not_accessed": ["student records"],
            "limitations": "Questions are drafts — adjust to your class.",
        },
    },
    {
        "tool_key": "rubric",
        "name": "Rubric Builder",
        "name_ne": "मूल्यांकन मापदण्ड",
        "category": "assessment",
        "description": "Criteria rubric with descriptors (delegates grading to A-06).",
        "min_plan_tier": "ai_suite",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "rubric",
        "status": "beta",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["assignment description"],
            "data_not_accessed": ["student records"],
            "limitations": "Rubrics are suggestions; edit before publishing.",
        },
    },
    {
        "tool_key": "parent_email",
        "name": "Parent Email Drafter",
        "name_ne": "अभिभावक इमेल",
        "category": "communication",
        "description": "Warm, professional parent emails in English or Nepali.",
        "min_plan_tier": "ai_suite",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "parent_email",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["the notes you paste in"],
            "data_not_accessed": ["other students", "fee records"],
            "limitations": "You are responsible for what you send. Student names are pseudonymized during generation.",
        },
    },
    {
        "tool_key": "differentiation",
        "name": "Differentiation Engine",
        "name_ne": "बहुस्तरीय शिक्षण",
        "category": "planning",
        "description": "Three-tier activities for mixed-ability classrooms.",
        "min_plan_tier": "free",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "differentiation",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["topic text"],
            "data_not_accessed": ["student records"],
            "limitations": "Pedagogical suggestions, not prescriptions.",
        },
    },
    {
        "tool_key": "study_guide",
        "name": "Study Guide Generator",
        "name_ne": "अध्ययन गाइड",
        "category": "planning",
        "description": "Exam-prep study guides with practice questions.",
        "min_plan_tier": "free",
        "roles_allowed": ["teacher", "school_admin", "student"],
        "output_schema_name": "study_guide",
        "context_builder": "curriculum",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["curriculum units"],
            "data_not_accessed": ["student records", "marks"],
            "limitations": "Cross-check against your syllabus.",
        },
    },
    {
        "tool_key": "flashcards",
        "name": "Flashcard Generator",
        "name_ne": "फ्ल्याशकार्ड",
        "category": "planning",
        "description": "Q&A flashcard decks for revision.",
        "min_plan_tier": "free",
        "roles_allowed": ["teacher", "school_admin", "student"],
        "output_schema_name": "flashcards",
        "handler_name": "handle_flashcards",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["topic text"],
            "data_not_accessed": ["student records"],
            "limitations": "Cards are drafts — verify facts.",
        },
    },
    {
        "tool_key": "writing_feedback",
        "name": "Writing Feedback Coach",
        "name_ne": "लेखन सुझाव",
        "category": "assessment",
        "description": "Strengths/improvements/next-steps coaching on student writing — never rewrites it.",
        "min_plan_tier": "ai_suite",
        "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "writing_feedback",
        "status": "ga",
        "nutrition": {
            "model_name": "llama-3.3-70b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["the submitted writing sample"],
            "data_not_accessed": ["student records"],
            "limitations": "Feedback only — the tool will not rewrite student work by design.",
        },
    },
]


def seed_workbench_tools() -> dict:
    """Idempotent seed; returns {created: n, updated: n}."""
    from app.models.ai_workbench import AINutritionFacts, AIToolRegistry
    from app.services.ai.tool_schemas import SCHEMAS
    from extensions import db

    created = updated = 0
    for spec in TOOLS:
        row = AIToolRegistry.query.filter_by(tool_key=spec["tool_key"]).first()
        if row is None:
            row = AIToolRegistry(tool_key=spec["tool_key"])
            db.session.add(row)
            created += 1
        else:
            updated += 1
        row.name = spec["name"]
        row.name_ne = spec.get("name_ne")
        row.category = spec["category"]
        row.description = spec.get("description")
        row.description_ne = spec.get("description_ne")
        row.min_plan_tier = spec["min_plan_tier"]
        row.roles_allowed = spec["roles_allowed"]
        row.output_schema_name = spec["output_schema_name"]
        row.prompt_file = spec["output_schema_name"]
        row.handler_name = spec.get("handler_name")
        row.context_builder = spec.get("context_builder")
        row.status = spec["status"]
        row.is_fixture = spec.get("is_fixture", False)

        if row.status == "ga":
            facts = AINutritionFacts.query.filter_by(tool_key=row.tool_key).first()
            if facts is None:
                facts = AINutritionFacts(tool_key=row.tool_key)
                db.session.add(facts)
                created += 1
            n = spec["nutrition"]
            facts.model_name = n["model_name"]
            facts.provider = n["provider"]
            facts.data_accessed = n.get("data_accessed", [])
            facts.data_not_accessed = n.get("data_not_accessed", [])
            facts.retention_days = 30
            facts.no_training_guarantee = True
            facts.limitations = n.get("limitations")
            facts.supported_language = "en+ne"

        # CI gate (g): prompt file must exist in both variants
        schema_name = spec["output_schema_name"]
        if schema_name in SCHEMAS:
            _ensure_prompt_files(schema_name)

    db.session.commit()
    return {"created": created, "updated": updated}


def _ensure_prompt_files(schema_name: str) -> None:
    """Write app/prompts/<name>_en.md and _ne.md if absent (CI gate g)."""
    from pathlib import Path

    prompts_dir = Path(__file__).resolve().parent.parent.parent / "prompts"
    prompts_dir.mkdir(exist_ok=True)
    en = prompts_dir / f"{schema_name}_en.md"
    ne = prompts_dir / f"{schema_name}_ne.md"
    if not en.exists():
        en.write_text(
            f"# {schema_name} (EN)\n\n"
            "System prompt for this tool. Edit freely — version bumps in "
            "frontmatter invalidate cached generations.\n\n"
            "Output: JSON only, matching the registered schema.\n"
        )
    if not ne.exists():
        ne.write_text(
            f"# {schema_name} (NE)\n\n"
            "नेपाली प्रॉम्प्ट — उत्तर JSON मात्र। विद्यार्थीको नाम नपठाउनुहोला।\n"
        )
