from app.utils.nepal_grading import calculate_subject_grade


def test_calculate_subject_grade_uses_explicit_component_pass_marks():
    result = calculate_subject_grade(
        26,
        75,
        10,
        25,
        theory_pass_marks=27,
        practical_pass_marks=10,
    )

    assert result["grade"] == "NG"
    assert result["status"] == "fail"


def test_calculate_subject_grade_passes_when_both_component_thresholds_are_met():
    result = calculate_subject_grade(
        27,
        75,
        10,
        25,
        theory_pass_marks=27,
        practical_pass_marks=10,
    )

    assert result["grade"] == "D"
    assert result["status"] == "pass"


def test_calculate_subject_grade_keeps_legacy_percentage_fallbacks():
    result = calculate_subject_grade(30, 75, 9, 25)

    assert result["grade"] == "NG"
    assert result["status"] == "fail"