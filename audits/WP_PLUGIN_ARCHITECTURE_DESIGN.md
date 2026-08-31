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
