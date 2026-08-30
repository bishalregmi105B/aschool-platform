"""Fees plugin API — fee structure, collection, receipts, payments."""

import hashlib
from datetime import datetime, timezone
from html import escape
from io import BytesIO

from flask import Blueprint, g, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_

from app.models.fee import FeeCollection, FeeReceipt, FeeStructure, StudentScholarship
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
        .order_by(FeeReceipt.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in recent_receipts:
        collection = FeeCollection.query.get(r.collection_id) if r.collection_id else None
        student = Student.query.get(r.student_id) if r.student_id else None
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
    query = query.order_by(FeeCollection.created_at.asc()).limit(limit)
    collections = query.all()

    result = []
    for c in collections:
        payable = _collection_payable_total(c)
        paid = min(_extract_partial_paid(c), payable)
        due = max(payable - paid, 0.0)
        if due <= 0:
            continue
        student = Student.query.get(c.student_id) if c.student_id else None
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


@fees_bp.route("/collections", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("fees")
def list_collections():
    """List fee collections."""
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

    items, meta = paginate(query.order_by(FeeCollection.created_at.desc()))
    return success_response(
        [_collection_dict(c) for c in items], meta={"pagination": meta}
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

    new_paid = min(total_amount, previous_paid + amount)
    recorded_amount = min(amount, outstanding)

    fc.payment_method = method
    fc.transaction_id = data.get("transaction_id") or fc.transaction_id
    fc.collected_at = datetime.now(timezone.utc)
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

    fc.payment_status = "refunded"
    fc.notes = f"[REFUNDED: {reason}] {fc.notes or ''}".strip()
    from extensions import db
    db.session.commit()

    return success_response({
        "collection_id": str(fc.id),
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


def _structure_cycle_key(structure):
    now = datetime.now(timezone.utc)
    frequency = _structure_frequency(structure)
    if frequency == "monthly":
        return f"{now.year}-{now.month:02d}"
    if frequency == "quarterly":
        return f"{now.year}-Q{((now.month - 1) // 3) + 1}"
    if frequency == "semi-annual":
        return f"{now.year}-H{1 if now.month <= 6 else 2}"
    if frequency == "annual":
        return str(structure.academic_year or now.year)
    return "one-time"


def _structure_cycle_fields(structure):
    now = datetime.now(timezone.utc)
    frequency = _structure_frequency(structure)
    if frequency == "monthly":
        return str(now.year), f"{now.month:02d}"
    if frequency == "quarterly":
        return str(now.year), f"Q{((now.month - 1) // 3) + 1}"
    if frequency == "semi-annual":
        return str(now.year), f"H{1 if now.month <= 6 else 2}"
    if frequency == "annual":
        return str(structure.academic_year or now.year), None
    return str(structure.academic_year or now.year), "ONE_TIME"


def _structure_collection_marker(structure):
    return f"[fee_structure:{structure.id}:{_structure_cycle_key(structure)}]"


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


def _has_existing_structure_collection(structure, student_id, marker):
    existing_marker = FeeCollection.query.filter(
        FeeCollection.school_id == structure.school_id,
        FeeCollection.student_id == student_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.notes.ilike(f"%{marker}%"),
    ).first()
    if existing_marker:
        return True

    year_bs, month_bs = _structure_cycle_fields(structure)
    query = FeeCollection.query.filter(
        FeeCollection.school_id == structure.school_id,
        FeeCollection.student_id == student_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.fee_item_name == _structure_item_name(structure),
        FeeCollection.academic_year == (structure.academic_year or year_bs),
        FeeCollection.year_bs == year_bs,
    )
    if month_bs is None:
        query = query.filter(FeeCollection.month_bs.is_(None))
    else:
        query = query.filter(FeeCollection.month_bs == month_bs)
    return query.first() is not None


def _apply_fee_structure(structure):
    marker = _structure_collection_marker(structure)
    frequency = _structure_frequency(structure)
    due_day = _structure_due_day(structure)
    year_bs, month_bs = _structure_cycle_fields(structure)
    amount = _structure_amount(structure)
    item_name = _structure_item_name(structure)
    now_year = str(datetime.now(timezone.utc).year)

    students = _matching_students_query(structure).all()
    created_count = 0
    skipped_count = 0

    for student in students:
        if _has_existing_structure_collection(structure, student.id, marker):
            skipped_count += 1
            continue

        notes = f"{marker} [frequency:{frequency}]"
        if due_day is not None:
            notes = f"{notes} [due_day:{due_day}]"

        # Auto-apply student scholarship/discount if one exists. ALL active
        # matching discounts stack additively (e.g. sibling 10% + merit 5%
        # = 15% of the base amount); fixed-NPR discounts add their flat
        # value. Percentages are always computed on the base amount (not
        # sequentially on the remainder), and the combined discount is
        # capped at the base so the net payable can never go negative and
        # discounts can never waive a late fine.
        discount_amount = 0.0
        is_scholarship = False
        try:
            import nepali_datetime
            today_bs = nepali_datetime.date.today()
            today_bs_str = f"{today_bs.year}-{today_bs.month:02d}-{today_bs.day:02d}"
            # SAVEPOINT: if the discount lookup fails (e.g. table missing in an
            # un-migrated DB), the error is contained — a bare failure here must
            # never abort the surrounding billing transaction mid-run.
            with db.session.begin_nested():
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
        except Exception:
            pass

        collection = FeeCollection(
            school_id=structure.school_id,
            student_id=student.id,
            academic_year=structure.academic_year or student.academic_year or now_year,
            fee_item_name=item_name,
            amount=amount,
            discount_amount=discount_amount,
            is_scholarship=is_scholarship,
            month_bs=month_bs,
            year_bs=year_bs,
            payment_status="pending",
            notes=notes,
        )
        db.session.add(collection)
        created_count += 1

    if created_count:
        db.session.commit()

    return {
        "matched_students": len(students),
        "created_collections": created_count,
        "skipped_existing": skipped_count,
        "applied_cycle": _structure_cycle_key(structure),
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
        "due_date": None,
    }


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
        "due_date": None,
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
    count = (
        FeeReceipt.query.filter_by(
            school_id=g.school_id,
            collection_id=collection.id,
            is_deleted=False,
        ).count()
        + 1
    )
    return f"RCPT-{str(collection.id).split('-')[0].upper()}-{count:02d}"


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
