"""Academic rollover task — promotes students into the next academic year."""

from datetime import date
import logging

from extensions import celery, db

logger = logging.getLogger(__name__)


@celery.task(name="academic_rollover_daily")
def academic_rollover_daily():
    """Promote students when the current academic year ends."""
    from app.models.school import School

    schools = School.query.filter_by(is_active=True, is_deleted=False).all()
    results = []
    for school in schools:
        results.append(_rollover_school(school.id))
    return results


def _rollover_school(school_id):
    from app.models.academic import AcademicYear, Class, Section
    from app.models.student import Student
    from app.utils.nepali_date import bs_to_ad

    current_year = AcademicYear.query.filter_by(
        school_id=school_id,
        is_current=True,
        is_deleted=False,
    ).first()
    if not current_year:
        return {"school_id": str(school_id), "status": "skipped", "reason": "no_current_year"}

    current_year_end = current_year.end_date_ad
    if not current_year_end and current_year.end_date_bs:
        try:
            current_year_end = bs_to_ad(current_year.end_date_bs)
        except Exception:
            logger.exception("Failed to parse current academic year BS end date for school %s", school_id)
            return {"school_id": str(school_id), "status": "skipped", "reason": "invalid_current_year_end"}

    if not current_year_end or current_year_end > date.today():
        return {"school_id": str(school_id), "status": "skipped", "reason": "year_not_ended"}

    next_year = _find_next_academic_year(current_year)
    if not next_year:
        return {"school_id": str(school_id), "status": "skipped", "reason": "no_next_year"}

    source_classes = Class.query.filter_by(
        school_id=school_id,
        academic_year_id=current_year.id,
        is_deleted=False,
    ).all()
    target_classes = Class.query.filter_by(
        school_id=school_id,
        academic_year_id=next_year.id,
        is_deleted=False,
    ).all()

    if not target_classes:
        return {"school_id": str(school_id), "status": "skipped", "reason": "no_target_classes"}

    source_class_map = {klass.id: klass for klass in source_classes}
    target_class_index = _build_target_class_index(target_classes)
    target_sections = Section.query.join(Class, Class.id == Section.class_id).filter(
        Section.school_id == school_id,
        Section.is_deleted.is_(False),
        Class.academic_year_id == next_year.id,
        Class.is_deleted.is_(False),
    ).all()
    section_index = _build_section_index(target_sections)

    students = Student.query.filter_by(
        school_id=school_id,
        academic_year_id=current_year.id,
        is_deleted=False,
    ).filter(Student.status.in_(("active", "transferred_in", "on_leave"))).all()

    promoted = 0
    graduated = 0
    unchanged = 0

    try:
        for student in students:
            source_class = source_class_map.get(student.class_id)
            if not source_class:
                unchanged += 1
                continue

            target_class = _find_target_class(source_class, target_class_index)
            if not target_class:
                student.status = "graduated"
                graduated += 1
                continue

            student.class_id = target_class.id
            student.section_id = _find_target_section_id(student, target_class, section_index)
            student.academic_year_id = next_year.id
            student.academic_year = next_year.name
            if student.status == "graduated":
                student.status = "active"
            promoted += 1

        current_year.is_current = False
        next_year.is_current = True
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Academic rollover failed for school %s", school_id)
        return {"school_id": str(school_id), "status": "failed"}

    logger.info(
        "Academic rollover completed for school %s: promoted=%d graduated=%d unchanged=%d next_year=%s",
        school_id,
        promoted,
        graduated,
        unchanged,
        next_year.name,
    )
    return {
        "school_id": str(school_id),
        "status": "completed",
        "current_year": current_year.name,
        "next_year": next_year.name,
        "promoted": promoted,
        "graduated": graduated,
        "unchanged": unchanged,
    }


def _find_next_academic_year(current_year):
    from app.models.academic import AcademicYear
    from app.utils.nepali_date import bs_to_ad

    query = AcademicYear.query.filter(
        AcademicYear.school_id == current_year.school_id,
        AcademicYear.id != current_year.id,
        AcademicYear.is_deleted.is_(False),
    ).all()

    def sort_key(year):
        if year.start_date_ad:
            return year.start_date_ad
        if year.start_date_bs:
            try:
                return bs_to_ad(year.start_date_bs)
            except Exception:
                return date.max
        return date.max

    later_years = [year for year in query if sort_key(year) > (current_year.end_date_ad or sort_key(current_year))]
    later_years.sort(key=sort_key)
    return later_years[0] if later_years else None


def _build_target_class_index(classes):
    index = {}
    for klass in classes:
        keys = [
            (klass.numeric_grade, klass.medium_id, klass.stream_id),
            (klass.numeric_grade, None, None),
            (klass.sort_order, klass.medium_id, klass.stream_id),
            (klass.sort_order, None, None),
        ]
        for key in keys:
            index.setdefault(key, klass)
    return index


def _find_target_class(source_class, target_class_index):
    candidate_keys = []
    if source_class.numeric_grade is not None:
        candidate_keys.extend(
            [
                (source_class.numeric_grade + 1, source_class.medium_id, source_class.stream_id),
                (source_class.numeric_grade + 1, None, None),
            ]
        )
    candidate_keys.extend(
        [
            (source_class.sort_order + 1, source_class.medium_id, source_class.stream_id),
            (source_class.sort_order + 1, None, None),
        ]
    )

    for key in candidate_keys:
        target = target_class_index.get(key)
        if target:
            return target
    return None


def _build_section_index(sections):
    index = {}
    for section in sections:
        index[(section.class_id, (section.name or "").strip().lower())] = section
    return index


def _find_target_section_id(student, target_class, section_index):
    if student.section and student.section.name:
        named = section_index.get(
            (target_class.id, student.section.name.strip().lower())
        )
        if named:
            return named.id

    fallback = next(
        (
            section.id
            for (class_id, _), section in section_index.items()
            if class_id == target_class.id
        ),
        None,
    )
    return fallback