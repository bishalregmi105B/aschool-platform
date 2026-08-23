"""Academic setup API — years, semesters, classes, sections, subjects."""
from datetime import date, time
from uuid import UUID

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.academic import (
    AcademicYear,
    Class,
    Medium,
    Section,
    Semester,
    Shift,
    Stream,
    Subject,
)
from app.models.user import User
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from app.utils.teacher_scope import teacher_allowed_class_ids, teacher_allowed_subject_ids
from extensions import db

academics_bp = Blueprint("academics", __name__, url_prefix="/academics")


# ── Academic Years ─────────────────────────────────────────


@academics_bp.route("/years", methods=["GET"])
@jwt_required()
@school_required
def list_academic_years():
    query = AcademicYear.query.filter_by(school_id=g.school_id, is_deleted=False)
    query = query.order_by(AcademicYear.start_date_bs.desc())
    items, meta = paginate(query)
    return success_response([_year_dict(y) for y in items], meta={"pagination": meta})


@academics_bp.route("/years", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_academic_year():
    data = request.get_json(silent=True) or {}
    year = AcademicYear(school_id=g.school_id)
    for key in ("name", "name_nepali", "start_date_bs", "end_date_bs", "is_current"):
        if key in data:
            setattr(year, key, data[key])
    start_date_ad = _parse_date(data.get("start_date_ad") or data.get("start_date"))
    end_date_ad = _parse_date(data.get("end_date_ad") or data.get("end_date"))
    if start_date_ad:
        year.start_date_ad = start_date_ad
    if end_date_ad:
        year.end_date_ad = end_date_ad
    if data.get("is_current"):
        AcademicYear.query.filter_by(school_id=g.school_id).update({"is_current": False})
    db.session.add(year)
    db.session.commit()
    return created_response(_year_dict(year))


@academics_bp.route("/years/<uuid:year_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_academic_year(year_id):
    year = AcademicYear.query.get(year_id)
    if not year or year.is_deleted or str(year.school_id) != str(g.school_id):
        return error_response("Academic year not found", 404)

    data = request.get_json(silent=True) or {}
    for key in ("name", "name_nepali", "start_date_bs", "end_date_bs", "is_current"):
        if key in data:
            setattr(year, key, data[key])

    start_date_ad = _parse_date(data.get("start_date_ad") or data.get("start_date"))
    end_date_ad = _parse_date(data.get("end_date_ad") or data.get("end_date"))
    if "start_date" in data or "start_date_ad" in data:
        year.start_date_ad = start_date_ad
    if "end_date" in data or "end_date_ad" in data:
        year.end_date_ad = end_date_ad
    if data.get("is_current"):
        AcademicYear.query.filter(
            AcademicYear.school_id == g.school_id,
            AcademicYear.id != year.id,
        ).update({"is_current": False})

    db.session.commit()
    return success_response(_year_dict(year))


@academics_bp.route("/years/<uuid:year_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_academic_year(year_id):
    year = AcademicYear.query.get(year_id)
    if not year or year.is_deleted or str(year.school_id) != str(g.school_id):
        return error_response("Academic year not found", 404)

    year.soft_delete()
    return no_content_response()


# ── Classes ────────────────────────────────────────────────


@academics_bp.route("/semesters", methods=["GET"])
@jwt_required()
@school_required
def list_semesters():
    query = Semester.query.filter_by(school_id=g.school_id, is_deleted=False)
    academic_year_id = request.args.get("academic_year_id")
    if academic_year_id:
        year_uuid = _parse_uuid_value(academic_year_id)
        if not year_uuid:
            return error_response("Invalid academic_year_id", 400)
        query = query.filter_by(academic_year_id=year_uuid)
    items, meta = paginate(query.order_by(Semester.sort_order, Semester.start_date_bs))
    return success_response([_semester_dict(item) for item in items], meta={"pagination": meta})


@academics_bp.route("/semesters", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_semester():
    data = request.get_json(silent=True) or {}
    semester = Semester(school_id=g.school_id)
    _apply_semester_payload(semester, data)
    if data.get("is_current"):
        Semester.query.filter_by(school_id=g.school_id).update({"is_current": False})
    db.session.add(semester)
    db.session.commit()
    return created_response(_semester_dict(semester))


@academics_bp.route("/semesters/<uuid:semester_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_semester(semester_id):
    semester = Semester.query.get(semester_id)
    if not semester or semester.is_deleted or str(semester.school_id) != str(g.school_id):
        return error_response("Semester not found", 404)
    data = request.get_json(silent=True) or {}
    _apply_semester_payload(semester, data)
    if data.get("is_current"):
        Semester.query.filter(
            Semester.school_id == g.school_id,
            Semester.id != semester.id,
        ).update({"is_current": False})
    db.session.commit()
    return success_response(_semester_dict(semester))


@academics_bp.route("/semesters/<uuid:semester_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_semester(semester_id):
    semester = Semester.query.get(semester_id)
    if not semester or semester.is_deleted or str(semester.school_id) != str(g.school_id):
        return error_response("Semester not found", 404)
    semester.soft_delete()
    return no_content_response()


@academics_bp.route("/mediums", methods=["GET"])
@jwt_required()
@school_required
def list_mediums():
    items = Medium.query.filter_by(school_id=g.school_id, is_deleted=False).order_by(Medium.name).all()
    return success_response([_medium_dict(item) for item in items])


@academics_bp.route("/mediums", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_medium():
    data = request.get_json(silent=True) or {}
    medium = Medium(school_id=g.school_id)
    _apply_named_dimension_payload(medium, data)
    if data.get("is_default"):
        Medium.query.filter_by(school_id=g.school_id).update({"is_default": False})
    db.session.add(medium)
    db.session.commit()
    return created_response(_medium_dict(medium))


@academics_bp.route("/mediums/<uuid:medium_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_medium(medium_id):
    medium = Medium.query.get(medium_id)
    if not medium or medium.is_deleted or str(medium.school_id) != str(g.school_id):
        return error_response("Medium not found", 404)
    data = request.get_json(silent=True) or {}
    _apply_named_dimension_payload(medium, data)
    if data.get("is_default"):
        Medium.query.filter(Medium.school_id == g.school_id, Medium.id != medium.id).update({"is_default": False})
    db.session.commit()
    return success_response(_medium_dict(medium))


@academics_bp.route("/mediums/<uuid:medium_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_medium(medium_id):
    medium = Medium.query.get(medium_id)
    if not medium or medium.is_deleted or str(medium.school_id) != str(g.school_id):
        return error_response("Medium not found", 404)
    medium.soft_delete()
    return no_content_response()


@academics_bp.route("/streams", methods=["GET"])
@jwt_required()
@school_required
def list_streams():
    query = Stream.query.filter_by(school_id=g.school_id, is_deleted=False)
    class_id = _parse_uuid_value(request.args.get("class_id"))
    if class_id:
        query = query.filter(Stream.class_ids.any(class_id))
    items = query.order_by(Stream.name).all()
    return success_response([_stream_dict(item) for item in items])


@academics_bp.route("/streams", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_stream():
    data = request.get_json(silent=True) or {}
    stream = Stream(school_id=g.school_id)
    _apply_stream_payload(stream, data)
    if data.get("is_default"):
        Stream.query.filter_by(school_id=g.school_id).update({"is_default": False})
    db.session.add(stream)
    db.session.commit()
    return created_response(_stream_dict(stream))


@academics_bp.route("/streams/<uuid:stream_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_stream(stream_id):
    stream = Stream.query.get(stream_id)
    if not stream or stream.is_deleted or str(stream.school_id) != str(g.school_id):
        return error_response("Stream not found", 404)
    data = request.get_json(silent=True) or {}
    _apply_stream_payload(stream, data)
    if data.get("is_default"):
        Stream.query.filter(Stream.school_id == g.school_id, Stream.id != stream.id).update({"is_default": False})
    db.session.commit()
    return success_response(_stream_dict(stream))


@academics_bp.route("/streams/<uuid:stream_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_stream(stream_id):
    stream = Stream.query.get(stream_id)
    if not stream or stream.is_deleted or str(stream.school_id) != str(g.school_id):
        return error_response("Stream not found", 404)
    stream.soft_delete()
    return no_content_response()


@academics_bp.route("/shifts", methods=["GET"])
@jwt_required()
@school_required
def list_shifts():
    items = Shift.query.filter_by(school_id=g.school_id, is_deleted=False).order_by(Shift.start_time, Shift.name).all()
    return success_response([_shift_dict(item) for item in items])


@academics_bp.route("/shifts", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_shift():
    data = request.get_json(silent=True) or {}
    shift = Shift(school_id=g.school_id)
    _apply_shift_payload(shift, data)
    if data.get("is_default"):
        Shift.query.filter_by(school_id=g.school_id).update({"is_default": False})
    db.session.add(shift)
    db.session.commit()
    return created_response(_shift_dict(shift))


@academics_bp.route("/shifts/<uuid:shift_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_shift(shift_id):
    shift = Shift.query.get(shift_id)
    if not shift or shift.is_deleted or str(shift.school_id) != str(g.school_id):
        return error_response("Shift not found", 404)
    data = request.get_json(silent=True) or {}
    _apply_shift_payload(shift, data)
    if data.get("is_default"):
        Shift.query.filter(Shift.school_id == g.school_id, Shift.id != shift.id).update({"is_default": False})
    db.session.commit()
    return success_response(_shift_dict(shift))


@academics_bp.route("/shifts/<uuid:shift_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_shift(shift_id):
    shift = Shift.query.get(shift_id)
    if not shift or shift.is_deleted or str(shift.school_id) != str(g.school_id):
        return error_response("Shift not found", 404)
    shift.soft_delete()
    return no_content_response()


@academics_bp.route("/classes", methods=["GET"])
@jwt_required()
@school_required
def list_classes():
    query = Class.query.filter_by(school_id=g.school_id, is_deleted=False)
    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        if not allowed_class_ids:
            items, meta = paginate(query.filter(Class.id.is_(None)))
            return success_response([], meta={"pagination": meta})
        query = query.filter(Class.id.in_(allowed_class_ids))

    for arg_name in ("academic_year_id", "medium_id", "stream_id"):
        raw_value = request.args.get(arg_name)
        if raw_value:
            parsed_value = _parse_uuid_value(raw_value)
            if not parsed_value:
                return error_response(f"Invalid {arg_name}", 400)
            query = query.filter(getattr(Class, arg_name) == parsed_value)
    query = query.order_by(Class.sort_order)
    items, meta = paginate(query)
    return success_response([_class_dict(c) for c in items], meta={"pagination": meta})


@academics_bp.route("/classes", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_class():
    data = request.get_json(silent=True) or {}
    cls = Class(school_id=g.school_id)
    _apply_class_payload(cls, data)
    if cls.sort_order is None and cls.numeric_grade is not None:
        cls.sort_order = cls.numeric_grade
    db.session.add(cls)
    db.session.commit()
    return created_response(_class_dict(cls))


@academics_bp.route("/classes/<uuid:class_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_class(class_id):
    cls = Class.query.get(class_id)
    if not cls or cls.is_deleted or str(cls.school_id) != str(g.school_id):
        return error_response("Class not found", 404)
    data = request.get_json(silent=True) or {}
    _apply_class_payload(cls, data)
    db.session.commit()
    return success_response(_class_dict(cls))


@academics_bp.route("/classes/<uuid:class_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_class(class_id):
    cls = Class.query.get(class_id)
    if not cls or cls.is_deleted or str(cls.school_id) != str(g.school_id):
        return error_response("Class not found", 404)
    cls.soft_delete()
    return no_content_response()


# ── Sections ───────────────────────────────────────────────


@academics_bp.route("/classes/<uuid:class_id>/sections", methods=["GET"])
@jwt_required()
@school_required
def list_sections(class_id):
    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return success_response([])

    query = Section.query.filter_by(class_id=class_id, school_id=g.school_id, is_deleted=False)
    items = query.order_by(Section.name).all()
    return success_response([_section_dict(s) for s in items])


@academics_bp.route("/classes/<uuid:class_id>/sections", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_section(class_id):
    klass = Class.query.get(class_id)
    if not klass or klass.is_deleted or str(klass.school_id) != str(g.school_id):
        return error_response("Class not found", 404)
    data = request.get_json(silent=True) or {}
    section = Section(class_id=class_id, school_id=g.school_id)
    for key in ("name", "capacity"):
        if key in data:
            setattr(section, key, data[key])
    class_teacher_id = _parse_uuid_value(data.get("class_teacher_id"))
    if class_teacher_id:
        section.class_teacher_id = class_teacher_id
    for key in ("medium_id", "shift_id"):
        if key in data:
            setattr(section, key, _parse_uuid_value(data.get(key)))
    db.session.add(section)
    db.session.commit()
    return created_response(_section_dict(section))


@academics_bp.route("/classes/<uuid:class_id>/sections/<uuid:section_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_section(class_id, section_id):
    section = Section.query.get(section_id)
    if (
        not section
        or section.is_deleted
        or str(section.school_id) != str(g.school_id)
        or str(section.class_id) != str(class_id)
    ):
        return error_response("Section not found", 404)

    data = request.get_json(silent=True) or {}
    for key in ("name", "capacity"):
        if key in data:
            setattr(section, key, data[key])

    if "class_teacher_id" in data:
        section.class_teacher_id = _parse_uuid_value(data.get("class_teacher_id"))
    for key in ("medium_id", "shift_id"):
        if key in data:
            setattr(section, key, _parse_uuid_value(data.get(key)))

    db.session.commit()
    return success_response(_section_dict(section))


@academics_bp.route("/classes/<uuid:class_id>/sections/<uuid:section_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_section(class_id, section_id):
    section = Section.query.get(section_id)
    if (
        not section
        or section.is_deleted
        or str(section.school_id) != str(g.school_id)
        or str(section.class_id) != str(class_id)
    ):
        return error_response("Section not found", 404)

    section.soft_delete()
    return no_content_response()


# ── Subjects ───────────────────────────────────────────────


@academics_bp.route("/subjects", methods=["GET"])
@jwt_required()
@school_required
def list_subjects():
    query = Subject.query.filter_by(school_id=g.school_id, is_deleted=False)
    class_id = request.args.get("class_id")
    class_uuid = None
    if class_id:
        class_uuid = _parse_uuid_value(class_id)
        if not class_uuid:
            return error_response("Invalid class_id", 400)
        query = query.filter(Subject.class_ids.any(class_uuid))
    stream_id = request.args.get("stream_id")
    if stream_id:
        stream_uuid = _parse_uuid_value(stream_id)
        if not stream_uuid:
            return error_response("Invalid stream_id", 400)
        query = query.filter(Subject.stream_id == stream_uuid)

    if g.role == "teacher" and g.user_id:
        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        if not allowed_subject_ids:
            items, meta = paginate(query.filter(Subject.id.is_(None)))
            return success_response([], meta={"pagination": meta})

        query = query.filter(Subject.id.in_(allowed_subject_ids))

        if class_uuid:
            allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
            allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
            if not allowed_class_ids_set or str(class_uuid) not in allowed_class_ids_set:
                items, meta = paginate(query.filter(Subject.id.is_(None)))
                return success_response([], meta={"pagination": meta})

    items, meta = paginate(query.order_by(Subject.name))
    return success_response([_subject_dict(s) for s in items], meta={"pagination": meta})


@academics_bp.route("/subjects", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_subject():
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return error_response("name is required", 400)
    subject = Subject(school_id=g.school_id)
    _apply_subject_payload(subject, data)
    db.session.add(subject)
    db.session.commit()
    return created_response(_subject_dict(subject))


@academics_bp.route("/subjects/<uuid:subject_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_subject(subject_id):
    subject = Subject.query.get(subject_id)
    if not subject or subject.is_deleted or str(subject.school_id) != str(g.school_id):
        return error_response("Subject not found", 404)
    data = request.get_json(silent=True) or {}
    _apply_subject_payload(subject, data)
    db.session.commit()
    return success_response(_subject_dict(subject))


@academics_bp.route("/subjects/<uuid:subject_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_subject(subject_id):
    subject = Subject.query.get(subject_id)
    if not subject or subject.is_deleted or str(subject.school_id) != str(g.school_id):
        return error_response("Subject not found", 404)

    subject.soft_delete()
    return no_content_response()


@academics_bp.route("/classes/<uuid:class_id>/subjects", methods=["GET"])
@jwt_required()
@school_required
def list_class_subjects(class_id):
    klass = Class.query.get(class_id)
    if not klass or klass.is_deleted or str(klass.school_id) != str(g.school_id):
        return error_response("Class not found", 404)

    query = Subject.query.filter_by(school_id=g.school_id, is_deleted=False).filter(
        Subject.class_ids.any(class_id)
    )

    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
        if not allowed_class_ids_set or str(class_id) not in allowed_class_ids_set:
            return success_response([])

        allowed_subject_ids = teacher_allowed_subject_ids(g.school_id, g.user_id)
        if not allowed_subject_ids:
            return success_response([])
        query = query.filter(Subject.id.in_(allowed_subject_ids))

    items = query.order_by(Subject.name).all()
    return success_response([_subject_dict(s) for s in items])


@academics_bp.route("/classes/<uuid:class_id>/subjects", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def assign_subject_to_class(class_id):
    klass = Class.query.get(class_id)
    if klass and not klass.is_deleted and str(klass.school_id) != str(g.school_id):
        return error_response("Class belongs to another school", 403)
    if not klass or klass.is_deleted:
        return error_response("Class not found", 404)

    data = request.get_json(silent=True) or {}
    subject_id = _parse_uuid_value(data.get("subject_id"))
    if not subject_id:
        return error_response("subject_id is required", 400)

    subject = Subject.query.get(subject_id)
    if subject and not subject.is_deleted and str(subject.school_id) != str(g.school_id):
        return error_response("Subject belongs to another school", 403)
    if not subject or subject.is_deleted:
        return error_response("Subject not found", 404)

    class_ids = list(subject.class_ids or [])
    if class_id not in class_ids:
        class_ids.append(class_id)
        subject.class_ids = class_ids
        db.session.commit()

    return created_response(_subject_dict(subject))


# ── Serializers ────────────────────────────────────────────


def _year_dict(y):
    return {
        "id": str(y.id), "name": y.name, "name_nepali": getattr(y, "name_nepali", None),
        "start_date": str(y.start_date_ad) if y.start_date_ad else y.start_date_bs,
        "end_date": str(y.end_date_ad) if y.end_date_ad else y.end_date_bs,
        "start_date_bs": y.start_date_bs, "end_date_bs": y.end_date_bs,
        "start_date_ad": str(y.start_date_ad) if y.start_date_ad else None,
        "end_date_ad": str(y.end_date_ad) if y.end_date_ad else None,
        "is_current": y.is_current,
    }


def _class_dict(c):
    return {
        "id": str(c.id), "name": c.name, "name_nepali": getattr(c, "name_nepali", None),
        "grade_number": getattr(c, "numeric_grade", None),
        "numeric_grade": getattr(c, "numeric_grade", None),
        "sort_order": getattr(c, "sort_order", 0),
        "academic_year_id": str(c.academic_year_id) if getattr(c, "academic_year_id", None) else None,
        "medium_id": str(c.medium_id) if getattr(c, "medium_id", None) else None,
        "medium_name": c.medium.name if getattr(c, "medium", None) else None,
        "stream_id": str(c.stream_id) if getattr(c, "stream_id", None) else None,
        "stream_name": c.stream.name if getattr(c, "stream", None) else None,
        "sections": [
            {
                "id": str(section.id),
                "name": section.name,
                "capacity": getattr(section, "capacity", None),
                "class_teacher_id": str(section.class_teacher_id) if getattr(section, "class_teacher_id", None) else None,
                "medium_id": str(section.medium_id) if getattr(section, "medium_id", None) else None,
                "medium_name": section.medium.name if getattr(section, "medium", None) else None,
                "shift_id": str(section.shift_id) if getattr(section, "shift_id", None) else None,
                "shift_name": section.shift.name if getattr(section, "shift", None) else None,
            }
            for section in sorted(getattr(c, "sections", []) or [], key=lambda item: item.name or "")
            if not getattr(section, "is_deleted", False)
        ],
    }


def _section_dict(s):
    return {
        "id": str(s.id), "name": s.name, "name_nepali": getattr(s, "name_nepali", None),
        "class_id": str(s.class_id), "capacity": getattr(s, "capacity", None),
        "class_teacher_id": str(s.class_teacher_id) if getattr(s, "class_teacher_id", None) else None,
        "medium_id": str(s.medium_id) if getattr(s, "medium_id", None) else None,
        "medium_name": s.medium.name if getattr(s, "medium", None) else None,
        "shift_id": str(s.shift_id) if getattr(s, "shift_id", None) else None,
        "shift_name": s.shift.name if getattr(s, "shift", None) else None,
    }


def _subject_dict(s):
    class_ids = [str(class_id) for class_id in (s.class_ids or [])]
    raw_teacher_ids = list(s.teacher_ids or [])
    teacher_ids = [str(teacher_id) for teacher_id in raw_teacher_ids]
    primary_teacher_uuid = raw_teacher_ids[0] if raw_teacher_ids else None
    primary_teacher_id = str(primary_teacher_uuid) if primary_teacher_uuid else None
    primary_teacher = User.query.get(primary_teacher_uuid) if primary_teacher_uuid else None
    subject_type = (s.subject_type or "compulsory").lower()
    return {
        "id": str(s.id), "name": s.name, "name_nepali": getattr(s, "name_nepali", None),
        "code": s.code,
        "class_id": class_ids[0] if class_ids else None,
        "class_ids": class_ids,
        "teacher_id": primary_teacher_id,
        "teacher_ids": teacher_ids,
        "teacher_name": getattr(primary_teacher, "full_name", None),
        "credit_hours": getattr(s, "credit_hours", None),
        "subject_type": subject_type,
        "is_optional": subject_type == "optional",
        "stream_id": str(s.stream_id) if getattr(s, "stream_id", None) else None,
        "stream_name": s.stream.name if getattr(s, "stream", None) else None,
        "has_practical": getattr(s, "has_practical", False),
        "full_marks": getattr(s, "full_marks", None),
        "pass_marks": getattr(s, "pass_marks", None),
        "practical_full_marks": getattr(s, "practical_full_marks", None),
        "practical_pass_marks": getattr(s, "practical_pass_marks", None),
    }


def _semester_dict(semester):
    return {
        "id": str(semester.id),
        "academic_year_id": str(semester.academic_year_id),
        "academic_year_name": semester.academic_year.name if semester.academic_year else None,
        "name": semester.name,
        "name_nepali": semester.name_nepali,
        "start_date": str(semester.start_date_ad) if semester.start_date_ad else semester.start_date_bs,
        "end_date": str(semester.end_date_ad) if semester.end_date_ad else semester.end_date_bs,
        "start_date_bs": semester.start_date_bs,
        "end_date_bs": semester.end_date_bs,
        "start_date_ad": str(semester.start_date_ad) if semester.start_date_ad else None,
        "end_date_ad": str(semester.end_date_ad) if semester.end_date_ad else None,
        "sort_order": semester.sort_order or 0,
        "is_current": bool(semester.is_current),
    }


def _medium_dict(medium):
    return {
        "id": str(medium.id),
        "name": medium.name,
        "name_nepali": medium.name_nepali,
        "code": medium.code,
        "is_default": bool(medium.is_default),
    }


def _stream_dict(stream):
    return {
        "id": str(stream.id),
        "name": stream.name,
        "name_nepali": stream.name_nepali,
        "code": stream.code,
        "description": stream.description,
        "class_ids": [str(class_id) for class_id in (stream.class_ids or [])],
        "is_default": bool(stream.is_default),
    }


def _shift_dict(shift):
    return {
        "id": str(shift.id),
        "name": shift.name,
        "name_nepali": shift.name_nepali,
        "start_time": shift.start_time.isoformat(timespec="minutes") if shift.start_time else None,
        "end_time": shift.end_time.isoformat(timespec="minutes") if shift.end_time else None,
        "is_default": bool(shift.is_default),
    }


def _apply_class_payload(cls, data):
    for key in ("name", "name_nepali", "sort_order"):
        if key in data:
            setattr(cls, key, data[key])
    if "numeric_grade" in data:
        cls.numeric_grade = data["numeric_grade"]
    elif "grade_number" in data:
        cls.numeric_grade = data["grade_number"]
    for key in ("academic_year_id", "medium_id", "stream_id"):
        if key in data:
            setattr(cls, key, _parse_uuid_value(data.get(key)))


def _apply_semester_payload(semester, data):
    for key in ("name", "name_nepali", "start_date_bs", "end_date_bs", "sort_order", "is_current"):
        if key in data:
            setattr(semester, key, data[key])
    if "academic_year_id" in data:
        semester.academic_year_id = _parse_uuid_value(data.get("academic_year_id"))
    start_date_ad = _parse_date(data.get("start_date_ad") or data.get("start_date"))
    end_date_ad = _parse_date(data.get("end_date_ad") or data.get("end_date"))
    if "start_date" in data or "start_date_ad" in data:
        semester.start_date_ad = start_date_ad
    if "end_date" in data or "end_date_ad" in data:
        semester.end_date_ad = end_date_ad


def _apply_named_dimension_payload(item, data):
    for key in ("name", "name_nepali", "code", "is_default"):
        if key in data:
            setattr(item, key, data[key])


def _apply_stream_payload(stream, data):
    _apply_named_dimension_payload(stream, data)
    if "description" in data:
        stream.description = data["description"]
    if "class_ids" in data or "class_id" in data:
        class_ids = _normalize_uuid_list(data.get("class_ids"))
        if not class_ids:
            class_id = _parse_uuid_value(data.get("class_id"))
            if class_id:
                class_ids = [class_id]
        stream.class_ids = class_ids


def _apply_shift_payload(shift, data):
    for key in ("name", "name_nepali", "is_default"):
        if key in data:
            setattr(shift, key, data[key])
    if "start_time" in data:
        shift.start_time = _parse_time(data.get("start_time"))
    if "end_time" in data:
        shift.end_time = _parse_time(data.get("end_time"))


def _apply_subject_payload(subject, data):
    for key in (
        "name",
        "name_nepali",
        "code",
        "credit_hours",
        "has_practical",
        "full_marks",
        "pass_marks",
    ):
        if key in data:
            setattr(subject, key, data[key])

    for key in ("practical_full_marks", "practical_pass_marks"):
        if key in data:
            value = data.get(key)
            setattr(subject, key, None if value in (None, "") else value)

    if not getattr(subject, "has_practical", False):
        subject.practical_full_marks = None
        subject.practical_pass_marks = None

    if "class_ids" in data or "class_id" in data:
        class_ids = _normalize_uuid_list(data.get("class_ids"))
        if not class_ids:
            class_id = _parse_uuid_value(data.get("class_id"))
            if class_id:
                class_ids = [class_id]
        subject.class_ids = class_ids

    if "teacher_ids" in data or "teacher_id" in data:
        teacher_ids = _normalize_uuid_list(data.get("teacher_ids"))
        if not teacher_ids:
            teacher_id = _parse_uuid_value(data.get("teacher_id"))
            if teacher_id:
                teacher_ids = [teacher_id]
        subject.teacher_ids = teacher_ids

    if "stream_id" in data:
        subject.stream_id = _parse_uuid_value(data.get("stream_id"))

    subject_type = data.get("subject_type") or data.get("type")
    if subject_type is None and "is_optional" in data:
        subject_type = "optional" if _is_truthy(data.get("is_optional")) else "compulsory"
    if subject_type:
        subject.subject_type = str(subject_type).strip().lower()


def _normalize_uuid_list(value):
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    items = []
    for item in values:
        parsed = _parse_uuid_value(item)
        if parsed:
            items.append(parsed)
    return items


def _parse_uuid_value(value):
    if not value:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _parse_time(value):
    if not value:
        return None
    if isinstance(value, time):
        return value
    text = str(value).strip()
    if len(text.split(":")) == 2:
        text = f"{text}:00"
    try:
        return time.fromisoformat(text)
    except (TypeError, ValueError):
        return None


def _is_truthy(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}
