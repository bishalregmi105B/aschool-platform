"""Fees billing-cycle simulation — 14 BS months, 30 students, 3 fee types.

ROLLBACK-SAFE: the app's scoped session is swapped for one whose get_bind
always returns a single outer Connection that was begun BEFORE any fixture
work (join_transaction_mode="create_savepoint"). Every internal
db.session.commit() only RELEASES A SAVEPOINT inside that outer transaction;
the outer transaction is rolled back on exit, so the real dev database is
left untouched (verified at the end against a fresh connection).

Run INSIDE the flask container (the DB port is not published to the host):

    docker exec aschool-flask-1 python tmp_fees_simulation.py

What it verifies (prints [PASS]/[FAIL] per check + a summary, exits non-zero
on any failure):
  1. 14 consecutive BS months of bill generation via _apply_fee_structure()
     (the service behind /fees/batch-monthly): monthly Tuition (2500, due_day
     10), monthly Transport (1200, due_day 5) and a ONE-TIME Exam Fee (3000).
  2. Due math per month: net payable = base + late_fine − discount, floored
     at 0; a 10% tuition scholarship discounts exactly the matching item.
  3. Idempotency: re-running every month creates ZERO duplicates, and the
     cron generator (_generate_monthly_fees_for_school) skips everything the
     manual path already billed — both marker directions.
  4. Defaulter detection thresholds: students with due > 0 are flagged, a
     fully-paid student is not; the reminder overdue cutoff
     (reminder_overdue_days) excludes fresh bills and includes backdated ones.
  5. Reminder payload correctness: send_single_fee_reminder() returns the
     right phone/amount and the SMS message carries the student name, amount
     and billing-period label — with the Celery sender stubbed (no broker,
     no SMS sent); kill-switch (reminder_enabled=false) aborts cleanly.
  6. payment math on one bill: partial then full settlement; ephemeral
     due_date derivation from [due_day:N] + the bill's BS month.
"""
import sys
import traceback
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

try:
    from app import create_app
    from extensions import db
except ImportError as exc:  # pragma: no cover
    print(f"SKIP: cannot import the Flask app ({exc}) — run from backend/ with the venv.")
    sys.exit(0)

app = create_app()
app.config["TESTING"] = True
_ctx = app.app_context()
_ctx.push()

import nepali_datetime
from sqlalchemy import text as _sqltext

CHECKS = []


def check(label, cond, detail=""):
    CHECKS.append((label, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {label}" + (f"  — {detail}" if detail and not cond else ""))


# ── rollback-safe session ──────────────────────────────────────────────────
# flask_sqlalchemy's Session.get_bind resolves the DEFAULT ENGINE and ignores
# any session-level bind, so configure(bind=...) is a no-op for model queries.
# Instead: begin an outer transaction on one connection and force EVERY
# get_bind to return that Connection. The session then joins the external
# transaction in create_savepoint mode: commit()/rollback() become savepoint
# operations and the connection is never closed behind our back.
connection = db.engine.connect()
outer_txn = connection.begin()
real_session = db.session
from flask_sqlalchemy.session import Session as _FSASession

_orig_get_bind = _FSASession.get_bind


def _outer_get_bind(self, mapper=None, clause=None, bind=None, **kwargs):
    if bind is None:
        return connection
    return _orig_get_bind(self, mapper=mapper, clause=clause, bind=bind, **kwargs)


_FSASession.get_bind = _outer_get_bind
db.session = db._make_scoped_session(
    options=dict(join_transaction_mode="create_savepoint")
)

DB_URL = (app.config.get("SQLALCHEMY_DATABASE_URI") or "").split("@")[-1]
print(f"DB target : ...@{DB_URL}")
print("SAFETY    : single outer transaction + savepoints — rolled back on exit.\n")


def cleanup(exit_code):
    """Discard EVERYTHING, restore the real session, prove nothing persisted."""
    try:
        db.session.remove()
    finally:
        _FSASession.get_bind = _orig_get_bind
        db.session = real_session
        try:
            outer_txn.rollback()
        finally:
            connection.close()
    probe = db.engine.connect()
    try:
        # only THIS run's fixture slug — a different feesim-* row would be a
        # leftover from some other (non-rollback) run, not this one.
        leftover = probe.execute(
            _sqltext("SELECT count(*) FROM schools WHERE slug = :s"),
            {"s": f"feesim-{SUFFIX}"},
        ).scalar()
    finally:
        probe.close()
    if leftover:
        print(f"[FAIL] rollback left {leftover} feesim-{SUFFIX} school(s) in the database")
        return max(exit_code, 3)
    print("[PASS] rollback verified — fixture school not persisted, database untouched")
    return exit_code


def bs_month_add(year, month, delta):
    month += delta
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    return year, month


def student_dues(student_id):
    """Grouped defaulter view for one student — mirrors list_defaulters."""
    rows = FeeCollection.query.filter(
        FeeCollection.school_id == school.id,
        FeeCollection.student_id == student_id,
        FeeCollection.payment_status.in_(("pending", "partial")),
        FeeCollection.is_deleted.is_(False),
    ).all()
    total = 0.0
    for c in rows:
        payable = _collection_payable_total(c)
        total += max(payable - min(_extract_partial_paid(c), payable), 0.0)
    return round(total, 2)


try:
    # ── fixtures ──────────────────────────────────────────────────────────
    SUFFIX = uuid_mod.uuid4().hex[:8]
    from app.models.academic import Class
    from app.models.fee import FeeCollection, FeeStructure, StudentScholarship
    from app.models.school import School
    from app.models.student import Guardian, Student

    school = School(
        name=f"FeeSim {SUFFIX}", slug=f"feesim-{SUFFIX}", plan="starter",
        status="active", is_active=True, email=f"feesim-{SUFFIX}@test.edu.np",
        phone=f"+97798{SUFFIX[:8]}",
    )
    db.session.add(school)
    db.session.flush()

    klass = Class(school_id=school.id, name=f"FeeSim {SUFFIX}", sort_order=95)
    db.session.add(klass)
    db.session.flush()

    students = []
    for i in range(30):
        s = Student(
            school_id=school.id, first_name=f"FeeSim{i:02d}", last_name=f"Sim{SUFFIX[:4]}",
            status="active", class_id=klass.id,
        )
        db.session.add(s)
        students.append(s)
    db.session.flush()

    # student 0 gets a 10% scholarship on Tuition Fee (exercises the
    # auto-applied discount path in _apply_fee_structure).
    db.session.add(
        StudentScholarship(
            school_id=school.id, student_id=students[0].id,
            fee_type="Tuition Fee", discount_type="percent", discount_value=10,
            reason="sim merit", is_active=True,
        )
    )
    # student 0 has a primary guardian phone (reminder target);
    # student 1 intentionally has NO guardian (no_guardian_phone path).
    db.session.add(
        Guardian(
            school_id=school.id, student_id=students[0].id, full_name="Sim Guardian 0",
            relation="father", phone="+9779800000001", is_primary=True,
        )
    )
    db.session.commit()

    structure = FeeStructure(
        school_id=school.id,
        class_id=klass.id,
        academic_year="2083",
        fee_items=[
            {"name": "Tuition Fee", "amount": 2500, "frequency": "monthly", "due_day": 10},
            {"name": "Transport Fee", "amount": 1200, "frequency": "monthly", "due_day": 5},
            {"name": "Exam Fee", "amount": 3000, "frequency": "one-time", "due_day": 10},
        ],
    )
    db.session.add(structure)
    db.session.commit()

    from app.api.v1.fees import (
        _apply_fee_structure,
        _collection_due_date,
        _collection_payable_total,
        _extract_partial_paid,
        _merge_partial_payment_note,
    )
    from app.tasks.fee_reminders import (
        _generate_monthly_fees_for_school,
        send_single_fee_reminder,
    )

    # ── 1) bill 14 consecutive BS months (anchor mid-month, step back) ────
    today_bs = nepali_datetime.date.today()
    anchor = nepali_datetime.date(today_bs.year, today_bs.month, 1)
    MONTHS = 14

    summary_rows = []
    rerun_created_total = 0
    for i in range(MONTHS):
        year, month = bs_month_add(anchor.year, anchor.month, -i)
        on_date = nepali_datetime.date(year, month, 15)
        first = _apply_fee_structure(structure, on_date=on_date)
        second = _apply_fee_structure(structure, on_date=on_date)
        rerun_created_total += second["created_collections"]
        summary_rows.append((f"{year}-{month:02d}", first["created_collections"],
                             second["created_collections"]))

    print()
    print(f"{'BS month':<10} {'created(run1)':>14} {'created(run2)':>14}")
    for month_bs, c1, c2 in summary_rows:
        print(f"{month_bs:<10} {c1:>14} {c2:>14}")
    print()

    check("month 0 billed 3 items x 30 students (90 bills)",
          summary_rows[0][1] == 90, f"got {summary_rows[0][1]}")
    check("months 1-13 billed 2 monthly items x 30 students (60 each)",
          all(r[1] == 60 for r in summary_rows[1:]),
          str([(r[0], r[1]) for r in summary_rows[1:] if r[1] != 60]))
    check("re-running every BS month creates ZERO duplicates (idempotent)",
          rerun_created_total == 0, f"re-run created {rerun_created_total}")

    def bills(item=None, student_id=None):
        q = FeeCollection.query.filter(
            FeeCollection.school_id == school.id, FeeCollection.is_deleted.is_(False))
        if item:
            q = q.filter(FeeCollection.fee_item_name == item)
        if student_id:
            q = q.filter(FeeCollection.student_id == student_id)
        return q

    check("Tuition Fee: exactly 14 bills per student (no duplicates)",
          bills("Tuition Fee", students[0].id).count() == MONTHS,
          f"got {bills('Tuition Fee', students[0].id).count()}")
    check("Transport Fee: exactly 14 bills per student",
          bills("Transport Fee", students[0].id).count() == MONTHS,
          f"got {bills('Transport Fee', students[0].id).count()}")
    check("one-time Exam Fee billed exactly ONCE per student",
          bills("Exam Fee", students[0].id).count() == 1,
          f"got {bills('Exam Fee', students[0].id).count()}")
    check("exam fee never re-billed in later months",
          bills("Exam Fee").count() == 30,
          f"got {bills('Exam Fee').count()}")

    # ── 2) due math per month ─────────────────────────────────────────────
    # students[1] has no scholarship — plain 2500 + 1200 every month.
    bad_math = []
    for i in range(MONTHS):
        year, month = bs_month_add(anchor.year, anchor.month, -i)
        month_bs = f"{year}-{month:02d}"
        tuition = bills("Tuition Fee", students[1].id).filter(
            FeeCollection.month_bs == month_bs).first()
        transport = bills("Transport Fee", students[1].id).filter(
            FeeCollection.month_bs == month_bs).first()
        if (tuition is None or transport is None
                or _collection_payable_total(tuition) != 2500.0
                or _collection_payable_total(transport) != 1200.0
                or tuition.payment_status != "pending"
                or _extract_partial_paid(tuition) != 0):
            bad_math.append(month_bs)
    check("due math: every month bills 2500 + 1200 pending with 0 paid (student 1)",
          not bad_math, f"bad months: {bad_math}")

    disc = bills("Tuition Fee", students[0].id).filter(
        FeeCollection.month_bs == summary_rows[0][0]).first()
    discount_amount = float(disc.discount_amount or 0)
    check("10% tuition scholarship auto-applied (2500 − 250 = 2250, flagged)",
          discount_amount == 250.0 and bool(disc.is_scholarship)
          and _collection_payable_total(disc) == 2250.0,
          f"discount={discount_amount}")

    # discount larger than base floors the net payable at 0 (never negative)
    probe = bills("Transport Fee", students[1].id).filter(
        FeeCollection.month_bs == summary_rows[0][0]).first()
    probe.discount_amount = 99999
    db.session.commit()
    check("discount > base floors net payable at 0", _collection_payable_total(probe) == 0.0,
          f"got {_collection_payable_total(probe)}")
    probe.discount_amount = 0
    db.session.commit()

    # ── 3) cross-generator idempotency (cron vs manual markers) ───────────
    # NOTE: this block runs AFTER the defaulter/reminder checks below in
    # earlier drafts polluted dues with a 15th "future" month; keep the
    # forward-month creation OUT of the defaulter section (it lives here).
    cron_created_total = 0
    for month_bs, _c1, _c2 in summary_rows:
        year_bs = month_bs.split("-")[0]
        cron_created_total += _generate_monthly_fees_for_school(
            str(school.id), month_bs=month_bs, year_bs=year_bs)["created"]
    check("cron generator skips all 14 months billed by the manual path",
          cron_created_total == 0, f"cron created {cron_created_total} duplicates")

    # ── 4) defaulter detection thresholds (dues still pure: 14 months) ────
    due_s0 = student_dues(students[0].id)
    expected_s0 = round(14 * (2500 + 1200) + 3000 - 14 * 250.0, 2)
    check("defaulter grouping: student 0 flagged with exact outstanding (51300)",
          due_s0 == expected_s0, f"got {due_s0}, want {expected_s0}")

    due_s1 = student_dues(students[1].id)
    check("defaulter grouping: student without scholarship has full dues",
          due_s1 == round(14 * 3700 + 3000, 2), f"got {due_s1}")

    # reminder overdue threshold: fresh bills NOT yet "overdue" for the cron,
    # a backdated bill IS — the same cutoff send_fee_reminders computes.
    from app.plugins.config_store import plugin_config_value

    overdue_days = int(plugin_config_value(
        str(school.id), "fees", "reminder_overdue_days", 30) or 30)
    check("reminder overdue threshold falls back to 30 days",
          overdue_days == 30, f"got {overdue_days}")
    cutoff = datetime.now(timezone.utc) - timedelta(days=overdue_days)
    backdated = bills("Tuition Fee", students[1].id).filter(
        FeeCollection.month_bs == summary_rows[-1][0]).first()
    backdated.created_at = cutoff - timedelta(days=10)
    db.session.commit()
    school_collections = FeeCollection.query.filter(
        FeeCollection.school_id == school.id, FeeCollection.is_deleted.is_(False))
    fresh_count = school_collections.filter(FeeCollection.created_at >= cutoff).count()
    stale_count = FeeCollection.query.filter(
        FeeCollection.school_id == school.id,
        FeeCollection.is_deleted.is_(False),
        FeeCollection.created_at < cutoff,
    ).count()
    check("overdue cutoff excludes fresh bills and includes the 40-day-old one",
          stale_count == 1 and fresh_count > 0,
          f"stale={stale_count} fresh={fresh_count}")
    backdated.created_at = datetime.now(timezone.utc)
    db.session.commit()

    # ── 5) reminder payload correctness (SMS sender stubbed) ──────────────
    import app.plugins.config_store as config_store_mod
    import app.tasks.sms_sender as sms_sender_mod

    real_plugin_config_value = config_store_mod.plugin_config_value
    sent_calls = []
    real_delay = sms_sender_mod.send_sms.delay

    def record_delay(*args, **kwargs):
        sent_calls.append((args, kwargs))
        return None

    try:
        sms_sender_mod.send_sms.delay = record_delay
        result = send_single_fee_reminder(str(school.id), str(students[0].id))
        check("reminder: ok=True with sent/phone/amount payload",
              result.get("ok") and result.get("sent") and result.get("phone") == "+9779800000001",
              str(result))
        check("reminder: amount equals the student's exact outstanding",
              result.get("amount") == expected_s0,
              f"got {result.get('amount')}, want {expected_s0}")
        check("reminder: exactly ONE sms dispatched", len(sent_calls) == 1,
              f"calls={len(sent_calls)}")
        if sent_calls:
            args, _kw = sent_calls[0]
            to_phone, message, sid = args[0], args[1], args[2]
            outstanding_periods = sum(
                1 for c in bills(student_id=students[0].id).all()
                if max(_collection_payable_total(c) - min(_extract_partial_paid(c),
                                                          _collection_payable_total(c)), 0) > 0
            )
            check("reminder: dispatched to the guardian phone of the right school",
                  to_phone == "+9779800000001" and str(sid) == str(school.id),
                  f"phone={to_phone} school={sid}")
            check("reminder: message carries student name, amount and period label",
                  f"FeeSim00" in str(message)
                  and f"Rs.{expected_s0:.2f}" in str(message)
                  and f"{outstanding_periods} billing periods" in str(message),
                  str(message)[:160])
        no_guardian = send_single_fee_reminder(str(school.id), str(students[1].id))
        check("reminder: student without guardian -> no_guardian_phone",
              not no_guardian.get("ok") and no_guardian.get("reason") == "no_guardian_phone",
              str(no_guardian))

        config_store_mod.plugin_config_value = (
            lambda sid, slug, key, default=None: False
            if key == "reminder_enabled" else real_plugin_config_value(sid, slug, key, default)
        )
        switched = send_single_fee_reminder(str(school.id), str(students[0].id))
        check("reminder: kill-switch (reminder_enabled=false) aborts cleanly",
              not switched.get("ok") and switched.get("reason") == "reminders_disabled",
              str(switched))
    finally:
        sms_sender_mod.send_sms.delay = real_delay
        config_store_mod.plugin_config_value = real_plugin_config_value

    # ── 5b) reverse dedupe: cron bills a FRESH BS month first, then the
    # manual path must skip it. Runs AFTER the defaulter/reminder checks so
    # the extra month cannot pollute their expected dues.
    fy, fm = bs_month_add(anchor.year, anchor.month, 1)
    cron_future = _generate_monthly_fees_for_school(
        str(school.id), month_bs=f"{fy}-{fm:02d}", year_bs=str(fy))
    manual_after = _apply_fee_structure(
        structure, on_date=nepali_datetime.date(fy, fm, 15))
    check("manual path skips the BS month the cron billed first (reverse dedupe)",
          cron_future["created"] == 60 and manual_after["created_collections"] == 0,
          f"cron={cron_future['created']} manual={manual_after['created_collections']}")

    # ── 6) payment math on one bill ───────────────────────────────────────
    bill = bills("Tuition Fee", students[2].id).filter(
        FeeCollection.month_bs == summary_rows[0][0]).first()
    bill.late_fine_amount = 200
    bill.discount_amount = 500
    db.session.commit()

    payable = _collection_payable_total(bill)
    check("payable = base + late_fine − discount (2500+200−500=2200)",
          payable == 2200.0, f"got {payable}")

    bill.notes = _merge_partial_payment_note(bill.notes, 700)
    bill.payment_status = "partial"
    db.session.commit()
    paid_after_partial = min(_extract_partial_paid(bill), payable)
    check("partial payment: paid=700, status=partial, due=1500",
          paid_after_partial == 700.0 and bill.payment_status == "partial"
          and round(payable - paid_after_partial, 2) == 1500.0,
          f"paid={paid_after_partial} status={bill.payment_status}")

    bill.notes = _merge_partial_payment_note(bill.notes, payable)
    bill.payment_status = "paid"
    db.session.commit()
    paid_full = min(_extract_partial_paid(bill), payable)
    check("full settlement: paid=payable, status=paid, due floored at 0",
          paid_full == 2200.0 and bill.payment_status == "paid"
          and max(payable - paid_full, 0) == 0.0,
          f"paid={paid_full} status={bill.payment_status}")

    # a fully-settled student must NOT be flagged as a defaulter
    for c in bills(student_id=students[3].id).all():
        c.notes = _merge_partial_payment_note(c.notes, _collection_payable_total(c))
        c.payment_status = "paid"
    db.session.commit()
    check("fully-paid student drops out of the defaulter list (due == 0)",
          student_dues(students[3].id) == 0.0, f"got {student_dues(students[3].id)}")

    check("reminder now reports no_outstanding for the settled student",
          send_single_fee_reminder(str(school.id), str(students[3].id))
          .get("reason") == "no_outstanding", "expected no_outstanding")

    # ── 7) ephemeral due_date derivation ([due_day:N] + BS month) ─────────
    check("due_date: tuition [due_day:10] -> 10th of the bill's BS month",
          _collection_due_date(disc) == f"{summary_rows[0][0]}-10",
          f"got {_collection_due_date(disc)}, want {summary_rows[0][0]}-10")
    transport0 = bills("Transport Fee", students[0].id).filter(
        FeeCollection.month_bs == summary_rows[0][0]).first()
    check("due_date: transport [due_day:5] -> 5th of the bill's BS month",
          _collection_due_date(transport0) == f"{summary_rows[0][0]}-05",
          f"got {_collection_due_date(transport0)}, want {summary_rows[0][0]}-05")

    # ── summary ───────────────────────────────────────────────────────────
    failed = [c for c in CHECKS if not c[1]]
    print()
    print("=" * 66)
    print("FEES SIMULATION SUMMARY (rollback-safe)")
    print("=" * 66)
    print(f"School fixture       : feesim-{SUFFIX} (rolled back, never persisted)")
    print(f"Students             : 30 (one scholarship, one guardianless)")
    print(f"BS months simulated  : {MONTHS}  ({summary_rows[-1][0]} -> {summary_rows[0][0]})")
    print(f"Fee types            : monthly Tuition 2500, monthly Transport 1200, one-time Exam 3000")
    print(f"Bills created        : {sum(r[1] for r in summary_rows)} (monthly+exam)")
    print(f"Re-run duplicates    : {rerun_created_total}")
    print(f"Cron duplicates      : {cron_created_total}")
    print(f"Checks passed        : {len(CHECKS) - len(failed)}/{len(CHECKS)}")
    for label, ok, detail in CHECKS:
        if not ok:
            print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))
    print("=" * 66)

    sys.exit(cleanup(1 if failed else 0))

except Exception:
    traceback.print_exc()
    sys.exit(cleanup(2))
