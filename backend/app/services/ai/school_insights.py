"""AI School Insights Service — AI-powered weekly intelligence reports.

All LLM calls route through AITokenHub — per-school quota enforcement and
usage logging happen there (E7: no direct Anthropic calls).
"""

import json
from datetime import datetime, timedelta

from sqlalchemy import func

from app.services.ai.token_hub import AITokenHub
from extensions import db, cache


class SchoolInsightsService:
    """Generate weekly school intelligence reports using AI."""

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
    def generate_weekly_report(cls, school_id: str, user_id=None) -> dict:
        """Generate a comprehensive weekly school intelligence report.

        ``user_id`` is optional — resolved from the request context (``g``)
        when omitted (Celery-triggered calls are attributed to the school
        owner by the hub), so existing callers work unchanged.
        """
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

        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="school-insights:weekly",
            messages=[{"role": "user", "content": prompt}],
            model="fast",  # haiku-class model via hub routing
            max_tokens=1024,
            temperature=1.0,  # matches the previous direct Anthropic default
            metadata={"school_id": str(school_id)},
        )["text"]

        try:
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
                Incident.involved_student_ids.any(student.id),
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
