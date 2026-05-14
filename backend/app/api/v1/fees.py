"""Fees plugin API — fee structure, collection, receipts, payments."""

import hashlib
from datetime import datetime, timezone
from html import escape
from io import BytesIO

from flask import Blueprint, g, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_

from app.models.fee import FeeCollection, FeeReceipt, FeeStructure
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
    },
    "fonepay": {
        "label": "FonePay",
        "enabled": True,
        "mode": "offline",
        "requires_reference": True,
        "supports_qr": True,
        "qr_image_url": "",
        "qr_payload": "",
        "instructions": "",
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
    """Return school-level payment method configuration."""
    methods = _get_configured_payment_methods()
    return success_response(
        {
            "methods": methods,
            "enabled_methods": [m["key"] for m in methods if m["enabled"]],
            "online_methods": [
                m["key"]
                for m in methods
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

    methods = _normalize_payment_methods(incoming_methods)
    if not any(m["enabled"] for m in methods):
        return error_response("At least one payment method must remain enabled", 400)

    fee_config = dict(school.fee_config or {})
    fee_config["payment_methods"] = methods
    school.fee_config = fee_config
    db.session.commit()

    return success_response(
        {
            "methods": methods,
            "enabled_methods": [m["key"] for m in methods if m["enabled"]],
            "online_methods": [
                m["key"]
                for m in methods
                if m["enabled"] and m["mode"] == "online"
            ],
        }
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
    from sqlalchemy import func

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
    limit = min(int(request.args.get("limit", 20)), 100)
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
    from app.models.academic import Class

    limit = min(int(request.args.get("limit", 50)), 200)
    class_id = request.args.get("class_id")

    query = FeeCollection.query.filter(
        FeeCollection.school_id == g.school_id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.payment_status.in_(["pending", "partial"]),
    )
    if class_id:
        query = query.filter_by(class_id=class_id)
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
        klass = Class.query.get(c.class_id) if c.class_id else None
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
    for key in (
        "class_id",
        "academic_year",
        "fee_items",
        "total_annual",
        "total_monthly",
    ):
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
        total_amount = float(collection.amount or 0)
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

    student = Student.query.filter_by(
        id=student_id,
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
    if not collection or collection.is_deleted or str(collection.school_id) != str(g.school_id):
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
    """Record a payment against a fee collection."""
    fc = FeeCollection.query.get(collection_id)
    if not fc or fc.is_deleted or str(fc.school_id) != str(g.school_id):
        return error_response("Fee collection not found", 404)

    data = request.get_json(silent=True) or {}
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
    if not fc or fc.is_deleted or str(fc.school_id) != str(g.school_id):
        return error_response("Fee collection not found", 404)

    provider = str(data.get("provider") or data.get("gateway") or "esewa").strip().lower()

    method_index = {method["key"]: method for method in _get_configured_payment_methods()}
    selected_method = method_index.get(provider)
    if not selected_method or not selected_method.get("enabled"):
        return error_response(f"Payment provider '{provider}' is not enabled", 400)
    if selected_method.get("mode") != "online":
        return error_response(f"Payment provider '{provider}' is not configured for online checkout", 400)

    amount = max(float(fc.amount or 0) - _extract_partial_paid(fc), 0)
    if amount <= 0:
        return error_response("No outstanding amount to pay")

    student = Student.query.get(fc.student_id)
    student_name = f"{student.first_name} {student.last_name}" if student else "Student"
    base_url = data.get("return_url", request.host_url.rstrip("/"))

    if provider == "esewa":
        result = EsewaGateway.initiate_payment(
            transaction_uuid=str(collection_id),
            amount=amount,
            success_url=f"{base_url}/api/v1/webhooks/esewa/callback",
            failure_url=f"{base_url}/api/v1/webhooks/esewa/callback",
        )
        return success_response({"provider": "esewa", **result})

    elif provider == "khalti":
        result = KhaltiGateway.initiate_payment(
            purchase_order_id=str(collection_id),
            purchase_order_name=f"School Fee — {student_name}",
            amount_paisa=int(amount * 100),
            return_url=f"{base_url}/api/v1/webhooks/khalti/callback",
            customer_info={"name": student_name},
        )
        if not result.get("success"):
            return error_response(result.get("error", "Khalti initiation failed"), 502)
        return success_response({"provider": "khalti", **result})

    return error_response(f"Unknown payment provider: {provider}", 400)


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
        # Only configured gateways support hosted checkout.
        if key not in {"esewa", "khalti"}:
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
            }
        )

    return methods


def _get_configured_payment_methods():
    school = _current_school()
    fee_config = dict(getattr(school, "fee_config", {}) or {})
    return _normalize_payment_methods(fee_config.get("payment_methods") or [])


def _coerce_fee_amount(value):
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


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

        collection = FeeCollection(
            school_id=structure.school_id,
            student_id=student.id,
            academic_year=structure.academic_year or student.academic_year or now_year,
            fee_item_name=item_name,
            amount=amount,
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
    paid_amount = _extract_partial_paid(collection) if collection else amount
    due_amount = max(total_amount - paid_amount, 0)
    paid_at = (
        receipt.created_at.strftime("%Y-%m-%d %I:%M %p") if receipt.created_at else "-"
    )
    hash_text = escape(receipt.verified_hash or "")

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
        <tr><td>{fee_type}</td><td>NPR {amount:,.2f}</td></tr>
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
