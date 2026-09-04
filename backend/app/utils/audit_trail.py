"""D-07: audit trail — SQLAlchemy before_flush listener.

Writes audit_logs rows for a configured set of sensitive tables on
INSERT/UPDATE/DELETE, capturing actor (g.user_id), school, old/new values
for changed columns only. Fail-open by design (an audit failure must never
block a business transaction — but it logs loudly).
"""
import json
import logging

from flask import g

logger = logging.getLogger(__name__)

# Tables under audit (D-07): money, identity, grades, access control.
AUDITED_TABLES = {
    "fee_collections",
    "fee_receipts",
    "fee_refunds",
    "marks",
    "report_cards",
    "staff_payroll",
    "student_scholarships",
    "users",
    "school_plugins",
}

# Columns never recorded (secrets / churn)
_SKIP_COLUMNS = {"updated_at", "password_hash", "totp_secret"}


# Per-session ledger of (obj, col) -> committed value, recorded at
# attribute-set time via the SQLAlchemy `set` event. `load_history()` cannot
# provide old values for attributes that were expired (deleted=()) — the
# committed value must be captured BEFORE it is overwritten.
_SET_LEDGER: dict[int, dict[str, object]] = {}


_NO_VALUE = object()  # sentinel from sqlalchemy LoaderCallableStatus


def _record_old_value(target, value, oldvalue, initiator) -> None:
    try:
        table = getattr(target.__table__, "name", None)
        if table not in AUDITED_TABLES:
            return
        if initiator.key in _SKIP_COLUMNS:
            return
        if type(oldvalue).__name__ == "LoaderCallableStatus":
            # expired attribute: committed value not resident; before_flush
            # resolves it from the DB row.
            oldvalue = _NO_VALUE
        ledger = _SET_LEDGER.setdefault(id(target), {})
        if initiator.key not in ledger:
            ledger[initiator.key] = oldvalue
    except Exception:  # noqa: BLE001 — never break attribute sets
        pass


def _actor():
    try:
        return getattr(g, "user_id", None), getattr(g, "school_id", None)
    except Exception:  # outside request context (celery) — best effort
        return None, None


def _jsonable(value):
    """Coerce any column value into JSON-serializable form (UUID, Decimal,
    datetime, enums...)."""
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    from decimal import Decimal

    if isinstance(value, Decimal):
        return float(value)
    from uuid import UUID

    if isinstance(value, UUID):
        return str(value)
    from datetime import date, datetime, time as dtime

    if isinstance(value, (datetime, date, dtime)):
        return value.isoformat()
    return str(value)


def _snapshot(obj, live: bool = False) -> dict:
    """Snapshot column values. live=True reads object attributes (INSERT:
    pending values not yet in load_history); False reads the committed
    state (DELETE)."""
    data = {}
    if live:
        for col in obj.__table__.columns:
            if col.name in _SKIP_COLUMNS:
                continue
            data[col.name] = _jsonable(getattr(obj, col.name, None))
        return data
    state = _state_of(obj)
    for col in obj.__table__.columns:
        if col.name in _SKIP_COLUMNS:
            continue
        data[col.name] = _jsonable(state.get(col.name))
    return data


def _state_of(obj) -> dict:
    """Current DB state for objects in a flush (for UPDATE old-values)."""
    from sqlalchemy import inspect as sa_inspect

    insp = sa_inspect(obj)
    state = {}
    for attr in insp.attrs:
        hist = attr.load_history()
        if hist.deleted:
            state[attr.key] = hist.deleted[0]
        elif hist.unchanged:
            state[attr.key] = hist.unchanged[0]
    return state


def before_flush(session, flush_context, instances) -> None:
    try:
        from app.models.compliance import AuditLog
        from extensions import db

        actor_id, school_id = _actor()
        pending = []

        for obj in session.new:
            table = getattr(obj.__table__, "name", None)
            if table in AUDITED_TABLES:
                pending.append(
                    AuditLog(
                        school_id=getattr(obj, "school_id", None) or school_id,
                        user_id=getattr(obj, "created_by_id", None) or actor_id,
                        action="create",
                        resource_type=table,
                        resource_id=getattr(obj, "id", None),
                        new_values=_snapshot(obj, live=True),
                    )
                )

        for obj in session.dirty:
            table = getattr(obj.__table__, "name", None)
            if table not in AUDITED_TABLES:
                continue
            if not session.is_modified(obj):
                continue
            from sqlalchemy import inspect as sa_inspect

            insp = sa_inspect(obj)
            changes = {}
            ledger = _SET_LEDGER.get(id(obj), {})
            # One committed-row read resolves every expired (NO_VALUE) entry.
            needs_db = [c for c, v in ledger.items() if v is _NO_VALUE]
            committed: dict = {}
            if needs_db and getattr(obj, "id", None):
                row = (
                    db.session.query(obj.__table__)
                    .filter(obj.__table__.c.id == obj.id)
                    .first()
                )
                if row is not None:
                    committed = dict(row._mapping)
            for attr in insp.attrs:
                hist = attr.load_history()
                if not hist.has_changes():
                    continue
                col = attr.key
                if col in _SKIP_COLUMNS:
                    continue
                raw_old = ledger.get(col)
                if raw_old is _NO_VALUE:
                    raw_old = committed.get(col)
                old = raw_old if raw_old is not _NO_VALUE else (
                    hist.deleted[0] if hist.deleted else None
                )
                new = hist.added[0] if hist.added else None
                changes[col] = {"old": _jsonable(old), "new": _jsonable(new)}
            _SET_LEDGER.pop(id(obj), None)
            if changes:
                old_values = {k: v["old"] for k, v in changes.items()}
                new_values = {k: v["new"] for k, v in changes.items()}
                pending.append(
                    AuditLog(
                        school_id=getattr(obj, "school_id", None) or school_id,
                        user_id=actor_id,
                        action="update",
                        resource_type=table,
                        resource_id=getattr(obj, "id", None),
                        old_values=old_values,
                        new_values=new_values,
                    )
                )

        for obj in session.deleted:
            table = getattr(obj.__table__, "name", None)
            if table in AUDITED_TABLES:
                pending.append(
                    AuditLog(
                        school_id=getattr(obj, "school_id", None) or school_id,
                        user_id=actor_id,
                        action="delete",
                        resource_type=table,
                        resource_id=getattr(obj, "id", None),
                        old_values=_snapshot(obj),
                    )
                )

        if pending:
            session.add_all(pending)
    except Exception:  # noqa: BLE001 — audit must never break the transaction
        logger.exception("audit trail write failed")


def register_audit_listeners() -> None:
    from sqlalchemy import event
    from extensions import db

    event.listen(db.session, "before_flush", before_flush)
    # `set` listens on the instrumented ATTRIBUTE (column), not the mapper.
    for cls, cols in _audited_columns().items():
        for col in cols:
            attr = getattr(cls, col, None)
            if attr is not None:
                event.listen(attr, "set", _record_old_value)


def _audited_columns() -> dict:
    """Audited table -> (class, [column names to track]) — the money/grade
    columns worth an old/new trail (full-row snapshots come from before_flush)."""
    from app.models.exam import Marks, ReportCard
    from app.models.fee import FeeCollection, FeeReceipt, FeeRefund, StudentScholarship
    from app.models.user import User
    from app.models.hr_payroll import StaffPayroll
    from app.models.plugin import SchoolPlugin

    return {
        Marks: ["theory_marks", "practical_marks", "total_marks", "grade", "gpa", "is_withheld"],
        ReportCard: ["overall_grade", "overall_gpa", "total_percentage", "rank_in_class"],
        FeeCollection: ["amount", "discount_amount", "payment_status", "payment_method"],
        FeeReceipt: ["amount", "receipt_number"],
        FeeRefund: ["amount", "status"],
        StudentScholarship: ["discount_value", "is_active"],
        User: ["role", "is_active", "school_id"],
        StaffPayroll: ["basic_salary", "net_salary", "status"],
        SchoolPlugin: ["active", "is_trial"],
    }
