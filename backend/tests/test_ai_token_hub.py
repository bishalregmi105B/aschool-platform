"""Tests for AITokenHub — the central gateway every AI service must use."""
from unittest.mock import patch

from app.services.ai.token_hub import AITokenHub


def test_generate_wraps_request_and_returns_text(app):
    with app.app_context():
        with patch.object(
            AITokenHub, "request", return_value={"text": "generated text", "tokens_used": 3}
        ) as req:
            out = AITokenHub.generate(
                school_id="00000000-0000-0000-0000-000000000001",
                prompt="Do a thing",
                action="report_remarks",
                max_tokens=42,
            )

            assert out == "generated text"
            kwargs = req.call_args.kwargs
            assert kwargs["feature"] == "service:report_remarks"
            assert kwargs["max_tokens"] == 42
            assert kwargs["messages"] == [{"role": "user", "content": "Do a thing"}]


def test_generate_with_system_prompt_prepends_message(app):
    with app.app_context():
        with patch.object(
            AITokenHub, "request", return_value={"text": "", "tokens_used": 0}
        ) as req:
            AITokenHub.generate(
                school_id="00000000-0000-0000-0000-000000000002",
                prompt="Hi",
                action="sentiment",
                system_prompt="You are strict.",
            )
            messages = req.call_args.kwargs["messages"]
            assert messages[0]["role"] == "system"
            assert messages[-1]["role"] == "user"


def test_all_service_modules_use_existing_hub_methods():
    """The live AI service modules must import cleanly (no phantom methods).

    W0-close (2026-09-05): the 8 dead modules (report_remarks, content_gen,
    sentiment, translator, social_ai, wellbeing_ai, admission_bot,
    attendance_ai, fee_predictor, plagiarism) were deleted — zero importers,
    confirmed by grep — so they leave this list. The modules kept are the
    ones actually mounted by routes/tasks.
    """
    import importlib

    modules = [
        "app.services.ai.risk_detector",
        "app.services.ai.benchmarking_ai",
        "app.services.ai.adaptive_learning",
        "app.services.ai.question_paper",
        "app.services.ai.question_paper_v2",
        "app.services.ai.lesson_plan",
        "app.services.ai.homework_helper",
        "app.services.ai.tutor_engine",
        "app.services.ai.school_insights",
        "app.services.ai.auto_grader",
    ]
    for name in modules:
        assert importlib.import_module(name) is not None
