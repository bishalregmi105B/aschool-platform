"""Auto-assignment of unique student numbers (E235, 2026-08-31).

Every student-creation path — manual enrollment (students.py), the
admission-acceptance auto-enroll listener (plugins/listeners.py) and the
IEMIS importer — must leave the student with:

- ``admission_number``  the school's enrollment number (the "Enrollment No."
  printed on ID cards / certificates — Student.to_dict() exposes it as
  ``enrollment_number``). Auto-generated when the caller did not supply one.
- ``roll_number``       the next free roll within the student's class.

Format (reuses the existing seeded pattern ``S6-DEMO-001``):
    {BS_YEAR}-{SCHOOL_SHORT}-{seq:04d}      e.g. 2082-DEMO-0001

- BS_YEAR   current Bikram Sambat year (app.utils.nepali_date).
- SHORT     first 6 alphanumeric chars of the school slug, uppercased.
- seq       per-school zero-padded sequence (0001, 0002, …) — the sequence
  is per (school, BS year, short code) prefix, so a new academic year
  restarts numbering naturally.

Concurrency safety: number issuance takes a ``SELECT … FOR UPDATE`` lock on
the School row, which serializes all issuance for that school (PostgreSQL —
the production DB; SQLite serializes writers anyway). The candidate value is
re-checked against existing rows before returning, and the generation loop
skips values already taken — two simultaneous enrollments can never mint the
same number.
"""

import logging

from sqlalchemy import func

from app.models.school import School
from app.models.student import Student
from app.utils.nepali_date import current_year_bs
from extensions import db

logger = logging.getLogger(__name__)

_ENROLL_SEQ_PAD = 4


def _school_short_code(school: School | None) -> str:
    """Stable short code for the number prefix (slug wins, then name)."""
    raw = str(
        (getattr(school, "slug", None) or getattr(school, "name", None) or "school")
    )
    code = "".join(ch for ch in raw.upper() if ch.isalnum())
    return code[:6] or "SCHOOL"


def generate_enrollment_number(school_id) -> str:
    """Next unique {BS_YEAR}-{SHORT}-{seq:04d} enrollment number for a school.

    Must be called INSIDE the caller's transaction (the School row lock and
    the candidate check are only safe in the same unit of work that commits
    the student row).
    """
    school = School.query.filter_by(id=school_id).with_for_update().first()
    prefix = f"{current_year_bs()}-{_school_short_code(school)}"

    # Highest sequence already issued for this prefix (per school + year).
    existing = (
        db.session
        .query(Student.admission_number)
        .filter(
            Student.school_id == school_id,
            Student.admission_number.ilike(f"{prefix}-%"),
        )
        .all()
    )
    seq = 0
    for (number,) in existing:
        tail = str(number).rsplit("-", 1)[-1]
        if tail.isdigit():
            seq = max(seq, int(tail))

    while True:
        seq += 1
        candidate = f"{prefix}-{seq:0{_ENROLL_SEQ_PAD}d}"
        taken = (
            db.session
            .query(Student.id)
            .filter_by(school_id=school_id, admission_number=candidate)
            .first()
        )
        if not taken:
            return candidate


def next_roll_number(school_id, class_id) -> int | None:
    """Next free roll number within the class (None when there is no class).

    Must be called inside the caller's transaction — the School row lock
    taken by generate_enrollment_number (same transaction) serializes
    concurrent enrollments into the same class.
    """
    if not class_id:
        return None
    max_roll = (
        db.session
        .query(func.max(Student.roll_number))
        .filter(
            Student.school_id == school_id,
            Student.class_id == class_id,
            Student.is_deleted.is_(False),
        )
        .scalar()
    )
    roll = int(max_roll or 0) + 1
    while (
        db.session
        .query(Student.id)
        .filter_by(
            school_id=school_id,
            class_id=class_id,
            roll_number=roll,
            is_deleted=False,
        )
        .first()
    ):
        roll += 1
    return roll


def ensure_student_numbers(student: Student) -> None:
    """Fill in missing admission_number / roll_number on a NEW student.

    No-op for fields the caller already provided. Call after the student's
    class_id is populated and before the session commits.
    """
    if not student.admission_number:
        student.admission_number = generate_enrollment_number(student.school_id)
    if student.roll_number is None:
        student.roll_number = next_roll_number(student.school_id, student.class_id)
