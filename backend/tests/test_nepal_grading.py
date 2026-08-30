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


def test_letter_grade_boundaries_match_neb_bands():
    """Exact threshold values land on the higher band; one tick below does not."""
    from app.utils.nepal_grading import calculate_grade

    cases = [
        (90, "A+", 4.0), (89.99, "A", 3.6), (80, "A", 3.6), (79.99, "B+", 3.2),
        (70, "B+", 3.2), (69.99, "B", 2.8), (60, "B", 2.8), (59.99, "C+", 2.4),
        (50, "C+", 2.4), (49.99, "C", 2.0), (40, "C", 2.0), (39.99, "D", 1.6),
        (35, "D", 1.6), (34.99, "NG", 0.0), (0, "NG", 0.0),
    ]
    for pct, grade, gpa in cases:
        result = calculate_grade(pct)
        assert result["grade"] == grade, pct
        assert result["gpa"] == gpa, pct
        assert result["status"] == ("fail" if grade == "NG" else "pass"), pct


def test_weighted_gpa_with_unequal_credit_hours():
    """Weighted GPA: 4.0x4 + 3.6x3 + 3.2x2 + 2.8x1 = 36.0 over 10 credits = 3.60."""
    from app.utils.nepal_grading import calculate_gpa

    subjects = [
        {"gpa": 4.0, "grade": "A+", "total_obtained": 90, "total_full": 100,
         "credit_hours": 4},
        {"gpa": 3.6, "grade": "A", "total_obtained": 80, "total_full": 100,
         "credit_hours": 3},
        {"gpa": 3.2, "grade": "B+", "total_obtained": 70, "total_full": 100,
         "credit_hours": 2},
        {"gpa": 2.8, "grade": "B", "total_obtained": 60, "total_full": 100,
         "credit_hours": 1},
    ]
    result = calculate_gpa(subjects)
    assert result["gpa"] == 3.6
    # Marks totals still include every subject: 300/400 = 75% -> B+.
    assert result["percentage"] == 75.0
    assert result["grade"] == "B+"


def test_null_credit_hours_falls_back_to_equal_weighting():
    """An explicit null weight must not crash; it is treated as 1.0."""
    from app.utils.nepal_grading import calculate_gpa

    subjects = [
        {"gpa": 3.6, "grade": "A", "total_obtained": 80, "total_full": 100,
         "credit_hours": None},
        {"gpa": 4.0, "grade": "A+", "total_obtained": 90, "total_full": 100},
    ]
    assert calculate_gpa(subjects)["gpa"] == 3.8


def test_zero_credit_subject_keeps_marks_but_no_gpa_weight():
    """Zero weight drops GPA contribution only, never the marks totals."""
    from app.utils.nepal_grading import calculate_gpa

    subjects = [
        {"gpa": 4.0, "grade": "A+", "total_obtained": 90, "total_full": 100,
         "credit_hours": 0},
        {"gpa": 3.6, "grade": "A", "total_obtained": 80, "total_full": 100,
         "credit_hours": 3},
    ]
    result = calculate_gpa(subjects)
    assert result["gpa"] == 3.6          # 3.6x3 / 3 — zero-credit excluded
    assert result["total_obtained"] == 170   # marks totals untouched
    assert result["percentage"] == 85.0  # 170/200 -> A
    assert result["grade"] == "A"

    # All-zero credits must not divide by zero.
    zero = calculate_gpa([
        {"gpa": 4.0, "grade": "A+", "total_obtained": 90, "total_full": 100,
         "credit_hours": 0},
        {"gpa": 3.6, "grade": "A", "total_obtained": 80, "total_full": 100,
         "credit_hours": 0},
    ])
    assert zero["gpa"] == 0.0
    assert zero["grade"] == "A"


def test_zero_total_marks_subject_is_ng_without_dividing_by_zero():
    from app.utils.nepal_grading import calculate_gpa, calculate_subject_grade

    empty = calculate_subject_grade(0, 0)
    assert empty["grade"] == "NG"
    assert empty["percentage"] == 0

    result = calculate_gpa([empty,
                            {"gpa": 4.0, "grade": "A+", "total_obtained": 90,
                             "total_full": 100}])
    assert result["gpa"] == 2.0          # (0 + 4.0) / 2
    assert result["subjects_failed"] == 1  # zero-mark subject not silently dropped
    assert result["status"] == "fail"
