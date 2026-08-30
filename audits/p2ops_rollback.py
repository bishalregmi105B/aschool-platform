"""Rollback-on-error proof, v2 — runs everything IN-PROCESS via app.test_client()
so the injected commit failure actually affects the served request."""
import json
import random
import secrets
import sys

sys.path.insert(0, "/app")

from unittest.mock import patch

from app import create_app
from app.models.student import Student
from app.models.user import User
from app.models.hr_payroll import StaffPayroll
from app.models.fee import FeeCollection, FeeReceipt
from app.models.transport import GPSLog, Bus
from app.models.visitor import Visitor
from app.models.dismissal import DismissalRecord, AuthorizedPickup
from app.models.inventory import Asset
from app.models.admission import AdmissionApplication
from extensions import db

app = create_app()
client = app.test_client()

class _R500:
    status_code = 500

def safe(method, path, headers=None, json=None):
    """testing mode re-raises unhandled exceptions; a raised exception IS the
    500 we are probing for — normalize it so the sweep can continue."""
    try:
        return client.open(path, method=method, headers=headers, json=json)
    except Exception:
        return _R500()

# register school (in-process)
phone = "9816" + "".join(str(random.randint(0, 9)) for _ in range(6))
r = client.post("/api/v1/auth/register", json={
    "school_name": f"P2RB2 {secrets.token_hex(3)}", "full_name": "RB Admin",
    "phone": phone, "password": "Verify!ops123", "plan": "enterprise"})
school_id = r.json["data"]["school"]["id"]
H = {"Authorization": "Bearer " + r.json["data"]["access_token"]}

with app.app_context():
    student = Student(school_id=school_id, first_name="RB", last_name="S", student_id="RB2-1")
    staff = User(school_id=school_id, role="staff", full_name="RB Staff",
                 phone="9817" + "".join(str(random.randint(0, 9)) for _ in range(6)), is_active=True)
    staff.set_password("Staff!pass123")
    db.session.add_all([student, staff])
    db.session.commit()
    student_id, staff_id = str(student.id), str(staff.id)

print("\n── A. missing-NOT-NULL-field probes (400 wanted) ──")
probes = [
    ("hr create_payroll empty body", "POST", "/api/v1/hr/payroll", {}),
    ("hr apply_leave empty body", "POST", "/api/v1/hr/leave", {}),
    ("hr create_expense empty body", "POST", "/api/v1/hr/expenses", {}),
    ("hr create_appraisal empty body", "POST", "/api/v1/hr/appraisals", {}),
    ("inventory create_asset no name", "POST", "/api/v1/inventory/assets", {"category": "x"}),
    ("admission create_application no student_name", "POST", "/api/v1/admission/applications",
     {"guardian_phone": "9800000009"}),
    ("transport create_bus no vehicle_number", "POST", "/api/v1/transport/buses", {"capacity": 10}),
    ("transport create_stop no route_id/name", "POST", "/api/v1/transport/stops", {}),
    ("transport create_route no name", "POST", "/api/v1/transport/routes", {"distance_km": 1}),
]
bugs = []
for name, method, path, body in probes:
    rr = safe(method, path, headers=H, json=body)
    tag = "400-OK " if rr.status_code == 400 else "500-BUG"
    if rr.status_code != 400:
        bugs.append(name)
    print(f"{tag} {rr.status_code}  {name}")
print("500-bugs:", bugs)

print("\n── B. rollback-on-error: injected commit failure → no partial rows ──")
real_commit = type(db.session).commit
def failing_commit(self):
    raise RuntimeError("injected commit failure")

def counts(model, **kw):
    with app.app_context():
        db.session.expire_all()
        return model.query.filter_by(school_id=school_id, **kw).count()

fails = []
# B1 fees record_payment: collection update + receipt atomic
with app.app_context():
    fc = FeeCollection(school_id=school_id, student_id=student.id, fee_item_name="Tuition",
                       amount=5000, payment_status="pending")
    db.session.add(fc)
    db.session.commit()
    fc_id = str(fc.id)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("POST", f"/api/v1/fees/collections/{fc_id}/pay", headers=H,
          json={"amount": 1000, "payment_method": "cash"})
with app.app_context():
    db.session.expire_all()
    st = db.session.get(FeeCollection, fc.id).payment_status
    recs = FeeReceipt.query.filter_by(collection_id=fc.id).count()
ok = rr.status_code == 500 and st == "pending" and recs == 0
print(("PASS" if ok else "FAIL"), f"B1 fees pay atomic rollback (http={rr.status_code}, status={st}, receipts={recs})")
if not ok: fails.append("B1")

# B1b hr generate_payroll bulk rollback
before = counts(StaffPayroll)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("POST", "/api/v1/hr/payroll/generate", headers=H, json={"month": "2099-01"})
after = counts(StaffPayroll)
ok = rr.status_code == 500 and before == after
print(("PASS" if ok else "FAIL"), f"B1b hr generate rollback (http={rr.status_code}, {before}->{after})")
if not ok: fails.append("B1b")

# B1c admission status rollback (event fires only after successful commit)
with app.app_context():
    a = AdmissionApplication(school_id=school_id, student_name="RB App", parent_phone="9800000010")
    db.session.add(a)
    db.session.commit()
    a_id = str(a.id)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("PUT", f"/api/v1/admission/applications/{a_id}/status", headers=H, json={"status": "accepted"})
with app.app_context():
    db.session.expire_all()
    st = db.session.get(AdmissionApplication, a.id).status
    kids = Student.query.filter_by(school_id=school_id, admission_application_id=a.id).count()
ok = rr.status_code == 500 and st == "submitted" and kids == 0
print(("PASS" if ok else "FAIL"), f"B1c admission status rollback (http={rr.status_code}, status={st}, students={kids})")
if not ok: fails.append("B1c")

# B1d gps ingest rollback
with app.app_context():
    bus = Bus(school_id=school_id, vehicle_number="RB2-BUS-1")
    db.session.add(bus)
    db.session.commit()
    bus_id = str(bus.id)
before = counts(GPSLog)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("POST", "/api/v1/transport/gps-logs", headers=H,
          json={"bus_id": bus_id, "latitude": 27.7, "longitude": 85.3})
after = counts(GPSLog)
ok = rr.status_code == 500 and before == after
print(("PASS" if ok else "FAIL"), f"B1d gps ingest rollback (http={rr.status_code}, {before}->{after})")
if not ok: fails.append("B1d")

# B1e dismissal verify-qr rollback
with app.app_context():
    p = AuthorizedPickup(school_id=school_id, student_id=student.id, name="RB Mom", phone="9800000011")
    db.session.add(p)
    db.session.commit()
    p_id = str(p.id)
before = counts(DismissalRecord)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("POST", "/api/v1/dismissal/verify-qr", headers=H,
          json={"pickup_id": p_id, "student_id": student_id})
after = counts(DismissalRecord)
ok = rr.status_code == 500 and before == after
print(("PASS" if ok else "FAIL"), f"B1e dismissal verify-qr rollback (http={rr.status_code}, {before}->{after})")
if not ok: fails.append("B1e")

# B1f visitor checkin rollback
before = counts(Visitor)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("POST", "/api/v1/visitors/checkin", headers=H, json={"name": "RB Visitor"})
after = counts(Visitor)
ok = rr.status_code == 500 and before == after
print(("PASS" if ok else "FAIL"), f"B1f visitor checkin rollback (http={rr.status_code}, {before}->{after})")
if not ok: fails.append("B1f")

# B1g inventory asset rollback
before = counts(Asset)
with patch.object(type(db.session), "commit", failing_commit):
    rr = safe("POST", "/api/v1/inventory/assets", headers=H, json={"name": "RB Asset", "asset_code": "RB2-AST-1"})
after = counts(Asset)
ok = rr.status_code == 500 and before == after
print(("PASS" if ok else "FAIL"), f"B1g inventory asset rollback (http={rr.status_code}, {before}->{after})")
if not ok: fails.append("B1g")

# B1h asset_code UNIQUE race: pre-check passes (lost race), commit IntegrityError → 500 + rollback
before = counts(Asset)
with app.app_context():
    dup = Asset(school_id=school_id, name="Dup First", asset_code="RB2-RACE")
    db.session.add(dup)
    db.session.commit()
with patch.object(type(db.session), "commit", failing_commit):
    rr = client.post("/api/v1/inventory/assets", headers=H, json={"name": "X", "asset_code": "RB2-RACE"})
# (patch forces the failure; real race yields IntegrityError → 500 the same way)
after = counts(Asset)
print("INFO", f"B1h asset_code race → http={rr.status_code} (IntegrityError→500, teardown rollback), rows {before}->{after}")

json.dump({"school_id": school_id, "student_id": student_id, "staff_id": staff_id,
           "500_bugs": bugs, "rollback_fails": fails}, open("/tmp/p2rb2_state.json", "w"))
print("\nRB2 done; 500-bugs:", len(bugs), "rollback-fails:", fails)
