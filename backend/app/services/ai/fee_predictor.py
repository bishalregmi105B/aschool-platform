"""AI Fee Predictor — predicts payment defaults and optimal reminder timing."""
import logging
from app.services.ai.token_hub import AITokenHub

logger = logging.getLogger(__name__)


class FeePredictor:
    """Predict fee payment defaults and suggest optimal collection strategies."""

    @staticmethod
    def predict_defaulters(school_id: str) -> list:
        """Identify students likely to default on upcoming fee payments."""
        from app.models.fee import FeeCollection
        from app.models.student import Student
        from sqlalchemy import func
        from extensions import db

        # Get students with late payment history
        late_payers = (
            db.session.query(
                FeeCollection.student_id,
                func.count(FeeCollection.id).label("total_payments"),
                func.avg(
                    func.extract("day", FeeCollection.collected_at - FeeCollection.created_at)
                ).label("avg_days_late"),
            )
            .filter(
                FeeCollection.school_id == school_id,
                FeeCollection.payment_status == "paid",
                FeeCollection.collected_at.isnot(None),
            )
            .group_by(FeeCollection.student_id)
            .all()
        )

        predictions = []
        for student_id, total, avg_late in late_payers:
            if avg_late and avg_late > 7:
                risk = "high" if avg_late > 30 else "medium"
                student = Student.query.get(student_id)
                if student:
                    predictions.append({
                        "student_id": str(student_id),
                        "name": f"{student.first_name} {student.last_name}",
                        "avg_days_late": round(float(avg_late), 1),
                        "total_payments": total,
                        "risk_level": risk,
                    })

        return sorted(predictions, key=lambda x: x["avg_days_late"], reverse=True)

    @staticmethod
    def suggest_reminder_timing(student_id: str, school_id: str = None) -> dict:
        """Suggest optimal reminder timing for a specific student."""
        from app.models.fee import FeeCollection

        history = FeeCollection.query.filter_by(
            student_id=student_id,
        ).filter(
            FeeCollection.collected_at.isnot(None),
        ).order_by(FeeCollection.collected_at.desc()).limit(12).all()

        if not history:
            return {"reminder_days_before": [7, 3, 1], "preferred_channel": "whatsapp"}

        avg_payment_day = sum(
            h.collected_at.day for h in history if h.collected_at
        ) / max(len(history), 1)

        return {
            "avg_payment_day": round(avg_payment_day),
            "reminder_days_before": [10, 5, 1],
            "preferred_channel": "whatsapp",
            "total_history": len(history),
        }
