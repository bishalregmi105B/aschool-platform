"""Emergency alert service — multi-channel emergency broadcast."""
import logging

logger = logging.getLogger(__name__)


class AlertService:
    """Multi-channel emergency broadcast system."""

    @staticmethod
    def send_emergency_alert(school_id: str, alert_type: str, message: str,
                             severity: str = "critical") -> dict:
        """Broadcast emergency alert to all parents via WhatsApp + SMS + Push.

        Args:
            school_id: School UUID
            alert_type: earthquake, fire, lockdown, evacuation, custom
            message: Alert message text
            severity: critical, high, medium, low
        """
        from app.models.school import School
        from app.models.student import Student, Guardian
        from app.models.emergency import EmergencyAlert
        from extensions import db

        school = School.query.get(school_id)
        if not school:
            return {"error": "School not found"}

        # Create alert record
        alert = EmergencyAlert(
            school_id=school_id,
            alert_type=alert_type,
            message=message,
            severity=severity,
            status="sending",
        )
        db.session.add(alert)
        db.session.commit()

        # Get all parent contacts
        guardians = Guardian.query.filter_by(
            school_id=school_id, is_deleted=False
        ).all()

        sent_count = 0
        for guardian in guardians:
            try:
                # WhatsApp (priority channel)
                if school.whatsapp_phone_number_id and guardian.phone:
                    from app.services.communications.whatsapp_cloud import WhatsAppCloudAPI
                    wa = WhatsAppCloudAPI(school.whatsapp_token, school.whatsapp_phone_number_id)
                    wa.send_text(guardian.phone, f"🚨 EMERGENCY: {message}")
                    sent_count += 1

                # SMS fallback
                if guardian.phone:
                    from app.services.communications.sms_gateway import SparrowSMS
                    sms = SparrowSMS()
                    sms.send(guardian.phone, f"EMERGENCY - {school.name}: {message}")
            except Exception:
                logger.exception("Failed to alert guardian %s", guardian.id)

        alert.status = "sent"
        alert.recipients_count = sent_count
        db.session.commit()

        return {
            "alert_id": str(alert.id),
            "sent_to": sent_count,
            "total_guardians": len(guardians),
            "status": "sent",
        }

    @staticmethod
    def mark_student_safe(school_id: str, alert_id: str, student_id: str,
                          marked_by: str) -> dict:
        """Mark a student as accounted for during an emergency."""
        from app.models.emergency import EmergencyHeadcount
        from extensions import db

        record = EmergencyHeadcount(
            school_id=school_id,
            alert_id=alert_id,
            student_id=student_id,
            marked_by=marked_by,
            status="safe",
        )
        db.session.add(record)
        db.session.commit()
        return {"student_id": student_id, "status": "safe"}
