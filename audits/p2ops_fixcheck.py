"""Re-verify the fixes: 400 validation, visitor search, procurement status,
sidebar dead links gone. In-process (fresh code) via test_client."""
import random
import secrets
import sys

sys.path.insert(0, "/app")

from app import create_app
from extensions import db

app = create_app()
app.testing = False
client = app.test_client()

phone = "9818" + "".join(str(random.randint(0, 9)) for _ in range(6))
r = client.post("/api/v1/auth/register", json={
    "school_name": f"P2FIX {secrets.token_hex(3)}", "full_name": "Fix Admin",
    "phone": phone, "password": "Verify!ops123", "plan": "enterprise"})
school_id = r.json["data"]["school"]["id"]
H = {"Authorization": "Bearer " + r.json["data"]["access_token"]}

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS" if cond else "FAIL"), name, detail)

# 1. previously-500 probes now 400
probes = [
    ("hr create_payroll empty", "POST", "/api/v1/hr/payroll", {}),
    ("hr apply_leave empty", "POST", "/api/v1/hr/leave", {}),
    ("hr create_appraisal empty", "POST", "/api/v1/hr/appraisals", {}),
    ("inventory asset no name", "POST", "/api/v1/inventory/assets", {"category": "x"}),
    ("admission application no student_name", "POST", "/api/v1/admission/applications", {"guardian_phone": "9800000009"}),
    ("transport bus no vehicle_number", "POST", "/api/v1/transport/buses", {"capacity": 10}),
    ("transport stop no route/name", "POST", "/api/v1/transport/stops", {}),
    ("transport route no name", "POST", "/api/v1/transport/routes", {"distance_km": 1}),
]
for name, m, p, b in probes:
    rr = client.open(p, method=m, headers=H, json=b)
    check(f"400 now: {name}", rr.status_code == 400, f"{rr.status_code}")

# 2. valid creates still work (string-UUID route_id accepted; FK validated)
rr = client.post("/api/v1/transport/routes", headers=H, json={"name": "R1"})
route_id = rr.json["data"]["id"]
rr = client.post("/api/v1/transport/buses", headers=H, json={"vehicle_number": "FIX-1", "route_id": route_id})
check("bus create with valid route still 201", rr.status_code == 201, f"{rr.status_code}")
rr = client.post("/api/v1/transport/buses", headers=H, json={"vehicle_number": "FIX-2", "route_id": "not-a-uuid"})
check("bus create with malformed route_id → 400", rr.status_code == 400, f"{rr.status_code}")
import uuid as _u
rr = client.post("/api/v1/transport/buses", headers=H, json={"vehicle_number": "FIX-3", "route_id": str(_u.uuid4())})
check("bus create with foreign route_id → 400", rr.status_code == 400, f"{rr.status_code}")
rr = client.post("/api/v1/transport/stops", headers=H, json={"route_id": route_id, "name": "S1"})
check("stop create with valid route still 201", rr.status_code == 201, f"{rr.status_code}")

# 3. procurement status validation
rr = client.post("/api/v1/inventory/procurement", headers=H, json={"title": "T", "items": []})
pr_id = rr.json["data"]["id"]
rr = client.post(f"/api/v1/inventory/procurement/{pr_id}/approve", headers=H, json={"status": "bogus"})
check("procurement bogus status → 400", rr.status_code == 400, f"{rr.status_code}")
rr = client.post(f"/api/v1/inventory/procurement/{pr_id}/approve", headers=H, json={})
check("procurement default approve ok", rr.status_code == 200 and rr.json["data"]["status"] == "approved")

# 4. visitor search param
rr = client.post("/api/v1/visitors/checkin", headers=H, json={"name": "Zelda Searchme", "phone": "9801111222"})
check("visitor checkin still 201", rr.status_code == 201, f"{rr.status_code}")
rr = client.get("/api/v1/visitors?search=Zelda", headers=H)
check("visitor ?search matches by name", rr.status_code == 200 and len(rr.json["data"]) == 1, f"{rr.status_code} n={len(rr.json['data'])}")
rr = client.get("/api/v1/visitors?search=9801111", headers=H)
check("visitor ?search matches by phone", len(rr.json["data"]) == 1)
rr = client.get("/api/v1/visitors?search=zzzz", headers=H)
check("visitor ?search non-match → empty", len(rr.json["data"]) == 0)

# 5. sidebar no longer emits dead routes
rr = client.get("/api/v1/plugins/sidebar", headers=H)
items = {i["slug"]: i for i in rr.json["data"]["items"]}
dead = []
for slug in ("admission", "inventory", "visitor_management", "dismissal"):
    for sub in items.get(slug, {}).get("subitems", []):
        route = sub["route"].replace("/dashboard", "app/dashboard", 1)
        import os
        if not os.path.exists(f"/../frontend/{route}/page.tsx") and not os.path.exists(f"/app/../frontend/{route}/page.tsx"):
            dead.append((slug, sub["route"]))
check("sidebar has no dead subitems for the 4 single-page plugins", not dead, str(dead))
# sanity: fees/hr/transport subitems still present (they do have pages)
check("fees still has subitems", len(items.get("fees", {}).get("subitems", [])) >= 5)
check("hr_payroll still has subitems", len(items.get("hr_payroll", {}).get("subitems", [])) >= 5)
check("gps_tracking still has subitems", len(items.get("gps_tracking", {}).get("subitems", [])) >= 4)
# top-level single-page items now link directly
for slug, expected in (("admission", "/dashboard/admission"), ("inventory", "/dashboard/inventory"),
                       ("visitor_management", "/dashboard/visitors"), ("dismissal", "/dashboard/dismissal")):
    check(f"{slug} top-level route = {expected}", items.get(slug, {}).get("route") == expected)

print("\nFIX-SUMMARY:", sum(1 for _, ok in results if ok), "passed /", len(results))
