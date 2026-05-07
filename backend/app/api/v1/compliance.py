"""Government Compliance & Reporting API — EMIS, MoE reports, audit logs."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.compliance import ComplianceReport, EMISExport, AuditLog
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

compliance_bp = Blueprint("compliance", __name__, url_prefix="/compliance")


# ── Compliance Reports ─────────────────────────────────────


@compliance_bp.route("/reports", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("compliance")
def list_reports():
    query = ComplianceReport.query.filter_by(school_id=g.school_id, is_deleted=False)
    report_type = request.args.get("type")
    if report_type:
        query = query.filter_by(report_type=report_type)
    items, meta = paginate(query.order_by(ComplianceReport.created_at.desc()))
    return success_response([_report_dict(r) for r in items], meta={"pagination": meta})


@compliance_bp.route("/reports", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("compliance")
@role_required("superadmin", "school_admin")
def create_report():
    data = request.get_json(silent=True) or {}
    report = ComplianceReport(school_id=g.school_id)
    for key in ("report_type", "academic_year", "data", "status", "notes"):
        if key in data:
            setattr(report, key, data[key])
    db.session.add(report)
    db.session.commit()
    return created_response(_report_dict(report))


@compliance_bp.route("/reports/<uuid:report_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("compliance")
@role_required("superadmin", "school_admin")
def update_report(report_id):
    report = ComplianceReport.query.filter_by(
        id=report_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not report:
        return error_response("Report not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("report_type", "academic_year", "data", "status", "notes",
                "submitted_at"):
        if key in data:
            setattr(report, key, data[key])
    if data.get("status") == "submitted" and not report.submitted_by_id:
        report.submitted_by_id = g.current_user.id
    db.session.commit()
    return success_response(_report_dict(report))


# ── Auto-generate reports ─────────────────────────────────


@compliance_bp.route("/reports/generate", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("compliance")
@role_required("superadmin", "school_admin")
def generate_report():
    """Auto-generate a compliance report from school data."""
    data = request.get_json(silent=True) or {}
    report_type = data.get("report_type", "emis")
    academic_year = data.get("academic_year")

    from app.models.student import Student
    from app.models.user import User
    from sqlalchemy import func

    student_count = Student.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).count()
    staff_count = User.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).count()

    report_data = {
        "school_id": str(g.school_id),
        "total_students": student_count,
        "total_staff": staff_count,
        "academic_year": academic_year,
        "generated": True,
    }

    report = ComplianceReport(
        school_id=g.school_id,
        report_type=report_type,
        academic_year=academic_year,
        data=report_data,
        status="draft",
    )
    db.session.add(report)
    db.session.commit()
    return created_response(_report_dict(report))


# ── EMIS Exports ───────────────────────────────────────────


@compliance_bp.route("/emis", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("compliance")
def list_emis_exports():
    query = EMISExport.query.filter_by(school_id=g.school_id, is_deleted=False)
    items, meta = paginate(query.order_by(EMISExport.generated_at.desc()))
    return success_response([_emis_dict(e) for e in items], meta={"pagination": meta})


@compliance_bp.route("/emis/generate", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("compliance")
@role_required("superadmin", "school_admin")
def generate_emis():
    """Generate EMIS-compatible export data."""
    data = request.get_json(silent=True) or {}
    from datetime import datetime, timezone

    emis = EMISExport(
        school_id=g.school_id,
        academic_year=data.get("academic_year"),
        export_data=data.get("data", {}),
        generated_at=datetime.now(timezone.utc),
        generated_by_id=g.current_user.id,
    )
    db.session.add(emis)
    db.session.commit()
    return created_response(_emis_dict(emis))


# ── Audit Logs ─────────────────────────────────────────────


@compliance_bp.route("/audit-logs", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("compliance")
@role_required("superadmin", "school_admin")
def list_audit_logs():
    query = AuditLog.query.filter_by(school_id=g.school_id, is_deleted=False)
    user_id = request.args.get("user_id")
    if user_id:
        query = query.filter_by(user_id=user_id)
    action = request.args.get("action")
    if action:
        query = query.filter_by(action=action)
    items, meta = paginate(query.order_by(AuditLog.created_at.desc()))
    return success_response([_audit_dict(a) for a in items], meta={"pagination": meta})


# ── Serializers ────────────────────────────────────────────


def _report_dict(r):
    return {
        "id": str(r.id), "report_type": r.report_type,
        "academic_year": r.academic_year, "data": r.data,
        "status": r.status, "notes": r.notes,
        "submitted_at": str(r.submitted_at) if r.submitted_at else None,
        "submitted_by_id": str(r.submitted_by_id) if r.submitted_by_id else None,
        "submitted_by_name": r.submitted_by.full_name if getattr(r, "submitted_by", None) else None,
        "created_at": str(r.created_at),
    }


def _emis_dict(e):
    return {
        "id": str(e.id), "academic_year": e.academic_year,
        "export_data": e.export_data, "file_url": e.file_url,
        "generated_at": str(e.generated_at) if e.generated_at else None,
    }


def _audit_dict(a):
    return {
        "id": str(a.id), "user_id": str(a.user_id) if a.user_id else None,
        "user_name": a.user.full_name if getattr(a, "user", None) else None,
        "action": a.action, "resource_type": a.resource_type,
        "resource_id": str(a.resource_id) if a.resource_id else None,
        "old_values": a.old_values, "new_values": a.new_values,
        "ip_address": a.ip_address, "created_at": str(a.created_at),
    }
