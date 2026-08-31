"""Monthly payroll processing — auto-generates draft payroll for all staff."""
from extensions import celery
from datetime import date
import logging

logger = logging.getLogger(__name__)


@celery.task(name="payroll_monthly_process")
def process_monthly_payroll():
    """Run on 1st of each month: generate draft payroll records for all active staff.

    Only processes for schools with the 'hr_payroll' plugin active.
    Mirrors the API's POST /hr/payroll/generate behavior (draft rows, salary 0
    until an admin fills in allowances/deductions).
    """
    from extensions import db
    from app.models.plugin import SchoolPlugin
    from app.models.hr_payroll import StaffPayroll
    from app.models.user import User

    today = date.today()
    month = today.strftime("%Y-%m")  # StaffPayroll.month is String(7) YYYY-MM

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="hr_payroll", active=True)
        .all()
    )

    for (school_id,) in active_schools:
        try:
            staff_members = User.query.filter(
                User.school_id == school_id,
                User.is_deleted.is_(False),
                User.is_active.is_(True),
                User.role.in_(("school_admin", "accountant", "teacher", "staff")),
            ).all()

            # Honor the school's payroll settings (same shape the API's
            # /hr/payroll/generate reads from school.settings.payroll) so cron
            # drafts are not stuck at zero salary. Per-staff carry-forward of a
            # prior month's basic is not done here (no request context) — the
            # API route still covers that richer path.
            from app.plugins.config_store import get_plugin_config
            from app.models.school import School

            school = School.query.get(school_id)
            payroll_settings = {}
            if school and isinstance(school.settings, dict):
                payroll_settings = school.settings.get("payroll") or {}
            if not isinstance(payroll_settings, dict):
                payroll_settings = {}
            plugin_cfg = get_plugin_config(school_id, "hr_payroll")
            if isinstance(plugin_cfg.get("payroll"), dict) and plugin_cfg["payroll"]:
                payroll_settings = plugin_cfg["payroll"]

            from app.api.v1.hr_payroll import (
                _components_from_settings,
                _compute_payroll_totals,
                _setting_number,
            )

            default_basic = 0.0
            for key in ("defaultBasicSalary", "basicSalary", "default_basic_salary"):
                value = _setting_number(payroll_settings.get(key))
                if value and value > 0:
                    default_basic = value
                    break
            tax_rate = _setting_number(payroll_settings.get("taxRate")) or 0.0
            basic = round(default_basic, 2)
            allowances = _components_from_settings(payroll_settings.get("allowances"), basic)
            deductions = _components_from_settings(payroll_settings.get("deductions"), basic)
            if tax_rate > 0 and basic > 0:
                deductions["Tax"] = round(basic * tax_rate / 100.0, 2)
            gross, net = _compute_payroll_totals(basic, allowances, deductions)

            created = 0
            for user in staff_members:
                exists = StaffPayroll.query.filter_by(
                    school_id=school_id,
                    user_id=user.id,
                    month=month,
                    is_deleted=False,
                ).first()
                if exists:
                    continue

                payroll = StaffPayroll(
                    school_id=school_id,
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
            logger.info(
                "Generated %d draft payroll records for school %s (%s)",
                created,
                school_id,
                month,
            )
        except Exception:
            db.session.rollback()
            logger.exception("Failed payroll for school %s", school_id)
