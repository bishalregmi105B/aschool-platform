"""TEMPORARY proof — WP-style plugin catalog with ZERO plugin seeding.

Throwaway DB aschool_test_wp (dropped + recreated before this run):
  env override subprocess → create_all + refresh_registry → marketplace
  lists every module plugin → install runs hooks → uninstall removes state.

Run:
  docker exec -e DATABASE_URL=postgresql://aschool:aschool@postgres:5432/aschool_test_wp \
      aschool-flask-1 python tmp_wp_catalog_proof.py
"""
import os
import uuid

from sqlalchemy import inspect  # noqa: E402 — must shadow nothing; used below

assert "aschool_test_wp" in os.getenv("DATABASE_URL", ""), "must target throwaway DB"

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {str(detail)[:220]}")


from app import create_app  # noqa: E402
from extensions import db  # noqa: E402

app = create_app()

with app.app_context():
    from app.models.plugin import Plugin, SchoolPlugin
    from app.models.school import School
    from app.models.user import User
    from app.plugins.loader import PluginLoader

    # 1. Fresh schema, ZERO seeding — plugins table starts EMPTY.
    db.create_all()
    check("fresh db: plugins table empty (zero seeding)",
          db.session.query(Plugin).count() == 0,
          f"count={db.session.query(Plugin).count()}")

    # 2. Registry scan mirrors the DIRECTORY into the catalog mirror.
    scan = PluginLoader.refresh_registry()
    slugs = {p.slug for p in Plugin.query.filter_by(is_published=True).all()}
    moved = {"white_label", "biometric", "multi_branch", "ai_adaptive_learning",
             "social_ads", "disaster_management", "incident_management"}
    check("refresh_registry creates mirror rows from directory scan",
          scan["created"] > 0 and moved <= slugs and scan["deactivated"] == 0,
          scan)

    # 3. Demo school + superadmin (users/schools only — NOT plugin catalog).
    demo = School(name="WP Proof School", slug=f"wp-proof-{uuid.uuid4().hex[:6]}",
                  plan="growth", status="active", is_active=True)
    db.session.add(demo)
    sa = User(email=f"wp-proof-{uuid.uuid4().hex[:6]}@test.np", role="superadmin",
              full_name="Proof SA", phone="+9779800000099", is_active=True)
    sa.set_password("Proof@1234")
    db.session.add(sa)
    db.session.commit()

    # 4. Marketplace endpoint lists the full catalog, nothing installed.
    client = app.test_client()
    r = client.post("/api/v1/auth/login", json={"email": sa.email, "password": "Proof@1234"})
    hdr = {"Authorization": f"Bearer {r.get_json()['data']['access_token']}"}
    # School context (the same resolution the app does from subdomains).
    hdr_school = {**hdr, "X-School-Slug": demo.slug}
    r = client.get("/api/v1/plugins/marketplace", headers=hdr_school)
    body = r.get_json()
    cards = {c["slug"]: c for c in body["data"]}
    check("marketplace lists all 7 moved module plugins, not_installed",
          r.status_code == 200 and moved <= set(cards)
          and all(cards[s]["install_state"] == "not_installed" for s in moved),
          f"total={len(cards)}")

    # 5. Install free attendance, then premium biometric (depends on it).
    r = client.post("/api/v1/plugins/install", headers=hdr_school, json={"plugin_slug": "attendance"})
    check("install free attendance → 201", r.status_code == 201, r.get_json())
    r = client.post("/api/v1/plugins/install", headers=hdr_school, json={"plugin_slug": "biometric"})
    j = r.get_json()
    check("install premium biometric → 201 (trial, activation hook ran)",
          r.status_code == 201 and j["data"].get("is_trial"), j)

    sp = SchoolPlugin.query.filter_by(school_id=demo.id, plugin_slug="biometric",
                                      uninstalled_at=None).first()
    tables_ok = all(inspect(db.engine).has_table(t) for t in
                    ("biometric_devices", "biometric_punches", "biometric_sync_logs"))
    check("SchoolPlugin row + biometric tables exist (activate hook)",
          sp is not None and sp.active and tables_ok,
          f"row={sp is not None} tables={tables_ok}")

    # 6. Uninstall → soft state only, data tables kept (WP keeps data).
    r = client.post("/api/v1/plugins/uninstall", headers=hdr_school, json={"plugin_slug": "biometric"})
    sp = SchoolPlugin.query.filter_by(school_id=demo.id, plugin_slug="biometric").first()
    r2 = client.get("/api/v1/plugins/marketplace", headers=hdr_school)
    card = next(c for c in r2.get_json()["data"] if c["slug"] == "biometric")
    check("uninstall → uninstalled_at set, marketplace not_installed",
          r.status_code == 200 and sp.uninstalled_at is not None
          and card["install_state"] == "not_installed")

    # 7. white_label uninstall hook removes its own config key only.
    demo.settings = {"white_label": {"brand_name": "X"}, "keep_me": True}
    db.session.commit()
    client.post("/api/v1/plugins/install", headers=hdr_school, json={"plugin_slug": "white_label"})
    client.post("/api/v1/plugins/uninstall", headers=hdr_school, json={"plugin_slug": "white_label"})
    db.session.expire_all()
    school = db.session.get(School, demo.id)
    check("white_label uninstall hook removes owned config key",
          "white_label" not in (school.settings or {}) and school.settings.get("keep_me") is True,
          school.settings)

    # 8. refresh-registry endpoint (superadmin) re-syncs additively.
    r = client.post("/api/v1/plugins/refresh-registry", headers=hdr)
    check("POST /plugins/refresh-registry → 200", r.status_code == 200, r.get_json())

print(f"\n{'ALL PROOFS PASS' if all(results) else 'PROOF FAILURES PRESENT'} "
      f"({sum(results)}/{len(results)})")
raise SystemExit(0 if all(results) else 1)
