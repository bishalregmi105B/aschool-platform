"""Inventory & Asset Management API — assets, procurement, QR tracking."""
from datetime import date, datetime

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required

from app.models.inventory import Asset, AssetAuditLog, ProcurementRequest
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

inventory_bp = Blueprint("inventory", __name__, url_prefix="/inventory")


# ── Assets ─────────────────────────────────────────────────


@inventory_bp.route("/assets", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("inventory")
def list_assets():
    query = Asset.query.filter_by(school_id=g.school_id, is_deleted=False)
    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)
    condition = request.args.get("condition")
    if condition:
        query = query.filter_by(condition=condition)
    items, meta = paginate(query.order_by(Asset.name))
    return success_response([_asset_dict(a) for a in items], meta={"pagination": meta})


@inventory_bp.route("/assets", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("inventory")
@role_required("superadmin", "school_admin", "staff")
def create_asset():
    data = request.get_json(silent=True) or {}
    asset = Asset(school_id=g.school_id)
    for key in ("name", "asset_code", "qr_code", "category", "location",
                "purchase_price", "current_value", "depreciation_rate",
                "condition", "assigned_to_id", "notes"):
        if key in data:
            setattr(asset, key, data[key])
    asset.purchase_date = _parse_date(data.get("purchase_date"))
    asset.warranty_expiry = _parse_date(data.get("warranty_expiry"))
    db.session.add(asset)
    db.session.commit()
    return created_response(_asset_dict(asset))


@inventory_bp.route("/assets/<uuid:asset_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("inventory")
def get_asset(asset_id):
    asset = Asset.query.filter_by(id=asset_id, school_id=g.school_id, is_deleted=False).first()
    if not asset:
        return error_response("Asset not found", 404)
    return success_response(_asset_dict(asset))


@inventory_bp.route("/assets/<uuid:asset_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("inventory")
@role_required("superadmin", "school_admin", "staff")
def update_asset(asset_id):
    asset = Asset.query.filter_by(id=asset_id, school_id=g.school_id, is_deleted=False).first()
    if not asset:
        return error_response("Asset not found", 404)
    data = request.get_json(silent=True) or {}
    for key in ("name", "asset_code", "qr_code", "category", "location",
                "purchase_price", "current_value", "depreciation_rate",
                "condition", "assigned_to_id", "notes", "is_active"):
        if key in data:
            setattr(asset, key, data[key])
    if "purchase_date" in data:
        asset.purchase_date = _parse_date(data.get("purchase_date"))
    if "warranty_expiry" in data:
        asset.warranty_expiry = _parse_date(data.get("warranty_expiry"))
    db.session.commit()
    return success_response(_asset_dict(asset))


@inventory_bp.route("/assets/<uuid:asset_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("inventory")
@role_required("superadmin", "school_admin")
def delete_asset(asset_id):
    asset = Asset.query.filter_by(id=asset_id, school_id=g.school_id, is_deleted=False).first()
    if not asset:
        return error_response("Asset not found", 404)
    asset.soft_delete()
    return success_response({"deleted": True})


@inventory_bp.route("/assets/scan/<string:qr_code>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("inventory")
def scan_asset(qr_code):
    """Look up asset by QR code."""
    asset = Asset.query.filter_by(
        qr_code=qr_code, school_id=g.school_id, is_deleted=False
    ).first()
    if not asset:
        return error_response("Asset not found for this QR code", 404)
    return success_response(_asset_dict(asset))


# ── Procurement ────────────────────────────────────────────


@inventory_bp.route("/procurement", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("inventory")
def list_procurement():
    query = ProcurementRequest.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    items, meta = paginate(query.order_by(ProcurementRequest.created_at.desc()))
    return success_response([_procurement_dict(p) for p in items], meta={"pagination": meta})


@inventory_bp.route("/procurement", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("inventory")
def create_procurement():
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    pr = ProcurementRequest(
        school_id=g.school_id,
        requested_by_id=claims.get("sub"),
    )
    for key in ("title", "items", "total_estimated_cost", "justification", "vendor"):
        if key in data:
            setattr(pr, key, data[key])
    db.session.add(pr)
    db.session.commit()
    return created_response(_procurement_dict(pr))


@inventory_bp.route("/procurement/<uuid:pr_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("inventory")
@role_required("superadmin", "school_admin")
def approve_procurement(pr_id):
    pr = ProcurementRequest.query.filter_by(
        id=pr_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not pr:
        return error_response("Procurement request not found", 404)
    claims = get_jwt()
    data = request.get_json(silent=True) or {}
    pr.status = data.get("status", "approved")
    pr.approved_by_id = claims.get("sub")
    pr.notes = data.get("notes", pr.notes)
    db.session.commit()
    return success_response(_procurement_dict(pr))


# ── Audit Log ──────────────────────────────────────────────


@inventory_bp.route("/assets/<uuid:asset_id>/audit", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("inventory")
def list_audit_log(asset_id):
    query = AssetAuditLog.query.filter_by(
        asset_id=asset_id, school_id=g.school_id, is_deleted=False
    )
    items, meta = paginate(query.order_by(AssetAuditLog.created_at.desc()))
    return success_response([_audit_dict(a) for a in items], meta={"pagination": meta})


@inventory_bp.route("/assets/<uuid:asset_id>/audit", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("inventory")
@role_required("superadmin", "school_admin", "staff")
def create_audit_entry(asset_id):
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    entry = AssetAuditLog(
        school_id=g.school_id,
        asset_id=asset_id,
        performed_by_id=claims.get("sub"),
    )
    for key in ("action", "old_value", "new_value", "notes"):
        if key in data:
            setattr(entry, key, data[key])
    db.session.add(entry)
    db.session.commit()
    return created_response(_audit_dict(entry))


# ── Serializers ────────────────────────────────────────────


def _asset_dict(a):
    return {
        "id": str(a.id),
        "name": a.name,
        "asset_code": a.asset_code,
        "qr_code": a.qr_code,
        "category": a.category,
        "location": a.location,
        "purchase_date": str(a.purchase_date) if a.purchase_date else None,
        "purchase_price": float(a.purchase_price) if a.purchase_price else None,
        "current_value": float(a.current_value) if a.current_value else None,
        "depreciation_rate": float(a.depreciation_rate) if a.depreciation_rate else None,
        "condition": a.condition,
        "assigned_to_id": str(a.assigned_to_id) if a.assigned_to_id else None,
        "warranty_expiry": str(a.warranty_expiry) if a.warranty_expiry else None,
        "is_active": a.is_active,
    }


def _procurement_dict(p):
    return {
        "id": str(p.id),
        "title": p.title,
        "items": p.items,
        "total_estimated_cost": float(p.total_estimated_cost) if p.total_estimated_cost else None,
        "justification": p.justification,
        "requested_by_id": str(p.requested_by_id),
        "status": p.status,
        "vendor": p.vendor,
        "purchase_order_ref": p.purchase_order_ref,
    }


def _audit_dict(a):
    return {
        "id": str(a.id),
        "asset_id": str(a.asset_id),
        "action": a.action,
        "performed_by_id": str(a.performed_by_id),
        "old_value": a.old_value,
        "new_value": a.new_value,
        "notes": a.notes,
        "created_at": str(a.created_at) if a.created_at else None,
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
