"""Helpers for scoping teacher access to classes and subjects."""

from app.models.academic import Section, Subject


def teacher_allowed_subject_ids(school_id, user_id):
    if not school_id or not user_id:
        return []
    subjects = Subject.query.filter(
        Subject.school_id == school_id,
        Subject.is_deleted.is_(False),
        Subject.teacher_ids.any(user_id),
    ).all()
    return [subject.id for subject in subjects]


def teacher_allowed_class_ids(school_id, user_id):
    if not school_id or not user_id:
        return []
    subject_class_ids = []
    subjects = Subject.query.filter(
        Subject.school_id == school_id,
        Subject.is_deleted.is_(False),
        Subject.teacher_ids.any(user_id),
    ).all()
    for subject in subjects:
        subject_class_ids.extend(subject.class_ids or [])

    section_class_ids = [
        section.class_id
        for section in Section.query.filter_by(
            school_id=school_id,
            class_teacher_id=user_id,
            is_deleted=False,
        ).all()
    ]

    allowed = {class_id for class_id in [*subject_class_ids, *section_class_ids] if class_id}
    return list(allowed)
