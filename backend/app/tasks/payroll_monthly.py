"""Monthly payroll processing — auto-generates payroll for all staff."""
from extensions import celery
import logging

logger = logging.getLogger(__name__)


@celery.task(name="payroll_monthly_process")
def process_monthly_payroll():
    """Run on 1st of each month: generate payroll records for all active staff.

    Only processes for schools with the 'hr_payroll' plugin active.
    """
    from extensions import db
    from app.models.plugin import SchoolPlugin
    from app.models.hr_payroll import Payroll, Staff
    from datetime import date, datetime

    today = date.today()
    month = today.month
    year = today.year

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="hr_payroll", active=True)
        .all()
    )

    for (school_id,) in active_schools:
        try:
            # Check if payroll already generated for this month
            existing = Payroll.query.filter_by(
                school_id=school_id,
                month=month,
                year=year,
            ).first()

            if existing:
                logger.info("Payroll already exists for school %s, %s/%s", school_id, month, year)
                continue

            # Get active staff
            staff_members = Staff.query.filter_by(
                school_id=school_id,
                is_deleted=False,
            ).all()

            for staff in staff_members:
                payroll = Payroll(
                    school_id=school_id,
                    staff_id=staff.id,
                    month=month,
                    year=year,
                    basic_salary=staff.basic_salary or 0,
                    status="pending",
                )
                db.session.add(payroll)

            db.session.commit()
            logger.info(
                "Generated payroll for %d staff in school %s",
                len(staff_members),
                school_id,
            )
        except Exception:
            db.session.rollback()
            logger.exception("Failed payroll for school %s", school_id)
