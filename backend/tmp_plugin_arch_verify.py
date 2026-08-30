"""TEMPORARY verification probe — WordPress-style plugin architecture batch.

Covers (audits E160-E166): config-driven install policy (free = install,
paid = PLUGIN_TRIAL_DAYS trial), WP-style activate/deactivate vs
install/uninstall, plugin config GET/PUT (dict validation, merge + ?replace=1,
flag_modified persistence), trial-clock preservation on reinstall, uninstall
of deactivated plugins, marketplace lifecycle fields, plugins_nav sidebar.

Run: docker compose exec flask python tmp_plugin_arch_verify.py
"""
import uuid as _uuid

import requests

BASE = "http://localhost:5000/api/v1"
SUFFIX = _uuid.uuid4().hex[:6]
SLUG = f"plug-arch-{SUFFIX}"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:300]))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {str(detail)[:300]}")


from app import create_app  # noqa: E402
from extensions import cache, db  # noqa: E402

app = create_app()
TRIAL_DAYS = app.config.get("PLUGIN_TRIAL_DAYS", 14)
FREE_TIERS = set(app.config.get("PLUGIN_FREE_TIERS") or [])
SCHOOL_IDS = []
USER_IDS = []

with app.app_context():
    from app.models.plugin import Plugin, SchoolPlugin
    from app.models.school import School
    from app.models.user import User

    school = School(
        name="Plugin Arch Probe", slug=SLUG, type="private", level="secondary",
        district="Kathmandu", plan="free", is_active=True,
    )
    db.session.add(school)
    db.session.flush()
    school_id = str(school.id)
    SCHOOL_IDS.append(school_id)

    # Second school for tenant-scope checks
    school2 = School(
        name="Plugin Arch Probe 2", slug=f"{SLUG}-2", type="private",
        level="secondary", district="Kathmandu", plan="free", is_active=True,
    )
    db.session.add(school2)
    db.session.flush()
    school2_id = str(school2.id)
    SCHOOL_IDS.append(school2_id)

    def mkuser(sch_id, phone, email_local):
        u = User(
            school_id=sch_id, role="school_admin", full_name="Probe Admin",
            phone=phone, email=f"{email_local}@{SLUG}.test", is_active=True,
        )
        u.set_password("ProbePass123!")
        db.session.add(u)
        db.session.flush()
        USER_IDS.append(str(u.id))
        return u

    admin = mkuser(school_id, "9804440001", "admin1")
    admin2 = mkuser(school2_id, "9804440002", "admin2")
    db.session.commit()

    # Catalog picks: a published FREE plugin and a published PAID plugin
    free_plugin = (
        Plugin.query.filter_by(is_published=True, is_deleted=False, is_free=True)
        .order_by(Plugin.price_monthly.asc())
        .first()
    )
    paid_rows = Plugin.query.filter(
        Plugin.is_published.is_(True),
        Plugin.is_deleted.is_(False),
        Plugin.price_monthly > 0,
    ).all()
    paid_plugin = next(
        (p for p in paid_rows if not (p.depends_on or []) and not (p.conflicts_with or [])),
        None,
    )
    FREE_SLUG = free_plugin.slug
    PAID_SLUG = paid_plugin.slug
    print(f"# fixture school={school_id} free={FREE_SLUG} paid={PAID_SLUG} "
          f"(paid price={paid_plugin.price_monthly} cat={paid_plugin.category}) "
          f"PLUGIN_TRIAL_DAYS={TRIAL_DAYS} FREE_TIERS={sorted(FREE_TIERS)}")

    # Unit-level: plugin_is_free honours PLUGIN_FREE_TIERS + price==0
    from app.plugins.billing import plugin_is_free

    class _Fake:
        category = "core"
        is_free = False
        price_monthly = 499

    check("plugin_is_free honours PLUGIN_FREE_TIERS", plugin_is_free(_Fake()) is True,
          f"core tier with price 499 → {plugin_is_free(_Fake())}")
    _Fake.category = "starter"
    _Fake.price_monthly = 0
    check("plugin_is_free honours price_monthly==0", plugin_is_free(_Fake()) is True,
          f"starter price 0 → {plugin_is_free(_Fake())}")

    # Loader: plugins_nav present in bottom nav for admins
    from app.plugins.loader import PluginLoader
    nav = PluginLoader.get_bottom_nav_items([], "school_admin")
    nav_slugs = [i["slug"] for i in nav]
    check("bottom nav has plugins_nav near marketplace",
          "plugins_nav" in nav_slugs and
          nav_slugs.index("plugins_nav") == nav_slugs.index("marketplace_nav") + 1,
          f"order={nav_slugs}")
    catalog_nav = Plugin.query.filter_by(slug="plugins_nav").first()
    check("plugins_nav not a catalog product (published:false)",
          catalog_nav is None or catalog_nav.is_published is False,
          f"row={catalog_nav is not None} published={getattr(catalog_nav, 'is_published', None)}")


def headers_for(email):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "ProbePass123!"})
    assert r.status_code == 200, r.text[:200]
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


H = headers_for(f"admin1@{SLUG}.test")
H2 = headers_for(f"admin2@{SLUG}.test")


def mp_row(slug):
    r = requests.get(f"{BASE}/plugins/marketplace", headers=H)
    assert r.status_code == 200, r.text[:200]
    for row in r.json()["data"]:
        if row["slug"] == slug:
            return row
    return None


# ── 1. marketplace lifecycle fields ───────────────────────────────
row = mp_row(PAID_SLUG)
check("marketplace row has lifecycle fields",
      all(k in row for k in ("price_monthly", "tier", "is_installed", "is_trial",
                             "trial_days_left", "can_subscribe", "install_state")),
      f"keys={sorted(row.keys())[:12]}")
check("marketplace: paid not_installed → can_subscribe",
      row["install_state"] == "not_installed" and row["can_subscribe"] is True
      and row["trial_days_left"] is None, f"state={row['install_state']} can_sub={row['can_subscribe']}")

# ── 2. FREE install: instant, never a trial ───────────────────────
r = requests.post(f"{BASE}/plugins/install", json={"plugin_slug": FREE_SLUG}, headers=H)
check("free install → 201", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
body = r.json()["data"]
check("free install: is_trial=False, trial_ends_at=None, active",
      body["is_trial"] is False and body["trial_ends_at"] is None and body["active"] is True,
      str(body))
row = mp_row(FREE_SLUG)
check("marketplace: free installed → Install semantics (no trial copy)",
      row["install_state"] == "active" and row["is_installed"] is True
      and row["is_trial"] is False and row["trial_days_left"] is None
      and row["can_subscribe"] is False and row["trial_days"] == 0,
      f"state={row['install_state']} trial={row['is_trial']} left={row['trial_days_left']} "
      f"can_sub={row['can_subscribe']} trial_days={row['trial_days']}")
r = requests.post(f"{BASE}/plugins/{FREE_SLUG}/subscribe", headers=H)
check("subscribe on FREE plugin → 400 (needs no subscription)", r.status_code == 400,
      f"{r.status_code} {r.text[:120]}")

# ── 3. PAID install → PLUGIN_TRIAL_DAYS trial ─────────────────────
r = requests.post(f"{BASE}/plugins/install", json={"plugin_slug": PAID_SLUG}, headers=H)
check("paid install → 201 with trial", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
body = r.json()["data"]
check(f"paid install: is_trial=True, trial_days={TRIAL_DAYS}",
      body["is_trial"] is True and body["trial_ends_at"] is not None, str(body))
row = mp_row(PAID_SLUG)
check(f"marketplace: paid trial → trial_days_left == PLUGIN_TRIAL_DAYS ({TRIAL_DAYS})",
      row["is_trial"] is True and row["trial_days_left"] == TRIAL_DAYS
      and row["can_subscribe"] is True,
      f"left={row['trial_days_left']} can_sub={row['can_subscribe']}")

# ── 4. deactivate → gated route 403 + absent from installed cache ─
GATED = {
    "elibrary": "/elibrary/books", "lms": "/lms/courses", "fees": "/fees/types",
    "attendance": "/attendance/students", "admission": "/admission/inquiries",
    "library_management": "/library/books", "library": "/library/books",
}
gated_path = GATED.get(PAID_SLUG)
r_probe = requests.get(f"{BASE}{gated_path}", headers=H) if gated_path else None
if gated_path and r_probe is not None and r_probe.status_code == 200:
    requests.post(f"{BASE}/plugins/{PAID_SLUG}/deactivate", headers=H)
    r2 = requests.get(f"{BASE}{gated_path}", headers=H)
    check("deactivated plugin → gated route 403", r2.status_code == 403,
          f"{r2.status_code} {r2.text[:120]}")
    with app.app_context():
        cached = cache.get(f"school:{school_id}:plugins")
    check("deactivated plugin absent from g.installed_plugins source cache",
          isinstance(cached, list) and PAID_SLUG not in cached, f"cache={cached}")
    r3 = requests.post(f"{BASE}/plugins/{PAID_SLUG}/activate", headers=H)
    check("reactivate → 200", r3.status_code == 200, f"{r3.status_code} {r3.text[:120]}")
    r4 = requests.get(f"{BASE}{gated_path}", headers=H)
    check("reactivated plugin → gated route 200 again", r4.status_code == 200,
          f"{r4.status_code}")
else:
    check("deactivate gate probe", False,
          f"no 200-able gated route found for {PAID_SLUG} ({gated_path})")

# deactivate idempotency + trial preserved through deactivate/reactivate
with app.app_context():
    sp_before = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=PAID_SLUG).first()
    trial_ends_before = sp_before.trial_ends_at
requests.post(f"{BASE}/plugins/{PAID_SLUG}/deactivate", headers=H)
r = requests.post(f"{BASE}/plugins/{PAID_SLUG}/deactivate", headers=H)
check("deactivate idempotent on already-deactivated", r.status_code in (200, 409),
      f"{r.status_code} {r.text[:120]}")
requests.post(f"{BASE}/plugins/{PAID_SLUG}/activate", headers=H)
with app.app_context():
    sp_after = SchoolPlugin.query.filter_by(
        school_id=school_id, plugin_slug=PAID_SLUG).first()
check("activate preserves trial window (no clock reset)",
      sp_after.trial_ends_at == trial_ends_before and sp_after.is_trial is True,
      f"before={trial_ends_before} after={sp_after.trial_ends_at}")

# ── 5. plugin config GET/PUT ─────────────────────────────────────
cfg = {"banner_text": "Hello School", "max_seats": 40, "enabled": True,
       "meta": {"a": 1, "b": [1, 2]}}
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config", json=cfg, headers=H)
check("PUT config (dict) → 200", r.status_code == 200, f"{r.status_code} {r.text[:150]}")
r = requests.get(f"{BASE}/plugins/{PAID_SLUG}/config", headers=H)
check("GET config persists all value types",
      r.json()["data"] == cfg, f"got={r.json()['data']}")

# in-place edit bug class: SECOND PUT on a non-empty config must persist
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config",
                 json={"banner_text": "Changed", "max_seats": 55}, headers=H)
r = requests.get(f"{BASE}/plugins/{PAID_SLUG}/config", headers=H)
got = r.json()["data"]
check("second PUT persists (JSONB in-place edit bug fixed)",
      got.get("banner_text") == "Changed" and got.get("max_seats") == 55
      and got.get("enabled") is True and got.get("meta") == cfg["meta"],
      f"got={got}")

# ?replace=1 drops removed keys
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config?replace=1",
                 json={"banner_text": "Only"}, headers=H)
r = requests.get(f"{BASE}/plugins/{PAID_SLUG}/config", headers=H)
check("PUT ?replace=1 replaces whole config (removed keys dropped)",
      r.json()["data"] == {"banner_text": "Only"}, f"got={r.json()['data']}")

# merge default restores keys over the stored config
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config", json={"max_seats": 9}, headers=H)
r = requests.get(f"{BASE}/plugins/{PAID_SLUG}/config", headers=H)
check("default PUT merges over stored config",
      r.json()["data"] == {"banner_text": "Only", "max_seats": 9}, f"got={r.json()['data']}")

# validation
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config", json=[1, 2], headers=H)
check("PUT config non-dict → 400", r.status_code == 400, f"{r.status_code}")
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config", json={"last_payment": {}}, headers=H)
check("PUT config reserved key → 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")
r = requests.put(f"{BASE}/plugins/{PAID_SLUG}/config",
                 json={"blob": "x" * 20000}, headers=H)
check("PUT config oversize → 400", r.status_code == 400, f"{r.status_code}")
r = requests.get(f"{BASE}/plugins/{FREE_SLUG}/config", headers=H2)
check("cross-school GET config → 404", r.status_code == 404, f"{r.status_code}")
r = requests.put(f"{BASE}/plugins/{FREE_SLUG}/config", json={"x": 1}, headers=H2)
check("cross-school PUT config → 404", r.status_code == 404, f"{r.status_code}")

# ── 6. uninstall of a DEACTIVATED plugin (WP allows delete while inactive) ─
requests.post(f"{BASE}/plugins/{FREE_SLUG}/deactivate", headers=H)
r = requests.post(f"{BASE}/plugins/uninstall", json={"plugin_slug": FREE_SLUG}, headers=H)
check("uninstall works on a DEACTIVATED plugin", r.status_code == 200,
      f"{r.status_code} {r.text[:150]}")
r = requests.post(f"{BASE}/plugins/uninstall", json={"plugin_slug": FREE_SLUG}, headers=H)
check("uninstall again → 400 (already uninstalled)", r.status_code == 400,
      f"{r.status_code}")

# ── 7. trial-clock preservation on reinstall (no infinite trial) ──
with app.app_context():
    from datetime import datetime, timezone as _tz
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=PAID_SLUG).first()
    original_ends = sp.trial_ends_at
requests.post(f"{BASE}/plugins/uninstall", json={"plugin_slug": PAID_SLUG}, headers=H)
r = requests.post(f"{BASE}/plugins/install", json={"plugin_slug": PAID_SLUG}, headers=H)
check("paid reinstall → 200", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
with app.app_context():
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=PAID_SLUG).first()
check("reinstall preserves the ORIGINAL trial window (no clock reset)",
      sp.trial_ends_at == original_ends and sp.is_trial is True,
      f"orig={original_ends} now={sp.trial_ends_at}")

# expired trial → reinstall refused
requests.post(f"{BASE}/plugins/uninstall", json={"plugin_slug": PAID_SLUG}, headers=H)
with app.app_context():
    from datetime import timedelta
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=PAID_SLUG).first()
    sp.trial_ends_at = datetime.now(_tz.utc) - timedelta(days=1)
    db.session.commit()
    cache.delete(f"school:{school_id}:plugins")
r = requests.post(f"{BASE}/plugins/install", json={"plugin_slug": PAID_SLUG}, headers=H)
check("expired-trial reinstall refused (must subscribe)", r.status_code == 400
      and "already been used" in r.json().get("error", ""), f"{r.status_code} {r.text[:150]}")

# ...and the expired-trial row CAN be subscribed (no subscribe deadlock)
r = requests.post(
    f"{BASE}/plugins/{PAID_SLUG}/subscribe",
    json={"billing_cycle": "monthly",
          "payment": {"provider": "esewa", "transaction_id": f"probe-{SUFFIX}"}},
    headers=H,
)
check("subscribe after EXPIRED trial → 200 (no deadlock)",
      r.status_code == 200, f"{r.status_code} {r.text[:150]}")

# subscribed-then-uninstalled reinstall never mints a fresh trial
r = requests.post(
    f"{BASE}/plugins/{PAID_SLUG}/subscribe",
    json={"billing_cycle": "monthly",
          "payment": {"provider": "esewa", "transaction_id": f"probe-{SUFFIX}"}},
    headers=H,
)
check("subscribe with payment proof → 200", r.status_code == 200, f"{r.status_code} {r.text[:150]}")
with app.app_context():
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=PAID_SLUG).first()
    paid_recorded = sp.is_trial is False and (sp.config or {}).get("last_payment", {}).get(
        "transaction_id") == f"probe-{SUFFIX}"
requests.post(f"{BASE}/plugins/uninstall", json={"plugin_slug": PAID_SLUG}, headers=H)
r = requests.post(f"{BASE}/plugins/install", json={"plugin_slug": PAID_SLUG}, headers=H)
with app.app_context():
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug=PAID_SLUG).first()
check("subscribed reinstall: is_trial stays False, payment ref kept, no fresh trial",
      paid_recorded and r.status_code == 201 and sp.is_trial is False
      and sp.trial_ends_at is None
      and (sp.config or {}).get("last_payment", {}).get("transaction_id") == f"probe-{SUFFIX}",
      f"install={r.status_code} is_trial={sp.is_trial} config={str(sp.config)[:120]}")

# ── 8. live server picked up the new bottom-nav manifest ─────────
r = requests.get(f"{BASE}/plugins/sidebar", headers=H)
nav = [i["slug"] for i in r.json()["data"]["bottom_nav"]]
check("live /plugins/sidebar exposes plugins_nav", "plugins_nav" in nav, f"nav={nav}")

# ── cleanup ───────────────────────────────────────────────────────
with app.app_context():
    from sqlalchemy import text
    stmts = [
        "DELETE FROM school_plugins WHERE school_id::text IN :ids",
        "DELETE FROM plugin_usage_logs WHERE school_id::text IN :ids",
        "DELETE FROM users WHERE school_id::text IN :ids",
        "DELETE FROM schools WHERE id::text IN :ids",
    ]
    fails = 0
    for s in stmts:
        try:
            db.session.execute(text(s), {"ids": tuple(SCHOOL_IDS)})
        except Exception as exc:  # noqa: BLE001
            fails += 1
            print(f"cleanup skip: {s.split()[2]} → {exc.__class__.__name__}")
            db.session.rollback()
    db.session.commit()
    left = db.session.execute(
        text("SELECT COUNT(*) FROM schools WHERE slug LIKE :pat"),
        {"pat": f"{SLUG}%"}).scalar()
    check("cleanup removed probe schools", left == 0, f"left={left} fails={fails}")

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n== {passed}/{len(results)} checks passed ==")
if passed != len(results):
    raise SystemExit(1)
