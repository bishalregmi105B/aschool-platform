"""Nepal NEB grading system utility.

Official grading scale used by National Examination Board (NEB):
- A+  (4.0) = 90-100%
- A   (3.6) = 80-<90%
- B+  (3.2) = 70-<80%
- B   (2.8) = 60-<70%
- C+  (2.4) = 50-<60%
- C   (2.0) = 40-<50%
- D   (1.6) = 35-<40%
- NG  (0.0) = Below 35% (Not Graded)

Pass criteria: At least D grade (35%) in each subject.
Theory minimum: 35%  |  Practical minimum: 40%
"""

# Grade boundaries: (min_pct, grade, gpa, description)
NEB_GRADES = [
    (90, "A+", 4.0, "Outstanding"),
    (80, "A",  3.6, "Excellent"),
    (70, "B+", 3.2, "Very Good"),
    (60, "B",  2.8, "Good"),
    (50, "C+", 2.4, "Satisfactory"),
    (40, "C",  2.0, "Acceptable"),
    (35, "D",  1.6, "Basic"),
    (0,  "NG", 0.0, "Not Graded"),
]

PASS_PERCENTAGE = 35
PRACTICAL_PASS_PERCENTAGE = 40


def calculate_grade(percentage: float) -> dict:
    """Given a percentage, return NEB grade info."""
    for min_pct, grade, gpa, desc in NEB_GRADES:
        if percentage >= min_pct:
            return {
                "grade": grade,
                "gpa": gpa,
                "description": desc,
                "status": "pass" if grade != "NG" else "fail",
            }
    return {"grade": "NG", "gpa": 0.0, "description": "Not Graded", "status": "fail"}


def calculate_subject_grade(
    theory_obtained: float,
    theory_full: float,
    practical_obtained: float = 0,
    practical_full: float = 0,
    theory_pass_marks: float | None = None,
    practical_pass_marks: float | None = None,
) -> dict:
    """Calculate NEB grade for a subject with theory + practical split."""
    # Check individual component pass
    theory_pct = (theory_obtained / theory_full * 100) if theory_full > 0 else 0
    practical_pct = (practical_obtained / practical_full * 100) if practical_full > 0 else 0

    total_obtained = theory_obtained + practical_obtained
    total_full = theory_full + practical_full
    overall_pct = (total_obtained / total_full * 100) if total_full > 0 else 0

    result = calculate_grade(overall_pct)

    # NEB rule: must pass theory (35%) and practical (40%) separately
    theory_pass = (
        theory_obtained >= theory_pass_marks
        if theory_pass_marks is not None and theory_full > 0
        else theory_pct >= PASS_PERCENTAGE if theory_full > 0 else True
    )
    practical_pass = (
        practical_obtained >= practical_pass_marks
        if practical_pass_marks is not None and practical_full > 0
        else practical_pct >= PRACTICAL_PASS_PERCENTAGE if practical_full > 0 else True
    )

    if not theory_pass or not practical_pass:
        result["grade"] = "NG"
        result["gpa"] = 0.0
        result["status"] = "fail"
        result["description"] = "Not Graded"

    result.update({
        "theory_obtained": theory_obtained,
        "practical_obtained": practical_obtained,
        "total_obtained": total_obtained,
        "total_full": total_full,
        "percentage": round(overall_pct, 2),
        "theory_percentage": round(theory_pct, 2),
        "practical_percentage": round(practical_pct, 2),
        "theory_pass_marks": theory_pass_marks,
        "practical_pass_marks": practical_pass_marks,
    })
    return result


def calculate_gpa(subject_grades: list[dict]) -> dict:
    """Calculate overall GPA from a list of subject grade results.
    Accepts 'credit_hours' in the subject dictionary for weighted GPA calculation.
    """
    if not subject_grades:
        return {"gpa": 0.0, "grade": "NG", "status": "fail"}

    total_credit_points = 0.0
    total_credits = 0.0
    
    for sg in subject_grades:
        credits = sg.get("credit_hours")
        if credits is None:
            # Explicit null weight falls back to equal weighting (1.0) instead
            # of crashing the GPA math. An explicit 0 is honoured: the subject
            # keeps contributing to marks totals but carries no GPA weight.
            credits = 1.0
        total_credit_points += sg["gpa"] * credits
        total_credits += credits

    avg_gpa = round(total_credit_points / total_credits, 2) if total_credits > 0 else 0.0
    
    total_obtained = sum(sg.get("total_obtained", 0) for sg in subject_grades)
    total_full = sum(sg.get("total_full", 0) for sg in subject_grades)
    overall_pct = (total_obtained / total_full * 100) if total_full > 0 else 0

    # If any subject is NG, the overall result may still pass based on GPA
    any_ng = any(sg["grade"] == "NG" for sg in subject_grades)
    overall_grade = calculate_grade(overall_pct)

    return {
        "gpa": avg_gpa,
        "grade": overall_grade["grade"],
        "description": overall_grade["description"],
        "status": "fail" if any_ng else overall_grade["status"],
        "total_obtained": total_obtained,
        "total_full": total_full,
        "percentage": round(overall_pct, 2),
        "subjects_failed": sum(1 for sg in subject_grades if sg["grade"] == "NG"),
    }


# Grade table for display/reference
GRADE_TABLE = [
    {"min_pct": g[0], "grade": g[1], "gpa": g[2], "description": g[3]}
    for g in NEB_GRADES
]
