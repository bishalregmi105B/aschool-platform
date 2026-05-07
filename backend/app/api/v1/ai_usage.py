"""AI Usage & Quota Admin API.

Endpoints:
  GET  /ai-usage/stats          — per-school usage summary
  GET  /ai-usage/logs           — paginated call log
  GET  /ai-usage/quota          — view quota settings
  PUT  /ai-usage/quota          — update quota settings
  POST /ai-usage/quota/init     — provision a default quota for the school
"""
from datetime import datetime, timezone

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.utils.decorators import role_required, school_required
from app.utils.response import error_response, success_response
from extensions import db

ai_usage_bp = Blueprint("ai_usage", __name__, url_prefix="/ai-usage")


# ---------------------------------------------------------------------------
# Quota management
# ---------------------------------------------------------------------------

@ai_usage_bp.route("/quota", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def get_quota():
    """Return the school's AI quota configuration."""
    from app.models.ai_token import AISchoolQuota
    from app.services.ai.token_hub import AITokenHub

    quota = AISchoolQuota.query.filter_by(school_id=g.school_id).first()
    if not quota:
        return error_response("No quota configured for this school. POST /quota/init first.", 404)

    today_used   = AITokenHub.get_usage_today(g.school_id)
    monthly_used = AITokenHub.get_usage_month(g.school_id)

    return success_response({
        **quota.to_dict(),
        "today_used":       today_used,
        "monthly_used":     monthly_used,
        "daily_percent":    round(today_used   / quota.daily_limit   * 100, 1) if quota.daily_limit   else 0,
        "monthly_percent":  round(monthly_used / quota.monthly_limit * 100, 1) if quota.monthly_limit else 0,
    })


@ai_usage_bp.route("/quota", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def update_quota():
    """Update quota limits / activation / plan for the school."""
    from app.models.ai_token import AISchoolQuota

    data  = request.get_json(silent=True) or {}
    quota = AISchoolQuota.query.filter_by(school_id=g.school_id).first()
    if not quota:
        return error_response("Quota record not found. POST /quota/init first.", 404)

    if "daily_limit"   in data: quota.daily_limit   = int(data["daily_limit"])
    if "monthly_limit" in data: quota.monthly_limit = int(data["monthly_limit"])
    if "alert_at"      in data: quota.alert_at      = int(data["alert_at"])
    if "is_active"     in data: quota.is_active     = bool(data["is_active"])
    if "plan_type"     in data: quota.plan_type     = str(data["plan_type"])

    db.session.commit()
    return success_response(quota.to_dict())


@ai_usage_bp.route("/quota/init", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def init_quota():
    """Provision the default AI quota record for this school."""
    from app.services.ai.token_hub import AITokenHub

    AITokenHub.ensure_quota_exists(g.school_id)
    from app.models.ai_token import AISchoolQuota
    quota = AISchoolQuota.query.filter_by(school_id=g.school_id).first()
    return success_response(quota.to_dict(), status_code=201)


# ---------------------------------------------------------------------------
# Usage statistics
# ---------------------------------------------------------------------------

@ai_usage_bp.route("/stats", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def get_stats():
    """Return aggregated AI usage stats for the current school."""
    from app.models.ai_token import AIUsageLog, AISchoolQuota
    from app.services.ai.token_hub import AITokenHub

    now         = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    quota       = AISchoolQuota.query.filter_by(school_id=g.school_id).first()
    today_used  = AITokenHub.get_usage_today(g.school_id)
    month_used  = AITokenHub.get_usage_month(g.school_id)

    # Top features this month
    top_features = (
        db.session.query(
            AIUsageLog.feature,
            func.count().label("call_count"),
            func.sum(AIUsageLog.total_tokens).label("tokens"),
        )
        .filter(
            AIUsageLog.school_id == g.school_id,
            AIUsageLog.created_at >= month_start,
            AIUsageLog.status == "success",
        )
        .group_by(AIUsageLog.feature)
        .order_by(func.sum(AIUsageLog.total_tokens).desc())
        .limit(10)
        .all()
    )

    # Daily tokens for last 7 days
    last_7_days = (
        db.session.query(
            func.date_trunc("day", AIUsageLog.created_at).label("day"),
            func.sum(AIUsageLog.total_tokens).label("tokens"),
        )
        .filter(
            AIUsageLog.school_id == g.school_id,
            AIUsageLog.status == "success",
        )
        .group_by("day")
        .order_by("day")
        .limit(7)
        .all()
    )

    # By provider
    by_provider = (
        db.session.query(
            AIUsageLog.provider,
            func.sum(AIUsageLog.total_tokens).label("tokens"),
            func.count().label("calls"),
        )
        .filter(
            AIUsageLog.school_id == g.school_id,
            AIUsageLog.created_at >= month_start,
        )
        .group_by(AIUsageLog.provider)
        .all()
    )

    return success_response({
        "quota": quota.to_dict() if quota else None,
        "usage": {
            "today":           today_used,
            "this_month":      month_used,
            "daily_percent":   round(today_used / quota.daily_limit   * 100, 1) if quota and quota.daily_limit   else 0,
            "monthly_percent": round(month_used / quota.monthly_limit * 100, 1) if quota and quota.monthly_limit else 0,
        },
        "top_features": [
            {"feature": r.feature, "call_count": r.call_count, "tokens": int(r.tokens or 0)}
            for r in top_features
        ],
        "daily_chart": [
            {"day": r.day.date().isoformat(), "tokens": int(r.tokens or 0)}
            for r in last_7_days
        ],
        "by_provider": [
            {"provider": r.provider, "tokens": int(r.tokens or 0), "calls": r.calls}
            for r in by_provider
        ],
    })


@ai_usage_bp.route("/logs", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def get_logs():
    """Paginated AI call log for the current school."""
    from app.models.ai_token import AIUsageLog
    from app.utils.pagination import paginate

    feature  = request.args.get("feature")
    status   = request.args.get("status")
    provider = request.args.get("provider")

    query = AIUsageLog.query.filter_by(school_id=g.school_id, is_deleted=False)
    if feature:  query = query.filter(AIUsageLog.feature == feature)
    if status:   query = query.filter(AIUsageLog.status  == status)
    if provider: query = query.filter(AIUsageLog.provider == provider)
    query = query.order_by(AIUsageLog.created_at.desc())

    items, meta = paginate(query)
    return success_response([r.to_dict() for r in items], meta=meta)
