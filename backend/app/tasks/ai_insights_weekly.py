"""AI Insights weekly report generation task."""

from extensions import celery


@celery.task(name="ai_insights_weekly")
def generate_weekly_insights(school_id: str):
    """Generate and store weekly AI insights report for a school."""
    from flask import current_app
    from app.services.ai.school_insights import SchoolInsightsService
    from extensions import cache

    try:
        report = SchoolInsightsService.generate_weekly_report(school_id)
        # Cache the report for 7 days
        cache.set(f"weekly_report:{school_id}", report, timeout=604800)
        current_app.logger.info(f"Weekly AI report generated for school {school_id}")
        return {"success": True, "school_id": school_id}
    except Exception as e:
        current_app.logger.error(f"Weekly AI report failed for {school_id}: {e}")
        return {"success": False, "error": str(e)}


@celery.task(name="calculate_risk_scores")
def calculate_risk_scores(school_id: str):
    """Calculate and cache student risk scores."""
    from flask import current_app
    from app.services.ai.school_insights import SchoolInsightsService
    from extensions import cache

    try:
        scores = SchoolInsightsService.calculate_student_risk_scores(school_id)
        cache.set(f"risk_scores:{school_id}", scores, timeout=86400)
        current_app.logger.info(f"Risk scores calculated: {len(scores)} at-risk students for school {school_id}")
        return {"success": True, "at_risk_count": len(scores)}
    except Exception as e:
        current_app.logger.error(f"Risk score calc failed for {school_id}: {e}")
        return {"success": False, "error": str(e)}


@celery.task(name="dispatch_ai_insights_weekly", queue="default")
def dispatch_ai_insights_weekly():
    """Fan-out weekly AI insights generation to all active schools."""
    from app.models.school import School

    schools = School.query.filter_by(is_active=True, is_deleted=False).all()
    for school in schools:
        generate_weekly_insights.delay(str(school.id))
    return {"queued": len(schools)}
