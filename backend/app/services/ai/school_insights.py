"""AI School Insights Service — Claude-powered weekly intelligence reports."""

import json
from datetime import datetime, timedelta

from flask import current_app, g
from sqlalchemy import func

from extensions import db, cache


class SchoolInsightsService:
    """Generate weekly school intelligence reports using Claude AI."""

    MODEL_FAST = "claude-haiku-4-5-20241022"
    MODEL_QUALITY = "claude-sonnet-4-20250514"

    @staticmethod
    def _get_client():
        import anthropic
        return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])

    @staticmethod
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

    @classmethod
    def generate_weekly_report(cls, school_id: str) -> dict:
        """Generate a comprehensive weekly school intelligence report."""
        from app.models.attendance import Attendance
        from app.models.fee import FeeCollection
        from app.models.student import Student
        from app.models.exam import Marks
        from app.models.incident import Incident

        week_ago = datetime.utcnow() - timedelta(days=7)

        # Gather metrics
        total_students = Student.query.filter_by(school_id=school_id, status="active").count()

        attendance_records = db.session.query(
            func.count(Attendance.id),
            func.sum(db.case((Attendance.status == "present", 1), else_=0)),
            func.sum(db.case((Attendance.status == "absent", 1), else_=0)),
        ).filter(
            Attendance.school_id == school_id,
            Attendance.date >= week_ago.date(),
        ).first()

        total_att, present, absent = attendance_records or (0, 0, 0)
        att_rate = round((present / total_att * 100), 1) if total_att else 0

        fee_collected = db.session.query(
            func.sum(FeeCollection.amount)
        ).filter(
            FeeCollection.school_id == school_id,
            FeeCollection.payment_status == "paid",
            FeeCollection.collected_at >= week_ago,
        ).scalar() or 0

        pending_collections = FeeCollection.query.filter(
            FeeCollection.school_id == school_id,
            FeeCollection.payment_status.in_(("pending", "partial")),
            FeeCollection.is_deleted.is_(False),
        ).all()
        fee_pending = sum(
            max(float(collection.amount or 0) - cls._fee_paid_amount(collection), 0)
            for collection in pending_collections
        )

        incidents_count = Incident.query.filter(
            Incident.school_id == school_id,
            Incident.created_at >= week_ago,
        ).count()

        metrics = {
            "total_students": total_students,
            "attendance_rate": att_rate,
            "present_count": present or 0,
            "absent_count": absent or 0,
            "fee_collected_this_week": float(fee_collected),
            "fee_pending_total": float(fee_pending),
            "incidents_this_week": incidents_count,
        }

        prompt = f"""You are an AI school management analyst for a school in Nepal.
Analyze these weekly metrics and provide an intelligence report in JSON format.

Metrics: {json.dumps(metrics)}

Return JSON with:
- "summary": 2-3 sentence executive summary
- "highlights": list of 3-5 key observations
- "concerns": list of any concerning trends
- "recommendations": list of 3-5 actionable recommendations
- "risk_level": "low" | "medium" | "high"

Focus on practical, Nepal-context relevant insights. Use NPR for currency."""

        client = cls._get_client()
        response = client.messages.create(
            model=cls.MODEL_FAST,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            text = response.content[0].text
            # Extract JSON from response
            start = text.index("{")
            end = text.rindex("}") + 1
            report = json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            report = {
                "summary": "AI analysis unavailable this week.",
                "highlights": [],
                "concerns": [],
                "recommendations": [],
                "risk_level": "low",
            }

        report["metrics"] = metrics
        report["generated_at"] = datetime.utcnow().isoformat()
        return report

    @classmethod
    def calculate_student_risk_scores(cls, school_id: str) -> list[dict]:
        """Detect at-risk students based on attendance, grades, fees, incidents."""
        from app.models.student import Student
        from app.models.attendance import Attendance
        from app.models.fee import FeeCollection
        from app.models.incident import Incident

        thirty_days = datetime.utcnow() - timedelta(days=30)
        students = Student.query.filter_by(school_id=school_id, status="active").all()

        at_risk = []
        for student in students:
            risk_score = 0
            reasons = []

            # Attendance risk
            att_count = Attendance.query.filter(
                Attendance.student_id == student.id,
                Attendance.date >= thirty_days.date(),
            ).count()
            absent_count = Attendance.query.filter(
                Attendance.student_id == student.id,
                Attendance.date >= thirty_days.date(),
                Attendance.status == "absent",
            ).count()

            if att_count > 0:
                absence_rate = absent_count / att_count
                if absence_rate > 0.3:
                    risk_score += 40
                    reasons.append(f"High absence rate: {absence_rate:.0%}")
                elif absence_rate > 0.15:
                    risk_score += 20
                    reasons.append(f"Moderate absence rate: {absence_rate:.0%}")

            # Fee risk
            overdue_fees = FeeCollection.query.filter(
                FeeCollection.school_id == school_id,
                FeeCollection.payment_status.in_(("pending", "partial")),
            ).join(Student).filter(Student.id == student.id).count()

            if overdue_fees > 0:
                risk_score += 20 * min(overdue_fees, 3)
                reasons.append(f"{overdue_fees} overdue fee(s)")

            # Incident risk
            recent_incidents = Incident.query.filter(
                Incident.school_id == school_id,
                Incident.created_at >= thirty_days,
            ).filter(
                Incident.students_involved.contains(str(student.id))
            ).count()

            if recent_incidents > 0:
                risk_score += 15 * min(recent_incidents, 3)
                reasons.append(f"{recent_incidents} recent incident(s)")

            if risk_score >= 30:
                at_risk.append({
                    "student_id": student.id,
                    "student_name": f"{student.first_name} {student.last_name}",
                    "enrollment_number": student.student_id or student.admission_number,
                    "risk_score": min(risk_score, 100),
                    "risk_level": "high" if risk_score >= 60 else "medium",
                    "reasons": reasons,
                })

        at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
        return at_risk

    @classmethod
    def generate_daily_brief(cls, school_id: str) -> dict:
        """Quick daily summary for the school admin morning briefing."""
        from app.models.notice import Event
        from app.models.student import Student

        today = datetime.utcnow().date()

        events_today = Event.query.filter(
            Event.school_id == school_id,
            Event.start_date <= today,
            db.or_(Event.end_date >= today, Event.end_date.is_(None)),
        ).all()

        return {
            "date": today.isoformat(),
            "events": [{"title": e.title, "is_holiday": e.event_type == "holiday"} for e in events_today],
            "total_students": Student.query.filter_by(school_id=school_id, status="active").count(),
        }
