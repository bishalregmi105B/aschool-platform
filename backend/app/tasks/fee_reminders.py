"""Fee reminder tasks."""
from extensions import celery


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
