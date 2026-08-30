"""Health Records API — student health profiles, immunization, medical visits."""
from datetime import date, datetime

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.health_records import HealthProfile, MedicalVisit, Immunization
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

health_records_bp = Blueprint("health_records", __name__, url_prefix="/health-records")


@health_records_bp.route("/profiles", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("health_records")
def list_health_profiles():
    """List existing health profiles for the school (the Allergies & Conditions
    registry page lists students from here, not from medical visits)."""
    query = HealthProfile.query.filter_by(school_id=g.school_id)
    search = request.args.get("search")
    items, meta = paginate(query.order_by(HealthProfile.created_at.desc()))
    results = [_profile_dict(p) for p in items]
    if search:
        # case-insensitive: the needle was lowercased but the haystack never
        # was, so any differently-cased query (e.g. "Aasha") filtered the
        # registry to zero rows (E130)
        needle = search.lower()
        results = [p for p in results if needle in (p.get("student_name") or "").lower()]
    return success_response(results, meta={"pagination": meta})


@health_records_bp.route("/students/<student_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("health_records")
def get_health_profile(student_id):
    profile = HealthProfile.query.filter_by(student_id=student_id, school_id=g.school_id).first()
    if not profile:
        return success_response({"student_id": student_id, "exists": False})
    return success_response(_profile_dict(profile))


@health_records_bp.route("/students/<student_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("health_records")
@role_required("superadmin", "school_admin", "teacher")
def update_health_profile(student_id):
    data = request.get_json(silent=True) or {}
    if not Student.query.filter_by(id=student_id, school_id=g.school_id).first():
        return error_response("Student not found at this school", 404)
    profile = HealthProfile.query.filter_by(student_id=student_id, school_id=g.school_id).first()
    if not profile:
        profile = HealthProfile(student_id=student_id, school_id=g.school_id)
        db.session.add(profile)

    for key in ("blood_group", "height_cm", "weight_kg", "allergies", "medical_conditions",
                 "emergency_contact", "emergency_phone", "insurance_info"):
        if key in data:
            setattr(profile, key, data[key])
    if "last_checkup_date" in data:
        profile.last_checkup_date = _parse_date(data.get("last_checkup_date"))

    db.session.commit()
    return success_response(_profile_dict(profile))


# ── Medical Visits ────────────────────────────────────────

@health_records_bp.route("/visits", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("health_records")
def list_medical_visits():
    query = MedicalVisit.query.filter_by(school_id=g.school_id)
    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)
    query = query.order_by(MedicalVisit.visit_date.desc())
    items, meta = paginate(query)
    return success_response([_visit_dict(v) for v in items], meta={"pagination": meta})


@health_records_bp.route("/visits", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("health_records")
@role_required("superadmin", "school_admin", "teacher")
def create_medical_visit():
    data = request.get_json(silent=True) or {}
    if not data.get("student_id"):
        return error_response("student_id is required", 400)
    if not Student.query.filter_by(id=data["student_id"], school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)
    visit = MedicalVisit(school_id=g.school_id, recorded_by=g.current_user.id)
    for key in ("student_id", "reason", "diagnosis", "treatment", "referred_to", "notes"):
        if key in data:
            setattr(visit, key, data[key])
    visit.visit_date = _parse_date(data.get("visit_date")) or date.today()
    db.session.add(visit)
    db.session.commit()
    return created_response(_visit_dict(visit))


# ── Immunizations ─────────────────────────────────────────

@health_records_bp.route("/immunizations", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("health_records")
def list_immunizations():
    student_id = request.args.get("student_id")
    query = Immunization.query.filter_by(school_id=g.school_id)
    if student_id:
        query = query.filter_by(student_id=student_id)
    items, meta = paginate(query)
    return success_response([_imm_dict(i) for i in items], meta={"pagination": meta})


@health_records_bp.route("/immunizations", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("health_records")
@role_required("superadmin", "school_admin", "teacher")
def record_immunization():
    data = request.get_json(silent=True) or {}
    if data.get("student_id") and not Student.query.filter_by(id=data["student_id"], school_id=g.school_id).first():
        return error_response("student_id does not match a student at this school", 400)
    if not (data.get("vaccine_name") or "").strip():
        return error_response("vaccine_name is required", 400)
    imm = Immunization(school_id=g.school_id)
    for key in ("student_id", "vaccine_name", "dose_number", "administered_by"):
        if key in data:
            setattr(imm, key, data[key])
    imm.date_administered = _parse_date(data.get("date_administered"))
    imm.next_due_date = _parse_date(data.get("next_due_date"))
    db.session.add(imm)
    db.session.commit()
    return created_response(_imm_dict(imm))


def _profile_dict(p):
    student = p.student if hasattr(p, "student") else None
    return {
        "id": str(p.id), "student_id": str(p.student_id) if p.student_id else None,
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "blood_group": p.blood_group,
        "height_cm": float(p.height_cm) if p.height_cm is not None else None,
        "weight_kg": float(p.weight_kg) if p.weight_kg is not None else None,
        "allergies": p.allergies, "medical_conditions": p.medical_conditions,
        "emergency_contact": p.emergency_contact, "emergency_phone": p.emergency_phone,
        "last_checkup_date": str(p.last_checkup_date) if p.last_checkup_date else None,
        "exists": True,
    }


def _visit_dict(v):
    student = v.student if hasattr(v, "student") else None
    return {
        "id": str(v.id), "student_id": str(v.student_id) if v.student_id else None,
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "visit_date": str(v.visit_date) if v.visit_date else None,
        "reason": v.reason, "diagnosis": v.diagnosis, "treatment": v.treatment,
    }


def _imm_dict(i):
    student = i.student if hasattr(i, "student") else None
    return {
        "id": str(i.id), "student_id": str(i.student_id) if i.student_id else None,
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "vaccine_name": i.vaccine_name,
        "dose_number": i.dose_number,
        "date_administered": str(i.date_administered) if i.date_administered else None,
        "next_due_date": str(i.next_due_date) if i.next_due_date else None,
    }


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None
