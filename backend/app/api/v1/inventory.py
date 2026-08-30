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
    # assets.name is NOT NULL — validate up front so a missing name gets a
    # 400 instead of an unhandled IntegrityError (500).
    if not str(data.get("name") or "").strip():
        return error_response("name is required", 400)
    # asset_code has a table-level UNIQUE constraint — check up front so a
    # duplicate gets a 400 instead of an unhandled IntegrityError (500).
    if data.get("asset_code") and Asset.query.filter_by(
        asset_code=data["asset_code"]
    ).first():
        return error_response(
            f"asset_code '{data['asset_code']}' is already in use", 409
        )
    # Money columns must not be negative (no such thing as a negative-price
    # asset) — reject with 400 instead of storing nonsense ledger values.
    for money_key in ("purchase_price", "current_value", "depreciation_rate"):
        raw = data.get(money_key)
        if raw is None:
            continue
        try:
            if float(raw) < 0:
                return error_response(f"{money_key} cannot be negative", 400)
        except (TypeError, ValueError):
            return error_response(f"{money_key} must be a number", 400)
    # E187: assigned_to_id is an FK to users.id — validate it points at a
    # user of this school instead of relying on the DB to 500.
    if data.get("assigned_to_id"):
        assignee = _school_user_or_none(data["assigned_to_id"])
        if not assignee:
            return error_response(
                "assigned_to_id does not match a user at this school", 400
            )
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
    # E187: asset_code has a table-level UNIQUE constraint — a duplicate on
    # update used to surface as an IntegrityError (500) instead of a 409.
    if data.get("asset_code") and data["asset_code"] != asset.asset_code:
        if Asset.query.filter_by(asset_code=data["asset_code"]).first():
            return error_response(
                f"asset_code '{data['asset_code']}' is already in use", 409
            )
    # E187: the same money validation as POST applies on update.
    for money_key in ("purchase_price", "current_value", "depreciation_rate"):
        if money_key in data and data[money_key] is not None:
            try:
                if float(data[money_key]) < 0:
                    return error_response(f"{money_key} cannot be negative", 400)
            except (TypeError, ValueError):
                return error_response(f"{money_key} must be a number", 400)
    # E187: assigned_to_id must reference a user of this school.
    if "assigned_to_id" in data and data["assigned_to_id"]:
        assignee = _school_user_or_none(data["assigned_to_id"])
        if not assignee:
            return error_response(
                "assigned_to_id does not match a user at this school", 400
            )
    previous_assignee_id = asset.assigned_to_id
    for key in ("name", "asset_code", "qr_code", "category", "location",
                "purchase_price", "current_value", "depreciation_rate",
                "condition", "assigned_to_id", "notes", "is_active"):
        if key in data:
            setattr(asset, key, data[key])
    if "purchase_date" in data:
        asset.purchase_date = _parse_date(data.get("purchase_date"))
    if "warranty_expiry" in data:
        asset.warranty_expiry = _parse_date(data.get("warranty_expiry"))

    # E187: the assignment/return lifecycle previously changed
    # assigned_to_id with NO audit trail. Record an AssetAuditLog entry
    # whenever the assignee changes (same contract as the manual audit POST).
    if "assigned_to_id" in data and asset.assigned_to_id != previous_assignee_id:
        action = "assign" if asset.assigned_to_id else "return"
        entry = AssetAuditLog(
            school_id=g.school_id,
            asset_id=asset.id,
            performed_by_id=get_jwt().get("sub"),
            action=action,
            old_value=str(previous_assignee_id) if previous_assignee_id else None,
            new_value=str(asset.assigned_to_id) if asset.assigned_to_id else None,
            notes="recorded automatically on assignment change",
        )
        db.session.add(entry)

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
    # E187: title is NOT NULL — an empty payload used to 500.
    if not str(data.get("title") or "").strip():
        return error_response("title is required", 400)
    if data.get("total_estimated_cost") is not None:
        # E187: a negative estimated cost is nonsense ledger data.
        try:
            if float(data["total_estimated_cost"]) < 0:
                return error_response("total_estimated_cost cannot be negative", 400)
        except (TypeError, ValueError):
            return error_response("total_estimated_cost must be a number", 400)
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
    new_status = data.get("status", "approved")
    # Status is documented as pending/approved/rejected/ordered/received —
    # reject anything else so typo'd transitions can't pollute the pipeline.
    if new_status not in ("pending", "approved", "rejected", "ordered", "received"):
        return error_response(
            "Invalid status. Must be one of: pending, approved, rejected, ordered, received",
            400,
        )
    pr.status = new_status
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
    asset = Asset.query.filter_by(
        id=asset_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not asset:
        return error_response("Asset not found", 404)
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    entry = AssetAuditLog(
        school_id=g.school_id,
        asset_id=asset.id,
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


def _school_user_or_none(user_id):
    """E187: resolve a user id that must exist at THIS school (None if not)."""
    import uuid as _uuid

    try:
        user_uuid = _uuid.UUID(str(user_id))
    except (ValueError, AttributeError, TypeError):
        return None
    from app.models.user import User

    return User.query.filter_by(
        id=user_uuid, school_id=g.school_id, is_deleted=False
    ).first()
