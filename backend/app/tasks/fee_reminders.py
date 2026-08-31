"""Fee reminder tasks — reminders, auto-generation, monthly reports."""
import logging
from datetime import datetime, timezone

from extensions import celery
from app.utils.tenant_url import school_site_domain

logger = logging.getLogger(__name__)


# ── Unified BS billing-cycle helpers (shared with app/api/v1/fees.py) ─────
#
# Manual billing (/fees/structures apply, /fees/batch-monthly) and the
# auto_generate_monthly_fees cron used to disagree twice over: the API keyed
# cycles by the GREGORIAN calendar while the cron keyed them by Bikram Sambat
# month, and each wrote a different notes marker ([fee_structure:id:YYYY-MM]
# vs [auto_monthly:id:BS-month:item]) — so the same BS month could be billed
# twice (once by cron, once by an admin clicking batch-billing). Both paths
# now go through the helpers below: one BS cycle key + one marker format.


def bs_cycle_key(frequency: str, academic_year=None, on_date=None) -> str:
    """BS-calendar cycle key for one billing period.

    `on_date` lets callers generate for a historical BS month (simulation,
    backfill); it defaults to today's BS date.
    """
    import nepali_datetime

    today_bs = on_date or nepali_datetime.date.today()
    frequency = str(frequency or "monthly").strip().lower()
    if frequency == "monthly":
        return f"{today_bs.year}-{today_bs.month:02d}"
    if frequency == "quarterly":
        return f"{today_bs.year}-Q{((today_bs.month - 1) // 3) + 1}"
    if frequency == "semi-annual":
        return f"{today_bs.year}-H{1 if today_bs.month <= 6 else 2}"
    if frequency == "annual":
        return str(academic_year or today_bs.year)
    return "one-time"


def is_bs_month_key(cycle_key: str) -> bool:
    """True when the cycle key is a BS 'YYYY-MM' month key."""
    parts = str(cycle_key or "").split("-")
    return (
        len(parts) == 2
        and len(parts[0]) == 4
        and len(parts[1]) == 2
        and parts[0].isdigit()
        and parts[1].isdigit()
    )


def structure_cycle_marker(structure_id, cycle_key: str, item_name=None) -> str:
    """Idempotency marker written into FeeCollection.notes by BOTH the manual
    API path and the cron. Per-item so multi-item structures dedupe correctly."""
    base = f"[fee_structure:{structure_id}:{cycle_key}]"
    if item_name:
        return f"[fee_structure:{structure_id}:{cycle_key}:{item_name}]"
    return base


def legacy_auto_monthly_marker(structure_id, month_bs: str, item_name: str) -> str:
    """Pre-unification cron marker — still HONORED when de-duplicating so
    months billed by the old cron version are never billed again."""
    return f"[auto_monthly:{structure_id}:{month_bs}:{item_name}]"


def compose_fee_reminder_message(student_name: str, pending_amount: float, period: str) -> str:
    """The one reminder SMS text — shared by the daily cron and the
    per-student remind endpoint."""
    return (
        f"Fee Reminder: Rs.{pending_amount:.2f} pending for "
        f"{student_name} ({period}). "
        f"Pay via eSewa/Khalti at {school_site_domain()}"
    )


def send_single_fee_reminder(school_id: str, student_id: str) -> dict:
    """Send ONE fee-reminder SMS to a student's primary guardian.

    Used by POST /fees/defaulters/<student_id>/remind. Reuses the cron's
    composition and the same per-school kill-switch. Returns:
      {"ok": True, "sent": True, "phone": ..., "amount": ...}
    or  {"ok": False, "reason": "student_not_found" | "reminders_disabled"
         | "no_outstanding" | "no_guardian_phone"}
    """
    from app.models.fee import FeeCollection
    from app.models.student import Guardian, Student
    from app.plugins.config_store import plugin_config_value

    student = Student.query.filter_by(
        id=student_id, school_id=school_id, is_deleted=False
    ).first()
    if not student:
        return {"ok": False, "reason": "student_not_found"}

    # Same kill-switch the daily cron honors.
    if not plugin_config_value(school_id, "fees", "reminder_enabled", True):
        return {"ok": False, "reason": "reminders_disabled"}

    collections = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.student_id == student_id,
        FeeCollection.payment_status.in_(("pending", "partial")),
        FeeCollection.is_deleted.is_(False),
    ).all()

    pending_amount = 0.0
    periods = []
    for fee in collections:
        # Net payable (base + fine − discount) — the E180 rule.
        payable = _fee_payable_total(fee)
        due = max(payable - _fee_paid_amount(fee, payable), 0)
        if due > 0:
            pending_amount += due
            period = " ".join(part for part in (fee.month_bs, fee.year_bs) if part)
            if period:
                periods.append(period)
    pending_amount = round(pending_amount, 2)
    if pending_amount <= 0:
        return {"ok": False, "reason": "no_outstanding"}

    guardian = Guardian.query.filter_by(student_id=student_id, is_primary=True).first()
    phone = guardian.phone if guardian else None
    if not phone:
        return {"ok": False, "reason": "no_guardian_phone"}

    if len(periods) == 1:
        period_label = periods[0]
    elif periods:
        period_label = f"{len(periods)} billing periods"
    else:
        period_label = "your billing period"

    student_name = f"{student.first_name or ''} {student.last_name or ''}".strip()
    message = compose_fee_reminder_message(student_name, pending_amount, period_label)

    from app.tasks.sms_sender import send_sms

    send_sms.delay(phone, message, str(school_id))
    return {
        "ok": True,
        "sent": True,
        "phone": phone,
        "amount": pending_amount,
        "message": message,
    }


@celery.task(name="dispatch_fee_reminders", queue="default")
def dispatch_fee_reminders():
    """Fan out fee reminders for every active school."""
    from app.models.school import School

    school_ids = (
        School.query.filter_by(is_active=True, is_deleted=False)
        .with_entities(School.id)
        .all()
    )

    for (school_id,) in school_ids:
        send_fee_reminders.delay(str(school_id))

    return {"queued": len(school_ids)}


@celery.task(name="send_fee_reminders", queue="default")
def send_fee_reminders(school_id: str):
    """Send fee reminders for overdue payments."""
    from app.models.fee import FeeCollection
    from app.models.student import Student, Guardian
    from app.tasks.sms_sender import send_sms
    from datetime import datetime, timedelta, timezone

    # Plugin config (config_schema.yaml): reminder_enabled kill-switch +
    # reminder_overdue_days (replaces the old hardcoded 30-day cutoff;
    # nonsense values fall back to 30).
    from app.plugins.config_store import plugin_config_value

    if not plugin_config_value(school_id, "fees", "reminder_enabled", True):
        return {"skipped": "reminders disabled in plugin settings"}
    try:
        overdue_days = int(
            plugin_config_value(school_id, "fees", "reminder_overdue_days", 30) or 30
        )
    except (TypeError, ValueError):
        overdue_days = 30
    if overdue_days < 1:
        overdue_days = 30

    cutoff = datetime.now(timezone.utc) - timedelta(days=overdue_days)
    overdue = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.payment_status.in_(("pending", "partial")),
        FeeCollection.created_at < cutoff,
        FeeCollection.is_deleted.is_(False),
    ).all()

    for fee in overdue:
        student = Student.query.get(fee.student_id)
        if not student:
            continue
        # E180: pending must be computed on the net payable
        # (base + late fine − discount), not the raw base — reminders for
        # discounted students used to demand money they do not owe.
        payable = _fee_payable_total(fee)
        pending_amount = max(payable - _fee_paid_amount(fee, payable), 0)
        if pending_amount <= 0:
            continue
        period = " ".join(part for part in (fee.month_bs, fee.year_bs) if part) or "your billing period"
        guardian = Guardian.query.filter_by(student_id=student.id, is_primary=True).first()
        if guardian and guardian.phone:
            msg = compose_fee_reminder_message(
                f"{student.first_name or ''} {student.last_name or ''}".strip()
                or "Student",
                pending_amount,
                period,
            )
            send_sms.delay(guardian.phone, msg, school_id)

        # Push notification to parent/guardian via OneSignal
        try:
            from app.models.user import User
            from app.tasks.push_notifications import send_push_notification

            parent_user = None
            if guardian and guardian.user_id:
                parent_user = User.query.filter_by(
                    id=guardian.user_id, is_deleted=False
                ).first()
            if not parent_user and student.user_id:
                parent_user = User.query.filter_by(
                    id=student.user_id, is_deleted=False
                ).first()

            if parent_user:
                push_title = "Fee Reminder"
                push_body = (
                    f"Rs.{pending_amount:,.0f} pending for "
                    f"{student.first_name} ({period})."
                )
                for pid in (parent_user.onesignal_player_ids or []):
                    send_push_notification.delay(
                        player_id=pid,
                        title=push_title,
                        body=push_body,
                        data={
                            "type": "fee_reminder",
                            "student_id": str(student.id),
                            "fee_id": str(fee.id),
                        },
                    )
        except Exception as _e:
            logger.warning("Fee reminder push failed for student %s: %s", student.id, _e)


def _fee_payable_total(collection) -> float:
    """E180: net payable = base + late fine − discount, floored at 0 — the
    same rule the /fees API uses for dues, summaries and reminders."""
    base = float(collection.amount or 0)
    fine = float(collection.late_fine_amount or 0)
    discount = float(collection.discount_amount or 0)
    return round(max(base + fine - discount, 0.0), 2)


def _fee_paid_amount(collection, payable_total=None) -> float:
    """Amount already paid against this collection.

    `payable_total` may be passed by callers who have already computed the
    net payable; a fully-paid collection returns that (not the raw base)."""
    if collection.payment_status == "paid":
        if payable_total is not None:
            return float(payable_total)
        return _fee_payable_total(collection)

    notes = collection.notes or ""
    marker = "[partial_paid:"
    if marker not in notes:
        return 0

    try:
        return float(notes.split(marker, 1)[1].split("]", 1)[0])
    except (IndexError, TypeError, ValueError):
        return 0


@celery.task(name="generate_monthly_fee_report", queue="default")
def generate_monthly_fee_report(school_id: str, month: int, year: int):
    """Generate monthly fee collection report with summary statistics."""
    from app.models.fee import FeeCollection
    from app.models.student import Student
    from app.models.academic import Class
    from extensions import db
    from sqlalchemy import func

    # Query all fee collections for the given month/year_bs
    month_bs = f"{year}-{month:02d}"
    collections = FeeCollection.query.filter(
        FeeCollection.school_id == school_id,
        FeeCollection.month_bs.like(f"{month_bs}%"),
        FeeCollection.is_deleted.is_(False),
    ).all()

    total_expected = 0.0
    total_collected = 0.0
    total_pending = 0.0
    total_partial = 0.0
    total_waived = 0.0
    total_records = len(collections)
    paid_count = 0
    pending_count = 0
    for c in collections:
        # E180: report the same money the /fees API reports — expected is the
        # net payable (base + fine − discount), collected is what was actually
        # paid, pending is the remaining due. Counting the raw base by status
        # overstated expected/collected for discounted students and counted
        # fully-paid amounts as pending for partial ones.
        payable = _fee_payable_total(c)
        paid = min(_fee_paid_amount(c, payable), payable)
        due = max(payable - paid, 0.0)
        total_expected += payable
        total_collected += paid
        total_pending += due
        if c.payment_status == "partial":
            total_partial += payable
        elif c.payment_status == "waived":
            total_waived += payable
        elif c.payment_status == "paid":
            paid_count += 1
        elif c.payment_status == "pending":
            pending_count += 1
    total_expected = round(total_expected, 2)
    total_collected = round(total_collected, 2)
    total_pending = round(total_pending, 2)
    total_partial = round(total_partial, 2)
    total_waived = round(total_waived, 2)
    total_scholarships = sum(
        float(c.discount_amount or 0) for c in collections if c.is_scholarship
    )
    total_late_fines = sum(float(c.late_fine_amount or 0) for c in collections)

    # Payment method breakdown — from receipts (actual recorded payments),
    # not base amounts of paid-status collections.
    from app.models.fee import FeeReceipt

    receipt_rows = (
        db.session.query(FeeReceipt.payment_method, func.coalesce(func.sum(FeeReceipt.amount), 0))
        .filter(
            FeeReceipt.school_id == school_id,
            FeeReceipt.is_deleted.is_(False),
            FeeReceipt.created_at >= datetime.strptime(f"{month_bs}-01", "%Y-%m-%d").replace(tzinfo=timezone.utc),
        )
        .all()
        if collections
        else []
    )
    method_breakdown = {
        (method or "unknown"): float(total)
        for method, total in receipt_rows
    }

    collection_rate = round(total_collected / total_expected * 100, 1) if total_expected else 0

    report = {
        "school_id": school_id,
        "month_bs": month_bs,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_expected": total_expected,
            "total_collected": total_collected,
            "total_pending": total_pending,
            "total_partial": total_partial,
            "total_waived": total_waived,
            "total_scholarships": total_scholarships,
            "total_late_fines": total_late_fines,
            "collection_rate_pct": collection_rate,
            "total_records": total_records,
            "paid_count": paid_count,
            "pending_count": pending_count,
        },
        "payment_methods": method_breakdown,
    }

    return report


# ── Auto-generate monthly fee collections (BS month 1) ──────────────────

@celery.task(name="auto_generate_monthly_fees", queue="default")
def auto_generate_monthly_fees():
    """Run daily: generates FeeCollection records for all students on the 1st
    of each Bikram Sambat month based on active monthly FeeStructures.

    Safe to re-run: uses idempotency markers in notes to skip duplicates.
    Only fires for schools with the 'fees' plugin active.
    """
    import nepali_datetime
    from app.models.plugin import SchoolPlugin
    from extensions import db

    today_bs = nepali_datetime.date.today()
    if today_bs.day > 2:
        # Only generate on BS day 1 (allow day 2 retry window)
        return {"skipped": "not first day of BS month", "bs_day": today_bs.day}

    month_bs = f"{today_bs.year}-{today_bs.month:02d}"
    year_bs = str(today_bs.year)

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="fees", active=True)
        .all()
    )

    results = []
    for (school_id,) in active_schools:
        try:
            result = _generate_monthly_fees_for_school(
                school_id=str(school_id),
                month_bs=month_bs,
                year_bs=year_bs,
            )
            results.append(result)
        except Exception:
            db.session.rollback()
            logger.exception(
                "Failed auto monthly fee generation for school %s", school_id
            )
            results.append({"school_id": str(school_id), "error": "failed"})

    return {"bs_month": month_bs, "schools_processed": len(results), "results": results}


def _generate_monthly_fees_for_school(school_id: str, month_bs: str, year_bs: str) -> dict:
    """Generate pending FeeCollection rows for a single school for the given BS month."""
    from app.models.fee import FeeCollection, FeeStructure
    from app.models.student import Student
    from extensions import db

    structures = FeeStructure.query.filter_by(
        school_id=school_id,
        is_deleted=False,
    ).all()

    created_total = 0
    skipped_total = 0

    for structure in structures:
        fee_items = structure.fee_items or []
        monthly_items = [
            item for item in fee_items
            if str(item.get("frequency", "monthly")).lower() == "monthly"
            and float(item.get("amount", 0) or 0) > 0
        ]
        if not monthly_items:
            continue

        # Students enrolled in this class/structure. E184: Student has no
        # is_active column — the old filter_by(is_active=True) raised
        # InvalidRequestError on EVERY run, so beat-scheduled auto monthly
        # billing silently generated nothing. Match the API's billing scope
        # (status == "active") used by /fees/batch-monthly.
        student_query = Student.query.filter_by(
            school_id=school_id,
            is_deleted=False,
            status="active",
        )
        if structure.class_id:
            student_query = student_query.filter_by(class_id=structure.class_id)
        students = student_query.all()

        for student in students:
            for item in monthly_items:
                item_name = item.get("name", "Tuition Fee")
                item_amount = float(item.get("amount", 0))
                # Unified dedupe marker — identical to the one the manual API
                # path (/fees/structures apply + /fees/batch-monthly) writes,
                # so a BS month billed by an admin is skipped by this cron and
                # vice versa. The legacy cron marker is still honored below.
                marker = structure_cycle_marker(structure.id, month_bs, item_name)

                exists = FeeCollection.query.filter(
                    FeeCollection.school_id == school_id,
                    FeeCollection.student_id == student.id,
                    FeeCollection.notes.ilike(f"%{marker}%"),
                    FeeCollection.is_deleted.is_(False),
                ).first()
                if not exists:
                    # Honor the PRE-unification cron marker so months already
                    # billed by the old code are never billed a second time.
                    legacy_marker = legacy_auto_monthly_marker(
                        structure.id, month_bs, item_name
                    )
                    exists = FeeCollection.query.filter(
                        FeeCollection.school_id == school_id,
                        FeeCollection.student_id == student.id,
                        FeeCollection.notes.ilike(f"%{legacy_marker}%"),
                        FeeCollection.is_deleted.is_(False),
                    ).first()

                if exists:
                    skipped_total += 1
                    continue

                # Align with the API generator (/fees structures apply): active
                # scholarships/discounts for the student are applied additively
                # on the base amount and capped at the base so the net stays >= 0.
                discount_amount, is_scholarship = _student_discount_for_item(
                    school_id, student.id, item_name, item_amount
                )

                collection = FeeCollection(
                    school_id=school_id,
                    student_id=student.id,
                    academic_year=structure.academic_year or year_bs,
                    fee_item_name=item_name,
                    amount=item_amount,
                    discount_amount=discount_amount,
                    is_scholarship=is_scholarship,
                    month_bs=month_bs,
                    year_bs=year_bs,
                    payment_status="pending",
                    notes=f"{marker} [auto_generated]",
                )
                db.session.add(collection)
                created_total += 1

    if created_total:
        db.session.commit()
    else:
        db.session.rollback()

    return {
        "school_id": school_id,
        "month_bs": month_bs,
        "created": created_total,
        "skipped": skipped_total,
    }


def _student_discount_for_item(school_id, student_id, item_name, base_amount):
    """Active scholarships for a student, additive on the base amount.

    Mirrors the rule in app/api/v1/fees.py::_apply_fee_structure: percent
    discounts are computed on the base (not sequentially), fixed discounts
    add flat NPR, the combined discount is capped at the base, and only
    currently-valid discounts (BS date window) for this fee item count.
    Returns (discount_amount, is_scholarship).
    """
    from app.models.fee import StudentScholarship
    from sqlalchemy import or_

    try:
        import nepali_datetime

        today_bs = nepali_datetime.date.today()
        today_bs_str = f"{today_bs.year}-{today_bs.month:02d}-{today_bs.day:02d}"
        scholarships = (
            StudentScholarship.query.filter(
                StudentScholarship.school_id == school_id,
                StudentScholarship.student_id == student_id,
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
        if not scholarships:
            return 0.0, False
        combined = 0.0
        for sc in scholarships:
            if sc.discount_type == "percent":
                combined += float(base_amount) * float(sc.discount_value or 0) / 100
            else:
                combined += float(sc.discount_value or 0)
        return round(min(max(combined, 0.0), float(base_amount)), 2), True
    except Exception:
        # A scholarship lookup failure must never abort auto billing.
        return 0.0, False

