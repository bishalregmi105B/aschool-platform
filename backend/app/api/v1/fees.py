"""Fees plugin API — fee structure, collection, receipts, payments."""

import hashlib
import csv
import io
import re
from datetime import datetime, timedelta, timezone
from html import escape
from io import BytesIO

from flask import Blueprint, Response, g, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.models.fee import (
    FeeCollection,
    FeeReceipt,
    FeeStructure,
    StudentScholarship,
    FeeRefund,
    FeeInvoice,
    FeeInstallment,
    FeeCarryForward,
    FeeCarryForwardLog,
    FeeOfflineSubmission,
    FeeDayClosure,
)
from app.models.school import School
from app.models.student import Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from extensions import db

fees_bp = Blueprint("fees", __name__, url_prefix="/fees")

# ── Default Fee Types (Nepal school standard) ─────────────────────────────
DEFAULT_FEE_TYPES = [
    {"name": "Tuition Fee", "description": "Monthly/Annual tuition charges"},
    {"name": "Admission Fee", "description": "One-time enrollment charge"},
    {"name": "Exam Fee", "description": "Examination entry fee"},
    {"name": "Library Fee", "description": "Library membership charge"},
    {"name": "Transport Fee", "description": "Bus/van transportation fee"},
    {"name": "Sports Fee", "description": "Physical education & sports"},
    {"name": "Lab Fee", "description": "Science/computer lab usage"},
    {"name": "Activity Fee", "description": "Extra-curricular activities"},
    {"name": "Hostel Fee", "description": "Boarding/hostel charges"},
    {"name": "Annual Fee", "description": "Yearly miscellaneous charges"},
    {"name": "Registration Fee", "description": "Annual re-registration"},
    {"name": "Other", "description": "Miscellaneous charges"},
]

DEFAULT_PAYMENT_METHODS = {
    "cash": {
        "label": "Cash",
        "enabled": True,
        "mode": "offline",
        "requires_reference": False,
        "supports_qr": False,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
        "merchant_code": "",
        "secret_key": "",
    },
    "bank": {
        "label": "Bank Transfer",
        "enabled": True,
        "mode": "offline",
        "requires_reference": True,
        "supports_qr": True,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
        "merchant_code": "",
        "secret_key": "",
    },
    "cheque": {
        "label": "Cheque",
        "enabled": True,
        "mode": "offline",
        "requires_reference": True,
        "supports_qr": False,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
        "merchant_code": "",
        "secret_key": "",
    },
    "fonepay": {
        "label": "FonePay",
        "enabled": True,
        "mode": "online",  # FonePay supports hosted checkout via FonePayGateway
        "requires_reference": False,
        "supports_qr": True,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
        "merchant_code": "",  # FonePay merchant code (PID)
        "secret_key": "",     # FonePay HMAC secret
    },
    "esewa": {
        "label": "eSewa",
        "enabled": True,
        "mode": "online",
        "requires_reference": False,
        "supports_qr": True,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
        "merchant_code": "",  # eSewa product code (e.g. EPAYTEST or school code)
        "secret_key": "",     # eSewa HMAC secret
    },
    "khalti": {
        "label": "Khalti",
        "enabled": True,
        "mode": "online",
        "requires_reference": False,
        "supports_qr": True,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
        "merchant_code": "",  # unused for Khalti; reserved
        "secret_key": "",     # Khalti live secret key
    },
    "qr_pay": {
        "label": "QR Pay",
        "enabled": False,
        "mode": "offline",
        "requires_reference": True,
        "supports_qr": True,
        "qr_image_url": "",   # School uploads their static QR image here
        "qr_payload": "",     # Optional: merchant ID / payment handle
        "instructions": "Scan the QR code below with any payment app (FonePay, eSewa, Khalti, banking app) and enter the transaction reference.",
        "merchant_code": "",
        "secret_key": "",
    },
}

PAYMENT_METHOD_KEYS = tuple(DEFAULT_PAYMENT_METHODS.keys())


# ── Fee Types ────────────────────────────────────────────────────────


@fees_bp.route("/types", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_fee_types():
    """List fee types for the school. Falls back to defaults if none exist."""
    from app.models.fee import FeeType

    try:
        types = FeeType.query.filter_by(school_id=g.school_id, is_deleted=False).all()
    except Exception:
        # FeeType table may not exist yet — return system defaults
        return success_response(DEFAULT_FEE_TYPES)
    if not types:
        return success_response(DEFAULT_FEE_TYPES)
    return success_response(
        [
            {
                "id": str(t.id),
                "name": t.name,
                "description": t.description or "",
                "is_system": getattr(t, "is_system", False),
            }
            for t in types
        ]
    )


@fees_bp.route("/types", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def create_fee_type():
    """Create a custom fee type."""
    from app.models.fee import FeeType

    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response("name is required", 400)
    try:
        ft = FeeType(
            school_id=g.school_id,
            name=name,
            description=data.get("description", ""),
            is_system=False,
        )
        db.session.add(ft)
        db.session.commit()
        return created_response(
            {"id": str(ft.id), "name": ft.name, "description": ft.description or ""}
        )
    except Exception as exc:
        return error_response(f"Could not create fee type: {exc}", 500)


@fees_bp.route("/types/<uuid:type_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def update_fee_type(type_id):
    """Update a fee type."""
    from app.models.fee import FeeType

    ft = FeeType.query.filter_by(
        id=type_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not ft:
        return error_response("Fee type not found", 404)
    if getattr(ft, "is_system", False):
        return error_response("System fee types cannot be modified", 403)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        ft.name = data["name"]
    if "description" in data:
        ft.description = data["description"]
    db.session.commit()
    return success_response(
        {"id": str(ft.id), "name": ft.name, "description": ft.description or ""}
    )


@fees_bp.route("/types/<uuid:type_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def delete_fee_type(type_id):
    """Soft-delete a fee type."""
    from app.models.fee import FeeType

    ft = FeeType.query.filter_by(
        id=type_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not ft:
        return error_response("Fee type not found", 404)
    if getattr(ft, "is_system", False):
        return error_response("System fee types cannot be deleted", 403)
    ft.soft_delete()
    return no_content_response()


# ── Fee Structures ─────────────────────────────────────────


@fees_bp.route("/payment-methods", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def get_payment_methods():
    """Return school-level payment method configuration.

    secret_key fields are masked in the response; they are write-only via PUT.
    """
    methods = _get_configured_payment_methods()
    safe_methods = [_mask_method_credentials(m) for m in methods]
    return success_response(
        {
            "methods": safe_methods,
            "enabled_methods": [m["key"] for m in safe_methods if m["enabled"]],
            "online_methods": [
                m["key"]
                for m in safe_methods
                if m["enabled"] and m["mode"] == "online"
            ],
        }
    )


@fees_bp.route("/payment-methods", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def update_payment_methods():
    """Update school-level payment method configuration."""
    school = _current_school()
    if not school:
        return error_response("School not found", 404)

    data = request.get_json(silent=True) or {}
    incoming_methods = data.get("methods")
    if not isinstance(incoming_methods, list):
        return error_response("methods must be a list", 400)

    # Resolve "***" sentinel — when a client sends "***" for secret_key it means
    # "keep the existing stored secret".  Substitute the actual stored value now so
    # _normalize_payment_methods always receives either a real secret or an empty string.
    existing_methods = {m["key"]: m for m in _get_configured_payment_methods()}
    for item in incoming_methods:
        if isinstance(item, dict) and item.get("secret_key") == "***":
            key = str(item.get("key") or "").strip().lower()
            item["secret_key"] = existing_methods.get(key, {}).get("secret_key", "")

    methods = _normalize_payment_methods(incoming_methods)
    if not any(m["enabled"] for m in methods):
        return error_response("At least one payment method must remain enabled", 400)

    fee_config = dict(school.fee_config or {})
    fee_config["payment_methods"] = methods
    school.fee_config = fee_config
    db.session.commit()

    safe_methods = [_mask_method_credentials(m) for m in methods]
    return success_response(
        {
            "methods": safe_methods,
            "enabled_methods": [m["key"] for m in safe_methods if m["enabled"]],
            "online_methods": [
                m["key"]
                for m in safe_methods
                if m["enabled"] and m["mode"] == "online"
            ],
        }
    )


@fees_bp.route("/payment-methods/upload-qr", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def upload_qr_image():
    """Upload a QR code image for a payment method.

    Accepts multipart/form-data with:
      - qr_image: the image file (PNG/JPG/WEBP)
      - method_key: which payment method to attach it to (default: qr_pay)

    Returns the public URL and automatically saves it on the school's fee config.
    """
    from app.utils.file_upload import VirusDetectedError, upload_file

    school = _current_school()
    if not school:
        return error_response("School not found", 404)

    file = request.files.get("qr_image")
    if not file or not file.filename:
        return error_response("No qr_image file provided", 400)

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in {"png", "jpg", "jpeg", "gif", "webp"}:
        return error_response("Unsupported file type — use PNG, JPG, or WEBP", 400)

    method_key = (request.form.get("method_key") or "qr_pay").strip().lower()
    if method_key not in PAYMENT_METHOD_KEYS:
        return error_response(f"Unknown method_key: {method_key}", 400)

    try:
        public_url = upload_file(
            file,
            folder=f"payment_qr/{school.slug}",
        )
    except VirusDetectedError:
        return error_response("File failed virus scan — upload rejected", 422)
    except Exception as exc:
        return error_response(f"Upload failed: {exc}", 500)

    # Persist the URL into the payment method config
    fee_config = dict(school.fee_config or {})
    existing_methods = {m["key"]: m for m in _get_configured_payment_methods()}
    updated_methods = []
    for key in PAYMENT_METHOD_KEYS:
        m = dict(existing_methods.get(key, DEFAULT_PAYMENT_METHODS[key]))
        if m["key"] == method_key:
            m["qr_image_url"] = public_url
        updated_methods.append(m)

    fee_config["payment_methods"] = updated_methods
    school.fee_config = fee_config
    db.session.commit()

    return success_response(
        {"url": public_url, "method_key": method_key},
        message="QR image uploaded and saved",
    )


@fees_bp.route("/summary", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def get_fees_summary():
    """Aggregate fee summary for the school overview dashboard."""
    from app.models.academic import Class

    school_id = g.school_id
    collections = FeeCollection.query.filter_by(
        school_id=school_id,
        is_deleted=False,
    ).all()

    # Aggregate collection stats
    total_expected = 0.0
    total_collected = 0.0
    pending_student_ids = set()
    paid_student_ids = set()

    for collection in collections:
        payable_total = _collection_payable_total(collection)
        paid_amount = min(_extract_partial_paid(collection), payable_total)
        due_amount = max(payable_total - paid_amount, 0.0)

        total_expected += payable_total
        total_collected += paid_amount

        if collection.student_id:
            student_id = str(collection.student_id)
            if due_amount > 0:
                pending_student_ids.add(student_id)
            elif paid_amount > 0:
                paid_student_ids.add(student_id)

    total_outstanding = float(total_expected) - float(total_collected)
    collection_rate = (
        round(float(total_collected) / float(total_expected) * 100, 1)
        if total_expected
        else 0
    )

    # Count by status
    status_counts = (
        db.session.query(
            FeeCollection.payment_status, func.count(FeeCollection.id).label("cnt")
        )
        .filter_by(school_id=school_id, is_deleted=False)
        .group_by(FeeCollection.payment_status)
        .all()
    )
    counts = {row.payment_status: row.cnt for row in status_counts}

    # This month collected
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = (
        db.session.query(func.coalesce(func.sum(FeeReceipt.amount), 0))
        .filter(
            FeeReceipt.school_id == school_id,
            FeeReceipt.is_deleted.is_(False),
            FeeReceipt.created_at >= month_start,
        )
        .scalar()
        or 0
    )

    # Recent payments (last 10)
    recent_receipts = (
        FeeReceipt.query.filter_by(school_id=school_id, is_deleted=False)
        .order_by(FeeReceipt.created_at.desc())
        .limit(10)
        .all()
    )
    recent_payments = []
    for r in recent_receipts:
        collection = (
            FeeCollection.query.get(r.collection_id) if r.collection_id else None
        )
        student = Student.query.get(r.student_id) if r.student_id else None
        recent_payments.append(
            {
                "id": str(r.id),
                "student_name": f"{student.first_name} {student.last_name}"
                if student
                else "Student",
                "fee_type": collection.fee_item_name if collection else "Fee",
                "amount": float(r.amount or 0),
                "paid_at": r.created_at.isoformat() if r.created_at else None,
                "receipt_number": r.receipt_number,
            }
        )

    # Collection by class
    by_class = []
    classes = Class.query.filter_by(school_id=school_id, is_deleted=False).all()
    for klass in classes[:10]:  # top 10 classes
        student_ids = {
            str(s.id)
            for s in Student.query.filter_by(
                school_id=school_id,
                class_id=klass.id,
                is_deleted=False,
            ).all()
        }
        if not student_ids:
            continue

        class_expected = 0.0
        class_collected = 0.0
        for collection in collections:
            if not collection.student_id or str(collection.student_id) not in student_ids:
                continue
            payable_total = _collection_payable_total(collection)
            paid_amount = min(_extract_partial_paid(collection), payable_total)
            class_expected += payable_total
            class_collected += paid_amount

        if class_expected > 0:
            by_class.append(
                {
                    "class_name": klass.name,
                    "collected": float(class_collected),
                    "expected": float(class_expected),
                    "rate": round(
                        float(class_collected) / float(class_expected) * 100, 1
                    ),
                }
            )

    by_class.sort(key=lambda x: x["rate"])

    active_student_count = Student.query.filter_by(
        school_id=school_id,
        is_deleted=False,
        status="active",
    ).count()

    pending_count = len(pending_student_ids)
    paid_count = len(paid_student_ids)
    overdue_count = pending_count

    return success_response(
        {
            "total_expected": float(total_expected),
            "total_collected": float(total_collected),
            "total_outstanding": max(0.0, total_outstanding),
            "total_overdue": float(total_outstanding),  # simplified
            "collection_rate": collection_rate,
            "student_count": active_student_count,
            "paid_count": paid_count,
            "pending_count": pending_count,
            "overdue_count": overdue_count,
            "this_month_collected": float(this_month),
            "recent_payments": recent_payments,
            "by_class": by_class,
        }
    )


@fees_bp.route("/recent", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def list_recent_fees():
    """Return the most recent fee payment receipts for the school."""
    limit = _coerce_limit(request.args.get("limit"), default=20, maximum=100)
    if limit is None:
        return error_response("limit must be a positive integer", 400)
    recent_receipts = (
        FeeReceipt.query.filter_by(school_id=g.school_id, is_deleted=False)
        .options(joinedload(FeeReceipt.collection), joinedload(FeeReceipt.student))
        .order_by(FeeReceipt.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in recent_receipts:
        # FC-A05: collection + student were re-fetched per receipt inside this
        # loop (2N extra queries); relationships are eager-loaded above now.
        collection = r.collection
        student = r.student
        result.append({
            "id": str(r.id),
            "student_name": (
                f"{student.first_name} {student.last_name}" if student else "Student"
            ),
            "student_id": str(r.student_id) if r.student_id else None,
            "fee_type": collection.fee_item_name if collection else "Fee",
            "amount": float(r.amount or 0),
            "paid_at": r.created_at.isoformat() if r.created_at else None,
            "receipt_number": r.receipt_number,
        })
    return success_response(result)


@fees_bp.route("/outstanding", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def list_outstanding_fees():
    """Return unpaid / partially-paid fee collections (defaulters)."""
    limit = _coerce_limit(request.args.get("limit"), default=50, maximum=200)
    if limit is None:
        return error_response("limit must be a positive integer", 400)
    class_id = request.args.get("class_id")

    query = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(["pending", "partial"]),
    )
    if class_id:
        # FeeCollection has no class_id column — filter through the student.
        query = (
            query.join(Student, Student.id == FeeCollection.student_id)
            .filter(Student.class_id == class_id, Student.is_deleted.is_(False))
        )
    query = (
        query.options(joinedload(FeeCollection.student).joinedload(Student.klass))
        .order_by(FeeCollection.created_at.asc())
        .limit(limit)
    )
    collections = query.all()

    result = []
    for c in collections:
        payable = _collection_payable_total(c)
        paid = min(_extract_partial_paid(c), payable)
        due = max(payable - paid, 0.0)
        if due <= 0:
            continue
        # FC-A05: student was re-fetched per collection inside this loop.
        student = c.student if c.student_id else None
        klass = student.klass if student else None
        result.append({
            "id": str(c.id),
            "student_id": str(c.student_id) if c.student_id else None,
            "student_name": (
                f"{student.first_name} {student.last_name}" if student else "Student"
            ),
            "class_name": klass.name if klass else "",
            "fee_type": c.fee_item_name or "Fee",
            "amount": due,
            "payment_status": c.payment_status,
        })
    return success_response(result)


@fees_bp.route("/structures", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_fee_structures():
    """List fee structures for the school."""
    query = FeeStructure.query.filter_by(school_id=g.school_id, is_deleted=False)
    class_id = request.args.get("class_id")
    if class_id:
        query = query.filter_by(class_id=class_id)
    academic_year = request.args.get("academic_year") or request.args.get(
        "academic_year_id"
    )
    if academic_year:
        query = query.filter_by(academic_year=academic_year)
    items, meta = paginate(query.order_by(FeeStructure.created_at.desc()))
    return success_response(
        [_structure_dict(s) for s in items], meta={"pagination": meta}
    )


@fees_bp.route("/structures", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def create_fee_structure():
    """Create a fee structure."""
    data = request.get_json(silent=True) or {}
    structure = FeeStructure(school_id=g.school_id)
    fee_name = (data.get("name") or "").strip()
    fee_type = (data.get("fee_type") or "").strip()
    if data.get("class_id") is not None and str(data["class_id"]) != "":
        # E181: an invalid uuid must 400, not blow up in the DB layer.
        class_uuid = _parse_uuid(data["class_id"])
        if class_uuid is None:
            return error_response("class_id must be a valid UUID", 400)
        structure.class_id = class_uuid
    for key in ("academic_year", "fee_items", "total_annual", "total_monthly"):
        if key in data:
            setattr(structure, key, data[key])
    if not structure.fee_items and (fee_name or fee_type or data.get("amount") is not None):
        amount = _coerce_fee_amount(data.get("amount") or data.get("total_amount"))
        if amount <= 0:
            return error_response("amount must be greater than zero", 400)

        frequency = _normalize_fee_frequency(data.get("frequency"))
        due_day = _coerce_due_day(data.get("due_day"))
        item_name = fee_name or _humanize_fee_label(fee_type) or "Fee"
        structure.fee_items = [
            {
                "name": item_name,
                "fee_type": fee_type or None,
                "amount": amount,
                "frequency": frequency,
                "due_day": due_day,
                "is_optional": bool(data.get("is_optional", False)),
            }
        ]
        if frequency == "annual":
            structure.total_annual = amount
            structure.total_monthly = round(amount / 12, 2)
        elif frequency == "quarterly":
            structure.total_annual = amount * 4
            structure.total_monthly = round(amount / 3, 2)
        elif frequency == "semi-annual":
            structure.total_annual = amount * 2
            structure.total_monthly = round(amount / 6, 2)
        elif frequency == "one-time":
            structure.total_annual = amount
            structure.total_monthly = 0
        else:
            structure.total_monthly = amount
            structure.total_annual = amount * 12
    if "academic_year_id" in data and "academic_year" not in data:
        structure.academic_year = data["academic_year_id"]
    if "total_amount" in data and "total_annual" not in data:
        structure.total_annual = data["total_amount"]
    if not structure.academic_year:
        structure.academic_year = str(datetime.now(timezone.utc).year)
    db.session.add(structure)
    db.session.commit()

    applied_summary = _apply_fee_structure(structure)
    payload = _structure_dict(structure)
    payload["applied_summary"] = applied_summary
    return created_response(payload)


@fees_bp.route("/structures/<uuid:structure_id>/apply", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def apply_fee_structure(structure_id):
    """Apply a fee structure to the current billing cycle."""
    structure = FeeStructure.query.filter_by(
        id=structure_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not structure:
        return error_response("Fee structure not found", 404)

    summary = _apply_fee_structure(structure)
    payload = _structure_dict(structure)
    payload["applied_summary"] = summary
    return success_response(payload)


@fees_bp.route("/batch-monthly", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def batch_monthly_billing():
    """Generate current-cycle fee collections for all active structures.

    Optionally filter by class_id. Safe to re-run — duplicates are skipped.
    Returns aggregate counts of new collections created vs skipped.
    """
    data = request.get_json(silent=True) or {}
    class_id = data.get("class_id")

    query = FeeStructure.query.filter_by(
        school_id=g.school_id,
        is_deleted=False,
    )
    if class_id:
        query = query.filter(
            or_(FeeStructure.class_id == class_id, FeeStructure.class_id.is_(None))
        )
    structures = query.all()

    total_created = 0
    total_skipped = 0
    total_students = 0
    results = []

    for struct in structures:
        summary = _apply_fee_structure(struct)
        total_created += summary.get("created_collections", 0)
        total_skipped += summary.get("skipped_existing", 0)
        total_students += summary.get("matched_students", 0)
        results.append({
            "structure_id": str(struct.id),
            "name": _structure_item_name(struct),
            "class_id": str(struct.class_id) if struct.class_id else None,
            **summary,
        })

    return success_response({
        "structures_processed": len(structures),
        "total_students_matched": total_students,
        "collections_created": total_created,
        "collections_skipped": total_skipped,
        "details": results,
    })


# ── Scholarships & Discounts ────────────────────────────────────────────────

@fees_bp.route("/scholarships", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def list_scholarships():
    """List all active scholarships/discounts for the school, optionally filtered by student."""
    student_id = request.args.get("student_id")
    query = StudentScholarship.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).order_by(StudentScholarship.created_at.desc())
    if student_id:
        query = query.filter_by(student_id=student_id)
    items, meta = paginate(query)
    return success_response([_scholarship_dict(s) for s in items], meta={"pagination": meta})


@fees_bp.route("/scholarships", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def create_scholarship():
    """Create a scholarship/discount for a student."""
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    if not student_id:
        return error_response("student_id is required", 400)
    student = Student.query.filter_by(id=student_id, school_id=g.school_id, is_deleted=False).first()
    if not student:
        return error_response("Student not found", 404)

    discount_type = data.get("discount_type", "percent")
    if discount_type not in ("percent", "fixed"):
        return error_response("discount_type must be 'percent' or 'fixed'", 400)
    try:
        discount_value = float(data.get("discount_value") or 0)
    except (TypeError, ValueError):
        return error_response("discount_value must be a number", 400)
    if discount_type == "percent" and not (0 < discount_value <= 100):
        return error_response("discount_value must be 1-100 for percent type", 400)
    # E181: a negative fixed discount stored nonsense that clamped to 0 at
    # apply time — reject it at the source instead.
    if discount_type == "fixed" and discount_value <= 0:
        return error_response("discount_value must be greater than zero for fixed type", 400)

    sc = StudentScholarship(
        school_id=g.school_id,
        student_id=student_id,
        fee_type=data.get("fee_type"),
        discount_type=discount_type,
        discount_value=discount_value,
        reason=data.get("reason"),
        valid_from_bs=data.get("valid_from_bs"),
        valid_until_bs=data.get("valid_until_bs"),
        is_active=data.get("is_active", True),
    )
    db.session.add(sc)
    db.session.commit()
    return created_response(_scholarship_dict(sc))


@fees_bp.route("/scholarships/<uuid:scholarship_id>", methods=["PUT", "PATCH"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def update_scholarship(scholarship_id):
    """Update a scholarship/discount."""
    sc = StudentScholarship.query.filter_by(
        id=scholarship_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not sc:
        return error_response("Scholarship not found", 404)
    data = request.get_json(silent=True) or {}
    # E181: updates previously accepted any discount_type / discount_value
    # (e.g. percent=400 or -50) — the same validation as POST applies here.
    if "discount_type" in data and data["discount_type"] not in ("percent", "fixed"):
        return error_response("discount_type must be 'percent' or 'fixed'", 400)
    if "discount_value" in data:
        try:
            discount_value = float(data["discount_value"] or 0)
        except (TypeError, ValueError):
            return error_response("discount_value must be a number", 400)
        effective_type = data.get("discount_type") or sc.discount_type
        if effective_type == "percent" and not (0 < discount_value <= 100):
            return error_response("discount_value must be 1-100 for percent type", 400)
        if effective_type == "fixed" and discount_value <= 0:
            return error_response("discount_value must be greater than zero for fixed type", 400)
    for field in ("fee_type", "discount_type", "discount_value", "reason",
                  "valid_from_bs", "valid_until_bs", "is_active"):
        if field in data:
            setattr(sc, field, data[field])
    db.session.commit()
    return success_response(_scholarship_dict(sc))


@fees_bp.route("/scholarships/<uuid:scholarship_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def delete_scholarship(scholarship_id):
    """Delete (soft) a scholarship/discount."""
    sc = StudentScholarship.query.filter_by(
        id=scholarship_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not sc:
        return error_response("Scholarship not found", 404)
    sc.soft_delete()
    return no_content_response()


def _scholarship_dict(sc):
    student = Student.query.filter_by(id=sc.student_id).first()
    return {
        "id": str(sc.id),
        "student_id": str(sc.student_id),
        "student_name": student.first_name + " " + (student.last_name or "") if student else "",
        "roll_number": getattr(student, "roll_number", None),
        "class_name": getattr(getattr(student, "klass", None), "name", None),
        "fee_type": sc.fee_type,
        "discount_type": sc.discount_type,
        "discount_value": float(sc.discount_value or 0),
        "reason": sc.reason,
        "valid_from_bs": sc.valid_from_bs,
        "valid_until_bs": sc.valid_until_bs,
        "is_active": sc.is_active,
        "created_at": sc.created_at.isoformat() if sc.created_at else None,
    }




@fees_bp.route("/structures/<uuid:structure_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def delete_fee_structure(structure_id):
    structure = FeeStructure.query.filter_by(
        id=structure_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not structure:
        return error_response("Fee structure not found", 404)
    structure.soft_delete()
    return no_content_response()


# ── Fee Collections ────────────────────────────────────────


def _collections_filtered_query():
    """FeeCollection query with the standard list filters applied from the
    request's query args (student_id, class_id, section_id, search, status,
    from, to).

    Shared by GET /fees/collections and GET /fees/collections/export so the
    CSV export always honors exactly the same filters as the list endpoint.
    `from`/`to` (ISO "YYYY-MM-DD", inclusive both ends) narrow the window by
    bill activity date — collected_at when the bill has payments, otherwise
    created_at. Unparseable values are ignored (lenient) so existing clients
    can never break on a bad date.
    """
    query = FeeCollection.query.filter_by(school_id=g.school_id, is_deleted=False)
    joined_student = False

    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)

    class_id = request.args.get("class_id")
    if class_id:
        query = query.join(Student, Student.id == FeeCollection.student_id)
        joined_student = True
        query = query.filter(
            Student.class_id == class_id, Student.is_deleted.is_(False)
        )

    section_id = request.args.get("section_id")
    if section_id:
        if not joined_student:
            query = query.join(Student, Student.id == FeeCollection.student_id)
            joined_student = True
        query = query.filter(
            Student.section_id == section_id, Student.is_deleted.is_(False)
        )

    search = request.args.get("search")
    if search:
        if not joined_student:
            query = query.join(Student, Student.id == FeeCollection.student_id)
            joined_student = True
        term = f"%{search}%"
        query = query.filter(
            Student.first_name.ilike(term)
            | Student.last_name.ilike(term)
            | Student.student_id.ilike(term)
            | Student.admission_number.ilike(term)
        )

    status = request.args.get("status")
    if status:
        query = query.filter_by(payment_status=status)

    activity_date = func.coalesce(FeeCollection.collected_at, FeeCollection.created_at)

    def _parse_range_date(raw):
        try:
            return datetime.fromisoformat(str(raw).strip())
        except (TypeError, ValueError):
            return None

    date_from = _parse_range_date(request.args.get("from") or request.args.get("start_date"))
    if date_from:
        query = query.filter(activity_date >= date_from.replace(tzinfo=timezone.utc))
    date_to = _parse_range_date(request.args.get("to") or request.args.get("end_date"))
    if date_to:
        query = query.filter(activity_date <= date_to.replace(tzinfo=timezone.utc) + timedelta(days=1))

    return query


@fees_bp.route("/collections", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_collections():
    """List fee collections."""
    query = _collections_filtered_query()
    items, meta = paginate(query.order_by(FeeCollection.created_at.desc()))
    return success_response(
        [_collection_dict(c) for c in items], meta={"pagination": meta}
    )


@fees_bp.route("/collections/export", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def export_collections_csv():
    """Export fee collections as CSV, honoring the same filters as
    GET /fees/collections (student_id, class_id, section_id, search, status,
    from, to inclusive ISO dates)."""
    query = _collections_filtered_query()
    collections = query.order_by(FeeCollection.created_at.desc()).all()

    output = io.StringIO()
    # UTF-8 BOM so Excel opens Nepali text correctly.
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "created_at",
            "student_id",
            "student_name",
            "class_name",
            "fee_type",
            "month_bs",
            "year_bs",
            "base_amount",
            "late_fine_amount",
            "discount_amount",
            "net_amount",
            "paid_amount",
            "due_amount",
            "payment_status",
            "payment_method",
            "receipt_number",
            "collected_at",
        ]
    )

    student_cache: dict = {}
    for c in collections:
        sid = str(c.student_id) if c.student_id else ""
        if sid not in student_cache:
            student = Student.query.get(c.student_id) if c.student_id else None
            klass = student.klass if student else None
            student_cache[sid] = (
                _student_name(student) or "Student",
                klass.name if klass else "",
            )
        student_name, class_name = student_cache[sid]
        payable = _collection_payable_total(c)
        paid = min(_extract_partial_paid(c), payable)
        writer.writerow(
            [
                str(c.id),
                c.created_at.isoformat() if c.created_at else "",
                sid,
                student_name,
                class_name,
                c.fee_item_name or "",
                c.month_bs or "",
                c.year_bs or "",
                _collection_base_amount(c),
                _collection_late_fine_amount(c),
                _collection_discount_amount(c),
                payable,
                round(paid, 2),
                round(max(payable - paid, 0.0), 2),
                c.payment_status or "",
                c.payment_method or "",
                c.receipt_number or "",
                c.collected_at.isoformat() if c.collected_at else "",
            ]
        )

    output.seek(0)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=fee_collections_{stamp}.csv"
        },
    )


@fees_bp.route("/defaulters", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def list_defaulters():
    """Students with outstanding fee collections."""
    collections = FeeCollection.query.filter_by(
        school_id=g.school_id,
        is_deleted=False,
    ).all()
    grouped: dict[str, dict[str, object]] = {}
    for collection in collections:
        # Payable = base + late fine − discount (same rule as everywhere else);
        # using the raw base here would overstate dues for discounted students
        # and understate them when a late fine applies.
        total_amount = _collection_payable_total(collection)
        paid_amount = _extract_partial_paid(collection)
        due_amount = max(total_amount - paid_amount, 0)
        if due_amount <= 0:
            continue
        student = collection.student
        student_id = str(collection.student_id)
        row = grouped.setdefault(
            student_id,
            {
                "id": student_id,
                "student_id": student_id,
                "student_name": _student_name(student) or "Student",
                "class_name": student.klass.name if student and student.klass else None,
                "parent_phone": student.user.phone
                if student and student.user
                else None,
                "parent_email": student.user.email
                if student and student.user
                else None,
                "total_due": 0.0,
                "overdue_since": collection.created_at.isoformat()
                if collection.created_at
                else None,
            },
        )
        row["total_due"] = float(row["total_due"]) + due_amount
        if collection.created_at and (
            not row.get("overdue_since")
            or collection.created_at.isoformat() < str(row["overdue_since"])
        ):
            row["overdue_since"] = collection.created_at.isoformat()
    return success_response(list(grouped.values()))


@fees_bp.route("/defaulters/<uuid:student_id>/remind", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def remind_defaulter(student_id):
    """Send ONE fee-reminder SMS to a student's primary guardian.

    Reuses the daily cron's composition + per-school kill-switch
    (fees plugin setting reminder_enabled). Returns {sent, phone, amount}
    where amount is the student's total outstanding (net payable).
    """
    from app.tasks.fee_reminders import send_single_fee_reminder

    result = send_single_fee_reminder(str(g.school_id), str(student_id))
    if not result.get("ok"):
        reason = result.get("reason")
        if reason == "student_not_found":
            return error_response("Student not found", 404)
        if reason == "reminders_disabled":
            return error_response(
                "Fee reminders are disabled for this school in the fees plugin settings",
                409,
            )
        if reason == "no_outstanding":
            return error_response("No outstanding fees for this student", 400)
        if reason == "no_guardian_phone":
            return error_response(
                "No primary guardian phone number on file for this student",
                400,
            )
        return error_response("Could not send reminder", 500)

    return success_response(
        {
            "sent": result["sent"],
            "channel": "sms",
            "phone": result["phone"],
            "amount": result["amount"],
        }
    )


@fees_bp.route("/collections", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def create_collection():
    """Create a fee bill for a student."""
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    if not student_id:
        return error_response("student_id is required", 400)
    # E181: a malformed uuid used to raise a DB DataError (500).
    student_uuid = _parse_uuid(student_id)
    if student_uuid is None:
        return error_response("student_id must be a valid UUID", 400)

    student = Student.query.filter_by(
        id=student_uuid,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not student:
        return error_response("Student not found", 404)

    collection = FeeCollection(
        school_id=g.school_id,
        student_id=student.id,
        collected_by_id=get_jwt_identity(),
    )
    for key in (
        "academic_year",
        "month_bs",
        "year_bs",
        "payment_method",
        "transaction_id",
        "notes",
    ):
        if key in data:
            setattr(collection, key, data[key])

    collection.fee_item_name = (data.get("fee_item_name") or data.get("fee_type") or "").strip()
    if not collection.fee_item_name:
        return error_response("fee_type is required", 400)

    collection.amount = _coerce_collection_amount(
        data.get("amount") or data.get("total_amount")
    )
    collection.late_fine_amount = _coerce_collection_amount(
        data.get("late_fine_amount")
    )
    collection.discount_amount = _coerce_collection_amount(
        data.get("discount_amount")
    )
    collection.is_scholarship = bool(data.get("is_scholarship"))

    payable_total = _collection_payable_total(collection)
    partial_paid = _coerce_collection_amount(data.get("paid_amount"))
    if partial_paid > payable_total:
        return error_response(
            "Paid amount cannot exceed the adjusted fee total",
            400,
        )
    if partial_paid > 0:
        collection.notes = _merge_partial_payment_note(collection.notes, partial_paid)

    requested_status = data.get("payment_status") or data.get("status")
    collection.payment_status = _resolve_collection_status(
        payable_total,
        partial_paid,
        requested_status,
    )

    db.session.add(collection)
    if collection.invoice_id:
        invoice = FeeInvoice.query.get(collection.invoice_id)
        if invoice is not None:
            _recompute_invoice_status(invoice)
    db.session.commit()
    return created_response(_collection_dict(collection))


@fees_bp.route("/collections/<uuid:collection_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def update_collection(collection_id):
    """Adjust a fee bill without recording a new payment."""
    collection = FeeCollection.query.get(collection_id)
    if collection and not collection.is_deleted and str(collection.school_id) != str(g.school_id):
        return error_response("Fee collection belongs to another school", 403)
    if not collection or collection.is_deleted:
        return error_response("Fee collection not found", 404)

    data = request.get_json(silent=True) or {}

    for key in (
        "academic_year",
        "month_bs",
        "year_bs",
        "payment_method",
        "transaction_id",
        "notes",
    ):
        if key in data:
            setattr(collection, key, data[key] or None)

    if "fee_type" in data or "fee_item_name" in data:
        collection.fee_item_name = (
            data.get("fee_item_name") or data.get("fee_type") or ""
        ).strip()
        if not collection.fee_item_name:
            return error_response("fee_type is required", 400)

    if "amount" in data or "total_amount" in data:
        collection.amount = _coerce_collection_amount(
            data.get("amount") if "amount" in data else data.get("total_amount")
        )
    if "late_fine_amount" in data:
        collection.late_fine_amount = _coerce_collection_amount(
            data.get("late_fine_amount")
        )
    if "discount_amount" in data:
        collection.discount_amount = _coerce_collection_amount(
            data.get("discount_amount")
        )
    if "is_scholarship" in data:
        collection.is_scholarship = bool(data.get("is_scholarship"))

    paid_amount = _extract_partial_paid(collection)
    payable_total = _collection_payable_total(collection)
    if paid_amount > payable_total:
        return error_response(
            "Adjusted total cannot be lower than the amount already paid",
            400,
        )

    requested_status = data.get("payment_status") or data.get("status")
    collection.payment_status = _resolve_collection_status(
        payable_total,
        paid_amount,
        requested_status,
    )

    if collection.invoice_id:
        invoice = FeeInvoice.query.get(collection.invoice_id)
        if invoice is not None:
            _recompute_invoice_status(invoice)
    db.session.commit()
    return success_response(_collection_dict(collection))


@fees_bp.route("/collections/<uuid:collection_id>/pay", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant")
def record_payment(collection_id):
    """Record a payment against a fee collection.

    Supports idempotency: pass an 'idempotency_key' in the request body
    to prevent duplicate payments on network retries or double-clicks.
    """
    fc = FeeCollection.query.get(collection_id)
    if fc and not fc.is_deleted and str(fc.school_id) != str(g.school_id):
        return error_response("Fee collection belongs to another school", 403)
    if not fc or fc.is_deleted:
        return error_response("Fee collection not found", 404)

    data = request.get_json(silent=True) or {}

    # ── Idempotency check ────────────────────────────────────────
    idempotency_key = data.get("idempotency_key")
    stored_idempotency_key = idempotency_key
    if idempotency_key:
        # E182: the lookup MUST be scoped to this school. A global lookup let
        # school B replaying school A's key receive school A's receipt (and
        # believe its own payment was recorded).
        existing = FeeReceipt.query.filter_by(
            idempotency_key=idempotency_key, school_id=g.school_id
        ).first()
        if existing:
            return success_response(
                {
                    "collection": _collection_dict(fc),
                    "receipt": _receipt_dict(existing),
                    "receipt_id": str(existing.id),
                    "idempotent": True,
                },
                meta={"message": "Payment already recorded (idempotent)"},
            )
        # fee_receipts.idempotency_key carries a GLOBAL unique index, so a
        # key already used by ANOTHER school must be namespaced for this
        # school's insert — otherwise the retry-safe replay would 500 with
        # a UniqueViolation instead of recording school B's real payment.
        foreign = FeeReceipt.query.filter_by(
            idempotency_key=idempotency_key
        ).first()
        if foreign:
            stored_idempotency_key = f"{g.school_id}:{idempotency_key}"[:100]

    amount = float(data.get("amount", 0) or 0)
    if amount <= 0:
        return error_response("Payment amount must be greater than zero", 400)

    method = str(data.get("payment_method") or "cash").strip().lower()
    available_methods = {
        item["key"]: item
        for item in _get_configured_payment_methods()
        if item.get("enabled")
    }
    if method not in available_methods:
        return error_response("Selected payment method is disabled or unsupported", 400)

    total_amount = _collection_payable_total(fc)
    previous_paid = _extract_partial_paid(fc)
    outstanding = max(total_amount - previous_paid, 0)
    if outstanding <= 0:
        return error_response("This fee collection is already paid", 400)

    # Optional backdated payment date (ISO "YYYY-MM-DD"): when supplied the
    # payment is stamped with it instead of "now" so cash collected at the
    # desk yesterday records as yesterday. Future dates are rejected.
    payment_date_raw = str(data.get("payment_date") or "").strip()
    if payment_date_raw:
        try:
            payment_dt = datetime.fromisoformat(payment_date_raw).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
        except ValueError:
            return error_response(
                "payment_date must be a valid ISO date (YYYY-MM-DD)", 400
            )
        # Nepal is UTC+5:45 — "today" in Nepal must never be rejected just
        # because UTC has already rolled over to the next day.
        nepal_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=45)
        if payment_dt > nepal_now:
            return error_response("payment_date cannot be in the future", 400)
        # Store the date at midnight UTC so the chosen calendar day is kept
        # exactly (23:59:59 above is only for the future check).
        fc.collected_at = datetime.fromisoformat(payment_date_raw).replace(
            tzinfo=timezone.utc
        )
    else:
        fc.collected_at = datetime.now(timezone.utc)

    new_paid = min(total_amount, previous_paid + amount)
    recorded_amount = min(amount, outstanding)

    # ── S-A1 till lock (A-24): a collector who closed their day for the
    # payment's BS date cannot record further desk payments until an admin
    # reopens the closure. Gateway-anchored callbacks skip this (they are
    # not counter cash).
    if method in ("cash", "cheque", "bank"):
        closure_bs = payment_date_raw or _bs_today().strftime("%Y-%m-%d")
        closed = FeeDayClosure.query.filter(
            FeeDayClosure.school_id == g.school_id,
            FeeDayClosure.closure_date_bs == closure_bs,
            FeeDayClosure.collected_by_id == g.user_id,
            FeeDayClosure.status == "closed",
            FeeDayClosure.is_deleted.is_(False),
        ).first()
        if closed is not None:
            return error_response(
                "Your counter for this date is closed. Ask an administrator "
                "to reopen the day before recording more payments.",
                423,
            )

    fc.payment_method = method
    # Attribution: who recorded the desk payment (day book + till lock key
    # on this). Was never stamped before S-A1 — the day book showed every
    # collection as "unknown".
    fc.collected_by_id = g.user_id
    fc.transaction_id = data.get("transaction_id") or fc.transaction_id
    fc.notes = _merge_partial_payment_note(fc.notes, new_paid)
    if new_paid >= total_amount:
        fc.payment_status = "paid"
    else:
        fc.payment_status = "partial"

    # Generate receipt
    receipt = FeeReceipt(
        school_id=g.school_id,
        collection_id=fc.id,
        student_id=fc.student_id,
        receipt_number=_generate_receipt_number(fc),
        amount=recorded_amount,
        payment_method=method,
        transaction_id=fc.transaction_id,
        idempotency_key=stored_idempotency_key,
    )
    receipt.verified_hash = _receipt_hash(
        receipt.receipt_number, fc.id, recorded_amount
    )
    db.session.add(receipt)
    fc.receipt_number = receipt.receipt_number
    fc.receipt_url = f"/api/v1/fees/receipts/{receipt.id}/pdf"
    receipt.pdf_url = fc.receipt_url
    # S-A1: keep the parent invoice document honest after the line changed.
    if fc.invoice_id:
        invoice = FeeInvoice.query.get(fc.invoice_id)
        if invoice is not None:
            _recompute_invoice_status(invoice)
    db.session.commit()

    from app.plugins.events import emit

    emit(
        "fee.paid",
        school_id=str(g.school_id),
        student_id=str(fc.student_id),
        amount=amount,
    )

    return success_response(
        {
            "collection": _collection_dict(fc),
            "receipt": _receipt_dict(receipt),
            "receipt_id": str(receipt.id),
        }
    )


@fees_bp.route("/collections/<uuid:collection_id>/receipt", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def get_collection_receipt(collection_id):
    """Return the latest receipt for a fee collection."""
    receipt = (
        FeeReceipt.query.filter_by(
            school_id=g.school_id,
            collection_id=collection_id,
            is_deleted=False,
        )
        .order_by(FeeReceipt.created_at.desc())
        .first()
    )
    if not receipt:
        return error_response("Receipt not found", 404)
    return success_response(_receipt_dict(receipt))


@fees_bp.route("/receipts/<uuid:receipt_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def get_receipt(receipt_id):
    """Return a receipt record."""
    receipt = FeeReceipt.query.filter_by(
        id=receipt_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not receipt:
        return error_response("Receipt not found", 404)
    return success_response(_receipt_dict(receipt))


@fees_bp.route("/receipts/<uuid:receipt_id>/pdf", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def download_receipt_pdf(receipt_id):
    """Generate a printable PDF fee receipt."""
    receipt = FeeReceipt.query.filter_by(
        id=receipt_id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if not receipt:
        return error_response("Receipt not found", 404)

    try:
        from weasyprint import HTML
    except ImportError:
        return error_response("PDF export is unavailable on this server", 501)

    try:
        pdf = HTML(
            string=_receipt_pdf_html(receipt), base_url=request.host_url
        ).write_pdf()
    except Exception as exc:
        return error_response(f"Failed to generate PDF: {exc}", 500)

    buffer = BytesIO(pdf)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{receipt.receipt_number}.pdf",
    )


@fees_bp.route("/students/<uuid:student_id>/statement/pdf", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin", "accountant")
def download_student_statement_pdf(student_id):
    """Generate a printable PDF account statement for one student.

    Prints every FeeCollection row with its net payable, paid amount and a
    running outstanding balance — the accountant's ledger for that student.
    """
    student = Student.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not student:
        return error_response("Student not found", 404)

    collections = (
        FeeCollection.query.filter_by(
            student_id=student.id,
            school_id=g.school_id,
            is_deleted=False,
        )
        .order_by(FeeCollection.created_at.asc(), FeeCollection.id.asc())
        .all()
    )

    try:
        from weasyprint import HTML
    except ImportError:
        return error_response("PDF export is unavailable on this server", 501)

    try:
        pdf = HTML(
            string=_statement_pdf_html(student, collections),
            base_url=request.host_url,
        ).write_pdf()
    except Exception as exc:
        return error_response(f"Failed to generate PDF: {exc}", 500)

    buffer = BytesIO(pdf)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"statement_{student.student_id or student.id}.pdf",
    )


def _statement_pdf_html(student, collections):
    """HTML for the student fee statement PDF (same styling as receipts)."""
    school = getattr(g, "school", None)
    school_name = escape(school.name if school else "ASchool")
    student_name = escape(_student_name(student) or "Student")
    klass = getattr(student, "klass", None)
    student_meta = escape(
        " • ".join(
            part
            for part in (
                klass.name if klass else "",
                getattr(student, "student_id", "") or "",
                getattr(student, "admission_number", "") or "",
            )
            if part
        )
        or "—"
    )

    generated_ad = datetime.now(timezone.utc)
    try:
        from app.utils.nepali_date import ad_to_bs

        generated_label = (
            f"{ad_to_bs(generated_ad)} BS  ({generated_ad.strftime('%Y-%m-%d')} AD)"
        )
    except Exception:
        generated_label = generated_ad.strftime("%Y-%m-%d")

    rows_html = []
    running_balance = 0.0
    total_payable = 0.0
    total_paid = 0.0
    for c in collections:
        payable = _collection_payable_total(c)
        paid = min(_extract_partial_paid(c), payable)
        due = round(max(payable - paid, 0.0), 2)
        running_balance = round(running_balance + due, 2)
        total_payable = round(total_payable + payable, 2)
        total_paid = round(total_paid + paid, 2)
        rows_html.append(
            f"""<tr>
      <td>{escape(c.created_at.strftime('%Y-%m-%d') if c.created_at else '-')}</td>
      <td>{escape((c.month_bs or c.year_bs or '-') if (c.month_bs or c.year_bs) else '-')}</td>
      <td>{escape(c.fee_item_name or 'Fee')}</td>
      <td>{escape(str(c.payment_status or '-'))}</td>
      <td class="num">NPR {payable:,.2f}</td>
      <td class="num">NPR {paid:,.2f}</td>
      <td class="num">NPR {due:,.2f}</td>
      <td class="num"><strong>NPR {running_balance:,.2f}</strong></td>
    </tr>"""
        )
    if not rows_html:
        rows_html.append(
            '<tr><td colspan="8" class="empty">No fee records for this student yet.</td></tr>'
        )

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {{ size: A4; margin: 16mm; }}
    body {{ margin: 0; font-family: Arial, sans-serif; color: #0f172a; }}
    .statement {{ border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; }}
    .header {{ display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }}
    .school {{ font-size: 22px; font-weight: 700; }}
    .muted {{ color: #64748b; font-size: 12px; }}
    .number {{ text-align: right; }}
    h1 {{ margin: 18px 0; font-size: 18px; }}
    .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }}
    .box {{ border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }}
    .label {{ color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }}
    .value {{ font-size: 14px; font-weight: 700; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 18px; }}
    th, td {{ border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 12px; }}
    th {{ background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; }}
    td.num, th.num {{ text-align: right; }}
    td.empty {{ text-align: center; color: #64748b; padding: 24px; }}
    .totals {{ display: flex; justify-content: flex-end; margin-top: 16px; }}
    .totals table {{ width: auto; }}
    .totals td {{ font-size: 13px; padding: 6px 14px; }}
    .signatures {{ display: flex; justify-content: space-between; margin-top: 42px; gap: 24px; }}
    .sig {{ flex: 1; border-top: 1px solid #334155; padding-top: 8px; text-align: center; color: #475569; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="statement">
    <div class="header">
      <div>
        <div class="school">{school_name}</div>
        <div class="muted">Student fee statement</div>
      </div>
      <div class="number">
        <div class="muted">Generated</div>
        <div class="value">{generated_label}</div>
      </div>
    </div>

    <h1>Fee Statement</h1>
    <div class="grid">
      <div class="box"><div class="label">Student</div><div class="value">{student_name}</div></div>
      <div class="box"><div class="label">Class / ID</div><div class="value">{student_meta}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th><th>Period (BS)</th><th>Fee Item</th><th>Status</th>
          <th class="num">Net Payable</th><th class="num">Paid</th>
          <th class="num">Due</th><th class="num">Running Balance</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows_html)}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Total billed (net)</td><td class="num"><strong>NPR {total_payable:,.2f}</strong></td></tr>
        <tr><td>Total paid</td><td class="num"><strong>NPR {total_paid:,.2f}</strong></td></tr>
        <tr><td>Outstanding balance</td><td class="num"><strong>NPR {running_balance:,.2f}</strong></td></tr>
      </table>
    </div>

    <div class="signatures">
      <div class="sig">Accountant</div>
      <div class="sig">Guardian</div>
    </div>
  </div>
</body>
</html>"""


# ── Online Payment Initiation ─────────────────────────────


@fees_bp.route("/collections/<uuid:collection_id>/pay-online", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
def initiate_online_payment(collection_id):
    """Initiate eSewa/Khalti online payment."""
    return _initiate_online_payment(collection_id, request.get_json(silent=True) or {})


@fees_bp.route("/initiate-payment", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
def initiate_parent_payment():
    """Initiate an online payment from the parent Flutter app."""
    data = request.get_json(silent=True) or {}
    fee_ids = data.get("fee_ids") or []
    if isinstance(fee_ids, str):
        fee_ids = [fee_ids]
    fee_ids = [fee_id for fee_id in fee_ids if fee_id]
    if len(fee_ids) != 1:
        return error_response("Select one fee record per online payment", 400)
    return _initiate_online_payment(fee_ids[0], data)


def _initiate_online_payment(collection_id, data):
    """Create a payment gateway redirect for a single collection."""
    from app.models.student import Student
    from app.services.payments.esewa_gateway import EsewaGateway
    from app.services.payments.khalti_gateway import KhaltiGateway

    fc = FeeCollection.query.get(collection_id)
    if fc and not fc.is_deleted and str(fc.school_id) != str(g.school_id):
        return error_response("Fee collection belongs to another school", 403)
    if not fc or fc.is_deleted:
        return error_response("Fee collection not found", 404)

    provider = str(data.get("provider") or data.get("gateway") or "esewa").strip().lower()

    method_index = {method["key"]: method for method in _get_configured_payment_methods()}
    selected_method = method_index.get(provider)
    if not selected_method or not selected_method.get("enabled"):
        return error_response(f"Payment provider '{provider}' is not enabled", 400)
    if selected_method.get("mode") != "online":
        return error_response(f"Payment provider '{provider}' is not configured for online checkout", 400)

    # Charge the net payable (base + late fine − discount) minus what has
    # already been paid — the same outstanding figure record_payment uses.
    # Charging the raw base would overbill discounted students and underbill
    # when a late fine applies.
    amount = max(_collection_payable_total(fc) - _extract_partial_paid(fc), 0)
    if amount <= 0:
        return error_response("No outstanding amount to pay")

    student = Student.query.get(fc.student_id)
    student_name = f"{student.first_name} {student.last_name}" if student else "Student"
    base_url = str(data.get("return_url") or request.host_url).rstrip("/")

    # Per-school credentials — must be configured by the school admin.
    school_merchant_code = (selected_method.get("merchant_code") or "").strip()
    school_secret_key = (selected_method.get("secret_key") or "").strip()

    # The gateway callbacks are registered at /webhooks/* (NOT /api/v1/*) —
    # pointing success_url/return_url at the wrong prefix made every real
    # gateway redirect 404 and the money was never recorded (audit E60).
    initiator = getattr(g, "current_user", None)

    def _persist_initiation(gateway_name, gateway_ref):
        """Persist the checkout attempt BEFORE the user is redirected so the
        callback can be anchored (amount cross-check + idempotency)."""
        from app.models.fee import PaymentInitiation

        row = PaymentInitiation(
            school_id=fc.school_id,
            collection_id=fc.id,
            gateway=gateway_name,
            gateway_ref=str(gateway_ref),
            amount=amount,
            status="initiated",
            initiated_by_id=getattr(initiator, "id", None),
        )
        db.session.add(row)
        db.session.commit()
        return row

    try:
        if provider == "esewa":
            result = EsewaGateway.initiate_payment(
                transaction_uuid=str(collection_id),
                amount=amount,
                product_code=school_merchant_code,
                secret_key=school_secret_key,
                success_url=f"{base_url}/webhooks/esewa/callback",
                failure_url=f"{base_url}/webhooks/esewa/callback",
            )
            _persist_initiation("esewa", str(collection_id))
            return success_response({"provider": "esewa", **result})

        elif provider == "khalti":
            result = KhaltiGateway.initiate_payment(
                purchase_order_id=str(collection_id),
                purchase_order_name=f"School Fee — {student_name}",
                amount_paisa=int(amount * 100),
                return_url=f"{base_url}/webhooks/khalti/callback",
                secret_key=school_secret_key,
                customer_info={"name": student_name},
            )
            if not result.get("success"):
                return error_response(result.get("error", "Khalti initiation failed"), 502)
            if not result.get("pidx"):
                return error_response("Khalti did not return a payment reference", 502)
            _persist_initiation("khalti", result["pidx"])
            return success_response({"provider": "khalti", **result})

        elif provider == "fonepay":
            from app.services.payments.fonepay_gateway import FonePayGateway

            result = FonePayGateway.initiate_fee_payment(
                school_slug=getattr(g, "school_slug", "school"),
                fee_collection_id=str(collection_id),
                amount=amount,
                student_name=student_name,
                return_url=f"{base_url}/webhooks/fonepay/callback",
                merchant_code=school_merchant_code,
                secret_key=school_secret_key,
            )
            if not result.get("success"):
                return error_response("FonePay initiation failed", 502)
            _persist_initiation("fonepay", result.get("prn") or "")
            return success_response({"provider": "fonepay", **result})

    except ValueError as exc:
        return error_response(str(exc), 422)

    return error_response(f"Unknown payment provider: {provider}", 400)


# ── Refunds ────────────────────────────────────────────────

@fees_bp.route("/collections/<uuid:collection_id>/refund", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("superadmin", "school_admin")
def refund_payment(collection_id):
    """Initiate a refund for an online fee payment (Khalti only currently).

    Body:
        reason (str): Required. Reason for the refund.
    """
    from app.models.fee import FeeCollection
    from app.utils.response import error_response, success_response

    fc = FeeCollection.query.filter_by(id=collection_id, school_id=g.school_id).first_or_404()
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "").strip()
    if not reason:
        return error_response("reason is required", 400)

    if fc.payment_status not in ("paid", "completed"):
        return error_response("Only paid/completed collections can be refunded", 422)

    if fc.payment_method != "khalti":
        return error_response("Refunds are currently supported for Khalti payments only", 422)

    # Khalti's refund API takes the pidx of the original charge. The pidx is
    # recorded on the PaymentInitiation row at checkout time (audit E60) —
    # `fc.gateway_pidx` never existed and transaction_id alone is not a pidx.
    from app.models.fee import PaymentInitiation

    initiation = (
        PaymentInitiation.query.filter_by(
            collection_id=fc.id, gateway="khalti", is_deleted=False
        )
        .order_by(PaymentInitiation.created_at.desc())
        .first()
    )
    gateway_ref = (initiation.gateway_ref if initiation else None) or getattr(
        fc, "transaction_id", None
    )
    if not gateway_ref:
        return error_response("No gateway reference found for this collection", 422)

    # Retrieve school's Khalti secret key from the payment_methods config
    # (the per-gateway credentials live in fee_config["payment_methods"]).
    khalti_cfg = next(
        (
            m
            for m in _get_configured_payment_methods()
            if m.get("key") == "khalti"
        ),
        {},
    )
    secret_key = (khalti_cfg.get("secret_key") or "").strip()
    if not secret_key:
        return error_response("Khalti is not configured for this school", 422)

    from app.services.payments.khalti_gateway import KhaltiGateway
    try:
        result = KhaltiGateway.refund_payment(gateway_ref, secret_key)
    except ValueError as exc:
        return error_response(str(exc), 422)

    if not result.get("success"):
        return error_response(result.get("error", "Refund failed"), 502)

    # S-13: ledger row + status change in ONE commit (the money has moved
    # gateway-side at this point — the local record must not be allowed to
    # fail independently). 'refunded' was added to the payment_status enum
    # by migration f8c2a9d4e1b7; before that, this commit raised DataError.
    refund_row = FeeRefund(
        school_id=fc.school_id,
        collection_id=fc.id,
        student_id=fc.student_id,
        amount=_collection_payable_total(fc),
        reason=reason,
        gateway="khalti",
        gateway_ref=result.get("refund_id") or result.get("transaction_id") or gateway_ref,
        approved_by_id=g.user_id,
        status="completed",
    )
    db.session.add(refund_row)
    fc.payment_status = "refunded"
    fc.notes = f"[REFUNDED: {reason}] {fc.notes or ''}".strip()
    if fc.invoice_id:
        invoice = FeeInvoice.query.get(fc.invoice_id)
        if invoice is not None:
            _recompute_invoice_status(invoice)
    db.session.commit()

    return success_response({
        "collection_id": str(fc.id),
        "refund_id": str(refund_row.id),
        "refund": result,
        "message": "Refund initiated successfully",
    })


# ── Serializers ────────────────────────────────────────────


def _normalize_fee_frequency(value):
    normalized = str(value or "monthly").strip().lower()
    aliases = {
        "semi annual": "semi-annual",
        "semiannual": "semi-annual",
        "half yearly": "semi-annual",
        "half-yearly": "semi-annual",
        "yearly": "annual",
        "one time": "one-time",
        "one_time": "one-time",
        "onetime": "one-time",
    }
    normalized = aliases.get(normalized, normalized)
    if normalized not in {"monthly", "quarterly", "semi-annual", "annual", "one-time"}:
        return "monthly"
    return normalized


def _current_school():
    school = getattr(g, "school", None)
    if school and str(school.id) == str(g.school_id):
        return school
    return School.query.filter_by(id=g.school_id, is_deleted=False).first()


def _to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _trimmed_text(value, max_length=300):
    text = str(value or "").strip()
    return text[:max_length]


# Gateways that support server-initiated hosted checkout.
_ONLINE_CAPABLE_GATEWAYS = {"esewa", "khalti", "fonepay"}


def _normalize_payment_methods(raw_methods):
    raw_map = {}
    if isinstance(raw_methods, list):
        for item in raw_methods:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or "").strip().lower()
            if key in PAYMENT_METHOD_KEYS:
                raw_map[key] = item

    methods = []
    for key in PAYMENT_METHOD_KEYS:
        defaults = DEFAULT_PAYMENT_METHODS[key]
        incoming = raw_map.get(key, {})

        mode = str(incoming.get("mode") or defaults["mode"]).strip().lower()
        if mode not in {"online", "offline"}:
            mode = defaults["mode"]
        # Only gateways with a hosted checkout implementation can be online.
        if key not in _ONLINE_CAPABLE_GATEWAYS:
            mode = "offline"

        methods.append(
            {
                "key": key,
                "label": _trimmed_text(
                    incoming.get("label") or defaults["label"],
                    max_length=80,
                )
                or defaults["label"],
                "enabled": _to_bool(incoming.get("enabled"), defaults["enabled"]),
                "mode": mode,
                "requires_reference": _to_bool(
                    incoming.get("requires_reference"),
                    defaults["requires_reference"],
                ),
                "supports_qr": _to_bool(
                    incoming.get("supports_qr"),
                    defaults["supports_qr"],
                ),
                "qr_image_url": _trimmed_text(
                    incoming.get("qr_image_url") or defaults["qr_image_url"],
                    max_length=1000,
                ),
                "qr_payload": _trimmed_text(
                    incoming.get("qr_payload") or defaults["qr_payload"],
                    max_length=500,
                ),
                "instructions": _trimmed_text(
                    incoming.get("instructions") or defaults["instructions"],
                    max_length=1200,
                ),
                # Per-school gateway credentials (stored server-side, masked in responses).
                # The "***" sentinel means "keep existing value" and is handled in
                # update_payment_methods before calling this function.
                "merchant_code": _trimmed_text(
                    incoming.get("merchant_code") or defaults.get("merchant_code", ""),
                    max_length=200,
                ),
                "secret_key": _trimmed_text(
                    incoming.get("secret_key") or defaults.get("secret_key", ""),
                    max_length=500,
                ),
            }
        )

    return methods


def _mask_method_credentials(method: dict) -> dict:
    """Return a copy of method config with secret_key masked for API responses."""
    masked = dict(method)
    masked["secret_key"] = "***" if method.get("secret_key") else ""
    return masked


def _get_configured_payment_methods():
    school = _current_school()
    fee_config = dict(getattr(school, "fee_config", {}) or {})
    return _normalize_payment_methods(fee_config.get("payment_methods") or [])


def _coerce_fee_amount(value):
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _coerce_limit(raw, default, maximum):
    """Parse a `limit` query param; None signals invalid input (→ 400)."""
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return min(value, maximum)


def _parse_uuid(value):
    """Return a UUID or None — E181: bad uuid strings in JSON bodies used to
    surface as unhandled 500s (psycopg2 DataError) instead of 400s."""
    import uuid as _uuid

    try:
        return _uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _coerce_due_day(value):
    if value in (None, ""):
        return None
    try:
        day = int(value)
    except (TypeError, ValueError):
        return None
    return day if 1 <= day <= 28 else None


def _humanize_fee_label(value):
    text = str(value or "").strip()
    if not text:
        return ""
    return text.replace("_", " ").replace("-", " ").title()


def _structure_primary_item(structure):
    items = structure.fee_items or []
    if isinstance(items, list) and items:
        return items[0] or {}
    return {}


def _structure_item_name(structure):
    first_item = _structure_primary_item(structure)
    return (
        (first_item.get("name") or "").strip()
        or _humanize_fee_label(first_item.get("fee_type"))
        or "Fee"
    )


def _structure_amount(structure):
    first_item = _structure_primary_item(structure)
    if first_item.get("amount") is not None:
        return _coerce_fee_amount(first_item.get("amount"))
    if structure.total_monthly is not None:
        return float(structure.total_monthly)
    if structure.total_annual is not None:
        return float(structure.total_annual)
    return 0.0


def _structure_frequency(structure):
    first_item = _structure_primary_item(structure)
    fallback = "annual" if structure.total_annual and not structure.total_monthly else "monthly"
    return _normalize_fee_frequency(first_item.get("frequency") or fallback)


def _structure_due_day(structure):
    return _coerce_due_day(_structure_primary_item(structure).get("due_day"))


def _structure_scope_label(structure, class_name):
    parts = [class_name or "All Classes"]
    if structure.academic_year:
        parts.append(f"AY {structure.academic_year}")
    return " • ".join(parts)


def _bs_today():
    """Today as a BS date (import is lazy so module import stays light)."""
    import nepali_datetime

    return nepali_datetime.date.today()


def _structure_cycle_key(structure, on_date=None):
    """BS-calendar cycle key for a structure's primary item.

    Delegates to the shared helper in app/tasks/fee_reminders.py so the
    manual API path and the auto-generate cron compute IDENTICAL keys —
    they used to diverge (Gregorian here, BS in the cron), which let the
    same period be billed twice under two different dedupe markers.
    """
    from app.tasks.fee_reminders import bs_cycle_key

    return bs_cycle_key(_structure_frequency(structure), structure.academic_year, on_date)


def _item_cycle_fields(frequency, structure, on_date=None):
    """(year_bs, month_bs) to stamp on a collection for one fee item.

    Monthly items stamp the full BS month ("2083-05") into month_bs so they
    match the format the cron has always written (and that
    generate_monthly_fee_report filters on).
    """
    today_bs = on_date or _bs_today()
    frequency = _normalize_fee_frequency(frequency)
    if frequency == "monthly":
        return str(today_bs.year), f"{today_bs.year}-{today_bs.month:02d}"
    if frequency == "quarterly":
        quarter = ((today_bs.month - 1) // 3) + 1
        return str(today_bs.year), f"{today_bs.year}-Q{quarter}"
    if frequency == "semi-annual":
        half = 1 if today_bs.month <= 6 else 2
        return str(today_bs.year), f"{today_bs.year}-H{half}"
    if frequency == "annual":
        return str(structure.academic_year or today_bs.year), None
    return str(structure.academic_year or today_bs.year), None


def _structure_cycle_fields(structure, on_date=None):
    """(year_bs, month_bs) for the structure's primary item (BS calendar)."""
    return _item_cycle_fields(
        _structure_frequency(structure), structure, on_date=on_date
    )


def _structure_collection_marker(structure, on_date=None):
    """Unified per-item dedupe marker for the structure's primary item."""
    from app.tasks.fee_reminders import structure_cycle_marker

    first_item = _structure_primary_item(structure)
    item_name = (
        (first_item.get("name") or "").strip()
        or _humanize_fee_label(first_item.get("fee_type"))
        or "Fee"
    )
    return structure_cycle_marker(
        structure.id, _structure_cycle_key(structure, on_date), item_name
    )


def _matching_students_query(structure):
    query = Student.query.filter(
        Student.school_id == structure.school_id,
        Student.is_deleted.is_(False),
        Student.status == "active",
    )
    if structure.class_id:
        query = query.filter(Student.class_id == structure.class_id)
    if structure.academic_year:
        query = query.filter(
            or_(
                Student.academic_year == structure.academic_year,
                Student.academic_year.is_(None),
                Student.academic_year == "",
            )
        )
    return query


def _structure_collection_exists(structure, student_id, markers, item_name, year_bs, month_bs):
    """True when a collection for (structure, student, item, cycle) exists.

    Checks (a) any of the dedupe markers in notes — the unified
    [fee_structure:...] marker plus the legacy [auto_monthly:...] one the old
    cron wrote — and (b) a column-level fallback that also catches pre-marker
    rows from either generator.
    """
    for marker in markers:
        exists = FeeCollection.query.filter(
            FeeCollection.school_id == structure.school_id,
            FeeCollection.student_id == student_id,
            FeeCollection.is_deleted.is_(False),
            FeeCollection.notes.ilike(f"%{marker}%"),
        ).first()
        if exists:
            return True

    query = FeeCollection.query.filter(
        FeeCollection.school_id == structure.school_id,
        FeeCollection.student_id == student_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.fee_item_name == item_name,
        FeeCollection.academic_year == (structure.academic_year or year_bs),
        FeeCollection.year_bs == year_bs,
    )
    if month_bs is None:
        query = query.filter(FeeCollection.month_bs.is_(None))
    else:
        query = query.filter(FeeCollection.month_bs == month_bs)
    return query.first() is not None


# ── S-A1: invoice grouping + status maintenance ──────────────────────────

def _period_key_of(collection):
    """The billing-cycle key an invoice groups by (mirrors the generators)."""
    month_bs = (collection.month_bs or "").strip()
    if re.match(r"^\d{4}-(Q\d|H\d|\d{2})$", month_bs):
        return month_bs
    return (collection.academic_year or collection.year_bs or "").strip() or None


def _invoice_title_of(collection):
    period = _period_key_of(collection)
    if period and re.match(r"^\d{4}-\d{2}$", period):
        try:
            import nepali_datetime

            label = nepali_datetime.date(int(period[:4]), int(period[5:7]), 1)
            return f"{label.strftime('%B')} {period[:4]} fees"
        except Exception:
            return f"{period} fees"
    if period:
        return f"{period} fees"
    return "Fee bill"


def _group_collections_into_invoices(school_id, collections):
    """Bucket fresh FeeCollection rows into per-student invoices.

    One invoice per (student, period_key): an existing non-paid invoice for
    the same period absorbs the new lines (so a manually-applied structure
    and the cron bill for the same month land on one document); otherwise a
    new invoice is created. Invoice status is recomputed from the lines —
    the invoice NEVER holds its own totals (single source of truth).
    """
    if not collections:
        return []
    by_key: dict[tuple, list[FeeCollection]] = {}
    for c in collections:
        key = (str(c.student_id), _period_key_of(c) or "")
        by_key.setdefault(key, []).append(c)

    invoices = []
    for (student_id, period_key), lines in by_key.items():
        invoice = None
        if period_key:
            invoice = (
                FeeInvoice.query.filter(
                    FeeInvoice.school_id == school_id,
                    FeeInvoice.student_id == student_id,
                    FeeInvoice.period_key == period_key,
                    FeeInvoice.is_deleted.is_(False),
                    FeeInvoice.status.in_(("pending", "partial")),
                )
                .first()
            )
        if invoice is None:
            first = lines[0]
            due_candidates = [
                (l.due_date_bs or "").strip() for l in lines if (l.due_date_bs or "").strip()
            ]
            invoice = FeeInvoice(
                school_id=school_id,
                student_id=student_id,
                academic_year=first.academic_year,
                title=_invoice_title_of(first),
                period_key=period_key or None,
                due_date_bs=min(due_candidates) if due_candidates else None,
                status="pending",
            )
            db.session.add(invoice)
            db.session.flush()
        for line in lines:
            line.invoice_id = invoice.id
            # Inherit an explicit due date when the line has none.
            if not (line.due_date_bs or "").strip() and invoice.due_date_bs:
                line.due_date_bs = invoice.due_date_bs
        _recompute_invoice_status(invoice)
        invoices.append(invoice)
    return invoices


def _invoice_totals(invoice):
    """(payable, paid) summed from the invoice's lines — never stored."""
    payable = 0.0
    paid = 0.0
    for line in invoice.collections:
        if line.is_deleted:
            continue
        status = (line.payment_status or "").lower()
        if status == "waived":
            continue
        payable += float(_collection_payable_total(line))
        paid += min(float(_extract_partial_paid(line)), float(_collection_payable_total(line)))
    return round(payable, 2), round(paid, 2)


def _recompute_invoice_status(invoice):
    """pending → partial → paid from the line sums. Waived-only invoices are
    'waived'. Call after ANY line mutation (payment, refund, edit, waive)."""
    payable, paid = _invoice_totals(invoice)
    lines = [l for l in invoice.collections if not l.is_deleted]
    if payable <= 0 and lines and all(
        (l.payment_status or "").lower() == "waived" for l in lines
    ):
        invoice.status = "waived"
    elif paid <= 0:
        invoice.status = "pending"
    elif paid >= payable:
        invoice.status = "paid"
    else:
        invoice.status = "partial"
    return invoice.status


def _recompute_invoices_for_collections(collections):
    """Recompute every distinct invoice touched by a line mutation."""
    seen = set()
    for line in collections:
        invoice = line.invoice
        if invoice is None or invoice.id in seen:
            continue
        seen.add(invoice.id)
        _recompute_invoice_status(invoice)


def _apply_fee_structure(structure, on_date=None):
    """Generate FeeCollection rows for every billable fee item on a structure.

    One bill per (fee item, BS billing cycle): each item is billed on its own
    frequency with the SAME unified notes marker the
    auto_generate_monthly_fees cron checks, so a period generated here is
    skipped by the cron and vice versa. Safe to re-run — duplicates are
    skipped via marker + column fallback.
    """
    from app.tasks.fee_reminders import (
        bs_cycle_key,
        is_bs_month_key,
        legacy_auto_monthly_marker,
        structure_cycle_marker,
    )

    items = structure.fee_items or []
    if not isinstance(items, list):
        items = []

    students = _matching_students_query(structure).all()
    created_count = 0
    skipped_count = 0
    applied_cycles = set()
    new_collections: list[FeeCollection] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        item_name = (
            (item.get("name") or "").strip()
            or _humanize_fee_label(item.get("fee_type"))
            or "Fee"
        )
        amount = _coerce_fee_amount(item.get("amount"))
        if amount <= 0:
            continue
        frequency = _normalize_fee_frequency(item.get("frequency"))
        due_day = _coerce_due_day(item.get("due_day"))
        cycle_key = bs_cycle_key(frequency, structure.academic_year, on_date)
        applied_cycles.add(cycle_key)
        year_bs, month_bs = _item_cycle_fields(frequency, structure, on_date)
        marker = structure_cycle_marker(structure.id, cycle_key, item_name)
        markers = [marker]
        if frequency == "monthly" and is_bs_month_key(cycle_key):
            # Honor the pre-unification cron marker so months billed by the
            # old auto_generate_monthly_fees are never billed twice.
            markers.append(legacy_auto_monthly_marker(structure.id, cycle_key, item_name))

        for student in students:
            if _structure_collection_exists(
                structure, student.id, markers, item_name, year_bs, month_bs
            ):
                skipped_count += 1
                continue

            notes = f"{marker} [frequency:{frequency}]"
            if due_day is not None:
                notes = f"{notes} [due_day:{due_day}]"

            # S-A1: explicit BS due date on the bill (aging + fine accrual
            # read the column; the notes marker remains the dedupe record).
            due_date_bs = None
            if due_day is not None and year_bs and month_bs:
                due_date_bs = nepali_day_date(year_bs, month_bs.split("-")[1], due_day)

            # Auto-apply student scholarship/discount if one exists. ALL active
            # matching discounts stack additively (e.g. sibling 10% + merit 5%
            # = 15% of the base amount); fixed-NPR discounts add their flat
            # value. Percentages are always computed on the base amount (not
            # sequentially on the remainder), and the combined discount is
            # capped at the base so the net payable can never go negative and
            # discounts can never waive a late fine.
            discount_amount = 0.0
            is_scholarship = False
            # No silent failure here (D-01): a swallowed scholarship-lookup
            # error billed students in full while marking nothing. The table
            # exists as of f3a8c2e6d9b4; a genuine DB failure fails loud.
            today_bs = on_date or _bs_today()
            today_bs_str = f"{today_bs.year}-{today_bs.month:02d}-{today_bs.day:02d}"
            scholarships = (
                StudentScholarship.query.filter(
                    StudentScholarship.school_id == structure.school_id,
                    StudentScholarship.student_id == student.id,
                    StudentScholarship.is_active.is_(True),
                    StudentScholarship.is_deleted.is_(False),
                    or_(
                        StudentScholarship.fee_type.is_(None),
                        StudentScholarship.fee_type == item_name,
                    ),
                    or_(
                        StudentScholarship.valid_from_bs.is_(None),
                        StudentScholarship.valid_from_bs <= today_bs_str,
                    ),
                    or_(
                        StudentScholarship.valid_until_bs.is_(None),
                        StudentScholarship.valid_until_bs >= today_bs_str,
                    ),
                )
                .order_by(StudentScholarship.created_at.asc())
                .all()
            )
            if scholarships:
                combined_discount = 0.0
                for sc in scholarships:
                    if sc.discount_type == "percent":
                        combined_discount += float(amount) * float(sc.discount_value or 0) / 100
                    else:
                        combined_discount += float(sc.discount_value or 0)
                discount_amount = round(
                    min(max(combined_discount, 0.0), float(amount)), 2
                )
                is_scholarship = True

            collection = FeeCollection(
                school_id=structure.school_id,
                student_id=student.id,
                academic_year=structure.academic_year or student.academic_year or year_bs,
                fee_item_name=item_name,
                amount=amount,
                discount_amount=discount_amount,
                is_scholarship=is_scholarship,
                month_bs=month_bs,
                year_bs=year_bs,
                payment_status="pending",
                notes=notes,
                due_date_bs=due_date_bs,
            )
            new_collections.append(collection)
            db.session.add(collection)
            created_count += 1

    if created_count:
        # S-A1: group the fresh bills into per-student invoices before
        # committing, so the invoice document exists from day one.
        _group_collections_into_invoices(structure.school_id, new_collections)
        db.session.commit()

    if not applied_cycles:
        applied_cycles.add(_structure_cycle_key(structure, on_date))
    return {
        "matched_students": len(students),
        "created_collections": created_count,
        "skipped_existing": skipped_count,
        "applied_cycle": "/".join(sorted(applied_cycles)),
    }


def _structure_applied_count(structure):
    marker = _structure_collection_marker(structure)
    return FeeCollection.query.filter(
        FeeCollection.school_id == structure.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.notes.ilike(f"%{marker}%"),
    ).count()


def _structure_effective_note(applied_count, applied_cycle):
    if applied_count:
        noun = "student" if applied_count == 1 else "students"
        return f"Active now for {applied_count} {noun} in {applied_cycle}."
    return "Template only until you apply it to students."


def _structure_dict(s):
    total_annual = float(s.total_annual) if s.total_annual is not None else 0
    total_monthly = float(s.total_monthly) if s.total_monthly is not None else 0
    class_name = s.klass.name if getattr(s, "klass", None) else None
    first_item = _structure_primary_item(s)
    item_name = _structure_item_name(s)
    frequency = _structure_frequency(s)
    applied_cycle = _structure_cycle_key(s)
    applied_count = _structure_applied_count(s)
    return {
        "id": str(s.id),
        "name": item_name,
        "scope_label": _structure_scope_label(s, class_name),
        "class_id": str(s.class_id) if s.class_id else None,
        "class_name": class_name,
        "academic_year": s.academic_year,
        "fee_items": s.fee_items or [],
        "fee_type": _humanize_fee_label(first_item.get("fee_type")) or item_name,
        "amount": _structure_amount(s),
        "frequency": frequency,
        "due_day": _structure_due_day(s),
        "is_optional": bool(first_item.get("is_optional", False)),
        "total_amount": total_annual,
        "total_annual": total_annual,
        "total_monthly": total_monthly,
        "applied_count": applied_count,
        "applied_cycle": applied_cycle,
        "effective_note": _structure_effective_note(applied_count, applied_cycle),
        "due_date": _structure_due_date(s),
    }


def _structure_due_date(structure):
    """Ephemeral due date for display: the primary item's due_day inside the
    current BS month. No DB column — computed on the fly."""
    due_day = _structure_due_day(structure)
    if not due_day:
        return None
    try:
        today_bs = _bs_today()
        return nepali_day_date(today_bs.year, today_bs.month, due_day)
    except Exception:
        return None


def nepali_day_date(bs_year, bs_month, bs_day):
    """ISO string for a BS (year, month, day) — None when not a valid BS date."""
    try:
        import nepali_datetime

        return nepali_datetime.date(int(bs_year), int(bs_month), int(bs_day)).isoformat()
    except Exception:
        return None


def bs_to_ad_date(bs_iso):
    """AD datetime.date for a BS ISO string ("2083-04-01") — None on failure.

    Used for due-date arithmetic (aging buckets, fine grace days); all
    display remains BS-first.
    """
    if not bs_iso:
        return None
    try:
        import nepali_datetime

        y, m, d = str(bs_iso).strip().split("-")
        return nepali_datetime.date(int(y), int(m), int(d)).to_datetime_date()
    except Exception:
        return None


def _collection_due_date(collection):
    """Due date for a fee bill (BS, as an AD date for arithmetic).

    S-A1: the explicit `due_date_bs` column wins (written by the generators,
    the installment scheduler and carry-forward). Legacy rows fall back to
    parsing "[due_day:N]" out of notes — month_bs from the generators is a
    full BS "YYYY-MM" key; legacy two-digit month values can't locate a BS
    month, so they yield None.
    """
    column_value = (collection.due_date_bs or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", column_value):
        return bs_to_ad_date(column_value)
    match = re.search(r"\[due_day:(\d{1,2})\]", collection.notes or "")
    if not match:
        return None
    month_bs = (collection.month_bs or "").strip()
    if not re.match(r"^\d{4}-\d{2}$", month_bs):
        return None
    bs_year, bs_month = month_bs.split("-")
    return nepali_day_date(bs_year, bs_month, match.group(1))


def _collection_dict(c):
    paid_amount = _extract_partial_paid(c)
    base_amount = _collection_base_amount(c)
    late_fine_amount = _collection_late_fine_amount(c)
    discount_amount = _collection_discount_amount(c)
    total_amount = _collection_payable_total(c)
    due_amount = max(total_amount - paid_amount, 0)
    student = getattr(c, "student", None)
    receipt = _latest_receipt(c.id)
    student_data = student.to_dict() if student else {}

    return {
        "id": str(c.id),
        "student_id": str(c.student_id),
        "student_name": student_data.get("full_name"),
        "enrollment_number": student_data.get("enrollment_number"),
        "class_name": student_data.get("class_name"),
        "section_name": student_data.get("section_name"),
        "roll_number": student_data.get("roll_number"),
        "fee_type": c.fee_item_name,
        "base_amount": base_amount,
        "late_fine_amount": late_fine_amount,
        "discount_amount": discount_amount,
        "gross_amount": round(base_amount + late_fine_amount, 2),
        "net_amount": total_amount,
        "amount": total_amount,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "due_amount": due_amount,
        "status": c.payment_status,
        "payment_status": c.payment_status,
        "payment_method": c.payment_method,
        "academic_year": c.academic_year,
        "month_bs": c.month_bs,
        "year_bs": c.year_bs,
        "is_scholarship": bool(c.is_scholarship),
        "notes": c.notes,
        "due_date": _collection_due_date(c),
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "paid_at": c.collected_at.isoformat() if c.collected_at else None,
        "receipt_id": str(receipt.id) if receipt else None,
        "receipt_number": receipt.receipt_number if receipt else c.receipt_number,
        "receipt_url": f"/api/v1/fees/receipts/{receipt.id}/pdf"
        if receipt
        else c.receipt_url,
    }


def _receipt_dict(receipt):
    collection = receipt.collection
    student = receipt.student or (collection.student if collection else None)
    return {
        "id": str(receipt.id),
        "collection_id": str(receipt.collection_id),
        "student_id": str(receipt.student_id),
        "student_name": _student_name(student),
        "receipt_number": receipt.receipt_number,
        "amount": float(receipt.amount or 0),
        "payment_method": receipt.payment_method,
        "transaction_id": receipt.transaction_id,
        "pdf_url": f"/api/v1/fees/receipts/{receipt.id}/pdf",
        "verified_hash": receipt.verified_hash,
        "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
        "fee_type": collection.fee_item_name if collection else None,
    }


def _latest_receipt(collection_id):
    return (
        FeeReceipt.query.filter_by(
            school_id=g.school_id,
            collection_id=collection_id,
            is_deleted=False,
        )
        .order_by(FeeReceipt.created_at.desc())
        .first()
    )


def _coerce_collection_amount(value):
    return max(_coerce_fee_amount(value), 0.0)


def _collection_base_amount(collection):
    return _coerce_collection_amount(collection.amount)


def _collection_late_fine_amount(collection):
    return _coerce_collection_amount(collection.late_fine_amount)


def _collection_discount_amount(collection):
    return _coerce_collection_amount(collection.discount_amount)


def _collection_payable_total(collection):
    return round(
        max(
            _collection_base_amount(collection)
            + _collection_late_fine_amount(collection)
            - _collection_discount_amount(collection),
            0.0,
        ),
        2,
    )


def _resolve_collection_status(payable_total, paid_amount, requested_status=None):
    requested = str(requested_status or "").strip().lower()
    if paid_amount > 0:
        return "paid" if paid_amount >= payable_total else "partial"
    if payable_total <= 0 or requested == "waived":
        return "waived"
    return "pending"


def _extract_partial_paid(collection):
    if collection.payment_status == "paid":
        return _collection_payable_total(collection)

    notes = collection.notes or ""
    marker = "[partial_paid:"
    if marker not in notes:
        return 0

    try:
        value = notes.split(marker, 1)[1].split("]", 1)[0]
        return float(value)
    except (ValueError, TypeError, IndexError):
        return 0


def _merge_partial_payment_note(existing_notes, paid_amount):
    notes = existing_notes or ""
    marker = "[partial_paid:"
    if marker in notes:
        prefix = notes.split(marker, 1)[0].rstrip()
        suffix = notes.split("]", 1)[1].lstrip() if "]" in notes else ""
        notes = " ".join(part for part in (prefix, suffix) if part).strip()
    partial_note = f"[partial_paid:{paid_amount}]"
    return f"{partial_note} {notes}".strip()


def _generate_receipt_number(collection):
    """School-level IRD-style series: {PREFIX}/{FY-BS}/{seq:05d} (D-02).

    A per-school counter row is taken with SELECT … FOR UPDATE so two
    concurrent receipts can never draw the same sequence number — the old
    COUNT(*)+1 numbering raced and issued duplicates.

    S-A1: the prefix and padding are school-configurable via
    School.settings["fee_receipt_numbering"] = {"prefix": "ABC", "pad": 5}
    (the sequence itself stays in SchoolReceiptCounter — only the format is
    configurable, the uniqueness mechanics are not).
    """
    from app.models.school import SchoolReceiptCounter

    today_bs = _bs_today()
    fy = today_bs.year if today_bs.month >= 4 else today_bs.year - 1
    fiscal_year_bs = f"{fy}/{str((fy + 1) % 100).zfill(2)}"

    school = School.query.get(g.school_id)
    numbering = {}
    if school and isinstance(school.settings, dict):
        numbering = school.settings.get("fee_receipt_numbering") or {}
    prefix = str(numbering.get("prefix") or "").strip().upper()[:12] or (
        (school.slug if school else "school").upper()[:12]
    )
    try:
        pad = max(2, min(int(numbering.get("pad") or 5), 10))
    except (TypeError, ValueError):
        pad = 5

    counter = (
        SchoolReceiptCounter.query.filter_by(
            school_id=g.school_id, fiscal_year_bs=fiscal_year_bs
        ).with_for_update().first()
    )
    if counter is None:
        counter = SchoolReceiptCounter(
            school_id=g.school_id, fiscal_year_bs=fiscal_year_bs, last_seq=0
        )
        db.session.add(counter)
        db.session.flush()
        # Re-select under lock — a concurrent first receipt may have created it.
        counter = (
            SchoolReceiptCounter.query.filter_by(
                school_id=g.school_id, fiscal_year_bs=fiscal_year_bs
            ).with_for_update().one()
        )
    counter.last_seq = (counter.last_seq or 0) + 1
    seq = counter.last_seq
    return f"{prefix}/{fiscal_year_bs}/{seq:0{pad}d}"


def _receipt_hash(receipt_number, collection_id, amount):
    payload = f"{g.school_id}:{collection_id}:{receipt_number}:{amount}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _student_name(student):
    if not student:
        return None
    return f"{student.first_name or ''} {student.last_name or ''}".strip()


def _receipt_pdf_html(receipt):
    collection = receipt.collection
    student = receipt.student or (collection.student if collection else None)
    school = getattr(g, "school", None)
    school_name = escape(school.name if school else "ASchool")
    student_name = escape(_student_name(student) or "Student")
    fee_type = escape(
        collection.fee_item_name if collection and collection.fee_item_name else "Fee"
    )
    receipt_number = escape(receipt.receipt_number)
    method = escape(receipt.payment_method or "-")
    transaction_id = escape(receipt.transaction_id or "-")
    amount = float(receipt.amount or 0)
    total_amount = _collection_payable_total(collection) if collection else 0
    if collection:
        # "Outstanding after payment" is a point-in-time figure: it must
        # reflect the balance after THIS receipt's payment, not the
        # collection's current balance (reprinting an older receipt after
        # later payments would otherwise show a stale/wrong due amount).
        # Cumulative paid through this receipt = Σ receipts up to and
        # including this one (payments are non-negative; refunds never
        # create receipt rows), capped at the payable total.
        paid_through = (
            db.session.query(func.coalesce(func.sum(FeeReceipt.amount), 0))
            .filter(
                FeeReceipt.collection_id == collection.id,
                FeeReceipt.is_deleted.is_(False),
                FeeReceipt.created_at <= receipt.created_at,
            )
            .scalar()
        )
        paid_amount = min(float(paid_through or 0), total_amount)
    else:
        paid_amount = amount
    due_amount = max(total_amount - paid_amount, 0)
    paid_at = (
        receipt.created_at.strftime("%Y-%m-%d %I:%M %p") if receipt.created_at else "-"
    )
    hash_text = escape(receipt.verified_hash or "")

    # ── IRD (Nepal tax) fields ────────────────────────────────────────
    # PAN is shown whenever the school has registered one. VAT breakdown is
    # rendered only when the school opted in via fee_config.vat_percent
    # (e.g. 13 for VAT-registered institutions), per IRD invoice norms.
    pan_number = escape(str(school.pan_number)) if school and school.pan_number else ""
    vat_percent = 0
    if school and isinstance(school.fee_config, dict):
        try:
            vat_percent = float(school.fee_config.get("vat_percent") or 0)
        except (TypeError, ValueError):
            vat_percent = 0

    if amount > 0 and vat_percent > 0:
        base_amount = amount / (1 + vat_percent / 100)
        vat_amount = amount - base_amount
        tax_rows = (
            f"<tr><td>Base Amount (before {vat_percent:g}% VAT)</td>"
            f"<td>NPR {base_amount:,.2f}</td></tr>"
            f"<tr><td>VAT ({vat_percent:g}%)</td>"
            f"<td>NPR {vat_amount:,.2f}</td></tr>"
            f"<tr><td><strong>Total (incl. VAT)</strong></td>"
            f"<td>NPR {amount:,.2f}</td></tr>"
        )
    else:
        tax_rows = f"<tr><td>{fee_type}</td><td>NPR {amount:,.2f}</td></tr>"

    pan_html = (
        f'<div class="muted">PAN: {pan_number}</div>' if pan_number else ""
    )

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {{ size: A4; margin: 18mm; }}
    body {{ margin: 0; font-family: Arial, sans-serif; color: #0f172a; }}
    .receipt {{ border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; }}
    .header {{ display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }}
    .school {{ font-size: 22px; font-weight: 700; }}
    .muted {{ color: #64748b; font-size: 12px; }}
    .number {{ text-align: right; }}
    h1 {{ margin: 18px 0; font-size: 18px; }}
    .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }}
    .box {{ border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }}
    .label {{ color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }}
    .value {{ font-size: 14px; font-weight: 700; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 18px; }}
    th, td {{ border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; }}
    th {{ background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; }}
    .total {{ text-align: right; font-size: 16px; font-weight: 700; margin-top: 16px; }}
    .hash {{ margin-top: 24px; overflow-wrap: anywhere; }}
    .signatures {{ display: flex; justify-content: space-between; margin-top: 42px; gap: 24px; }}
    .sig {{ flex: 1; border-top: 1px solid #334155; padding-top: 8px; text-align: center; color: #475569; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div>
        <div class="school">{school_name}</div>
        <div class="muted">Digital fee receipt</div>
        {pan_html}
      </div>
      <div class="number">
        <div class="muted">Receipt No.</div>
        <div class="value">{receipt_number}</div>
        <div class="muted">{paid_at}</div>
      </div>
    </div>

    <h1>Payment Receipt</h1>
    <div class="grid">
      <div class="box"><div class="label">Student</div><div class="value">{student_name}</div></div>
      <div class="box"><div class="label">Payment Method</div><div class="value">{method}</div></div>
      <div class="box"><div class="label">Fee Type</div><div class="value">{fee_type}</div></div>
      <div class="box"><div class="label">Transaction ID</div><div class="value">{transaction_id}</div></div>
    </div>

    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        {tax_rows}
      </tbody>
    </table>

    <div class="total">Paid: NPR {amount:,.2f}</div>
    <div class="muted" style="text-align:right;">Outstanding after payment: NPR {due_amount:,.2f}</div>

    <div class="hash muted">Verification hash: {hash_text}</div>
    <div class="signatures">
      <div class="sig">Collected By</div>
      <div class="sig">Guardian</div>
    </div>
  </div>
</body>
</html>"""


# ══════════════════════════════════════════════════════════════════════════
# S-A1 — Fees depth (MASTER_EXECUTION_PLAN A-01 + A-08 + A-24):
# invoices, installments, carry-forward, AR aging, fines/waivers reports,
# offline bank-slip approval queue, day closure/day book, receipt numbering
# config, pending-payment sweeper, parent nudge.
# ══════════════════════════════════════════════════════════════════════════

# ── Fee invoices ─────────────────────────────────────────────────────────

def _invoice_dict(invoice, with_lines=False):
    payable, paid = _invoice_totals(invoice)
    student = invoice.student
    data = {
        "id": str(invoice.id),
        "student_id": str(invoice.student_id),
        "student_name": _student_name(student),
        "class_name": (student.to_dict() or {}).get("class_name") if student else None,
        "title": invoice.title,
        "academic_year": invoice.academic_year,
        "period_key": invoice.period_key,
        "due_date_bs": invoice.due_date_bs,
        "status": invoice.status,
        "total_amount": payable,
        "paid_amount": paid,
        "due_amount": max(payable - paid, 0.0),
        "line_count": sum(1 for l in invoice.collections if not l.is_deleted),
        "notes": invoice.notes,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
    }
    if with_lines:
        data["lines"] = [_collection_dict(l) for l in invoice.collections if not l.is_deleted]
    return data


@fees_bp.route("/invoices", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_invoices():
    """Per-student bill documents (grouped FeeCollection lines)."""
    query = FeeInvoice.query.filter(
        FeeInvoice.school_id == g.school_id, FeeInvoice.is_deleted.is_(False)
    ).options(joinedload(FeeInvoice.student))
    status = (request.args.get("status") or "").strip().lower()
    if status in ("pending", "partial", "paid", "waived"):
        query = query.filter(FeeInvoice.status == status)
    student_id = _parse_uuid(request.args.get("student_id"))
    if student_id:
        query = query.filter(FeeInvoice.student_id == student_id)
    academic_year = (request.args.get("academic_year") or "").strip()
    if academic_year:
        query = query.filter(FeeInvoice.academic_year == academic_year)
    class_id = _parse_uuid(request.args.get("class_id"))
    if class_id:
        query = query.join(Student, Student.id == FeeInvoice.student_id).filter(
            Student.class_id == class_id
        )
    query = query.order_by(FeeInvoice.created_at.desc())
    items, meta = paginate(query)
    return success_response(
        {"invoices": [_invoice_dict(i) for i in items], "meta": meta}
    )


@fees_bp.route("/invoices/<uuid:invoice_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def get_invoice(invoice_id):
    invoice = FeeInvoice.query.filter_by(
        id=invoice_id, school_id=g.school_id, is_deleted=False
    ).first()
    if invoice is None:
        return error_response("Invoice not found", 404)
    return success_response({"invoice": _invoice_dict(invoice, with_lines=True)})


# ── Installments ─────────────────────────────────────────────────────────

@fees_bp.route("/structures/<uuid:structure_id>/installments", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_installments(structure_id):
    structure = FeeStructure.query.filter_by(
        id=structure_id, school_id=g.school_id, is_deleted=False
    ).first()
    if structure is None:
        return error_response("Fee structure not found", 404)
    rows = (
        FeeInstallment.query.filter_by(structure_id=structure.id, is_deleted=False)
        .order_by(FeeInstallment.seq.asc())
        .all()
    )
    scheduled_total = round(sum(float(r.amount or 0) for r in rows), 2)
    return success_response({
        "installments": [
            {
                "id": str(r.id),
                "seq": r.seq,
                "label": r.label,
                "amount": float(r.amount or 0),
                "due_date_bs": r.due_date_bs,
                "is_generated": bool(r.is_generated),
            }
            for r in rows
        ],
        "scheduled_total": scheduled_total,
        "structure_total": float(structure.total_annual or 0),
        "balanced": scheduled_total == round(float(structure.total_annual or 0), 2),
    })


@fees_bp.route("/structures/<uuid:structure_id>/installments", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def set_installments(structure_id):
    """Replace the structure's installment schedule.

    Body: {"installments": [{"seq": 1, "label": "Term 1", "amount": 12000,
    "due_date_bs": "2083-04-10"}, ...]}
    The schedule must sum to the structure total (total_annual when set,
    else the sum of fee_items) — a mismatched schedule would bill an amount
    the structure never promised.
    """
    structure = FeeStructure.query.filter_by(
        id=structure_id, school_id=g.school_id, is_deleted=False
    ).first()
    if structure is None:
        return error_response("Fee structure not found", 404)
    if any(
        (i.is_generated for i in FeeInstallment.query.filter_by(
            structure_id=structure.id, is_deleted=False
        ).all())
    ):
        return error_response(
            "Installments were already applied to students — delete the "
            "generated bills first or create a new structure", 409
        )

    data = request.get_json(silent=True) or {}
    rows = data.get("installments")
    if not isinstance(rows, list) or not rows:
        return error_response("installments must be a non-empty list", 400)

    cleaned = []
    for idx, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            return error_response(f"installments[{idx}] must be an object", 400)
        amount = _coerce_fee_amount(row.get("amount"))
        if amount <= 0:
            return error_response(f"installments[{idx}].amount must be > 0", 400)
        due = str(row.get("due_date_bs") or "").strip() or None
        if due and not re.match(r"^\d{4}-\d{2}-\d{2}$", due):
            return error_response(
                f"installments[{idx}].due_date_bs must be YYYY-MM-DD (BS)", 400
            )
        label = str(row.get("label") or f"Installment {idx}").strip()[:100]
        cleaned.append({
            "seq": int(row.get("seq") or idx),
            "label": label,
            "amount": amount,
            "due_date_bs": due,
        })

    target_total = float(structure.total_annual or 0)
    if target_total <= 0:
        target_total = round(
            sum(_coerce_fee_amount(i.get("amount")) for i in (structure.fee_items or [])
                if isinstance(i, dict)),
            2,
        )
    scheduled_total = round(sum(r["amount"] for r in cleaned), 2)
    if target_total > 0 and abs(scheduled_total - target_total) > 0.01:
        return error_response(
            f"Installment total ({scheduled_total}) must equal the structure "
            f"total ({target_total})", 400
        )

    for existing in FeeInstallment.query.filter_by(
        structure_id=structure.id, is_deleted=False
    ).all():
        existing.soft_delete()
    for row in cleaned:
        db.session.add(
            FeeInstallment(
                school_id=g.school_id,
                structure_id=structure.id,
                seq=row["seq"],
                label=row["label"],
                amount=row["amount"],
                due_date_bs=row["due_date_bs"],
                is_generated=False,
            )
        )
    db.session.commit()
    return success_response({"saved": len(cleaned), "scheduled_total": scheduled_total})


@fees_bp.route("/structures/<uuid:structure_id>/installments/apply", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def apply_installments(structure_id):
    """Generate one bill (FeeCollection) per installment per matched student.

    Idempotent per (structure, installment, student): re-running skips
    already-generated installments. Every bill gets the explicit BS due date
    and lands on the student's invoice document.
    """
    structure = FeeStructure.query.filter_by(
        id=structure_id, school_id=g.school_id, is_deleted=False
    ).first()
    if structure is None:
        return error_response("Fee structure not found", 404)
    installments = (
        FeeInstallment.query.filter_by(structure_id=structure.id, is_deleted=False)
        .order_by(FeeInstallment.seq.asc())
        .all()
    )
    if not installments:
        return error_response(
            "No installment schedule on this structure — save one first", 400
        )

    primary_item = _structure_primary_item(structure)
    item_name = (
        (primary_item.get("name") or "").strip()
        or _humanize_fee_label(primary_item.get("fee_type"))
        or (structure.total_annual and "Fee") or "Fee"
    )
    students = _matching_students_query(structure).all()
    created = 0
    skipped = 0
    new_collections: list[FeeCollection] = []

    # Convert (not double-bill): a structure that already auto-applied its
    # full amount retires those UNPAID bills when the school switches to an
    # installment schedule — otherwise students are billed the total twice
    # (full apply + installments). Paid bills are money already moved; they
    # stay and the installment bills for them must be settled manually.
    for old_bill in FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.installment_id.is_(None),
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(("pending", "partial")),
        FeeCollection.notes.ilike(f"%[fee_structure:{structure.id}%]"),
    ).all():
        if float(_extract_partial_paid(old_bill)) <= 0.005:
            old_bill.soft_delete()

    for inst in installments:
        for student in students:
            exists = FeeCollection.query.filter(
                FeeCollection.school_id == g.school_id,
                FeeCollection.student_id == student.id,
                FeeCollection.installment_id == inst.id,
                FeeCollection.is_deleted.is_(False),
            ).first()
            if exists:
                skipped += 1
                continue
            # Scholarships apply per-bill, same as the cycle generator.
            discount_amount = 0.0
            is_scholarship = False
            scholarships = StudentScholarship.query.filter(
                StudentScholarship.school_id == g.school_id,
                StudentScholarship.student_id == student.id,
                StudentScholarship.is_active.is_(True),
                StudentScholarship.is_deleted.is_(False),
                or_(
                    StudentScholarship.fee_type.is_(None),
                    StudentScholarship.fee_type == item_name,
                ),
            ).all()
            if scholarships:
                combined = sum(
                    float(inst.amount or 0) * float(sc.discount_value or 0) / 100
                    if sc.discount_type == "percent"
                    else float(sc.discount_value or 0)
                    for sc in scholarships
                )
                discount_amount = round(min(max(combined, 0.0), float(inst.amount or 0)), 2)
                is_scholarship = True
            collection = FeeCollection(
                school_id=g.school_id,
                student_id=student.id,
                academic_year=structure.academic_year,
                fee_item_name=f"{item_name} — {inst.label}",
                amount=float(inst.amount or 0),
                discount_amount=discount_amount,
                is_scholarship=is_scholarship,
                month_bs=None,
                year_bs=structure.academic_year,
                payment_status="pending",
                notes=f"[fee_installment:{structure.id}:{inst.seq}]",
                due_date_bs=inst.due_date_bs,
                installment_id=inst.id,
            )
            new_collections.append(collection)
            db.session.add(collection)
            created += 1
        inst.is_generated = True
    if created:
        _group_collections_into_invoices(g.school_id, new_collections)
    db.session.commit()
    return success_response({
        "created_collections": created,
        "skipped_existing": skipped,
        "matched_students": len(students),
    })


# ── Carry-forward ────────────────────────────────────────────────────────

def _student_year_balance(school_id, student_id, year_bs):
    """Signed balance for one student in one academic year:
    (payable − paid) over that year's non-waived bills. >0 = due,
    <0 = credit (overpayment/advance)."""
    rows = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.student_id == student_id,
        FeeCollection.is_deleted.is_(False),
        or_(
            FeeCollection.academic_year == year_bs,
            FeeCollection.year_bs == year_bs,
        ),
    ).all()
    payable = 0.0
    paid = 0.0
    for row in rows:
        if (row.payment_status or "").lower() in ("waived", "refunded"):
            continue
        payable += float(_collection_payable_total(row))
        # Raw partial marker (NOT capped at payable): an amount lowered
        # after payment overpays the line, which is exactly how a credit
        # (advance) arises — capping here would silently erase it.
        paid += float(_extract_partial_paid(row))
    return round(payable - paid, 2)


@fees_bp.route("/carry-forward/preview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def carry_forward_preview():
    """Signed per-student balances for a from-year (what year-close would roll)."""
    from_year = (request.args.get("from_year_bs") or "").strip()
    if not re.match(r"^\d{4}(/?\d{2})?$", from_year):
        return error_response("from_year_bs is required (e.g. 2082 or 2082/83)", 400)
    # Match either the bare BS year or the "2082/83" display form.
    year_variants = {from_year}
    if "/" in from_year:
        year_variants.add(from_year.split("/")[0])
    else:
        year_variants.add(f"{from_year}/{str((int(from_year) + 1) % 100).zfill(2)}")

    query = Student.query.filter(
        Student.school_id == g.school_id, Student.is_deleted.is_(False)
    )
    class_id = _parse_uuid(request.args.get("class_id"))
    if class_id:
        query = query.filter(Student.class_id == class_id)
    students = query.all()

    entries = []
    for student in students:
        balance = 0.0
        for variant in year_variants:
            balance = _student_year_balance(g.school_id, student.id, variant)
            if abs(balance) > 0.005:
                break
        if abs(balance) <= 0.005:
            continue
        entries.append({
            "student_id": str(student.id),
            "student_name": _student_name(student),
            "class_name": (student.to_dict() or {}).get("class_name"),
            "balance": abs(balance),
            "balance_type": "due" if balance > 0 else "credit",
            "signed_balance": balance,
        })
    entries.sort(key=lambda e: e["student_name"] or "")
    return success_response({
        "from_year_bs": from_year,
        "students": entries,
        "total_due": round(sum(e["balance"] for e in entries if e["balance_type"] == "due"), 2),
        "total_credit": round(sum(e["balance"] for e in entries if e["balance_type"] == "credit"), 2),
    })


@fees_bp.route("/carry-forward/apply", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def carry_forward_apply():
    """Roll selected signed balances into the new academic year.

    Body: {"from_year_bs": "2082", "to_year_bs": "2083", "due_date_bs":
    "2083-04-10", "student_ids": [...]} — every selected student with a
    non-zero balance gets a carry-forward row (due → a pending bill in the
    new year; credit → a self-settled credit line visible in reports).
    Idempotent per (student, from, to): already-applied students are skipped.
    """
    data = request.get_json(silent=True) or {}
    from_year = str(data.get("from_year_bs") or "").strip()
    to_year = str(data.get("to_year_bs") or "").strip()
    due_date_bs = str(data.get("due_date_bs") or "").strip() or None
    if not from_year or not to_year:
        return error_response("from_year_bs and to_year_bs are required", 400)
    if due_date_bs and not re.match(r"^\d{4}-\d{2}-\d{2}$", due_date_bs):
        return error_response("due_date_bs must be YYYY-MM-DD (BS)", 400)
    student_ids = data.get("student_ids") or []
    if not isinstance(student_ids, list) or not student_ids:
        return error_response("student_ids must be a non-empty list", 400)

    year_variants = {from_year}
    if "/" in from_year:
        year_variants.add(from_year.split("/")[0])
    else:
        year_variants.add(f"{from_year}/{str((int(from_year) + 1) % 100).zfill(2)}")

    created_bills = 0
    applied = 0
    skipped = 0
    new_collections: list[FeeCollection] = []
    for sid in student_ids:
        parsed = _parse_uuid(sid)
        if not parsed:
            skipped += 1
            continue
        student = Student.query.filter_by(
            id=parsed, school_id=g.school_id, is_deleted=False
        ).first()
        if student is None:
            skipped += 1
            continue
        existing = FeeCarryForward.query.filter(
            FeeCarryForward.school_id == g.school_id,
            FeeCarryForward.student_id == student.id,
            FeeCarryForward.from_year_bs == from_year,
            FeeCarryForward.to_year_bs == to_year,
            FeeCarryForward.is_deleted.is_(False),
            FeeCarryForward.status.in_(("pending", "applied")),
        ).first()
        if existing is not None:
            skipped += 1
            continue

        balance = 0.0
        for variant in year_variants:
            balance = _student_year_balance(g.school_id, student.id, variant)
            if abs(balance) > 0.005:
                break
        if abs(balance) <= 0.005:
            skipped += 1
            continue

        balance_type = "due" if balance > 0 else "credit"
        row = FeeCarryForward(
            school_id=g.school_id,
            student_id=student.id,
            from_year_bs=from_year,
            to_year_bs=to_year,
            balance=round(abs(balance), 2),
            balance_type=balance_type,
            due_date_bs=due_date_bs,
            status="pending",
        )
        db.session.add(row)
        db.session.flush()

        if balance_type == "due":
            bill = FeeCollection(
                school_id=g.school_id,
                student_id=student.id,
                academic_year=to_year,
                fee_item_name=f"Carry-forward balance ({from_year})",
                amount=round(abs(balance), 2),
                month_bs=None,
                year_bs=to_year,
                payment_status="pending",
                notes=f"[carry_forward:{from_year}:{row.id}]",
                due_date_bs=due_date_bs,
            )
        else:
            # Credit: a self-settled line — discount nets the payable to 0 so
            # reports show the advance without inventing a wallet.
            bill = FeeCollection(
                school_id=g.school_id,
                student_id=student.id,
                academic_year=to_year,
                fee_item_name=f"Carry-forward credit ({from_year})",
                amount=round(abs(balance), 2),
                discount_amount=round(abs(balance), 2),
                month_bs=None,
                year_bs=to_year,
                payment_status="waived",
                notes=f"[carry_forward_credit:{from_year}:{row.id}]",
            )
        db.session.add(bill)
        db.session.flush()
        row.applied_collection_id = bill.id
        row.status = "applied"
        new_collections.append(bill)
        db.session.add(
            FeeCarryForwardLog(
                school_id=g.school_id,
                student_id=student.id,
                action="apply",
                balance=round(abs(balance), 2),
                balance_type=balance_type,
                from_year_bs=from_year,
                to_year_bs=to_year,
                actor_id=g.user_id,
                detail={"collection_id": str(bill.id)},
            )
        )
        applied += 1
        created_bills += 1

    if created_bills:
        _group_collections_into_invoices(g.school_id, new_collections)
    db.session.commit()
    return success_response({
        "applied": applied,
        "skipped": skipped,
        "bills_created": created_bills,
    })


@fees_bp.route("/carry-forward/log", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def carry_forward_log():
    query = FeeCarryForwardLog.query.filter(
        FeeCarryForwardLog.school_id == g.school_id,
        FeeCarryForwardLog.is_deleted.is_(False),
    ).order_by(FeeCarryForwardLog.created_at.desc())
    items, meta = paginate(query)
    return success_response({
        "log": [
            {
                "id": str(item.id),
                "student_id": str(item.student_id),
                "action": item.action,
                "balance": float(item.balance or 0),
                "balance_type": item.balance_type,
                "from_year_bs": item.from_year_bs,
                "to_year_bs": item.to_year_bs,
                "detail": item.detail,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
        "meta": meta,
    })


# ── AR aging ─────────────────────────────────────────────────────────────

@fees_bp.route("/receivables/aging", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def receivables_aging():
    """Accounts-receivable aging: outstanding balances bucketed by days past
    due (current / 30 / 60 / 90 / 90+), grouped by class. BS dates in,
    arithmetic on the converted AD dates."""
    as_of_bs = (request.args.get("as_of_bs") or _bs_today().strftime("%Y-%m-%d")).strip()
    as_of_ad = bs_to_ad_date(as_of_bs)
    if as_of_ad is None:
        return error_response("as_of_bs must be a valid BS date (YYYY-MM-DD)", 400)

    rows = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(("pending", "partial")),
    ).all()

    buckets_by_class: dict[str, dict[str, float]] = {}
    student_totals: dict[str, dict] = {}
    for row in rows:
        due_ad = _collection_due_date(row)
        outstanding = float(_collection_payable_total(row)) - min(
            float(_extract_partial_paid(row)), float(_collection_payable_total(row))
        )
        if outstanding <= 0.005:
            continue
        if due_ad is None:
            days_overdue = -1  # not yet schedulable — "unscheduled" bucket
        else:
            days_overdue = (as_of_ad - due_ad).days
            if days_overdue < 0:
                days_overdue = 0
        if days_overdue < 0:
            bucket = "unscheduled"
        elif days_overdue <= 30:
            bucket = "current_or_30"
        elif days_overdue <= 60:
            bucket = "b31_60"
        elif days_overdue <= 90:
            bucket = "b61_90"
        else:
            bucket = "b90_plus"

        student = row.student
        class_name = "Unassigned"
        if student is not None:
            sdata = student.to_dict() or {}
            class_name = sdata.get("class_name") or "Unassigned"
        agg = buckets_by_class.setdefault(
            class_name,
            {"unscheduled": 0.0, "current_or_30": 0.0, "b31_60": 0.0,
             "b61_90": 0.0, "b90_plus": 0.0, "total": 0.0},
        )
        agg[bucket] = round(agg[bucket] + outstanding, 2)
        agg["total"] = round(agg["total"] + outstanding, 2)

        sid = str(row.student_id)
        entry = student_totals.setdefault(
            sid, {"student_id": sid, "student_name": _student_name(student),
                  "class_name": class_name, "total": 0.0,
                  "oldest_overdue_days": None}
        )
        entry["total"] = round(entry["total"] + outstanding, 2)
        if days_overdue is not None and days_overdue >= 0:
            if entry["oldest_overdue_days"] is None or days_overdue > entry["oldest_overdue_days"]:
                entry["oldest_overdue_days"] = days_overdue

    return success_response({
        "as_of_bs": as_of_bs,
        "by_class": [
            {"class_name": name, **totals}
            for name, totals in sorted(buckets_by_class.items())
        ],
        "by_student": sorted(
            student_totals.values(),
            key=lambda s: -(s["oldest_overdue_days"] or 0),
        )[:100],
        "grand_total": round(sum(t["total"] for t in buckets_by_class.values()), 2),
    })


# ── Fines & waivers ──────────────────────────────────────────────────────

def _fee_fine_policy(school):
    policy = {}
    if school and isinstance(school.settings, dict):
        policy = school.settings.get("fees_fine_policy") or {}
    mode = str(policy.get("mode") or "none").strip().lower()
    if mode not in ("none", "fixed_once", "daily_percent"):
        mode = "none"
    try:
        value = max(float(policy.get("value") or 0), 0.0)
    except (TypeError, ValueError):
        value = 0.0
    try:
        grace = max(int(policy.get("grace_days") or 0), 0)
    except (TypeError, ValueError):
        grace = 0
    try:
        max_amount = policy.get("max_amount")
        max_amount = float(max_amount) if max_amount is not None else None
    except (TypeError, ValueError):
        max_amount = None
    return {"mode": mode, "value": value, "grace_days": grace, "max_amount": max_amount}


def _accrue_fines_core(school_id: str, as_of_bs: str | None = None) -> dict:
    """Fine-accrual core shared by the admin endpoint and the daily beat
    task. Idempotent per BS day via fine_accrued_on_bs on each bill."""
    school = School.query.get(school_id)
    policy = _fee_fine_policy(school)
    if policy["mode"] == "none" or policy["value"] <= 0:
        return {"bills_fined": 0, "fine_total": 0.0, "policy": policy, "skipped": "no_policy"}

    as_of_bs = (as_of_bs or _bs_today().strftime("%Y-%m-%d")).strip()
    as_of_ad = bs_to_ad_date(as_of_bs)
    if as_of_ad is None:
        return {"bills_fined": 0, "fine_total": 0.0, "policy": policy, "skipped": "bad_date"}

    rows = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(("pending", "partial")),
    ).all()

    touched = 0
    total_fine = 0.0
    for row in rows:
        if (row.fine_accrued_on_bs or "").strip() >= as_of_bs:
            continue  # already accrued on/after this BS date
        due_ad = _collection_due_date(row)
        if due_ad is None:
            continue
        days_late = (as_of_ad - due_ad).days - policy["grace_days"]
        if days_late <= 0:
            continue
        base = float(_collection_base_amount(row))
        previous_fine = float(row.late_fine_amount or 0)
        if policy["mode"] == "fixed_once":
            if previous_fine > 0:
                continue  # a fixed fine lands once, ever
            new_fine = round(min(policy["value"], policy["max_amount"] or policy["value"]), 2)
            row.late_fine_amount = round(previous_fine + new_fine, 2)
            total_fine += new_fine
        else:  # daily_percent — RECOMPUTE (idempotent + self-healing): the
            # fine is a pure function of days late, never compounded by
            # repeated runs (MSP's flat-per-sub-head double-count lesson).
            fine = round(base * policy["value"] / 100.0 * days_late, 2)
            if policy["max_amount"] is not None:
                fine = min(fine, policy["max_amount"])
            fine = round(min(max(fine, 0.0), 100000.0), 2)
            if fine <= 0:
                continue
            row.late_fine_amount = fine
            total_fine += max(fine - previous_fine, 0.0)
        row.fine_accrued_on_bs = as_of_bs
        touched += 1

    if touched:
        # Fines change line payables → refresh their invoices.
        _recompute_invoices_for_collections(rows)
    db.session.commit()
    return {"bills_fined": touched, "fine_total": round(total_fine, 2), "policy": policy}


@fees_bp.route("/fines/accrue", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def accrue_fines():
    """Accrue late fines per the school's fine policy (School.settings
    ['fees_fine_policy']): mode none|fixed_once|daily_percent, value, grace
    days, optional max cap. Idempotent per BS day via fine_accrued_on_bs —
    re-running the same day is a no-op; daily_percent grows per elapsed day
    (InfixEdu's percent-or-fixed fine math, made idempotent).
    """
    data = request.get_json(silent=True) or {}
    result = _accrue_fines_core(str(g.school_id), data.get("as_of_bs"))
    if result.get("skipped") == "no_policy":
        return error_response(
            "No fine policy configured — set fees_fine_policy in school "
            "settings (mode, value, grace_days, max_amount)", 409
        )
    if result.get("skipped") == "bad_date":
        return error_response("as_of_bs must be a valid BS date", 400)
    return success_response({
        "accrued_on": (data.get("as_of_bs") or _bs_today().strftime("%Y-%m-%d")).strip(),
        "bills_fined": result["bills_fined"],
        "fine_total": result["fine_total"],
        "policy": result["policy"],
    })


@fees_bp.route("/fines/settings", methods=["GET", "PUT"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "superadmin")
def fines_settings():
    """Read/update the school's late-fine policy (School.settings)."""
    school = School.query.get(g.school_id)
    if school is None:
        return error_response("School not found", 404)
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        policy = _fee_fine_policy(school)
        mode = str(data.get("mode") or policy["mode"]).strip().lower()
        if mode not in ("none", "fixed_once", "daily_percent"):
            return error_response("mode must be none|fixed_once|daily_percent", 400)
        policy.update({
            "mode": mode,
            "value": _coerce_fee_amount(data.get("value", policy["value"])),
            "grace_days": max(int(data.get("grace_days", policy["grace_days"]) or 0), 0),
        })
        if data.get("max_amount") is not None:
            policy["max_amount"] = _coerce_fee_amount(data.get("max_amount"))
        settings = dict(school.settings or {})
        settings["fees_fine_policy"] = policy
        school.settings = settings
        db.session.commit()
    return success_response({"policy": _fee_fine_policy(school)})


@fees_bp.route("/reports/fines", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def fines_report():
    """Fines collected/accrued grouped by class and BS month."""
    rows = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.late_fine_amount > 0,
    ).all()
    by_class: dict[str, float] = {}
    by_month: dict[str, float] = {}
    for row in rows:
        student = row.student
        class_name = "Unassigned"
        if student is not None:
            class_name = (student.to_dict() or {}).get("class_name") or "Unassigned"
        by_class[class_name] = round(
            by_class.get(class_name, 0.0) + float(row.late_fine_amount or 0), 2
        )
        key = row.month_bs or row.year_bs or "unscheduled"
        by_month[key] = round(by_month.get(key, 0.0) + float(row.late_fine_amount or 0), 2)
    return success_response({
        "by_class": [{"class_name": k, "fine_total": v} for k, v in sorted(by_class.items())],
        "by_month": [{"month_bs": k, "fine_total": v} for k, v in sorted(by_month.items())],
        "grand_total": round(sum(float(r.late_fine_amount or 0) for r in rows), 2),
    })


@fees_bp.route("/reports/waivers", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def waivers_report():
    """Waivers/discounts granted (scholarships + credits) grouped by class
    and fee type — the accountability report for every NPR not collected."""
    rows = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.discount_amount > 0,
    ).all()
    by_class: dict[str, float] = {}
    by_fee_type: dict[str, float] = {}
    for row in rows:
        student = row.student
        class_name = "Unassigned"
        if student is not None:
            class_name = (student.to_dict() or {}).get("class_name") or "Unassigned"
        by_class[class_name] = round(
            by_class.get(class_name, 0.0) + float(row.discount_amount or 0), 2
        )
        key = row.fee_item_name or "unknown"
        by_fee_type[key] = round(
            by_fee_type.get(key, 0.0) + float(row.discount_amount or 0), 2
        )
    return success_response({
        "by_class": [{"class_name": k, "waiver_total": v} for k, v in sorted(by_class.items())],
        "by_fee_type": [{"fee_type": k, "waiver_total": v} for k, v in sorted(by_fee_type.items())],
        "grand_total": round(sum(float(r.discount_amount or 0) for r in rows), 2),
    })


# ── Offline bank-slip / cheque approval queue ────────────────────────────

def _offline_submission_dict(sub):
    return {
        "id": str(sub.id),
        "student_id": str(sub.student_id),
        "student_name": _student_name(sub.student),
        "amount": float(sub.amount or 0),
        "method": sub.method,
        "bank_name": sub.bank_name,
        "reference_no": sub.reference_no,
        "paid_on_bs": sub.paid_on_bs,
        "slip_file_id": str(sub.slip_file_id) if sub.slip_file_id else None,
        "collection_ids": sub.collection_ids or [],
        "status": sub.status,
        "review_notes": sub.review_notes,
        "created_by_id": str(sub.created_by_id) if sub.created_by_id else None,
        "receipt_ids": sub.receipt_ids or [],
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "reviewed_at": sub.updated_at.isoformat() if sub.updated_at else None,
    }


@fees_bp.route("/offline-submissions", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
def create_offline_submission():
    """Parent/student/teacher submits a bank-transfer or cheque slip for
    review. Money is NOT applied here — an admin approves."""
    data = request.get_json(silent=True) or {}
    student_id = _parse_uuid(data.get("student_id"))
    if not student_id:
        return error_response("student_id is required", 400)
    student = Student.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first()
    if student is None:
        return error_response("Student not found", 404)
    # Parents may only submit for their own children; students for themselves.
    if g.role == "parent":
        own = Student.query.filter(
            Student.school_id == g.school_id,
            Student.is_deleted.is_(False),
            Student.guardians.any(user_id=g.user_id),
        ).all()
        if str(student.id) not in {str(s.id) for s in own}:
            return error_response("You can only submit slips for your own children", 403)
    elif g.role == "student":
        own = Student.query.filter_by(
            user_id=g.user_id, school_id=g.school_id, is_deleted=False
        ).first()
        if own is None or str(own.id) != str(student.id):
            return error_response("You can only submit slips for yourself", 403)

    amount = _coerce_fee_amount(data.get("amount"))
    if amount <= 0:
        return error_response("amount must be greater than zero", 400)
    method = str(data.get("method") or "").strip().lower()
    if method not in ("bank", "cheque"):
        return error_response("method must be bank or cheque", 400)
    paid_on_bs = str(data.get("paid_on_bs") or "").strip() or None
    if paid_on_bs and not re.match(r"^\d{4}-\d{2}-\d{2}$", paid_on_bs):
        return error_response("paid_on_bs must be YYYY-MM-DD (BS)", 400)

    collection_ids = data.get("collection_ids") or []
    if not isinstance(collection_ids, list):
        return error_response("collection_ids must be a list", 400)
    valid_ids = []
    for cid in collection_ids:
        parsed = _parse_uuid(cid)
        if not parsed:
            continue
        bill = FeeCollection.query.filter(
            FeeCollection.id == parsed,
            FeeCollection.school_id == g.school_id,
            FeeCollection.is_deleted.is_(False),
        ).first()
        if bill is not None and str(bill.student_id) == str(student.id):
            outstanding = float(_collection_payable_total(bill)) - min(
                float(_extract_partial_paid(bill)), float(_collection_payable_total(bill))
            )
            if outstanding > 0.005:
                valid_ids.append(str(bill.id))
    if not valid_ids:
        return error_response(
            "No valid outstanding bills for this student in collection_ids", 400
        )

    sub = FeeOfflineSubmission(
        school_id=g.school_id,
        student_id=student.id,
        amount=amount,
        method=method,
        bank_name=str(data.get("bank_name") or "").strip()[:200] or None,
        reference_no=str(data.get("reference_no") or "").strip()[:200] or None,
        paid_on_bs=paid_on_bs,
        slip_file_id=_parse_uuid(data.get("slip_file_id")),
        collection_ids=valid_ids,
        status="pending",
        created_by_id=g.user_id,
    )
    db.session.add(sub)
    db.session.commit()
    return created_response(_offline_submission_dict(sub))


@fees_bp.route("/offline-submissions", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_offline_submissions():
    """Admins see everything (filter by status); parents/students see their
    own submissions only."""
    query = FeeOfflineSubmission.query.filter(
        FeeOfflineSubmission.school_id == g.school_id,
        FeeOfflineSubmission.is_deleted.is_(False),
    ).options(joinedload(FeeOfflineSubmission.student))
    status = (request.args.get("status") or "").strip().lower()
    if status in ("pending", "approved", "rejected"):
        query = query.filter(FeeOfflineSubmission.status == status)
    if g.role in ("parent", "student"):
        own_student_ids = set()
        if g.role == "parent":
            for s in Student.query.filter(
                Student.school_id == g.school_id,
                Student.is_deleted.is_(False),
                Student.guardians.any(user_id=g.user_id),
            ).all():
                own_student_ids.add(str(s.id))
        else:
            own = Student.query.filter_by(
                user_id=g.user_id, school_id=g.school_id, is_deleted=False
            ).first()
            if own:
                own_student_ids.add(str(own.id))
        query = query.filter(
            FeeOfflineSubmission.created_by_id == g.user_id
            if own_student_ids
            else FeeOfflineSubmission.id.is_(None)
        )
    query = query.order_by(FeeOfflineSubmission.created_at.desc())
    items, meta = paginate(query)
    return success_response({
        "submissions": [_offline_submission_dict(s) for s in items], "meta": meta
    })


@fees_bp.route("/offline-submissions/<uuid:submission_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def approve_offline_submission(submission_id):
    """Approve a slip: record the payment through the SAME desk-collection
    core (receipts + invoice status + fee.paid event), settle the referenced
    bills FIFO, and notify the submitter. Single-transaction."""
    sub = FeeOfflineSubmission.query.filter_by(
        id=submission_id, school_id=g.school_id, is_deleted=False
    ).first()
    if sub is None:
        return error_response("Submission not found", 404)
    if sub.status != "pending":
        return error_response(f"Submission is already {sub.status}", 409)

    remaining = float(sub.amount or 0)
    receipts = []
    allocated = 0.0
    for cid in sub.collection_ids or []:
        if remaining <= 0.005:
            break
        bill = FeeCollection.query.filter(
            FeeCollection.id == _parse_uuid(cid),
            FeeCollection.school_id == g.school_id,
            FeeCollection.is_deleted.is_(False),
        ).first()
        if bill is None:
            continue
        payable = float(_collection_payable_total(bill))
        paid_already = min(float(_extract_partial_paid(bill)), payable)
        outstanding = max(payable - paid_already, 0.0)
        if outstanding <= 0.005:
            continue
        applied = min(remaining, outstanding)
        new_paid = paid_already + applied
        previous_notes = bill.notes or ""
        bill.payment_method = sub.method
        bill.collected_by_id = g.user_id
        bill.transaction_id = sub.reference_no or bill.transaction_id
        if not sub.paid_on_bs or not bill.collected_at:
            bill.collected_at = datetime.now(timezone.utc)
        bill.notes = _merge_partial_payment_note(previous_notes, new_paid)
        bill.payment_status = "paid" if new_paid >= payable else "partial"
        receipt = FeeReceipt(
            school_id=g.school_id,
            collection_id=bill.id,
            student_id=bill.student_id,
            receipt_number=_generate_receipt_number(bill),
            amount=round(applied, 2),
            payment_method=sub.method,
            transaction_id=sub.reference_no,
        )
        receipt.verified_hash = _receipt_hash(
            receipt.receipt_number, bill.id, round(applied, 2)
        )
        db.session.add(receipt)
        bill.receipt_number = receipt.receipt_number
        bill.receipt_url = f"/api/v1/fees/receipts/{receipt.id}/pdf"
        receipt.pdf_url = bill.receipt_url
        receipts.append(str(receipt.id))
        remaining -= applied
        allocated += applied
        if bill.invoice_id:
            invoice = FeeInvoice.query.get(bill.invoice_id)
            if invoice is not None:
                _recompute_invoice_status(invoice)

    if allocated <= 0.005:
        return error_response(
            "The referenced bills are already settled — reject this "
            "submission instead", 400
        )

    sub.status = "approved"
    sub.reviewed_by_id = g.user_id
    sub.receipt_ids = receipts
    approve_body = request.get_json(silent=True) or {}
    sub.review_notes = str(approve_body.get("review_notes") or "")[:500] or None
    db.session.commit()

    from app.plugins.events import emit

    emit(
        "fee.paid",
        school_id=str(g.school_id),
        student_id=str(sub.student_id),
        amount=allocated,
    )
    # In-app receipt notification for the submitter (if they have an account).
    if sub.created_by_id:
        from app.api.v1.notifications import create_notification

        create_notification(
            school_id=str(g.school_id),
            user_id=str(sub.created_by_id),
            title="Payment slip approved",
            body=(
                f"Your {sub.method} payment of NPR {allocated:,.2f} "
                f"(ref {sub.reference_no or '—'}) was approved. "
                f"{len(receipts)} receipt(s) issued."
            ),
            category="fee",
            priority="normal",
            data={"submission_id": str(sub.id), "receipt_ids": receipts},
            action_url="/dashboard/fees",
        )
    return success_response({
        "submission": _offline_submission_dict(sub),
        "allocated_amount": round(allocated, 2),
        "unallocated_amount": round(max(remaining, 0.0), 2),
        "receipt_ids": receipts,
    })


@fees_bp.route("/offline-submissions/<uuid:submission_id>/reject", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def reject_offline_submission(submission_id):
    sub = FeeOfflineSubmission.query.filter_by(
        id=submission_id, school_id=g.school_id, is_deleted=False
    ).first()
    if sub is None:
        return error_response("Submission not found", 404)
    if sub.status != "pending":
        return error_response(f"Submission is already {sub.status}", 409)
    data = request.get_json(silent=True) or {}
    sub.status = "rejected"
    sub.reviewed_by_id = g.user_id
    sub.review_notes = str(data.get("review_notes") or "")[:500] or None
    db.session.commit()
    if sub.created_by_id:
        from app.api.v1.notifications import create_notification

        create_notification(
            school_id=str(g.school_id),
            user_id=str(sub.created_by_id),
            title="Payment slip rejected",
            body=(
                f"Your {sub.method} payment slip of NPR {float(sub.amount or 0):,.2f} "
                f"was rejected. {sub.review_notes or 'Contact the accounts office.'}"
            ),
            category="fee",
            priority="high",
            data={"submission_id": str(sub.id)},
        )
    return success_response({"submission": _offline_submission_dict(sub)})


# ── Day book & day closure (counter accountability) ──────────────────────

@fees_bp.route("/day-book", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def day_book():
    """Collections grouped by payment method (and collector) for one BS date
    — the counter's take for the day."""
    date_bs = (request.args.get("date_bs") or _bs_today().strftime("%Y-%m-%d")).strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_bs):
        return error_response("date_bs must be YYYY-MM-DD (BS)", 400)
    date_ad = bs_to_ad_date(date_bs)
    if date_ad is None:
        return error_response("date_bs must be a valid BS date", 400)

    day_start = datetime(date_ad.year, date_ad.month, date_ad.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    query = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.collected_at >= day_start,
        FeeCollection.collected_at < day_end,
        FeeCollection.payment_status.in_(("paid", "partial")),
    ).options(joinedload(FeeCollection.student))

    user_id = _parse_uuid(request.args.get("user_id"))
    if user_id:
        query = query.filter(FeeCollection.collected_by_id == user_id)
    rows = query.all()

    by_method: dict[str, dict] = {}
    by_user: dict[str, dict] = {}
    grand = 0.0
    for row in rows:
        # The collected amount for a partially-paid bill = what was actually
        # paid (partial marker), else the full payable.
        payable = float(_collection_payable_total(row))
        paid = min(float(_extract_partial_paid(row)), payable) or payable
        method = row.payment_method or "unknown"
        entry = by_method.setdefault(
            method, {"method": method, "count": 0, "amount": 0.0}
        )
        entry["count"] += 1
        entry["amount"] = round(entry["amount"] + paid, 2)
        uname = "unknown"
        collector = row.collected_by
        if collector is not None:
            uname = (collector.full_name or "").strip() \
                or str(collector.email or collector.id)
        uentry = by_user.setdefault(
            str(row.collected_by_id) if row.collected_by_id else "unknown",
            {"user_id": str(row.collected_by_id) if row.collected_by_id else None,
             "user_name": uname, "count": 0, "amount": 0.0},
        )
        uentry["count"] += 1
        uentry["amount"] = round(uentry["amount"] + paid, 2)
        grand += paid

    closure = FeeDayClosure.query.filter(
        FeeDayClosure.school_id == g.school_id,
        FeeDayClosure.closure_date_bs == date_bs,
        FeeDayClosure.is_deleted.is_(False),
    ).all() if not user_id else FeeDayClosure.query.filter(
        FeeDayClosure.school_id == g.school_id,
        FeeDayClosure.closure_date_bs == date_bs,
        FeeDayClosure.collected_by_id == user_id,
        FeeDayClosure.is_deleted.is_(False),
    ).all()

    return success_response({
        "date_bs": date_bs,
        "by_method": list(by_method.values()),
        "by_user": list(by_user.values()),
        "grand_total": round(grand, 2),
        "collections_count": len(rows),
        "closures": [
            {
                "id": str(c.id),
                "collected_by_id": str(c.collected_by_id),
                "status": c.status,
                "expected_total": float(c.expected_total or 0),
                "counted_total": float(c.counted_total or 0),
                "difference": float(c.difference or 0),
            }
            for c in closure
        ],
    })


@fees_bp.route("/day-closures", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def close_day():
    """Close the counter for one collector + BS date: the day book total is
    frozen as expected_total; counted denominations produce the difference.
    While closed, record_payment refuses cash/cheque/bank entries for that
    collector+date (the till lock)."""
    data = request.get_json(silent=True) or {}
    date_bs = str(data.get("closure_date_bs") or _bs_today().strftime("%Y-%m-%d")).strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_bs):
        return error_response("closure_date_bs must be YYYY-MM-DD (BS)", 400)
    date_ad = bs_to_ad_date(date_bs)
    if date_ad is None:
        return error_response("closure_date_bs must be a valid BS date", 400)
    collector_id = _parse_uuid(data.get("collected_by_id")) or g.user_id

    existing = FeeDayClosure.query.filter(
        FeeDayClosure.school_id == g.school_id,
        FeeDayClosure.closure_date_bs == date_bs,
        FeeDayClosure.collected_by_id == collector_id,
        FeeDayClosure.is_deleted.is_(False),
        FeeDayClosure.status == "closed",
    ).first()
    if existing is not None:
        return error_response("This counter is already closed for the date", 409)

    day_start = datetime(date_ad.year, date_ad.month, date_ad.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    rows = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.collected_by_id == collector_id,
        FeeCollection.collected_at >= day_start,
        FeeCollection.collected_at < day_end,
        FeeCollection.payment_status.in_(("paid", "partial")),
    ).all()
    expected = 0.0
    for row in rows:
        payable = float(_collection_payable_total(row))
        paid = min(float(_extract_partial_paid(row)), payable) or payable
        if (row.payment_method or "") in ("cash", "cheque", "bank", "qr_pay"):
            expected += paid

    denominations = data.get("denominations")
    if not isinstance(denominations, dict):
        denominations = {}
    counted = 0.0
    clean_denoms: dict[str, int] = {}
    for denom, count in denominations.items():
        try:
            d = int(float(denom))
            c = int(count)
        except (TypeError, ValueError):
            continue
        if d <= 0 or c < 0:
            continue
        clean_denoms[str(d)] = c
        counted += d * c

    closure = FeeDayClosure(
        school_id=g.school_id,
        closure_date_bs=date_bs,
        closure_date_ad=day_start,
        collected_by_id=collector_id,
        status="closed",
        denominations=clean_denoms,
        expected_total=round(expected, 2),
        counted_total=round(counted, 2),
        difference=round(counted - expected, 2),
        closed_at=datetime.now(timezone.utc),
        closed_by_id=g.user_id,
        notes=str(data.get("notes") or "")[:500] or None,
    )
    db.session.add(closure)
    db.session.commit()
    return created_response({
        "id": str(closure.id),
        "closure_date_bs": closure.closure_date_bs,
        "collected_by_id": str(closure.collected_by_id),
        "status": closure.status,
        "expected_total": float(closure.expected_total),
        "counted_total": float(closure.counted_total),
        "difference": float(closure.difference),
    })


@fees_bp.route("/day-closures", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def list_day_closures():
    query = FeeDayClosure.query.filter(
        FeeDayClosure.school_id == g.school_id, FeeDayClosure.is_deleted.is_(False)
    ).order_by(FeeDayClosure.closure_date_bs.desc())
    date_bs = (request.args.get("date_bs") or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_bs):
        query = query.filter(FeeDayClosure.closure_date_bs == date_bs)
    items, meta = paginate(query)
    return success_response({
        "closures": [
            {
                "id": str(c.id),
                "closure_date_bs": c.closure_date_bs,
                "collected_by_id": str(c.collected_by_id),
                "status": c.status,
                "expected_total": float(c.expected_total or 0),
                "counted_total": float(c.counted_total or 0),
                "difference": float(c.difference or 0),
                "denominations": c.denominations or {},
                "notes": c.notes,
                "closed_at": c.closed_at.isoformat() if c.closed_at else None,
                "reopened_at": c.reopened_at.isoformat() if c.reopened_at else None,
            }
            for c in items
        ],
        "meta": meta,
    })


@fees_bp.route("/day-closures/<uuid:closure_id>/reopen", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "superadmin")
def reopen_day(closure_id):
    """Admin-only reopen — every reopen is stamped with who and when."""
    closure = FeeDayClosure.query.filter_by(
        id=closure_id, school_id=g.school_id, is_deleted=False
    ).first()
    if closure is None:
        return error_response("Day closure not found", 404)
    if closure.status != "closed":
        return error_response("This counter is not closed", 409)
    closure.status = "open"
    closure.reopened_at = datetime.now(timezone.utc)
    closure.reopened_by_id = g.user_id
    db.session.commit()
    return success_response({"id": str(closure.id), "status": closure.status})


# ── Receipt numbering config ─────────────────────────────────────────────

@fees_bp.route("/receipt-numbering", methods=["GET", "PUT"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "superadmin")
def receipt_numbering():
    """School-configurable receipt series (prefix + zero-pad). The sequence
    itself stays in the locked per-school counter — only the FORMAT changes."""
    school = School.query.get(g.school_id)
    if school is None:
        return error_response("School not found", 404)
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        settings = dict(school.settings or {})
        current = settings.get("fee_receipt_numbering") or {}
        prefix = str(data.get("prefix") or current.get("prefix") or "").strip().upper()[:12]
        try:
            pad = max(2, min(int(data.get("pad") or current.get("pad") or 5), 10))
        except (TypeError, ValueError):
            pad = 5
        settings["fee_receipt_numbering"] = {"prefix": prefix, "pad": pad}
        school.settings = settings
        db.session.commit()
    numbering = {}
    if isinstance(school.settings, dict):
        numbering = school.settings.get("fee_receipt_numbering") or {}
    return success_response({
        "prefix": numbering.get("prefix") or (school.slug or "school").upper()[:12],
        "pad": numbering.get("pad") or 5,
        "sample": f"{(numbering.get('prefix') or (school.slug or 'school').upper()[:12])}"
                  f"/2083-84/{'1'.zfill(numbering.get('pad') or 5)}",
    })


# ── Pending-payment sweeper (A-08) ───────────────────────────────────────

@fees_bp.route("/payments/sweep-pending", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
@role_required("school_admin", "accountant", "superadmin")
def sweep_pending_payments():
    """Fail stale gateway initiations: a PaymentInitiation stuck in
    'initiated' past the stale window (default 1h, eSewa/Khalti/FonePay
    sessions all expire well inside it) is marked failed so the due stays
    honestly outstanding. The beat task runs this hourly; the endpoint is
    the manual trigger. Idempotent."""
    data = request.get_json(silent=True) or {}
    try:
        stale_hours = max(float(data.get("stale_hours") or 1.0), 0.25)
    except (TypeError, ValueError):
        stale_hours = 1.0
    cutoff = datetime.now(timezone.utc) - timedelta(hours=stale_hours)

    from app.models.fee import PaymentInitiation

    stale = PaymentInitiation.query.filter(
        PaymentInitiation.school_id == g.school_id,
        PaymentInitiation.status == "initiated",
        PaymentInitiation.created_at < cutoff,
        PaymentInitiation.is_deleted.is_(False),
    ).all()
    swept = 0
    amount = 0.0
    for initiation in stale:
        initiation.status = "failed"
        swept += 1
        amount += float(initiation.amount or 0)
    if swept:
        db.session.commit()
    return success_response({
        "swept": swept,
        "amount": round(amount, 2),
        "stale_hours": stale_hours,
    })


# ── Ask-parents-to-pay nudge (A-08) ──────────────────────────────────────

@fees_bp.route("/students/<uuid:student_id>/nudge-parent", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("fees")
def nudge_parent(student_id):
    """Student (or admin on their behalf) asks the guardians to pay
    outstanding fees — an in-app notification per guardian account with the
    outstanding total (the eSchool 'ask parents to pay' loop, on our rails)."""
    student = Student.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first()
    if student is None:
        return error_response("Student not found", 404)
    if g.role == "student":
        own = Student.query.filter_by(
            user_id=g.user_id, school_id=g.school_id, is_deleted=False
        ).first()
        if own is None or str(own.id) != str(student.id):
            return error_response("You can only nudge your own guardians", 403)

    dues = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.student_id == student.id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(("pending", "partial")),
    ).all()
    outstanding = 0.0
    for row in dues:
        payable = float(_collection_payable_total(row))
        paid = min(float(_extract_partial_paid(row)), payable)
        outstanding += max(payable - paid, 0.0)
    if outstanding <= 0.005:
        return error_response("No outstanding fees for this student", 400)

    from app.api.v1.notifications import create_notification

    notified = 0
    for guardian in student.guardians:
        if guardian.user_id is None:
            continue
        create_notification(
            school_id=str(g.school_id),
            user_id=str(guardian.user_id),
            title="Fee payment requested",
            body=(
                f"{_student_name(student)} has requested help paying outstanding "
                f"fees of NPR {outstanding:,.2f}."
            ),
            category="fee",
            priority="normal",
            data={"student_id": str(student.id), "outstanding": round(outstanding, 2)},
            action_url="/parent/fees",
        )
        notified += 1
    if notified == 0:
        return error_response(
            "No guardian accounts are linked to this student yet", 409
        )
    return success_response({"notified": notified, "outstanding": round(outstanding, 2)})
