"""Social Ads API — ad campaign management for the social_ads plugin
(growth, NPR 499).

E30: the plugin was published/sold but had ZERO API routes — the web
campaigns page (frontend/app/dashboard/social-hub/campaigns/page.tsx, gated
PluginGate slug="social_ads") called GET/POST /social/campaigns which 404'd.
The AdCampaign model (app/models/social.py) existed unused.

Routes (mounted under /api/v1, all gated @plugin_required("social_ads"),
tenant-scoped to g.school_id):
  GET    /social/campaigns                    list (?status, ?objective) + stats
  POST   /social/campaigns                    create (validated targeting)
  GET    /social/campaigns/preview            honest audience estimate for a
                                              targeting draft (real counts)
  GET    /social/campaigns/<id>               detail + audience estimate
  PATCH  /social/campaigns/<id>               update fields / status transitions
  POST   /social/campaigns/<id>/pause         active → paused
  POST   /social/campaigns/<id>/resume        paused → active
  DELETE /social/campaigns/<id>               soft delete

Delivery honesty: there is NO Meta Ads API wiring (no credentials, no
provider). reach/impressions/clicks/spend are REAL counters that stay 0
until actual delivery data exists — nothing in this blueprint fabricates
impression numbers. The preview endpoint returns an in-school audience
estimate computed from real Student/Guardian row counts (matched students +
distinct guardians), clearly labeled as an audience size, NOT an impression
forecast.
"""

from datetime import datetime
import uuid as uuid_mod

import bleach
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.models.academic import Class, Section
from app.models.social import AdCampaign
from app.models.student import Guardian, Student
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

social_ads_bp = Blueprint("social_ads", __name__, url_prefix="/social")

PLATFORMS = ("facebook", "instagram")
OBJECTIVES = ("admission", "awareness", "engagement", "traffic")
AUDIENCES = ("students_parents", "students", "parents")
STATUSES = ("draft", "active", "paused", "completed")
# Which status transitions a campaign may take.
STATUS_TRANSITIONS = {
    "draft": {"active"},
    "active": {"paused", "completed"},
    "paused": {"active", "completed"},
    "completed": set(),
}
MAX_NOTE_LEN = 200

# Same sanitization policy as notices (app/api/v1/notices.py::_sanitize_html).
_ALLOWED_TAGS = [
    "b", "strong", "i", "em", "u", "s", "p", "br", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "span",
]
_ALLOWED_ATTRS = {"a": ["href", "title", "target"], "span": ["class"]}


# ── Helpers ───────────────────────────────────────────────────────────────

def _sanitize_html(value: str) -> str:
    """Strip dangerous tags; allow the same safe subset as notices."""
    return bleach.clean(
        value or "", tags=_ALLOWED_TAGS, attributes=_ALLOWED_ATTRS, strip=True
    )


def _sanitize_plain(value: str) -> str:
    """Plain-text field: strip ALL markup (names, free-text audience notes)."""
    return bleach.clean(value or "", tags=[], attributes={}, strip=True).strip()


def _sanitize_media_url(value: str):
    """Only http(s) URLs are accepted — blocks javascript:/data: payloads.

    Returns (clean_url, error)."""
    url = (value or "").strip()
    if not url:
        return None, None
    if not (url.startswith("http://") or url.startswith("https://")):
        return None, "media_url must be an http(s) URL"
    return bleach.clean(url, tags=[], attributes={}, strip=True), None


def _parse_dt(value):
    """Parse an ISO date/datetime string, or None."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_budget(value):
    """Accept int/float/numeric-string budgets; return Decimal-able float."""
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount <= 0 or amount > 99_999_999:
        return None
    return round(amount, 2)


def _as_id_list(value):
    """Normalize a targeting id field: 'a,b' / ['a','b'] → [str, ...]."""
    if value is None:
        return []
    if isinstance(value, str):
        parts = value.split(",")
    elif isinstance(value, (list, tuple)):
        parts = list(value)
    else:
        return None
    out = [str(p).strip() for p in parts if str(p).strip()]
    return out


def _uuid_tokens(tokens):
    """All tokens must be UUID-shaped (normalized); otherwise None.

    Without this, a junk id like 'abc' reaches a UUID column and Postgres
    raises DataError → 500. Bad input must be a 400, never a 500.
    """
    out = []
    for token in tokens:
        try:
            out.append(str(uuid_mod.UUID(str(token))))
        except (ValueError, AttributeError, TypeError):
            return None
    return out


def _validate_targeting(data):
    """Validate targeting params against the school's REAL classes/sections.

    Accepts: class_ids, section_ids (list or comma string), audience enum,
    and a free-text note (the frontend's target_audience string).
    Returns (targeting_dict, error_response_or_None).
    """
    raw_class_ids = _as_id_list(data.get("class_ids"))
    raw_section_ids = _as_id_list(data.get("section_ids"))
    if raw_class_ids is None or raw_section_ids is None:
        return None, error_response("class_ids/section_ids must be lists", 400)
    class_uuids = _uuid_tokens(raw_class_ids)
    section_uuids = _uuid_tokens(raw_section_ids)
    if class_uuids is None or section_uuids is None:
        return None, error_response(
            "class_ids/section_ids must be UUIDs", 400
        )

    audience = data.get("audience") or "students_parents"
    if audience not in AUDIENCES:
        return None, error_response(
            f"audience must be one of {', '.join(AUDIENCES)}", 400
        )

    # Every class must be a live class of THIS school.
    class_ids = []
    for cid in class_uuids:
        klass = Class.query.filter_by(
            id=cid, school_id=g.school_id, is_deleted=False
        ).first()
        if klass is None:
            return None, error_response(f"Unknown class: {cid}", 400)
        class_ids.append(str(klass.id))

    # Every section must be a live section of THIS school and, when classes
    # were selected, belong to one of them.
    section_ids = []
    for sid in section_uuids:
        section = (
            Section.query.join(Class, Section.class_id == Class.id)
            .filter(
                Section.id == sid,
                Section.is_deleted.is_(False),
                Class.school_id == g.school_id,
                Class.is_deleted.is_(False),
            )
            .first()
        )
        if section is None:
            return None, error_response(f"Unknown section: {sid}", 400)
        if class_ids and str(section.class_id) not in class_ids:
            return None, error_response(
                f"Section {sid} does not belong to the selected classes", 400
            )
        section_ids.append(str(section.id))

    note = _sanitize_plain(str(data.get("note") or data.get("target_audience") or ""))
    targeting = {
        "class_ids": class_ids,
        "section_ids": section_ids,
        "audience": audience,
        "note": note[:MAX_NOTE_LEN],
    }
    return targeting, None


def _audience_estimate(school_id, targeting):
    """Honest reach estimate: real row counts, not impressions.

    estimated_reach = matched students + distinct guardians of those
    students (per the selected audience), straight from SQL COUNTs.
    """
    class_ids = list((targeting or {}).get("class_ids") or [])
    section_ids = list((targeting or {}).get("section_ids") or [])
    audience = (targeting or {}).get("audience") or "students_parents"

    student_q = Student.query.filter(
        Student.school_id == school_id, Student.is_deleted.is_(False)
    )
    if class_ids:
        student_q = student_q.filter(Student.class_id.in_(class_ids))
    if section_ids:
        student_q = student_q.filter(Student.section_id.in_(section_ids))
    students_count = student_q.count()

    guardian_q = (
        db.session.query(func.count(func.distinct(Guardian.id)))
        .join(Student, Guardian.student_id == Student.id)
        .filter(
            Guardian.school_id == school_id,
            Guardian.is_deleted.is_(False),
            Student.is_deleted.is_(False),
        )
    )
    if class_ids:
        guardian_q = guardian_q.filter(Student.class_id.in_(class_ids))
    if section_ids:
        guardian_q = guardian_q.filter(Student.section_id.in_(section_ids))
    guardians_count = int(guardian_q.scalar() or 0)

    if audience == "students":
        estimated = students_count
    elif audience == "parents":
        estimated = guardians_count
    else:
        estimated = students_count + guardians_count

    return {
        "students_count": students_count,
        "guardians_count": guardians_count,
        "estimated_reach": estimated,
        "estimate_basis": (
            "In-school audience: matched students + guardians counted from "
            "this school's own database. Not a Meta impression forecast."
        ),
    }


def _campaign_dict(campaign, include_estimate=True):
    out = campaign.to_dict()
    if include_estimate:
        out["audience_estimate"] = _audience_estimate(
            g.school_id, campaign.targeting
        )
    return out


def _get_campaign(campaign_id):
    """Tenant-scoped fetch; bad UUIDs simply miss (404, not 500)."""
    try:
        return AdCampaign.query.filter_by(
            id=campaign_id, school_id=g.school_id, is_deleted=False
        ).first()
    except Exception:  # invalid uuid format → DataError
        return None


# ── Campaign CRUD ─────────────────────────────────────────────────────────

@social_ads_bp.route("/campaigns", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def list_campaigns():
    """Campaigns for this school (?status, ?objective) + honest stats."""
    query = AdCampaign.query.filter_by(school_id=g.school_id, is_deleted=False)
    status = (request.args.get("status") or "").strip()
    if status:
        query = query.filter_by(status=status)
    objective = (request.args.get("objective") or "").strip()
    if objective:
        query = query.filter_by(objective=objective)
    campaigns = query.order_by(AdCampaign.created_at.desc()).all()

    items = [_campaign_dict(c) for c in campaigns]
    stats = {
        "total": len(campaigns),
        "active": sum(1 for c in campaigns if c.status == "active"),
        "paused": sum(1 for c in campaigns if c.status == "paused"),
        # Real counters only — 0 until actual delivery is wired (no Meta API).
        "total_reach": sum(c.reach or 0 for c in campaigns),
        "impressions": sum(c.impressions or 0 for c in campaigns),
        "clicks": sum(c.clicks or 0 for c in campaigns),
        "estimated_audience": sum(
            i["audience_estimate"]["estimated_reach"] for i in items
        ),
    }
    return success_response({"items": items, "stats": stats})


@social_ads_bp.route("/campaigns", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def create_campaign():
    """Create a campaign. Targeting is validated against real school data."""
    data = request.get_json(silent=True) or {}

    name = _sanitize_plain(str(data.get("name") or ""))[:200]
    if not name:
        return error_response("name is required", 400)

    platform = data.get("platform") or "facebook"
    if platform not in PLATFORMS:
        return error_response(
            f"platform must be one of {', '.join(PLATFORMS)}", 400
        )

    objective = data.get("objective") or "admission"
    if objective not in OBJECTIVES:
        return error_response(
            f"objective must be one of {', '.join(OBJECTIVES)}", 400
        )

    total_budget = _parse_budget(data.get("budget", data.get("total_budget_npr")))
    if data.get("budget", data.get("total_budget_npr")) not in (None, "") \
            and total_budget is None:
        return error_response("budget must be a positive number", 400)
    daily_budget = _parse_budget(data.get("daily_budget_npr"))
    if data.get("daily_budget_npr") not in (None, "") and daily_budget is None:
        return error_response("daily_budget_npr must be a positive number", 400)

    start_date = _parse_dt(data.get("start_date"))
    if data.get("start_date") and start_date is None:
        return error_response("start_date must be an ISO date/datetime", 400)
    end_date = _parse_dt(data.get("end_date"))
    if data.get("end_date") and end_date is None:
        return error_response("end_date must be an ISO date/datetime", 400)
    if start_date and end_date and end_date < start_date:
        return error_response("end_date must be after start_date", 400)

    targeting, err = _validate_targeting(data)
    if err is not None:
        return err

    media_url, err = _sanitize_media_url(data.get("media_url"))
    if err is not None:
        return error_response(err, 400)

    campaign = AdCampaign(
        school_id=g.school_id,
        name=name,
        content=_sanitize_html(data.get("content") or "") or None,
        media_url=media_url,
        platform=platform,
        objective=objective,
        status="draft",
        targeting=targeting,
        total_budget_npr=total_budget,
        daily_budget_npr=daily_budget,
        start_date=start_date,
        end_date=end_date,
    )
    post_id = (data.get("post_id") or "").strip() or None
    if post_id:
        # Must reference an existing post of THIS school (any state).
        from app.models.social import SocialPost

        post = SocialPost.query.filter_by(
            id=post_id, school_id=g.school_id
        ).first()
        if post is None:
            return error_response("Unknown post_id for this school", 400)
        campaign.post_id = post.id

    db.session.add(campaign)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to create campaign", 500)
    return created_response(_campaign_dict(campaign))


@social_ads_bp.route("/campaigns/preview", methods=["GET", "POST"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def preview_audience():
    """Honest audience estimate for a targeting draft (no campaign row).

    Query params (GET): class_ids, section_ids (comma-separated), audience.
    JSON body (POST): the same targeting shape used on create.
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = {
            "class_ids": request.args.get("class_ids"),
            "section_ids": request.args.get("section_ids"),
            "audience": request.args.get("audience"),
        }
    targeting, err = _validate_targeting(data)
    if err is not None:
        return err
    estimate = _audience_estimate(g.school_id, targeting)
    return success_response({"targeting": targeting, **estimate})


@social_ads_bp.route("/campaigns/<campaign_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def get_campaign(campaign_id):
    campaign = _get_campaign(campaign_id)
    if campaign is None:
        return error_response("Campaign not found", 404)
    return success_response(_campaign_dict(campaign))


@social_ads_bp.route("/campaigns/<campaign_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def update_campaign(campaign_id):
    """Update editable fields. status follows the allowed transition map."""
    campaign = _get_campaign(campaign_id)
    if campaign is None:
        return error_response("Campaign not found", 404)

    data = request.get_json(silent=True) or {}
    if not data:
        return error_response("No fields to update", 400)

    if "name" in data:
        name = _sanitize_plain(str(data.get("name") or ""))[:200]
        if not name:
            return error_response("name cannot be empty", 400)
        campaign.name = name
    if "content" in data:
        campaign.content = _sanitize_html(data.get("content") or "") or None
    if "media_url" in data:
        media_url, err = _sanitize_media_url(data.get("media_url"))
        if err is not None:
            return error_response(err, 400)
        campaign.media_url = media_url
    if "platform" in data:
        if data["platform"] not in PLATFORMS:
            return error_response(
                f"platform must be one of {', '.join(PLATFORMS)}", 400
            )
        campaign.platform = data["platform"]
    if "objective" in data:
        if data["objective"] not in OBJECTIVES:
            return error_response(
                f"objective must be one of {', '.join(OBJECTIVES)}", 400
            )
        campaign.objective = data["objective"]
    if "budget" in data or "total_budget_npr" in data:
        raw = data.get("budget", data.get("total_budget_npr"))
        if raw in (None, ""):
            campaign.total_budget_npr = None
        else:
            amount = _parse_budget(raw)
            if amount is None:
                return error_response("budget must be a positive number", 400)
            campaign.total_budget_npr = amount
    if "daily_budget_npr" in data:
        raw = data.get("daily_budget_npr")
        if raw in (None, ""):
            campaign.daily_budget_npr = None
        else:
            amount = _parse_budget(raw)
            if amount is None:
                return error_response(
                    "daily_budget_npr must be a positive number", 400
                )
            campaign.daily_budget_npr = amount
    for field in ("start_date", "end_date"):
        if field in data:
            parsed = _parse_dt(data.get(field))
            if data.get(field) and parsed is None:
                return error_response(f"{field} must be an ISO date/datetime", 400)
            setattr(campaign, field, parsed)
    if campaign.start_date and campaign.end_date \
            and campaign.end_date < campaign.start_date:
        return error_response("end_date must be after start_date", 400)

    if "status" in data:
        new_status = data.get("status")
        if new_status not in STATUSES:
            return error_response(
                f"status must be one of {', '.join(STATUSES)}", 400
            )
        allowed = STATUS_TRANSITIONS.get(campaign.status or "draft", set())
        if new_status != campaign.status and new_status not in allowed:
            return error_response(
                f"Cannot move campaign from '{campaign.status}' "
                f"to '{new_status}'", 400
            )
        campaign.status = new_status

    if any(k in data for k in ("class_ids", "section_ids", "audience",
                               "target_audience", "note")):
        merged = dict(campaign.targeting or {})
        for k in ("class_ids", "section_ids", "audience"):
            if k in data:
                merged[k] = data[k]
        # A new free-text audience note must not lose to the stored one.
        if "note" in data or "target_audience" in data:
            merged.pop("note", None)
            merged.pop("target_audience", None)
            if "note" in data:
                merged["note"] = data["note"]
            if "target_audience" in data:
                merged["target_audience"] = data["target_audience"]
        targeting, err = _validate_targeting(merged)
        if err is not None:
            return err
        campaign.targeting = targeting

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to update campaign", 500)
    return success_response(_campaign_dict(campaign))


@social_ads_bp.route("/campaigns/<campaign_id>/pause", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def pause_campaign(campaign_id):
    """active → paused."""
    campaign = _get_campaign(campaign_id)
    if campaign is None:
        return error_response("Campaign not found", 404)
    if campaign.status != "active":
        return error_response(
            f"Only active campaigns can be paused (current: {campaign.status})",
            400,
        )
    campaign.status = "paused"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to pause campaign", 500)
    return success_response(_campaign_dict(campaign))


@social_ads_bp.route("/campaigns/<campaign_id>/resume", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def resume_campaign(campaign_id):
    """paused → active."""
    campaign = _get_campaign(campaign_id)
    if campaign is None:
        return error_response("Campaign not found", 404)
    if campaign.status != "paused":
        return error_response(
            f"Only paused campaigns can be resumed (current: {campaign.status})",
            400,
        )
    campaign.status = "active"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to resume campaign", 500)
    return success_response(_campaign_dict(campaign))


@social_ads_bp.route("/campaigns/<campaign_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("social_ads")
@role_required("school_admin")
def delete_campaign(campaign_id):
    """Soft delete."""
    campaign = _get_campaign(campaign_id)
    if campaign is None:
        return error_response("Campaign not found", 404)
    campaign.is_deleted = True
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to delete campaign", 500)
    return success_response({"deleted": True, "id": str(campaign.id)})
