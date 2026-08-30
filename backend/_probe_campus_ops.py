"""TEMP Phase-2 campus-ops verification probe (deleted after use).

Runs against the Flask test_client inside aschool-flask-1.
Creates two fixture schools (enterprise = all plugins; free = none) and runs
one end-to-end workflow per campus-ops plugin + gate/rollback checks.
"""
import random
import uuid
from datetime import date, datetime, timedelta

from app import create_app
from app.extensions import db
from app.models.academic import Class
from app.models.plugin import SchoolPlugin
from app.models.school import School
from app.models.student import Student
from app.models.user import User

app = create_app()
C = app.test_client()


class SafeClient:
    """Wraps the test client so server exceptions (500s) surface as responses."""

    def __init__(self, client):
        self._c = client

    def request(self, method, *a, **kw):
        try:
            return getattr(self._c, method)(*a, **kw)
        except Exception as exc:  # server raised instead of returning 500
            class _R:
                status_code = 500
                text = str(exc)[:400]

                def get_json(self, *a2, **k2):
                    return {"success": False, "error": str(exc)[:300]}

            return _R()

    def get(self, *a, **kw):
        return self.request("get", *a, **kw)

    def post(self, *a, **kw):
        return self.request("post", *a, **kw)

    def put(self, *a, **kw):
        return self.request("put", *a, **kw)


C = SafeClient(C)
PHONE = f"98{random.randint(10000000, 99999999)}"
PHONE_B = f"98{random.randint(10000000, 99999999)}"
PASSWORD = "ProbePass!2026"

results = []


def check(label, cond, detail=""):
    results.append((label, bool(cond), detail))
    print(f"{'[ok]  ' if cond else '[BUG] '} {label} {detail if not cond else ''}")


def register(phone, plan):
    r = C.post(
        "/api/v1/auth/register",
        json={
            "school_name": f"CampusOps Probe {phone}",
            "full_name": "Probe Admin",
            "phone": phone,
            "password": PASSWORD,
            "plan": plan,
        },
    )
    body = r.get_json()
    tokens = (body.get("data") or {}).get("access_token") or (body.get("data") or {}).get("tokens", {}).get("access_token")
    school_id = None
    if tokens:
        import base64
        import json as _json

        def _claim(tok, key):
            payload = tok.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            return _json.loads(base64.urlsafe_b64decode(payload)).get(key)

        school_id = _claim(tokens, "school_id")
    return r.status_code, tokens, school_id, body


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def j(r):
    try:
        return r.get_json()
    except Exception:
        return None


def data_of(r):
    b = j(r) or {}
    return b.get("data")


print("== setup ==")
status, tokA, schoolA, bodyA = register(PHONE, "enterprise")
check("register enterprise 201", status == 201, f"status={status} body={str(bodyA)[:300]}")
status_b, tokB, schoolB, _ = register(PHONE_B, "free")
check("register free 201", status_b == 201, f"status={status_b}")

with app.app_context():
    school = db.session.get(School, uuid.UUID(schoolA))
    admin = User.query.filter_by(school_id=school.id, role="school_admin").first()
    cls = Class(school_id=school.id, name="Grade 10")
    db.session.add(cls)
    db.session.flush()
    students = []
    for i in range(1, 4):
        s = Student(
            school_id=school.id,
            first_name=f"Probe{i}",
            last_name="Student",
            class_id=cls.id,
            admission_number=f"COPS-{i:03d}",
            status="active",
        )
        db.session.add(s)
        students.append(s)
    db.session.commit()
    S1, S2, S3 = (str(s.id) for s in students)
    CLASS_ID = str(cls.id)
    installed = sorted(
        sp.plugin_slug for sp in SchoolPlugin.query.filter_by(school_id=school.id, active=True).all()
    )
    need = ["library_management", "elibrary", "hostel", "health_records", "emergency",
            "disaster_management", "incidents", "incident_management", "gamification", "wellbeing"]
    check("enterprise school has all 10 campus-ops plugins", all(p in installed for p in need),
          f"missing={[p for p in need if p not in installed]}")

# ---------------------------------------------------------------- gates (free school)
print("== gate checks: free school (expect 403 everywhere) ==")
for label, path in [
    ("library gate", "/api/v1/library/books"),
    ("elibrary gate", "/api/v1/elibrary/books"),
    ("hostel gate (NO GATE pre-fix?)", "/api/v1/hostel"),
    ("health_records gate", "/api/v1/health-records/visits"),
    ("emergency gate", "/api/v1/emergency/alerts"),
    ("incidents gate", "/api/v1/incidents"),
    ("gamification gate", "/api/v1/gamification/leaderboard"),
    ("wellbeing gate", "/api/v1/wellbeing/mood"),
]:
    r = C.get(path, headers=H(tokB))
    check(f"free school {label} -> 403", r.status_code == 403, f"got {r.status_code}")

# ---------------------------------------------------------------- library_management
print("== library_management ==")
r = C.post("/api/v1/library/books", headers=H(tokA),
           json={"title": "Nepali Kovida", "author": "Lekhnath", "total_copies": 2, "available_copies": 2, "category": "fiction"})
check("create book 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
book_id = (data_of(r) or {}).get("id")
r = C.get("/api/v1/library/books?search=kovida", headers=H(tokA))
check("list books search", r.status_code == 200 and any(b["id"] == book_id for b in data_of(r)), f"got {r.status_code}")

r = C.post("/api/v1/library/issues", headers=H(tokA),
           json={"book_id": book_id, "student_id": S1, "due_date": str(date.today() + timedelta(days=14))})
check("issue book 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
issue_id = (data_of(r) or {}).get("id")
with app.app_context():
    from app.models.library import Book
    avail_after_issue = db.session.get(Book, uuid.UUID(book_id)).available_copies
check("available_copies decremented 2->1", avail_after_issue == 1, f"got {avail_after_issue}")

r = C.post(f"/api/v1/library/issues/{issue_id}/return", headers=H(tokA), json={})
check("return book 200", r.status_code == 200, f"got {r.status_code} {str(j(r))[:200]}")
with app.app_context():
    avail_after_return = db.session.get(Book, uuid.UUID(book_id)).available_copies
check("available_copies restored 1->2", avail_after_return == 2, f"got {avail_after_return}")
r = C.post(f"/api/v1/library/issues/{issue_id}/return", headers=H(tokA), json={})
check("double return 400", r.status_code == 400, f"got {r.status_code}")
r = C.get("/api/v1/library/issues?status=returned", headers=H(tokA))
check("issues list filter returned", r.status_code == 200 and data_of(r), f"got {r.status_code}")

bogus = str(uuid.uuid4())
r = C.post("/api/v1/library/issues", headers=H(tokA), json={"book_id": book_id, "student_id": bogus})
check(f"issue with bogus student_id -> 4xx (pre-fix may be 500)", r.status_code in (400, 404), f"got {r.status_code}")
r = C.post("/api/v1/library/issues", headers=H(tokA), json={"student_id": S1})
check("issue without book_id -> 400", r.status_code == 400, f"got {r.status_code}")

# ---------------------------------------------------------------- elibrary
print("== elibrary ==")
r = C.post("/api/v1/elibrary/books", headers=H(tokA),
           json={"title": "Algebra Ebook", "author": "R. Sharma", "file_url": "https://cdn.test/algebra.pdf", "file_type": "pdf"})
check("create ebook 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.get("/api/v1/elibrary/books?search=algebra", headers=H(tokA))
d = data_of(r) or []
stats = (j(r).get("meta") or {}).get("stats", {})
check("list ebooks + stats", r.status_code == 200 and len(d) == 1 and stats.get("total") == 1, f"got {r.status_code} stats={stats}")
r = C.get("/api/v1/elibrary/papers", headers=H(tokA))
check("GET /elibrary/papers 200", r.status_code == 200, f"got {r.status_code}")
r = C.get("/api/v1/elibrary/past-papers", headers=H(tokA))
check("frontend's GET /elibrary/past-papers exists", r.status_code == 200, f"got {r.status_code} (frontend calls this!)")
r = C.get("/api/v1/elibrary/resources", headers=H(tokA))
check("GET /elibrary/resources 200", r.status_code == 200, f"got {r.status_code}")

# ---------------------------------------------------------------- hostel
print("== hostel ==")
r = C.post("/api/v1/hostel", headers=H(tokA), json={"name": "Boys Block A", "type": "boys", "total_capacity": 10})
check("create hostel 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
hostel_id = (data_of(r) or {}).get("id")
r = C.post("/api/v1/hostel/rooms", headers=H(tokA),
           json={"hostel_id": hostel_id, "room_number": "101", "capacity": 2, "monthly_fee": 3000})
check("create room 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
room_id = (data_of(r) or {}).get("id")
r = C.post("/api/v1/hostel/allocations", headers=H(tokA),
           json={"room_id": room_id, "student_id": S1, "check_in_date": str(date.today())})
check("allocate S1 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
alloc1 = (data_of(r) or {}).get("id")
r = C.post("/api/v1/hostel/allocations", headers=H(tokA),
           json={"room_id": room_id, "student_id": S2, "check_in_date": str(date.today())})
check("allocate S2 201", r.status_code == 201, f"got {r.status_code}")
r = C.post("/api/v1/hostel/allocations", headers=H(tokA),
           json={"room_id": room_id, "student_id": S3, "check_in_date": str(date.today())})
check("allocate into full room -> 422", r.status_code == 422, f"got {r.status_code}")
r = C.get("/api/v1/hostel/summary", headers=H(tokA))
d = data_of(r) or []
check("summary occupancy 2/2 = 100%", r.status_code == 200 and d and d[0]["occupied"] == 2 and d[0]["occupancy_pct"] == 100,
      f"got {r.status_code} {d}")
r = C.post("/api/v1/hostel/allocations", headers=H(tokA),
           json={"room_id": room_id, "student_id": S1, "check_in_date": str(date.today())})
check("duplicate active allocation -> 422", r.status_code == 422, f"got {r.status_code}")
r = C.post(f"/api/v1/hostel/allocations/{alloc1}/checkout", headers=H(tokA), json={"check_out_date": str(date.today())})
check("checkout S1 200", r.status_code == 200 and (data_of(r) or {}).get("status") == "checked_out", f"got {r.status_code}")
r = C.get("/api/v1/hostel/summary", headers=H(tokA))
d = data_of(r) or []
check("summary after checkout 1/2", r.status_code == 200 and d and d[0]["occupied"] == 1 and d[0]["occupancy_pct"] == 50, f"got {d}")
r = C.post("/api/v1/hostel/allocations", headers=H(tokA),
           json={"room_id": room_id, "student_id": bogus, "check_in_date": str(date.today())})
check("allocate bogus student -> 4xx (pre-fix may be 500)", r.status_code in (400, 404, 422), f"got {r.status_code}")
with app.app_context():
    from app.models.hostel import HostelAllocation
    n_allocs = HostelAllocation.query.filter_by(school_id=school.id).count()
check("rollback: no phantom allocation rows after failed writes", n_allocs == 2, f"rows={n_allocs}")

# ---------------------------------------------------------------- health_records
print("== health_records ==")
r = C.put(f"/api/v1/health-records/students/{S1}", headers=H(tokA),
          json={"blood_group": "A+", "height_cm": 122, "weight_kg": 31.5, "allergies": ["peanut"]})
check("create profile via PUT 200", r.status_code == 200 and (data_of(r) or {}).get("blood_group") == "A+",
      f"got {r.status_code} {str(j(r))[:200]}")
r = C.get(f"/api/v1/health-records/students/{S1}", headers=H(tokA))
check("GET profile exists", r.status_code == 200 and (data_of(r) or {}).get("exists") is True, f"got {r.status_code}")
r = C.post("/api/v1/health-records/visits", headers=H(tokA),
           json={"student_id": S1, "reason": "fever", "diagnosis": "flu", "treatment": "rest"})
check("create visit 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.get(f"/api/v1/health-records/visits?student_id={S1}", headers=H(tokA))
check("list visits filtered", r.status_code == 200 and len(data_of(r) or []) == 1, f"got {r.status_code}")
r = C.post("/api/v1/health-records/immunizations", headers=H(tokA),
           json={"student_id": S1, "vaccine_name": "MMR", "dose_number": 1, "date_administered": str(date.today())})
check("create immunization 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.get("/api/v1/health-records/immunizations", headers=H(tokA))
check("list immunizations", r.status_code == 200 and len(data_of(r) or []) == 1, f"got {r.status_code}")
r = C.put(f"/api/v1/health-records/students/{bogus}", headers=H(tokA), json={"blood_group": "O-"})
check("profile for bogus student -> 4xx (pre-fix 500)", r.status_code in (400, 404), f"got {r.status_code}")

# ---------------------------------------------------------------- emergency
print("== emergency ==")
r = C.post("/api/v1/emergency/alerts", headers=H(tokA),
           json={"alert_type": "fire", "title": "Fire drill", "description": "Main building"})
check("trigger alert 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
alert_id = (data_of(r) or {}).get("id")
r = C.get("/api/v1/emergency/alerts?status=active", headers=H(tokA))
check("list active alerts contains alert", r.status_code == 200 and any(a["id"] == alert_id for a in (data_of(r) or [])), f"got {r.status_code}")
r = C.post(f"/api/v1/emergency/alerts/{alert_id}/headcount", headers=H(tokA),
           json={"class_id": CLASS_ID, "total_expected": 3, "total_present": 2, "missing_student_ids": [S3]})
check("submit headcount 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
hc = data_of(r) or {}
check("headcount missing ids echo", hc.get("missing_student_ids") == [S3] and hc.get("total_present") == 2, f"got {hc}")
r = C.get(f"/api/v1/emergency/alerts/{alert_id}/headcount", headers=H(tokA))
check("list headcounts", r.status_code == 200 and len(data_of(r) or []) == 1, f"got {r.status_code}")
r = C.post(f"/api/v1/emergency/alerts/{alert_id}/resolve", headers=H(tokA), json={"status": "resolved"})
check("resolve alert", r.status_code == 200 and (data_of(r) or {}).get("status") == "resolved", f"got {r.status_code}")
r = C.post(f"/api/v1/emergency/alerts/{bogus}/headcount", headers=H(tokA), json={"total_expected": 1, "total_present": 1})
check("headcount on bogus alert -> 4xx (pre-fix 500)", r.status_code in (400, 404), f"got {r.status_code}")

# ---------------------------------------------------------------- disaster_management (frontend contract)
print("== disaster_management (frontend contract vs backend) ==")
for label, path in [
    ("GET /emergency/disaster/overview", "/api/v1/emergency/disaster/overview"),
    ("GET /emergency/drills", "/api/v1/emergency/drills"),
    ("GET /emergency/evacuation-plans", "/api/v1/emergency/evacuation-plans"),
    ("GET /emergency/seismic-alerts", "/api/v1/emergency/seismic-alerts"),
]:
    r = C.get(path, headers=H(tokA))
    check(f"disaster page endpoint {label}", r.status_code == 200, f"got {r.status_code} — frontend calls this!")
r = C.post("/api/v1/emergency/plans", headers=H(tokA), json={"name": "Earthquake plan", "emergency_type": "earthquake"})
check("emergency plans create 201 (route /emergency/plans)", r.status_code == 201, f"got {r.status_code}")

# ---------------------------------------------------------------- incidents pair
print("== incidents / incident_management ==")
r = C.post("/api/v1/incidents", headers=H(tokA),
           json={"title": "Playground fight", "incident_type": "bullying", "severity": "high",
                 "location": "yard", "involved_student_ids": [S1, S2], "description": "shoving match"})
check("create incident 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
inc_id = (data_of(r) or {}).get("id")
r = C.post(f"/api/v1/incidents/{inc_id}/statements", headers=H(tokA), json={"statement": "I saw it from the window"})
check("witness statement 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.post(f"/api/v1/incidents/{inc_id}/actions", headers=H(tokA),
           json={"action_type": "counseling", "description": " counselor session", "student_id": S1})
check("incident action 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.put(f"/api/v1/incidents/{inc_id}", headers=H(tokA), json={"status": "resolved", "resolution": "parents informed"})
check("resolve incident via PUT", r.status_code == 200 and (data_of(r) or {}).get("status") == "resolved", f"got {r.status_code}")
r = C.get(f"/api/v1/incidents/{inc_id}", headers=H(tokA))
d = data_of(r) or {}
check("incident detail embeds statements+actions",
      r.status_code == 200 and len(d.get("witness_statements", [])) == 1 and len(d.get("actions", [])) == 1, f"got {r.status_code} {d}")
r = C.get("/api/v1/incidents?severity=high", headers=H(tokA))
check("incidents filter severity", r.status_code == 200 and len(data_of(r) or []) == 1, f"got {r.status_code}")
r = C.post(f"/api/v1/incidents/{bogus}/statements", headers=H(tokA), json={"statement": "x"})
check("statement on bogus incident -> 4xx (pre-fix 500)", r.status_code in (400, 404), f"got {r.status_code}")
print("-- incident_management extension endpoints (frontend calls) --")
for label, path in [
    ("GET /incidents/management/overview", "/api/v1/incidents/management/overview"),
    ("GET /incidents/management/active", "/api/v1/incidents/management/active"),
    ("GET /incidents/management/escalations", "/api/v1/incidents/management/escalations"),
    ("GET /incidents/management/reports", "/api/v1/incidents/management/reports"),
]:
    r = C.get(path, headers=H(tokA))
    check(f"incident-mgmt page endpoint {label}", r.status_code == 200, f"got {r.status_code} — frontend calls this!")

# ---------------------------------------------------------------- gamification
print("== gamification ==")
r = C.post("/api/v1/gamification/badges", headers=H(tokA),
           json={"name": "Perfect Week", "criteria": "7 days present", "points_value": 50})
check("create badge 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
badge_id = (data_of(r) or {}).get("id")
r = C.post("/api/v1/gamification/points", headers=H(tokA), json={"student_id": S1, "points": 50, "reason": "attendance", "category": "attendance"})
check("award S1 +50", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.post("/api/v1/gamification/points", headers=H(tokA), json={"student_id": S1, "points": 30, "reason": "helping", "category": "behavior"})
check("award S1 +30", r.status_code == 201, f"got {r.status_code}")
r = C.post("/api/v1/gamification/points", headers=H(tokA), json={"student_id": S2, "points": 100, "reason": "top grade", "category": "academic"})
check("award S2 +100", r.status_code == 201, f"got {r.status_code}")
r = C.post("/api/v1/gamification/points", headers=H(tokA), json={"student_id": S3, "points": 10, "reason": "cleanup", "category": "general"})
check("award S3 +10", r.status_code == 201, f"got {r.status_code}")
r = C.get("/api/v1/gamification/leaderboard", headers=H(tokA))
lb = data_of(r) or []
expected = [(S2, 100), (S1, 80), (S3, 10)]
got = [(e.get("student_id"), e.get("total_points")) for e in lb]
check("leaderboard order+totals hand-check", got == expected, f"got {got} expected {expected}")
check("leaderboard has student_name for frontend", all(e.get("student_name") for e in lb), f"got {lb}")
r = C.get(f"/api/v1/gamification/points/{S1}", headers=H(tokA))
d = data_of(r) or {}
check("student_points total 80", d.get("total_points") == 80, f"got {d.get('total_points')}")
r = C.post("/api/v1/gamification/award-badge", headers=H(tokA), json={"student_id": S1, "badge_id": badge_id})
check("award badge 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.post("/api/v1/gamification/points", headers=H(tokA), json={"student_id": bogus, "points": 5})
check("award points bogus student -> 4xx (pre-fix 500)", r.status_code in (400, 404), f"got {r.status_code}")
r = C.post("/api/v1/gamification/award-badge", headers=H(tokA), json={"student_id": S1, "badge_id": bogus})
check("award badge bogus badge -> 4xx (pre-fix 500)", r.status_code in (400, 404), f"got {r.status_code}")
r = C.post("/api/v1/gamification/points", headers=H(tokA), json={"student_id": S1, "points": "abc"})
check("award points non-numeric -> 400 (pre-fix 500)", r.status_code == 400, f"got {r.status_code}")

# ---------------------------------------------------------------- wellbeing
print("== wellbeing ==")
r = C.post("/api/v1/wellbeing/mood", headers=H(tokA), json={"student_id": S1, "mood": "happy", "energy_level": 4, "notes": "good day"})
check("mood log S1 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.post("/api/v1/wellbeing/mood", headers=H(tokA), json={"student_id": S2, "mood": "sad", "energy_level": 2})
check("mood log S2 201", r.status_code == 201, f"got {r.status_code}")
r = C.post("/api/v1/wellbeing/mood", headers=H(tokA), json={"student_id": S3, "mood": "anxious", "energy_level": 3})
check("mood log S3 201", r.status_code == 201, f"got {r.status_code}")
r = C.get("/api/v1/wellbeing/mood?student_id=" + S1, headers=H(tokA))
check("mood list filter", r.status_code == 200 and len(data_of(r) or []) == 1, f"got {r.status_code}")
r = C.get("/api/v1/wellbeing/mood/summary?days=7", headers=H(tokA))
d = data_of(r) or {}
check("mood summary distribution hand-check",
      d.get("mood_distribution") == {"happy": 1, "sad": 1, "anxious": 1} and d.get("total_entries") == 3,
      f"got {d}")
r = C.post("/api/v1/wellbeing/counselor-notes", headers=H(tokA),
           json={"student_id": S2, "type": "followup", "content": "talked to guardian"})
check("counselor note 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.get("/api/v1/wellbeing/counselor-notes", headers=H(tokA))
check("counselor notes list", r.status_code == 200 and len(data_of(r) or []) == 1, f"got {r.status_code}")
r = C.post("/api/v1/wellbeing/surveys", headers=H(tokA), json={"title": "Monthly check", "questions": [{"q": "stress?"}]})
check("survey create 201", r.status_code == 201, f"got {r.status_code} {str(j(r))[:200]}")
r = C.post("/api/v1/wellbeing/mood", headers=H(tokA), json={"mood": "happy"})
check("mood without student_id resolves current user (pre-fix 500?)", r.status_code in (200, 201, 400, 404), f"got {r.status_code}")
r = C.post("/api/v1/wellbeing/counselor-notes", headers=H(tokA), json={"type": "general"})
check("counselor note missing student_id -> 400 (pre-fix KeyError 500)", r.status_code == 400, f"got {r.status_code}")

# ---------------------------------------------------------------- student-app routes (no plugin gate?)
print("== student-app routes (gate check: free school) ==")
with app.app_context():
    # create a student user for school B to test student routes without plugins
    from app.models.academic import Class as ClsB
    schB = db.session.get(School, uuid.UUID(schoolB))
    cb = ClsB(school_id=schB.id, name="Grade 9")
    sb_user = User(school_id=schB.id, email=f"stub_{PHONE_B}@test.np", phone=PHONE_B + "1",
                   full_name="Stub Student", role="student")
    sb_user.set_password(PASSWORD)
    db.session.add(sb_user)
    db.session.add(cb)
    db.session.flush()
    sb = Student(school_id=schB.id, user_id=sb_user.id, first_name="Stub", last_name="Student",
                 class_id=cb.id, status="active", student_id="COPS-STU-001")
    db.session.add(sb)
    db.session.commit()

r = C.post("/api/v1/auth/student-login", json={"student_id": "COPS-STU-001", "password": PASSWORD})
tokS = None
b = j(r) or {}
tokS = (b.get("data") or {}).get("access_token")
check("student-login with student code works", bool(tokS), f"got {r.status_code} {str(b)[:200]}")
if tokS:
    for label, method, path in [
        ("student library GET", "get", "/api/v1/student/library"),
        ("student elibrary GET", "get", "/api/v1/student/elibrary"),
        ("student wellbeing GET", "get", "/api/v1/student/wellbeing"),
    ]:
        r = getattr(C, method)(path, headers=H(tokS))
        check(f"free school {label} (no plugin gate) -> 403 ideal", r.status_code == 403, f"got {r.status_code}")

# ---------------------------------------------------------------- cleanup
def purge_schools(ids):
    """Delete fixture schools + every school_id child row (multi-pass with
    savepoints; child-of-child FKs force ordering)."""
    with app.app_context():
        from sqlalchemy import bindparam, text as _text

        tables = [
            r[0]
            for r in db.session.execute(_text(
                "SELECT DISTINCT kcu.table_name FROM information_schema.table_constraints tc "
                "JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name "
                "AND kcu.table_schema = tc.table_schema "
                "JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name "
                "AND ccu.table_schema = tc.table_schema "
                "WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'schools' "
                "AND kcu.column_name = 'school_id' AND tc.table_schema = 'public'"
            )).fetchall()
        ]
        remaining = list(tables)
        # schools.owner_id -> users.id blocks deleting the admin user before the
        # school row; detach the ownership link first (fixture cleanup only).
        db.session.execute(_text(
            "UPDATE schools SET owner_id = NULL WHERE id IN :ids").bindparams(
            bindparam("ids", expanding=True)), {"ids": ids})
        db.session.commit()
        errs = {}
        for i in range(8):
            still = []
            errs = {}
            for t in tables:  # re-process ALL tables each pass
                try:
                    with db.session.begin_nested():
                        db.session.execute(
                            _text(f'DELETE FROM "{t}" WHERE school_id IN :ids').bindparams(
                                bindparam("ids", expanding=True)),
                            {"ids": ids})
                except Exception as e:
                    still.append(t)
                    errs[t] = str(e).splitlines()[0][:160]
            db.session.commit()
            remaining = still
            if not still:
                break
        if remaining:
            raise RuntimeError(f"cleanup could not clear: {remaining} errors={errs}")
        db.session.execute(_text("DELETE FROM schools WHERE id IN :ids").bindparams(
            bindparam("ids", expanding=True)), {"ids": ids})
        db.session.commit()


print("== cleanup ==")
with app.app_context():
    # also purge leftovers from earlier aborted probe runs
    stale = School.query.filter(School.name.like("CampusOps Probe %")).all()
    if stale:
        purge_schools([str(s.id) for s in stale])
        print(f"purged {len(stale)} leftover school(s)")
purge_schools([schoolA, schoolB])
print("cleanup done")

print("\n== SUMMARY ==")
bugs = [lbl for lbl, ok, _ in results if not ok]
print(f"{len(results) - len(bugs)}/{len(results)} checks passed")
print("FAILED:")
for lbl in bugs:
    print("  -", lbl)
