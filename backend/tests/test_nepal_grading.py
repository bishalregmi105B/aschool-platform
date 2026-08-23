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

def test_exact_theory_boundary_passes_and_one_below_fails():
    """NEB theory pass is 35% of full marks — exact boundary and 1-below."""
    from app.utils.nepal_grading import calculate_subject_grade

    # Exactly at the boundary: 35/100 theory.
    at = calculate_subject_grade(35, 100, 20, 25)
    assert at["status"] == "pass"

    below = calculate_subject_grade(34, 100, 20, 25)
    assert below["status"] == "fail"
    assert below["grade"] == "NG"


def test_component_fail_overrides_good_total():
    """Strong total but one component below its own threshold must fail."""
    from app.utils.nepal_grading import calculate_subject_grade

    # Total 75% but practical only 8/25 (32%) — below the 40% practical bar.
    result = calculate_subject_grade(60, 75, 8, 25, practical_pass_marks=10)
    assert result["status"] == "fail"


def test_gpa_aggregation_counts_failed_subject_as_zero_per_neb():
    """NEB GPA = sum of subject grade points / subject count; NG scores 0."""
    from app.utils.nepal_grading import calculate_gpa

    subjects = [
        {"gpa": 4.0, "grade": "A", "total_obtained": 90, "total_full": 100},
        {"gpa": 0.0, "grade": "NG", "total_obtained": 10, "total_full": 100},
    ]
    result = calculate_gpa(subjects)
    assert result["gpa"] == 2.0
    assert result["subjects_failed"] == 1
    # Any NG fails the aggregate regardless of GPA.
    assert result["status"] == "fail"
