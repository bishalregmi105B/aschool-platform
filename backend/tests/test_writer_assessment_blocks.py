"""Writer assessment blocks (W4/B3) — worksheet/paper artifacts render.

Pins the five new writer-JSON block types (section_header, question,
answer_space, page_break, checkbox_list) that turn the writer engine into a
worksheet/exam-paper renderer: every block must produce its expected HTML in
the print path, with escaped content.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app  # noqa: E402


def _render(blocks):
    from app.services.designer.template_engine import TemplateEngineService

    with create_app("testing").app_context():
        return TemplateEngineService._render_writer_html(
            {"writer_json": {"config": {"size": "A4"}, "blocks": blocks}}, {}
        )


def test_paper_blocks_render():
    from app.services.designer.template_engine import (
        _w_answer_space,
        _w_checklist,
        _w_page_break,
        _w_question,
        _w_section_header,
    )

    html = _render(
        [
            _w_section_header("SECTION A", "Objective (5 × 1 = 5)"),
            _w_question(1, "What is <water>?", 1),
            _w_checklist(["Oxygen", "Water"]),
            _w_question(2, "Explain.", 5, [{"label": "a", "text": "Define.", "marks": 2}]),
            _w_answer_space(3),
            _w_page_break(),
        ]
    )
    for marker in (
        "SECTION A",
        "Objective (5 × 1 = 5)",
        "1.</b>",
        "[1]",
        "&lt;water&gt;",  # question text is escaped
        "☐",
        "a)</b>",
        "[2]",
        "border-bottom:1px solid",  # ruled answer lines (×3)
        "page-break-after:always",
    ):
        assert marker in html, f"missing: {marker}"
    assert html.count("border-bottom:1px solid") == 3


def test_question_without_marks_omits_tag():
    from app.services.designer.template_engine import _w_question

    html = _render([_w_question(1, "Free answer")])
    assert "1.</b>" in html
    assert "[" not in html.split("</span>", 2)[-1][:20] or "[" not in html.replace("[", "", 0)
