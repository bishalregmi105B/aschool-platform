"""Admission follow-up tasks — reminders, pipeline automation."""

from extensions import celery


@celery.task(name="admission_followup")
def send_admission_followups(school_id: str):
    """Auto-send follow-up messages for pending admission inquiries."""
    from flask import current_app
    from app.models.admission import AdmissionInquiry
    from app.services.communications.sms_gateway import SmsGatewayService
    from extensions import db
    from datetime import datetime, timedelta

    three_days_ago = datetime.utcnow() - timedelta(days=3)

    pending = AdmissionInquiry.query.filter(
        AdmissionInquiry.school_id == school_id,
        AdmissionInquiry.status == "new",
        AdmissionInquiry.created_at <= three_days_ago,
    ).all()

    sent = 0
    for inquiry in pending:
        if inquiry.phone:
            message = (
                f"Namaste! Thank you for your interest in our school. "
                f"We noticed your inquiry about admission for {inquiry.student_name}. "
                f"Would you like to schedule a visit? Reply YES or call us."
            )
            result = SmsGatewayService.send_sms(inquiry.phone, message)
            if result.get("success"):
                sent += 1
                inquiry.status = "followed_up"

    db.session.commit()
    current_app.logger.info(f"Admission follow-ups for {school_id}: {sent}/{len(pending)} sent")
    return {"school_id": school_id, "total_pending": len(pending), "followed_up": sent}


@celery.task(name="admission_pipeline_cleanup")
def cleanup_stale_applications(school_id: str, stale_days: int = 90):
    """Archive applications that have been stale for too long."""
    from flask import current_app
    from app.models.admission import AdmissionApplication
    from extensions import db
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(days=stale_days)

    stale = AdmissionApplication.query.filter(
        AdmissionApplication.school_id == school_id,
        AdmissionApplication.status.in_(["submitted", "under_review"]),
        AdmissionApplication.updated_at <= cutoff,
    ).all()

    for app in stale:
        # E186: `status` is an Enum column (admission_status) with NO
        # "archived" value — writing "archived" crashed with DataError on
        # every run, so stale applications were never cleaned up. Park them
        # in the closest real state and leave an auditable remark instead.
        app.status = "rejected"
        app.remarks = (
            f"{(app.remarks or '').strip()} [auto-archived: stale >{stale_days} days]".strip()
        )

    db.session.commit()
    current_app.logger.info(f"Archived {len(stale)} stale applications for school {school_id}")
    return {"archived": len(stale)}


@celery.task(name="dispatch_admission_followups", queue="default")
def dispatch_admission_followups():
    """Fan-out admission follow-ups to all active schools."""
    from app.models.plugin import SchoolPlugin

    from extensions import db

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="admission", active=True)
        .all()
    )
    for (school_id,) in active_schools:
        send_admission_followups.delay(str(school_id))
    return {"queued": len(active_schools)}
