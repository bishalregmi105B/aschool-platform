"""TEMPORARY Phase-2 verification probe (Money & Operations plugins).

Creates a throwaway school with the 7 plugins installed, drives the live HTTP
API with fixture rows, prints PASS/FAIL evidence lines, and cleans up.
Run: docker compose exec flask python tmp_phase2_verify.py
"""
import json
import sys
import uuid as uuid_mod
from datetime import datetime, timezone

import requests

BASE = "http://localhost:5000/api/v1"  # in-container port (host maps 5003)
SUFFIX = uuid_mod.uuid4().hex[:6]
SLUG = f"phase2-audit-{SUFFIX}"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:300]))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {str(detail)[:300]}")


# ───────────────────────────── setup ─────────────────────────────
from app import create_app  # noqa: E402
from extensions import db  # noqa: E402

app = create_app()
created = {"school_id": None, "user_ids": [], "student_ids": [], "extra": []}

with app.app_context():
    # sweep leftovers from any earlier crashed run
    from app.models.school import School
    from sqlalchemy import text
    old = School.query.filter(School.slug.like("phase2-audit-%")).all()
    for s in old:
        sid = str(s.id)
        for stmt in [
            "DELETE FROM gps_logs WHERE school_id=:s",
            "DELETE FROM bus_stops WHERE school_id=:s",
            "DELETE FROM buses WHERE school_id=:s",
            "DELETE FROM routes WHERE school_id=:s",
            "DELETE FROM dismissal_records WHERE school_id=:s",
            "DELETE FROM authorized_pickups WHERE school_id=:s",
            "DELETE FROM asset_audit_logs WHERE school_id=:s",
            "DELETE FROM procurement_requests WHERE school_id=:s",
            "DELETE FROM assets WHERE school_id=:s",
            "DELETE FROM visitor_appointments WHERE school_id=:s",
            "DELETE FROM visitors WHERE school_id=:s",
            "DELETE FROM admission_applications WHERE school_id=:s",
            "DELETE FROM admission_inquiries WHERE school_id=:s",
            "DELETE FROM in_app_notifications WHERE school_id=:s",
            "DELETE FROM sms_logs WHERE school_id=:s",
            "UPDATE students SET user_id=NULL WHERE school_id=:s",
            "DELETE FROM students WHERE school_id=:s",
            "DELETE FROM school_plugins WHERE school_id=:s",
            "DELETE FROM users WHERE school_id=:s",
            "DELETE FROM schools WHERE id=:s",
        ]:
            try:
                db.session.execute(text(stmt), {"s": sid})
            except Exception as e:
                db.session.rollback()
                print(f"sweep-skip: {type(e).__name__}")
        print(f"swept leftover school {s.slug}")
    db.session.commit()

with app.app_context():
    from app.models.school import School
    from app.models.user import User
    from app.models.student import Student
    from app.models.plugin import SchoolPlugin
    school = School(
        name="Phase2 Audit School", slug=SLUG, type="private",
        level="secondary", district="Kathmandu", plan="growth", is_active=True,
    )
    db.session.add(school)
    db.session.flush()
    created["school_id"] = str(school.id)

    def mkuser(role, full_name, phone, email=None):
        u = User(
            school_id=str(school.id), role=role, full_name=full_name,
            phone=phone, email=email or f"{phone}@{SLUG}.test", is_active=True,
        )
        u.set_password("ProbePass123!")
        db.session.add(u)
        db.session.flush()
        created["user_ids"].append(str(u.id))
        return u

    admin = mkuser("school_admin", "Probe Admin", "9801110001")
    teacher = mkuser("teacher", "Probe Teacher", "9801110002")
    parent = mkuser("parent", "Probe Parent", "9801110003")

    for slug in ["fees", "hr_payroll", "admission", "inventory",
                 "gps_tracking", "visitor_management", "dismissal"]:
        db.session.add(SchoolPlugin(
            school_id=str(school.id), plugin_slug=slug, active=True, is_trial=False,
        ))

    # student owned by parent (dismissal legit path) + one other student
    s1 = Student(school_id=str(school.id), user_id=parent.id,
                 first_name="Own", last_name="Child")
    s2 = Student(school_id=str(school.id), first_name="Other", last_name="Child")
    db.session.add_all([s1, s2])
    db.session.flush()
    created["student_ids"] = [str(s1.id), str(s2.id)]
    db.session.commit()

    TOKENS = {}
    for role, u in [("admin", admin), ("teacher", teacher), ("parent", parent)]:
        r = requests.post(f"{BASE}/auth/login", json={
            "email": u.email, "password": "ProbePass123!"},
            headers={"X-School-Slug": SLUG}, timeout=15)
        ok = r.status_code == 200 and r.json().get("data", {}).get("access_token")
        check(f"login {role}", ok, f"{r.status_code} {r.text[:120]}")
        TOKENS[role] = r.json()["data"]["access_token"]

def H(role="admin"):
    return {"Authorization": f"Bearer {TOKENS[role]}", "X-School-Slug": SLUG}


def api(method, path, role="admin", **kw):
    kw.setdefault("timeout", 30)
    return requests.request(method, BASE + path, headers=H(role), **kw)


try:
    # ───────────────── ADMISSION funnel ─────────────────
    r = api("POST", "/admission/inquiries", json={
        "student_name": "Aarav Funnel", "guardian_name": "G Funnel",
        "phone": "9812345601", "class_applied": "Grade 1", "source": "walk_in"})
    check("admission create inquiry", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    inq = r.json()["data"]

    r = api("GET", "/admission/inquiries?status=new")
    check("admission list inquiries (real data)", r.status_code == 200 and
          any(i["student_name"] == "Aarav Funnel" for i in r.json()["data"]),
          f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("PUT", f"/admission/inquiries/{inq['id']}", json={"status": "contacted"})
    check("admission update inquiry status", r.status_code == 200 and
          r.json()["data"]["status"] == "contacted", f"{r.status_code}")

    r = api("POST", "/admission/applications", json={
        "student_name": "Aarav Funnel", "guardian_name": "G Funnel",
        "guardian_phone": "9812345601", "class_applied": "Grade 1",
        "inquiry_id": inq["id"]})
    check("admission create application (linked inquiry)", r.status_code == 201 and
          r.json()["data"]["inquiry_id"] == inq["id"], f"{r.status_code} {r.text[:200]}")
    app_obj = r.json()["data"]

    r = api("POST", "/admission/applications", json={"student_name": "NoPhone Kid"})
    check("admission application without phone rejected 400", r.status_code == 400,
          f"{r.status_code}")

    for st in ["under_review", "interview"]:
        r = api("PUT", f"/admission/applications/{app_obj['id']}/status", json={"status": st})
        check(f"admission status -> {st}", r.status_code == 200 and r.json()["data"]["status"] == st,
              f"{r.status_code}")

    # ACCEPT → listener auto-creates user+student
    with app.app_context():
        from app.models.student import Student as SModel
        before = SModel.query.filter_by(school_id=created["school_id"]).count()
    r = api("PUT", f"/admission/applications/{app_obj['id']}/status", json={"status": "accepted"})
    check("admission accept 200", r.status_code == 200, f"{r.status_code} {r.text[:150]}")
    import time
    deadline = time.time() + 15
    after = None
    while time.time() < deadline:
        with app.app_context():
            after = SModel.query.filter_by(school_id=created["school_id"]).count()
        if after > before:
            break
        time.sleep(0.5)
    check("admission accept auto-enrolls student", after == before + 1,
          f"before={before} after={after}")

    # idempotency: accept again
    r = api("PUT", f"/admission/applications/{app_obj['id']}/status", json={"status": "accepted"})
    time.sleep(4)
    with app.app_context():
        after2 = SModel.query.filter_by(school_id=created["school_id"]).count()
        dup_users = []
        from app.models.user import User as UModel
        dup_users = UModel.query.filter_by(school_id=created["school_id"], role="student").all()
    check("admission RE-accept does not duplicate student", after2 == after,
          f"students after re-accept={after2} (student-role users={len(dup_users)})")

    # enrolled
    r = api("PUT", f"/admission/applications/{app_obj['id']}/status", json={"status": "enrolled"})
    check("admission status -> enrolled", r.status_code == 200 and
          r.json()["data"]["status"] == "enrolled", f"{r.status_code}")

    r = api("GET", "/admission/dashboard")
    d = r.json().get("data", {})
    check("admission dashboard funnel counts", r.status_code == 200 and
          d.get("total_inquiries", 0) >= 1 and d.get("pipeline", {}).get("accepted") == 1,
          f"{r.status_code} {d}")

    r = api("GET", "/admission/inquiries", role="parent")
    check("admission routes plugin-gated for school users (200 w/ plugin)", r.status_code == 200,
          f"{r.status_code}")

    # invalid transition value
    r = api("PUT", f"/admission/applications/{app_obj['id']}/status", json={"status": "bogus"})
    check("admission invalid status 400", r.status_code == 400, f"{r.status_code}")

    # shortlisted (model enum has it; API valid list?)
    r = api("PUT", f"/admission/applications/{app_obj['id']}/status", json={"status": "shortlisted"})
    check("admission 'shortlisted' accepted by API", r.status_code == 200, f"{r.status_code} {r.text[:120]}")

    # ───────────────── VISITOR MANAGEMENT ─────────────────
    r = api("POST", "/visitors/checkin", json={
        "name": "Ramesh Visitor", "phone": "9855550001", "id_type": "citizenship",
        "id_number": "11-22-33", "purpose": "PT meeting", "badge_number": "B-001"})
    check("visitor check-in 201", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    vis = r.json()["data"]
    check("visitor status=checked_in + checked_in_at set",
          vis["status"] == "checked_in" and vis["checked_in_at"], json.dumps(vis)[:200])

    r = api("POST", f"/visitors/{vis['id']}/checkout")
    check("visitor check-out 200", r.status_code == 200 and
          r.json()["data"]["status"] == "checked_out" and r.json()["data"]["checked_out_at"],
          f"{r.status_code}")

    r = api("POST", f"/visitors/{vis['id']}/checkout")
    check("visitor double check-out (current behavior)", r.status_code, f"{r.status_code}")

    r = api("GET", "/visitors?status=checked_in")
    check("visitor list filter", r.status_code == 200 and
          all(v["status"] == "checked_in" for v in r.json()["data"]),
          f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("POST", "/visitors/checkin", json={"purpose": "no name"})
    check("visitor check-in without name (current behavior)", r.status_code, f"{r.status_code}")

    r = api("POST", "/visitors/appointments", json={
        "visitor_name": "Dr. Koirala", "visitor_phone": "9855550002",
        "purpose": "Health talk", "staff_id": created["user_ids"][1],
        "scheduled_at": "2026-09-01T10:00:00"})
    check("visitor appointment create 201", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    appt = r.json()["data"]
    r = api("POST", f"/visitors/appointments/{appt['id']}/approve")
    check("visitor appointment approve", r.status_code == 200 and
          r.json()["data"]["status"] == "approved", f"{r.status_code}")

    # ───────────────── DISMISSAL ─────────────────
    r = api("POST", "/dismissal/authorized", role="parent", json={
        "student_id": created["student_ids"][0], "name": "Uncle Hari",
        "relation": "uncle", "phone": "9855550003"})
    check("dismissal parent registers pickup for OWN child", r.status_code == 201,
          f"{r.status_code} {r.text[:200]}")
    pickup = r.json()["data"] if r.status_code == 201 else None

    r = api("POST", "/dismissal/authorized", role="parent", json={
        "student_id": created["student_ids"][1], "name": "Sneaky Uncle",
        "relation": "uncle", "phone": "9855550009"})
    check("dismissal parent CANNOT register pickup for someone else's child",
          r.status_code in (400, 403), f"{r.status_code} {r.text[:150]}")

    r = api("POST", "/dismissal/authorized", role="parent", json={
        "student_id": "00000000-0000-0000-0000-000000000000",
        "name": "Ghost", "relation": "?", "phone": "9"})
    check("dismissal pickup for nonexistent student rejected",
          r.status_code in (400, 403, 404), f"{r.status_code}")

    if pickup:
        r = api("POST", "/dismissal/verify-qr", role="teacher",
                json={"pickup_id": pickup["id"], "student_id": pickup["student_id"]})
        check("dismissal verify-qr creates record (qr_verified=True)", r.status_code == 201 and
              r.json()["data"]["qr_verified"] is True, f"{r.status_code} {r.text[:150]}")
        rec = r.json()["data"] if r.status_code == 201 else None

        # deactivate authorization → verify-qr must refuse
        api("PUT", f"/dismissal/authorized/{pickup['id']}", role="admin", json={"is_active": False})
        r = api("POST", "/dismissal/verify-qr", role="teacher",
                json={"pickup_id": pickup["id"], "student_id": pickup["student_id"]})
        check("dismissal verify-qr refuses inactive authorization", r.status_code == 403,
              f"{r.status_code}")

    r = api("POST", "/dismissal/records", role="teacher", json={
        "student_id": created["student_ids"][0], "picked_up_by": "Mom",
        "notes": "manual"})
    check("dismissal manual record by teacher", r.status_code == 201, f"{r.status_code} {r.text[:150]}")

    r = api("GET", "/dismissal/records")
    check("dismissal records list", r.status_code == 200 and len(r.json()["data"]) >= 1,
          f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("GET", "/dismissal/authorized?student_id=" + created["student_ids"][0])
    check("dismissal authorized list filter", r.status_code == 200, f"{r.status_code}")

    # ───────────────── INVENTORY ─────────────────
    r = api("POST", "/inventory/assets", json={
        "name": "Projector P1", "asset_code": f"AST-{SUFFIX}-1",
        "qr_code": f"QR-{SUFFIX}-1", "category": "electronics",
        "location": "Room 101", "purchase_price": "45000",
        "purchase_date": "2026-01-15", "condition": "good"})
    check("inventory create asset 201", r.status_code == 201, f"{r.status_code} {r.text[:200]}")
    asset = r.json()["data"]
    check("inventory asset purchase_date stored", asset.get("purchase_date") == "2026-01-15",
          json.dumps(asset)[:200])

    r = api("GET", "/inventory/assets?category=electronics")
    check("inventory list assets w/ filter", r.status_code == 200 and
          any(a["id"] == asset["id"] for a in r.json()["data"]), f"{r.status_code}")

    r = api("GET", f"/inventory/assets/scan/QR-{SUFFIX}-1")
    check("inventory QR scan lookup", r.status_code == 200 and r.json()["data"]["id"] == asset["id"],
          f"{r.status_code}")

    r = api("PUT", f"/inventory/assets/{asset['id']}", json={"location": "Room 202"})
    check("inventory update asset", r.status_code == 200 and
          r.json()["data"]["location"] == "Room 202", f"{r.status_code}")

    r = api("POST", f"/inventory/assets/{asset['id']}/audit", json={
        "action": "moved", "old_value": "Room 101", "new_value": "Room 202",
        "notes": "term move"})
    check("inventory audit entry create", r.status_code == 201, f"{r.status_code}")

    r = api("POST", "/inventory/assets/00000000-0000-0000-0000-000000000000/audit",
            json={"action": "ghost"})
    check("inventory audit entry for nonexistent asset (current behavior)",
          r.status_code, f"{r.status_code} {r.text[:120]}")

    r = api("POST", "/inventory/procurement", json={
        "title": "10 whiteboards", "items": [{"name": "whiteboard", "qty": 10, "unit_cost": 3000}],
        "total_estimated_cost": 30000, "vendor": "Kagaaj Suppliers",
        "justification": "classrooms"})
    check("inventory procurement create", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    pr = r.json()["data"]

    r = api("POST", f"/inventory/procurement/{pr['id']}/approve", json={"status": "approved"})
    check("inventory procurement approve", r.status_code == 200 and
          r.json()["data"]["status"] == "approved", f"{r.status_code}")

    r = api("GET", f"/inventory/assets/{asset['id']}/audit")
    check("inventory audit log list", r.status_code == 200 and len(r.json()["data"]) >= 1,
          f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("DELETE", f"/inventory/assets/{asset['id']}")
    check("inventory delete asset (soft)", r.status_code == 200, f"{r.status_code}")
    r = api("GET", f"/inventory/assets/{asset['id']}")
    check("inventory deleted asset hidden from GET", r.status_code == 404, f"{r.status_code}")

    # ───────────────── GPS TRACKING / TRANSPORT ─────────────────
    r = api("POST", "/transport/routes", json={"name": "Route A", "distance_km": "12.5",
                                               "estimated_time_mins": 40})
    check("transport create route", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    route = r.json()["data"]

    r = api("POST", "/transport/buses", json={"vehicle_number": f"BA-{SUFFIX}",
                                              "capacity": 30, "route_id": route["id"],
                                              "gps_device_id": f"esp32-{SUFFIX}"})
    check("transport create bus", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    bus = r.json()["data"]

    r = api("POST", "/transport/stops", json={"route_id": route["id"], "name": "Kalanki",
                                              "latitude": "27.6939", "longitude": "85.2810",
                                              "sequence_number": 1,
                                              "arrival_time_am": "07:15",
                                              "arrival_time_pm": "16:00"})
    check("transport create stop", r.status_code == 201, f"{r.status_code} {r.text[:150]}")

    realistic = {"bus_id": bus["id"], "latitude": 27.7172, "longitude": 85.3240,
                 "speed_kmh": 32.5, "heading": 180.0, "accuracy_m": 4.2,
                 "timestamp": datetime.now(timezone.utc).isoformat()}
    r = api("POST", "/transport/gps-logs", json=realistic, role="teacher")
    check("gps ingest realistic payload (teacher JWT)", r.status_code == 201,
          f"{r.status_code} {r.text[:150]}")

    r = api("GET", f"/transport/gps-logs?bus_id={bus['id']}")
    check("gps logs list returns positions", r.status_code == 200 and
          len(r.json()["data"]) >= 1 and
          abs(float(r.json()["data"][0]["latitude"]) - 27.7172) < 0.001,
          f"{r.status_code} n={len(r.json().get('data', []))}")

    r = api("POST", "/transport/gps-logs", json={"bus_id": bus["id"]})
    check("gps ingest WITHOUT lat/lng (current behavior)", r.status_code,
          f"{r.status_code} {r.text[:120]}")

    r = api("POST", "/transport/gps-logs",
            json={"bus_id": bus["id"], "latitude": 999.0, "longitude": -999.0})
    check("gps ingest out-of-range coords (current behavior)", r.status_code,
          f"{r.status_code}")

    r = api("POST", "/transport/gps-logs",
            json={"bus_id": "00000000-0000-0000-0000-000000000000",
                  "latitude": 27.7, "longitude": 85.3})
    check("gps ingest for nonexistent bus (current behavior)", r.status_code,
          f"{r.status_code} {r.text[:120]}")

    r = api("GET", "/transport/buses")
    check("transport list buses", r.status_code == 200 and
          any(b["id"] == bus["id"] for b in r.json()["data"]), f"{r.status_code}")

    # ───────────────── FEES + HR (light; math verified separately) ─────────────────
    r = api("GET", "/fees/structures")
    check("fees list structures (route live)", r.status_code in (200, 404) and
          r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    r = api("GET", "/hr/payroll")
    check("hr payroll list (route live)", r.status_code == 200, f"{r.status_code} {r.text[:120]}")

    # ───────────────── GATING negative check (other school without plugins) ─────
    r = requests.get(f"{BASE}/visitors", headers={
        "Authorization": f"Bearer {TOKENS['admin']}", "X-School-Slug": "nonexistent-slug-xz"},
        timeout=15)
    check("bad school slug rejected", r.status_code in (401, 403, 404), f"{r.status_code}")

finally:
    # ───────────────────────────── cleanup ─────────────────────────────
    with app.app_context():
        from sqlalchemy import text
        sid = created["school_id"]
        if sid:
            for stmt in [
                "DELETE FROM gps_logs WHERE school_id=:s",
                "DELETE FROM bus_stops WHERE school_id=:s",
                "DELETE FROM buses WHERE school_id=:s",
                "DELETE FROM routes WHERE school_id=:s",
                "DELETE FROM dismissal_records WHERE school_id=:s",
                "DELETE FROM authorized_pickups WHERE school_id=:s",
                "DELETE FROM asset_audit_logs WHERE school_id=:s",
                "DELETE FROM procurement_requests WHERE school_id=:s",
                "DELETE FROM assets WHERE school_id=:s",
                "DELETE FROM visitor_appointments WHERE school_id=:s",
                "DELETE FROM visitors WHERE school_id=:s",
                "DELETE FROM admission_applications WHERE school_id=:s",
                "DELETE FROM admission_inquiries WHERE school_id=:s",
                "DELETE FROM in_app_notifications WHERE school_id=:s",
                "DELETE FROM sms_logs WHERE school_id=:s",
            ]:
                try:
                    db.session.execute(text(stmt), {"s": sid})
                except Exception as e:
                    db.session.rollback()
                    print(f"cleanup-skip {stmt.split('FROM')[1].strip()}: {type(e).__name__}")
            db.session.rollback()
            try:
                db.session.execute(text(
                    "UPDATE students SET user_id=NULL WHERE school_id=:s"), {"s": sid})
                db.session.execute(text(
                    "DELETE FROM students WHERE school_id=:s"), {"s": sid})
                db.session.execute(text(
                    "DELETE FROM school_plugins WHERE school_id=:s"), {"s": sid})
                db.session.execute(text(
                    "DELETE FROM users WHERE school_id=:s"), {"s": sid})
                db.session.execute(text(
                    "DELETE FROM schools WHERE id=:s"), {"s": sid})
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"CLEANUP CORE FAILURE: {e}")
    print("CLEANUP DONE")

fails = [r for r in results if not r[1]]
print(f"\nSUMMARY: {len(results) - len(fails)}/{len(results)} passed")
sys.exit(0)
