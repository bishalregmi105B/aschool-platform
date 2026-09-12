"""A-35 dynamic registration/custom fields — school-defined form fields for
student/staff registration (and the public admission wizard), validated
server-side; values persist in `students.dynamic_fields` /
`staff.dynamic_fields` keyed by def id.
"""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.custom_field import CustomFieldDef
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

custom_fields_bp = Blueprint("custom_fields", __name__, url_prefix="/custom-fields")

VALID_TYPES = ("text", "textarea", "number", "date", "select", "multiselect", "checkbox")
VALID_FORMS = ("student_registration", "staff_registration")


def _def_dict(d):
    return {
        "id": str(d.id),
        "form_name": d.form_name,
        "label": d.label,
        "label_nepali": d.label_nepali,
        "field_type": d.field_type,
        "required": bool(d.required),
        "choices": d.choices or [],
        "rank": d.rank or 0,
        "is_active": bool(d.is_active),
    }


@custom_fields_bp.route("/defs", methods=["GET"])
@jwt_required()
@school_required
def list_defs():
    form_name = (request.args.get("form_name") or "").strip()
    query = CustomFieldDef.query.filter(
        CustomFieldDef.school_id == g.school_id,
        CustomFieldDef.is_deleted.is_(False),
    )
    if form_name:
        query = query.filter(CustomFieldDef.form_name == form_name)
    rows = query.order_by(CustomFieldDef.rank, CustomFieldDef.created_at).all()
    return success_response({"defs": [_def_dict(d) for d in rows]})


@custom_fields_bp.route("/defs", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_def():
    data = request.get_json(silent=True) or {}
    cleaned, err = _validated_def_payload(data)
    if err:
        return error_response(err, 400)
    d = CustomFieldDef(school_id=g.school_id, **cleaned)
    db.session.add(d)
    db.session.commit()
    return created_response(_def_dict(d))


@custom_fields_bp.route("/defs/<uuid:def_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_def(def_id):
    d = CustomFieldDef.query.filter_by(
        id=def_id, school_id=g.school_id, is_deleted=False
    ).first()
    if d is None:
        return error_response("Field definition not found", 404)
    data = request.get_json(silent=True) or {}
    cleaned, err = _validated_def_payload(data, partial=True)
    if err:
        return error_response(err, 400)
    for key, value in cleaned.items():
        setattr(d, key, value)
    db.session.commit()
    return success_response(_def_dict(d))


@custom_fields_bp.route("/defs/<uuid:def_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_def(def_id):
    d = CustomFieldDef.query.filter_by(
        id=def_id, school_id=g.school_id, is_deleted=False
    ).first()
    if d is None:
        return error_response("Field definition not found", 404)
    d.soft_delete()
    return success_response({"deleted": True})


@custom_fields_bp.route("/defs/public/<slug>/<form_name>", methods=["GET"])
def public_defs(slug, form_name):
    """Public read for the admission wizard — labels + choices only."""
    from app.models.school import School

    school = School.query.filter_by(slug=slug, is_active=True, is_deleted=False).first()
    if school is None or form_name not in VALID_FORMS:
        return error_response("Not found", 404)
    rows = CustomFieldDef.query.filter(
        CustomFieldDef.school_id == school.id,
        CustomFieldDef.form_name == form_name,
        CustomFieldDef.is_active.is_(True),
        CustomFieldDef.is_deleted.is_(False),
    ).order_by(CustomFieldDef.rank, CustomFieldDef.created_at).all()
    return success_response({
        "fields": [
            {
                "id": str(d.id),
                "label": d.label,
                "label_nepali": d.label_nepali,
                "field_type": d.field_type,
                "required": bool(d.required),
                "choices": d.choices or [],
            }
            for d in rows
        ]
    })


def _validated_def_payload(data, partial=False):
    cleaned = {}
    if "form_name" in data or not partial:
        form_name = str(data.get("form_name") or "").strip()
        if form_name not in VALID_FORMS:
            return None, f"form_name must be one of {VALID_FORMS}"
        cleaned["form_name"] = form_name
    if "label" in data or not partial:
        label = str(data.get("label") or "").strip()[:200]
        if not label:
            return None, "label is required"
        cleaned["label"] = label
    if "label_nepali" in data:
        cleaned["label_nepali"] = str(data.get("label_nepali") or "").strip()[:200] or None
    if "field_type" in data or not partial:
        ft = str(data.get("field_type") or "").strip()
        if ft not in VALID_TYPES:
            return None, f"field_type must be one of {VALID_TYPES}"
        cleaned["field_type"] = ft
    if "required" in data:
        cleaned["required"] = bool(data.get("required"))
    if "choices" in data:
        choices = data.get("choices")
        if choices is not None and not (
            isinstance(choices, list)
            and all(isinstance(c, str) for c in choices)
        ):
            return None, "choices must be a list of strings"
        cleaned["choices"] = choices or []
    if "rank" in data:
        try:
            cleaned["rank"] = int(data.get("rank") or 0)
        except (TypeError, ValueError):
            return None, "rank must be an integer"
    if "is_active" in data:
        cleaned["is_active"] = bool(data.get("is_active"))
    return cleaned, None


def validate_dynamic_fields(school_id, form_name: str, values) -> tuple[bool, dict, list]:
    """Server-side validation of a dynamic_fields payload against the
    school's defs: unknown keys dropped, required enforced, choices checked.
    Returns (ok, cleaned, errors)."""
    errors = []
    cleaned = {}
    if values is None:
        values = {}
    if not isinstance(values, dict):
        return False, {}, ["dynamic_fields must be an object"]
    defs = CustomFieldDef.query.filter(
        CustomFieldDef.school_id == school_id,
        CustomFieldDef.form_name == form_name,
        CustomFieldDef.is_active.is_(True),
        CustomFieldDef.is_deleted.is_(False),
    ).all()
    by_id = {str(d.id): d for d in defs}
    for key, value in values.items():
        d = by_id.get(str(key))
        if d is None:
            continue  # unknown keys are dropped silently (schema evolution)
        if d.field_type == "number":
            try:
                value = float(value) if value not in (None, "") else None
            except (TypeError, ValueError):
                errors.append({"id": str(d.id), "label": d.label,
                               "error": "must be a number"})
                continue
        if d.field_type in ("select", "multiselect") and d.choices:
            chosen = value if isinstance(value, list) else [value]
            invalid = [c for c in chosen if c and c not in d.choices]
            if invalid:
                errors.append({"id": str(d.id), "label": d.label,
                               "error": f"invalid choice(s): {invalid}"})
                continue
        if value not in (None, "", []):
            cleaned[str(d.id)] = value
    for d in defs:
        if d.required and not cleaned.get(str(d.id)):
            errors.append({"id": str(d.id), "label": d.label,
                           "error": "is required"})
    return (not errors), cleaned, errors
