"""Multi-Branch Chain API — org/branch registry + cross-branch analytics
(premium plugin, NPR 2999).

A chain is owned by a parent School (the organisation). Branches are real
School tenants linked via SchoolChainMember. All aggregate queries are
tenant-scoped to the owner's own branches, so a chain admin can only ever
see their own chain's numbers.

Routes (mounted under /api/v1):
  GET    /schools/chain/overview          per-branch rollup + stats
  GET    /schools/chain/dashboard         unified dashboard (totals + branches)
  GET    /schools/chain/analytics         period metrics + branch rankings
  GET    /schools/branches                branch registry (chain-owned only)
  POST   /schools/branches                create a branch tenant / link existing
  PATCH  /schools/branches/<member_id>    update branch (owner school admins)
  DELETE /schools/branches/<member_id>    unlink branch from chain
"""

from datetime import date, datetime, timedelta

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func

from app.models.fee import FeeCollection
from app.models.attendance import Attendance
from app.models.school import School
from app.models.school_chain import SchoolChain, SchoolChainMember
from app.models.student import Student
from app.models.user import User
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.response import created_response, error_response, success_response
from extensions import db

multi_branch_bp = Blueprint("multi_branch", __name__, url_prefix="/schools")

STAFF_ROLES = ("teacher", "staff", "accountant", "school_admin")
PERIODS = ("this_month", "this_year", "last_year")


# ── Helpers ───────────────────────────────────────────────────────────────

def _slugify(raw: str) -> str:
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", str(raw or "").lower()).strip("-")
    return slug[:90] or "branch"


def _chain_or_none():
    """The chain owned by the requesting school (parent), if any."""
    return SchoolChain.query.filter_by(school_id=g.school_id, is_deleted=False).first()


def _require_chain():
    """Return (chain, None) or (None, error_response) when not a chain owner."""
    chain = _chain_or_none()
    if not chain:
        return None, error_response(
            "School is not a chain owner. Create a branch first to start a chain.",
            403,
        )
    return chain, None


def _chain_members(chain):
    return (
        SchoolChainMember.query.filter_by(chain_id=chain.id, is_deleted=False)
        .order_by(SchoolChainMember.created_at.asc())
        .all()
    )


def _period_window(period: str):
    """(start_date, end_date) inclusive for the requested analytics period."""
    today = date.today()
    if period == "this_year":
        return date(today.year, 1, 1), today
    if period == "last_year":
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)
    # this_month (default)
    return today.replace(day=1), today


def _previous_window(start: date, end: date):
    """Immediate equal-length window before (start, end)."""
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - (end - start)
    return prev_start, prev_end


def _fee_sums(school_ids, start: date, end: date):
    """{school_id: (paid_amount, invoiced_amount)} for real FeeCollection rows."""
    when = func.coalesce(FeeCollection.collected_at, FeeCollection.created_at)
    rows = (
        db.session.query(
            FeeCollection.school_id,
            func.coalesce(
                func.sum(case((FeeCollection.payment_status == "paid", FeeCollection.amount), else_=0)),
                0,
            ),
            func.coalesce(func.sum(FeeCollection.amount), 0),
        )
        .filter(
            FeeCollection.school_id.in_(school_ids),
            FeeCollection.is_deleted.is_(False),
            when >= datetime.combine(start, datetime.min.time()),
            when < datetime.combine(end + timedelta(days=1), datetime.min.time()),
        )
        .group_by(FeeCollection.school_id)
        .all()
    )
    return {sid: (float(paid or 0), float(total or 0)) for sid, paid, total in rows}


def _attendance_rates(school_ids, start: date, end: date):
    """{school_id: (attended, total)} — present/late count as attended."""
    rows = (
        db.session.query(
            Attendance.school_id,
            func.sum(
                case((Attendance.status.in_(("present", "late")), 1), else_=0)
            ),
            func.count(Attendance.id),
        )
        .filter(
            Attendance.school_id.in_(school_ids),
            Attendance.is_deleted.is_(False),
            Attendance.date >= start,
            Attendance.date <= end,
        )
        .group_by(Attendance.school_id)
        .all()
    )
    return {sid: (int(attended or 0), int(total or 0)) for sid, attended, total in rows}


def _pct(part, whole):
    return round(part / whole * 100, 1) if whole else None


def _composite_score(attendance_rate, fee_rate):
    """Honest derived score: 50% attendance + 50% fee collection rate."""
    parts = [p for p in (attendance_rate, fee_rate) if p is not None]
    if not parts:
        return None
    return round(sum(parts) / len(parts), 1)


def _branch_metrics(members, start: date, end: date):
    """Aggregate real per-branch counts for the given window."""
    ids = [m.school_id for m in members]
    if not ids:
        return {}

    students = dict(
        db.session.query(Student.school_id, func.count(Student.id))
        .filter(
            Student.school_id.in_(ids),
            Student.is_deleted.is_(False),
            Student.status == "active",
        )
        .group_by(Student.school_id)
        .all()
    )
    staff = dict(
        db.session.query(User.school_id, func.count(User.id))
        .filter(
            User.school_id.in_(ids),
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.role.in_(STAFF_ROLES),
        )
        .group_by(User.school_id)
        .all()
    )
    fees = _fee_sums(ids, start, end)
    attendance = _attendance_rates(ids, start, end)

    metrics = {}
    for sid in ids:
        attended, marked = attendance.get(sid, (0, 0))
        attendance_rate = _pct(attended, marked)
        paid, invoiced = fees.get(sid, (0.0, 0.0))
        fee_rate = _pct(paid, invoiced)
        metrics[sid] = {
            "students": int(students.get(sid, 0)),
            "staff": int(staff.get(sid, 0)),
            "revenue": paid,
            "attendance_rate": attendance_rate,
            "fee_rate": fee_rate,
            "performance_score": _composite_score(attendance_rate, fee_rate),
        }
    return metrics


# ── Chain overview / dashboard / analytics ────────────────────────────────

@multi_branch_bp.route("/chain/overview", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def chain_overview():
    """Per-branch rollup (students, staff, performance) for the owner's chain."""
    chain, err = _require_chain()
    if err:
        return err

    members = _chain_members(chain)
    today = date.today()
    metrics = _branch_metrics(members, today.replace(day=1), today)

    branches = []
    for m in members:
        bm = metrics.get(m.school_id, {})
        branches.append(
            {
                **m.to_dict(),
                "student_count": bm.get("students", 0),
                "staff_count": bm.get("staff", 0),
                "performance_score": bm.get("performance_score"),
            }
        )

    scores = [b["performance_score"] for b in branches if b["performance_score"] is not None]
    return success_response(
        {
            "chain": chain.to_dict(),
            "branches": branches,
            "stats": {
                "total_branches": len(branches),
                "total_students": sum(b["student_count"] for b in branches),
                "total_staff": sum(b["staff_count"] for b in branches),
                "avg_performance": round(sum(scores) / len(scores), 1) if scores else None,
                "fee_collection_this_month": round(
                    sum(metrics[m.school_id]["revenue"] for m in members if m.school_id in metrics), 2
                ),
            },
        }
    )


@multi_branch_bp.route("/chain/dashboard", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def chain_dashboard():
    """Unified dashboard: chain totals + per-branch cards for this month."""
    chain, err = _require_chain()
    if err:
        return err

    members = _chain_members(chain)
    today = date.today()
    metrics = _branch_metrics(members, today.replace(day=1), today)

    branches = []
    for m in members:
        bm = metrics.get(m.school_id, {})
        branches.append(
            {
                **m.to_dict(),
                "student_count": bm.get("students", 0),
                "staff_count": bm.get("staff", 0),
                "attendance_rate": bm.get("attendance_rate"),
                "performance_score": bm.get("performance_score"),
            }
        )

    att_parts = _attendance_rates([m.school_id for m in members], today.replace(day=1), today)
    total_marked = sum(t for _, t in att_parts.values())
    total_attended = sum(a for a, _ in att_parts.values())

    totals = {
        "students": sum(metrics[m.school_id]["students"] for m in members if m.school_id in metrics),
        "staff": sum(metrics[m.school_id]["staff"] for m in members if m.school_id in metrics),
        "attendance": _pct(total_attended, total_marked),
        "revenue": round(sum(metrics[m.school_id]["revenue"] for m in members if m.school_id in metrics), 2),
    }

    return success_response({"totals": totals, "branches": branches})


@multi_branch_bp.route("/chain/analytics", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def chain_analytics():
    """Period metrics (with change vs previous period) + branch rankings."""
    chain, err = _require_chain()
    if err:
        return err

    period = request.args.get("period", "this_month")
    if period not in PERIODS:
        return error_response(f"period must be one of {', '.join(PERIODS)}", 400)

    members = _chain_members(chain)
    start, end = _period_window(period)
    prev_start, prev_end = _previous_window(start, end)

    cur = _branch_metrics(members, start, end)
    prev = _branch_metrics(members, prev_start, prev_end)

    def _chain_total(ms, key):
        return sum(m[key] for m in ms.values())

    def _change(cur_val, prev_val):
        if cur_val is None or prev_val in (None, 0):
            return None
        return round((cur_val - prev_val) / prev_val * 100, 1)

    revenue = _chain_total(cur, "revenue")
    prev_revenue = _chain_total(prev, "revenue")
    new_students = (
        Student.query.filter(
            Student.school_id.in_([m.school_id for m in members] or [None]),
            Student.is_deleted.is_(False),
            Student.created_at >= datetime.combine(start, datetime.min.time()),
            Student.created_at < datetime.combine(end + timedelta(days=1), datetime.min.time()),
        ).count()
        if members
        else 0
    )
    prev_students = (
        Student.query.filter(
            Student.school_id.in_([m.school_id for m in members]),
            Student.is_deleted.is_(False),
            Student.created_at >= datetime.combine(prev_start, datetime.min.time()),
            Student.created_at < datetime.combine(prev_end + timedelta(days=1), datetime.min.time()),
        ).count()
        if members
        else 0
    )

    att_parts_cur = _attendance_rates([m.school_id for m in members], start, end)
    att_parts_prev = _attendance_rates([m.school_id for m in members], prev_start, prev_end)
    att = _pct(
        sum(a for a, _ in att_parts_cur.values()),
        sum(t for _, t in att_parts_cur.values()),
    )
    prev_att = _pct(
        sum(a for a, _ in att_parts_prev.values()),
        sum(t for _, t in att_parts_prev.values()),
    )

    metrics = [
        {
            "label": "Chain Revenue",
            "value": f"Rs. {revenue:,.0f}",
            "change": _change(revenue, prev_revenue),
        },
        {
            "label": "New Students",
            "value": str(new_students),
            "change": _change(new_students, prev_students),
        },
        {
            "label": "Avg Attendance",
            "value": f"{att}%" if att is not None else "—",
            "change": round((att - prev_att), 1) if att is not None and prev_att is not None else None,
        },
    ]

    rankings = []
    for m in members:
        cm = cur.get(m.school_id, {})
        pm = prev.get(m.school_id, {})
        score = cm.get("performance_score")
        prev_score = pm.get("performance_score")
        trend = (
            round(score - prev_score, 1)
            if score is not None and prev_score is not None
            else 0
        )
        rankings.append({"id": str(m.school_id), "name": m.school.name, "score": score, "trend": trend})
    rankings.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0)))

    return success_response({"period": period, "metrics": metrics, "branch_rankings": rankings})


# ── Branch registry (CRUD) ────────────────────────────────────────────────

@multi_branch_bp.route("/branches", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def list_branches():
    """Branch registry for the owner's chain. Non-chain schools get an empty list."""
    chain = _chain_or_none()
    if not chain:
        return success_response({"chain": None, "items": []})

    members = _chain_members(chain)
    search = (request.args.get("search") or "").strip()
    if search:
        members = [
            m for m in members
            if search.lower() in (m.school.name if m.school else "").lower()
            or search.lower() in (m.code or "").lower()
        ]
    return success_response({"chain": chain.to_dict(), "items": [m.to_dict() for m in members]})


@multi_branch_bp.route("/branches", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def create_branch():
    """Create a branch: either a new School tenant, or link an existing school
    (body {"school_id": ...}). First branch implicitly starts the chain."""
    chain = _chain_or_none()
    data = request.get_json(silent=True) or {}

    try:
        if chain is None:
            owner = School.query.get(g.school_id)
            chain = SchoolChain(
                school_id=g.school_id,
                name=f"{owner.name} Group",
                created_by_id=g.current_user_id,
            )
            db.session.add(chain)
            db.session.flush()

        if data.get("school_id"):
            branch_school = _validate_existing_school(data["school_id"])
        else:
            branch_school = _create_branch_school(data)

        code = (data.get("code") or "").strip() or None
        if code and any(
            m.code == code for m in _chain_members(chain)
        ):
            raise ValueError(f"Branch code '{code}' already exists in this chain")

        member = SchoolChainMember(
            school_id=branch_school.id,
            chain_id=chain.id,
            code=code,
            principal_name=(data.get("principal_name") or "").strip() or None,
            is_active=True,
            added_by_id=g.current_user_id,
        )
        db.session.add(member)
        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return error_response(str(e), 400)
    except Exception:
        db.session.rollback()
        return error_response("Failed to create branch", 500)

    return created_response(member.to_dict())


def _validate_existing_school(raw_school_id):
    """A school may be linked as a branch only if it is a free-standing tenant."""
    try:
        school = School.query.get(str(raw_school_id).strip())
    except Exception:
        school = None
    if not school or school.is_deleted:
        raise ValueError("School to link not found")
    if str(school.id) == str(g.school_id):
        raise ValueError("Cannot link the chain owner as its own branch")
    if not school.is_active:
        raise ValueError("Cannot link an inactive school")
    already_member = SchoolChainMember.query.filter_by(
        school_id=school.id, is_deleted=False
    ).first()
    if already_member:
        raise ValueError("School already belongs to a chain")
    owns_chain = SchoolChain.query.filter_by(school_id=school.id, is_deleted=False).first()
    if owns_chain:
        raise ValueError("School is itself a chain owner")
    return school


def _create_branch_school(data):
    """Create a real branch School tenant from the Add-Branch form."""
    name = (data.get("name") or "").strip()
    if not name:
        raise ValueError("Branch name is required")

    base = _slugify(data.get("code") or name)
    slug = base
    suffix = 2
    while School.query.filter_by(slug=slug).first() is not None:
        slug = f"{base}-{suffix}"
        suffix += 1

    school = School(
        name=name,
        slug=slug,
        plan="free",
        status="active",
        is_active=True,
        max_students=100,
        address=(data.get("address") or "").strip() or None,
        phone=(data.get("phone") or "").strip() or None,
        email=(data.get("email") or "").strip() or None,
        owner_id=g.current_user_id,
    )
    db.session.add(school)
    db.session.flush()
    return school


def _owned_member_or_error(member_id):
    """Fetch a live chain member of the requester's chain, with role guard."""
    member = SchoolChainMember.query.filter_by(id=member_id, is_deleted=False).first()
    if not member:
        return None, error_response("Branch not found", 404)
    chain = SchoolChain.query.get(member.chain_id)
    if not chain or str(chain.school_id) != str(g.school_id):
        return None, error_response("Branch does not belong to your chain", 403)
    return member, None


@multi_branch_bp.route("/branches/<member_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def update_branch(member_id):
    """Update branch registry fields; name/address/phone/email write through
    to the branch School tenant."""
    member, err = _owned_member_or_error(member_id)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    if not data:
        return error_response("No fields to update", 400)

    try:
        if "code" in data:
            code = (data.get("code") or "").strip() or None
            if code and any(
                m.code == code and str(m.id) != str(member.id)
                for m in _chain_members(SchoolChain.query.get(member.chain_id))
            ):
                raise ValueError(f"Branch code '{code}' already exists in this chain")
            member.code = code
        if "principal_name" in data:
            member.principal_name = (data.get("principal_name") or "").strip() or None
        if "is_active" in data:
            member.is_active = bool(data.get("is_active"))

        school = School.query.get(member.school_id)
        if school:
            if "name" in data and (data.get("name") or "").strip():
                school.name = data["name"].strip()
            if "address" in data:
                school.address = (data.get("address") or "").strip() or None
            if "phone" in data:
                school.phone = (data.get("phone") or "").strip() or None
            if "email" in data:
                school.email = (data.get("email") or "").strip() or None

        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return error_response(str(e), 400)
    except Exception:
        db.session.rollback()
        return error_response("Failed to update branch", 500)

    return success_response(member.to_dict())


@multi_branch_bp.route("/branches/<member_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("multi_branch")
@role_required("superadmin", "school_admin")
def remove_branch(member_id):
    """Unlink a branch from the chain. The School tenant itself is not deleted."""
    member, err = _owned_member_or_error(member_id)
    if err:
        return err

    try:
        member.is_deleted = True
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error_response("Failed to remove branch", 500)

    return success_response({"removed": True, "school_id": str(member.school_id)})
