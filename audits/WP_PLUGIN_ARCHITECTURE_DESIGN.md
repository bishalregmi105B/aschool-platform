# WP-STYLE PLUGIN ARCHITECTURE — RESEARCH + MIGRATION DESIGN (2026-08-30)

## How WordPress manages plugins (verified model)
1. **Filesystem is the catalog.** Plugins live in `wp-content/plugins/<folder>/<main>.php`; the main file starts with a plugin **header comment** (Plugin Name, Version, Description, Author, TextDomain). WP scans the directory at runtime — drop a folder in, the plugin appears in the admin list instantly. **No DB insert for the catalog.**
2. **DB stores only STATE.** `wp_options.active_plugins` = array of ACTIVE plugin file paths (+ per-site state on multisite). Deactivated = just not in the array.
3. **Folders are fully self-contained.** Each plugin dir carries ALL its code: main file, `includes/`, `assets/` (css/js), `templates/`, `readme.txt`, `uninstall.php`.
4. **Lifecycle hooks.** `register_activation_hook` (create tables/defaults on activate), `register_deactivation_hook` (cleanup-light), `uninstall.php` (full removal on delete).
5. **Versioning/updates** via `readme.txt` + update API; schema upgrades via `dbDelta()` in the activation hook.

## Where ASchool is today (delta)
| WP concept | ASchool now | Gap |
|---|---|---|
| Plugin folder w/ header | `backend/app/plugins/modules/<slug>/manifest.yaml` — loader.py already scans dir at startup ✅ | manifest lacks some header fields (author, config schema, uninstall hook) |
| Self-contained code | Blueprint/services live OUTSIDE (app/api/v1/*.py referenced by entry_points) | move/attach code into the module folder |
| FS = catalog | DB `Plugin` table is the catalog; populated by seed scripts ❌ | **marketplace must read the FS registry live**; DB Plugin table deprecated for catalog |
| DB = state only | `SchoolPlugin` per-school install/activate ✅ (matches WP) | keep |
| Activation hook | install = SchoolPlugin row only | add module-level `hooks.py::activate/deactivate/uninstall` |
| No seed needed | seed.py/seed_full.py hardcode/seed catalog | remove plugin seeding entirely |

## Target architecture (one folder = one plugin)
```
backend/app/plugins/modules/<slug>/
  manifest.yaml        # name, slug, version, description, author, category/tier,
                       # price_monthly, price_yearly, depends_on, published
  routes.py            # the plugin's Flask blueprint (moved from app/api/v1 where owned by the plugin)
  services.py|services/
  models.py            # plugin-owned tables (SQLAlchemy models, created on activate)
  config_schema.yaml   # settings screen definition (field, type, default, help)
  hooks.py             # activate(db), deactivate(db), uninstall(db) lifecycle
  tests/               # plugin tests
  README.md
  frontend/            # declarative: routes → frontend pages (FE tree stays, mapping declared here)
  mobile/              # mobile repo/screen declarations
```

## Runtime rules to implement
1. **Discovery**: loader scans `modules/` at startup AND exposes `POST /api/v1/plugins/refresh-registry` (superadmin) → re-scan without restart. Registry = in-memory; on scan, UPSERT catalog mirror rows into `Plugin` (for backward-compatible queries) and DEACTIVATE (published=false) any DB row whose folder vanished.
2. **Catalog reads**: `/plugins/marketplace`, `/plugins/installed`, sidebar/nav must read the REGISTRY (merged with SchoolPlugin state), never trust seed data.
3. **Seed scripts**: delete ALL plugin-catalog seeding from seed.py/seed_full.py (they keep schools/users/demo data only).
4. **Lifecycle**: on install → run module `hooks.activate` (create its tables via its metadata, seed its defaults); on deactivate → hooks.deactivate; on uninstall → hooks.uninstall (drop plugin-owned tables? default: keep data, only remove state — WP keeps data too; document).
5. **API contract unchanged** for frontend/mobile (same endpoints/shapes) — only the data source changes.
6. Config schema: `GET /plugins/<slug>/config-schema` serves config_schema.yaml → the existing /dashboard/plugins/[slug]/settings page renders the form from it instead of generic key/value.

## Migration steps (ordered)
1. Loader: add header parsing (author, config_schema path, hooks import), registry refresh API, catalog mirror upsert.
2. plugins.py: switch marketplace/installed/nav to registry-first.
3. Move each plugin's blueprint into its folder where the plugin owns it (start with the 7 newly implemented ones: white_label, biometric, multi_branch, adaptive_learning, social_ads, disaster_management, incident_management — they have no legacy callers), keep app/api/v1 shims importing from the new location for untouched ones.
4. hooks.py for the 7 new plugins (activate = create tables; the models already exist).
5. config_schema.yaml for 3-5 flagship plugins; settings page consumes schema.
6. Strip plugin seeding from seed scripts; seed_full keeps demo school/users.
7. Fresh-deploy check: empty DB + `create_all` + registry scan → marketplace lists ALL plugins with zero plugin seeding.

---

# IMPLEMENTED (2026-08-31)

All migration steps landed; every item below is in the working tree (uncommitted at write time).

## 1. Loader (`backend/app/plugins/loader.py`)
- **Header fields parsed** per manifest: `author` (→ `_author`), `config_schema` (`true`/relative path → `_config_schema_path`), `hooks` (explicit module or auto-detected `hooks.py` next to the manifest → `_hooks_module`).
- **`refresh_registry()`**: rescans `modules/` + legacy `manifests/`, then UPSERTs the `plugins` mirror table — missing folders get rows (`published=True` unless the manifest says `published: false`), existing rows get additive field sync (manifest wins, DB-only fields like screenshots/tags preserved), DB rows whose folder vanished are **unpublished, never deleted**. Returns `{scanned, created, updated, deactivated}`. Unknown `category` values fall back to `starter` (enum-safe).
- **`POST /api/v1/plugins/refresh-registry`** — superadmin-only (`backend/app/api/v1/plugins.py`), runs the same rescan without a restart.
- **Startup**: `create_app()` calls `refresh_registry()` inside an app context after blueprint mounting (best-effort, logged non-fatal) → fresh DB + scan = full catalog, **zero seeding**.
- **Mount fix**: `discover_and_register` skips only `STATICALLY_MOUNTED_MODULES` when mounting manifest blueprints (the scan's path set is informational). Import failures of manifest blueprints are logged and non-fatal. (During implementation the skip set briefly included every scanned manifest path, which silently un-mounted all manifest-only blueprints such as `app.api.v1.portfolio` — fixed and covered by tests.)

## 2. Catalog reads (`backend/app/api/v1/plugins.py`)
- `/marketplace` builds `_catalog_entries()` from the REGISTRY (manifest wins) merged with the `plugins` mirror (fallback for marketplace-only fields); published mirror-only rows still appear until the next refresh unpublishes them. Per-school install state comes from `SchoolPlugin` (`install_state`: `not_installed | active | inactive`). Response shape unchanged from the pre-migration contract.
- `/installed` and `/sidebar` unchanged in shape; sidebar/nav keep reading the loader (registry) with per-role visibility.

## 3. Blueprints moved into module folders (7)
`white_label`, `biometric`, `multi_branch`, `ai_adaptive_learning` (slug; the `adaptive_learning` legacy import path), `social_ads`, `disaster_management`, `incident_management` — each now has `app/plugins/modules/<slug>/routes.py`; `app/api/v1/<name>.py` is a 2-line re-export shim. They remain mounted statically (listed in `STATICALLY_MOUNTED_MODULES`) so url rules exist exactly once.

## 4. Lifecycle hooks (`hooks.py` in each of the 7)
- `activate(db)`: `model.__table__.create(db.engine, checkfirst=True)` for module-owned models — idempotent.
- `deactivate(db)`: no-op (WP-style light deactivation).
- `uninstall(db)`: removes ONLY module-owned config rows (e.g. white_label deletes `school.settings["white_label"]`); data tables are kept (WordPress keeps data on uninstall too).
- Wired into plugins.py `install` (activate), `uninstall` (uninstall), plus `trial`/`subscribe` (activate). All hook import/runtime failures are logged and non-fatal (`_run_plugin_hook`).

## 5. Config schemas + settings UI
- `config_schema.yaml` shipped for `attendance`, `fees`, `whatsapp_bot`, `ai_tools`, `website_builder`.
- `GET /plugins/<slug>/config-schema` → `{slug, has_schema, fields}` (empty fields → generic fallback).
- `frontend/app/dashboard/plugins/[slug]/settings/page.tsx` renders schema fields first (string/number/boolean/json controls, dot-path nested keys, defaults, help text) and keeps the generic key/value editor for undeclared keys; saves the full dict with `?replace=1`; never displays/writes the reserved `last_payment` key. tsc clean for this file.

## 6. Seed scripts
- `backend/seed.py` + `backend/seed_full.py` seed **no plugin catalog rows** — they run `PluginLoader.refresh_registry()` (same as startup) and create demo install STATE through `install_plugin()` against registry-backed rows.

## 7. Proof (throwaway DB, zero seeding)
`backend/tmp_wp_catalog_proof.py` against a dropped/recreated `aschool_test_wp` Postgres DB (DATABASE_URL env-override subprocess in `aschool-flask-1`): create_all → plugins table EMPTY → `refresh_registry()` mirrors the full directory → marketplace lists all 7 moved module plugins (`not_installed`) → install creates SchoolPlugin + runs activate (tables exist) → uninstall sets `uninstalled_at`, data kept → white_label uninstall removes only its own config key → superadmin refresh-registry 200. Also one additive `refresh_registry()` run against the production DB (updates only; no deletions).

## 8. Tests
`backend/tests/test_plugin_registry.py` (mirror upsert/idempotency/delisting, registry-merged catalog, hooks incl. drop-and-recreate checkfirst, blueprint mount-once with (path, method) dup guard, config-schema endpoint, refresh-registry authorization) alongside existing `tests/test_plugins.py` + `tests/test_plugin_aliases.py` — all green.

---

## 17. Catalog consolidation + repricing + sidebar IA (E230-E237, 2026-08-31)

User-approved product decisions implemented on top of the FS-driven catalog
(manifests = source of truth; `refresh_registry()` syncs the DB mirror).

### E230 — Bundle consolidation: seven AI plugins → `ai_suite`
- NEW module `backend/app/plugins/modules/ai_suite/` — premium, **NPR 399/mo
  (3990/yr)**, one "AI Suite" product covering auto-grading, AI tutor, AI tools,
  adaptive learning, insights, advanced analytics and benchmarking. It has **no
  blueprint of its own** — it is a LICENSING GATE: every AI route stays mounted
  from its owning blueprint.
- `PLUGIN_SLUG_ALIASES` (`app/plugins/decorators.py`, mirrored in
  `frontend/lib/plugins.tsx`): `ai_grading, ai_tutor, ai_tools,
  ai_adaptive_learning, ai_insights, benchmarking, advanced_analytics` →
  `ai_suite`. Single-hop expansion (unchanged): an ai_suite install satisfies
  every one of those gates; legacy installs of an individual plugin keep
  passing their own gate because the reverse aliases are kept.
- The seven individual manifests: `published: false` + `deprecated: true`
  (same mechanism as the digital_content→elibrary precedent), sidebar
  `visible_to: []`. Loader skips deprecated manifests for nav; marketplace
  delists them (mirror rows unpublished on next refresh).
- Near-duplicate review verdicts (no other merges — features are distinct):
  - `library` ⇄ `library_management`: same name/feature (clean rename) —
    `library` deprecated, canonical `library_management`, alias kept.
  - `incidents` vs `incident_management`: two tiers of one chain
    (incident_management depends_on incidents, distinct behavior-management
    frontend) — BOTH stay published.
  - `portfolio`/`student_portfolio`: already merged (prior batch).
  - `design_studio`: its own product (aliases removed in E3 — leak fix).
- `social_hub` WITHDRAWN: `published: false` + `deprecated: true`, sidebar
  entry gone, NO alias (feature not replaced). Routes stay mounted and gated
  `@plugin_required("social_hub")` — existing installs keep working; new
  installs refused.

### E231 — Coming-soon tier
`whatsapp_bot`, `gps_tracking`, `conferences` manifests carry
`coming_soon: true` (new manifest field; loader/marketplace aware):
- Cards show a "Coming Soon" badge; install/trial/subscribe disabled — FE
  button disabled with tooltip, BE refuses with 409 (`_coming_soon_guard`) and
  `install_plugin()` refuses at the deepest shared entry-point (API, seeds,
  plan grants).
- Sidebar/nav entries hidden (loader + bottom-nav skip `coming_soon`).
- Routes stay mounted + gated; existing install rows unaffected.

### E232 — Sidebar information-architecture rewrite
Section scheme (backend `SLUG_SECTION_MAP` + manifest `section:` values, FE
`PLUGIN_SECTION_ORDER`): Dashboard → **Academics** (Students, Teachers,
Academics, Timetable, Attendance) → **Learning** (LMS, E-Library, Library,
Assignments, Exams) → **Money** (Fees, Payroll, Admission) → **Operations**
(Inventory, Visitors, Dismissal, Transport, Biometric, Conferences) →
**Communication** (Notices, SMS, WhatsApp) → **Design & Web** (Design Studio,
Website, White Label) → **Insights** (Reports, AI Suite) → **Student Life** →
**Safety & Compliance** → **Growth** → **Admin** (Users, Settings, IEMIS,
Marketplace, Installed Plugins).
- Only INSTALLED+ACTIVE plugins render: `get_sidebar()` expands the
  single-hop acceptable-slug family per manifest and drops anything not in
  the install set (same rule as `@plugin_required`), so a deactivated plugin's
  entry disappears immediately. Coming-soon/deprecated entries never render.
- Exactly ONE "AI Suite" entry (the bundle manifest's sidebar block), shown
  for schools holding either the bundle or any legacy individual AI install.

### E233 — Marketplace shows what is ACTIVE
Individual Plugins tab: filter chips **All (n) / Installed & Active (n) / Not
installed (n)**, an "N plugins active for your school" summary line, and the
existing per-card "Active" badge. SaaS Packages tab prices are derived live
from the catalog (no hardcoded prices) over curated selections — see §17.1.

### E234 — Repricing (manifests = source of truth; DB syncs via refresh_registry)
Three consumer bands — starter ≈ NPR 300-400/mo total, professional ≈ 700,
top ≈ 1,000 for a reasonable selection:
| Band | NPR/mo | NPR/yr | Plugins |
|---|---|---|---|
| starter | 99 | 990 | assignments, elibrary, exams, fees, library_management, sms_notifications, timetable, whatsapp_bot(coming soon), conferences(coming soon at 199) |
| growth | 149-199 | 1490-1990 | admission, alumni, compliance, design_studio, gamification, health_records, hostel, inventory, lms, social_ads, student_portfolio, visitor_management, wellbeing (149); hr_payroll, incident_management (199) |
| premium | 299 | 2990 | biometric, disaster_management, dismissal, emergency, gps_tracking(coming soon), multi_branch, website_builder, white_label |
| bundle | 399 | 3990 | ai_suite (replaces 7 plugins that summed to ≈ 8,000+) |
Yearly ≈ 10× monthly everywhere. Full-selection sanity check: a realistic
school (fees 99 + exams 99 + timetable 99 + sms 99 + admission 149 + lms 149 +
assignments 99 + elibrary 99 + library_management 99 + ai_suite 399) ≈ NPR
1,490 — the top band with AI lands ≈ 1k without AI Suite; **curated SaaS
packages land exactly in-band**: Starter 396 (99×4), Professional 694
(+149+149), Enterprise 991 (+99+99+99). Rationale: previous tiers mixed
199-2999 freely (duplicate slugs at different prices, ai_* individually at
599-1499); the flat per-band pricing makes any combination predictable and
the bundle makes AI pricing simple instead of 7× confusing.

### E235 — Auto-assigned student numbers
`backend/app/services/student_numbers.py`: missing `admission_number`
(school enrollment number) → `{BS_YEAR}-{SCHOOL_SHORT}-{seq:04d}}`
(e.g. `2082-DEMO-0001`, reusing the seeded S6-DEMO-001 style pattern) issued
per school + BS year under a `SELECT … FOR UPDATE` lock on the School row
(concurrency-safe; candidates re-checked before use); missing `roll_number` →
next free roll within the class (max+1, skipping taken values, deleted rows
excluded). Wired into ALL three creation paths: `students.py` POST,
`admission.accepted` auto-enrollment listener (also resolves the applied-for
class so the student gets a roll), and the IEMIS importer (new + re-imported
rows). Caller-provided numbers are never overwritten; unique-violation retries
are unnecessary by construction (the lock serializes issuance).

### E236 — Broken-pages sweep (running-stack probes)
- `/dashboard/elibrary/books` (and `/dashboard/elibrary/papers|resources`)
  were 404s: manifest sidebar subitems pointed at non-existent FE pages.
  All module-manifest `route:` values are now cross-checked against
  `frontend/app/dashboard/**/page.tsx` — every published manifest route
  resolves to a real page (alumni/compliance/emergency/incidents/lms/notices
  are single-page features → subitems dropped; academics/sections →
  class-sections; designer/id-cards → designer/bulk "Bulk ID Cards";
  website-builder/ai-content → ai-builder; reports → exam/expense/teacher).
- SMS page showed "—" credits: `GET /sms/stats` lacked the fields the Credits
  tab renders (`credits_available`, `this_month_sent`, `total_sent`,
  `total_failed`) — added; remaining = plugin config `credits_topup` − used,
  overridden by a live Sparrow gateway balance when configured.
- 1-2 useful demo rows seeded via proper APIs where a page was bare
  (elibrary book; conference slot) — see FIX_STATUS E236 for the log.

### E237 — Login lockout timezone crash
`AuthService._check_lockout` compared a timezone-naive `users.locked_until`
against offset-aware `datetime.now(timezone.utc)` → TypeError → HTTP 500 on
EVERY login for any user with a lockout row (the seed data ships one). The
stored value is now normalized to UTC before comparison.

### Verification
`pytest -q -k "plugin or alias or registry or student"`; superadmin
`POST /api/v1/plugins/refresh-registry` re-syncs the DB mirror (prices, flags)
with zero restarts; `tsc --noEmit` clean; live probes on the docker stack
(:5003 backend / :3003 frontend) as demo admin.
