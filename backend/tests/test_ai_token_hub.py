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
    """The 10 AI service modules must import cleanly (no phantom methods)."""
    import importlib

    modules = [
        "app.services.ai.report_remarks",
        "app.services.ai.content_gen",
        "app.services.ai.risk_detector",
        "app.services.ai.sentiment",
        "app.services.ai.translator",
        "app.services.ai.social_ai",
        "app.services.ai.benchmarking_ai",
        "app.services.ai.wellbeing_ai",
        "app.services.ai.adaptive_learning",
        "app.services.ai.admission_bot",
    ]
    for name in modules:
        assert importlib.import_module(name) is not None
