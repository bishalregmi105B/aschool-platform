"""Output schemas for ai_workbench tools (AW-01/AW-03).

Minimal jsonschema subset understood by parse_and_validate. CI gate (e):
schemas for writing-feedback tools deliberately have NO `revised_text`
field — the tool must coach, not rewrite the student's work.
"""

SCHEMAS = {
    "lesson_plan": {
        "type": "object",
        "required": ["title", "objectives", "phases", "assessment"],
        "properties": {
            "title": {"type": "string"},
            "objectives": {"type": "array", "items": {"type": "string"}},
            "phases": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["name", "duration_minutes", "activities"],
                    "properties": {
                        "name": {"type": "string"},
                        "duration_minutes": {"type": "integer"},
                        "activities": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
            "assessment": {"type": "string"},
            "differentiation": {"type": "string"},
            "materials": {"type": "array", "items": {"type": "string"}},
        },
    },
    "blueprint_builder": {
        "type": "object",
        "required": ["title", "sections"],
        "properties": {
            "title": {"type": "string"},
            "total_marks": {"type": "number"},
            "duration_minutes": {"type": "integer"},
            "notes": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["name", "question_type", "count", "marks_each"],
                    "properties": {
                        "name": {"type": "string"},
                        "question_type": {
                            "type": "string",
                            "enum": [
                                "mcq", "short_answer", "long_answer", "fill_in_the_blanks",
                                "true_false", "matching", "very_short", "case_study",
                                "source_based", "diagram_based", "proof", "construction",
                                "comprehension", "numerical",
                            ],
                        },
                        "count": {"type": "integer", "minimum": 1},
                        "marks_each": {"type": "number", "minimum": 0.5},
                        "difficulty": {
                            "type": "string",
                            "enum": ["easy", "medium", "hard"],
                        },
                        "unit_hint": {"type": "string"},
                    },
                },
            },
        },
    },
    "text_leveler": {
        "type": "object",
        "required": ["text", "level"],
        "properties": {
            "text": {"type": "string"},
            "level": {"type": "string", "enum": ["easier", "same", "harder"]},
            "grade_band": {"type": "string"},
            "changes_made": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["kind", "detail"],
                    "properties": {
                        "kind": {
                            "type": "string",
                            "enum": ["vocabulary", "sentence_length", "structure", "added_support"],
                        },
                        "detail": {"type": "string"},
                    },
                },
            },
        },
    },
    "vocab_support": {
        "type": "object",
        "required": ["terms"],
        "properties": {
            "terms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["term", "definition"],
                    "properties": {
                        "term": {"type": "string"},
                        "definition": {"type": "string"},
                        "definition_ne": {"type": "string"},
                        "example": {"type": "string"},
                        "example_ne": {"type": "string"},
                    },
                },
            },
            "title": {"type": "string"},
        },
    },
    "lesson_hook": {
        "type": "object",
        "required": ["hook"],
        "properties": {
            "hook": {"type": "string"},
            "timing_minutes": {"type": "integer"},
            "materials": {"type": "array", "items": {"type": "string"}},
            "steps": {"type": "array", "items": {"type": "string"}},
            "bridge_to_lesson": {"type": "string"},
            "alternatives": {"type": "array", "items": {"type": "string"}},
        },
    },
    "email_responder": {
        "type": "object",
        "required": ["reply"],
        "properties": {
            "reply": {"type": "string"},
            "subject_line": {"type": "string"},
            "key_points": {"type": "array", "items": {"type": "string"}},
            "tone_note": {"type": "string"},
        },
    },
    "meeting_minutes": {
        "type": "object",
        "required": ["title", "discussion"],
        "properties": {
            "title": {"type": "string"},
            "date_note": {"type": "string"},
            "discussion": {"type": "array", "items": {"type": "string"}},
            "decisions": {"type": "array", "items": {"type": "string"}},
            "action_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["task"],
                    "properties": {
                        "task": {"type": "string"},
                        "owner": {"type": "string"},
                        "due": {"type": "string"},
                    },
                },
            },
        },
    },
    # ── Differentiation pack (wave-2) ─────────────────────────────────────
    "text_scaffolder": {
        "type": "object",
        "required": ["title", "steps"],
        "properties": {
            "title": {"type": "string"},
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["prompt", "support"],
                    "properties": {
                        "prompt": {"type": "string"},
                        "support": {"type": "string"},
                        "sentence_starter": {"type": "string"},
                    },
                },
            },
        },
    },
    "accommodation_finder": {
        "type": "object",
        "required": ["accommodations"],
        "properties": {
            "summary": {"type": "string"},
            "accommodations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["barrier", "accommodation"],
                    "properties": {
                        "barrier": {"type": "string"},
                        "accommodation": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": ["presentation", "response", "setting", "timing", "materials"],
                        },
                    },
                },
            },
        },
    },
    "enrichment_plan": {
        "type": "object",
        "required": ["activities"],
        "properties": {
            "activities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["title", "description"],
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "difficulty": {"type": "string", "enum": ["stretch", "challenge", "project"]},
                    },
                },
            },
        },
    },
    "udl_choice_board": {
        "type": "object",
        "required": ["cells"],
        "properties": {
            "instructions": {"type": "string"},
            "cells": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["row", "column", "task"],
                    "properties": {
                        "row": {"type": "string"},
                        "column": {"type": "string"},
                        "task": {"type": "string"},
                    },
                },
            },
        },
    },
    # ── Comms + PD pack (wave-2) ──────────────────────────────────────────
    "attendance_outreach": {
        "type": "object",
        "required": ["messages"],
        "properties": {
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["student", "message"],
                    "properties": {
                        "student": {"type": "string"},
                        "message": {"type": "string"},
                        "escalation": {"type": "string", "enum": ["gentle", "concern", "urgent"]},
                    },
                },
            },
        },
    },
    "progress_conference": {
        "type": "object",
        "required": ["agenda"],
        "properties": {
            "agenda": {"type": "array", "items": {"type": "string"}},
            "talking_points": {"type": "array", "items": {"type": "string"}},
            "questions_to_ask": {"type": "array", "items": {"type": "string"}},
            "follow_up_note": {"type": "string"},
        },
    },
    "lesson_observation": {
        "type": "object",
        "required": ["strengths", "growth_areas"],
        "properties": {
            "strengths": {"type": "array", "items": {"type": "string"}},
            "growth_areas": {"type": "array", "items": {"type": "string"}},
            "suggestions": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
        },
    },
    # ── Planning + assessment pack (wave-2) ───────────────────────────────
    "annual_scheme": {
        "type": "object",
        "required": ["units"],
        "properties": {
            "units": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["month", "topics"],
                    "properties": {
                        "month": {"type": "string"},
                        "topics": {"type": "array", "items": {"type": "string"}},
                        "assessment": {"type": "string"},
                    },
                },
            },
        },
    },
    "transition_guide": {
        "type": "object",
        "required": ["sections"],
        "properties": {
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["heading", "content"],
                    "properties": {"heading": {"type": "string"}, "content": {"type": "string"}},
                },
            },
        },
    },
    "exam_timetable": {
        "type": "object",
        "required": ["days"],
        "properties": {
            "days": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["date", "subjects"],
                    "properties": {
                        "date": {"type": "string"},
                        "subjects": {"type": "array", "items": {"type": "string"}},
                        "notes": {"type": "string"},
                    },
                },
            },
            "conflicts": {"type": "array", "items": {"type": "string"}},
        },
    },
    "practical_exam": {
        "type": "object",
        "required": ["tasks"],
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["task", "marks"],
                    "properties": {
                        "task": {"type": "string"},
                        "marks": {"type": "number"},
                        "materials": {"type": "array", "items": {"type": "string"}},
                        "criteria": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
            "total_marks": {"type": "number"},
        },
    },
    "worksheet": {
        "type": "object",
        "required": ["title", "items"],
        "properties": {
            "title": {"type": "string"},
            "instructions": {"type": "string"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["question", "marks"],
                    "properties": {
                        "question": {"type": "string"},
                        "marks": {"type": "number"},
                        "question_type": {"type": "string"},
                    },
                },
            },
        },
    },
    "exit_ticket": {
        "type": "object",
        "required": ["questions"],
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["question"],
                    "properties": {"question": {"type": "string"}},
                },
            },
            "reflection_prompt": {"type": "string"},
        },
    },
    "rubric": {
        "type": "object",
        "required": ["criteria"],
        "properties": {
            "criteria": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["name", "max_marks"],
                    "properties": {
                        "name": {"type": "string"},
                        "max_marks": {"type": "number"},
                        "descriptors": {"type": "string"},
                    },
                },
            },
        },
    },
    "parent_email": {
        "type": "object",
        "required": ["subject", "body"],
        "properties": {
            "subject": {"type": "string"},
            "body": {"type": "string"},
            "citations": {"type": "array", "items": {"type": "string"}},
        },
    },
    "differentiation": {
        "type": "object",
        "required": ["tiers"],
        "properties": {
            "tiers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["tier", "strategy"],
                    "properties": {
                        "tier": {"type": "string"},
                        "strategy": {"type": "string"},
                        "activities": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
        },
    },
    "study_guide": {
        "type": "object",
        "required": ["sections"],
        "properties": {
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["heading", "points"],
                    "properties": {
                        "heading": {"type": "string"},
                        "points": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
            "practice_questions": {"type": "array", "items": {"type": "string"}},
        },
    },
    "flashcards": {
        "type": "object",
        "required": ["cards"],
        "properties": {
            "cards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["front", "back"],
                    "properties": {
                        "front": {"type": "string"},
                        "back": {"type": "string"},
                    },
                },
            }
        },
    },
    # CI gate (e): writing-feedback coaches — no revised_text field at the
    # type level; its presence would turn the tool into a ghost-writer.
    "writing_feedback": {
        "type": "object",
        "required": ["strengths", "improvements", "next_steps"],
        "properties": {
            "strengths": {"type": "array", "items": {"type": "string"}},
            "improvements": {"type": "array", "items": {"type": "string"}},
            "next_steps": {"type": "array", "items": {"type": "string"}},
            "encouragement": {"type": "string"},
        },
    },
    # AW-01 fixture tool (CI gate b)
    "fixture_test": {
        "type": "object",
        "required": ["echo"],
        "properties": {"echo": {"type": "string"}},
    },
    # ── Generic document schema (D-2): one shape for the text-output tools ──
    # {title, sections:[{heading, body:[...]}], follow_ups?} — the result
    # template renders it; per-tool prompts define the content contract.
    "doc_sections": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "heading": {"type": "string"},
                        "body": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["heading", "body"],
                },
            },
            "follow_ups": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["title", "sections"],
    },
    # item_analysis: deterministic-leaning analysis of question performance
    "item_analysis": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question_ref": {"type": "string"},
                        "difficulty_index": {"type": "number"},
                        "discrimination": {"type": "number"},
                        "verdict": {"type": "string"},
                        "action": {"type": "string"},
                    },
                    "required": ["question_ref", "verdict", "action"],
                },
            },
            "summary": {"type": "string"},
        },
        "required": ["title", "items", "summary"],
    },
}

REQUIRED = {
    key: schema.get("required") for key, schema in SCHEMAS.items()
}
