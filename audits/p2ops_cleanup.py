"""Cleanup v2: delete P2* fixture schools + dependents; commit per table."""
import sys

sys.path.insert(0, "/app")

from extensions import db
from app import create_app

app = create_app()
with app.app_context():
    tables = [
        # money
        "fee_receipts", "fee_collections", "fee_structures",
        "student_scholarships",
        # operations
        "asset_audit_logs", "assets", "procurement_requests",
        "visitor_appointments", "visitors",
        "dismissal_records", "authorized_pickups",
        "gps_logs", "bus_stops", "buses", "routes",
        "staff_payroll", "staff_leaves", "staff_appraisals",
        "expenses", "expense_categories",
        "admission_forms", "admission_leads",
        # notifications / gamification (points_logs.student_id → students)
        "in_app_notifications", "points_logs",
        "students",
        # admission chain (applications.admission_application_id ← students)
        "admission_applications", "admission_inquiries",
        # install + quota
        "school_plugins", "ai_school_quotas",
    ]
    # break the school.owner_id → users cycle, then users, then schools
    try:
        db.session.execute(db.text(
            "UPDATE schools SET owner_id = NULL WHERE name LIKE 'P2%'"))
        db.session.commit()
        print("schools.owner_id cleared")
    except Exception as e:
        db.session.rollback()
        print("owner_id ERR", str(e)[:150])
    tables.append("users")
    for t in tables:
        try:
            r = db.session.execute(db.text(
                "DELETE FROM {t} WHERE school_id IN (SELECT id FROM schools WHERE name LIKE 'P2%')"
                .format(t=t)))
            db.session.commit()
            print(t, r.rowcount)
        except Exception as e:
            db.session.rollback()
            print(t, "ERR", str(e)[:150])
    try:
        r = db.session.execute(db.text("DELETE FROM schools WHERE name LIKE 'P2%'"))
        db.session.commit()
        print("schools", r.rowcount)
    except Exception as e:
        db.session.rollback()
        print("schools ERR", str(e)[:200])
    n = db.session.execute(db.text(
        "SELECT count(*) FROM schools WHERE name LIKE 'P2%'")).scalar()
    print("remaining P2 schools:", n)
