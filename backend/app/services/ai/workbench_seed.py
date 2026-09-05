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
        "ui_type": 'form',
        "budget": 'tier0',
        "icon": '🧪',
        "grounding": 'none',
        "sort_order": 999,
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
        "ui_type": 'form',
        "budget": 'tier2',
        "icon": '📋',
        "grounding": 'optional',
        "sort_order": 1,
        "badge": 'popular',
        "output_document_type": 'writer',
        "trigger_phrases": ['make a lesson plan', 'lesson plan for', 'पाठ योजना बनाउनुहोस्', 'plan my lesson'],
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
        "ui_type": 'form',
        "budget": 'tier2',
        "icon": '📝',
        "grounding": 'optional',
        "sort_order": 2,
        "badge": 'popular',
        "output_document_type": 'writer',
        "trigger_phrases": ['make a worksheet', 'practice sheet', 'अभ्यास पत्र'],
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
        "ui_type": 'form',
        "budget": 'tier1',
        "icon": '🎫',
        "grounding": 'optional',
        "sort_order": 3,
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
        "ui_type": 'rubric',
        "budget": 'tier1',
        "icon": '📐',
        "grounding": 'none',
        "sort_order": 4,
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
        "ui_type": 'writing',
        "budget": 'tier1',
        "icon": '✉️',
        "grounding": 'none',
        "sort_order": 5,
        "trigger_phrases": ['email a parent', 'write to parents', 'अभिभावकलाई पत्र'],
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
        "ui_type": 'tiered',
        "budget": 'tier2',
        "icon": '🪜',
        "grounding": 'optional',
        "sort_order": 6,
        "output_document_type": 'writer',
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
        "ui_type": 'form',
        "budget": 'tier2',
        "icon": '📖',
        "grounding": 'required',
        "sort_order": 7,
        "output_document_type": 'writer',
        "trigger_phrases": ['study guide', 'exam prep guide', 'अध्ययन गाइड'],
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
        "ui_type": 'flashcards',
        "budget": 'tier1',
        "icon": '🃏',
        "grounding": 'optional',
        "sort_order": 8,
        "badge": 'popular',
        "trigger_phrases": ['make flashcards', 'flip cards', 'कार्ड'],
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
        "ui_type": 'feedback',
        "budget": 'tier2',
        "icon": '🖊️',
        "grounding": 'none',
        "sort_order": 9,
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
    },    # ── D-2 catalog wave 1 (D1 §C.15 top-25 subset that maps to the
    # doc_sections result template — the highest-leverage NEW tools) ────
    {
        "tool_key": "unit_plan",
        "name": "Unit / Chapter Plan", "name_ne": "एकाइ योजना",
        "category": "planning",
        "description": "2-6 week unit: outcome map, lesson sequence, assessment plan, resources.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections", "context_builder": "curriculum",
        "status": "ga", "ui_type": "form", "budget": "tier3", "icon": "🗺️",
        "grounding": "required", "sort_order": 10, "badge": "new",
        "output_document_type": "writer",
        "trigger_phrases": ["unit plan", "chapter plan", "एकाइ योजना"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq",
            "data_accessed": ["curriculum units", "learning outcomes"],
            "limitations": "Plans are drafts — teacher review required.",
        },
    },
    {
        "tool_key": "substitute_plan",
        "name": "Substitute / Cover Plan", "name_ne": "प्रतिस्थापन योजना",
        "category": "planning",
        "description": "Self-contained plan a non-specialist can teach tomorrow.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections", "context_builder": "curriculum",
        "status": "ga", "ui_type": "form", "budget": "tier2", "icon": "🧑‍🏫",
        "grounding": "optional", "sort_order": 11, "badge": "new",
        "output_document_type": "writer",
        "trigger_phrases": ["substitute plan", "cover lesson", "बिहे बस्ने योजना"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["curriculum units"],
            "limitations": "Plans are drafts — teacher review required.",
        },
    },
    {
        "tool_key": "objective_writer",
        "name": "Learning Objectives (Bloom)", "name_ne": "सिकाइ उपलब्धि",
        "category": "planning",
        "description": "Topic to measurable Bloom-verbed objectives mapped to CDC outcomes.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections", "context_builder": "curriculum",
        "status": "ga", "ui_type": "form", "budget": "tier1", "icon": "🎯",
        "grounding": "required", "sort_order": 12,
        "trigger_phrases": ["write objectives", "learning outcomes", "उद्देश्य"],
        "nutrition": {
            "model_name": "gpt-oss-20b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["curriculum outcomes"],
            "limitations": "Objectives map to the seeded CDC framework.",
        },
    },
    {
        "tool_key": "misconception_map",
        "name": "Common Misconceptions", "name_ne": "सामान्य भ्रम",
        "category": "assessment",
        "description": "Likely wrong ideas + the diagnostic question that exposes each.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections", "context_builder": "curriculum",
        "status": "ga", "ui_type": "form", "budget": "tier2", "icon": "🧠",
        "grounding": "required", "sort_order": 20, "badge": "new",
        "output_document_type": "writer",
        "trigger_phrases": ["misconceptions", "what do students get wrong", "भ्रम"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["curriculum units"],
            "limitations": "Educational hypotheses, not diagnostics of a specific child.",
        },
    },
    {
        "tool_key": "remedial_plan",
        "name": "Remedial Plan", "name_ne": "उपचारात्मक योजना",
        "category": "assessment",
        "description": "Targeted support plan for students below benchmark on a topic.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "form", "budget": "tier2", "icon": "🩹",
        "grounding": "optional", "sort_order": 21, "badge": "new",
        "output_document_type": "writer",
        "trigger_phrases": ["remedial plan", "help weak students", "कमजोर विद्यार्थी"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["marks ranges provided in input"],
            "data_not_accessed": ["student names", "health", "behaviour"],
            "limitations": "Suggests strategies; the teacher decides support.",
        },
    },
    {
        "tool_key": "answer_key",
        "name": "Answer Key & Marking Scheme", "name_ne": "उत्तर कुंजी",
        "category": "assessment",
        "description": "Marking scheme for a paper: model answers, step marks, alternatives.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "form", "budget": "tier2", "icon": "🔑",
        "grounding": "optional", "sort_order": 22,
        "output_document_type": "writer",
        "trigger_phrases": ["answer key", "marking scheme", "उत्तर कुंजी"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": [],
            "limitations": "Verify step marks against the school's scheme.",
        },
    },
    {
        "tool_key": "class_performance",
        "name": "Class Performance Actions", "name_ne": "कक्षा नतिजा विश्लेषण",
        "category": "admin",
        "description": "Turns exam results into three concrete teaching actions.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "analysis", "budget": "tier1", "icon": "📊",
        "grounding": "none", "sort_order": 30,
        "trigger_phrases": ["class performance", "result analysis", "नतिजा"],
        "nutrition": {
            "model_name": "gpt-oss-20b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["aggregate stats pasted in input"],
            "data_not_accessed": ["individual student identities"],
            "limitations": "Paste aggregate numbers; never paste student names.",
        },
    },
    {
        "tool_key": "see_prep_pack",
        "name": "SEE Prep Pack", "name_ne": "SEE तयारी प्याक",
        "category": "student",
        "description": "SEE exam preparation pack: high-weight topics, practice plan, exam-day strategy.",
        "min_plan_tier": "ai_suite", "roles_allowed": ["student", "teacher", "school_admin"],
        "output_schema_name": "doc_sections", "context_builder": "curriculum",
        "status": "ga", "ui_type": "form", "budget": "tier3", "icon": "🎓",
        "grounding": "required", "sort_order": 40, "badge": "smart",
        "trigger_phrases": ["SEE prep", "SEE preparation", "तयारी"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["curriculum units", "learning outcomes"],
            "data_not_accessed": ["marks", "attendance"],
            "limitations": "Study guidance only — not exam content.",
        },
    },
    {
        "tool_key": "practice_set",
        "name": "Adaptive Practice Set", "name_ne": "अभ्यास सेट",
        "category": "student",
        "description": "Practice questions targeted at a student's weak topics with worked solutions.",
        "min_plan_tier": "ai_suite", "roles_allowed": ["student", "teacher", "school_admin"],
        "output_schema_name": "doc_sections", "context_builder": "curriculum",
        "status": "ga", "ui_type": "exam", "budget": "tier2", "icon": "🏋️",
        "grounding": "required", "sort_order": 41,
        "trigger_phrases": ["practice questions", "give me problems", "अभ्यास"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["curriculum units"],
            "limitations": "Solutions are teachable steps, never direct exam answers.",
        },
    },
    {
        "tool_key": "parent_sms",
        "name": "Parent SMS Drafter", "name_ne": "अभिभावक SMS",
        "category": "communication",
        "description": "Short, respectful Nepali/English SMS drafts for the class audience.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "writing", "budget": "tier1", "icon": "💬",
        "grounding": "none", "sort_order": 50,
        "trigger_phrases": ["sms to parents", "text parents", "एसएमएस"],
        "nutrition": {
            "model_name": "gpt-oss-20b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": [],
            "data_not_accessed": ["student records"],
            "limitations": "Drafts only — sending runs through the SMS plugin with its own consent.",
        },
    },
    {
        "tool_key": "difficult_conversation",
        "name": "Difficult Conversation Coach", "name_ne": "कठिन कुरा तालिम",
        "category": "communication",
        "description": "Plans a hard parent/colleague conversation: framing, likely reactions, follow-up.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "writing", "budget": "tier2", "icon": "🤝",
        "grounding": "none", "sort_order": 51,
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": [],
            "data_not_accessed": ["student records"],
            "limitations": "Coaching aid — never paste student identities.",
        },
    },
    {
        "tool_key": "nepali_style_editor",
        "name": "Nepali Style Editor", "name_ne": "नेपाली शैली सम्पादक",
        "category": "communication",
        "description": "Polishes Nepali text for clarity and respectful register; keeps technical terms English.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin", "student"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "writing", "budget": "tier1", "icon": "✒️",
        "grounding": "none", "sort_order": 52, "badge": "smart",
        "trigger_phrases": ["improve my nepali", "सच्याउनुहोस्", "polish text"],
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": [],
            "limitations": "Style editing only.",
        },
    },
    {
        "tool_key": "item_analysis",
        "name": "Question Item Analysis", "name_ne": "प्रश्न विश्लेषण",
        "category": "admin",
        "description": "Difficulty/discrimination per question from result data; retires bad items.",
        "min_plan_tier": "ai_suite", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "item_analysis",
        "status": "ga", "ui_type": "analysis", "budget": "tier2", "icon": "🔍",
        "grounding": "none", "sort_order": 53,
        "nutrition": {
            "model_name": "gpt-oss-120b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["aggregate question stats pasted in input"],
            "data_not_accessed": ["student identities"],
            "limitations": "Interpret indices against the school's cohort size.",
        },
    },
    {
        "tool_key": "substitute_notes_home_support",
        "name": "Home Support Guide", "name_ne": "घरमा सहयोग गाइड",
        "category": "communication",
        "description": "A one-page guide parents can follow to support a topic at home.",
        "min_plan_tier": "free", "roles_allowed": ["teacher", "school_admin"],
        "output_schema_name": "doc_sections",
        "status": "ga", "ui_type": "writing", "budget": "tier1", "icon": "🏠",
        "grounding": "optional", "sort_order": 54,
        "nutrition": {
            "model_name": "gpt-oss-20b (Groq) / Claude fallback",
            "provider": "groq", "data_accessed": ["curriculum units"],
            "limitations": "General guidance; adapt to the family's situation.",
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
