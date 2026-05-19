"""Fee reminder tasks — reminders, auto-generation, monthly reports."""
import logging

from extensions import celery

logger = logging.getLogger(__name__)


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

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
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
        guardian = Guardian.query.filter_by(student_id=student.id, is_primary=True).first()
        if guardian and guardian.phone:
            pending_amount = max(float(fee.amount or 0) - _fee_paid_amount(fee), 0)
            period = " ".join(part for part in (fee.month_bs, fee.year_bs) if part) or "your billing period"
            msg = (
                f"Fee Reminder: Rs.{pending_amount:.2f} pending for "
                f"{student.first_name} ({period}). "
                f"Pay via eSewa/Khalti at aschool.com.np"
            )
            send_sms.delay(guardian.phone, msg, school_id)


def _fee_paid_amount(collection) -> float:
    if collection.payment_status == "paid":
        return float(collection.amount or 0)

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

    total_expected = sum(float(c.amount or 0) for c in collections)
    total_collected = sum(
        float(c.amount or 0) for c in collections if c.payment_status == "paid"
    )
    total_pending = sum(
        float(c.amount or 0) for c in collections if c.payment_status == "pending"
    )
    total_partial = sum(
        float(c.amount or 0) for c in collections if c.payment_status == "partial"
    )
    total_waived = sum(
        float(c.amount or 0) for c in collections if c.payment_status == "waived"
    )
    total_scholarships = sum(
        float(c.discount_amount or 0) for c in collections if c.is_scholarship
    )
    total_late_fines = sum(float(c.late_fine_amount or 0) for c in collections)

    # Payment method breakdown
    method_breakdown = {}
    for c in collections:
        if c.payment_status == "paid" and c.payment_method:
            method_breakdown[c.payment_method] = (
                method_breakdown.get(c.payment_method, 0) + float(c.amount or 0)
            )

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
            "total_records": len(collections),
            "paid_count": sum(1 for c in collections if c.payment_status == "paid"),
            "pending_count": sum(1 for c in collections if c.payment_status == "pending"),
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

        # Students enrolled in this class/structure
        student_query = Student.query.filter_by(
            school_id=school_id,
            is_deleted=False,
            is_active=True,
        )
        if structure.class_id:
            student_query = student_query.filter_by(class_id=structure.class_id)
        students = student_query.all()

        for student in students:
            for item in monthly_items:
                item_name = item.get("name", "Tuition Fee")
                marker = (
                    f"[auto_monthly:{structure.id}:{month_bs}:{item_name}]"
                )

                exists = FeeCollection.query.filter(
                    FeeCollection.school_id == school_id,
                    FeeCollection.student_id == student.id,
                    FeeCollection.notes.ilike(f"%{marker}%"),
                    FeeCollection.is_deleted.is_(False),
                ).first()

                if exists:
                    skipped_total += 1
                    continue

                collection = FeeCollection(
                    school_id=school_id,
                    student_id=student.id,
                    academic_year=structure.academic_year or year_bs,
                    fee_item_name=item_name,
                    amount=float(item.get("amount", 0)),
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

