"""S-A1 fees-depth beat tasks: stale-gateway-initiation sweeper + late-fine
accrual (MASTER_EXECUTION_PLAN A-01/A-08).

Both are idempotent — beat retries and overlapping schedules are no-ops:
  - sweeper: an initiation flips initiated→failed exactly once;
  - fines: fine_accrued_on_bs stamps the last accrual day per bill.
"""
import logging

from extensions import celery

logger = logging.getLogger(__name__)


@celery.task(name="sweep_pending_fee_initiations", queue="default")
def sweep_pending_fee_initiations():
    """Fail PaymentInitiation rows stuck in 'initiated' past the stale window.

    Every gateway we ship (eSewa ePay v2, Khalti v2, FonePay) expires its
    session well inside one hour, so an initiation older than that will never
    complete — leaving it 'initiated' forever makes the dues picture lie and
    invites double-payments on the same bill.
    """
    from datetime import datetime, timedelta, timezone

    from app.models.fee import PaymentInitiation
    from extensions import db

    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    stale = PaymentInitiation.query.filter(
        PaymentInitiation.status == "initiated",
        PaymentInitiation.created_at < cutoff,
        PaymentInitiation.is_deleted.is_(False),
    ).all()
    swept = 0
    for initiation in stale:
        initiation.status = "failed"
        swept += 1
    if swept:
        db.session.commit()
    if swept:
        logger.info("swept %s stale fee initiation(s)", swept)
    return {"swept": swept}


@celery.task(name="accrue_fee_fines_daily", queue="default")
def accrue_fee_fines_daily():
    """Accrue late fines for every school whose fees plugin is active and
    that configured a fine policy (School.settings['fees_fine_policy']).

    Runs shortly after midnight (Nepal time the beat's 18:35 UTC ≈ 00:20
    NST) so the accrual day matches the BS calendar day.
    """
    from app.models.school import School

    schools = School.query.filter(School.is_deleted.is_(False)).all()
    total_bills = 0
    total_fine = 0.0
    for school in schools:
        policy = {}
        if isinstance(school.settings, dict):
            policy = school.settings.get("fees_fine_policy") or {}
        if str(policy.get("mode") or "none") not in ("fixed_once", "daily_percent"):
            continue
        try:
            from app.api.v1.fees import _accrue_fines_core

            result = _accrue_fines_core(str(school.id))
            total_bills += result.get("bills_fined", 0)
            total_fine += result.get("fine_total", 0.0)
        except Exception:  # noqa: BLE001 — one school must not block the rest
            logger.exception("fine accrual failed for school %s", school.id)
    return {"bills_fined": total_bills, "fine_total": round(total_fine, 2)}
