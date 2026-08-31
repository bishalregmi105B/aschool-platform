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
    # E185: the HR dashboard labels this "Monthly Payroll" — sum only the
    # current month's payroll rows (month is stored as "YYYY-MM"), not every
    # payroll row ever created for the school.
    from datetime import datetime as _dt

    current_month = _dt.utcnow().strftime("%Y-%m")
    monthly_payroll = (
        db.session.query(func.coalesce(func.sum(StaffPayroll.net_salary), 0))
        .filter(
            StaffPayroll.school_id == g.school_id,
            StaffPayroll.is_deleted.is_(False),
            StaffPayroll.month == current_month,
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
    # user_id/month/basic_salary are NOT NULL columns — validate up front so a
    # missing field gets a 400 instead of an unhandled IntegrityError (500).
    missing = [
        field
        for field in ("user_id", "month", "basic_salary")
        if not data.get(field)
    ]
    if missing:
        return error_response(
            f"Missing required field(s): {', '.join(missing)}", 400
        )
    # user_id is a NOT NULL FK to users.id — reject ids that don't belong to
    # this school with a 400 instead of an unhandled IntegrityError (500).
    import uuid as _uuid

    try:
        user_uuid = _uuid.UUID(str(data["user_id"]))
    except (ValueError, AttributeError, TypeError):
        return error_response("user_id must be a valid UUID", 400)
    staff_user = User.query.filter_by(
        id=user_uuid, school_id=g.school_id, is_deleted=False
    ).first()
    if not staff_user:
        return error_response("user_id does not match a user at this school", 400)
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

    # Server-side money math: when gross/net are not supplied explicitly,
    # derive them from the itemized components instead of storing nothing.
    if "gross_salary" not in data or "net_salary" not in data:
        gross, net = _compute_payroll_totals(
            payroll.basic_salary, payroll.allowances, payroll.deductions
        )
        if "gross_salary" not in data:
            payroll.gross_salary = gross
        if "net_salary" not in data:
            # Derive net from the gross that will actually be stored (an
            # explicit client gross wins over the component math) so the
            # stored pair always satisfies net = gross − Σdeductions — the
            # same formula the payslip fallback uses.
            stored_gross = (
                float(payroll.gross_salary)
                if payroll.gross_salary is not None
                else gross
            )
            payroll.net_salary = round(
                stored_gross - _sum_money(payroll.deductions), 2
            )

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

    # Default salary structure configured by the payroll settings page
    # (saved into school.settings.payroll via PUT /schools/<id>):
    #   settings.payroll = {
    #     "basicSalaryPercentage": 100, "taxRate": 1, "paymentDay": 1,
    #     "allowances": [{"name": "Transport", "percentage": 5} | {"amount": n}, ...],
    #     "deductions": [...same shapes...],
    #   }
    # The hr_payroll plugin's own per-school config (SchoolPlugin.config,
    # readable via app.plugins.config_store) overrides that block when it
    # carries a non-empty "payroll" section, so plugin-level settings win.
    from app.models.school import School

    from app.plugins.config_store import get_plugin_config

    school = School.query.get(g.school_id)
    payroll_settings = {}
    if school and isinstance(school.settings, dict):
        payroll_settings = school.settings.get("payroll") or {}
    plugin_cfg = get_plugin_config(str(g.school_id), "hr_payroll")
    if isinstance(plugin_cfg.get("payroll"), dict) and plugin_cfg["payroll"]:
        payroll_settings = plugin_cfg["payroll"]
    if not isinstance(payroll_settings, dict):
        payroll_settings = {}
    has_settings = bool(payroll_settings)
    default_basic = 0.0
    for key in ("defaultBasicSalary", "basicSalary", "default_basic_salary"):
        value = _setting_number(payroll_settings.get(key))
        if value and value > 0:
            default_basic = value
            break
    tax_rate = _setting_number(payroll_settings.get("taxRate")) or 0.0
    # basicSalaryPercentage (payroll settings page: "What percentage of Gross
    # Salary is considered Basic Salary"). Applied when a staff member's basic
    # is carried forward from their most recent payslip: the previous GROSS is
    # scaled by the percentage so lowering it (e.g. 100 -> 60, moving the rest
    # into configured allowances) re-derives basic instead of repeating last
    # month's basic. 100/absent keeps the plain carry-forward behavior.
    basic_pct = _setting_number(payroll_settings.get("basicSalaryPercentage"))

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

        # Zero-salary drafts remain the fallback when nothing is configured.
        basic = 0
        allowances = {}
        deductions = {}
        if has_settings:
            # Base for percentage components: an absolute default basic
            # salary from settings wins; otherwise carry the staff member's
            # most recent previous basic forward so percentages resolve to
            # real amounts instead of 0.
            base_basic = default_basic
            if base_basic <= 0:
                last_row = (
                    StaffPayroll.query.filter(
                        StaffPayroll.school_id == g.school_id,
                        StaffPayroll.user_id == user.id,
                        StaffPayroll.is_deleted.is_(False),
                        StaffPayroll.month < month,
                    )
                    .order_by(StaffPayroll.month.desc())
                    .first()
                )
                if last_row is not None:
                    if (
                        basic_pct is not None
                        and 0 < basic_pct < 100
                        and last_row.gross_salary is not None
                    ):
                        # Scale the previous gross down to the configured
                        # basic-salary percentage (see comment above).
                        base_basic = (
                            float(last_row.gross_salary) * basic_pct / 100.0
                        )
                    else:
                        base_basic = float(last_row.basic_salary or 0)
            basic = round(base_basic, 2)
            allowances = _components_from_settings(
                payroll_settings.get("allowances"), base_basic
            )
            deductions = _components_from_settings(
                payroll_settings.get("deductions"), base_basic
            )
            if tax_rate > 0 and base_basic > 0:
                deductions["Tax"] = round(base_basic * tax_rate / 100.0, 2)
        gross, net = _compute_payroll_totals(basic, allowances, deductions)

        payroll = StaffPayroll(
            school_id=g.school_id,
            user_id=user.id,
            month=month,
            basic_salary=basic,
            allowances=allowances,
            deductions=deductions,
            gross_salary=gross,
            net_salary=net,
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

    # If a money component changed but gross/net were not re-specified,
    # recompute so stored totals can never drift from
    # basic + Σallowances − Σdeductions. Unrelated updates (notes, status)
    # never touch stored amounts.
    components_touched = bool(
        {"basic_salary", "allowances", "deductions"} & set(data)
    )
    if components_touched and ("gross_salary" not in data or "net_salary" not in data):
        gross, net = _compute_payroll_totals(
            payroll.basic_salary, payroll.allowances, payroll.deductions
        )
        if "gross_salary" not in data:
            payroll.gross_salary = gross
        if "net_salary" not in data:
            # Same rule as create: net derives from the gross that will
            # actually be stored so the pair can never disagree with
            # net = gross − Σdeductions.
            stored_gross = (
                float(payroll.gross_salary)
                if payroll.gross_salary is not None
                else gross
            )
            payroll.net_salary = round(
                stored_gross - _sum_money(payroll.deductions), 2
            )

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

    # Build allowances / deductions tables (single shared money-math helper)
    allowances_data = payroll.allowances if isinstance(payroll.allowances, dict) else {}
    deductions_data = payroll.deductions if isinstance(payroll.deductions, dict) else {}

    total_allowances = _sum_money(allowances_data)
    total_deductions = _sum_money(deductions_data)

    computed_gross, _ = _compute_payroll_totals(basic, allowances_data, deductions_data)
    # Same semantics as _payroll_dict: a stored value (including an explicit
    # 0) always wins; only a missing one falls back to the component math.
    gross = (
        float(payroll.gross_salary)
        if payroll.gross_salary is not None
        else computed_gross
    )
    net = (
        float(payroll.net_salary)
        if payroll.net_salary is not None
        else round(gross - total_deductions, 2)
    )

    allowances_rows = "".join(
        f"<tr><td>{k}</td><td class='amount'>NPR {float(v):,.2f}</td></tr>"
        for k, v in allowances_data.items()
        if isinstance(v, (int, float)) and not isinstance(v, bool)
        or isinstance(v, str) and v.replace(".", "", 1).isdigit()
    ) or "<tr><td colspan='2'>—</td></tr>"

    deductions_rows = "".join(
        f"<tr><td>{k}</td><td class='amount'>NPR {float(v):,.2f}</td></tr>"
        for k, v in deductions_data.items()
        if isinstance(v, (int, float)) and not isinstance(v, bool)
        or isinstance(v, str) and v.replace(".", "", 1).isdigit()
    ) or "<tr><td colspan='2'>—</td></tr>"

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
  <div class='item'><div class='value'>NPR {gross:,.2f}</div><div class='label'>Gross Salary</div></div>
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
    # E123: the payroll page sends payment_method here — store it instead of
    # silently dropping it (the serializer exposes the column).
    if data.get("payment_method"):
        payroll.payment_method = data.get("payment_method")
    db.session.commit()
    return success_response(_payroll_dict(payroll))


@hr_payroll_bp.route("/payroll/bulk-action", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def bulk_payroll_action():
    """Bulk approve / mark-paid for one month's payroll rows.

    Body: {"action": "approve"|"mark_paid", "month": "YYYY-MM",
           "ids": ["<payroll-id>", ...]?}
    When ids is omitted or empty, every row of the month eligible for the
    action is targeted. Reuses the per-row handlers' rules: approve applies
    to draft rows only (a paid row is never regressed), mark_paid requires
    the approved status exactly like POST /payroll/<id>/pay.
    """
    from datetime import datetime

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    month = data.get("month")
    if action not in ("approve", "mark_paid"):
        return error_response("action must be 'approve' or 'mark_paid'", 400)
    if not month:
        return error_response("month is required", 400)

    requested_ids = data.get("ids") or []
    id_uuids = []
    if requested_ids:
        import uuid as _uuid

        if not isinstance(requested_ids, (list, tuple)):
            return error_response("ids must be a list of payroll UUIDs", 400)
        for raw_id in requested_ids:
            try:
                id_uuids.append(_uuid.UUID(str(raw_id)))
            except (ValueError, AttributeError, TypeError):
                return error_response(
                    "ids must be a list of valid payroll UUIDs", 400
                )

    query = StaffPayroll.query.filter_by(
        school_id=g.school_id, is_deleted=False, month=month
    )
    if id_uuids:
        query = query.filter(StaffPayroll.id.in_(id_uuids))
    # Status gate mirrors the per-row endpoints: approve targets draft rows,
    # mark_paid requires approved.
    query = query.filter(
        StaffPayroll.status == ("draft" if action == "approve" else "approved")
    )
    rows = query.all()

    claims = get_jwt()
    now = datetime.utcnow()
    updated_ids = []
    for payroll in rows:
        if action == "approve":
            payroll.status = "approved"
            payroll.approved_by_id = claims.get("sub")
        else:
            payroll.status = "paid"
            payroll.paid_at = now
            if data.get("payment_method"):
                payroll.payment_method = data.get("payment_method")
        updated_ids.append(str(payroll.id))

    db.session.commit()
    # Rows excluded by the status gate (or unknown ids) are reported as
    # skipped so the UI can explain partial results.
    skipped = max(len(requested_ids) - len(updated_ids), 0) if requested_ids else 0
    return success_response(
        {
            "action": action,
            "month": month,
            "updated": len(updated_ids),
            "skipped": skipped,
            "ids": updated_ids,
        }
    )


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
    # leave_type/start_date/end_date are NOT NULL columns — validate up front
    # so a missing field gets a 400 instead of an unhandled IntegrityError.
    missing = [
        field
        for field in ("leave_type", "start_date", "end_date")
        if not data.get(field)
    ]
    if missing:
        return error_response(
            f"Missing required field(s): {', '.join(missing)}", 400
        )
    # E185: the leave must target a user at THIS school (default: self).
    requested_user_id = data.get("user_id") or claims.get("sub")
    staff_user = _school_user_or_none(requested_user_id)
    if not staff_user:
        return error_response(
            "user_id does not match a user at this school", 400
        )
    leave = StaffLeave(
        school_id=g.school_id,
        user_id=staff_user.id,
    )
    for key in ("leave_type", "start_date", "end_date", "days", "reason"):
        if key in data:
            setattr(leave, key, data[key])
    # E185: date columns are NOT NULL dates — reject unparseable values.
    for field in ("start_date", "end_date"):
        parsed = _parse_date_value(getattr(leave, field, None) or data.get(field))
        if parsed is None:
            return error_response(f"{field} must be a valid ISO date", 400)
        setattr(leave, field, parsed)
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
    new_status = data.get("status", "approved")
    # E185: free-form statuses ("banana") polluted the pipeline — restrict to
    # the documented set.
    if new_status not in VALID_LEAVE_STATUSES:
        return error_response(
            "Invalid status. Must be one of: " + ", ".join(VALID_LEAVE_STATUSES),
            400,
        )
    leave.status = new_status
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
    new_status = data.get("status", leave.status)
    if new_status not in VALID_LEAVE_STATUSES:
        return error_response(
            "Invalid status. Must be one of: " + ", ".join(VALID_LEAVE_STATUSES),
            400,
        )
    leave.status = new_status
    leave.notes = data.get("notes", leave.notes)
    db.session.commit()
    return success_response(_leave_dict(leave))


@hr_payroll_bp.route("/leave-report", methods=["GET"])
@hr_payroll_bp.route("/leaves/report", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def leave_report():
    """Per-staff leave aggregates for a month or a whole year.

    Query params:
      year  (int, default current year) — the report period
      month (int 1-12, optional)        — restrict to a single month
      status (optional)                 — filter by leave status
      user_id (optional)                — a single staff member
      format=csv                        — download the aggregate as CSV

    Returns one row per staff member with days summed per leave type
    (JSON) or a CSV with one column per leave type present in the period.
    A leave is attributed to the month/year of its start_date; the row's
    own `days` value wins, otherwise days are computed inclusive of both
    endpooints.
    """
    from datetime import date as _date, timedelta as _timedelta

    year = request.args.get("year", type=int) or _date.today().year
    month = request.args.get("month", type=int)
    if month is not None and not 1 <= month <= 12:
        return error_response("month must be an integer between 1 and 12", 400)
    status = request.args.get("status")
    if status and status not in VALID_LEAVE_STATUSES:
        return error_response(
            "Invalid status. Must be one of: " + ", ".join(VALID_LEAVE_STATUSES),
            400,
        )

    query = StaffLeave.query.filter_by(school_id=g.school_id, is_deleted=False)
    if month:
        start_bound = _date(year, month, 1)
        if month == 12:
            end_bound = _date(year, 12, 31)
        else:
            end_bound = _date(year, month + 1, 1) - _timedelta(days=1)
    else:
        start_bound = _date(year, 1, 1)
        end_bound = _date(year, 12, 31)
    query = query.filter(
        StaffLeave.start_date >= start_bound,
        StaffLeave.start_date <= end_bound,
    )
    if status:
        query = query.filter_by(status=status)
    user_id = _parse_uuid_or_none(request.args.get("user_id"))
    if user_id is not None:
        query = query.filter_by(user_id=user_id)
    leaves = query.all()

    def _leave_days(leave):
        if leave.days:
            return int(leave.days)
        start = _parse_date_value(leave.start_date)
        end = _parse_date_value(leave.end_date)
        if start and end and end >= start:
            return (end - start).days + 1
        return 1

    by_staff: dict = {}
    leave_types: set = set()
    for leave in leaves:
        key = str(leave.user_id)
        entry = by_staff.setdefault(
            key,
            {
                "user_id": key,
                "staff_name": leave.user.full_name
                if getattr(leave, "user", None)
                else "Unknown Staff",
                "by_type": {},
                "total_days": 0,
                "requests": 0,
            },
        )
        leave_type = (leave.leave_type or "unknown").lower()
        leave_types.add(leave_type)
        bucket = entry["by_type"].setdefault(
            leave_type, {"days": 0, "requests": 0}
        )
        days = _leave_days(leave)
        bucket["days"] += days
        bucket["requests"] += 1
        entry["total_days"] += days
        entry["requests"] += 1

    staff_rows = sorted(by_staff.values(), key=lambda e: e["staff_name"] or "")

    if request.args.get("format") == "csv":
        import csv as _csv
        from io import StringIO

        buffer = StringIO()
        writer = _csv.writer(buffer)
        types = sorted(leave_types)
        writer.writerow(
            ["Staff Name", *[t.capitalize() for t in types], "Total Days", "Requests"]
        )
        for row in staff_rows:
            writer.writerow(
                [row["staff_name"]]
                + [row["by_type"].get(t, {}).get("days", 0) for t in types]
                + [row["total_days"], row["requests"]]
            )
        if not staff_rows:
            writer.writerow(["No leave records", *[0] * (len(types) + 2)])
        period = f"{year}-{month:02d}" if month else str(year)
        from flask import make_response

        response = make_response(buffer.getvalue())
        response.headers["Content-Type"] = "text/csv; charset=utf-8"
        response.headers["Content-Disposition"] = (
            f"attachment; filename=leave_report_{period}.csv"
        )
        return response

    return success_response(
        {
            "year": year,
            "month": month,
            "status": status,
            "leave_types": sorted(leave_types),
            "staff": staff_rows,
            "total_requests": len(leaves),
        }
    )


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
    if "staff_id" in data and "user_id" not in data:
        data["user_id"] = data.get("staff_id")
    # staff_appraisals.user_id is NOT NULL — validate up front so a missing
    # staff id gets a 400 instead of an unhandled IntegrityError (500).
    if not data.get("user_id"):
        return error_response("user_id (or staff_id) is required", 400)
    # E185: the appraisee must be a user of THIS school; a bad uuid or a
    # foreign-school user previously produced a 500 / cross-tenant row.
    staff_user = _school_user_or_none(data["user_id"])
    if not staff_user:
        return error_response("user_id (or staff_id) does not match a user at this school", 400)
    scores = data.get("scores") or {
        "teaching": data.get("teaching_score"),
        "attendance": data.get("attendance_score"),
        "teamwork": data.get("teamwork_score"),
    }
    if not isinstance(scores, dict):
        return error_response("scores must be an object", 400)
    try:
        numeric_scores = [
            float(value) for value in scores.values() if value is not None
        ]
    except (TypeError, ValueError):
        return error_response("scores must be numeric", 400)
    overall = data.get("overall_score")
    if overall is None and numeric_scores:
        overall = round(sum(numeric_scores) / len(numeric_scores), 1)
    appraisal = StaffAppraisal(
        school_id=g.school_id,
        reviewer_id=claims.get("sub"),
    )
    data["scores"] = scores
    data["overall_score"] = overall
    if "comments" in data and "strengths" not in data:
        data["strengths"] = data.get("comments")
    data["user_id"] = staff_user.id
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
    # E185: overall_score is Numeric(3,1) — reject non-numeric values with a
    # 400 instead of a DataError 500.
    if "overall_score" in data and data["overall_score"] is not None:
        try:
            data["overall_score"] = float(data["overall_score"])
        except (TypeError, ValueError):
            return error_response("overall_score must be a number", 400)
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

    # E185: amount must be a positive number, date a real date, and the
    # category must belong to THIS school (a bad uuid or foreign category
    # previously caused a 500 or a cross-tenant reference).
    try:
        amount = float(data["amount"])
    except (TypeError, ValueError):
        return error_response("amount must be a number", 400)
    if amount <= 0:
        return error_response("amount must be greater than zero", 400)
    expense_date = _parse_date_value(data["date"])
    if expense_date is None:
        return error_response("date must be a valid ISO date", 400)
    import uuid as _uuid

    try:
        category_uuid = _uuid.UUID(str(data["category_id"]))
    except (ValueError, AttributeError, TypeError):
        return error_response("category_id must be a valid UUID", 400)
    category = ExpenseCategory.query.filter_by(
        id=category_uuid, school_id=g.school_id, is_deleted=False
    ).first()
    if not category:
        return error_response("category_id does not match a category at this school", 400)

    expense = Expense(
        school_id=g.school_id,
        recorded_by_id=claims.get("sub"),
        title=data["title"],
        amount=amount,
        date=expense_date,
        category_id=category.id,
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
    # E185: mirror the create-side validation on updates so bad amounts,
    # dates or foreign categories cannot slip through PUT.
    if "amount" in data:
        try:
            amount = float(data["amount"])
        except (TypeError, ValueError):
            return error_response("amount must be a number", 400)
        if amount <= 0:
            return error_response("amount must be greater than zero", 400)
        data["amount"] = amount
    if "date" in data:
        parsed_date = _parse_date_value(data["date"])
        if parsed_date is None:
            return error_response("date must be a valid ISO date", 400)
        data["date"] = parsed_date
    if "category_id" in data:
        import uuid as _uuid

        try:
            category_uuid = _uuid.UUID(str(data["category_id"]))
        except (ValueError, AttributeError, TypeError):
            return error_response("category_id must be a valid UUID", 400)
        category = ExpenseCategory.query.filter_by(
            id=category_uuid, school_id=g.school_id, is_deleted=False
        ).first()
        if not category:
            return error_response("category_id does not match a category at this school", 400)
    for key in ("title", "amount", "date", "category_id", "notes", "receipt_url"):
        if key in data:
            setattr(expense, key, data[key])
    db.session.commit()
    return success_response(_expense_dict(expense))


# ── Serializers ────────────────────────────────────────────

VALID_LEAVE_STATUSES = ("pending", "approved", "rejected", "cancelled")


def _school_user_or_none(user_id):
    """E185: resolve a user id that must exist at THIS school (None if not).
    Bad uuids and foreign-school ids used to end as FK-violation 500s — or
    worse, as successful rows linking other schools' users."""
    import uuid as _uuid

    try:
        user_uuid = _uuid.UUID(str(user_id))
    except (ValueError, AttributeError, TypeError):
        return None
    return User.query.filter_by(
        id=user_uuid, school_id=g.school_id, is_deleted=False
    ).first()


def _parse_uuid_or_none(value):
    """UUID of a client-supplied id, or None when unparseable/absent."""
    import uuid as _uuid

    if value is None or value == "":
        return None
    try:
        return _uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def _parse_date_value(value):
    """Parse a client-supplied date/datetime; None when unparseable."""
    from datetime import date as _date, datetime as _dt

    if value is None or value == "":
        return None
    if isinstance(value, _dt):
        return value.date()
    if isinstance(value, _date):
        return value
    try:
        return _date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _setting_number(value):
    """Numeric value of a settings entry (None for non-numeric values)."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.replace(".", "", 1).isdigit():
        return float(value)
    return None


def _components_from_settings(entries, base_basic):
    """Flatten settings.payroll.allowances/deductions into {name: amount}.

    Shapes handled (the settings page saves {"name", "percentage"}; absolute
    amounts and legacy flat dicts are also accepted):
      [{"name": "Transport", "amount": 1500}]   -> {"Transport": 1500.0}
      [{"name": "Transport", "percentage": 5}]  -> {"Transport": base*5/100}
      {"Transport": 1500}                       -> {"Transport": 1500.0}
    Components resolving to <= 0 are dropped so percentage-only setups with
    no salary base fall back to the previous zero-component behavior.
    """
    components = {}
    if isinstance(entries, dict):
        pairs = [(str(name), value) for name, value in entries.items()]
    elif isinstance(entries, list):
        pairs = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("name") or "").strip()
            if not name:
                continue
            amount = _setting_number(entry.get("amount"))
            if amount is None:
                percentage = _setting_number(entry.get("percentage"))
                if percentage is not None:
                    amount = base_basic * percentage / 100.0
            pairs.append((name, amount))
    else:
        pairs = []
    for name, amount in pairs:
        value = _setting_number(amount)
        if not name or value is None:
            continue
        rounded = round(value, 2)
        if rounded > 0:
            components[name] = rounded
    return components


def _payroll_dict(p):
    computed_gross, _computed_net = _compute_payroll_totals(
        p.basic_salary, p.allowances, p.deductions
    )
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
        # E123: raw component dicts so the payroll page's component editor can
        # hydrate names/amounts (the summed numbers above are display-only).
        "allowance_items": dict(p.allowances)
        if isinstance(p.allowances, dict)
        else {},
        "deduction_items": dict(p.deductions)
        if isinstance(p.deductions, dict)
        else {},
        # Stored totals win; when a total was never stored, report the value
        # derived from the real records. Net is derived from the stored gross
        # (if one exists) so the reported pair always satisfies
        # net = gross − Σdeductions — identical to the payslip fallback.
        "gross_salary": round(float(p.gross_salary), 2)
        if p.gross_salary is not None
        else computed_gross,
        "net_salary": round(float(p.net_salary), 2)
        if p.net_salary is not None
        else round(
            (float(p.gross_salary) if p.gross_salary is not None else computed_gross)
            - _sum_money(p.deductions),
            2,
        ),
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


def _numeric_component(value):
    """Return the numeric amount of an itemized component value.

    Plain numbers and numeric strings (e.g. "1500") count; anything else
    (percent labels, booleans, None) contributes nothing — matching the
    payslip's own itemized-row filter.
    """
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value or 0)
    if isinstance(value, str) and value.replace(".", "", 1).isdigit():
        return float(value)
    return 0.0


def _sum_money(value):
    if isinstance(value, dict):
        return round(sum(_numeric_component(v) for v in value.values()), 2)
    return round(float(value or 0), 2)


def _compute_payroll_totals(basic_salary, allowances, deductions):
    """gross = basic + Σallowances ; net = gross − Σdeductions.

    Single source of truth for the payroll money math — used by
    create/update endpoints, the list serializer and the payslip fallback.
    """
    basic = float(basic_salary or 0)
    total_allowances = _sum_money(allowances)
    total_deductions = _sum_money(deductions)
    gross = round(basic + total_allowances, 2)
    net = round(gross - total_deductions, 2)
    return gross, net


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
