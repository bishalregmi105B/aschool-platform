"""HR & Payroll API — staff payroll, leave management, appraisals."""

from flask import Blueprint, g, request
from flask_jwt_extended import get_jwt, jwt_required
from sqlalchemy import func

from app.models.hr_payroll import (
    Expense,
    ExpenseCategory,
    StaffAppraisal,
    StaffLeave,
    StaffPayroll,
)
from app.models.user import User
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

hr_payroll_bp = Blueprint("hr_payroll", __name__, url_prefix="/hr")


@hr_payroll_bp.route("/stats", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def hr_stats():
    total_staff = User.query.filter(
        User.school_id == g.school_id,
        User.is_deleted.is_(False),
        User.is_active.is_(True),
        User.role.in_(("school_admin", "accountant", "teacher", "staff")),
    ).count()
    pending_leaves = StaffLeave.query.filter_by(
        school_id=g.school_id,
        is_deleted=False,
        status="pending",
    ).count()
    pending_payroll = StaffPayroll.query.filter(
        StaffPayroll.school_id == g.school_id,
        StaffPayroll.is_deleted.is_(False),
        StaffPayroll.status.in_(("draft", "approved")),
    ).count()
    avg_rating = (
        db.session.query(func.avg(StaffAppraisal.overall_score))
        .filter(
            StaffAppraisal.school_id == g.school_id,
            StaffAppraisal.is_deleted.is_(False),
        )
        .scalar()
    )
    monthly_payroll = (
        db.session.query(func.coalesce(func.sum(StaffPayroll.net_salary), 0))
        .filter(
            StaffPayroll.school_id == g.school_id,
            StaffPayroll.is_deleted.is_(False),
        )
        .scalar()
    )
    return success_response(
        {
            "total_staff": total_staff,
            "pending_leaves": pending_leaves,
            "pending_payroll": pending_payroll,
            "avg_rating": round(float(avg_rating), 1)
            if avg_rating is not None
            else None,
            "monthly_payroll": float(monthly_payroll or 0),
        }
    )


# ── Payroll ────────────────────────────────────────────────


@hr_payroll_bp.route("/payroll", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def list_payroll():
    query = StaffPayroll.query.filter_by(school_id=g.school_id, is_deleted=False)
    month = request.args.get("month")
    if month:
        query = query.filter_by(month=month)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    items, meta = paginate(query.order_by(StaffPayroll.month.desc()))
    return success_response(
        [_payroll_dict(p) for p in items], meta={"pagination": meta}
    )


@hr_payroll_bp.route("/payroll", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def create_payroll():
    data = request.get_json(silent=True) or {}
    payroll = StaffPayroll(school_id=g.school_id)
    for key in (
        "user_id",
        "month",
        "basic_salary",
        "allowances",
        "deductions",
        "gross_salary",
        "net_salary",
        "payment_method",
        "notes",
    ):
        if key in data:
            setattr(payroll, key, data[key])
    db.session.add(payroll)
    db.session.commit()
    return created_response(_payroll_dict(payroll))


@hr_payroll_bp.route("/payroll/generate", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def generate_payroll():
    data = request.get_json(silent=True) or {}
    month = data.get("month")
    if not month:
        return error_response("month is required")

    staff_members = User.query.filter(
        User.school_id == g.school_id,
        User.is_deleted.is_(False),
        User.is_active.is_(True),
        User.role.in_(("school_admin", "accountant", "teacher", "staff")),
    ).all()

    created = 0
    for user in staff_members:
        exists = StaffPayroll.query.filter_by(
            school_id=g.school_id,
            user_id=user.id,
            month=month,
            is_deleted=False,
        ).first()
        if exists:
            continue

        payroll = StaffPayroll(
            school_id=g.school_id,
            user_id=user.id,
            month=month,
            basic_salary=0,
            allowances={},
            deductions={},
            gross_salary=0,
            net_salary=0,
            status="draft",
        )
        db.session.add(payroll)
        created += 1

    db.session.commit()
    return success_response({"created": created, "month": month})


@hr_payroll_bp.route("/payroll/<uuid:payroll_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def update_payroll(payroll_id):
    payroll = StaffPayroll.query.filter_by(
        id=payroll_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not payroll:
        return error_response("Payroll record not found", 404)
    data = request.get_json(silent=True) or {}
    for key in (
        "basic_salary",
        "allowances",
        "deductions",
        "gross_salary",
        "net_salary",
        "payment_method",
        "notes",
        "status",
    ):
        if key in data:
            setattr(payroll, key, data[key])
    db.session.commit()
    return success_response(_payroll_dict(payroll))


@hr_payroll_bp.route("/payroll/<uuid:payroll_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def approve_payroll(payroll_id):
    payroll = StaffPayroll.query.filter_by(
        id=payroll_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not payroll:
        return error_response("Payroll record not found", 404)
    claims = get_jwt()
    payroll.status = "approved"
    payroll.approved_by_id = claims.get("sub")
    db.session.commit()
    return success_response(_payroll_dict(payroll))


@hr_payroll_bp.route("/payroll/<uuid:payroll_id>/payslip", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
def download_payslip(payroll_id):
    """Generate and download a payslip PDF for a staff member."""
    from io import BytesIO

    from flask import send_file

    payroll = StaffPayroll.query.filter_by(
        id=payroll_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not payroll:
        return error_response("Payroll record not found", 404)

    # Fetch staff info
    staff_user = User.query.get(payroll.user_id) if payroll.user_id else None
    staff_name = staff_user.full_name if staff_user else "Staff Member"
    designation = staff_user.role.replace("_", " ").title() if staff_user else ""

    from app.models.school import School

    school = School.query.get(g.school_id)
    school_name = school.name if school else "ASchool"

    basic = float(payroll.basic_salary or 0)
    gross = float(payroll.gross_salary or basic)
    net = float(payroll.net_salary or basic)

    # Build allowances / deductions tables
    allowances_data = payroll.allowances if isinstance(payroll.allowances, dict) else {}
    deductions_data = payroll.deductions if isinstance(payroll.deductions, dict) else {}

    total_allowances = sum(
        float(v) for v in allowances_data.values() if isinstance(v, (int, float))
    )
    total_deductions = sum(
        float(v) for v in deductions_data.values() if isinstance(v, (int, float))
    )

    allowances_rows = (
        "".join(
            f"<tr><td>{k}</td><td class='amount'>NPR {float(v):,.2f}</td></tr>"
            for k, v in allowances_data.items()
            if isinstance(v, (int, float))
        )
        or "<tr><td colspan='2'>—</td></tr>"
    )

    deductions_rows = (
        "".join(
            f"<tr><td>{k}</td><td class='amount'>NPR {float(v):,.2f}</td></tr>"
            for k, v in deductions_data.items()
            if isinstance(v, (int, float))
        )
        or "<tr><td colspan='2'>—</td></tr>"
    )

    html = f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'>
<style>
@page {{ size: A4; margin: 15mm; }}
body {{ font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; }}
.header {{ text-align: center; border-bottom: 2px solid #22577A; padding-bottom: 10px; margin-bottom: 16px; }}
.header h1 {{ font-size: 18px; margin: 0; color: #22577A; }}
.header h2 {{ font-size: 13px; margin: 4px 0 0; color: #555; }}
.meta {{ display: flex; justify-content: space-between; margin: 10px 0; background: #f0f4f8; padding: 8px 12px; border-radius: 4px; }}
.meta div {{ font-size: 11px; }}
.meta strong {{ display: block; font-size: 12px; margin-bottom: 2px; }}
.tables {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 14px 0; }}
table {{ width: 100%; border-collapse: collapse; }}
th {{ background: #22577A; color: white; padding: 6px 8px; font-size: 11px; text-align: left; }}
td {{ padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }}
td.amount {{ text-align: right; font-family: monospace; }}
.summary {{ background: #f0f4f8; border: 2px solid #22577A; border-radius: 6px; padding: 12px 16px; margin: 16px 0; display: flex; justify-content: space-between; }}
.summary .item {{ text-align: center; }}
.summary .value {{ font-size: 16px; font-weight: bold; color: #22577A; }}
.summary .label {{ font-size: 10px; color: #666; }}
.footer {{ margin-top: 30px; display: flex; justify-content: space-between; padding-top: 10px; }}
.sig {{ border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 10px; width: 160px; }}
.status-badge {{ display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 10px; font-weight: bold;
  background: {"#dcfce7" if payroll.status == "paid" else "#fef3c7"};
  color: {"#166534" if payroll.status == "paid" else "#92400e"}; }}
</style></head><body>
<div class='header'>
  <h1>{school_name}</h1>
  <h2>Payslip — {payroll.month or "N/A"}</h2>
</div>
<div class='meta'>
  <div><strong>{staff_name}</strong>{designation}</div>
  <div><strong>Employee ID</strong>{str(staff_user.id)[:8].upper() if staff_user else "N/A"}</div>
  <div><strong>Month</strong>{payroll.month or "—"}</div>
  <div><strong>Status</strong><span class='status-badge'>{(payroll.status or "draft").upper()}</span></div>
</div>
<div class='summary'>
  <div class='item'><div class='value'>NPR {basic:,.2f}</div><div class='label'>Basic Salary</div></div>
  <div class='item'><div class='value'>NPR {total_allowances:,.2f}</div><div class='label'>Total Allowances</div></div>
  <div class='item'><div class='value'>NPR {total_deductions:,.2f}</div><div class='label'>Total Deductions</div></div>
  <div class='item'><div class='value' style='color:#166534'>NPR {net:,.2f}</div><div class='label'>Net Pay</div></div>
</div>
<div class='tables'>
  <table>
    <thead><tr><th colspan='2'>Allowances</th></tr></thead>
    <tbody>{allowances_rows}<tr><td><strong>Total</strong></td><td class='amount'><strong>NPR {total_allowances:,.2f}</strong></td></tr></tbody>
  </table>
  <table>
    <thead><tr><th colspan='2'>Deductions</th></tr></thead>
    <tbody>{deductions_rows}<tr><td><strong>Total</strong></td><td class='amount'><strong>NPR {total_deductions:,.2f}</strong></td></tr></tbody>
  </table>
</div>
<div class='footer'>
  <div class='sig'>Employee Signature</div>
  <div class='sig'>Accountant</div>
  <div class='sig'>Principal / HR Head</div>
</div>
</body></html>"""

    try:
        from weasyprint import HTML

        pdf_bytes = HTML(string=html).write_pdf()
    except ImportError:
        return error_response("PDF export unavailable on this server", 501)
    except Exception as exc:
        return error_response(f"PDF generation failed: {exc}", 500)

    buffer = BytesIO(pdf_bytes)
    buffer.seek(0)
    filename = f"payslip_{staff_name.replace(' ', '_')}_{payroll.month or 'month'}.pdf"
    return send_file(
        buffer, mimetype="application/pdf", as_attachment=True, download_name=filename
    )


@hr_payroll_bp.route("/payroll/<uuid:payroll_id>/pay", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def mark_paid(payroll_id):
    from datetime import datetime

    payroll = StaffPayroll.query.filter_by(
        id=payroll_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not payroll:
        return error_response("Payroll record not found", 404)
    if payroll.status != "approved":
        return error_response("Payroll must be approved before marking as paid")
    data = request.get_json(silent=True) or {}
    payroll.status = "paid"
    payroll.paid_at = datetime.utcnow()
    payroll.bank_ref = data.get("bank_ref")
    db.session.commit()
    return success_response(_payroll_dict(payroll))


# ── Leave Management ──────────────────────────────────────


@hr_payroll_bp.route("/leave", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
def list_leave():
    query = StaffLeave.query.filter_by(school_id=g.school_id, is_deleted=False)
    user_id = request.args.get("user_id")
    if user_id:
        query = query.filter_by(user_id=user_id)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    items, meta = paginate(query.order_by(StaffLeave.start_date.desc()))
    return success_response([_leave_dict(l) for l in items], meta={"pagination": meta})


@hr_payroll_bp.route("/leaves", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
def list_leave_plural():
    return list_leave()


@hr_payroll_bp.route("/leave", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
def apply_leave():
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    leave = StaffLeave(
        school_id=g.school_id,
        user_id=data.get("user_id") or claims.get("sub"),
    )
    for key in ("leave_type", "start_date", "end_date", "days", "reason"):
        if key in data:
            setattr(leave, key, data[key])
    db.session.add(leave)
    db.session.commit()
    return created_response(_leave_dict(leave))


@hr_payroll_bp.route("/leave/<uuid:leave_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def approve_leave(leave_id):
    from datetime import datetime

    leave = StaffLeave.query.filter_by(
        id=leave_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not leave:
        return error_response("Leave request not found", 404)
    claims = get_jwt()
    data = request.get_json(silent=True) or {}
    leave.status = data.get("status", "approved")
    leave.approved_by_id = claims.get("sub")
    leave.approved_at = datetime.utcnow()
    leave.notes = data.get("notes", leave.notes)
    db.session.commit()
    return success_response(_leave_dict(leave))


@hr_payroll_bp.route("/leaves/<uuid:leave_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def update_leave_status(leave_id):
    leave = StaffLeave.query.filter_by(
        id=leave_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not leave:
        return error_response("Leave request not found", 404)

    data = request.get_json(silent=True) or {}
    leave.status = data.get("status", leave.status)
    leave.notes = data.get("notes", leave.notes)
    db.session.commit()
    return success_response(_leave_dict(leave))


# ── Appraisals ─────────────────────────────────────────────


@hr_payroll_bp.route("/appraisals", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def list_appraisals():
    query = StaffAppraisal.query.filter_by(school_id=g.school_id, is_deleted=False)
    user_id = request.args.get("user_id")
    if user_id:
        query = query.filter_by(user_id=user_id)
    items, meta = paginate(query.order_by(StaffAppraisal.created_at.desc()))
    return success_response(
        [_appraisal_dict(a) for a in items], meta={"pagination": meta}
    )


@hr_payroll_bp.route("/appraisals", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def create_appraisal():
    data = request.get_json(silent=True) or {}
    claims = get_jwt()
    scores = data.get("scores") or {
        "teaching": data.get("teaching_score"),
        "attendance": data.get("attendance_score"),
        "teamwork": data.get("teamwork_score"),
    }
    numeric_scores = [float(value) for value in scores.values() if value is not None]
    overall = data.get("overall_score")
    if overall is None and numeric_scores:
        overall = round(sum(numeric_scores) / len(numeric_scores), 1)
    appraisal = StaffAppraisal(
        school_id=g.school_id,
        reviewer_id=claims.get("sub"),
    )
    if "staff_id" in data and "user_id" not in data:
        data["user_id"] = data.get("staff_id")
    data["scores"] = scores
    data["overall_score"] = overall
    if "comments" in data and "strengths" not in data:
        data["strengths"] = data.get("comments")
    for key in (
        "user_id",
        "period",
        "scores",
        "overall_score",
        "strengths",
        "areas_for_improvement",
        "goals",
    ):
        if key in data:
            setattr(appraisal, key, data[key])
    db.session.add(appraisal)
    db.session.commit()
    return created_response(_appraisal_dict(appraisal))


@hr_payroll_bp.route("/appraisals/<uuid:appraisal_id>", methods=["PUT"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def update_appraisal(appraisal_id):
    appraisal = StaffAppraisal.query.filter_by(
        id=appraisal_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not appraisal:
        return error_response("Appraisal not found", 404)
    data = request.get_json(silent=True) or {}
    for key in (
        "scores",
        "overall_score",
        "strengths",
        "areas_for_improvement",
        "goals",
        "status",
    ):
        if key in data:
            setattr(appraisal, key, data[key])
    db.session.commit()
    return success_response(_appraisal_dict(appraisal))


# ── Expenses ───────────────────────────────────────────────


@hr_payroll_bp.route("/expense-categories", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def list_expense_categories():
    categories = (
        ExpenseCategory.query.filter_by(school_id=g.school_id, is_deleted=False)
        .order_by(ExpenseCategory.name.asc())
        .all()
    )
    return success_response(
        [
            {"id": str(c.id), "name": c.name, "description": c.description}
            for c in categories
        ]
    )


@hr_payroll_bp.route("/expense-categories", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def create_expense_category():
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return error_response("Name is required")
    cat = ExpenseCategory(
        school_id=g.school_id, name=data["name"], description=data.get("description")
    )
    db.session.add(cat)
    db.session.commit()
    return created_response(
        {"id": str(cat.id), "name": cat.name, "description": cat.description}
    )


@hr_payroll_bp.route("/expense-categories/<uuid:cat_id>", methods=["PUT", "DELETE"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def update_expense_category(cat_id):
    cat = ExpenseCategory.query.filter_by(
        id=cat_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not cat:
        return error_response("Category not found", 404)

    if request.method == "DELETE":
        cat.is_deleted = True
        db.session.commit()
        return success_response({"id": str(cat.id)})

    data = request.get_json(silent=True) or {}
    if "name" in data:
        cat.name = data["name"]
    if "description" in data:
        cat.description = data["description"]
    db.session.commit()
    return success_response(
        {"id": str(cat.id), "name": cat.name, "description": cat.description}
    )


@hr_payroll_bp.route("/expenses", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def list_expenses():
    query = Expense.query.filter_by(school_id=g.school_id, is_deleted=False)

    category_id = request.args.get("category_id")
    if category_id:
        query = query.filter_by(category_id=category_id)

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    if start_date:
        query = query.filter(Expense.date >= start_date)
    if end_date:
        query = query.filter(Expense.date <= end_date)

    items, meta = paginate(query.order_by(Expense.date.desc()))
    return success_response(
        [_expense_dict(e) for e in items], meta={"pagination": meta}
    )


@hr_payroll_bp.route("/expenses", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def create_expense():
    data = request.get_json(silent=True) or {}
    claims = get_jwt()

    if (
        not data.get("title")
        or not data.get("amount")
        or not data.get("date")
        or not data.get("category_id")
    ):
        return error_response("title, amount, date, and category_id are required")

    expense = Expense(
        school_id=g.school_id,
        recorded_by_id=claims.get("sub"),
        title=data["title"],
        amount=data["amount"],
        date=data["date"],
        category_id=data["category_id"],
        notes=data.get("notes"),
        receipt_url=data.get("receipt_url"),
    )
    db.session.add(expense)
    db.session.commit()
    return created_response(_expense_dict(expense))


@hr_payroll_bp.route("/expenses/<uuid:expense_id>", methods=["PUT", "DELETE"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def update_expense(expense_id):
    expense = Expense.query.filter_by(
        id=expense_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not expense:
        return error_response("Expense not found", 404)

    if request.method == "DELETE":
        expense.is_deleted = True
        db.session.commit()
        return success_response({"id": str(expense.id)})

    data = request.get_json(silent=True) or {}
    for key in ("title", "amount", "date", "category_id", "notes", "receipt_url"):
        if key in data:
            setattr(expense, key, data[key])
    db.session.commit()
    return success_response(_expense_dict(expense))


# ── Serializers ────────────────────────────────────────────


def _payroll_dict(p):
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "staff_name": p.user.full_name if getattr(p, "user", None) else None,
        "month": p.month,
        "basic_salary": float(p.basic_salary) if p.basic_salary else None,
        "allowances": _sum_money(p.allowances),
        "allowances_total": _sum_money(p.allowances),
        "deductions": _sum_money(p.deductions),
        "deductions_total": _sum_money(p.deductions),
        "gross_salary": float(p.gross_salary) if p.gross_salary else None,
        "net_salary": float(p.net_salary) if p.net_salary else None,
        "status": p.status,
        "paid_at": str(p.paid_at) if p.paid_at else None,
        "payment_method": p.payment_method,
        "bank_ref": p.bank_ref,
        "department": None,
    }


def _leave_dict(l):
    return {
        "id": str(l.id),
        "user_id": str(l.user_id),
        "staff_name": l.user.full_name if getattr(l, "user", None) else None,
        "leave_type": l.leave_type,
        "start_date": str(l.start_date) if l.start_date else None,
        "end_date": str(l.end_date) if l.end_date else None,
        "from_date": str(l.start_date) if l.start_date else None,
        "to_date": str(l.end_date) if l.end_date else None,
        "days": l.days,
        "reason": l.reason,
        "status": l.status,
        "approved_by_id": str(l.approved_by_id) if l.approved_by_id else None,
        "approved_at": str(l.approved_at) if l.approved_at else None,
    }


def _appraisal_dict(a):
    return {
        "id": str(a.id),
        "user_id": str(a.user_id),
        "staff_name": a.user.full_name if getattr(a, "user", None) else None,
        "period": a.period,
        "reviewer_id": str(a.reviewer_id) if a.reviewer_id else None,
        "scores": a.scores,
        "overall_score": float(a.overall_score) if a.overall_score else None,
        "strengths": a.strengths,
        "areas_for_improvement": a.areas_for_improvement,
        "goals": a.goals,
        "status": a.status,
        "teaching_score": int((a.scores or {}).get("teaching") or 0),
        "attendance_score": int((a.scores or {}).get("attendance") or 0),
        "teamwork_score": int((a.scores or {}).get("teamwork") or 0),
        "comments": a.strengths,
    }


def _sum_money(value):
    if isinstance(value, dict):
        return round(sum(float(v or 0) for v in value.values()), 2)
    return round(float(value or 0), 2)


def _expense_dict(e):
    return {
        "id": str(e.id),
        "category_id": str(e.category_id),
        "category_name": e.category.name if e.category else None,
        "title": e.title,
        "amount": float(e.amount),
        "date": str(e.date),
        "recorded_by_id": str(e.recorded_by_id) if e.recorded_by_id else None,
        "recorded_by_name": e.recorded_by.full_name if e.recorded_by else None,
        "receipt_url": e.receipt_url,
        "notes": e.notes,
        "created_at": str(e.created_at) if e.created_at else None,
    }
